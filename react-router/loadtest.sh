#!/bin/bash

# k6 load test script - equivalent to loadtest.sh (ab benchmark)
# ab params: -n 50000 -c 1000 -s 1
# This translates to: 50,000 total requests with 1,000 virtual users

set -e

# Ensure TARGET_URL is set
if [ -z "$TARGET_URL" ]; then
  echo "Error: TARGET_URL environment variable must be set"
  exit 1
fi

# k6 test script
K6_SCRIPT=$(cat <<'EOF'
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  throw: true,
  scenarios: {
    constant_arrival_rate: {
      executor: 'constant-arrival-rate',

      duration: '120s',

      rate: 1000,

      timeUnit: '1s',

      preAllocatedVUs: 1000,
    },
  },
  // noConnectionReuse: true, // Disable HTTP keep-alive, create new connection for each request
};

const errorCounts = new Counter('request_errors')

export default function () {
  const countMessages = [
    'connection refused',
    'request timeout'
  ]

  try {
    const res = http.get(__ENV.TARGET, {
      timeout: "5s"
    });
    check(res, {
      'status is 200': (r) => r.status === 200,
    });
  } catch (err) {
    if (err) {
      let found = false
      const errMsg = err.value.toString()

      for (let msg of countMessages) {
        if (errMsg.includes(msg)) {
          errorCounts.add(1, { errorType: msg })
          found = true
          break
        }
      }

      if (!found) {
        errorCounts.add(1, { errorType: 'Unknown', message: errMsg })
      }
    }
  }
}
EOF
)

# Function to run k6 test
run_k6_test() {
  local name=$1
  local url=$2

  echo "== $name =="
  echo "$K6_SCRIPT" | k6 run --env TARGET="$url" --quiet -
}

# Run tests against each service
run_k6_test "PM2" "http://$TARGET_URL:30001/"
sleep 480

run_k6_test "Watt" "http://$TARGET_URL:30002/"
sleep 480

run_k6_test "Single Node" "http://$TARGET_URL:30000/"
