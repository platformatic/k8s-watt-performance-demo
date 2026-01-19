#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[PASS]${NC} $1"; }
error() { echo -e "${RED}[FAIL]${NC} $1"; }
warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# Cleanup function
cleanup() {
    log "Cleaning up..."
    pkill -f "node.*next" 2>/dev/null || true
    pkill -f "node.*server.js" 2>/dev/null || true
    pkill -f "node.*index.mjs" 2>/dev/null || true
    pkill -f "npm run start" 2>/dev/null || true
    # Kill any processes on our test ports
    fuser -k 3000/tcp 2>/dev/null || true
    fuser -k 3001/tcp 2>/dev/null || true
    fuser -k 3002/tcp 2>/dev/null || true
    sleep 2
}

trap cleanup EXIT

# Wait for server to be ready
wait_for_server() {
    local url=$1
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "200"; then
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    return 1
}

# Results tracking
NEXT_RESULT=""
REACT_ROUTER_RESULT=""
TANSTACK_RESULT=""

# Make sure we have Playwright installed
log "Installing test dependencies..."
cd "$SCRIPT_DIR"
npm install --silent 2>/dev/null || npm install

# Install Playwright browsers if needed
npx playwright install chromium --with-deps 2>/dev/null || true

echo ""
echo "========================================"
echo "  E-commerce Integration Tests"
echo "========================================"
echo ""

# Test Next.js
log "Starting Next.js app on port 3000..."
cd "$ROOT_DIR/next"
PORT=3000 npm run start:node > /tmp/next-server.log 2>&1 &
NEXT_PID=$!

if wait_for_server "http://localhost:3000"; then
    success "Next.js app is ready"

    log "Running tests against Next.js..."
    cd "$SCRIPT_DIR"
    if BASE_URL=http://localhost:3000 npx playwright test --reporter=line 2>&1 | tee /tmp/next-test.log; then
        success "Next.js tests passed!"
        NEXT_RESULT="PASSED"
    else
        error "Next.js tests failed"
        NEXT_RESULT="FAILED"
    fi
else
    error "Next.js app failed to start"
    NEXT_RESULT="FAILED (app did not start)"
fi

kill $NEXT_PID 2>/dev/null || true
sleep 2

# Test React Router
log "Starting React Router app on port 3001..."
cd "$ROOT_DIR/react-router"
PORT=3001 npm run start:node > /tmp/react-router-server.log 2>&1 &
RR_PID=$!

if wait_for_server "http://localhost:3001"; then
    success "React Router app is ready"

    log "Running tests against React Router..."
    cd "$SCRIPT_DIR"
    if BASE_URL=http://localhost:3001 npx playwright test --reporter=line 2>&1 | tee /tmp/react-router-test.log; then
        success "React Router tests passed!"
        REACT_ROUTER_RESULT="PASSED"
    else
        error "React Router tests failed"
        REACT_ROUTER_RESULT="FAILED"
    fi
else
    error "React Router app failed to start"
    REACT_ROUTER_RESULT="FAILED (app did not start)"
fi

kill $RR_PID 2>/dev/null || true
fuser -k 3001/tcp 2>/dev/null || true
sleep 2

# Test TanStack
log "Starting TanStack app on port 3002..."
fuser -k 3002/tcp 2>/dev/null || true
sleep 1
cd "$ROOT_DIR/tanstack"
PORT=3002 npm run start:node > /tmp/tanstack-server.log 2>&1 &
TS_PID=$!

if wait_for_server "http://localhost:3002"; then
    success "TanStack app is ready"

    log "Running tests against TanStack..."
    cd "$SCRIPT_DIR"
    if BASE_URL=http://localhost:3002 npx playwright test --reporter=line 2>&1 | tee /tmp/tanstack-test.log; then
        success "TanStack tests passed!"
        TANSTACK_RESULT="PASSED"
    else
        error "TanStack tests failed"
        TANSTACK_RESULT="FAILED"
    fi
else
    error "TanStack app failed to start"
    TANSTACK_RESULT="FAILED (app did not start)"
fi

kill $TS_PID 2>/dev/null || true

# Print summary
echo ""
echo "========================================"
echo "  Test Results Summary"
echo "========================================"
echo ""
echo -e "Next.js:      ${NEXT_RESULT}"
echo -e "React Router: ${REACT_ROUTER_RESULT}"
echo -e "TanStack:     ${TANSTACK_RESULT}"
echo ""

# Exit with error if any tests failed
if [[ "$NEXT_RESULT" == "PASSED" && "$REACT_ROUTER_RESULT" == "PASSED" && "$TANSTACK_RESULT" == "PASSED" ]]; then
    success "All frameworks passed integration tests!"
    exit 0
else
    error "Some tests failed. Check logs in /tmp for details."
    exit 1
fi
