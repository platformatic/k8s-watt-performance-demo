import http from 'k6/http';

export const options = {
  scenarios: {
    warmup: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 10,
      maxVUs: 20,
    },
  },
};

const ROUTES = ['/', '/games', '/games/pokemon', '/games/magic', '/search?q=pikachu&page=1', '/sellers'];

export default function () {
  const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  http.get(__ENV.TARGET + route, { timeout: '10s' });
}
