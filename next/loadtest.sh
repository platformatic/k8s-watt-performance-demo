#!/bin/bash

# E-commerce Load Test Script
# Tests realistic e-commerce scenarios: homepage, search, card details, game browsing, sellers
# Sweep: Node and Watt runtimes, each with useNodeStreams OFF and ON.
# Produces verbose output for debugging

set -e

# Ensure LoadBalancer URLs are set (4 variants in a single sweep)
if [ -z "$URL_NODE" ] || [ -z "$URL_NODE_STREAM" ] || [ -z "$URL_WATT" ] || [ -z "$URL_WATT_STREAM" ]; then
  echo "Error: URL_NODE, URL_NODE_STREAM, URL_WATT, and URL_WATT_STREAM environment variables must be set"
  exit 1
fi

# Variants tested in order: "Label|URL|s3-phase-tag"
VARIANTS=(
  "Node (streams OFF)|$URL_NODE|node-off"
  "Node (streams ON)|$URL_NODE_STREAM|node-on"
  "Watt (streams OFF)|$URL_WATT|watt-off"
  "Watt (streams ON)|$URL_WATT_STREAM|watt-on"
)

echo "========================================================================"
echo "E-COMMERCE LOAD TEST CONFIGURATION (useNodeStreams sweep)"
echo "========================================================================"
echo "URL_NODE:        $URL_NODE        (Node, useNodeStreams OFF)"
echo "URL_NODE_STREAM: $URL_NODE_STREAM (Node, useNodeStreams ON)"
echo "URL_WATT:        $URL_WATT        (Watt, useNodeStreams OFF)"
echo "URL_WATT_STREAM: $URL_WATT_STREAM (Watt, useNodeStreams ON)"
echo ""
echo "Test Parameters:"
echo "  - Initial NLB warm-up: 60s per endpoint (10->500 req/s ramp)"
echo "  - Pre-test warm-up: 20s per endpoint (50->400 req/s ramp)"
echo "  - Post-warmup wait: 60s before main test"
echo "  - Test duration: 60s ramp-up (0->1000 req/s) + 120s @ 1000 req/s"
echo "  - Cooldown: 480s between tests"
echo "  - Scenarios: Homepage, Search, Card Detail, Game Browse, Sellers"
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

for variant in "${VARIANTS[@]}"; do
  IFS='|' read -r v_name v_url v_phase <<< "$variant"
  check_endpoint "$v_name" "$v_url/"
done

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
    http_req_failed: ['rate<0.1'],
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

# E-commerce k6 test script - mixed realistic scenarios
K6_ECOMMERCE_SCRIPT=$(cat <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// Custom metrics
const requestErrors = new Counter('request_errors');
const successfulRequests = new Counter('successful_requests');
const responseTime = new Trend('response_time_ms');

// Sample data for realistic requests
const SEARCH_QUERIES = ['pikachu', 'charizard', 'dragon', 'rare', 'ex', 'magic', 'yugioh'];
const GAME_SLUGS = ['pokemon', 'magic', 'yugioh', 'digimon', 'onepiece'];
const SET_SLUGS = ['scarlet-violet', 'paldea-evolved', 'murders-at-karlov-manor', 'phantom-nightmare'];

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
        { duration: '60s', target: 1000 },  // Ramp up over 60s
        { duration: '120s', target: 1000 }, // Constant at 1000 req/s for 120s
      ],
    },
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
  const BASE = __ENV.TARGET;

  // Randomly select scenario (weighted distribution)
  const rand = Math.random();

  if (rand < 0.20) {
    // 20% - Homepage
    makeRequest(BASE + '/', 'homepage');
  } else if (rand < 0.45) {
    // 25% - Search with query
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
    const page = Math.floor(Math.random() * 5) + 1;
    makeRequest(BASE + '/search?q=' + query + '&page=' + page, 'search');
  } else if (rand < 0.65) {
    // 20% - Card detail (random card ID)
    const gameId = GAME_SLUGS[Math.floor(Math.random() * GAME_SLUGS.length)];
    const setNum = String(Math.floor(Math.random() * 10) + 1).padStart(2, '0');
    const cardNum = String(Math.floor(Math.random() * 200) + 1).padStart(3, '0');
    const cardId = gameId + '-set-' + setNum + '-' + cardNum;
    makeRequest(BASE + '/cards/' + cardId, 'card_detail');
  } else if (rand < 0.80) {
    // 15% - Game detail
    const gameSlug = GAME_SLUGS[Math.floor(Math.random() * GAME_SLUGS.length)];
    makeRequest(BASE + '/games/' + gameSlug, 'game_detail');
  } else if (rand < 0.90) {
    // 10% - Games list
    makeRequest(BASE + '/games', 'games_list');
  } else if (rand < 0.95) {
    // 5% - Sellers list
    makeRequest(BASE + '/sellers', 'sellers_list');
  } else {
    // 5% - Set detail (random set)
    const setSlug = SET_SLUGS[Math.floor(Math.random() * SET_SLUGS.length)];
    const page = Math.floor(Math.random() * 3) + 1;
    makeRequest(BASE + '/sets/' + setSlug + '?page=' + page, 'set_detail');
  }
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
  echo "$K6_WARMUP_SCRIPT" | k6 run --quiet -e TARGET="$url" -
  echo "Warm-up complete for $name"
}

run_pre_test_warmup() {
  local name=$1
  local url=$2
  echo ""
  echo "------------------------------------------------------------------------"
  echo "Pre-test warm-up: $name (20s @ 50->400 req/s)"
  echo "------------------------------------------------------------------------"
  echo "$K6_WARMUP_SCRIPT" | k6 run --quiet -e TARGET="$url" - --duration 20s
}

run_ecommerce_test() {
  local name=$1
  local url=$2
  echo ""
  echo "========================================================================"
  echo "E-COMMERCE LOAD TEST: $name"
  echo "Target: $url"
  echo "Duration: 60s ramp-up + 120s @ 1000 req/s (mixed scenarios)"
  echo "========================================================================"

  # Pre-test warm-up
  run_pre_test_warmup "$name" "$url"

  echo ""
  echo "Waiting 60s before main load test..."
  sleep 60

  echo ""
  echo "Starting main load test..."
  echo "$K6_ECOMMERCE_SCRIPT" | k6 run -e TARGET="$url" -

  echo ""
  echo "Test complete for $name"
}

# Phase 1: NLB Warm-up for all endpoints
echo ""
echo "========================================================================"
echo "PHASE 1: NLB WARM-UP (ALL ENDPOINTS)"
echo "========================================================================"
for variant in "${VARIANTS[@]}"; do
  IFS='|' read -r v_name v_url v_phase <<< "$variant"
  run_warmup "$v_name" "$v_url"
done

echo ""
echo "========================================================================"
echo "NLB warm-up complete. Waiting 60s before starting tests..."
echo "========================================================================"
sleep 60

# Phase 2: Run load tests sequentially for each variant.
# Repeat the whole 4-variant sequence REPEATS times (interleaved) so run-to-run
# drift is spread evenly across all arms, then average offline to bound noise.
REPEATS="${REPEATS:-1}"
echo ""
echo "========================================================================"
echo "PHASE 2: E-COMMERCE LOAD TESTS (${REPEATS} repeat(s), interleaved)"
echo "========================================================================"

num_variants=${#VARIANTS[@]}
for round in $(seq 1 "$REPEATS"); do
  echo ""
  echo "########################################################################"
  echo "ROUND ${round}/${REPEATS}"
  echo "########################################################################"

  for idx in "${!VARIANTS[@]}"; do
    IFS='|' read -r v_name v_url v_phase <<< "${VARIANTS[$idx]}"

    run_ecommerce_test "$v_name (round ${round}/${REPEATS})" "$v_url"

    # Upload results to S3 after each test, tagged by variant and round.
    if type upload_to_s3 &>/dev/null; then
      upload_to_s3 "${v_phase}-r${round}"
    fi

    # Cooldown before the next test, unless this is the very last test overall.
    if [[ $round -lt $REPEATS || $((idx + 1)) -lt $num_variants ]]; then
      echo ""
      echo "Cooldown: 480s before next test..."
      sleep 480
    fi
  done
done

echo ""
echo "========================================================================"
echo "ALL E-COMMERCE LOAD TESTS COMPLETE (${REPEATS} round(s))"
echo "========================================================================"
