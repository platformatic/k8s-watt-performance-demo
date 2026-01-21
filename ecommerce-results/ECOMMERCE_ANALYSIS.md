# E-commerce Benchmark Analysis

## Executive Summary

This analysis compares the performance of three React meta-frameworks (Next.js, React Router, TanStack Start) running identical e-commerce applications under load. The benchmarks were conducted on AWS EKS with 4 x m5.2xlarge nodes, testing Node.js, PM2, and Platformatic Watt runtime configurations.

**Key Finding**: React Router with Node.js runtime is the **only configuration that handled 1000 req/s flawlessly** - achieving 0% errors with 97.59ms average latency. All other configurations showed degradation under high load.

**Configuration Changes**: This benchmark was run after normalizing watt.json (maxHeapTotal: 2GB, managementApi: false) and converting the database layer from synchronous to asynchronous file operations.

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Test Duration | 120 seconds per service |
| Target Rate | 1000 requests/second |
| Target Requests | 120,000 per test |
| Test Scenarios | Mixed e-commerce (homepage, search, cards, games, sellers) |
| Infrastructure | AWS EKS, 4x m5.2xlarge nodes |
| Load Generator | k6 on c7gn.2xlarge EC2 instance |
| Cooldown | 480 seconds between tests |
| Watt Version | 3.30.0 |

### Kubernetes Resource Configuration (Normalized)

All frameworks now use identical resource allocations:

| Runtime | Memory | CPU |
|---------|--------|-----|
| Node | 2Gi | 1000m |
| PM2 | 4Gi | 2000m |
| Watt | 4Gi | 2000m |

### Watt Configuration (Normalized)

All frameworks now use identical Watt settings:
- `maxHeapTotal`: 2GB
- `managementApi`: false

### Scenario Distribution
- 20% Homepage (`/`)
- 25% Search queries (`/search?q=...`)
- 20% Card detail pages (`/cards/...`)
- 15% Game detail pages (`/games/...`)
- 10% Games list (`/games`)
- 5% Sellers list (`/sellers`)
- 5% Set detail pages (`/sets/...`)

## Results Summary (Latest Run - January 20, 2026)

### High-Load Test Performance Ranking

| Rank | Framework | Runtime | Error Rate | Avg Latency | Max VUs | Total Requests |
|------|-----------|---------|------------|-------------|---------|----------------|
| 1 | **React Router** | Node | **0.00%** | 97.59ms | 2,000 | 120,002 |
| 2 | **React Router** | Watt | **7.21%** | 818.69ms | 2,794 | 119,093 |
| 3 | **React Router** | PM2 | 27.90% | 716.54ms | 8,288 | 110,706 |
| 4 | **TanStack** | Watt | 30.27% | 1.2s | 5,132 | 134,493 |
| 5 | **TanStack** | Node | 39.47% | 467.08ms | 16,463 | 115,217 |
| 6 | **Next.js** | Watt | 49.27% | 1.46s | 19,318 | 94,444 |
| 7 | **Next.js** | Node | 50.18% | 2.27s | 19,157 | 95,103 |
| 8 | **Next.js** | PM2 | 53.36% | 1.52s | 18,546 | 94,953 |
| 9 | **TanStack** | PM2 | 60.72% | 2.07s | 20,000 | 77,160 |

### React Router (Best Framework Performance)

| Runtime | Requests | Successful | Avg Latency | p(95) Latency | Error Rate | Max VUs |
|---------|----------|------------|-------------|---------------|------------|---------|
| **Node** | 120,002 | 120,002 | **97.59ms** | 138ms | **0.00%** | 2,000 |
| **Watt** | 119,093 | 110,501 | 818.69ms | 2.5s | **7.21%** | 2,794 |
| **PM2** | 110,706 | 79,809 | 716.54ms | 6.85s | 27.90% | 8,288 |

React Router Node achieved **perfect throughput** - the only configuration to handle 1000 req/s with zero errors.

### TanStack Start (Mixed Results)

| Runtime | Requests | Successful | Avg Latency | p(95) Latency | Error Rate | Max VUs |
|---------|----------|------------|-------------|---------------|------------|---------|
| **Watt** | 134,493 | 93,774 | 1.2s | 9.99s | **30.27%** | 5,132 |
| **Node** | 115,217 | 69,737 | 467.08ms | 944.49ms | 39.47% | 16,463 |
| **PM2** | 77,160 | 30,306 | 2.07s | 9.99s | 60.72% | 20,000 |

TanStack Watt showed the best error rate for this framework, while Node had the lowest latency.

### Next.js (Severe Performance Issues)

| Runtime | Requests | Successful | Avg Latency | p(95) Latency | Error Rate | Max VUs |
|---------|----------|------------|-------------|---------------|------------|---------|
| **Watt** | 94,444 | 47,906 | 1.46s | 8.97s | **49.27%** | 19,318 |
| **Node** | 95,103 | 47,379 | 2.27s | 9.99s | 50.18% | 19,157 |
| **PM2** | 94,953 | 44,278 | 1.52s | 9.99s | 53.36% | 18,546 |

Next.js failed to handle 1000 req/s, with approximately half of all requests timing out regardless of runtime.

## Performance Visualizations

### Error Rate by Framework and Runtime

```
React Router Node   0.00%   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (PERFECT)
React Router Watt   7.21%   ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
React Router PM2    27.90%  ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
TanStack Watt       30.27%  ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
TanStack Node       39.47%  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░
Next.js Watt        49.27%  ████████████████████░░░░░░░░░░░░░░░░░░░░
Next.js Node        50.18%  ████████████████████░░░░░░░░░░░░░░░░░░░░
Next.js PM2         53.36%  █████████████████████░░░░░░░░░░░░░░░░░░░
TanStack PM2        60.72%  ████████████████████████░░░░░░░░░░░░░░░░
```

### Average Latency Comparison

```
React Router Node   █ 98ms (BEST)
TanStack Node       ████░ 467ms
React Router PM2    ███████░ 717ms
React Router Watt   ████████░ 819ms
TanStack Watt       ████████████░ 1,200ms
Next.js Watt        ███████████████░ 1,460ms
Next.js PM2         ███████████████░ 1,520ms
TanStack PM2        █████████████████████░ 2,070ms
Next.js Node        ███████████████████████░ 2,270ms
```

### VU Saturation (Lower is Better - 2000 = No Saturation)

```
React Router Node   ██ 2,000 (NO SATURATION - PERFECT)
React Router Watt   ███ 2,794
TanStack Watt       █████ 5,132
React Router PM2    ████████ 8,288
TanStack Node       ████████████████ 16,463
Next.js PM2         ██████████████████ 18,546
Next.js Node        ███████████████████ 19,157
Next.js Watt        ███████████████████ 19,318
TanStack PM2        ████████████████████ 20,000 (MAX - SATURATED)
```

## Warmup Test Results (100 VUs - Low Load)

All frameworks performed well at low load:

| Framework | Runtime | Error Rate | Avg Latency |
|-----------|---------|------------|-------------|
| React Router | Node | 0.00% | 11.9ms |
| React Router | PM2 | 0.00% | 11.81ms |
| React Router | Watt | 0.00% | 11.65ms |
| TanStack | Node | 0.15% | 17.66ms |
| TanStack | PM2 | 0.00% | 15.69ms |
| TanStack | Watt | 0.00% | 15.03ms |
| Next.js | Node | 0.01% | 18.84ms |
| Next.js | PM2 | 0.00% | 21.83ms |
| Next.js | Watt | 0.00% | 22.41ms |

React Router shows lowest warmup latency across all runtimes.

## Comparison with Previous Run

### Changes Made Between Runs
1. Normalized `maxHeapTotal` to 2GB across all watt.json files
2. Disabled `managementApi` in React Router and TanStack watt.json
3. Converted database layer from sync `readFileSync` to async `readFile`

### Error Rate Changes

| Framework | Runtime | Previous | Latest | Change |
|-----------|---------|----------|--------|--------|
| React Router | Node | 0.00% | 0.00% | = |
| React Router | Watt | 0.00% | 7.21% | **+7.21%** |
| React Router | PM2 | 0.00% | 27.90% | **+27.90%** |
| TanStack | Node | 26.94% | 39.47% | +12.53% |
| TanStack | Watt | 38.00% | 30.27% | **-7.73%** |
| TanStack | PM2 | 39.40% | 60.72% | +21.32% |
| Next.js | Node | 50.63% | 50.18% | -0.45% |
| Next.js | Watt | 53.14% | 49.27% | -3.87% |
| Next.js | PM2 | 55.18% | 53.36% | -1.82% |

**Key Observations**:
- React Router Node remains the only perfect performer
- React Router Watt/PM2 showed degradation (possibly due to config changes)
- TanStack Watt improved while PM2 degraded significantly
- Next.js showed slight improvement across all runtimes

## Detailed Metrics

### React Router - Node Runtime (BEST OVERALL)
```
Total Requests:      120,002
Successful:          120,002 (100%)
Throughput:          1000 req/s (target achieved)

Response Times:
  Average:           97.59ms
  Median:            17.21ms
  p(90):             56.32ms
  p(95):             138ms
  Max:               7,820ms

VUs Required:        2,000 (NO SATURATION)
```

### React Router - Watt Runtime
```
Total Requests:      119,093
Successful:          110,501 (92.79%)
Failed:              8,592 (7.21%)
Throughput:          992 req/s

Response Times:
  Average:           818.69ms
  Median:            343.37ms
  p(90):             1,370ms
  p(95):             2,500ms
  Max:               10,010ms

VUs Required:        2,794
```

### React Router - PM2 Runtime
```
Total Requests:      110,706
Successful:          79,809 (72.10%)
Failed:              30,897 (27.90%)
Throughput:          922 req/s

Response Times:
  Average:           716.54ms
  Median:            18.72ms
  p(90):             2,770ms
  p(95):             6,850ms
  Max:               10,000ms

VUs Required:        8,288
```

### TanStack Start - Watt Runtime (Best for TanStack)
```
Total Requests:      134,493
Successful:          93,774 (69.73%)
Failed:              40,719 (30.27%)
Throughput:          1,121 req/s

Response Times:
  Average:           1,200ms (1.2s)
  Median:            119.33ms
  p(90):             6,040ms
  p(95):             9,990ms
  Max:               10,720ms

VUs Required:        5,132
```

### TanStack Start - Node Runtime
```
Total Requests:      115,217
Successful:          69,737 (60.53%)
Failed:              45,480 (39.47%)
Throughput:          960 req/s

Response Times:
  Average:           467.08ms
  Median:            43.63ms
  p(90):             597.09ms
  p(95):             944.49ms
  Max:               10,000ms

VUs Required:        16,463 - SATURATED
```

### TanStack Start - PM2 Runtime
```
Total Requests:      77,160
Successful:          30,306 (39.28%)
Failed:              46,854 (60.72%)
Throughput:          643 req/s (target: 1000)

Response Times:
  Average:           2,070ms (2.07s)
  Median:            165.81ms
  p(90):             9,990ms
  p(95):             9,990ms
  Max:               10,010ms

VUs Required:        20,000 - FULLY SATURATED
```

### Next.js - Watt Runtime (Best for Next.js)
```
Total Requests:      94,444
Successful:          47,906 (50.73%)
Failed:              46,538 (49.27%)
Throughput:          787 req/s (target: 1000)

Response Times:
  Average:           1,460ms (1.46s)
  Median:            1,010ms
  p(90):             2,710ms
  p(95):             8,970ms
  Max:               10,050ms

VUs Required:        19,318 - SATURATED
```

### Next.js - Node Runtime
```
Total Requests:      95,103
Successful:          47,379 (49.82%)
Failed:              47,724 (50.18%)
Throughput:          792 req/s (target: 1000)

Response Times:
  Average:           2,270ms (2.27s)
  Median:            696.6ms
  p(90):             9,990ms
  p(95):             9,990ms
  Max:               10,020ms

VUs Required:        19,157 - SATURATED
```

### Next.js - PM2 Runtime
```
Total Requests:      94,953
Successful:          44,278 (46.64%)
Failed:              50,675 (53.36%)
Throughput:          791 req/s (target: 1000)

Response Times:
  Average:           1,520ms (1.52s)
  Median:            362.21ms
  p(90):             8,990ms
  p(95):             9,990ms
  Max:               10,640ms

VUs Required:        18,546 - SATURATED
```

## Analysis

### Why React Router Node Excels

1. **Perfect Throughput**: Handled exactly 1000 req/s with zero errors across 120,002 requests.

2. **No VU Saturation**: VU count stayed at exactly 2,000 throughout the test, indicating request processing matched arrival rate perfectly.

3. **Single-Process Efficiency**: The standalone Node.js process avoids the overhead of multi-process communication that PM2 and Watt introduce.

4. **Low Tail Latency**: p95 at 138ms vs 2.5s+ for multi-process configurations.

### Why Watt Showed Mixed Results

1. **React Router Watt**: 7.21% errors - the async db changes may have introduced slight overhead with Watt's worker model.

2. **TanStack Watt**: 30.27% errors - actually the BEST performer for TanStack, suggesting Watt handles TanStack's SSR model well.

3. **Next.js Watt**: 49.27% errors - best for Next.js but still shows fundamental SSR limitations.

### Why PM2 Struggled

1. **High VU Saturation**: PM2 configurations showed the highest VU counts (8k-20k), indicating severe request backlog.

2. **Process Communication Overhead**: PM2's cluster mode adds inter-process communication overhead that doesn't benefit SSR workloads.

3. **Worst for TanStack**: 60.72% error rate - the highest in the entire benchmark.

### Framework Architecture Impact

| Framework | Optimal Runtime | Why |
|-----------|-----------------|-----|
| React Router | Node | Lightweight SSR, efficient single-process |
| TanStack | Watt | Multi-worker benefits TanStack's streaming SSR |
| Next.js | Watt | Slight improvement, but all runtimes struggle |

### VU Saturation Analysis

VUs above 2000 indicate request backlog building up:

- **2,000 VUs**: Perfect - requests processed at arrival rate
- **2,000-5,000 VUs**: Minor backlog
- **5,000-10,000 VUs**: Significant degradation
- **10,000+ VUs**: Severe saturation, high error rates expected
- **20,000 VUs**: Maximum reached, test can't inject more load

## Winner by Category

| Category | Winner | Details |
|----------|--------|---------|
| **Overall Best** | React Router + Node | 0% errors, 97.59ms latency |
| **Most Reliable** | React Router + Node | Only config with 0% errors |
| **Best Latency** | React Router + Node | 97.59ms avg, 138ms p95 |
| **Best for TanStack** | TanStack + Watt | 30.27% errors (lowest for TanStack) |
| **Best for Next.js** | Next.js + Watt | 49.27% errors (lowest for Next.js) |
| **Most Efficient** | React Router + Node | 2000 VUs = no saturation |

## Recommendations

### For High-Traffic Applications
- **Use React Router with Node.js runtime** - the only configuration proven to handle 1000 req/s flawlessly
- Consider Watt for React Router only if you need multi-worker benefits and can tolerate ~7% error rate
- Avoid PM2 for high-throughput SSR workloads

### For TanStack Start Users
- **Use Platformatic Watt** - it provides the best error rate (30.27%) for TanStack
- Standalone Node has lower latency but higher error rate
- Avoid PM2 - it showed 60.72% errors

### For Next.js Users
- **Use Platformatic Watt** - slight improvement (49.27% vs 50.18% for Node)
- Implement aggressive caching (ISR, CDN) to reduce SSR load
- Consider static generation for non-dynamic pages
- Scale horizontally with more pod replicas at lower request rates per pod

### General Recommendations
- Monitor VU saturation as a leading indicator of performance issues
- Keep max VUs close to baseline (2000 in this test) for optimal throughput
- Test your specific workload - results vary by framework and application complexity

## Conclusion

React Router with Node.js demonstrated exceptional performance, being the **only configuration to handle 1000 req/s with zero errors**. This represents a significant finding:

**Framework Rankings (at 1000 req/s)**:
1. **React Router + Node**: 0% errors, 97.59ms latency (PERFECT)
2. **React Router + Watt**: 7.21% errors, 819ms latency (GOOD)
3. **React Router + PM2**: 27.90% errors, 717ms latency (MODERATE)
4. **TanStack + Watt**: 30.27% errors, 1.2s latency (MODERATE)
5. **TanStack + Node**: 39.47% errors, 467ms latency (POOR)
6. **Next.js + Watt**: 49.27% errors, 1.46s latency (POOR)
7. **Next.js + Node**: 50.18% errors, 2.27s latency (POOR)
8. **Next.js + PM2**: 53.36% errors, 1.52s latency (POOR)
9. **TanStack + PM2**: 60.72% errors, 2.07s latency (VERY POOR)

For production e-commerce applications requiring high throughput, **React Router with standalone Node.js** is the clear winner. The data shows that for this specific workload, single-process Node.js outperforms multi-process configurations (PM2, Watt) due to reduced overhead.

---

*Benchmark Date: January 20, 2026*
*Infrastructure: AWS EKS (4x m5.2xlarge)*
*Application: CardMarket E-commerce Clone (TCGPlayer-inspired)*
*Platformatic Watt Version: 3.30.0*
*Resource Config: Normalized (2Gi/4Gi across all frameworks)*
*Database: Async file operations*
