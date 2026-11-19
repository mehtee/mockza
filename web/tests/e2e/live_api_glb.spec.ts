import { expect, test } from '@playwright/test';

const API_BASE = process.env['MOCKZA_LIVE_API_BASE'] ?? 'http://127.0.0.1:45281';

async function isLiveApiHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/healthz`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

test.describe('Live API Contract Smoke (no mock-api-harness)', () => {
  test('verifies real Hono API endpoints and live browser SPA calls against Postgres-backed backend', async ({
    page,
  }) => {
    const alive = await isLiveApiHealthy();
    if (!alive && process.env['MOCKZA_LIVE_API'] !== '1') {
      test.skip(true, `Live backend not running at ${API_BASE}; set MOCKZA_LIVE_API=1 to require it.`);
      return;
    }

    const failedApiCalls: string[] = [];
    const seenApiPaths = new Set<string>();
    page.on('response', (res) => {
      if (res.url().startsWith(API_BASE)) {
        const path = new URL(res.url()).pathname;
        seenApiPaths.add(path);
        if (res.status() >= 400) {
          failedApiCalls.push(`${res.status()} ${res.request().method()} ${path}`);
        }
      }
    });

    // Direct API contract probe matching exact SPA gateway endpoints
    const anonDeviceId = crypto.randomUUID();
    const anonRes = await fetch(`${API_BASE}/v1/auth/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: anonDeviceId,
        appVersion: '1.0.0-e2e',
      }),
    });
    expect([200, 201]).toContain(anonRes.status);
    const anonData = (await anonRes.json()) as { accessToken?: string; token?: string };
    const token = anonData.accessToken ?? anonData.token;
    expect(token).toBeTruthy();

    const quotaRes = await fetch(`${API_BASE}/v1/quota/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(quotaRes.status).toBe(200);

    const telRes = await fetch(`${API_BASE}/v1/telemetry/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        events: [{ eventName: 'e2e_live_smoke', timestamp: new Date().toISOString() }],
      }),
    });
    expect(telRes.status).toBe(200);
    const telBody = (await telRes.json()) as { acceptedCount: number };
    expect(telBody.acceptedCount).toBe(1);

    // Live browser navigation without Playwright route mocking (bootstrap-shared connects to :45281 on 127.0.0.1)
    await page.goto('/app/home');
    await expect(page.getByTestId('home-screen')).toBeVisible({ timeout: 15000 });
    await page.goto('/app/practice');
    await expect(page.getByTestId('practice-catalog-screen')).toBeVisible({ timeout: 15000 });
    expect(failedApiCalls).toEqual([]);
    expect(seenApiPaths.size).toBeGreaterThanOrEqual(1);
  });
});
