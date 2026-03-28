#!/bin/zsh
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
K6_DIR="$REPO_DIR/k6"
RESULTS_DIR="$REPO_DIR/results"
DOCKER_DIR="$REPO_DIR/docker"
RUNS=${RUNS:-3}
RATE=${RATE:-1000}
DURATION=${DURATION:-30s}
NETWORK="bench-net"

# CPU pinning: server gets 4 cores, k6 gets 2 cores
SERVER_CPUS="0-3"
K6_CPUS="4-5"

mkdir -p "$RESULTS_DIR"

cleanup() {
  docker rm -f bench-server bench-k6 2>/dev/null
  docker network rm "$NETWORK" 2>/dev/null
}
trap cleanup EXIT

# Create isolated network
docker network rm "$NETWORK" 2>/dev/null
docker network create "$NETWORK" >/dev/null 2>&1

echo "=== Docker Benchmark ==="
echo "Runs: $RUNS | Rate: $RATE req/s | Duration: $DURATION"
echo "Server CPUs: $SERVER_CPUS | k6 CPUs: $K6_CPUS"
echo ""

# Build k6 image once
echo "Building k6 image..."
docker build -q -t bench-k6 -f - "$REPO_DIR" << 'DOCK'
FROM grafana/k6:latest
COPY k6/ /scripts/
DOCK

run_benchmark() {
  local name=$1
  local image_tag=$2
  local dockerfile=$3

  echo ""
  echo "=========================================="
  echo "  $name ($RUNS runs @ ${RATE} req/s)"
  echo "=========================================="

  # Build framework image
  echo "Building $name image..."
  docker build -q -t "$image_tag" -f "$dockerfile" "$REPO_DIR" >/dev/null

  # Start server container with CPU pinning
  docker rm -f bench-server 2>/dev/null
  docker run -d --name bench-server \
    --cpuset-cpus="$SERVER_CPUS" \
    --memory=4g \
    --network="$NETWORK" \
    -e PORT=3000 \
    -e DB_DELAY_ENABLED=true \
    "$image_tag" >/dev/null

  # Wait for server
  echo "Waiting for $name..."
  local max_attempts=30
  for i in $(seq 1 $max_attempts); do
    if docker run --rm --network="$NETWORK" curlimages/curl \
      -s -o /dev/null -w "%{http_code}" "http://bench-server:3000/" 2>/dev/null | grep -q "200"; then
      break
    fi
    if [ $i -eq $max_attempts ]; then
      echo "ERROR: $name did not start within ${max_attempts}s"
      docker logs bench-server 2>&1 | tail -10
      docker rm -f bench-server 2>/dev/null
      return 1
    fi
    sleep 1
  done
  echo "$name is ready"

  # Warmup
  echo "Warming up $name..."
  docker run --rm --name bench-k6 \
    --cpuset-cpus="$K6_CPUS" \
    --network="$NETWORK" \
    -e BASE_URL="http://bench-server:3000" \
    bench-k6 run --quiet /scripts/warmup.js 2>&1 | grep -E 'http_req_duration|iterations'

  # Benchmark runs
  for run in $(seq 1 $RUNS); do
    local outfile="/results/${name}-run${run}.json"
    echo "  Run $run/$RUNS..."
    docker run --rm --name bench-k6 \
      --cpuset-cpus="$K6_CPUS" \
      --network="$NETWORK" \
      -v "$RESULTS_DIR:/results" \
      -e BASE_URL="http://bench-server:3000" \
      -e RATE=$RATE \
      -e DURATION=$DURATION \
      -e OUT_FILE="$outfile" \
      bench-k6 run --quiet /scripts/ecommerce.js 2>&1 | grep -E 'http_req_duration|response_time|request_errors|successful'
    sleep 2
  done

  docker rm -f bench-server 2>/dev/null
  echo "$name complete."
}

# ── Build & Run Each Framework ──

run_benchmark "next.js" "bench-next" "$DOCKER_DIR/Dockerfile.next"
run_benchmark "tanstack-start" "bench-tanstack" "$DOCKER_DIR/Dockerfile.tanstack"
run_benchmark "nuxt" "bench-nuxt" "$DOCKER_DIR/Dockerfile.nuxt"
run_benchmark "sveltekit" "bench-svelte" "$DOCKER_DIR/Dockerfile.svelte"
run_benchmark "vertz-bun" "bench-vertz-bun" "$DOCKER_DIR/Dockerfile.vertz-bun"
run_benchmark "vertz-node" "bench-vertz-node" "$DOCKER_DIR/Dockerfile.vertz-node"
run_benchmark "hono" "bench-hono" "$DOCKER_DIR/Dockerfile.hono"

# ── Results Table ──

echo ""
echo "=========================================="
echo "  RESULTS (Docker, CPU-pinned)"
echo "=========================================="
echo ""

printf "%-18s %8s %8s %8s %8s %8s %8s %8s\n" \
  "Framework" "Avg(ms)" "Med(ms)" "P90(ms)" "P95(ms)" "RPS" "Errors" "Iters"
printf "%-18s %8s %8s %8s %8s %8s %8s %8s\n" \
  "-----------------" "-------" "-------" "-------" "-------" "-------" "-------" "-------"

for fw in "next.js" "tanstack-start" "nuxt" "sveltekit" "vertz-bun" "vertz-node" "hono"; do
  sum_avg=0; sum_med=0; sum_p90=0; sum_p95=0; sum_rps=0; sum_errors=0; sum_iters=0
  count=0

  for run in $(seq 1 $RUNS); do
    f="$RESULTS_DIR/${fw}-run${run}.json"
    if [ ! -f "$f" ]; then continue; fi
    if python3 -c "
import json,sys
d=json.load(open('$f'))
if 'error' in d: sys.exit(1)
sys.exit(0)
" 2>/dev/null; then
      avg=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('avg','0'))")
      med=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('med','0'))")
      p90=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('p90','0'))")
      p95=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('p95','0'))")
      rps=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('rps','0'))")
      errors=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('errors','0'))")
      iters=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('iterations', d.get('requests','0')))")

      sum_avg=$(echo "$sum_avg + $avg" | bc 2>/dev/null || echo "0")
      sum_med=$(echo "$sum_med + $med" | bc 2>/dev/null || echo "0")
      sum_p90=$(echo "$sum_p90 + $p90" | bc 2>/dev/null || echo "0")
      sum_p95=$(echo "$sum_p95 + $p95" | bc 2>/dev/null || echo "0")
      sum_rps=$(echo "$sum_rps + $rps" | bc 2>/dev/null || echo "0")
      sum_errors=$(echo "$sum_errors + $errors" | bc 2>/dev/null || echo "0")
      sum_iters=$(echo "$sum_iters + $iters" | bc 2>/dev/null || echo "0")
      count=$((count + 1))
    fi
  done

  if [ $count -gt 0 ]; then
    avg_avg=$(echo "scale=2; $sum_avg / $count" | bc)
    avg_med=$(echo "scale=2; $sum_med / $count" | bc)
    avg_p90=$(echo "scale=2; $sum_p90 / $count" | bc)
    avg_p95=$(echo "scale=2; $sum_p95 / $count" | bc)
    avg_rps=$(echo "scale=0; $sum_rps / $count" | bc)
    tot_errors=$(echo "$sum_errors" | bc)
    tot_iters=$(echo "$sum_iters" | bc)
    printf "%-18s %8s %8s %8s %8s %8s %8s %8s\n" \
      "$fw" "$avg_avg" "$avg_med" "$avg_p90" "$avg_p95" "$avg_rps" "$tot_errors" "$tot_iters"
  else
    printf "%-18s %8s\n" "$fw" "FAILED"
  fi
done

echo ""
echo "Per-run details in: $RESULTS_DIR/"
echo "Done."
