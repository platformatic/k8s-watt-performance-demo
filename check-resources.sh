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

CLUSTER_NAME="next-${arm}-${RUN_ID}"
REGION="${AWS_REGION:-$(aws configure get region --profile "$AWS_PROFILE")}"
STATE_FILE="$SCRIPT_DIR/.benchmark-state/${CLUSTER_NAME}.json"
remaining=0

pass() {
	printf 'PASS %-24s %s\n' "$1" "${2:-}"
}

fail() {
	printf 'FAIL %-24s %s\n' "$1" "${2:-resources remain}"
	remaining=$((remaining + 1))
}

not_found_or_empty() {
	[[ -z "$1" || "$1" == "None" || "$1" == "[]" ]]
}

printf 'Checking benchmark resources for %s in %s\n' "$CLUSTER_NAME" "$REGION"
printf 'AWS profile: %s\n\n' "$AWS_PROFILE"

if [[ -f "$STATE_FILE" ]]; then
	fail 'state file' "$STATE_FILE"
else
	pass 'state file' 'not present'
fi

cluster_status=$(aws eks describe-cluster \
	--name "$CLUSTER_NAME" \
	--region "$REGION" \
	--profile "$AWS_PROFILE" \
	--query 'cluster.status' \
	--output text 2>/dev/null || true)
if not_found_or_empty "$cluster_status"; then
	pass 'EKS cluster' 'not present'
else
	fail 'EKS cluster' "$cluster_status"
fi

nodegroup_status=$(aws eks describe-nodegroup \
	--cluster-name "$CLUSTER_NAME" \
	--nodegroup-name "${CLUSTER_NAME}-nodegroup" \
	--region "$REGION" \
	--profile "$AWS_PROFILE" \
	--query 'nodegroup.status' \
	--output text 2>/dev/null || true)
if not_found_or_empty "$nodegroup_status"; then
	pass 'EKS node group' 'not present'
else
	fail 'EKS node group' "$nodegroup_status"
fi

vpc_id=$(jq -r '.resources.vpc.vpc_id // empty' "$STATE_FILE" 2>/dev/null || true)
if [[ -z "$vpc_id" ]]; then
	vpc_id=$(aws ec2 describe-vpcs \
		--filters "Name=tag:Name,Values=eks-vpc-${CLUSTER_NAME}" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'Vpcs[0].VpcId' \
		--output text 2>/dev/null || true)
fi

if [[ -z "$vpc_id" || "$vpc_id" == "None" ]]; then
	pass 'VPC and dependencies' 'VPC not present'
else
	fail 'VPC' "$vpc_id"

	instances=$(aws ec2 describe-instances \
		--filters "Name=vpc-id,Values=$vpc_id" "Name=instance-state-name,Values=pending,running,stopping,stopped" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'Reservations[].Instances[].{Id:InstanceId,Type:InstanceType,State:State.Name,Name:Tags[?Key==`Name`].Value|[0]}' \
		--output json 2>/dev/null || echo '[]')
	if [[ "$instances" == '[]' ]]; then pass 'EC2 instances' 'none'; else fail 'EC2 instances' "$instances"; fi

	enis=$(aws ec2 describe-network-interfaces \
		--filters "Name=vpc-id,Values=$vpc_id" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'NetworkInterfaces[].{Id:NetworkInterfaceId,Status:Status,Type:InterfaceType,Description:Description}' \
		--output json 2>/dev/null || echo '[]')
	if [[ "$enis" == '[]' ]]; then pass 'network interfaces' 'none'; else fail 'network interfaces' "$enis"; fi

	subnets=$(aws ec2 describe-subnets \
		--filters "Name=vpc-id,Values=$vpc_id" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'Subnets[].SubnetId' \
		--output text 2>/dev/null || true)
	if not_found_or_empty "$subnets"; then pass 'subnets' 'none'; else fail 'subnets' "$subnets"; fi

	nat_gateways=$(aws ec2 describe-nat-gateways \
		--filter "Name=vpc-id,Values=$vpc_id" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'NatGateways[?State!=`deleted`].{Id:NatGatewayId,State:State}' \
		--output json 2>/dev/null || echo '[]')
	if [[ "$nat_gateways" == '[]' ]]; then pass 'NAT gateways' 'none'; else fail 'NAT gateways' "$nat_gateways"; fi

	vpc_endpoints=$(aws ec2 describe-vpc-endpoints \
		--filters "Name=vpc-id,Values=$vpc_id" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'VpcEndpoints[].{Id:VpcEndpointId,State:State}' \
		--output json 2>/dev/null || echo '[]')
	if [[ "$vpc_endpoints" == '[]' ]]; then pass 'VPC endpoints' 'none'; else fail 'VPC endpoints' "$vpc_endpoints"; fi

	internet_gateways=$(aws ec2 describe-internet-gateways \
		--filters "Name=attachment.vpc-id,Values=$vpc_id" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'InternetGateways[].InternetGatewayId' \
		--output text 2>/dev/null || true)
	if not_found_or_empty "$internet_gateways"; then pass 'internet gateways' 'none'; else fail 'internet gateways' "$internet_gateways"; fi

	route_tables=$(aws ec2 describe-route-tables \
		--filters "Name=vpc-id,Values=$vpc_id" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'RouteTables[].RouteTableId' \
		--output text 2>/dev/null || true)
	if not_found_or_empty "$route_tables"; then pass 'route tables' 'none'; else fail 'route tables' "$route_tables"; fi

	security_groups=$(aws ec2 describe-security-groups \
		--filters "Name=vpc-id,Values=$vpc_id" \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query 'SecurityGroups[].{Id:GroupId,Name:GroupName}' \
		--output json 2>/dev/null || echo '[]')
	if [[ "$security_groups" == '[]' ]]; then pass 'security groups' 'none'; else fail 'security groups' "$security_groups"; fi

	load_balancers=$(aws elbv2 describe-load-balancers \
		--region "$REGION" \
		--profile "$AWS_PROFILE" \
		--query "LoadBalancers[?VpcId=='$vpc_id'].{Name:LoadBalancerName,Type:Type,State:State.Code}" \
		--output json 2>/dev/null || echo '[]')
	if [[ "$load_balancers" == '[]' ]]; then pass 'load balancers' 'none'; else fail 'load balancers' "$load_balancers"; fi
fi

iam_roles=$(aws iam list-roles \
	--profile "$AWS_PROFILE" \
	--query "Roles[?contains(RoleName, '${CLUSTER_NAME}')].RoleName" \
	--output text 2>/dev/null || true)
if not_found_or_empty "$iam_roles"; then pass 'IAM roles' 'none'; else fail 'IAM roles' "$iam_roles"; fi

if aws s3api head-bucket \
	--bucket "benchmark-results-${CLUSTER_NAME}" \
	--profile "$AWS_PROFILE" >/dev/null 2>&1; then
	fail 'S3 results bucket' "benchmark-results-${CLUSTER_NAME}"
else
	pass 'S3 results bucket' 'not present'
fi

ecr_repo=$(aws ecr describe-repositories \
	--repository-names "${ECR_REPO_NAME:-watt-benchmark}" \
	--region "$REGION" \
	--profile "$AWS_PROFILE" \
	--query 'repositories[0].repositoryName' \
	--output text 2>/dev/null || true)
if not_found_or_empty "$ecr_repo"; then pass 'ECR repository' 'not present'; else fail 'ECR repository' "$ecr_repo"; fi

printf '\n'
if [[ "$remaining" -eq 0 ]]; then
	printf 'No resources found for %s.\n' "$CLUSTER_NAME"
	exit 0
fi

printf '%s resource categories still present for %s.\n' "$remaining" "$CLUSTER_NAME" >&2
exit 1
