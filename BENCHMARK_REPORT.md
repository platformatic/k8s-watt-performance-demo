# Platformatic SSRT Benchmark Report

## Executive Summary

This benchmark compares a Next.js application built with SSR Templates disabled (Control) and enabled (SSRT) on Amazon EKS.

The benchmark focused on the render-heavy `/sellers` route at a sustained target rate of 200 requests per second. Both runs were healthy: each runner completed approximately 30,000 requests with a 100% success rate and no pod restarts.

SSRT reduced CPU usage consistently across all execution modes and improved latency, especially at the tail:

- **12-17% lower pod CPU usage** at the same load.
- **10-29% lower average latency**.
- **26-45% lower p99 latency**.
- The strongest average-latency improvement was observed with the plain Node runner.

## Test Configuration

| Item                | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| Benchmark date      | September 8, 2026                                     |
| Application         | Next.js e-commerce demo                               |
| Route               | `/sellers` only                                       |
| Load profile        | 60-second ramp, then 120 seconds steady state         |
| Target rate         | 200 requests/second                                   |
| Load generator      | k6 on a dedicated EC2 instance                        |
| Platform            | Amazon EKS with Network Load Balancers                |
| Execution modes     | PM2, Platformatic Watt, standalone Node.js            |
| Requests per runner | Approximately 30,000                                  |
| Comparison          | Control (`SSRT_ENABLED=0`) vs SSRT (`SSRT_ENABLED=1`) |

The control and SSRT images passed their build and runtime guards. The SSRT image contained 57 template call sites, including three in the `/sellers` page chunks, and `/api/ssrt` reported the expected build flag on all services before load generation.

## Results

### Latency

Response times are in milliseconds. Deltas are SSRT relative to Control.

| Runner | Control avg | SSRT avg | Avg delta | Control p99 | SSRT p99 | p99 delta |
| ------ | ----------: | -------: | --------: | ----------: | -------: | --------: |
| PM2    |        22.7 |     20.4 |  **-10%** |          87 |       48 |  **-45%** |
| Watt   |        29.0 |     24.5 |  **-16%** |         146 |      108 |  **-26%** |
| Node   |        42.5 |     30.2 |  **-29%** |         298 |      201 |  **-33%** |

Median latency also improved in every runner:

| Runner | Control median | SSRT median | Delta |
| ------ | -------------: | ----------: | ----: |
| PM2    |          21 ms |       19 ms |  -10% |
| Watt   |          23 ms |       20 ms |  -13% |
| Node   |          25 ms |       21 ms |  -16% |

### Pod CPU

CPU values are the sum of the runner's pods during the 120-second steady-state window.

| Runner |    Control |       SSRT | CPU delta |
| ------ | ---------: | ---------: | --------: |
| PM2    | 2.90 cores | 2.48 cores |  **-14%** |
| Watt   | 2.99 cores | 2.64 cores |  **-12%** |
| Node   | 3.35 cores | 2.79 cores |  **-17%** |

## Interpretation

The result is consistent with the expected SSRT behavior: precompiled server-rendering work reduces the CPU required to produce the HTML response. The improvement is visible in both average and tail latency because the workload is close enough to the application's rendering cost for CPU savings to affect queueing.

The cluster measurement includes work SSRT does not optimize, including HTTP handling, the Next.js server, and the application's data-access delay.

The comparison also shows a separate runtime characteristic: under the same control load, Watt was slower than PM2 on this route. That is independent of the SSRT effect and should be investigated separately rather than attributed to SSRT.

## Conclusion

For this Next.js workload, SSRT provides a clear production-style benefit when the application serves the render-heavy `/sellers` page:

1. CPU consumption falls by approximately 12-17%.
2. Average latency falls by approximately 10-29%.
3. p99 latency falls by approximately 26-45%.
4. Reliability is unchanged in this run: all runners completed with 100% request success and zero pod restarts.

The result supports enabling SSRT for this workload. The benefit should not be generalized to every route: routes dominated by data processing rather than server rendering are expected to show a smaller improvement.

## Artifact Inventory

The source artifacts are stored in the local `logs/` directory and were retrieved from the benchmark host at `casa.perseveranza.net`:

- `benchmark-detached-20260908-081600.log`
- `benchmark_20260908_084143.log`
- `pod-usage_20260908_084143.log`
- `next-20260908-091750.log`
- `benchmark-detached-20260908-102943.log`
- `benchmark_20260908_105432.log`
- `pod-usage_20260908_105432.log`
- `next-20260908-113056.log`

The first four files are the Control run. The last four files are the SSRT run.
