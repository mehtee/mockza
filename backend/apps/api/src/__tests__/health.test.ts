import { loadEnv } from '@mockza/config';
import { describe, expect, it } from 'vitest';
import { createApiApp } from '../app.js';

describe('@mockza/api health & edition guard', () => {
  const env = loadEnv({ EDITION: 'glb', NODE_ENV: 'test' });
  const app = createApiApp(env);

  it('returns ok status and configured edition on /v1/health', async () => {
    const res = await app.request('/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: 'ok',
      edition: 'glb',
      service: 'mockza-api',
    });
  });

  it('rejects requests carrying mismatched x-mockza-edition header', async () => {
    const res = await app.request('/v1/catalog/manifest', {
      headers: { 'x-mockza-edition': 'irn' },
    });
    expect(res.status).toBe(403);
  });
});
