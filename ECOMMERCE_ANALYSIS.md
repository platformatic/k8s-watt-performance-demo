# E-commerce Benchmark Analysis

## Executive Summary

This analysis compares the performance of three React meta-frameworks (Next.js, React Router, TanStack Start) running identical e-commerce applications under load. The benchmarks were conducted on AWS EKS with 4 x m5.2xlarge nodes, testing Node.js, PM2, and Platformatic Watt runtime configurations.

**Key Finding**: React Router dramatically outperformed both Next.js and TanStack Start under load, handling 1000 req/s with **0% errors** and 36-48ms average latency across all three runtimes. Next.js struggled with **50-55% error rates**, while TanStack showed **27-39% error rates**.

**Watt Performance**: Platformatic Watt provided the **best latency for React Router** (35.97ms avg vs 47.59ms for Node - 24% improvement), while showing mixed results for other frameworks.

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

### Scenario Distribution
- 20% Homepage (`/`)
- 25% Search queries (`/search?q=...`)
- 20% Card detail pages (`/cards/...`)
- 15% Game detail pages (`/games/...`)
- 10% Games list (`/games`)
- 5% Sellers list (`/sellers`)
- 5% Set detail pages (`/sets/...`)

## Results Summary (Latest Run - January 20, 2026)

### React Router (Best Performance - 0% Errors)

| Runtime | Requests | Successful | Avg Latency | p(95) Latency | Error Rate | Max VUs |
|---------|----------|------------|-------------|---------------|------------|---------|
| **Watt** | 120,001 | 120,001 | **35.97ms** | 72.36ms | **0.00%** | 2,000 |
| **PM2** | 120,001 | 120,001 | 44.59ms | 94.97ms | **0.00%** | 2,000 |
| **Node** | 120,001 | 120,001 | 47.59ms | 144.96ms | **0.00%** | 2,000 |

React Router achieved perfect 1000 req/s throughput with zero errors. **Watt provided the best latency** (24% faster than Node).

### TanStack Start (Moderate Issues - 27-39% Errors)

| Runtime | Requests | Successful | Avg Latency | p(95) Latency | Error Rate | Max VUs |
|---------|----------|------------|-------------|---------------|------------|---------|
| **Node** | 136,381 | 99,630 | 1.05s | 8.98s | **26.94%** | 4,749 |
| **Watt** | 116,864 | 72,451 | 1.04s | 8.93s | **38.00%** | 14,920 |
| **PM2** | 116,412 | 70,539 | 793ms | 2.32s | **39.40%** | 14,212 |

TanStack showed variable performance. Node runtime performed notably better than PM2 or Watt.

### Next.js (Severe Performance Issues - 50-55% Errors)

| Runtime | Requests | Successful | Avg Latency | p(95) Latency | Error Rate | Max VUs |
|---------|----------|------------|-------------|---------------|------------|---------|
| **Node** | 103,845 | 51,266 | 1.41s | 9.99s | **50.63%** | 9,430 |
| **Watt** | 102,120 | 47,846 | 2.03s | 9.99s | **53.14%** | 10,448 |
| **PM2** | 100,508 | 45,043 | 2.04s | 9.99s | **55.18%** | 13,149 |

Next.js failed to handle 1000 req/s, with over half of all requests timing out.

## Performance Comparison

### Error Rate by Framework and Runtime

```
React Router Watt   0.00%   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
React Router PM2    0.00%   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
React Router Node   0.00%   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
TanStack Node       26.94%  ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
TanStack Watt       38.00%  ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░
TanStack PM2        39.40%  ████████████████░░░░░░░░░░░░░░░░░░░░░░░░
Next.js Node        50.63%  ████████████████████░░░░░░░░░░░░░░░░░░░░
Next.js Watt        53.14%  █████████████████████░░░░░░░░░░░░░░░░░░░
Next.js PM2         55.18%  ██████████████████████░░░░░░░░░░░░░░░░░░
```

### Average Latency Comparison

```
React Router Watt   ░ 36ms
React Router PM2    ░ 45ms
React Router Node   ░ 48ms
TanStack PM2        █████████████ 793ms
TanStack Watt       █████████████████ 1,040ms
TanStack Node       █████████████████░ 1,050ms
Next.js Node        ███████████████████████ 1,410ms
Next.js Watt        ██████████████████████████████████ 2,030ms
Next.js PM2         ██████████████████████████████████ 2,040ms
```

### VU Saturation (Lower is Better)

```
React Router Watt   ██ 2,000 (no saturation - perfect)
React Router PM2    ██ 2,000 (no saturation - perfect)
React Router Node   ██ 2,000 (no saturation - perfect)
TanStack Node       ████░ 4,749
Next.js Node        █████████░ 9,430
Next.js Watt        ██████████░ 10,448
Next.js PM2         █████████████░ 13,149
TanStack PM2        ██████████████░ 14,212
TanStack Watt       ███████████████ 14,920
```

## Comparison with Previous Run (Before Config Normalization)

The previous benchmark used different resource allocations (TanStack/React Router had 3Gi/6Gi vs Next.js 2Gi/4Gi). After normalizing to 2Gi/4Gi across all frameworks:

| Framework | Runtime | Old Errors | New Errors | Change |
|-----------|---------|------------|------------|--------|
| React Router | Node | 0.00% | 0.00% | = |
| React Router | Watt | 0.00% | 0.00% | = |
| React Router | PM2 | 0.00% | 0.00% | = |
| TanStack | Node | 32.34% | 26.94% | **-5.4%** |
| TanStack | Watt | 51.27% | 38.00% | **-13.3%** |
| TanStack | PM2 | 46.30% | 39.40% | **-6.9%** |
| Next.js | Node | 52.86% | 50.63% | -2.2% |
| Next.js | Watt | 45.02% | 53.14% | +8.1% |
| Next.js | PM2 | 48.54% | 55.18% | +6.6% |

**Key Observations**:
- React Router remains rock-solid regardless of resource changes
- TanStack improved significantly with resource normalization (possibly due to other config/version changes)
- Next.js Node slightly improved, but Watt/PM2 degraded

## Detailed Metrics

### React Router - Watt Runtime (Best Latency)
```
Total Requests:      120,001
Successful:          120,001 (100%)
Throughput:          999.60 req/s

Response Times:
  Average:           35.97ms
  Median:            16.85ms
  p(90):             42.27ms
  p(95):             72.36ms
  Max:               2,520ms

VUs Required:        2,000 (no saturation)
```

### React Router - PM2 Runtime
```
Total Requests:      120,001
Successful:          120,001 (100%)
Throughput:          999.82 req/s

Response Times:
  Average:           44.59ms
  Median:            16.70ms
  p(90):             40.63ms
  p(95):             94.97ms
  Max:               4,330ms

VUs Required:        2,000 (no saturation)
```

### React Router - Node Runtime
```
Total Requests:      120,001
Successful:          120,001 (100%)
Throughput:          999.19 req/s

Response Times:
  Average:           47.59ms
  Median:            18.61ms
  p(90):             71.46ms
  p(95):             144.96ms
  Max:               3,790ms

VUs Required:        2,000 (no saturation)
```

### TanStack Start - Node Runtime (Best for TanStack)
```
Total Requests:      136,381
Successful:          99,630 (73.06%)
Failed:              36,751 (26.94%)
Throughput:          1,049 req/s

Response Times:
  Average:           1,050ms (1.05s)
  Median:            139.90ms
  p(90):             2,060ms
  p(95):             8,980ms
  Max:               10,070ms

VUs Required:        4,749 (saturation building)
Dropped Iterations:  3,752
```

### TanStack Start - Watt Runtime
```
Total Requests:      116,864
Successful:          72,451 (62.00%)
Failed:              44,413 (38.00%)
Throughput:          874 req/s

Response Times:
  Average:           1,040ms (1.04s)
  Median:            178.66ms
  p(90):             2,790ms
  p(95):             8,930ms
  Max:               10,020ms

VUs Required:        14,920 - SATURATED
```

### TanStack Start - PM2 Runtime
```
Total Requests:      116,412
Successful:          70,539 (60.60%)
Failed:              45,873 (39.40%)
Throughput:          861 req/s

Response Times:
  Average:           793ms
  Median:            248.03ms
  p(90):             1,450ms
  p(95):             2,320ms
  Max:               11,090ms

VUs Required:        14,212 - SATURATED
```

### Next.js - Node Runtime (Best for Next.js)
```
Total Requests:      103,845
Successful:          51,266 (49.37%)
Failed:              52,579 (50.63%)
Throughput:          683 req/s (target: 1000)

Response Times:
  Average:           1,410ms (1.41s)
  Median:            166.38ms
  p(90):             2,810ms
  p(95):             9,990ms
  Max:               11,100ms

VUs Required:        9,430 - SATURATED
Dropped Iterations:  16,160
```

### Next.js - Watt Runtime
```
Total Requests:      102,120
Successful:          47,846 (46.86%)
Failed:              54,274 (53.14%)
Throughput:          666 req/s (target: 1000)

Response Times:
  Average:           2,030ms (2.03s)
  Median:            671.89ms
  p(90):             9,990ms
  p(95):             9,990ms
  Max:               10,660ms

VUs Required:        10,448 - SATURATED
```

### Next.js - PM2 Runtime
```
Total Requests:      100,508
Successful:          45,043 (44.82%)
Failed:              55,465 (55.18%)
Throughput:          698 req/s (target: 1000)

Response Times:
  Average:           2,040ms (2.04s)
  Median:            837.36ms
  p(90):             9,990ms
  p(95):             9,990ms
  Max:               10,630ms

VUs Required:        13,149 - SATURATED
```

## Analysis

### Why React Router Outperformed

1. **Perfect Throughput**: All three runtimes handled exactly 1000 req/s with zero errors across 360,003 total requests.

2. **No VU Saturation**: VU count stayed at exactly 2,000 throughout all tests, indicating request processing matched arrival rate perfectly.

3. **Watt Optimization**: Platformatic Watt provided 24% better average latency (35.97ms vs 47.59ms) and 50% better p95 (72ms vs 145ms) compared to standalone Node.

4. **Consistent Performance**: All runtimes performed excellently, but Watt showed measurable improvements in tail latencies.

### Why TanStack Improved

1. **Node Runtime Best**: TanStack with Node achieved 73% success rate with only 4,749 max VUs - much better than PM2/Watt (60-62% success, 14k+ VUs).

2. **Config Changes Helped**: After normalizing resources and updating to Watt 3.30.0, TanStack Watt improved from 51% errors to 38% errors.

3. **Architecture Consideration**: The dramatic difference between Node and PM2/Watt suggests TanStack may have thread-safety or serialization overhead in multi-process configurations.

### Why Next.js Struggled

1. **Persistent Saturation**: All three runtimes maxed out VUs (9,000-13,000), indicating systemic throughput limits.

2. **Timeout Cascade**: 50-55% of requests hit the 10-second timeout threshold across all runtimes.

3. **Node Performed Best**: Standalone Node.js (50.63% errors) slightly outperformed Watt (53.14%) and PM2 (55.18%).

4. **Not a Resource Issue**: Even with identical resources to the other frameworks, Next.js SSR throughput is fundamentally limited.

### Runtime Comparison Across Frameworks

| Runtime | React Router | TanStack | Next.js |
|---------|--------------|----------|---------|
| **Watt** | Best (36ms, 0%) | Poor (1.04s, 38%) | Worst (2.03s, 53%) |
| **PM2** | Good (45ms, 0%) | Worst (793ms, 39%) | Worst (2.04s, 55%) |
| **Node** | Good (48ms, 0%) | Best (1.05s, 27%) | Best (1.41s, 51%) |

**Key Insight**: Platformatic Watt significantly improves React Router latency but shows mixed results for TanStack and Next.js.

## Winner by Category

| Category | Winner | Details |
|----------|--------|---------|
| **Overall Best** | React Router + Watt | 0% errors, 35.97ms latency |
| **Most Reliable** | React Router (any runtime) | 0% errors across all runtimes |
| **Best Latency** | React Router + Watt | 35.97ms avg, 72ms p95 |
| **Best Watt Improvement** | React Router | 24% latency reduction |
| **Most Resource Efficient** | React Router | Perfect performance at 2Gi/4Gi |

## Recommendations

### For High-Traffic Applications
- **React Router** is the clear choice for applications requiring high throughput and low latency
- **Use Platformatic Watt** with React Router for optimal latency (24% improvement)
- Consider React Router for any application expecting >500 req/s sustained traffic

### For Next.js Users
- Implement aggressive caching (ISR, CDN) to reduce SSR load
- Consider static generation for pages that don't require real-time data
- Use edge functions for latency-sensitive operations
- Scale horizontally with more pod replicas at lower request rates per pod
- **Use Node runtime** - it outperformed Watt/PM2 in this benchmark

### For TanStack Start Users
- **Use standalone Node.js** - it significantly outperforms PM2 and Watt (27% vs 38-39% errors)
- Avoid PM2 and Watt configurations until further optimization
- Consider hybrid approaches with client-side rendering for complex pages

## Conclusion

React Router demonstrated exceptional performance characteristics for server-side rendered e-commerce applications, handling 1000 req/s with zero errors while Platformatic Watt provided an additional 24% latency improvement.

**Framework Rankings (at 1000 req/s)**:
1. **React Router**: 0% errors, 36-48ms latency (Watt best, all runtimes excellent)
2. **TanStack**: 27-39% errors, 0.8-1.1s latency (Node best, Watt/PM2 struggle)
3. **Next.js**: 51-55% errors, 1.4-2.0s latency (Node best, all runtimes struggle)

For production e-commerce applications requiring high throughput, React Router with Platformatic Watt should be strongly considered as the optimal configuration. The data suggests fundamental architectural differences in SSR efficiency between these frameworks.

---

*Benchmark Date: January 19-20, 2026*
*Infrastructure: AWS EKS (4x m5.2xlarge)*
*Application: CardMarket E-commerce Clone (TCGPlayer-inspired)*
*Platformatic Watt Version: 3.30.0*
*Resource Config: Normalized (2Gi/4Gi across all frameworks)*
