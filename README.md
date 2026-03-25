# Kubernetes Autoscaler Benchmark

Compare autoscaler performance on Amazon EKS: **HPA** vs **KEDA** vs **ICC** (Platformatic Intelligent Command Center).

## Overview

Runs a Next.js e-commerce app under Platformatic watt-extra and tests three Kubernetes autoscalers sequentially. Each scaler handles the same ramping load (10→800 req/s over 3.5 minutes) while the benchmark collects latency, error rate, scaling events, and ELU metrics.

```
┌─────────────────────────────────────────────────────────────────────┐
│                           LOCAL MACHINE                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                      │
│  │  next/   │───▶│  Docker  │───▶│   ECR    │                      │
│  │  ICC     │    │  Build   │    │  Push    │                      │
│  │  Machinist│    └──────────┘    └────┬─────┘                      │
│  └──────────┘                          │                            │
│                                        │ Prometheus port-forward    │
│                                  metrics collection (CSV)           │
└────────────────────────────────────────┼────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           AWS ACCOUNT                               │
│                                                                     │
│  ┌────────────────────────────────────────────┐  ┌──────────────┐  │
│  │              EKS Cluster                   │  │ EC2 Instance │  │
│  │                                            │  │              │  │
│  │  ┌─────────┐  ┌──────────────────────┐     │  │     k6       │  │
│  │  │  Envoy  │◀─┤  Next.js Pods (1-20) │     │  │  Load Test   │  │
│  │  │  (slow  │  └──────────────────────┘     │  │              │  │
│  │  │  start) │                               │  │              │  │
│  │  └────┬────┘  ┌──────┐ ┌──────┐ ┌──────┐  │  │              │  │
│  │       │       │ ICC  │ │ KEDA │ │ HPA  │  │  │              │  │
│  │  ┌────┴────┐  └──────┘ └──────┘ └──────┘  │  │              │  │
│  │  │   NLB   │◀──────────────────────────────┼──┤              │  │
│  │  └─────────┘                               │  └──────────────┘  │
│  │                                            │                    │
│  │  Prometheus · PostgreSQL · Valkey           │                    │
│  └────────────────────────────────────────────┘                    │
│                                                                     │
│  S3 Bucket ── benchmark results                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key design**: Traffic flows through an Envoy proxy with **slow start** (30s ramp) so new pods receive gradually increasing traffic instead of full load instantly. This prevents JIT cold-start spikes from distorting scaler comparison.

## Prerequisites

- **Docker** — installed and running
- **AWS CLI v2** — configured with a default region
- **kubectl** and **helm** — installed
- **jq** — JSON processor

Apply required AWS IAM permissions:

```sh
AWS_PROFILE=<profile-name> ./setup-policy.sh
```

> **Note**: Default settings use 26 vCPU. AWS default limit is 32.

## Quick Start

```sh
AWS_PROFILE=<profile-name> ./benchmark.sh
```

This will:
1. Build and push Docker images to ECR
2. Create EKS cluster with 4 worker nodes (~15-20 min)
3. Install Helm charts (Prometheus, KEDA, PostgreSQL, Valkey, ICC)
4. Deploy the Next.js app and Envoy slow-start proxy
5. Test each scaler sequentially (ICC, KEDA, HPA)
6. Collect metrics and upload results to S3
7. Clean up all AWS resources

## Configuration

### Required

| Variable | Description |
|---|---|
| `AWS_PROFILE` | AWS CLI profile |

### Optional

| Variable | Default | Description |
|---|---|---|
| `CLUSTER_NAME` | `watt-benchmark-<timestamp>` | EKS cluster name |
| `NODE_TYPE` | `m5.2xlarge` | Instance type for EKS nodes |
| `NODE_COUNT` | `4` | Number of worker nodes |
| `SCALERS` | `icc keda hpa` | Space-separated list of scalers to test |
| `COOLDOWN_BETWEEN_SCALERS` | `120` | Seconds between scaler tests |
| `AMI_ID` | `ami-0d77ef7f6a82c86be` | Amazon Linux 2023 ARM64 AMI for k6 |
| `LOADTESTING_INSTANCE_TYPE` | `c7gn.2xlarge` | EC2 instance type for k6 |
| `ECR_REPO_NAME` | `watt-benchmark` | ECR repository name |
| `IMAGE_TAG` | `latest` | Docker image tag |
| `ICC_REPO` | _(empty)_ | Path to local ICC repo. If unset, uses public Docker Hub image |
| `MACHINIST_REPO` | _(empty)_ | Path to local Machinist repo. If unset, uses public Docker Hub image |

### Building ICC from source

By default, the benchmark uses public images from Docker Hub (`platformatic/intelligent-command-center:latest` and `platformatic/machinist:latest`). To build from local repos:

```sh
ICC_REPO=~/projects/platformatic/icc-3 \
MACHINIST_REPO=~/projects/platformatic/machinist \
AWS_PROFILE=<profile-name> ./benchmark.sh
```

### Run a single scaler

```sh
SCALERS="icc" AWS_PROFILE=<profile-name> ./benchmark.sh
```

## Architecture

### Scalers

| Scaler | Metric | Mechanism |
|---|---|---|
| **HPA** | CPU utilization (70% target) | Native k8s `HorizontalPodAutoscaler` |
| **KEDA** | ELU via Prometheus (0.7 threshold) | `ScaledObject` with Prometheus trigger |
| **ICC** | ELU health signals (predictive v2 algorithm) | Label-based scaling via Platformatic ICC |

### Envoy Slow Start

New pods receive gradually increasing traffic over 30 seconds via Envoy's `slow_start_config`. This prevents V8 JIT cold-start from causing ELU spikes that would unfairly penalize scalers that add pods under high load.

- `envoy-slowstart.yaml` — Envoy deployment, headless service for pod discovery, NLB
- Envoy uses `STRICT_DNS` with `dns_refresh_rate: 5s` to detect new pods
- `round_robin_lb_config.slow_start_config.slow_start_window: 30s`

### Load Test

The k6 test (`next/loadtest.sh`) runs from a dedicated EC2 instance:

- **Warmup**: 30s at 10 req/s (JIT warmup)
- **Ramp**: 20s stages from 200→800 req/s
- **Sustained**: 40s at 800 req/s
- **Scenarios**: Homepage (20%), Search (25%), Card detail (20%), Game detail (15%), Games list (10%), Sellers (5%), Set detail (5%)
- `noConnectionReuse: true` — simulates real user connections

### Metrics Collection

During each scaler test, the benchmark collects:

- **Pod scaling events** — `{scaler}-pods.csv` (timestamp, replica count)
- **ELU + CPU metrics** — `{scaler}-metrics.csv` (avg ELU from Prometheus, HPA CPU %)
- **k6 results** — `benchmark-{scaler}.log` (latency, error rate, throughput)

## Results

After the benchmark completes, results are in `results/<cluster-name>/`:

```
results/watt-benchmark-1774445030/
├── icc-pods.csv              # Scaling events (timestamp, replica count)
├── icc-metrics.csv           # ELU + CPU over time
├── benchmark-icc.log         # Full k6 output
├── keda-pods.csv
├── keda-metrics.csv
├── benchmark-keda.log
├── hpa-pods.csv
├── hpa-metrics.csv
└── benchmark-hpa.log
```

Results are also uploaded to S3 (`s3://benchmark-results-<cluster-name>/`) during the test, but the S3 bucket is deleted during cleanup. The local files are the permanent copy.

## Cleanup

Resources are cleaned up automatically on exit. If the script is interrupted, use the standalone cleanup:

```sh
# List orphaned runs
./cleanup.sh --list

# Preview what would be deleted
./cleanup.sh --all --dry-run

# Clean up all orphaned resources
./cleanup.sh --all

# Clean up a specific run
./cleanup.sh --file .benchmark-state/<cluster-name>.json
```

## Project Structure

```
├── benchmark.sh              # Main orchestration script
├── cleanup.sh                # Standalone cleanup for orphaned resources
├── envoy-slowstart.yaml      # Envoy proxy with slow start
├── lib/
│   ├── common.sh             # Shared bash functions
│   ├── state.sh              # Resource state tracking
│   └── minimum-policy.json   # Required AWS IAM permissions
├── helm-values/
│   └── platformatic.yaml     # Helm values for ICC/Machinist
├── scalers/
│   ├── hpa.yaml              # HPA manifest
│   └── keda.yaml             # KEDA ScaledObject manifest
└── next/
    ├── Dockerfile            # App image (watt-extra + Next.js)
    ├── kube.yaml             # Deployment, Service, PodMonitor
    ├── loadtest.sh           # k6 load test script
    ├── watt.json             # Platformatic runtime config
    └── src/                  # Next.js e-commerce app
```
