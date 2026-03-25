# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Kubernetes-based benchmarking framework for comparing autoscaler performance on Amazon EKS (Elastic Kubernetes Service). The benchmark runs a single Next.js application under Platformatic watt-extra and tests three different Kubernetes autoscalers sequentially: HPA (Horizontal Pod Autoscaler), KEDA (Kubernetes Event-Driven Autoscaler), and ICC (Platformatic Intelligent Command Center).

## Architecture

1. **Common Functions Library** (`lib/common.sh`) - Shared bash functions for logging, tool validation, HTTP health checks, and cleanup
2. **State Management** (`lib/state.sh`) - Persistent resource tracking for cleanup of orphaned AWS resources
3. **Application** (`next/`) - Next.js e-commerce app running under watt-extra
4. **Scaler Configs** (`scalers/`) - Kubernetes manifests for HPA and KEDA scalers
5. **Helm Values** (`helm-values/`) - Helm chart values for Platformatic ICC/Machinist
6. **EKS Orchestration** (`benchmark.sh`) - Main benchmarking script

### Key Design Decisions

- **Pure AWS CLI**: Creates all infrastructure using AWS CLI (no eksctl, CloudFormation, or Terraform)
- **Local Docker Build + ECR**: Images are built locally and pushed to an ephemeral ECR repository (no external CI/CD dependency)
- **Single App, Multiple Scalers**: One Next.js app under watt-extra, tested with HPA, KEDA, and ICC sequentially
- **watt-extra Runtime**: Enterprise Platformatic runtime that connects to ICC, reports ELU health signals, exposes metrics on port 9090 and app on port 3042
- **ICC Always Connected**: App always has `PLT_ICC_URL` set so it's registered with ICC; ICC scaling is controlled via `icc.platformatic.dev/scaler-max` label (1 = locked, 10 = enabled)
- **Scaler Metrics**: HPA uses CPU utilization (70%), KEDA uses ELU via Prometheus (0.7 threshold), ICC uses its internal load-predictive algorithm (v2)
- **AWS Network Load Balancers**: Service gets an internal NLB for proper load distribution
  - Annotated with `benchmark.platformatic.dev/expose: "true"` for discovery
  - NLB annotations: `aws-load-balancer-type: nlb`, `aws-load-balancer-scheme: internal`
- **Topology Spread Constraints**: Pods are distributed evenly across cluster nodes
  - Uses `topologySpreadConstraints` with `maxSkew: 1` on `kubernetes.io/hostname`
- **Separate Load Testing Instance**: k6 runs on a dedicated EC2 instance (not in the cluster) to simulate realistic network conditions and avoid resource contention. One EC2 instance per scaler test.
- **Local Metrics Collection**: kubectl port-forward to Prometheus collects pod count, ELU, and CPU every 5 seconds into CSV files during each scaler test
- **Automatic Cleanup**: All resources (cluster, node group, VPC, IAM roles, EC2 instance, ECR repository, NLBs, Helm releases, S3 bucket) are cleaned up via trap handlers on exit/failure

### Infrastructure Flow

1. Creates ECR repository and builds/pushes Docker image locally
2. Creates VPC with subnets, internet gateway, and route tables
3. Creates IAM roles for cluster, nodes, and load test instance
4. Creates S3 bucket for benchmark results
5. Creates EKS cluster and managed node group
6. Configures kubectl context (cluster name)
7. Installs Helm charts: kube-prometheus-stack, KEDA, PostgreSQL, Valkey, Platformatic ICC/Machinist
8. Deploys Next.js app from `kube.yaml` (templated with ECR image URI)
9. Waits for pods to be ready
10. Discovers annotated LoadBalancer service and waits for NLB hostname
11. Starts Prometheus port-forward for local metrics collection
12. For each scaler (HPA, KEDA, ICC):
    - Resets deployment to 1 replica
    - Applies scaler config
    - Starts background metrics collection (pod count + ELU + CPU to CSV)
    - Launches EC2 instance running k6 constant load (1000 req/s for 3 minutes)
    - Monitors console output, downloads results from S3
    - Terminates EC2 instance
    - Removes scaler config
    - Cooldown between scalers
13. Cleans up all resources (Helm releases, EC2, EKS, VPC, IAM, ECR, S3)

### Helm Charts

Installed in `install_helm_charts()`:
- **kube-prometheus-stack** (v65.3.2) - Prometheus for metrics collection (alertmanager/grafana disabled)
- **KEDA** (v2.16.1) - Event-driven autoscaler
- **PostgreSQL** (cloudpirates/postgres v0.4.0) - Required by ICC
- **Valkey** (cloudpirates/valkey v0.3.2) - Required by ICC
- **Platformatic** (oci://ghcr.io/platformatic/helm v4.0.2-alpha6) - ICC + Machinist, installed in `platformatic` namespace with values from `helm-values/platformatic.yaml`

### Scaler Management

- **HPA** (`scalers/hpa.yaml`): kubectl apply/delete
- **KEDA** (`scalers/keda.yaml`): kubectl apply/delete of ScaledObject with Prometheus trigger
- **ICC**: Label toggling on the deployment (`icc.platformatic.dev/scaler-max=10` to enable, `=1` to lock)

## Running Benchmarks

### Prerequisites

Before running benchmarks, ensure:
- Docker is installed and running
- AWS CLI v2 is installed and configured with a default region
- kubectl is installed
- helm is installed
- jq is installed
- AWS profile has required permissions (see `lib/minimum-policy.json`)

Apply required AWS IAM permissions:
```sh
AWS_PROFILE=<profile-name> ./setup-policy.sh
```

### Execute Benchmark

```sh
AWS_PROFILE=<profile-name> ./benchmark.sh
```

The script will:
- Build Docker image locally and push to ECR
- Create an EKS cluster (takes 15-20 minutes)
- Install Helm charts (Prometheus, KEDA, PostgreSQL, Valkey, ICC)
- Deploy the Next.js app under watt-extra
- Test each scaler sequentially (HPA, KEDA, ICC) with k6 constant load
- Collect scaling metrics (pod count, ELU, CPU) to CSV files
- Upload results to S3
- Clean up all resources automatically

### Environment Variables

Required:
- `AWS_PROFILE` - AWS CLI profile to use

Optional (with defaults):
- `CLUSTER_NAME` - EKS cluster name (default: `watt-benchmark-<timestamp>`)
- `NODE_TYPE` - EC2 instance type for EKS nodes (default: `m5.2xlarge`)
- `NODE_COUNT` - Number of worker nodes (default: `4`)
- `AMI_ID` - Amazon Linux 2023 AMI for load testing EC2 (default: `ami-07b2b18045edffe90`)
- `LOADTESTING_INSTANCE_TYPE` - EC2 instance type for k6 (default: `c7gn.2xlarge`, 16GB RAM for 10k VUs)
- `ECR_REPO_NAME` - ECR repository name (default: `watt-benchmark`)
- `IMAGE_TAG` - Docker image tag (default: `latest`)
- `COOLDOWN_BETWEEN_SCALERS` - Seconds between scaler tests (default: `120`)

## Application Structure (`next/`)

### Files
- `Dockerfile` - Builds app, installs watt-extra globally, runs via `CMD ["watt-extra", "start"]`
- `kube.yaml` - Kubernetes manifests: Deployment (1 replica), Service (LoadBalancer), PodMonitor (Prometheus scraping)
- `loadtest.sh` - k6 load test: constant 1000 req/s for 3 minutes, mixed e-commerce scenarios
- `watt.json` - Platformatic Watt configuration
- `package.json` - NPM scripts and dependencies

### Kubernetes Resources (`kube.yaml`)
- **Deployment**: 1 replica, ports 3042 (app) + 9090 (metrics), probes on `/ready` and `/status` via metrics port
  - Labels: `icc.platformatic.dev/scaler-max: "1"` (ICC scaling locked by default)
  - Pod label: `platformatic.dev/monitor: prometheus` (for PodMonitor matching)
  - `topologySpreadConstraints` for even distribution across nodes
- **Service**: LoadBalancer (NLB), ports 80->app, 9090->metrics, benchmark annotation
- **PodMonitor**: Prometheus scrapes metrics port every 5s for ELU metrics

### Docker Image
- Based on Node 24.11.0 Alpine
- Installs `@platformatic/watt-extra@latest` globally
- Key env vars: `PLT_ICC_URL`, `PLT_MANAGEMENT_API=true`, `PLT_SERVER_METRICS=true`, `PLT_SERVER_HEALTH=true`, `PLT_ELU_HEALTH_SIGNAL_THRESHOLD=0.7`, `WORKERS=2`
- Exposes ports 3042 (app) and 9090 (metrics/health)

### Local Development

```sh
cd next
npm install
npm run dev      # Development server with hot reload
npm run build    # Build app
```

## Common Functions (lib/common.sh)

Shared utilities used by benchmark script:

- **Logging**: `log()`, `error()`, `success()`, `warning()` - Colored output functions
- **Validation**: `check_tool()`, `validate_aws_tools()`, `validate_common_tools()`, `validate_required_vars()`
- **Health Checks**: `wait_for_http()` - Polls HTTP endpoint until ready
- **Cleanup**: `generic_cleanup()` - Calls provider-specific `cleanup_instances()`

## State Management (lib/state.sh)

Persistent resource tracking for cleanup of orphaned AWS resources:

- **State Files**: JSON files in `.benchmark-state/` directory, one per cluster
- **save_resource()** / **mark_resource_cleaned()**: Track resource creation/deletion
- **load_state()**: Load state from file into environment variables for cleanup
- **cleanup.sh**: Standalone script to clean up resources from a state file

## Code Style

- **Shell Scripts**: Bash with `set -e`, use common.sh logging functions
- **AWS Operations**: Use `--profile "$AWS_PROFILE"` for all AWS CLI commands
- **Kubernetes Operations**: Use `--context "$KUBE_CONTEXT"` for all kubectl/helm commands
- **Error Handling**: Trap handlers for cleanup, `|| true` for best-effort cleanup operations
- **Quiet Mode**: Redirect verbose output to `/dev/null` or filter with grep
