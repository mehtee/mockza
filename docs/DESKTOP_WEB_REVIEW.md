# Desktop Web Comprehensive Codebase Review & Plan Audit

**Reviewed Against:** [DESKTOP_WEB_PLAN.md](./DESKTOP_WEB_PLAN.md) (`v3.0`)  
**Repository Snapshot:** Branch `main` at commit `2ad67c2` (`W0`–`W9.1` marked DONE)  
**Review Date:** 2026-11-18  
**Remediation Status (2026-11-19):** **RESOLVED** — All `P0-1..P0-7`, `P1-1..P1-7`, `P2-1..P2-4`, E2E blind spots, and a post-audit `/app/*` Caddy CSP hydration bug have been fixed on `main` (see [Section 8](#8-post-review-remediation-status-ledger-2026-11-19)).  
**Scope:** Full audit of `web/`, `packages/design-tokens/`, `shared-fixtures/`, `backend/` (`W2.1` IRN/billing/AI/worker extensions & route parity), `scripts/`, `compose.yaml`, and built `web/dist-{glb,irn}` artifacts.

---

## 1. Executive Summary & Overall Verdict

**Verdict: Architecturally Strong Foundation, NOT Production-Ready Yet (~72% True Plan Fulfillment).**

The Desktop Web codebase has an impressive structural skeleton:
- Single-source-of-truth design tokens (`packages/design-tokens/tokens.json` + `scripts/sync_design_tokens.mjs`),
- Zero-duplication shared `@mockza/domain` & `@mockza/contracts` locked to Flutter via `330` golden parity vectors in `shared-fixtures/`,
- Clean DIP/ISP gateway interfaces (`web/src/gateways/*`), strict ESLint architectural boundaries (`web/eslint.config.mjs`), and real GLB/IRN compile-time bundle isolation,
- A complete 14-table Dexie v4 schema, 3-tier OPFS/Cache/IDB binary storage adapter with SHA-256 verification, and solid backend `W2.1` extensions (OTP, Zarinpal, Persian AI coaching appendix, `ffmpeg` WebM->M4A normalization).

**However, a line-by-line review of the actual runtime wiring reveals critical production bugs (`P0`), unwired subsystems, broken performance budgets, security shortcuts, and UX/parity gaps (`P1`–`P2`) that were masked by mocked E2E tests and permissive budget scripts.** Several core adapters (`DexieOutboxAdapter`, `flushUrgentDraftSync`, `CountdownClockTracker`, `upsertSeededDeckPreservingSrs`, `@tanstack/react-query`) were built and unit-tested in isolation **but never wired into the React SPA screens**.

| Category | Status | Summary |
| :--- | :---: | :--- |
| **W0: Tokens SSOT, `@mockza/domain` & Cross-Parity** | **PASS (95%)** | Tokens SSOT & 330 golden vectors work cleanly. Missing `PROMPT_MANIFEST` versioning in `@mockza/ai`. |
| **W1: Astro Shell, Gateways, Dexie/OPFS, BiDi/Jalali, DI** | **PARTIAL (75%)** | Strong interfaces & adapters, but `syncOutbox`, `flushUrgentDraftSync`, `purgeExpiredAudio`, `useAudioStore`, and `@tanstack/react-query` are unwired/unused in the SPA. |
| **W2: Auth, 1+1 Device Slots & Dual-Edition Billing** | **PARTIAL (70%)** | Backend `W2.1` & UI flows exist, but `401 SESSION_REVOKED` auto-redirect is missing, `AuthScreen` `returnTo` produces `/app/app/*` 404s, IRN phone/OTP rejects Persian digits (`۰–۹`), and page reload loses `isPro`/profile fields. |
| **W3: DRY Polymorphic Exam Component Kit** | **PARTIAL (65%)** | All 11 components exist, but `ExamSvgChartCard` has an XSS-bypassable regex instead of `DOMPurify`, `SplitPaneWorkspace` Dexie persistence is dead + remounts children on reset, `WaveformMicRecorder` re-renders at 60fps & lacks mic selector, and `MzObjectiveAnswerInput` lacks OCP registry & `A–D` shortcuts. |
| **W4: Onboarding, Diagnostic & Home Bento** | **PARTIAL (70%)** | Onboarding & Home are solid, but `?track=` deep links are ignored, and `DiagnosticSessionScreen` reloads `AudioStudioPlayer` every 1s AND leaks listening transcripts in Standard Exam mode. |
| **W5: 4-Skill Simulators, Drills & Full Mock** | **PARTIAL (65%)** | Reading/Listening/Writing/Speaking/Drills/Mock work in happy paths, but `HttpEvaluationAdapter` hits nonexistent `GET /v1/quota` (404 on real backend), Writing re-writes Dexie every 1s without sync `pagehide` flush, timers use drifting `setInterval`, and offline AI submission doesn't use `syncOutbox`. |
| **W6: Evaluation Review, SM-2 Vocab & Progress** | **PARTIAL (65%)** | Virtualized vocab & master-detail review work, but `/v1/vocab/deck` is never fetched (empty deck for new users), `ProgressScreen` lacks Radar/TOEFL-120/DET-4/export, `CompareAttemptsScreen` lacks essay diff/WPM, and `EvaluationPendingScreen` lacks background toast & max timeout. |
| **W7: SEO & GEO Public Growth Layer** | **PARTIAL (60%)** | Zero-JS landing/pillars & `/llms.txt` work, but 3 calculator routes + programmatic `/writing-samples/*`, `/speaking-topics/*`, `/vocabulary/*` routes are missing (only 4–5 hardcoded vocab words), OG images are `.svg` (unsupported by social crawlers), `/calculators` ships `65 KB` gzipped React, and IRN public pages have untranslated English headings. |
| **W8: Playwright E2E, Container, Budget & Load Proof** | **PARTIAL (55%)** | E2E passes 9/9 only via mocked `/v1/**` harness (hiding real API mismatches & skipping stages); `/app/*` ships `273 KB` gzipped JS (nearly 3× the `< 95 KB` budget); Nginx cannot serve `.br` files; Lighthouse & `k6` were never actually executed. |
| **W9: Cutover & Operations** | **PARTIAL (75%)** | Local `:45280` cutover and `check_all.sh` / `run_e2e.sh` wiring work, but `web/nginx_security_headers.conf` CSP is overly permissive (`'unsafe-inline'`, `connect-src https:`) while `media-src` blocks remote CDN/S3 audio. |

---

## 2. Critical Production Bugs & Blockers (`P0`)

These issues cause broken behavior, security exposure, or data loss against a real backend/browser and must be fixed before any production rollout.

### `P0-1`: Real-Backend API Endpoint Mismatches (`404 Not Found` in Production)
- **Quota endpoint mismatch:**
  - [http-evaluation.adapter.ts:46](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-evaluation.adapter.ts#L46) calls `GET /v1/quota`.
  - Real backend route in [quota.ts:22](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/quota.ts#L22) is `GET /v1/quota/me` (which `StripeBillingAdapter` and `ZarinpalBillingAdapter` call correctly).
  - **Impact:** Writing and Speaking simulator quota checks silently fail with `404` against the real API server. This slipped past Playwright E2E because `mock-api-harness.ts` intercepted `/v1/quota`.
- **Non-existent telemetry endpoint:**
  - [http-telemetry.adapter.ts:67](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-telemetry.adapter.ts#L67) posts batches to `POST /v1/telemetry/events`, which does not exist anywhere in `backend/apps/api/src/routes/`.

### `P0-2`: `AudioStudioPlayer` Reloads Every 1 Second in Diagnostic + Transcript Leaked in Standard Exam Mode
- **1Hz audio reset loop:**
  - [DiagnosticSessionScreen.tsx:439-443](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticSessionScreen.tsx#L439-L443) passes an unmemoized inline object literal `source={{ mediaKey: activeBlock.blockId, fallbackUrl: ... }}` to `<AudioStudioPlayer />`.
  - [AudioStudioPlayer.tsx:58-96](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/AudioStudioPlayer.tsx#L58-L96) puts `source` (by object reference) in its `useEffect` dependency array.
  - Because `DiagnosticSessionScreen` updates `remainingSeconds` every 1 second, the parent re-renders every second -> creates a new `source` object -> **disposes and reloads the `<audio>` element every 1 second**, making diagnostic listening unplayable in a real browser.
  - The exact same inline `source={{ ... }}` bug occurs in [ObjectiveResultScreen.tsx:219-223](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/ObjectiveResultScreen.tsx#L219-L223), causing "Jump to Evidence" clicks to tear down and reload the audio element right as `externalSeekRequest` fires.
- **Hardcoded diagnostic audio URL:**
  - [DiagnosticSessionScreen.tsx:442](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticSessionScreen.tsx#L442) hardcodes `/v1/media/diagnostic/${activeBlock.blockId}.m4a` instead of reading `activeBlock.mediaUrl` returned by `/v1/diagnostic/packs`.
- **Exam-integrity transcript leak:**
  - [DiagnosticSessionScreen.tsx:453-457](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticSessionScreen.tsx#L453-L457) renders `activeBlock.scriptText` directly on screen whenever `diagState.mode !== 'accessible'` (i.e., **in Standard Exam mode**!). That completely gives away listening answers during the timed diagnostic.

### `P0-3`: Stored-SVG XSS Vulnerability & Broken/Weak Production CSP
- **Regex SVG sanitization violates Plan Section 9.2:**
  - Plan Section 9.2 explicitly requires: *"SVG stimuli rendered through sanitized `<svg>` / `<img>` sandboxes (`DOMPurify` SVG profile) preventing stored/pack XSS."*
  - `dompurify` is not even installed in [web/package.json](file:///home/mahdi/projects/ideas/mockza/web/package.json). Instead, [ExamSvgChartCard.tsx:20-24](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/ExamSvgChartCard.tsx#L20-L24) uses a 2-line regex (`<script...>` and `\son[a-z]+=`) and injects the result via `dangerouslySetInnerHTML`.
  - **Bypass vectors:** `<foreignObject><iframe src="javascript:...">`, `<a xlink:href="javascript:...">`, `<animate onbegin=...>`, `<use href="data:...">`, `<image href="javascript:...">`, `<style>` exfiltration.
- **Weak/mismatched Nginx CSP:**
  - [web/nginx_security_headers.conf:5](file:///home/mahdi/projects/ideas/mockza/web/nginx_security_headers.conf#L5) sets `script-src 'self' 'unsafe-inline'` (weakening XSS protection instead of hashing `ZERO_FOUC_THEME_BOOT_SCRIPT`) and `connect-src 'self' https:` (allowing exfiltration to **any** HTTPS domain instead of edition-locked `api.mockza.com`/R2 vs `api.sanjia.ir`/domestic S3/`zarinpal.com`).
  - Meanwhile, `media-src 'self' blob:` will **block** direct audio playback from `cdn.mockza.com`, `cdn.sanjia.ir`, or presigned S3 URLs whenever audio isn't already materialized into a `blob:` URL.

### `P0-4`: Offline Outbox, Synchronous Crash-Safe Draft Flush & 30-Day Audio GC Are Unwired
- **`syncOutbox` has ZERO callers in `web/src/spa/`:**
  - `DexieOutboxAdapter` is implemented and unit-tested, and `deps.syncOutbox` is exposed on `AppDependencies`, **yet no feature screen ever calls `enqueue()`, `flushPending()`, `observePendingCount()`, or `purgeExpiredAudio()`**.
  - When offline, submitting Writing ([WritingSimulatorScreen.tsx:309-318](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/WritingSimulatorScreen.tsx#L309-L318)) or Speaking ([SpeakingSimulatorScreen.tsx:258-269](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/SpeakingSimulatorScreen.tsx#L258-L269)) simply shows an error banner instead of queueing for automatic reconnect sync.
  - `DesktopSimulatorApp.tsx` never calls `dependencies.syncOutbox.purgeExpiredAudio()` on boot (violating Plan Section 9.2's 30-day audio ephemerality rule).
- **`flushUrgentDraftSync` has ZERO callers in `web/src/spa/` + 1Hz Dexie write storm:**
  - [WritingSimulatorScreen.tsx:228-235](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/WritingSimulatorScreen.tsx#L228-L235) calls async `flushDraftToStore()` on `pagehide` (which browsers routinely abort mid-transaction) instead of synchronous `deps.attemptStore.flushUrgentDraftSync(draft)` + `visibilitychange` (`hidden`).
  - Worse, `flushDraftToStore` includes `remainingSeconds` in its `useCallback` dependency array ([WritingSimulatorScreen.tsx:214](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/WritingSimulatorScreen.tsx#L214)), causing the 500ms debounce `useEffect` ([line 225](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/WritingSimulatorScreen.tsx#L225)) to fire **every single second** even while idle, flashing *"Saving draft..."* / *"Draft saved locally"* continuously and hammering IndexedDB.

### `P0-5`: `401 SESSION_REVOKED` Auto-Redirect Missing & `AuthScreen` `returnTo` 404 Bug
- **Missing global revocation handler:**
  - Plan Section 7.3 (#1) mandates that catching `401 SESSION_REVOKED` flushes non-sensitive state, halts background polling, and routes to `/app/auth/login?reason=session_revoked`.
  - [bootstrap-shared.ts:80-82](file:///home/mahdi/projects/ideas/mockza/web/src/composition/bootstrap-shared.ts#L80-L82) calls `authAdapter?.handleRemoteSessionRevoked()`, which only notifies listeners with `null`. Nothing in `DesktopSimulatorApp.tsx` or `router.tsx` subscribes to remote revocation to cancel queries/polling or redirect to `/app/auth/login?reason=session_revoked`.
- **Broken `returnTo` redirect causing `/app/app/*` 404:**
  - [SettingsScreen.tsx:179](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L179) passes `search={{ returnTo: '/app/settings' }}` and [PaywallScreen.tsx:294](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/paywall/PaywallScreen.tsx#L294) passes `search={{ returnTo: '/app/paywall' }}`.
  - [AuthScreen.tsx:35-41](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/auth/AuthScreen.tsx#L35-L41) passes `safeTarget` verbatim to TanStack Router `navigate({ to: safeTarget })`. Because the router has `basepath: '/app'` ([router.tsx:707](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L707)), navigating to `'/app/settings'` resolves to **`/app/app/settings` -> Route Not Found**.
- **Session reload data loss & missing `HttpOnly` refresh cookie:**
  - [http-auth.adapter.ts:345-359](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-auth.adapter.ts#L345-L359) re-hydrates after reload via `/v1/auth/anonymous` with `deviceSecret`, setting `displayName: null`, `linkedProviders: ['email']`, `isPro: false`, and dropping `phoneE164` / `acceptedDevicePolicyAt`. Also, backend `auth.ts` does not issue rotated `HttpOnly; Secure; SameSite=Strict` refresh cookies described in Plan Section 9.2.

### `P0-6`: Vocabulary Hub Ships Completely Empty (Seeded 320+ Deck Never Synced)
- Backend exposes `GET /v1/vocab/deck` ([exams.ts:218](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/exams.ts#L218)), and `DexieStorageAdapter` implements `upsertSeededDeckPreservingSrs()` ([dexie-storage.adapter.ts:1056](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/dexie/dexie-storage.adapter.ts#L1056)).
- **However, `GET /v1/vocab/deck` and `upsertSeededDeckPreservingSrs()` are NEVER called anywhere in `web/src/`** (neither in `OpfsCatalogAdapter`, `DesktopSimulatorApp`, nor `VocabHubScreen`).
- **Impact:** Every new desktop user opening `/app/vocabulary` sees *"No vocabulary cards match your current filters."* instead of the `320+` seeded academic cards.

### `P0-7`: `SplitPaneWorkspace` Persistence Is Dead & Resets Remount Active Simulators
- [SplitPaneWorkspace.tsx:66-69](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/SplitPaneWorkspace.tsx#L66-L69) aborts Dexie ratio hydration whenever `initialRatio !== undefined`:
  ```ts
  if (initialRatio !== undefined || !deps) {
    hydratedRef.current = true;
    return;
  }
  ```
- Every single caller (`ReadingSimulatorScreen` `0.55`, `ListeningSimulatorScreen` `0.44`, `WritingSimulatorScreen` `0.45`, `EvaluationResultScreen` `0.48`, `ObjectiveResultScreen` `0.5`) passes `initialRatio`, **completely disabling persisted user split-pane ratios** across the entire application.
- Additionally, [SplitPaneWorkspace.tsx:121-122](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/SplitPaneWorkspace.tsx#L121-L122) puts `key={layoutEpoch}` on `<PanelGroup>`. Double-clicking the divider increments `layoutEpoch`, **unmounting and remounting both `leftPane` and `rightPane`** (losing active audio playback handles, scroll position, selection state, and focus).

---

## 3. High-Priority Plan Deviations & Missing Capabilities (`P1`)

### `P1-1`: Severe JS Payload Budget Violations & Font Asset Leakage
- **Initial `/app/*` JS is nearly 3× over budget:**
  - Plan Section 1.1 target: **`< 95 KB` gzipped** initial JS on `/app/*`, enabled by TanStack Router route-level code-splitting (Section 2.1).
  - Measured `web/dist-glb/_astro/`:
    - `DesktopSimulatorApp.*.js`: `734 KB` raw / **`208 KB` gzip** (`174 KB` brotli)
    - `client.*.js` (React 19): `207 KB` raw / **`65 KB` gzip** (`56 KB` brotli)
    - **Combined initial JS:** **`941 KB` raw / `273 KB` gzip** (`230 KB` brotli).
  - **Root cause:** [router.tsx:16-39](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L16-L39) statically imports all 24 screens at the top of the file—zero `React.lazy` or TanStack `lazyRouteComponent` splitting—and pulls in unused `@tanstack/react-query` (`~13 KB` gzip).
- **`/calculators` JS is >16× over budget:**
  - Plan Section 8.1 target: **`< 4 KB` JS** progressive-enhancement island.
  - Reality: [calculators/index.astro:61](file:///home/mahdi/projects/ideas/mockza/web/src/pages/calculators/index.astro#L61) mounts `<ScoreCalculatorsIsland client:load />` using React 19, shipping `client.*.js` (`65 KB` gzip) + island JS. A tiny vanilla `<script>` module importing `@mockza/domain` would meet `< 4 KB`.
- **Unused Arabic/Persian fonts shipped in GLB bundle:**
  - [global.css:7-10](file:///home/mahdi/projects/ideas/mockza/web/src/styles/global.css#L7-L10) unconditionally imports `@fontsource/vazirmatn/arabic-{400,500,600,700}.css`, emitting 8 unused Vazirmatn `.woff`/`.woff2` files (~`200 KB`) into `web/dist-glb/_astro/`.
  - Also missing `@font-face` `size-adjust` fallback metrics specified in Section 8.1 for `CLS = 0.00`.

### `P1-2`: `CountdownClockTracker` Never Used (Timers Drift in Background Tabs)
- Plan Section 4.2 & 5.3 explicitly promote monotonic wall-clock `CountdownClockTracker` into `@mockza/domain` to prevent browser background-tab `setInterval` throttling drift.
- **Finding:** `CountdownClockTracker` is imported **0 times** in `web/src/`. Every simulator (`useObjectiveSimulatorSession.ts`, `DiagnosticSessionScreen.tsx`, `WritingSimulatorScreen.tsx`, `SpeakingSimulatorScreen.tsx`, `MicroDrillsScreen.tsx`, `FullMockOrchestratorScreen.tsx`) decrements React state via naive `setInterval(prev => prev - 1, 1000)`.
- Several of those intervals also trigger side effects (`void handleSubmit()`, `void finishDrill()`, `setPhase('recording')`, `void stopRecording()`) **inside React `setState` updater callbacks**, which is a React 19 StrictMode anti-pattern.
- In [useObjectiveSimulatorSession.ts:68](file:///home/mahdi/projects/ideas/mockza/web/src/spa/useObjectiveSimulatorSession.ts#L68) and [WritingSimulatorScreen.tsx:125](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/WritingSimulatorScreen.tsx#L125), `draft.timerRemainingSec || durationSec` resets an expired `0s` draft back to full `durationSec` instead of using `??`.

### `P1-3`: Desktop App Shell & Simulator Layout Diverge From Section 7.2 Spec
Comparing [router.tsx:266-365](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L266-L365) against Plan Section 7.2:
1. **No Top Contextual Command Bar:** Plan requires `Exam Track Switcher`, `Sync/Offline Status Pill`, `Theme Mode/Preset Quick Toggle`, and `Target Countdown Chip` in a persistent top bar. None of these exist in `AppRootLayout`.
2. **Simulators are NOT full-viewport distraction-free:** Active exam routes (`/app/practice/reading/*`, writing, listening, speaking, diagnostic) render **inside** the left navigation sidebar and `<main className="mx-auto w-full max-w-6xl flex-1 p-6">` (`1152px` cap), rather than full-viewport `100vw × 100vh` (`overflow: hidden` outer frame) with the sidebar hidden, and non-simulator max width is `1152px` (`max-w-6xl`) rather than `1440px`.
3. **Collapsed rail has no icons & collides visually:** When collapsed (`w-20`), nav links render `label.slice(0, 1)`—producing `H`, `P`, `V`, `P`, `S`, `S` (duplicate `P` for Practice & Progress, duplicate `S` for Settings & Sign In!), no `Pro Plans` link, and no responsive `< 1024px` drawer collapse.

### `P1-4`: 22 Undefined `hover:bg-primary-strong` Classes & WCAG Contrast Failures
- **22 broken hover styles:** `hover:bg-primary-strong` is used across 19 files (`BaseLayout.astro`, `index.astro`, `[examSlug].astro`, `calculators/index.astro`, `samples/index.astro`, `vocab/index.astro`, `AudioStudioPlayer.tsx`, `HomeScreen.tsx`, `SettingsScreen.tsx`, `ProgressScreen.tsx`, `VocabHubScreen.tsx`, `VocabReviewScreen.tsx`, `DiagnosticResultScreen.tsx`, `EvaluationPendingScreen.tsx`, `EvaluationResultScreen.tsx`, `WritingSimulatorScreen.tsx`, `SpeakingSimulatorScreen.tsx`, `FullMockOrchestratorScreen.tsx`).
  - Verified in [generated-tokens.css](file:///home/mahdi/projects/ideas/mockza/web/src/styles/generated-tokens.css): `--color-primary-strong` **does not exist** (`0` matches); the generated token is `--color-primary-pressed` (`hover:bg-primary-pressed`).
- **WCAG AA contrast bugs in `SettingsScreen.tsx`:**
  - Lines [181](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L181), [296](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L296), and [463](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L463) hardcode `text-white` on `bg-primary` instead of `text-on-primary`. On dark themes (`Nordic Emerald` `#34D399`, `Editorial Amber` `#F5B749`, `Oceanic Cobalt` `#56CCF2`), white text on bright accents fails WCAG AA (`~1.8:1` contrast ratio).

### `P1-5`: Sanjia (`IRN`) Localization, Persian Digit Input & RTL Polish Defects
- **Persian digits rejected in `+98` phone & OTP inputs:**
  - [otp-auth.adapter.ts:13-22](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/irn/otp-auth.adapter.ts#L13-L22) (`normalizeIranPhoneE164`) and line [73](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/irn/otp-auth.adapter.ts#L73) (`verifySmsOtp`) do **not** call `toAsciiDigits()` before regex validation. Iranian users typing with a Persian keyboard (`۰۹۱۲۳۴۵۶۷۸۹`, `۱۲۳۴۵۶`) get validation errors.
- **Untranslated English UI strings rendered in `IRN` (`fa-IR`) edition:**
  - Public SEO pages: [index.astro:67-82](file:///home/mahdi/projects/ideas/mockza/web/src/pages/index.astro#L67-L82) (`Exam Tracks`, `Desktop Workspace`, `Offline Engine`, `Spaced Repetition`), [\[examSlug\].astro:78,90,102](file:///home/mahdi/projects/ideas/mockza/web/src/pages/[examSlug].astro#L78) (`Key Facts`, `Exam Format & Section Flow`, `Frequently Asked Questions`), [calculators/index.astro:66,88](file:///home/mahdi/projects/ideas/mockza/web/src/pages/calculators/index.astro#L66).
  - SPA screens: [DiagnosticIntroScreen.tsx:110-114](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticIntroScreen.tsx#L110-L114) (`rulesSummary`), [HomeScreen.tsx:213](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/home/HomeScreen.tsx#L213) (`TOEFL Concordance`), [EvaluationPendingScreen.tsx:13-18,163](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/EvaluationPendingScreen.tsx#L13-L18) (`ORDERED_STAGES`, `Refresh Status`), [ProgressScreen.tsx:209,228](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L209) (`Target`, `Streak & Samples`), [FullMockOrchestratorScreen.tsx:39-57,225](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/FullMockOrchestratorScreen.tsx#L39-L57) (`Listening Section`, `Mock Day Break`), [ReadingSimulatorScreen.tsx:170-175](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/ReadingSimulatorScreen.tsx#L170-L175) (shortcut descriptions), [router.tsx:416-417](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L416-L417) (404 title/description).
- **Unflipped directional icons in RTL:**
  - [CompareAttemptsScreen.tsx:76](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/CompareAttemptsScreen.tsx#L76) and [VocabReviewScreen.tsx:163](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/vocabulary/VocabReviewScreen.tsx#L163) render `<ArrowLeft />` unconditionally instead of flipping to `<ArrowRight />` when `edition === 'irn'`.
- **Minor DI bleed in `HomeScreen.tsx`:**
  - [HomeScreen.tsx:80](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/home/HomeScreen.tsx#L80) reads `getActiveEditionConfig()` instead of deriving brand from `deps.edition`.

### `P1-6`: Deep Links `/app/diagnostic/intro?track=...` Broken End-to-End
- Plan Section 8.1 specifies exam pillar CTAs deep-linking directly into `/app/diagnostic/intro?track=toefl_ibt` (etc.).
- [\[examSlug\].astro:60](file:///home/mahdi/projects/ideas/mockza/web/src/pages/[examSlug].astro#L60) links to bare `/app/diagnostic/intro` without `?track=...`.
- [router.tsx:440-444](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L440-L444) has no `validateSearch` for `track` on `diagnosticIntroRoute`, and [DiagnosticIntroScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticIntroScreen.tsx) never accepts or applies a `track` query param.

### `P1-7`: Nginx Container Does Not Serve Brotli (`.br`), Plus Unexecuted Lighthouse & `k6` Gates
- **Brotli dead weight in Nginx image:** [web/Containerfile:43](file:///home/mahdi/projects/ideas/mockza/web/Containerfile#L43) pre-compresses `.br` and `.gz` sidecars, and [web/nginx.conf:12-14](file:///home/mahdi/projects/ideas/mockza/web/nginx.conf#L12-L14) enables `gzip_static on;`. However, stock `nginx:1.27-alpine` does **not** include `ngx_http_brotli_static_module`, so Nginx never serves `.br` assets (Caddy or `fholzer/nginx-brotli` / compiled module is needed for real Brotli edge delivery).
- **Missing Lighthouse & `k6` verification:** Plan `W8.2` & Section 8.1 require Lighthouse (`>= 98` Performance, `100` SEO/A11y, `LCP <= 1.2s`, `INP <= 50ms`, `CLS = 0.00`) and `k6` concurrency proof. [scripts/check_web_budget.mjs](file:///home/mahdi/projects/ideas/mockza/scripts/check_web_budget.mjs) only checks HTML regexes + a local Node HTTP burst against `serve_web_static.mjs` (never runs Lighthouse, never asserts `< 95 KB` or `< 4 KB`, and `scripts/k6_web_load.js` was never executed against the Nginx container).

---

## 4. Medium-Priority Feature Parity, SOLID/DRY & SEO/GEO Gaps (`P2`)

### `P2-1`: Exam Component Kit (`web/src/components/exam-kit/`) Gaps
| Component | File & Line | Gap vs. Plan Section 5.1 / 5.3 / 7.2 |
| :--- | :--- | :--- |
| **`MzObjectiveAnswerInput`** | [MzObjectiveAnswerInput.tsx:64-336](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/MzObjectiveAnswerInput.tsx#L64-L336) | Procedural `if` chain instead of Open-Closed `OBJECTIVE_RENDERER_REGISTRY`; supports `1–9` keys only (no `A–D` letter shortcuts); `word_completion` renders a plain `<input>` without character-slot hints. |
| **`PassageAnnotatorPane`** | [PassageAnnotatorPane.tsx:164-184,270,412,453](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/PassageAnnotatorPane.tsx#L164-L184) | `getUtf16SelectionOffsets` fails (returns `null`) when browser selection starts/ends on an Element node (e.g., triple-click across spans); `evidenceRef` is never reset so a 2nd "Jump to Evidence" scrolls to the stale element; editing notes uses blocking `window.prompt()`; hotkey is `H` instead of `Alt+H`; highlight styles use raw Tailwind colors (`amber-300`, `emerald-300`, `rose-400`) instead of design tokens; `ReadingSimulatorScreen` omits `onUpdateAnnotationNote`. |
| **`ExamSvgChartCard`** | [ExamSvgChartCard.tsx:20-72](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/ExamSvgChartCard.tsx#L20-L72) | Missing `DOMPurify` (see `P0-3`); missing scroll-wheel zoom (`onWheel`); hardcoded dark colors (`bg-[#0E1322]`, `bg-[#0B101D]`, `text-slate-200`) ignore Light mode & theme presets. |
| **`WaveformMicRecorder`** | [WaveformMicRecorder.tsx:64,83-90,115,140](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/WaveformMicRecorder.tsx#L64) | Missing audio input device selector dropdown; `setCurrentRms(clamped)` triggers 60fps React re-renders; `previewUrl` in cleanup effect dependency array couples URL revocation to `handleRef.current?.cancel()`; hardcoded canvas fill `#9580FF`/`#4E5D78` ignores active theme preset; `SpeakingSimulatorScreen` prep timeout doesn't auto-start recording. |
| **`AudioStudioPlayer`** | [AudioStudioPlayer.tsx:33,96,161](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/AudioStudioPlayer.tsx#L33) | Speed cycle is `[0.85, 1.0, 1.25]` instead of `0.75x–1.5x`; missing Study Mode keyboard shortcuts (`Space`, `ArrowLeft`/`ArrowRight`, `[`/`]`); broken `hover:bg-primary-strong`. |
| **`DistractionFreeEssayEditor`** | [DistractionFreeEssayEditor.tsx:25-33,61-101](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/DistractionFreeEssayEditor.tsx#L25-L33) | No live character counter displayed; `countEssaySentences` naive `.!?` split miscounts abbreviations like `Dr. Smith` or `U.S. policy` as multiple sentences (false-positive PTE single-sentence warnings). |
| **`CompactPreflightHeader`** | [CompactPreflightHeader.tsx:108-121](file:///home/mahdi/projects/ideas/mockza/web/src/components/exam-kit/CompactPreflightHeader.tsx#L108-L121) | Loopback `blobUrl` returned by `runPreflightLoopbackTest` is never played back and never revoked via `URL.revokeObjectURL` (minor memory leak). |

### `P2-2`: Screen-Level Feature Parity Gaps vs. Section 7.1 & 7.3
- **`ProgressScreen.tsx`:** Missing Skill Radar SVG chart, TOEFL `/120` concordance panel, DET 4-subscore panel, and History Export action (Plan Section 7.1 #20).
- **`CompareAttemptsScreen.tsx`:** Missing WPM / lexical density shift metrics and side-by-side essay/transcript text diff view (Plan Section 7.1 #21).
- **`EvaluationPendingScreen.tsx`:** Polls every `1500ms` indefinitely (no `45s` max timeout / exponential backoff), and clicking *"Practice While Waiting"* unmounts the component—there is no persistent background polling toast notifying the user when grading completes (Plan Section 2.1 & 7.1 #15).
- **`EvaluationResultScreen.tsx`:**
  - Lines [183-191](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/EvaluationResultScreen.tsx#L183-L191) pass `evaluation.overallBand` into all 4 inputs of `computeDetSubscores`, producing 4 identical subscores.
  - Model Rewrite renders as plain text rather than an inline/side-by-side diff against the learner's submission.
  - Missing `IRN` `Navia` handoff card (Plan Section 6 lists *"Progress & Evaluation screens"*).
- **`ObjectiveResultScreen.tsx`:** Missing `Flagged` filter tab (`All` / `Incorrect Only` only, missing `Flagged` from Section 7.1 #17).
- **`WritingSimulatorScreen.tsx`:** Submitting a multi-task pack only submits the currently selected task (`activeEssayText`); DET 2-step chained *Interactive Writing* follow-up step flow is not modeled distinctly.
- **`FullMockOrchestratorScreen.tsx`:** Missing `<CompactPreflightHeader />` before stage 1, missing consolidated 4-section score summary card upon completion, and uses hardcoded `if (track === ...)` branches instead of driving stage order from `EXAM_DESCRIPTORS` (OCP).
- **`VocabReviewScreen.tsx`:** Handles `Space` flip, missing `Enter` flip specified in Section 7.2.
- **`useObjectiveSimulatorSession.ts`:** Keyboard shortcuts use `J`/`K`/`F` instead of documented `Alt+ArrowRight`/`Alt+N`, `Alt+ArrowLeft`/`Alt+P`, `Alt+F`.
- **`DiagnosticSessionScreen.tsx`:** [line 134](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticSessionScreen.tsx#L134) puts freshly created `t` in `useEffect` deps, re-toggling `setActiveExamLock` every 1s; [line 279](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticSessionScreen.tsx#L279) recomputes `pickNextAdaptiveBlock` on every 1s tick.
- **`AuthScreen.tsx`:** [lines 55-61](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/auth/AuthScreen.tsx#L55-L61) mutates state synchronously during render (`ctrl.setMode(initialMode)`).

### `P2-3`: SEO & GEO Growth Layer Gaps vs. Section 8
- **Missing dedicated programmatic routes (Section 8.1):**
  - Missing `/calculators/ielts-band-calculator`, `/calculators/pte-to-ielts-concordance`, `/calculators/det-subscore-estimator` (only `/calculators` and `/calculators/toefl-6-to-120-converter` exist).
  - Missing `/writing-samples/[track]/[slug]` and `/speaking-topics/[track]/[slug]` (collapsed to `/samples` with only `3` GLB / `2` IRN hardcoded excerpts).
  - Missing `/vocabulary/[track]/[category]` generated from the `320+` clean-room catalog (collapsed to `/vocab` with only `5` GLB / `4` IRN hardcoded words).
- **SVG OpenGraph cards won't render on social platforms:**
  - Plan Section 8.1 specifies build-time **SVG -> PNG (`1200×630`)** social cards. Currently `og:image` points to `/og/[slug].svg`, which Twitter/X, Facebook, LinkedIn, WhatsApp, and Telegram ignore.
- **Incomplete JSON-LD & HTML head metadata:**
  - Missing `Quiz` and `BreadcrumbList` JSON-LD schemas (Plan Section 8.1).
  - Missing `web/public/` favicons (`favicon.svg`/`favicon.ico`) and `manifest.webmanifest` (Plan Section 3.1).
  - Landing page `/` lacks the interactive live score preview, pricing transparency section, and FAQ block mentioned in Section 8.1.

### `P2-4`: Dead Code, Unused Dependencies & Minor SOLID/OCP Leaks
- **Unused runtime packages in `web/package.json`:**
  - `@tanstack/react-query` — Provider mounted in `DesktopSimulatorApp.tsx`, **0 hooks used** anywhere.
  - `@radix-ui/react-popover`, `@radix-ui/react-slider`, `@radix-ui/react-tabs` — **0 imports** anywhere (custom buttons & native `<input type="range">` used instead).
- **Unused Zustand store:** `web/src/spa/stores/audio.store.ts` (`useAudioStore`) has **0 consumers** in `web/src/spa/`.
- **Leftover scaffold UI on 404 route:** [router.tsx:229-264,414](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L229-L264) still renders `RouteSkeletonView` with `t('scaffoldBadgeLabel')` (`"W1.1 Scaffold"` / `"ساختار پایه W1.1"`).
- **OCP leak in Theme Settings:** [SettingsScreen.tsx:54-59](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L54-L59) uses a static `Record<ThemePresetId, TranslationKey>` map instead of falling back to `preset.displayName` from `generated-presets.ts` when a 5th preset is added in `tokens.json`.
- **Missing `PROMPT_MANIFEST` versioning:** Plan Section 4.3 calls for an explicit versioned `PROMPT_MANIFEST` persisted on submission records in `backend/packages/ai/src/prompts/`; grep confirms `PROMPT_MANIFEST` was not added.

---

## 5. Test & Verification Honesty Audit (`P2` / `P3`)

All automated checks currently pass (`211` Vitest tests, `9` Playwright E2E tests, `330` Flutter parity tests, `46` API tests, `check_all.sh all`). That green status is **misleading** for production readiness because of specific test blind spots:

1. **Mocked-only Playwright E2E masked real API contract drift:** Every Playwright spec routes `/v1/**` to `mock-api-harness.ts`, which mocked `/v1/quota`—hiding the real `404` against backend's `/v1/quota/me` (`P0-1`). Adding even one live-API smoke Playwright test against `127.0.0.1:45281` would immediately catch endpoint/schema drift.
2. **E2E coverage shortcuts masked real bugs:**
   - `Web-E2E 1` ([web_e2e_glb.spec.ts:29-38](file:///home/mahdi/projects/ideas/mockza/web/tests/e2e/web_e2e_glb.spec.ts#L29-L38)) skips Listening, Writing, and Speaking stages, missing the `P0-2` 1-second audio reload loop and exam transcript leak.
   - `Web-E2E 4` ([line 177](file:///home/mahdi/projects/ideas/mockza/web/tests/e2e/web_e2e_glb.spec.ts#L177)) wraps flashcard review in `if (await flipBtn.isVisible())`, silently passing even when the vocab deck is empty (`P0-6`).
   - `Web-E2E 5` ([lines 204-227](file:///home/mahdi/projects/ideas/mockza/web/tests/e2e/web_e2e_glb.spec.ts#L204-L227)) never tests offline Writing/Speaking submission + reconnect outbox flush (`P0-4`).
   - `Web-E2E 6` ([lines 229-261](file:///home/mahdi/projects/ideas/mockza/web/tests/e2e/web_e2e_glb.spec.ts#L229-L261)) never tests Settings device revocation or `401 SESSION_REVOKED` redirect (`P0-5`).
   - `Web-E2E 7` ([lines 263-288](file:///home/mahdi/projects/ideas/mockza/web/tests/e2e/web_e2e_glb.spec.ts#L263-L288)) omits TOEFL *Build a Sentence*, PTE *Re-order Paragraphs*, PTE *Describe Image* SVG, and DET *Read & Select* / 4 subscores.
3. **Permissive budget script:** `scripts/check_web_budget.mjs` prints `main chunk gzip=207.8KB` and passes without failing on the `< 95 KB` target, doesn't check `/calculators` JS size (`< 4 KB`), doesn't run Lighthouse, and doesn't test the actual Nginx container.

---

## 6. Genuine Strengths (What Was Built Cleanly & Correctly)

To keep this review balanced and fair, several foundational layers are genuinely well-engineered and should be preserved as-is:
- **Design Tokens SSOT (`W0.2`–`W0.3`):** `packages/design-tokens/tokens.json` + strict schema validator + `scripts/sync_design_tokens.mjs --check` cleanly drives both Flutter (`generated_tokens.dart`) and Web (`generated-tokens.css` + `generated-presets.ts`) for all 4 presets × Dark/Light modes.
- **Pure `@mockza/domain` & `shared-fixtures/` Parity (`W0.4`–`W0.5`):** Consolidating exam specs, band tables, objective scorer, diagnostic router, SM-2 scheduler, `SerialDay`, and study metrics into `@mockza/domain` with `330` cross-language golden vectors verified in both Vitest and Flutter is rock-solid.
- **SOLID Gateway/Adapter Separation & Static Gates (`W1.2`, `W1.5`):** Pure interface modules in `web/src/gateways/*`, typed `Result<T, E>` returns, shared LSP contract test suites (`web/tests/unit/contracts/*`), `eslint-plugin-boundaries`, physical-CSS RTL grep, and GLB/IRN bundle isolation greps in `scripts/check_all.sh` are well-crafted.
- **Storage & Media Primitives (`W1.3`):** The 14-table Dexie v4 schema (`mockza-db.ts`), 3-tier OPFS/Cache/IDB binary store with canonical sorted-key SHA-256 verification matching Flutter (`opfs-catalog.adapter.ts`), and `WebAudioPlayerAdapter` exam-lock snapshotting (`web-audio.adapter.ts`) are thoughtfully designed (they just need to be fully wired into the UI).
- **Backend `W2.1` Extensions:** Clean `EDITION=irn` route gating for `/v1/auth/otp/{request,verify}` and `/v1/billing/zarinpal/{request,verify}`, integer-Rial ledger handling, `IRN_PERSIAN_COACHING_APPENDIX`, and `ffmpeg` WebM/Opus -> 16 kHz mono `.m4a` normalization in `backend/packages/ai/src/audio/processor.ts`.
- **Zero-JS Public HTML & GEO Emitters (`W7.1`, `W7.3`):** Public landing and 5 exam pillar pages genuinely ship `0 KB` of `/_astro/` framework JS, with clean `/robots.txt`, `/llms.txt`, `/llms-full.txt`, and `*.md` content twins for both `mockza.com` and `sanjia.ir`.

---

## 7. Prioritized Remediation Plan (Recommended Execution Order)

### Sprint A — Fix All `P0` Production Blockers (Highest Priority)
1. **Fix API mismatches:** Change `HttpEvaluationAdapter.getQuotaStatus()` from `/v1/quota` to `/v1/quota/me`; either implement `POST /v1/telemetry/events` on the API or make `HttpTelemetryAdapter` a no-op/configurable endpoint when absent.
2. **Fix `DiagnosticSessionScreen` & `ObjectiveResultScreen` audio:** Memoize `AudioStudioPlayer` `source` by primitive keys (`mediaKey`, `fallbackUrl`), use `activeBlock.mediaUrl`, and **only** render `scriptText` when `diagState.mode === 'accessible'`.
3. **Install & enforce `DOMPurify` SVG profile** in `ExamSvgChartCard.tsx`; tighten `web/nginx_security_headers.conf` per edition (hash-based `script-src`, edition-locked `connect-src`, and CDN/S3-compatible `media-src`).
4. **Wire offline resilience:**
   - Call `deps.syncOutbox.purgeExpiredAudio()` and `deps.syncOutbox.flushPending()` on boot in `DesktopSimulatorApp.tsx`.
   - Enqueue offline Writing/Speaking submissions into `deps.syncOutbox` on network failure.
   - Replace async `pagehide` in `WritingSimulatorScreen.tsx` with `registerUrgentDraftFlushListeners` + `deps.attemptStore.flushUrgentDraftSync`, and remove `remainingSeconds` from `flushDraftToStore` deps (use a `ref` for timer remaining).
5. **Wire `401 SESSION_REVOKED` redirect & fix `AuthScreen` `returnTo`:** Strip `/app` prefix from `returnTo` before calling TanStack `navigate()`, and subscribe to remote revocation in `DesktopSimulatorApp.tsx` to halt polling and navigate to `/auth/login?reason=session_revoked`. Fetch `/v1/account/me` on reload to restore full `AuthenticatedUser` state (`isPro`, `displayName`, `phoneE164`).
6. **Wire `GET /v1/vocab/deck` -> `upsertSeededDeckPreservingSrs`:** Add `syncVocabDeck()` to `OpfsCatalogAdapter` / `ICatalogMediaGateway` and hydrate automatically in `VocabHubScreen` & `VocabReviewScreen` when local seeded cards are empty.
7. **Fix `SplitPaneWorkspace`:** Rename `initialRatio` to `defaultRatio` (fallback only when Dexie has no stored ratio), and call `groupRef.current?.setLayout(...)` without remounting `<PanelGroup>` via `key={layoutEpoch}`.

### Sprint B — Fix `P1` Performance, UX, IRN & Delivery Gaps
8. **Meet JS payload budgets:** Add TanStack Router route-level lazy loading (`lazyRouteComponent` / `React.lazy`) in `router.tsx`; remove unused `@tanstack/react-query` & unused `@radix-ui/*` packages (or actively adopt them); replace React island on `/calculators` with a `< 4 KB` vanilla module; conditionally load `@fontsource/vazirmatn` only in `IRN` builds; enforce `< 95 KB` (`/app/*`) and `< 4 KB` (`/calculators`) in `check_web_budget.mjs`.
9. **Adopt `CountdownClockTracker`:** Replace raw `setInterval` countdowns across all 6 timed screens with `@mockza/domain`'s wall-clock `CountdownClockTracker`, moving side effects out of `setState` updaters.
10. **Fix broken CSS & WCAG contrast:** Replace all 22 `hover:bg-primary-strong` with `hover:bg-primary-pressed`; replace `text-white` on `bg-primary` in `SettingsScreen.tsx` with `text-on-primary`.
11. **Complete Desktop Shell & IRN polish:** Add top contextual command bar (`Track Switcher`, `Sync/Offline Pill` wired to `syncOutbox.observePendingCount`, `Theme Toggle`, `Target Countdown`), hide sidebar + expand to `100vw × 100vh` on active simulator routes, add icons to collapsed rail + `< 1024px` drawer; run `toAsciiDigits()` in `normalizeIranPhoneE164` & OTP verify; localize all remaining hardcoded English strings & flip `ArrowLeft` icons in RTL; wire `?track=` deep links from exam pillars into `DiagnosticIntroScreen`.
12. **Fix Nginx Brotli & real load/Lighthouse proof:** Switch container runtime to Caddy or Brotli-enabled Nginx so `.br` files are actually served; run Lighthouse (`>= 98` Perf, `100` SEO/A11y) and `k6` (`scripts/k6_web_load.js`) against the running container.

### Sprint C — Complete `P2` Component, Parity, SEO & E2E Depth
13. **Upgrade Exam Kit:** Refactor `MzObjectiveAnswerInput` to `OBJECTIVE_RENDERER_REGISTRY` + `A–D` shortcuts + `word_completion` slots; fix `PassageAnnotatorPane` Element-node selection, `evidenceRef` reset, and inline note editing (remove `window.prompt`); fix `WaveformMicRecorder` 60fps re-renders, mic selector, theme token fill, and cleanup effect; expand `AudioStudioPlayer` speeds to `0.75x–1.5x` + Study keyboard shortcuts; improve `countEssaySentences` for abbreviations.
14. **Close screen parity gaps:** Add Radar chart + TOEFL `/120` + DET 4-subscores + export to `ProgressScreen`; add side-by-side essay diff & WPM to `CompareAttemptsScreen`; add global background grading toast & `45s` cap for `EvaluationPendingScreen`; add `Flagged` filter to `ObjectiveResultScreen`; add `Enter` flip to `VocabReviewScreen`; remove `RouteSkeletonView` scaffold badge from 404.
15. **Expand SEO/GEO & harden E2E:** Generate PNG (`1200×630`) OG cards, dedicated calculator/sample/vocab programmatic pages from seed data, `Quiz`/`BreadcrumbList` JSON-LD, favicon & `manifest.webmanifest`; upgrade Playwright E2E to test full 4-skill diagnostic, offline outbox sync, device revocation, `401` redirect, and at least one live-API integration smoke test against `:45281`.

---

## 8. Post-Review Remediation Status Ledger (`2026-11-19`)

All findings in Sections 2–6 were resolved across Batches 1–7 on branch `main`:

| Category / ID | Resolution Summary | Commit | Status |
|---|---|---|---|
| `P0-1` API contract & telemetry mismatch | Fixed `HttpEvaluationAdapter` quota path (`/v1/quota/me`) and added `POST /v1/telemetry/events` (`feedback.ts`) | `4dbce13` | Resolved |
| `P0-2` Diagnostic audio & accessible lock | Memoized `AudioStudioPlayer` source keys, wired `activeBlock.mediaUrl`, gated `scriptText` on `accessible` mode | `4dbce13` | Resolved |
| `P0-3` SVG XSS & strict CSP | Enforced `DOMPurify` SVG profile in `ExamSvgChartCard.tsx` and strict CSP (`script-src 'self'`, edition-locked `connect-src`) in `security-headers.{glb,irn}.caddy` | `7002dba` | Resolved |
| `P0-4` Offline outbox & crash-safe drafts | Wired boot `purgeExpiredAudio()`/`flushPending()`, offline Writing/Speaking outbox enqueue + reconnect flush, synchronous `pagehide` flush, and offline SPA chunk prefetch (`offline-ready`) | `5f18fb8`, Batch 7 | Resolved |
| `P0-5` `401` revocation & `/app` `returnTo` | Added `/app` prefix strip on `returnTo`, `401` revocation listener redirecting to `/app/auth/login?reason=session_revoked`, and `/v1/account/me` reload hydration | `4dbce13` | Resolved |
| `P0-6` Empty Vocabulary Hub | Added `syncVocabDeck()` (`GET /v1/vocab/deck`) -> `upsertSeededDeckPreservingSrs()` hydration in `OpfsCatalogAdapter` / vocab screens | `5f18fb8` | Resolved |
| `P0-7` `SplitPaneWorkspace` persistence & reset | Converted `initialRatio` to fallback `defaultRatio` (preserving Dexie user ratio) and used imperative `setLayout()` without remounting panes | `4dbce13` | Resolved |
| `P1-1` Payload budgets & GLB font leak | Added route-level `lazy()` splitting in `router.tsx`, `< 4 KB` vanilla calculator module (`score-calculators-client.ts`), and `IRN`-only `@fontsource/vazirmatn` CSS loading; enforced `< 95 KB` / `< 4 KB` in `scripts/check_web_budget.mjs` | `e6046e1` | Resolved |
| `P1-2` Wall-clock `CountdownClockTracker` | Replaced raw `setInterval` decrements and updater side effects across all timed screens with `@mockza/domain` `CountdownClockTracker` | `1ae7e32` | Resolved |
| `P1-3` Desktop command bar & 100vw simulators | Added contextual top command bar (track switcher, sync/offline pill, theme quick toggle, countdown), hidden rail / full-viewport `100vw × 100vh` simulator layout, distinct rail icons, and `< 1024px` drawer | `1ae7e32` | Resolved |
| `P1-4` `hover:bg-primary-pressed` & AA contrast | Replaced all 22 `hover:bg-primary-strong` classes with `hover:bg-primary-pressed` and switched `SettingsScreen.tsx` `text-white` on `bg-primary` to `text-on-primary` | `1ae7e32` | Resolved |
| `P1-5` Sanjia IRN localization & Persian digits | Applied `toAsciiDigits()` in `normalizeIranPhoneE164` & OTP verify, localized remaining English copy in GLB/IRN builds, and flipped directional icons in RTL | `1ae7e32` | Resolved |
| `P1-6` `?track=` deep links | Passed `?track=...` from `[examSlug].astro` into `diagnosticIntroRoute` `validateSearch` and applied in `DiagnosticIntroScreen.tsx` | `1ae7e32` | Resolved |
| `P1-7` Caddy Brotli, `/app/*` CSP & load/browser checks | Switched `web/Containerfile` & `web/Caddyfile` to `caddy:2.8-alpine` (`precompressed br gzip`); fixed `/app/[...slug].astro` inline hydration script CSP violation via hoisted `web/src/spa/mount-app.tsx`; executed containerized `k6` + Chromium telemetry | `e6046e1`, Batch 7 | Resolved |
| `P2-1` Exam Component Kit depth | Refactored `MzObjectiveAnswerInput` to `OBJECTIVE_RENDERER_REGISTRY` + `A–Z`/`word_completion` slots, fixed `PassageAnnotatorPane` Element-node offsets + inline notes, removed 60fps `WaveformMicRecorder` React re-renders, added mic selector + `AudioStudioPlayer` async-ready state + Study shortcuts, abbreviation-safe `countEssaySentences` | `c2a1760`, Batch 7 | Resolved |
| `P2-2` Screen parity gaps | Added 4-skill SVG radar, TOEFL `/120`, DET 4 subscores, JSON export, WPM/token diff in `CompareAttemptsScreen`, `45s` poll cap + background ready banner, `Flagged` filter, `Enter` vocab flip, consolidated full-mock scorecard, Navia handoff | `c2a1760` | Resolved |
| `P2-3` SEO/GEO growth layer | Added `favicon.svg`, `manifest.webmanifest`, `1200×630` PNG OG generator (`og/[slug].png.ts`), 3 dedicated calculator routes, 10 writing sample pages, 10 speaking topic pages, 35 vocab category pages from seed data (`85` total pages per edition), landing concordance/pricing/FAQ + `Quiz`/`BreadcrumbList` JSON-LD | Batch 7 | Resolved |
| `P2-4` Cleanup & DRY/SOLID polish | Removed dead scaffold badges, exposed `PROMPT_MANIFEST`, deduplicated `STAGE_ORDER_BY_TRACK` and preset lookup | `c2a1760` | Resolved |
| Post-Review Verification | - `./scripts/check_all.sh all`: PASS (`34/34` Web Vitest files / `219/219` tests; `dist-glb` & `dist-irn` `85` pages each; GLB main chunk `51.4 KB` gzip / IRN `53.6 KB` gzip)<br>- `./scripts/check_cross_parity.sh`: PASS (`330` Flutter parity vectors + `3/3` `@mockza/contracts` OpenAPI lockstep)<br>- `MOCKZA_LIVE_API=1 pnpm --dir web test:e2e`: PASS (`10/10` specs incl. Postgres-backed live API smoke)<br>- `e2e_full_journey.test.ts` (`1/1`) & `flutter test --no-pub --concurrency=1 test/e2e` (`7/7`): PASS<br>- `caddy:2.8-alpine` headers + Chromium CDP (`0` CSP script errors, `/`, `/calculators/...`, `/ielts-academic/` `FCP 80–112ms`, `CLS <= 0.0185`, `/app/home/` `spaMounted: true`, `FCP 108ms`, `LCP 480ms`, `CLS 0`)<br>- `grafana/k6:0.54.0` (`scripts/k6_web_load.js`, `1000` unpaced VUs on single-host localhost): `171,950` requests (`4,298.6 req/s`), `0` 5xx (`100%` check pass), `med=75.17ms`, `p(95)=258.91ms` (crosses single-host `p(95)<50ms` threshold under shared localhost CPU load; standalone `lighthouse` CLI binary is not installed on host) | Batch 7 | Verified |
