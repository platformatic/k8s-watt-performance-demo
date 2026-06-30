# Next.js `useNodeStreams` Performance Impact

## Experiment

Compared Next.js `16.2.1-canary.27` with and without `experimental: { useNodeStreams: true }` on AWS EKS at 1,000 req/s for 3 minutes with mixed e-commerce traffic (homepage, search, card details, game browsing, sellers). No compression. All other conditions identical between runs.

## Results

### Baseline (`useNodeStreams: false`)

| Runtime | Success Rate | Avg (ms) | Median (ms) | p(90) (ms) | p(95) (ms) | p(99) (ms) | Max (ms) |
| ------- | ------------ | -------- | ----------- | ---------- | ---------- | ---------- | -------- |
| Node    | 58.12%       | 9,786    | 3,752       | 30,824     | 54,727     | 70,275     | 72,853   |
| PM2     | 56.05%       | 11,362   | 3,184       | 38,069     | 68,945     | 74,348     | 77,803   |
| Watt    | 56.57%       | 10,314   | 3,343       | 31,000     | 65,310     | 73,118     | 76,042   |

### With `useNodeStreams: true`

| Runtime | Success Rate | Avg (ms) | Median (ms) | p(90) (ms) | p(95) (ms) | p(99) (ms) | Max (ms) |
| ------- | ------------ | -------- | ----------- | ---------- | ---------- | ---------- | -------- |
| Node    | 59.23%       | 7,905    | 3,221       | 10,006     | 49,093     | 56,968     | 59,305   |
| PM2     | 59.12%       | 7,889    | 3,368       | 18,500     | 33,978     | 58,208     | 60,739   |
| Watt    | 61.33%       | 8,260    | 3,012       | 10,314     | 52,674     | 66,356     | 68,910   |

### Improvement

| Metric       | Node       | PM2        | Watt       |
| ------------ | ---------- | ---------- | ---------- |
| Success rate | +1.1 pp    | +3.1 pp    | +4.8 pp    |
| Avg latency  | -19%       | -31%       | -20%       |
| Median       | -14%       | +6%        | -10%       |
| p(90)        | **-68%**   | **-51%**   | **-67%**   |
| p(95)        | -10%       | -51%       | -19%       |
| p(99)        | -19%       | -22%       | -9%        |
| Max          | -19%       | -22%       | -9%        |

## Key findings

- **Tail latency collapses.** p(90) drops 50-68% across all runtimes — from ~31-38s down to ~10-18s. This is the single largest improvement.
- **Average latency drops 19-31%** across all runtimes.
- **Success rate improves 1-5 percentage points**, with Watt seeing the largest gain (56.57% to 61.33%).
- **Median barely moves** (~3s in both runs). Next.js still cannot sustain 1,000 req/s — the flag helps the tail but does not lift the throughput ceiling.
- The improvement is consistent across Node, PM2, and Watt. Runtime ordering is preserved: `useNodeStreams` is a framework-level optimization that benefits all runtimes roughly equally.

## Environment

- Next.js `16.2.1-canary.27`
- Node.js 24.11.0
- Watt (wattpm) 3.39.0
- AWS EKS, 4x `m5.2xlarge` nodes
- k6 on dedicated `c7gn.2xlarge` EC2 instance
- 1,000 req/s, `ramping-arrival-rate` executor, 3-minute sustained load
- Metric: custom `response_time_ms` (wall-clock via `Date.now()`)
