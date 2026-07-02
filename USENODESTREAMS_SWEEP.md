# Next.js `useNodeStreams` sweep

## What this measures

The impact of Next.js **node streams vs web streams** for app-router SSR, under
the local EKS benchmark, for both the **Node** and **Watt** runtimes — collected
in a single sweep.

---

## Active sweep: version comparison — `16.2.9` vs `16.3.0-canary.72` (Node)

`benchmark.sh` is currently wired for a **two-version comparison** on the Node
runtime, not the streams A/B (the streams results below are prior findings):

| Cell | Version | Streams | Service |
| ---- | ------- | ------- | ------- |
| stable | `16.2.9` (latest stable) | web (no node-streams path) | `next-stable` |
| latest | `16.3.0-canary.72` (latest canary) | node (baked on, no toggle) | `next-latest` |

It builds one image per version (`--build-arg NEXT_VERSION`), deploys both as
Node, and load-tests each `REPEATS` times interleaved. Run:

```sh
AWS_PROFILE=<profile> ./benchmark.sh
# override: NEXT_VERSION_STABLE=16.2.9 NEXT_VERSION_LATEST=16.3.0-canary.72 REPEATS=3
```

**What it can and cannot conclude.** The stable→latest delta is the real-world
upgrade, but it **bundles the version change with the streams switch** (stable is
web-only; latest is node-only — neither can toggle). To read it as *mostly
version*, lean on the clean streams result below (`canary.45` A/B → streams ≈ no
effect on 16.3). Isolating streams in *this* run is not possible without a
toggle-capable version (`≤ canary.45`).

### Results — version comparison

Run on 2026-07-01 (`results/next-20260701-144702.log`), `REPEATS=3`, Node.
Mean of the 3 interleaved rounds per version.

| Version (streams)             | Success Rate | Avg (ms) | Median (ms) | p(90) (ms) | p(95) (ms) | p(99) (ms) | Max (ms) | Goodput |
| ----------------------------- | ------------ | -------- | ----------- | ---------- | ---------- | ---------- | -------- | ------- |
| `16.2.9` stable (web)         | 56.3%        | 7,567    | 3,652       | 10,061     | 37,361     | 49,949     | 52,157   | 399/s   |
| `16.3.0-canary.72` (node)     | 58.1%        | 7,445    | 3,400       | 10,058     | 38,435     | 50,478     | 52,794   | 420/s   |

**Δ latest vs stable:** goodput **+5.3%** (399→420/s), success **+1.8 pp**, median
**−6.9%** — all exceed 1 round-to-round σ. Avg and the whole tail (p90/p95/p99/max)
are **within noise** (flat). So a real but **small** improvement; the tail does not
move.

**This debunks the apparent "huge" 16.2→16.3 gain** from the earlier April-vs-June
cross-run comparison (p90 31s→10s, tail ~halved). That was almost entirely a
harness/deps **confound**, not Next: today's `16.2.9` baseline already shows
p90 ≈ 10,061 ms / p99 ≈ 49,949 / max ≈ 52,157, versus April's `16.2.1-canary.27`
at p90 ≈ 31,000 / p99 ≈ 73,000 / max ≈ 76,000 — the same 16.2 line, tail collapsed,
with **no Next change**. Controlled, 16.2→16.3 is worth ~5% goodput and a slightly
faster median, nothing more.

---

## Design: same-version A/B (clean), pinned to `16.3.0-canary.45`

`experimental.useNodeStreams` is a real config toggle only for a window of
canaries; it then **graduated to always-on** and the toggle was removed:

| Next.js version | `experimental.useNodeStreams` | Streaming behavior |
| --------------- | ----------------------------- | ------------------ |
| `16.2.x` stable (e.g. `16.2.9`) | does not exist | web streams only (no node-streams path) |
| `16.3.0-canary.0` … **`16.3.0-canary.45`** | present & togglable | OFF (web) by default / ON (node) when enabled |
| **`16.3.0-canary.46`**, `.47`, `16.3.0-preview.*` | **removed** | node streams **permanently on**, no off switch |

To isolate *only* the streaming change, the sweep toggles the flag **within one
version** — `16.3.0-canary.45`, the newest version that still honors it. Both
images are built from `.45`; they differ solely by `useNodeStreams` (baked via
`NEXT_USE_NODE_STREAMS`). This removes the version confound that an across-version
comparison would introduce (see the first-attempt results below).

Why `.45` honors the flag (and `.46+` does not) — verified in `node_modules`:

| Check | `16.3.0-canary.45` | `16.3.0-canary.47` |
| ----- | ------------------ | ------------------ |
| `define-env.js` value | `… : isUseNodeStreamsEnabled` (config-derived) | `… : true` (hardcoded literal) |
| `config-schema.js` has the key | yes | no (rejected as "Unrecognized key") |
| `next-server.js` sets env from config | yes (`__NEXT_USE_NODE_STREAMS='true'`) | no reference |
| precompiled runtime reads env at runtime | yes (5 sites) | no (0 — branch dead-coded to node) |

Locally confirmed: the `.45` OFF image logs `useNodeStreams=false` and the `.45`
ON image logs `useNodeStreams=true`, both with **no** config warning; the `.47`
image logs `⚠ Unrecognized key(s): 'useNodeStreams'`.

## Sweep layout (single run, no pm2, no other frameworks)

Four deployments, four NLB endpoints, benchmarked in one sweep. All four are
`next@16.3.0-canary.45`; the only difference is the baked `useNodeStreams` flag:

| Deployment / Service | Runtime | Image | `useNodeStreams` |
| -------------------- | ------- | ----- | ---------------- |
| `next`               | Node (`next start`)   | `:latest-off` | OFF (web streams)  |
| `next-stream`        | Node (`next start`)   | `:latest-on`  | ON (node streams)  |
| `next-watt`          | Watt (`wattpm start`) | `:latest-off` | OFF (web streams)  |
| `next-watt-stream`   | Watt (`wattpm start`) | `:latest-on`  | ON (node streams)  |

`benchmark.sh` builds **two images** from the same source and version, differing
only by `--build-arg NEXT_USE_NODE_STREAMS` (0/1), pushes both to ECR, and
templates `IMAGE_PLACEHOLDER_OFF` / `IMAGE_PLACEHOLDER_ON` in `next/kube.yaml`.

## How to run

```sh
AWS_PROFILE=<profile> ./benchmark.sh
```

Tunables (env vars):

```sh
AWS_PROFILE=<profile> \
  NEXT_VERSION=16.3.0-canary.45 \   # must be <= canary.45 to honor the toggle
  REPEATS=3 \                       # interleaved repeats per arm (default 3)
  ./benchmark.sh
```

k6 runs on a dedicated EC2 instance: NLB warm-up for all four endpoints, then the
full 4-variant sequence is run `REPEATS` times (**interleaved** — all four per
round — so run-to-run drift spreads evenly across arms). Each test is 60s ramp →
120s @ 1000 req/s of mixed e-commerce traffic, with a 480s cooldown between tests
(~45 min per round). Results upload to S3 under phase tags
`node-off-r<N>`, `node-on-r<N>`, `watt-off-r<N>`, `watt-on-r<N>`; average the
rounds offline to bound the high-variance tail metrics.

## Results — clean A/B (`16.3.0-canary.45`, OFF vs ON)

Run on 2026-06-30 (`results/next-20260630-125524.log`), `REPEATS=3` interleaved.
Values below are the **mean of the 3 rounds** per variant (180s @ target 1,000
req/s each). Goodput = successful requests / 180s.

| Runtime / Streams  | Success Rate | Avg (ms) | Median (ms) | p(90) (ms) | p(95) (ms) | p(99) (ms) | Max (ms) | Goodput |
| ------------------ | ------------ | -------- | ----------- | ---------- | ---------- | ---------- | -------- | ------- |
| Node — streams OFF | 59.2%        | 7,101    | 3,225       | 10,025     | 36,137     | 48,260     | 50,961   | 433/s   |
| Node — streams ON  | 59.1%        | 6,845    | 3,256       | 10,003     | 29,304     | 46,649     | 49,477   | 437/s   |
| Watt — streams OFF | 61.3%        | 6,789    | 2,755       | 10,007     | 35,174     | 48,442     | 50,657   | 452/s   |
| Watt — streams ON  | 59.6%        | 7,347    | 2,892       | 11,652     | 41,034     | 50,172     | 52,866   | 442/s   |

### Verdict: no meaningful effect under this (saturated) load

Averaged over 3 rounds, every OFF↔ON gap is **within the round-to-round noise**:

- Per-variant p95 noise is ±3,000–7,700 ms (3–8 s). The OFF↔ON p95 gaps
  (Node −6.8 s, Watt +5.9 s) are ~1 pooled σ — not robust at n=3.
- The bulk is identical across all four: p(90) ~10.0 s, median ~3 s, success
  ~59–61%, goodput 433–452/s.
- The only two gaps that exceed 1 σ — Node p(95) (better ON) and Watt avg
  (worse ON) — point in **opposite** streams-favorability directions, and they
  also **contradict the version-based first attempt** (Watt better / Node worse).
  Disagreeing signs across experiments indicate noise, not a real effect.

Conclusion: on `16.3.0-canary.45`, toggling node-streams vs web-streams does not
move throughput or latency for either Node or Watt at 1,000 req/s. This differs
from the clean April A/B on `16.2.1-canary.27` (large consistent tail wins) — a
different Next version; the flag's measurable impact did not survive into 16.3.

## Results — first attempt (version-based, confounded)

Run on 2026-06-25 (`results/next-20260625-123153.log`). This early run compared
**two versions** (OFF = `16.3.0-canary.45` web streams, ON = `16.3.0-canary.47`
node streams), so it conflates the flag with ~2 canaries of other changes — kept
here for the record. Main test: 180s @ target 1,000 req/s, single run per variant.

| Runtime / Streams       | Success Rate | Avg (ms) | Median (ms) | p(90) (ms) | p(95) (ms) | p(99) (ms) | Max (ms) | Successful reqs |
| ----------------------- | ------------ | -------- | ----------- | ---------- | ---------- | ---------- | -------- | --------------- |
| Node — streams OFF (.45) | 59.17%      | 7,289    | 3,345       | 10,032     | 34,457     | 51,645     | 55,197   | 76,616          |
| Node — streams ON (.47)  | 58.08%      | 8,891    | 3,503       | 10,585     | 56,516     | 66,097     | 67,489   | 72,940          |
| Watt — streams OFF (.45) | 60.22%      | 7,238    | 3,178       | 10,012     | 32,127     | 51,591     | 55,359   | 80,774          |
| Watt — streams ON (.47)  | 61.54%      | 6,767    | 3,012       | 10,004     | 30,272     | 50,058     | 53,730   | 80,765          |

### ON vs OFF, per runtime (opposite directions)

| Metric                       | Node (OFF→ON) | Watt (OFF→ON) |
| ---------------------------- | ------------- | ------------- |
| Success rate                 | −1.1 pp       | +1.3 pp       |
| Avg latency                  | +22%          | −6.5%         |
| Median                       | +4.7%         | −5.2%         |
| p(90)                        | +5.5%         | ~0%           |
| p(95)                        | +64%          | −5.8%         |
| p(99)                        | +28%          | −3.0%         |
| Max                          | +22%          | −2.9%         |
| Goodput (successful req/s)   | 426 → 405 (−5%) | 449 → 449 (flat) |

### Key findings

- **No throughput win.** Goodput is flat for Watt and down ~5% for Node. Watt's
  success-rate bump is an artifact: it issued slightly fewer requests (131k vs
  134k) for the same ~80,765 successes, so real throughput did not move.
- **The bulk distribution barely moved.** p(90) is ~10.0–10.6s for all four
  variants. The only large swings are in the extreme tail (p95–p99) and success
  rate — the two noisiest metrics in a saturated system (~40% errors, ~3s median).
- **Node's extreme tail got much worse on .47** (p95 34s→56s, +64%); Watt's tail
  got slightly better. The inconsistent direction across runtimes is the
  signature of noise/confound, not a clean effect.

### Caveats

1. **Cross-version, not a flag toggle.** ON=`.47` vs OFF=`.45` carries ~2 canaries
   of unrelated changes; the Node regression cannot be attributed to node-streams
   specifically.
2. **Single run, heavily saturated.** No repeats → no confidence bounds on the
   high-variance tail metrics.

### Comparison with the previous check

The earlier experiment (April 2026, see `STREAM_PERF_RESULT.md`) was a **clean
same-version A/B** — it toggled `experimental.useNodeStreams` on/off **within a
single version, `16.2.1-canary.27`** (Watt/wattpm 3.39.0). That run showed large,
*consistent* tail-latency wins from streams-ON across all runtimes (p(90) −50% to
−68%, avg −19% to −31%).

This version-based sweep **does not reproduce** those gains and is even
contradictory between runtimes. The most likely explanation is the version
confound plus single-run saturation noise here, versus the clean within-version
toggle there. A definitive verdict needs the same-version A/B repeated on
`16.3.0-canary.45` (the newest version that still supports the toggle), 2–3 runs
per arm.

## Environment

- Next.js `16.3.0-canary.45` (OFF) and `16.3.0-canary.47` (ON)
- Node.js 24.11.0
- Watt (wattpm) `^3.39.0`
- AWS EKS, 4× `m5.2xlarge` nodes
- k6 on a dedicated `c7gn.2xlarge` EC2 instance
- 1,000 req/s, `ramping-arrival-rate` executor, 3-minute sustained load
- Metric: custom `response_time_ms` (wall-clock via `Date.now()`)
