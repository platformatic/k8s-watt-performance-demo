# FINDINGS — k8s-watt-performance-demo benchmark runs (2026-09-07)

Repo under test (remote): `/home/perseveranza/sandbox/k8s-watt-performance-demo`
on `casa.perseveranza.net` (user `perseveranza`).
Local checkout (this session): `/Users/Shared/Sandbox/platformatic-ecommerce`
(note: `logs/` and `.benchmark-state/` in the local checkout do NOT reflect the
remote runs — see §6).

## 1. Log consolidation into `logs/`

All locally-generated logs now go to the repo-root `logs/` directory
(previously: project root, `results/`, and `/tmp`):

- `benchmark.sh --detach` → `logs/benchmark-detached-<timestamp>.log`
  (override via `BENCHMARK_LOG_FILE` is basenamed into `logs/`, cannot escape it)
- `monitor_load_test()` → `logs/benchmark_<timestamp>.log` (EC2 console-output mirror)
- S3 `benchmark-final.log` download → `logs/<framework>-<timestamp>.log`
- `tests/run-tests.sh` server/test logs → `logs/{next,react-router,tanstack}-{server,test}.log`
  (were `/tmp/*.log`)
- `benchmark-all.sh` result lookup → `logs/` (was `results/`)
- `logs/.gitkeep` added; README reference updated to
  `logs/benchmark-detached-<timestamp>.log`
- Shell syntax validated with `bash -n`. Project tests/lint not run.

## 2. `run-benchmark.sh` follows the detached log

After launching `benchmark.sh --detach`, the launcher now stays attached:

```sh
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/benchmark-detached-$(date +%Y%m%d-%H%M%S).log"
export BENCHMARK_LOG_FILE="$LOG"
touch "$LOG"

"$SCRIPT_DIR/benchmark.sh" --detach
tail -n 1000 -f "$LOG"
```

`tail -f` exits on Ctrl-C; the nohup'd orchestrator keeps running.

## 3. Control run: `next-control-2026-09-07-001` (SSRT=0)

- Instance `i-03163779b1b8dec58`, framework `next`, full `pm2,watt,node` order.
- Harness completed: `Test complete for {PM2,WATT,NODE}`,
  `ALL E-COMMERCE LOAD TESTS COMPLETE`, S3 uploads
  (`benchmark-{pm2,watt,node,latest,final}.log`) succeeded, `Benchmark completed`,
  `exit 0`, cloud-init finished.
- App results FAILED in all three arms (client-side `request timeout`s after the
  10s k6 `http.get` timeout, `http_req_failed rate<0.1` threshold crossed,
  `WARN: main load test for ... exited nonzero`):

| Runner | Time (UTC) | Success | Avg / p99 |
|---|---|---|---|
| PM2  | 08:50:37 | 67.55% (43,851 err) | 6762ms / 61870ms |
| WATT | 09:03:11 | 63.43% (48,022 err) | 8402ms / 67215ms |
| NODE | 09:15:43 | 64.89% (45,982 err) | 7516ms / 61997ms |

- Failure rate ≈ 32–37%, i.e. NOT a warmup issue — the ~⅓ errors come from the
  main `mixed_load` phase (1000 iters/s, ~15k VUs, 3 min).
- Cleanup 09:30–09:31 deleted VPC, IAM roles, ECR repo, S3 bucket, state file:
  `Cleanup completed`. `check-resources.sh 2026-09-07-001` → 7/7 PASS, exit 0.

## 4. SSRT run: `next-ssrt-2026-09-07-001` (SSRT=1, same RUN_ID)

- Instance `i-0cc33d4cae6400b6c`, full matrix, harness completed, cleanup
  completed 11:40:52–11:40:56, `check-resources.sh 2026-09-07-001 1` → 7/7 PASS.
- Results (uniformly worse than control, same saturation signature):

| Runner | Time (UTC) | Success | Avg / p99 |
|---|---|---|---|
| PM2  | 10:59:05 | 63.08% (46,089 err) | 8936ms / 74755ms |
| WATT | 11:13:04 | 57.78% (52,004 err) | 11811ms / 81910ms |
| NODE | 11:25:47 | 59.82% (51,560 err) | 10055ms / 76583ms |

- Delta ≈ −5pp success and higher latency in every arm, but both arms are
  saturated → the comparison is NOT a usable SSRT-vs-control signal; the −5pp
  is indistinguishable from run-to-run noise under saturation.

## 5. Artifacts (remote `logs/`, sole surviving copies)

Cleanup deletes the S3 buckets, so these local files are the only full results:

- Control: `benchmark-detached-20260907-081208.log` (27M),
  `benchmark_20260907_083912.log` (65K),
  `next-20260907-091755.log` (27M)
- SSRT: `benchmark-detached-20260907-102157.log` (30M),
  `benchmark_20260907_104711.log` (65K),
  `next-20260907-112806.log` (30M)

Back these up off the server before any `logs/` cleanup.

## 6. Local vs remote checkout discrepancy (explained)

`ls logs` locally showed only `.gitkeep` while the remote had the full triplets:
the runs happened on `casa.perseveranza.net`, not in
`/Users/Shared/Sandbox/platformatic-ecommerce`. Local `logs/` /
`.benchmark-state/` are empty by design. The code changes in §1–§2 exist in the
local checkout; verify they are synced to the remote repo before the next run.

## 7. Diff vs Matteo's commits (`7e2dcbc`, Mar 2026 → HEAD)

Working tree clean. All changes since are Paolo's September commits.

Expected (confirmed):
- New scripts: `run-benchmark.sh`, `check-resources.sh`, `preflight.sh`
- `next/package.json` + lockfile: SSRT Next/React pinning,
  `build:control` / `build:ssrt` scripts
- Docs: `README.md` (+SSRT Comparison, Detached runs, Runner Matrix),
  `next/README.md` SSRT paragraph, `CLAUDE.md` AMI line

SSRT plumbing (intended, but beyond packages):
- `next/Dockerfile`: `SSRT_ENABLED` arg → `TEMPLATES` env, BuildKit npmrc secret
  mount, `--legacy-peer-deps`, syntax directive
- `next/next.config.mjs`: `ssrTemplates` toggled by `TEMPLATES`
- `benchmark.sh`: `SSRT_ENABLED`, `IMAGE_TAG` default `latest` →
  `next-ssrt-${SSRT_ENABLED}`, mandatory `NPMRC_PATH` check in
  `validate_docker`, `--secret`/`--build-arg` in docker build, preflight gate

Behavior/measurement changes vs Matteo's baseline (affect comparability):
1. Load-test AMI: pinned `ami-07b2b18045edffe90` → SSM-resolved latest AL2023 ARM64.
2. Main k6 script gained `thresholds: http_req_failed rate<0.1` (previously none);
   warmup tightened `0.1` → `0.05`.
3. All k6 invocations got `|| echo "WARN: ... exited nonzero"` — failures no
   longer abort the loadtest script under `set -e`.
4. Local `health_check_endpoints()` deleted; remote health checks on the
   load-test host with `REMOTE_HEALTH_CHECKS_FAILED` gating + monitor fast-fail.
5. Hardened user-data (`set -euxo pipefail`, EXIT trap, k6 install retries via
   `jq`, guarded conntrack sysctl); remote exits with k6's real status.
6. `RUN_ORDER` runner selection (default `pm2,watt,node` = Matteo's order;
   both runs used the full matrix).
7. §1 `logs/` consolidation (this session).

## 8. Open items / recommended next step

- Do NOT spend more cluster cycles on comparison runs until saturation is
  diagnosed: pod CPU/throttling during the 09:15 and 11:25 (UTC) windows, NLB
  target health, Node event-loop lag.
- Decide whether items §7.1–§7.4 are accepted as the new baseline or should be
  re-aligned for apples-to-apples comparison with Matteo's numbers.
- Preflight for next run is green (remote `.env` present, disk 25%, Docker
  28.2.2, empty state, no stray processes).

## 9. Why SSRT was not faster (diagnosed 2026-09-07, local reproduction)

Three independent problems stack up. Any one of them alone hides the SSRT delta.

### 9.1 The SSRT image contains no templates (Turbopack glob mismatch)

- `next build` in Next 16 defaults to Turbopack; both remote Docker builds print
  `Next.js 16.3.0-canary.105 (Turbopack)` (detached logs, `#13` build step).
- `@platformatic/ssrt-next@16.3.0-canary.105-ssrt.4` registers the Turbopack
  template loader only for these globs
  (`node_modules/next/dist/build/swc/index.js`, `turbopack.rules`):
  `./app/**/*.{js,jsx,ts,tsx}` (flight), `./components/server/**` (flight),
  `./components/client/**` (html). This project keeps its routes in
  `./src/app/**`, so the loader never runs on any component.
- `✓ ssrTemplates` in the build output only reflects the config flag and the
  runtime switch (`app-page-turbo-ssrt.runtime.prod.js` is referenced 30x in
  `.next/server`); it does not mean templates were compiled.
- Proof (local, identical source and flag):

| Build | `flightTemplate`/`jsxTemplate` call sites in `.next/server` |
|---|---|
| `TEMPLATES=1 next build` (Turbopack, what Docker runs) | 0 |
| `TEMPLATES=1 next build --webpack` | 63 |

- Running the babel plugin by hand on `src/app/page.tsx`, `search/page.tsx`,
  `cards/[id]/page.tsx`, `layout.tsx` emits 10-15 templates per file, so the
  compiler itself works; only the Turbopack wiring misses `src/app`.
- Net effect: the `next-ssrt-*` image is the control image plus the SSRT React
  runtime, with zero templated components. Any measured difference is noise.

### 9.2 Even with templates applied, the gain on this app is modest

Local A/B, single `next start` process, `DB_DELAY_ENABLED=false`, autocannon
`-c 20 -d 8`, Apple Silicon, webpack builds (templates present):

| Route | control req/s | SSRT req/s | delta |
|---|---|---|---|
| `/` | 845 | 915 | +8% |
| `/search?q=pikachu&page=2` | 477 | 500 | +5% |
| `/cards/<id>` | 498 | 520 | +4% |
| `/games/<slug>` | 1209 | 1238 | +2% |
| `/games` | 1405 | 1449 | +3% |
| `/sellers` (147 KB HTML) | 217 | 277 | +28% |
| `/sets/<slug>?page=1` | 923 | 906 | -2% |

Why it is small here:
- The app has zero `'use client'` components, so only flight-mode templates
  apply (63 `flightTemplate`, 0 `jsxTemplate`/`renderTemplate`); the html
  template path has nothing to template.
- The JSON "database" is a real CPU cost that SSRT cannot touch: with delay
  disabled, `searchCards` costs 0.96 ms/call (text scan of 10,000 cards) and
  `getCardWithListings` 0.90 ms/call (filter of 101,544 listings). Those two
  routes are 45% of the k6 mix and take ~2.1 ms/request end to end, so the data
  layer is ~45% of their CPU.
- Mix-weighted, the whole page render costs ~1.8 ms CPU per request on one
  fast core; SSRT shaves roughly 5-10% of that.

### 9.3 The cluster harness measures a crash loop, not throughput

- Warm-up (homepage only, up to 500 req/s) is clean in all six arms:
  p95 28-35 ms, 0-11 failures out of 17,324.
- The main test ramps 0->1000 req/s over 60 s. In every arm the k6 progress
  lines show VUs exploding at 45-50 s, i.e. around 750-830 req/s of the mixed
  workload. That is the capacity of 6 vCPU per variant for this mix.
- Liveness probe in `next/kube.yaml` is `GET /` with `timeoutSeconds: 1`,
  `periodSeconds: 2`, `failureThreshold: 5`: 10 s of >1 s latency kills the
  container. Post-benchmark diagnostics show `RESTARTS = 2` for all 12 pods in
  both runs, with `Killing ... failed liveness probe` events for the `next`
  pods still visible in the last 50 events. Each arm therefore goes through two
  full kill/restart cycles inside its 3-minute test, which is where the 32-42%
  failure rate and the 60-80 s response times come from.
- Because all arms collapse identically, a 5-25% per-request CPU change is
  invisible. `metrics-server` is not installed, so `kubectl top` returned
  nothing and no CPU data exists for the runs.

### 9.4 What to change before the next run

1. Make templates land. Either build with `next build --webpack` (verified: 63
   templates, runs fine), or add a Turbopack rule for `./src/app/**/*.{js,jsx,ts,tsx}`
   in `next.config.mjs`, or move `src/app` to `app`. Report the hardcoded
   `./app` glob upstream to ssrt-next (it should derive from the detected
   `appDir`).
2. Add a build-time assertion in the Dockerfile when `SSRT_ENABLED=1`:
   fail if `.next/server` contains no `flightTemplate`/`jsxTemplate` call sites.
3. Stop overloading the cluster: target ~500-600 req/s (or ramp to find the
   knee and report max sustainable rate), and stop the liveness probe from
   killing pods under load (cheap dedicated health endpoint, or
   `timeoutSeconds` 5 / `failureThreshold` 10, or no liveness probe during
   benchmarks). Install `metrics-server` so pod CPU is captured.
4. Expect a small delta on this workload unless the app gains client
   components or the data layer is made cheaper (indexes/maps instead of
   linear scans), because SSRT only accelerates the render.

Local artifacts: `next/.next` currently holds the webpack `TEMPLATES=1` build
from this diagnosis (gitignored). Scripts and logs are in the session scratchpad.

## 10. Applied changes (2026-09-07, Turbopack route)

### 10.1 Templates now compile under Turbopack

- Second defect found while wiring the rule: the upstream
  `next/dist/build/turbopack/ssr-template-loader` only loads Babel's React
  preset, so it throws `SyntaxError: Unexpected token` on every `.ts`/`.tsx`
  source. Even a project with `./app/**` would fail on TypeScript.
- `next/ssrt-template-loader.cjs` (new): same contract as the upstream loader
  plus the TypeScript preset (`isTSX` by extension, `allExtensions`).
- `next/next.config.mjs`: when `TEMPLATES=1`, registers a Turbopack rule for
  `./src/app/**/*.{js,jsx,ts,tsx}` in flight mode with the same server-only,
  non-foreign condition as the internal rule. Control builds register nothing.
- Result: `TEMPLATES=1 npm run build` (Turbopack) now embeds 57
  `flightTemplate` call sites (was 0). Local A/B, same method as §9.2:

| Route | control req/s | SSRT req/s | delta |
|---|---|---|---|
| `/` | 796 | 842 | +6% |
| `/search?q=pikachu&page=2` | 443 | 460 | +4% |
| `/cards/<id>` | 463 | 478 | +3% |
| `/games/<slug>` | 1015 | 1132 | +12% |
| `/games` | 1271 | 1385 | +9% |
| `/sellers` | 204 | 270 | +32% |
| `/sets/<slug>?page=1` | 819 | 855 | +4% |

Both upstream issues are fixed in ssrt-next and released as
`@platformatic/ssrt-next@16.3.0-canary.105-ssrt.5` (GitHub Actions run
34123164515, all jobs green):
`packages/next/src/build/swc/index.ts` derives the rule globs from the detected
`app` directory (`./src/app/**`, `./src/components/{server,client}/**` when
sources live under `src/`), and
`packages/next/src/build/turbopack/ssr-template-loader.js` adds the compiled
TypeScript preset for `.ts`/`.tsx` sources. Verified with the built package
against a copy of this app using a plain `next.config.mjs`: 57 `flightTemplate`
call sites with `ssrTemplates: true`, 0 without. `next/package.json` now pins
`ssrt.5` (installed with `--min-release-age=0` on the command line), and the
temporary `next/ssrt-template-loader.cjs` plus the Turbopack rule in
`next/next.config.mjs` were removed again; see §11 for the re-verification.

### 10.2 Guard against a mislabelled SSRT image

- `next/Dockerfile`: after `npm run build`, when `SSRT_ENABLED=1`, counts
  `flightTemplate|jsxTemplate|renderTemplate` call sites in `.next/server` and
  fails the build if the count is 0 (busybox-compatible `find | grep`).

### 10.3 Harness no longer measures a crash loop

- `next/kube.yaml` (all three deployments): liveness probe `timeoutSeconds`
  1 -> 5, `periodSeconds` 2 -> 10, `failureThreshold` 5 -> 10 (100 s of >5 s
  latency before a kill); readiness probe gains `timeoutSeconds: 5` and
  `failureThreshold` 1 -> 3 so a single slow check no longer deregisters the
  pod from the NLB.
- `next/loadtest.sh` + `benchmark.sh`: new `TARGET_RATE` (default 600 req/s,
  exported into the EC2 user-data like `RUN_ORDER`) drives both stages of the
  main k6 scenario; banners print the configured rate.
- `benchmark.sh`: `install_metrics_server()` (best effort, after nodes are
  ready) and a 30 s `kubectl top pods` sampler in `monitor_load_test()` writing
  `logs/pod-usage_<timestamp>.log`, so pod CPU exists for the next run.
- Docs: `README.md` (`TARGET_RATE`, build guard, usage log), `CLAUDE.md`,
  `next/README.md`.

### 10.4 Not changed

- `react-router/kube.yaml` and `tanstack/kube.yaml` keep the aggressive probes;
  apply the same relaxation before benchmarking those frameworks.
- The JSON data layer still does linear scans; it bounds the SSRT delta on
  search and card-detail routes (§9.2) but is part of the workload definition.

## 11. Re-verification on `@platformatic/ssrt-next@16.3.0-canary.105-ssrt.5`

- `next/package.json` pins `ssrt.5`; installed with
  `npm install --legacy-peer-deps --min-release-age=0` (command-line override,
  `~/.npmrc` unchanged). The installed `dist` contains both fixes (`findDir`
  in `build/swc/index.js`, `preset-typescript` in the Turbopack loader).
- `next/next.config.mjs` is back to the committed plain config and
  `next/ssrt-template-loader.cjs` is gone.
- Docker SSRT build (`SSRT_ENABLED=1`): compiles, guard prints
  `SSRT template call sites: 57`, image builds.
- Local Turbopack builds with the plain config: `TEMPLATES=0` -> 0 template
  call sites, `TEMPLATES=1` -> 57 `flightTemplate`.
- Local A/B (single `next start`, `DB_DELAY_ENABLED=false`, autocannon
  `-c 20 -d 8`):

| Route | control req/s | SSRT req/s | delta |
|---|---|---|---|
| `/` | 865 | 881 | +2% |
| `/search?q=pikachu&page=2` | 473 | 488 | +3% |
| `/cards/<id>` | 509 | 515 | +1% |
| `/games/<slug>` | 1174 | 1235 | +5% |
| `/games` | 1448 | 1418 | -2% |
| `/sellers` | 216 | 280 | +30% |
| `/sets/<slug>?page=1` | 891 | 938 | +5% |

Same picture as §9.2/§10.1: the only route that moves clearly is the 147 KB
sellers page; everything else is within run-to-run noise of a few percent.
The cluster run needs the §10.3 harness changes to have any chance of showing
that delta.
