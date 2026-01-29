#!/bin/bash

set -e

# Load common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
source "$PROJECT_ROOT/lib/common.sh"

AWS_PROFILE="${AWS_PROFILE}"
ECR_REPO_NAME="${ECR_REPO_NAME:-watt-benchmark}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DEMO_SOURCE_DIR="$PROJECT_ROOT/demo"

# Validate required tools
validate_build_tools() {
	log "Validating build tools..."

	if ! check_tool "docker" "Please install Docker: https://docs.docker.com/get-docker/"; then
		return 1
	fi

	success "Build tools validated"
	return 0
}

get_aws_account_id() {
	aws sts get-caller-identity \
		--profile "$AWS_PROFILE" \
		--query 'Account' \
		--output text
}

get_aws_region() {
	aws configure get region --profile "$AWS_PROFILE"
}

ecr_login() {
	local account_id=$1
	local region=$2

	log "Logging in to ECR..."

	aws ecr get-login-password \
		--profile "$AWS_PROFILE" \
		--region "$region" | \
	docker login \
		--username AWS \
		--password-stdin \
		"${account_id}.dkr.ecr.${region}.amazonaws.com"

	success "ECR login successful"
}

create_ecr_repository() {
	local repo_name=$1

	log "Creating ECR repository: $repo_name"

	if aws ecr describe-repositories \
		--repository-names "$repo_name" \
		--profile "$AWS_PROFILE" >/dev/null 2>&1; then
		log "Repository already exists"
		return 0
	fi

	aws ecr create-repository \
		--repository-name "$repo_name" \
		--profile "$AWS_PROFILE" \
		--image-scanning-configuration scanOnPush=false \
		>/dev/null

	success "ECR repository created"
}

build_and_push_image() {
	local account_id=$1
	local region=$2
	local repo_name=$3
	local tag=$4

	local ecr_uri="${account_id}.dkr.ecr.${region}.amazonaws.com/${repo_name}:${tag}"

	log "Building Docker image for linux/amd64..."
	log "This may take a few minutes..."

	docker build \
		--platform linux/amd64 \
		--build-arg COMMIT_HASH="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
		--build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
		-t "$ecr_uri" \
		"$DEMO_SOURCE_DIR"

	log "Pushing image to ECR..."

	docker push "$ecr_uri"

	success "Image pushed: $ecr_uri"
	echo "$ecr_uri"
}

main() {
	if ! validate_aws_tools || ! validate_common_tools || ! validate_build_tools; then
		error "Tool validation failed"
		exit 1
	fi

	if ! validate_required_vars "AWS_PROFILE"; then
		exit 1
	fi

	local account_id=$(get_aws_account_id)
	local region=$(get_aws_region)

	if [[ -z "$account_id" ]]; then
		error "Could not get AWS account ID"
		exit 1
	fi

	if [[ -z "$region" ]]; then
		error "Could not get AWS region. Please set a default region with: aws configure"
		exit 1
	fi

	log "AWS Account: $account_id"
	log "AWS Region: $region"

	ecr_login "$account_id" "$region"
	create_ecr_repository "$ECR_REPO_NAME"

	local image_uri=$(build_and_push_image "$account_id" "$region" "$ECR_REPO_NAME" "$IMAGE_TAG")

	echo ""
	success "Build complete!"
	echo "Image URI: $image_uri"
	echo ""
	echo "Run the benchmark with:"
	echo "  AWS_PROFILE=$AWS_PROFILE ./benchmark.sh"
}

main "$@"
