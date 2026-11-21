import { expect, test } from '@playwright/test';
import { attachE2eApiHarness } from './support/mock-api-harness';

test.describe('Mockza Desktop Web (GLB) E2E Robot Journeys (Web-E2E 1..7)', () => {
  test('Web-E2E 1: Onboarding -> Adaptive Diagnostic -> Home Bento', async ({ page }) => {
    await attachE2eApiHarness(page, { edition: 'glb' });

    await page.goto('/app/welcome');
    await expect(page.getByTestId('welcome-screen')).toBeVisible();
    await page.getByTestId('welcome-track-ielts_academic').click();
    await page.getByTestId('welcome-continue-btn').click();

    await expect(page.getByTestId('goal-setup-screen')).toBeVisible();
    await page.getByTestId('goal-target-inc').click();
    await page.getByTestId('goal-date-preset-60').click();
    await page.getByTestId('goal-start-diagnostic-btn').click();

    await expect(page.getByTestId('diagnostic-intro-screen')).toBeVisible({ timeout: 15000 });
    const startDiagBtn = page.getByTestId('diag-start-btn');
    await expect(startDiagBtn).toBeEnabled();
    await startDiagBtn.scrollIntoViewIfNeeded();
    await startDiagBtn.click({ force: true });

    await expect(page.getByTestId('diagnostic-session-screen')).toBeVisible({ timeout: 15000 });
    // Answer reading stage 1 block cleanly, then advance/skip remaining stages
    await page.getByTestId('choice-1-Key mechanism in focus').click();
    await page.getByTestId('choice-2-Reliable clinic backup power').click();
    await page.getByTestId('diag-next-block-btn').click();
    for (let i = 0; i < 6; i += 1) {
      if (await page.getByTestId('diagnostic-result-screen').isVisible().catch(() => false)) {
        break;
      }
      const skipBtn = page.getByTestId('diag-skip-stage-btn');
      if (await skipBtn.isVisible().catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(100);
      }
    }

    await expect(page.getByTestId('diagnostic-result-screen')).toBeVisible();
    await page.getByTestId('diag-go-home-link').click();

    await expect(page.getByTestId('home-screen')).toBeVisible();
    await expect(page.getByTestId('home-readiness-hero')).toBeVisible();
  });

  test('Web-E2E 2: Reading Passage Highlight + Note + Save to Vocab -> Submit -> Evidence Jump + Ask AI Why & Listening Study/Exam Lock', async ({
    page,
  }) => {
    await attachE2eApiHarness(page, { edition: 'glb' });

    await page.goto('/app/practice/reading/ielts-acad-reading-seed-01');
    await expect(page.getByTestId('reading-simulator-screen')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('passage-text-body')).toBeVisible({ timeout: 15000 });

    // Simulate mouse text selection inside PassageAnnotatorPane to open popover
    await page.evaluate(() => {
      const passage = document.querySelector('[data-testid="passage-text-body"]');
      if (!passage || !passage.firstChild) return;
      const range = document.createRange();
      const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT);
      const firstText = walker.nextNode();
      if (!firstText || !firstText.textContent) return;
      const start = Math.max(0, firstText.textContent.indexOf('microgrids'));
      range.setStart(firstText, start);
      range.setEnd(firstText, Math.min(firstText.textContent.length, start + 10));
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
    await page.getByTestId('passage-text-body').dispatchEvent('mouseup');

    await expect(page.getByTestId('annotator-selection-popover')).toBeVisible();
    await page.getByTestId('annotator-save-vocab-btn').click();

    // Add note & color highlight on another selection
    await page.evaluate(() => {
      const passage = document.querySelector('[data-testid="passage-text-body"]');
      if (!passage) return;
      const walker = document.createTreeWalker(passage, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node && !(node.textContent ?? '').includes('heatwaves')) {
        node = walker.nextNode();
      }
      if (!node || !node.textContent) return;
      const idx = node.textContent.indexOf('heatwaves');
      const range = document.createRange();
      range.setStart(node, idx);
      range.setEnd(node, idx + 9);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
    await page.getByTestId('passage-text-body').dispatchEvent('mouseup');
    await page.getByTestId('annotator-note-toggle').click();
    await page.getByTestId('annotator-note-input').fill('Key heatwave feeder detail');
    await page.getByTestId('annotator-save-note-btn').click();

    // Answer Q1 (TRUE), advance to Q2 in Focused View, flag Q2 and answer wrong to verify Flagged tab + evidence + AI why
    await page.getByTestId('choice-1-TRUE').click();
    await page.getByTestId('reading-next-btn').click();
    await page.getByTestId('flag-question-2').click();
    await page.getByTestId('text-answer-2').fill('outages');
    await page.getByTestId('reading-submit-btn').click();

    await expect(page.getByTestId('objective-result-screen')).toBeVisible();
    await page.getByRole('tab', { name: /Flagged/i }).click();
    await expect(page.getByTestId('jump-evidence-2')).toBeVisible();
    await page.getByRole('tab', { name: /^All/i }).click();
    await page.getByTestId('jump-evidence-2').click();
    await expect(page.getByTestId('evidence-span-highlight')).toBeVisible();

    await page.getByTestId('ask-ai-why-2').click();
    await expect(page.getByTestId('ai-explanation-2')).toContainText('credited key');

    // Listening Simulator: Exam Mode lock vs Study Mode transcript reveal & 0.75x-1.5x speed cycle
    await page.goto('/app/practice/listening/ielts-listening-seed-01');
    await expect(page.getByTestId('listening-simulator-screen')).toBeVisible();
    await expect(page.getByTestId('audio-exam-locked-badge')).toBeVisible();
    await expect(page.getByTestId('audio-transcript-panel')).toHaveCount(0);

    await page.getByRole('tab', { name: /Study Mode/i }).click();
    await expect(page.getByTestId('audio-seek-slider')).toBeVisible();
    await expect(page.getByTestId('audio-transcript-panel')).toBeVisible();
    await expect(page.getByTestId('audio-speed-btn')).toBeEnabled();
    await page.getByTestId('audio-speed-btn').click();
    await expect(page.getByTestId('audio-speed-btn')).toContainText('1.25x');
    await page.getByTestId('audio-speed-btn').click();
    await expect(page.getByTestId('audio-speed-btn')).toContainText('1.5x');
  });

  test('Web-E2E 3: Writing 500ms Dexie Draft Autosave Across Reload + Exam Spellcheck Lock -> Pending -> Master-Detail Inline Edit + SM-2 Upgrade', async ({
    page,
  }) => {
    await attachE2eApiHarness(page, { edition: 'glb' });

    await page.goto('/app/practice/writing/ielts-writing-seed-01');
    await expect(page.getByTestId('writing-simulator-screen')).toBeVisible();
    await expect(page.getByTestId('essay-spellcheck-locked-badge')).toBeVisible();

    const textarea = page.getByTestId('essay-editor-textarea');
    await expect(textarea).toHaveAttribute('spellcheck', 'false');

    const sampleEssay =
      'Cities must expand electric rail networks because frequent transit reduces emissions and supports reliable commuting for residents across metropolitan neighborhoods.';
    await textarea.fill(sampleEssay);
    // Wait > 600ms for 500ms debounce flush to Dexie
    await page.waitForTimeout(700);
    await page.reload();

    await expect(page.getByTestId('essay-editor-textarea')).toHaveValue(sampleEssay);

    await page.getByTestId('writing-submit-btn').click();
    await expect(page.getByTestId('evaluation-result-screen')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('eval-result-overall-band')).toContainText('7.0');

    await page.getByTestId('inline-edit-span-edit-1').click();
    await expect(page.getByTestId('inline-edit-inspector')).toContainText('Critically, rail');

    await page.getByTestId('add-vocab-sm2-vu-e2e-1').click();
    await page.goto('/app/vocabulary');
    await expect(page.getByTestId('vocab-hub-screen')).toBeVisible();
    await page.getByTestId('vocab-search-input').fill('mitigate');
    await expect(page.getByText('mitigate').first()).toBeVisible();
  });

  test('Web-E2E 4: Full Mock Inter-Section Break + SM-2 Keyboard Review + Progress Compare', async ({
    page,
  }) => {
    await attachE2eApiHarness(page, { edition: 'glb' });

    await page.goto('/app/practice/full-mock');
    await expect(page.getByTestId('full-mock-screen')).toBeVisible();
    await page.getByTestId('start-mock-stage-listening').click();
    await expect(page.getByTestId('listening-simulator-screen')).toBeVisible();
    await page.getByTestId('listening-submit-btn').click();

    await expect(page.getByTestId('full-mock-break-card')).toBeVisible();
    await page.getByTestId('full-mock-skip-break-btn').click();
    await expect(page.getByTestId('reading-simulator-screen')).toBeVisible();

    // Seed an SM-2 card via Reading annotator and review via Space + 3 keyboard shortcuts
    await page.goto('/app/vocabulary/review');
    await expect(page.getByTestId('vocab-review-screen')).toBeVisible();
    const flipBtn = page.getByTestId('vocab-reveal-btn');
    if (await flipBtn.isVisible().catch(() => false)) {
      await page.keyboard.press('Space');
      await expect(page.getByTestId('vocab-card-back')).toBeVisible();
      await page.keyboard.press('3');
    }

    // Create 2 reading attempts (score 0 vs score 9.0) so Compare Attempts shows real delta
    await page.goto('/app/practice/reading/ielts-acad-reading-seed-01');
    await page.getByTestId('reading-submit-btn').click();
    await expect(page.getByTestId('objective-result-screen')).toBeVisible();

    await page.goto('/app/practice/reading/ielts-acad-reading-seed-01');
    await page.getByTestId('choice-1-TRUE').click();
    await page.getByTestId('reading-next-btn').click();
    await page.getByTestId('text-answer-2').fill('blackouts');
    await page.getByTestId('reading-submit-btn').click();
    await expect(page.getByTestId('objective-result-screen')).toBeVisible();

    await page.goto('/app/progress');
    await expect(page.getByTestId('progress-screen')).toBeVisible();
    await expect(page.getByTestId('progress-trend-chart')).toBeVisible();

    await page.getByTestId('progress-compare-cta').click();
    await expect(page.getByTestId('compare-attempts-screen')).toBeVisible();
    await expect(page.getByTestId('compare-delta-value')).toBeVisible();
  });

  test('Web-E2E 5: Offline Airplane Mode with Pre-Cached Reading Pack & Local Draft Persistence', async ({
    page,
    context,
  }) => {
    await attachE2eApiHarness(page, { edition: 'glb' });

    await page.goto('/app/practice');
    await expect(page.getByTestId('practice-catalog-screen')).toBeVisible();
    await page.getByTestId('download-pack-ielts-acad-reading-seed-01').click();
    await expect(page.getByTestId('pack-offline-badge-ielts-acad-reading-seed-01')).toBeVisible();
    await page.getByTestId('download-pack-ielts-writing-seed-01').click();
    await expect(page.getByTestId('pack-offline-badge-ielts-writing-seed-01')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-offline-ready', 'true');

    // Go offline and verify Reading + Writing simulators run via client-side navigation & Dexie/OPFS cache
    await context.setOffline(true);
    await page.getByTestId('launch-pack-ielts-acad-reading-seed-01').click();
    await expect(page.getByTestId('reading-simulator-screen')).toBeVisible();
    await page.getByTestId('choice-1-TRUE').click();
    await page.getByTestId('reading-next-btn').click();
    await page.getByTestId('text-answer-2').fill('blackouts');
    await page.getByTestId('reading-submit-btn').click();
    await expect(page.getByTestId('objective-result-screen')).toBeVisible();
    await expect(page.getByTestId('objective-result-band')).toContainText('9.0');

    await page.getByTestId('nav-practice-link').click();
    await expect(page.getByTestId('practice-catalog-screen')).toBeVisible();
    await page.getByTestId('launch-pack-ielts-writing-seed-01').click();
    await expect(page.getByTestId('writing-simulator-screen')).toBeVisible();
    await page
      .getByTestId('essay-editor-textarea')
      .fill('Offline municipal solar storage sustains clinic operations reliably during severe regional storms.');
    await page.getByTestId('writing-submit-btn').click();
    await expect(page.getByTestId('progress-screen')).toBeVisible({ timeout: 10000 });

    // Reconnect and confirm automatic outbox flush dispatches evaluation POST
    const evalDispatched = page.waitForRequest(
      (req) => req.url().includes('/v1/evaluate/writing') && req.method() === 'POST',
      { timeout: 10000 },
    );
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await evalDispatched;
  });

  test('Web-E2E 6: 409 Desktop Slot Takeover -> Settings Device List -> Paywall 1+1 ToS Consent & Stripe Checkout', async ({
    page,
  }) => {
    const state = await attachE2eApiHarness(page, { edition: 'glb' });
    state.simulateDesktopConflictOnNextLogin = true;

    await page.goto('/app/auth/login');
    await expect(page.getByTestId('auth-screen')).toBeVisible();
    await page.getByTestId('auth-email-input').fill('learner@mockza.test');
    await page.getByTestId('auth-password-input').fill('Password123!');
    await page.getByTestId('auth-email-submit').click();

    // 409 Conflict takeover prompt
    await expect(page.getByTestId('auth-slot-replace-btn')).toBeVisible();
    await page.getByTestId('auth-slot-replace-btn').click();
    await expect(page.getByTestId('home-screen')).toBeVisible();

    // Settings should show Pixel 9 Phone + Desktop Chrome Browser (navigate inside SPA so auth session persists)
    await page.getByRole('link', { name: 'Settings' }).click();
    await expect(page.getByTestId('settings-screen')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Pixel 9 Phone')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Desktop Chrome Browser')).toBeVisible();

    // Paywall 1+1 ToS consent + Stripe checkout sandbox
    await page.getByTestId('settings-open-paywall-link').click();
    await expect(page.getByTestId('paywall-screen')).toBeVisible();
    await page.locator('label').filter({ has: page.getByRole('checkbox') }).click();
    await Promise.all([
      page.waitForURL(/session_id=stripe_e2e_ok/, { timeout: 15000 }),
      page.getByTestId('paywall-checkout-btn').click(),
    ]);
    await expect(page.getByText(/Pro subscription activated/i)).toBeVisible({ timeout: 15000 });
  });

  test('Web-E2E 7: Multi-Exam Scales — TOEFL Zero-Prep Speaking & /120 Concordance + PTE Single-Sentence Validation', async ({
    page,
  }) => {
    await attachE2eApiHarness(page, { edition: 'glb' });

    await page.goto('/app/welcome');
    await page.getByTestId('welcome-track-toefl_ibt').click();
    await page.getByTestId('welcome-continue-btn').click();
    await page.getByTestId('goal-skip-home-btn').click();
    await expect(page.getByTestId('home-toefl-concordance')).toBeVisible();

    await page.goto('/app/practice/speaking/toefl-speaking-pack-01');
    await expect(page.getByTestId('speaking-simulator-screen')).toBeVisible();
    await expect(page.getByTestId('speaking-immediate-stage')).toBeVisible();

    await page.goto('/app/practice/writing/pte-writing-pack-01');
    await expect(page.getByTestId('writing-simulator-screen')).toBeVisible();
    await page.getByTestId('essay-editor-textarea').fill('First sentence here. Second sentence violates rule.');
    await expect(page.getByTestId('essay-sentence-rule')).toContainText('2 detected');

    await page.goto('/app/home');
    await page.getByTestId('home-track-det').click();
    await expect(page.getByTestId('home-toefl-concordance')).toHaveCount(0);
    await expect(page.getByTestId('home-target-score-pill')).toContainText(/1[0-6]0|1[1-5][05]/);
  });
});
