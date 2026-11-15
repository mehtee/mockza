# Mockza Flutter Application — End-to-End Audit & Production Readiness Report

**Audit Date:** 2026-11-15  
**Scope:** Full Flutter codebase (`app/`), bundled seed assets (`app/assets/`), native platform configurations (`android/`, `ios/`, `web/`), backend contract alignment (`backend/`), UI/UX spec conformance (`docs/design.md`, `docs/UI-UX-TLDR.md`), compliance docs (`docs/compliance/`, `docs/HARDWARE_VERIFICATION_CHECKLIST.md`), and test suite (`app/test/`, `app/integration_test/`).

---

## Executive Verdict: Not Ready for Store Publication or End-User Release

While Mockza has a **clean foundational skeleton** (strict layer boundaries in `core/`, well-structured Drift SQLite schema + cross-platform Web `sqlite3.wasm`/IndexedDB persistence, a solid pure-Dart SM-2 scheduler & objective answer normalizer, and a dark/light design token library), **the application layer above the database is largely an interactive UI prototype / static wireframe**.

When a real user opens the Web app or mobile build today:
- **Onboarding is skipped completely** (app opens straight to `/home`).
- **All 4 exam simulators (`Speaking`, `Writing`, `Reading`, `Listening`) run on hardcoded Dart mockups** rather than real tests served from Postgres + self-hosted S3, use fake timers/waveforms, and have broken scoring (`rawCorrect = answers.length`, giving 100% for typing any gibberish!). Meanwhile, junk static seed JSONs (`app/assets/seed/`), Python generator scripts, static CDN pack files (`backend/content-pipeline/packs/`), and Cloudflare R2 `.example.com` placeholders clutter the repo without wiring Postgres or SeaweedFS S3 properly.
- **No AI grading, microphone recording, audio playback, account auth, exam syncing, or offline sync queue ever works end-to-end.** Even if wired as-is, the Flutter HTTP client hits wrong URLs (`/v1/audio/presign`, `/v1/explain`, `/v1/quota`, `/v1/content/flag`), sends zero `Authorization` headers, uses non-UUID `attemptId`s rejected by backend Zod validation, and mis-parses backend job statuses & response keys.
- **Evaluation Review shows a single hardcoded Band 6.5 Writing mockup** (`att-demo-01`) regardless of what exam or attempt you just finished.
- **Native store & Web runtime requirements are missing**: Android lacks `INTERNET` & `RECORD_AUDIO` permissions; iOS lacks `NSMicrophoneUsageDescription`; neither platform implements the declared `com.mockza/audio_session` MethodChannel; RevenueCat is never initialized (`Purchases.configure`) and crashes on Web; and the Web container runs over plain HTTP (`45280`), where browsers block microphone `getUserMedia` and `WebCrypto`.

### Readiness Scorecard

| Layer / Area | Status | Summary |
| :--- | :--- | :--- |
| **Core Domain Logic (`app/lib/core/`)** | **Mostly Ready** | `Sm2Scheduler`, `LocalObjectiveScorer`, `BandConversionTable`, `StudyMetricsCalculator`, and `Result/Failure` are well-tested pure Dart (though non-IELTS exams are metadata-only). |
| **Local Database (`app/lib/data/`)** | **Partial** | 10 Drift tables + cross-platform SQLite (native WAL + Web `sqlite3.wasm`/IndexedDB) work, but `OutboxSyncQueue` & `AudioRecordings` have **0 DAO/Repository methods**, `ProgressDao` overwrites instead of adding daily study seconds, and `VocabDao` logs the wrong day serial. |
| **Networking & Auth (`app/lib/services/`)** | **Broken** | Zero anonymous auth bootstrap (`/v1/auth/anonymous`), wrong REST endpoint URLs, mismatched JSON request/response schemas, missing S3 binary `PUT`, dead `AssetDownloadGateway` & `TelemetryGateway`. |
| **Navigation & Onboarding** | **Broken** | No first-run `/onboarding` guard; `/practice/setup/:skill` and `/practice/full-mock/:mockId` are routed back to `PracticeHubScreen`; `wantDiagnostic` toggle does nothing. |
| **Exam Simulators (4 Skills)** | **Mocked / Broken** | Speaking mic/waveform is fake math; Listening never plays `listening_s01.m4a` and gives full marks for any input; Reading repeats one hardcoded Cetacean passage and gives full marks for any input; Writing omits SVG charts, General Training tasks, and AI grading. |
| **Evaluation, Vocab & Progress** | **Mocked / Buggy** | Review screen is 100% static `att-demo-01`; `VocabReviewScreen` skips every 2nd card & has silent speaker icon; `ProgressScreen` ignores timeframe filters, invents fake trend lines, and `ProgressSkillScreen` is static mock. |
| **Settings & Paywall / IAP** | **Stubbed / Crash-Prone** | Account linking (`v1.1`), cache cleanup, and app version are fake stubs; `wipeAllData()` skips 4 tables + never calls `DELETE /v1/account`; `RevenueCatBillingGateway` crashes on Web and lacks `Purchases.configure`; `IranBillingGateway` is a no-op stub. |
| **Android / iOS / Web Packaging** | **Not Store-Ready** | Missing OS permissions (`RECORD_AUDIO`, `INTERNET`, `NSMicrophoneUsageDescription`), debug release signing, no flavor configs, default Flutter icons/HTML template, no HTTPS/CORS for Web mic/S3. |
| **L10n & Iran Edition (`irn`)** | **Incomplete** | `app_en.arb` has only 20 keys while UI strings are hardcoded across screens; zero Persian (`fa`) translations/RTL; `.example.com` placeholder domains. |

---

## 1. P0 Critical Store & Core-Loop Blockers (Must Fix Before Hand-Off)

### 1.1 First-Time Onboarding Is Completely Bypassed
- **Symptom:** Opening the app for the first time lands directly on Home (`/home`).
- **Evidence:**
  - `app/lib/routing/app_router.dart:34` sets `initialLocation: AppRoutes.home` with **zero** `redirect` callback inspecting `UserProfiles.onboardingCompleted`.
  - `ProfileRepository.completeOnboarding` (`app/lib/data/repositories/profile_repository.dart:131-153`) exists, and `OnboardingNotifier` sets `onboardingCompleted = true`, but nothing ever routes un-onboarded users to `/onboarding`.

### 1.2 Zero Device Authentication & Token Lifecycle (`401 Unauthorized` on Every API Call)
- **Backend requirement:** `backend/apps/api/src/middleware/auth.ts:35-85` rejects requests without `Authorization: Bearer <HS256 JWT>` (or raw UUID fallback in non-JWT paths). Tokens are issued by `POST /v1/auth/anonymous` (`backend/apps/api/src/routes/auth.ts:39-78`) and guarded by `createAttestationMiddleware` (`backend/apps/api/src/middleware/attest.ts`) when `APP_ATTEST_ENFORCED=true`.
- **Client reality:**
  - `dio_client.dart:28-31` calls `readAccessToken()`, **but nothing in the entire Flutter app calls `POST /v1/auth/anonymous` or `SecureIdentityService.saveAccessToken(...)`**. Every authenticated endpoint immediately fails with `401`.
  - `FlutterSecureStorageGateway` (`app/lib/services/secure_identity_service.dart:38-74`) catches `on Object` and falls back to an **in-memory static map** (`_fallbackStore`). On plain-HTTP Web where `WebCrypto` (`SubtleCrypto`) is unavailable, device credentials & tokens vanish on every browser reload.
  - Nothing reads `GET /v1/auth/challenge` or sends `x-app-attest` headers (Play Integrity / App Attest).

### 1.3 Client–Backend API Contract & Schema Mismatches (`HttpGradingGateway`)
Even if authentication were wired, `HttpGradingGateway` (`app/lib/services/grading_gateway.dart`) fails against `backend/apps/api/src/routes/` and `backend/packages/contracts/src/schemas.ts`:

| Operation | Flutter Client Sends / Calls | Backend Expects / Exposes | Result |
| :--- | :--- | :--- | :--- |
| **Audio Presign URL** | `POST /v1/audio/presign` (`grading_gateway.dart:136`) | `POST /v1/uploads/presign` (`uploads.ts:26`) | **404 Not Found** |
| **Audio Binary Upload** | *No upload method exists anywhere in client* | Client must HTTP `PUT` `.m4a` bytes to `uploadUrl`; backend `evaluate.ts:249` verifies object in S3 | **404 `upload_not_found`** |
| **Speaking Presign `contentType`** | Hardcodes `'audio/mp4'` (`grading_gateway.dart:141`) | Schema requires `z.literal('audio/mp4')` (`schemas.ts:87`), whereas Web browsers typically record `audio/webm` / `audio/ogg` (Opus) | **Web incompatibility** |
| **Speaking Enqueue Body** | `{ attemptId, packId, audioObjectKey, partIndex }` (`grading_gateway.dart:166-171`) | `EvaluateSpeakingRequestSchema` requires `{ attemptId (uuid), packId, examId, partSequence, turns: [{ partIndex, promptText, objectKey, durationMs }] }` (`schemas.ts:114-132`) | **400 `validation_error`** |
| **Poll Job Status Check** | Checks `status == 'pending' \|\| 'evaluating' \|\| 'processing'` (`grading_gateway.dart:110-112, 195-197`) & reads `data['error']` | Backend emits `'queued'`, `'processing_audio'`, `'transcoding'`, `'evaluating'`, `'repairing'`, `'completed'`, `'failed'` (`schemas.ts:260-268`) & `errorCode` (`schemas.ts:271`) | **Immediately treats `'queued'` jobs as finished with null result -> fake Band 6.0!** |
| **Explain Question** | `POST /v1/explain` with `{ questionId, learnerAnswer, correctAnswer, passageContext }` (`grading_gateway.dart:221-227`) | `POST /v1/evaluate/explain-question` with `{ packId, packVersion, questionId, skill, questionType, userAnswer }` (`evaluate.ts:332`, `schemas.ts:229-238`) | **404 / 400 error** |
| **Quota Status** | `GET /v1/quota`; reads `speakingRemaining` & `writingRemaining` (`grading_gateway.dart:239-247`) | `GET /v1/quota/me` (`quota.ts:20`); returns `{ isPro, freeDiagnosticUsed, dailySpeakingUsed, dailySpeakingLimit, dailyWritingUsed, dailyWritingLimit, monthlyUsed, monthlyLimit, ... }` (`schemas.ts:278-291`) | **404 Not Found** & wrong JSON keys |
| **Flag Question** | `POST /v1/content/flag` (`grading_gateway.dart:261`) | `POST /v1/feedback/question-flag` (`feedback.ts:22`) | **404 Not Found** |
| **Attempt IDs** | Simulators construct `'att-speaking-demo-01'`, `'att-writing-...'`, `'att-reading-...'`, `'att-listening-...'` | `EvaluateWritingRequestSchema`, `EvaluateSpeakingRequestSchema`, `PresignUploadRequestSchema` strictly enforce `z.string().uuid()` (`schemas.ts:80,102,125`) | **400 `validation_error`** |
| **Eval Result Parsing** | Reads `criterionCode`, `criterionLabel`, `startSec`/`endSec`, `kind`/`originalText`/`startOffset`/`endOffset`, `original`/`upgraded`/`collocation`, `drillId`/`weaknessCode`, `modelRewrite` as `String?` (`grading_gateway.dart:274-426`) | `EvaluationOutputSchema` emits `code`, `label`, `startMs`/`endMs`, `type`/`suggestion`/`rationale`, `id`/`term`/`ipa`/`contextSentence`/`paraphrases`/`bandRationale`, `drillType`/`weakestCriterionCode`, `modelRewrite` as nested object `{ targetBandDelta, title, rewrittenText, preservedIdeasNote }` (`schemas.ts:141-227`) | **Parsed fields silently fall back to empty strings / `TR` / Band `6.0` / type cast crash on `modelRewrite`** |

- **Additional Infra Upload Blocker (`compose.yaml:18`):** `S3_PUBLIC_ENDPOINT` defaults to `http://127.0.0.1:45833` and nginx (`app/nginx.conf`) only proxies `/v1/` and `/openapi.json`. Any mobile device or remote Web browser (`http://153.76.122.172:45280`) receiving a `127.0.0.1:45833` presigned URL cannot upload audio to S3/SeaweedFS at all (plus Web cross-origin `PUT` lacks CORS config).

### 1.4 Durable Offline Outbox Sync Is Completely Missing
- `OutboxSyncQueue` is defined in `core_tables.dart:324-339` and registered in `app_database.dart:22`, and even has a table-level test (`outbox_queue_test.dart`), **but there are ZERO usages of `OutboxSyncQueue` anywhere in DAOs, repositories, providers, or services**.
- `AudioRecordings` (`core_tables.dart:122-147`) is declared in `AttemptDao`'s `@DriftAccessor(tables: [...])`, **yet `AttemptDao` and `AttemptRepository` have zero methods to insert, query, update `remoteObjectKey`, or delete audio recording metadata**.
- **Impact:** Offline speaking/writing submissions are never queued for retry, audio uploads never resume on reconnect, and `failedRetryable` attempts cannot actually be retried.

### 1.5 Native Platform Permissions, Audio Channels & Release Configs Missing
- **Android (`app/android/app/src/main/AndroidManifest.xml:1-45`):**
  - **Missing `<uses-permission android:name="android.permission.INTERNET" />`**: Flutter injects `INTERNET` automatically only in `src/debug/`; **release APKs/AABs will have zero network access**.
  - **Missing `<uses-permission android:name="android.permission.RECORD_AUDIO" />`**: Microphone permission cannot be requested or granted in Speaking Simulator.
  - Lowercase `android:label="mockza"`.
- **Android Build (`app/android/app/build.gradle.kts:17-38`):**
  - Signs `release` with `signingConfigs.getByName("debug")` (`TODO: Add your own signing config`).
  - No `productFlavors` separating Global (`glb`) vs Iran (`irn`) builds or distinct `applicationId`s.
- **iOS (`app/ios/Runner/Info.plist:1-70`):**
  - **Missing `NSMicrophoneUsageDescription`**: Opening the mic on any real iPhone/iPad will trigger an immediate OS `TCC` crash!
  - **Missing `UIBackgroundModes` (`audio`)**: Fails `HARDWARE_VERIFICATION_CHECKLIST.md` Gate 2 (background/lockscreen playback during Listening).
  - Bundle ID is hardcoded to `com.mockza.mockza` (`project.pbxproj:386,567,589`) without Global vs Iran schemes/configurations.
- **Native MethodChannel Unimplemented:**
  - `PlatformAudioChannel` (`app/lib/services/native/platform_audio_channel.dart:9`) invokes `configureRecordingSession` on `MethodChannel('com.mockza/audio_session')` and silently swallows `MissingPluginException` (`lines 19-21`).
  - Both `MainActivity.kt` (`app/android/app/src/main/kotlin/com/mockza/mockza/MainActivity.kt`) and `AppDelegate.swift` (`app/ios/Runner/AppDelegate.swift`) / `SceneDelegate.swift` have **zero implementation** for `com.mockza/audio_session` — and `PlatformAudioChannel` is never called by any feature either.

### 1.6 Billing & Paywall Non-Functional / Crash-Prone
- **`Purchases.configure(...)` is never called anywhere** (no RevenueCat API key in `EditionConfig` or `bootstrap.dart`).
- **`RevenueCatBillingGateway`** (`app/lib/services/billing_gateway.dart:51-123`):
  - Only catches `PlatformException`. On **Flutter Web**, `purchases_flutter` throws `MissingPluginException` / `UnimplementedError` when calling `getCustomerInfo` / `getOfferings` / `restorePurchases` / `purchase` -> unhandled error on Web Paywall!
  - `purchasePackage` (`lines 105-107`) calls `.firstWhere((p) => p.identifier == packageId)` **without `orElse`**, throwing `StateError` instead of returning `ValidationFailure` if an offering isn't loaded.
- **`IranBillingGateway`** (`billing_gateway.dart:126-143`) is an explicit stub returning `Ok(false)` / `Ok(<StorePackage>[])` with zero Cafe Bazaar / Myket SDK integration.
- **SKU & Pricing Conflict:** `PaywallNotifier.defaultStorePackages` hardcodes `$5.99` / `$14.99` / `$29.99` USD for all locales, while `docs/compliance/aso_listings.md:38-40`, `POST_LAUNCH_GATES.md:29-31`, and `HARDWARE_VERIFICATION_CHECKLIST.md:52-55` specify `$9.99` (`mockza_cram_weekly`), `$19.99` (`mockza_pro_monthly`), `$44.99` (`mockza_quarterly`).
- **Paywall Purchase Flow Bug:** `PaywallNotifier.purchaseSelected()` (`paywall_notifier.dart:122`) reports `'Purchase completed.'` even when `purchasePackage` returns `Ok(false)`, and never updates `UserProfiles.isPro` in SQLite or notifies `SettingsNotifier` / quota state.

### 1.7 Broken Scoring Logic in Reading & Listening Simulators
- In `ReadingSimScreen` (`reading_sim_screen.dart:295-308`) and `ListeningSimScreen` (`listening_sim_screen.dart:246-257`):
  - **Both compute `final rawCorrect = state.answers.length;`** — they **never compare learner answers against answer keys** and **never call `LocalObjectiveScorer.score(...)`** (`app/lib/core/exams/local_objective_scorer.dart:137-187`)! Typing `"asdf"` into every blank earns 100% / Band 9.0.
  - Submitted payload discards actual user answers and saves only `'{"rawScore": $rawCorrect}'`, making answer-level review impossible.

---

## 2. Feature-by-Feature & Screen-by-Screen Detailed Audit

The design docs (`docs/design.md`, `docs/ui_designs/README.txt`) define **24 designed views across 13 feature modules**. Below is the verified state of every module.

### 2.1 Onboarding (`OnboardingScreen`, `OnboardingNotifier`)
- **Unreached on First Launch:** Router starts at `/home` instead of gating on `onboardingCompleted` (`app_router.dart:34`).
- **Diagnostic Toggle Is Dead:** Tapping `"Start with a 15-min Diagnostic Test"` (`wantDiagnostic`) and finishing `"Get Started"` (`onboarding_screen.dart:295-359`) always runs `context.go(AppRoutes.home)` — it never launches a diagnostic flow.
- **Broken Multi-Exam Score Scale & False Waitlist Promise:**
  - Selecting PTE (`10–90`) or TOEFL (`0–120`) shows `"Join waitlist."` (`onboarding_screen.dart:107-119`), **yet never joins a waitlist** and enters the same IELTS-only Home/Practice experience.
  - `_GoalSetupStep` (`onboarding_screen.dart:246`) formats target scores with `'Band ${state.targetBand.toStringAsFixed(1)}'` and half-point `divisions` even for PTE/TOEFL/DET.
- **No Loading Indicator:** `"Get Started"` button ignores `state.isSaving`.

### 2.2 Navigation Shell & Routing (`AppRouter`, `AppRoutes`)
- **Missing Setup & Full Mock Screens:** `app/lib/routing/app_router.dart:98-105` maps BOTH `AppRoutes.practiceSetup` (`/practice/setup/:skill`) and `AppRoutes.practiceFullMock` (`/practice/full-mock/:mockId`) straight to `const PracticeHubScreen()` — neither screen exists!
- **Deep Link / Cold Start Safety:** No redirect logic handles missing profiles, invalid attempt IDs, or active exam guard restoration.

### 2.3 Home Dashboard (`HomeScreen`, `HomeNotifier`)
- **Fabricated Day-1 Streak Bug:** `HomeNotifier._listenToAttempts` (`home_notifier.dart:192-194`) runs:
  ```dart
  final studyDays = attempts.map((a) => SerialDay.fromUtcDateTime(a.updatedAt)).toSet()..add(today);
  ```
  Adding `today` unconditionally means every brand-new user with **0 attempts** gets `streakDays = 1` and Today marked complete on `StudyWeekStrip`, violating `design.md` honest-data rules. It also ignores `DailyStudyLogs` from `ProgressRepository` completely.
- **Clamped Exam Countdown:** `home_notifier.dart:128,142` clamps `(targetDateSerial - todaySerial).clamp(0, 3650)`, showing `"Exam day!"` indefinitely even if the exam date passed months ago.
- **Stale Hero Progress on Preference Change:** Updating `targetBand` or `track` in `_loadProfile` (`home_notifier.dart:130-147`) does not recalculate `estimatedSummary` (`targetBand` / `progressToTarget`).
- **Header Switcher & CTAs:** Tapping the exam pill in `BrandHeader` (`home_screen.dart:86`) pushes `/onboarding` instead of opening a quick switcher wired to `HomeNotifier.setTrack`. MetricHero `"Start Diagnostic"` (`home_screen.dart:131-132`) only opens `/speaking/ielts-speaking-01`, and skill cards only launch fixed single routes.

### 2.4 Practice Hub (`PracticeHubScreen`, `PracticeHubNotifier`)
- **Mode Toggle Is Discarded:** In the Test Setup bottom sheet (`practice_hub_screen.dart:360-462`), `_TestSetupContentState.isExamMode` only sets local widget state — clicking Start just pushes `route` without passing `Exam Mode` vs `Study Mode` (`usedStudyMode`) to any simulator!
- **All 5 Catalog Cards Hardcoded:** `installedExamPacksProvider` is not watched or displayed in `PracticeHubScreen`.
- **Missing Capabilities (`design.md` Sec. 6 & `UI-UX-TLDR.md`):**
  - No remote catalog fetch (`GET /v1/catalog/manifest`) or download/verify/delete pack UI (`AssetDownloadGateway` has 0 callers).
  - No offline cache size or `Offline Cached ✓` indicators backed by real `ExamPacks` rows.
  - No Academic vs General Training switcher or Full Mock Exam runner.

### 2.5 Speaking Simulator (`SpeakingSimScreen`, `SpeakingSimNotifier`, `AudioLevelMeter`)
*Directly matches the user's observation ("microphone testing in prep mode is not showing anything...").*
- **100% Mocked Audio & Waveform:**
  - Never calls `AudioRecorderGateway`, `AudioPlayerGateway`, `PlatformAudioChannel`, or `GradingGateway`.
  - **Flat Prep Waveform:** `AudioLevelMeter` (`audio_level_meter.dart:96-98`) explicitly forces all bars to flat `0.15` height whenever `!isRecording`. Even if microphone permissions are granted, speaking during Prep / Pre-flight Check produces **zero waveform movement**. `isSilent`, `isClipping`, and `hasPermission` warnings (`lines 117-129`) are never computed or supplied.
  - **Fake Recording Waveform:** `SpeakingSimNotifier` computes synthetic amplitude `0.25 + ((state.remainingSeconds % 5) * 0.12)` once per second instead of sampling `AudioRecorderGateway.watchAmplitude()` (note `record` exposes ~50ms amplitude streams that must be normalized cleanly from dBFS `-60..0` to `0.0..1.0`!).
- **Broken Test Sequencing & Timers:**
  - `SpeakingSimNotifier.build()` does not start the 60s Part 2 preparation timer automatically (`startPreparation()` is never called on load).
  - Seed asset `app/assets/seed/speaking/ielts_speaking_starter.json` (which contains structured Part 1, Part 2 cue card, and Part 3 discussion prompts) is completely ignored; only one hardcoded Part 2 prompt is shown, and Parts 1 & 3 cannot be stepped through in UI (`selectPart` has no UI trigger).
  - No spoken examiner prompt TTS/audio playback, no prep scratchpad notes UI (`UI-UX-TLDR.md` Sec. 2.B), no audible chime between prep & speak, no pre-mic AI data transmission disclosure dialog, and no permission-denied `"Open App Settings"` recovery state.
- **Broken Persistence & Submission:**
  - Never creates/stores an `.m4a` file or `AudioRecordings` DB row.
  - Submit (`speaking_sim_screen.dart:149`) saves hardcoded non-UUID `attemptId = 'att-speaking-demo-01'` and `'{"completedPart": 2}'` offline and never uploads audio or enqueues AI grading.

### 2.6 Writing Simulator (`WritingSimScreen`, `WritingSimNotifier`)
- **Wrong / Missing Prompt Content & Chart:**
  - Ignores `app/assets/seed/writing/ielts_writing_starter.json` and `app/assets/seed/writing/task1_chart.svg`.
  - Instead of rendering `task1_chart.svg` (there isn't even an SVG package like `flutter_svg` in `pubspec.yaml`!), `writing_sim_screen.dart:217,347` renders a hardcoded 4-rectangle widget `_AcademicChartPlaceholder`, and `writing_sim_notifier.dart:184` stores the literal placeholder string `'<svg viewBox="0 0 400 200">...</svg>'`.
  - `WritingTaskType.task1General` (`writing_sim_notifier.dart:186-198`) falls into the `else` branch and shows a 40-minute Academic Task 2 essay instead of a 20-minute General Training letter task.
- **Timer & Draft Persistence Bugs:**
  - `TimerBar` in `writing_sim_screen.dart:182` hardcodes `totalSeconds: 3600` instead of `state.totalSeconds` (`1200` / `2400`).
  - `WritingSimNotifier` (`writing_sim_notifier.dart:132,154`) hardcodes a single global `attemptId = 'att-writing-active'` and `packId = 'writing-pack-01'`. Switching Task 1 <-> Task 2 (`selectTaskType`) keeps the old `_controller.text` / overwrites the same draft row.
  - Because `saveWritingDraft` creates an `ExamAttempts` row for `'att-writing-active'` (`attempt_repository.dart:230-237`), while `WritingSimScreen` submits under `'att-writing-${widget.taskId}'` (`line 284`) **and never calls `deleteWritingDraft`**, every writing session leaves a permanent orphan `'att-writing-active'` (`inProgress`) row in Attempt History!
- **Corrupted JSON & Missing AI Grading:**
  - `writing_sim_screen.dart:290` builds submission JSON via unescaped string interpolation (`'{"essayText": "${_controller.text}"}'`), producing invalid JSON whenever the essay contains quotes, backslashes, or newlines.
  - Never calls `GradingGateway.enqueueWritingEvaluation(...)` and never enforces Exam Mode assistive input lock (`autocorrect: false`, `enableSuggestions: false`) or submits/locks automatically when timer hits `0`.

### 2.7 Reading Simulator (`ReadingSimScreen`, `ReadingSimNotifier`)
- **Ignores Seed Pack & Repeats One Hardcoded Passage:**
  - Never loads `app/assets/seed/reading/ielts_reading_starter.json` (`287` lines, 6 paragraphs, 13 questions with `acceptedAnswers` and `evidence` quotes/rationales).
  - Hardcodes 4 short Cetacean paragraphs and ignores `passageIndex`, so switching Passage 1 -> Passage 2 -> Passage 3 shows the exact same text.
- **Count Mismatches & Broken Navigation:**
  - Header shows `answeredCount/40`, bottom bar draws 13 static untappable dots, while `_QuestionsPane` only renders 3 hardcoded questions (`1..3`).
- **Dead Annotation Toolbar:**
  - Highlight color circles only toggle `activeHighlightColor` in memory; users cannot select passage text, create highlights, add marginal notes, or persist anything to `ReadingAnnotations`. `AnnotatedText` component is unused.
- **Fake AI Explainer & Broken Scoring:**
  - `_showAskAiSheet` displays one hardcoded Cetacean explanation for every question without calling `GradingGateway.explainQuestion`.
  - Submit (`reading_sim_screen.dart:295-308`) assigns `rawCorrect = state.answers.length` instead of calling `LocalObjectiveScorer.score`, reuses hardcoded `'att-reading-$packId'`, and throws away individual answers.

### 2.8 Listening Simulator (`ListeningSimScreen`, `ListeningSimNotifier`)
- **Zero Audio Playback:**
  - Bundled audio `app/assets/seed/audio/listening_s01.m4a` (`1.8 MB`) and `app/assets/seed/listening/ielts_listening_starter.json` (287 lines of dialogue script with `startMs`/`endMs` timestamps + 10 questions with `acceptedAnswers` and `distractorNote`) are **never loaded**.
  - `ListeningSimNotifier` never calls `AudioPlayerGateway` — it hardcodes `isPlaying: true`, `currentPosition: 00:45`, `totalDuration: 05:30` permanently.
- **UI & Controller Bugs:**
  - Header says `Questions 1–6`, bottom strip shows `1..10`, yet `_QuestionsFormView` renders only 4 form inputs (`1..4`). Switching Section `1..4` changes nothing.
  - `listening_sim_screen.dart:398` creates a new `TextEditingController` inside `build()` on every rebuild (causing cursor jumps/leaks).
  - Synced transcript shows 4 hardcoded lines instead of loaded timestamps, does not use `TranscriptSegmentWidget`, and never enforces Exam Mode rules (linear single-play, disabled pause/seek, pre-audio reading timer) vs Study Mode controls (`0.85x / 1.0x / 1.25x` & transcript toggle).
  - **Broken scoring:** `rawCorrect = state.answers.length` + `'att-listening-$packId'`.

### 2.9 Evaluation Review (`/results/:attemptId`, `EvaluationReviewScreen`, `EvaluationReviewNotifier`)
- **100% Hardcoded Demo Screen:**
  - `EvaluationReviewScreen` accepts `attemptId` (`evaluation_review_screen.dart:26`) **and ignores it**.
  - `EvaluationReviewNotifier.build()` always returns a static Band `6.5` Writing result (`'att-demo-01'`) regardless of which skill or attempt the user submitted (`evaluation_review_notifier.dart:102-142`).
  - **Consequence:** Submitting Speaking, Reading, Listening, or a new Writing essay and opening `/results/:attemptId` always shows the same fake Writing essay critique.
- **Missing Skill-Specific Views & Actions:**
  - No database load (`AttemptRepository.getAttemptById` / watch attempt) or background polling / SSE streaming (`GET /v1/jobs/:jobId` or `/events`) showing multi-stage AI progress (`Saving audio -> Evaluating -> Generating rewrite`).
  - No `SpeakingEvaluationResult` view (own audio player bar synced to `TranscriptSegmentWidget` with pause/filler/grammar badges, retry failed upload button).
  - No `Reading`/`Listening` question-by-question answer review with `EvidenceLink` jump-to-passage and `"Ask AI Why?"`.
  - Essay annotations don't use `AnnotatedText` with 1-tap `Save Word` into `VocabRepository`.
  - `_CompareTab` (`evaluation_review_screen.dart:445-476`) hardcodes static `Attempt #1 (3 days ago)` vs `Today` deltas.
  - Share button (`line 69`) is an empty callback `onPressed: () {}`.

### 2.10 Micro-Drills (`MicroDrillsScreen`, `MicroDrillsNotifier`)
- **Route Parameter Ignored:** `MicroDrillsScreen.drillId` is never passed to `notifier.loadDrill(drillId)`, so opening a specific weakness drill always shows the default drill (`drill-cc-trans-01`), and the countdown timer doesn't auto-start unless explicitly triggered.
- **Hardcoded 2-Drill Bank & Wrong Score Scale:** Only 2 drills exist in Dart code (`micro_drills_notifier.dart`). Completing a drill converts accuracy directly into `(score / total) * 9.0` (0/5 = Band 0.0) and never logs `DailyStudyLogs`.

### 2.11 Vocabulary SRS (`VocabularyScreen`, `VocabReviewScreen`, `VocabWordDetailScreen`, `VocabDao`)
- **Critical Double-Advance Bug in Flashcard Review:**
  - `VocabDao.updateSchedule` updates `dueDay` -> `dueVocabCardsProvider` stream immediately removes the rated card from index `0`, **AND** `VocabularyNotifier.rateCard` (`line 65`) increments `activeCardIndex + 1`. Result: **every second due flashcard is skipped!**
- **Review Session UX Bugs:**
  - `VocabReviewScreen` (`line 31`) checks `asData?.value ?? []` and flashes `"Flashcard Session Done!"` while SQLite is still loading.
  - `VocabularyNotifier` state (`activeCardIndex`, `reviewedCount`, `isRevealed`) is not reset cleanly when starting a new review session.
  - `"Review Ahead"` CTA on `VocabularyScreen` (`line 170`) pushes `VocabReviewScreen` which still watches `dueVocabCardsProvider` (empty when due == 0).
- **220 Seeded Cards Hidden + Wrong Review Day Logged:**
  - `ielts_vocab_seed.json` seeds **320 cards**, yet `VocabDao.watchAllCards` / `VocabRepository.watchAllCards` (`vocab_dao.dart:25`, `vocab_repository.dart:98`) defaults to **`limit = 100`**, hiding 220 seeded words from the UI!
  - `VocabDao.recordReviewTransaction` (`vocab_dao.dart:92`) writes `reviewedDaySerial: dueDay` (the **future** due day!) instead of today's `SerialDay`, corrupting review history analytics.
  - `VocabularyScreen` uses eager `SliverChildListDelegate` instead of `SliverList.builder` and lacks topic filter chips (`environment`, `technology`, etc. — the only tags seeded cards have!).
- **Word Detail Gaps:** `VocabWordDetailScreen` (`line 142`) renders a speaker/headphone icon beside the IPA with **no `onTap` handler and no pronunciation audio/TTS**; briefly renders fake `"Substantiate"` fallback while async card lookup completes; no edit/delete or manual custom card creation.

### 2.12 Progress Analytics & History (`ProgressScreen`, `ProgressSkillScreen`, `ProgressAttemptsScreen`, `ProgressNotifier`)
- **`ProgressScreen` Violations:**
  - Watches `timeframeProvider` (`7D / 30D / 90D / ALL`), **never filters `attempts` or trend points by selected timeframe**.
  - Hardcodes `targetBand: 7.5` (`lines 57, 106`) instead of reading user profile `targetBand` and exam scale.
  - `_buildTrendPoints` (`lines 377-390`) fabricates fake baseline trend points (`Start: 6.0 -> Today: 6.5`) when `attempts.isEmpty`, violating `design.md` honest empty-state rules (`TrendChart` itself has a proper empty state that is bypassed!).
  - Heatmap ignores `recentDailyStudyLogsProvider` (`DailyStudyLogs`), while `ProgressDao.upsertDailyLog` (`progress_dao.dart:31-32`) + `ProgressRepository.logTodayActivity` (`progress_repository.dart:55-70`) **overwrites** `studySeconds` & `completedItems` instead of incrementing, and is never called by any simulator or drill!
- **`ProgressSkillScreen`:** 100% hardcoded static mock (`Band 7.0`, `Target Band 7.5`, static criteria bars, static `drill-cc-trans-01`), ignoring the `skill` parameter and actual attempts.
- **`ProgressAttemptsScreen`:** Retry button (`lines 188-192`) only shows a fake SnackBar; filter chips omit `Vocabulary`; list reads `recentAttemptsProvider` (fixed `limit: 50`) without cursor-based "Load more" using `AttemptRepository.fetchHistoryPage`.
- **`ProgressNotifier`:** Contains hardcoded `(6.5, 6, 7, 7)` mock values unused anywhere.

### 2.13 Settings, Privacy & Data Deletion (`SettingsScreen`, `SettingsNotifier`)
- **Account Linking Is a Stub:** Tapping `"Link Apple / Google Account"` (`settings_screen.dart:284-294`) shows SnackBar `'Account linking available in v1.1'` instead of OAuth + `POST /v1/auth/link`.
- **Storage Cache Card Is Fake:** Displays hardcoded `'1 starter pack cached (~2.1 MB)'` and `'Clear Cache'` shows `'Cache already clean.'` without measuring or deleting cached packs/audio (`settings_screen.dart:318-335`).
- **Hardcoded App Version:** Displays `'Mockza v1.0.0 (Build 10001)'` (`line 422`) instead of reading runtime version metadata.
- **Exam Scale Overwrite Bug:** `SettingsNotifier.setTargetBand` (`settings_notifier.dart:131`) clamps to `5.0..9.0` (breaking PTE/TOEFL/DET), and `setExamModule` (`lines 156-158`) overwrites `examId` with `'ielts_academic'`/`'ielts_general'`.
- **Incomplete Data Deletion (Privacy / Store Compliance Risk):** `SettingsNotifier.wipeAllData()` (`settings_notifier.dart:201-220`):
  - Leaves `audioRecordings`, `dailyStudyLogs`, `examPacks`, and `outboxSyncQueue` untouched.
  - Never calls `SecureIdentityService.clearCredentials()` and never deletes `deviceId`.
  - Never deletes `.m4a` audio files on disk / IndexedDB.
  - Never calls backend `DELETE /v1/account` (`backend/apps/api/src/routes/account.ts:32`), **directly contradicting what `docs/compliance/google_play_data_safety.md:11` declares to Google Play**.
  - Never re-seeds bundled starter content or routes back to `/onboarding`.

---

## 3. Data, Assets, Design Kit & Cross-Edition Gaps

### 3.1 Conflicting Pack Identifiers Across Four Layers
Packs cannot resolve cleanly across router, local DB, seed files, and backend API because **4 incompatible naming schemes** are used:
1. `AppRoutes` (`routes.dart:75-88`): `ielts-speaking-01`, `ielts-writing-t2-01`, `ielts-reading-acad-01`, `ielts-listening-sec1-01`.
2. `SeedLoader` (`seed_loader.dart:47-74`): `ielts-reading-starter-01`, `ielts-listening-starter-01`, `ielts-writing-starter-01`, `ielts-speaking-starter-01`.
3. Bundled JSON files (`assets/seed/**/*.json`): `ielts-acad-reading-seed-01`, `ielts-listening-seed-01`, `ielts-writing-seed-01`, `ielts-speaking-seed-01`.
4. Backend catalog fallback (`catalog.ts:50-61`): `ielts-acad-starter-reading-01`, `ielts-acad-starter-listening-01`.

### 3.2 Static Seed JSONs, Python Pack Generators & Cloudflare R2 Junk Architecture
Instead of a standard **Postgres + Self-Hosted S3** content system, the codebase currently scatters static placeholder files across disk while the UI ignores them completely:
- **Static app bundle files (`app/assets/seed/`):** `listening_s01.m4a` (`1.8 MB`), `ielts_listening_starter.json`, `ielts_reading_starter.json`, `ielts_writing_starter.json`, `task1_chart.svg`, `ielts_speaking_starter.json`, and `ielts_vocab_seed.json`, generated by a 1,298-line Python script (`scripts/generate_seed_content.py`) and read only partially by `SeedLoader` (`seed_loader.dart`) for vocabulary. **These static JSON/asset files bloat the client binary, cannot be updated without rebuilding the app, and should be removed once initial data is imported into Postgres + S3.**
- **Static backend pack JSONs (`backend/content-pipeline/packs/`):** `22` generated pack JSON files + `manifest.json` created by `backend/content-pipeline/generate-cdn-packs.py`, alongside a filesystem-only validator (`validate-pack.ts`) — **never uploaded to S3 and never stored as queryable exam content in Postgres** (`backend/packages/db/src/schema.ts` `catalog_packs` only stores metadata rows, with no tables/columns for passages, questions, prompts, drills, or vocabulary cards, so `catalog.ts:46-72` falls back to 2 hardcoded fake packs).
- **Unused Cloudflare R2 & Fake `.example.com` CDN Plumbing:** `deploy/r2-cdn-setup.sh`, `deploy/cdn_cache_rules.md`, `R2_CDN_PUBLIC_URL`, `MOCKZA_CDN_BASE_URL`, `cdn.mockza.example.com`, `cdn.ir.mockza.example.com`, and `CdnAssetDownloadGateway` (`asset_download_gateway.dart`) target Cloudflare R2 rather than the self-hosted **SeaweedFS S3** container already deployed in `compose.yaml`. **See Section 7 for the full cleanup & Postgres + Self-Hosted S3 migration spec.**

### 3.3 Unused UI Kit Components & Dead Gateways
- **9 UI Kit components** in `app/lib/theme/components/` have **0 references** in `app/lib/features`, `routing`, or `app.dart`:
  - `annotated_text.dart`, `transcript_segment.dart`, `status_banner.dart`, `mz_toast.dart`, `mz_skeleton.dart`, `empty_state.dart`, `section_header.dart`, `mz_form_field.dart`, `feature_module_body.dart`.
- **Dead / Unwired Services:**
  - `AssetDownloadGateway` (`0` feature callers; points to dead `cdnBaseUrl`)
  - `TelemetryGateway` (`0` callers)
  - `PlatformAudioChannel` (`0` callers)
  - `FileRingBufferCrashLog` (`crash_log.dart:48`) is not wired in `bootstrap.dart` (which uses default logger without disk crash ring persistence on mobile).
- **Placeholder Production Domains:** `EditionConfig` (`edition_config.dart`), `app/Containerfile`, `.env.example`, `backend/.env.example`, `backend/packages/config/src/env.ts`, and `compose.yaml` default to `api.mockza.example.com`, `cdn.mockza.example.com`, `api.ir.mockza.example.com`, and `cdn.ir.mockza.example.com`.

### 3.4 Localization (`l10n`), Branding & Iran Edition (`irn`)
- `app/lib/l10n/app_en.arb` contains only **20 strings** (including unused `"placeholderStatus": "Module scaffold ready"`), while nearly all copy across screens (`HomeScreen`, `PracticeHubScreen`, `SettingsScreen`, `PaywallScreen`, simulators, errors) is hardcoded English literals.
- `irn` (`AppEdition.iran`) lacks Persian (`fa`) ARB localization & RTL layout adjustments (or if intended to stay LTR English UI per `UI-UX-TLDR.md`, store/payment localization for Iran still has no implementation).

---

## 4. Platform, Web & Store Release Readiness Audit

### 4.1 Flutter Web (`app/web/`, `app/nginx.conf`, `compose.yaml`)
- **Generic Template Metadata:** `app/web/index.html` and `app/web/manifest.json` still contain Flutter's template values (`"A new Flutter project."`, `"mockza"` lowercase title, `"#0175C2"` blue colors, default `Icon-*.png` / `favicon.png`).
- **Browser Security Blocks on Plain HTTP:** Serving Web on `http://153.76.122.172:45280` (plain HTTP, not HTTPS) causes modern browsers (Chrome/Safari/Firefox) to **block microphone access (`navigator.mediaDevices.getUserMedia` -> `NotAllowedError`/undefined) and disable `WebCrypto` (`SubtleCrypto` needed by `flutter_secure_storage`)**. `AudioRecorderGateway` only catches `PlatformException`, not browser JS exceptions / `UnimplementedError`.
- **Audio Codec & Player Failures on Web:**
  - `JustAudioPlayerGateway.loadFile` (`audio_player_gateway.dart:68-77`) calls `_player.setFilePath(filePath)`, which fails for Flutter Web assets (`assets/seed/audio/listening_s01.m4a`) and browser `blob:` / `https:` URLs (requires `setAsset` vs `setUrl` routing).
  - `RecordAudioRecorderGateway.startRecording` requests default AAC/`64kbps`/`16kHz` to a filesystem `outputPath`; browsers return `blob:` URLs often encoded as `audio/webm;codecs=opus` rather than `.m4a` (`audio/mp4`), incompatible with backend `PresignUploadRequestSchema` (`contentType: z.literal('audio/mp4')`) unless configured/transcoded cleanly.

### 4.2 Android Store Checklist Gaps
- Missing `<uses-permission android:name="android.permission.INTERNET" />` in `app/android/app/src/main/AndroidManifest.xml` (release builds fail all network requests).
- Missing `<uses-permission android:name="android.permission.RECORD_AUDIO" />` in `AndroidManifest.xml`.
- `release` buildType signs with `debug` keys (`build.gradle.kts:36`); no keystore / Play App Signing properties; no `productFlavors` (`glb` / `irn`); default Flutter `mipmap-*/ic_launcher.png` icons (442 B–1.4 KB).
- Empty `MainActivity.kt` (no `com.mockza/audio_session` channel handler).

### 4.3 iOS Store Checklist Gaps
- Missing `NSMicrophoneUsageDescription` in `app/ios/Runner/Info.plist` (App Store rejection + instant runtime crash on mic access).
- Missing `UIBackgroundModes` -> `audio` in `Info.plist`.
- Single `PRODUCT_BUNDLE_IDENTIFIER = com.mockza.mockza` (`project.pbxproj:386,567,589`), no flavor schemes (`glb`/`irn`), default blank 68-byte `LaunchImage*.png` & template `AppIcon.appiconset`.
- Empty `AppDelegate.swift` / `SceneDelegate.swift` (no `com.mockza/audio_session` `AVAudioSession` setup).

### 4.4 Documentation vs. Reality Mismatch
- `docs/HARDWARE_VERIFICATION_CHECKLIST.md:89` records `PASSED ✓` for `2026-11-15`, and `aso_listings.md:27` advertises `500+` flashcards (`ielts_vocab_seed.json` has `320`) and `/v1/account` deletion (`google_play_data_safety.md:11`). Submitting the current binary based on these docs would fail App Store / Google Play review immediately.

---

## 5. Automated Test Coverage Blindspots

The existing test suite (`13` test files under `app/test/` + `app/integration_test/hardware_verification_test.dart`) passes **only because UI/provider tests either isolate static layouts or substitute `Fake*` gateways and skip feature Notifier/end-to-end execution**:
- **Covered well:** Pure domain math (`sm2_scheduler_test.dart`, `local_objective_scorer_test.dart`, `study_metrics_calculator_test.dart`, `result_test.dart`), Drift SQLite table primitives (`database_foreign_keys_test.dart`, `outbox_queue_test.dart`, `writing_drafts_and_annotations_test.dart`, `attempt_cursor_pagination_test.dart`, `vocab_repository_test.dart`), static policy checks (`architecture_policy_test.dart`), 2-screen responsive overflow + 4-screen `PopScope` checks (`accessibility_and_layout_test.dart`), and fake gateway unit calls (`provider_container_gateway_test.dart`).
- **0% Coverage on Critical Real App Paths:**
  - **Zero unit or widget tests** exercise `OnboardingNotifier`, `HomeNotifier`, `PracticeHubNotifier`, `SpeakingSimNotifier`, `WritingSimNotifier`, `ReadingSimNotifier`, `ListeningSimNotifier`, `EvaluationReviewNotifier`, `MicroDrillsNotifier`, `ProgressNotifier`, `VocabularyNotifier`, `SettingsNotifier`, or `PaywallNotifier`.
  - **Zero tests** verify `HttpGradingGateway` against actual JSON payloads generated by `backend/packages/contracts/src/schemas.ts` (which allowed 9 schema/URL bugs to go completely undetected).
  - **Zero tests** verify `SeedLoader` idempotency with real asset bundles + `MockzaApp` navigation flow (`Onboarding -> Practice -> Simulator -> Score -> Review -> Vocab -> Progress`).
  - `hardware_verification_test.dart:53` explicitly catches `MissingPluginException` around `RevenueCatBillingGateway`, hiding unconfigured billing on host runs.

---

## 6. Prioritized Fix Roadmap to Production v1.0

### Stage A — Foundation, Auth, Routing & Backend Alignment (Blockers)
1. **Enforce First-Run Onboarding Guard:** Add `GoRouter` redirect watching `onboardingCompleted` in `UserProfiles`; finish `wantDiagnostic` flow, remove misleading PTE/TOEFL `"Join waitlist"` promises (or gate behind real feature flags / scale-aware UI), and implement `PracticeSetupScreen` (`/practice/setup/:skill`) and `FullMockScreen` (`/practice/full-mock/:mockId`) passing `usedStudyMode`.
2. **Implement Auth Bootstrap & Durable Identity:** Call `POST /v1/auth/anonymous` on startup, persist bearer JWT cleanly (including Web storage fallback via `IndexedDB` / `localStorage` instead of volatile RAM map on HTTP), attach attestation hooks when enabled, and wire `POST /v1/auth/link` + `DELETE /v1/account`.
3. **Fix `HttpGradingGateway` Contracts & Self-Hosted S3 Upload/Media Proxy:** Update URLs (`/v1/uploads/presign`, `/v1/evaluate/explain-question`, `/v1/quota/me`, `/v1/feedback/question-flag`), add binary S3 `PUT` upload, expose **SeaweedFS S3** behind Nginx/HTTPS reverse proxy + CORS for mobile/Web (eliminating `127.0.0.1:45833` & Cloudflare R2 `.example.com` defaults), match all Zod request/response fields and job stages (`queued`, `processing_audio`, `transcoding`, `evaluating`, `repairing`), enforce UUIDv4 `attemptId`s via `EntropySource`, and add contract tests against OpenAPI/Zod fixtures.
4. **Build Real `OutboxSyncService` & `AudioRecordings` DAO:** Implement DAO/Repository methods for `OutboxSyncQueue` and `AudioRecordings`, enqueue offline submissions/audio uploads, process retries on startup & connectivity recovery, and clean up temporary local audio after confirmed upload.
5. **Migrate Content Out of Static JSON/Python/R2 Into Postgres + Self-Hosted S3:** Remove `app/assets/seed/`, `scripts/generate_seed_content.py`, `backend/content-pipeline/packs/`, `backend/content-pipeline/generate-cdn-packs.py`, and Cloudflare R2 scripts; expand Postgres schema (`schema.ts`) to store full exams, questions, drills, and vocabulary; store `.m4a` audio & chart SVGs in SeaweedFS (`mockza-media`); remove `catalog.ts` fallback packs; wire Admin upload/publish APIs + Flutter API sync/local Drift caching (see **Section 7**).

### Stage B — Replace All 4 Mocked Exam Simulators With Real Engines
6. **Unify Pack/Exam IDs Across Postgres, Routes & Local Cache:** Replace all hardcoded sample IDs (`ielts-speaking-01`, `ielts-reading-acad-01`, `drill-cc-trans-01`, `att-demo-01`, etc.) with real database UUIDs/pack IDs served by Postgres (`GET /v1/catalog/manifest` & `GET /v1/exams/:packId`) and cached in Drift SQLite (`SeedLoader` removed).
7. **Speaking Simulator + Live Prep-Mode Mic Waveform:**
   - Wire `AudioRecorderGateway` + `PlatformAudioChannel` + `AudioPlayerGateway`.
   - Remove the `!isRecording` flat `0.15` lock in `AudioLevelMeter` and stream real normalized mic dBFS levels during **Pre-flight Mic Check & Part 2 Preparation** as well as active recording; compute real `isSilent` / `isClipping` / `hasPermission` states with Settings recovery UI.
   - Auto-start Part 2 timer, support full Parts 1–3 progression loaded from Postgres (plus optional prompt audio from S3), local `.m4a` / Web blob persistence, pre-mic AI disclosure, and S3 + AI evaluation upload.
8. **Writing Simulator:** Bundle `flutter_svg` and render Task 1 chart SVGs downloaded from self-hosted S3 (`chart_s3_key`), load Task 1 Academic / Task 1 General / Task 2 prompts from Postgres, fix `TimerBar` `totalSeconds`, isolate drafts per task & delete drafts + clean orphan `inProgress` rows on submit, use `jsonEncode` cleanly, lock autocorrect in Exam Mode, and enqueue `evaluate/writing`.
9. **Reading & Listening Simulators:** Load passages/sections/questions/transcripts from Postgres and stream/cache listening `.m4a` audio from self-hosted S3 via `JustAudioPlayerGateway` (`setUrl` / local cached file); replace `rawCorrect = answers.length` with `LocalObjectiveScorer.score` + full per-question answer persistence; render full question sets with working question-jump circles; build real Reading text highlighting/notes using `AnnotatedText` + `ReadingAnnotations`; wire `TranscriptSegmentWidget` and strict Exam Mode vs Study Mode playback locks.

### Stage C — Real Review, SRS Vocabulary, Progress & Billing
10. **Evaluation Review:** Load any `attemptId` from SQLite/Postgres / poll `GET /v1/jobs/:jobId` (or SSE `/events`); render skill-specific Speaking (S3/local audio replay + synced annotated transcript), Writing (`AnnotatedText` + `+1.5` rewrite + 1-tap `Save Word`), and Reading/Listening (`EvidenceLink` + real `explainQuestion` AI sheet + `CompareAttempts` from real prior attempts + Share sheet).
11. **Vocabulary SRS:** Sync vocabulary deck from Postgres (`GET /v1/vocab/deck`) + pronunciation audio from S3/TTS; fix the double-advance skip bug in `VocabReviewScreen` / `VocabularyNotifier`, fix loading flicker, fix `VocabDao.recordReviewTransaction` to log `today` instead of `dueDay`, remove the `limit = 100` cap, add topic filters + `"Review Ahead"` + custom card creation.
12. **Progress & Analytics:** Remove `..add(today)` phantom streak bug in `HomeNotifier`, wire `DailyStudyLogs` as additive increments across all simulators/drills, filter charts by `7D/30D/90D/ALL`, remove fabricated baseline trend points on empty state, make `ProgressSkillScreen` dynamic, wire Retry & full keyset pagination on `ProgressAttemptsScreen`.
13. **Settings, Cache, Account & Billing:** Make `wipeAllData()` delete all local tables + cached S3 media/audio files + credentials + call `DELETE /v1/account` + reset sync state & route to `/onboarding`; compute real cache size/clear; read runtime app version; configure RevenueCat safely on mobile with Web graceful fallback, align SKUs/prices across code & docs, implement `IranBillingGateway` (if shipping `irn`), and sync `isPro` state reliably.

### Stage D — Store Packaging, Web HTTPS, L10n & Real E2E Tests
14. **Android & iOS Manifests, Signing, Icons & Native Audio:** Add `INTERNET` + `RECORD_AUDIO` (Android) and `NSMicrophoneUsageDescription` + `UIBackgroundModes: audio` (iOS); implement `com.mockza/audio_session` in `MainActivity.kt` & `AppDelegate.swift`; add Android release keystore signing + flavor configs (`glb`/`irn`); replace default Flutter launcher icons, iOS LaunchImages, and Web `manifest.json` / `index.html`.
15. **Web HTTPS & Storage/Codec Compatibility:** Serve Web & proxied SeaweedFS S3 behind TLS/HTTPS (required for browser mic `getUserMedia`, `WebCrypto`, and S3 media playback), handle Web audio format/upload compatibility (WebM/Opus -> server transcoding or MP4 recorder support), and configure S3 CORS.
16. **Production Domains, Localization & End-to-End Tests:** Replace `.example.com` defaults via environment configs; move UI strings to `app_en.arb` (+ `fa` if targeting Persian UI); add real Notifier + Router + HTTP contract + Web/mobile integration tests covering complete user journeys end-to-end.

---

## 7. Content & Storage Architecture Migration: Remove Static JSON / R2 Junk -> Postgres + Self-Hosted S3

To turn Mockza from a prototype into a real, maintainable production application (where new tests, audio, charts, drills, and vocabulary cards are added dynamically via **PostgreSQL + self-hosted SeaweedFS S3** without shipping app updates or running generator scripts), **every static JSON/generator/R2 placeholder listed below must be removed or refactored**.

### 7.1 Files & Hardcoded Mock Content to Delete or Refactor ("Junk Removal" Checklist)

| Category | Exact Files / Locations | Action Required |
| :--- | :--- | :--- |
| **Static Client Seed Assets** | `app/assets/seed/` (`reading/ielts_reading_starter.json`, `listening/ielts_listening_starter.json`, `writing/ielts_writing_starter.json`, `writing/task1_chart.svg`, `speaking/ielts_speaking_starter.json`, `vocabulary/ielts_vocab_seed.json`, `audio/listening_s01.m4a`), `app/pubspec.yaml:59-65`, `scripts/generate_seed_content.py` | **One-time import then delete:** Run a one-time DB/S3 import migration for any curated starter items you want to keep, then **delete `app/assets/seed/` and `scripts/generate_seed_content.py`**, and remove `assets/seed/*` entries from `app/pubspec.yaml`. |
| **Client Static Seed Loader** | `app/lib/data/db/seed/seed_loader.dart`, `app/lib/providers.dart:115` (`seedLoaderProvider`), `app/lib/app.dart:30`, `vocabulary_providers.dart:16,23`, `practice_hub_providers.dart:16` | **Delete `SeedLoader`** (`rootBundle.loadString` + hardcoded `'ielts-*-starter-01'` rows). Replace startup/provider sync with an API sync service fetching published catalog/vocab/exams from Postgres and caching them in Drift SQLite. |
| **Static Backend Pack JSONs & Python Script** | `backend/content-pipeline/packs/` (`22` `.json` files + `manifest.json`), `backend/content-pipeline/generate-cdn-packs.py` | **One-time import then delete:** Migrate any valid packs into Postgres + SeaweedFS S3, then **delete `backend/content-pipeline/packs/` and `generate-cdn-packs.py`**. |
| **Disk-Only Pack Validator** | `backend/content-pipeline/src/validate-pack.ts:55-212`, `compose.yaml:248-258` (`content-validate` service) | **Refactor into server-side validator:** Keep Zod schemas, copyright/trademark checks (`BANNED_PATTERNS`), and quote verification (`schemas.ts` / `validator.ts`) as a library called directly by the **Admin ingestion/publish API** when saving to Postgres (drop hardcoded `app/assets/seed` & `../packs` directory walks). |
| **Cloudflare R2 & Fake CDN Config** | `deploy/r2-cdn-setup.sh`, `deploy/cdn_cache_rules.md`, `R2_CDN_PUBLIC_URL` / `MOCKZA_CDN_BASE_URL` / `cdn.mockza.example.com` / `cdn.ir.mockza.example.com` across `.env.example:28,47`, `backend/.env.example:22`, `backend/packages/config/src/env.ts:38`, `compose.yaml:23,204`, `app/Containerfile:58,66`, `app/lib/core/config/edition_config.dart:24,33-60,71`, `app/lib/services/asset_download_gateway.dart` (`CdnAssetDownloadGateway`), `app/lib/providers.dart:141` | **Delete `deploy/r2-cdn-setup.sh` & `deploy/cdn_cache_rules.md`.** Replace `R2_CDN_PUBLIC_URL` / `MOCKZA_CDN_BASE_URL` with `S3_MEDIA_BUCKET` + `MEDIA_PUBLIC_BASE_URL` (pointing to your self-hosted Nginx/API SeaweedFS reverse proxy). Replace `CdnAssetDownloadGateway` with direct authenticated API + S3 media downloads/caching. |
| **Backend Fallback Catalog & Localhost S3 URL** | `backend/apps/api/src/routes/catalog.ts:46-72` (hardcoded 2-pack fallback when Postgres `catalog_packs` is empty); `compose.yaml:18` (`S3_PUBLIC_ENDPOINT=http://127.0.0.1:45833`) | **Remove the 2-pack hardcoded fallback** in `catalog.ts` (return real Postgres `catalog_packs` / `exams` rows only). Replace `127.0.0.1:45833` with a routable HTTPS/reverse-proxied SeaweedFS endpoint so web browsers and mobile devices can fetch/upload S3 objects cleanly. |
| **Hardcoded Sample Data Inside Flutter UI & Router** | `app/lib/routing/routes.dart:75-88`, `app_router.dart:109,115,121,127,133`, `practice_hub_screen.dart` (`5` static cards + `'drill-cc-trans-01'`), `reading_sim_screen.dart` (Cetacean passage, `3` questions, fake AI quote), `listening_sim_screen.dart` & `listening_sim_notifier.dart` (`4` questions/transcript/timestamps), `writing_sim_notifier.dart` (`'writing-pack-01'`, `'<svg viewBox=...>...</svg>'`, hardcoded prompts) & `writing_sim_screen.dart` (`_AcademicChartPlaceholder`), `speaking_sim_screen.dart` (`'ielts-speaking-01'`, `'att-speaking-demo-01'`) & `speaking_sim_notifier.dart`, `evaluation_review_screen.dart` & `evaluation_review_notifier.dart` (`'att-demo-01'`, fake `_CompareTab`), `micro_drills_notifier.dart` & `micro_drills_screen.dart` (`2` hardcoded drills), `vocab_word_detail_screen.dart:40` (`'Substantiate'`), `progress_skill_screen.dart`, `progress_notifier.dart`, `progress_screen.dart` | **Strip every hardcoded sample prompt, passage, SVG stub, fake Band 6.5 result, and demo ID.** Load all active catalog items, exam sections/questions, audio/chart URLs, drills, vocabulary decks, and attempt reviews from Postgres API + Drift local cache. Update fake pack strings in `app/test/features/provider_container_gateway_test.dart` to match the new contract tests. |

### 7.2 Target PostgreSQL Content Schema (`backend/packages/db/src/schema.ts`)
Currently Postgres only has `catalog_packs` metadata (`packId`, `edition`, `examId`, `skill`, `version`, `sha256`, `byteLength`, `cdnRelativePath`, `contentOrigin`, `humanQaReviewed`, `isFreeSample`, `isPublished`, `publishedAt`). Expand Postgres with forward Drizzle migrations so **Postgres is the single source of truth** for all text, questions, answers, rubrics, drills, and vocabulary:

1. **`exam_packs` / `exams` (extends `catalog_packs`):** Remove Cloudflare-only `cdnRelativePath`; track `title`, `description`, `track` (`academic` / `general_training`), `duration_seconds`, `edition` (`glb` | `irn` | `both`), `is_free_sample`, `is_published`, `version`, `content_checksum`.
2. **`reading_passages` & `exam_questions`:** Store passage title, ordered paragraphs (`jsonb`), word count, and normalized questions (`question_id`, `section_id`, `question_number`, `question_type`, `prompt`, `options_json`, `accepted_answers_json`, `evidence_paragraph`, `evidence_quote`, `evidence_rationale` / `distractor_note`).
3. **`listening_sections`:** Store section index (`1..4`), **`audio_s3_key`** (pointing to `.m4a` in self-hosted S3 `mockza-media` bucket), `audio_duration_ms`, transcript turns (`speaker`, `accent`, `text`, `startMs`, `endMs`, `distractor` markers), linked to `exam_questions`.
4. **`writing_prompts`:** Store `task_type` (`task1Academic` | `task1General` | `task2Essay`), `title`, `prompt_body`, **`chart_s3_key`** (pointing to `.svg`/`.png` in `mockza-media`), `min_words`, `recommended_seconds`.
5. **`speaking_prompts`:** Store `part1_questions_json`, `part2_cue_card_json`, `part3_questions_json`, plus optional **`prompt_audio_s3_key`** references in `mockza-media`.
6. **`micro_drills`:** Store `drill_id`, `skill`, `weakness_code`, `title`, `instructions`, `duration_seconds`, `items_json`, `is_published`.
7. **`vocab_deck_cards`:** Store `card_id`, `headword`, `ipa`, `definition`, `topic_tag`, `context_sentence`, `paraphrases_json`, `collocations_json`, **`audio_s3_key`** (optional pronunciation `.m4a`), `is_published`.

### 7.3 Target Self-Hosted S3 (`SeaweedFS`) Setup & Reverse Proxy
Use the existing **SeaweedFS S3** service (`compose.yaml:88-106`, `backend/packages/storage/`) for all binary files instead of Cloudflare R2:
1. **Two Clean Buckets (`init-buckets.ts`):**
   - `mockza-audio-private` (`S3_BUCKET`): Private user speaking recordings (`users/{deviceId}/clips/{attemptId}/part-{n}.m4a`), written via presigned `PUT` URLs and auto-purged after `AUDIO_TTL_DAYS`.
   - `mockza-media` (replaces `mockza-packs-public` / `mockza-cdn-packs`): Stores official exam media — listening `.m4a` audio tracks, writing Task 1 diagram `.svg`/`.png` files, and optional speaking/vocab pronunciation audio (`media/listening/...`, `media/writing/...`, `media/vocab/...`).
2. **Same-Origin / Public HTTPS Access (`app/nginx.conf` + `compose.yaml`):**
   - Proxy S3 traffic safely behind Nginx / API TLS (e.g., `/storage/` -> `http://seaweedfs:8333` with proper `Host` / signature forwarding or dedicated public S3 domain with TLS + CORS `GET`/`PUT`/`HEAD`), and eliminate `http://127.0.0.1:45833` defaults so real browsers and mobile phones can upload speaking audio and download/stream listening tracks and charts.
   - Generate presigned `GET` URLs (or proxy `/v1/media/*` through signed tokens / Nginx cache) for all `*_s3_key` columns when serving test payloads from the API.

### 7.4 Backend API & Admin Content Workflow
- **App Read Endpoints (`backend/apps/api/src/routes/`):**
  - `GET /v1/catalog/manifest`: Query published rows strictly from Postgres (`catalog_packs` / `exams`), filtered by `edition` and `track` (no hardcoded starter fallback).
  - `GET /v1/exams/:packId`: Return the complete hydrated test (passages/sections/prompts/questions — **omitting answer keys during Exam Mode if server-graded, or delivering complete package for offline client scoring & caching**) with live SeaweedFS media URLs for audio/charts.
  - `GET /v1/drills` & `GET /v1/drills/:drillId`: Serve published micro-drills from Postgres.
  - `GET /v1/vocab/deck`: Serve published vocabulary deck cards (+ `audioUrl`) from Postgres with `updatedSince` / cursor pagination so the client never ships large JSON seed files.
- **Admin Upload & Publish Endpoints (`/v1/admin/*` protected by admin auth):**
  - `POST /v1/admin/media/presign`: Issue S3 `PUT` presigned URL into `mockza-media` for uploading listening `.m4a` audio, writing `.svg`/`.png` charts, and pronunciation clips.
  - `POST /v1/admin/exams`, `PUT /v1/admin/exams/:packId`, `POST /v1/admin/exams/:packId/publish`, plus `/v1/admin/drills` and `/v1/admin/vocab` CRUD: Validate payload using `@mockza/content-pipeline` Zod/copyright/evidence rules before saving in Postgres and setting `is_published = true`.
  - Provide a tiny Admin Web UI (or internal Node CLI import tool for bulk migration) so tests are created, validated, media-uploaded, and published live without touching app code or Python generators.

### 7.5 Flutter Client Sync & Offline Cache Refactor
- Replace `SeedLoader` and `CdnAssetDownloadGateway` with a **Catalog & Exam Sync Repository**:
  - On first launch / network connect, call `GET /v1/catalog/manifest` + `GET /v1/vocab/deck` + `GET /v1/drills` and persist synced data in Drift SQLite (`ExamPacks`, `VocabCards`, and cached exam/drill tables or JSON payloads).
  - When opening Practice Hub or starting any test, check local Drift cache first (allowing full offline play once downloaded) or fetch `GET /v1/exams/:packId` and cache media URLs/files (via `AudioPlayerGateway.setUrl` / `setFilePath` + `flutter_svg` `SvgPicture.network` / cached SVG).
  - Delete all hardcoded sample constructors/fallbacks from all 4 simulators, `EvaluationReviewNotifier`, `MicroDrillsNotifier`, `VocabWordDetailScreen`, and `ProgressSkillScreen`, rendering proper loading/offline/empty states (`MzSkeleton`, `EmptyState`) instead of fake data.
