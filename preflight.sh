#!/usr/bin/env bash

set -euo pipefail

export AWS_PAGER=""

PROFILE="${AWS_PROFILE:-}"
REQUIRED_TOOLS=(aws docker kubectl jq npm)
REQUIRED_ACTIONS=(
  eks:CreateCluster
  eks:CreateNodegroup
  ec2:RunInstances
  ec2:CreateVpc
  iam:CreateRole
  iam:PassRole
  ecr:CreateRepository
  s3:CreateBucket
)

failures=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'PASS %-24s\n' "$name"
  else
    printf 'FAIL %-24s\n' "$name"
    failures=$((failures + 1))
  fi
}

check_iam_action() {
  local action="$1"
  local result
  if result=$(aws iam simulate-principal-policy \
    --policy-source-arn "$PRINCIPAL_ARN" \
    --action-names "$action" \
    --profile "$PROFILE" \
    --output json 2>/dev/null) && [[ "$(jq -r '.EvaluationResults[0].EvalDecision' <<<"$result")" == "allowed" ]]; then
    printf 'PASS %-24s\n' "iam:$action"
  else
    printf 'FAIL %-24s\n' "iam:$action"
    failures=$((failures + 1))
  fi
}

if [[ -z "$PROFILE" ]]; then
  printf 'AWS_PROFILE must be set.\n' >&2
  exit 1
fi

printf 'Read-only benchmark preflight for profile %s\n' "$PROFILE"
for tool in "${REQUIRED_TOOLS[@]}"; do
  check "tool:$tool" command -v "$tool"
done

if ! command -v aws >/dev/null 2>&1; then
  printf '\nAWS CLI is required before any benchmark resource can be created.\n' >&2
  exit 1
fi

CALLER_IDENTITY=$(aws sts get-caller-identity --profile "$PROFILE" --output json)
ACCOUNT_ID=$(jq -r '.Account' <<<"$CALLER_IDENTITY")
PRINCIPAL_ARN=$(jq -r '.Arn' <<<"$CALLER_IDENTITY")
REGION=$(aws configure get region --profile "$PROFILE")

if [[ "$PRINCIPAL_ARN" == arn:aws:sts::*:assumed-role/*/* ]]; then
  PRINCIPAL_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${PRINCIPAL_ARN#*:assumed-role/}"
  PRINCIPAL_ARN="${PRINCIPAL_ARN%/*}"
fi

printf 'Account: %s\nRegion:  %s\nPrincipal: %s\n' "$ACCOUNT_ID" "${REGION:-unset}" "$PRINCIPAL_ARN"

if [[ -z "$REGION" ]]; then
  printf 'FAIL aws:region\n'
  failures=$((failures + 1))
else
  printf 'PASS aws:region\n'
fi

check 'aws:caller-identity' aws sts get-caller-identity --profile "$PROFILE"
check 'aws:availability-zones' aws ec2 describe-availability-zones --profile "$PROFILE" --region "$REGION"
check 'aws:eks-quotas' aws service-quotas get-service-quota --service-code eks --quota-code L-1194D53C --profile "$PROFILE" --region "$REGION"
check 'aws:ec2-quotas' aws service-quotas get-service-quota --service-code ec2 --quota-code L-1216C47A --profile "$PROFILE" --region "$REGION"

for action in "${REQUIRED_ACTIONS[@]}"; do
  check_iam_action "$action"
done

if [[ "$failures" -gt 0 ]]; then
  printf '\nPreflight failed with %s check(s). No AWS resources were created.\n' "$failures" >&2
  exit 1
fi

printf '\nPreflight passed. This script performed read-only checks only.\n'
