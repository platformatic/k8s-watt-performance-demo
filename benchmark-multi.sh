#!/bin/zsh
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
K6_DIR="$REPO_DIR/k6"
RESULTS_DIR="$REPO_DIR/results"
RUNS=${RUNS:-3}
RATE=${RATE:-500}
DURATION=${DURATION:-30s}

mkdir -p "$RESULTS_DIR"

kill_port() {
  local port=$1
  lsof -ti :"$port" | xargs kill -9 2>/dev/null
  sleep 1
}

wait_for_server() {
  local url=$1
  local max_attempts=30
  for i in $(seq 1 $max_attempts); do
    if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200"; then
      return 0
    fi
    sleep 1
  done
  echo "ERROR: Server at $url did not start within ${max_attempts}s"
  return 1
}

run_benchmark() {
  local name=$1
  local port=$2
  local start_cmd=$3
  local work_dir=$4

  echo ""
  echo "=========================================="
  echo "  $name (port $port, $RUNS runs @ ${RATE} req/s)"
  echo "=========================================="

  kill_port $port

  echo "Starting $name..."
  cd "$work_dir"
  eval "PORT=$port $start_cmd" &
  local server_pid=$!
  cd "$REPO_DIR"

  if ! wait_for_server "http://localhost:$port/"; then
    kill $server_pid 2>/dev/null
    return 1
  fi
  echo "$name is ready on port $port"

  # Warmup
  echo "Warming up $name..."
  BASE_URL="http://localhost:$port" k6 run --quiet "$K6_DIR/warmup.js" 2>&1 | grep -E 'http_req_duration|iterations'

  # Runs
  for run in $(seq 1 $RUNS); do
    local outfile="$RESULTS_DIR/${name}-run${run}.json"
    echo "  Run $run/$RUNS..."
    BASE_URL="http://localhost:$port" RATE=$RATE DURATION=$DURATION OUT_FILE="$outfile" \
      k6 run --quiet "$K6_DIR/ecommerce.js" 2>&1 | grep -E 'http_req_duration|response_time|request_errors|successful'
    sleep 2
  done

  # Stop server
  kill $server_pid 2>/dev/null
  kill_port $port
  echo "$name complete."
}

echo "=== Multi-Run Benchmark ==="
echo "Runs: $RUNS | Rate: $RATE req/s | Duration: $DURATION"
echo ""

# ── Next.js ──
run_benchmark "next.js" 3001 \
  "npm run start:node" \
  "$REPO_DIR/next"

# ── TanStack Start ──
run_benchmark "tanstack-start" 3002 \
  "node .output/server/index.mjs" \
  "$REPO_DIR/tanstack"

# ── Vertz (Bun) ──
run_benchmark "vertz-bun" 3003 \
  "bun run server.ts" \
  "$REPO_DIR/vertz"

# ── Vertz (Node) ──
run_benchmark "vertz-node" 3004 \
  "node server-node.mjs" \
  "$REPO_DIR/vertz"

# ── Nuxt ──
run_benchmark "nuxt" 3005 \
  "node .output/server/index.mjs" \
  "$REPO_DIR/nuxt"

# ── SvelteKit ──
run_benchmark "sveltekit" 3006 \
  "node build/index.js" \
  "$REPO_DIR/svelte"

# ── Hono + Preact (SSR with hydration) ──
run_benchmark "hono-preact" 3007 \
  "node dist/server.js" \
  "$REPO_DIR/hono-preact"

echo ""
echo "=========================================="
echo "  RESULTS"
echo "=========================================="
echo ""

printf "%-18s %8s %8s %8s %8s %8s %8s %8s\n" \
  "Framework" "Avg(ms)" "Med(ms)" "P90(ms)" "P95(ms)" "RPS" "Errors" "Reqs"
printf "%-18s %8s %8s %8s %8s %8s %8s %8s\n" \
  "-----------------" "-------" "-------" "-------" "-------" "-------" "-------" "-------"

for fw in "next.js" "tanstack-start" "vertz-bun" "vertz-node" "nuxt" "sveltekit" "hono-preact"; do
  sum_avg=0; sum_med=0; sum_p90=0; sum_p95=0; sum_rps=0; sum_errors=0; sum_reqs=0
  count=0

  for run in $(seq 1 $RUNS); do
    f="$RESULTS_DIR/${fw}-run${run}.json"
    if [ ! -f "$f" ]; then continue; fi
    # Check for actual error sentinel (not "errors":0)
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
      reqs=$(python3 -c "import json; d=json.load(open('$f')); print(d.get('requests','0'))")

      sum_avg=$(echo "$sum_avg + $avg" | bc 2>/dev/null || echo "0")
      sum_med=$(echo "$sum_med + $med" | bc 2>/dev/null || echo "0")
      sum_p90=$(echo "$sum_p90 + $p90" | bc 2>/dev/null || echo "0")
      sum_p95=$(echo "$sum_p95 + $p95" | bc 2>/dev/null || echo "0")
      sum_rps=$(echo "$sum_rps + $rps" | bc 2>/dev/null || echo "0")
      sum_errors=$(echo "$sum_errors + $errors" | bc 2>/dev/null || echo "0")
      sum_reqs=$(echo "$sum_reqs + $reqs" | bc 2>/dev/null || echo "0")
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
    tot_reqs=$(echo "$sum_reqs" | bc)
    printf "%-18s %8s %8s %8s %8s %8s %8s %8s\n" \
      "$fw" "$avg_avg" "$avg_med" "$avg_p90" "$avg_p95" "$avg_rps" "$tot_errors" "$tot_reqs"
  else
    printf "%-18s %8s\n" "$fw" "FAILED"
  fi
done

echo ""
echo "Per-run details in: $RESULTS_DIR/"
echo "Done."
