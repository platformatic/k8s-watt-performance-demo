#!/bin/bash
# Generate local CPU/heap flamegraphs for two Next.js versions using
# @platformatic/flame, under identical load. Output -> ./flamegraphs/
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$SCRIPT_DIR/next"
OUT="$SCRIPT_DIR/flamegraphs"
PORT="${PORT:-3200}"
DURATION="${DURATION:-30}"
CONCURRENCY="${CONCURRENCY:-50}"
VERSIONS=("16.2.9" "16.3.0-canary.72")   # .72 last so node_modules ends on the committed version
# Flame binary (override e.g. FLAME="node /path/to/flame/bin/flame.js" for a PR build)
# and extra args (e.g. sourcemap flags). Both run relative to the app dir.
FLAME="${FLAME:-node_modules/.bin/flame}"
FLAME_SM_ARGS="${FLAME_SM_ARGS:-}"

mkdir -p "$OUT"
cd "$APP"

for V in "${VERSIONS[@]}"; do
  TAG="${V//\//-}"
  echo "======================================================================"
  echo "  Flamegraph: next@$V"
  echo "======================================================================"

  echo ">> installing next@$V"
  npm install "next@$V" --no-audit --no-fund --silent || { echo "install failed"; exit 1; }

  echo ">> building"
  npm run build >/tmp/flame-build-$TAG.log 2>&1 || { echo "build failed, see /tmp/flame-build-$TAG.log"; tail -20 /tmp/flame-build-$TAG.log; exit 1; }

  rm -f cpu-profile-*.pb cpu-profile-*.html cpu-profile-*.md heap-profile-*.pb heap-profile-*.html heap-profile-*.md

  echo ">> starting server under flame"
  NODE_ENV=production PORT="$PORT" HOSTNAME=127.0.0.1 NEXT_TELEMETRY_DISABLED=1 \
    DB_DELAY_ENABLED=false \
    $FLAME run --delay=none $FLAME_SM_ARGS node_modules/next/dist/bin/next start \
    >/tmp/flame-run-$TAG.log 2>&1 &
  FPID=$!

  echo ">> waiting for server (flame pid $FPID)"
  for i in $(seq 1 60); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/" 2>/dev/null || echo 000)
    [ "$code" = "200" ] && { echo "   ready after ${i}s"; break; }
    if ! kill -0 "$FPID" 2>/dev/null; then echo "   server died; log:"; tail -30 /tmp/flame-run-$TAG.log; exit 1; fi
    sleep 1
  done

  # The profiled process is a child of the flame CLI; SIGINT that child directly
  # (signaling the process group would hit this script too).
  CHILD=$(grep -oE "Process PID: [0-9]+" /tmp/flame-run-$TAG.log | head -1 | grep -oE "[0-9]+")
  [ -z "$CHILD" ] && CHILD="$FPID"

  # Profiling only begins after sourcemap init (can load thousands of maps).
  # Wait for it so the load is actually captured.
  echo ">> waiting for profiler to become active"
  for i in $(seq 1 90); do
    grep -q "Auto-starting CPU and heap profilers" /tmp/flame-run-$TAG.log 2>/dev/null && { echo "   profiling active after ${i}s"; break; }
    sleep 1
  done

  echo ">> load: ${DURATION}s @ concurrency ${CONCURRENCY}"
  node .flame-load.mjs "http://127.0.0.1:$PORT" "$DURATION" "$CONCURRENCY"

  echo ">> stopping (SIGINT to child $CHILD) and waiting for flamegraph generation"
  kill -INT "$CHILD" 2>/dev/null
  for i in $(seq 1 120); do
    ls cpu-profile-*.html >/dev/null 2>&1 && { sleep 2; break; }
    kill -0 "$FPID" 2>/dev/null || break
    sleep 1
  done
  kill -INT "$FPID" 2>/dev/null; kill "$FPID" 2>/dev/null

  # Collect newest generated artifacts (HTML flamegraph + markdown summary)
  cpu_html=$(ls -t cpu-profile-*.html 2>/dev/null | head -1)
  heap_html=$(ls -t heap-profile-*.html 2>/dev/null | head -1)
  cpu_md=$(ls -t cpu-profile-*.md 2>/dev/null | head -1)
  heap_md=$(ls -t heap-profile-*.md 2>/dev/null | head -1)
  if [ -n "$cpu_html" ]; then cp "$cpu_html" "$OUT/cpu-$TAG.html"; echo "   -> flamegraphs/cpu-$TAG.html"; else echo "   !! no CPU flamegraph produced; log:"; tail -30 /tmp/flame-run-$TAG.log; fi
  [ -n "$heap_html" ] && cp "$heap_html" "$OUT/heap-$TAG.html" && echo "   -> flamegraphs/heap-$TAG.html"
  [ -n "$cpu_md" ] && cp "$cpu_md" "$OUT/cpu-$TAG.md"
  [ -n "$heap_md" ] && cp "$heap_md" "$OUT/heap-$TAG.md"
  rm -f cpu-profile-*.pb cpu-profile-*.html cpu-profile-*.md heap-profile-*.pb heap-profile-*.html heap-profile-*.md
done

echo ">> restoring committed package.json/package-lock.json"
cd "$SCRIPT_DIR"
git checkout next/package.json next/package-lock.json 2>/dev/null

echo "DONE. Flamegraphs in: $OUT"
ls -la "$OUT"
