import { expect, test } from '@playwright/test';
import { attachE2eApiHarness } from './support/mock-api-harness';

test.describe('Adaptive Personalization, Roadmap & Speech Practice (Web-E2E GLB)', () => {
  test('Home Roadmap Next Step -> /app/roadmap Panorama & Step Action -> Vocab Wave Listen', async ({
    page,
  }) => {
    const harness = await attachE2eApiHarness(page, { edition: 'glb' });

    await page.goto('/app/home');
    await expect(page.getByTestId('home-roadmap-next-step-card')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('home-band-confidence-pill')).toBeVisible();

    await page.getByTestId('home-open-roadmap-link').click();
    await expect(page.getByTestId('roadmap-screen')).toBeVisible();
    await expect(page.getByTestId('roadmap-panorama')).toBeVisible();
    await expect(page.getByTestId('roadmap-milestone-1')).toBeVisible();
    await expect(page.getByTestId('roadmap-milestone-4')).toBeVisible();

    // Advance active step 1 -> step 2 becomes active
    await page.getByTestId('roadmap-step-complete-step-1').click();
    await expect(page.getByTestId('roadmap-active-step-2')).toBeVisible({ timeout: 10000 });

    // Visit Vocabulary Wave Hub & trigger Kokoro TTS API Listen
    await page.goto('/app/vocabulary');
    await expect(page.getByTestId('vocab-wave-banner')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('vocab-listen-vocab-001').or(page.locator('[data-testid^="vocab-listen-"]').first())).toBeVisible();
    await page.locator('[data-testid^="vocab-listen-"]').first().click();

    await expect
      .poll(() => harness.requests.some((r) => r.path === '/v1/tts/synthesize'))
      .toBe(true);
  });
});
