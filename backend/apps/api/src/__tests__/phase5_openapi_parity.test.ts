import { Readable } from 'node:stream';
import { loadEnv } from '@mockza/config';
import { describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

describe('Phase 5: OpenAPI Parity, Media Security Headers & Aggregate Upload Limits (TD-50, TD-55, TD-56)', () => {
  const env = loadEnv({
    EDITION: 'glb',
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-at-least-32-chars-long-12345',
    REVENUECAT_WEBHOOK_SECRET: 'rc-webhook-secret-999',
  });
  const app = createApiApp(env);

  it('TD-50: OpenAPI document exposes critical client wire endpoints with expected HTTP methods', () => {
    const doc = app.getOpenAPIDocument({
      openapi: '3.1.0',
      info: { title: 'Mockza API', version: '0.1.0' },
    }) as unknown as { paths?: Record<string, Record<string, unknown>> };

    const paths = doc.paths ?? {};
    const expectedOpenApiPaths: Array<[string, string]> = [
      ['/v1/health', 'get'],
      ['/v1/health/ready', 'get'],
      ['/v1/uploads/presign', 'post'],
      ['/v1/evaluate/writing', 'post'],
      ['/v1/evaluate/speaking', 'post'],
      ['/v1/evaluate/retry', 'post'],
      ['/v1/evaluate/explain-question', 'post'],
      ['/v1/jobs/{jobId}', 'get'],
      ['/v1/exams/{packId}', 'get'],
      ['/v1/drills', 'get'],
      ['/v1/vocab/deck', 'get'],
      ['/v1/catalog/manifest', 'get'],
      ['/v1/quota/me', 'get'],
    ];

    for (const [path, method] of expectedOpenApiPaths) {
      expect(paths[path], `Missing OpenAPI route ${method.toUpperCase()} ${path}`).toBeDefined();
      expect(
        paths[path]?.[method],
        `Missing OpenAPI method ${method.toUpperCase()} on ${path}`,
      ).toBeDefined();
    }

    const registeredRoutes = new Set(app.routes.map((r) => `${r.method.toUpperCase()} ${r.path}`));
    for (const sig of [
      'POST /v1/auth/anonymous',
      'GET /v1/auth/challenge',
      'POST /v1/auth/link',
      'DELETE /v1/account',
      'GET /v1/jobs/:jobId/events',
      'POST /v1/webhooks/revenuecat',
      'POST /v1/feedback/question-flag',
    ]) {
      expect(registeredRoutes.has(sig), `Missing mounted route ${sig}`).toBe(true);
    }
  });

  it('TD-55: media proxy sets nosniff and sandboxes SVG responses', async () => {
    const svgMockS3 = {
      async send() {
        return {
          ContentType: 'image/svg+xml',
          ContentLength: 24,
          ETag: '"abc"',
          Body: Readable.from([Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')]),
        };
      },
    } as never;

    const mediaApp = createApiApp(env, { s3Client: svgMockS3 });
    const res = await mediaApp.request('/v1/media/charts/task1.svg');
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBe('sandbox');
  });
});
