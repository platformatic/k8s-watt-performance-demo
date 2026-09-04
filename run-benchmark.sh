#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
	printf 'Missing local environment file: %s/.env\n' "$SCRIPT_DIR" >&2
	exit 1
fi

set -a
source "$SCRIPT_DIR/.env"
set +a

if [[ -z "${AWS_PROFILE:-}" ]]; then
	printf 'AWS_PROFILE must be set in %s/.env\n' "$SCRIPT_DIR" >&2
	exit 1
fi

RUN_ID="${1:-}"
SSRT_ENABLED="${2:-0}"

if [[ -z "$RUN_ID" || ! "$RUN_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
	printf 'Usage: %s <run-id> [0|1]\n' "$0" >&2
	exit 1
fi

if [[ "$SSRT_ENABLED" != "0" && "$SSRT_ENABLED" != "1" ]]; then
	printf 'SSRT status must be 0 or 1\n' >&2
	exit 1
fi

if [[ "$SSRT_ENABLED" == "1" ]]; then
	arm="ssrt"
else
	arm="control"
fi

export CLUSTER_NAME="next-${arm}-${RUN_ID}"
export IMAGE_TAG="$CLUSTER_NAME"
export SSRT_ENABLED

exec "$SCRIPT_DIR/benchmark.sh" --detach
