import { expect, test } from '@playwright/test';
import { attachClosedLoopRoutes } from './support/closed-loop-mock';
import { attachE2eApiHarness } from './support/mock-api-harness';

test.describe('Sanjia Desktop Web (IRN RTL) Closed-Loop E2E (Web-E2E 10)', () => {
  test('RTL Persian coaching Chrome + LTR English LtrExamBoundary + Register Shifter + Drop Anything recovery', async ({
    page,
  }) => {
    await attachE2eApiHarness(page, { edition: 'irn' });
    await attachClosedLoopRoutes(page, { edition: 'irn' });

    // 1. Sanjia Home -> Daily Mission in Persian RTL with LtrExamBoundary on English targets.
    await page.goto('/app/home');
    await expect(page.getByTestId('home-daily-mission-card')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await page.getByTestId('home-daily-mission-cta').click();
    await expect(page.getByTestId('daily-mission-screen')).toBeVisible();
    await expect(page.getByTestId('mission-forced-targets')).toContainText('Had engineers prioritized');

    const englishInputDir = await page.getByTestId('mission-response-input').getAttribute('dir');
    expect(englishInputDir).toBe('ltr');

    // 2. Register Shifter renders Persian examiner rationale (whyFa) + English LTR sentences.
    await page.goto('/app/register-shifter');
    await page.getByTestId('shifter-record-btn').click();
    await page.waitForTimeout(450);
    await page.getByTestId('shifter-record-btn').click();

    await expect(page.getByTestId('register-gear-ladder')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('register-gear-ladder')).toContainText('جایگزینی صفت کلی good');

    // 3. Drop Anything rejects blocked URL in Persian, then builds bilingual 2-min drill from pasted text.
    await page.goto('/app/drop');
    await page.getByTestId('drop-url-input').fill('https://youtu.be/abc123');
    await page.getByTestId('drop-ingest-btn').click();
    await expect(page.getByTestId('drop-error-banner')).toBeVisible();

    await page.getByTestId('drop-tab-text').click();
    await page
      .getByTestId('drop-text-input')
      .fill('Inference sped up markedly, albeit with slightly higher variance on rare tokens.');
    await page.getByTestId('drop-ingest-btn').click();

    await expect(page.getByTestId('drop-drill-screen')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('drop-drill-screen')).toContainText('هرچند؛ با وجود اینکه');
  });
});
