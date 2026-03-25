#!/bin/bash

# State management functions for persistent benchmark resource tracking
# Enables cleanup of orphaned AWS resources after power loss or script interruption

STATE_DIR="${STATE_DIR:-.benchmark-state}"
STATE_FILE=""
STATE_VERSION="1"

# Initialize state directory
init_state_dir() {
	local project_root="${1:-$PROJECT_ROOT}"
	STATE_DIR="${project_root}/${STATE_DIR}"

	if [[ ! -d "$STATE_DIR" ]]; then
		mkdir -p "$STATE_DIR"
		log "Created state directory: $STATE_DIR"
	fi
}

# Create a new state file for this benchmark run
# Args: cluster_name, aws_profile, aws_region
create_state_file() {
	local cluster_name="$1"
	local aws_profile="$2"
	local aws_region="$3"

	if [[ -z "$cluster_name" ]]; then
		error "create_state_file: cluster_name is required"
		return 1
	fi

	STATE_FILE="${STATE_DIR}/${cluster_name}.json"

	local created_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

	cat > "$STATE_FILE" <<EOF
{
  "version": "$STATE_VERSION",
  "created_at": "$created_at",
  "updated_at": "$created_at",
  "status": "initializing",
  "config": {
    "aws_profile": "${aws_profile:-}",
    "aws_region": "${aws_region:-}",
    "cluster_name": "$cluster_name"
  },
  "resources": {}
}
EOF

	log "Created state file: $STATE_FILE"
}

# Atomic write helper - writes to temp file then moves
_atomic_write() {
	local file="$1"
	local content="$2"
	local temp_file="${file}.tmp.$$"

	echo "$content" > "$temp_file"
	mv "$temp_file" "$file"
}

# Save a resource to the state file
# Args: category, key, value
# Example: save_resource "vpc" "vpc_id" "vpc-12345"
save_resource() {
	local category="$1"
	local key="$2"
	local value="$3"

	if [[ -z "$STATE_FILE" || ! -f "$STATE_FILE" ]]; then
		warning "save_resource: No state file initialized"
		return 1
	fi

	if [[ -z "$category" || -z "$key" ]]; then
		error "save_resource: category and key are required"
		return 1
	fi

	local updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

	# Use jq to update the state file atomically
	local updated=$(jq \
		--arg cat "$category" \
		--arg key "$key" \
		--arg val "$value" \
		--arg ts "$updated_at" \
		'.resources[$cat][$key] = $val | .updated_at = $ts' \
		"$STATE_FILE")

	_atomic_write "$STATE_FILE" "$updated"
}

# Save multiple resources at once (array values)
# Args: category, key, value1 value2 value3...
# Example: save_resource_array "vpc" "subnet_ids" "subnet-1" "subnet-2"
save_resource_array() {
	local category="$1"
	local key="$2"
	shift 2
	local values=("$@")

	if [[ -z "$STATE_FILE" || ! -f "$STATE_FILE" ]]; then
		warning "save_resource_array: No state file initialized"
		return 1
	fi

	local updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

	# Convert bash array to JSON array
	local json_array=$(printf '%s\n' "${values[@]}" | jq -R . | jq -s .)

	local updated=$(jq \
		--arg cat "$category" \
		--arg key "$key" \
		--argjson val "$json_array" \
		--arg ts "$updated_at" \
		'.resources[$cat][$key] = $val | .updated_at = $ts' \
		"$STATE_FILE")

	_atomic_write "$STATE_FILE" "$updated"
}

# Mark a resource as cleaned (remove from state)
# Args: category, key
mark_resource_cleaned() {
	local category="$1"
	local key="$2"

	if [[ -z "$STATE_FILE" || ! -f "$STATE_FILE" ]]; then
		return 0  # No state file, nothing to mark
	fi

	local updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

	local updated=$(jq \
		--arg cat "$category" \
		--arg key "$key" \
		--arg ts "$updated_at" \
		'del(.resources[$cat][$key]) |
		 if .resources[$cat] == {} then del(.resources[$cat]) else . end |
		 .updated_at = $ts' \
		"$STATE_FILE")

	_atomic_write "$STATE_FILE" "$updated"
}

# Update the run status
# Args: status (initializing, running, cleaning, completed, failed)
update_state_status() {
	local new_status="$1"

	if [[ -z "$STATE_FILE" || ! -f "$STATE_FILE" ]]; then
		return 0  # No state file, nothing to update
	fi

	local updated_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)

	local updated=$(jq \
		--arg new_status "$new_status" \
		--arg ts "$updated_at" \
		'.status = $new_status | .updated_at = $ts' \
		"$STATE_FILE")

	_atomic_write "$STATE_FILE" "$updated"
}

# Load state from a file into environment variables
# Returns values via global variables prefixed with STATE_
# Args: state_file_path
load_state() {
	local file="${1:-$STATE_FILE}"

	if [[ ! -f "$file" ]]; then
		error "State file not found: $file"
		return 1
	fi

	# Load config
	STATE_AWS_PROFILE=$(jq -r '.config.aws_profile // empty' "$file")
	STATE_AWS_REGION=$(jq -r '.config.aws_region // empty' "$file")
	STATE_CLUSTER_NAME=$(jq -r '.config.cluster_name // empty' "$file")
	STATE_STATUS=$(jq -r '.status // empty' "$file")
	STATE_CREATED_AT=$(jq -r '.created_at // empty' "$file")

	# Load resources - VPC
	STATE_VPC_ID=$(jq -r '.resources.vpc.vpc_id // empty' "$file")
	STATE_IGW_ID=$(jq -r '.resources.vpc.igw_id // empty' "$file")
	STATE_RTB_ID=$(jq -r '.resources.vpc.rtb_id // empty' "$file")
	STATE_SUBNET_IDS=$(jq -r '.resources.vpc.subnet_ids // [] | join(",")' "$file")

	# Load resources - IAM
	STATE_CLUSTER_ROLE_NAME=$(jq -r '.resources.iam.cluster_role_name // empty' "$file")
	STATE_NODE_ROLE_NAME=$(jq -r '.resources.iam.node_role_name // empty' "$file")
	STATE_EBS_CSI_ROLE_NAME=$(jq -r '.resources.iam.ebs_csi_role_name // empty' "$file")
	STATE_LOADTEST_ROLE_NAME=$(jq -r '.resources.iam.loadtest_role_name // empty' "$file")
	STATE_LOADTEST_INSTANCE_PROFILE_NAME=$(jq -r '.resources.iam.loadtest_instance_profile_name // empty' "$file")

	# Load resources - EKS
	STATE_NODEGROUP_NAME=$(jq -r '.resources.eks.nodegroup_name // empty' "$file")

	# Load resources - EC2
	STATE_SECURITY_GROUP_ID=$(jq -r '.resources.ec2.security_group_id // empty' "$file")
	STATE_LOAD_TEST_INSTANCE_ID=$(jq -r '.resources.ec2.load_test_instance_id // empty' "$file")

	# Load resources - ECR
	STATE_ECR_REPO_NAME=$(jq -r '.resources.ecr.repo_name // empty' "$file")
	STATE_ECR_REPO_CREATED=$(jq -r '.resources.ecr.repo_created // empty' "$file")

	# Load resources - S3
	STATE_S3_BUCKET_NAME=$(jq -r '.resources.s3.bucket_name // empty' "$file")

	return 0
}

# List all state files with their status
list_state_files() {
	local state_dir="${1:-$STATE_DIR}"

	if [[ ! -d "$state_dir" ]]; then
		echo "No state directory found at: $state_dir"
		return 0
	fi

	local files=$(find "$state_dir" -name "*.json" -type f 2>/dev/null | sort)

	if [[ -z "$files" ]]; then
		echo "No state files found in: $state_dir"
		return 0
	fi

	printf "%-45s %-15s %-25s %s\n" "CLUSTER" "STATUS" "CREATED" "PROFILE"
	printf "%-45s %-15s %-25s %s\n" "-------" "------" "-------" "-------"

	for file in $files; do
		local cluster_name=$(jq -r '.config.cluster_name // "unknown"' "$file")
		local file_status=$(jq -r '.status // "unknown"' "$file")
		local created=$(jq -r '.created_at // "unknown"' "$file")
		local profile=$(jq -r '.config.aws_profile // "default"' "$file")

		printf "%-45s %-15s %-25s %s\n" "$cluster_name" "$file_status" "$created" "$profile"
	done
}

# Get state file path for a cluster
get_state_file() {
	local cluster_name="$1"
	local state_dir="${2:-$STATE_DIR}"

	echo "${state_dir}/${cluster_name}.json"
}

# Delete state file after successful cleanup
delete_state_file() {
	local file="${1:-$STATE_FILE}"

	if [[ -f "$file" ]]; then
		rm -f "$file"
		log "Deleted state file: $file"
	fi
}

# Check if state has any remaining resources
state_has_resources() {
	local file="${1:-$STATE_FILE}"

	if [[ ! -f "$file" ]]; then
		return 1
	fi

	local resource_count=$(jq '.resources | to_entries | length' "$file")
	[[ "$resource_count" -gt 0 ]]
}

# Get current state file path
get_current_state_file() {
	echo "$STATE_FILE"
}

