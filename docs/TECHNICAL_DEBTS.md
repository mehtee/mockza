# Technical debts, implemented UI/UX review, and architectural concerns

Audit date: 2026-11-16. Source baseline: commit `a6ed85e`, including the existing untracked deployment Nginx configuration. This audit changes documentation only.

## 1. Scope, evidence, and interpretation

This report covers Flutter features and shared widgets, local persistence, network and device services, API routes, authentication, quotas, billing, AI evaluation, workers, content, tests, migrations, deployment, and release automation. It builds on repository orientation and rechecks the consequential findings against current source. Historical readiness reports are not treated as proof of current behavior.

**Evidence labels:**

- **Confirmed:** The implementation contains the described behavior or omission. A source-confirmed defect is not necessarily reproduced against a deployed service.
- **Risk:** A concrete implementation mechanism can fail under a stated condition; the triggering runtime condition was not exercised.
- **Decision:** A product or architecture tradeoff requiring an explicit policy. It is not automatically a defect.
- **Unverified:** Requires browser, device, infrastructure, vendor, or human assessment beyond this audit.

**Priority:** P0 = identity/privacy/billing integrity or fabricated assessment; resolve before trusting production exposure. P1 = core feature correctness, data preservation, or release blocker. P2 = significant reliability, usability, or maintenance cost. P3 = polish or lower-impact optimization. Priorities describe recommended remediation order, not a claim that an incident has occurred.

### Verification already available

The preceding repository review ran `./scripts/check_all.sh all`, backend `pnpm typecheck`, backend `pnpm test`, and Flutter `flutter test --no-pub --reporter expanded`. All passed; Flutter reported 70 tests. Those results are a baseline, not evidence that the failure paths below work. No application code changed between that review and this audit, so the entire suite was not repeated for this documentation change.

The initial browser attempt was blocked by host AppArmor. After the host configuration was repaired, a browser follow-up succeeded on 2026-11-16; Section 12 records the actual flows, viewport sizes, reproduced defects, and remaining limits. The source review remains applicable, with browser confirmation only where explicitly stated. The design contact sheet is a specification reference, not a screenshot of the running app. This report does **not** certify measured color contrast, mobile audio behavior, purchase fulfillment, live model accuracy, production concurrency, or deployed TLS configuration.

### Audit inventory

The report records **61 technical debts** (10 P0, 42 P1, 9 P2), **20 implemented UI/UX findings**, **13 browser follow-up observations**, and **8 product/architecture decisions**. Counts include conditional risks and assurance gaps as labeled; they are not counts of reproduced incidents.

### Highest-priority findings

| Area | Finding | IDs |
| --- | --- | --- |
| Identity | UUID bearer fallback, unverified provider tokens, and anonymous reissuance defeat identity ownership | TD-01–03 |
| Assessment trust | AI errors can become successful heuristic grades with misleading model provenance | TD-23–25 |
| Private results | SSE lacks job ownership enforcement | TD-05 |
| Money | Webhook authentication/configuration and fulfillment state are unsafe; client/server billing identities differ | TD-04, TD-10 |
| User work | Speaking parent/child insertion order is wrong; cleanup can delete pending audio | TD-18, TD-40 |
| Quotas/jobs | Admission/refund races and non-atomic queue handoff can lose or misaccount work | TD-11–16 |
| Content | Several published question/drill formats do not match client parsers | TD-27–31 |
| Release | Flavor entrypoints, Android flavor selection, artifact paths, and release dependencies disagree | TD-48–49 |

## 2. Identity, security, privacy, and billing

### TD-01 — UUID bearer fallback bypasses JWT verification

**P0 · Confirmed · Owner: API authentication**

**Evidence:** [backend/apps/api/src/middleware/auth.ts:57](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/middleware/auth.ts:57). Any failed JWT verification enters a fallback accepting a raw UUID. The comment says development/test, but the middleware has no environment restriction.

**Failure and impact:** A caller knowing a device UUID can send `Authorization: Bearer <uuid>` and obtain that device's request context. JWT signature, expiration, and edition binding are bypassed. UUID entropy reduces guessing; it does not make an identifier an authentication credential. Private result access, uploads, quota use, and deletion rely on this context.

**Remediation:** Remove the fallback from production code. Inject test identity through explicit test dependencies. Validate required JWT claims, including subject, type, and edition; do not silently change account identity after database lookup failures.

**Acceptance:** Raw UUIDs, expired tokens, wrong editions, missing claims, and invalid signatures fail on every protected route. Existing valid tokens continue to work.

### TD-02 — Account linking decodes provider tokens without verifying them

**P0 · Confirmed · Owner: API account identity**

**Evidence:** [backend/apps/api/src/routes/auth.ts:15](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/auth.ts:15) decodes arbitrary base64 payloads and even falls back to a raw token slice. [backend/apps/api/src/routes/auth.ts:115](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/auth.ts:115) uses that subject to select or create an account. Lookup scopes only by `providerSubject`; the database unique constraint also omits provider: [backend/packages/db/src/migrations/0001_vengeful_the_santerians.sql:1](/home/mahdi/projects/ideas/mockza/backend/packages/db/src/migrations/0001_vengeful_the_santerians.sql:1).

**Failure and impact:** A fabricated token containing another subject can link a device to an existing account. Apple and Google subject namespaces can also collide. Sign-in labels currently imply guarantees the route does not implement.

**Remediation:** Verify provider signature/JWKS, issuer, audience, expiration, and applicable nonce. Identify links by `(provider, provider_subject)`. Define relinking and account merge policy before moving entitlements. Migrate constraints without losing existing links.

**Acceptance:** Forged, expired, wrong-audience, and replayed tokens fail. Identical subject strings from different providers remain distinct. Concurrent first links resolve to one account.

### TD-03 — Anonymous token issuance lets callers reclaim an existing device ID

**P0 · Confirmed · Owner: authentication bootstrap**

**Evidence:** [backend/apps/api/src/routes/auth.ts:39](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/auth.ts:39) accepts a caller-supplied device ID, upserts it, and signs a fresh token without proof of prior possession. Invalid payloads can become a fresh identity rather than a validation error. [backend/apps/api/src/middleware/attest.ts:15](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/middleware/attest.ts:15) checks only whether a header exists. Challenge generation does not persist or consume the nonce: [backend/apps/api/src/routes/auth.ts:80](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/auth.ts:80).

**Failure and impact:** Removing TD-01 alone is insufficient: a caller can request a signed credential for an existing UUID. Reinstallation/new UUIDs also replenish device-based diagnostic access. Merely enabling `APP_ATTEST_ENFORCED` does not establish attestation.

**Remediation:** Separate first-time registration from credential renewal. Use a server-issued secret or verified device key for renewal. Implement real platform attestation with bounded, single-use challenges if its anti-abuse value is required. Reject malformed registration input.

**Acceptance:** Knowledge of an existing UUID cannot mint its credential. Arbitrary attestation strings fail. Expired or reused challenges fail. Legitimate returning devices retain identity.

### TD-04 — Production configuration accepts development credentials and an unauthenticated billing webhook

**P0 · Confirmed · Owner: configuration/deployment**

**Evidence:** [backend/packages/config/src/env.ts:32](/home/mahdi/projects/ideas/mockza/backend/packages/config/src/env.ts:32) defaults S3, admin, and JWT credentials and allows an empty RevenueCat webhook secret. [backend/apps/api/src/routes/webhooks-revenuecat.ts:24](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/webhooks-revenuecat.ts:24) validates authorization only when that secret is nonempty. [compose.yaml:24](/home/mahdi/projects/ideas/mockza/compose.yaml:24) also supplies development defaults.

**Failure and impact:** A production process can start with known admin/JWT secrets. An empty webhook secret permits unauthenticated entitlement events. This is a startup validation failure, not a request to remove convenient local defaults.

**Remediation:** Apply production-only configuration refinements. Require independently generated secrets and required vendor configuration; reject known defaults. Disable billing routes explicitly when billing is unavailable. Keep local examples separate from production deployment inputs.

**Acceptance:** Production startup rejects missing/default secrets. Billing webhook rejects missing/wrong authorization. Development setup remains easy without making production silently permissive.

### TD-05 — Job SSE streams omit ownership checks

**P0 · Confirmed · Owner: job API**

**Evidence:** [backend/apps/api/src/routes/jobs.ts:84](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/jobs.ts:84) checks ownership for ordinary polling. The SSE handler at [backend/apps/api/src/routes/jobs.ts:150](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/jobs.ts:150) retrieves a job by ID and emits its result without the corresponding check.

**Failure and impact:** An authenticated caller with another job ID can receive its evaluation and potentially learner text/transcript. The feature flag `SSE_ENABLED` is not used to gate this route. The two result transports have different security rules.

**Remediation:** Reuse a single authorized job lookup for GET and SSE. Reject unauthorized streams before opening them. Honor the feature flag or remove the unused setting. Bound streaming sessions and handle disconnects.

**Acceptance:** Cross-account reads fail through both transports. Same-account access follows one documented device/account policy. Disabled SSE is unavailable.

### TD-06 — Attempt idempotency is not scoped to ownership or payload identity

**P1 · Confirmed · Owner: evaluation admission**

**Evidence:** [backend/apps/api/src/routes/evaluate.ts:91](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:91) and [backend/apps/api/src/routes/evaluate.ts:228](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:228) return an existing job using only `attemptId`. They do not compare account, skill, or payload hash.

**Failure and impact:** Another caller can discover job existence/status through a known attempt ID. Accidental reuse with a different essay or skill returns the old result. Concurrent first submissions can hit unique constraints after separate prechecks. Failed attempts are also returned unchanged, which obstructs meaningful retry.

**Remediation:** Make idempotency an owned, immutable submission identity. Persist an input hash; reject mismatched reuse. Handle uniqueness conflicts as part of admission. Separate retry of the same accepted input from a new learner attempt.

**Acceptance:** Same owner/input yields the same job. Cross-owner access is denied. Changed input is rejected. Simultaneous duplicates produce one reservation and one logical job.

### TD-07 — Rate limiting trusts caller-controlled forwarding headers

**P1 · Confirmed mechanism; deployment impact conditional · Owner: API/edge**

**Evidence:** [backend/apps/api/src/middleware/rate-limit.ts:60](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/middleware/rate-limit.ts:60) uses the first `X-Forwarded-For` value before any device ID. [backend/apps/api/src/app.ts:41](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/app.ts:41) installs it before route authentication. Nginx appends forwarding information: [app/nginx.conf:33](/home/mahdi/projects/ideas/mockza/app/nginx.conf:33).

**Failure and impact:** An untrusted inbound forwarding chain can let a caller rotate the limiter key. Conversely, clients behind one proxy/NAT can share the same quota. Process-local maps do not coordinate across replicas and grow with distinct keys until cleanup.

**Remediation:** Establish trusted-proxy handling at the edge and overwrite untrusted headers. Use authenticated account/device budgets for expensive work. A bounded local limiter can remain suitable for one instance; coordinate limits when replicas are introduced.

**Acceptance:** Spoofed forwarding headers cannot bypass limits through the deployed proxy chain. Legitimate shared-network users are handled intentionally. Load tests exercise the real middleware.

### TD-08 — API credentials can be sent to absolute upload/media origins

**P1 · Confirmed mechanism · Owner: HTTP client**

**Evidence:** [app/lib/services/network/dio_client.dart:29](/home/mahdi/projects/ideas/mockza/app/lib/services/network/dio_client.dart:29) adds bearer authorization to every path except strings containing `/v1/auth/`. [app/lib/services/grading_gateway.dart:269](/home/mahdi/projects/ideas/mockza/app/lib/services/grading_gateway.dart:269) uploads through that same Dio instance. [app/lib/services/content_sync_service.dart:140](/home/mahdi/projects/ideas/mockza/app/lib/services/content_sync_service.dart:140) downloads absolute media URLs through it too.

**Failure and impact:** Presigned S3 URLs or future media/CDN origins can receive the API bearer token. Current same-origin proxy mode limits exposure, but the supported presigned mode crosses a trust boundary. The interceptor comment promises more isolation than the code provides.

**Remediation:** Attach API credentials only to the configured API origin. Use an unauthenticated transport for presigned uploads and external media. Preserve only headers required by the signature; do not run API refresh logic against external hosts.

**Acceptance:** A fake external upload/media server sees no API authorization or API-specific identity headers. Same-origin API requests retain auth and refresh behavior.

### TD-09 — Account deletion can report success while data remains and recovery credentials are erased

**P0 · Confirmed · Owner: account lifecycle/storage/app settings**

**Evidence:** [backend/apps/api/src/routes/account.ts:57](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/account.ts:57) deletes database rows before S3 cleanup and swallows storage errors at line 108. [app/lib/services/auth_session_service.dart:135](/home/mahdi/projects/ideas/mockza/app/lib/services/auth_session_service.dart:135) clears credentials even after remote failure. [app/lib/features/settings/presentation/settings_notifier.dart:318](/home/mahdi/projects/ideas/mockza/app/lib/features/settings/presentation/settings_notifier.dart:318) ignores that failure and reports successful deletion.

**Failure and impact:** An offline deletion removes the user's means of retrying, while remote records remain. S3 failures lose database tracking before purge finishes. Linked-account deletion deletes the user and all provider links but removes job/audio rows and storage prefix only for the current device; other linked devices can retain data under detached identities. Queued workers are not coordinated with erasure. Existing JWTs are not revoked, and auth does not require that the device row still exists; stale credentials can still reach upload authorization after deletion.

**Remediation:** Define device reset versus full account erasure. Enumerate all linked devices for account deletion. Persist an idempotent erasure request/tombstone, cancel or fence work, retry object deletion, and retain recoverable deletion state until acknowledged. Report pending/partial completion honestly.

**Acceptance:** Offline requests remain retryable. Multi-device erasure removes all intended records and object prefixes. Worker races do not recreate data. Storage failure never becomes a false completed deletion.

### TD-10 — RevenueCat identity and event processing do not establish reliable fulfillment

**P0 · Confirmed · Owner: billing client/server**

**Evidence:** [app/lib/services/billing_gateway.dart:84](/home/mahdi/projects/ideas/mockza/app/lib/services/billing_gateway.dart:84) configures RevenueCat without the Mockza device/account app user ID. [backend/apps/api/src/routes/webhooks-revenuecat.ts:77](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/webhooks-revenuecat.ts:77) only resolves a UUID matching `devices.deviceId`. The webhook records receipt before entitlement writes at line 67; most event types default to `isPro = true` at line 80.

**Failure and impact:** A purchase can succeed locally while backend evaluation remains locked. An entitlement write failure leaves a deduplicated event that subsequent retries skip. Unknown or out-of-order events can grant or resurrect access; event/product/entitlement semantics are not rigorously validated. Quota reads remain device-centric even for linked accounts.

**Remediation:** Choose one billing identity and explicitly log in/alias it in RevenueCat. Validate a typed event payload and configured products/entitlements. Apply supported event semantics and ordering. Commit processed-event state with fulfillment or use a durable event inbox with retry status. Provide a server reconciliation path.

**Acceptance:** Real sandbox purchase, renewal, expiration, cancellation/refund, transfer, duplicate, and out-of-order events converge on the same client/server entitlement. Injected DB failure is recoverable by webhook retry.

## 3. Quotas, jobs, and distributed state

### TD-11 — Quota admission is not atomic despite its function name

**P1 · Confirmed · Owner: database quota service**

**Evidence:** [backend/packages/db/src/quota-service.ts:103](/home/mahdi/projects/ideas/mockza/backend/packages/db/src/quota-service.ts:103) checks prior reservation, reads usage, and determines eligibility before entering the transaction at line 151. The transaction increments usage without conditional ceilings or locking the admission decision.

**Failure and impact:** Two distinct attempts can both observe the last available slot or unused free diagnostic and both succeed. Same-attempt races can throw unique conflicts. Transactions protect the individual writes, not the business limit.

**Remediation:** Serialize admission on the relevant account/day/month and diagnostic identity, or use conditional updates/appropriate isolation with bounded retries. Keep reservation uniqueness and eligibility inside the same protected decision. Define a stable lock order.

**Acceptance:** Real PostgreSQL bursts at daily/monthly/diagnostic boundaries admit exactly the allowed count. Repeated identical attempts consume once. No unhandled unique/serialization errors escape.

### TD-12 — Refunds can decrement more than once and target the wrong diagnostic device

**P1 · Confirmed · Owner: database quota service**

**Evidence:** [backend/packages/db/src/quota-service.ts:221](/home/mahdi/projects/ideas/mockza/backend/packages/db/src/quota-service.ts:221) reads reservation status outside the refund transaction. The update at line 236 does not condition on the prior status. Line 268 compares `devices.deviceId` to an account key that may be a user ID.

**Failure and impact:** Concurrent refunds can each decrement shared counters. `GREATEST(0, ...)` hides underflow but can erase usage belonging to other attempts. A linked user's free diagnostic may not be restored. A later worker commit can overwrite a refunded status without restoring the counter.

**Remediation:** Atomically transition one eligible reservation to refunded, return the transitioned row, and decrement only for the winner. Persist the diagnostic owner explicitly. Make commit/refund mutually consistent state transitions.

**Acceptance:** Many simultaneous refunds decrement once. Linked-device diagnostics restore correctly. Commit-versus-refund races have one documented outcome and balanced counters.

### TD-13 — API can accept work while the queue producer is unavailable

**P1 · Confirmed · Owner: API bootstrap/readiness**

**Evidence:** [backend/apps/api/src/server.ts:16](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/server.ts:16) catches pg-boss startup errors and continues. [backend/apps/api/src/routes/evaluate.ts:152](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:152) conditionally sends only if `boss` exists, then returns queued. The variable is assigned before `start()`, so a failed start may also leave a non-undefined but unusable producer. [backend/apps/api/src/routes/health.ts:64](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/health.ts:64) does not inspect producer/worker availability.

**Failure and impact:** Requests can reserve quota and create stranded jobs, or fail unpredictably when sending through a partially initialized producer. Health can remain green while the core grading service cannot accept work.

**Remediation:** Publish the producer dependency only after successful initialization. Reject evaluation admission with a retryable 503 when unavailable. Distinguish liveness from readiness, and expose queue/worker health or lag where operationally meaningful.

**Acceptance:** Stop queue initialization/connectivity: no accepted request becomes silently stranded. Readiness reflects inability to enqueue. Recovery is observable and does not require arbitrary user resubmission.

### TD-14 — Reservation, job creation, and queue handoff are separate commits

**P1 · Confirmed · Owner: evaluation admission/database**

**Evidence:** [backend/apps/api/src/routes/evaluate.ts:116](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:116) reserves quota, inserts an evaluation job, and sends pg-boss work in separate steps. Compensation exists for a thrown enqueue error, but not process death or every intermediate failure.

**Failure and impact:** A crash after reservation can consume credit with no job. A crash after job insertion can leave a job that never runs. Returning an existing queued job then prevents normal resubmission from repairing that gap.

**Remediation:** Prefer a transactionally compatible pg-boss enqueue if the installed API supports the required transaction semantics; otherwise use a small transactional dispatch outbox. Add reconciliation for old reserved/queued states. Avoid compensating only known exceptions.

**Acceptance:** Kill the process at each boundary and restart. Every accepted submission eventually runs or reaches an explicit failed/refunded state. Counters, reservations, jobs, and dispatch records reconcile.

### TD-15 — Worker failure/refund lifecycle disagrees with pg-boss retries

**P1 · Confirmed · Owner: worker lifecycle**

**Evidence:** [backend/apps/worker/src/jobs/grade-writing.ts:53](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/grade-writing.ts:53) and [backend/apps/worker/src/jobs/grade-speaking.ts:97](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/grade-speaking.ts:97) mark jobs failed and refund on every thrown execution. [backend/apps/worker/src/index.ts:25](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/index.ts:25) enables queue retries. Completion and quota commitment are also separate writes.

**Failure and impact:** The UI sees final failure while the queue still intends to retry. A later success can commit a refunded reservation without charging it again. Duplicate/redelivered work may overwrite terminal state and spend extra model calls. Initial status writes outside the handler's main `try` have different failure handling.

**Remediation:** Model retrying versus terminal failure explicitly. Refund only after permanent rejection or exhausted retries. Fence duplicate executions and use conditional state updates. Commit result and reservation state coherently, with recovery for interrupted completion.

**Acceptance:** A transient model failure followed by success charges exactly once and never reports final failure prematurely. Exhausted work refunds once. Redelivery after completion does not rerun the model.

### TD-16 — “Retry AI Evaluation” does not create a real failed-job retry

**P1 · Confirmed · Owner: review flow/API job lifecycle**

**Evidence:** [app/lib/features/evaluation_review/presentation/evaluation_review_notifier.dart:468](/home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_notifier.dart:468) flushes existing outbox work or polls the existing remote ID. [backend/apps/api/src/routes/evaluate.ts:99](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:99) returns the same failed job for repeated attempt IDs.

**Failure and impact:** Once the outbox entry has been removed and a remote job is terminally failed, the advertised retry can simply redisplay the failure. Creating a new random learner attempt would hide duplicate history and quota questions rather than solve recovery.

**Remediation:** Define an authorized retry operation for immutable original input. Coordinate queue generation, retry count, quota reservation/re-reservation, and UI status. Keep “check status” separate from “retry failed evaluation.”

**Acceptance:** A terminally failed submission can recover using the button, with the original work intact, a bounded execution history, and correct credit accounting.

### TD-17 — Asynchronous review responses are not bound to the attempt that initiated them

**P1 · Risk · Owner: review state**

**Evidence:** [app/lib/features/evaluation_review/presentation/evaluation_review_notifier.dart:501](/home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_notifier.dart:501) awaits a status request. [app/lib/features/evaluation_review/presentation/evaluation_review_notifier.dart:673](/home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_notifier.dart:673) applies its snapshot to `state.attemptId`, rather than an immutable captured attempt identity. The provider is shared: [app/lib/features/evaluation_review/presentation/evaluation_review_providers.dart:5](/home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_providers.dart:5).

**Failure and impact:** If another review loads while a prior request is in flight, the old response can be written onto the new active attempt. `_isDisposed` is insufficient because the shared notifier remains alive. Similar stale-response hazards exist in screen-local analytics/history loads.

**Remediation:** Scope state by attempt ID or validate a request generation plus expected attempt/job ID before writes. Cancellation is useful but identity checking remains necessary.

**Acceptance:** Delay attempt A's poll, open B, then finish A. Neither B's persisted result nor its displayed state changes to A's result.

## 4. Speaking, AI evaluation, and assessment trust

### TD-18 — Speaking persists child audio rows before the parent attempt

**P1 · Confirmed · Owner: speaking submission/local repository**

**Evidence:** [app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:771](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:771) saves `AudioRecordings`; parent `saveLocalSubmission` follows at line 794. [app/lib/data/db/app_database.dart:81](/home/mahdi/projects/ideas/mockza/app/lib/data/db/app_database.dart:81) enables foreign keys. The existing foreign-key test rejects orphaned children.

**Failure and impact:** A fresh speaking submission can fail with a foreign-key violation after network uploads already occurred. The recording may not gain durable attempt/outbox ownership. The error path returns null and surfaces a raw exception to the learner.

**Remediation:** Persist parent, complete turn manifest, and child records locally before network work, in one transaction. Make upload/enqueue a subsequent resumable step. Do not weaken foreign keys to accommodate incorrect ordering.

**Acceptance:** A fresh multi-turn session submits with FK enforcement on. Offline submission survives restart. Injected failure between persistence/upload/enqueue preserves recoverable work without orphan objects.

### TD-19 — Partial speaking uploads can be submitted as a complete session

**P1 · Confirmed · Owner: speaking submission**

**Evidence:** [app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:733](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:733) collects only successful uploads. At line 808 it queues evaluation when that list is merely nonempty, even if other recorded turns failed upload.

**Failure and impact:** One successful clip out of several can produce a final evaluation while omitted turns never enter the retry outbox. The part-sequence label is derived from recorded count, not successful coverage. The user is not told the assessment is partial.

**Remediation:** Store per-turn upload progress. Admit evaluation only when all required recorded turns are available, or explicitly support a partial assessment with visible coverage. Resume only missing uploads.

**Acceptance:** Fail the second of three uploads. No full-session grade is requested until all required clips succeed. Restart resumes missing work without discarding or silently omitting turns.

### TD-20 — Speaking worker grades only the first audio turn

**P1 · Confirmed · Owner: audio evaluation worker**

**Evidence:** [backend/apps/worker/src/jobs/grade-speaking.ts:35](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/grade-speaking.ts:35) selects `turns[0]`/`audioObjectKeys[0]`. The rest of the session is not fetched for audio analysis.

**Failure and impact:** Parts 2 and 3 can be ignored while the result appears to evaluate a full interview. Textual prompt context cannot replace missing acoustic evidence. Changing later clips may have no effect on the result.

**Remediation:** Preserve ordered turn IDs and analyze every admitted clip, with clear part boundaries. Either send supported multi-audio input or aggregate per-turn evidence into one rubric result. Preserve timestamps relative to the correct source.

**Acceptance:** A multi-turn fixture proves every clip reaches the evaluator. Contradictory pronunciation/fluency in later parts affects the assessment. Each transcript segment maps to a source turn.

### TD-21 — Speaking protocol and storage identify parts rather than individual turns

**P1 · Confirmed contract defect; latent overwrite risk · Owner: contracts/storage**

**Evidence:** [app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:815](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_notifier.dart:815) emits `part_1`/`part_2`; [backend/packages/contracts/src/schemas.ts:128](/home/mahdi/projects/ideas/mockza/backend/packages/contracts/src/schemas.ts:128) defines the request enum with `part1`/`part2`/`part3`/`full`/`diagnostic`. [backend/packages/storage/src/presign.ts:40](/home/mahdi/projects/ideas/mockza/backend/packages/storage/src/presign.ts:40) uses only attempt ID and part index for the clip key.

**Failure and impact:** Single-part submissions can fail validation. Once individual questions are represented correctly, multiple clips in one part overwrite the same object key. Uploaded input can also be replaced while its signed URL remains valid, breaking immutable evaluation provenance.

**Remediation:** Use canonical typed part-sequence values in Dart and TypeScript fixtures. Give every recording a stable turn/clip ID and immutable storage key; include expected checksum/size in the accepted manifest.

**Acceptance:** All part modes round-trip through real request schemas. Two questions in part 1 retain two distinct objects. Replacing accepted bytes cannot silently change an in-flight assessment.

### TD-22 — Audio preparation can relabel invalid/unconverted bytes as M4A and lacks execution bounds

**P1 · Confirmed · Owner: audio processing**

**Evidence:** [backend/packages/ai/src/audio/processor.ts:40](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/audio/processor.ts:40) starts FFmpeg without a wall-clock limit. Failed transcoding returns original bytes at line 114; `encodeAudioForModel` always declares `m4a` at line 123. [backend/apps/worker/src/jobs/grade-speaking.ts:52](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/grade-speaking.ts:52) suppresses S3/preparation errors and proceeds without audio.

**Failure and impact:** WebM/Ogg or corrupt bytes can be mislabeled. A stuck decoder can occupy a worker indefinitely. Missing/corrupt input falls into fabricated grading rather than an actionable input error. File size alone does not bound decode time or decoded duration.

**Remediation:** Validate container, duration, channels, and decode outcome. Bound subprocess runtime/resources, kill on timeout, and return a typed permanent/transient error. Preserve the actual format when fallback is explicitly supported; production grading should require verified audio.

**Acceptance:** Corrupt, silent, oversized-duration, unsupported, and hanging inputs fail with bounded resources. Valid native/browser recordings normalize and retain appropriate signal quality.

### TD-23 — AI failure silently produces successful heuristic results

**P0 · Confirmed · Owner: grading policy/AI execution**

**Evidence:** [backend/packages/ai/src/graphs/grade-speaking.ts:20](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-speaking.ts:20) derives fallback text from `inputText` or the examiner prompt. [backend/packages/ai/src/graphs/grade-speaking.ts:224](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-speaking.ts:224) falls back when key/audio is absent and after upstream errors. [backend/packages/ai/src/graphs/grade-writing.ts:288](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-writing.ts:288) has equivalent fallback behavior. Fallback outputs report the primary model ID.

**Failure and impact:** Missing keys, network errors, invalid model output, or absent audio can become “completed” evaluations. Speaking feedback can claim pronunciation problems and a transcript without listening to learner audio. Quota is committed for a result whose provenance is misrepresented.

**Remediation:** Confine deterministic fakes to tests or an explicitly labeled demo mode. Production should fail honestly, preserve work, retry eligible failures, and refund terminal failures. Store actual evaluator, version, input coverage, and failure provenance.

**Acceptance:** Remove API key, drop audio, force timeout/429/invalid JSON: no normal successful AI grade appears. Tests verify user-visible failure, retry/refund behavior, and truthful provenance.

### TD-24 — Golden benchmark is contaminated by sample-specific grading rules

**P0 · Confirmed · Owner: evaluation methodology**

**Evidence:** [backend/packages/ai/src/graphs/grade-writing.ts:94](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-writing.ts:94) assigns scores using specific benchmark phrases. [backend/packages/ai/src/graphs/grade-speaking.ts:35](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-speaking.ts:35) has similar phrase rules. [backend/evals/src/run-evals.ts:63](/home/mahdi/projects/ideas/mockza/backend/evals/src/run-evals.ts:63) passes text rather than audio for speaking. The pass condition at line 112 does not require verified evidence or real model execution.

**Failure and impact:** A green “calibration” gate can measure recognition of known examples rather than generalization. Its speaking latency and pronunciation claims are not live audio measurements. Tuning to this gate risks making production worse while reported accuracy improves.

**Remediation:** Remove sample-specific anchors from production. Separate deterministic contract tests from model benchmarks. Use held-out, independently rated writing and audio samples; record reviewer agreement, model version, actual provider use, subgroup errors, and cost/latency.

**Acceptance:** Benchmarks fail closed if a fake/fallback runs. Unseen paraphrases and new samples retain accuracy. Speaking calibration uses audio and assesses pronunciation separately from transcript quality.

### TD-25 — Structural model validation is not enough to support assessment claims

**P1 · Confirmed validation gap; quality requires evaluation · Owner: AI/rubric/content**

**Evidence:** [backend/packages/ai/src/graphs/grade-writing.ts:337](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-writing.ts:337), [backend/packages/ai/src/graphs/grade-speaking.ts:275](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-speaking.ts:275), and [backend/packages/contracts/src/schemas.ts:212](/home/mahdi/projects/ideas/mockza/backend/packages/contracts/src/schemas.ts:212) validate result structure but do not establish that quotations, edit offsets, timestamps, recommended drill IDs, and criterion claims are grounded in the submitted work. Writing requests also accept prompt text from the client rather than loading authoritative task context.

**Failure and impact:** A schema-valid result can quote absent text, recommend an unavailable drill, follow instructions embedded in an essay, or assess a chart report without the chart's underlying facts. Client-edited prompt/context can alter the grading task. Claims such as “official examiner standards” need independent evidence.

**Remediation:** Load canonical prompt/task data by pack/version/task ID. Treat learner content as untrusted data in the prompt. Validate evidence and ranges against original input, verify drill references, and provide honest uncertainty/coverage. Supply structured chart data or supported image context for Task 1.

**Acceptance:** Adversarial essays cannot override rubric policy. Invented quotes, invalid offsets, out-of-range timestamps, and unknown drills are rejected or repaired with bounded retries. Human evaluation measures criterion accuracy, not just JSON validity.

### TD-26 — Observability exists as unused scaffolding, leaving assessment cost and failures opaque

**P2 · Confirmed · Owner: AI/operations**

**Evidence:** [backend/packages/ai/src/observability/langfuse.ts:60](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/observability/langfuse.ts:60) defines a tracer, but production graph/worker call sites do not invoke it. Token/cost fields exist in [backend/packages/db/src/schema.ts:120](/home/mahdi/projects/ideas/mockza/backend/packages/db/src/schema.ts:120) without production population. [backend/packages/ai/src/models/openrouter.ts:90](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/models/openrouter.ts:90) casts provider JSON rather than validating it at the boundary.

**Failure and impact:** Operators cannot reliably distinguish fallback, provider failure, malformed output, slow jobs, repeated billing, or model drift. Claimed cost/latency gates lack representative measurements. Raw upstream error text can be copied into stored job stage messages.

**Remediation:** Instrument the existing provider/worker boundaries with correlation IDs, actual model/provider, usage, latency, retry outcome, and bounded error codes. Redact before exporting; avoid logging full learner essays/audio by default. Either wire the tracer or remove unsupported operational claims.

**Acceptance:** One accepted job can be traced through dispatch, execution, retries, and completion without exposing raw private content. Usage/cost reconciles with vendor records and representative alerts fire.

## 5. Content contracts, scoring, and learner analytics

### TD-27 — Published question type names fall through to the wrong client controls

**P1 · Confirmed · Owner: content contract/client parser**

**Evidence:** [backend/packages/db/src/seed-data/starter-exams.ts:213](/home/mahdi/projects/ideas/mockza/backend/packages/db/src/seed-data/starter-exams.ts:213) publishes types including `true_false_not_given` and `multiple_choice`. [app/lib/data/repositories/exam_catalog_repository.dart:516](/home/mahdi/projects/ideas/mockza/app/lib/data/repositories/exam_catalog_repository.dart:516) recognizes `tfng`, `mcq_single`, etc., and silently defaults everything else to short answer.

**Failure and impact:** A published TFNG or MCQ question can appear as a free-text field. This changes the intended task, produces confusing answer conventions, and invalidates comparable scoring. Silent defaults hide malformed content instead of isolating it.

**Remediation:** Define a canonical content discriminated union and validate it at publishing and client import. Use a temporary explicit compatibility mapping for existing seeded values. Unsupported types should fail import with a useful diagnostic, not change task semantics.

**Acceptance:** Every published seed bundle passes through the actual API response and Dart parser. Each question creates the intended widget and can submit its canonical correct answer.

### TD-28 — Matching headings and answer constraints disagree across content and UI

**P1 · Confirmed · Owner: objective-question contract**

**Evidence:** [app/lib/features/reading_sim/presentation/reading_sim_screen.dart:813](/home/mahdi/projects/ideas/mockza/app/lib/features/reading_sim/presentation/reading_sim_screen.dart:813) renders matching headings like choices and sends alphabetical letters at line 847. Seed heading answers use Roman numerals or full heading text. [app/lib/data/repositories/exam_catalog_repository.dart:554](/home/mahdi/projects/ideas/mockza/app/lib/data/repositories/exam_catalog_repository.dart:554) does not load a per-question word limit and leaves `QuestionSpec.maxWords` at its default.

**Failure and impact:** Selecting the correct visible heading can be marked wrong. Short-answer instructions can say one thing while the scorer enforces a default of three words. Multi-select correctness currently relies on serialized answer strings rather than an explicit set representation.

**Remediation:** Separate stable option IDs, displayed labels, and accepted answers. Carry word limits and answer cardinality in the canonical question type. Score selected IDs/sets with deterministic order-independent semantics where appropriate.

**Acceptance:** Correct heading selections score correctly regardless of label style. Word limits round-trip. Multi-select fixtures cover missing, extra, reordered, and repeated selections.

### TD-29 — Micro-drill item schemas do not round-trip

**P1 · Confirmed · Owner: content publishing/client import**

**Evidence:** [backend/apps/api/src/routes/admin.ts:78](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/admin.ts:78) and starter drills use `{id, answer}`. [app/lib/data/repositories/exam_catalog_repository.dart:485](/home/mahdi/projects/ideas/mockza/app/lib/data/repositories/exam_catalog_repository.dart:485) expects `{itemId, acceptedAnswers}`. The API passes through stored items: [backend/apps/api/src/routes/exams.ts:195](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/exams.ts:195). AI recommendations carry a `drillType`, which [app/lib/services/grading_gateway.dart:526](/home/mahdi/projects/ideas/mockza/app/lib/services/grading_gateway.dart:526) treats as a concrete drill ID, further confusing categories with published content identities.

**Failure and impact:** Items can acquire empty identifiers and no accepted answers. Learners can answer correctly and still fail. Recommending a drill from an AI result is further weakened by [app/lib/features/micro_drills/presentation/micro_drills_notifier.dart:205](/home/mahdi/projects/ideas/mockza/app/lib/features/micro_drills/presentation/micro_drills_notifier.dart:205), which silently substitutes the first drill when the requested ID is absent.

**Remediation:** Unify drill DTOs and migrate existing items. Require unique nonempty IDs and at least one accepted answer. Return a specific missing-drill state or an explicitly labeled alternative; do not silently change the recommendation.

**Acceptance:** Seed and admin-created drills survive publish/API/cache/parse/answer flows. Recommended IDs resolve to the intended content, or the app explains that content is unavailable.

### TD-30 — Speaking imports sections as questions and loses cue-card metadata

**P1 · Confirmed · Owner: speaking content parser**

**Evidence:** [app/lib/data/repositories/exam_catalog_repository.dart:443](/home/mahdi/projects/ideas/mockza/app/lib/data/repositories/exam_catalog_repository.dart:443) builds one prompt per section and ignores question rows. It recognizes `bulletPoints`/`cueCardBullets` and `prepSeconds`, while seed metadata uses other names in parts of the dataset.

**Failure and impact:** Individual examiner questions disappear; a session can become three broad section descriptions. Cue-card bullets and intended timing may be absent. This compounds TD-20: both content selection and audio coverage underrepresent a full interview.

**Remediation:** Build ordered speaking turns from canonical question rows, with explicit section/part and cue-card metadata. Preserve question IDs, timing, bullets, and source content version. Reject incomplete mandatory metadata before publishing.

**Acceptance:** Compare a seeded session's authored questions with the app's turn list. Every intended question appears once, in order, with correct Part 2 preparation and response windows. Expand the three-turn request ceiling only alongside a bounded, stable per-question recording manifest (TD-21/TD-56).

### TD-31 — Publishing, validation, and integrity checks use competing definitions

**P1 · Confirmed · Owner: content pipeline/domain/API**

**Evidence:** [backend/content-pipeline/src/validator.ts:24](/home/mahdi/projects/ideas/mockza/backend/content-pipeline/src/validator.ts:24) validates `CompletePackSchema`, exact evidence slices, and 40 reading questions. [backend/content-pipeline/src/validate-pack.ts:104](/home/mahdi/projects/ideas/mockza/backend/content-pipeline/src/validate-pack.ts:104) runs a separate seed inspection that checks SHA shape rather than comparing calculated content bytes, and accepts missing evidence quotes. [backend/apps/api/src/routes/admin.ts:157](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/admin.ts:157) uses another schema and blocklist. Provenance enums also differ.

**Failure and impact:** “Validation passed” means different things depending on the entrypoint. A syntactically valid 64-character checksum is not integrity verification. The stricter pipeline is not necessarily protecting admin-published/current API content. `humanQaReviewed: true` is a declaration, not a recorded review.

**Remediation:** Consolidate around one publishable canonical format, with distinct rules for full tests versus practice excerpts. Validate all production ingress using the same semantic validator. Define exact canonical bytes and verify their digest, media digests, evidence ranges, question references, and provenance/reviewer records.

**Acceptance:** Seed, CLI, and admin routes reject the same malformed examples. Changing one byte invalidates the expected checksum. Invalid references, missing required evidence, and unsupported provenance cannot be published.

### TD-32 — Offline catalog caching has no complete version/integrity lifecycle

**P1 · Confirmed · Owner: content sync/local catalog**

**Evidence:** [app/lib/services/content_sync_service.dart:111](/home/mahdi/projects/ideas/mockza/app/lib/services/content_sync_service.dart:111) saves bundle JSON before opportunistic media fetching. Bytes fetched at line 142 are discarded. `ensureExamBundle` at line 164 returns any existing cached bundle without checking the manifest version or checksum.

**Failure and impact:** A downloaded badge can mean only JSON is present; listening audio/chart still requires a network connection. Revised or withdrawn content can remain indefinitely in local cache. Partial downloads appear complete. Redundant warm-up transfers consume bandwidth without durable benefit.

**Remediation:** Store actual media bytes in app-owned storage, keyed by immutable content version/hash. Verify size/digest, stage a full pack, then atomically mark it available. Pin attempts to content versions. Define update, rollback, withdrawal, and eviction behavior without damaging old attempt review.

**Acceptance:** After download, disable network and restart: all required text/audio/chart resources work. Corrupt or interrupted downloads do not get a ready badge. New versions update predictably while old attempt evidence remains reproducible.

### TD-33 — Objective scoring overstates precision and uses lossy normalization

**P1 · Confirmed behavior; calibration is a product concern · Owner: assessment domain**

**Evidence:** [app/lib/core/exams/local_objective_scorer.dart:106](/home/mahdi/projects/ideas/mockza/app/lib/core/exams/local_objective_scorer.dart:106) strips punctuation inside tokens, so values such as `1.5` and `15` can normalize identically. [app/lib/core/exams/local_objective_scorer.dart:172](/home/mahdi/projects/ideas/mockza/app/lib/core/exams/local_objective_scorer.dart:172) scales any non-40-question pack proportionally to a 40-item band table. Word-count rules are applied to every answer format.

**Failure and impact:** Distinct numeric answers may be accepted as equal. Very short practice sets can yield a precise-looking band despite large sampling error. Generic normalization can erase distinctions meaningful to a question. Hyphenation/numeral/word-count rules require an explicit marking policy rather than broad cleanup.

**Remediation:** Use question-type-aware normalization and explicit accepted variants. Preserve decimal and other meaningful punctuation. Separate raw practice accuracy from a calibrated full-test band estimate. State sample size and uncertainty when a practice estimate is shown.

**Acceptance:** Regression fixtures distinguish decimal values, dates, contractions, hyphens, units, and multi-select sets. Small excerpt results do not imply full-test measurement accuracy.

### TD-34 — Full mock completion and Writing aggregation are not modeled as exam results

**P1 · Confirmed · Owner: mock orchestration/domain**

**Evidence:** [app/lib/features/practice_hub/presentation/full_mock_screen.dart:27](/home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/full_mock_screen.dart:27) keeps launched skills in widget memory. Lines 142–144 mark completion whenever navigation returns. [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:368](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:368) submits only the active task. The weighted helper in [app/lib/core/exams/exam_spec.dart:505](/home/mahdi/projects/ideas/mockza/app/lib/core/exams/exam_spec.dart:505) is not a durable two-task exam orchestrator.

**Failure and impact:** Start a section, exit without submitting, and the planner can count it complete. Restart loses mock progress. Task 1 and Task 2 do not form a persistently identified, weighted Writing result for that mock. Arbitrary short seed packs are presented with full-exam language.

**Remediation:** Introduce only the necessary durable mock session and stage references. Completion must follow accepted submission, not a route return. Track task-level Writing results and combine Task 2 at double weight when both belong to one exam. Distinguish practice packs from validated full tests.

**Acceptance:** Cancellation never completes a stage. Restart resumes the same mock. Four linked skill results produce one reproducible overall result, with honest pending/partial states.

### TD-35 — Progress combines unlike attempts and labels incomplete evidence as an overall estimate

**P1 · Confirmed · Owner: analytics domain/data**

**Evidence:** [app/lib/core/exams/study_metrics_calculator.dart:182](/home/mahdi/projects/ideas/mockza/app/lib/core/exams/study_metrics_calculator.dart:182) averages available skills even if only one exists. [app/lib/features/home/presentation/home_notifier.dart:207](/home/mahdi/projects/ideas/mockza/app/lib/features/home/presentation/home_notifier.dart:207) does not partition attempts by exam ID. [app/lib/features/progress/presentation/progress_screen.dart:44](/home/mahdi/projects/ideas/mockza/app/lib/features/progress/presentation/progress_screen.dart:44) derives an IELTS track from module type, then uses all recent scored attempts. [app/lib/features/progress/presentation/progress_providers.dart:27](/home/mahdi/projects/ideas/mockza/app/lib/features/progress/presentation/progress_providers.dart:27) limits the dataset to 100, even for “ALL.”

**Failure and impact:** A single speaking score can appear as an overall band. Academic, General, study-mode, full-test, drill, and partial results can be compared or averaged without sufficient qualification. Historical charts shift because `updatedAt` is treated as completion time; polling a result can create a new study day. Overall averaging weights skills equally, while the monthly delta uses a pooled attempt mean, so apparent improvement can reflect changing skill mix.

**Remediation:** Define eligible attempt types, exam/module/version, completion time, and study-mode metadata. Show skill coverage and sample counts. Query aggregates at the database layer for the chosen time range. Compare like with like, with the same aggregation rule for current and baseline values.

**Acceptance:** One skill is shown as partial evidence. Track switching never reinterprets old scores. Updating a result does not change study-day history. “ALL” includes attempts beyond the first 100. Delta fixtures hold skill mix constant.

### TD-36 — Future exam choices are selectable without their scoring systems

**P1 · Confirmed · Owner: product capability gating**

**Evidence:** [app/lib/features/onboarding/presentation/onboarding_screen.dart:105](/home/mahdi/projects/ideas/mockza/app/lib/features/onboarding/presentation/onboarding_screen.dart:105) exposes PTE and TOEFL as active choices. [app/lib/features/home/presentation/home_screen.dart:140](/home/mahdi/projects/ideas/mockza/app/lib/features/home/presentation/home_screen.dart:140) launches IELTS simulators. [app/lib/core/exams/study_metrics_calculator.dart:199](/home/mahdi/projects/ideas/mockza/app/lib/core/exams/study_metrics_calculator.dart:199) changes rounding for non-IELTS tracks but does not implement those exams' assessment models.

**Failure and impact:** IELTS-scale results can be shown under a 10–90 or 0–120 target, and progress screens still assume IELTS. A label or linear scale conversion cannot provide PTE/TOEFL content, integrated task scoring, timing, or validity.

**Remediation:** Gate unsupported exams as clearly unavailable/roadmap, or deliver a complete independently validated slice before enabling selection. Preserve IELTS as the supported capability rather than silently reusing incompatible semantics.

**Acceptance:** Every selectable exam has matching content, timing, score domain, review, and analytics. Unsupported exams cannot create a misleading active preparation plan.

## 6. Flutter state, offline reliability, and data preservation

### TD-37 — Timer behavior is callback-count-based rather than elapsed-time-based

**P1 · Confirmed · Owner: simulator session state**

**Evidence:** [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:298](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:298) and [app/lib/features/reading_sim/presentation/reading_sim_notifier.dart:273](/home/mahdi/projects/ideas/mockza/app/lib/features/reading_sim/presentation/reading_sim_notifier.dart:273) subtract one per timer callback. Speaking and drills use the same family of periodic countdowns. At writing zero, only the timer stops; [app/lib/features/writing_sim/presentation/writing_sim_screen.dart:318](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_screen.dart:318) still permits editing.

**Failure and impact:** Background suspension, browser throttling, or a busy frame loop extends exam time. Restored zero-time drafts can regain recommended time because restoration tests for positive remaining time. Different simulators implement different expiration/submit behavior.

**Remediation:** Store a clock-based deadline or elapsed active duration with explicit study pause rules. Reconcile on resume. Define zero-time transitions centrally in the exam domain and freeze/submit according to the chosen policy. Preserve an expired draft without silently granting time.

**Acceptance:** Advance a fake clock while callbacks are suspended; remaining time remains correct. Zero remains zero across reloads. Study pauses and exam expiration behave consistently and preserve work.

### TD-38 — Route sessions share long-lived providers and device resources

**P1 · Risk with confirmed lifetime mismatch · Owner: Riverpod/session ownership**

**Evidence:** [app/lib/features/speaking_sim/presentation/speaking_sim_providers.dart:5](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_providers.dart:5), [app/lib/features/writing_sim/presentation/writing_sim_providers.dart:5](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_providers.dart:5), and equivalent providers are non-auto-dispose singletons. Cleanup is mainly attached to notifier disposal. [app/lib/features/speaking_sim/presentation/speaking_sim_screen.dart:59](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_screen.dart:59) disposes the text controller, not the session resources. Shared audio gateways are application-level dependencies.

**Failure and impact:** Leaving a route need not dispose its timer, microphone preview/recording, playback, subscriptions, or polling. Opening another simulator can compete for shared audio. A second initialization can race the first and publish stale state. Exit confirmation alone does not establish cleanup.

**Remediation:** Give each route session clear ownership, with explicit finish/leave cleanup or route-scoped providers keyed by session. Coordinate microphone/player exclusivity. Apply request identity checks to asynchronous initialization.

**Acceptance:** Exit every simulator during preparation, recording, playback, and polling. Resources stop or continue only under a documented policy. Reopening creates/resumes the correct session without old callbacks.

### TD-39 — Writing autosave lacks lifecycle guarantees and durable content identity

**P1 · Confirmed · Owner: writing drafts**

**Evidence:** [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:334](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:334) saves after a 500 ms debounce and suppresses storage exceptions. [app/lib/app.dart:49](/home/mahdi/projects/ideas/mockza/app/lib/app.dart:49) handles resume but does not flush active drafts on pause. Draft keys use `draft-<pack>-<taskIndex>` at writing notifier line 261.

**Failure and impact:** Immediate app termination can lose recent text. Save failure is invisible. Reordering tasks or updating pack content can restore a draft against the wrong prompt. Timers are only persisted when text saves, so an untouched draft can restore stale remaining time. Synthetic draft parent attempts can pollute history/streak metrics.

**Remediation:** Persist immutable draft identity using task ID and content version. Save text/timer snapshots through a serialized owner, flush on meaningful lifecycle/exit events, and surface failed persistence. Keep drafts separate from completed study evidence. Platform unload handling cannot guarantee a last asynchronous save, so retain frequent safe checkpoints.

**Acceptance:** Kill/relaunch after edits and task switching; saved text matches the correct prompt/version. Force SQLite failure and show an unsaved warning. Expired/untouched timers restore accurately.

### TD-40 — Cache clearing and retention can destroy recordings still needed by the outbox

**P1 · Confirmed · Owner: cache/retention policy**

**Evidence:** [app/lib/services/cache_cleanup_service.dart:18](/home/mahdi/projects/ideas/mockza/app/lib/services/cache_cleanup_service.dart:18) queries audio using `retention: Duration.zero` and deletes all matching files/rows. [app/lib/services/outbox_sync_service.dart:37](/home/mahdi/projects/ideas/mockza/app/lib/services/outbox_sync_service.dart:37) purges expired audio before dispatch, without excluding unfinished submissions. Missing audio at line 175 removes its outbox item.

**Failure and impact:** “Clear cache” can destroy the only copy of a pending speaking response. A learner offline beyond retention loses queued work before sync is attempted. Completed and pending assets are treated as equally disposable.

**Remediation:** Separate replaceable downloaded content from irreplaceable learner recordings. Pin files referenced by active drafts, pending outbox work, or unfinished evaluation. If policy imposes a hard expiration, warn in advance and offer explicit deletion/export; do not call it ordinary cache cleanup.

**Acceptance:** Queue an offline recording, clear cache, restart, and sync successfully. Retention removes eligible completed media while protecting pending work. Explicit destructive actions name what will be lost.

### TD-41 — Web persistence can silently degrade to memory; recorded blob URLs do not survive reload

**P1 · Confirmed · Owner: web storage/audio**

**Evidence:** [app/lib/data/db/connection_web.dart:24](/home/mahdi/projects/ideas/mockza/app/lib/data/db/connection_web.dart:24) silently opens an in-memory DB if IndexedDB setup fails. [app/lib/services/media_bytes_web.dart:6](/home/mahdi/projects/ideas/mockza/app/lib/services/media_bytes_web.dart:6) reads `blob:` URLs, which are stored as recording paths. [app/lib/services/secure_storage_web.dart:3](/home/mahdi/projects/ideas/mockza/app/lib/services/secure_storage_web.dart:3) stores credential fallback data in localStorage.

**Failure and impact:** The UI can claim local saving while all data disappears on refresh. Persisting a blob URL in SQLite does not persist its bytes. Long-lived web credentials are script-accessible; browser storage eviction, private mode, multiple tabs, and failed writes need explicit behavior.

**Remediation:** Expose a durable-storage capability state and show a clear temporary-session warning. Persist recording bytes in IndexedDB/OPFS with stable IDs before treating them as saved. Bound credential lifetime and review origin/script security. Coordinate database access across supported browser tabs.

**Acceptance:** Reload with pending recorded audio and replay/sync it. Denied/quota-exhausted storage produces an honest visible mode. Multi-tab and eviction tests never silently claim durable saving.

### TD-42 — Outbox retry requires unrelated lifecycle events and drains only one batch

**P1 · Confirmed · Owner: sync scheduling**

**Evidence:** [app/lib/services/outbox_sync_service.dart:31](/home/mahdi/projects/ideas/mockza/app/lib/services/outbox_sync_service.dart:31) processes at most ten ready entries once. [app/lib/app.dart:41](/home/mahdi/projects/ideas/mockza/app/lib/app.dart:41) flushes at startup and line 51 on resume. There is no continuous queue drain, next-retry scheduler, or reconnect trigger in these paths.

**Failure and impact:** The eleventh queued item can remain indefinitely while the app stays open. A failed item whose backoff expires is not automatically retried unless another trigger occurs. Returning online without leaving the app need not send saved work. “Sync automatically” overstates the guarantee.

**Remediation:** Add a bounded foreground drain driven by queue state, next eligible time, and network recovery. Avoid tight loops. Show pending/retry counts and a manual sync action. Native background execution is a separate capability decision; do not promise it unless implemented.

**Acceptance:** More than ten queued actions drain without app restarts. Backoff expiration and reconnection trigger retry. Network loss does not create battery-consuming loops.

### TD-43 — Local submission and outbox changes are not one durable operation; exception handling can delete work

**P1 · Confirmed · Owner: local attempt/outbox repository**

**Evidence:** [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:413](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:413) persists the attempt, removes its draft, then attempts network work before enqueueing an offline action. [app/lib/services/outbox_sync_service.dart:106](/home/mahdi/projects/ideas/mockza/app/lib/services/outbox_sync_service.dart:106) catches any dispatch exception as “invalid payload” and deletes the item. Upload progress is not checkpointed per turn.

**Failure and impact:** Process death between persistence and enqueue leaves accepted local work with no dispatch path. A transient database/programming/transport exception can be misclassified as malformed payload and silently dropped. Retries can repeat successful uploads because their object keys are not saved into the queued payload.

**Remediation:** Transactionally save submission and required dispatch intent before network operations. Separate payload validation failures from retryable execution errors. Quarantine corrupt work with visible recovery, rather than deleting it. Checkpoint per-turn upload success and make replay idempotent.

**Acceptance:** Crash at each submission boundary; restart finds recoverable work. Inject unexpected dispatch errors and retain the item. Partial upload retries reuse confirmed progress.

### TD-44 — Migration correctness is unproven for existing installations

**P1 · Confirmed test gap · Owner: local/database schema**

**Evidence:** [app/lib/data/db/app_database.dart:36](/home/mahdi/projects/ideas/mockza/app/lib/data/db/app_database.dart:36) contains handwritten v1→v2→v3 upgrade paths. Existing app database tests create current-schema databases; there are no committed historical Drift schema fixtures and upgrade validation in the test inventory. Backend migration 0001 also adds a non-null `account_key` without a backfill/default: [backend/packages/db/src/migrations/0001_vengeful_the_santerians.sql:100](/home/mahdi/projects/ideas/mockza/backend/packages/db/src/migrations/0001_vengeful_the_santerians.sql:100).

**Failure and impact:** Clean-install tests cannot prove upgrades preserve old drafts, SRS state, timestamps, foreign keys, or indexes. A backend upgrade with preexisting jobs can fail at the non-null column addition. Fresh deployment success would hide that problem.

**Remediation:** Capture historical schemas and representative user data. Test every supported upgrade path with Drift schema validation and semantic assertions. For populated backend tables, use compatible expand/backfill/constrain migrations and document restart/rollback behavior.

**Acceptance:** Upgrade populated v1/v2 databases to current and preserve learner data. Apply backend migrations to a prior production-shaped snapshot with existing jobs. Re-running supported deployment steps is safe.

### TD-45 — Several production errors are swallowed because tests lack platform plugins

**P2 · Confirmed · Owner: feature/service error handling**

**Evidence:** [app/lib/features/settings/presentation/settings_notifier.dart:209](/home/mahdi/projects/ideas/mockza/app/lib/features/settings/presentation/settings_notifier.dart:209) ignores preference persistence errors with a test-environment comment; theme save has the same pattern. [app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:346](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_notifier.dart:346) ignores draft save errors. Audio initialization/stream errors are also suppressed in listening notifier.

**Failure and impact:** A failed real persistence/plugin operation becomes indistinguishable from success or empty content. The learner can lose settings/work without knowing. Testing limitations have leaked into production semantics.

**Remediation:** Keep fakes at injected boundaries. Propagate typed failures where user recovery matters, log bounded diagnostics, and preserve retryable state. Reserve silent handling for explicitly harmless operations.

**Acceptance:** Simulated disk-full, plugin failure, and preferences write failure show appropriate status and preserve data. Headless tests use explicit fakes rather than relying on swallowed exceptions. Secure-storage write/delete failures must also be returned honestly: [app/lib/services/secure_identity_service.dart:34](/home/mahdi/projects/ideas/mockza/app/lib/services/secure_identity_service.dart:34) currently reports success even when the platform operation fails and only a process-local fallback survives.

### TD-46 — Vocabulary review can race, and content corrections cannot update existing cards

**P2 · Confirmed mechanisms · Owner: SRS repository/review UI**

**Evidence:** [app/lib/features/vocabulary/presentation/vocabulary_notifier.dart:101](/home/mahdi/projects/ideas/mockza/app/lib/features/vocabulary/presentation/vocabulary_notifier.dart:101) has no in-flight guard around rating. [app/lib/data/repositories/vocab_repository.dart:179](/home/mahdi/projects/ideas/mockza/app/lib/data/repositories/vocab_repository.dart:179) creates log IDs from card ID and milliseconds. [app/lib/data/daos/vocab_dao.dart:56](/home/mahdi/projects/ideas/mockza/app/lib/data/daos/vocab_dao.dart:56) imports cards with insert-or-ignore. Mistake capture uses full upserts at vocabulary repository line 211.

**Failure and impact:** Rapid taps can record/advance twice, compute scheduling from the same stale card, or collide on a log ID. A corrected definition/IPA remains stale forever for existing imported cards. Re-saving an existing mistake can reset scheduler fields rather than only updating content.

**Remediation:** Serialize one rating per displayed card and use collision-safe review IDs. Update immutable content metadata separately from learner schedule. Preserve scheduling during imports and repeated captures; use content versions where needed.

**Acceptance:** Double taps create one review and one transition. Corrected content updates without changing due dates. Re-saving a captured card preserves its review history/schedule.

### TD-47 — Attempt pagination has no tie-breaker; metadata and recovery/export are incomplete

**P2 · Confirmed · Owner: local history/data product**

**Evidence:** [app/lib/data/daos/attempt_dao.dart:28](/home/mahdi/projects/ideas/mockza/app/lib/data/daos/attempt_dao.dart:28) pages only by `updatedAt < cursor`, ordered only by that timestamp. [app/lib/features/progress/presentation/progress_attempts_screen.dart:64](/home/mahdi/projects/ideas/mockza/app/lib/features/progress/presentation/progress_attempts_screen.dart:64) passes no ID tie-breaker. Submission paths do not consistently populate stored duration/completion/study-mode fields. Settings has no learner data export/restore or account-linking UI, despite local-only history and account-sync language elsewhere.

**Failure and impact:** Equal-timestamp attempts can be skipped at a page boundary. History and comparisons lose exam conditions. Device loss/browser clearing can erase learner history and SRS state; restoring a purchase is not restoring study data.

**Remediation:** Use a stable composite cursor `(timestamp, attemptId)` and matching order/index. Populate metadata at accepted submission/terminal transitions. State the actual backup/sync guarantee. Prioritize a versioned export/restore format if local-only storage remains the product choice.

**Acceptance:** Paginate many identical timestamps with no gaps/duplicates. Study mode and duration survive review/restart. A documented recovery path preserves both attempts and SRS state, or clearly discloses its absence.

## 7. Release, operations, assurance, and maintenance

### TD-48 — Release flavor mapping does not match app entrypoints or Android variants

**P1 · Confirmed · Owner: release automation**

**Evidence:** [.github/workflows/release.yml:58](/home/mahdi/projects/ideas/mockza/.github/workflows/release.yml:58) constructs `main_glb.dart`/`main_irn.dart`, neither of which exists, then silently falls back to `main_global.dart`. Existing entrypoints are `main_global.dart` and `main_iran.dart`. [app/android/app/build.gradle.kts:37](/home/mahdi/projects/ideas/mockza/app/android/app/build.gradle.kts:37) defines product flavors, but the workflow omits `--flavor` and expects an unflavored bundle path.

**Failure and impact:** Iran tags can compile the global configuration. Android outputs can have different task names/paths from those archived. Required API/billing defines are not part of a validated release matrix. [app/android/app/build.gradle.kts:61](/home/mahdi/projects/ideas/mockza/app/android/app/build.gradle.kts:61) falls back to debug signing when release credentials are absent.

**Remediation:** Map tag edition explicitly to entrypoint, Android flavor, app identifier, signing identity, service endpoints, and expected output path. Fail closed on absent mapping/configuration/signing. Test the same commands used in release.

**Acceptance:** Produce both editions and inspect embedded edition, package ID, endpoints, signatures, and artifact paths. An Iran tag cannot silently produce a global build. Missing release signing fails release.

### TD-49 — Release publication can precede required builds and publishes only checksums

**P1 · Confirmed · Owner: release automation**

**Evidence:** [.github/workflows/release.yml:156](/home/mahdi/projects/ideas/mockza/.github/workflows/release.yml:156) depends on Android and tag validation, not the iOS/backend jobs. It invokes `gh release create` with only `SHA256SUMS.txt`. The iOS job archives `.xcarchive` while naming the artifact unsigned `.ipa`. Backend image tags use the full release tag, which includes `+`; Docker tag syntax does not allow that character.

**Failure and impact:** A release can announce completion without iOS/backend success, omit the binaries described in its notes, and fail image publication for every supported tag shape. Digest files for `.ipa` will not capture an `.xcarchive` directory. Separate moving `latest` tags also obscure edition and rollback identity.

**Remediation:** Normalize OCI-compatible image tags separately from app version tags. Await all required deliverables. Name archives truthfully, package/upload intended distributables, attach their checksums, and record immutable image digests. Use edition-specific moving tags only if needed.

**Acceptance:** A dry-run release produces the expected attached app artifacts and valid image tags/digests for both editions. Any required build failure blocks publication. Every checksum resolves to a delivered file.

### TD-50 — CI/toolchain definitions drift and the OpenAPI parity gate does not establish client parity

**P2 · Confirmed · Owner: CI/contracts**

**Evidence:** [backend/package.json:1](/home/mahdi/projects/ideas/mockza/backend/package.json:1) pins pnpm 12.8.1, also used by the backend Containerfile. [.github/workflows/ci.yml:92](/home/mahdi/projects/ideas/mockza/.github/workflows/ci.yml:92) installs pnpm 9 and Node 22 for a separate gate. The “export OpenAPI” step runs contract tests, followed by a clean-tree check, rather than explicitly regenerating the specification and comparing Flutter DTO behavior.

**Failure and impact:** One job can fail because of toolchain incompatibility while container jobs pass. Conversely, clean git status does not prove Dart parsing matches the wire format; TD-27–30 survive the current gates. Plain Hono routes are not all automatically represented in the OpenAPI registry.

**Remediation:** Use the declared package manager/runtime consistently. Generate and compare the intended OpenAPI artifact explicitly. Inventory undocumented routes. Add shared wire fixtures exercised by both actual server serializers and Dart parsers; generated clients are optional, cross-language compatibility proof is not.

**Acceptance:** One documented toolchain runs locally and in CI. A deliberate enum/field mismatch breaks parity checks. The exported route inventory includes every supported external endpoint.

### TD-51 — Operational recovery and capacity claims lack representative evidence

**P1 · Confirmed repository gap; deployment state unverified · Owner: operations**

**Evidence:** [compose.yaml:41](/home/mahdi/projects/ideas/mockza/compose.yaml:41) configures persistent services and healthchecks; no complete automated database/object-store backup and tested restore workflow is present. [backend/apps/worker/src/index.ts:48](/home/mahdi/projects/ideas/mockza/backend/apps/worker/src/index.ts:48) processes each fetched batch in a sequential loop, even though logs describe a concurrency setting. Healthchecks primarily test liveness. The repository includes a k6 script but no audited production-like capacity result.

**Failure and impact:** Persistent volumes are not backups. A data-loss incident may have no proven recovery procedure. Batch size, DB pool sizes, and the concurrency log do not prove parallel model throughput; a thrown item can affect the rest of a fetched batch depending on pg-boss batch semantics. Queue backlog can grow while all containers appear healthy.

**Remediation:** Define RPO/RTO, backup DB plus media/configuration, encrypt and retain copies, and run restores. Verify pg-boss batching/acknowledgment behavior for the installed version. Measure real worker concurrency, queue age, memory during audio decode, upstream quotas, and graceful shutdown. Scale from measurements, not the configured number.

**Acceptance:** Restore into a clean environment and replay pending jobs without loss/double charge. A representative mixed workload demonstrates the promised latency/throughput and bounded memory. Alerts identify stuck workers and aging jobs.

### TD-52 — Test names overstate integration, concurrency, privacy, and accessibility coverage

**P1 · Confirmed · Owner: engineering assurance**

**Evidence:** [backend/apps/api/src/__tests__/concurrency_and_integration.test.ts:14](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/__tests__/concurrency_and_integration.test.ts:14) tests a local JavaScript counter, not production quota admission. Its app has no DB/queue dependencies, so idempotency and deletion tests do not exercise persistence. [app/test/a11y/accessibility_and_layout_test.dart:280](/home/mahdi/projects/ideas/mockza/app/test/a11y/accessibility_and_layout_test.dart:280) checks RTL direction and one text semantics node, not contrast or full screen-reader interaction. [docs/HARDWARE_VERIFICATION_CHECKLIST.md:89](/home/mahdi/projects/ideas/mockza/docs/HARDWARE_VERIFICATION_CHECKLIST.md:89) records PASSED without reproducible device artifacts in the repository.

**Failure and impact:** Green tests create false confidence at exactly the boundaries with confirmed defects. Existence of `PopScope` does not prove leaving stops recording or saves work. A mock purchase result does not prove vendor fulfillment. Unit tests are useful, but their labels should not imply stronger proof.

**Remediation:** Rename suites to reflect scope. Add the smallest high-value real-boundary tests: PostgreSQL quota/refund races; API→queue→worker→result lifecycle; seeded content→Dart parsing; speaking submit with FK enabled; pending-media preservation; actual release builds. Store device/browser/vendor QA evidence with versions and dates. Add measured accessibility checks and manual assistive-technology testing.

**Acceptance:** Each high-priority debt has a test that fails before its fix. Test reports distinguish unit, service integration, device, and live-model evidence. No unperformed validation is marked passed.

### TD-53 — Documentation, feature flags, dependencies, and architecture labels are inconsistent

**P2 · Confirmed · Owner: architecture/documentation**

**Evidence:** [backend/langgraph.json:1](/home/mahdi/projects/ideas/mockza/backend/langgraph.json:1) and dependencies suggest LangGraph, but [backend/packages/ai/src/graphs/grade-writing.ts:284](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/grade-writing.ts:284) exports a plain object with `invoke`. `SSE_ENABLED` and several vendor/privacy settings are declared without complete behavior. [docs/PDR.md:28](/home/mahdi/projects/ideas/mockza/docs/PDR.md:28) discusses prices different from [app/lib/services/billing_gateway.dart:35](/home/mahdi/projects/ideas/mockza/app/lib/services/billing_gateway.dart:35). Several documents describe shipped capabilities still scaffolded.

**Failure and impact:** Future engineers make changes against an architecture that does not exist. Redundant validators, unused SDKs, flags without effects, placeholder gateways, and large mixed-responsibility screens increase maintenance and obscure true ownership. Dependency presence is not a reason to add a workflow framework.

**Remediation:** Keep the simpler plain evaluator functions if they satisfy requirements; remove unused LangChain/LangGraph surface or implement only the state transitions actually needed. Update specs to separate shipped/planned/verified. Centralize authoritative product limits/pricing and audit every flag's call sites. Extract large widgets only around meaningful state/behavior boundaries.

**Acceptance:** A newcomer can map every documented shipped feature to code and proof. Every retained flag has a tested effect. Removing an unused dependency does not remove behavior.

### TD-54 — Server audio retention is scheduled but not populated or verified

**P0 · Confirmed · Owner: privacy/storage lifecycle**

**Evidence:** [backend/packages/storage/src/purge.ts:84](/home/mahdi/projects/ideas/mockza/backend/packages/storage/src/purge.ts:84) scans `audio_assets`, but current upload/admission paths do not insert audio asset rows. [backend/packages/config/src/env.ts:55](/home/mahdi/projects/ideas/mockza/backend/packages/config/src/env.ts:55) declares a TTL that is not used to register uploads. [backend/packages/storage/src/purge.ts:23](/home/mahdi/projects/ideas/mockza/backend/packages/storage/src/purge.ts:23) ignores per-object `DeleteObjects` errors and counts all requested objects as deleted, then marks tracking rows purged.

**Failure and impact:** The hourly purge can run successfully while retaining every unregistered upload. Orphan/abandoned uploads have no application tracking. Partial S3 failures can be recorded as successful deletion. Local seven-day retention and documented server thirty-day retention need consistent disclosure; essays, transcripts, job input JSON, webhook payloads, telemetry, and backups need their own retention rules.

**Remediation:** Register actual stored objects with owner, immutable input/attempt association, creation time, and expiration. Reconcile orphan uploads or use a verified bucket lifecycle policy where appropriate. Inspect S3 per-object failures and retry only unconfirmed deletion. Define and implement retention for all data classes, including backup expiry.

**Acceptance:** Age real registered and abandoned objects, run maintenance, and verify physical deletion. Inject per-object failures and retain retryable tracking. Published retention wording matches observed storage behavior.

### TD-55 — Web deployment security and cache policy need a production-specific contract

**P2 · Confirmed configuration; deployment exposure unverified · Owner: web/edge**

**Evidence:** [app/nginx.conf:11](/home/mahdi/projects/ideas/mockza/app/nginx.conf:11) sets some useful headers but no complete CSP/framing policy. Its `/assets/` location marks paths immutable for seven days, although not every asset path is content-addressed. [deploy/nginx/mockza.mehtea.ir.conf:1](/home/mahdi/projects/ideas/mockza/deploy/nginx/mockza.mehtea.ir.conf:1) is HTTP-only in the supplied configuration. API CORS is permissive at [backend/apps/api/src/app.ts:39](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/app.ts:39).

**Failure and impact:** Script-accessible long-lived tokens increase the cost of script injection. Cached unversioned assets can conflict with a newly deployed app. HTTP serving breaks security guarantees needed by microphone/credential APIs outside trusted local origins. A separate TLS terminator may exist; this audit did not inspect it, so deployed plaintext exposure is not asserted.

**Remediation:** Document the actual TLS edge, trusted origins, allowed embeds, and Flutter-compatible CSP. Use immutable caching only for versioned assets and deploy app shell/assets coherently. Restrict CORS to the supported browser use cases where useful; CORS is not authentication. Verify Nginx header inheritance on locations with their own `add_header`.

**Acceptance:** Test real HTTPS microphone/storage flows, deployment upgrade caching, relevant response headers, and supported origins. Security settings do not break Flutter WASM or intended media loading.

### TD-56 — Request/resource bounds and error contracts are inconsistent

**P1 · Confirmed · Owner: API boundaries**

**Evidence:** [backend/apps/api/src/routes/uploads.ts:167](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/uploads.ts:167) buffers the full request before checking maximum size. [backend/packages/ai/src/audio/processor.ts:12](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/audio/processor.ts:12) has a separate 15 MB ceiling while configuration permits up to 25 MB. [backend/apps/api/src/routes/evaluate.ts:253](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:253) caps requests at three turns but validates clips individually without an explicit aggregate byte/duration budget. Errors use varying ad hoc codes and there is no common application error handler in [backend/apps/api/src/app.ts:33](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/app.ts:33).

**Failure and impact:** Direct API traffic can allocate more memory than the accepted payload size before rejection. Up to three individually valid clips can still exceed an intended total decode/model budget; the three-turn ceiling also conflicts with a future full question-by-question interview. Different layers disagree about supported sizes. Unexpected JSON/DB/provider errors bypass the documented `{code,message,requestId}` contract and can leak technical details or become unhelpful client retries.

**Remediation:** Bound bodies before buffering, and limit aggregate turn count/bytes/duration and text input consistently. Validate external DTOs at boundaries. Map expected and unexpected failures centrally to stable codes, safe messages, request IDs, and appropriate retryability; keep sensitive diagnostics in controlled logs. Preserve entitlement-required (402) separately from authentication failures; the Dart gateway currently maps both to `UnauthorizedFailure`, which prevents precise recovery guidance.

**Acceptance:** Oversized/chunked bodies and aggregate-over-budget audio requests reject with bounded allocation. Every configured supported size works end to end. Malformed JSON, missing DB, and injected provider failures produce consistent safe error responses.

## 8. Implemented UI/UX review

These comments concern the actual widget/state implementation. Section 12 adds rendered-browser observations and reproduced interactions; it supersedes the initial browser limitation without claiming complete device coverage. Related technical debt IDs identify the underlying behavior, so a cosmetic change does not conceal the defect.

### What should be preserved

- The four primary destinations—Home, Practice, Vocabulary, Progress—form a comprehensible study loop. Keep this stable while fixing correctness.
- Shared colors, typography, shapes, cards, buttons, and status components provide a useful design foundation. Dark and light themes exist; directional spacing is used in many places.
- Review flows connect criteria, evidence, next steps, and mistake-to-deck capture. This is a stronger learning loop than a score-only response when its evidence is real.
- Writing drafts, reading annotations, local objective grading, and SRS are appropriate offline-capable primitives. Their reliability and disclosure need improvement; the concepts are worth keeping.
- Simulators have exit-confirmation hooks. Study-mode replay/pause and exam-mode restrictions show an intentional distinction, although enforcement is incomplete.
- Empty states and explicit “not yet estimated” presentations exist. Prefer extending those honest states over adding synthetic activity or fabricated scores.

### UX-01 — First-run onboarding presents unsupported capabilities and overclaims calibration

**P1 · Confirmed copy/flow issue**

**Evidence:** [app/lib/features/onboarding/presentation/onboarding_screen.dart:79](/home/mahdi/projects/ideas/mockza/app/lib/features/onboarding/presentation/onboarding_screen.dart:79) says “calibrated to official examiner standards,” and offers active PTE/TOEFL choices at line 105. Actual grading validity is not established (TD-24–25), and the corresponding exam systems do not exist (TD-36).

**Recommendation:** Offer supported IELTS tracks clearly. Mark future exams as unavailable with no active setup. Replace calibration claims with accurate AI-estimate wording until held-out human-rated evidence exists. Explain target score/date and whether diagnostic access is one shared free credit. Make skipping the diagnostic explicit.

**Acceptance:** A new user can predict which exam they will practice, what will be evaluated, what needs internet, and whether a credit is consumed before entering a microphone flow.

### UX-02 — Home has useful structure but weak distinction between “estimate,” “coverage,” and “next action”

**P2 · Confirmed information-design concern**

**Evidence:** [app/lib/features/home/presentation/home_screen.dart:140](/home/mahdi/projects/ideas/mockza/app/lib/features/home/presentation/home_screen.dart:140) prioritizes the score hero, four skill cards, and recommendations. Its diagnostic CTA launches speaking directly. Aggregate evidence may cover one skill only (TD-35).

**Recommendation:** Show assessed skills/sample counts beside any overall estimate. Make the primary CTA explicit: continue saved work, review a completed result, or start a specific next task. Explain why a recommendation was chosen, its duration, mode, download status, and credit cost. Avoid making every card equal in visual/action priority.

**Acceptance:** A learner can identify one next action and distinguish missing measurements from a low score without opening several screens.

### UX-03 — Practice mixes quick launch, full mock, catalog packs, and drills with conflicting expectations

**P2 · Confirmed**

**Evidence:** [app/lib/features/practice_hub/presentation/practice_hub_screen.dart:180](/home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/practice_hub_screen.dart:180) contains hardcoded simulator launches, a full-mock banner, dynamic packs, and drills. Track/mode defaults and seed pack selection vary across launch points.

**Recommendation:** Distinguish full validated tests from short practice and targeted drills. Show actual question/section counts and expected time. Route launches through consistent setup with track, study/exam mode, readiness, and credit information. Keep “continue draft” discoverable. Avoid advertising “3 passages/4 sections” for packs that contain fewer.

**Acceptance:** The same pack has the same configuration and description from Home, Practice, and recommendations. Short samples are never mistaken for a complete mock. Micro-drills should state the exact weakness, task, duration, and immediate correction; mismatched or substituted recommendations must be disclosed (TD-29).

### UX-04 — Download badges currently communicate a guarantee the app cannot deliver

**P1 · Confirmed**

**Evidence:** [app/lib/services/content_sync_service.dart:124](/home/mahdi/projects/ideas/mockza/app/lib/services/content_sync_service.dart:124) saves JSON before nonpersistent media warm-up. Practice displays cached/offline state based on that content. TD-32 describes the underlying defect.

**Recommendation:** Use distinct states: available online, downloading, verifying, ready offline, incomplete, update available, and failed. Show bytes/progress and retry/cancel where useful. Do not show a complete download badge until all required assets are durable and verified.

**Acceptance:** An offline-ready pack works after restart with network disabled. A failed media download produces a recoverable incomplete state rather than a misleading success badge.

### UX-05 — Speaking needs a trustworthy preflight and explicit recording/session states

**P1 · Confirmed workflow concerns; device ergonomics unverified**

**Evidence:** [app/lib/features/speaking_sim/presentation/speaking_sim_screen.dart:595](/home/mahdi/projects/ideas/mockza/app/lib/features/speaking_sim/presentation/speaking_sim_screen.dart:595) includes mic preview and permission controls. The implementation spans preparation, live recording, playback, re-recording, upload, and evaluation across one screen.

**Recommendation:** Clearly label permission denied versus unsupported microphone versus device failure. Explain what leaves the device before recording/upload, and how long audio is retained. Keep one dominant action per state: test mic, start preparation, start response, stop, next turn, submit. Expose recorded/required turn coverage and upload recovery. Do not present a waveform alone as proof of an intelligible recording.

**Acceptance:** On actual devices, test denied/permanently denied permission, absent input, quiet/clipped audio, Bluetooth/headset changes, interruptions, and route exit. The learner always knows whether the microphone is active and whether work is safely saved.

### UX-06 — Writing's timer, task model, and save indicator can mislead learners

**P1 · Confirmed**

**Evidence:** [app/lib/features/writing_sim/presentation/writing_sim_screen.dart:190](/home/mahdi/projects/ideas/mockza/app/lib/features/writing_sim/presentation/writing_sim_screen.dart:190) shows a timer; the editor at line 318 stays editable after expiry. The notifier saves per-task drafts and submits one active task, while the planner advertises Tasks 1 & 2.

**Recommendation:** Define whether exam mode uses one 60-minute Writing budget or enforced per-task budgets. Present Task 1/2 completion separately and show the submission scope. Use save states such as saving/saved/failed, including timestamp, instead of optimistic static copy. Keep prompt/chart visible or readily recoverable while typing. Show minimum-word guidance without implying longer automatically means better.

**Acceptance:** Keyboard, task switching, expiry, backgrounding, and failed autosave preserve text and present accurate state. The learner cannot mistake a Task 2-only result for combined Writing performance.

### UX-07 — Listening exam mode can have no usable start action

**P1 · Confirmed**

**Evidence:** [app/lib/theme/components/audio_player_bar.dart:138](/home/mahdi/projects/ideas/mockza/app/lib/theme/components/audio_player_bar.dart:138) hides play/pause in exam mode. [app/lib/features/listening_sim/presentation/listening_sim_notifier.dart:296](/home/mahdi/projects/ideas/mockza/app/lib/features/listening_sim/presentation/listening_sim_notifier.dart:296) loads audio but does not start it automatically.

**Recommendation:** Provide an explicit “Start listening test” gesture after readiness/pre-reading. Then enforce the intended replay/seek policy. Browser autoplay restrictions make a user gesture especially important. Make loading, decode failure, retry, audio-ended, and network loss visible. Define whether a failed audio start pauses exam timing.

**Acceptance:** A fresh exam-mode listening session can start on supported browsers and native devices. It never consumes test time silently while audio is unavailable.

### UX-08 — Reading question navigation and evidence need stronger continuity

**P2 · Confirmed implementation concern; usability testing required**

**Evidence:** [app/lib/features/reading_sim/presentation/reading_sim_screen.dart:175](/home/mahdi/projects/ideas/mockza/app/lib/features/reading_sim/presentation/reading_sim_screen.dart:175) combines timed passage/questions tabs with question navigation. Evidence navigation selects a paragraph through [app/lib/features/reading_sim/presentation/reading_sim_notifier.dart:409](/home/mahdi/projects/ideas/mockza/app/lib/features/reading_sim/presentation/reading_sim_notifier.dart:409). Heading answer semantics are broken (TD-28).

**Recommendation:** Preserve passage/question scroll positions and focus across tab switches. A question-number selection should scroll to and announce the actual target, not only change a numeric highlight. Evidence links should scroll to the precise quote with enough surrounding context. Make answered, unanswered, current, and flagged states distinguishable without color alone. Consider a side-by-side reading/question layout only where available width supports it.

**Acceptance:** Users can move from a missed question to evidence and back without losing their place. Keyboard and screen-reader focus follows the intended target. Long passages remain readable at large text sizes.

### UX-09 — Full mock planner conflates launched and completed stages

**P1 · Confirmed**

**Evidence:** [app/lib/features/practice_hub/presentation/full_mock_screen.dart:108](/home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/full_mock_screen.dart:108) says “Sections Completed” for the launched-skill set.

**Recommendation:** Until TD-34 is fixed, keep the planner wording already used by its Practice CTA and label stages accurately inside the screen. With persistence, distinguish not started, in progress, submitted, awaiting AI, completed, and failed. Explain break/order rules and show a resume action. A mixed partial aggregate should not look like an official full mock result.

**Acceptance:** Opening/canceling a section never increases completed count. Every completed marker links to its actual accepted submission/result.

### UX-10 — Review offers strong learning content but has excessive density and uncertain evidence

**P2 · Confirmed structural concern**

**Evidence:** [app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart:330](/home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart:330) exposes overview, criteria/questions, rewrite/transcript/key, and comparison flows. [app/lib/theme/components/annotated_text.dart:79](/home/mahdi/projects/ideas/mockza/app/lib/theme/components/annotated_text.dart:79) clamps/sorts offsets but does not resolve overlapping edits; inline `WidgetSpan` highlights can fragment long text.

**Recommendation:** Prioritize one or two actionable weaknesses with grounded examples, then progressive detail. Keep original, suggested correction, reason, and criterion together. Provide an accessible correction list alongside inline highlights. Label generic rewrites as examples, not proof of likely score improvement. Show assessment scope/model provenance and uncertainty. Validate overlap and original-text matching before rendering annotations.

**Acceptance:** A learner can explain what to practice next and find the cited evidence. Overlapping/invalid annotations never duplicate or corrupt displayed text. Screen readers can access the same correction content.

### UX-11 — Pending, failed, offline, and quota states need distinct recovery actions

**P1 · Confirmed**

**Evidence:** [app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart:350](/home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart:350) uses status banners and retry/check actions. TD-13–17 and TD-42 describe behavior that can leave those actions ineffective. Some user-facing errors include raw exception/network text.

**Recommendation:** Distinguish saved locally, waiting for upload, uploading, queued remotely, processing, temporarily unavailable, terminal failure, and insufficient entitlement. Show whether work is safe and whether a credit was consumed/refunded. Use “check status,” “sync now,” and “retry evaluation” only for their actual operations. Translate technical errors into short recovery guidance while retaining a support/request ID.

**Acceptance:** Every failure has an action that changes the state or clearly explains the external requirement. No indefinite spinner substitutes for an unresolved backend state.

### UX-12 — Progress visualizations can imply learning gains without comparable evidence

**P1 · Confirmed data semantics; visual legibility unverified**

**Evidence:** [app/lib/features/progress/presentation/progress_screen.dart:48](/home/mahdi/projects/ideas/mockza/app/lib/features/progress/presentation/progress_screen.dart:48) filters on updated times, and [app/lib/theme/components/trend_chart.dart:159](/home/mahdi/projects/ideas/mockza/app/lib/theme/components/trend_chart.dart:159) spaces points evenly by index rather than elapsed date. Its default minimum is 4.0 and values are clamped, so lower bands can share the same plotted floor. Skill analytics averages a bounded recent sample.

**Recommendation:** Label charts as attempts versus time; use date spacing if claiming a time trend. Include sample size, assessed skill coverage, mode, and eligibility. Avoid treating repeated attempts on the same known passage as independent proof of exam readiness. Show partial-test accuracy separately. Explain “this month” precisely and avoid a gain badge when the baseline isn't comparable.

**Acceptance:** Irregular dates and mixed skill/mode fixtures produce honest labels and summaries. Long histories are not silently truncated under “ALL.”

### UX-13 — Vocabulary needs interaction safety and an honest learning model

**P2 · Confirmed**

**Evidence:** [app/lib/theme/components/vocab_flip_card.dart:139](/home/mahdi/projects/ideas/mockza/app/lib/theme/components/vocab_flip_card.dart:139) offers tap-to-reveal and rating buttons. [app/lib/features/vocabulary/presentation/vocab_review_screen.dart:117](/home/mahdi/projects/ideas/mockza/app/lib/features/vocabulary/presentation/vocab_review_screen.dart:117) connects reveal/rating to the notifier. Pronunciation is only available if a callback is supplied.

**Recommendation:** Disable rating while its write is pending, announce the next card, and make rating meanings/next interval clear. Offer keyboard controls and consider a narrowly scoped undo for accidental ratings. Do not show a sound affordance unless pronunciation works. Distinguish due study from review-ahead and explain whether early review changes scheduling. Saving full exam answer phrases as vocabulary should preserve useful context and avoid misleading “definitions.”

**Acceptance:** Fast taps do not skip cards. Keyboard and assistive technology can reveal and rate. Empty, finished, failed-write, and review-ahead states are understandable.

### UX-14 — Paywall promises and platform availability are inconsistent

**P1 · Confirmed**

**Evidence:** [app/lib/services/billing_gateway.dart:35](/home/mahdi/projects/ideas/mockza/app/lib/services/billing_gateway.dart:35) includes “unlimited” package descriptions while [app/lib/features/paywall/presentation/paywall_screen.dart:161](/home/mahdi/projects/ideas/mockza/app/lib/features/paywall/presentation/paywall_screen.dart:161) states 10+10 daily and 150 monthly limits. The same screen promises full offline packs and “official objective tests.” Web purchase is disabled, while automatic account synchronization is promised. Iran billing returns errors/false in [app/lib/services/billing_gateway.dart:207](/home/mahdi/projects/ideas/mockza/app/lib/services/billing_gateway.dart:207).

**Recommendation:** Use one accurate allowance statement throughout. Show only purchasable offers with vendor-localized price and period; do not present fallback prices as live offers. Explain refresh/reset policy and billing availability before selection. Add working privacy/terms links and supported subscription-management guidance; current terms notice is plain text. Never imply an original practice bank is official licensed test content.

**Acceptance:** A user understands total price, recurrence, limits, supported platform, and how to cancel/restore before purchase. Sandbox checkout unlocks backend access, or the UI shows recoverable pending fulfillment.

### UX-15 — Settings mixes harmless cache maintenance with destructive account/data actions

**P1 · Confirmed**

**Evidence:** [app/lib/features/settings/presentation/settings_notifier.dart:318](/home/mahdi/projects/ideas/mockza/app/lib/features/settings/presentation/settings_notifier.dart:318) performs a combined wipe; [app/lib/services/cache_cleanup_service.dart:18](/home/mahdi/projects/ideas/mockza/app/lib/services/cache_cleanup_service.dart:18) deletes learner audio during cache clearing.

**Recommendation:** Separate downloaded-pack cleanup, local reset, and remote account deletion. Explain the exact scope, including queued recordings and SRS/history. Provide pending/partial deletion status and a way to finish it. Make account/device identity meaningful to users rather than relying on a raw internal ID. Expose recovery/export and subscription management when supported.

**Acceptance:** A learner can choose cache cleanup without risking unuploaded responses. Destructive confirmation states actual irreversible loss and never reports unconfirmed remote erasure as complete.

### UX-16 — Accessibility coverage is partial despite useful shared foundations

**P1 · Confirmed gaps; full conformance unverified**

**Evidence:** [app/lib/features/onboarding/presentation/onboarding_screen.dart:157](/home/mahdi/projects/ideas/mockza/app/lib/features/onboarding/presentation/onboarding_screen.dart:157) wraps a gesture detector with a button label but omits selected state. Several icon-only navigation controls lack tooltips/semantic labels. [app/lib/theme/components/audio_player_bar.dart:138](/home/mahdi/projects/ideas/mockza/app/lib/theme/components/audio_player_bar.dart:138) uses unlabeled play/pause icons. Chart and score components already have some semantics; those should be preserved. Existing accessibility tests are limited (TD-52).

**Recommendation:** Give every action an accessible name, role, selected/disabled/busy state, keyboard focus, and activation behavior. Prefer native controls for selectable cards/chips. Announce meaningful state changes without reading every timer tick. Provide textual equivalents for chart/waveform/annotation information. Verify minimum target sizes, contrast, focus visibility, text scaling, RTL, reading order, and error focus using real flows.

**Acceptance:** Complete onboarding, a simulator, review, vocabulary, paywall, and deletion with keyboard and TalkBack/VoiceOver. Run Flutter accessibility guidelines and manual contrast checks in both themes with representative populated content.

### UX-17 — Responsive layout needs task-specific treatment beyond preventing overflow

**P2 · Risk based on implementation; rendered review required**

**Evidence:** [app/test/a11y/accessibility_and_layout_test.dart:20](/home/mahdi/projects/ideas/mockza/app/test/a11y/accessibility_and_layout_test.dart:20) tests Home/Practice at a few sizes and 2× text; it does not cover populated review/paywall/simulator states. Many screens use fixed rows and phone-style stacked layouts. Review filters and paywall allowance headings are particular large-text candidates.

**Recommendation:** Test narrow width, landscape, split screen, keyboard-visible height, and large fonts. Use available constraints to wrap controls and bound reading width. On wider screens, consider two-pane reading/writing layouts and adaptive primary navigation only where they improve the task. Avoid stretching single-column cards across an entire desktop viewport.

**Acceptance:** Populated screens with long titles, translated labels, real errors, and keyboard open remain usable. Measure overflow and reading ergonomics; do not infer desktop quality from phone test success.

### UX-18 — Localization and the Iran edition are incomplete product experiences

**P1 · Confirmed**

**Evidence:** [app/lib/l10n/app_fa.arb:1](/home/mahdi/projects/ideas/mockza/app/lib/l10n/app_fa.arb:1) and English ARB contain only a small fraction of UI strings. Most feature screens hardcode English. [app/lib/app.dart:73](/home/mahdi/projects/ideas/mockza/app/lib/app.dart:73) declares supported locales but does not enforce an edition locale. Iran billing is scaffolded (TD-10/UX-14), and Iranian identity/payment/calendar requirements are not end-to-end features.

**Recommendation:** Move all user-visible text, errors, semantics, plurals, dates, and currency into localization. Define which parts of an English exam remain LTR inside Persian UI. Decide product naming, local numerals/date display, payment support, and regional endpoints together. RTL direction alone is not a translated product.

**Acceptance:** Run core flows entirely in Persian, including permission errors, paywall, offline states, and deletion. Verify mixed Persian/English prompts, numbers, and screen-reader order. Edition build tests prove intended services and branding.

### UX-19 — Reduced motion and interaction feedback are inconsistently applied

**P2 · Confirmed source inconsistency; sensory impact unverified**

**Evidence:** [app/lib/theme/app_motion.dart:52](/home/mahdi/projects/ideas/mockza/app/lib/theme/app_motion.dart:52) provides a reduced-motion-aware resolver, while onboarding uses `AppMotion.standard` directly at [app/lib/features/onboarding/presentation/onboarding_screen.dart:30](/home/mahdi/projects/ideas/mockza/app/lib/features/onboarding/presentation/onboarding_screen.dart:30) and line 163. Shared custom controls and charts use differing selection/animation patterns.

**Recommendation:** Resolve motion through context consistently. Keep visible pressed/focused/selected/busy feedback across cards, chips, ratings, and downloads. Use haptics sparingly for meaningful native actions if they improve the experience; do not introduce vibration merely for parity with a design document.

**Acceptance:** System reduced motion removes nonessential transitions. Keyboard and touch users can tell which action is active and whether a write/upload is in progress without relying on animation alone.

### UX-20 — Trust language and technical jargon appear in learner-facing copy

**P2 · Confirmed**

**Evidence:** Practice empty-state copy names “Mockza API,” PostgreSQL-sourced content, or audio/chart packs, while paywall/onboarding use “official” and “calibrated” language. [app/lib/features/practice_hub/presentation/practice_hub_screen.dart:313](/home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/practice_hub_screen.dart:313) exposes infrastructure terminology rather than an actionable study state.

**Recommendation:** Say “Connect to download practice tests” rather than explaining storage implementation. Reserve model/rubric provenance for useful detail views. Keep “estimated,” “practice,” “partial,” and “saved” precise. Align every marketing promise with a demonstrably shipped capability and the independence disclaimer.

**Acceptance:** A nontechnical learner understands empty/error states and the limits of the assessment. Product copy does not claim legal affiliation, scoring validity, durable saving, or offline readiness without evidence.

## 9. Additional privacy, infrastructure, and explanation concerns

### TD-57 — Privacy disclosures contain unsupported claims and placeholder policy URLs

**P1 · Confirmed document/code mismatch; legal classification needs qualified review · Owner: product/privacy**

**Evidence:** [docs/compliance/google_play_data_safety.md:9](/home/mahdi/projects/ideas/mockza/docs/compliance/google_play_data_safety.md:9) asserts TLS 1.3 everywhere, a functional external deletion form, and thirty-day automatic purge. Policy/deletion URLs use `mockza.example.com`. TD-09, TD-54, and TD-55 show the guarantees are not established. [backend/packages/ai/src/models/openrouter.ts:75](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/models/openrouter.ts:75) sets `provider.data_collection = 'deny'`; that request setting alone is not proof of all contractual retention, training, residency, logging, and subprocessors' behavior.

**Failure and impact:** Store submissions and learner consent can misdescribe transmission and retention of audio, essays, transcripts, identifiers, diagnostics, and purchases. Calling data “anonymous” does not make persistent device/account identifiers anonymous. A region enum does not enforce data residency. The code's PII regexes cannot prove removal of all personal information from free text.

**Remediation:** Inventory real data flows, destinations, access, retention, and deletion. Publish actual policy/support/deletion pages. Verify vendor terms and routing guarantees for each deployed region/model. Align consent, store forms, privacy manifest, and code behavior after implementation. Obtain qualified privacy review for applicable markets rather than treating a source audit as legal certification.

**Acceptance:** Every disclosure maps to a deployed behavior or vendor commitment with evidence. Placeholder domains are removed. A real deletion request and retention exercise validate the published wording.

### TD-58 — “Private bucket” and network isolation are not sufficient evidence of storage authorization

**P1 · Risk · Owner: infrastructure/storage**

**Evidence:** [compose.yaml:90](/home/mahdi/projects/ideas/mockza/compose.yaml:90) launches SeaweedFS with `server -s3` but no explicit S3 identity/authorization configuration is mounted in the supplied Compose service. [backend/packages/storage/src/buckets.ts:8](/home/mahdi/projects/ideas/mockza/backend/packages/storage/src/buckets.ts:8) creates buckets and permissive CORS, but does not establish a private/public access policy. S3 ports are loopback-bound; API/web ports are exposed on all interfaces.

**Failure and impact:** Naming a bucket `*-private` and passing client credentials does not demonstrate that the server rejects unauthenticated reads/writes. Loopback/network isolation helps, but a later port/proxy change can expose an assumption. This audit did not issue live anonymous storage requests, so unauthorized storage access is a risk requiring verification, not a claimed reproduced exploit.

**Remediation:** Explicitly configure storage identities and least-privilege permissions for audio versus published media. Keep internal S3/control ports isolated and validate firewall/proxy paths. Prefer the API/presigned transport already intended by the architecture. Verify policies against the actual SeaweedFS version.

**Acceptance:** Anonymous list/read/write to audio storage fails through every reachable path. Authorized signed operations work. Public media access cannot be used to read user audio. A deployment check detects accidental exposure.

### TD-59 — Shared explanation caching stores personalized answers and fabricated fallback rationale

**P1 · Confirmed · Owner: question explanation API/AI**

**Evidence:** [backend/apps/api/src/routes/evaluate.ts:394](/home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/evaluate.ts:394) caches by question ID and caller-supplied pack version, but [backend/packages/ai/src/graphs/explain-question.ts:44](/home/mahdi/projects/ideas/mockza/backend/packages/ai/src/graphs/explain-question.ts:44) includes the learner's answer in the generated rationale. The next learner receives the same cached response. The graph's missing-key/error fallbacks assert that the submitted answer is wrong, sometimes citing an invented paragraph, without establishing correctness.

**Failure and impact:** Learner A's wrong-answer explanation can be shown to learner B, even when B chose a different or correct answer. Free-form answer text can cross learner boundaries through the shared cache. Missing question/version validation can generate/cache explanations without an authoritative published question. Failed generation can permanently seed a shared fabricated rationale.

**Remediation:** Separate a versioned, question-generic explanation cache from learner-specific diagnosis. Validate the authoritative question and pack version before cache lookup/generation. Never cache fallback errors as grounded explanations. If personalization is retained, keep it private and keyed by the relevant answer/input without exposing one learner's text to another.

**Acceptance:** Two learners with different answers receive appropriate feedback without cross-user text. Correct answers are not labeled wrong by fallback. Unknown/stale question versions fail safely. Provider failure cannot poison the shared cache.

### TD-60 — Settings does not observe onboarding changes, and profile initialization can create a placeholder identity

**P2 · Browser-observed inconsistency; initialization mechanism confirmed in source · Owner: profile bootstrap/settings state**

**Evidence:** A fresh browser session completed onboarding at Band 7.5; Home and review showed 7.5, while opening Settings showed 7.0 and `mockza-local-user`. [settings_notifier.dart:138](/home/mahdi/projects/ideas/mockza/app/lib/features/settings/presentation/settings_notifier.dart:138) hydrates its long-lived state once rather than observing profile changes. [profile_repository.dart:95](/home/mahdi/projects/ideas/mockza/app/lib/data/repositories/profile_repository.dart:95) creates a primary profile using a placeholder ID if none exists. The app reads Settings for theme during build, while identity bootstrap runs after the first frame.

**Failure and impact:** Settings can contradict the learner's chosen goal until state is reloaded, and an initialization race can make the placeholder profile the durable local identity. Showing that value as the pseudonymous device identifier is inconsistent with the secure UUID used for API requests. A browser reload restored the displayed target to 7.5, supporting the stale-hydration diagnosis. A settings change can then apply against stale preferences or an unintended profile.

**Remediation:** Give profile initialization one owner after secure identity resolution. Observe the persisted primary profile in Settings rather than copying it once. Keep local primary profile and API device identity aligned, with an explicit migration for existing placeholder rows that preserves learner data.

**Acceptance:** Fresh startup creates exactly one intended primary profile. Onboarding immediately updates Home, Settings, and review to the same goal. Reload, theme change, and delayed storage/auth bootstrap cannot recreate placeholder profiles or overwrite newer preferences.

### TD-61 — SRS button intervals do not match the scheduler's actual output

**P2 · Display reproduced in browser; scheduling mismatch confirmed in source · Owner: SRS scheduling/UI contract**

**Evidence:** The first review card displayed `Again 1m`, `Hard 1d`, `Good 1d`, and `Easy 4d`. [sm2_scheduler.dart:94](/home/mahdi/projects/ideas/mockza/app/lib/core/vocab/sm2_scheduler.dart:94) schedules failed recall for the following day. Its successful first repetition is also one day for every passing grade. The independent preview calculations at [sm2_scheduler.dart:121](/home/mahdi/projects/ideas/mockza/app/lib/core/vocab/sm2_scheduler.dart:121) advertise minute relearning and an Easy bonus that `schedule()` does not implement.

**Failure and impact:** Learners choose ratings based on promised intervals that are not honored. `Again` does not create the advertised minute-based relearning step, and the frozen session advances without reinserting that card. Hard/Easy previews can also diverge on later repetitions because they use formulas different from the scheduling function.

**Remediation:** Calculate preview labels from the actual scheduling result for each quality and the same clock/state. Either implement deliberately scoped intraday relearning with durable due instants, or remove minute promises and explain the day-based algorithm. Do not keep two independent interval algorithms.

**Acceptance:** For every supported quality and representative old/new card state, the displayed preview equals the persisted next review interval. Minute labels appear only when minute-based relearning is actually scheduled and delivered across reloads.

## 10. Product and architecture decisions that need explicit ownership

These are concerns about choices, not demands to add frameworks or speculative features. Resolve the policy before expanding implementation. The narrowest correct implementation should follow the decision.

### DEC-01 — Assessment validity is the primary product dependency

The paid differentiator is trustworthy diagnosis, not successful JSON generation. The current benchmark and fallback design undermine that differentiator. Specify what a band estimate means, the population and accents it was validated on, acceptable criterion error, known limitations, and how users contest an assessment. Independent human-rated evidence must precede “calibrated” claims. Do not display false acoustic precision or sell confidence unsupported by audio analysis.

**Suggested decision:** Prioritize one reliable IELTS assessment slice with honest uncertainty before adding more exam labels, models, or evaluation graphs. Keep test doubles explicit and out of paid assessment paths.

### DEC-02 — Define “offline-first” as concrete capabilities

Text caching, durable learner work, offline audio/media, delayed AI submission, and background sync are different capabilities. Current marketing blends them. Decide which work must survive app kill, browser refresh, seven days offline, and device replacement. A mandatory first content sync also means first installation is not offline-ready; no bundled starter bank is currently wired through `pubspec.yaml`.

**Suggested decision:** Guarantee local work preservation and explicit foreground sync first. Advertise downloaded offline tests only after verified durable assets exist. Treat cross-device backup and OS background work as separately scoped commitments.

### DEC-03 — One identity model must own billing, quotas, deletion, and recovery

Device IDs currently serve as account identity, bearer fallback, quota key, storage path, diagnostic boundary, and RevenueCat resolver. Linked users partly change that meaning. A restore-purchases button cannot reconcile all these identities.

**Suggested decision:** Write a small identity lifecycle specification: anonymous registration, credential recovery, provider linking, multiple devices, entitlements, quota migration, logout, local reset, and full erasure. Keep device and person/account ownership distinct. Resolve free-diagnostic abuse and purchase recovery within that model rather than adding isolated guards.

### DEC-04 — Original content needs educational QA, not trademark scanning alone

A banned-name regex does not prove originality, licensing rights, correct answer keys, fair distractors, CEFR/exam difficulty, or realistic audio. Some seed packs are short excerpts but appear behind full-test actions. Static `humanQaReviewed` flags provide no reviewer or versioned sign-off record.

**Suggested decision:** Establish content provenance, author/reviewer records, answer-key verification, question-type coverage, exam blueprint validation, listening audio/script alignment, and withdrawal/correction procedure. Keep factual passage claims and licensing attributions reviewable. Separate practice excerpts from full mocks in data and UI.

### DEC-05 — Keep the current architecture where it earns its cost

Flutter/Riverpod/Drift and Hono/Postgres/pg-boss/S3 are a reasonable small-team stack. Postgres-backed jobs can avoid another queue service. The main problem is inconsistent ownership and unimplemented invariants, not absence of another framework. A separate LangGraph layer, generic workflow engine, or extra repository abstraction will not automatically fix transactional admission or grading truthfulness.

**Suggested decision:** Keep domain calculations pure, local repositories responsible for durable local transitions, database transactions responsible for admission/accounting, and workers responsible for idempotent execution. Consolidate competing contracts/validators. Remove unused frameworks/flags before expanding abstractions. Retain the existing injected device gateways because they already serve real platform/testing boundaries.

### DEC-06 — Subscription economics need measured cost and truthful limits

Weekly/monthly/quarterly offers, daily per-skill limits, a combined monthly ceiling, one diagnostic, retries, explanations, and multi-turn audio create different cost patterns. “Unlimited” copy conflicts with actual limits. Device-based entitlement resolution and quota races further distort economics. Upstream model identifiers, prices, audio capability, and availability can change independently of a registry constant.

**Suggested decision:** Measure actual token/audio cost per successful evaluation, include retries/failures/explanations, then set sustainable limits with clear reset/period rules. Verify the currently selected models' capabilities and provider availability before release. Do not infer cost from a benchmark that uses deterministic fallback.

### DEC-07 — Regional editions require a deployment and product boundary, not just a flag

Global and Iran currently share much code, which is useful. But payment providers, distribution/signing, identity, branding, localization, currency/calendar, connectivity, vendor routing, support, and privacy commitments remain distinct requirements. Both default edition configurations enable telemetry; the adapter targets `/v1/events`, which is not registered by the current API, and has no complete event-ingestion/consent flow. Enabling a flag is not evidence that these services exist or are appropriate for a region.

**Suggested decision:** Maintain one shared core with an explicit tested capability matrix per edition. Disable unavailable functions rather than showing a nonfunctional adapter. Make region-specific vendor/payment/legal choices explicit and verify them outside source inspection.

### DEC-08 — Analytics should guide learning without gamifying corrupted evidence

Lifetime means, changing skill mix, repeated familiar passages, partial packs, and result-update timestamps can make streaks and apparent score gains look better without measuring readiness. Rounding to a half band does not establish validity. Using a UTC serial day is deterministic, but may conflict with a learner's local-day expectations around midnight or travel.

**Suggested decision:** Define study-day/timezone policy, comparable attempt eligibility, coverage thresholds, trend windows, and confidence messaging. Make repeated practice useful without treating every retry as an independent full-test measurement. Prefer honest progress summaries over visually satisfying but unsupported numbers.

## 11. Remediation sequence and completion evidence

Avoid attempting every item in one refactor. Preserve current working behavior while correcting the responsible boundary.

1. **Contain trust failures:** TD-01–05, TD-09–10, TD-23–24, and TD-54. Stop forged identities, unauthorized results, false erasure, unreliable fulfillment, and fabricated assessment. Validate production configuration. Temporary feature unavailability is preferable to returning a false success.
2. **Preserve learner work:** TD-18–22, TD-37–43. Persist before transport, protect pending media, define timer/session ownership, and make recovery visible. Add narrowly targeted failure/crash tests before broad UI cleanup.
3. **Make admission/execution/accounting consistent:** TD-06 and TD-11–17. Use protected transitions and durable dispatch; implement real retry and result ownership. Verify with actual PostgreSQL and pg-boss fault injection.
4. **Repair published learning content and scores:** TD-27–36, TD-46–47, TD-59–61. Round-trip every seed/admin payload through the client, fix answer semantics, distinguish full versus partial tests, and make analytics comparable.
5. **Prove release and privacy operations:** TD-44 and TD-48–58. Build actual edition artifacts, test upgrades/restores/retention, align disclosures, and record operational proof.
6. **Complete UX/accessibility/localization:** UX-01–20. Behavior and truthful state messaging come first; visual refinement follows rendered browser/device testing.

### Minimum release evidence matrix

| Boundary | Required proof | Current audit result |
| --- | --- | --- |
| Authentication/authorization | Negative JWT/provider/re-registration/ownership tests, including SSE | Source defects confirmed; deployed exploit tests not run |
| Quotas | Real DB admission/refund/commit races at all boundaries | Existing simulated counter test is insufficient |
| Job lifecycle | API→DB→queue→worker→result with injected crashes and retries | Current unit/fallback tests do not establish it; browser checks did not invoke paid AI |
| Speaking persistence | Fresh FK-enforced submit, partial uploads, restart, all-turn coverage | Parent ordering and partial/first-turn defects confirmed in source; recording permission screen inspected, recording not exercised |
| Offline/media | Download→network off→restart→play/review/sync | Durable media/recording gaps confirmed |
| Writing/timers | Edit/task-switch/background/expiry/relaunch/storage failure | Lifecycle/time invariants incomplete |
| Content | Every seed/admin type through wire serializer and Dart parser/scorer | Multiple mismatches confirmed; wrong heading and drill grading reproduced in browser |
| Scoring | Held-out human-rated writing/audio; evidence grounding and subgroup review | Existing calibration gate is not valid proof |
| Billing | Real sandbox purchase/restore plus webhook/reconciliation failures | Identity/event defects confirmed; vendor flow unverified |
| Migration/history | Populated old schema upgrades; tied pagination; accurate metadata | Coverage gaps and pagination defect confirmed; browser reload retained the onboarding goal, while Settings initially showed stale state |
| Accessibility/UI | Populated screens, keyboard, TalkBack/VoiceOver, contrast, large text, RTL | Source/tests plus browser follow-up in Section 12; physical assistive-technology/contrast/large-text review remains open |
| Release | Both editions, signed intended artifacts, valid OCI tags, correct attached checksums | Workflow defects confirmed; builds not run |
| Operations/privacy | Tested restore, real object purge, partial-delete retries, actual policy pages | Source/document gaps confirmed; infrastructure unverified |

### Suggested tracking fields

When converting a debt into work, retain its ID, priority, evidence, owner, chosen behavior, migration/rollback implications, acceptance tests, and proof link. Close a finding only when its failure path is corrected and its acceptance condition is demonstrated. Preserve unresolved product decisions separately from engineering implementation tasks.

This report is a source-and-browser audit snapshot, not a guarantee that every possible defect has been found. New runtime evidence may change priorities or invalidate a conditional risk. Recheck cited code before implementing fixes against later revisions.

## 12. Rendered-browser follow-up after host repair

### Environment and scope

The AppArmor issue was repaired by the user. Browser automation subsequently opened the running Flutter web app successfully on 2026-11-16. This section replaces the initial inability to inspect the rendered UI; it does not turn source-only security or native-device findings into runtime-verified claims.

- Used a separate incognito review tab and a new local origin. Reviewed at **393×852**, **320×640**, and **1280×800 CSS pixels**. These viewport sizes do not emulate a physical mobile browser, keyboard, microphone, or screen reader.
- The existing static server on port 45280 returned 501 for `POST /v1/auth/anonymous` and 404 for API GETs. A temporary loopback proxy on port 45282 forwarded `/v1/` to the already-running API on 45281 and other paths to 45280. Afterward registration returned 201 and catalog, quota, drills, vocabulary, exam, and media requests returned successful responses. This is a local review setup issue, not proof that the repository's production Nginx proxy is broken.
- Completed onboarding without its optional diagnostic. Used one locally scored reading submission and one immediate drill answer. No paid AI evaluation, purchase, recording upload, account deletion, or changes to existing learner accounts were performed. The normal anonymous registration flow created a review identity, and local review actions changed only the review session's learner state.
- Inspected onboarding, Home, Practice, Reading, objective results/question review, Listening, Writing, Speaking permission state, Settings, Paywall, vocabulary reveal/ratings, Progress, micro-drill selection/feedback, and full-mock cancellation. Both light and dark appearances were inspected on representative screens, not every screen/theme combination.
- Some Flutter semantics locator clicks timed out; coordinate clicks based on the current rendered view worked. Automation timeouts alone are not recorded as app interaction failures. Accessibility observations below concern the emitted semantics tree, not a completed TalkBack/VoiceOver audit.
- The served web bundle was inspected as it existed. Its exact build commit was not independently established; source explanations were checked against the workspace, and runtime observations are explicitly scoped to this served build. Browser observations/screenshots appear in the review tool transcript; no additional screenshot assets were committed.

### BF-01 — Correct matching heading is marked wrong

**P1 · Reproduced · Confirms TD-28 / UX-08**

At 393×852, opened the Reading quick launch and switched to Questions. Question 1 asks which heading matches Paragraph B. The second visible choice is labeled **B** and displays **“ii. Structural layout and atmospheric ventilation impediments.”** Selected that choice and submitted the test. Review showed **“Your answer: B”**, **“Accepted: ii / structural layout and atmospheric ventilation impediments”**, and **“Missed.”** Overall result was 0/13.

This directly demonstrates the option-ID/accepted-answer mismatch. It is not a hypothetical content-quality concern. Use the exact interaction as a regression test. The other twelve questions were deliberately left blank; the observed zero is not evidence that all thirteen answer keys are wrong.

### BF-02 — A plainly correct TFNG drill answer is rejected

**P1 · Reproduced · Confirms TD-29**

Opened **TFNG Speed Trap Identifier**. Its first item states that a solar array generated 45 MW and consumption was 40 MW, then asks whether it generated more power than needed. Selected **TRUE** and pressed **Check Answer**. The UI marked TRUE red, displayed **“Incorrect variant.”**, and simultaneously explained **“Direct comparison: 45 MW generated > 40 MW consumed.”**

The feedback contradicts its own explanation. This supports the diagnosed empty-accepted-answer import defect. The drill also shows the internal `speed_tfng` identifier and a **“Complete the Sentence”** heading for a TFNG task. Replace generic/internal labels with the actual exercise type, after correcting grading.

### BF-03 — Canceling a mock section marks it completed

**P1 · Reproduced · Confirms TD-34 / UX-09**

Opened the full Academic mock planner at **0 of 4 Sections Completed**. Pressed **Start Next Section**, then exited Listening using its exit dialog, without answering or submitting. The planner returned showing **1 of 4 Sections Completed** and a checkmark beside Listening.

The cancellation dialog itself appeared and worked. The defect is the completion transition after cancellation. Required regression: route return without an accepted submission must leave the stage incomplete.

### BF-04 — Exam Listening loads audio but exposes no start control

**P1 · Reproduced visible state · Confirms UX-07; source supports TD-37/TD-38 interactions**

Opened the seeded Listening exam. Media GET returned 200/206, and the player displayed a duration of **03:40**, but remained at **00:00**. The player showed a speaker icon and **“Exam Mode · Linear”**, with no visible or semantic play/start action. This is distinct from an audio-download failure or a denied microphone permission.

Add an explicit start gesture after readiness. Do not infer audible playback quality from this check: no physical audio output or native audio session was evaluated. The quick-launch promise of four sections/30 minutes also did not describe this one-section, ten-question, 3:40 sample.

### BF-05 — Task 1 chart is poorly legible in light mode

**P1 for assessment usability · Visually observed · Extends UX-06 / UX-16**

At 393×852 in light mode, the Task 1 chart's title, country names, and legend use tiny white text on a pale chart/card background. Axis labels and numeric values are also very small. The full task prompt occupies most of the viewport; the response editor begins near the bottom, while the submit action remains prominent.

The chart must support the answer, not merely decorate the prompt. Provide theme-appropriate artwork/colors, a readable expanded view, and an accessible data table or equivalent description. Preserve access to the prompt/data while writing. No numeric contrast ratio was measured in this pass; the observed legibility problem is a visual finding, not a WCAG certification.

### BF-06 — Important actions and study guidance are truncated at ordinary mobile widths

**P2 · Visually observed · Confirms UX-02 / UX-05 / UX-17**

At 393×852, Home truncates the recommendation title to **“Science Fiction & Academic Resear...”** and its reason to **“No scored speaking a...”**. Practice truncates several simulator descriptions. Speaking truncates **Retry Permission** to **“Retry Permis...”**. The mock planner truncates **Start Next Section** to **“Start Next Se...”**. Reading clips the passage selector so its number is not visible.

These are not all equivalent. Truncating a secondary catalog description may be acceptable if details are available; truncating the next action or why it was recommended harms decision-making. Wrap critical action labels, shorten them deliberately, and give the passage selector enough width. Preserve useful card summaries without forcing a user to open each card.

### BF-07 — Paywall allowance heading clips at 320px

**P2 · Reproduced · Confirms UX-17**

At 320×640, **“TRANSPARENT FAIR-USE ALLOWANCE”** extends beyond its card and is clipped rather than wrapping. The rest of the allowance bullets wrap. This failure is in a populated Paywall screen outside the Home/Practice layout tests.

Use a flexible/wrapping heading or shorter learner-facing wording. Include populated paywall/review/permission states in the narrow-width matrix. The browser release build did not emit an overflow diagnostic; absence of a console error did not mean the heading was readable.

### BF-08 — Semantics contain duplicated labels, unnamed controls, and incomplete state/value descriptions

**P1 · Observed in browser accessibility tree · Extends UX-16**

Onboarding exam choices announce the title/description twice because the explicit combined label and child text both enter the semantics name. Goal setup's slider appeared with a value of **“1”**, while the visible goal was **Band 7.5**, and had no useful accessible name. Several back/close controls and Settings minus/plus controls appear as unnamed buttons. Settings' Academic/General switch was checked but unnamed. Reading's three highlight-color controls appeared as unnamed buttons.

Other elements were better: main navigation had selected tab semantics, result actions had names, flashcard rating buttons included intervals, and the chart exposed a textual score summary. Preserve those strengths. Add names, meaningful values, selected/check states, and nonduplicated grouping. Test a complete flow with actual assistive technology before claiming conformance.

### BF-09 — Diagnostic wording promises two skills, but the configured route is Speaking only

**P1 · Copy observed in browser; route mismatch established in source · Extends UX-01**

Goal setup displays **“Start with a 15-min Diagnostic Test”** and **“Evaluates Speaking & Writing immediately to calibrate your baseline.”** The onboarding notifier routes a selected diagnostic to the Speaking simulator, not a combined Speaking/Writing assessment. This browser run unchecked the diagnostic rather than consuming it.

Either deliver the combined diagnostic and its quota policy or change the offer to the actual Speaking-only experience. Avoid promising an immediate calibrated baseline before assessment validity and skill coverage are established.

### BF-10 — Settings contradicts the goal shown elsewhere and exposes a placeholder identity

**P2 · Reproduced initial state · New TD-60**

Onboarding displayed Band 7.5, and Home/review/Progress displayed target 7.5. The first Settings visit instead displayed **7.0** and **`mockza-local-user`** as the pseudonymous device identifier. No goal adjustment was performed during this comparison. A later full browser reload restored Settings to 7.5, confirming stale live UI state rather than a lost onboarding preference. This is a real cross-screen state inconsistency, with the hydration/initialization mechanisms described in TD-60.

A clear goal-setting control is useful, but it must reflect the same persisted preference everywhere. Prefer useful account/recovery status over presenting a placeholder as a real device identity.

### BF-11 — Vocabulary review starts with 200 cards and promises intervals not implemented

**P2 · Display observed; algorithm mismatch source-confirmed · New TD-61 / Extends UX-13**

The initial session showed **Card 1 of 200**. Reveal worked, and the rating controls displayed **Again 1m**, **Hard 1d**, **Good 1d**, **Easy 4d**. The scheduling source does not honor these minute/Easy promises (TD-61). No rating was submitted in this check, so no actual one-minute wait or persisted review schedule was measured.

Keep the readable card, context sentence, and explicit interval presentation, but make previews truthful. Consider a small chosen daily/session goal with **continue later**, rather than framing the first session as a 200-card obligation. Explain that a session limit is not the total deck size.

### BF-12 — Progress shows an overall band from one partial result and an unlabelled plot

**P1 for score interpretation; P2 for chart presentation · Reproduced · Confirms TD-35 / UX-12**

After the single deliberately partial Reading submission, Progress displayed **“ESTIMATED OVERALL BAND — Band 0.0”**, although Speaking, Writing, and Listening all had zero attempts. The plot contained horizontal lines, one dot, and a dashed target line, without visible axis values, dates, or a legend. Its accessibility summary did expose the date and value. The source's 4.0 minimum clamps the zero-score point to the chart floor, making the unlabelled scale particularly misleading.

Show **Reading practice result / partial baseline** with skill coverage. Add visible chart labels and a simple data list/tooltip, or omit the chart until enough comparable data exists. Do not interpret the test session's zero as an estimate of a real learner's overall exam readiness.

### BF-13 — Desktop layout is inconsistent; a width constraint already exists for primary tabs

**P2 · Visually observed · Refines UX-17**

At 1280×800, Progress kept a centered, bounded main column, which is a useful existing behavior from the shared tab shell. In contrast, onboarding and micro-drill selection/exercises stretched almost the full viewport. Drill text and answer rows became very wide, while the same bottom navigation still spans the full window on primary tabs.

This narrows the earlier source-based concern: **not every screen stretches on desktop**. Reuse or deliberately adapt the existing width policy for standalone learning/setup screens. Consider task-specific two-pane layouts where helpful, rather than indiscriminately constraining or stretching everything.

### Remaining runtime work

This pass did not exercise physical microphone permission recovery, recording/replay/interruptions, multi-turn uploads, web-blob recovery after refresh, paid/live AI, vendor billing, full offline network isolation, Iranian/Persian flows, text scaling, keyboard-only completion, physical screen readers, numeric contrast measurements, or every content pack. Existing source findings in those areas remain source-confirmed or conditional as originally labeled. The local proxy and review tab are temporary audit infrastructure and are stopped/closed after inspection; no application source or deployment configuration was changed.
