#!/bin/bash

# Scaler Benchmark Load Test Script
# Constant load against a single endpoint to test scaler behavior
# Called once per scaler by the benchmark orchestrator

set -e

# Ensure LoadBalancer URL is set
if [ -z "$URL_APP" ]; then
  echo "Error: URL_APP environment variable must be set"
  exit 1
fi

echo "========================================================================"
echo "SCALER BENCHMARK LOAD TEST"
echo "========================================================================"
echo "URL_APP: $URL_APP"
echo "SCALER: ${SCALER_NAME:-unknown}"
echo ""
echo "Test Parameters:"
echo "  - Rate: 1000 req/s constant"
echo "  - Duration: 3 minutes"
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

check_endpoint "App" "$URL_APP/"

echo "========================================================================"

# E-commerce k6 test script - constant rate, mixed realistic scenarios
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
  noConnectionReuse: true,
  scenarios: {
    ramping_load: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 2000,
      maxVUs: 2000,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '20s', target: 200 },
        { duration: '20s', target: 300 },
        { duration: '20s', target: 400 },
        { duration: '20s', target: 500 },
        { duration: '20s', target: 600 },
        { duration: '20s', target: 700 },
        { duration: '20s', target: 800 },
        { duration: '40s', target: 800 },
      ],
    },
  },
};

// Helper to make request and track metrics
function makeRequest(url, name) {
  const start = Date.now();
  const res = http.get(url, { timeout: "10s", tags: { name: name } });
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
  const total = data.metrics.successful_requests.values.count + data.metrics.request_errors.values.count;
  const success = data.metrics.successful_requests.values.count;
  const errors = data.metrics.request_errors.values.count;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(2) : 0;

  console.log('\n========================================');
  console.log('LOAD TEST SUMMARY');
  console.log('========================================');
  console.log('Total Requests:    ' + total);
  console.log('Successful:        ' + success);
  console.log('Errors:            ' + errors);
  console.log('Success Rate:      ' + successRate + '%');
  console.log('');
  console.log('Response Times (ms):');
  console.log('  Average:         ' + data.metrics.response_time_ms.values.avg.toFixed(2));
  console.log('  Min:             ' + data.metrics.response_time_ms.values.min.toFixed(2));
  console.log('  Median:          ' + data.metrics.response_time_ms.values.med.toFixed(2));
  console.log('  Max:             ' + data.metrics.response_time_ms.values.max.toFixed(2));
  console.log('  p(90):           ' + data.metrics.response_time_ms.values['p(90)'].toFixed(2));
  console.log('  p(95):           ' + data.metrics.response_time_ms.values['p(95)'].toFixed(2));
  console.log('  p(99):           ' + data.metrics.response_time_ms.values['p(99)'].toFixed(2));
  console.log('========================================\n');

  return {};
}
EOF
)

# Run constant load test
echo ""
echo "========================================================================"
echo "STARTING CONSTANT LOAD TEST (scaler: ${SCALER_NAME:-unknown})"
echo "Start time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================================================"

echo "$K6_ECOMMERCE_SCRIPT" | k6 run -e TARGET="$URL_APP" -

echo ""
echo "========================================================================"
echo "LOAD TEST COMPLETE (scaler: ${SCALER_NAME:-unknown})"
echo "========================================================================"
