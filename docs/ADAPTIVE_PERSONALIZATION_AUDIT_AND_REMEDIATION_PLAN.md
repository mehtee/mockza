# Adaptive Personalization, Roadmap, Kokoro TTS, Pronunciation Studio & Tracing — Complete Audit & Remediation Plan

**Audit Date:** 2026-11-22  
**Audited Specification:** `docs/ADAPTIVE_PERSONALIZATION_AND_ROADMAP_PLAN.md`  
**Scope:** Backend (`@mockza/contracts`, `@mockza/db`, `@mockza/ai`, `apps/api`, `apps/worker`), Shared Domain (`packages/domain`), Web SPA (GLB Mockza & IRN Sanjia), Flutter App (GLB Mockza & IRN Sanjia), Cross-Device Sync, Tracing & Cost Ledger.

---

## Executive Summary & Production Readiness Scorecard

The core architecture for Adaptive Personalization, Dynamic Band Evolution, Durnama + Step-by-Step Roadmap, OpenRouter Kokoro-82m TTS, Gemini 3.1 Flash Lite Pronunciation Practice, Cross-Device Sync, and Server-Side Usage/Cost Tracing has been scaffolded end-to-end and passes static checks, existing unit/widget suites, and Docker health checks.

However, a deep line-by-line audit across all four targets (**Web GLB, Web IRN, Flutter GLB, Flutter IRN**) and the **live Backend contracts** uncovered **14 P0 critical production bugs/contract mismatches** (including several silent `HTTP 400` failures that escaped CI because client tests used hand-written fake gateways instead of validating payloads against `@mockza/contracts` Zod schemas), **12 P1/P2 technical debts** (including an unbounded in-memory MP3 cache leak on the low-RAM server), and **11 high-impact UI/UX & Web↔Flutter parity enhancements** needed to fully realize the anti-overload, step-by-step experience described in the original plan.

| Subsystem | Current Status | Blocking Findings |
| :--- | :--- | :--- |
| **Backend Contracts & API** | Needs Hotfix | Unbounded RAM audio cache in `tts.ts`; `bandShift` reset on every GET; multi-exam threshold bug; `studyFocus`/DET `targetBand` schema caps; incomplete guest→account merge; missing `explain-question` cost tracing |
| **Web (GLB & IRN)** | Partial / Needs Fix | Vocab batch sync sends `{ items }` instead of `{ cards }` (HTTP 400); Roadmap `targetRoute` 404s; Objective exams omit `questionTypeStats`/attempt sync; Pronunciation Drawer auto-submits on Stop without preview; unbounded `blobUrlCache` |
| **Flutter (GLB & IRN)** | Blocked on Live API | Pronunciation submit broken (non-UUID `practiceId`, invalid enums, no 202 job polling); ALL TTS Listen buttons send invalid `sourceContext` enums (HTTP 400); Vocab batch sync & Band Events send invalid payloads (HTTP 400); `VocabReviewScreen` bypasses 15-word waves; Practice Hub & Progress lack Web parity |
| **GLB ↔ IRN & Web ↔ Flutter Parity** | Gaps Found | Practice Hub "For Your Path", Progress Pronunciation History, Pronunciation Preview-before-Submit, and Vocab Wave enforcement diverge between Web and Flutter |
| **Tracing & Cost Ledger** | Mostly Solid, Gaps | `explain-question` untraced; GDPR erasure hard-deletes financial ledger rows; missing date filters/CSV export/UI for Admin Trace Console |

---

## Section 1: Critical Issues & Bugs (P0 — Must Fix Before Release)

### P0-01. Flutter Pronunciation Submit & Polling Completely Broken Against Live API (4 Compound Bugs)
- **Locations:**
  - `backend/packages/contracts/src/schemas.ts:1604,1625-1635`
  - `backend/apps/api/src/routes/pronunciation.ts:181,339,473,568`
  - `app/lib/theme/components/speech_practice_sheet.dart:283,293`
  - `app/lib/services/speech_practice_gateway.dart:322-356`
  - `app/lib/features/vocabulary/presentation/vocab_flip_card.dart`, `vocab_word_detail_screen.dart`, `vocabulary_screen.dart`, `roadmap_screen.dart`, `progress_screen.dart`, `evaluation_review_screen.dart`, `register_shifter_screen.dart`, `drop_anything_screen.dart`, `daily_mission_screen.dart`
- **Root Cause:**
  1. `PronunciationPresignRequestSchema` and `AnalyzePronunciationRequestSchema` require `practiceId: z.string().uuid()`. `speech_practice_sheet.dart:283` generates `'pron_$nowMs'` → **HTTP 400**.
  2. `AnalyzePronunciationRequestSchema.practiceKind` only accepts `'word' | 'sentence' | 'reading_excerpt' | 'feedback_shadow'`. Flutter passes `'collocation'` → **HTTP 400**.
  3. `AnalyzePronunciationRequestSchema.sourceRefType` only accepts `'vocab_card' | 'reading_passage' | 'listening_feedback' | 'writing_feedback' | 'speaking_feedback' | 'coach' | 'custom'`. Flutter sends `'vocab_example'`, `'register_shifter'`, `'roadmap_step'`, `'evaluation_quote'`, `'evaluation_rewrite'`, `'drop_phrase'`, `'daily_mission'`, `'progress_studio'` → **HTTP 400**.
  4. `POST /v1/pronunciation/analyze` returns **HTTP 202 `{ jobId, status: 'queued' | 'completed' }`** (`JobEnqueueResponseSchema`). Web (`web/src/adapters/http/http-speech-practice.adapter.ts:138-157`) polls `/v1/pronunciation/history` for up to 45s to fetch the scored result. Flutter (`speech_practice_gateway.dart:339-355`) attempts to parse the 202 enqueue response directly as a `PronunciationPracticeItemDto` with **zero polling**, resulting in blank/zero scores on every submission.
- **Impact:** Pronunciation Practice Studio is 100% non-functional on Flutter (GLB & IRN) against the live API.
- **Fix:**
  - Generate `practiceId` via `ref.read(entropySourceProvider).nextUuidV4()`.
  - Standardize `practiceKind` and `sourceRefType` enums cleanly in `@mockza/contracts` (either expand `sourceRefType` with explicit canonical values or map all Flutter/Web call sites strictly to the canonical contract enum via a typed enum, never raw strings).
  - Add a dedicated `GET /v1/pronunciation/:practiceId` (or job status) endpoint AND implement bounded polling in Flutter `SpeechPracticeGateway.analyzeRecording` (mirroring Web, plus immediate return if status is already `completed`).

### P0-02. Flutter Kokoro TTS Requests Fail with HTTP 400 (`sourceContext` Enum Violations + `cacheId` Typo)
- **Locations:**
  - `backend/packages/contracts/src/schemas.ts:1586`
  - `backend/apps/api/src/routes/tts.ts:134`
  - `app/lib/services/speech_practice_gateway.dart:259`
  - All Flutter `InlineListenButton` call sites (`vocab_flip_card.dart`, `vocab_word_detail_screen.dart`, `vocabulary_screen.dart`, `reading_sim_screen.dart`, `evaluation_review_screen.dart`, `register_shifter_screen.dart`, `daily_mission_screen.dart`, `drop_anything_screen.dart`, `roadmap_screen.dart`, `progress_screen.dart`).
- **Root Cause:**
  1. `TtsSynthesizeRequestSchema.sourceContext` only allows `'vocab' | 'reading' | 'listening_feedback' | 'speaking_feedback' | 'writing_feedback' | 'coach' | 'pronunciation'`.
  2. Flutter passes `'vocab_card'`, `'vocab_example'`, `'vocab_deck'`, `'vocab_detail'`, `'vocab_detail_sentence'`, `'reading_study'`, `'reading_feedback'`, `'evaluation_rewrite'`, `'register_shifter'`, `'daily_mission'`, `'drop_drill'`, `'roadmap'`, `'progress'` → **every Flutter Listen tap returns HTTP 400**.
  3. `speech_practice_gateway.dart:259` reads `data['cacheId']`, whereas `tts.ts:134` returns `cacheKey`.
- **Impact:** All Kokoro-82m TTS Listen buttons fail on Flutter GLB & IRN.
- **Fix:** Replace raw string `sourceContext` in Flutter `InlineListenButton` & `SpeechPracticeGateway` with a Dart `enum TtsSourceContext` matching `TtsSynthesizeRequestSchema.sourceContext` 1:1, and read `data['cacheKey']`.

### P0-03. Vocab SRS Batch Sync Fails with HTTP 400 on BOTH Web and Flutter (`items` vs `cards`, `reviewedAtIso` vs `lastReviewedAt`)
- **Locations:**
  - `backend/packages/contracts/src/schemas.ts:1685-1700`
  - `backend/apps/api/src/routes/sync.ts`
  - `web/src/spa/features/vocabulary/VocabReviewScreen.tsx:202-226`
  - `web/src/adapters/http/api-client.ts:633-635`
  - `app/lib/features/vocabulary/presentation/vocabulary_notifier.dart:141-153`
  - `app/lib/services/outbox_sync_service.dart:260-285`
  - `app/lib/services/personalization_gateway.dart:704-715`
- **Root Cause:** `VocabBatchSyncRequestSchema` expects:
  ```json
  { "cards": [{ "cardId": "...", "easeFactorMilli": 2500, "intervalDays": 1, "repetitions": 1, "dueSerialDay": 20000, "lapses": 0, "lastReviewedAt": "ISO", "sourceKind": "seeded" }] }
  ```
  - Web `VocabReviewScreen.tsx:202-220` enqueues `{ items: [{ ..., reviewedAtIso }] }` and `api-client.ts:634` posts it verbatim to `/v1/sync/vocab-batch` → **HTTP 400**.
  - Flutter `vocabulary_notifier.dart:141-153` enqueues `{ items: [{ ..., lastQuality, updatedAt }] }` (missing `lapses`), and `personalization_gateway.dart:707` posts `{ items: ... }` → **HTTP 400**.
- **Impact:** Cross-device vocabulary SRS sync never succeeds on either Web or Flutter.
- **Fix:** Align Web, Flutter, and Outbox adapters to strictly send `{ cards: [...] }` with `lapses` and `lastReviewedAt` matching `VocabBatchSyncRequestSchema`.

### P0-04. Flutter Band Events Fail with HTTP 400 + Objective Exams Never Sync Attempts/Weaknesses on Either Web or Flutter
- **Locations:**
  - `backend/packages/contracts/src/schemas.ts:1535-1565`
  - `app/lib/features/micro_drills/presentation/micro_drills_notifier.dart`
  - `app/lib/features/reading_sim/presentation/reading_sim_notifier.dart`
  - `app/lib/features/listening_sim/presentation/listening_sim_notifier.dart`
  - `app/lib/theme/components/speech_practice_sheet.dart`
  - `web/src/spa/useObjectiveSimulatorSession.ts:279-287`
- **Root Cause:**
  1. `RecordBandEventRequestSchema` accepts `skill: 'reading' | 'listening' | 'writing' | 'speaking'` and `sourceKind: 'diagnostic' | 'practice_section' | 'full_mock' | 'writing_eval' | 'speaking_eval' | 'micro_drill' | 'mission' | 'pronunciation'`.
  2. Flutter sends `skill: 'vocabulary'` (`micro_drills_notifier.dart`), `sourceKind: 'reading_objective'` (`reading_sim_notifier.dart`), `sourceKind: 'listening_objective'` (`listening_sim_notifier.dart`), and `sourceKind: 'pronunciation_practice'` (`speech_practice_sheet.dart`) → **ALL HTTP 400**.
  3. Neither Web (`useObjectiveSimulatorSession.ts:279-287`) nor Flutter (`reading_sim_notifier.dart`, `listening_sim_notifier.dart`) includes `questionTypeStats`, `attemptId`, `packId`, `answersJson`, `feedbackJson`, or `topicKeys` when posting the band event!
- **Impact:**
  - Flutter Reading/Listening/Drill/Pronunciation sessions never update live band or roadmap on the server.
  - On **both** Web and Flutter, completed objective Reading/Listening attempts never populate `user_attempts_sync` (breaking cross-device attempt sync), never extract Reading/Listening weaknesses via `extractObjectiveWeaknesses`, and never update `learner_topic_weakness_coverage` (preventing automatic Phase 1→Phase 2→Phase 3 topic rotation!).
- **Fix:** Map all Flutter skill/sourceKind values using typed enums matching `RecordBandEventRequestSchema`, and compute + attach `questionTypeStats`, `topicKeys`, `attemptId`, `packId`, `answersJson`, and `feedbackJson` from every Reading and Listening submission on both Web and Flutter.

### P0-05. `studyFocus` Schema Rejects `'exams'` / `'coach'` & DET `targetBand` Capped at 120 Instead of 160
- **Locations:**
  - `backend/packages/contracts/src/schemas.ts:1499,1525,1528`
  - `web/src/spa/cross-device-sync.ts:66`
  - `app/lib/data/repositories/personalization_repository.dart:230`
  - `app/lib/features/onboarding/presentation/onboarding_notifier.dart`, `settings_notifier.dart`
- **Root Cause:**
  - Backend schema restricts `studyFocus` to `z.enum(['speaking_only', 'both'])` while both Web and Flutter UIs use `'exams' | 'coach' | 'both'` → **HTTP 400** whenever a user picks Exams-only or Coach-only in Onboarding or Settings.
  - `targetBand` schema has `.max(120)`, whereas Duolingo English Test (`det`) scales from `10` to `160` → **HTTP 400** for any DET target > 120.
  - Both `cross-device-sync.ts:66` and `personalization_repository.dart:230` silently overwrite `'exams'` with `'both'` during sync pull.
- **Fix:** Update `studyFocus` schema & DB default to `z.enum(['exams', 'coach', 'both', 'speaking_only'])` (preserving backwards compatibility for legacy `'speaking_only'`), raise `targetBand` max to `160` (with exam-specific range validation), and preserve exact `studyFocus` in sync pull on Web & Flutter.

### P0-06. Broken Roadmap `targetRoute` Navigation (404s on Both Web and Flutter)
- **Locations:**
  - `backend/packages/db/src/personalization-store.ts:67-88` (`mapStepKindToRoute`)
  - `web/src/spa/features/roadmap/RoadmapScreen.tsx:24-29`, `HomeScreen.tsx:104-109`
  - `app/lib/features/roadmap/presentation/roadmap_screen.dart:447`, `home_screen.dart:564`
- **Root Cause:** `mapStepKindToRoute` returns hardcoded web-like routes that do NOT match either Web's TanStack Router or Flutter's GoRouter:
  - Returns `/diagnostic` → both apps route `/diagnostic/intro`.
  - Returns `/practice/${targetRefId}` → Web expects `/practice/${skill}/${packId}`, Flutter expects `/reading/:packId`, `/listening/:packId`, `/writing/:packId`, `/speaking/:packId`.
  - Returns `/drills?focus=...` → Web expects `/practice/drills`, Flutter expects `/micro-drill/:drillId` (or `/practice`).
  - Returns `/vocab` → Flutter expects `/vocabulary`.
  - Returns `/coach/mission`, `/coach/shifter`, `/coach/drop` → Flutter expects `/mission/today`, `/register-shifter`, `/drop`.
- **Impact:** Tapping "Start Step" on Roadmap or Home causes 404 / broken route errors across almost every step kind on both platforms.
- **Fix:** Stop relying on raw platform-specific URLs from the backend. Keep `stepKind`, `skill`, `targetRefId`, `weaknessKey`, and `topicKey` as the canonical structured fields on `RoadmapStepSchema`, and implement a dedicated, unit-tested client route resolver (`resolveRoadmapStepRoute(step)` in Web & `RoadmapRouteResolver.resolve(step)` in Flutter) that maps every `stepKind` + `skill` + `targetRefId` to verified router paths on each platform (with graceful fallback to the relevant hub if `targetRefId` is absent).

### P0-07. Unbounded Process-Global In-Memory MP3 Cache Leak in `tts.ts` + Missing Error Handling & OpenRouter TTS Endpoint Verification
- **Locations:**
  - `backend/apps/api/src/routes/tts.ts:43-46,173,192-197`
  - `backend/packages/ai/src/models/openrouter.ts`
- **Root Cause:**
  1. `tts.ts:192-197` inserts EVERY synthesized MP3 `Buffer` into an unbounded `memoryAudioCache` `Map` **even when Postgres `db` and MinIO `s3Client` are configured**, and never evicts entries. On a ~1.8 GiB RAM VPS, this guarantees progressive memory exhaustion and OOM kills.
  2. `tts.ts:173` calls `client.createSpeech(...)` without catching `EvaluationModelError` to return a structured `503` error response.
  3. OpenRouter's `hexgrad/kokoro-82m` routing compatibility (standard OpenAI `/audio/speech` vs chat-completions audio modality vs provider-specific response headers/MIME) must be smoke-tested live against OpenRouter with graceful fallback/error diagnostics so production never fails silently if OpenRouter changes the speech endpoint contract.
- **Fix:**
  - Only use `memoryAudioCache` when `s3Client` is absent (dev/test mode) AND cap it with a strict LRU limit (e.g., max 64 entries / 16 MB total bytes). When `s3Client` is configured, stream directly from S3/MinIO (or return presigned/cached binary stream) without holding MP3 buffers in Node RAM.
  - Wrap `client.createSpeech(...)` in `try/catch` returning clean `503 { code: 'tts_upstream_unavailable', ... }` with `requestId`.
  - Run a live smoke test of `OPENROUTER_TTS_MODEL=hexgrad/kokoro-82m` via `scripts/` and support configurable endpoint strategy (`speech` vs `chat_audio`) in `openrouter.ts` if needed.

### P0-08. Multi-Exam Success Threshold Bug in `personalization-store.ts` & `evaluationJobs.overallBand` Scale Corruption
- **Locations:**
  - `backend/packages/db/src/personalization-store.ts:338`
  - `backend/apps/api/src/routes/pronunciation.ts:405,475`
  - `backend/apps/worker/src/jobs/analyze-pronunciation.ts:180`
- **Root Cause:**
  1. `personalization-store.ts:338`:
     ```ts
     const succeeded = (params.accuracyRatio ?? 0.65) >= 0.72 || params.rawScore >= 6.5;
     ```
     Hardcoding `>= 6.5` assumes IELTS `0–9` scale:
     - For **TOEFL iBT (1.0–6.0)**, `rawScore` is NEVER `>= 6.5` (even a perfect `6.0`!).
     - For **PTE (10–90)** and **DET (10–160)**, even a failing score of `20` satisfies `>= 6.5`, falsely marking failed topics as "mastered" and advancing coverage phases prematurely!
  2. `pronunciation.ts:405` and `worker/src/jobs/analyze-pronunciation.ts:180` store `result.overallScore` (`0..100`) into `evaluationJobs.overallBand` (designed for `0..9` IELTS bands), polluting evaluation analytics/aggregates.
  3. `pronunciation.ts:475`: the inline fallback wraps execution in `.catch(() => {})` without marking the `pronunciation_practices` / `evaluation_jobs` row as `'failed'`, leaving clients polling forever on `'queued'`.
- **Fix:**
  - Compute `succeeded` using normalized `0..1` score (`normalizeExamScore(params.rawScore, params.examId) >= 0.72`) or `(params.accuracyRatio ?? 0) >= 0.72`.
  - Leave `evaluationJobs.overallBand` `null` (or normalize `overallScore / 100 * 9` explicitly documented, preferably `null` since pronunciation has its own `pronunciation_practices.overall_score` column).
  - In `pronunciation.ts:475`, catch errors properly and transition both `pronunciation_practices.status` and `evaluation_jobs.status` to `'failed'` with `errorMessage`.

### P0-09. Incomplete Guest → Account Merge & Shared-DB Edition Primary Key Collision
- **Locations:**
  - `backend/packages/db/src/personalization-store.ts:1038-1097` (`mergeAccountPersonalizationData`)
  - `backend/packages/db/src/migrations/0010_adaptive_personalization_and_roadmap.sql:33,261`
  - `backend/packages/db/src/schema.ts`
- **Root Cause:**
  1. `mergeAccountPersonalizationData` (called across `auth.ts` on register/login/OAuth/OTP/link) only migrates `learnerBandEvents`, `learnerProfiles`, and `pronunciationPractices`. It **drops/orphans** guest data in:
     - `learner_roadmap_plans` & `learner_roadmap_steps`
     - `learner_topic_weakness_coverage`
     - `user_vocab_srs_sync`
     - `user_attempts_sync`
     - `user_activity_ledger`
     - `ai_usage_ledger`
     - `audio_assets`
     - `linguistic_nodes` (if still keyed by `deviceId`)
  2. In migration `0010`, `learner_profiles` has `PRIMARY KEY (account_key)` (missing `edition`), and `user_vocab_srs_sync` has `PRIMARY KEY (account_key, card_id)` (missing `edition`). If an account key exists on both GLB and IRN against a shared database instance, profile/vocab rows will collide or overwrite across editions.
- **Fix:**
  - Create additive migration `0011_personalization_hardening.sql` updating PKs/unique indexes to include `edition` cleanly (`(account_key, edition)` and `(account_key, edition, card_id)`).
  - Update `mergeAccountPersonalizationData` inside a single DB transaction to merge/re-key **all 10 tables** (using conflict-safe upserts for `learner_profiles`, `learner_topic_weakness_coverage`, `user_vocab_srs_sync`, and `user_attempts_sync`, and triggering a roadmap recompute on `toAccountKey`).

### P0-10. `bandShift` Wiped to `0` on Every `GET /v1/personalization/state` Read
- **Locations:**
  - `backend/packages/db/src/personalization-store.ts:518,563-577`
- **Root Cause:** `getOrComputePersonalizationState` is invoked by `GET /v1/personalization/state`. Every single GET recomputes `liveBand` with `previousOverallScore: profileRow.currentBand` (which is already the updated band!) and immediately overwrites `learner_profiles.band_shift = 0` in Postgres. Thus, the second read (e.g., Home screen hydrating after Diagnostic or Test) wipes `bandShift` to `0` before the user ever sees the celebratory `"+0.5 Band Up!"` banner.
- **Fix:** Make `GET /v1/personalization/state` read-only whenever `learner_profiles` and active `learner_roadmap_plans` are already fresh (`dirty = false`). Only recompute and update `bandShift` (and persist `bandShiftAcknowledgedAt`) on mutating events (`recordBandEvent`, `updateProfile`, evaluation completion, diagnostic completion), plus add a lightweight `POST /v1/personalization/band-shift/ack` endpoint when the user dismisses the banner.

### P0-11. Unsafe Raw Object `::jsonb` Template Cast in `usage-ledger-store.ts`
- **Locations:**
  - `backend/packages/db/src/usage-ledger-store.ts:148-149`
- **Root Cause:** `COALESCE(${params.answersJson ?? null}::jsonb, user_attempts_sync.answers_json)` interpolates a raw JS object into a Drizzle `sql` template with `::jsonb`. Depending on pg driver serialization, complex nested objects or `undefined` can trigger Postgres cast errors on conflict updates.
- **Fix:** Serialize explicitly via `JSON.stringify(params.answersJson)` before passing to `sql`${...}::jsonb`` (or conditionally include `answersJson`/`feedbackJson` in the `.set(...)` map only when defined).

### P0-12. Diagnostic Reading & Listening Weaknesses Never Written to `linguistic_nodes`
- **Locations:**
  - `backend/apps/api/src/routes/diagnostic.ts:936-963`
- **Root Cause:** When the 10-minute Diagnostic finishes Reading & Listening, `diagnostic.ts` records `reading` and `listening` band events, but passes **no `questionTypeStats`** and never persists Reading/Listening `weaknessFocus` items into `linguistic_nodes`. As a result, the initial roadmap right after the diagnostic lacks concrete Reading/Listening weakness nodes (contradicting Plan Sections 1 & 2.2).
- **Fix:** Aggregate per-question-type accuracy from the diagnostic Reading & Listening responses, pass `questionTypeStats` into `recordLearnerBandEvent`, and upsert the top detected Reading/Listening weakness nodes into `linguistic_nodes` immediately upon diagnostic submission.

### P0-13. Study-Mode `POST /v1/evaluate/explain-question` Missing from `ai_usage_ledger`
- **Locations:**
  - `backend/apps/api/src/routes/evaluate.ts:1180-1235`
- **Root Cause:** `explainQuestionGraph.invoke(...)` is called without an `onUsage` callback and without calling `recordAiUsageLedger(...)`, leaving AI Question Explanations completely untraced in per-user token usage and OpenRouter USD cost reports.
- **Fix:** Pass `onUsage` through `explainQuestionGraph` (mirroring Writing/Speaking/Coach graphs) and call `recordAiUsageLedger` with `featureKind: 'explain_question'` and `recordUserActivity`.

### P0-14. Flutter `VocabReviewScreen` Bypasses Progressive 15-Word Waves & 10-New/Day Cap
- **Locations:**
  - `app/lib/features/vocabulary/presentation/vocabulary_notifier.dart:77-94`
  - `app/lib/features/vocabulary/presentation/vocab_review_screen.dart`
- **Root Cause:** Although Flutter `VocabularyScreen` displays the Wave banner, tapping "Start Review" invokes `VocabularyNotifier.startReview()` which still calls `vocabRepo.getDueCards(limit: effectiveLimit)` directly — completely ignoring `VocabWaveScheduler`, `unlockedWave`, and `dailyNewVocabCap`. Meanwhile Web `VocabReviewScreen.tsx:85-123` properly filters by `assignVocabWaves` and `remainingNewBudget`.
- **Impact:** Flutter users are still flooded with locked/unpersonalized words during review sessions, creating a major Web ↔ Flutter parity and UX violation.
- **Fix:** Update `VocabularyNotifier.startReview()` to run `VocabWaveScheduler.assignWaves(...)` using `personalizationStateProvider` (`unlockedWave`, `dailyNewVocabCap`, `favoriteTopics`, `currentBand`, `weaknesses`), prioritizing `mistake_to_deck` → due cards in unlocked waves → capped new cards from unlocked waves (strictly respecting `dailyNewRemaining`).

---

## Section 2: Technical Debts (P1 / P2)

### TD-01. Test Harness Blind Spot — Fake Gateways Do Not Validate Against `@mockza/contracts` (Root Cause of P0-01..P0-05)
- **Locations:** `app/test/**`, `web/src/adapters/fakes/**`, `web/e2e/**`
- **Problem:** Every P0 contract mismatch above passed CI because Flutter unit/widget/E2E tests and Web Playwright E2E tests mocked the HTTP boundary with permissive fakes that accepted arbitrary keys/enum strings.
- **Remediation:**
  1. Add a shared contract-validation layer in Web fakes (`FakePersonalizationAdapter`, `FakeSpeechPracticeAdapter`, `FakeOutboxTransport`) that runs `Schema.parse(payload)` from `@mockza/contracts` on EVERY request in tests — any drift immediately fails CI.
  2. Export a JSON schema manifest from `@mockza/contracts` (or add a Dart contract test suite reading the OpenAPI snapshot `backend/openapi.snapshot.json`) that validates every request body emitted by Flutter `PersonalizationGateway`, `SpeechPracticeGateway`, and `OutboxSyncService` against the live OpenAPI schemas!

### TD-02. Web `blobUrlCache` Unbounded Memory Leak & Missing `URL.revokeObjectURL`
- **Locations:** `web/src/adapters/http/http-speech-practice.adapter.ts:33,188`
- **Problem:** `blobUrlCache` creates `URL.createObjectURL(blob)` entries and stores them in an unbounded `Map` for the entire SPA lifetime without revoking evicted URLs.
- **Remediation:** Convert `blobUrlCache` into a bounded LRU cache (max 40 entries) that calls `URL.revokeObjectURL(evictedUrl)` on eviction and provides a `clear()` helper on logout/dispose.

### TD-03. Web `InlineListenButton` Kills Global Audio on Component Unmount
- **Locations:** `web/src/components/speech/InlineListenButton.tsx:41-45`
- **Problem:** Each `InlineListenButton` registers a `useEffect` cleanup calling global `stopEnglishSpeech()`. When a virtualized vocabulary list scrolls or a filter changes, an unmounting row kills audio currently playing from a completely different card/button.
- **Remediation:** Track an active playback token/instance ID in `speech-tts.ts` (`stopEnglishSpeechIfOwner(ownerId)`) so unmounting a button only stops audio if **that specific button** started it.

### TD-04. Web `SpeechPracticeDrawer` Auto-Submits Without Preview, Redundant History Refetch, & Missing Band-Event Sync
- **Locations:** `web/src/components/speech/SpeechPracticeDrawer.tsx:90-185`
- **Problem:**
  1. `stopRecording` immediately uploads and triggers Gemini 3.1 Flash Lite analysis (spending a daily quota slot) without letting the user preview/re-record first — unlike Flutter `SpeechPracticeSheet` which shows a `"Play My Recording"` preview + `"Analyze"` button.
  2. `loadHistory` includes `activeResult` in its `useCallback` dependency array (`line 100`), triggering an unnecessary redundant `GET /v1/pronunciation/history` immediately after every completed analysis.
  3. Completing a pronunciation analysis on Web does not invalidate/refresh `PersonalizationState` or emit a `pronunciation` band/activity update to update the Roadmap step if the active step is a pronunciation drill.
- **Remediation:** Add a preview-before-analyze state (`recorded` → user can Play, Re-record, or Analyze) matching Flutter, remove `activeResult` from `loadHistory` dependencies using a ref, and refresh `PersonalizationState` upon completion.

### TD-05. Flutter `SpeechPracticeSheet` Hardcodes `contentType: 'audio/mp4'` & Omits `durationMs`
- **Locations:** `app/lib/theme/components/speech_practice_sheet.dart:285-315`
- **Problem:** Hardcodes `contentType: 'audio/mp4'` instead of reading `recorder.activeContentType` (which breaks Flutter Web where browsers record `audio/webm` or `audio/ogg`), and never measures/passes `durationMs` to the backend tracing/cost ledger.
- **Remediation:** Read actual MIME type from the recorder service, track elapsed recording milliseconds accurately, validate minimum recording length (>= 500ms, <= 30s), and send both `contentType` and `durationMs`.

### TD-06. Flutter `OutboxSyncService` Infinite Retries on 400 Validation Errors & Sync Pull Placeholder Cards
- **Locations:**
  - `app/lib/services/outbox_sync_service.dart:260-323`
  - `app/lib/data/repositories/personalization_repository.dart:284-285`
- **Problem:**
  1. The newly added `vocab.srs_batch`, `band.event`, and `profile.update` cases in `outbox_sync_service.dart` do not route failures through `_handleDispatchFailure` (which caps retries and dead-letters terminal `400`/`422` errors), risking infinite retry loops blocking the outbox queue.
  2. `applyCrossDevicePull` inserts unknown synced vocab cards with placeholder text (`headword: cardId`, `definition: 'Synced vocabulary card'`) instead of ensuring the seeded catalog is synced first or pulling full card metadata for custom mistake cards.
- **Remediation:** Route all personalization outbox actions through `_handleDispatchFailure` with terminal-4xx dead-lettering; sync custom mistake-card metadata in `user_vocab_srs_sync` (add optional `cardSnapshotJson` column in migration `0011` for user-created cards like `mistake_to_deck` / `drop_anything`) and ensure catalog sync runs before `applyCrossDevicePull`.

### TD-07. Missing Incremental Sync (`since` Cursor) & Pagination on `/v1/sync/pull` and `/v1/pronunciation/history`
- **Locations:** `backend/apps/api/src/routes/sync.ts`, `backend/apps/api/src/routes/pronunciation.ts`
- **Problem:** Every cross-device sync pull downloads up to 100 full attempts, all vocab SRS states, and 60 pronunciation records from scratch — wasteful on constrained Iran mobile connections.
- **Remediation:** Support optional `?since=<ISO>` query parameter on `GET /v1/sync/pull` (returning only delta rows updated after `since`, plus `serverNowIso` cursor stored locally on Web Dexie & Flutter SQLite) and `?cursor=` / `?limit=` pagination on `/v1/pronunciation/history`.

### TD-08. Missing Per-Account Rate Limiting / Quota Guard on `/v1/tts/synthesize`
- **Locations:** `backend/apps/api/src/routes/tts.ts`
- **Problem:** While TTS audio is cached by SHA-256 hash, an abusive client can send thousands of unique random strings to `/v1/tts/synthesize`, burning OpenRouter Kokoro-82m spend with no per-account daily cap or burst limiter.
- **Remediation:** Add per-account rate limiting (e.g., 60 req/min burst) plus daily uncached synthesis caps (e.g., Free: 80 unique syntheses/day, Pro: 500/day; cache hits remain unlimited and free) enforced via `ai_usage_ledger` / Redis counter.

### TD-09. GDPR Erasure Hard-Deletes `ai_usage_ledger` Breaking Financial Spend Reconciliation
- **Locations:** `backend/apps/api/src/routes/account.ts:360,377`
- **Problem:** Deleting a user's account hard-deletes their rows in `ai_usage_ledger`, causing historical OpenRouter spend totals in `/v1/admin/usage/summary` to drift below actual provider invoices.
- **Remediation:** On account erasure, keep `ai_usage_ledger` rows for aggregate cost reconciliation by pseudonymizing `account_key = 'deleted:' || sha256(account_key + salt)` and stripping `request_id`/`entity_id` metadata, while still hard-deleting all PII, audio blobs, recordings, transcripts, profiles, and activity timelines.

### TD-10. Hardcoded English Strings & Generic Placeholders in New Flutter/Web UI Components
- **Locations:**
  - `app/lib/features/roadmap/presentation/roadmap_screen.dart:437` (`'Clear sustained academic articulation raises IELTS fluency.'`, `'Step completed! Next step unlocked.'`)
  - `app/lib/features/progress/presentation/progress_screen.dart:210`
  - `app/lib/theme/components/speech_practice_sheet.dart` (`'Audio load failed'`, etc.)
  - `web/src/spa/features/vocabulary/VocabHubScreen.tsx:271-277` (inline `isRtl ? ... : ...` instead of i18n keys)
  - `app/lib/features/diagnostic/presentation/diagnostic_results_screen.dart` (hardcoded English strings on non-localized parts)
- **Remediation:** Move all UI strings into `app/lib/l10n/app_en.arb` + `app_fa.arb` and `web/src/i18n/en.ts` + `fa.ts`, and replace the generic placeholder sentence in Roadmap/Progress with the user's actual latest weakness/upgrade sentence or contextual step phrase.

### TD-11. Missing `updated_at` / `active_roadmap_dirty` Flag & Idempotency on Roadmap Action Endpoint
- **Locations:** `backend/packages/db/src/personalization-store.ts`, `backend/apps/api/src/routes/personalization.ts`
- **Problem:** Rapid double-taps on "Mark Step Complete" can skip two consecutive steps because `/v1/personalization/roadmap/steps/:stepId/action` does not guard against already-completed steps cleanly or return a deterministic no-op.
- **Remediation:** Make step transitions strictly idempotent (completing an already-completed step returns current state without advancing another step) and add an `active_plan_version` / optimistic check.

### TD-12. Backend OpenRouter Pricing Config Drift & Missing Fallback Pricing Alert
- **Locations:** `backend/packages/ai/src/observability/usage-extract.ts`, `backend/packages/config/`
- **Problem:** Cost estimation uses static per-model fallback rates when OpenRouter omits `usage.cost` (e.g., on TTS audio responses). If OpenRouter changes pricing or a new model ID is set via env var (`OPENROUTER_TTS_MODEL`, `OPENROUTER_PRONUNCIATION_MODEL`), unmapped models record `estimatedCostUsd = 0` silently.
- **Remediation:** Add `OPENROUTER_PRICING_OVERRIDES_JSON` env support + log a structured warning when a model falls back to `0` cost, and add a `costSource: 'openrouter_reported' | 'estimated_table' | 'unknown'` column/metadata tag in `ai_usage_ledger` so Admin reports distinguish exact billed cost vs estimated cost.

---

## Section 3: UI/UX & Functionality Enhancements (100% Web ↔ Flutter & GLB ↔ IRN Parity)

Comparing the current screens against `docs/ADAPTIVE_PERSONALIZATION_AND_ROADMAP_PLAN.md` (Sections 3, 4, 5, 6), the following enhancements will transform the app from "features added on top of old screens" into the truly calm, guided, step-by-step experience requested:

### UX-01. Home Screen Anti-Overload Streamlining + Celebratory Band-Shift Banner (Web & Flutter)
- **Current State:** Both Flutter `HomeScreen` and Web `HomeScreen` stacked the new Roadmap card on top of all legacy dashboard blocks (MetricHero + 4 full SkillMetricCards + StudyWeek + MissionProgressCard + RecommendationCard), causing visual overload.
- **Enhancement:**
  - Streamline Home into 4 calm, high-focus blocks:
    1. **Compact Live Band & Goal Header** (single-row pill: Current Band `6.0` → Target `7.5` + confidence badge `Provisional` / `Calibrated` + subtle tap-through to Progress).
    2. **Dismissible Band-Shift Celebration Banner** (appears ONLY when `bandShift !== 0`, e.g., `"+0.5 Band Up! Your Speaking jumped to 6.5 — Roadmap refreshed for Band 7.0 targets"` with ack button).
    3. **Primary Single-Focus Hero ("Your Next Step — Step N of M")** with Topic + Weakness reason chips, estimated minutes, and ONE unmistakable primary CTA (`Start Step N`).
    4. **Horizontal Durnama Panorama Strip** (compact 4-milestone dots: `M1 ● — M2 ◎ — M3 ○ — M4 ○` + `"View Full Roadmap →"`) + compact 2-item **Today's Quick Strip** (`Daily Vocab Wave (N due)` + `3-Min Drill`).
  - Move secondary full skill grids & historical analytics cleanly to the **Progress** tab.

### UX-02. Diagnostic Results → Personalized Roadmap Reveal (Web & Flutter)
- **Current State:** Flutter `DiagnosticResultsScreen` only added a small text button `"View Full Roadmap"` at the bottom; Web `DiagnosticResultsScreen` similarly lacks the rich roadmap handoff.
- **Enhancement:**
  - Add a **Provisional Band Reveal Card** showing overall estimated band + clear `"Provisional baseline — sharpens with every practice test"` badge.
  - Display **Top 2 Detected Weaknesses** across all 4 skills (now powered by P0-12 Reading/Listening diagnostic weakness extraction + Writing/Speaking AI evaluation).
  - Embed an inline **4-Milestone Durnama Preview Card** (showing Milestone 1..4 titles, target bands, and focus topics) with primary CTA `"Start Step 1 of Your Roadmap →"`.

### UX-03. Practice Hub & Micro-Drills "For Your Path" Parity on Flutter (Matching & Upgrading Web)
- **Current State:** Web `PracticeCatalogScreen` highlights `recommendedPacks` with spotlight badges, whereas Flutter `PracticeHubScreen` (`app/lib/features/practice_hub/presentation/practice_hub_screen.dart`) does NOT even watch `personalizationStateProvider`! Neither Flutter nor Web has a clean `"For Your Path" | "All Tests"` default tab.
- **Enhancement:**
  - Add a segmented toggle **`For Your Path` (default) | `All Tests`** at the top of Practice Hub (Flutter & Web).
  - In `For Your Path`, show:
    - **#1 Best Next Practice Pack** hero card with transparent reason chips (`Band 6.5 Fit` · `Your Topic: Technology` · `Targets: TFNG`).
    - **Best Next 3-Minute Micro-Drill** spotlight card targeting the top active weakness.
    - **2 Alternative Next Packs** (same band/weakness fit) so the user has agency without catalog paralysis.
  - Keep `All Tests` one tap away for users who want to browse the full catalog.

### UX-04. Vocabulary 3-Tab Progressive UX & Wave Auto-Unlock Celebration (Web & Flutter)
- **Current State:** Web & Flutter show a single flat list with a wave banner and toggle; Flutter review ignores waves (P0-14); no configurable daily cap selector in Settings; no `"Why this word?"` badge during flashcards.
- **Enhancement:**
  - Structure Vocabulary Hub into 3 clean tabs on both Web & Flutter:
    1. **`Today's Wave`** (default: active unlocked wave cards + visual progress ring toward 60% unlock threshold + prominent `"Start Today's Review (N cards)"` CTA).
    2. **`My Saved Mistakes`** (high-priority cards saved from AI evaluations, Reading/Listening mistakes, and Drop Anything).
    3. **`Full Deck`** (searchable entire deck, clearly showing locked future waves with a soft `"Preview / Unlock Wave"` action).
  - Show a subtle **`Why this word?`** tag on every flashcard during review (`Band 6.5 · Your Topic: Environment` or `From Your Speaking Evaluation`).
  - Show a celebratory **Wave Unlocked toast/card** automatically when the user crosses >= 60% learned in their current wave.
  - Add **Daily New Vocab Cap** selector (`5 / 10 / 20 words/day`) in Settings (Web & Flutter), synced via `PUT /v1/personalization/profile`.

### UX-05. Post-Test "How This Updated Your Plan" Impact Card (Web & Flutter)
- **Current State:** After finishing Reading, Listening, Writing, or Speaking, neither `ObjectiveResultScreen`/`EvaluationResultScreen` (Web) nor `EvaluationReviewScreen`/Objective Review (Flutter) tells the user how the test affected their Live Band, Weaknesses, or Roadmap.
- **Enhancement:**
  - Add a compact, scannable **"How This Updated Your Plan"** card at the top of post-test results (both Web and Flutter):
    - **Live Band Impact:** e.g., `Reading 6.0 → 6.5 (+0.5)` or `Band steady at 6.5 (Calibrated)`
    - **Weaknesses Updated:** e.g., `TFNG accuracy improved to 83%` or `Added focus: Matching Headings`
    - **Roadmap Progress:** e.g., `Step 2 Completed ✓ → Step 3 Unlocked`
    - **Primary Next CTA:** `"Continue to Step 3: Writing Task 2 — Environment →"`

### UX-06. Progress Screen Parity: Synced Pronunciation History + Confidence-Annotated Band Chart (Web & Flutter)
- **Current State:** Web `ProgressScreen` shows a synced `pronHistory` list with inline audio replay, whereas Flutter `ProgressScreen` only shows a button opening `SpeechPracticeSheet` with a generic sentence. Neither chart distinguishes Provisional vs Calibrated points.
- **Enhancement:**
  - Add a synced **Pronunciation Practice History** section to Flutter `ProgressScreen` (parity with Web): shows recent takes, target text, score badge (`0–100`), timestamp, and **Play My Recording** + **Review Feedback** + **Re-Practice** actions (hydrated from cross-device sync!).
  - Annotate the Band Trend Chart (Web & Flutter) with distinct markers for **Provisional Baseline (hollow/dashed dot)** vs **Calibrated Full/Section Practice (solid dot)** + Target Band horizontal dashed line.

### UX-07. Pronunciation Practice Studio Pro UX (Web & Flutter 100% Parity)
- **Current State:** Web auto-submits without preview; no live waveform or countdown; no clickable word-level single-word Kokoro drill; no A/B audio comparison; no UK vs US voice accent choice; no remaining daily quota display.
- **Enhancement:**
  - Unify both Web `SpeechPracticeDrawer` and Flutter `SpeechPracticeSheet` into a crystal-clear **4-Step Guided Studio**:
    1. **Step 1 — Listen to Reference:** Kokoro-82m playback with **`1.0x` / `0.8x` (Slow)** toggle AND **Accent Selector (`British UK · bf_emma` / `American US · af_bella`)** — essential for IELTS & international exam learners!
    2. **Step 2 — Record Shadow Take:** Live amplitude waveform bar + countdown timer (`0:00 / 0:30` with auto-stop at 30s) + clear Hold/Tap mic button.
    3. **Step 3 — Preview Before Analyzing:** Listen back to your own recording, **Re-record** for free if you stumbled, or tap **"Analyze Pronunciation"** (displaying remaining daily quota, e.g., `14 / 15 left today`).
    4. **Step 4 — Deep Actionable Feedback:**
       - 4 score rings: **Overall, Pronunciation, Stress & Rhythm, Fluency**.
       - **Interactive Word-by-Word Highlighted Strip:** Green (`good`), Amber (`needs_work`), Red (`missed`). **Tapping any Amber/Red word** opens an inline detail popover showing `Target IPA` vs `Your Spoken IPA`, exact mouth/tongue placement tip (in English for GLB, Persian + English IPA for IRN), AND a **`Listen to this word at 0.8x`** button (calls Kokoro-82m for that isolated word!) + **`Practice this word`**.
       - **Side-by-Side A/B Audio Toggle:** `"Play Kokoro Reference"` vs `"Play My Take"` right next to each other so the learner immediately hears the exact phonetic difference.
       - **Try Again & Beat Your Score** CTA showing previous best vs current take (`74 → 86 (+12)`).

### UX-08. Roadmap Screen Refinements: Collapsible Completed Milestones, Soft-Jump & Inline Personalization Sheet (Web & Flutter)
- **Current State:** All milestones render expanded equally; locked/upcoming steps don't clearly let confident learners jump ahead; changing topics/pace requires leaving Roadmap to Settings.
- **Enhancement:**
  - **Collapse completed milestones** into a clean green summary pill (`Milestone 1: Foundations — 4/4 Complete ✓` expandable on tap) so the user's eye lands immediately on the **Active Milestone & Active Step**.
  - On upcoming steps, show a subtle `"Jump ahead anyway"` secondary action (soft guidance, never rigid lock-out).
  - Add a **"Topics & Pace"** button in the Roadmap header opening a bottom sheet / modal to edit `Favorite Topics` (3–5 chips), `Daily Study Minutes`, and `Target Band` — immediately triggering roadmap regeneration with a live diff toast (`"Roadmap updated with your new topics!"`).

### UX-09. Linguistic Graph: Topic × Weakness Coverage Matrix & Band-Calibrated Register Shifter (Web & Flutter)
- **Current State:** Backend tracks `learner_topic_weakness_coverage` (Phase 1 Favorite Topics → Phase 2 Adjacent Topics → Phase 3 Full Exam Breadth), but the UI does not visualize this journey; `RegisterShifterScreen` does not pre-select target gear from `liveBand`.
- **Enhancement:**
  - On `LinguisticGraphScreen` (Web & Flutter), add a compact **Topic × Weakness Phase Coverage Card** showing which weaknesses are mastered on Favorite Topics vs expanding to General Exam Topics (making the adaptive rotation transparent and motivating).
  - On `RegisterShifterScreen` (Web & Flutter), pre-select the target band gear automatically from `liveBand.currentBand + 1.0` (clamped to `targetBand`) with a badge `"Auto-calibrated for your Band 6.0 → 7.0 step"`.

### UX-10. Admin Observability & Tracing Console Upgrades (API + Protected Web Admin View)
- **Current State:** Backend has `/v1/admin/usage/summary`, `/v1/admin/users/:accountKey/trace`, and `/v1/admin/recordings/stream`, but lacks date filtering, CSV export, and any visual inspection UI.
- **Enhancement:**
  - Add `?from=<ISO>&to=<ISO>&edition=<glb|irn>&featureKind=<...>` filters and `GET /v1/admin/usage/export.csv` on the Backend Admin API.
  - Add a minimal, key-gated **Admin Trace & Cost Inspector** page (or dedicated dev/admin route gated strictly by `x-admin-key`, never exposed in learner navigation) to search a user by `accountKey`/email, inspect their band timeline, play back their uploaded pronunciation/speaking recordings inline, read AI feedbacks, and audit exact token & USD spend per feature/model.

### UX-11. Study-Mode Reading/Listening Selection Listen & Shadow (Web & Flutter)
- **Current State:** Listen & Shadow buttons exist per question/feedback card, but learners reading a passage in Study Mode cannot highlight/tap a specific tricky sentence to hear Kokoro-82m read it and shadow it.
- **Enhancement:**
  - In **Study Mode ONLY** (strictly disabled in timed Exam Mode per `AGENTS.md` Exam Mode Restraint), add a subtle `"Listen to Passage Paragraph"` button per paragraph (Web & Flutter) and a text-selection tooltip (`Listen` | `Practice Pronunciation` | `Save to Vocab`) on Web + sentence-tap sheet on Flutter.

---

## Section 4: Complete Detailed Task-by-Task Implementation Plan

Execute the phases below **in strict numerical order**. Before running any build/test command in any phase, check available RAM (`free -m`), use `NODE_OPTIONS="--max-old-space-size=1024"` / `DART_VM_OPTIONS="--old_gen_heap_size=1024"`, and run heavy builds/tests sequentially (`--workers=1` / `--concurrency=1`).

---

### Phase R1: P0 Production & Contract Hotfixes (Highest Priority — Unblocks Live API)

#### Task R1.1 — Shared Contracts & DB Schema Hardening (`@mockza/contracts`, `@mockza/db`)
- **Files:**
  - `backend/packages/contracts/src/schemas.ts`
  - `backend/packages/db/src/migrations/0011_personalization_hardening.sql` (new)
  - `backend/packages/db/src/schema.ts`
  - `backend/packages/db/src/usage-ledger-store.ts`
  - `backend/packages/db/src/personalization-store.ts`
- **Steps:**
  1. In `schemas.ts`:
     - Expand `studyFocus` enum to `z.enum(['exams', 'coach', 'both', 'speaking_only'])`.
     - Raise `targetBand` max in `UpdatePersonalizationProfileRequestSchema` & `PersonalizationProfileSchema` from `120` to `160`.
     - Add `PronunciationSingleResponseSchema` for `GET /v1/pronunciation/:practiceId`.
     - Add `cardSnapshotJson` optional field to `VocabBatchSyncCardSchema` (for syncing user-created mistake/drop cards across devices).
     - Add `bandShiftAcknowledged: z.boolean().optional()` and `voiceAccent: z.enum(['us', 'uk']).default('us')` to `PersonalizationProfileSchema`.
     - Add `AckBandShiftResponseSchema` for `POST /v1/personalization/band-shift/ack`.
     - Export explicit canonical arrays (`TTS_SOURCE_CONTEXTS`, `PRONUNCIATION_PRACTICE_KINDS`, `PRONUNCIATION_SOURCE_REF_TYPES`, `BAND_EVENT_SKILLS`, `BAND_EVENT_SOURCE_KINDS`) so clients and tests share the single source of truth.
  2. Write `0011_personalization_hardening.sql`:
     - Add composite uniqueness / PK scoping by `edition` on `learner_profiles` (`(account_key, edition)`) and `user_vocab_srs_sync` (`(account_key, edition, card_id)`).
     - Add `card_snapshot_json jsonb` to `user_vocab_srs_sync`.
     - Add `band_shift_ack_at timestamptz` and `preferred_tts_accent text NOT NULL DEFAULT 'us'` to `learner_profiles`.
     - Add `cost_source text NOT NULL DEFAULT 'openrouter_reported'` to `ai_usage_ledger`.
     - Mirror all column/index additions in `backend/packages/db/src/schema.ts`.
  3. Fix `usage-ledger-store.ts:148-149`: serialize `answersJson` / `feedbackJson` safely via `JSON.stringify(...)` or conditionally omit `undefined` keys in `.set(...)` instead of raw object `::jsonb` interpolation.
  4. Fix `personalization-store.ts:338`: replace `params.rawScore >= 6.5` with normalized exam score (`normalizeExamScore(params.rawScore, params.examId) >= 0.72 || (params.accuracyRatio ?? 0) >= 0.72`).
  5. Fix `personalization-store.ts:518-577`:
     - Make `GET /v1/personalization/state` read-only when profile/plan already exist and no recompute is required, preserving non-zero `bandShift` until acknowledged via `POST /v1/personalization/band-shift/ack` or overwritten by a newer band event.
     - Make `advanceRoadmapStep` strictly idempotent (no-op if `stepId` is already in requested terminal status).
  6. Fix `personalization-store.ts:1038-1097` (`mergeAccountPersonalizationData`):
     - Wrap in `db.transaction(async (tx) => ...)`.
     - Migrate ALL 10 tables: `learnerBandEvents`, `learnerProfiles`, `learnerRoadmapPlans`, `learnerRoadmapSteps`, `learnerTopicWeaknessCoverage`, `pronunciationPractices`, `userVocabSrsSync`, `userAttemptsSync`, `userActivityLedger`, `aiUsageLedger`, `audioAssets`, and `linguisticNodes` (using conflict-safe merge rules keeping latest `updatedAt` / higher `repetitions` / merged `favoriteTopics`).
     - Recompute roadmap for `toAccountKey` after merge.
- **Verification:** `npm --workspace=@mockza/contracts run build && npm --workspace=@mockza/db run test` + regenerate `backend/openapi.snapshot.json` if needed.

#### Task R1.2 — Backend TTS RAM Leak, Error Handling, Pronunciation Job Status & Tracing Fixes
- **Files:**
  - `backend/apps/api/src/routes/tts.ts`
  - `backend/apps/api/src/routes/pronunciation.ts`
  - `backend/apps/worker/src/jobs/analyze-pronunciation.ts`
  - `backend/apps/api/src/routes/diagnostic.ts`
  - `backend/apps/api/src/routes/evaluate.ts`
  - `backend/apps/api/src/routes/personalization.ts`
  - `backend/packages/ai/src/graphs/explain-question.ts` (verify `onUsage` hook)
- **Steps:**
  1. **`tts.ts`:**
     - Replace unbounded `memoryAudioCache` with a bounded LRU cache (max 64 entries / 16 MB) used **ONLY** when `!s3Client`. When `s3Client` is configured, read/write exclusively through S3/MinIO + Postgres `tts_audio_cache` (zero process-RAM audio retention).
     - Wrap `client.createSpeech(...)` in `try/catch` returning `503 { code: 'tts_upstream_unavailable', message, requestId }`.
     - Add per-account rate limit (60 req/min) and daily uncached synthesis cap (Free: 80/day, Pro: 500/day; cached hits unlimited).
     - Support `voiceId` mapping for UK (`bf_emma`) and US (`af_bella`) accents validated against allowlist.
     - Run a live OpenRouter smoke check for `hexgrad/kokoro-82m` and verify audio bytes + `usage` extraction; document verified model/endpoint behavior.
  2. **`pronunciation.ts` & `worker/src/jobs/analyze-pronunciation.ts`:**
     - Add `GET /v1/pronunciation/:practiceId` returning the single `PronunciationPracticeItemSchema` (including `status: 'queued' | 'processing' | 'completed' | 'failed'` and `errorMessage`) so Flutter and Web poll a lightweight single-row endpoint instead of downloading 60 history records every second.
     - Stop writing `0..100` `overallScore` into `evaluationJobs.overallBand` (keep `overallBand: null` on pronunciation jobs).
     - Fix inline fallback `.catch(...)` (`pronunciation.ts:475`) to mark both `pronunciation_practices` and `evaluation_jobs` as `status: 'failed'` with `errorMessage` and structured error logging.
  3. **`diagnostic.ts:936-963`:**
     - Compute `questionTypeStats` from diagnostic Reading and Listening items.
     - Pass `questionTypeStats` to `recordLearnerBandEvent(...)` and persist detected Reading/Listening weaknesses into `linguistic_nodes`.
  4. **`evaluate.ts:1180-1235`:**
     - Wire `onUsage` callback into `explainQuestionGraph.invoke(...)` and call `recordAiUsageLedger({ featureKind: 'explain_question', ... })` + `recordUserActivity(...)`.
  5. **`personalization.ts`:**
     - Register `POST /v1/personalization/band-shift/ack` to acknowledge/dismiss the band shift banner.
- **Verification:** `npm --workspace=@mockza/api run test && npm --workspace=@mockza/worker run test`.

#### Task R1.3 — Flutter P0 Live-API Contract Fixes (Pronunciation, TTS, Vocab Sync, Band Events, Route Resolver)
- **Files:**
  - `app/lib/services/speech_practice_gateway.dart`
  - `app/lib/services/personalization_gateway.dart`
  - `app/lib/services/outbox_sync_service.dart`
  - `app/lib/theme/components/inline_listen_button.dart`
  - `app/lib/theme/components/speech_practice_sheet.dart`
  - `app/lib/routing/roadmap_route_resolver.dart` (new)
  - `app/lib/features/roadmap/presentation/roadmap_screen.dart`
  - `app/lib/features/home/presentation/home_screen.dart`
  - `app/lib/features/vocabulary/presentation/vocabulary_notifier.dart`, `vocab_flip_card.dart`, `vocab_word_detail_screen.dart`, `vocabulary_screen.dart`
  - `app/lib/features/reading_sim/presentation/reading_sim_notifier.dart`, `reading_sim_screen.dart`
  - `app/lib/features/listening_sim/presentation/listening_sim_notifier.dart`
  - `app/lib/features/micro_drills/presentation/micro_drills_notifier.dart`
  - `app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart`
  - `app/lib/features/register_shifter/presentation/register_shifter_screen.dart`
  - `app/lib/features/drop_anything/presentation/drop_anything_screen.dart`
  - `app/lib/features/linguistic_mission/presentation/daily_mission_screen.dart`
  - `app/lib/features/progress/presentation/progress_screen.dart`
  - `app/lib/data/repositories/personalization_repository.dart`
- **Steps:**
  1. **Typed Contract Enums in `speech_practice_gateway.dart` & `personalization_gateway.dart`:**
     - Create Dart enums `TtsSourceContext`, `PronunciationPracticeKind`, `PronunciationSourceRefType`, `BandEventSkill`, `BandEventSourceKind`, `StudyFocusMode` whose `.wireValue` matches `@mockza/contracts` 1:1.
     - Refactor ALL Flutter call sites (`InlineListenButton`, `SpeechPracticeSheet`, `reading_sim_notifier`, `listening_sim_notifier`, `micro_drills_notifier`, `vocabulary_notifier`, `onboarding_notifier`, `settings_notifier`) to pass typed enums — eliminating raw string contract mismatches permanently.
  2. **Fix `speech_practice_gateway.dart`:**
     - Read `data['cacheKey']` (not `cacheId`).
     - Update `analyzeRecording` to handle HTTP `202` `{ jobId, status }` and poll `GET /v1/pronunciation/:practiceId` (every 1.2s, max 45s) until `status == 'completed'` or `'failed'`, returning the scored `PronunciationPracticeItemDto` (or structured error).
  3. **Fix `speech_practice_sheet.dart`:**
     - Generate `practiceId` via `ref.read(entropySourceProvider).nextUuidV4()`.
     - Read actual `contentType` from the audio recorder service (never hardcoded `'audio/mp4'`).
     - Track recording `durationMs` and enforce `500ms..30000ms` bounds.
     - After analysis completes, emit a valid `BandEventSourceKind.pronunciation` / `BandEventSkill.speaking` event and refresh `personalizationStateProvider`.
  4. **Fix Vocab Batch Sync (`vocabulary_notifier.dart`, `outbox_sync_service.dart`, `personalization_gateway.dart`):**
     - Enqueue and POST `{ "cards": [{ "cardId": ..., "easeFactorMilli": ..., "intervalDays": ..., "repetitions": ..., "dueSerialDay": ..., "lapses": ..., "lastReviewedAt": ..., "sourceKind": ..., "cardSnapshotJson": ... }] }` matching `VocabBatchSyncRequestSchema`.
     - Route `vocab.srs_batch`, `band.event`, and `profile.update` errors through `_handleDispatchFailure` with terminal-4xx dead-lettering.
  5. **Fix Flutter `VocabReviewScreen` Wave Enforcement (`vocabulary_notifier.dart`):**
     - Replace raw `getDueCards` in `startReview()` with `VocabWaveScheduler.assignWaves(...)` using `unlockedWave`, `dailyNewVocabCap`, `favoriteTopics`, `currentBand`, and `weaknesses`. Prioritize: (1) Saved Mistakes (`mistake_to_deck` / `evaluation_upgrade` / `drop_extract`), (2) Due cards in unlocked waves, (3) New cards in unlocked waves capped at `dailyNewRemaining`.
  6. **Fix Objective Attempt + Weakness Sync (`reading_sim_notifier.dart`, `listening_sim_notifier.dart`):**
     - Compute `questionTypeStats` (`{ questionType, correct, total }`) and pack `topicKeys` on exam submit.
     - Include `attemptId`, `packId`, `questionTypeStats`, `topicKeys`, `answersJson`, and `feedbackJson` in the `band.event` payload (`sourceKind: 'practice_section'` or `'full_mock'`).
  7. **Fix `PersonalizationRepository.applyCrossDevicePull`:**
     - Preserve exact `studyFocus` (`'exams' | 'coach' | 'both'`).
     - Trigger seeded catalog hydration before applying pulled SRS cards; hydrate user-created mistake cards from `cardSnapshotJson` instead of writing `'Synced vocabulary card'` placeholders.
  8. **Create `RoadmapRouteResolver` (`app/lib/routing/roadmap_route_resolver.dart`):**
     - Deterministically map `RoadmapStepDto` (`stepKind`, `skill`, `targetRefId`, `weaknessKey`, `topicKey`) to exact Flutter `AppRoutes` (`AppRoutes.diagnosticIntro`, `AppRoutes.buildReading(packId)`, `AppRoutes.buildListening(packId)`, `AppRoutes.buildWriting(packId)`, `AppRoutes.buildSpeaking(packId)`, `AppRoutes.vocabulary`, `AppRoutes.microDrills`, `AppRoutes.dailyMission`, `AppRoutes.registerShifter`, `AppRoutes.dropAnything`).
     - Wire into `RoadmapScreen` and `HomeScreen`.

#### Task R1.4 — Web P0 Live-API Contract Fixes (Vocab Sync, Objective Weaknesses, Route Resolver, StudyFocus)
- **Files:**
  - `web/src/spa/features/vocabulary/VocabReviewScreen.tsx`
  - `web/src/adapters/http/api-client.ts`
  - `web/src/adapters/http/http-speech-practice.adapter.ts`
  - `web/src/spa/useObjectiveSimulatorSession.ts`
  - `web/src/spa/cross-device-sync.ts`
  - `web/src/spa/roadmap-route-resolver.ts` (new)
  - `web/src/spa/features/roadmap/RoadmapScreen.tsx`
  - `web/src/spa/features/home/HomeScreen.tsx`
- **Steps:**
  1. Fix `VocabReviewScreen.tsx:202-220`: change payload from `{ items: [{ ..., reviewedAtIso }] }` to `{ cards: [{ ..., lastReviewedAt, cardSnapshotJson }] }` strictly matching `VocabBatchSyncRequestSchema`.
  2. Fix `useObjectiveSimulatorSession.ts:279-287`: compute `questionTypeStats` per question type + `topicKeys` from the exam bundle, and attach `attemptId`, `packId`, `questionTypeStats`, `topicKeys`, `answersJson`, and `feedbackJson` to the `band.event` payload.
  3. Fix `cross-device-sync.ts:66`: preserve exact `studyFocus` (`'exams' | 'coach' | 'both'`) without collapsing `'exams'` into `'both'`.
  4. Update `http-speech-practice.adapter.ts:138-157`: poll lightweight `GET /v1/pronunciation/:practiceId` instead of fetching the full 60-item history array on every poll tick.
  5. Create `web/src/spa/roadmap-route-resolver.ts` mapping `RoadmapStepDto` (`stepKind`, `skill`, `targetRefId`) to exact TanStack Router paths (`/diagnostic/intro`, `/practice/${skill}/${packId}`, `/vocabulary`, `/practice/drills`, `/coach/mission`, `/coach/shifter`, `/coach/drop`), and wire into `RoadmapScreen.tsx` and `HomeScreen.tsx`.

---

### Phase R2: Reliability, Memory Safety, Sync & Tracing Hardening (P1 Technical Debts)

#### Task R2.1 — Web Audio Memory & Lifecycle Hardening
- **Files:**
  - `web/src/adapters/http/http-speech-practice.adapter.ts`
  - `web/src/components/speech-tts.ts`
  - `web/src/components/speech/InlineListenButton.tsx`
- **Steps:**
  1. Convert `blobUrlCache` in `http-speech-practice.adapter.ts` to a 40-entry LRU cache that revokes evicted Blob URLs via `URL.revokeObjectURL(...)`.
  2. Add owner-scoped playback control (`playEnglishSpeech({ ownerId, ... })` + `stopEnglishSpeechIfOwner(ownerId)`) in `speech-tts.ts`, and update `InlineListenButton.tsx` cleanup to only stop playback if it owns the currently playing audio.

#### Task R2.2 — Incremental Cross-Device Sync (`since` Cursor) & Pagination
- **Files:**
  - `backend/apps/api/src/routes/sync.ts`
  - `backend/apps/api/src/routes/pronunciation.ts`
  - `backend/packages/contracts/src/schemas.ts`
  - `web/src/adapters/http/http-personalization.adapter.ts`, `web/src/spa/cross-device-sync.ts`
  - `app/lib/services/personalization_gateway.dart`, `app/lib/data/repositories/personalization_repository.dart`
- **Steps:**
  1. Support `?since=<ISO>` on `GET /v1/sync/pull` returning only updated attempts/vocab/pronunciation rows + `serverNowIso`.
  2. Support `?limit=&cursor=` pagination on `GET /v1/pronunciation/history`.
  3. Persist `lastSyncPullIso` locally in Web Dexie (`syncMeta`) and Flutter SQLite (`sync_meta`) and pass it on subsequent pulls (with full pull fallback on sign-in / account switch).

#### Task R2.3 — GDPR Erasure vs Financial Cost Ledger Reconciliation & Pricing Observability
- **Files:**
  - `backend/apps/api/src/routes/account.ts`
  - `backend/packages/ai/src/observability/usage-extract.ts`
  - `backend/packages/config/src/env.ts`
- **Steps:**
  1. In `account.ts` erasure handler, pseudonymize `ai_usage_ledger.account_key` (`deleted:<sha256>`) and strip PII metadata (`entity_id`, `request_id`) instead of hard-deleting rows, while hard-deleting all learner PII, profiles, activity logs, recordings, and S3 audio objects.
  2. Add `OPENROUTER_PRICING_OVERRIDES_JSON` env parsing + `costSource` tagging (`'openrouter_reported' | 'estimated_table' | 'unknown'`) and structured warn logging when a configured model lacks pricing data.

#### Task R2.4 — Complete Localization Hygiene (Zero Hardcoded English Strings in GLB/IRN UI)
- **Files:**
  - `app/lib/l10n/app_en.arb`, `app/lib/l10n/app_fa.arb` (regenerate via `flutter gen-l10n`)
  - `web/src/i18n/en.ts`, `web/src/i18n/fa.ts`
  - `app/lib/features/roadmap/presentation/roadmap_screen.dart`, `progress_screen.dart`, `speech_practice_sheet.dart`, `diagnostic_results_screen.dart`
  - `web/src/spa/features/vocabulary/VocabHubScreen.tsx`, `RoadmapScreen.tsx`, `SpeechPracticeDrawer.tsx`
- **Steps:**
  1. Extract every hardcoded English/Persian string into ARB keys (Flutter) and i18n dictionary keys (Web) with verified natural English (GLB) and Persian (IRN) translations.
  2. Replace generic placeholder practice sentences in Roadmap & Progress with context-aware sentences drawn from the user's active step, top weakness, or recent upgrade card.

---

### Phase R3: Web ↔ Flutter Parity & High-Impact UX Polish (GLB + IRN)

#### Task R3.1 — Home Screen Anti-Overload Streamlining & Band-Shift Celebration Banner
- **Files:**
  - `web/src/spa/features/home/HomeScreen.tsx`
  - `app/lib/features/home/presentation/home_screen.dart`
- **Steps:**
  1. Implement the calm 4-section layout identically on Web and Flutter:
     - Compact Live Band + Goal header pill (`Current → Target` + `Provisional`/`Calibrated` badge).
     - Dismissible **Band-Shift Celebration Banner** (`bandShift !== 0`) calling `POST /v1/personalization/band-shift/ack` on dismiss.
     - Single-Focus **Active Step Hero Card** (`Step N of M`, reason chips, time estimate, 1 primary CTA).
     - Compact **4-Milestone Panorama Strip** (`M1–M4` dots + `"View Full Roadmap"`) + 2-item **Today's Quick Strip** (`Vocab Wave` + `Quick Drill`).
  2. Verify zero RTL/compact overflow on 360px/375px mobile widths (both LTR EN and RTL FA).

#### Task R3.2 — Diagnostic Results Personalized Roadmap Reveal
- **Files:**
  - `web/src/spa/features/diagnostic/DiagnosticResultsScreen.tsx`
  - `app/lib/features/diagnostic/presentation/diagnostic_results_screen.dart`
- **Steps:**
  1. Hydrate `PersonalizationState` on Results load (polling briefly while diagnostic Writing/Speaking settles if needed).
  2. Render Provisional Band Hero, Top 2 Detected Weaknesses chips (across Reading/Listening/Writing/Speaking), and an inline **4-Milestone Roadmap Preview** card.
  3. Wire primary CTA `"Start Step 1 of Your Roadmap"` directly through `RoadmapRouteResolver`.

#### Task R3.3 — Practice Hub & Micro-Drills `"For Your Path"` Tab (Web & Flutter Parity)
- **Files:**
  - `app/lib/features/practice_hub/presentation/practice_hub_screen.dart`
  - `app/lib/features/micro_drills/presentation/micro_drills_screen.dart`
  - `web/src/spa/features/practice/PracticeCatalogScreen.tsx`
  - `web/src/spa/features/practice/MicroDrillsScreen.tsx`
- **Steps:**
  1. Wire `personalizationStateProvider` into Flutter `PracticeHubScreen` and `MicroDrillsScreen`.
  2. Add **`For Your Path` (default) | `All Tests`** segmented control on both Flutter and Web Practice Hub.
  3. Render **#1 Best Next Practice Pack** card + **Best Next 3-Min Drill** spotlight + **2 Alternative Fits** with transparent reason chips (`Band Fit`, `Your Topic`, `Targets <Weakness>`).

#### Task R3.4 — Vocabulary 3-Tab Hub, `"Why This Word?"` Context, Wave Unlock Celebration & Settings Daily Cap
- **Files:**
  - `web/src/spa/features/vocabulary/VocabHubScreen.tsx`, `VocabReviewScreen.tsx`, `web/src/spa/features/settings/SettingsScreen.tsx`
  - `app/lib/features/vocabulary/presentation/vocabulary_screen.dart`, `vocab_review_screen.dart`, `vocab_flip_card.dart`, `app/lib/features/settings/presentation/settings_screen.dart`
- **Steps:**
  1. Upgrade both Web and Flutter Vocabulary Hub to 3 tabs: `Today's Wave` | `My Saved Mistakes` | `Full Deck`.
  2. Add wave progress bar (`X / 15 learned — 60% unlocks Wave N+1`) + automatic unlock celebration banner when crossing 60%.
  3. Add `"Why this word?"` badge on flashcards during review.
  4. Add `Daily New Vocab Cap` (`5 / 10 / 20`) selector in Settings (Web & Flutter) wired to `PUT /v1/personalization/profile`.

#### Task R3.5 — Post-Test `"How This Updated Your Plan"` Impact Card
- **Files:**
  - `web/src/components/personalization/PlanImpactCard.tsx` (new)
  - `web/src/spa/features/results/ObjectiveResultScreen.tsx`, `EvaluationResultScreen.tsx`
  - `app/lib/theme/components/plan_impact_card.dart` (new)
  - `app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart`
  - `app/lib/features/reading_sim/presentation/reading_review_screen.dart` (or objective result view)
  - `app/lib/features/listening_sim/presentation/listening_review_screen.dart`
- **Steps:**
  1. Build reusable `PlanImpactCard` showing: Band Delta (`6.0 → 6.5`), Weaknesses Updated, Completed Roadmap Step badge, and `"Continue to Next Roadmap Step →"` CTA.
  2. Mount at the top of both Objective and AI Evaluation Result screens on Web and Flutter.

#### Task R3.6 — Progress Screen Synced Pronunciation History, Chart Annotations, Roadmap Collapsible Milestones & Linguistic Graph Matrix
- **Files:**
  - `app/lib/features/progress/presentation/progress_screen.dart`, `web/src/spa/features/progress/ProgressScreen.tsx`
  - `app/lib/features/roadmap/presentation/roadmap_screen.dart`, `web/src/spa/features/roadmap/RoadmapScreen.tsx`
  - `app/lib/features/progress/presentation/linguistic_graph_screen.dart` (or equivalent), `web/src/spa/features/progress/LinguisticGraphScreen.tsx`
  - `app/lib/features/register_shifter/presentation/register_shifter_screen.dart`, `web/src/spa/features/coach/RegisterShifterScreen.tsx`
- **Steps:**
  1. Add synced **Pronunciation Practice History** list + inline replay + feedback modal to Flutter `ProgressScreen` (parity with Web).
  2. Annotate Band Trend Chart points (`Provisional` vs `Calibrated`) + target band dashed line on Web & Flutter.
  3. Collapse completed milestones on Roadmap, add soft `"Jump ahead anyway"` on upcoming steps, and add `"Topics & Pace"` quick-edit sheet in Roadmap AppBar.
  4. Display **Topic × Weakness Phase Coverage Matrix** on `LinguisticGraphScreen` and auto-calibrate default target gear on `RegisterShifterScreen` (`liveBand + 1.0`).

---

### Phase R4: Pronunciation Practice Studio Pro UX & Admin Observability

#### Task R4.1 — Unified 4-Step Pronunciation Studio (Web & Flutter 100% Parity)
- **Files:**
  - `web/src/components/speech/SpeechPracticeDrawer.tsx`
  - `app/lib/theme/components/speech_practice_sheet.dart`
  - `web/src/components/speech/InlineListenButton.tsx`
  - `app/lib/theme/components/inline_listen_button.dart`
- **Steps:**
  1. **Preview-Before-Analyze Parity on Web:** Stop auto-submitting on Stop in `SpeechPracticeDrawer.tsx`; show `Play My Recording`, `Re-record`, and `Analyze Pronunciation` (matching Flutter) + remove `activeResult` from `loadHistory` dependencies.
  2. **UK / US Kokoro Accent Switcher:** Add compact `US · af_bella` / `UK · bf_emma` toggle persisted in `preferredTtsAccent` via `PUT /v1/personalization/profile`.
  3. **Live Amplitude Waveform + 30s Auto-Stop Timer:** Render clean live mic meter and countdown (`0:00 / 0:30`) on both Web (`AnalyserNode`) and Flutter (`AudioRecorder.onAmplitudeChanged`).
  4. **Interactive Word-by-Word IPA Diff & Single-Word 0.8x Drill:** Make every Amber/Red word chip clickable to reveal `Target IPA` vs `Spoken IPA`, mouth/tongue tip, and an inline **`Listen to this word (0.8x)`** button (synthesizing just that word via Kokoro-82m).
  5. **Side-by-Side A/B Audio Compare + Daily Quota Counter:** Add side-by-side `"Kokoro Reference"` vs `"My Take"` playback controls and remaining daily pronunciation quota badge (`N / M left today`), plus `"Beat Your Best"` score delta on retries.

#### Task R4.2 — Study-Mode Paragraph Listen & Selection Shadow
- **Files:**
  - `web/src/components/exam-kit/PassageAnnotatorPane.tsx`
  - `app/lib/features/reading_sim/presentation/reading_sim_screen.dart`
- **Steps:**
  1. **Strictly when `!isExamMode` (Study Mode only):**
     - Add subtle per-paragraph `InlineListenButton` on Reading passages (Web & Flutter).
     - On Web, add a floating selection action bar (`Listen` | `Practice Pronunciation` | `Save to Vocab`) for selected phrases up to 240 chars.
     - On Flutter, add a long-press / sentence-tap bottom sheet offering `Listen`, `Practice Pronunciation`, and `Save to Vocab`.
  2. Verify zero Listen/Shadow controls appear when `isExamMode === true` (Exam Mode Restraint check).

#### Task R4.3 — Admin Observability Filters, CSV Export & Protected Inspector UI
- **Files:**
  - `backend/apps/api/src/routes/admin.ts`
  - `backend/packages/db/src/usage-ledger-store.ts`
  - `web/src/spa/features/admin/AdminTraceConsoleScreen.tsx` (new, hidden route `/admin/trace` gated strictly by `x-admin-key` entry in memory, never shown in learner nav)
- **Steps:**
  1. Add `?from=&to=&edition=&featureKind=` filtering to `/v1/admin/usage/summary` and `/v1/admin/users/:accountKey/trace`.
  2. Add `GET /v1/admin/usage/export.csv` streaming RFC-4180 CSV rows with model, tokens, exact/estimated USD cost, feature, and edition.
  3. Build lightweight `/admin/trace` inspector UI on Web allowing admins (after entering `x-admin-key`) to view aggregate spend, search a learner by `accountKey`, inspect band history/activity timeline, and stream/play their recorded audio takes directly via `/v1/admin/recordings/stream`.

---

### Phase R5: Contract-Backed Verification, Parity Proof & Live Deployment Runbook

#### Task R5.1 — Close the Test Harness Blind Spot (Contract-Validated Client Suites)
- **Files:**
  - `web/src/adapters/fakes/fake-personalization.adapter.ts`
  - `web/src/adapters/fakes/fake-speech-practice.adapter.ts`
  - `web/src/adapters/fakes/fake-storage.adapter.ts`
  - `backend/apps/api/test/personalization-contract.test.ts` (new)
  - `app/test/services/contract_payload_parity_test.dart` (new)
- **Steps:**
  1. Wire `@mockza/contracts` Zod `.parse(...)` assertions directly into ALL Web fake adapters (`TtsSynthesizeRequestSchema`, `PronunciationPresignRequestSchema`, `AnalyzePronunciationRequestSchema`, `RecordBandEventRequestSchema`, `VocabBatchSyncRequestSchema`, `UpdatePersonalizationProfileRequestSchema`).
  2. Add `app/test/services/contract_payload_parity_test.dart` that loads `backend/openapi.snapshot.json` (or explicit schema rules) and verifies every single payload generated by Flutter `SpeechPracticeGateway`, `PersonalizationGateway`, `OutboxSyncService`, `ReadingSimNotifier`, `ListeningSimNotifier`, `MicroDrillsNotifier`, `VocabularyNotifier`, and `SpeechPracticeSheet` (UUID validation, enum membership, field names).
  3. Add backend integration tests covering:
     - Full diagnostic → Reading/Listening weakness extraction → Band shift persistence → Ack → Band shift clears.
     - Multi-exam `normalizeExamScore` threshold checks for IELTS, TOEFL (`1–6`), PTE (`10–90`), and DET (`10–160`).
     - Full guest → signed-in account merge verifying all 10 tables migrate cleanly.
     - Pronunciation 202 enqueue → worker completion → `GET /v1/pronunciation/:practiceId` + failure status transition.
     - TTS LRU bound + rate-limit + `explain_question` `ai_usage_ledger` entry + GDPR pseudonymization preserving aggregate USD totals.

#### Task R5.2 — Low-RAM Sequential Full Verification & Live Docker Rollout
Run sequentially after checking `free -m` (ensure >= 1.5 GiB available / low swap pressure):
1. **Static & Cross-Parity Gates:**
   ```bash
   free -m
   NODE_OPTIONS="--max-old-space-size=1024" bash scripts/check_all.sh all
   bash scripts/check_cross_parity.sh
   ```
2. **Backend Contract & Unit Tests:**
   ```bash
   NODE_OPTIONS="--max-old-space-size=1024" npm --workspace=@mockza/db run test
   NODE_OPTIONS="--max-old-space-size=1024" npm --workspace=@mockza/api run test
   NODE_OPTIONS="--max-old-space-size=1024" npm --workspace=@mockza/worker run test
   ```
3. **Web Unit & GLB + IRN Playwright E2E (Single Worker):**
   ```bash
   NODE_OPTIONS="--max-old-space-size=1024" npm --workspace=@mockza/web run test
   NODE_OPTIONS="--max-old-space-size=1024" npx --workspace=@mockza/web playwright test --workers=1
   ```
4. **Flutter Analyze, Contract Parity Tests & GLB + IRN E2E:**
   ```bash
   cd app
   DART_VM_OPTIONS="--old_gen_heap_size=1024" flutter gen-l10n
   DART_VM_OPTIONS="--old_gen_heap_size=1024" flutter analyze
   DART_VM_OPTIONS="--old_gen_heap_size=1024" flutter test --concurrency=1 test/services/contract_payload_parity_test.dart test/e2e/
   ```
5. **Live OpenRouter Kokoro-82m & Gemini 3.1 Flash Lite Smoke Check:**
   - Apply migration `0011_personalization_hardening.sql` to live Postgres.
   - Rebuild & restart `api`, `worker`, and `web` containers for both Mockza (GLB) and Sanjia (IRN).
   - Verify live `POST /v1/tts/synthesize` returns valid playable audio bytes + `ai_usage_ledger` row.
   - Verify live `POST /v1/pronunciation/presign` → upload → `POST /v1/pronunciation/analyze` → `GET /v1/pronunciation/:practiceId` returns Gemini 3.1 Flash Lite IPA feedback + recorded cost in `/v1/admin/usage/summary`.
   - Verify live `POST /v1/sync/vocab-batch` and `POST /v1/personalization/band-event` return `200 OK` from both Web and Flutter clients.
