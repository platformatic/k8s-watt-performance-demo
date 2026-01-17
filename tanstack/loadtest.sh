#!/bin/bash

# k6 load test script
# Tests: PM2, Watt, Single Node via LoadBalancer URLs
# Produces verbose output for debugging

set -e

# Ensure LoadBalancer URLs are set
if [ -z "$URL_NODE" ] || [ -z "$URL_PM2" ] || [ -z "$URL_WATT" ]; then
  echo "Error: URL_NODE, URL_PM2, and URL_WATT environment variables must be set"
  exit 1
fi

echo "========================================================================"
echo "LOAD TEST CONFIGURATION"
echo "========================================================================"
echo "URL_NODE: $URL_NODE"
echo "URL_PM2:  $URL_PM2"
echo "URL_WATT: $URL_WATT"
echo ""
echo "Test Parameters:"
echo "  - Initial NLB warm-up: 60s per endpoint (10->500 req/s ramp)"
echo "  - Pre-test warm-up: 20s per endpoint (50->400 req/s ramp)"
echo "  - Test duration: 120s per service @ 5000 req/s"
echo "  - Cooldown: 480s between tests"
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

check_endpoint "PM2" "$URL_PM2/"
check_endpoint "Watt" "$URL_WATT/"
check_endpoint "Node" "$URL_NODE/"

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
        { duration: '15s', target: 100 },   // Ramp to 100 req/s
        { duration: '15s', target: 300 },   // Ramp to 300 req/s
        { duration: '15s', target: 500 },   // Ramp to 500 req/s
        { duration: '15s', target: 500 },   // Hold at 500 req/s
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.1'],  // Allow up to 10% failures during warmup
  },
};

export default function () {
  const res = http.get(__ENV.TARGET, {
    timeout: "10s",
  });
  check(res, {
    'warmup status ok': (r) => r.status === 200,
  });
}
EOF
)

# Function to warm up a single endpoint
warmup_endpoint() {
  local name=$1
  local url=$2

  echo ""
  echo "--- Warming up $name at $url ---"
  echo "  Ramping: 10 -> 100 -> 300 -> 500 req/s over 60s"
  echo "  Started at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

  echo "$K6_WARMUP_SCRIPT" | k6 run --quiet --env TARGET="$url" - 2>&1 | tail -5

  echo "  Warmup completed at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "  Settling for 10s..."
  sleep 10
}

# Warm up ALL endpoints before any tests to ensure NLB is scaled
warmup_all_endpoints() {
  echo ""
  echo "========================================================================"
  echo "NLB WARM-UP PHASE"
  echo "========================================================================"
  echo "Warming up all endpoints to ensure NLB has scaled properly."
  echo "This prevents cold-start bias in benchmark results."
  echo ""

  warmup_endpoint "PM2" "$URL_PM2/"
  warmup_endpoint "Watt" "$URL_WATT/"
  warmup_endpoint "Node" "$URL_NODE/"

  echo ""
  echo "========================================================================"
  echo "NLB WARM-UP COMPLETE"
  echo "========================================================================"
  echo "All endpoints warmed up. Starting benchmark tests in 30s..."
  sleep 30
}

# Short k6 script for quick pre-test warm-up (after cooldown)
K6_QUICK_WARMUP=$(cat <<'EOF'
import http from 'k6/http';
export const options = {
  scenarios: {
    quick_warmup: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 300,
      stages: [
        { duration: '10s', target: 200 },
        { duration: '10s', target: 400 },
      ],
    },
  },
};
export default function () {
  http.get(__ENV.TARGET, { timeout: "5s" });
}
EOF
)

# Quick warm-up before each test (reconnect after cooldown)
quick_warmup() {
  local name=$1
  local url=$2

  echo ""
  echo "--- Quick warm-up: $name ---"
  echo "  Ramping 50 -> 400 req/s over 20s to re-establish connections"
  echo "$K6_QUICK_WARMUP" | k6 run --quiet --env TARGET="$url" - 2>&1 | tail -3
  echo "  Settling for 5s..."
  sleep 5
}

# k6 test script with detailed metrics
K6_SCRIPT=$(cat <<'EOF'
import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics for detailed tracking
const errorCounts = new Counter('request_errors');
const successCount = new Counter('successful_requests');
const responseTime = new Trend('response_time_ms');

export const options = {
  throw: true,
  scenarios: {
    constant_arrival_rate: {
      executor: 'constant-arrival-rate',
      duration: '120s',
      rate: 5000,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 10000,
    },
  },
  // More detailed summary output
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

const countMessages = [
  'connection refused',
  'request timeout',
  'context deadline exceeded',
  'connection reset',
  'no such host',
  'EOF',
];

export default function () {
  try {
    const start = Date.now();
    const res = http.get(__ENV.TARGET, {
      timeout: "5s",
      tags: { name: 'homepage' },
    });
    const duration = Date.now() - start;

    responseTime.add(duration);

    const passed = check(res, {
      'status is 200': (r) => r.status === 200,
      'response has body': (r) => r.body && r.body.length > 0,
    });

    if (passed) {
      successCount.add(1);
    }
  } catch (err) {
    if (err) {
      let found = false;
      const errMsg = err.value ? err.value.toString() : err.toString();

      for (let msg of countMessages) {
        if (errMsg.toLowerCase().includes(msg.toLowerCase())) {
          errorCounts.add(1, { errorType: msg });
          found = true;
          break;
        }
      }

      if (!found) {
        errorCounts.add(1, { errorType: 'Unknown', message: errMsg.substring(0, 100) });
      }
    }
  }
}

export function handleSummary(data) {
  // Print detailed summary to console
  console.log('\n========== DETAILED METRICS ==========');

  if (data.metrics.http_req_duration) {
    const d = data.metrics.http_req_duration.values;
    console.log(`HTTP Request Duration:`);
    console.log(`  avg=${d.avg.toFixed(2)}ms min=${d.min.toFixed(2)}ms max=${d.max.toFixed(2)}ms`);
    console.log(`  p90=${d['p(90)'].toFixed(2)}ms p95=${d['p(95)'].toFixed(2)}ms p99=${d['p(99)'].toFixed(2)}ms`);
  }

  if (data.metrics.http_reqs) {
    console.log(`Total Requests: ${data.metrics.http_reqs.values.count}`);
    console.log(`Requests/sec: ${data.metrics.http_reqs.values.rate.toFixed(2)}`);
  }

  if (data.metrics.http_req_failed) {
    const failed = data.metrics.http_req_failed.values;
    console.log(`Failed Requests: ${(failed.rate * 100).toFixed(2)}%`);
  }

  if (data.metrics.successful_requests) {
    console.log(`Successful Requests: ${data.metrics.successful_requests.values.count}`);
  }

  if (data.metrics.request_errors) {
    console.log(`Error Count: ${data.metrics.request_errors.values.count}`);
  }

  if (data.metrics.vus_max) {
    console.log(`Max VUs: ${data.metrics.vus_max.values.max}`);
  }

  if (data.metrics.dropped_iterations) {
    console.log(`Dropped Iterations: ${data.metrics.dropped_iterations.values.count}`);
  }

  console.log('=======================================\n');

  return {
    stdout: textSummary(data, { indent: '  ', enableColors: false }),
  };
}

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
EOF
)

# Function to run k6 test with verbose output
run_k6_test() {
  local name=$1
  local url=$2
  local test_num=$3

  echo ""
  echo "########################################################################"
  echo "TEST $test_num: $name"
  echo "URL: $url"
  echo "Started at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "########################################################################"

  # Show system stats before test
  echo ""
  echo "--- System Stats Before Test ---"
  free -h 2>/dev/null || true
  echo ""

  # --quiet removes progress bar updates (which truncate EC2 console output) but keeps the summary
  echo "$K6_SCRIPT" | k6 run --quiet --env TARGET="$url" --summary-trend-stats="avg,min,med,max,p(90),p(95),p(99)" -

  local exit_code=$?

  echo ""
  echo "--- Test Completed ---"
  echo "Finished at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Exit code: $exit_code"

  # Show system stats after test
  echo ""
  echo "--- System Stats After Test ---"
  free -h 2>/dev/null || true
  echo ""

  return $exit_code
}

echo ""
echo "========================================================================"
echo "STARTING BENCHMARK TESTS"
echo "========================================================================"

# Warm up all endpoints first to ensure NLB is ready
warmup_all_endpoints

# Test 1: PM2
quick_warmup "PM2" "$URL_PM2/"
run_k6_test "PM2 (2 workers)" "$URL_PM2/" 1

echo ""
echo "========================================================================"
echo "COOLDOWN: 480 seconds before next test"
echo "========================================================================"
sleep 480

# Test 2: Watt
quick_warmup "Watt" "$URL_WATT/"
run_k6_test "Watt (2 workers)" "$URL_WATT/" 2

echo ""
echo "========================================================================"
echo "COOLDOWN: 480 seconds before next test"
echo "========================================================================"
sleep 480

# Test 3: Single Node
quick_warmup "Node" "$URL_NODE/"
run_k6_test "Single Node" "$URL_NODE/" 3

echo ""
echo "========================================================================"
echo "ALL TESTS COMPLETED"
echo "========================================================================"
