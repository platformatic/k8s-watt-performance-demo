# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Kubernetes-based benchmarking framework for running Platformatic Watt performance tests on Amazon EKS (Elastic Kubernetes Service). The benchmark compares application performance when running with Node.js, PM2, and Platformatic Watt across different frameworks (Next.js, React Router, TanStack).

## Architecture

The repository follows a multi-framework architecture:

1. **Common Functions Library** (`lib/common.sh`) - Shared bash functions for logging, tool validation, HTTP health checks, and cleanup
2. **Framework Applications** - Each framework has its own directory:
   - `next/` - Next.js application
   - `react-router/` - React Router application
   - `tanstack/` - TanStack Start application
3. **EKS Orchestration** (`benchmark.sh`) - Main benchmarking script that creates AWS infrastructure, deploys to EKS, runs load tests, and cleans up

### Key Design Decisions

- **Pure AWS CLI**: Creates all infrastructure using AWS CLI (no eksctl, CloudFormation, or Terraform)
- **Local Docker Build + ECR**: Images are built locally and pushed to an ephemeral ECR repository (no external CI/CD dependency)
- **Multi-Framework Support**: Use `FRAMEWORK` env var to select which framework to benchmark (default: `next`)
- **AWS Network Load Balancers**: Each service gets its own internal NLB for proper load distribution
  - Traffic distributed across all nodes at the network layer
  - Services annotated with `benchmark.platformatic.dev/expose: "true"` are discovered and benchmarked
  - NLB annotations: `aws-load-balancer-type: nlb`, `aws-load-balancer-scheme: internal`
- **Topology Spread Constraints**: Pods are distributed evenly across cluster nodes
  - Uses `topologySpreadConstraints` with `maxSkew: 1` on `kubernetes.io/hostname`
  - Ensures balanced resource utilization during benchmarks
- **Separate Load Testing Instance**: k6 runs on a dedicated EC2 instance (not in the cluster) to simulate realistic network conditions and avoid resource contention
- **Automatic Cleanup**: All resources (cluster, node group, VPC, IAM roles, EC2 instance, ECR repository, NLBs) are cleaned up via trap handlers on exit/failure

### Infrastructure Flow

1. Creates ECR repository and builds/pushes Docker image locally
2. Creates VPC with subnets, internet gateway, and route tables
3. Creates IAM roles for cluster and nodes
4. Creates EKS cluster and managed node group
5. Configures kubectl context (cluster name)
6. Deploys framework application from `kube.yaml` (templated with ECR image URI)
7. Waits for pods to be ready using kubectl
8. Discovers annotated LoadBalancer services
9. Waits for NLB hostnames to be assigned
10. Launches EC2 instance running k6 load tests against NLB endpoints
11. Monitors console output and displays results
12. Cleans up all resources (including ECR repository and NLBs)

## Running Benchmarks

### Prerequisites

Before running benchmarks, ensure:
- Docker is installed and running
- AWS CLI v2 is installed and configured with a default region
- kubectl is installed
- jq is installed
- AWS profile has required permissions (see `lib/minimum-policy.json`)

Apply required AWS IAM permissions:
```sh
AWS_PROFILE=<profile-name> ./setup-policy.sh
```

### Execute Benchmark

Run the main benchmark script:
```sh
# Benchmark Next.js (default)
AWS_PROFILE=<profile-name> ./benchmark.sh

# Benchmark React Router
AWS_PROFILE=<profile-name> FRAMEWORK=react-router ./benchmark.sh

# Benchmark TanStack
AWS_PROFILE=<profile-name> FRAMEWORK=tanstack ./benchmark.sh
```

The script will:
- Build Docker image locally and push to ECR
- Create an EKS cluster (takes 15-20 minutes)
- Deploy the selected framework with three variants (Node, PM2, Watt)
- Launch EC2 instance running k6 load tests
- Display performance results
- Clean up all resources automatically (including ECR repository)

### Environment Variables

Required:
- `AWS_PROFILE` - AWS CLI profile to use

Optional (with defaults):
- `FRAMEWORK` - Framework to benchmark (default: `next`, options: `next`, `react-router`, `tanstack`)
- `CLUSTER_NAME` - EKS cluster name (default: `watt-benchmark-<timestamp>`)
- `NODE_TYPE` - EC2 instance type for EKS nodes (default: `m5.2xlarge`)
- `NODE_COUNT` - Number of worker nodes (default: `4`)
- `AMI_ID` - Amazon Linux 2023 ARM64 AMI for load testing EC2 (resolved from the regional AWS public parameter unless explicitly set)
- `LOADTESTING_INSTANCE_TYPE` - EC2 instance type for k6 (default: `c7gn.2xlarge`, 16GB RAM for 10k VUs)
- `ECR_REPO_NAME` - ECR repository name (default: `watt-benchmark`)
- `IMAGE_TAG` - Docker image tag (default: `latest`)

## Framework Application Structure

Each framework directory (`next/`, `react-router/`, `tanstack/`) contains:

### Common Files
- `Dockerfile` - Docker image build configuration
- `entrypoint.sh` - Docker entrypoint that runs `npm run $SCRIPT_NAME`
- `kube.yaml` - Kubernetes manifests for three deployment variants
- `loadtest.sh` - k6 load testing script
- `ecosystem.config.js` - PM2 configuration
- `watt.json` - Platformatic Watt configuration
- `package.json` - NPM scripts and dependencies

### Package Scripts
- `start:node` - Run with standalone Node.js server
- `start:pm2r` - Run with PM2 (2 workers by default)
- `start:watt` - Run with Platformatic Watt (2 workers by default)

### Kubernetes Deployment (`kube.yaml`)
- Three Deployments: `<framework>` (Node), `<framework>-pm2`, `<framework>-watt`
  - Each deployment has `topologySpreadConstraints` for even distribution across nodes
- Three Services with LoadBalancer type (AWS NLB) and benchmark annotation
  - All services expose port 80, each gets its own NLB hostname
- Environment variables control which script runs (`SCRIPT_NAME`, `WORKERS`)
- Image reference uses `IMAGE_PLACEHOLDER`, templated at deploy time with ECR URI

### Docker Image (`Dockerfile`)
- Based on Node 24 Alpine
- Builds app during image build
- `entrypoint.sh` executes `npm run $SCRIPT_NAME` to start the appropriate server

### Local Development

```sh
cd next  # or react-router
npm install
npm run dev      # Development server with hot reload
npm run build    # Build app
```

### Load Testing

The `loadtest.sh` script runs k6 load tests sequentially against all three services:
- 1000 requests/second for 120 seconds per service (Next.js) or 10000 req/s (React Router)
- 480 second cooldown between tests
- Tests run on separate EC2 instance within same VPC
- Uses LoadBalancer URLs passed via `URL_NODE`, `URL_PM2`, `URL_WATT` environment variables

## CI/CD

GitHub Actions (`.github/workflows/main.yml`) automatically builds and pushes the Docker image to `platformatic/k8s-watt-performance-demo-next` on Docker Hub when changes are pushed to `demo/` on the `main` branch. Images are built for both `linux/amd64` and `linux/arm64` platforms.

## Common Functions (lib/common.sh)

Shared utilities used by benchmark script:

- **Logging**: `log()`, `error()`, `success()`, `warning()` - Colored output functions
- **Validation**: `check_tool()`, `validate_aws_tools()`, `validate_common_tools()`, `validate_required_vars()`
- **Health Checks**: `wait_for_http()` - Polls HTTP endpoint until ready
- **Cleanup**: `generic_cleanup()` - Calls provider-specific `cleanup_instances()`

## Code Style

- **Shell Scripts**: Bash with `set -e`, use common.sh logging functions
- **AWS Operations**: Use `--profile "$AWS_PROFILE"` for all AWS CLI commands
- **Error Handling**: Trap handlers for cleanup, `|| true` for best-effort cleanup operations
- **Quiet Mode**: Redirect verbose output to `/dev/null` or filter with grep
