#!/bin/bash

set -e

# Standalone cleanup script for orphaned benchmark resources
# Use this script to clean up AWS resources after power loss or script interruption

# Disable AWS CLI pager
export AWS_PAGER=""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

# Source common functions
source "$PROJECT_ROOT/lib/common.sh"
source "$PROJECT_ROOT/lib/state.sh"

# Script options
DRY_RUN=false
CLEANUP_ALL=false
STATE_FILE_ARG=""
LIST_ONLY=false

usage() {
	cat <<EOF
Usage: $0 [OPTIONS]

Clean up orphaned AWS resources from interrupted benchmark runs.

Options:
  --list              List all state files with their status
  --file FILE         Clean up resources from a specific state file
  --all               Clean up all state files
  --dry-run           Preview cleanup without deleting resources
  -h, --help          Show this help message

Examples:
  $0 --list                          # List all orphaned runs
  $0 --file .benchmark-state/watt-benchmark-123.json
  $0 --all --dry-run                 # Preview cleanup of all runs
  $0 --all                           # Clean up all orphaned resources

State files are stored in: .benchmark-state/
EOF
}

# Parse command line arguments
parse_args() {
	while [[ $# -gt 0 ]]; do
		case "$1" in
			--list)
				LIST_ONLY=true
				shift
				;;
			--file)
				STATE_FILE_ARG="$2"
				shift 2
				;;
			--all)
				CLEANUP_ALL=true
				shift
				;;
			--dry-run)
				DRY_RUN=true
				shift
				;;
			-h|--help)
				usage
				exit 0
				;;
			*)
				error "Unknown option: $1"
				usage
				exit 1
				;;
		esac
	done
}

# Dry run wrapper - executes command or prints it
run_cmd() {
	if [[ "$DRY_RUN" == "true" ]]; then
		echo "[DRY-RUN] $*"
		return 0
	fi
	"$@"
}

# Cleanup resources from loaded state
# This mirrors cleanup_instances() but uses STATE_ variables
cleanup_from_state() {
	local state_file="$1"

	log "Loading state from: $state_file"

	if ! load_state "$state_file"; then
		error "Failed to load state file"
		return 1
	fi

	log "Cluster: $STATE_CLUSTER_NAME"
	log "AWS Profile: $STATE_AWS_PROFILE"
	log "AWS Region: $STATE_AWS_REGION"
	log "Status: $STATE_STATUS"

	# Set AWS_PROFILE for cleanup commands
	local AWS_PROFILE="${STATE_AWS_PROFILE:-default}"

	if [[ "$DRY_RUN" == "true" ]]; then
		warning "DRY RUN MODE - No resources will be deleted"
	fi

	# Terminate load test EC2 instance
	if [[ -n "$STATE_LOAD_TEST_INSTANCE_ID" ]]; then
		log "Terminating load test instance: $STATE_LOAD_TEST_INSTANCE_ID"
		if run_cmd aws ec2 terminate-instances \
			--instance-ids "$STATE_LOAD_TEST_INSTANCE_ID" \
			--profile "$AWS_PROFILE" >/dev/null 2>&1; then

			if [[ "$DRY_RUN" != "true" ]]; then
				log "Waiting for instance termination..."
				aws ec2 wait instance-terminated \
					--instance-ids "$STATE_LOAD_TEST_INSTANCE_ID" \
					--profile "$AWS_PROFILE" 2>/dev/null || true
				mark_resource_cleaned "ec2" "load_test_instance_id"
			fi
		fi
	fi

	# Delete EKS node group
	if [[ -n "$STATE_CLUSTER_NAME" && -n "$STATE_NODEGROUP_NAME" ]]; then
		log "Checking for node group: $STATE_NODEGROUP_NAME"

		if aws eks describe-nodegroup \
			--cluster-name "$STATE_CLUSTER_NAME" \
			--nodegroup-name "$STATE_NODEGROUP_NAME" \
			--profile "$AWS_PROFILE" >/dev/null 2>&1; then

			log "Deleting node group: $STATE_NODEGROUP_NAME"
			if run_cmd aws eks delete-nodegroup \
				--cluster-name "$STATE_CLUSTER_NAME" \
				--nodegroup-name "$STATE_NODEGROUP_NAME" \
				--profile "$AWS_PROFILE" >/dev/null 2>&1; then

				if [[ "$DRY_RUN" != "true" ]]; then
					log "Waiting for node group deletion..."
					aws eks wait nodegroup-deleted \
						--cluster-name "$STATE_CLUSTER_NAME" \
						--nodegroup-name "$STATE_NODEGROUP_NAME" \
						--profile "$AWS_PROFILE" 2>&1 | grep -v "waiting" || true
					mark_resource_cleaned "eks" "nodegroup_name"
				fi
			fi
		fi
	fi

	# Delete EKS cluster
	if [[ -n "$STATE_CLUSTER_NAME" ]]; then
		log "Checking if cluster exists: $STATE_CLUSTER_NAME"

		if aws eks describe-cluster \
			--name "$STATE_CLUSTER_NAME" \
			--profile "$AWS_PROFILE" >/dev/null 2>&1; then

			log "Deleting EKS cluster: $STATE_CLUSTER_NAME"
			if run_cmd aws eks delete-cluster \
				--name "$STATE_CLUSTER_NAME" \
				--profile "$AWS_PROFILE" >/dev/null 2>&1; then

				if [[ "$DRY_RUN" != "true" ]]; then
					log "Waiting for cluster deletion..."
					aws eks wait cluster-deleted \
						--name "$STATE_CLUSTER_NAME" \
						--profile "$AWS_PROFILE" 2>&1 | grep -v "waiting" || true
				fi
			fi
		fi
	fi

	# Delete Load Balancers in VPC
	if [[ -n "$STATE_VPC_ID" ]]; then
		log "Deleting Load Balancers in VPC..."
		local lb_arns
		lb_arns=$(aws elbv2 describe-load-balancers \
			--profile "$AWS_PROFILE" \
			--output json 2>/dev/null | \
			jq -r ".LoadBalancers[] | select(.VpcId == \"$STATE_VPC_ID\") | .LoadBalancerArn" 2>/dev/null || true)

		if [[ -n "$lb_arns" ]]; then
			for arn in $lb_arns; do
				log "Deleting Load Balancer: $arn"
				run_cmd aws elbv2 delete-load-balancer \
					--load-balancer-arn "$arn" \
					--profile "$AWS_PROFILE" 2>/dev/null || true
			done
			if [[ "$DRY_RUN" != "true" ]]; then
				log "Waiting for Load Balancer ENIs to be released (60s)..."
				sleep 60
			fi
		fi
	fi

	# Delete security group
	if [[ -n "$STATE_SECURITY_GROUP_ID" ]]; then
		log "Deleting security group: $STATE_SECURITY_GROUP_ID"
		local sg_retry=0
		while [[ $sg_retry -lt 5 ]]; do
			if run_cmd aws ec2 delete-security-group \
				--group-id "$STATE_SECURITY_GROUP_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null; then
				if [[ "$DRY_RUN" != "true" ]]; then
					mark_resource_cleaned "ec2" "security_group_id"
				fi
				break
			fi
			sg_retry=$((sg_retry + 1))
			[[ "$DRY_RUN" != "true" ]] && sleep 10
		done
	fi

	# Delete VPC resources
	if [[ -n "$STATE_VPC_ID" ]]; then
		log "Deleting VPC resources..."

		# Delete all non-default security groups in VPC
		log "Deleting security groups..."
		local sgs
		sgs=$(aws ec2 describe-security-groups \
			--filters "Name=vpc-id,Values=$STATE_VPC_ID" \
			--profile "$AWS_PROFILE" \
			--output json 2>/dev/null | \
			jq -r '.SecurityGroups[] | select(.GroupName != "default") | .GroupId' 2>/dev/null || true)
		for sg in $sgs; do
			run_cmd aws ec2 delete-security-group \
				--group-id "$sg" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done

		# Delete Network Interfaces
		log "Deleting network interfaces..."
		local enis
		enis=$(aws ec2 describe-network-interfaces \
			--filters "Name=vpc-id,Values=$STATE_VPC_ID" \
			--query 'NetworkInterfaces[*].NetworkInterfaceId' \
			--output text \
			--profile "$AWS_PROFILE" 2>/dev/null || true)
		for eni in $enis; do
			run_cmd aws ec2 delete-network-interface \
				--network-interface-id "$eni" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done

		# Detach and delete internet gateway
		if [[ -n "$STATE_IGW_ID" ]]; then
			run_cmd aws ec2 detach-internet-gateway \
				--internet-gateway-id "$STATE_IGW_ID" \
				--vpc-id "$STATE_VPC_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
			run_cmd aws ec2 delete-internet-gateway \
				--internet-gateway-id "$STATE_IGW_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
			[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "vpc" "igw_id"
		fi

		# Also check for any IGWs attached to VPC
		local igws
		igws=$(aws ec2 describe-internet-gateways \
			--filters "Name=attachment.vpc-id,Values=$STATE_VPC_ID" \
			--query 'InternetGateways[*].InternetGatewayId' \
			--output text \
			--profile "$AWS_PROFILE" 2>/dev/null || true)
		for igw in $igws; do
			run_cmd aws ec2 detach-internet-gateway \
				--internet-gateway-id "$igw" \
				--vpc-id "$STATE_VPC_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
			run_cmd aws ec2 delete-internet-gateway \
				--internet-gateway-id "$igw" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done

		# Delete subnets
		log "Deleting subnets..."
		local subnets
		subnets=$(aws ec2 describe-subnets \
			--filters "Name=vpc-id,Values=$STATE_VPC_ID" \
			--query 'Subnets[*].SubnetId' \
			--output text \
			--profile "$AWS_PROFILE" 2>/dev/null || true)
		for subnet in $subnets; do
			run_cmd aws ec2 delete-subnet \
				--subnet-id "$subnet" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "vpc" "subnet_ids"

		# Delete route tables
		log "Deleting route tables..."
		local rts
		rts=$(aws ec2 describe-route-tables \
			--filters "Name=vpc-id,Values=$STATE_VPC_ID" \
			--profile "$AWS_PROFILE" \
			--output json 2>/dev/null | \
			jq -r '.RouteTables[] | select(.Associations[0].Main != true) | .RouteTableId' 2>/dev/null || true)
		for rt in $rts; do
			run_cmd aws ec2 delete-route-table \
				--route-table-id "$rt" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "vpc" "rtb_id"

		# Delete VPC
		log "Deleting VPC: $STATE_VPC_ID"
		local vpc_retry=0
		while [[ $vpc_retry -lt 3 ]]; do
			if run_cmd aws ec2 delete-vpc \
				--vpc-id "$STATE_VPC_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null; then
				log "VPC deleted successfully"
				[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "vpc" "vpc_id"
				break
			fi
			vpc_retry=$((vpc_retry + 1))
			if [[ "$DRY_RUN" != "true" ]]; then
				log "VPC deletion failed, retrying in 10s... (attempt $vpc_retry/3)"
				sleep 10
			fi
		done
	fi

	# Delete orphaned EBS volumes tagged with this cluster
	if [[ -n "$STATE_CLUSTER_NAME" ]]; then
		log "Deleting orphaned EBS volumes for cluster: $STATE_CLUSTER_NAME"
		local volumes
		volumes=$(aws ec2 describe-volumes \
			--filters "Name=status,Values=available" "Name=tag:Name,Values=*${STATE_CLUSTER_NAME}*" \
			--profile "$AWS_PROFILE" \
			--query 'Volumes[*].VolumeId' \
			--output text 2>/dev/null || true)
		for vol in $volumes; do
			log "Deleting EBS volume: $vol"
			run_cmd aws ec2 delete-volume \
				--volume-id "$vol" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done
	fi

	# Delete node IAM role
	if [[ -n "$STATE_NODE_ROLE_NAME" ]]; then
		log "Deleting node IAM role: $STATE_NODE_ROLE_NAME"
		# Detach all attached policies dynamically
		local node_policies
		node_policies=$(aws iam list-attached-role-policies \
			--role-name "$STATE_NODE_ROLE_NAME" \
			--profile "$AWS_PROFILE" \
			--query 'AttachedPolicies[*].PolicyArn' \
			--output text 2>/dev/null || true)
		for policy_arn in $node_policies; do
			run_cmd aws iam detach-role-policy \
				--role-name "$STATE_NODE_ROLE_NAME" \
				--policy-arn "$policy_arn" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done
		run_cmd aws iam delete-role \
			--role-name "$STATE_NODE_ROLE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "iam" "node_role_name"
	fi

	# Delete cluster IAM role
	if [[ -n "$STATE_CLUSTER_ROLE_NAME" ]]; then
		log "Deleting cluster IAM role: $STATE_CLUSTER_ROLE_NAME"
		run_cmd aws iam detach-role-policy \
			--role-name "$STATE_CLUSTER_ROLE_NAME" \
			--policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		run_cmd aws iam delete-role \
			--role-name "$STATE_CLUSTER_ROLE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "iam" "cluster_role_name"
	fi

	# Delete EBS CSI IAM role
	if [[ -n "$STATE_EBS_CSI_ROLE_NAME" ]]; then
		log "Deleting EBS CSI IAM role: $STATE_EBS_CSI_ROLE_NAME"
		run_cmd aws iam detach-role-policy \
			--role-name "$STATE_EBS_CSI_ROLE_NAME" \
			--policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		run_cmd aws iam delete-role \
			--role-name "$STATE_EBS_CSI_ROLE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "iam" "ebs_csi_role_name"
	fi

	# Delete OIDC provider
	if [[ -n "$STATE_OIDC_PROVIDER_ARN" ]]; then
		log "Deleting OIDC provider: $STATE_OIDC_PROVIDER_ARN"
		run_cmd aws iam delete-open-id-connect-provider \
			--open-id-connect-provider-arn "$STATE_OIDC_PROVIDER_ARN" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "iam" "oidc_provider_arn"
	fi

	# Delete ECR repositories (app + icc + machinist)
	if [[ -n "$STATE_ECR_REPO_NAME" && "$STATE_ECR_REPO_CREATED" == "true" ]]; then
		for repo in "$STATE_ECR_REPO_NAME" "watt-benchmark-icc" "watt-benchmark-machinist"; do
			log "Deleting ECR repository: $repo"
			run_cmd aws ecr delete-repository \
				--repository-name "$repo" \
				--force \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		done
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "ecr" "repo_name"
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "ecr" "repo_created"
	fi

	# Delete load test instance profile and role
	if [[ -n "$STATE_LOADTEST_INSTANCE_PROFILE_NAME" ]]; then
		log "Deleting load test instance profile: $STATE_LOADTEST_INSTANCE_PROFILE_NAME"
		run_cmd aws iam remove-role-from-instance-profile \
			--instance-profile-name "$STATE_LOADTEST_INSTANCE_PROFILE_NAME" \
			--role-name "$STATE_LOADTEST_ROLE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		run_cmd aws iam delete-instance-profile \
			--instance-profile-name "$STATE_LOADTEST_INSTANCE_PROFILE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "iam" "loadtest_instance_profile_name"
	fi

	if [[ -n "$STATE_LOADTEST_ROLE_NAME" ]]; then
		log "Deleting load test IAM role: $STATE_LOADTEST_ROLE_NAME"
		run_cmd aws iam delete-role-policy \
			--role-name "$STATE_LOADTEST_ROLE_NAME" \
			--policy-name "S3BenchmarkAccess" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		run_cmd aws iam delete-role \
			--role-name "$STATE_LOADTEST_ROLE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "iam" "loadtest_role_name"
	fi

	# Delete S3 bucket
	if [[ -n "$STATE_S3_BUCKET_NAME" ]]; then
		log "Deleting S3 bucket: $STATE_S3_BUCKET_NAME"
		run_cmd aws s3 rm "s3://$STATE_S3_BUCKET_NAME" --recursive \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		run_cmd aws s3 rb "s3://$STATE_S3_BUCKET_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		[[ "$DRY_RUN" != "true" ]] && mark_resource_cleaned "s3" "bucket_name"
	fi

	# Delete state file if all resources cleaned and not dry run
	if [[ "$DRY_RUN" != "true" ]]; then
		STATE_FILE="$state_file"
		if ! state_has_resources "$state_file"; then
			delete_state_file "$state_file"
			success "All resources cleaned and state file removed"
		else
			warning "Some resources may not have been cleaned. State file retained: $state_file"
		fi
	fi

	success "Cleanup completed for: $STATE_CLUSTER_NAME"
}

main() {
	parse_args "$@"

	# Initialize state directory
	init_state_dir "$PROJECT_ROOT"

	# List mode
	if [[ "$LIST_ONLY" == "true" ]]; then
		list_state_files "$STATE_DIR"
		exit 0
	fi

	# Must specify either --file or --all
	if [[ -z "$STATE_FILE_ARG" && "$CLEANUP_ALL" != "true" ]]; then
		error "Must specify either --file or --all"
		usage
		exit 1
	fi

	# Single file cleanup
	if [[ -n "$STATE_FILE_ARG" ]]; then
		if [[ ! -f "$STATE_FILE_ARG" ]]; then
			error "State file not found: $STATE_FILE_ARG"
			exit 1
		fi
		cleanup_from_state "$STATE_FILE_ARG"
		exit 0
	fi

	# Cleanup all state files
	if [[ "$CLEANUP_ALL" == "true" ]]; then
		local files=$(find "$STATE_DIR" -name "*.json" -type f 2>/dev/null | sort)

		if [[ -z "$files" ]]; then
			log "No state files found in: $STATE_DIR"
			exit 0
		fi

		log "Found state files to clean up:"
		for file in $files; do
			local cluster=$(jq -r '.config.cluster_name // "unknown"' "$file")
			log "  - $cluster ($file)"
		done

		echo ""

		for file in $files; do
			log "=========================================="
			cleanup_from_state "$file"
			log "=========================================="
			echo ""
		done

		success "All cleanup operations completed"
	fi
}

main "$@"
