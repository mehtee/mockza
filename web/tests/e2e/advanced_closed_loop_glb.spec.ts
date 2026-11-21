import { expect, test } from '@playwright/test';
import { attachClosedLoopRoutes } from './support/closed-loop-mock';
import { attachE2eApiHarness } from './support/mock-api-harness';

test.describe('Desktop Closed-Loop Linguistic Engine (Web-E2E 9: GLB)', () => {
  test('Home -> Daily Mission -> Graph -> Register Shifter 3-Gear + Repeat -> Drop Anything YouTube reject & Text Drill -> SM-2', async ({
    page,
  }) => {
    await attachE2eApiHarness(page, { edition: 'glb' });
    await attachClosedLoopRoutes(page, { edition: 'glb' });

    // 1. Home renders Daily Mission card and launches Daily Mission screen.
    await page.goto('/app/home');
    await expect(page.getByTestId('home-daily-mission-card')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('home-daily-mission-cta').click();

    await expect(page.getByTestId('daily-mission-screen')).toBeVisible();
    await expect(page.getByTestId('mission-forced-targets')).toContainText('albeit');

    await page
      .getByTestId('mission-response-input')
      .fill(
        'Had engineers prioritized quantization earlier, latency would have dropped significantly, albeit at minor calibration cost.',
      );
    await page.getByTestId('mission-complete-btn').click();
    await expect(page.getByTestId('mission-completed-banner')).toBeVisible();

    // 2. Navigate to Linguistic Graph & verify bottlenecks + pinned topic.
    await page.getByRole('link', { name: 'View Linguistic Graph' }).click();
    await expect(page.getByTestId('linguistic-graph-screen')).toBeVisible();
    await expect(page.getByTestId('linguistic-graph-screen')).toContainText('Overuses generic "good/bad"');

    // 3. Navigate to Register Shifter, record clip, switch all 3 gears, save phrase & verify repeat aloud.
    await page.goto('/app/register-shifter');
    await page.getByTestId('shifter-record-btn').click();
    await page.waitForTimeout(450);
    await page.getByTestId('shifter-record-btn').click();

    await expect(page.getByTestId('register-gear-ladder')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('register-active-sentence')).toContainText('remarkable analytical depth');

    await page.getByTestId('gear-tab-0').click();
    await expect(page.getByTestId('register-active-sentence')).toContainText('really good');

    await page.getByTestId('gear-tab-1').click();
    await expect(page.getByTestId('register-active-sentence')).toContainText('compelling technical demos');

    await page.getByTestId('gear-tab-2').click();
    await page.getByRole('button', { name: 'Save to SM-2 Deck' }).click();
    await expect(page.getByRole('button', { name: 'Saved to SM-2 Deck' })).toBeVisible();

    await page.getByTestId('shifter-repeat-btn').click();
    await page.waitForTimeout(400);
    await page.getByTestId('shifter-repeat-btn').click();
    await expect(page.getByTestId('shifter-repeat-verified')).toBeVisible({ timeout: 10000 });

    // 4. Navigate to Drop Anything, verify YouTube URL rejection, then drop text & save extracted SM-2 phrase.
    await page.goto('/app/drop');
    await page.getByTestId('drop-url-input').fill('https://youtube.com/watch?v=dQw4w9WgXcQ');
    await page.getByTestId('drop-ingest-btn').click();
    await expect(page.getByTestId('drop-error-banner')).toBeVisible();

    await page.getByTestId('drop-tab-text').click();
    await page
      .getByTestId('drop-text-input')
      .fill(
        'Quantized weights slash memory bandwidth overhead dramatically, albeit with minor tail variance on rare idioms.',
      );
    await page.getByTestId('drop-ingest-btn').click();

    await expect(page.getByTestId('drop-drill-screen')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('drop-2min-drill-card')).toBeVisible();
    await page.getByTestId('save-drop-phrase-albeit').click();
    await expect(page.getByTestId('save-drop-phrase-albeit')).toBeDisabled();
  });
});
