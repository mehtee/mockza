import { expect, test } from '@playwright/test';
import { attachE2eApiHarness } from './support/mock-api-harness';

test.describe('Sanjia IRN Edition + Static SEO & GEO Emitters E2E (Web-E2E 8)', () => {
  test('Web-E2E 8A: Sanjia IRN RTL chrome + <LtrExamBoundary> strict LTR exam isolation + Jalali 1405 + OTP + Zarinpal + Navia Handoff', async ({
    page,
  }) => {
    await attachE2eApiHarness(page, { edition: 'irn' });

    const irnBase = 'http://127.0.0.1:45381';
    await page.goto(`${irnBase}/app/onboarding/goal`);
    await expect(page.getByTestId('goal-setup-screen')).toBeVisible();

    // Document root must be RTL fa
    const rootDir = await page.evaluate(() => document.documentElement.getAttribute('dir'));
    expect(rootDir).toBe('rtl');

    // Jalali calendar inputs present in IRN
    await expect(page.getByTestId('goal-jalali-inputs')).toBeVisible();
    await page.getByTestId('goal-jalali-year').fill('1405');
    await page.getByTestId('goal-jalali-month').fill('08');
    await page.getByTestId('goal-jalali-day').fill('27');
    await expect(page.getByTestId('goal-formatted-date')).toContainText(/1405|۱۴۰۵/);

    // Phone SMS OTP auth (with Persian digits normalization!)
    await page.goto(`${irnBase}/app/auth/login`);
    await expect(page.getByTestId('auth-phone-input')).toBeVisible();
    await page.getByTestId('auth-phone-input').fill('+۹۸۹۱۲۱۲۳۴۵۶۷');
    await page.getByTestId('auth-otp-submit').click();
    await expect(page.getByTestId('auth-otp-input')).toBeVisible();
    await page.getByTestId('auth-otp-input').fill('۱۲۳۴۵۶');
    await page.getByTestId('auth-otp-submit').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    // Exam Passage & Inputs stay strict LTR even inside RTL page
    await page.goto(`${irnBase}/app/practice/reading/ielts-acad-reading-seed-01`);
    await expect(page.getByTestId('reading-simulator-screen')).toBeVisible();
    const passageDirection = await page
      .getByTestId('passage-text-body')
      .evaluate((el) => getComputedStyle(el).direction);
    expect(passageDirection).toBe('ltr');

    // Navia cross-app handoff present in IRN Progress
    await page.goto(`${irnBase}/app/progress`);
    await expect(page.getByTestId('ecosystem-handoff-link')).toHaveAttribute(
      'href',
      /https:\/\/navia\.ir/,
    );

    // Zarinpal checkout & verification in IRN Paywall
    await page.goto(`${irnBase}/app/paywall`);
    await page.locator('label').filter({ has: page.getByRole('checkbox') }).click();
    await Promise.all([
      page.waitForURL(/Status=OK/, { timeout: 15000 }),
      page.getByTestId('paywall-checkout-btn').click(),
    ]);
    await expect(page.getByTestId('paywall-screen')).toBeVisible();
  });

  test('Web-E2E 8B: Landing demos, static exam guides, calculators and GEO endpoints', async ({
    browser,
    page,
    request,
  }) => {
    const glbBase = 'http://127.0.0.1:45380';
    const irnBase = 'http://127.0.0.1:45381';

    // The landing uses one small external controller. Exam guides remain static.
    await page.goto(`${glbBase}/`);
    await expect(page.locator('main')).toBeVisible();
    const homeScriptCount = await page.locator('script[src*="/_astro/"]').count();
    expect(homeScriptCount).toBe(1);
    await expect(page.locator('astro-island')).toHaveCount(0);
    await page.locator('#evaluation-panel-writing [data-demo-revise]').click();
    await expect(page.locator('#evaluation-panel-writing [data-demo-revise]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#evaluation-tab-speaking').click();
    await expect(page.locator('#evaluation-panel-speaking')).toBeVisible();

    await page.locator('#report-tab-reading').click();
    const reading = page.locator('#report-panel-reading');
    await reading.locator('[data-report-toggle="drill"]').click();
    await reading.locator('[data-report-part="answer"] [data-correct-choice] input').check();
    await reading.locator('[data-report-part="evidence"] label:not([data-correct-choice]) input').first().check();
    await reading.locator('button[type="submit"]').click();
    await expect(reading.locator('[data-drill-count="answer"]')).toHaveText('1 / 1');
    await expect(reading.locator('[data-drill-count="evidence"]')).toHaveText('0 / 1');

    await page.locator('#report-tab-listening').click();
    const listening = page.locator('#report-panel-listening');
    await listening.locator('[data-report-toggle="drill"]').click();
    await listening.locator('[data-correct-choice] input').check();
    await listening.locator('button[type="submit"]').click();
    await expect(listening.locator('[data-drill-count="answer"]')).toHaveText('1 / 1');
    await expect(listening.locator('.report-drill-transcript')).toHaveAttribute('open', '');

    const staticContext = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    });
    try {
      const staticPage = await staticContext.newPage();
      await staticPage.goto(`${irnBase}/`);
      await expect(staticPage.locator('html')).toHaveAttribute('lang', 'fa');
      await expect(staticPage.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(staticPage.locator('#report-panel-reading')).toBeVisible();
      await expect(staticPage.locator('#report-panel-listening [data-report-review] audio')).toBeVisible();
      await expect(staticPage.locator('#evaluation-panel-writing')).toBeVisible();
      await expect(staticPage.locator('#evaluation-panel-speaking')).toBeVisible();
    } finally {
      await staticContext.close();
    }

    await page.goto(`${glbBase}/toefl-ibt`);
    await expect(page.locator('main')).toBeVisible();
    const pillarScriptCount = await page.locator('script[src*="/_astro/"]').count();
    expect(pillarScriptCount).toBe(0);

    // Interactive Score Calculators Island works with @mockza/domain logic
    await page.goto(`${glbBase}/calculators/toefl-6-to-120-converter`);
    await expect(page.getByTestId('score-calculators-island')).toBeVisible();
    await page.getByTestId('calc-toefl-band').fill('5.0');
    await expect(page.getByTestId('calc-toefl-result')).toContainText('100');

    // Verify GLB GEO endpoints over real HTTP
    const robots = await request.get(`${glbBase}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('OAI-SearchBot');

    const llms = await request.get(`${glbBase}/llms.txt`);
    expect(llms.status()).toBe(200);
    expect(await llms.text()).toContain('/ielts-academic.md');

    const indexMd = await request.get(`${glbBase}/index.md`);
    expect(indexMd.status()).toBe(200);
    expect(await indexMd.text()).toContain('# Mockza');

    const llmsFull = await request.get(`${glbBase}/llms-full.txt`);
    expect(llmsFull.status()).toBe(200);
    expect(await llmsFull.text()).toContain('TOEFL');

    const toeflMd = await request.get(`${glbBase}/toefl-ibt.md`);
    expect(toeflMd.status()).toBe(200);
    expect(await toeflMd.text()).toContain('# TOEFL iBT');

    const ogSvg = await request.get(`${glbBase}/og/home.svg`);
    expect(ogSvg.status()).toBe(200);
    expect(await ogSvg.text()).toContain('width="1200"');

    const ogPng = await request.get(`${glbBase}/og/home.png`);
    expect(ogPng.status()).toBe(200);
    expect(ogPng.headers()['content-type']).toContain('image/png');
    const pngBytes = await ogPng.body();
    expect(pngBytes.subarray(0, 4).toString('hex')).toBe('89504e47');

    const favicon = await request.get(`${glbBase}/favicon.svg`);
    expect(favicon.status()).toBe(200);
    const manifest = await request.get(`${glbBase}/manifest.webmanifest`);
    expect(manifest.status()).toBe(200);

    // Programmatic calculators, writing samples, speaking topics & 320+ vocab categories
    for (const staticRoute of [
      '/calculators/ielts-band-calculator',
      '/calculators/pte-to-ielts-concordance',
      '/calculators/det-subscore-estimator',
      '/writing-samples/ielts-academic/urban-light-rail-subsidies',
      '/speaking-topics/toefl-ibt/zero-prep-campus-interview',
      '/vocabulary/ielts-academic/environment',
    ]) {
      const res = await request.get(`${glbBase}${staticRoute}`);
      expect(res.status(), `route ${staticRoute}`).toBe(200);
      const html = await res.text();
      expect(html).toContain('BreadcrumbList');
    }

    const sitemap = await request.get(`${glbBase}/sitemap-index.xml`);
    expect(sitemap.status()).toBe(200);

    // IRN GEO isolation check: ZERO Stripe / mockza leakage on Sanjia host
    const irnRobots = await request.get(`${irnBase}/robots.txt`);
    expect(irnRobots.status()).toBe(200);
    const irnLlms = await request.get(`${irnBase}/llms.txt`);
    const irnLlmsText = await irnLlms.text();
    expect(irnLlmsText).toContain('sanjia.ir');
    expect(irnLlmsText.toLowerCase()).not.toContain('stripe');
  });
});
