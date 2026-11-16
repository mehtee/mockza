# Remediation Review

**Reviewed:** 16 November 2026  
**Baseline:** a6ed85e; remediation is in the current, uncommitted working tree.  
**Original audit:** [TECHNICAL_DEBTS.md](/home/mahdi/projects/ideas/mockza/docs/TECHNICAL_DEBTS.md)

## Verdict

The remediation makes the app substantially safer and more usable. Several original defects have been fixed at the correct layer: authentication, quota locking, durable submission transactions, content parsing, and error handling.

**I do not agree that all six phases are complete or that the app is ready for an unrestricted paid launch.** Existing tests pass, but targeted review found reproducible resource cleanup failures, incomplete recording durability, unsafe duplicate execution, billing races, incomplete erasure recovery, and release configuration gaps. The Speaking calibration claim remains unsupported.

Keep the current stack. These problems need focused engineering and better boundary tests; they do not justify a framework rewrite. A controlled beta is a reasonable next milestone after the P1 findings below are resolved.

## Scope and evidence

I reviewed the remediation against the original audit, traced the changed client/API/database/worker flows, inspected the new tests, ran independent checks, and revisited the live HTTPS app. This is a source and behavior review, not a certification that every branch, native platform, or operational scenario has been exercised.

At review time, 121 tracked files differed from the baseline, with approximately 7,581 insertions and 2,388 deletions. New tests, migrations, components, and scripts were also untracked. This report reviews the working tree; a clean checkout of HEAD alone does not contain these fixes.

No application source was changed during this review. I did not restart services, run migrations, delete accounts, purchase subscriptions, submit paid AI jobs, or restore a live database. Browser actions used an isolated review session; local Reading practice was submitted to check deterministic scoring.

**Evidence labels:**

- **Reproduced:** independently observed through execution or the live browser.
- **Source-confirmed:** the relevant control/data flow is present in the reviewed source; the production failure was not induced.
- **Unverified:** the implementation or supplied claim needs platform, external-service, or operational proof.

### Independent verification

| Check | Result | What it establishes |
| --- | --- | --- |
| ./scripts/check_all.sh all | Passed | Current static architecture gates pass. |
| Backend: pnpm typecheck, pnpm lint, pnpm test | Passed | Workspace checks pass, including 29 API tests and 5 worker tests. |
| Actual PostgreSQL quota race tests | 3 passed; not skipped | Concurrent diagnostic/Pro admission and repeated refund scenarios were exercised against PostgreSQL. |
| Flutter: flutter analyze --fatal-infos | Passed | No analyzer findings. |
| Flutter: flutter test --no-pub --reporter expanded | 85 passed | Existing unit/widget/database suite passes. |
| CI's Dart format command | **Failed, exit 1** | 170 files checked; 22 require formatting. The read-only command did not modify them. |
| Evals with OPENROUTER_API_KEY absent | **Failed, exit 1, as designed** | The evaluator now refuses fake fallback calibration. CI does not supply the required key. |
| Additional isolated provider disposal tests | **2 failed** | Speaking recorder and Listening playback remain active after their route providers dispose. |
| Live browser | Selected fixes confirmed | See the browser and UX sections below. |

The agent's release build, migration, bucket initialization, and backup-archive claims were not independently rerun. Serving a working bundle is useful evidence, but does not prove native release configuration, clean restores, real purchases, or live assessment validity.

Local review logs are in /tmp/mockza-remediation-static.log, /tmp/mockza-remediation-backend.log, /tmp/mockza-remediation-flutter.log, /tmp/mockza-remediation-format.log, and /tmp/mockza-remediation-disposal.log. These temporary files are supporting evidence, not durable release records.

## Changes that deserve credit

1. **Authentication is materially stronger.** UUID bearer fallback is removed. JWT claims, edition, active device records, and token versions are checked. Anonymous renewal requires a device secret or valid bearer. Provider linking now verifies cryptographic signatures and issuer/audience/expiry, and links use a composite provider/subject key.
2. **Production configuration fails closed in important places.** Known development credentials are rejected in production. Missing webhook configuration cannot silently authorize billing. Demo evaluation is explicitly identified and prohibited in production.
3. **Quota accounting now has real concurrency protection.** Admission runs under a transaction-scoped account lock. Refunds and commits use conditional reservation transitions. The PostgreSQL race tests are meaningful evidence.
4. **Submissions are persisted before transport.** Speaking now inserts its parent attempt, recordings, and outbox together. Writing also persists its attempt and outbox transactionally. The server has a dispatch outbox.
5. **AI failures no longer become successful production heuristic grades.** Typed failures, bounded audio processing, all-turn Speaking preparation, and transactional result/accounting updates are substantial improvements.
6. **Content interoperability improved.** Question aliases, Roman headings, drill item keys, Speaking turn parsing, and canonical bundle digests now have concrete coverage.
7. **Several visible bugs are fixed.** The correct Roman heading scores correctly; canceled mock sections remain incomplete; Listening has a working start control; the Task 1 chart has usable contrast; important microphone labels fit.
8. **Upgrade and state work improved.** Actual SQLite v1/v2 upgrade tests, stale review response isolation, composite pagination, profile observation, and shared SRS interval calculation improve confidence.
9. **Operations are more explicit.** Erasure records, audio asset TTL metadata, per-object deletion errors, S3 authentication configuration, release artifact attachment, and a backup script are useful additions.

These improvements should be preserved while completing the remaining invariants.

## Findings requiring follow-up

P1 means resolve before the affected feature is represented as dependable or sold broadly. P2 means material debt that should have an owner and scheduled acceptance evidence. Findings describe specific gaps; they do not imply that every surrounding change is wrong.

### RR-01 — P1: route disposal still leaves microphone/playback active

**Evidence: Reproduced.** [app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:930](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:930) and [app/lib/features/listening_sim/presentation/listening_sim_notifier.dart:353](/home/mahdi/projects/ideas/mockza/app/lib/features/listening_sim/presentation/listening_sim_notifier.dart:353).

Speaking registers _cleanupAll with ref.onDispose, then calls ref.read to obtain its recorder and player during that callback. Riverpod rejects use of the disposed ref. Both exceptions are swallowed. Listening starts an asynchronous subscription cleanup and reads the player after awaits, again after disposal. Its error is also swallowed. The underlying gateways are app-scoped providers, so disposing the route does not dispose the gateway.

I independently created two isolated tests outside the repository. Each watched the actual route provider, activated the fake resource, closed its last subscription, and awaited container.pump():

- Speaking: expected recorder.isRecording == false; actual true.
- Listening: expected player.isPlaying == false; actual true.

This is a privacy, battery, and session isolation defect. autoDispose alone does not establish native resource ownership.

**Fix:** Capture the responsible gateway while the ref is valid, or give the session explicit ownership of its resources. Cleanup must operate on those captured objects. Await resource release where navigation requires it; handle cleanup errors without pretending release succeeded.

**Acceptance:** Permanent tests must cover actual provider disposal, including microphone preview, active recording, playback, and pending subscription cancellation. Assert resource state after disposal, not merely provider state reset. Run a real microphone indicator/playback exit check on supported platforms.

### RR-02 — P1: persisted web Speaking clips cannot be replayed

**Evidence: Source-confirmed.** [app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:603](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:603), [app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:679](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:679), [app/lib/services/audio_player_gateway.dart:67](/home/mahdi/projects/ideas/mockza/app/lib/services/audio_player_gateway.dart:67), and [app/lib/services/media_bytes_web.dart:179](/home/mahdi/projects/ideas/mockza/app/lib/services/media_bytes_web.dart:179).

finishResponse replaces a browser blob URL with an idb:// reference after successful persistence. togglePlayback passes that reference directly to player.loadFile. The real player recognizes HTTP, HTTPS, blob, and /v1/ URLs; idb:// falls through to setFilePath. IndexedDB is not a filesystem path and cannot be played that way.

Listening already resolves cached IndexedDB audio into a playable blob URL. Speaking does not use that mechanism. Upload byte loading and playback are separate paths: working upload does not prove working replay.

**Fix:** Resolve durable audio references at the audio/media boundary before loading the player, preserve the recording's MIME type, and revoke materialized blob URLs when replaced or released.

**Acceptance:** Record, stop, play, pause, and replay a clip in the release web app. Repeat after restoring the durable clip. Exercise WebM/Ogg and MP4 paths where supported. A fake that accepts every input path cannot detect this defect.

### RR-03 — P1: durable dispatch does not prevent duplicate or stale executions

**Evidence: Source-confirmed.** [backend/apps/api/src/routes/evaluate.ts:85](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:85), [backend/apps/api/src/routes/evaluate.ts:359](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:359), [backend/apps/api/src/routes/evaluate.ts:903](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:903), [backend/apps/worker/src/index.ts:14](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/index.ts:14), and [backend/apps/worker/src/jobs/grade-writing.ts:32](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/grade-writing.ts:32). Speaking has the same execution pattern.

The API dispatches with singletonKey equal to attemptId; recovery uses attemptId:outbox:attempts; manual retry uses attemptId:retry:generation. A crash after queue send but before the outbox update can therefore create another queue job under a different key.

Workers only reject absent or terminal database rows. Their transition accepts any nonterminal status, including one another worker has already changed to evaluating. They do not require an exclusive execution claim or check that an update won before invoking the paid model.

Manual retry also resets the same job without an execution generation in its payload. An older queue delivery can see the new queued state and execute against a fresh reservation. attemptsCount mixes queue retry counts with manual retry generation.

**Impact:** Duplicate provider charges, competing results, and a stale failure that can fail/refund a newer execution. Conditional terminal writes reduce double accounting but do not fence execution.

**Fix:** Use one durable dispatch identity per job generation across API and recovery. Introduce a database claim/lease and generation fence for execution and finalization. A duplicate delivery must observe another owner's claim and avoid the model call. Recovery must handle an expired claim after a worker crash.

**Acceptance:** With real PostgreSQL and pg-boss, interrupt after send/before outbox acknowledgement; run concurrent sweepers and duplicate consumers; deliver an old generation after manual retry. Assert one active execution and that stale generations cannot finalize/refund the new one. Provider calls should be counted with an injected client.

### RR-04 — P1: RevenueCat ordering protection is not atomic, and transfers are incomplete

**Evidence: Source-confirmed.** [backend/apps/api/src/routes/webhooks-revenuecat.ts:14](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/webhooks-revenuecat.ts:14), [backend/apps/api/src/routes/webhooks-revenuecat.ts:26](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/webhooks-revenuecat.ts:26), and [backend/apps/api/src/routes/webhooks-revenuecat.ts:211](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/webhooks-revenuecat.ts:211).

Receipt insertion and fulfillment now share a transaction, which fixes a major original problem. However, ordering still uses a read followed by an unconditional entitlement upsert. Concurrent distinct events can both read the old timestamp; the older event can write last and overwrite a newer renewal or revocation.

TRANSFER is handled as an ordinary grant. The schema reads transferred_to but not transferred_from, so there is no corresponding source revocation. Missing product, entitlement, and expiration fields are accepted; a transfer-shaped grant can therefore produce isPro=true with no expiration. Unknown identities are acknowledged and recorded as processed, with no implemented reconciliation path.

**Fix:** Make event ordering part of the database update condition or serialize fulfillment per identity. Handle transfer source/destination explicitly, and obtain authoritative entitlement state when the event does not contain enough information. Retain unresolved receipts as retryable reconciliation work.

**Acceptance:** Real PostgreSQL tests for concurrent renewal/expiration in both commit orders, duplicate receipts, transfers between two identities, missing transfer fields, and an event received before identity registration. Verify both client purchase status and server quota entitlement.

### RR-05 — P1: partial deletion loses the authentication needed for the promised retry

**Evidence: Source-confirmed.** [backend/apps/api/src/routes/account.ts:74](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/account.ts:74), [backend/apps/api/src/routes/account.ts:131](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/account.ts:131), [app/lib/services/auth_session_service.dart:151](/home/mahdi/projects/ideas/mockza/app/lib/services/auth_session_service.dart:151), and [backend/packages/storage/src/purge.ts:172](/home/mahdi/projects/ideas/mockza/backend/packages/storage/src/purge.ts:172).

The server now records erasure work and returns an honest 503 when S3 deletion fails. The hourly retry worker is a useful improvement. But the database transaction has already removed the device before the 503. The client preserves its credentials and offers retry; those credentials now refer to a missing device. An immediate retry gets 401, with no receipt/status flow that allows the client to finish local deletion after server-side cleanup eventually succeeds.

The client also ignores the Result returned by identity.clearAll on the success path. A credential-storage deletion failure can still be reported as success.

Local media erasure is incomplete too. Settings calls [clearDownloadedCaches](/home/mahdi/projects/ideas/mockza/app/lib/services/cache_cleanup_service.dart:18), which intentionally deletes only expired, completed recordings, then [resets database rows](/home/mahdi/projects/ideas/mockza/app/lib/features/settings/presentation/settings_notifier.dart:373). That is the correct protection policy for Clear Cache, but the wrong policy for Delete All My Data. Retained/pending audio bytes can remain in IndexedDB or the native support directory after their database references are erased. Use a separate complete-media-erasure operation, with verifiable completion, for account wiping.

**Fix:** Model erasure as a resumable operation with a receipt that remains usable after account access is revoked. Distinguish server erasure accepted/pending/completed from local reset completion. Explicitly erase local recording/cache bytes and propagate credential/media deletion failures.

**Acceptance:** Force S3 failure after the database commit. Restart API/client, complete worker cleanup, query or retry using the receipt, then complete local reset. Verify revoked credentials stay revoked and the UI does not require a now-invalid login to finish deletion. Seed pending and retained local clips; verify both their bytes and metadata are erased on Web/native, including a failed local file deletion.

**Correction to a possible concern:** The dispatch outbox has an ON DELETE CASCADE foreign key to evaluation_jobs. I do not report outbox payload retention after job deletion as an established bug.

### RR-06 — P1: an outstanding signed upload can recreate audio after completed erasure

**Evidence: Source-confirmed.** [backend/apps/api/src/routes/uploads.ts:205](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/uploads.ts:205), [backend/apps/api/src/routes/uploads.ts:270](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/uploads.ts:270), and [backend/apps/api/src/routes/account.ts:118](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/account.ts:118).

The signed PUT proxy validates its HMAC and expiry but does not check whether the device still exists or is being erased. Obtain a signed URL, complete account deletion, then use that still-valid URL: S3 receives the object before audioAssets insertion checks the device foreign key. That insertion can fail after the object has already been written.

The erasure request may already be completed, and there is then no audioAssets row to drive TTL cleanup. This can leave recreated audio outside both cleanup mechanisms.

**Fix:** Fence new writes when erasure starts. Check an active upload grant/device generation at PUT time, coordinate the in-flight upload/deletion race, and clean up the object if metadata finalization fails. Direct S3 presigned mode also needs an explicit policy for outstanding capabilities.

**Acceptance:** An isolated S3/PostgreSQL test must overlap deletion with upload before and after the final purge. Verify no objects remain or can be recreated under the deleted identity after erasure completion.

### RR-07 — P1: web recording persistence still does not establish session recovery

**Evidence: Source-confirmed.** [app/lib/services/media_bytes_web.dart:38](/home/mahdi/projects/ideas/mockza/app/lib/services/media_bytes_web.dart:38), [app/lib/services/media_bytes_web.dart:112](/home/mahdi/projects/ideas/mockza/app/lib/services/media_bytes_web.dart:112), [app/lib/data/db/connection_web.dart:17](/home/mahdi/projects/ideas/mockza/app/lib/data/db/connection_web.dart:17), and [app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:598](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:598).

Three different guarantees are being conflated:

1. Bytes may be stored in IndexedDB.
2. The clip belongs to a recoverable attempt/session.
3. The UI has told the learner that storage is durable.

_putIdbBytes completes on the individual request's success, not the transaction's completion. A later transaction abort is not reflected. persistRecordedAudioClip silently returns the original temporary blob URL if persistence fails. Before submission, recorded-turn metadata still lives in notifier memory; storing bytes alone does not reconstruct prompts, turn order, durations, or a resumable session after reload.

The SQLite fallback now exposes isDatabaseEphemeral, but no UI consumes that getter. The learner still receives no implemented warning when the database falls back to memory.

**Fix:** Wait for IndexedDB transaction completion, report abort/quota/storage failures, persist a session manifest as each turn is saved, and implement restoration. Surface ephemeral storage before claiming that work is safely saved.

**Acceptance:** Browser tests for reload before submission, reload during upload, storage denial, quota exhaustion, transaction abort after request success, and recovery from all persisted turns. Do not use native/in-memory DB tests as proof of browser persistence.

### RR-08 — P1: serialized Writing autosave reads the wrong task after waiting

**Evidence: Source-confirmed.** [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:392](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:392), [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:412](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:412), and [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:473](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:473).

selectTaskIndex starts an unawaited flush and immediately activates the next task. When another save is already pending, the new flush waits, then reads activeTaskIndex, draft key, task type, text, and timer from mutable current state. It therefore saves the incoming task rather than the outgoing task's latest edits.

Example: Task 1 save is still in progress; type more Task 1 text; switch to Task 2; the queued flush resumes and snapshots Task 2. Task 1's latest text remains only in memory.

Submission cancels the debounce but does not drain/invalidate all queued saves before deleting the draft. That also leaves a resurrection race to test. Periodic timer saves and explicit exit flushing are helpful, but they do not solve snapshot ownership.

**Fix:** Capture an immutable task/version/text/timer snapshot before awaiting previous saves. Define how submission closes that save generation, drains it, and prevents later draft recreation.

**Acceptance:** Hold a first storage write with a controllable future, edit and switch tasks, then release it. Reload and verify both tasks. Repeat with submit/exit during the queued write and confirm submitted drafts are not recreated.

### RR-09 — P1: the Speaking benchmark still compares text anchor scores against synthetic silence

**Evidence: Source-confirmed, dataset counted independently.** [backend/evals/src/run-evals.ts:40](/home/mahdi/projects/ideas/mockza/backend/evals/src/run-evals.ts:40), [backend/evals/src/run-evals.ts:45](/home/mahdi/projects/ideas/mockza/backend/evals/src/run-evals.ts:45), [backend/evals/src/run-evals.ts:113](/home/mahdi/projects/ideas/mockza/backend/evals/src/run-evals.ts:113), and [backend/evals/datasets/golden-rubric-samples.json:160](/home/mahdi/projects/ideas/mockza/backend/evals/datasets/golden-rubric-samples.json:160).

There are 42 samples: 25 Writing and 17 Speaking. **None of the 17 Speaking samples contains base64AudioData.** The runner substitutes 0.1 seconds of silent WAV for each. Speaking inputText is not passed as the performance being graded. The requireAudioForSpeaking option is declared but unused.

The report is called a held-out calibration benchmark, but comparing a silent audio grade with a human band for a written sample cannot validate pronunciation, fluency, or Speaking accuracy. Removing sample-specific grading anchors was correct; the replacement does not establish calibration.

The new unit test checks for an input_audio part using an injected model client. It does not establish that the input is the human-rated recording.

**Fix:** Require actual, consented, human-rated recordings for every Speaking calibration sample. Missing recordings must fail the benchmark. Keep synthetic audio checks in a separately named protocol test. Separate model/prompt development data from a held-out evaluation set.

**Acceptance:** Record dataset provenance, rater agreement, human criterion bands, audio duration/content, model/prompt version, and actual measured errors. Review low-quality/silent inputs separately. Until then, remove claims such as “calibrated to official examiner standards.”

### RR-10 — P1: short exercises still become IELTS band evidence

**Evidence: Reproduced and source-confirmed.** [app/lib/core/exams/local_objective_scorer.dart:190](/home/mahdi/projects/ideas/mockza/app/lib/core/exams/local_objective_scorer.dart:190), [app/lib/features/reading_sim/presentation/reading_sim_notifier.dart:560](/home/mahdi/projects/ideas/mockza/app/lib/features/reading_sim/presentation/reading_sim_notifier.dart:560), [app/lib/features/listening_sim/presentation/listening_sim_notifier.dart:512](/home/mahdi/projects/ideas/mockza/app/lib/features/listening_sim/presentation/listening_sim_notifier.dart:512), and [app/lib/features/home/presentation/home_notifier.dart:207](/home/mahdi/projects/ideas/mockza/app/lib/features/home/presentation/home_notifier.dart:207).

The scorer now marks a 40-item pack with isCalibratedFullPack. But short packs are still proportionally scaled to 40 questions, receive a numeric band, and are persisted through overallBand. The calibration flag is not included in the submission records consumed by review/analytics.

In the live app, I answered only the correct Roman heading ii in the 13-question Reading sample. Review correctly showed 1/13, but prominently displayed **2.5 Estimated IELTS Band** with no visible short-pack qualification. The problem is not this particular low result; it is treating a small sample as comparable full-test evidence.

Partial-skill labels in Progress improve honesty, but they do not distinguish sample practice, full exams, Study mode, task type, or Academic/General cohorts. The common metrics still accept mixed attempts.

**Fix:** Store coverage, mode, module, content version, and calibration eligibility with scores. Show accuracy for short exercises, or an explicitly labeled uncalibrated practice estimate. Exclude those values from full-test band estimates and comparable improvement claims.

**Acceptance:** A short drill/sample must not silently enter a full IELTS band aggregate. Tests should cover mixed modes, mixed modules, unequal task coverage, and historical content changes.

### RR-11 — P1: Full Mock still infers membership and completes Writing after one task

**Evidence: Source-confirmed; cancellation fix reproduced.** [app/lib/features/practice_hub/presentation/full_mock_screen.dart:47](/home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/full_mock_screen.dart:47), [app/lib/features/practice_hub/presentation/full_mock_screen.dart:170](/home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/full_mock_screen.dart:170), and [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:496](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:496).

The planner now persists a start marker and checks real submissions. This fixes “launched means completed”: after launching and exiting Listening, I observed 0 of 4 Sections Completed.

However, session membership is inferred from skill + packId + completion time after the marker. There is no explicit mockSessionId on the attempts, and mode/task coverage is not checked. Independent practice of the same pack can complete a mock stage. A queued or failed submission also satisfies the non-inProgress condition.

Writing submits only the active task. One Task 1 or Task 2 submission can therefore complete “Writing Tasks 1 & 2.” Four available skill bands are averaged into “Full Mock Band” without verifying both Writing tasks or full objective sections. The marker is also stored as a synthetic Writing draft/attempt, which pollutes the persistence model.

**Fix:** Give the mock an explicit session and stage/task membership model. Distinguish submitted, awaiting evaluation, failed, and scored. Require both Writing tasks and the intended weighting before producing a Writing/full-mock band.

**Acceptance:** Cancel/reload/reset tests, ordinary practice during an active mock, failed AI jobs, mode changes, both Writing tasks, and partial objective packs. Only actual eligible stage results may produce a full-mock result.

### RR-12 — P1: native release artifacts still lack API and billing configuration

**Evidence: Source-confirmed; native artifact execution unverified.** [.github/workflows/release.yml:90](/home/mahdi/projects/ideas/mockza/.github/workflows/release.yml:90), [.github/workflows/release.yml:135](/home/mahdi/projects/ideas/mockza/.github/workflows/release.yml:135), [app/lib/core/config/edition_config.dart:27](/home/mahdi/projects/ideas/mockza/app/lib/core/config/edition_config.dart:27), and [app/lib/services/billing_gateway.dart:84](/home/mahdi/projects/ideas/mockza/app/lib/services/billing_gateway.dart:84).

The entrypoint/flavor names and artifact attachment are improved. But neither Android nor iOS build passes MOCKZA_API_BASE_URL or REVENUECAT_PUBLIC_KEY. Both default to empty strings.

Same-origin API paths can work in the browser. Native Dio has no browser origin to resolve /v1/auth/anonymous against. RevenueCat deliberately declines configuration when the key is empty. Consequently, a successfully built native artifact can still have nonfunctional auth, content sync, and checkout.

**Fix:** Supply validated edition/platform configuration through the release build and fail the native build if required values are absent. Do not treat a no-codesign iOS archive as a signed, store-installable release.

**Acceptance:** Install the exact global and Iran artifacts produced by CI. Verify server edition, TLS/API origin, authentication, content/audio, identity binding, purchase/restore, and server entitlement. Record artifact identifiers and configuration provenance.

### RR-13 — P1 for CI, P2 for test coverage: passing local suites do not equal passing release gates

**Evidence: Reproduced plus workflow inspection.** [.github/workflows/ci.yml:63](/home/mahdi/projects/ideas/mockza/.github/workflows/ci.yml:63), [.github/workflows/ci.yml:84](/home/mahdi/projects/ideas/mockza/.github/workflows/ci.yml:84), [backend/apps/api/src/__tests__/phase3_admission.test.ts:108](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/__tests__/phase3_admission.test.ts:108), and [app/test/features/phase6_ux_a11y_test.dart:75](/home/mahdi/projects/ideas/mockza/app/test/features/phase6_ux_a11y_test.dart:75).

The CI format command exits 1: 22 Dart files need formatting. The original 85 tests and analyzer do not run that gate.

The calibration job runs its container without OPENROUTER_API_KEY. The newly fail-closed evaluator consequently cannot pass. I independently reproduced the absent-key refusal with env -u OPENROUTER_API_KEY pnpm --filter @mockza/evals eval. This is a necessary failure, not a reason to restore fake success.

Several test names also overstate coverage:

- “supports authorized job retry endpoint for existing failed jobs” only checks 404 for a missing job.
- The new admission/idempotency API tests construct createApiApp without a database or queue. They exercise the memory branch.
- The UX/a11y suite checks rendering without exceptions for three screens. It does not inspect semantics, focus order, contrast ratios, large text, or real media plugins.
- The audio benchmark contract test checks that an audio part exists, not that the human-rated performance is present.
- SQLite migration tests are valuable, but do not prove browser upgrades or backend migrations against representative production state.

**Fix:** Format the affected files; keep offline contract tests separate from credentialed calibration; provision restricted secrets only for the intended evaluation job. Add boundary tests for the demonstrated failures. Name tests after what they assert.

**Acceptance:** A clean checkout must pass the exact CI workflow, and release evidence must list real service/platform checks separately from fakes. Never claim calibration or recovery merely from a green unit suite.


### RR-14 — P2: offline/integrity guarantees remain conditional

**Evidence: Source-confirmed.** [app/lib/services/content_sync_service.dart:131](/home/mahdi/projects/ideas/mockza/app/lib/services/content_sync_service.dart:131), [app/lib/services/content_sync_service.dart:163](/home/mahdi/projects/ideas/mockza/app/lib/services/content_sync_service.dart:163), [backend/content-pipeline/src/validate-pack.ts:172](/home/mahdi/projects/ideas/mockza/backend/content-pipeline/src/validate-pack.ts:172), and [backend/apps/api/src/routes/admin.ts:330](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/admin.ts:330).

The new JSON digest and persistent Listening media are useful improvements, but:

- Missing or malformed declared hashes skip client verification entirely. The test covers a well-formed mismatch only.
- Writing chart download failures are swallowed; the bundle can be marked cached even though the visual task stimulus is unavailable offline.
- Media bytes are not checked against an authored asset digest.
- The seed validation command checks that declared and computed digests look like SHA-256 strings; it never compares them for equality.
- The standalone content schema, seed bundle path, and admin publication path still enforce different requirements. The publish endpoint flips a flag without invoking the stronger content validator.
- Attempts do not pin a complete immutable content version for later review.
- Clearing bundle references does not establish a bounded media-byte cleanup lifecycle.

**Fix:** Define one published bundle/asset contract, reject invalid or absent required integrity metadata, make task-critical assets mandatory, and validate at the publication boundary. Preserve the content version used by an attempt.

**Acceptance:** Corrupt/missing hashes, missing charts, corrupt media, republishing, offline reload, and historical review after a content update. A download badge must mean every required asset can actually be opened offline.

### RR-15 — P2: the backup script verifies an archive, not recovery

**Evidence: Source-confirmed; checksum path bug reproduced.** [scripts/backup_restore.sh:4](/home/mahdi/projects/ideas/mockza/scripts/backup_restore.sh:4), [scripts/backup_restore.sh:43](/home/mahdi/projects/ideas/mockza/scripts/backup_restore.sh:43), and [scripts/backup_restore.sh:56](/home/mahdi/projects/ideas/mockza/scripts/backup_restore.sh:56).

The script's title mentions PostgreSQL and SeaweedFS. Its implementation backs up only PostgreSQL. verify checks a checksum and pg_restore --list. That does not prove a successful restore, usable constraints/migrations, app startup, or recoverable audio/media.

There is also a concrete path defect. backup writes the directory-qualified dump path into SHA256SUMS.txt. verify changes into that directory. A relative directory such as backup then resolves backup/mockza_pg.dump inside backup and fails. Absolute checksum paths also make moving the backup unreliable. I reproduced the relative-path failure using temporary dummy bytes and the script's exact checksum/cwd logic, without touching any database.

**Fix:** Store checksum entries relative to the archive directory. Back up required object storage and configuration separately, protect/encrypt backups, and exercise recovery into an isolated environment.

**Acceptance:** Restore a relocated backup into a fresh database and object store; verify representative attempts, quotas, media, migrations, and app access. Record restore time and acceptable data loss. Do not describe a catalog listing as a restore drill.

### RR-16 — P2: live cache fixes and deployment security are not reproducible together

**Evidence: Source-confirmed and live bundle requests observed.** [app/web/index.html:54](/home/mahdi/projects/ideas/mockza/app/web/index.html:54), [app/nginx.conf:15](/home/mahdi/projects/ideas/mockza/app/nginx.conf:15), [app/nginx.conf:59](/home/mahdi/projects/ideas/mockza/app/nginx.conf:59), [app/Containerfile:63](/home/mahdi/projects/ideas/mockza/app/Containerfile:63), and [compose.yaml:92](/home/mahdi/projects/ideas/mockza/compose.yaml:92).

The live app requested flutter_bootstrap.js and main.dart.js with ?v=202611161456. Those edits exist in ignored build/web output. Source index.html still loads the unversioned bootstrap, and the build pipeline does not reproduce the manual versioning step. The next clean build can lose the cache fix.

The Nginx header configuration has another gap: locations with their own add_header directives do not inherit the server-level header set in Nginx 1.27. The exact index.html location repeats some headers but omits CSP and Permissions-Policy. Several asset locations also replace the inherited set.

If the declared CSP is applied consistently, its self-only script/font sources conflict with the observed default Flutter loads from www.gstatic.com and fonts.gstatic.com. Either bundle those resources locally or define a tested, explicit deployment policy. Adding a header string is not proof of an effective working policy.

Finally, Compose mounts a static SeaweedFS authentication JSON containing development credentials. Changing backend S3 environment variables alone does not update that file. Production credential rotation must update both sides coherently; network isolation and bucket naming do not prove authorization.

**Fix:** Make build versioning/cache policy source-controlled, define one reusable effective header policy, test the actual image behind the intended CDN, and provision storage credentials from deployment secrets rather than a fixed development identity.

**Acceptance:** Two consecutive clean builds/deployments through Cloudflare, checked on a previously loaded browser. Verify effective headers on HTML/bootstrap/assets, required renderer/fonts, private object denial, signed access, and rotated storage credentials. The Python static server proves a different serving configuration from the Nginx release image.

### RR-17 — P1 for exposed API abuse: request limits and proxy trust remain incomplete

**Evidence: Source-confirmed.** [backend/apps/api/src/middleware/rate-limit.ts:32](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/middleware/rate-limit.ts:32), [backend/apps/api/src/app.ts:48](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/app.ts:48), [backend/apps/api/src/routes/uploads.ts:212](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/uploads.ts:212), and [backend/apps/api/src/routes/uploads.ts:258](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/uploads.ts:258).

The limiter still uses the caller's first X-Forwarded-For value. TRUSTED_PROXY_IPS is added to configuration but never consumed. The Nginx proxy appends to the supplied header. Without an independently enforced trusted ingress policy, a caller can rotate the first address to evade limits. The limiter is also per-process memory.

The upload proxy checks Content-Length when present, then reads the entire body into memory before checking actual size. Chunked or otherwise undeclared bodies can exceed the intended application memory ceiling. Nginx's separate limit helps that particular deployment, but does not make the API handler bounded on every ingress.

Aggregate Speaking HEAD-size validation, container checks, and ffmpeg timeouts are improvements. They do not replace streamed ingress bounds, bounded JSON parsing, and consistent safe error envelopes. The app still has no shared explicit onError/body-limit policy. Broad CORS is also a deployment decision that should be intentional rather than assumed to enforce authentication.

**Fix:** Derive client identity from a trusted transport/proxy chain, enforce shared limits where needed, cap streamed input before buffering, and normalize API errors. Keep external provider errors out of learner-facing diagnostics.

**Acceptance:** Spoofed forwarding headers, direct API access, multiple API instances, chunked oversized requests, malformed JSON, and storage/model failures. Measure peak memory under concurrent maximum-size requests.

### RR-18 — P1 for assessment integrity: JSON validity is still not semantic validity

**Evidence: Source-confirmed.** [backend/packages/contracts/src/schemas.ts:156](/home/mahdi/projects/ideas/mockza/backend/packages/contracts/src/schemas.ts:156), [backend/packages/contracts/src/schemas.ts:228](/home/mahdi/projects/ideas/mockza/backend/packages/contracts/src/schemas.ts:228), [backend/packages/ai/src/graphs/grade-writing.ts:195](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-writing.ts:195), and [backend/apps/api/src/routes/evaluate.ts:1008](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:1008).

The graphs now require four finite criterion bands and valid JSON. They still accept four duplicated criterion codes, the wrong criterion set for a skill/task, empty or fabricated evidence, unrelated quote text, invalid edit relationships, and ungrounded transcript times. The contracts do not enforce these relationships against the submitted essay or recording manifest.

Writing's prompt title/body remain caller-provided input to grading. Question explanation generation now avoids embedding a learner's answer in the shared cache, but the caller still supplies packVersion; the cache lookup does not verify it against the current authoritative pack version. The query labeled “published question” checks question/pack IDs without a publication check.

**Fix:** Validate required distinct criterion sets, task identity, evidence/edit bounds and exact text, transcript timing/turn coverage, and authoritative published content/version. Treat failed evidence validation as a recoverable evaluation failure. Preserve uncertainty rather than turning schema success into a calibration claim.

**Acceptance:** Inject schema-valid but semantically wrong model responses. Verify rejection before persistence. Change/unpublish a pack and ensure shared explanations cannot be served/generated under an invented version. Validate both rubric accuracy and grounding with human review.

### RR-19 — P2: cost, capacity, retention, and privacy claims still exceed measured evidence

**Evidence: Source-confirmed and operationally unverified.** [backend/packages/db/src/schema.ts:148](/home/mahdi/projects/ideas/mockza/backend/packages/db/src/schema.ts:148), [backend/packages/ai/src/observability/langfuse.ts:65](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/observability/langfuse.ts:65), [backend/apps/worker/src/index.ts:89](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/index.ts:89), [docs/compliance/google_play_data_safety.md:20](/home/mahdi/projects/ideas/mockza/docs/compliance/google_play_data_safety.md:20), and [backend/packages/ai/src/models/openrouter.ts:49](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/models/openrouter.ts:49).

Token/cost fields and tracing remain largely scaffolding rather than a measured end-to-end assessment ledger. A nine-turn Speaking evaluation and retries now perform more real work than the old first-turn fallback. Cost and latency need measuring on that actual path.

The worker's batched handler uses Promise.all, despite its nearby comment referring to allSettled. One failure rejects the callback while other calls may remain active. The exact queue batch retry behavior needs a real pg-boss failure test; it should not be assumed safe from the comment.

Audio TTL rows and purge error handling are improved, but no independent long-running retention, orphan reconciliation, or restore proof was established. Completed erasure records still contain device IDs and account identifiers and need their own bounded retention policy.

Privacy documentation improves the domain/TLS wording, but a data_collection='deny' request setting is not proof of all provider retention, training, residency, or contractual obligations. The “Device IDs not shared” answer also needs reconciliation with their use as RevenueCat appUserID. Configured privacy/deletion URLs require checking as real deployed routes.

**Fix:** Instrument provider usage, queue delay, attempts, failures, costs, and redacted correlation IDs at the existing execution boundary. Run representative workloads and retention drills. Make disclosures match demonstrated behavior and actual subprocessors.

**Acceptance:** A measured latency/cost/error report for real full sessions, concurrent load within the deployment budget, deletion/TTL verification including orphans and audit records, and tested public privacy/deletion pages. Performance and subscription margin remain unverified until then.


### RR-20 — P2: corrected vocabulary content still does not reach existing synced cards

**Evidence: Source-confirmed.** [VocabRepository.insertSyncedDeckCards](/home/mahdi/projects/ideas/mockza/app/lib/data/repositories/vocab_repository.dart:153) still calls [VocabDao.insertMissingCardsBatch](/home/mahdi/projects/ideas/mockza/app/lib/data/daos/vocab_dao.dart:60), which uses insertOrIgnore. A second catalog sync for the same card ID therefore ignores a corrected definition, IPA, or context sentence.

The new test re-captures a card through captureMistakeToDeck. That is a different path; it does not prove server-authored deck corrections are applied. Preserving scheduling state on recapture and guarding rapid ratings are real improvements.

**Fix:** Update authored content fields on a synced-card conflict while preserving the learner's repetitions, interval, ease and due date. Keep learner edits/source ownership explicit where appropriate.

**Acceptance:** Sync a card, review it, sync corrected content under the same ID, then reload. Assert the correction is visible and the schedule/review history remains unchanged.

## Disposition of the original 61 technical debts

**Addressed** means the specific original failure is corrected in the reviewed implementation, supported where noted by tests/browser evidence. It does not mean every acceptance scenario has been exercised. **Partial** means material progress with a remaining requirement. **Open** means the original concern remains. No item is closed merely because a phase has a matching test filename.

| ID | Disposition | Review |
| --- | --- | --- |
| TD-01 | Addressed | UUID bearer fallback removed; signed claims and active device checks added. Expand malformed/legacy-token tests before formal security sign-off. |
| TD-02 | Partial | Cryptographic provider verification and composite key fixed. Actual Apple/Google flows, nonce/replay binding, concurrent linking/merge behavior remain unverified. |
| TD-03 | Partial | Existing UUID takeover and malformed registration fixed; challenge consumption added. Default proof is shared-secret HMAC, not a wired Play Integrity/App Attest implementation, and the client does not implement that proof flow. |
| TD-04 | Addressed | Production rejects known default secrets and unconfigured billing fails closed. Deployment must supply matching storage credentials; RR-16. |
| TD-05 | Addressed | GET/SSE share authorization and SSE_ENABLED is honored. Add authenticated cross-owner stream coverage; current phase test chiefly covers missing auth/disabled SSE. |
| TD-06 | Addressed | Owned, input-hashed replay checks added. Current API regression uses memory; actual database contention still deserves coverage. |
| TD-07 | Open | Caller-controlled forwarding headers and local-memory limits remain; RR-17. |
| TD-08 | Addressed | Auth/edition headers and refresh are scoped away from external upload/media origins. |
| TD-09 | Partial | Durable erasure work and honest partial failure added; retry/auth and upload resurrection remain; RR-05/RR-06. |
| TD-10 | Partial | Client identity binding, authentication, transaction/dedupe improved. Concurrent ordering, transfers, reconciliation and real purchases remain; RR-04/RR-12. |
| TD-11 | Addressed | Per-account PostgreSQL lock and transaction; actual race tests pass. Account-link transitions still need an explicit quota policy. |
| TD-12 | Addressed | Conditional refund transition and originating device persisted; PostgreSQL repeated-refund test passes. |
| TD-13 | Partial | Failed producer startup prevents admission. Boolean(boss) is not ongoing queue health or startup reconnection; operational recovery remains unverified. |
| TD-14 | Partial | Transactional dispatch outbox prevents lost handoff intent; execution dedupe/generation is incomplete; RR-03. |
| TD-15 | Partial | Real retry metadata and transactional result/refund coupling improved. Duplicate/stale execution and batch behavior remain; RR-03/RR-19. |
| TD-16 | Partial | Actual retry endpoint and client call exist. Generation fencing is missing; named API test only verifies a missing-job 404; RR-03/RR-13. |
| TD-17 | Addressed | Load-generation checks and delayed-A/loaded-B regression improve response ownership. |
| TD-18 | Addressed | Parent/recordings/outbox now share a durable transaction. Pre-submit session recovery is separate; RR-07. |
| TD-19 | Addressed | Admission waits for all recorded uploads; partial uploads remain retryable. This does not prove every authored interview turn was recorded. |
| TD-20 | Addressed | Worker prepares all submitted turns rather than only the first. Live multi-turn grading quality remains unverified. |
| TD-21 | Partial | Per-turn IDs/object keys and up to 12 turns added. Model transcript schema still identifies parts without a stable per-turn timeline; RR-18. |
| TD-22 | Addressed | Container detection, bounded buffering/transcoding, timeouts, and no silent relabel fallback. Real browser/native codec matrix remains unverified. |
| TD-23 | Addressed | Production model failures no longer become successful heuristic grades; explicit development demo has honest provenance. |
| TD-24 | Partial | Sample-specific grading shortcuts removed and no-key benchmark fails closed. Synthetic silent Speaking calibration remains invalid; RR-09. |
| TD-25 | Open | Semantic grounding, criterion identity and assessment validity remain; RR-18/RR-09. |
| TD-26 | Open | Cost/tracing fields are not an implemented assessment ledger; RR-19. |
| TD-27 | Addressed | Canonical/alias parsing covered by new client tests. |
| TD-28 | Addressed | Roman heading/answer constraints repaired; live ii for Paragraph B now scores Correct. |
| TD-29 | Addressed | Drill id/answer payload mapping and unknown-ID behavior repaired; source/unit coverage and browser result below. |
| TD-30 | Addressed | Speaking questions become individual prompts with preparation metadata; live starter pack shows 9 turns. |
| TD-31 | Partial | Canonical mapping/digests and content checks improved; publication paths/checksum/evidence enforcement still diverge; RR-14. |
| TD-32 | Partial | Persistent media and freshness checks added; invalid hash bypass, chart failures, asset integrity/version lifecycle remain; RR-14. |
| TD-33 | Partial | Decimal/currency/percentage preservation improved. Short packs still yield bands; negative signs still normalize away; RR-10. |
| TD-34 | Partial | Cancellation/persistence improved, but mock membership, both Writing tasks, eligible full sections and result states remain; RR-11. |
| TD-35 | Partial | Partial-skill labels and timestamp handling improve honesty. Mixed cohorts, short-pack evidence and finite ALL history remain; RR-10. |
| TD-36 | Addressed | Onboarding gates PTE/TOEFL as coming soon. Their future scoring systems remain intentionally unimplemented. |
| TD-37 | Partial | Elapsed clock tracker fixes callback drift. Process restart/clock changes/closed-app exam policy still need explicit behavior and tests. |
| TD-38 | Partial | Route providers auto-dispose, but native resource release fails; independently reproduced; RR-01. |
| TD-39 | Partial | Task-specific saves, lifecycle flush and timer checkpoints added. Mutable queued snapshots and content-version identity remain; RR-08. |
| TD-40 | Addressed | Clear Cache no longer deliberately deletes pending recordings; expiry selection protects pending work. Full deletion/media-byte cleanup still needs separate coverage. |
| TD-41 | Partial | IndexedDB bytes and an ephemeral flag added, but recovery/transaction success/UI warning remain incomplete; RR-02/RR-07. |
| TD-42 | Addressed | Foreground scheduling/draining improved and batches over 10 have regression coverage. Mobile OS background execution is not established. |
| TD-43 | Partial | Local attempt/recording/outbox transactions fix the original split commit. Full crash-recovery and post-persistence exception behavior still need boundary tests. |
| TD-44 | Partial | Real SQLite v1/v2 upgrade tests pass. Browser/backend upgrades and representative deployed data were not independently proven. Historical migration 0001 was also edited; record supported upgrade paths explicitly. |
| TD-45 | Partial | Some swallowed errors now surface, but cleanup/storage exceptions still hide failures; RR-01/RR-07/RR-08. |
| TD-46 | Partial | Rating guard and re-capture preservation improve the original behavior. Synced deck corrections still use insert-or-ignore and cannot update existing cards; RR-20. |
| TD-47 | Partial | Composite pagination, metadata fields and JSON export added. Export omits recordings/drafts/annotations/outbox and has no restore; Reading/Listening do not populate all new metadata fields. |
| TD-48 | Partial | Correct targets and Android flavors added. Native runtime configuration and signed/installable artifact proof remain; RR-12. |
| TD-49 | Partial | Release waits for build jobs and attaches artifacts; container tags improved. CI gates and native functionality still block release confidence; RR-12/RR-13. |
| TD-50 | Partial | Tool versions align and route inventory assertions improve coverage. Parity job still does not prove Dart wire decoding; CI calibration/configuration remains broken; RR-13. |
| TD-51 | Partial | Backup utility exists. Actual restore, SeaweedFS backup, capacity, RPO/RTO remain unproven; RR-15/RR-19. |
| TD-52 | Open | Coverage improved but test labels still overstate boundaries; two focused disposal tests found failures outside the 85-test suite; RR-13. |
| TD-53 | Partial | Telemetry stub removed and selected architecture violations repaired. Operational documentation, regional stubs and feature/quality claims still need alignment. |
| TD-54 | Partial | Audio metadata and partial purge handling implemented. End-to-end TTL/orphan behavior remains unverified and upload-after-erasure is unsafe; RR-06/RR-19. |
| TD-55 | Partial | Media nosniff/SVG sandbox and Nginx policy added. Header inheritance/CDN/cache behavior remain inconsistent; RR-16. |
| TD-56 | Partial | Aggregate audio and transcoding bounds improved. Streamed ingress limits, proxy trust and error envelopes remain; RR-17. |
| TD-57 | Partial | Production-domain/TLS wording improved. Provider guarantees, sharing disclosures and functioning privacy/deletion pages still require proof; RR-19. |
| TD-58 | Partial | SeaweedFS explicit authentication configuration added. Production credential provisioning and signed/unsigned/anonymous object-access proof remain; RR-16. |
| TD-59 | Partial | Generic explanation prompt and fail-closed model remove personalized/fabricated fallback behavior. Authoritative publication/version and semantic grounding remain; RR-18. |
| TD-60 | Addressed | Settings observes profile changes and no longer starts with mockza-local-user. Live onboarding target and first Settings visit both showed 7.5. |
| TD-61 | Addressed | Button previews now use the actual scheduler. Again is honestly day-based; Easy's 4/8-day behavior is an intentional scheduler change, not a tested learning-effectiveness claim. |

## Live browser follow-up

I inspected https://mockza.mehtea.ir/ in an isolated browser session at 1280×800, 393×852, and 320×640. A 393×1000 viewport was also used to expose a drill action while checking grading. Flutter semantics were enabled for accessibility-tree inspection. The review tab was closed afterward.

The checked flows produced no application console errors. Chromium emitted WebGL/ReadPixels performance warnings. This is not a frame-rate, accessibility certification, physical audio, or real-device microphone test.

### Original browser findings

| Finding | Current outcome | Evidence and limits |
| --- | --- | --- |
| BF-01: correct Roman heading scored wrong | **Fixed in live retest** | Selected ii for Paragraph B; review showed Question 1 Correct and Your answer: ii. |
| BF-02: correct TFNG answer rejected | **Fixed in live retest** | Selected TRUE for 45 MW generation versus 40 MW consumption; Check Answer showed “Well done! Correct.” and the correct comparison explanation. |
| BF-03: canceled mock section completed | **Fixed for cancellation** | Fresh planner showed 0/4; launched Listening and exited without submitting; still 0/4. Broader Full Mock correctness remains RR-11. |
| BF-04: no Exam Listening start | **Fixed in live retest** | Start Audio appeared; after activating it, the position advanced to 00:12 / 03:40. Physical sound quality was not evaluated. |
| BF-05: light-mode chart contrast | **Fixed visually** | Task 1 uses a dark chart frame with legible light labels; expand affordance is present. Actual chart accessibility/large-text behavior remains unverified. |
| BF-06: clipped important actions | **Improved, incomplete overall** | At 320px, Allow Mic, Retry Permission, Open Settings and the turn header have full labels. Other screens still truncate information or crowd controls. |
| BF-07: allowance heading clips at 320px | **Fixed visually** | “TRANSPARENT FAIR-USE ALLOWANCE” wraps within the card. Commercial copy still conflicts with limits elsewhere. |
| BF-08: weak/duplicate semantics | **Still open in live retest** | Settings has unnamed back/minus/plus controls and an unlabeled switch. Reading highlight color buttons are unnamed. Listening Start Audio appears as nested button semantics; question chips appear as generic numbers. |
| BF-09: two-skill diagnostic promise | **Improved** | Onboarding now says the option opens the Speaking baseline. Claims about calibrated/general starting bands still need qualification. |
| BF-10: goal mismatch/placeholder | **Fixed in observed flow** | Onboarding, Home and first Settings visit showed target 7.5, with a real initialized identifier instead of mockza-local-user. |
| BF-11: SRS intervals/session size | **Algorithm fixed; UX remains partial** | Source and passing tests use the scheduler for previews. I did not independently wait out a persisted interval in the browser. The 200-card session default remains. |
| BF-12: partial result presented as overall band | **Partially fixed** | Progress has coverage wording in source. Live 13-item Reading review still displayed an unqualified numeric Estimated IELTS Band; RR-10. |
| BF-13: desktop/task layout inconsistencies | **Still partial** | Primary tab width constraint remains useful. Desktop Settings spans almost the full viewport; task-specific mobile/desktop ergonomics are not resolved by no-overflow tests. |

### Remaining UI/UX feedback

The visual system is coherent: restrained colors, recognizable skill icons, consistent cards, and a clear separation between practice and review. Preserve that foundation. The largest remaining UX risk is whether the app tells the truth about the learner's work, score, purchase, and recovery state.

| Original concern | Review and recommended next change |
| --- | --- |
| UX-01: onboarding | Unsupported exams now have honest coming-soon gating. Remove “calibrated to official examiner standards” until RR-09/RR-18 are proven. Announce selected exam and target/date state to assistive technology. |
| UX-02: Home | Clear skill cards and an empty baseline state are good. Distinguish a Speaking baseline, a partial skill profile, and a four-skill readiness estimate. Explain the reason and duration for the next action. Do not call one skill the learner's overall band. |
| UX-03: Practice | Quick-launch cards still promise 4 Listening sections/30 minutes and 3 Reading passages/60 minutes while opening short seed samples. Use actual pack coverage and label the planner/sample explicitly. Replace developer copy such as “Postgres exam catalog” and “SeaweedFS .m4a audio.” |
| UX-04: downloads | Persistent Listening assets improve the offline experience. A Writing download can still omit its chart; RR-14. Show downloading/verifying/ready/failed/update-available states tied to real asset readiness. |
| UX-05: Speaking | Nine authored turns and readable permission actions improve usability. The critical remaining work is releasing the microphone, replaying saved clips, and recovering the session; RR-01/RR-02/RR-07. Clearly separate preview, recording, saved, uploading, retryable, and submitted states. |
| UX-06: Writing | Chart contrast and zoom affordance are much better. On the phone, a large prompt/chart consumes the viewport before the response editor appears. Make stimulus access and editor access easy during timed writing. Resolve the two-task submit model and actual save guarantees before promising “safely autosaved.” |
| UX-07: Listening | The start gesture works. At 393px before playback, “Exam Mode · Linear” crowds the timestamp and extends past the card's usable right space. Let the controls wrap or split into rows. Test with long durations, large text, loading, interruption, and actual audio errors. |
| UX-08: Reading | Roman headings are now correct. At phone width, “Passage 1” still clips in the narrow header. Highlight colors need names and keyboard operation. Preserve position/selection when switching passage/questions. Review showed several distinct evidence quotes labeled Paragraph 2; audit authored paragraph indexing alongside navigation. |
| UX-09: Full Mock | Canceling no longer fakes completion, which is an important fix. The planner still labels submitted/failed stages as completed and can count one Writing task. Display actual stage states and real membership; RR-11. |
| UX-10: review | Generic explanations, overlap handling, and stale-response protection help. Keep evidence verifiable, distinguish objective accuracy from estimated AI scoring, and reduce competing dense panels. The overlapping-annotation test currently checks only absence of an exception, not that all text/annotations remain accessible. |
| UX-11: failure recovery | Real retry/outbox paths exist now. Recovery labels must match the durable state, especially partial erasure, failed AI execution, incomplete uploads, and ephemeral storage. Offer a clear retry/resume/status action with a safe human-readable reason. |
| UX-12: Progress | Partial coverage labels are an improvement. Comparable cohorts still matter more than a polished line chart. Exclude unsupported short-pack bands; show skill, mode, dates, sample count and uncertainty. ALL is still bounded to 2,000 streamed attempts, not lifetime history. |
| UX-13: vocabulary | Preview labels now match the scheduler and rating is guarded. A first workout of 200 cards remains overwhelming. Offer a small session target, progress that survives interruption, and an explanation of day-based Again. Ease/interval changes should be evaluated as a product choice, not asserted effective from algorithm tests. |
| UX-14: paywall | The allowance card fits at 320px and web purchase availability is explicit. Package descriptions still say “unlimited AI evaluation access” and “Unlimited Speaking & Writing AI reviews” beside daily/monthly ceilings. “Official objective tests” conflicts with independent clean-room content. Show store-backed pricing and truthful allowances everywhere. |
| UX-15: Settings/privacy | Live target consistency is fixed and JSON export exists. The desktop screen is unnecessarily wide. Export currently copies JSON to the clipboard and omits work needed for exact restore. Clearly distinguish downloaded-cache clearing, portable export, pending erasure, and irreversible local reset. Free quota wording should say one shared diagnostic, not imply daily 1 Speaking plus 1 Writing. |
| UX-16: accessibility | Still incomplete. Unnamed controls, nested semantics, selected/value state, keyboard traversal, screen-reader reading order and task stimuli need explicit checks. A rendering test cannot close this item. Test actual accessible names/actions and supported screen readers. |
| UX-17: responsive layout | The fixed Paywall/Speaking cases are real progress. At 320px the drill title is reduced to a tiny space beside a wide timer, while it is still called “Complete the Sentence” for a TFNG exercise. Test the full set of task screens, long strings, system text scaling, keyboard-open layouts and portrait/landscape. |
| UX-18: localization/Iran | Adding a few ARB keys does not localize screens full of English literals. The Iran billing adapter remains a stub. Do not represent this as a complete regional product until language/RTL, identity, billing, hosting and support flows work end to end. |
| UX-19: motion/feedback | Broad reduced-motion, keyboard/focus, haptics and interruption evidence was not added by these fixes. Keep feedback purposeful and honor user preferences. This remains unverified rather than closed. |
| UX-20: trust/copy | Learner-facing database names, raw drill identifiers such as speed_tfng, model jargon, “official” content claims and unsupported calibration language remain. Replace them with coverage, task purpose, save status and concrete next steps. |

These remaining copy issues have direct code evidence: [app/lib/services/billing_gateway.dart:36](/home/mahdi/projects/ideas/mockza/app/lib/services/billing_gateway.dart:36), [app/lib/features/paywall/presentation/paywall_screen.dart:136](/home/mahdi/projects/ideas/mockza/app/lib/features/paywall/presentation/paywall_screen.dart:136), and [backend/apps/api/src/routes/quota.ts:50](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/quota.ts:50). The quota response exposes per-skill limits while the free entitlement is one shared diagnostic; the presentation must explain that distinction.

## Architecture and product choices

### Keep the stack; finish the boundaries

Flutter, Riverpod, Drift, Hono, PostgreSQL and pg-boss are sufficient for this product. The new quota lock and durable outbox are appropriate uses of existing database capabilities. Introducing another state framework, queue broker, or microservice would add work without solving the demonstrated invariants.

The main complexity concern is ownership. Route resources remain app-scoped while route disposal tries to control them through invalid refs. Mock sessions are stored as Writing drafts. Retry generation shares a field with delivery count. Content publication has multiple validators. Consolidate responsibility at those boundaries instead of adding isolated exceptions around symptoms.

The quota lock trades per-account throughput for correctness; that is reasonable for human-paced evaluation requests. Queue leases, asset lifecycle and migration guarantees need explicit definitions before more abstraction is added.

### Assessment validity owns the product promise

The primary commercial risk remains whether learners can trust the score and feedback. A model identifier, rubric prompt, deterministic rounding, and valid JSON do not establish examiner-level accuracy. The silent benchmark is especially important because a green-looking calibration report can hide missing evidence.

Publish only what has been measured. Call results practice estimates, show coverage, preserve uncertainty, and validate improvement on comparable tasks. Full mocks need complete content and both Writing tasks, not a four-number average from unrelated activity.

### Efficiency must be measured on the real session

The architecture can be efficient at the intended workload. It has not yet been proven efficient for nine-turn audio sessions, duplicate delivery, retries, queue backlogs, and the stated subscription allowance. Measure p50/p95 end-to-end latency, provider cost per accepted evaluation, storage/egress, retry amplification and peak memory.

Do not choose prices from nominal single-call costs. Include transcription/audio inputs, all turns, failures, explanations, payment fees, support and retention. Fix duplicate execution before using benchmark costs to forecast margins.

### User acceptance still needs user evidence

The interface now looks suitable for a focused beta. Users are most likely to value realistic practice, correct answers, useful explanations and saved work. They are most likely to lose trust through misleading scores, missing recordings, contradictory limits or a failed purchase/reset.

Neither this review nor screenshots can establish that users will like the product. Run task-based sessions with representative learners: complete a short practice, inspect why an answer was wrong, resume interrupted work, understand a partial score and explain the paid allowance. Measure completion, confusion, return use and whether feedback changes the next attempt.

### Privacy and regional editions need explicit ownership

One identity model must connect auth, linking, quota, billing, recovery and erasure. A shared-secret proof hook is not deployed native attestation. A flag selecting an Iran entrypoint is not evidence of regional compliance or a working local payment flow.

Assign one owner for each public promise: provider data handling, retention, deletion completion, offline durability, calibration, regional hosting, and purchase recovery. Keep the documentation linked to executable acceptance evidence.

## Recommended next sequence

1. **Protect resources and learner work:** RR-01/RR-02/RR-07/RR-08. Add the demonstrated disposal regressions, fix durable reference playback, persist session metadata, and serialize immutable Writing snapshots.
2. **Fence server execution and erasure:** RR-03/RR-05/RR-06. Prove crash recovery, old-generation rejection, partial deletion resumption, and upload/deletion races using isolated real services.
3. **Make billing reliable:** RR-04/RR-12. Test event concurrency/transfers and install exact configured release artifacts before enabling paid acquisition.
4. **Make scores and content honest:** RR-09/RR-10/RR-11/RR-14/RR-18. Remove unsupported claims now; require valid audio calibration and eligible full-test evidence for band aggregates.
5. **Restore reproducible release/operations:** RR-13/RR-15/RR-16/RR-17/RR-19. Pass exact CI, test the deployed serving policy, restore from relocated backups, and measure real cost/capacity.
6. **Complete UX acceptance:** accessible controls, truthful plan/coverage wording, responsive task flows, and a small real-learner beta.

For each item, keep four separate fields: implementation change, automated proof, real environment proof, and remaining limitation. That would make the next agent's completion report auditable.

## Reproduction note: resource disposal

The additional failing test file was /tmp/mockza_review_disposal_test.dart, run from app with:

~~~sh
flutter test --no-pub /tmp/mockza_review_disposal_test.dart --reporter expanded
~~~

Its two cases used the repository's actual providers and existing fake gateways. The important sequence was:

~~~dart
final subscription = container.listen(
  speakingSimNotifierProvider,
  (_, _) {},
);
await recorder.startRecording(outputPath: '/tmp/review_fake.m4a');
await player.play();
subscription.close();
await container.pump();

expect(recorder.isRecording, false); // Actual: true.
expect(player.isPlaying, false);
~~~

The Listening case watched listeningSimNotifierProvider, started playback, closed its last subscription, awaited container.pump(), and expected player.isPlaying to be false. Actual: true. The fakes were injected through the existing audioRecorderGatewayProvider/audioPlayerGatewayProvider overrides, so there were no real microphone, filesystem recording, or paid network calls.

Both cases failed against the reviewed source. Promote these checks into permanent regressions with the fixes; the temporary test and logs are not part of the repository changes.
