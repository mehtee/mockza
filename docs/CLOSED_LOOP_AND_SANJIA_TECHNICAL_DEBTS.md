# Closed-Loop Linguistic Engine & Sanjia Flutter — Code Audit & Technical Debt Ledger

**Audit Date:** 2026-11-21  
**Resolution Date:** 2026-11-21 (`TD-CL-01` through `TD-CL-20` fixed and verified)  
**Audited Commit:** `8342759` (`feat: implement Sanjia IRN Flutter & Closed-Loop Linguistic Engine (Phases A0-A6)`)  
**Scope:** Line-by-line static and architectural review of all newly implemented and modified files across Backend (`@mockza/config`, `@mockza/contracts`, `@mockza/domain`, `@mockza/db`, `@mockza/storage`, `@mockza/ai`, `@mockza/api`, `@mockza/worker`, `@mockza/evals`), Desktop Web (`web/`), and Flutter (`app/` — `Mockza` GLB & `Sanjia` IRN).

---

## Resolution Summary (`20 / 20` Resolved)

| ID | Status | Primary Fix Summary |
| :--- | :---: | :--- |
| **TD-CL-01** | **Resolved** | `ShareIntentBridge` subscribed & drained in [app.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/app.dart), routed to `/drop` in [app_router.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/routing/app_router.dart); Android `com.mockza.app/share_intent` + content staging (`<=5 MB`, max 4) in [MainActivity.kt](file:///home/mahdi/projects/ideas/mockza/app/android/app/src/main/kotlin/com/mockza/mockza/MainActivity.kt); iOS App Group host channel + image/audio/text staging in [AppDelegate.swift](file:///home/mahdi/projects/ideas/mockza/app/ios/Runner/AppDelegate.swift) and [ShareViewController.swift](file:///home/mahdi/projects/ideas/mockza/app/ios/ShareExtension/ShareViewController.swift). |
| **TD-CL-02** | **Resolved** | Added Image (1–4) & Audio (`<=180s` file picker + mic recording) modes, `uploadDropMedia` upload flow, shared file hydration, and `profileRepositoryProvider` `examId` resolution in [drop_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_hub_screen.dart) via cross-platform pickers in [media_bytes_platform.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/media_bytes_platform.dart). |
| **TD-CL-03** | **Resolved** | Added interactive MCQ correctness highlighting and Step 2 Cloze Recall input/check UI in [drop_drill_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_drill_screen.dart). |
| **TD-CL-04** | **Resolved** | Replaced dummy repeat-aloud key with real mic capture + `presignAudioUpload` + `uploadAudioBytes` + `verifyRepeatAloud` and profile `examId` lookup in [register_shifter_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/register_shifter/presentation/register_shifter_screen.dart). |
| **TD-CL-05** | **Resolved** | Implemented `ir.sanjia.app/iran_iap` (`queryLatestPurchase` & `launchPurchase` over Android AIDL IAB v3 Binder, gated to `ir.sanjia.app`) in [MainActivity.kt](file:///home/mahdi/projects/ideas/mockza/app/android/app/src/main/kotlin/com/mockza/mockza/MainActivity.kt). |
| **TD-CL-06** | **Resolved** | Wired `mission.complete`, `shifter.repeat_check`, and `drop.drill_complete` handlers in [dexie-outbox.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/dexie/dexie-outbox.adapter.ts), [api-client.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/api-client.ts), [bootstrap-shared.ts](file:///home/mahdi/projects/ideas/mockza/web/src/composition/bootstrap-shared.ts), and [http-linguistic.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-linguistic.adapter.ts). |
| **TD-CL-07** | **Resolved** | Added `mission.complete`, `graph.update_interests`, and `drop.drill_complete` dispatchers to [outbox_sync_service.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/outbox_sync_service.dart) and queued offline mutations on `NetworkFailure` in [daily_mission_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/linguistic_mission/presentation/daily_mission_screen.dart) & [linguistic_graph_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/linguistic_mission/presentation/linguistic_graph_screen.dart). |
| **TD-CL-08** | **Resolved** | Added `isPinned`/`isMuted` to `LinguisticNodes`, bumped Drift schema v7→v8 with safe migration (`if (from >= 7 && from < 8)`) in [app_database.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/data/db/app_database.dart), persisted flags & `DailyMissions.resultJson` in [linguistic_repository.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/data/repositories/linguistic_repository.dart). |
| **TD-CL-09** | **Resolved** | Implemented indexed `readCachedDailyMission`, `readCachedDropHistory`, `readCachedDropById` in [dexie-linguistic.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/dexie/dexie-linguistic.adapter.ts) / [mockza-db.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/dexie/mockza-db.ts) and wired network fallbacks in [http-linguistic.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-linguistic.adapter.ts). |
| **TD-CL-10** | **Resolved** | Enforced strict `users/${deviceId}/drops/` prefix validation on `imageObjectKeys` & `audioObjectKey` in [drop.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/drop.ts). |
| **TD-CL-11** | **Resolved** | Exported `safeFetchBinaryUrl` (`5 MB` cap, DNS-pinned SSRF guard) in [safe-url-fetch.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/storage/src/safe-url-fetch.ts) and used it for external `imageUrls` & `audioUrl` in [drop-ingest.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/drop-ingest.ts). |
| **TD-CL-12** | **Resolved** | Fixed spoken mission S3 check to use `internalS3`, validated `users/${deviceId}/` prefix, and gated `allowDemoEvaluator` in [graph-and-missions.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/graph-and-missions.ts). |
| **TD-CL-13** | **Resolved** | Enforced `users/${deviceId}/` `objectKey` check (HTTP `400`), `job.taskType === 'register_shifter'`, and DB canonical `repeatAloudTarget` lookup in [register-shifter.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/register-shifter.ts). |
| **TD-CL-14** | **Resolved** | Added Unicode property-escape `slugifyTopicCanonicalKey` (`[^\p{L}\p{N}]+`) across domain, DB store, API routes, and Web fake adapter. |
| **TD-CL-15** | **Resolved** | Shared module-scoped `sharedDecisionBreaker` and `sharedExtractionBreaker` singletons across `OpenRouterAlphaClient` instances in [openrouter-alpha.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/ai/src/models/openrouter-alpha.ts). |
| **TD-CL-16** | **Resolved** | Switched `upsertLinguisticGraphSignals` to atomic `.onConflictDoUpdate` and sorted read nodes by `computeNodePriorityScore` recency decay in [linguistic-graph-store.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/db/src/linguistic-graph-store.ts). |
| **TD-CL-17** | **Resolved** | Replaced raw `Duration` literals in [listening_evidence_sheet.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/widgets/listening_evidence_sheet.dart) with `AppMotion` helpers in [app_motion.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/app_motion.dart). |
| **TD-CL-18** | **Resolved** | Updated OTP & Bazaar/Myket sandbox request payloads in [w2_1_irn_auth_billing.test.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/__tests__/w2_1_irn_auth_billing.test.ts). |
| **TD-CL-19** | **Resolved** | Externalized closed-loop UI strings to ARB (`app_en.arb`/`app_fa.arb`) and Web `en.ts`/`fa.ts` and formatted dynamic counts with `EdgeNumerals.toPersianDigits` / `toPersianDigits`. |
| **TD-CL-20** | **Resolved** | Fixed Sanjia `PaywallScreen` copy from `۱۵۰` to `۱۲۰` monthly evaluations in [paywall_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/paywall/presentation/paywall_screen.dart). |

---

## Executive Summary

| Severity | Count | Category Summary |
| :--- | :---: | :--- |
| **P0 (Critical Functional / Native Bridge Gap)** | **1** | OS Share Sheet (`ShareIntentBridge`) is not subscribed to at app startup and lacks native Android Kotlin & iOS App Group host handlers. |
| **P1 (High — Security, Parity, Offline Sync & Verification Bugs)** | **12** | Missing Flutter Drop Image/Audio UI & Cloze drill; mocked Repeat-Aloud object key in Flutter; missing Android Kotlin plugin for Cafe Bazaar/Myket IAP; no-op outbox handlers in Web/Flutter; missing `users/${deviceId}/` prefix checks on Drop media ingest; `s3Client` vs `internalS3` bug in spoken Daily Mission completion; Persian topic slug stripping (`[^a-z0-9]+`); pre-existing gate/test drift. |
| **P2 (Medium/Low — Circuit-Breaker Lifecycle, Schema Polish & L10n)** | **7** | Per-request `OpenRouterAlphaClient` instantiation resetting circuit breakers; Drift `LinguisticNodes` missing `isPinned`/`isMuted`; Web `DexieLinguisticCache` write-only for missions/drops; non-atomic graph node upsert & static weights; inline `isRtl ? ... : ...` strings & Persian numeral edge formatting; `PaywallScreen` IRN 150 vs 120 monthly quota copy. |

---

## 1. Flutter Mobile (`Mockza` GLB & `Sanjia` IRN)

### TD-CL-01 (`P0`): `ShareIntentBridge` Unwired at Startup & Missing Native Android/iOS Handlers
- **Locations:**
  - [share_intent_bridge.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/native/share_intent_bridge.dart#L62-L108)
  - [providers.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/providers.dart#L267-L272)
  - [app.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/app.dart#L21-L61)
  - [AndroidManifest.xml](file:///home/mahdi/projects/ideas/mockza/app/android/app/src/main/AndroidManifest.xml#L33-L53)
  - [AppDelegate.swift](file:///home/mahdi/projects/ideas/mockza/app/ios/Runner/AppDelegate.swift#L16-L63)
  - [ShareViewController.swift](file:///home/mahdi/projects/ideas/mockza/app/ios/ShareExtension/ShareViewController.swift#L25-L61)
- **Problem:**
  1. `shareIntentBridgeProvider` is declared in `providers.dart`, but `_MockzaAppState._bootstrapServices()` in `app.dart` never calls `initializeAndDrainInitialShare()` and never subscribes to `incomingShares` to navigate `GoRouter` to `/drop` (`AppRoutes.buildDropHub(...)`).
  2. On Android, `<intent-filter>` declarations for `ACTION_SEND` and `ACTION_SEND_MULTIPLE` (`text/plain`, `image/*`, `audio/*`) were added to `AndroidManifest.xml`, but there is no `MainActivity.kt` in `app/android/app/src/` implementing the `com.mockza.app/share_intent` `MethodChannel` (`consumeInitialShare` / `onNewIntent` -> `onShareReceived`) or copying content `Uri` streams into cache files.
  3. On iOS, `AppDelegate.swift` only registers `com.mockza/audio_session` and does not implement `com.mockza.app/share_intent` to drain `pending_drop_payload` from `UserDefaults(suiteName: "group.com.mockza.app" | "group.ir.sanjia.app")`.
  4. In `ShareViewController.swift`, only `UTType.url` and `UTType.plainText` are inspected; `UTType.image` and `UTType.audio` attachments are ignored, and the `UTType.plainText` branch (lines 49–58) saves to `UserDefaults` without invoking `openHostUrl`.
- **Remediation:**
  - Subscribe to `ref.read(shareIntentBridgeProvider)` in `_MockzaAppState._bootstrapServices()` (and drain cold-start shares) to push `AppRoutes.buildDropHub(...)` via `ref.read(appRouterProvider)`.
  - Add `MainActivity.kt` handling `ACTION_SEND` / `ACTION_SEND_MULTIPLE` with `contentResolver` stream staging (`<= 5 MB`, `<= 4` files) and `com.mockza.app/share_intent`.
  - Register `com.mockza.app/share_intent` in `AppDelegate.swift` and extend `ShareViewController.swift` to stage image/audio files into the App Group container.

---

### TD-CL-02 (`P1`): Flutter `DropHubScreen` Missing Image (Mode B) & Audio (Mode C) UI and Hardcodes `ielts_academic`
- **Locations:**
  - [drop_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_hub_screen.dart#L42-L125)
  - [drop_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_hub_screen.dart#L183-L204)
- **Problem:**
  - Unlike Desktop Web ([DropHubScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/drop/DropHubScreen.tsx#L264-L374)), which supports all 4 tabs (`url`, `text`, `image`, `audio`), Flutter's `DropHubScreen` only offers 2 chips (`_modeIndex == 0` Article URL, `_modeIndex == 1` Paste Text).
  - Even though `HttpLinguisticGateway.uploadDropMedia` and `enqueueDropIngest(imageObjectKeys: ..., audioObjectKey: ...)` exist in [linguistic_gateway.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/linguistic_gateway.dart#L728-L824), `DropHubScreen` has no UI or file-picker integration for screenshots/images or `<= 180s` audio files, and ignores image/audio file paths from `ShareIntentBridge`.
  - Lines 104 and 119 hardcode `examTrack: 'ielts_academic'` instead of reading the learner's active exam track from `profileRepositoryProvider`.
- **Remediation:**
  - Add Mode B (1–4 images `<= 5 MB`) and Mode C (audio `<= 180s`, `<= 5 MB`) tabs to `DropHubScreen`, wire `uploadDropMedia`, accept shared file paths from `InboundSharePayload.filePaths`, and resolve `examTrack` from the user profile.

---

### TD-CL-03 (`P1`): Flutter `DropDrillScreen` Missing Cloze Recall Input & Comprehension Answer Feedback
- **Locations:**
  - [drop_drill_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_drill_screen.dart#L192-L248)
- **Problem:**
  - `DroppedContentDto` parses `correctOptionIndex`, `clozeSentence`, and `clozeAnswer` ([linguistic_gateway.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/linguistic_gateway.dart#L454-L457)), and Desktop Web ([DropDrillScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/drop/DropDrillScreen.tsx#L147-L202)) renders correctness feedback on the MCQ plus an interactive cloze input checked against `clozeAnswer`.
  - Flutter's `DropDrillScreen` renders the MCQ options without checking `_selectedIdx == d.correctOptionIndex` (no right/wrong visual feedback) and completely omits `d.clozeSentence` and `d.clozeAnswer`.
- **Remediation:**
  - Show success/error styling when `_selectedIdx` is chosen in `DropDrillScreen`, and add the Step 2 Cloze Recall card (`d.clozeSentence` + `TextField` checking `d.clozeAnswer`).

---

### TD-CL-04 (`P1`): Flutter `RegisterShifterScreen` Passes Dummy `objectKey` for Repeat-Aloud Verification & Hardcodes `ielts_academic`
- **Locations:**
  - [register_shifter_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/register_shifter/presentation/register_shifter_screen.dart#L130)
  - [register_shifter_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/register_shifter/presentation/register_shifter_screen.dart#L194-L218)
- **Problem:**
  - In `_verifyRepeatQuick()` (lines 194–218), pressing `"Verify Repeat-Aloud"` does **not** record the learner's voice or upload a clip. Instead, it immediately calls `verifyRepeatAloud` with `objectKey: 'users/device/repeat-check.m4a'`.
  - Because `'users/device/repeat-check.m4a'` does not match `users/${deviceId}/` on the server ([register-shifter.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/register-shifter.ts#L302)), the backend skips S3 download and evaluates `spokenTextFallback: body.expectedSentence` against `expectedSentence`, resulting in an automatic false-positive pass without acoustic verification.
  - Line 130 also hardcodes `examTrack: 'ielts_academic'`.
- **Remediation:**
  - Mirror `_toggleRecordAndShift()` in `_verifyRepeatQuick()`: record a 3–20s repeat clip via `audioRecorderGatewayProvider`, upload it via `grading.presignAudioUpload` + `uploadAudioBytes`, and pass the real `presigned.objectKey` to `verifyRepeatAloud`. Read `examTrack` from `profileRepositoryProvider`.

---

### TD-CL-05 (`P1`): Sanjia Android `IranIapChannel` (`ir.sanjia.app/iran_iap`) Missing Native Kotlin Implementation
- **Locations:**
  - [iran_iap_channel.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/native/iran_iap_channel.dart#L6-L80)
  - [billing_gateway.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/billing_gateway.dart#L331-L403)
  - [build.gradle.kts](file:///home/mahdi/projects/ideas/mockza/app/android/app/build.gradle.kts#L38-L48)
- **Problem:**
  - `IranIapChannel` defines `MethodChannel('ir.sanjia.app/iran_iap')` with `launchPurchase` and `queryLatestPurchase` methods for Cafe Bazaar (`bazaar`) and Myket (`myket`) Android store builds.
  - However, no Kotlin class in `app/android/` registers `'ir.sanjia.app/iran_iap'` or integrates Poolakey / Myket billing aidl/SDKs. On real Android devices compiled with `--dart-define=IRN_BILLING_CHANNEL=bazaar` or `myket`, invoking purchase throws `MissingPluginException` (caught at line 35 of `iran_iap_channel.dart`).
- **Remediation:**
  - Implement the `ir.sanjia.app/iran_iap` handler inside Android `src/iran/kotlin/.../MainActivity.kt` (isolated to the `iran` flavor so `global` APK remains free of Iranian store SDKs).

---

## 2. Offline Persistence & Outbox Sync (Web & Flutter)

### TD-CL-06 (`P1`): Web `DexieOutboxAdapter` Silently Deletes Closed-Loop Outbox Actions as No-Ops
- **Locations:**
  - [dexie-outbox.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/dexie/dexie-outbox.adapter.ts#L459-L464)
- **Problem:**
  - In `DexieOutboxAdapter.dispatchItem`:
    ```ts
    case 'mission.complete':
    case 'shifter.repeat_check':
    case 'drop.drill_complete': {
      await this.db.syncOutbox.delete(seq);
      return { status: 'succeeded' };
    }
    ```
  - Any queued outbox item of these three types is immediately deleted from IndexedDB without making any HTTP request to the backend. Moreover, `HttpLinguisticAdapter` does not enqueue failed offline `completeMission` or `verifyRepeatAloud` calls into `syncOutbox`.
- **Remediation:**
  - Wire `mission.complete` and `shifter.repeat_check` in `DexieOutboxAdapter` to invoke the transport / linguistic API endpoints before deleting `seq`, and enqueue into `syncOutbox` when `HttpLinguisticAdapter.completeMission` fails with `error.kind === 'network'`.

---

### TD-CL-07 (`P1`): Flutter `OutboxSyncService` Drops Unrecognized Actions & Closed-Loop Flows Lack Offline Queueing
- **Locations:**
  - [outbox_sync_service.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/outbox_sync_service.dart#L153-L187)
  - [linguistic_repository.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/data/repositories/linguistic_repository.dart#L20-L233)
- **Problem:**
  - `OutboxSyncService._dispatchItem` only handles `submit_writing`/`evaluate_writing`, `submit_speaking`/`evaluate_speaking`, and `flag_question`; its `default:` branch deletes any other `actionType`.
  - Offline mission completions or interest updates in Flutter are not queued in `outboxSyncQueue`.
- **Remediation:**
  - Add `mission.complete` and `graph.update_interests` handlers to `OutboxSyncService` and enqueue them from `LinguisticRepository` when `HttpLinguisticGateway` returns a `NetworkFailure`.

---

### TD-CL-08 (`P2`): Flutter Drift `LinguisticNodes` Table Missing `isPinned` & `isMuted` Columns + Unused `DailyMissions.resultJson`
- **Locations:**
  - [core_tables.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/data/db/tables/core_tables.dart#L485-L569)
  - [linguistic_repository.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/data/repositories/linguistic_repository.dart#L35-L81)
  - [linguistic_repository.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/data/repositories/linguistic_repository.dart#L101-L145)
- **Problem:**
  - `LinguisticNodes` in `core_tables.dart` omits `isPinned` and `isMuted` boolean columns. When `LinguisticRepository.readCachedGraphSnapshot` maps Drift rows back to `LinguisticNodeDto`, `isPinned` and `isMuted` always default to `false`, losing pinned/muted topic state offline.
  - `DailyMissions` defines `TextColumn get resultJson => text().nullable()();` (line 562), but `cacheDailyMission` serializes `evaluationResult` inside `missionPayloadJson` and never writes or reads `resultJson`.
- **Remediation:**
  - Add `isPinned` and `isMuted` columns to `LinguisticNodes` (or persist them in `LinguisticRepository`), and populate `resultJson` in `cacheDailyMission`.

---

### TD-CL-09 (`P2`): Web `DexieLinguisticCache` Is Write-Only for `dailyMissions` and `droppedContents`
- **Locations:**
  - [dexie-linguistic.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/dexie/dexie-linguistic.adapter.ts#L74-L102)
  - [http-linguistic.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-linguistic.adapter.ts#L86-L100)
  - [http-linguistic.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-linguistic.adapter.ts#L235-L248)
- **Problem:**
  - `HttpLinguisticAdapter.getTodayMission()` calls `this.cache?.cacheDailyMission(res.value)` and `getDropById()` calls `this.cache?.cacheDropItem(res.value)`.
  - However, `DexieLinguisticCache` has no `readCachedDailyMission()`, `readCachedDropItem()`, or `readCachedDropHistory()` methods, and `HttpLinguisticAdapter` does not fall back to `this.cache` when `res.error.kind === 'network'` on `/v1/missions/today`, `/v1/drop/history`, or `/v1/drop/:dropId` (unlike `getMyGraph()`, which does fall back on lines 63–68).
- **Remediation:**
  - Add `readCachedDailyMission`, `readCachedDropItem`, and `readCachedDropHistory` to `DexieLinguisticCache` and fall back to them in `HttpLinguisticAdapter` on network errors.

---

## 3. Backend API, Worker, Storage & AI Graphs

### TD-CL-10 (`P1`): `POST /v1/drop/ingest` Does Not Enforce `users/${deviceId}/drops/` Prefix on `imageObjectKeys` / `audioObjectKey` and Uses Dummy `byteLength: 1024`
- **Locations:**
  - [drop.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/drop.ts#L308-L392)
- **Problem:**
  - Unlike `/v1/register-shifter/shift` ([register-shifter.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/register-shifter.ts#L125)), `POST /v1/drop/ingest` does not verify that every key in `body.imageObjectKeys` and `body.audioObjectKey` starts with `users/${deviceId}/drops/`. An authenticated user could reference an arbitrary S3 object key in the bucket.
  - Lines 320–322 and 360–365 call `validateDropImagesMetadata` and `validateBoundedAudioInput` with synthetic `{ contentType: 'image/png', byteLength: 1024 }` and `{ contentType: 'audio/mp4', byteLength: 1024 }` placeholders rather than validating real object metadata.
- **Remediation:**
  - Reject any `imageObjectKeys` or `audioObjectKey` not starting with `users/${deviceId}/drops/` with HTTP `400 validation_error`.

---

### TD-CL-11 (`P1`): Worker `handleDropIngestJob` Passes Unvalidated External `imageUrls` to Model & Ignores `audioUrl`
- **Locations:**
  - [drop-ingest.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/drop-ingest.ts#L132-L173)
- **Problem:**
  - In `req.inputKind === 'image'` (lines 151–156), if `imageObjectKeys` are not used and `req.imageUrls` are provided, the worker forwards the raw remote URLs directly into `imageDataUris` without downloading them through DNS-pinned SSRF protection or running `validateAndStripImageForModel` (bypassing the 5 MB cap, container magic-byte check, and EXIF stripping).
  - In `req.inputKind === 'audio'` (lines 157–173), only `req.audioObjectKey` is handled; if `req.audioUrl` is submitted (allowed by `DropIngestRequestSchema` and preflighted in `drop.ts` lines 376–391), the worker never fetches `req.audioUrl`, leaving `audioBase64` undefined.
- **Remediation:**
  - Fetch remote `imageUrls` and `audioUrl` through a DNS-pinned byte-bounded fetcher before running `validateAndStripImageForModel` / `prepareAudioForModel`, or restrict `DropIngestRequestSchema` to presigned `imageObjectKeys` and `audioObjectKey` only.

---

### TD-CL-12 (`P1`): `POST /v1/missions/{missionId}/complete` Checks `s3Client` Instead of `internalS3` for Audio Submissions & Hardcodes `allowDemoEvaluator: true`
- **Locations:**
  - [graph-and-missions.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/graph-and-missions.ts#L79)
  - [graph-and-missions.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/graph-and-missions.ts#L571-L582)
  - [graph-and-missions.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/graph-and-missions.ts#L668-L677)
- **Problem:**
  - Line 79 initializes `const internalS3 = s3Client ?? createAudioS3Client(env);`, where `s3Client` is an optional dependency-injection parameter (undefined in production `createApiApp`).
  - Line 571 checks `if (!sampleText && body.audioObjectKey && s3Client)` instead of `internalS3` (and does not verify `body.audioObjectKey.startsWith(\`users/${deviceId}/\`)`). As a result, in production, `audioObjectKey` mission submissions never fetch audio from S3.
  - Line 676 passes `{ allowDemoEvaluator: true }` unconditionally to `updateLinguisticGraphSignals`, rather than `env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY`.
- **Remediation:**
  - Check `internalS3` and `body.audioObjectKey.startsWith(\`users/${deviceId}/\`)` on line 571, and pass `{ allowDemoEvaluator: env.ALLOW_DEMO_EVALUATOR || !env.OPENROUTER_API_KEY }` on line 676.

---

### TD-CL-13 (`P1`): `POST /v1/register-shifter/{runId}/verify-repeat` Permits Unverified Fallback When `objectKey` Prefix Fails & Trusts Client `expectedSentence`
- **Locations:**
  - [register-shifter.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/register-shifter.ts#L272-L334)
- **Problem:**
  - If `body.objectKey` does not start with `users/${deviceId}/` (line 302), the route does not return `400`; it silently skips S3 download and calls `verifyRepeatAloud` with `base64AudioData: undefined` and `spokenTextFallback: body.expectedSentence`, which compares `expectedSentence` against itself and grants mastery credit without audio.
  - Lines 273–299 do not verify `job.taskType === 'register_shifter'` and do not read `expectedSentence` / `targetPhrases` from the stored `job.resultJson` in Postgres.
- **Remediation:**
  - Return HTTP `400 validation_error` when `!body.objectKey.startsWith(\`users/${deviceId}/\`)`, verify `job.taskType === 'register_shifter'`, and read canonical `repeatAloudTarget` phrases from `job.resultJson` when `db` is present.

---

### TD-CL-14 (`P1`): Topic Canonical Key Slugifier Strips All Persian (`fa-IR`) Characters (`topic:general` Collision)
- **Locations:**
  - [linguistic-graph-store.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/db/src/linguistic-graph-store.ts#L174-L175)
  - [linguistic-graph-store.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/db/src/linguistic-graph-store.ts#L218)
  - [graph-and-missions.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/graph-and-missions.ts#L210)
  - [fake-linguistic.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/fakes/fake-linguistic.adapter.ts#L171)
- **Problem:**
  - `updateGraphInterestPreferences` computes `const slug = rawTopic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); const canonicalKey = \`topic:${slug || 'general'}\`;`.
  - When a Sanjia (`irn`) learner enters a Persian topic (such as `'فوتبال'` or `'هوش مصنوعی'`, which the UI placeholder explicitly suggests), `/[^a-z0-9]+/g` strips every Persian character, producing `slug = ''` and `canonicalKey = 'topic:general'`. Every Persian topic overwrites the same `'topic:general'` row in Postgres.
- **Remediation:**
  - Use Unicode-aware property escapes (`.replace(/[^\p{L}\p{N}]+/gu, '_')`) so Persian, Arabic, and Latin topic names each produce distinct, deterministic canonical keys (e.g., `topic:فوتبال`).

---

### TD-CL-15 (`P2`): `OpenRouterAlphaClient` Instantiated Per Request Resets Sliding-Window Circuit Breakers
- **Locations:**
  - [openrouter-alpha.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/ai/src/models/openrouter-alpha.ts#L255-L256)
  - [ingest-dropped-content.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/ingest-dropped-content.ts#L151)
  - [update-linguistic-graph.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/update-linguistic-graph.ts#L334)
  - [shift-register.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/shift-register.ts#L238)
  - [graph-and-missions.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/graph-and-missions.ts#L589)
- **Problem:**
  - `OpenRouterAlphaClient` defaults `this.decisionBreaker` and `this.extractionBreaker` to fresh `new SlidingWindowCircuitBreaker()` instances whenever not passed in options.
  - Because every graph function creates `new OpenRouterAlphaClient({ apiKey })` per invocation, failure counts never accumulate across requests and the 5-failures-in-60s → 120s circuit breaker (`ADR-ADV-002`) never trips across requests in production.
- **Remediation:**
  - Use module-scoped default `sharedDecisionBreaker` and `sharedExtractionBreaker` singletons in `openrouter-alpha.ts` when custom breaker instances are not injected.

---

### TD-CL-16 (`P2`): Non-Atomic `SELECT` + `INSERT`/`UPDATE` in `upsertLinguisticGraphSignals` & Undecayed `signalWeightMilli` Ordering
- **Locations:**
  - [linguistic-graph-store.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/db/src/linguistic-graph-store.ts#L45-L114)
  - [linguistic-graph-store.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/db/src/linguistic-graph-store.ts#L132-L159)
- **Problem:**
  - `upsertLinguisticGraphSignals` performs a `SELECT` followed by `INSERT` or `UPDATE` rather than `INSERT ... ON CONFLICT (account_key, edition, node_kind, canonical_key) DO UPDATE`. Concurrent worker jobs completing for the same user can hit a unique-index conflict on `linguistic_nodes_account_edition_kind_key_uq`.
  - `signalWeightMilli` only increments (`clampMilli(baseWeight + weightBump)`) and `listLinguisticGraphForAccount` orders by raw `signalWeightMilli DESC` without applying `computeDecayedPriorityWeightMilli` across elapsed days.
- **Remediation:**
  - Use `.onConflictDoUpdate(...)` on the composite unique index and apply recency decay when ranking/sorting returned nodes in `listLinguisticGraphForAccount`.

---

## 4. Pre-Existing Gate & Localization Polish Debts

### TD-CL-17 (`P1` — Pre-Existing): `scripts/check_all.sh` Fails on Raw `Duration` Literal in `listening_evidence_sheet.dart`
- **Location:**
  - [listening_evidence_sheet.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/widgets/listening_evidence_sheet.dart#L146)
  - [check_all.sh](file:///home/mahdi/projects/ideas/mockza/scripts/check_all.sh#L81-L83)
- **Problem:**
  - `check_app_gates` rule 7 bans `Duration(milliseconds:|seconds:)` outside `app/lib/theme/`, `services/`, `data/`, and `*_notifier.dart`. Line 146 of `listening_evidence_sheet.dart` contains `const Duration(seconds: 8)` (and lines 57, 117, 189 use `Duration(milliseconds: ...)`), causing `./scripts/check_all.sh all` to exit with `1 failure(s)`.
- **Remediation:**
  - Move the 8-second preview constant to `MotionTokens` in `app/lib/theme/primitives.dart` (or construct cue durations via a helper in `core/`/`theme/`).

---

### TD-CL-18 (`P1` — Pre-Existing): `w2_1_irn_auth_billing.test.ts` Sends `{ phone }` Instead of `{ phoneE164 }`
- **Location:**
  - [w2_1_irn_auth_billing.test.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/__tests__/w2_1_irn_auth_billing.test.ts#L366-L383)
- **Problem:**
  - The test sends `{ phone }` to `/v1/auth/otp/request` and `{ phone, code, ... }` to `/v1/auth/otp/verify`, whereas `OtpRequestSchema` and `OtpVerifySchema` in [schemas.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/contracts/src/schemas.ts) require `{ phoneE164 }` and `{ phoneE164, otpCode, ... }`.
- **Remediation:**
  - Update lines 369 and 378–379 of `w2_1_irn_auth_billing.test.ts` to use `phoneE164: phone` and `otpCode: devOtpCode`.

---

### TD-CL-19 (`P2`): Inline `isRtl ? '...' : '...'` Strings & Unlocalized ASCII Numerals in Closed-Loop Screens
- **Locations:**
  - Flutter: [daily_mission_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/linguistic_mission/presentation/daily_mission_screen.dart), [linguistic_graph_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/linguistic_mission/presentation/linguistic_graph_screen.dart#L107-L110), [register_shifter_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/register_shifter/presentation/register_shifter_screen.dart#L214), [drop_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_hub_screen.dart), [drop_drill_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_drill_screen.dart), [linguistic_cards.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/linguistic_cards.dart#L169)
  - Web: [DailyMissionScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/mission/DailyMissionScreen.tsx), [LinguisticGraphScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/mission/LinguisticGraphScreen.tsx), [RegisterShifterScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/register-shifter/RegisterShifterScreen.tsx), [DropHubScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/drop/DropHubScreen.tsx), [DropDrillScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/drop/DropDrillScreen.tsx)
- **Problem:**
  - Closed-loop screens branch on `isRtl ? 'Persian...' : 'English...'` inline instead of reading from `AppLocalizations` (`app_en.arb` / `app_fa.arb`) and Web `useI18n().t(...)`.
  - Dynamic numeric badges in `irn` mode (e.g., `گلوگاه‌های فعال (${g?.bottlenecks.length ?? 0})`, `BottleneckBadge` `$label · $masteryPercent%`, `Tracking ${graph?.totalEvidenceCount ?? 0}`) render ASCII digits rather than formatting with `EdgeNumerals.toPersianDigits` / `formatUiNumber(..., 'irn')`.
- **Remediation:**
  - Move inline strings into `app_{en,fa}.arb` and `web/src/i18n/{en,fa}.ts`, and format UI counts/percentages through `EdgeNumerals.toPersianDigits` / `formatUiNumber` when `edition == 'irn'`.

---

### TD-CL-20 (`P2`): Sanjia `PaywallScreen` Displays `۱۵۰` Instead of `۱۲۰` Monthly Evaluations
- **Location:**
  - [paywall_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/paywall/presentation/paywall_screen.dart#L214)
- **Problem:**
  - Line 214 displays `'ماهانه ۱۵۰ ارزیابی هوشمند'` for `isIran == true`, whereas `ADR-Iran` and `QuotaRules` ([quota.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/domain/src/quota.ts), [quota_rules.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/advanced/quota_rules.dart)) set the `IRN` Pro monthly allowance to **120** evaluations/month (vs 150 for `GLB`).
- **Remediation:**
  - Update the `isIran` copy on line 214 of `paywall_screen.dart` to `'ماهانه ۱۲۰ ارزیابی هوشمند'`.
