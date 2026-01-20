#!/bin/bash

# Benchmark All Frameworks
# Runs benchmarks for Next.js, React Router, and TanStack sequentially

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] ✓${NC} $1"; }
error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ✗${NC} $1"; }
warning() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] ⚠${NC} $1"; }

# Frameworks to benchmark (in order)
FRAMEWORKS=("next" "react-router" "tanstack")

# Track results
declare -A RESULTS
FAILED_FRAMEWORKS=()

# Check if AWS_PROFILE is set
if [ -z "$AWS_PROFILE" ]; then
  error "AWS_PROFILE environment variable must be set"
  echo "Usage: AWS_PROFILE=<profile-name> $0"
  exit 1
fi

echo ""
echo "========================================================================"
echo "  BENCHMARK ALL FRAMEWORKS"
echo "========================================================================"
echo ""
echo "AWS Profile: $AWS_PROFILE"
echo "Frameworks:  ${FRAMEWORKS[*]}"
echo ""
echo "This will run benchmarks for all frameworks sequentially."
echo "Each benchmark creates a new EKS cluster and cleans up after completion."
echo ""
echo "========================================================================"
echo ""

# Optional: cooldown between benchmarks (in seconds)
COOLDOWN_BETWEEN_BENCHMARKS=${COOLDOWN_BETWEEN_BENCHMARKS:-60}

# Run benchmark for each framework
for i in "${!FRAMEWORKS[@]}"; do
  framework="${FRAMEWORKS[$i]}"
  framework_num=$((i + 1))
  total_frameworks=${#FRAMEWORKS[@]}

  echo ""
  echo "========================================================================"
  echo "  FRAMEWORK ${framework_num}/${total_frameworks}: ${framework^^}"
  echo "========================================================================"
  echo ""

  log "Starting benchmark for $framework..."

  START_TIME=$(date +%s)

  # Run the benchmark
  if FRAMEWORK="$framework" ./benchmark.sh; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    DURATION_MIN=$((DURATION / 60))
    DURATION_SEC=$((DURATION % 60))

    success "$framework benchmark completed in ${DURATION_MIN}m ${DURATION_SEC}s"
    RESULTS[$framework]="SUCCESS (${DURATION_MIN}m ${DURATION_SEC}s)"
  else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    DURATION_MIN=$((DURATION / 60))
    DURATION_SEC=$((DURATION % 60))

    error "$framework benchmark FAILED after ${DURATION_MIN}m ${DURATION_SEC}s"
    RESULTS[$framework]="FAILED (${DURATION_MIN}m ${DURATION_SEC}s)"
    FAILED_FRAMEWORKS+=("$framework")
  fi

  # Cooldown between benchmarks (except for the last one)
  if [ $framework_num -lt $total_frameworks ]; then
    log "Cooldown: waiting ${COOLDOWN_BETWEEN_BENCHMARKS}s before next benchmark..."
    sleep "$COOLDOWN_BETWEEN_BENCHMARKS"
  fi
done

# Print summary
echo ""
echo "========================================================================"
echo "  BENCHMARK SUMMARY"
echo "========================================================================"
echo ""

for framework in "${FRAMEWORKS[@]}"; do
  status="${RESULTS[$framework]}"
  if [[ "$status" == SUCCESS* ]]; then
    success "$framework: $status"
  else
    error "$framework: $status"
  fi
done

echo ""

# Check for result files
log "Checking for result files..."
echo ""

for framework in "${FRAMEWORKS[@]}"; do
  latest_result=$(ls -t results/${framework}-*.log 2>/dev/null | head -1)
  if [ -n "$latest_result" ]; then
    success "$framework: $latest_result"
  else
    warning "$framework: No result file found"
  fi
done

echo ""
echo "========================================================================"

# Exit with error if any benchmark failed
if [ ${#FAILED_FRAMEWORKS[@]} -gt 0 ]; then
  error "The following frameworks failed: ${FAILED_FRAMEWORKS[*]}"
  exit 1
else
  success "All benchmarks completed successfully!"
  exit 0
fi
