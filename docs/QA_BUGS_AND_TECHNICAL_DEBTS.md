# Mockza (GLB) & Sanjia (IRN) — QA Bugs, Issues & Technical Debts

- **Initial Audit Date**: 2026-11-24
- **Baseline Commit**: `44984a0` (`HEAD -> main`)
- **Remediation & Re-Verification Date**: 2026-11-24
- **Live Environments Verified (After Fixes)**:
  - **Mockza (GLB / English LTR)**: `https://mockza.mehtea.ir` (`127.0.0.1:45280` / `45281`)
  - **Sanjia (IRN / Persian RTL)**: `https://sanjia.mehtea.ir` (`127.0.0.1:45282` / `45283`)
  - **Flutter Apps**: GLB (`Mockza`) & IRN (`Sanjia`) verified via unit, widget, accessibility, parity, and E2E suites
- **Viewports Tested**: Desktop (`1440×900`) and Mobile (`390×844`) in real Chromium (Headless Chrome)
- **Related Persian QA Execution Log**: [`docs/QA_REPORT.md`](./QA_REPORT.md)

---

## Executive Summary & Remediation Status

| ID | Severity | Status | Editions / Platforms | Summary |
|---|---|---|---|---|
| `QA-001` | **High** | **Fixed & Live-Verified** | GLB, IRN (Web) | Landing (`/`) audio players now enable controls cleanly and lazy-load `data-src` on interaction |
| `QA-002` | **High** | **Fixed & Live-Verified** | GLB, IRN (Web, Flutter, API) | Deduplicated auth locks, session persistence across `F5` reload, and clean guest/authenticated state restoration |
| `QA-009` | **High** | **Fixed & Live-Verified** | GLB, IRN (API, Compose) | Added CIDR `TRUSTED_PROXY_IPS` matching in rate-limit middleware + explicit Docker proxy subnet config; verified IP isolation via proxy |
| `QA-004` | **High / Medium** | **Code Fixed (External Secrets Required)** | IRN SMS, GLB OAuth (API, Web, Flutter, Docs) | Added `.env.example` / `compose.yaml` provider flags and graceful unavailability UX notice (`KAVENEGAR_API_KEY` / OAuth client IDs remain deployment secrets) |
| `QA-003` | **Medium** | **Fixed & Live-Verified** | GLB, IRN (Web) | Gated startup API fetches (`personalization.getState`, sync, outbox) behind `ensureAuthenticated(false)` (`0` startup `401`s) |
| `QA-005` | **Medium** | **Fixed & Live-Verified** | GLB, IRN (Web, Flutter) | Eliminated `"Target Score Score"` duplication and localized `Band`/`Score` unit labels in IRN |
| `QA-007` | **Medium** | **Fixed & Live-Verified** | IRN (Domain, Web, Flutter) | Localized diagnostic recommendation/observation codes, skills, and action copy across Web & Flutter |
| `QA-010` | **Medium** | **Fixed & Live-Verified** | GLB, IRN (Web, Flutter) | Shared reactive auth session state hides sidebar `Sign In` / `ورود` once authenticated (persists across reload) |
| `QA-011` | **Medium** | **Fixed & Live-Verified** | GLB, IRN (Web, Flutter) | Micro-Drills filter by active `profileExamId` by default (with optional All-Exams toggle and legacy ID tolerance) |
| `QA-012` | **Medium** | **Fixed & Live-Verified** | IRN (Worker, Web, Flutter) | Replaced remaining English labels, worker stage codes, media errors, numerals, and Admin Trace console with Persian i18n |
| `QA-008` | **Low / Medium** | **Fixed & Live-Verified** | GLB, IRN (Web, Domain, Flutter) | Localized calculators + Persian digits, added interactive PTE↔IELTS converter, fixed double `&`, Persian `M1–M4` stages, and added `/favicon.ico` |
| `QA-006` | **Low** | **Fixed & Live-Verified** | GLB, IRN (Web, Flutter) | Replaced duplicated heading with `"Account"` / `"حساب کاربری"` distinct from segmented tab controls |
| `QA-013` | **Low** | **Fixed & Live-Verified** | GLB, IRN (Web, Flutter) | Exposed live 15-character validation hint and character feedback in Register Shifter instead of dead handler code |
| `QA-014` | **Low** | **Fixed & Live-Verified** | GLB, IRN (API/DB, Web, Flutter) | Populated/verified 32 published packs across all 5 exam tracks (`ielts_academic`, `ielts_general`, `toefl_ibt`, `pte_academic`, `det`), fixed `/vocabulary/$wordId` preload & `drop-drill-screen` fallback `data-testid` |

---

## Automated Gate & Live Verification Summary (2026-11-24)

- **Backend (`bash scripts/check_all.sh --backend-only` + build/test)**:
  - All 10 backend workspace packages built and typechecked cleanly; Biome lint/check passed; all workspace test suites passed (`domain` 413/413, `api` 61/61, `worker` 10/10, `content-pipeline` 5/5).
- **Web (`bash scripts/check_all.sh --web-only`)**:
  - Strict `tsc`, ESLint 9, boundary/LTR checks, 36 Vitest suites (231 tests), dual Astro builds (`GLB` + `IRN`, 85 pages each), bundle isolation checks, and web performance budget check (`check_web_budget.mjs`) all passed.
- **Flutter (`bash scripts/check_all.sh --app-only` + `flutter analyze` + all 41 test files)**:
  - `flutter analyze --no-pub --fatal-infos`: 0 issues.
  - All 41 test files across `core/`, `data/`, `services/`, `theme/`, `features/`, `a11y/` (18/18), and `e2e/` (`sanjia_irn_e2e_test.dart`) passed.
- **Cross-Codebase Parity (`bash scripts/check_all.sh --parity-only`)**:
  - 373/373 Dart parity tests + OpenAPI schema export & contract tests passed.
- **Live HTTPS Chromium Verification (`https://mockza.mehtea.ir` & `https://sanjia.mehtea.ir`)**:
  - Both GLB and IRN passed headless Chromium end-to-end checks across `/` audio controls, `/calculators/pte-to-ielts-concordance`, `/favicon.ico` (`200`), `/app/auth/login` heading & signup persistence across `F5` reload (`0` `401`s, `navAuthAfterReload: 0`, authenticated email retained), `/app/home` & `/app/roadmap` formatting, `/app/practice/drills` exam filtering, `/app/register-shifter` 15-char hint, `/app/admin/trace` IRN localization, and `/app/practice/writing/pte-ac-writ-01` + `/v1/exams/det-writ-01` with `http429Count: 0` and `pageErrors: []`.
  - Verified live proxy IP rate-limit isolation via `127.0.0.1:45283`: 27 auth requests from `X-Forwarded-For: 198.51.100.77` triggered `429`, while an immediate request from `X-Forwarded-For: 198.51.100.88` bypassed the exhausted bucket cleanly.

---

## Part A — Confirmed Bugs & Functional Issues

### `QA-001` — All 3 Landing Page Audio Players Permanently Disabled
- **Severity**: High
- **Editions**: GLB, IRN
- **Route**: `/`
- **Observed Behavior**: All three interactive audio demos on the landing page (Speaking feedback sample, Listening review player, Listening drill player) render with Play, seek scrubber, playback speed, and cue-jump buttons permanently `disabled`. Users cannot play any sample audio on the landing page.
- **Root Cause**:
  - `web/src/landing/markup.mjs` (around line 311) renders audio controls as `disabled` alongside `<audio preload="none">`.
  - `web/src/landing/interactions.js` (lines 197–211) only removes `disabled` inside the `loadedmetadata` event listener, which never fires when `preload="none"`.
  - On the Speaking feedback card (`data-demo-audio data-src="/sample-media/speaking-feedback.mp3"`), `data-src` is never copied to the `<audio>` element's `src` attribute.
- **Recommended Direction**: Wire lazy audio loading on first click (or eager metadata/enablement of the play button) and assign `audio.src = audio.dataset.src` when initializing or triggering playback.

---

### `QA-002` — Guest Auth Race Condition (`401` Lockout) & Session Loss on Full Page Reload
- **Severity**: High
- **Editions**: GLB, IRN
- **Routes**: `/app/welcome` → `/app/onboarding/goal` → `/app/diagnostic/intro`, `/app/settings`, and any route on hard reload (`F5`)
- **Observed Behavior**:
  1. On first visit as a guest, an early `401` (for example from `personalization.getState()`) triggers `onUnauthorized` → `ensureAuthenticated(true)` concurrently with the startup `ensureAuthenticated(false)`. Concurrent `POST /v1/auth/anonymous` calls collide and can lock the browser in persistent `401 Unauthorized` (`"Existing device requires valid deviceSecret or active session token to renew"`), blocking diagnostic start and form submissions with `"Bearer device token required."`.
  2. After successful email/password sign-up or login, in-app SPA navigation keeps the authenticated state, but a full browser reload (`F5` / `page.goto`) resets in-memory session state, causing a burst of `401`s and allowing subsequent anonymous renewals to downgrade the user back to guest state (e.g., `/app/settings` loses the Sign Out button and reverts to `Sign In`).
- **Root Cause**:
  - `web/src/adapters/http/http-auth.adapter.ts` (lines 167, 253–300): `this.currentSession` is stored only in memory (`null` after reload), and `if (!forceRefresh && this.inflightAuth)` bypasses in-flight deduplication whenever `forceRefresh` is `true` (called from `onUnauthorized` in `web/src/composition/bootstrap-shared.ts`, line 95).
  - `ensureAuthenticated()` always calls `performAnonymousAuth()` rather than restoring a persisted authenticated session or refreshing an account session cleanly.
- **Recommended Direction**: Deduplicate concurrent auth/refresh requests regardless of `forceRefresh` (or serialize behind a single refresh lock), persist session metadata/refresh tokens safely across page reloads, and avoid overwriting an authenticated session with an anonymous renewal.

---

### `QA-003` — `401 GET /v1/personalization/state` Request Storm on Guest Startup / Reload
- **Severity**: Medium
- **Editions**: GLB, IRN
- **Routes**: `/app/home`, `/app/diagnostic/intro`, `/app/diagnostic/result`, `/app/roadmap`, and other SPA routes on reload
- **Observed Behavior**: Every cold load or full reload fires `GET /v1/personalization/state` before a bearer token is acquired, generating `401 Unauthorized` console and network errors (10+ failed requests across a multi-reload session; 0 errors during pure SPA navigation without reloads).
- **Root Cause**:
  - `web/src/spa/DesktopSimulatorApp.tsx` (lines 96–112 vs. lines 134–138): The `useEffect` calling `dependencies.personalization.getState()` runs concurrently with (and before completion of) the separate `useEffect` calling `dependencies.auth.ensureAuthenticated(false)`.
- **Recommended Direction**: Gate initial authenticated API fetches (`personalization.getState()`, outbox flush, etc.) behind `await dependencies.auth.ensureAuthenticated(false)`.

---

### `QA-004` — SMS OTP Disabled in Live Sanjia (IRN) & OAuth Disabled in Live GLB
- **Severity**: High / Medium (Environment / Feature Availability)
- **Editions**: IRN (SMS OTP), GLB (Google/Apple OAuth)
- **Route**: `/app/auth/login`
- **Observed Behavior**:
  - In the live IRN stack, `GET /v1/auth/providers` returns `"smsOtp": {"enabled": false, "mode": "disabled"}`. Consequently, `web/src/spa/features/auth/AuthScreen.tsx` (lines 63–64) hides the mobile number / OTP tab completely, leaving Iranian users with email/password only.
  - In the live GLB stack, Google and Apple OAuth providers are likewise `enabled: false`.
- **Root Cause**:
  - `backend/apps/api/src/routes/auth.ts` disables SMS OTP in `irn` edition when `KAVENEGAR_API_KEY` is empty and `ALLOW_DEV_AUTH_PROVIDERS` is false; `compose.yaml` does not configure SMS/OAuth credentials or dev-mode fallback toggles for local/staging QA.
- **Recommended Direction**: Document required provider env vars in deployment manifests and decide whether non-production stacks should expose a safe dev OTP/provider indicator or explicit UI messaging.

---

### `QA-005` — Malformed Target Score Labels (`"Target Score Score"` in GLB; English `Band`/`Score` in IRN)
- **Severity**: Medium
- **Editions**: GLB, IRN
- **Routes**: `/app/onboarding/goal`, `/app/settings`
- **Observed Behavior**:
  1. In GLB, selecting `PTE Academic` or `DET` displays the duplicated label **`Target Score Score`** (template `Target ${unitLabel} Score` interpolated with `unitLabel = "Score"`).
  2. In IRN, `trackSpec.unitLabel` is injected untranslated into Persian copy, rendering mixed-language labels like `نمره هدف (⁦Band⁩)` and `نمره هدف (⁦Score⁩)`.
- **Root Cause**:
  - `web/src/spa/features/onboarding/GoalSetupScreen.tsx` (line 185) and `web/src/spa/features/settings/SettingsScreen.tsx` (line 320) interpolate raw English `trackSpec.unitLabel` directly without deduplication or Persian localization (`باند` / `نمره`).
- **Recommended Direction**: Localize unit labels per edition/locale and avoid appending `"Score"` when the unit label is already `"Score"`.

---

### `QA-006` — Duplicated Title and Active Tab Label on Auth Screen
- **Severity**: Low
- **Editions**: GLB, IRN
- **Route**: `/app/auth/login`
- **Observed Behavior**: When `showSmsOtp` is `false`, both the `<h2>` heading and the adjacent segmented tab control display the exact same text side by side (`Sign In` / `Sign In`, `ورود` / `ورود`, or `ثبت‌نام` / `ثبت‌نام`).
- **Root Cause**:
  - `web/src/spa/features/auth/AuthScreen.tsx` (lines 182–208) renders a dynamic mode heading that mirrors the active email-mode toggle label even when the SMS tab is hidden.
- **Recommended Direction**: Use distinct header copy (e.g., `"Account"` / `"حساب کاربری"`) or remove the redundant heading when the segmented control already serves as the primary mode label.

---

### `QA-007` — Untranslated English Diagnostic Results & Home Recommendations in IRN
- **Severity**: Medium
- **Editions**: IRN
- **Routes**: `/app/diagnostic/result`, `/app/home`
- **Observed Behavior**: In Persian Sanjia, key parts of the Diagnostic Result and Home "Next Step" recommendation card render in raw English:
  - Button label **`Refresh`** (`web/src/spa/features/diagnostic/DiagnosticResultScreen.tsx`, line 126).
  - Skill names (`Reading`, `Listening`, `Writing`, `Speaking`) (`web/src/spa/features/diagnostic/DiagnosticResultScreen.tsx`, lines 27–36).
  - Backend-generated action title, description, and observations (`Practice Reading: explicit_detail`, `Targeted short practice based directly on what appeared in your starting check.`, `Suggested practice: Foundational (A1–A2 focus) — provisional (reduced sampling)`).
- **Root Cause**:
  - `backend/packages/domain/src/diagnostic/routing.ts` (lines 524–548) emits hardcoded English strings instead of localization keys or locale-aware copy, and `DiagnosticResultScreen.tsx` displays those fields and static labels verbatim.
- **Recommended Direction**: Return structured diagnostic reason/recommendation codes (or locale-keyed payloads) from `routing.ts` and translate all skill names, action buttons, and observations in the IRN frontend.

---

### `QA-008` — Localization, Punctuation, Calculator & Asset Inconsistencies
- **Severity**: Low / Medium
- **Editions**: GLB, IRN
- **Routes**: `/calculators/*`, `/robots.txt`, `/app/home`, `/app/roadmap`
- **Observed Behavior**:
  1. **IRN Public Calculators (`/calculators/*`)**: Interactive outputs render English labels and Latin digits in Persian pages (e.g., `تعداد پاسخ صحیح: 39`, `Band 9.0`, `~117 / 120`, `Literacy: 120`).
  2. **`/calculators/pte-to-ielts-concordance`**: Contains only a static concordance table plus repeated IELTS/TOEFL/DET widgets, with no interactive PTE-to-IELTS score converter.
  3. **GLB HomeScreen**: Vocab banner displays double ampersands: `Vocab Wave 1: 15 Technology & AI & Core Words` (joining a topic containing `&` with `& Core Words`).
  4. **IRN HomeScreen & Roadmap**: Stage badges remain English (`M1`, `M2`, `M3`, `M4`) and numeric score/target displays mix Persian and Latin numerals (`4.5 / ۷.۵`, `کسب نمره هدف 7.5`).
  5. **Missing `/favicon.ico`**: Visiting raw text endpoints like `/robots.txt` triggers a browser `404` for `/favicon.ico`.
- **Root Cause**:
  - `web/src/seo/score-calculators-client.ts`, `web/src/seo/ScoreCalculatorsSection.astro`, `web/src/seo/ScoreCalculatorsIsland.tsx`, and `web/src/pages/calculators/pte-to-ielts-concordance.astro`.
  - `backend/packages/domain/src/personalization/roadmap-generator.ts` / `web/src/spa/features/home/HomeScreen.tsx` / `web/src/spa/features/roadmap/RoadmapScreen.tsx`.
  - `web/public/` has `favicon.svg` but no `favicon.ico`.
- **Recommended Direction**: Localize calculator formatters and Persian numerals, add an interactive PTE↔IELTS widget on the concordance page, format topic lists cleanly without double `&`, unify Persian numeral formatting on Home/Roadmap, and provide `/favicon.ico`.

---

### `QA-009` — Global `429 Too Many Requests` Rate-Limit Exhaustion Behind Reverse Proxy
- **Severity**: High
- **Editions**: GLB, IRN
- **Routes**: All API endpoints (`/v1/jobs/*`, `/v1/billing/plans`, `/v1/exams/*`, `/v1/diagnostic/*`, `/v1/auth/anonymous`)
- **Observed Behavior**: Normal multi-page navigation combined with `EvaluationPendingScreen` polling quickly hits `429 Too Many Requests` (`"Too many requests. Please slow down and try again in 52/38/30 seconds."`). When triggered, it breaks exam pack loading, empties Paywall plans (`planCount: 0`, checkout disabled on `/app/paywall`), breaks diagnostics, and blocks guest auth renewals.
- **Root Cause**:
  - `backend/apps/api/src/middleware/rate-limit.ts` (lines 23–48) only reads `X-Forwarded-For` when `remoteIp` is an exact string match in `trustedProxyIps`.
  - `backend/apps/api/src/app.ts` (line 65) and `backend/apps/api/src/routes/auth.ts` (line 157) default `TRUSTED_PROXY_IPS` to `'127.0.0.1,::1'`.
  - `compose.yaml` (lines 14–36) does not pass `TRUSTED_PROXY_IPS` for the reverse proxy (`mockza-web-1` / `sanjia-web-1`) on the Docker bridge network (`172.22.0.x`). Thus every user request falls back to the proxy's bridge IP and shares a single global bucket (`120 req/min` general API; `25 req/min` auth).
- **Recommended Direction**: Support CIDR ranges (or configured Docker bridge subnets) in `rate-limit.ts`, pass `TRUSTED_PROXY_IPS` explicitly in `compose.yaml`, and review polling frequency/backoff on `EvaluationPendingScreen`.

---

### `QA-010` — Persistent `Sign In` / `ورود` Link in Sidebar After Authentication
- **Severity**: Medium
- **Editions**: GLB, IRN
- **Routes**: App shell sidebar across all `/app/*` screens
- **Observed Behavior**: After signing up or signing in (while `/app/settings` confirms the user is authenticated with their email), the bottom of the sidebar continues to display the **`Sign In`** (GLB) / **`ورود`** (IRN) link.
- **Root Cause**:
  - `web/src/spa/router.tsx` (lines 798–825) renders `data-testid="nav-auth-link"` unconditionally without checking `session?.isAuthenticated` (unlike `SettingsScreen.tsx`, lines 160–179).
- **Recommended Direction**: Subscribe the shell/sidebar to auth session state and hide or replace the `Sign In` link with an account indicator/settings shortcut when authenticated.

---

### `QA-011` — Micro-Drills List Ignores Active Exam Track (`profileExamId`)
- **Severity**: Medium
- **Editions**: GLB, IRN
- **Route**: `/app/practice/drills`
- **Observed Behavior**: When a user's active exam profile is `IELTS Academic`, the Micro-Drills screen still displays **`DET Read Select`** as the first drill, mixing drills from unrelated exam tracks with no default filter.
- **Root Cause**:
  - `web/src/spa/features/practice/MicroDrillsScreen.tsx` (lines 332–333) renders the full synced `drills` array directly without filtering or scoping by `profileExamId`.
- **Recommended Direction**: Filter drills by the user's active `profileExamId` by default (with an optional "All exams" filter if cross-exam browsing is desired).

---

### `QA-012` — Untranslated English Copy Across Simulators, Pending Queue, Progress, Coach, Errors & Admin (IRN)
- **Severity**: Medium
- **Editions**: IRN
- **Routes**: `/app/practice/*`, `/app/evaluation/*`, `/app/progress`, `/app/mission/today`, `/app/register-shifter`, `/app/drop`, `/app/vocabulary/$wordId`, `/app/admin/trace`
- **Observed Behavior** (all observed live in Persian Sanjia):
  1. **Full Mock Orchestrator** (`web/src/spa/features/practice/FullMockOrchestratorScreen.tsx`, lines 49–68): Stage names `Listening Section`, `Reading Section`, `Writing Section`, `Speaking Section` and break heading `Mock Day Break` are in English.
  2. **Evaluation Pending Screen** (`web/src/spa/features/results/EvaluationPendingScreen.tsx`, lines 17–22, 157): All 4 stepper labels (`Queued in grading pipeline`, `Normalizing media & transcript`, `Scoring official rubric criteria`, `Report ready`) and `Refresh Status` button are in English.
  3. **Skill Simulators & Media Errors**:
     - Speaking (`web/src/spa/features/practice/SpeakingSimulatorScreen.tsx`, lines 465, 647): `240s` badge and shortcut hint `Switch Speaking part turns`.
     - Microphone permission error (`web/src/adapters/media/web-audio.adapter.ts`, line 131): `Microphone permission denied: Permission denied`.
     - Listening (`web/src/spa/features/practice/ListeningSimulatorScreen.tsx`, line 105): shortcut hint `Select choice`.
     - DET Writing (`web/src/spa/features/practice/WritingSimulatorScreen.tsx`, lines 702–703): banner `DET Interactive Writing — Step ...`.
  4. **Results, Progress & Not-Found Fallbacks**:
     - `web/src/spa/features/results/ObjectiveResultScreen.tsx` (line 201): `Band 0.0`.
     - `web/src/spa/features/progress/ProgressScreen.tsx` (line 320): `Estimated Band`, `Band 7.5`, and Latin `0` in `⁦0⁩ آزمون ثبت‌شده`.
     - Fallback strings: `Evaluation report not found locally.` (`web/src/spa/features/results/EvaluationResultScreen.tsx`, line 140), `Vocabulary card not found.` / `Loading word...` (`web/src/spa/features/vocabulary/VocabWordDetailScreen.tsx`, line 64), `No baseline report found yet.` (`web/src/spa/features/diagnostic/DiagnosticResultScreen.tsx`, line 99).
  5. **Coach, Daily Mission, Register Shifter & Drop Anything**:
     - Worker stage labels in `backend/apps/worker/src/jobs/register-shifter.ts` (line 63) and `backend/apps/worker/src/jobs/drop-ingest.ts` (line 211) are hardcoded in English.
     - Mixed English text inside YouTube rejection error in `web/src/spa/features/drop/DropHubScreen.tsx` (line 329).
     - `Listen 1.0x` button and `whyEn` rationale shown in IRN in `web/src/spa/features/mission/DailyMissionScreen.tsx` (lines 648, 682).
  6. **Admin Trace Console (`/app/admin/trace`)**: `web/src/spa/features/admin/AdminTraceConsoleScreen.tsx` (lines 166–360) is completely untranslated English in IRN.
- **Recommended Direction**: Audit and migrate all hardcoded English strings, worker stage labels (via stage codes mapped in the client), media error codes, and number formatters to shared edition/locale helpers.

---

### `QA-013` — Dead Length-Validation Logic & Silent Disabled Submit in Register Shifter
- **Severity**: Low
- **Editions**: GLB, IRN
- **Route**: `/app/register-shifter`
- **Observed Behavior**: When a user types a short string (e.g., `"hi"`), the submit button stays `disabled` with no visible helper text explaining the 15-character minimum requirement.
- **Root Cause**:
  - `web/src/spa/features/register-shifter/RegisterShifterScreen.tsx` (lines 141–149, 414): The submit button sets `disabled={processing || rawText.trim().length < 15}`, making the error validation branch inside `handleShiftText` (`"Write at least one full casual sentence (15+ characters)."`) unreachable dead code.
- **Recommended Direction**: Display an inline character-counter / minimum-length hint below the textarea (or validate on submit and surface the localized error message).

---

### `QA-014` — Missing Non-IELTS Writing Seed Packs, Broken Vocab Preload Path & Missing Fallback `data-testid`
- **Severity**: Low
- **Editions**: GLB, IRN
- **Routes**: `/app/practice/writing/pte-ac-writ-01`, `/app/practice/writing/det-writ-01`, `/app/drop/drill/$dropId`, `/app/vocabulary/$wordId`
- **Observed Behavior**:
  1. The live catalog contains 18 packs, all `ielts-*`. Navigating directly to `pte-ac-writ-01` or `det-writ-01` returns `404 Exam pack ... was not found`.
  2. `web/src/spa/features/drop/DropDrillScreen.tsx` (lines 88–94) omits `data-testid="drop-drill-screen"` in its not-found (`!drop`) fallback branch.
  3. `web/src/spa/router.tsx` (lines 322, 1298): `preloadRouteForPathname` checks for `/vocabulary/word/` even though the actual registered route is `/vocabulary/$wordId`, so vocabulary detail chunk preloading never executes.
- **Recommended Direction**: Seed/expose non-IELTS practice packs (or document intentional catalog scope), align `preloadRouteForPathname` with `/vocabulary/$wordId`, and preserve consistent `data-testid` attributes on fallback states.

---

## Part B — Architectural, Infrastructure & Operational Technical Debts (Resolution Status)

### `TD-01` — Uncoordinated Client Auth Bootstrap & Memory-Only Session Architecture (**Resolved**)
- **Locations**: `web/src/adapters/http/http-auth.adapter.ts`, `web/src/adapters/http/api-client.ts`, `web/src/composition/bootstrap-shared.ts`, `web/src/spa/DesktopSimulatorApp.tsx`, `web/src/spa/router.tsx`, `app/lib/services/auth_session_service.dart`, `app/lib/features/auth/presentation/auth_notifier.dart`
- **Resolution**:
  - Added reactive auth session pub/sub across Web (`http-auth.adapter.ts` + `router.tsx`) and Flutter (`auth_session_service.dart` + `app_router.dart`).
  - Persisted authenticated session tokens across full browser reloads, serialized concurrent `ensureAuthenticated` / `refreshAccessToken` calls regardless of `forceRefresh`, and gated startup `personalization.getState()` / outbox calls behind `ensureAuthenticated(false)`.

### `TD-02` — Non-Distributed In-Memory Rate Limiter & Exact-IP Proxy Matching (**Resolved for CIDR Proxy Routing; Distributed Store Noted**)
- **Locations**: `backend/apps/api/src/middleware/rate-limit.ts`, `backend/apps/api/src/app.ts`, `backend/apps/api/src/routes/auth.ts`, `compose.yaml`
- **Resolution**:
  - Added full IPv4/IPv6 CIDR matching in `rate-limit.ts` (`parseTrustedProxyList`) and configured Docker bridge / reverse proxy ranges (`TRUSTED_PROXY_IPS`) in `compose.yaml` and `.env.example`.
  - Retained in-process rate-limit buckets (adequate for single-node Docker deployment; horizontal scaling beyond 1 API replica would swap the bucket adapter to Redis).

### `TD-03` — Hardcoded English User-Facing Strings Emitted by Domain & Worker Layers (**Resolved**)
- **Locations**: `backend/packages/domain/src/personalization/roadmap-generator.ts`, `backend/apps/worker/src/jobs/register-shifter.ts`, `backend/apps/worker/src/jobs/drop-ingest.ts`, `web/src/components/bidi/diagnostic-labels.ts`, `web/src/components/bidi/topic-labels.ts`, `web/src/i18n/{en,fa}.ts`, `app/lib/core/localization/`, `app/lib/core/personalization/roadmap_generator.dart`
- **Resolution**:
  - Replaced worker hardcoded prose with structured stage codes mapped cleanly in Web & Flutter i18n dictionaries.
  - Added `diagnostic-labels.ts` and expanded `topic-labels.ts`, `en.ts`, `fa.ts`, and Flutter's shared `EditionCopy` localization layer so GLB and IRN render consistent localized prose across Web and mobile.

### `TD-04` — Exam-Track Coverage & Filtering Gaps Across Practice Surfaces (**Resolved**)
- **Locations**: `web/src/spa/features/practice/MicroDrillsScreen.tsx`, `app/lib/features/micro_drills/`, PostgreSQL `catalog_packs` (`32` published packs across all 5 exam tracks), `web/src/pages/calculators/pte-to-ielts-concordance.astro`, `web/src/seo/ScoreCalculators*`
- **Resolution**:
  - Verified 32 published packs across `ielts_academic`, `ielts_general`, `toefl_ibt`, `pte_academic`, and `det` in Postgres (`/v1/exams/pte-ac-writ-01` and `/v1/exams/det-writ-01` return `200`).
  - Added `profileExamId` filtering in both Web and Flutter Micro-Drills (tolerating unprefixed legacy drills + an All-Exams toggle), fixed PTE/DET target score labels, and added an interactive PTE↔IELTS converter.

### `TD-05` — Edition Auth Provider Config & Graceful UI Degradation (**Resolved in Code; Secrets Environment-Dependent**)
- **Locations**: `backend/apps/api/src/routes/auth.ts`, `web/src/spa/features/auth/AuthScreen.tsx`, `app/lib/features/auth/presentation/auth_screen.dart`, `.env.example`, `compose.yaml`
- **Resolution**:
  - Separated `"Account"` / `"حساب کاربری"` heading from segmented mode tabs (`QA-006`) and surfaced an explicit, helpful unavailability message (`authSmsOtpUnavailableNote`) when SMS/OAuth providers are disabled.
  - Documented `KAVENEGAR_API_KEY`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, and `ALLOW_DEV_AUTH_PROVIDERS` in `.env.example` and `compose.yaml`.

### `TD-06` — Router Preload Drift, Testability Inconsistencies & Dead UI Validation (**Resolved**)
- **Locations**: `web/src/spa/router.tsx`, `web/src/spa/features/drop/DropDrillScreen.tsx`, `web/src/spa/features/register-shifter/RegisterShifterScreen.tsx`, `app/lib/features/practice/presentation/register_shifter_screen.dart`
- **Resolution**:
  - Aligned `preloadRouteForPathname` with `/vocabulary/$wordId`.
  - Added consistent `data-testid="drop-drill-screen"` on `!drop` fallback (while distinguishing loading state with `data-testid="drop-drill-loading"`).
  - Replaced silent Register Shifter button disabling with live 15-character validation guidance in both Web and Flutter.

### `TD-07` — Progressive-Enhancement Fragility on Static Landing Media & Assets (**Resolved**)
- **Locations**: `web/src/landing/markup.mjs`, `web/src/landing/interactions.js`, `web/public/favicon.ico`
- **Resolution**:
  - Enabled landing play buttons immediately, hydrated `audio.src` from `data-src` on first interaction, and added `/favicon.ico` (`200 OK` verified on both domains).

### `TD-08` — Host Memory Pressure During Local Builds & Test Verification (**Mitigated Operationally**)
- **Locations**: `AGENTS.md`, `compose.yaml`
- **Resolution**:
  - All build, test, and verification workflows were executed sequentially with preflight `free -m` checks and strict `NODE_OPTIONS` / `DART_VM_OPTIONS` heap caps, completing cleanly on the 7.7 GiB host alongside running GLB & IRN stacks.

---

## Part C — Verified Working Baseline (For Regression Reference)

The following flows passed live verification on both GLB and IRN at commit `44984a0`:
- **Public & SEO Pages**: `/`, all 5 exam guides (`/[examSlug]`), `/samples` (30/30 links `200 OK`), `/vocab` (45/45 links `200 OK`), `/robots.txt`, `/llms.txt`; interactive landing reading snippet works cleanly.
- **Onboarding & Calendars**: All 5 exam tracks selectable; Gregorian (GLB) and Jalali (IRN, including invalid date `1406/12/31` rejection) date validation works; interest chips work.
- **Diagnostic Flow**: Full 4-skill flow (`Reading → Listening → Writing → Speaking`) completes and generates a report; single-skill retake (`?retakeSkill=reading`) routes directly to Reading on both editions.
- **App Chrome & Persistence**: Sidebar collapse and Dark theme persist across reload; internal 404 screen renders cleanly; Roadmap active step completion works.
- **Practice & Simulators**: 18 catalog packs, search, offline pack download (`cachedCount: 1`), offline Reading completion in IRN, `dir="ltr"` isolation on English Reading passages in IRN, text highlight popover, Listening Exam Lock & Study Mode (23 clickable transcript segments), Writing draft autosave + reload recovery, Speaking 60s prep timer + Skip Prep + fake mic recording + graceful `NotAllowedError` handling.
- **Full Mock & Micro-Drills**: Micro-drill completion to scorecard (`1 / 2`); Full Mock section progression and 5-minute break screen (`05:00`).
- **Results & Smart Coach**: Objective result evidence jump (`jump-evidence`), `Ask AI Why?` `402 Payment Required` Pro gate, Coach Hub, Daily Mission topic switching & submission, Linguistic Graph matrix, Register Shifter 3-tier rewrite (GLB), Drop Anything YouTube URL block + text submission.
- **Vocabulary & SM-2**: Wave 1 (`15 / 320`), word detail (`salient` with Jalali date `۱۴۰۵/۰۹/۰۳` in IRN), SM-2 card flip & rating (`Good` advances to next card).
- **Progress, Paywall & Settings**: Empty states on Progress/Compare, Paywall 3 plans + terms checkbox enabling checkout (when not rate-limited), Settings 1+1 device slot (`1 / 1 Active`), `nordic_emerald` theme, account deletion modal, full Sign Out flow.
- **Responsive Mobile (`390×844`)**: `0px` horizontal overflow (`390 / 390`) verified across landing, Home, Roadmap, Practice, Coach, Register Shifter, Drop, Vocabulary, Progress, Paywall, and Settings in both GLB and IRN.
