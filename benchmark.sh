#!/bin/bash

set -e

# Disable AWS CLI pager (prevents less/more from opening)
export AWS_PAGER=""

# Load common functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR" && pwd)"
source "$PROJECT_ROOT/lib/common.sh"

CLUSTER_NAME="${CLUSTER_NAME:-watt-benchmark-$(date +%s)}"
AWS_PROFILE="${AWS_PROFILE}"
NODE_TYPE="${NODE_TYPE:-m5.2xlarge}"
NODE_COUNT="${NODE_COUNT:-3}"
DEMO_SOURCE_DIR="$PROJECT_ROOT/demo"
KUBE_MANIFEST="${DEMO_SOURCE_DIR}/kube.yaml"
AMI_ID="${AMI_ID:-ami-07b2b18045edffe90}" # Amazon Linux 2023 arm64
LOADTESTING_INSTANCE_TYPE="${LOADTESTING_INSTANCE_TYPE:-c7gn.large}"
ECR_REPO_NAME="${ECR_REPO_NAME:-watt-benchmark}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

# Infrastructure resource names (set by creation functions)
CLUSTER_ROLE_NAME=""
NODE_ROLE_NAME=""
VPC_ID=""
SUBNET_IDS=""
IGW_ID=""
RTB_ID=""
CLUSTER_ROLE_ARN=""
NODE_ROLE_ARN=""
KUBE_CONTEXT=""
LOAD_TEST_INSTANCE_ID=""
SECURITY_GROUP_ID=""
AWS_ACCOUNT_ID=""
AWS_REGION=""
ECR_IMAGE_URI=""
ECR_REPO_CREATED=""

cleanup_instances() {
	if [[ -n "$LOAD_TEST_INSTANCE_ID" ]]; then
		log "Terminating load_test instance: $LOAD_TEST_INSTANCE_ID"
		aws ec2 terminate-instances \
			--instance-ids "$LOAD_TEST_INSTANCE_ID" \
			--profile "$AWS_PROFILE" >/dev/null 2>&1 || true
	fi

	if [[ -n "$CLUSTER_NAME" ]]; then
		local nodegroup_name="$CLUSTER_NAME-nodegroup"
		log "Checking for node group: $nodegroup_name"

		if aws eks describe-nodegroup \
			--cluster-name "$CLUSTER_NAME" \
			--nodegroup-name "$nodegroup_name" \
			--profile "$AWS_PROFILE" >/dev/null 2>&1; then

			log "Deleting node group: $nodegroup_name"
			aws eks delete-nodegroup \
				--cluster-name "$CLUSTER_NAME" \
				--nodegroup-name "$nodegroup_name" \
				--profile "$AWS_PROFILE" >/dev/null 2>&1 || true

			log "Waiting for node group deletion..."
			aws eks wait nodegroup-deleted \
				--cluster-name "$CLUSTER_NAME" \
				--nodegroup-name "$nodegroup_name" \
				--profile "$AWS_PROFILE" 2>&1 | grep -v "waiting" || true
		fi
	fi

	if [[ -n "$CLUSTER_NAME" ]]; then
		log "Checking if cluster exists: $CLUSTER_NAME"

		if aws eks describe-cluster \
			--name "$CLUSTER_NAME" \
			--profile "$AWS_PROFILE" >/dev/null 2>&1; then

			log "Deleting EKS cluster: $CLUSTER_NAME"
			aws eks delete-cluster \
				--name "$CLUSTER_NAME" \
				--profile "$AWS_PROFILE" >/dev/null 2>&1 || true

			log "Waiting for cluster deletion..."
			aws eks wait cluster-deleted \
				--name "$CLUSTER_NAME" \
				--profile "$AWS_PROFILE" 2>&1 | grep -v "waiting" || true
		fi
	fi

	if [[ -n "$SECURITY_GROUP_ID" ]]; then
		log "Deleting security group: $SECURITY_GROUP_ID"
		sleep 5
		aws ec2 delete-security-group \
			--group-id "$SECURITY_GROUP_ID" \
			--profile "$AWS_PROFILE" >/dev/null 2>&1 || true
	fi

	if [[ -n "$VPC_ID" ]]; then
		log "Deleting VPC resources..."

		if [[ -n "$IGW_ID" ]]; then
			aws ec2 detach-internet-gateway \
				--internet-gateway-id "$IGW_ID" \
				--vpc-id "$VPC_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
			aws ec2 delete-internet-gateway \
				--internet-gateway-id "$IGW_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		fi

		if [[ -n "$SUBNET_IDS" ]]; then
			IFS=',' read -ra SUBNETS <<< "$SUBNET_IDS"
			for subnet in "${SUBNETS[@]}"; do
				aws ec2 delete-subnet \
					--subnet-id "$subnet" \
					--profile "$AWS_PROFILE" 2>/dev/null || true
			done
		fi

		if [[ -n "$RTB_ID" ]]; then
			aws ec2 delete-route-table \
				--route-table-id "$RTB_ID" \
				--profile "$AWS_PROFILE" 2>/dev/null || true
		fi

		aws ec2 delete-vpc \
			--vpc-id "$VPC_ID" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
	fi

	if [[ -n "$NODE_ROLE_NAME" ]]; then
		log "Deleting node IAM role: $NODE_ROLE_NAME"
		aws iam detach-role-policy \
			--role-name "$NODE_ROLE_NAME" \
			--policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		aws iam detach-role-policy \
			--role-name "$NODE_ROLE_NAME" \
			--policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		aws iam detach-role-policy \
			--role-name "$NODE_ROLE_NAME" \
			--policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		aws iam delete-role \
			--role-name "$NODE_ROLE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
	fi

	if [[ -n "$CLUSTER_ROLE_NAME" ]]; then
		log "Deleting cluster IAM role: $CLUSTER_ROLE_NAME"
		aws iam detach-role-policy \
			--role-name "$CLUSTER_ROLE_NAME" \
			--policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy \
			--profile "$AWS_PROFILE" 2>/dev/null || true
		aws iam delete-role \
			--role-name "$CLUSTER_ROLE_NAME" \
			--profile "$AWS_PROFILE" 2>/dev/null || true
	fi

	if [[ -n "$ECR_REPO_CREATED" && "$ECR_REPO_CREATED" == "true" ]]; then
		log "Deleting ECR repository: $ECR_REPO_NAME"
		aws ecr delete-repository \
			--repository-name "$ECR_REPO_NAME" \
			--force \
			--profile "$AWS_PROFILE" 2>/dev/null || true
	fi
}

trap generic_cleanup EXIT INT TERM

# OS-specific base64 encoding without line wraps
base64_encode() {
	local input="$1"
	if [[ "$OSTYPE" == "darwin"* ]]; then
		# macOS doesn't support -w flag
		printf '%s' "$input" | base64 | tr -d '\n'
	else
		# Linux (GNU coreutils)
		printf '%s' "$input" | base64 -w0
	fi
}

validate_eks_tools() {
	log "Validating EKS tools..."

	if ! check_tool "kubectl" "Please install kubectl: https://kubernetes.io/docs/tasks/tools/"; then
		return 1
	fi

	success "EKS tools validated"
	return 0
}

validate_demo_manifests() {
	log "Validating demo manifests..."

	if [[ ! -f "$KUBE_MANIFEST" ]]; then
		error "Kubernetes manifest not found: $KUBE_MANIFEST"
		error "Expected kube.yaml in demo directory"
		return 1
	fi

	success "Demo manifests validated"
	return 0
}

validate_docker() {
	log "Validating Docker..."

	if ! command -v docker &>/dev/null; then
		error "Docker is not installed. Please install Docker: https://docs.docker.com/get-docker/"
		return 1
	fi

	if ! docker info >/dev/null 2>&1; then
		error "Docker daemon is not running. Please start Docker."
		return 1
	fi

	success "Docker validated"
	return 0
}

setup_aws_info() {
	log "Getting AWS account info..."

	AWS_ACCOUNT_ID=$(aws sts get-caller-identity \
		--profile "$AWS_PROFILE" \
		--query 'Account' \
		--output text)

	AWS_REGION=$(aws configure get region --profile "$AWS_PROFILE")

	if [[ -z "$AWS_ACCOUNT_ID" ]]; then
		error "Could not get AWS account ID"
		return 1
	fi

	if [[ -z "$AWS_REGION" ]]; then
		error "Could not get AWS region. Please set a default region with: aws configure"
		return 1
	fi

	ECR_IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}:${IMAGE_TAG}"

	log "AWS Account: $AWS_ACCOUNT_ID"
	log "AWS Region: $AWS_REGION"
	log "ECR Image: $ECR_IMAGE_URI"

	success "AWS info retrieved"
}

ecr_login() {
	log "Logging in to ECR..."

	aws ecr get-login-password \
		--profile "$AWS_PROFILE" \
		--region "$AWS_REGION" | \
	docker login \
		--username AWS \
		--password-stdin \
		"${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com" >/dev/null 2>&1

	success "ECR login successful"
}

create_ecr_repository() {
	log "Creating ECR repository: $ECR_REPO_NAME"

	if aws ecr describe-repositories \
		--repository-names "$ECR_REPO_NAME" \
		--profile "$AWS_PROFILE" >/dev/null 2>&1; then
		log "Repository already exists"
		return 0
	fi

	aws ecr create-repository \
		--repository-name "$ECR_REPO_NAME" \
		--profile "$AWS_PROFILE" \
		--image-scanning-configuration scanOnPush=false \
		>/dev/null

	ECR_REPO_CREATED="true"
	success "ECR repository created"
}

build_and_push_image() {
	log "Building Docker image for linux/amd64..."
	log "This may take a few minutes..."

	docker build \
		--platform linux/amd64 \
		--build-arg COMMIT_HASH="$(git rev-parse HEAD 2>/dev/null || echo 'unknown')" \
		--build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
		-t "$ECR_IMAGE_URI" \
		"$DEMO_SOURCE_DIR"

	log "Pushing image to ECR..."

	docker push "$ECR_IMAGE_URI"

	success "Image pushed: $ECR_IMAGE_URI"
}

create_security_group_for_load_test() {
	log "Creating security group for load_test instance..."

	local vpc_id=$(aws eks describe-cluster \
		--name "$CLUSTER_NAME" \
		--profile "$AWS_PROFILE" \
		--query 'cluster.resourcesVpcConfig.vpcId' \
		--output text)

	if [[ -z "$vpc_id" || "$vpc_id" == "None" ]]; then
		error "Could not get VPC ID from EKS cluster"
		return 1
	fi

	log "Using VPC from EKS cluster: $vpc_id"

	local timestamp=$(date +%s)
	local sg_name="load_test-sg-$timestamp"

	SECURITY_GROUP_ID=$(aws ec2 create-security-group \
		--group-name "$sg_name" \
		--description "Temporary security group for load_test instance" \
		--vpc-id "$vpc_id" \
		--query 'GroupId' \
		--output text \
		--profile "$AWS_PROFILE")

	log "Created security group: $SECURITY_GROUP_ID"
	success "Security group configured"
}

configure_node_security_for_nodeports() {
	local node_ports=$1

	log "Configuring node security groups for NodePort access..."

	local node_sg=$(aws eks describe-cluster \
		--name "$CLUSTER_NAME" \
		--profile "$AWS_PROFILE" \
		--query 'cluster.resourcesVpcConfig.clusterSecurityGroupId' \
		--output text)

	if [[ -z "$node_sg" || "$node_sg" == "None" ]]; then
		error "Could not get cluster security group"
		return 1
	fi

	log "Cluster security group: $node_sg"

	# Add ingress rules for each NodePort
	IFS=',' read -ra PORTS <<< "$node_ports"
	for port in "${PORTS[@]}"; do
		log "Adding ingress rule for NodePort $port..."

		AWS_PAGER="" aws ec2 authorize-security-group-ingress \
			--group-id "$node_sg" \
			--protocol tcp \
			--port "$port" \
			--source-group "$SECURITY_GROUP_ID" \
			--profile "$AWS_PROFILE" 2>/dev/null || {
			log "  (rule may already exist, continuing...)"
		}
	done

	success "Node security configured for ports: $node_ports"
}

create_vpc_stack() {
	log "Creating VPC infrastructure..."

	VPC_ID=$(aws ec2 create-vpc \
		--cidr-block 10.0.0.0/16 \
		--profile "$AWS_PROFILE" \
		--tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=eks-vpc-$CLUSTER_NAME}]" \
		--query 'Vpc.VpcId' \
		--output text)
	log "Created VPC: $VPC_ID"

	aws ec2 modify-vpc-attribute \
		--vpc-id "$VPC_ID" \
		--enable-dns-hostnames \
		--profile "$AWS_PROFILE"

	local igw_id=$(aws ec2 create-internet-gateway \
		--profile "$AWS_PROFILE" \
		--tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=eks-igw-$CLUSTER_NAME}]" \
		--query 'InternetGateway.InternetGatewayId' \
		--output text)
	log "Created Internet Gateway: $igw_id"

	aws ec2 attach-internet-gateway \
		--vpc-id "$VPC_ID" \
		--internet-gateway-id "$igw_id" \
		--profile "$AWS_PROFILE"

	local azs=($(aws ec2 describe-availability-zones \
		--profile "$AWS_PROFILE" \
		--query 'AvailabilityZones[0:2].ZoneName' \
		--output text))

	local subnet1=$(aws ec2 create-subnet \
		--vpc-id "$VPC_ID" \
		--cidr-block 10.0.1.0/24 \
		--availability-zone "${azs[0]}" \
		--profile "$AWS_PROFILE" \
		--tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=eks-public-subnet-1}]" \
		--query 'Subnet.SubnetId' \
		--output text)

	local subnet2=$(aws ec2 create-subnet \
		--vpc-id "$VPC_ID" \
		--cidr-block 10.0.2.0/24 \
		--availability-zone "${azs[1]}" \
		--profile "$AWS_PROFILE" \
		--tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=eks-public-subnet-2}]" \
		--query 'Subnet.SubnetId' \
		--output text)

	log "Created subnets: $subnet1, $subnet2"

	aws ec2 modify-subnet-attribute \
		--subnet-id "$subnet1" \
		--map-public-ip-on-launch \
		--profile "$AWS_PROFILE"

	aws ec2 modify-subnet-attribute \
		--subnet-id "$subnet2" \
		--map-public-ip-on-launch \
		--profile "$AWS_PROFILE"

	local rtb_id=$(aws ec2 create-route-table \
		--vpc-id "$VPC_ID" \
		--profile "$AWS_PROFILE" \
		--tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=eks-public-rtb}]" \
		--query 'RouteTable.RouteTableId' \
		--output text)
	log "Created route table: $rtb_id"

	aws ec2 create-route \
		--route-table-id "$rtb_id" \
		--destination-cidr-block 0.0.0.0/0 \
		--gateway-id "$igw_id" \
		--profile "$AWS_PROFILE" >/dev/null

	aws ec2 associate-route-table \
		--route-table-id "$rtb_id" \
		--subnet-id "$subnet1" \
		--profile "$AWS_PROFILE" >/dev/null

	aws ec2 associate-route-table \
		--route-table-id "$rtb_id" \
		--subnet-id "$subnet2" \
		--profile "$AWS_PROFILE" >/dev/null

	SUBNET_IDS="$subnet1,$subnet2"
	IGW_ID="$igw_id"
	RTB_ID="$rtb_id"

	log "VPC ID: $VPC_ID"
	log "Subnet IDs: $SUBNET_IDS"
	success "VPC infrastructure created"
}

create_cluster_iam_role() {
	local role_name="eks-cluster-role-$CLUSTER_NAME"
	CLUSTER_ROLE_NAME="$role_name"

	log "Creating EKS cluster IAM role: $role_name"

	cat >/tmp/cluster-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

	aws iam create-role \
		--role-name "$role_name" \
		--assume-role-policy-document file:///tmp/cluster-trust-policy.json \
		--profile "$AWS_PROFILE" \
		>/dev/null

	aws iam attach-role-policy \
		--policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy \
		--role-name "$role_name" \
		--profile "$AWS_PROFILE"

	CLUSTER_ROLE_ARN=$(aws iam get-role \
		--role-name "$role_name" \
		--profile "$AWS_PROFILE" \
		--query 'Role.Arn' \
		--output text)

	log "Cluster role ARN: $CLUSTER_ROLE_ARN"
	success "Cluster IAM role created"
}

create_node_iam_role() {
	local role_name="eks-node-role-$CLUSTER_NAME"
	NODE_ROLE_NAME="$role_name"

	log "Creating EKS node IAM role: $role_name"

	cat >/tmp/node-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      }
    }
  ]
}
EOF

	aws iam create-role \
		--role-name "$role_name" \
		--assume-role-policy-document file:///tmp/node-trust-policy.json \
		--profile "$AWS_PROFILE" \
		>/dev/null

	aws iam attach-role-policy \
		--policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy \
		--role-name "$role_name" \
		--profile "$AWS_PROFILE"

	aws iam attach-role-policy \
		--policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPullOnly \
		--role-name "$role_name" \
		--profile "$AWS_PROFILE"

	aws iam attach-role-policy \
		--policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy \
		--role-name "$role_name" \
		--profile "$AWS_PROFILE"

	NODE_ROLE_ARN=$(aws iam get-role \
		--role-name "$role_name" \
		--profile "$AWS_PROFILE" \
		--query 'Role.Arn' \
		--output text)

	log "Node role ARN: $NODE_ROLE_ARN"
	success "Node IAM role created"
}

create_eks_cluster() {
	log "Creating EKS cluster: $CLUSTER_NAME"
	log "This may take 15-20 minutes..."

	aws eks create-cluster \
		--name "$CLUSTER_NAME" \
		--role-arn "$CLUSTER_ROLE_ARN" \
		--resources-vpc-config subnetIds="$SUBNET_IDS" \
		--profile "$AWS_PROFILE" \
		>/dev/null

	log "Waiting for cluster to be ACTIVE..."
	local max_attempts=60
	local retry_delay=15

	for ((i = 1; i <= max_attempts; i++)); do
		local status=$(aws eks describe-cluster \
			--name "$CLUSTER_NAME" \
			--profile "$AWS_PROFILE" \
			--query 'cluster.status' \
			--output text)

		if [[ "$status" == "ACTIVE" ]]; then
			success "EKS cluster is ACTIVE"
			return 0
		fi

		if ((i % 4 == 0)); then
			log "Cluster status: $status (attempt $i/$max_attempts)"
		fi
		sleep "$retry_delay"
	done

	error "Cluster not ACTIVE after $((max_attempts * retry_delay)) seconds"
	return 1
}

create_nodegroup() {
	local nodegroup_name="$CLUSTER_NAME-nodegroup"

	log "Creating managed node group: $nodegroup_name"

	aws eks create-nodegroup \
		--cluster-name "$CLUSTER_NAME" \
		--nodegroup-name "$nodegroup_name" \
		--node-role "$NODE_ROLE_ARN" \
		--subnets $(echo "$SUBNET_IDS" | tr ',' ' ') \
		--instance-types "$NODE_TYPE" \
		--scaling-config minSize="$NODE_COUNT",maxSize="$NODE_COUNT",desiredSize="$NODE_COUNT" \
		--profile "$AWS_PROFILE" \
		>/dev/null

	log "Waiting for node group to be ACTIVE..."
	local max_attempts=60
	local retry_delay=10

	for ((i = 1; i <= max_attempts; i++)); do
		local status=$(aws eks describe-nodegroup \
			--cluster-name "$CLUSTER_NAME" \
			--nodegroup-name "$nodegroup_name" \
			--profile "$AWS_PROFILE" \
			--query 'nodegroup.status' \
			--output text 2>/dev/null || echo "CREATING")

		if [[ "$status" == "ACTIVE" ]]; then
			success "Node group is ACTIVE"
			return 0
		fi

		if ((i % 6 == 0)); then
			log "Node group status: $status (attempt $i/$max_attempts)"
		fi
		sleep "$retry_delay"
	done

	error "Node group not ACTIVE after $((max_attempts * retry_delay)) seconds"
	return 1
}

wait_for_nodes() {
	log "Waiting for nodes to be ready..."

	local max_attempts=60
	local retry_delay=5

	for ((i = 1; i <= max_attempts; i++)); do
		local ready_nodes=$(kubectl --context "$KUBE_CONTEXT" get nodes --no-headers 2>/dev/null | grep -c " Ready" || echo "0")

		if [[ "$ready_nodes" -ge "$NODE_COUNT" ]]; then
			success "All $NODE_COUNT nodes are ready"
			return 0
		fi

		if ((i % 10 == 0)); then
			log "Still waiting for nodes... $ready_nodes/$NODE_COUNT ready (attempt $i/$max_attempts)"
		fi
		sleep "$retry_delay"
	done

	error "Nodes not ready after $((max_attempts * retry_delay)) seconds"
	return 1
}

apply_demo_manifests() {
	log "Applying demo manifests from $KUBE_MANIFEST..."

	# Template the manifest with ECR image URI
	sed "s|IMAGE_PLACEHOLDER|${ECR_IMAGE_URI}|g" "$KUBE_MANIFEST" | \
		kubectl --context "$KUBE_CONTEXT" apply -f -

	success "Demo manifests applied"
}

wait_for_pods() {
	log "Waiting for pods to be ready..."

	local max_attempts=120
	local retry_delay=5

	for ((i = 1; i <= max_attempts; i++)); do
		local pods=$(kubectl --context "$KUBE_CONTEXT" get pods --all-namespaces --no-headers 2>/dev/null | grep -v "kube-system" || echo "")

		if [[ -z "$pods" ]]; then
			if ((i % 10 == 0)); then
				log "No pods found yet... (attempt $i/$max_attempts)"
			fi
			sleep "$retry_delay"
			continue
		fi

		# Check if all pods are ready (status shows "Running" and ready count matches total count)
		local not_ready=$(echo "$pods" | awk '{
			# Extract ready count (e.g., "1/1" -> both should match)
			split($3, ready, "/");
			if (ready[1] != ready[2] || $4 != "Running") {
				print $0
			}
		}')

		if [[ -z "$not_ready" ]]; then
			success "All pods are ready"
			kubectl --context "$KUBE_CONTEXT" get pods --all-namespaces | grep -v "kube-system"
			return 0
		fi

		if ((i % 10 == 0)); then
			log "Still waiting for pods to be ready... (attempt $i/$max_attempts)"
			kubectl --context "$KUBE_CONTEXT" get pods --all-namespaces | grep -v "kube-system" || true
		fi
		sleep "$retry_delay"
	done

	error "Pods not ready after $((max_attempts * retry_delay)) seconds"
	kubectl --context "$KUBE_CONTEXT" get pods --all-namespaces
	return 1
}

find_annotated_nodeport_services() {
	log "Finding annotated NodePort services..."

	# Find all services with the benchmark annotation
	local services=$(kubectl --context "$KUBE_CONTEXT" get services -o json | jq -r '.items[] |
		select(.metadata.annotations["benchmark.platformatic.dev/expose"] == "true") |
		select(.spec.type == "NodePort") |
		{name: .metadata.name, port: .spec.ports[0].nodePort} |
		"\(.name):\(.port)"')

	if [[ -z "$services" ]]; then
		error "No NodePort services found with annotation benchmark.platformatic.dev/expose=true"
		log "Available services:"
		kubectl --context "$KUBE_CONTEXT" get services
		return 1
	fi

	log "Found annotated services:"
	echo "$services" | while read -r svc; do
		log "  - $svc"
	done

	echo "$services"
}

get_node_private_ip() {
	log "Getting private IP of a cluster node..."

	local node_ip=$(kubectl --context "$KUBE_CONTEXT" get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')

	if [[ -z "$node_ip" ]]; then
		error "Could not get node private IP"
		kubectl --context "$KUBE_CONTEXT" get nodes -o wide
		return 1
	fi

	log "Node private IP: $node_ip"
	echo "$node_ip"
}

get_node_ports_list() {
	local services=$1
	echo "$services" | while read -r svc; do
		echo "$svc" | cut -d: -f2
	done | tr '\n' ',' | sed 's/,$//'
}

get_instance_ip() {
	aws ec2 describe-instances \
		--instance-ids "$1" \
		--query 'Reservations[0].Instances[0].PublicIpAddress' \
		--profile "$AWS_PROFILE" \
		--output text
}

launch_load_test_instance() {
	local node_ip=$1
	local service_ports=$2

	log "Launching load_test EC2 instance..."

	# Get a private subnet from the EKS cluster VPC (load_test needs to reach private node IPs)
	local vpc_id=$(aws eks describe-cluster \
		--name "$CLUSTER_NAME" \
		--profile "$AWS_PROFILE" \
		--query 'cluster.resourcesVpcConfig.vpcId' \
		--output text)

	# Use private subnet since nodes are on private IPs
	local subnet_id=$(aws ec2 describe-subnets \
		--filters "Name=vpc-id,Values=$vpc_id" \
		--profile "$AWS_PROFILE" \
		--query 'Subnets[0].SubnetId' \
		--output text)

	if [[ -z "$subnet_id" || "$subnet_id" == "None" ]]; then
		error "Could not find subnet in VPC"
		return 1
	fi

	log "Using subnet: $subnet_id"

	local load_test_script
	load_test_script=$(cat "$DEMO_SOURCE_DIR/loadtest.sh")
	# log "Loadtest script: $load_test_script"

	# Create user data script for load_test instance
	IFS='' read -r -d '' ac_user_script <<EOF || true
#!/bin/bash
set -x

yum update -y
yum install -y httpd-tools

# Install k6 from static binary for ARM64 support
K6_VERSION=\$(curl -s https://api.github.com/repos/grafana/k6/releases/latest | grep -oP '"tag_name": "v\K[^"]+')
curl -L "https://github.com/grafana/k6/releases/download/v\${K6_VERSION}/k6-v\${K6_VERSION}-linux-arm64.tar.gz" -o /tmp/k6.tar.gz
tar -xzf /tmp/k6.tar.gz -C /tmp
mv "/tmp/k6-v\${K6_VERSION}-linux-arm64/k6" /usr/local/bin/k6
chmod +x /usr/local/bin/k6
rm -rf /tmp/k6*

sysctl net.core.rmem_default=268435456
sysctl net.core.wmem_default=268435456
sysctl net.core.rmem_max=268435456
sysctl net.core.wmem_max=268435456
sysctl net.core.netdev_max_backlog=100000
sysctl "net.ipv4.tcp_rmem=4096 16384 134217728"
sysctl "net.ipv4.tcp_wmem=4096 16384 134217728"
sysctl "net.ipv4.tcp_mem=786432 1048576 268435456"
sysctl net.ipv4.tcp_max_tw_buckets=360000
sysctl net.ipv4.tcp_max_syn_backlog=10000
sysctl vm.min_free_kbytes=65536
sysctl vm.swappiness=0
sysctl net.core.somaxconn=10000
sysctl fs.file-max=65536

# Port exhaustion - you're likely hitting this
sysctl net.ipv4.ip_local_port_range="1024 65535"  # Current default is probably 32768-60999

# TIME_WAIT socket reuse (essential for load testing)
sysctl net.ipv4.tcp_tw_reuse=1

# Reduce TIME_WAIT duration from 60s to 30s
sysctl net.netfilter.nf_conntrack_tcp_timeout_time_wait=30  # If using conntrack

ulimit -n 1000000
sysctl fs.file-max=2097152  # System-wide
sysctl fs.nr_open=2097152

echo 'Starting benchmark against node $node_ip'
export TARGET_URL=$node_ip

$load_test_script

echo 'Benchmark completed - instance will terminate'
EOF

	local ac_user_data=$(base64_encode "$ac_user_script")

	LOAD_TEST_INSTANCE_ID=$(aws ec2 run-instances \
		--image-id "$AMI_ID" \
		--count 1 \
		--instance-type "$LOADTESTING_INSTANCE_TYPE" \
		--user-data "${ac_user_data}" \
		--subnet-id "$subnet_id" \
		--security-group-ids "$SECURITY_GROUP_ID" \
		--tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=benchmark-load_test}]" \
		--query 'Instances[0].InstanceId' \
		--output text \
		--profile "$AWS_PROFILE")

	success "load_test instance launched: $LOAD_TEST_INSTANCE_ID"
}

parse_console_output() {
	local temp_file=$(mktemp)
	cat >"$temp_file"

	local start_line=$(grep -n "Starting benchmark" "$temp_file" |
		grep -v '+ echo' |
		tail -1 |
		cut -d: -f1)

	local end_line=$(tail -n +$start_line "$temp_file" |
		grep -n "Benchmark completed" |
		grep -v '+ echo' |
		head -1 |
		cut -d: -f1)
	end_line=$((start_line + end_line - 1))

	sed -n "${start_line},${end_line}p" "$temp_file" |
		sed -E 's/^\[[^]]+\] cloud-init\[[0-9]+\]: //' |
		grep -v '^+ ' |
		grep -Ev 'docker run|entered blocking|entered disabled|entered promiscuous|left promiscuous|renamed from|link becomes ready|entered forwarding'

	rm -f "$temp_file"
}

monitor_load_test() {
	local instance_id=$1
	local previous_output=""
	local current_output=""
	local all_output=""

	log "Monitoring load_test instance console output..."
	log "Waiting for benchmark to complete (this may take a few minutes)..."

	while true; do
		current_output=$(aws ec2 get-console-output \
			--instance-id "$instance_id" \
			--query 'Output' \
			--output text \
			--latest \
			--profile "$AWS_PROFILE")

		if [[ -n "$current_output" && "$current_output" != "$previous_output" ]]; then
			previous_output="$current_output"
			all_output+="$current_output"
		fi

		if echo "$current_output" | grep -q "Benchmark completed"; then
			echo "$all_output" | parse_console_output
			success "Benchmark execution completed!"
			break
		fi

		sleep 10
	done
}

main() {
	if ! validate_aws_tools || ! validate_common_tools || ! validate_eks_tools || ! validate_docker; then
		error "Tool validation failed"
		exit 1
	fi

	if ! validate_required_vars "AWS_PROFILE"; then
		exit 1
	fi

	if ! validate_demo_manifests; then
		exit 1
	fi

	# Setup AWS info and ECR
	if ! setup_aws_info; then
		exit 1
	fi

	ecr_login
	create_ecr_repository
	build_and_push_image

	# Create infrastructure
	create_vpc_stack
	create_cluster_iam_role
	create_node_iam_role
	create_eks_cluster

	KUBE_CONTEXT="$CLUSTER_NAME"
	log "Updating kubeconfig with context: $KUBE_CONTEXT"
	aws eks update-kubeconfig \
		--name "$CLUSTER_NAME" \
		--profile "$AWS_PROFILE" \
		--alias "$KUBE_CONTEXT"

	create_nodegroup
	wait_for_nodes

	apply_demo_manifests
	wait_for_pods

	local services=$(find_annotated_nodeport_services)

	if [[ -z "$services" ]]; then
		error "Could not find annotated NodePort services"
		exit 1
	fi

	local node_ip=$(get_node_private_ip)

	if [[ -z "$node_ip" ]]; then
		error "Could not get node IP"
		exit 1
	fi

	local node_ports=$(get_node_ports_list "$services")

	log "Services will be accessible at: $node_ip"
	log "NodePorts: $node_ports"

	create_security_group_for_load_test

	configure_node_security_for_nodeports "$node_ports"

	launch_load_test_instance "$node_ip" "$node_ports"

	log "Waiting for load_test instance to be running..."
	aws ec2 wait instance-running \
		--instance-ids "$LOAD_TEST_INSTANCE_ID" \
		--profile "$AWS_PROFILE"

	monitor_load_test "$LOAD_TEST_INSTANCE_ID"

	success "Benchmark orchestration completed!"
}

main "$@"
