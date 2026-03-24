import http from 'k6/http';
import { sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    warmup: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 400,
      stages: [
        { duration: '5s', target: 50 },
        { duration: '5s', target: 200 },
      ],
    },
  },
};

export default function () {
  http.get(`${BASE_URL}/`, { headers: { Accept: 'text/html' }, timeout: '10s' });
}
