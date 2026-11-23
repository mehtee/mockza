# Mockza (GLB) & Sanjia (IRN) — Pixel-Perfect UI/UX Audit & Overhaul Plan

> **Status:** Audit & Planning Specification Only (no source files modified yet)
> **Platforms:** Web SPA + Public Marketing/SEO (`mockza.mehtea.ir` GLB EN/LTR · `sanjia.mehtea.ir` IRN FA/RTL) across Desktop (`1440×900`) and Mobile Web (`390×844` / `360–412px`), keeping design-token parity with Flutter (`packages/design-tokens/tokens.json` & `app/`).
> **Evidence Folder:** [`docs/ui_ux_audit_screenshots/`](./ui_ux_audit_screenshots/) (**41 screenshots** + [`audit_metrics_batch1.json`](./ui_ux_audit_screenshots/audit_metrics_batch1.json) + [`audit_metrics_batch2.json`](./ui_ux_audit_screenshots/audit_metrics_batch2.json)), plus the **5 mobile screenshots** supplied by the user covering `/app/vocabulary`, `/app/vocabulary/review`, and `/app/home`.

---

## 1. Executive Summary & Root-Cause Diagnosis

Although the color palette (`Editorial Green`), underlying domain calculators, and exam-simulation features are strong conceptually, the live UI/UX suffers from **five systemic architectural failures** that make several workflows broken, overwhelming, or frustrating—especially on mobile web and Persian RTL (`Sanjia`):

1. **Broken Dynamic Sizing & Severe Visual Clipping (P0):**
   - `VocabHubScreen` uses `@tanstack/react-virtual` with a hardcoded `estimateSize: () => 92` and fixed `height: ${virtualRow.size}px` without `measureElement`. On mobile (`390px`), card content wraps vertically (`115–140px`), overlapping the adjacent card (`irn_mobile_11_vocab_list.jpg`, `glb_mobile_11_vocab_list.jpg`, and user screenshots). On direct desktop load (`irn_desktop_11_vocab.jpg`), async catalog seeding leaves the deck showing `0 / 0` with an empty-filter message instead of a loading state or starter cards.
2. **Dead-End Blank Simulators & HTTP 429 Request Storms (P0):**
   - `HttpPersonalizationAdapter.getState()` (`web/src/adapters/http/http-personalization.adapter.ts:39-50`) performs no in-flight deduplication or TTL cache, and only falls back to Dexie cache when `res.error.kind === 'network'` (not `429`). Routine multi-page navigation triggers rate limits (`Too many requests...` banner seen in `irn_desktop_08_roadmap.jpg`, `irn_mobile_18_diagnostic_intro.jpg`, `irn_mobile_24_mission.jpg`). Worse, when `!bundle` occurs inside Reading, Listening, Writing, or Speaking simulators (`isActiveSimulator` hides the global topbar/nav), the user is trapped on an empty blank page with only an error banner and **zero Back/Exit/Retry buttons** (`irn_mobile_19_reading_sim.jpg` through `irn_mobile_22_speaking_sim.jpg`, `irn_desktop_21_writing_sim.jpg`).
3. **BiDi (RTL/LTR) & Localization Leaks Throughout Sanjia (`IRN`) (P0–P1):**
   - English definitions, hints, and subtitles lack `<LtrExamBoundary>` / `unicode-bidi: isolate`, flipping leading/trailing punctuation (`".Most noticeable or important"` in `irn_mobile_12_vocab_review_back.jpg`, `".particular habitat"` in `irn_mobile_13_vocab_detail.jpg`, `".Short excerpt..."` in `irn_mobile_18_diagnostic_intro.jpg`).
   - RTL fractions (`10 / 1`), directional arrows (`آزمون‌ها →` pointing backward on RTL in `irn_mobile_07_home_top.jpg` & `irn_mobile_10_coach.jpg`; wrapped `< قبلی` / `بعدی <` in `irn_desktop_19_reading_sim.jpg`), English weekday chips (`M T W Th F Sa Su` & `days studied` in `irn_desktop_07_home.jpg`), untranslated headings (`Estimated Band`, `Target`, `Streak & Samples` in `irn_mobile_14_progress.jpg`), internal `snake_case` slugs (`technology_ai`, `academic_linking`, `academic_core`, `marine_biology`), and infrastructure leaks (`SeaweedFS`, `Kokoro AI`, `af_bella`, `bf_emma`, raw UUIDs, `day/5`) are visible to learners.
4. **Information Architecture Overload & Lack of Visual Hierarchy (P1):**
   - `/app/home` stacks **three competing hero/action blocks** with 9+ buttons above core metrics (`irn_mobile_07_home_top.jpg`, `irn_mobile_07_home_mid.jpg`, `glb_mobile_07_home.jpg`, and user home screenshots). `/app/practice` renders **14+ filter chips** above the fold pushing content down a `5081px` (`6.0x` viewport) scroll (`irn_mobile_09_practice.jpg`). `/app/settings` spans `3169px` (`3.8x` viewport) with developer internals mixed into user preferences (`irn_mobile_16_settings.jpg`). `/app/auth/login` places an explanatory 1+1 slot marketing card above the login form on mobile (`irn_mobile_06_auth_login.jpg`).
5. **Sub-Minimum Tap Targets & Missing Mobile Shell Ergonomics (P1):**
   - Although `packages/design-tokens` already defines `--mz-min-touch-target: 48px` and `--mz-bottom-nav-height: 76px` (`web/src/styles/generated-tokens.css:21-22`), **every audited route** failed the `44px` minimum hit-target check (`smallTapTargetCount` up to `41` on mobile Vocabulary Hub, `18` on desktop Reading Sim, `17` on Settings, `14–16` on Landing/Practice). Desktop renders two stacked header bars (`~110px`), while mobile wraps a cramped 2-row topbar with `32×32px` icon buttons even on Onboarding and has no persistent thumb-zone bottom bar.

---

## 2. Research Synthesis: Adapting "Great UI & Great UX" to High-Stakes AI Exam Prep

High-stakes exam simulators (`IELTS`, `TOEFL 2026`, `PTE Academic`, `DET`) combined with AI daily coaching require a fundamentally different UX architecture from casual gamified apps (like Duolingo) or generic SaaS dashboards:

1. **Two Strict Modes — Never Mix Study Warmth with Exam Noise:**
   - **Mode A: Calm Editorial Study Room & Coach** (`/app/home`, `/app/roadmap`, `/app/coach`, `/app/vocabulary`, `/app/progress`): Low cognitive load, warm paper surfaces, progressive disclosure, one primary "Next Step" CTA per screen (Hick's Law), encouraging feedback, and quick 1–2 tap entry into a session.
   - **Mode B: Zero-Noise Authentic Test Booth** (`/app/practice/reading|listening|writing|speaking`, `/app/diagnostic/session`): Strictly de-gamified, high-contrast neutral exam typography, persistent accessible exit + timer + progress indicator, split-pane desktop fidelity (`SplitPaneWorkspace`), and a dedicated **sticky 2-tab mobile switcher (`Passage ↔ Questions` / `Chart & Prompt ↔ Essay`)** so narrow phone viewports never lose reading scroll position.
2. **Evidence-Linked Explanations Over Score-Only Output:**
   - Learners improve fastest when feedback jumps straight to the exact mistake span (passage highlight, audio timestamp, inline essay diff, or pronunciation phoneme). Review and result screens must prioritize actionable jumps ("Ask AI Why?", "Save to Deck", "Fix in 10-Min Coach") over walls of static criteria paragraphs.
3. **Coarse-Pointer & Mobile-First Ergonomics (`360–412px`):**
   - Minimum `44×44px` interactive hitbox (`48px` for primary/nav controls per `--mz-min-touch-target`), thumb-reachable bottom sticky primary CTAs (`Onboarding`, `Review`, `Paywall`, `Simulators`), single-row horizontal chip scrollers instead of wrapping multi-row pill walls, and hiding desktop keyboard hints (`(Space)`, `1–4`, `J / K`) when `(pointer: coarse)` matches.
4. **Native-Grade Persian RTL + English Exam BiDi Discipline:**
   - All chrome, navigation, metadata labels, durations, scores captions, topic names, and progress metrics must be **100% localized** in idiomatic Persian (`fa`) on Sanjia.
   - All English exam artifacts (passages, questions, headwords, IPA, sample sentences, definitions, email/essay prompts, SVG charts) must be strictly isolated with `dir="ltr"` + `unicode-bidi: isolate` (`<LtrExamBoundary>`) and explicit `text-align: left` inside RTL cards so trailing punctuation (`.`, `?`, `/`) never jumps to the start of a line.
   - All CSS `letter-spacing` (`tracking-wide` / `tracking-wider`) and `text-transform: uppercase` must be disabled or replaced inside `html[dir="rtl"]` / `[lang="fa"]`, because letter-spacing breaks joined Persian glyphs and `uppercase` only emphasizes residual English labels.
   - Directional icons (`ChevronLeft/Right`, `ArrowLeft/Right`) must use **one centralized direction-aware helper** (`lucide-react` chevron flipped by `dir === 'rtl'`, or CSS `rtl:rotate-180` / `scaleX(-1)`) — excluding media play/pause/skip-5s icons which remain universally LTR.

---

## 3. Quantitative Baseline & Screenshot Audit Registry

Measured directly via headless Chromium during this audit ([`audit_metrics_batch1.json`](./ui_ux_audit_screenshots/audit_metrics_batch1.json), [`audit_metrics_batch2.json`](./ui_ux_audit_screenshots/audit_metrics_batch2.json)):

| Screen / Route | Edition & Viewport | Screenshot Ref | Height (Ratio) | Small Taps (`<44px`)* | Critical Visual / UX Issues Observed |
|---|---|---|---:|---:|---|
| Landing `/` | IRN `390×844` | `irn_mobile_01_landing.jpg` | `5141px (6.1×)` | `14` | Wrapped nav row below top CTA; `6.1×` long scroll; hero card edge tight against viewport |
| Landing `/` | GLB `390×844` | `glb_mobile_01_landing.jpg` | `5347px (6.3×)` | `16` | Same wrapped header strip (`20px`-tall links); floating Speaking card clips bottom fold |
| Landing `/` | GLB/IRN `1440×900` | `glb_desktop_01_landing.jpg`, `irn_desktop_01_landing.jpg` | `4233px (4.7×)` | `15–17` | Strong editorial hero overall; footer/header links below `44px` hit height |
| Calculator `/calculators/ielts-band-calculator` | IRN `390×844` | `irn_mobile_02_calculator.jpg` | `1579px (1.9×)` | `9` | `"تعداد صحیح (/۴۰)"` punctuation/paren flip; crowded 4-col header; English `"Academic Reading"` select |
| Exam Pillar `/ielts-academic` | IRN `390×844` | `irn_mobile_03_pillar_ielts.jpg` | `1852px (2.2×)` | `9` | Middot `"۰.۵) · ۲"` visually merges near `۲۰`; emphasizes "Desktop" on mobile; mixed English `Skills` value |
| Onboarding `/app/welcome` (Step 1) | IRN `390×844` | `irn_mobile_04_welcome.jpg` | `1278px (1.5×)` | `2` | App topbar (`IELTS Academic` + Sync + Theme) shown unnecessarily; awkward `(IELTS Academic) آیلتس آکادمیک`; CTA pushed offscreen by preview card |
| Onboarding `/app/welcome` (Step 2) | IRN `390×844` | `irn_mobile_05_goal_setup.jpg` | `1639px (1.9×)` | `15` | `30px` topic chips; primary CTA at bottom of long scroll instead of sticky footer; `"1405 / 08 / 27"` formatting ambiguous |
| Login `/app/auth/login` | IRN `390×844` | `irn_mobile_06_auth_login.jpg` | `1051px (1.2×)` | `5` | Value/slot card renders *above* login form on mobile, pushing SMS/Email inputs below the fold |
| Home `/app/home` | IRN/GLB `390×844` & `1440×900` | `irn_mobile_07_home_top.jpg`, `irn_mobile_07_home_mid.jpg`, `irn_desktop_07_home.jpg`, `glb_mobile_07_home.jpg`, user media | `2647px (3.1×)` | `8–9` | **3 competing hero blocks** + **9 buttons** before core metrics; wrong `→` arrows on RTL; English `M..Su` week & `IELTS ACADEMIC` uppercase; `"Reading 60m..."` raw English |
| Roadmap `/app/roadmap` | IRN `390×844` & `1440×900` | `irn_mobile_08_roadmap.jpg`, `irn_desktop_08_roadmap.jpg` | `1877px (2.2×)` | `2–3` | Raw `"technology ai"` tag inside English pill; mixed `"8m"`/`"01"`/`"نا مشخص ( پایه )"`; 3 stacked equal buttons per step; desktop HTTP 429 banner on navigation |
| Practice Catalog `/app/practice` | IRN `390×844` | `irn_mobile_09_practice.jpg` | `5081px (6.0×)` | `14` | **14+ stacked filter chips** bury pack cards; leaks **`SeaweedFS`** infra name & **`marine_biology`**; English descriptions on IRN |
| Smart Coach `/app/coach` | IRN `390×844` | `irn_mobile_10_coach.jpg` | `1418px (1.7×)` | `8` | `"موضوع: technology_ai"` raw snake_case; bottom `"آزمون‌ها →"` arrow points backward on RTL |
| Vocab Hub `/app/vocabulary` | IRN/GLB `390×844` & `1440×900` | `irn_mobile_11_vocab_top.jpg`, `irn_mobile_11_vocab_list.jpg`, `irn_desktop_11_vocab.jpg`, `glb_mobile_11_vocab_list.jpg`, user media | `1184px (1.4×)` | `38–41` | **Broken virtualizer overlaps adjacent word cards & clips meanings/glossFa**; IPA wraps after `/`; `320` vs `15` confusing math; Desktop rendered **`0 / 0` empty state** |
| Vocab Review `/app/vocabulary/review` | IRN `390×844` | `irn_mobile_12_vocab_review_front.jpg`, `back.jpg`, user media | `844px (1.0×)` | `4–6` | **Flipped `10 / 1` progress**; raw `academic_linking`/`academic_core` pills; **`".Most noticeable or important"` flipped period**; desktop `(Space)` hint shown on mobile |
| Vocab Detail `/app/vocabulary/seed-vocab-001` | IRN `390×844` | `irn_mobile_13_vocab_detail.jpg` | `919px (1.1×)` | `6` | **`".particular habitat"` flipped period**; untranslated `State`, `Repetitions`, `Interval`, `Next Due` + `NEW`; `"0 روز"` spacing overlap |
| Progress `/app/progress` | IRN `390×844` | `irn_mobile_14_progress.jpg` | `1918px (2.3×)` | `3` | Untranslated `Estimated Band`, `Target`, `Streak & Samples`; tiny empty radar diamond; small `71×17` link |
| Graph `/app/progress/graph` | IRN `390×844` | `irn_mobile_15_graph.jpg` | `1381px (1.6×)` | `9` | Giant empty boxes with lone `"0"` metric; `26px` topic chips |
| Settings `/app/settings` | IRN `390×844` | `irn_mobile_16_settings.jpg` | `3169px (3.8×)` | `17` | Exposes raw UUID, `day/5` syntax, `Kokoro AI (af_bella / bf_emma)` internals; English track subtitle; oversized 5-row theme list |
| Paywall `/app/paywall` | IRN/GLB `390×844` | `irn_mobile_17_paywall.jpg`, `glb_mobile_17_paywall.jpg` | `1834px (2.2×)` | `5` | Floating orphaned `Settings`/`تنظیمات` `16px` link; `1×1` sr-only checkbox measurement; dead disabled CTA instead of "Sign In & Subscribe" |
| Diagnostic Intro `/app/diagnostic/intro` | IRN `390×844` | `irn_mobile_18_diagnostic_intro.jpg` | `988px (1.2×)` | `3` | HTTP 429 banner; untranslated English rules & `Reading/Listening Calibration` cards w/ flipped periods; 3-line wrapped segmented pill; wrapped CTA arrow |
| Reading / Listening / Writing / Speaking Simulators | IRN `390×844` & `1440×900` | `irn_mobile_19..22_*.jpg`, `irn_desktop_19`, `irn_desktop_21` | `844–900px` | `1–18` | **Dead-end white screen on HTTP 429 (`!bundle`) with zero Back/Retry button**; desktop Reading repeats pack title twice; footer wraps `< قبلی` onto 2 lines; mobile lacks Passage↔Question tabs |
| Quick Drills `/app/practice/drills` | IRN `390×844` | `irn_mobile_23_drills.jpg` | `844px (1.0×)` | `2` | Cold empty box `"هنوز تمرینی بارگذاری نشده است"` with zero retry/sync button |
| Coach Tools (`mission/today`, `register-shifter`, `drop`) | IRN `390×844` | `irn_mobile_24..26_*.jpg` | `844px (1.0×)` | `2–4` | Mission hit 429 with unlocalized English banner & no retry; `drop` chips wrap unevenly (`4` tabs) |
| Admin Trace `/app/admin/trace` | GLB `1440×900` | `glb_desktop_27_admin_trace.jpg` | `900px (1.0×)` | `3` | Functional but shares double desktop header |

*\*Note: `smallTapTargets` excludes legitimate tiny `sr-only` checkbox inputs once `<label>` wrapper height >= 48px, though `<input>` should use `inset-0 opacity-0` over the custom box for accurate click/accessibility geometry.*

---

## 4. Global Architecture, Design Tokens & Shared Primitives

### 4.1 Design Token & CSS Layer (`packages/design-tokens/tokens.json`, `web/src/styles/global.css`, `web/src/styles/generated-tokens.css`)
- **Keep SSOT Discipline:** Any spacing/radius/target token updates must land in `packages/design-tokens/tokens.json` followed by `pnpm tokens:sync` so `web/src/styles/generated-tokens.css` and Flutter `app/` tokens remain in sync.
- **RTL Typography & BiDi Global Rules (`web/src/styles/global.css:35-108`):**
  1. In `html[dir="rtl"]`: explicitly reset `letter-spacing: 0 !important;` on `.tracking-wide`, `.tracking-wider`, and headings so `Vazirmatn` Arabic/Persian ligatures never split or deform, and disable `.uppercase` capitalization styling where it adds noise to mixed badges.
  2. Fix font parity on `<h1..h3>`: notice `global.css:100-107` styles `[lang="fa"][data-theme="editorial_green"]` ONLY for `.font-editorial, [data-study-app] h1` — extend this rule to all `h2, h3` with `.font-editorial` (`h2.font-editorial` on `HomeScreen.tsx:370, 425`) and set crisp Persian editorial weights (`700` display weight, tight line-height `1.3`).
  3. Add `.bidi-isolate { unicode-bidi: isolate; }` and enforce `.mz-en-inline` / `<LtrExamBoundary>` (which sets `dir="ltr"`) as inline-block/block with `unicode-bidi: isolate; text-align: left;` whenever wrapping English passages, prompts, definitions, sentences, IPA (`white-space: nowrap` on short `/ˈs.../` tokens so the opening `/` never orphans on the previous line!), phone numbers, URLs, and raw dates/counts.
  4. Introduce `.mz-touch-target` utility & bottom safe-area padding (`pb-[calc(var(--mz-bottom-nav-height)+env(safe-area-inset-bottom)+1rem)]` on `<main>` in mobile viewports when bottom nav is visible).

### 4.2 Shared UI Primitives (`web/src/components/ui/` & `web/src/components/speech/`)
- **`MzButton.tsx` (`lines 15-69`):**
  - Keep `size="sm"` for compact *desktop-only* table toolbars (`h-9`), but default interactive CTAs to `min-h-[44px]` (`h-11` = `44px`) on mobile using `min-h-11 sm:min-h-9` (or dedicated `touchSize`), AND add **`whitespace-nowrap shrink-0`** + `<span className="inline-flex items-center gap-1.5 whitespace-nowrap">{children}</span>` so button labels + trailing chevrons **never** split onto 2 lines like `شروع تعیین سطح \n ←` (`irn_mobile_18_diagnostic_intro.jpg`) or `قبلی \n >` (`irn_desktop_19_reading_sim.jpg`)!
- **`MzSegmentedControl.tsx` (`lines 15-65`):**
  - Currently uses `inline-flex rounded-pill`, causing narrow mobile segments (`DiagnosticIntroScreen`, `RegisterShifterScreen`) to squash labels into 3-line circles or clip horizontally.
  - Upgrade props with optional `fullWidth?: boolean` and `scrollableOnMobile?: boolean`: on `<640px`, either stretch cleanly in an equal-column CSS grid (`grid-flow-col auto-cols-fr w-full`) for 2–3 short tabs (`Exam vs Study`), or wrap nicely with `min-h-[40px] px-3 whitespace-nowrap overflow-x-auto no-scrollbar` for longer labels (`Standard / Extended 1.5x / Repeatable Audio`).
- **`MzCheckbox.tsx` (`lines 26-66`):**
  - Replace `className="peer sr-only"` (1×1px box flagged by Playwright tap-target/a11y check) with `className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"` inside the `min-h-[48px]` interactive `<label>`, keeping visual box crisp and real `<input>` bounding box full-sized!
- **`InlineListenButton.tsx` (`lines 77-118`):**
  - Upgrade `sm` height from `h-7` (`28px` — caused `41` small-target alerts on `/app/vocabulary`!) to `min-h-[40px] sm:min-h-[34px] px-3` (with invisible pseudo-hitbox or true `40–44px` comfortable mobile pill) and keep `Listen` + `0.8x` grouped cleanly inside an atomic nowrap flex cluster.
- **Unified Direction Helper (`web/src/edition/bidi/DirectionIcon.tsx` — new tiny helper):**
  - Replace scattered ad-hoc `deps.edition === 'irn' ? ChevronRight : ChevronLeft` / literal `'→'` strings across `HomeScreen`, `CoachHubScreen`, `DiagnosticIntroScreen`, `RegisterShifterScreen`, `Reading/Listening/SpeakingSimulatorScreen`, `VocabReviewScreen`, `VocabWordDetailScreen`, `CompareAttemptsScreen` with a single `<ForwardArrowIcon />` and `<BackArrowIcon />` (using Lucide SVG icons that automatically mirror in `rtl`).

### 4.3 Unified Navigation Shell (`web/src/spa/router.tsx:664-920`)
**Current Problems Observed (`irn_mobile_04..09`, `irn_desktop_07`, `irn_desktop_08`):**
1. Desktop shows **two full-width stacked headers** (`~110px`), with nav links taking row 1 and the Track Switcher + Sync pill + Theme button floating far apart in row 2.
2. Mobile renders a wrapping 2-row topbar with `32×32px` buttons (`topbar-mobile-nav-btn`, `topbar-theme-toggle`), even on Onboarding (`/app/welcome`), Goal Setup, and Auth (`/app/auth/login`).
3. Mobile lacks a persistent thumb-zone **Bottom Navigation Bar**, forcing users to open a hamburger drawer just to switch between Home, Roadmap, Practice, Coach, and Vocabulary.

**Exact Shell Redesign:**
1. **Route Chrome Mode Classification (`chromeMode`):**
   - `focused_flow` (`/welcome`, `/onboarding/*`, `/auth/*`): Hide topbar track switcher, sync badge, and nav drawer completely! Render only a ultra-clean slim `56px` top strip with Brand mark (linked to `/`), subtle `"ورود"` / `"Skip"` context link if appropriate, and Theme Toggle (`44×44px`).
   - `simulator` (`isActiveSimulator` routes): Full-bleed edge-to-edge workspace (`SimulatorWorkspaceShell`).
   - `app_shell` (all core authenticated/guest study hubs): Unified Desktop + Mobile App Chrome.
2. **Desktop (`>= 1024px` `lg`):**
   - **Consolidate the 2-row header into ONE crisp `64px` top bar + slim collapsible left/start Icon+Label Sidebar (`220px` expanded / `68px` collapsed)** OR **single sticky header (`64px`)** with primary 5 hubs (`Home`, `Roadmap`, `Practice`, `Coach`, `Vocabulary`) + compact right/end cluster (`Track Pill`, `Sync Icon+Tooltip` instead of verbose badge text, `Pro Plans`, `Settings`, `Theme`, `Sign In`), keeping total top chrome height `<= 64px` (saving `46px+` above the fold and eliminating lonely empty space in row 2).
   - Recommendation aligned with `AppShell` tests (`sidebarCollapsed` in `router.tsx:724`): Keep `<aside>` as a true **vertical start-edge rail on desktop (`lg:w-60 lg:flex-col lg:border-e`, `lg:w-[72px]` collapsed)** and keep `<header data-testid="top-command-bar">` clean alongside `<main>` (`flex-row` at `lg:`!). *Wait — notice why `router.tsx:710` failed earlier!* Someone changed `<aside>` to `lg:w-full lg:flex-row` while leaving the parent `[data-study-app]` as `flex-col`! Switching desktop (`lg:`) to true **Left/Start Rail + Slim `56px` Top Utility Bar** immediately restores desktop ergonomic hierarchy AND gives Reading/Progress/Vocab clean centered max-width focus!
3. **Mobile (`< 1024px`):**
   - **Single-Row Sticky Header (`56px` tall, `px-3`):** Start: Menu Drawer Button (`44×44px`!) + Compact Brand or Page Title; Middle/End: Compact Track Dropdown (`max-w-[140px] truncate h-10`) + Sync Dot/Icon (`40×40px` popover tooltip, NOT a wide pill forcing row wrap!) + Theme Toggle (`44×44px`). Never wrap onto 2 rows!
   - **Persistent Bottom Navigation Bar (`lg:hidden`, `--mz-bottom-nav-height: 72px` + `env(safe-area-inset-bottom)`):**
     - **4–5 Primary Destinations** matching user habits: `خانه` (`/home`), `نقشه راه` (`/roadmap`), `آزمون‌ها` (`/practice`), `مربی` (`/coach`), `واژگان` (`/vocabulary`), each `>= 48×48px` with icon + 1-line label (`text-[11px]`). Secondary items (`Progress`, `Pro Plans`, `Settings`, `Sign In`) remain inside the Drawer and Profile/Settings shortcut.

### 4.4 Network Resilience, Request Deduplication & Rate-Limit Recovery
**Root Cause of the HTTP 429 Screenshots (`irn_desktop_08`, `irn_mobile_18..22`, `irn_mobile_24`):**
- `HttpPersonalizationAdapter.getState()` (`web/src/adapters/http/http-personalization.adapter.ts:39-50`) and `catalog.listPacks()` / `syncSeededVocabDeck()` fire un-coordinated concurrent `GET`s on every route transition (`Home` -> `Roadmap` -> `Practice` -> `Vocab` -> `Simulator`).
- **Exact Fix Spec:**
  1. **Shared In-Flight + Short-TTL Request Deduplication (`10s` SWR window):** In `HttpPersonalizationAdapter.getState()` (and `HttpCatalogAdapter`), coalesce concurrent calls into a single shared Promise and return cached fresh state within `10s` (invalidating cleanly on any `POST`/`PUT` mutation like `updateProfile`, `advanceRoadmapStep`, `recordBandEvent`).
  2. **Graceful `429` Cache Fallback (`http-personalization.adapter.ts:45`):** Fallback to Dexie `readCachedState()` not only on `res.error.kind === 'network'`, but also on HTTP `429` (`rate_limited`) or `5xx`, emitting a quiet `"Offline / cached snapshot"` status rather than failing route hydration.
  3. **Localized Friendly Rate-Limit Copy (`api-client` / i18n):** Map `rate_limited` errors on `IRN` to Persian (`«تعداد درخواست‌ها زیاد بود؛ چند ثانیه دیگر دوباره تلاش کنید»`) instead of English `"Too many requests. Please slow down..."`.
  4. **Zero-Trap Error Card Component (`SimulatorLoadErrorState`):** Wrap `!bundle` fallback in `ReadingSimulatorScreen`, `ListeningSimulatorScreen`, `WritingSimulatorScreen`, `SpeakingSimulatorScreen`, `DailyMissionScreen`, and `DropDrillScreen` with an explicit card containing: (a) friendly message, (b) **"تلاش مجدد / Retry"** (`>= 44px`), and (c) **"بازگشت به خانه / Back to Study Room"** (`>= 44px`) so a user is **NEVER** stranded in a chrome-less dead end!

---

## 5. Screen-by-Screen Pixel-Perfect Remediation Plan

### A. Public Landing, Pillar Guides & Score Calculators (`/` · `/ielts-academic` · `/calculators/*`)
**Screenshots:** `irn_mobile_01_landing.jpg`, `glb_mobile_01_landing.jpg`, `irn_desktop_01_landing.jpg`, `glb_desktop_01_landing.jpg`, `irn_mobile_02_calculator.jpg`, `irn_mobile_03_pillar_ielts.jpg`
**Files:** `web/src/layouts/BaseLayout.astro:86-125`, `web/src/landing/landing.css:1-522`, `web/src/landing/markup.mjs`, `web/src/pages/[examSlug].astro:84-105`, `web/src/pages/calculators/ielts-band-calculator.astro:45-78`, `web/src/seo/ScoreCalculatorsSection.astro:23-99`, `web/src/seo/public-catalog-irn.ts:24-100`

- **Public Header Nav (`BaseLayout.astro:86-125`):**
  - On `<640px`, stop forcing `order-last w-full` secondary text links (`20px` height) below the header bar. Instead, render a horizontal scrollable sub-strip with `min-h-[44px] items-center` tap targets OR a compact mobile disclosure menu button (`44×44px`), keeping the sticky top header height compact (`<= 60px` vs current `~104px` on mobile).
  - Give all footer & header `<a>` links `min-block-size: 44px; display: inline-flex; align-items: center; padding-inline: 8px;` so mobile touch audit reports `0` small tap targets.
- **Mobile Landing Hero Cards (`landing.css:123-161, 485-507`):**
  - On `@media (max-width: 800px)`, tighten `.hero-evaluation` (`inset-block-end: 58px`) and `.hero-playing` (`inset-block-end: -8px`) spacing so the `Speaking review` card never clips across the bottom viewport fold (`glb_mobile_01_landing.jpg`), and add swipe/accordion collapsing on verbose SEO FAQ sections on `<640px` to reduce `6.1×`–`6.3×` page height toward `<= 4.2×`.
- **Exam Pillar Header Meta (`[examSlug].astro:86`, `irn_mobile_03_pillar_ielts.jpg`):**
  - Split `{guide.scoreScaleLabel} · {guide.durationLabel}` into two bordered pills (`gap-2`) so `۰.۵) · ۲ ساعت` never visually blends into `۲۰ ساعت`.
  - Localize `"شبیه‌ساز دسکتاپ..."` phrasing or clarify `"شبیه‌ساز تحت وب و دسکتاپ (سازگار با موبایل و کامپیوتر)"` when accessed from mobile/universal landing, and translate `keyFacts` values in `public-catalog-irn.ts:36` (`Listening · Reading · Writing · Speaking` -> `لیسنینگ · ریدینگ · رایتینگ · اسپیکینگ` with optional English parentheticals properly isolated).
- **Score Calculator (`ielts-band-calculator.astro:58`, `ScoreCalculatorsSection.astro:40-44`, `irn_mobile_02_calculator.jpg`):**
  - Fix `'تعداد صحیح (/۴۰)'` -> `'پاسخ صحیح (از ۴۰)'` (eliminates reversed `/40` glyph ambiguity), add generous column padding (`px-2` + `overflow-x-auto`), enlarge mobile header columns (`text-[11px]`), localize `<select>` options (`Academic Reading` -> `ریدینگ آکادمیک`, `General Training Reading` -> `ریدینگ جنرال`, `Listening` -> `لیسنینگ`) when `isIrn === true`, and ensure slider handles + numeric output use `<LtrExamBoundary>` cleanly.

---

### B. Onboarding & Auth (`/app/welcome` · `/app/auth/login`)
**Screenshots:** `irn_mobile_04_welcome.jpg`, `irn_mobile_05_goal_setup.jpg`, `irn_mobile_06_auth_login.jpg`
**Files:** `web/src/spa/features/onboarding/WelcomeScreen.tsx:1-157`, `web/src/spa/features/onboarding/GoalSetupScreen.tsx:1-369`, `web/src/spa/features/auth/AuthScreen.tsx:101-350`, `backend/packages/domain/src/exams/exam-descriptor.ts:84-160`

- **Clean Onboarding Chrome (`router.tsx`):**
  - Hide `<header data-testid="top-command-bar">` and sidebar drawer on `/welcome` and `/auth/*` (`focused_flow` layout mode).
  - Add a visible step progress pill (`گام ۱ از ۲: انتخاب آزمون` -> `گام ۲ از ۲: هدف و علاقه`) so users know onboarding takes only 30 seconds.
- **Step 1 — Exam Track Picker (`WelcomeScreen.tsx` & `irn_mobile_04_welcome.jpg`):**
  - Remove mixed BiDi parentheses (`(IELTS Academic) آیلتس آکادمیک`): display primary localized title (`آیلتس آکادمیک`) on line 1, clean `<LtrExamBoundary>` badge (`IELTS Academic`) right-aligned at the end on a neutral chip, and **localized** subtitle (`مقیاس ۰ تا ۹ (گام ۰.۵) · مناسب مهاجرت تحصیلی و کاری`) instead of raw English `EXAM_DESCRIPTORS[trackId].subtitle`.
  - Keep the exam preview card **compact (`2–3` bullet highlights)** or collapsible on `<640px`, and dock the `"ادامه: تنظیم نمره هدف"` (`Continue`) primary button in a **sticky bottom thumb bar** (`border-t bg-canvas/95 backdrop-blur p-3`), eliminating scrolling past `1278px` to find Continue!
- **Step 2 — Goal & Topics Setup (`GoalSetupScreen.tsx` & `irn_mobile_05_goal_setup.jpg`):**
  - Upgrade all topic & preference chips from `30px` to `min-h-[44px] px-3.5 text-xs`.
  - Improve Jalali target date input (`۱۴۰۵/۰۸/۲۷`): wrap input with `dir="ltr"` + helper preset chips (`۱ ماه دیگر`, `۳ ماه دیگر`, `۶ ماه دیگر`, `هنوز تصمیم نگرفته‌ام`), reducing manual Jalali typing friction.
  - Place Primary CTA (`«شروع و ذخیره برنامه»`) + subtle secondary action (`«تعیین سطح بعداً انجام می‌دهم»` / Skip) in a sticky bottom bar on mobile so users never hunt to `1639px` at the bottom.
- **Sign In / OTP (`AuthScreen.tsx:107-199` & `irn_mobile_06_auth_login.jpg`):**
  - Add `order-first lg:order-last` on the interactive Sign-In/OTP panel (or `order-last lg:order-first` on the Value & 1+1 Device Slot card line `110`)! Mobile visitors opening `/app/auth/login` immediately see `"ورود با پیامک / ایمیل"` above the fold (`y = 80px`), with the `1+1 Device Policy` explainer neatly below!
  - Fix `<MzTextField inputDir="ltr">` phone/OTP inputs and bump all small text links (`authOtpChangePhoneAction`) to `min-h-[44px]` inline touch targets.

---

### C. Home Study Room (`/app/home`)
**Screenshots:** `irn_mobile_07_home_top.jpg`, `irn_mobile_07_home_mid.jpg`, `glb_mobile_07_home.jpg`, `irn_desktop_07_home.jpg`, plus user screenshots `media_1795382251165_12c1c3c5.jpg` and `media_1795382252784_1b20d4ca.jpg`
**Files:** `web/src/spa/features/home/HomeScreen.tsx:1-789`, `web/src/spa/features/home/useHomeController.ts:205-342`

**Critical Structural Consolidation:**
1. **Eliminate the 3 Competing "Next Step" Cards (`HomeScreen.tsx:1-514`):**
   - Currently, a user sees: (1) Hero Roadmap Card with M1..M4 + 2 buttons, (2) 2 Pillar Nav Cards (`آزمون‌ها` + `مربی هوشمند`), (3) Duplicate `home-recommended-card` (`پیشنهاد هوشمند گام بعدی` with **4 buttons**), AND (4) `home-daily-mission-card` with **3 buttons**! That is **9 stacked CTAs** in `1400px` of scroll before showing live readiness or study week!
   - **New Crisp 4-Zone Information Architecture:**
     - **Header:** Greeting + active Track chip (tap opens quick switcher instead of duplicating a 5-pill switcher strip at `y = 1400px`, keeping `home-track-*` accessible inside a compact horizontal scroll bar or modal drawer if needed — wait: preserve `home-track-*` testids cleanly inside a slim single-row horizontal scroll strip!).
     - **Zone 1 (Primary Above-the-Fold Hero Card):** Strictly **ONE Hero Next Step Card** with **max 2 actions**:
       - If unassessed (`!latestDiagnostic && !resumableDraft`): Shows **1 Primary CTA** `"شروع گام اول (پایه)"` (or resume draft) + **1 Secondary Link Button** `"آزمون ۱۰ دقیقه‌ای تعیین سطح"`. Keeps `M1–M4` horizontal stepper clean (`44px` step nodes) and **completely removes** the redundant `home-recommended-card` duplicate block (`lines 366-514`)!
       - **2 Quick-Switch Pillar Tiles (`آزمون‌های شبیه‌ساز` & `مربی هوشمند روزانه`):** Compact 2-column grid (`grid-cols-2 gap-3`), localized arrow icon via `<ForwardArrowIcon />` (pointing **left** `←` in RTL, **right** `→` in LTR!), with crisp 1-line subtitle instead of wrapped 4-line paragraph.
     - **Zone 2 (Coach Quick Strip — Compact 3-Icon Action Row):** Today's 10-Min Mission (`۱ تمرین امروز`), `ارتقای اسپیکینگ`, `یادگیری از لینک/عکس` rendered as a neat 3-column mobile/desktop micro-grid (`min-h-[56px]`) — **not** 3 stacked wide outline buttons inside an extra white card!
     - **Zone 3 (Readiness Score + Persian Saturday-First Study Week — Bento `7/5` on desktop):**
       - Localize `trackSpec.displayName` in Persian (`آیلتس آکادمیک`) and remove Tailwind `uppercase` on `{t('homeReadinessHeroTitle')} · {localizedTrackName}` (`HomeScreen.tsx:551`).
       - Wrap TOEFL concordance (`~94 / 120`) and DET subscore keys (`Literacy`, etc.) with `<LtrExamBoundary>` AND localized captions on IRN.
       - **Fix Weekly Calendar (`HomeScreen.tsx:655-676`, `useHomeController.ts:279`):** Keep `calculateStudyWeek()` untouched in `@mockza/domain` (to protect 373-vector cross-codebase parity!), and add a UI formatter `localizeStudyWeek(studyWeek, deps.edition)`: on `irn`, rotate the 7 days to **Saturday-first (`ش · ی · د · س · چ · پ · ج`)** matching Persian calendar week using each day's `daySerial`, and localize summary (`t('homeStudyWeekSummary', { count: studyWeek.completedCount })` -> `«۰ از ۷ روز هفته مطالعه شده»` instead of raw English `0/7 days studied`), removing `<LtrExamBoundary>` from the Persian week grid (`rtl` reads Saturday on right -> Friday on left naturally!).
     - **Zone 4 (Due Vocabulary Preview + 4 Skills):**
       - Upgrade `homePracticeSkillAction` (`practice-skill`) and `homeBrowseVocabAction` links (`HomeScreen.tsx:718, 749`) from bare `16px` text links to `min-h-[44px] inline-flex items-center px-3` touch buttons.

---

### D. Personalized Roadmap (`/app/roadmap`)
**Screenshots:** `irn_mobile_08_roadmap.jpg`, `irn_desktop_08_roadmap.jpg`
**Files:** `web/src/spa/features/roadmap/RoadmapScreen.tsx:1-664`

- **Topic & Time Localization:**
  - Never render raw `step.topicKey` (`"technology ai"` in `irn_mobile_08_roadmap.jpg`). Look up `TOPIC_METADATA[key]?.labelFa / labelEn` with friendly fallback, wrapped cleanly in Persian (`فناوری و هوش مصنوعی`)!
  - Localize duration units: `"8m"` / `"10m"` -> `"۸ دقیقه"` / `"۱۰ دقیقه"`, step numbers `"01".."04"` -> `"۱".."۴"` (Persian digits on `irn`), and fix spacing artifact `"نا مشخص ( پایه )"` -> `"نامشخص (مسیر پایه)"` in `fa.ts`!
- **Card Decluttering & Visual Timeline:**
  - Connect `M1–M4` with a real visual step rail (`completed` checkmark, `active` highlighted ring, `unlocked` starter indicator).
  - Replace 3 stacked full-width buttons on each active step (`شروع تمرین`, `ثبت انجام گام`, `رد کردن گام`) with:
    - **1 Primary Full-Width CTA:** `"شروع تمرین"` (`min-h-[44px]`)
    - **1 Clean Secondary Toolbar Row:** `"ثبت انجام گام"` + overflow/subtle `"رد کردن"` (`min-h-[44px]`), preventing button fatigue on mobile!
  - Resolve the HTTP 429 banner visible in `irn_desktop_08_roadmap.jpg` via global `HttpPersonalizationAdapter.getState()` deduplication (Section 4.4).

---

### E. Practice Catalog, 3-Min Drills & Full Mock (`/app/practice` · `/app/practice/drills` · `/app/practice/full-mock`)
**Screenshots:** `irn_mobile_09_practice.jpg`, `irn_mobile_23_drills.jpg`
**Files:** `web/src/spa/features/practice/PracticeCatalogScreen.tsx:251-524`, `web/src/spa/features/practice/MicroDrillsScreen.tsx:1-530`, `web/src/spa/features/practice/FullMockOrchestratorScreen.tsx:1-418`, `backend/packages/db/src/seed-data/starter-exams.ts:1237`

- **Above-the-Fold Mobile Collapse (`PracticeCatalogScreen.tsx:251-426` & `irn_mobile_09_practice.jpg`):**
  - Replace the **14+ stacked filter pills** (Exam + Skill filters pushing pack cards offscreen) with:
    1. Search bar + **Single Horizontal Scrollable Skill Chip Row** (`همه`, `ریدینگ`, `لیسنینگ`, `رایتینگ`, `اسپیکینگ` — localized, **not** `READING`/`LISTENING`/`FULLMOCK` in English caps!) with `min-h-[40px]`.
    2. Compact Track Dropdown / Toggle + `"فیلترها"` drawer/pill (showing offline cache usage inside the sheet or compact subtitle) instead of occupying 280px of static controls.
  - Collapse mobile scroll height from `5081px (6.0×)` down to `~1800–2400px` (`<= 3×`) with tighter pack cards showing **2 clean metadata badges** (`آیلتس آکادمیک · لیسنینگ`, `۳۰ دقیقه`) and **1 primary button (`شروع آزمون`) + compact offline download icon button (`44×44px`)**.
- **Eliminate Infrastructure & Content Copy Leaks:**
  - Fix **`starter-exams.ts:1237`**: Replace `"synchronized script and SeaweedFS .m4a audio."` with `"paired synchronized transcript and studio audio."` (and add localized pack title/description map or API `titleFa`/`descriptionFa` fallback for starter seeded packs on Sanjia so `IRN` users aren't confronted with pure English UI cards).
  - Translate `recommendedByPackId` & `topic` tags (`"marine_biology"` -> `"زیست‌شناسی دریا"` via `TOPIC_METADATA` / pack-tag map; zero raw `snake_case` allowed!).
- **Quick Drills (`MicroDrillsScreen.tsx` & `irn_mobile_23_drills.jpg`):**
  - Never leave `"هنوز تمرینی بارگذاری نشده است"` as a blank dead card when catalog sync hasn't finished or failed due to rate limit: show a pulsing 3-card skeleton while `isLoadingCatalog` is true, and an explicit `"تلاش مجدد و همگام‌سازی تمرین‌ها"` button (`min-h-[44px]`) if offline/empty.
- **Full Mock Orchestrator (`FullMockOrchestratorScreen.tsx:43-73`):**
  - Localize section titles (`Listening Section` -> `بخش لیسنینگ` etc.) for `IRN`.

---

### F. Smart Coach Hub, Daily Mission, Linguistic Graph, Register Shifter & Drop-to-Practice
**Screenshots:** `irn_mobile_10_coach.jpg`, `irn_mobile_15_graph.jpg`, `irn_mobile_24_mission.jpg`, `irn_mobile_25_register_shifter.jpg`, `irn_mobile_26_drop.jpg`
**Files:** `web/src/spa/features/mission/CoachHubScreen.tsx:1-320`, `DailyMissionScreen.tsx:1-699`, `LinguisticGraphScreen.tsx:1-387`, `web/src/spa/features/register-shifter/RegisterShifterScreen.tsx:1-525`, `web/src/spa/features/drop/DropHubScreen.tsx:1-827`

- **Coach Hub (`CoachHubScreen.tsx` & `irn_mobile_10_coach.jpg`):**
  - Fix `"موضوع: technology_ai"` badge -> map via `TOPIC_METADATA[topicKey].labelFa` (`موضوع: فناوری و هوش مصنوعی`) and wrap English mission title (`AI at Work: Weighing Speed vs Reliability`) in `<LtrExamBoundary>`.
  - Fix bottom `"آزمون‌ها →"` arrow to `<ForwardArrowIcon />` (pointing left `←` in RTL).
  - Upgrade the 4 quick-drop badges (`لینک`, `متن`, `عکس`, `صدا`) from `20px` mini pills to `min-h-[40px]` touch pills or clean icon indicators inside the Drop card.
- **10-Min Daily Mission (`DailyMissionScreen.tsx` & `irn_mobile_24_mission.jpg`):**
  - Add skeleton loading + Retry/Back button when `/v1/coach/mission` fails (`429` or offline). Ensure the 3-step segmented bar (`۱. گرم‌کردن`, `۲. پاسخ شما`, `۳. بازخورد مربی`) renders as a 3-column equal bar with `>= 44px` touch height and clear step checkmarks.
- **Weakness & Topic Graph (`LinguisticGraphScreen.tsx` & `irn_mobile_15_graph.jpg`):**
  - Replace the two giant nearly-empty metric boxes showing a lonely `"0"` in `irn_mobile_15_graph.jpg` with a clean **compact horizontal stat strip** (`flex justify-between items-center py-3 px-4`) + actionable empty-state CTA (`«برای شناسایی خودکار نقاط ضعف، اولین تمرین ۱۰ دقیقه‌ای را انجام دهید»`).
  - Upgrade `+ فناوری و هوش مصنوعی` topic toggle chips from `26px` height to `min-h-[44px] px-3.5` with distinct selected check icon + high-contrast active fill.
- **Register Shifter (`RegisterShifterScreen.tsx` & `irn_mobile_25_register_shifter.jpg`):**
  - Fix segmented switcher (`ضبط صدا` vs `نوشتن جمله`): use full-width 2-column grid (`grid-cols-2`) so neither tab wraps awkwardly.
  - Ensure example starter pills & `"میکروفون ندارید؟ جمله بنویسید"` button have `min-h-[44px]` and consistent `<ForwardArrowIcon />`.
- **Drop-to-Practice (`DropHubScreen.tsx` & `irn_mobile_26_drop.jpg`):**
  - Render the 4 input types (`لینک مقاله`, `چسباندن متن`, `اسکرین‌شات / عکس`, `فایل صوتی کوتاه`) as an intentional **2×2 icon grid on mobile (`grid-cols-2 gap-2 sm:grid-cols-4`)** with `min-h-[44px]`, stopping jagged pill wrapping.
  - Give the URL input `dir="ltr" className="text-left ..."` cleanly (`placeholder="https://example.com/..."`) so pasted URLs don't clash with RTL alignment, and translate `item.historyFilter` labels (`url/text/image/audio` -> Persian on IRN; `<Button h>=40px`).

---

### G. Vocabulary Studio, SM-2 Flashcards & Word Detail (`/app/vocabulary`, `/review`, `/$wordId`)
**Screenshots:** `irn_mobile_11_vocab_top.jpg`, `irn_mobile_11_vocab_list.jpg`, `irn_desktop_11_vocab.jpg`, `glb_mobile_11_vocab_list.jpg`, `irn_mobile_12_vocab_review_front.jpg`, `irn_mobile_12_vocab_review_back.jpg`, `irn_mobile_13_vocab_detail.jpg`, plus user screenshots `media_1795382248551_40de6865.jpg`, `media_1795382249368_b412af3a.jpg`, `media_1795382249998_8adb5324.jpg`
**Files:** `web/src/spa/features/vocabulary/VocabHubScreen.tsx:183-446`, `VocabReviewScreen.tsx:300-440`, `VocabWordDetailScreen.tsx:56-160`

**This section addresses the exact screenshots that triggered the user's feedback:**
1. **Fix Virtualizer Overlap & Mobile Card Architecture (`VocabHubScreen.tsx:183-445`):**
   - **Dynamic Measurement:** Pass `measureElement` to `@tanstack/react-virtual`:
     - Remove fixed `height: ${virtualRow.size}px` on `[data-testid="vocab-row-..."]` wrapper!
     - Attach `data-index={virtualRow.index}` and `ref={rowVirtualizer.measureElement}` to each virtual row wrapper, bump `estimateSize: () => 136`, and avoid constraining inner height (`h-full` removed; use crisp bottom gap `pb-3`) so rows expand dynamically across any font size or phone width with **0px clipping/overlap** on both IRN and GLB!
   - **Responsive Two-Row Card Layout (`VocabHubScreen.tsx:384-439`):**
     - On `<640px` mobile: stack vertically (`flex-col gap-2.5 p-3.5`)!
       - **Row 1 (Word Header, LTR isolated):** Headword (`text-base font-bold`) + IPA (`whitespace-nowrap shrink-0 font-mono-exam` — prevents `/` from wrapping onto its own line!) + Localized Mastery Badge (`جدید` / `در حال یادگیری` / `تثبیت‌شده` instead of raw `NEW`).
       - **Row 2 (Meaning):** Clear 2-line limit (`line-clamp-2`) wrapped cleanly: English definition in `<LtrExamBoundary>` (with left align) + Persian gloss (`card.glossFa`, larger `text-sm font-medium text-primary`) right below — full width (`~330px`) instead of being crushed to `115px` beside action buttons!
       - **Row 3 (Action Bar):** 3 equal-height `min-h-[44px]` buttons (`گوش دادن`, `تلفظ`, `جزئیات`) cleanly aligned across the bottom edge!
     - On `>=640px` desktop (`sm:flex-row sm:items-center sm:justify-between`): comfortable horizontal split inside `max-w-5xl`, eliminating the empty desktop wasteland.
   - **Clarify Contradictory Counts & Fix Desktop Empty `0/0` (`VocabHubScreen.tsx:56-100, 224-327`):**
     - Display loading skeletons during initial `syncSeededVocabDeck` hydration so users NEVER flash `0 / 0` + `"هیچ کارتی یافت نشد"` (`irn_desktop_11_vocab.jpg`). If catalog sync fails (`429`/offline) and IndexedDB is empty, render an explicit Retry CTA + offline cache notice.
     - Reconcile `"شروع مرور امروز (۳۲۰)"` vs `"موج ۱ · ۱۵ از ۳۲۰ باز شده"` vs `"واژگان جدید امروز: ۰ از ۱۰"`: make the Review CTA show **the actual clickable session queue count** (`«مرور جلسه امروز (۱۰ واژه)»`) and explain unlocked wave clearly (`«موج ۱ فعال: ۱۵ واژه باز · کل مجموعه: ۳۲۰»`), plus reverse `"۳۲۰ / ۱۵"` -> `"۱۵ از ۳۲۰ واژه"` on RTL!
2. **Flashcard Review Perfection (`VocabReviewScreen.tsx` & `irn_mobile_12_vocab_review_*.jpg`):**
   - **Fix `10 / 1` Progress Counter:** Wrap index label in localized string `t('vocabReviewCounter', { current: currentIndex + 1, total: queue.length })` -> **`۱ از ۱۰`** (Persian digits on IRN, `1 of 10` on GLB), paired with a sleek full-width progress bar directly under the header.
   - **Remove Raw `snake_case` & Translate Selection Reason (`lines 340-348`):** Map both `topicTag` and `canonicalTopic` through `TOPIC_METADATA[key]?.labelFa / labelEn` and replace `'seeded'`/`'mistake_to_deck'` etc. with readable labels (`واژه پایه · سطح B1 · فناوری و هوش مصنوعی`).
   - **Fix Flipped Period on Back of Card (`line 380`):** Wrap `currentEntry.card.definition` in **`<LtrExamBoundary>`**! Immediately turns `.Most noticeable or important` into `Most noticeable or important.`. Add Persian gloss (`glossFa`) prominently right beneath!
   - **Device-Aware Hint & Ergonomic Rating Deck (`lines 258, 367-423`):** Hide `(Space)` and `[1]..[4]` shortcut prefixes on touch/mobile screens (`@media (hover: none) and (pointer: coarse)` / JS `pointer: fine` check -> show clean `"نمایش پاسخ"` on phone!), fill mobile viewport cleanly (`flex-1 justify-between` card + docked bottom 2×2 / 4-column thumb rating bar with `min-h-[56px]` cards and localized intervals `«۴ روز»`).
3. **Word Detail (`VocabWordDetailScreen.tsx` & `irn_mobile_13_vocab_detail.jpg`):**
   - Wrap `card.definition` (`line 93`) and `card.usageNote` (`line 128`) in **`<LtrExamBoundary>`** to eliminate `.particular habitat`.
   - Localize SRS card fields (`lines 136-154`): `State` -> `وضعیت`, `Repetitions` -> `تعداد مرور`, `Interval` -> `فاصله بعدی`, `Next Due` -> `مرور بعدی`, localized `srs.state` (`جدید`), and `<BdiLtr>` around `۰ روز` so zero never touches `روز` awkwardly.
   - Increase `Back` link (`line 62`) and `Listen`/`0.8x` buttons to `>= 40–44px`.

---

### H. Diagnostic & All 4 Exam Simulators (`/app/diagnostic/*` · `/app/practice/reading|listening|writing|speaking/*`)
**Screenshots:** `irn_mobile_18_diagnostic_intro.jpg`, `irn_mobile_19_reading_sim.jpg`, `irn_desktop_19_reading_sim.jpg`, `irn_mobile_20_listening_sim.jpg`, `irn_mobile_21_writing_sim.jpg`, `irn_desktop_21_writing_sim.jpg`, `irn_mobile_22_speaking_sim.jpg`
**Files:** `DiagnosticIntroScreen.tsx:110-204`, `CompactPreflightHeader.tsx`, `SimulatorWorkspaceShell.tsx:89-236`, `SplitPaneWorkspace.tsx:50-188`, `QuestionPaletteBar.tsx:58-115`, `ReadingSimulatorScreen.tsx:189-398`, `ListeningSimulatorScreen.tsx:107-345`, `WritingSimulatorScreen.tsx:547-733`, `SpeakingSimulatorScreen.tsx:553-752`, `AudioStudioPlayer.tsx:242-320`, `ExamSvgChartCard.tsx:80-120`

1. **Diagnostic Intro (`DiagnosticIntroScreen.tsx` & `irn_mobile_18_diagnostic_intro.jpg`):**
   - Localize `rulesSummary` (`lines 125-129`) and replace hardcoded English `'Reading Calibration'`, `'Listening Calibration'` and English fallback descriptions (`lines 139-158`) with `t(...)` keys (zero `.mode` / `.block` flipped periods!).
   - Make `CompactPreflightHeader` mode options stack into clean 1-line pills (`استاندارد (۱۵ دقیقه)` | `زمان اضافه` | `پخش تکراری`) instead of 3-line squished circles.
   - Reorder bottom CTA box so `"شروع تعیین سطح"` + `<ForwardArrowIcon />` (with `whitespace-nowrap`, no line-break onto arrow!) sits FIRST / Primary top on mobile, followed by `"ادامه بدون اسپیکینگ"` and subtle `"بعداً انجام می‌دهم"`.
2. **Global Simulator `!bundle` Safety Net (Fixes `irn_mobile_19..22` & `irn_desktop_21` Blank Traps):**
   - Extract a shared `SimulatorLoadFallback` component used across Reading, Listening, Writing, Speaking when `!bundle`: renders a centered status card with Retry button (`onRetry`), Offline Cache check, and **`بازگشت به آزمون‌ها / بازگشت به خانه`** button (`min-h-[44px]`).
   - Also wrap media preload in Writing/Listening so an optional SVG/media pre-cache HTTP 429 falls back cleanly to on-demand inline image load + warning toast instead of blocking the entire Writing simulator mount (`irn_desktop_21_writing_sim.jpg`).
3. **Distraction-Free Workspace Chrome (`SimulatorWorkspaceShell.tsx` & `irn_desktop_19_reading_sim.jpg`):**
   - Deduplicate `breadcrumb` & `subtitle`: when `activeSection?.title === bundle.pack.title`, omit `subtitle` (eliminates `"The Physics and Architecture..."` printed 3× in Reading Desktop!). Wrap English passage headings (`PassageAnnotatorPane` `title`, Reading/Writing/Speaking section titles) in `<LtrExamBoundary>` so passage `h1` aligns cleanly left-to-right!
   - Increase `workspace-exit-btn` & `workspace-shortcuts-btn` from `h-8` (`32px`) to `h-10 sm:h-9` (`40px`) and hide keyboard shortcut modal trigger (`workspace-shortcuts-btn`) on coarse mobile screens.
   - Fix `(Focused)` mixed English label in `simViewFocusedLabel` (`fa.ts`) -> `'تک‌سوالی'` vs `'همه پرسش‌ها'`.
4. **Footer Pagination & Question Palette (`QuestionPaletteBar.tsx` + Reading/Listening/Speaking Footers):**
   - Fix `قبلی >` / `بعدی <` 2-line vertical wrapping seen in `irn_desktop_19_reading_sim.jpg` by adding `whitespace-nowrap shrink-0` inside Prev/Next `MzButton`s and using unified `<BackArrowIcon />` / `<ForwardArrowIcon />` (`min-w-[84px] h-10`).
   - **Mobile Question Palette (`<768px`):** Replace wrapping `flex-wrap` grid inside fixed `footer` (which explodes across 3–4 rows for 40-question Listening/Reading tests!) with a **single-row horizontally scrollable palette strip (`flex-nowrap overflow-x-auto no-scrollbar`)** + optional `"سوال ۱ از ۴۰ ▾"` sheet trigger, keeping footer height compact (`<= 68px` on mobile).
   - Keep palette items `min-h-[40px] min-w-[40px]` for reliable thumb tapping (currently `32px` `h-8`).
5. **Mobile Split-Pane Ergonomics (`SplitPaneWorkspace.tsx` & Simulators):**
   - Currently `SplitPaneWorkspace` switches at `<680px` (`stacked === true`) into vertical top/bottom half panels inside `100dvh`, cramping passages and questions into two tiny `240px`-tall scrollable boxes!
   - Upgrade `<680px` behavior on `SplitPaneWorkspace` to support a **clean segmented sticky Mobile Pane Switcher (`متن / پرسش‌ها` · `صوت و متن / پرسش‌ها` · `نمودار و موضوع / ویرایشگر` · `کارت موضوع / ضبط صدا`)** with an unread-question count badge + quick Jump-to-Questions CTA, while optionally retaining a collapsible peek preview for Writing chart / Listening player (`AudioStudioPlayer` remains compact sticky header in mobile Listening mode so you can listen while reading Q1–Q10!).

---

### I. Progress Analytics, Compare Attempts & Results (`/app/progress`, `/compare`, `/results/*`)
**Screenshots:** `irn_mobile_14_progress.jpg`
**Files:** `web/src/spa/features/progress/ProgressScreen.tsx:321-644`, `CompareAttemptsScreen.tsx:87-341`, `ObjectiveResultScreen.tsx:180-521`, `EvaluationResultScreen.tsx:557-656`

- **Progress Localization & Radar Visual Clarity (`ProgressScreen.tsx`):**
  - Replace hardcoded English headers `Target` (`line 344` -> `t('progressTargetHeading')` `"نمره هدف"`) and `Streak & Samples` (`line 363` -> `t('progressStreakSamplesHeading')` `"تداوم و آزمون‌ها"`), and translate header eyebrow `Estimated Band` (`«تخمین فعلی»`).
  - Improve Empty Radar State (`lines 438-486` seen in `irn_mobile_14_progress.jpg`): Instead of a microscopic center dot floating inside a blank diamond with bare `R / W / S / L` initials, render full localized skill axis labels (`ریدینگ / رایتینگ / اسپیکینگ / لیسنینگ` on IRN), dashed baseline guide + friendly `"پس از اولین آزمون پر می‌شود"` overlay note when all 4 skills are null.
  - Upgrade `"نقشه راه من"` inline link (`line 332`) to a proper `min-h-[40px]` pill button.
- **Result Screens (`ObjectiveResultScreen.tsx` & `EvaluationResultScreen.tsx`):**
  - Remove `uppercase` / `tracking-wider` in Persian, ensure `Question` prompts / inline essay diffs use `<LtrExamBoundary>`, add mobile sticky view switcher (`پاسخ‌نامه / متن و شواهد`) via upgraded `SplitPaneWorkspace`, and ensure all bridge CTAs (`eval-bridge-coach-cta`, `eval-bridge-shifter-cta`, `ecosystem-handoff-link`) are `min-h-[44px]` (currently `h-8` `32px`).

---

### J. Settings, Paywall & Admin Console (`/app/settings`, `/app/paywall`, `/app/admin/trace`)
**Screenshots:** `irn_mobile_16_settings.jpg`, `irn_mobile_17_paywall.jpg`, `glb_mobile_17_paywall.jpg`, `glb_desktop_27_admin_trace.jpg`
**Files:** `web/src/spa/features/settings/SettingsScreen.tsx:200-650`, `web/src/spa/features/paywall/PaywallScreen.tsx:94-323`, `web/src/spa/features/admin/AdminTraceConsoleScreen.tsx:1-361`

- **Settings Cleanup & Condensing (`SettingsScreen.tsx` & `irn_mobile_16_settings.jpg`):**
  - Hide raw `cf4b72bc-c378-43f7-9625-59ccc4b1fc6c` device UUID inside a collapsible `"اطلاعات فنی و همگام‌سازی پیشرفته"` `<details>` accordion at the bottom (keeping normal Account + Sync Now CTA prominent).
  - Translate `trackDescriptor.subtitle` (`line 298`) and fix `{cap}/day` (`line 475`) -> `t('settingsVocabCapOption', { count: cap })` (`«۵ واژه جدید/روز»`).
  - **Clean up Internal AI Voice Leaks (`fa.ts:741-743`, `en.ts:744-746`):** Replace `'لهجه صوتی مرجع (Kokoro AI)'`, `'آمریکایی (af_bella)'`, `'بریتانیایی (bf_emma)'` with **`'لهجه پخش تلفظ'`**, **`'انگلیسی آمریکایی'`**, **`'انگلیسی بریتانیایی'`** (and on EN: `'Reference Pronunciation Accent'`, `'American English'`, `'British English'`)!
  - Render the 5 Color Themes (`lines 527-575`) in a compact **2-column visual swatch card grid** (saving ~250px scroll height) and bump all track/topic/cap/accent pills from `26–30px` to `min-h-[44px]`.
  - Wrap bottom `"منطقه خطر / حذف حساب"` inside a calm outlined card or collapsed panel.
- **Paywall Conversion & Accessibility (`PaywallScreen.tsx` & `irn_mobile_17_paywall.jpg`):**
  - Replace the floating orphaned `"تنظیمات"` / `"Settings"` text link (`41×16px`) under the subtitle with a structured back/manage link or contextual account status pill inside the header.
  - Fix `<MzCheckbox>` hit box (`1×1` -> full container via `inset-0 opacity-0`) and replace the awkward dual-state bottom (`signin link` + `disabled grey button`) with **one clear primary action flow**: if unauthenticated and TOS checked, Primary CTA reads `"ورود و ادامه پرداخت"` (`Sign In & Continue to Checkout`) and directly navigates to `/app/auth/login?returnTo=/app/paywall` instead of leaving a dead disabled button! On `<768px`, pin Checkout CTA in a clean bottom summary bar if a plan is selected.

---

## 6. Master BiDi, Typography & Copy Hygiene Matrix

Every item below was directly observed across live screenshots and verified in source files (`web/src/i18n/fa.ts`, `en.ts`, `backend/packages/domain/src/exams/exam-descriptor.ts`, `starter-exams.ts`, TSX components):

| Defect Category | Exact Observed Occurrence (Live Screenshot / File) | Exact Fix Rule |
|---|---|---|
| Flipped Punctuation on English Text in RTL | `.Most noticeable or important` (`irn_mobile_12_vocab_review_back.jpg`), `.particular habitat` (`irn_mobile_13_vocab_detail.jpg`), `.Short excerpt...` & `.mode` (`irn_mobile_18_diagnostic_intro.jpg`), `.seconds` (`irn_mobile_24_mission.jpg`) | Wrap every English sentence, definition, usage note, prompt, and fallback error string in `<LtrExamBoundary>` (`dir="ltr"` + `unicode-bidi: isolate`) |
| Split IPA Across Lines | `/` alone on line 1, `'seɪ.li.ənt/` on line 2 (`irn_mobile_11_vocab_list.jpg`) | Give IPA wrapper `whitespace-nowrap inline-block shrink-0` inside full-width header row |
| Reversed RTL Fractions & Arrows | `10 / 1` (`vocab_review`), `320 / 15` (`vocab_hub`), `(/۴۰)` (`calculator`), `آزمون‌ها →` (`home`, `coach`), wrapped `قبلی >` / `بعدی <` (`reading_sim`) | Replace slash counters with localized `«۱ از ۱۰»` & `«۱۵ از ۳۲۰»`; replace `(/۴۰)` with `(از ۴۰)`; unify directional chevrons via direction-aware component + `whitespace-nowrap` |
| Untranslated English Labels on IRN | `Estimated Band`, `Target`, `Streak & Samples`, `IELTS ACADEMIC`, `M T W Th F Sa Su`, `days studied`, `University & Professional...`, `Reading 60m...`, `(Focused)`, `State / Repetitions / Interval / Next Due` | Add dedicated keys in `i18n/fa.ts` + `en.ts`; localize `EXAM_DESCRIPTORS` + `studyWeek` in UI helpers while keeping `@mockza/domain` pure for parity tests |
| Raw `snake_case` Tags & Internal Names | `technology_ai`, `technology ai`, `marine_biology`, `academic_linking`, `academic_core`, `SeaweedFS`, `Kokoro AI`, `af_bella`, `bf_emma`, `day/5`, device UUID | Route all topic/tag pills through `TOPIC_METADATA` / human tag labeler; scrub `SeaweedFS`, `Kokoro AI`, `af_bella`, `bf_emma` from user copy; hide UUID in advanced accordion |
| Desktop Keyboard Hints on Touch Screens | `(Space)` inside button & `"کلید Space..."` / `[1]..[4]` on phone (`irn_mobile_12_*`, `irn_desktop_19`) | Gate shortcut hints & `(?)` modal trigger behind `(pointer: fine)` / desktop breakpoint (`hidden md:inline`) |

---

## 7. Phased Implementation Plan & Verification Gates

### Execution Sequence (Safe, Incremental, Rebuilds Only After Grouped Edits)

- **Phase 0 — Resilience, BiDi Foundation & Shared UI Primitives (Zero Visual Regressions):**
  1. Add `getState()` / `listPacks()` in-flight dedupe + short TTL + `429`/offline Dexie cache fallback in `web/src/adapters/http/http-personalization.adapter.ts` and `HttpCatalogAdapter`; map `429` error toast to friendly Persian/English text.
  2. Fix `starter-exams.ts:1237` (`SeaweedFS` copy leak) and check `WritingSimulatorScreen` media preload handling so SVG asset 429 never bricks the simulator.
  3. Update `web/src/styles/global.css` (disable RTL `letter-spacing` / `uppercase`, extend `[lang="fa"]` editorial heading styles to `.font-editorial` `h2`/`h3`, `.bidi-isolate`) and shared `DirectionIcon.tsx`.
  4. Upgrade `MzButton` (`whitespace-nowrap`, mobile `min-h-11` where primary/nav), `MzSegmentedControl` (equal-grid & mobile scroll options), `MzCheckbox` (`inset-0 opacity-0` hitbox), and `InlineListenButton` (`min-h-[40px]` pill).

- **Phase 1 — Global App Shell & Mobile Bottom Navigation:**
  1. Refactor `web/src/spa/router.tsx` shell:
     - Implement `focused_flow` minimal header on `/welcome` and `/auth/*`.
     - Restore desktop (`lg:`) true single start rail + slim `56px` utility topbar (eliminating the `110px` 2-row header stack).
     - Implement mobile (`<lg`) non-wrapping single-row `56px` topbar (`44×44` menu/theme triggers + compact sync indicator) and persistent bottom 5-tab bar (`خانه`, `نقشه راه`, `آزمون‌ها`, `مربی`, `واژگان`) respecting `env(safe-area-inset-bottom)`.

- **Phase 2 — Highest-Impact User Pain Screens (`Vocabulary`, `Home`, `Roadmap`, `Onboarding/Auth`):**
  1. Rebuild `VocabHubScreen` virtualizer with `measureElement`, responsive 3-row mobile card layout, `whitespace-nowrap` IPA, clear due/wave counters, and desktop loading/retry state (eliminates overlapping cards and `0/0` flash).
  2. Fix `VocabReviewScreen` (`<LtrExamBoundary>` definitions, `1 از 10` counter, localized topic pills, touch-friendly rating dock without `(Space)`).
  3. Fix `VocabWordDetailScreen` (`<LtrExamBoundary>` definitions/usageNote, localized SRS table).
  4. Simplify `HomeScreen` to the 4-zone editorial hierarchy (single Hero Next Step, 2-pillar cards with RTL arrows, compact Coach strip, Saturday-first localized Study Week without breaking domain parity).
  5. Polish `RoadmapScreen` (localized topics/units/spacing, single primary CTA + compact secondary bar), `WelcomeScreen` + `GoalSetupScreen` (sticky thumb footer, localized subtitles), and `AuthScreen` (`order-first` login card on mobile).

- **Phase 3 — Exam Discovery, Coach Hubs & Simulator Ergonomics (`Practice`, `Coach`, `Simulators`, `Results`):**
  1. Streamline `PracticeCatalogScreen` filters (`Search` + single horizontal scrollable skill strip), scrub leaked slugs/infra terms, add `SimulatorLoadFallback` Retry/Exit cards on all 4 simulators + `DiagnosticIntro`/`Session` + `DailyMission` + `MicroDrills`.
  2. Upgrade `SplitPaneWorkspace` (sticky mobile 2-tab pane switcher below `680px`), `QuestionPaletteBar` (single-row mobile scroll strip + `40×40` pills), `SimulatorWorkspaceShell` (dedupe duplicate titles, `whitespace-nowrap` pagination buttons, RTL `<LtrExamBoundary>` on passage headers), and `ExamSvgChartCard` touch zoom ergonomics.
  3. Polish `CoachHubScreen`, `LinguisticGraphScreen`, `RegisterShifterScreen`, `DropHubScreen` (2×2 mode grid + LTR URL box), and `ProgressScreen` / `ObjectiveResultScreen` / `EvaluationResultScreen`.

- **Phase 4 — Public SEO, Calculator, Settings, Paywall & Design Token Parity Audit:**
  1. Fix `BaseLayout.astro` + `landing.css` mobile header nav link heights (`>= 44px`), hero floating card clearances, `[examSlug].astro` pill badges, and `ielts-band-calculator` wording/columns.
  2. Condense `SettingsScreen` (collapsible UUID/debug panel, 2-column theme grid, clean `"لهجه پخش تلفظ"` labels without `af_bella`/`Kokoro`) and fix `PaywallScreen` sign-in+checkout single CTA flow.
  3. Verify `packages/design-tokens/tokens.json` & Flutter (`app/`) parity (`check_cross_parity.sh`).

### Verification & Server-Safety Acceptance Gates
Per `AGENTS.md` (host has `7.7 GiB` RAM and `0` swap):
1. **RAM Check First:** Run `free -h` before any test/build; never run parallel heavy Node/Docker builds; run `pnpm --filter @mockza/web check` / Playwright with `NODE_OPTIONS="--max-old-space-size=1536"`.
2. **Code & BiDi Gates:**
   - All existing `web` unit/component tests + `@mockza/domain` + `@mockza/design-tokens` tests + `./scripts/check_all.sh --web-only` + `./scripts/check_cross_parity.sh` pass cleanly (`0` failures).
   - E2E selector contracts (`data-testid` attributes referenced in `web/tests` / `app/test/e2e`) preserved intact across all refactors.
3. **Pixel & DOM Telemetry Regression Check (Mobile `390×844` + Desktop `1440×900`, both `sanjia` & `mockza`):**
   - `horizOverflowPx === 0` on 100% of audited pages.
   - `smallTapTargetCount === 0` (`< 44×44px`) on primary nav, CTAs, checkboxes, filter pills, and audio controls.
   - `rawSnakeCaseVisible.length === 0` and zero occurrences of `SeaweedFS`, `Kokoro`, `af_bella`, `bf_emma`, `days studied`, `Estimated Band`, or flipped `.Punctuation` in `IRN`.
   - Zero virtualizer card bounding-box overlap (`rowBottom[i] <= rowTop[i+1]`) in `/app/vocabulary` across 20+ scrolled rows on both IRN & GLB.
   - Fresh post-edit screenshot comparison across all critical views before any container deployment.
