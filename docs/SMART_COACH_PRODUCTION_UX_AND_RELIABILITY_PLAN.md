# Smart Coach & End-to-End UX Production-Readiness Master Plan

**Status:** Complete Full-Stack Audit & Architectural Blueprint (Pre-Implementation)  
**Audit Coverage:** 100% of Smart Coach / Closed-Loop code across Backend API, Worker, AI Graphs, Storage, DB, Contracts, Web SPA (`mockza.mehtea.ir` GLB & `sanjia.mehtea.ir` IRN), and Flutter (`Mockza` GLB & `Sanjia` IRN).  
**Goal:** Fix every live reliability & UX defect (including the `404` media upload failure, silent multi-image overwrite, cold-start timeouts, canned feedback, and broken new-user flows) and elevate Mockza / Sanjia into a cohesive, unmistakable, ready-to-publish product.

---

## 1. Exhaustive Full-Stack Audit (Every Defect Found in Code & Live Servers)

Every item below was verified directly in source files and/or against live running containers (`mockza-api-1`, `sanjia-api-1`, `mockza-web-1`, `sanjia-web-1`).

### 1.1 Critical Backend, Storage & AI Pipeline Bugs (`P0`)
| # | Severity | Exact Location | Verified Root Cause & User Impact |
| :--- | :--- | :--- | :--- |
| **B1** | **P0** | `backend/apps/api/src/routes/drop.ts:175` vs `uploads.ts:245` | **File Upload `404 Not Found`:** Under live `S3_PUBLIC_MODE=proxy`, `POST /v1/drop/presign-media` returns `uploadUrl: "/v1/uploads/proxy?..."`, which does not exist (`PUT /v1/uploads/proxy` returns `HTTP 404`). The mounted route is **`PUT /v1/uploads/signed-put`**. Every image and audio upload in *Learn From Anything* fails on both Web & Flutter. |
| **B2** | **P0** | `DropHubScreen.tsx:181-195`, `http-linguistic.adapter.ts:215`, `drop_hub_screen.dart:325-341`, `linguistic_gateway.dart:745`, `drop.ts:144-155` | **Multi-Image Overwrite Data Loss:** Both Web and Flutter upload 2–4 images in a loop calling `/v1/drop/presign-media` with a **1-element `files` array**. `drop.ts` keys each file by array index `0` (`item-0.webp`), so images 2, 3, and 4 **silently overwrite `item-0`** on S3 and the AI receives 4 copies of the last image. |
| **B3** | **P0** | `backend/apps/api/src/routes/graph-and-missions.ts:373` vs `web/src/adapters/http/api-client.ts:19` | **Brand-New User Cold-Start Timeout (`20–24s` vs `15s`):** Live probe confirmed `GET /v1/missions/today` executes synchronous OpenRouter synthesis and took **~20–24s** for a brand-new user — aborted at **15s** by Web `DEFAULT_API_TIMEOUT_MS`. |
| **B4** | **P0** | `backend/packages/ai/src/graphs/ingest-dropped-content.ts:175, 328, 386` + `openrouter-alpha.ts:250` | **3-Call Sequential AI Waterfall (25–45s Latency):** Text/Image Drops make 3 sequential OpenRouter calls (System 1 Decisions → System 1 Extractions → System 2 Drill), each risking a `4s` alpha timeout before falling back to GA models — tripling both latency and token cost. |
| **B5** | **P0** | `DropHubScreen.tsx:96`, `RegisterShifterScreen.tsx:46`, `drop_hub_screen.dart:393,415`, `register_shifter_screen.dart:169` | **Silent Polling Suicide (`6.4s` Flutter / `12s` Web):** Web polls `20 × 600ms = 12s`; Flutter polls `16 × 400ms = 6.4s`. When real AI jobs take 15–35s, the loop exits silently (`setSubmitting(false)`) with **zero error, zero toast, and zero navigation**. |
| **B6** | **P0** | `graph-and-missions.ts:593, 603-699` | **Double Synchronous LLM Call + Canned Fake Mission Feedback + Poisoned Spoken Graph:** `POST /v1/missions/:id/complete` runs TWO synchronous AI calls (`callDecisionsApi` + `await updateLinguisticGraphSignals`, risking 15s aborts), throws away real critique to return hardcoded boilerplate text (`"Great transfer! Integrated X..."`), and sets spoken audio `sampleText = "Spoken mission submission (m4a)"` instead of transcribing speech — polluting the user's Weak Spots graph. |
| **B7** | **P0** | `DropHubScreen.tsx:221, 231` & `drop.ts:90-140` | **Hardcoded Audio MIME/Duration & Post-Upload `402`:** Web audio drop hardcodes `contentType: 'audio/mp4'` (breaking `.mp3`/`.wav`/`.ogg`) and `durationSeconds: 180`. Free users upload megabytes to S3 *before* `/v1/drop/ingest` rejects them with a raw `402 pro_required_for_audio_drop`. |
| **B8** | **P1** | `app/lib/services/linguistic_gateway.dart:765` | **Flutter `Dio` Upload Auth Header Leak:** `_dio.put(uploadUrl)` sends the app's `Authorization: Bearer` header to S3 presigned URLs (which S3 rejects with `400 InvalidArgument` in non-proxy mode). |
| **B9** | **P1** | `backend/apps/api/src/server.ts` (`mockza-api-1` live logs) | **Unhandled `pg-boss` Error Crash:** Live API logs showed `Emitted 'error' event on PgBoss instance (EAI_AGAIN postgres)` killing the API container on transient DNS blips. |

### 1.2 New-User Flow, State & Data Integrity Gaps (`P1`)
| # | Location | Verified Gap |
| :--- | :--- | :--- |
| **U1** | `web/src/spa/router.tsx:947-951` + `web/src/landing/markup.mjs:6-14` | **Web Skips Onboarding Completely:** `/app` blindly renders `<Navigate to="/home" replace />` regardless of `onboardingCompleted`. Landing page `/` sends visitors straight to `/app/diagnostic/intro` or `/app/practice` and never introduces **Smart Coach**. |
| **U2** | `DesktopSimulatorApp.tsx` + `api-client.ts` | **Cold Anonymous Auth Penalty:** Anonymous device auth only fires after the first request fails with `401`, adding wasted latency on a new user's first click. |
| **U3** | `DailyMissionScreen`, `RegisterShifterScreen`, `DropDrillScreen` (Web & Flutter) | **Smart Coach Gives ZERO Streak / Study-Week Credit:** None of the 3 Smart Coach flows write to `daily_study_logs` (`attemptStore` / Drift `DailyStudyLogs`), so a daily Smart Coach learner stays stuck at a **0-day streak** and an empty Study Week strip on Home! |
| **U4** | `DropDrillScreen.tsx:34` & `drop_drill_screen.dart:89` | **Hardcoded Track & Card ID Collisions:** Web saves dropped vocab hardcoded to `examId: 'ielts_academic'` instead of the active exam track; Flutter `cardId` omits `dropId` prefix (colliding across drops). |
| **U5** | `graph-and-missions.ts:300-325` & `drop.ts` | **No Same-Day Topic Refresh & No Drop Deletion:** Once a new user opens Today's Coach once, it stays frozen on `"Technology & Modern Work"` all day even if they pin `"Football"` or `"Medicine"` 30 seconds later; users also cannot delete unwanted drops from their history. |
| **U6** | `DropHubScreen.tsx:112-116` & `drop_hub_screen.dart:408-412` | **Misleading Failure Copy:** When an **image** or **audio** drop fails in the worker, the UI prints `"This link was unavailable; paste text instead"` — a hardcoded URL error shown for all input types. |

### 1.3 Naive UI/UX Deficiencies Across Every Smart Coach Screen
1. **Smart Coach Hub (`/coach`):** Static 4-card brochure with zero live state (no today's mission status, no active topic pill, no remaining Free/Pro quota, no recent study materials, no 1-click sample trials).
2. **Today's 10-Min Coach (`DailyMissionScreen`):** Bare `<textarea>` only — no Speak toggle (despite backend audio support), no 60s Warm-Up step, no live target-phrase highlighting as you write/speak, no sentence-starter hint for blank-page freeze, no real coaching diff or Band 8+ model rewrite.
3. **Upgrade My Speaking (`RegisterShifterScreen` + `RegisterGearLadderCard`):** Voice-only with no mic pre-check, no live audio level/waveform, no playback preview before submit, **no Type-a-Sentence fallback** for desktop/quiet rooms, and a **fake non-interactive `Volume2` speaker icon** (`RegisterGearLadderCard.tsx:90`) with zero audio playback.
4. **Learn From Anything (`DropHubScreen` + `DropDrillScreen`):** No drag-and-drop, no image thumbnail previews or per-image remove, no inline audio preview player, no upload progress bar or 4-stage processing stepper, no 1-click sample excerpts; `DropDrillScreen` has strict exact-match-only Cloze (no fuzzy/punctuation tolerance, Web lacks Hint/Show Answer), non-interactive plain-text Shadowing, and no completion summary.
5. **My Weak Spots (`LinguisticGraphScreen`):** Depressing empty boxes on Day 1; Flutter cannot even mute/remove topics (`linguistic_graph_screen.dart:194-209`); no curated 1-tap topic chips; no mastery progress bars; no `"Practice This Now"` deep-link on each weak spot.
6. **Leaked Internal Jargon:** `"SM-2"`, `"Save to SM-2 Deck"`, `"در دِک SM-2 ذخیره شد"`, `"Drop"`, `"Micro-Drill"`, `"Target Register Output"` still appear in `RegisterGearLadderCard.tsx`, `DropDrillScreen.tsx`, `app_en.arb`, and `daily_mission_screen.dart`.

---

## 2. Product & UX Architecture (Making It Amazing, Productive & Effortless)

### 2.1 Unmistakable Two-Pillar Mental Model
Every screen, CTA, and tab reinforces two complementary workspaces:
- **Mock Exams (`آزمون‌ها` · `/practice`)** — *"Test & Measure"*: Timed simulations, official-style rubrics, calibrated band/score reports.
- **Smart Coach (`مربی هوشمند` · `/coach`)** — *"Train & Improve Daily"*: 2–10 minute personalized coaching that fixes your recurring habits using topics and real-world content you enjoy.

### 2.2 Core UX Design Standards
1. **60-Second First Win:** Zero empty dead-ends. Day-1 users pick 2–3 topics during onboarding and immediately get a tailored Day-1 Coach, 1-click Sample Content Drills, and a 30s Voice-or-Text Speaking Upgrade.
2. **Zero Jargon Everywhere:**
   - `SM-2` / `SM-2 Deck` → **Vocab Deck** / **دفترچه واژگان**
   - `Drop` / `Dropped Content` → **Study Material** / **محتوای آموزشی**
   - `Closed-Loop` / `Bottleneck` → **Smart Coach** / **Weak Spot** / **نقطه ضعف پرتکرار**
   - `Register Gear` → **Speaking Level** (**Everyday · Casual** | **Professional · Work** | **Exam Style · Band 8+**)
3. **Speak OR Type Freedom:** Every productive Smart Coach tool accepts both voice and text seamlessly (respecting commuters, offices, and missing microphones).
4. **Transparent Speed & Progress:** Every page renders in `<300ms`; every AI job displays real upload progress (`%`) + a 4-stage live stepper (`Uploading → Reading → Coaching → Ready`), continues safely in the background if the user switches tabs, and always offers one-tap Retry on failure.
5. **Upfront Quota Honesty:** Show remaining free samples / Pro daily allowance *before* recording or uploading; never waste a user's effort only to show a surprise `402`.
6. **Unified Habit & Streak Loop:** Every completed Smart Coach activity logs real study time + completion to `daily_study_logs`, advancing the user's daily streak and Study Week strip alongside Mock Exams.

---

## 3. Screen-by-Screen UX Blueprint (Web + Flutter Parity)

### 3.1 Public Landing Page (`/`)
- Add a clean **"Two Ways to Reach Your Target Score"** showcase highlighting **Mock Exams** alongside **Smart Coach** (including a mini visual preview of *Everyday → Work → Band 8+* Speaking Upgrade and *Article/Photo → 2-Min Quiz*).
- Primary "Start Free" CTA routes into `/app/welcome` (returning onboarded users auto-redirect to `/app/home`).

### 3.2 Guided 3-Step Onboarding & Screening (Web + Flutter)
Enforced automatically on first visit (`/app` → `AppEntryGate` on Web; `app_router` on Flutter), preserving any intended deep-link `returnTo`:
- **Step 1 — "How do you want to use Mockza / Sanjia?" (Screening FIRST):**
  - 3 large visual choice cards:
    1. **Both — Complete Prep *(Recommended)***: *"Timed Mock Exams + 10-min Daily Smart Coach."*
    2. **Mock Exams Only**: *"Realistic full/section tests & calibrated score estimates."*
    3. **Daily Smart Coach**: *"10-min daily coaching, speaking upgrades & learning from real content."*
- **Step 2 — Quick Personalization (~20s):**
  - **Exam Track & Target Score/Date** (primary for `both`/`exams`; compact optional picker for `coach`).
  - **Pick 2–3 Favorite Topics** (1-tap chips: *AI & Tech*, *Business & Work*, *Medicine & Health*, *Cinema & Books*, *Football & Sports*, *Travel & Culture*, *Environment & Science*, *Daily Life* + custom input).
  - Saved immediately to `UserProfile.studyFocus` + `PATCH /v1/graph/interests` so Day 1 is already personalized.
- **Step 3 — Tailored Instant First Win:**
  - `exams` / `both`: **"Check My Level (~10 min)"** or **"Enter Workspace"**.
  - `coach`: **"Start Today's 10-Min Coach"** or **"Try Upgrade My Speaking (30s)"** or **"Enter Workspace"**.

### 3.3 Adaptive Home Dashboard (`/home`)
- **Single Clear Hero Card ("Your Best Next Step"):**
  - `coach`: Live **Today's 10-Min Coach** card (`Ready · 10 min` / `Completed Today ✓`, focus topic chip, 1-tap `Start`).
  - `exams`: Resume active exam draft / Level Check / Recommended Exam Pack.
  - `both`: Side-by-side **2-Pillar Action Cards** (**Mock Exams** with next pack vs **Smart Coach** with live today status) — zero stacked duplicate buttons.
- **Readiness, 7-Day Study Week & Due Vocab Row:** Reflects streaks and study minutes earned from **both** Mock Exams and Smart Coach.

### 3.4 Smart Coach Command Center (`/coach`)
Replace the static 4-card brochure with a live personal coaching hub:
- **Live Today Bar:** Today's Coach status badge (`Ready` / `Done ✓`), active focus topic pill with 1-tap **"Switch Topic"** popover, and **Daily Allowance Indicator** (`Free Trial: 1 Speaking Upgrade & 1 Content Drill` or `Pro: 5/5 remaining today`).
- **4 Live Tool Cards (with Real Counts & Quick Launchers):**
  1. **Today's 10-Min Coach** — Previews today's prompt title & 2 target phrases + `"Start 10-Min Session"` (or `"Review Feedback"` if done).
  2. **Upgrade My Speaking** — Shows latest upgraded phrase or `"Voice or Text · 30s"` + quick `"Try Sample"` link.
  3. **Learn From Anything** — Shows count of saved materials + 4 quick-entry chips (`Link`, `Paste Text`, `Photo`, `Audio`) that open `/drop` directly on that tab.
  4. **My Weak Spots & Topics** — Shows live counts (`N active habits · M mastered`) or `"Pick your topics"` badge on Day 1.
- **Cross-Pillar Switcher Footer:** Calm link to **Mock Exams (`/practice`)** when ready for a timed test.

### 3.5 Today's 10-Min Coach (`DailyMissionScreen`) — Interactive 3-Stage Studio
- **Header:** Focus topic badge + **"Switch Topic"** button (up to 2 refreshes/day via `POST /v1/missions/today/refresh`) + link to **My Weak Spots**.
- **Stage 1 — 60-Second Warm-Up:**
  - 2 interactive target-expression cards with **working Listen audio (`1.0x`/`0.8x`)**, plain `EN`/`FA` tip, and a 1-line example.
  - Optional mini peek of up to 2 due words from the user's Vocab Deck.
- **Stage 2 — Guided Practice Studio (Write OR Speak Toggle):**
  - **Live Target Radar:** Both target phrases sit above the editor/recorder as live status pills — turning **green with a checkmark** in real time as the learner writes them naturally!
  - **Write Tab:** Clean LTR editor (`LtrExamBoundary`) with word-count pacing bar (`0 → 120 words`) + optional **"Need a starter?"** toggle revealing a gentle opening clause + `Cmd/Ctrl+Enter` submit shortcut.
  - **Speak Tab:** Built-in mic recorder with live level meter, 30–120s timer, local playback preview, and submit to backend audio evaluation (which transcribes real speech cleanly!).
- **Stage 3 — Real Examiner Critique & Lock-In:**
  - Shows **Actual Target Transfer Check** (exact quoted match or 1-sentence fix showing how to weave a missed target into *their* response).
  - Shows **2 Specific Inline Upgrades** on the learner's own sentences (`Original → Improved + Why`).
  - Shows a **Polished Band 8+ Model Version** of their answer (with **Listen** playback + 1-tap **"Save Phrase to Vocab Deck"**).
  - Credits `daily_study_logs` (streak + study time) and offers `"View Updated Weak Spots"` / `"Back to Coach Hub"`.

### 3.6 Upgrade My Speaking (`RegisterShifterScreen` + `RegisterGearLadderCard`)
- **Dual Input Composer:**
  - **Speak Tab:** Mic pre-check with friendly recovery guide, animated waveform/level meter, 5–45s progress ring, Stop/Re-record, and **Playback Preview** before clicking *"Upgrade My Speaking"*.
  - **Type Tab (New):** Type 1–3 casual sentences (`20–600 chars`) for quiet rooms / no-mic desktop use + **3 One-Click Sample Sentences** so new users feel the magic immediately!
- **Live Stage Stepper:** `Uploading → Transcribing → Building Everyday / Work / Band 8+ levels` via SSE + 90s polling with explicit retry on failure.
- **Interactive 3-Level Upgrade Card:**
  - Keyboard shortcuts `1` / `2` / `3` on desktop to switch **Everyday · Casual**, **Professional · Work**, and **Exam Style (Band 8+)**.
  - **Working Listen Button (`1.0x` & `0.8x Slow`)** replacing the fake static `Volume2` icon!
  - Highlighted diff cards (`really good → compelling`) with concise `EN`/`FA` coaching rationale + 1-tap **"Save to Vocab Deck"** (zero `"SM-2"` jargon).
- **Step 2 — Guided Say-It-Aloud Practice:**
  - Plays the target sentence first, records repeat-aloud with waveform, shows word-by-word green/amber match pills + fluency stars (`1–5`), and lets learners retry until nailed.

### 3.7 Learn From Anything (`DropHubScreen` + `DropDrillScreen`)
- **Drop Composer (`DropHubScreen`):**
  - **Upfront Quota & Pro Clarity:** Shows remaining free/Pro count; clearly labels Audio Drop as `Pro` with a helpful preview CTA *before* picking a file.
  - **Article URL Tab:** Instant URL pre-flight validation + Iran no-VPN notice + smart fallback prompt if a site is paywalled/video.
  - **Paste Text Tab:** Live char counter (`40–15,000`), clipboard paste button, and **3 One-Click Curated Sample Articles** (*AI & Work*, *Sports Strategy*, *Health & Lifestyle*) for instant zero-friction discovery.
  - **Screenshot / Image Tab:** Real **Drag-and-Drop + `Ctrl+V` Paste + File Picker**, **thumbnail preview cards** with file size & per-image remove (`×`), batch presign (fixing `B2` multi-image overwrite!), and live upload progress bar (`0–100%`).
  - **Audio Tab:** Real MIME detection (`.mp3`, `.m4a`, `.wav`, `.ogg`), **client-side duration check before upload** (instant friendly message if `>180s`), inline audio preview player, plus optional **"Record Voice Note (≤3 min)"**.
  - **4-Stage Live Stepper + Background Job Tray:** `1. Uploading (%) → 2. Reading content → 3. Extracting expressions → 4. Building 2-min quiz`. If the user navigates away, a non-intrusive toast notifies *"Your 2-min study drill is ready — Open →"* upon completion! Context-aware errors per input kind (never showing a URL error for an image/audio failure).
- **Interactive 4-Step 2-Min Study Drill (`DropDrillScreen`):**
  - Progress indicator (`Step 1 of 4` → `Complete`):
    1. **Key Expressions:** Cards with IPA, definition, Persian gloss (`irn`), context sentence, **Listen** audio button, and 1-tap **"Save to Vocab Deck"** (bound to user's **active `examId`** + collision-free `dropId`-scoped `cardId`!).
    2. **Comprehension Check:** Interactive MCQ with immediate feedback & concise explanation of why the correct option matches the material.
    3. **Smart Paraphrase Cloze:** Tolerant matching via shared `@mockza/domain` `checkClozeAnswer(...)` (case/punctuation/whitespace/inflection tolerant) + **"Hint"** and **"Show Answer"** buttons on both Web and Flutter.
    4. **Aloud Shadowing + Completion Card:** **Listen (`1.0x`/`0.8x`)** playback of the shadowing sentence + optional **"Practice Aloud"** check → Completion card crediting streak/study log + `"Use Saved Words in Today's Coach"` CTA!
  - **Searchable Study Library:** Filterable by type (`All | Links | Text | Photos | Audio`), shows CEFR pill, topic tags, Jalali/Gregorian date, and **Delete (`DELETE /v1/drop/:dropId`)** with undo/confirm.

### 3.8 My Weak Spots & Topics (`LinguisticGraphScreen`)
- **Helpful Day-1 Zero State:** Curated 1-tap Topic Chips + `"Run a 30s Speaking Upgrade"` and `"Start Today's 10-Min Coach"` launch cards.
- **Active Weak Spots:** Visual mastery progress bar (`0–100%`), real quote from learner's previous response, `EN`/`FA` examiner note, and **"Fix This Now →"** action deep-linking to Coach.
- **Mastered Habits:** Celebratory green mastery cards (`>=70%`).
- **Full Topic Controls (Web + Flutter Parity):** Pin, Mute/Remove, Curated 1-tap chips, and Custom Topic input on **both** Web and Flutter.

### 3.9 Exam-to-Coach Bridge (Closing the Loop Visually!)
- On **Writing & Speaking Exam Evaluation Review** screens (`EvaluationResultScreen.tsx` & `evaluation_review_screen.dart`), display a sleek post-exam callout card:
  > *"Smart Coach spotted your top focus habits from this attempt — practice them in 10 minutes tomorrow (or start now) →"*
- Links directly into `/coach` or `/progress/graph`, uniting **Mock Exams** and **Smart Coach** into one unmistakable learning loop.

---

## 4. Backend, AI & Infrastructure Engineering Changes

### 4.1 `P0` Upload & Media Fixes
1. **`backend/apps/api/src/routes/drop.ts`:**
   - Line `175`: change `uploadUrl: '/v1/uploads/proxy?...'` → **`uploadUrl: '/v1/uploads/signed-put?...'`**.
   - Add read-only entitlement & quota preflight inside `POST /v1/drop/presign-media` (`evaluateAdvancedFeatureQuota`) so unentitled/over-quota requests return `402`/`429` *before* upload.
   - Add `DELETE /v1/drop/{dropId}` scoped to `(dropId, accountKey, edition)` deleting the DB row + cleaning S3 media objects.
2. **Batch Multi-Image Presign (Web + Flutter):**
   - `http-linguistic.adapter.ts` & `linguistic_gateway.dart`: add `uploadDropMediaBatch(dropId, mediaKind, files[])` calling `POST /v1/drop/presign-media` **once** with all `1..4` files so each receives unique `item-0..item-3` keys, then upload each slot with progress reporting.
   - Flutter (`linguistic_gateway.dart`): use a clean unauthenticated `Dio` instance (no `Authorization` header) for `PUT uploadUrl`.
3. **Real Audio MIME & Duration Decoding:**
   - Web (`DropHubScreen.tsx`): map `file.type` / extension to exact `'audio/mp4' | 'audio/mpeg' | 'audio/wav' | 'audio/ogg'`, decode real duration via `<audio>` / `AudioContext` pre-upload, and reject `>180s` locally before network spend.

### 4.2 `P0` AI Speed, Real Coaching Quality & Resilient Streaming
1. **Collapse 3-Call Drop Waterfall into 1 Fast Multimodal Call (`ingest-dropped-content.ts`):**
   - Replace sequential `callDecisionsApi` + `callExtractionsApi` + `createChatCompletion` with a **single structured-JSON multimodal call** (`google/gemini-3.1-flash-lite` for Image/Audio, `deepseek/deepseek-v4.1-flash-1017` or fast flash for Text/URL) returning safety flag, CEFR, topic, title, 3–5 expressions with spans + `glossFa`, and full drill payload (`comprehensionExplanation` included!).
   - Reduces Drop latency from **25–45s → ~4–8s** and cuts AI cost by **~66%**.
   - Update worker `stageDetail` at each real phase (`Downloading media` → `Analyzing content` → `Building 2-min drill`) so the frontend 4-stage stepper reflects genuine progress.
2. **Instant Day-1 Starter Mission + Real Coaching Critique (`graph-and-missions.ts` + `plan-daily-mission.ts`):**
   - Add a high-craft **Curated Track × Topic Starter Mission Bank** (`EN` + `FA`) for cold-start users (`totalEvidenceCount === 0`) so `GET /v1/missions/today` returns in **`<150ms`** matched to their chosen onboarding topic!
   - For returning users with real bottlenecks, run fast LLM synthesis with a strict 10s budget and clean deterministic fallback (never hanging 24s).
   - Add `POST /v1/missions/today/refresh` (`topic` param, max 2/day) so users can swap today's topic on demand.
   - Upgrade `POST /v1/missions/{missionId}/complete`:
     - Replace canned boilerplate with a **single fast structured coaching call (`3–5s`)** that actually reads the learner's text or transcribes their spoken audio (`transcriptEn`), verifies target usage, returns 2 concrete inline sentence upgrades (`original → improved + whyEn/Fa`), and gives a Band 8+ model rewrite!
     - Dispatch `updateLinguisticGraphSignals` **asynchronously** (detached non-blocking worker/promise) after returning HTTP `200`, cutting completion response time from ~30s to ~4s.
3. **Register Shifter Text Mode (`register-shifter.ts` + `contracts` + `worker`):**
   - Extend `RegisterShifterRequestSchema` to accept either audio (`objectKey`, `durationSeconds`) OR text (`rawText`: 20–600 chars) and pass `sourceTextFallback` cleanly through worker → `shiftRegisterGraph` (which already supports `sourceTextFallback`!).
4. **SSE + 90s Resilient Job Watcher (`jobs.ts` + Web/Flutter):**
   - Increase `GET /v1/jobs/:jobId/events` SSE loop from `30` → `90` iterations and ensure `SSE_ENABLED=true` in live Docker env.
   - Create a shared `watchAdvancedJob(jobId, onStage)` helper on both Web and Flutter that uses SSE (when available) with automatic fallback to `1s → 2s → 3s` exponential polling up to **90 seconds**, updating live stage copy and surfacing actionable errors/retries — never failing silently.
   - Bump `ApiClient` per-request timeout to `35_000ms` for AI endpoints (`/v1/missions/*`, `/v1/register-shifter/*/verify-repeat`).
5. **Quota Status & `pg-boss` Hardening:**
   - Extend `GET /v1/quota/status` with `advancedQuota` summary (`shifterRemaining`, `dropsRemaining`, `audioDropAllowed`, `freeSampleUsed`, `isPro`).
   - Attach `boss.on('error', ...)` in API & Worker entrypoints so transient Postgres/DNS errors log cleanly without crashing the container.

### 4.3 `P1` Web First-Run Gate, Shared Domain Helpers & Audio TTS
- **Web `AppEntryGate` (`router.tsx`):** Check `attemptStore.getUserProfile()` on `/app` → route new users to `/welcome`, onboarded users to `/home`. Warm anonymous session non-blockingly in `DesktopSimulatorApp` mount.
- **Shared Domain `checkClozeAnswer` (`@mockza/domain` + Flutter parity):** Tolerant cloze checker (punctuation/case/whitespace/minor inflection tolerance) with golden parity vectors.
- **Unified Habit Credit (`recordCoachActivity`):** Completing Today's 10-Min Coach, Upgrade My Speaking, or a 2-Min Study Drill increments `daily_study_logs` on both Web (Dexie) and Flutter (Drift).
- **Real TTS Audio Service:** Web `SpeechSynthesis` helper (`1.0x` / `0.8x`) + Flutter TTS (`flutter_tts` or synthesized audio fallback) wired to every **Listen** button across Mission Warm-Up, Register Gear Card, and Drop Drill.

---

## 5. Phased Implementation Plan & Low-RAM Verification Matrix

### Phase 1 — `P0` Reliability, Upload `404` Fix & Speed Foundation
- Fix `drop.ts:175` (`/v1/uploads/signed-put`), batch multi-image presign (Web + Flutter), Flutter unauthenticated upload Dio, pre-presign quota guard, real audio MIME/duration validation, `pg-boss` error listener.
- Collapse `ingest-dropped-content.ts` to 1-call multimodal synthesis (`~4–8s`), add instant `<150ms` Day-1 starter missions + async graph update + real coaching critique on `completeMission` (including real spoken audio transcription), add Register Shifter text mode, and deploy SSE + 90s stage-aware job watcher.
- Add Web `AppEntryGate` (`/app` → `/welcome` for new users) + proactive anonymous session warm-up + `GET /v1/quota/status` advanced quota fields.
- **Phase 1 Exit Proof:** Automated live curl/script test against local/staging API confirming a brand-new user uploads real PNG + MP3 (`200`), loads Day-1 mission in `<1s`, completes text+audio mission with real critique, runs text+audio Speaking Upgrade, and gets a multi-image Drop drill with all distinct images intact.

### Phase 2 — High-Craft Onboarding, Adaptive Home, Live Coach Hub & Exam-to-Coach Bridge
- Implement 3-step Screening-First Onboarding (**Goal → Adaptive Exam/Score + 1-Tap Favorite Topics → Tailored First Win**) on Web & Flutter.
- Upgrade Public Landing (`/`) with clear Two-Pillar showcase (**Mock Exams + Smart Coach**).
- Upgrade Home & `/coach` into a live Command Center (mission status, topic switcher, upfront quota badge, quick-entry drop chips, zero jargon) + wire unified streak/study-week credit across all Smart Coach completions + add Exam-to-Coach bridge banner on Writing/Speaking evaluation review screens.

### Phase 3 — Studio-Grade Interactive Smart Coach Tools
- **Today's 10-Min Coach:** 3-Stage Studio (60s Warm-Up with Listen → Speak/Write with live green Target Radar & starter hint → Real Diff Critique + Band 8+ rewrite + 1-tap Vocab Deck save + Topic Refresh).
- **Upgrade My Speaking:** Voice + Text tabs, mic pre-check + waveform + playback preview, 3 sample prompts, working `1.0x`/`0.8x` Listen playback, visual Casual→Work→Band 8+ diff chips, and word-level Say-It-Aloud match feedback.
- **Learn From Anything:** Drag-and-drop + `Ctrl+V` + thumbnail preview grid with remove + audio player preview + upload `%` progress bar + 4-stage live stepper + background job completion toast + 3 one-click sample articles + guided 4-step `DropDrillScreen` (tolerant cloze, Listen + shadowing, active `examId` vocab save, completion summary) + searchable/deletable library.
- **My Weak Spots:** Actionable Day-1 zero state, curated 1-tap topic chips, mastery progress bars, `"Fix This Now"` deep-links, and full Pin/Mute parity on Flutter & Web.

### Phase 4 — Strict Low-RAM Verification, Live Smoke Suite & Production Rollout
Every build/test runs **strictly sequentially** after checking `free -m` (`NODE_OPTIONS="--max-old-space-size=768"`, `DART_VM_OPTIONS="--old_gen_heap_size=768"`, `--maxWorkers=1`, `--concurrency=1`, Astro builds capped at `320–384 MiB`):
1. **Backend Tests:** Unit + integration tests for batch multi-image presign & `PUT /v1/uploads/signed-put` (`PNG`, `WebP`, `MP3`, `M4A`), pre-presign `402`/`429`, `<150ms` Day-1 mission, real mission critique + async graph update, `DELETE /v1/drop/:id`, `POST /v1/missions/today/refresh`, and text-mode Speaking Upgrade.
2. **Flutter Full Gate:** `flutter gen-l10n`, `flutter analyze --no-pub --fatal-infos`, `flutter test --no-pub --concurrency=1` (including new-user 3-step onboarding → topic chips → Coach Hub → 3-stage Mission → multi-image Drop + 360×640 `2.0x` textScale overflow checks).
3. **Web Full Gate & Cross-Parity:** `PUBLIC_API_BASE_URL="" ./scripts/check_all.sh all` (TypeScript, ESLint, Vitest single-worker, dual GLB/IRN Astro builds, bundle isolation, asset budget, 350+ golden parity vectors including `checkClozeAnswer`).
4. **Playwright E2E (`--workers=1`):** GLB + IRN browser tests covering first-run `/app` → `/welcome` onboarding, multi-image drag/drop upload, 3-stage Mission, Voice+Text Speaking Upgrade, and 4-step Drill.
5. **Sequential Deploy & Live Brand-New User Verification:** Rebuild & restart `mockza-api-1`, `mockza-worker-1`, `sanjia-api-1`, `sanjia-worker-1`, `mockza-web-1`, `sanjia-web-1` sequentially, then run an end-to-end live verification check against both **`https://mockza.mehtea.ir`** and **`https://sanjia.mehtea.ir`**.
