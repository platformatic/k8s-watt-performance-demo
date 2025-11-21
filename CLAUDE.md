# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Kubernetes-based benchmarking framework for running Platformatic Watt performance tests on Amazon EKS (Elastic Kubernetes Service). The benchmark compares Next.js application performance when running with Node.js, PM2, and Platformatic Watt.

## Architecture

The repository follows a three-component architecture:

1. **Common Functions Library** (`lib/common.sh`) - Shared bash functions for logging, tool validation, HTTP health checks, and cleanup
2. **Demo Application** (`demo/`) - Next.js application that can be run with different process managers (Node, PM2, Watt)
3. **EKS Orchestration** (`benchmark.sh`) - Main benchmarking script that creates AWS infrastructure, deploys to EKS, runs load tests, and cleans up

### Key Design Decisions

- **Pure AWS CLI**: Creates all infrastructure using AWS CLI (no eksctl, CloudFormation, or Terraform)
- **NodePort Services**: Demo services use NodePort (not LoadBalancer) accessed via node private IPs
  - Supports multiple services with single node IP (different ports)
  - No LoadBalancer costs
  - Services annotated with `benchmark.platformatic.dev/expose: "true"` are discovered and benchmarked
- **Separate Load Testing Instance**: Autocannon runs on a dedicated EC2 instance (not in the cluster) to simulate realistic network conditions and avoid resource contention
- **Automatic Cleanup**: All resources (cluster, node group, VPC, IAM roles, EC2 instance) are cleaned up via trap handlers on exit/failure

### Infrastructure Flow

1. Creates VPC with subnets, internet gateway, and route tables
2. Creates IAM roles for cluster and nodes
3. Creates EKS cluster and managed node group
4. Configures kubectl context (cluster name)
5. Deploys demo application from `kube.yaml`
6. Waits for pods to be ready using kubectl
7. Discovers annotated NodePort services
8. Configures security groups for NodePort access
9. Launches EC2 instance running k6 load tests
10. Monitors console output and displays results
11. Cleans up all resources

## Running Benchmarks

### Prerequisites

Before running benchmarks, ensure:
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
AWS_PROFILE=<profile-name> ./benchmark.sh
```

The script will:
- Create an EKS cluster (takes 15-20 minutes)
- Deploy the Next.js demo with three variants (Node, PM2, Watt)
- Launch EC2 instance running k6 load tests
- Display performance results
- Clean up all resources automatically

### Environment Variables

Required:
- `AWS_PROFILE` - AWS CLI profile to use

Optional (with defaults):
- `CLUSTER_NAME` - EKS cluster name (default: `watt-benchmark-<timestamp>`)
- `NODE_TYPE` - EC2 instance type for EKS nodes (default: `m5.2xlarge`)
- `NODE_COUNT` - Number of worker nodes (default: `3`)
- `AMI_ID` - Amazon Linux 2023 AMI for autocannon EC2 (default: `ami-07b2b18045edffe90`)
- `LOADTESTING_INSTANCE_TYPE` - EC2 instance type for k6 (default: `c7gn.large`)

## Demo Application Structure

The demo (`demo/`) is a Next.js application with three deployment variants:

### Package Scripts
- `start:node` - Run with standalone Node.js
- `start:pm2r` - Run with PM2 (2 workers by default)
- `start:watt` - Run with Platformatic Watt (2 workers by default)

### Configuration

**Kubernetes deployment** (`kube.yaml`):
- Three Deployments: `next` (Node), `next-pm2`, `next-watt`
- Three Services with NodePort type and benchmark annotation
- Services use fixed NodePorts: 30000 (Node), 30001 (PM2), 30002 (Watt)
- Environment variables control which script runs (`SCRIPT_NAME`, `WORKERS`)

**Docker image** (`Dockerfile`):
- Based on Node 24 Alpine
- Builds Next.js app during image build
- `entrypoint.sh` executes `npm run $SCRIPT_NAME` to start the appropriate server

### Load Testing

The `demo/loadtest.sh` script runs k6 load tests sequentially against all three services:
- 1000 requests/second for 120 seconds per service
- 480 second cooldown between tests
- Tests run on separate EC2 instance within same VPC

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
