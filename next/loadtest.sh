#!/bin/bash

# E-commerce Load Test Script
# Tests the /sellers page only: it is the render-heavy route (~147 KB of HTML)
# where SSR templates make a measurable difference. Produces verbose output for
# debugging.

set -e

# Ensure LoadBalancer URLs are set
if [ -z "$URL_NODE" ] || [ -z "$URL_PM2" ] || [ -z "$URL_WATT" ]; then
  echo "Error: URL_NODE, URL_PM2, and URL_WATT environment variables must be set"
  exit 1
fi

RUN_ORDER="${RUN_ORDER:-pm2,watt,node}"
# Peak arrival rate of the main test. /sellers costs ~2.5x the CPU of the old
# mixed workload, whose knee was 750-800 req/s on 6 vCPU per runner, so the
# knee for this test is ~300 req/s and the default sits below it.
TARGET_RATE="${TARGET_RATE:-200}"

run_named() {
  local phase=$1
  local runner=$2
  local url

  case "$runner" in
    node) url="$URL_NODE" ;;
    pm2) url="$URL_PM2" ;;
    watt) url="$URL_WATT" ;;
    *) echo "Error: RUN_ORDER contains unknown runner: $runner" >&2; exit 1 ;;
  esac

  if [ "$phase" = "warmup" ]; then
    run_warmup "${runner^^}" "$url"
  else
    run_ecommerce_test "${runner^^}" "$url"
  fi
}

echo "========================================================================"
echo "E-COMMERCE LOAD TEST CONFIGURATION"
echo "========================================================================"
echo "URL_NODE: $URL_NODE"
echo "URL_PM2:  $URL_PM2"
echo "URL_WATT: $URL_WATT"
echo ""
echo "Test Parameters:"
echo "  - Initial NLB warm-up: 60s per endpoint (10->500 req/s ramp)"
echo "  - Pre-test warm-up: 20s per endpoint (50->400 req/s ramp)"
echo "  - Post-warmup wait: 60s before main test"
echo "  - Test duration: 60s ramp-up (0->${TARGET_RATE} req/s) + 120s @ ${TARGET_RATE} req/s"
echo "  - Cooldown: 480s between tests"
echo "  - Scenario: /sellers only (render-heavy page)"
echo "========================================================================"

# Pre-flight connectivity check
echo ""
echo "========================================================================"
echo "PRE-FLIGHT CONNECTIVITY CHECK"
echo "========================================================================"

check_endpoint() {
  local name=$1
  local url=$2
  local max_retries=30
  local retry_delay=10

  echo "Checking $name at $url..."
  echo "  Will retry up to $max_retries times with ${retry_delay}s delay..."

  for ((i=1; i<=max_retries; i++)); do
    local result=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 --max-time 30 "$url" 2>&1 || echo "000")

    if [[ "$result" == "200" ]]; then
      echo "  $name: OK (HTTP 200 on attempt $i)"
      return 0
    fi

    if [[ $i -lt $max_retries ]]; then
      echo "  Attempt $i/$max_retries: HTTP $result - retrying in ${retry_delay}s..."
      sleep $retry_delay
    fi
  done

  echo "  $name: FAILED after $max_retries attempts"
  echo "  Last response code: $result"
  echo "  Trying verbose curl for diagnostics:"
  curl -v --connect-timeout 10 --max-time 30 "$url" 2>&1 || true
  return 1
}

check_endpoint "PM2" "$URL_PM2/sellers"
check_endpoint "Watt" "$URL_WATT/sellers"
check_endpoint "Node" "$URL_NODE/sellers"

echo "========================================================================"

# Warm-up k6 script - gradual ramp to warm up NLB and connection pools
K6_WARMUP_SCRIPT=$(cat <<'EOF'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    warmup: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '15s', target: 100 },
        { duration: '15s', target: 300 },
        { duration: '15s', target: 500 },
        { duration: '15s', target: 500 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get(__ENV.TARGET, {
    timeout: "10s",
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
EOF
)

# E-commerce k6 test script - /sellers only
K6_ECOMMERCE_SCRIPT=$(cat <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const requestErrors = new Counter('request_errors');
const successfulRequests = new Counter('successful_requests');
const responseTime = new Trend('response_time_ms');

const TARGET_RATE = parseInt(__ENV.TARGET_RATE || '200', 10);
const ROUTES = ['sellers_list'];

// k6 only reports tagged sub-metrics that a threshold references, so declare a
// never-failing threshold per route to get per-route latency and counts.
const routeThresholds = {};
for (const name of ROUTES) {
  routeThresholds['http_req_duration{name:' + name + '}'] = ['p(99)<600000'];
  routeThresholds['http_req_failed{name:' + name + '}'] = ['rate<=1'];
  routeThresholds['http_reqs{name:' + name + '}'] = ['count>=0'];
}

export const options = {
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  scenarios: {
    mixed_load: {
      executor: 'ramping-arrival-rate',
      startRate: 0,
      timeUnit: '1s',
      preAllocatedVUs: 2000,
      maxVUs: 20000,
      stages: [
        { duration: '60s', target: TARGET_RATE },  // Ramp up over 60s
        { duration: '120s', target: TARGET_RATE }, // Constant at TARGET_RATE req/s for 120s
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],
    ...routeThresholds,
  },
};

// Helper to make request and track metrics
function makeRequest(url, name) {
  const start = Date.now();
  const res = http.get(url, { timeout: "10s", tags: { name: name }, headers: { 'Accept-Encoding': 'gzip' } });
  const duration = Date.now() - start;

  responseTime.add(duration);

  if (res.status === 200) {
    successfulRequests.add(1);
  } else {
    requestErrors.add(1);
  }

  return res;
}

export default function () {
  makeRequest(__ENV.TARGET + '/sellers', 'sellers_list');
}

export function handleSummary(data) {
  const success = data.metrics.successful_requests ? data.metrics.successful_requests.values.count : 0;
  const errors = data.metrics.request_errors ? data.metrics.request_errors.values.count : 0;
  const total = success + errors;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(2) : 0;
  const rt = data.metrics.response_time_ms ? data.metrics.response_time_ms.values : null;

  console.log('\n========================================');
  console.log('E-COMMERCE LOAD TEST SUMMARY');
  console.log('========================================');
  console.log('Total Requests:    ' + total);
  console.log('Successful:        ' + success);
  console.log('Errors:            ' + errors);
  console.log('Success Rate:      ' + successRate + '%');
  console.log('');
  if (rt) {
    console.log('Response Times (ms):');
    console.log('  Average:         ' + rt.avg.toFixed(2));
    console.log('  Min:             ' + rt.min.toFixed(2));
    console.log('  Median:          ' + rt.med.toFixed(2));
    console.log('  Max:             ' + rt.max.toFixed(2));
    console.log('  p(90):           ' + rt['p(90)'].toFixed(2));
    console.log('  p(95):           ' + rt['p(95)'].toFixed(2));
    console.log('  p(99):           ' + rt['p(99)'].toFixed(2));
  }
  console.log('');
  console.log('Per route (http_req_duration, ms):');
  console.log('  route         reqs    fail%     avg     med   p(99)');
  for (const name of ROUTES) {
    const d = data.metrics['http_req_duration{name:' + name + '}'];
    const n = data.metrics['http_reqs{name:' + name + '}'];
    const f = data.metrics['http_req_failed{name:' + name + '}'];
    if (!d || !n) continue;
    const v = d.values;
    console.log('  ' + name.padEnd(12) + String(n.values.count).padStart(7) +
      ((f ? f.values.rate * 100 : 0).toFixed(2) + '%').padStart(9) +
      v.avg.toFixed(0).padStart(8) + v.med.toFixed(0).padStart(8) + v['p(99)'].toFixed(0).padStart(8));
  }
  console.log('========================================\n');

  return {};
}
EOF
)

run_warmup() {
  local name=$1
  local url=$2
  echo ""
  echo "========================================================================"
  echo "NLB WARM-UP: $name"
  echo "Target: $url"
  echo "Duration: 60s (10->500 req/s ramp)"
  echo "========================================================================"
  echo "$K6_WARMUP_SCRIPT" | k6 run --quiet -e TARGET="$url/sellers" - || echo "WARN: warm-up for $name exited nonzero"
  echo "Warm-up complete for $name"
}

run_pre_test_warmup() {
  local name=$1
  local url=$2
  echo ""
  echo "------------------------------------------------------------------------"
  echo "Pre-test warm-up: $name (20s @ 50->400 req/s)"
  echo "------------------------------------------------------------------------"
  echo "$K6_WARMUP_SCRIPT" | k6 run --quiet -e TARGET="$url/sellers" - --duration 20s || echo "WARN: pre-test warm-up for $name exited nonzero"
}

run_ecommerce_test() {
  local name=$1
  local url=$2
  echo ""
  echo "========================================================================"
  echo "E-COMMERCE LOAD TEST: $name"
  echo "Target: $url"
  echo "Duration: 60s ramp-up + 120s @ ${TARGET_RATE} req/s (/sellers only)"
  echo "========================================================================"

  # Pre-test warm-up
  run_pre_test_warmup "$name" "$url"

  echo ""
  echo "Waiting 60s before main load test..."
  sleep 60

  echo ""
  echo "Starting main load test..."
  echo "$K6_ECOMMERCE_SCRIPT" | k6 run -e TARGET="$url" -e TARGET_RATE="$TARGET_RATE" - || echo "WARN: main load test for $name exited nonzero"

  echo ""
  echo "Test complete for $name"
}

# Phase 1: NLB Warm-up for all endpoints
echo ""
echo "========================================================================"
echo "PHASE 1: NLB WARM-UP (ALL ENDPOINTS)"
echo "========================================================================"
IFS=',' read -r -a runners <<< "$RUN_ORDER"
for runner in "${runners[@]}"; do
  run_named warmup "$runner"
done

echo ""
echo "========================================================================"
echo "NLB warm-up complete. Waiting 60s before starting tests..."
echo "========================================================================"
sleep 60

# Phase 2: Run load tests
echo ""
echo "========================================================================"
echo "PHASE 2: E-COMMERCE LOAD TESTS"
echo "========================================================================"

last_runner_index=$((${#runners[@]} - 1))
for runner_index in "${!runners[@]}"; do
  runner="${runners[$runner_index]}"
  run_named test "$runner"
  if type upload_to_s3 &>/dev/null; then
    upload_to_s3 "$runner"
  fi
  if [ "$runner_index" -ne "$last_runner_index" ]; then
    echo ""
    echo "Cooldown: 480s before next test..."
    sleep 480
  fi
done

echo ""
echo "========================================================================"
echo "ALL E-COMMERCE LOAD TESTS COMPLETE"
echo "========================================================================"
