# Kubernetes Watt Benchmarking

Run Platformatic Watt performance benchmarks in Amazon EKS (Elastic Kubernetes Service).

## Overview

The `benchmark.sh` script automates the creation of an EKS benchmarking
workflow. An EKS cluster and EC2 instance are created, with the EC2 instance
running `autocannon` against the cluster.

## Prerequisites

> [!Note]
> The default maximum number of vCPU that AWS supports is 32. The default settings here
> use 26 vCPU.

- AWS CLI v2 installed and configured
    - We use your profile's region so make sure that a default is set:
        ```sh
        aws configure
        ```
    - Permissions for AWS profile are set. See [minimum-policy.json](). To apply
      these policies:
      ```sh
      AWS_PROFILE=<your-profile-name> ./setup-policy.sh
      ```
- **kubectl** - Kubernetes CLI tool ([installation guide](https://kubernetes.io/docs/tasks/tools/))
- **jq** - JSON processor for parsing kube context

How it works:

![Showing a user executing a benchmark.sh and it creating cloud-specific instances, running autocannon against demos, and then cleaning up](./watt-performance-demos.png "How this repository works")

## Usage

Run the benchmark:

```sh
AWS_PROFILE=<your-profile-name> ./benchmark.sh
```

## Configuration

Required environment variables:
| Variable | Description |
|---|---|
| `AWS_PROFILE` | The AWS profile to use when making requests to AWS via the CLI |

Optional environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CLUSTER_NAME` | `watt-benchmark-<timestamp>` | EKS cluster name |
| `NODE_TYPE` | `m5.2xlarge` | Instance type for EKS worker nodes |
| `NODE_COUNT` | `3` | Number of worker nodes |
| `AMI_ID` | `ami-07b2b18045edffe90` | Amazon Linux 2023 AMI for autocannon |
| `LOADTESTING_INSTANCE_TYPE` | `c7gn.large` | EC2 instance type for autocannon |
