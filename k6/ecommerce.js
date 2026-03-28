import http from 'k6/http';
import { check } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const RATE = parseInt(__ENV.RATE || '500');
const DURATION = __ENV.DURATION || '30s';

export const request_errors = new Counter('request_errors');
export const successful_requests = new Counter('successful_requests');
export const response_time_ms = new Trend('response_time_ms');

export const options = {
  scenarios: {
    ecommerce_mix: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: '1s',
      duration: DURATION,
      preAllocatedVUs: Math.min(RATE * 2, 2000),
      maxVUs: Math.min(RATE * 4, 5000),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<2000'],
  },
};

const ROUTES = [
  { path: '/',                          weight: 20 },
  { path: '/search?q=dragon',           weight: 25 },
  { path: '/cards/pokemon-set-01-001',  weight: 20 },
  { path: '/games/pokemon',             weight: 15 },
  { path: '/games',                     weight: 10 },
  { path: '/sellers',                   weight: 5 },
  { path: '/sets/scarlet-violet',       weight: 5 },
];

const totalWeight = ROUTES.reduce((sum, r) => sum + r.weight, 0);
const cumWeights = [];
let cumSum = 0;
for (const r of ROUTES) {
  cumSum += r.weight;
  cumWeights.push({ path: r.path, cum: cumSum });
}

function pickRoute() {
  const rand = Math.random() * totalWeight;
  for (const entry of cumWeights) {
    if (rand < entry.cum) return entry.path;
  }
  return '/';
}

export default function () {
  const path = pickRoute();
  const url = `${BASE_URL}${path}`;
  const res = http.get(url, {
    headers: { Accept: 'text/html' },
    timeout: '10s',
    redirects: 5,
  });

  response_time_ms.add(res.timings.duration);

  const ok = check(res, {
    'status is 2xx/3xx': (r) => r.status >= 200 && r.status < 400,
    'body not empty': (r) => r.body && r.body.length > 0,
  });

  if (ok) {
    successful_requests.add(1);
  } else {
    request_errors.add(1);
  }
}

export function handleSummary(data) {
  const outFile = __ENV.OUT_FILE;
  if (!outFile) return {};

  const rt = data.metrics.response_time_ms;
  const fmt = (v) => (v !== undefined && v !== null) ? v.toFixed(2) : 'N/A';

  const iters = data.metrics.iterations?.values?.count || 0;

  const summary = {
    avg: fmt(rt?.values?.avg),
    min: fmt(rt?.values?.min),
    max: fmt(rt?.values?.max),
    med: fmt(rt?.values?.med),
    p90: fmt(rt?.values?.['p(90)']),
    p95: fmt(rt?.values?.['p(95)']),
    iterations: iters,
    requests: data.metrics.http_reqs?.values?.count || 0,
    errors: data.metrics.request_errors?.values?.count || 0,
    rps: fmt(iters / (parseInt(__ENV.DURATION) || 30)),
  };

  return {
    [outFile]: JSON.stringify(summary, null, 2),
  };
}
