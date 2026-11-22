import { expect, test } from '@playwright/test';
import { attachE2eApiHarness } from './support/mock-api-harness';

test.describe('Adaptive Personalization & Speech Practice (Web-E2E IRN RTL)', () => {
  test('IRN /app/roadmap renders Persian RTL milestones & Pronunciation Studio analyzes voice', async ({
    page,
  }) => {
    const harness = await attachE2eApiHarness(page, { edition: 'irn' });

    await page.goto('/app/roadmap');
    await expect(page.getByTestId('roadmap-screen')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-study-app]')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('roadmap-panorama')).toBeVisible();

    await page.goto('/app/vocabulary');
    await expect(page.getByTestId('vocab-wave-banner')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid^="vocab-practice-"]').first().click();
    await expect(page.getByTestId('speech-practice-drawer')).toBeVisible();

    await page.getByTestId('speech-studio-ref-listen').click();
    await expect
      .poll(() => harness.requests.some((r) => r.path === '/v1/tts/synthesize'))
      .toBe(true);
  });
});
