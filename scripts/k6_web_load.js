import { check } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const serverErrors = new Counter('server_errors_5xx');
const staticSuccess = new Rate('static_requests_ok');
const staticDuration = new Trend('static_route_duration_ms');

export const options = {
  scenarios: {
    static_edge_burst: {
      executor: 'ramping-vus',
      startVUs: 20,
      stages: [
        { duration: '10s', target: 500 },
        { duration: '20s', target: 1000 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<50'],
    server_errors_5xx: ['count==0'],
    static_requests_ok: ['rate>0.995'],
  },
};

const WEB_URL = __ENV.WEB_URL || 'http://web:8080';

const ROUTES = [
  '/',
  '/ielts-academic/',
  '/toefl-ibt/',
  '/calculators/toefl-6-to-120-converter/',
  '/samples/',
  '/vocab/',
  '/llms.txt',
  '/toefl-ibt.md',
  '/robots.txt',
  '/app/home/',
];

export default function () {
  const targetPath = ROUTES[(__VU + __ITER) % ROUTES.length];
  const res = http.get(`${WEB_URL}${targetPath}`, {
    headers: { 'Accept-Encoding': 'br, gzip' },
  });

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
    'non-empty response': (r) => Boolean(r.body && r.body.length > 0),
  });

  staticSuccess.add(ok ? 1 : 0);
  staticDuration.add(res.timings.duration);
  if (res.status >= 500) {
    serverErrors.add(1);
  }
}
