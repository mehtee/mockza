import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// Custom metrics for PgBouncer & Hono performance
const quotaExceededCount = new Counter('quota_exceeded_429');
const successfulEvals = new Counter('successful_evals_202');
const serverErrors = new Counter('server_errors_5xx');
const apiP95Latency = new Trend('api_p95_latency');
const successRate = new Rate('successful_requests');

export const options = {
  scenarios: {
    thousand_concurrent_users: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '15s', target: 500 }, // Ramp to 500 VUs
        { duration: '30s', target: 1000 }, // Peak 1,000 concurrent VUs
        { duration: '30s', target: 1000 }, // Sustain 1,000 VUs against PgBouncer
        { duration: '15s', target: 0 }, // Ramp down cleanly
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // Strict SLA: P95 < 100ms for lightweight API routes behind PgBouncer
    http_req_duration: ['p(95)<100'],
    // Server 5xx errors must be zero
    server_errors_5xx: ['count==0'],
    // High request success rate (> 98% excluding deliberate 429 quota gates)
    successful_requests: ['rate>0.98'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://api:8787';

export default function () {
  const vuId = __VU;
  const iter = __ITER;
  const deviceId = `k6-device-${vuId}-${iter % 10}`;

  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Id': deviceId,
    'X-Client-Edition': 'glb',
  };

  // 1. Health check (lightweight PgBouncer ping)
  const healthRes = http.get(`${BASE_URL}/v1/health`, { headers });
  check(healthRes, {
    'health returns 200': (r) => r.status === 200,
  });
  successRate.add(healthRes.status === 200);

  // 2. Fetch catalog manifest (cached/CDN payload read)
  const catalogRes = http.get(`${BASE_URL}/v1/catalog/manifest`, { headers });
  check(catalogRes, {
    'catalog manifest returns 200': (r) => r.status === 200,
  });
  successRate.add(catalogRes.status === 200);

  // 3. Check quota snapshot
  const quotaRes = http.get(`${BASE_URL}/v1/quota`, { headers });
  check(quotaRes, {
    'quota status returns 200': (r) => r.status === 200,
  });
  successRate.add(quotaRes.status === 200);

  // 4. Job polling check
  const fakeJobId = '00000000-0000-4000-8000-000000000001';
  const jobRes = http.get(`${BASE_URL}/v1/jobs/${fakeJobId}`, { headers });
  check(jobRes, {
    'job poll returns 200 or 404': (r) => r.status === 200 || r.status === 404,
  });
  successRate.add(jobRes.status === 200 || jobRes.status === 404);

  // 5. Evaluate burst simulation (testing atomic quota reservation & zero double-spend)
  if (iter % 3 === 0) {
    const payload = JSON.stringify({
      attemptId: `k6-attempt-${vuId}-${iter}`,
      packId: 'ielts-writing-pack-01',
      taskType: 'task2',
      essayText:
        'In contemporary urban society, sustainable architectural innovations have substantially mitigated the environmental footprint of metropolitan density. This essay explores renewable energy integration and communal infrastructure planning in modern cities.',
    });

    const evalRes = http.post(`${BASE_URL}/v1/evaluate/writing`, payload, {
      headers: {
        ...headers,
        'Idempotency-Key': `k6-idemp-${vuId}-${iter}`,
      },
    });

    if (evalRes.status === 200 || evalRes.status === 202) {
      successfulEvals.add(1);
      successRate.add(1);
    } else if (evalRes.status === 429) {
      // Deliberate quota exhaustion gate - not a server defect
      quotaExceededCount.add(1);
      successRate.add(1);
    } else if (evalRes.status >= 500) {
      serverErrors.add(1);
      successRate.add(0);
    }

    apiP95Latency.add(evalRes.timings.duration);
  }

  // Brief jitter pause between user actions
  sleep(0.05 + Math.random() * 0.1);
}
