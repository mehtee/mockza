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

    // Phone SMS OTP auth
    await page.goto(`${irnBase}/app/auth/login`);
    await expect(page.getByTestId('auth-phone-input')).toBeVisible();
    await page.getByTestId('auth-phone-input').fill('+989121234567');
    await page.getByTestId('auth-otp-submit').click();
    await expect(page.getByTestId('auth-otp-input')).toBeVisible();
    await page.getByTestId('auth-otp-input').fill('123456');
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

  test('Web-E2E 8B: Public 0 KB JS SEO Pages, Interactive Score Calculators Island & GEO Markdown/SVG/Sitemap Emitters', async ({
    page,
    request,
  }) => {
    const glbBase = 'http://127.0.0.1:45380';
    const irnBase = 'http://127.0.0.1:45381';

    // 0 KB JS on public landing and exam pillar page (GLB)
    await page.goto(`${glbBase}/`);
    await expect(page.locator('main')).toBeVisible();
    const homeScriptCount = await page.locator('script[src*="/_astro/"]').count();
    expect(homeScriptCount).toBe(0);

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
