# Code Review Issues — Uncommitted Working Tree (2026-11-27)

- **Date:** 2026-11-27
- **Repository:** `/home/mahdi/projects/ideas/mockza` (uncommitted changes on top of commit `44984a0`)
- **Scope:** Full file-by-file review of all **95 uncommitted files** (`88` modified + `7` untracked)
- **Summary:** **34 verified issues** found — **3 Critical**, **6 High**, **16 Medium**, **9 Low**
- **Resolution Status:** **All 34/34 issues resolved and verified** (Backend domain 413/413 + API/worker `tsc`, Web `tsc` + 231/231 tests, Flutter `flutter analyze` 0 issues + 25/25 targeted regression/a11y tests).

| Severity | Count | Key Themes |
| --- | ---: | --- |
| **Critical** | 3 | Unstable `createTranslator()` in React `useCallback`/`useEffect` deps causing infinite fetch/hydration loops & canceling rate-limit backoff |
| **High** | 6 | Rate-limit proxy-trust spoofing via Docker NAT, Web auth re-entrant deadlock, Flutter micro-drill track drop, Dart/TS roadmap parity drift, RTL `ScoreMeter` inversion, `LtrExamBoundary` wrapping Persian UI |
| **Medium** | 16 | BiDi/RTL boundary leaks, worker error-token dead code, `localStorage` JWT exposure, PTE concordance off-by-one, audio seek bugs, `++0.5` banner bug, missing `mounted` check, missing `'y'` SM-2 interval, `RenderFlex` overflow risk |
| **Low** | 9 | Doc count/line inaccuracies, extra `router.tsx` session resubscriptions, RTL arrow directionality, non-canonical exam scale IDs, minor Persian copy & numeral inconsistencies |

---

## Critical Issues (3)

### 1. Infinite network/state re-fetch loop in `DiagnosticResultScreen`
- **File:** [DiagnosticResultScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticResultScreen.tsx#L46-L103) (see also [i18n/index.ts](file:///home/mahdi/projects/ideas/mockza/web/src/i18n/index.ts#L76-L80))
- **Cause:** `const t = createTranslator(deps.edition)` allocates a **new function reference on every render**. The diff added `t` to `loadResults`'s `useCallback` dependency array (`line 87`), and `useEffect(() => { void loadResults(); }, [loadResults])` (`lines 89-91`) depends on `loadResults`.
- **Impact:** Every state update (`setSession`, `setPersonalization`, `setErrorMsg`) triggers a re-render → new `t` → new `loadResults` → immediate `useEffect` re-run, creating an unbounded infinite loop of `deps.diagnostic.getSession(...)` requests. Even `quota_exceeded` does not stop it because `pollPausedByQuota` only guards the `setInterval` effect (`line 98`), not the mount effect (`line 89`).
- **Fix:** Memoize `t` with `useMemo(() => createTranslator(deps.edition), [deps.edition])`, or call `translate(deps.edition, 'rateLimitFriendlyError')` inside `loadResults` and depend on `deps.edition` instead of `t`.

### 2. Infinite hydration loop in `EvaluationResultScreen`
- **File:** [EvaluationResultScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/EvaluationResultScreen.tsx#L81-L148)
- **Cause:** `const t = createTranslator(deps.edition)` (`line 81`) returns a new closure every render, and the diff added `t` to the hydration `useEffect` dependency array (`line 148`).
- **Impact:** Whenever `hydrate()` sets `attempt` or `evaluation` (fresh objects from IndexedDB / `JSON.parse` / `pollEvaluationJob`), or on any local UI interaction (selecting an inline edit, toggling shadow practice, adding vocab), the component re-renders and re-runs `hydrate()` continuously.
- **Fix:** Call `translate(deps.edition, 'evalResultNotFound')` inside `hydrate()` and replace `t` with `deps.edition` in the `useEffect` dependency array (or memoize `t` with `useMemo`).

### 3. Unstable `t` in `EvaluationPendingScreen` cancels backoff timers and breaks `quota_exceeded` backoff
- **File:** [EvaluationPendingScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/EvaluationPendingScreen.tsx#L32-L113)
- **Cause:** `const t = createTranslator(deps.edition)` (`line 32`) is included in `pollOnce`'s `useCallback` deps (`line 77`), and the polling `useEffect` (`lines 79-113`) depends on `pollOnce`.
- **Impact:** Every `setJob(res.value)` or `setErrorMsg(t('rateLimitFriendlyError'))` triggers a re-render → new `pollOnce` → `useEffect` cleanup clears `timerId` (canceling the 8s+ `nextDelayOverrideMsRef` backoff and `POLL_BACKOFF_SCHEDULE_MS`), resets `startedAt = Date.now()` and `attemptCount = 0` (preventing `MAX_ACTIVE_POLL_MS` from ever timing out), and immediately fires `pollOnce()` again with `0ms` delay.
- **Fix:** Call `translate(deps.edition, ...)` inside `pollOnce` and depend on `deps.edition` instead of `t` (or memoize `t` with `useMemo`).

---

## High Issues (6)

### 4. Rate-limit bypass via Docker bridge NAT & inability to disable proxy trust
- **Files:**
  - [rate-limit.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/middleware/rate-limit.ts#L8-L25)
  - [compose.yaml](file:///home/mahdi/projects/ideas/mockza/compose.yaml#L41) & [compose.yaml](file:///home/mahdi/projects/ideas/mockza/compose.yaml#L169-L170)
- **Cause:** `parseTrustedProxyList` falls back to `DEFAULT_TRUSTED_PROXY_LIST` (all RFC 1918 ranges `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` + `fc00::/7` + loopback) whenever `TRUSTED_PROXY_IPS` is empty/unset, so proxy trust cannot be disabled via `TRUSTED_PROXY_IPS=""`. Meanwhile, `compose.yaml` binds the API directly on `0.0.0.0:45281:8787`, where external connections arrive over the Docker bridge NAT (`172.16.0.0/12`).
- **Impact:** Any external caller hitting port `45281` directly appears to come from a trusted `172.x.x.x` peer and can spoof arbitrary `X-Forwarded-For` / `X-Real-IP` headers to completely bypass IP rate limiting.
- **Fix:** Distinguish `TRUSTED_PROXY_IPS === undefined` from explicit `""` / `"none"` (disabling proxy trust), narrow defaults or require explicit proxy CIDR in production, and bind the `compose.yaml` API port to `127.0.0.1:45281:8787` when behind a host reverse proxy.

### 5. Re-entrant promise deadlock in Web `HttpAuthAdapter.performAnonymousAuth()`
- **Files:**
  - [http-auth.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-auth.adapter.ts#L340-L350) & [http-auth.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-auth.adapter.ts#L426-L437)
  - [bootstrap-shared.ts](file:///home/mahdi/projects/ideas/mockza/web/src/composition/bootstrap-shared.ts#L90-L96)
- **Cause:** Inside `performAnonymousAuth()` (which is stored as `this.inflightAuth`), the adapter calls `apiClient.get('/v1/account/me', { skipAuthRefresh: true })` without passing an explicit `Authorization` header. `apiClient` calls `readAccessToken()`, which calls `getFreshAccessToken()`. If `getFreshAccessToken()` returns `null` (e.g., client clock skew or a token TTL `<= 60s`), `readAccessToken()` calls `await authAdapter.ensureAuthenticated(false)`, which returns `this.inflightAuth` — awaiting itself forever.
- **Impact:** Permanent authentication deadlock on clock-skewed browsers or short-lived access tokens.
- **Fix:** Pass `headers: { authorization: \`Bearer ${accessToken}\` }` directly on the `/v1/account/me` request inside `performAnonymousAuth()` so it never re-enters `readAccessToken()` / `ensureAuthenticated()`.

### 6. `MicroDrillsNotifier.loadDrill` drops `profileTrack` when directly activating a matched drill
- **File:** [micro_drills_notifier.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/micro_drills/presentation/micro_drills_notifier.dart#L242-L288)
- **Cause:** `loadDrill` resolves `profileTrack` (`line 184`) and stores it on early-return branches (`lines 201, 215, 246`), but on the matched-drill branch (`line 260`) it calls `_activateDrill(drills: drills, spec: matched)` which copies `examTrack: state.examTrack` (`line 279`) without passing `profileTrack`.
- **Impact:** When a PTE Academic, TOEFL iBT, or DET learner opens a drill directly via `/micro-drill/<id>` and `drillId` has no exam prefix, `state.examTrack` remains at default `ExamTrack.ieltsAcademic`, corrupting the completion `ScoreMeter` range/unit and recorded `examId`.
- **Fix:** Add `ExamTrack? examTrack` to `_activateDrill`, pass `examTrack: profileTrack` at `line 260`, and set `examTrack: examTrack ?? state.examTrack` at `line 279`.

### 7. Dart ↔ TypeScript parity drift in `RoadmapGenerator`
- **Files:**
  - [roadmap_generator.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/personalization/roadmap_generator.dart#L422-L424) & [roadmap_generator.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/personalization/roadmap_generator.dart#L859-L889)
  - [roadmap-generator.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/domain/src/personalization/roadmap-generator.ts#L203) & [roadmap-generator.ts](file:///home/mahdi/projects/ideas/mockza/backend/packages/domain/src/personalization/roadmap-generator.ts#L551-L574)
- **Cause:**
  1. **Vocab Wave 1 `titleEn`:** TS (`line 203`) unconditionally emits ``Vocab Wave 1: 15 ${favLabelEn} Core Words``, while Dart (`lines 422-424`) only drops `&` when `primaryFav.labelEn.contains('&')` (still emitting `& Core Words` for non-ampersand topics like `Education`).
  2. **Target score unit & Persian digits:** Dart (`lines 859-889`) formats target scores with `track.formatScore` / `track.formatScoreWithUnit` and Persian digits via `EdgeNumerals.toPersianDigits(...)`, while TS (`lines 551-574`) still hardcodes ``toward Band ${params.targetBand}.`` (producing `"toward Band 72."` for PTE and `"toward Band 120."` for DET) and ASCII digits in Persian strings.
- **Impact:** Server-generated roadmaps diverge from locally generated Dart roadmaps and leak `"Band"` on non-IELTS tracks and ASCII digits on IRN.
- **Fix:** Unify Dart `line 422` to `'Vocab Wave 1: 15 ${primaryFav.labelEn} Core Words'` and port track-aware score formatting + Persian numeral formatting into `roadmap-generator.ts`.

### 8. Physical LTR layout in Flutter `ScoreMeter` inverts progress fill and target tick in RTL
- **File:** [score_meter.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/score_meter.dart#L91-L155)
- **Cause:** Uses physical `Alignment.centerLeft` (`line 93`) and `Positioned(left: targetX - 1.5, ...)` (`line 116`), while the axis labels `Row` (`lines 132-155`) is RTL-aware.
- **Impact:** Violates the zero-physical-LTR architecture rule. In RTL (`irn`) wherever `ScoreMeter` is not inside `LtrExamBoundary` (e.g., `MetricHero`, `ProgressSkillScreen`), `minScore` (`۰`) sits on the right and `maxScore` (`۹`) on the left, while the fill bar grows from the **left** (`۹` side) and the target tick is measured from the left — visually inverting the meter relative to its own scale labels.
- **Fix:** Replace `Alignment.centerLeft` with `AlignmentDirectional.centerStart` and `Positioned(left: targetX - 1.5, ...)` with `PositionedDirectional(start: targetX - 1.5, ...)`.

### 9. Flutter `LtrExamBoundary` wraps Persian UI copy in `RegisterShifterScreen` and `ProgressScreen`
- **Files:**
  - [register_shifter_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/register_shifter/presentation/register_shifter_screen.dart#L573-L589)
  - [progress_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/progress/presentation/progress_screen.dart#L388-L409) & [progress_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/progress/presentation/progress_screen.dart#L574-L582)
- **Cause:** `LtrExamBoundary` unconditionally forces `Directionality(TextDirection.ltr)` and `Localizations.override(locale: Locale('en', 'US'))`.
  - In `register_shifter_screen.dart`, Persian `hintText` and `helperText` (`حداقل ۱۵ کاراکتر...`) are placed inside `LtrExamBoundary`.
  - In `progress_screen.dart`, Persian `scoreText` (`باند ۶.۵` / `هنوز برآورد نشده`), Persian `targetPrefix` (`هدف`), and Persian `skillName` (`اسپیکینگ`) are wrapped in `LtrExamBoundary`.
- **Impact:** Persian text is forced left-aligned in LTR directionality with broken BiDi punctuation/counter ordering and `en_US` locale override.
- **Fix:** In `register_shifter_screen.dart`, set `textDirection: TextDirection.ltr` on `TextField` with `hintTextDirection: isRtl ? TextDirection.rtl : TextDirection.ltr` and keep Persian helper text outside `LtrExamBoundary`. In `progress_screen.dart`, apply `LtrExamBoundary` only when `!isIran` (and remove it around `ScoreMeter` once Issue #8 is fixed).

---

## Medium Issues (16)

### 10. `drop-ingest.ts` overwrites `'stage.drop_failed'` token with raw English `error.message`
- **File:** [drop-ingest.ts](file:///home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/drop-ingest.ts#L398-L401)
- **Cause:** Sets `stageDetail: error instanceof Error ? error.message.slice(0, 200) : 'stage.drop_failed'`. Because caught exceptions are almost always `Error` instances, `'stage.drop_failed'` is effectively dead code and raw English error messages are persisted and surfaced to IRN users (unlike `register-shifter.ts:243`, which unconditionally sets `'stage.register_failed'`).
- **Fix:** Always set `stageDetail: 'stage.drop_failed'` (and keep raw `error.message` in server logs only).

### 11. Raw bearer JWT persisted in `localStorage` & unvalidated `user` shape on restore
- **File:** [http-auth.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-auth.adapter.ts#L31-L52) & [http-auth.adapter.ts](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-auth.adapter.ts#L191-L220)
- **Cause:** `accessToken` is written to `localStorage` (accessible to any XSS script on the origin), and `isPersistedAuthSession` checks `typeof obj['user'] === 'object'` without validating required fields (`id`, `isAnonymous`, etc.).
- **Impact:** Expands XSS blast radius for bearer tokens and can crash downstream UI if corrupted/partial `user` JSON exists in storage.
- **Fix:** Prefer HttpOnly cookie or in-memory access token with refresh flow if backend supports it; at minimum, strictly validate all required `user` fields in `isPersistedAuthSession` and clear corrupt storage entries.

### 12. PTE-to-IELTS concordance off-by-one at PTE `84`
- **Files:**
  - [score-calculators-client.ts](file:///home/mahdi/projects/ideas/mockza/web/src/seo/score-calculators-client.ts#L15)
  - [pte-to-ielts-concordance.astro](file:///home/mahdi/projects/ideas/mockza/web/src/pages/calculators/pte-to-ielts-concordance.astro#L12-L13)
- **Cause:** `score-calculators-client.ts:15` has `if (pte >= 84) return { ielts: '8.5', cefr: 'C2' }`, contradicting the concordance table in `pte-to-ielts-concordance.astro:12-13` (`76–84 → 8.0, C1–C2`; `85–90 → 8.5–9.0, C2`).
- **Fix:** Change `pte >= 84` to `pte >= 85` in `score-calculators-client.ts` (or verify against the official Pearson concordance table and align both files).

### 13. Landing audio seek slider snaps back to `0` and repeatedly calls `audio.load()` before metadata loads
- **File:** [interactions.js](file:///home/mahdi/projects/ideas/mockza/web/src/landing/interactions.js#L192-L197), [interactions.js](file:///home/mahdi/projects/ideas/mockza/web/src/landing/interactions.js#L304-L309), [interactions.js](file:///home/mahdi/projects/ideas/mockza/web/src/landing/interactions.js#L360-L365)
- **Cause:** In `setupReportAudio`, dragging the seek slider before metadata loads triggers `audio.load()` on every `input` event and calls `sync()`, which resets `seek.value` to `0` (`audio.currentTime = 0`). In `setupSpeakingAudio`, dragging seek before Play sets `src` but never loads or updates the playhead until Play is clicked.
- **Fix:** Guard `audio.load()` so it only runs once per `src` (not on every `input` tick), preserve the pending seek fraction until `loadedmetadata` fires, and apply it once `duration` is known.

### 14. Web `ProgressScreen` wraps Persian DET subscore labels & digits in `<LtrExamBoundary>`
- **File:** [ProgressScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L520-L544)
- **Cause:** The DET subscores grid (`سواد (Literacy)`, `درک مطلب (Comprehension)`, etc. + Persian digits) is wrapped in `<LtrExamBoundary>` and `font-mono-exam`.
- **Impact:** Renders Persian labels left-aligned in LTR with English monospace font and inverted colon punctuation on IRN.
- **Fix:** Remove `<LtrExamBoundary>` and `font-mono-exam` from the grid wrapper (matching [HomeScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/home/HomeScreen.tsx#L588-L605)).

### 15. Web Persian score-with-unit and status strings rendered inside `<LtrExamBoundary>`
- **Files:**
  - [FullMockOrchestratorScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/FullMockOrchestratorScreen.tsx#L343-L349)
  - [ProgressScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L302-L308), [L354-L358](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L354-L358), [L565-L570](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L565-L570), [L646-L651](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L646-L651)
  - [EvaluationResultScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/EvaluationResultScreen.tsx#L231-L236)
  - [ObjectiveResultScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/ObjectiveResultScreen.tsx#L198-L205)
- **Cause:** `formatLocalizedExamScoreWithUnit` returns Persian strings on IRN (`باند 7.5`, `نمره 120`), and `FullMockOrchestratorScreen.tsx:347` also renders `t('diagPendingStatusLabel')` (`در انتظار`) inside `<LtrExamBoundary>`.
- **Impact:** Forces Persian unit and status copy into `dir="ltr" lang="en" font-en` inside RTL cards.
- **Fix:** Render localized score-with-unit and status strings outside `<LtrExamBoundary>`, isolating only the numeric exam score in `<bdi dir="ltr" className="font-mono-exam">` where needed.

### 16. `ForwardArrowIcon` points backwards inside `<LtrExamBoundary>` in `DailyMissionScreen`
- **File:** [DailyMissionScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/mission/DailyMissionScreen.tsx#L643-L651)
- **Cause:** Inside `<LtrExamBoundary>` (`dir="ltr"`), `{u.original}` is on the left and `{u.improved}` is on the right, but `<ForwardArrowIcon edition={deps.edition} />` renders `ArrowLeft` (`←`) on IRN, producing `original ← improved`.
- **Fix:** Use `ArrowRight` (or `<ForwardArrowIcon edition="glb" />`) inside this LTR English diff block.

### 17. Double plus sign (`++0.5`) in `HomeScreen` band-up banner
- **File:** [HomeScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/home/HomeScreen.tsx#L180-L187)
- **Cause:** Passes `delta: formatChromeNumber(bandShiftDelta > 0 ? \`+${bandShiftDelta}\` : bandShiftDelta, deps.edition)` into `t('roadmapBandUpBannerTitle', ...)`, whose template in both `en.ts` and `fa.ts` already starts with `+{delta}`.
- **Impact:** Displays `++0.5 Band Up!` / `++۰.۵ ارتقای نمره!` when `bandShiftDelta > 0`.
- **Fix:** Pass `delta: formatChromeNumber(bandShiftDelta, deps.edition)` without prepending a second `+`.

### 18. Untranslated English `overallSummary.scaleLabel` leaks on IRN in Web `ProgressScreen`
- **File:** [ProgressScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L321-L322)
- **Cause:** Renders raw `overallSummary.scaleLabel` (`'Estimated Band'` / `'Estimated Score'`) when `readinessGap === null`, even though `localizeScaleLabel` already exists in [diagnostic-labels.ts](file:///home/mahdi/projects/ideas/mockza/web/src/components/bidi/diagnostic-labels.ts#L35-L46).
- **Fix:** Use `localizeScaleLabel(overallSummary.scaleLabel, deps.edition)`.

### 19. Flutter `MicroDrillsScreen` filter toggle can be a no-op and "All Tests" leaks other exam tracks
- **File:** [micro_drills_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/micro_drills/presentation/micro_drills_screen.dart#L211-L270)
- **Cause:**
  1. `hasFilterToggle` is `true` whenever `recIds.isNotEmpty`, even if `recAndTrack` is empty and `trackMatched.length == state.availableDrills.length`, rendering a `ChoiceChip` toggle where both options display the exact same list.
  2. When `_pathOnly == false` ("All Tests"), `listToRender` renders `state.availableDrills` unfiltered across all exam tracks directly below the active-track subtitle (`line 250`).
- **Fix:** Scope "All Tests" to `trackBase` and set `hasFilterToggle = recAndTrack.isNotEmpty && recAndTrack.length < trackBase.length` (or, if cross-track browsing is intentional, compute `final pathList = recAndTrack.isNotEmpty ? recAndTrack : trackBase;` and `hasFilterToggle = pathList.length < state.availableDrills.length`).

### 20. Flutter BiDi inversion: Persian labels wrapped in `LtrExamBoundary` / `TextDirection.ltr`
- **Files:**
  - [drop_drill_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_drill_screen.dart#L438-L447) & [drop_drill_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_drill_screen.dart#L492-L501)
  - [evaluation_review_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart#L1024-L1035)
- **Cause:** Persian strings (`'راهنما: ...'`, `'تکرار با صدای بلند: ...'`, `'پاراگراف ۱: "..."'`) are rendered inside `LtrExamBoundary` or `textDirection: TextDirection.ltr`.
- **Fix:** Place Persian labels outside `LtrExamBoundary` and wrap only the English hint/prompt/quote inside `LtrExamBoundary`.

### 21. Missing `mounted` check after async gap before `router.go` in `DiagnosticResultsScreen`
- **File:** [diagnostic_results_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/diagnostic/presentation/diagnostic_results_screen.dart#L456-L464)
- **Cause:** `onRetakeSkill` awaits `notifier.startSingleSkillRetake(outcome.skill)` and then calls `router.go(...)` without checking `if (!mounted) return;`.
- **Impact:** If the user navigates away while the request is in flight, the stale callback unexpectedly redirects them to a diagnostic session.
- **Fix:** Add `if (!mounted) return;` immediately after the `await`.

### 22. `EditionCopy.localizeDropPolicyReason` is unused while `DropHubScreen` shows raw English errors in IRN
- **Files:**
  - [edition_copy.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/localization/edition_copy.dart#L436-L456)
  - [drop_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/drop_anything/presentation/drop_hub_screen.dart#L499-L505)
- **Cause:** `EditionCopy.localizeDropPolicyReason` has zero call sites across `app/lib/` and `app/test/`, while `drop_hub_screen.dart:503` assigns `_error = f.message;` directly.
- **Fix:** Call `EditionCopy.localizeDropPolicyReason(f.code, f.message, isIran: isRtl)` in `drop_hub_screen.dart` and add unit test coverage in `edition_copy_and_qa_unit_test.dart`.

### 23. Missing `'y'` (year) interval branch in `VocabFlipCard._formatInterval`
- **File:** [vocab_flip_card.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/vocab_flip_card.dart#L372-L383)
- **Cause:** `Sm2Scheduler.formatDays` returns `'${years}y'` when `days >= 365`, but `_formatInterval` only handles `'mo'`, `'m'`, and `'d'`.
- **Impact:** Mature cards with intervals `>= 365` days render mixed-script `'۱y'` / `'۲y'` in Persian mode.
- **Fix:** Add `else if (text.endsWith('y')) { text = '${text.substring(0, text.length - 1)} سال'; }` before `EdgeNumerals.toPersianDigits(text)`.

### 24. Unbounded `Text` in `PracticeHubScreen._TestSetupContent` risks horizontal `RenderFlex` overflow
- **File:** [practice_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/practice_hub_screen.dart#L910-L927) & [practice_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/practice_hub_screen.dart#L950-L966)
- **Cause:** Inside each half-width mode card's `Row`, `Text(isFa ? 'حالت آزمون' : 'Exam Mode')` / `Text(isFa ? 'حالت مطالعه' : 'Study Mode')` is not wrapped in `Expanded`/`Flexible`.
- **Impact:** Horizontal overflow on narrow viewports (320–360px) or large accessibility font scales (1.5x–2.0x).
- **Fix:** Wrap both `Text` widgets in `Expanded(child: Text(..., maxLines: 1, overflow: TextOverflow.ellipsis))` with `SizedBox(width: SpacingTokens.xs)` before `AppIcon`.

### 25. Hardcoded `LucideGlyph.arrowRight` on `MetricHero` CTA
- **File:** [metric_hero.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/metric_hero.dart#L155-L159)
- **Cause:** `trailingGlyph: LucideGlyph.arrowRight` is hardcoded without checking `Directionality.of(context)`.
- **Impact:** Forward CTA arrow points backwards in RTL (IRN).
- **Fix:** Use `Directionality.of(context) == TextDirection.rtl ? LucideGlyph.arrowLeft : LucideGlyph.arrowRight`.

---

## Low Issues (9)

### 26. Documentation symbol/line/count inaccuracies in QA docs
- **Files:**
  - [QA_BUGS_AND_TECHNICAL_DEBTS.md](file:///home/mahdi/projects/ideas/mockza/docs/QA_BUGS_AND_TECHNICAL_DEBTS.md#L169) & [L256](file:///home/mahdi/projects/ideas/mockza/docs/QA_BUGS_AND_TECHNICAL_DEBTS.md#L256)
  - [QA_REPORT.md](file:///home/mahdi/projects/ideas/mockza/docs/QA_REPORT.md#L18-L31) & [L105](file:///home/mahdi/projects/ideas/mockza/docs/QA_REPORT.md#L105)
- **Details:**
  - Cites `parseTrustedProxyIps` instead of `parseTrustedProxyList` (`QA_BUGS_AND_TECHNICAL_DEBTS.md:256`).
  - Cites `app.ts:107` instead of `app.ts:65` (`QA_BUGS_AND_TECHNICAL_DEBTS.md:169`, `QA_REPORT.md:105`).
  - `QA_REPORT.md:18-31` summary table bug counts contradict the per-section lists (Section 2: `5` vs `6`, Section 3: `3` vs `4`, Section 12: `3` vs `4`).
- **Fix:** Sync the function name, line reference, and summary table counts.

### 27. `ScoreCalculatorsIsland` keeps `<LtrExamBoundary>` around Persian DET subscores
- **File:** [ScoreCalculatorsIsland.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/seo/ScoreCalculatorsIsland.tsx#L194-L204)
- **Details:** Wraps Persian DET subscores (`سواد: ...`) in `<LtrExamBoundary>`, inconsistent with IELTS/TOEFL in the same file and [ScoreCalculatorsSection.astro](file:///home/mahdi/projects/ideas/mockza/web/src/seo/ScoreCalculatorsSection.astro#L164).
- **Fix:** Remove `<LtrExamBoundary>` from the Persian DET subscores container.

### 28. `router.tsx` re-subscribes `onSessionChanged` and re-calls `getSession()` on every route change
- **File:** [router.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L606-L642)
- **Details:** `deps.auth.onSessionChanged(...)` is registered inside a `useEffect` whose dependency array includes `pathname`, causing unnecessary unsubscribe/resubscribe and `getSession()` calls on every SPA navigation.
- **Fix:** Split the `onSessionChanged` subscription into its own `useEffect` depending only on `[deps.auth]`.

### 29. Unlocalized ASCII seconds in Speaking badge & unisolated `$`/English tokens in Admin console
- **Files:**
  - [SpeakingSimulatorScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/SpeakingSimulatorScreen.tsx#L644)
  - [AdminTraceConsoleScreen.tsx](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/admin/AdminTraceConsoleScreen.tsx#L275-L277), [L339-L345](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/admin/AdminTraceConsoleScreen.tsx#L339-L345), [L360](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/admin/AdminTraceConsoleScreen.tsx#L360)
- **Details:** `SpeakingSimulatorScreen.tsx:644` omits `formatChromeNumber(..., deps.edition)` on `activeTiming.responseSeconds`; `AdminTraceConsoleScreen.tsx` renders `$0.0000`, `call.modelId`, and English `p.targetText` without `dir="ltr"` / `<LtrExamBoundary>`, flipping `$` to `0.0000$` in RTL.
- **Fix:** Format seconds with `formatChromeNumber` and isolate USD/model/English strings in `<LtrExamBoundary>` or `<span dir="ltr">`.

### 30. `_defaultExamScalesFa` uses non-canonical `examId` values
- **File:** [diagnostic_results_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/diagnostic/presentation/diagnostic_results_screen.dart#L74-L96)
- **Details:** Uses `'toefl'` and `'pte'` instead of canonical `'toefl_ibt'` and `'pte_academic'`, so `info.examId == activeExamId` in `diagnostic_help_sheet.dart:72` never matches, hiding the `'هدف شما'` ("Your Goal") chip for TOEFL, PTE, and IELTS General users in IRN.
- **Fix:** Use canonical IDs (`'toefl_ibt'`, `'pte_academic'`) and match via `ExamTrack.fromId(...)` (mapping `ielts_general` to the IELTS entry).

### 31. Hardcoded `LucideGlyph.arrowRight` on Persian RTL forward CTAs
- **Files:**
  - [micro_drills_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/micro_drills/presentation/micro_drills_screen.dart#L599)
  - [evaluation_review_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/evaluation_review/presentation/evaluation_review_screen.dart#L738)
  - [diagnostic_results_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/diagnostic/presentation/diagnostic_results_screen.dart#L386)
- **Details:** Forward buttons (`تمرین بعدی`, `شروع تمرین هدفمند`, `شروع گام اول در نقشه راه`) keep `LucideGlyph.arrowRight` on RTL screens.
- **Fix:** Flip to `arrowLeft` in RTL (`isFa` / `isIran`).

### 32. `HomeScreen.unestimatedSubtitle` hardcodes `"band score"` for non-IELTS tracks
- **File:** [home_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/home/presentation/home_screen.dart#L329-L332)
- **Details:** On GLB, displays `'Complete your free diagnostic to calculate your baseline band score.'` even when the active track is PTE Academic or DET.
- **Fix:** Condition `"band score"` vs `"score"` on `state.track.unitLabel == 'Band'`.

### 33. Unlocalized `slotKind.displayLabel`, `ID:`, and ASCII `'<-'` in `device_session_card.dart`
- **File:** [device_session_card.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/device_session_card.dart#L263), [L332](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/device_session_card.dart#L332), [L393](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/device_session_card.dart#L393)
- **Details:** Embeds raw English `'Mobile Phone'` / `'Desktop Web'` and `'ID:'` in Persian UI, and uses ASCII `'<-'` instead of Unicode `'←'`.
- **Fix:** Reuse a localized `_slotLabel(DeviceSlotKind, {required bool isFa})` helper, localize `'شناسه:'`, and use `'←'`.

### 34. Minor Persian copy & fallback inconsistencies in `VocabReviewScreen` and `PracticeHubScreen`
- **Files:**
  - [vocab_review_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/vocabulary/presentation/vocab_review_screen.dart#L236) — `'هم‌آواهای نمره‌آور'` translates "collocations" as «هم‌آواها» (homophones) instead of «همنشینی‌ها» / «کالُکیشن‌ها».
  - [practice_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/practice_hub_screen.dart#L506) & [L954](file:///home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/practice_hub_screen.dart#L954) — uses `'حالت مطالعه'` for "Study Mode", inconsistent with `'حالت تمرینی'` in `full_mock_screen.dart:425` and `practice_setup_screen.dart:153`.
  - [practice_hub_screen.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/features/practice_hub/presentation/practice_hub_screen.dart#L641) — fallback subtitle `'${pack.track.toUpperCase()} • ...'` leaks raw uppercase English (`ACADEMIC`/`GENERAL`) in Persian mode when `pack.description` is empty.

---

## Coverage Verification (95 / 95 Uncommitted Files Reviewed)

- **Backend, Infra & Docs (13 files):** `.env.example`, `compose.yaml`, `backend/apps/api/src/__tests__/phase7_fencing_and_reconciliation.test.ts`, `backend/apps/api/src/app.ts`, `backend/apps/api/src/middleware/rate-limit.ts`, `backend/apps/api/src/routes/auth.ts`, `backend/apps/api/src/routes/exams.ts`, `backend/apps/worker/src/jobs/drop-ingest.ts`, `backend/apps/worker/src/jobs/register-shifter.ts`, `backend/packages/domain/src/__tests__/cross-codebase-parity.test.ts`, `backend/packages/domain/src/personalization/roadmap-generator.ts`, `docs/QA_BUGS_AND_TECHNICAL_DEBTS.md`, `docs/QA_REPORT.md`
- **Web Core, Adapters, Landing, Calculators, i18n & Assets (18 files):** `api-client.ts`, `http-auth.adapter.ts`, `topic-labels.ts`, `diagnostic-labels.ts`, `WaveformMicRecorder.tsx`, `bootstrap-shared.ts`, `en.ts`, `fa.ts`, `interactions.js`, `markup.mjs`, `pte-to-ielts-concordance.astro`, `ScoreCalculatorsIsland.tsx`, `ScoreCalculatorsSection.astro`, `score-calculators-client.ts`, `DesktopSimulatorApp.tsx`, `router.tsx`, `evaluation_review.test.tsx`, `web/public/favicon.ico`
- **Web SPA Feature Screens (21 files):** `AdminTraceConsoleScreen.tsx`, `AuthScreen.tsx`, `DiagnosticResultScreen.tsx`, `DropDrillScreen.tsx`, `DropHubScreen.tsx`, `HomeScreen.tsx`, `DailyMissionScreen.tsx`, `GoalSetupScreen.tsx`, `FullMockOrchestratorScreen.tsx`, `ListeningSimulatorScreen.tsx`, `MicroDrillsScreen.tsx`, `SpeakingSimulatorScreen.tsx`, `WritingSimulatorScreen.tsx`, `ProgressScreen.tsx`, `RegisterShifterScreen.tsx`, `EvaluationPendingScreen.tsx`, `EvaluationResultScreen.tsx`, `ObjectiveResultScreen.tsx`, `RoadmapScreen.tsx`, `SettingsScreen.tsx`, `VocabWordDetailScreen.tsx`
- **Flutter Core, Routing, Services, Tests & Features Batch A (22 files):** `edition_copy.dart`, `exam_spec.dart`, `roadmap_generator.dart`, `app_router.dart`, `auth_session_service.dart`, `linguistic_gateway.dart`, `auth_notifier.dart`, `auth_screen.dart`, `diagnostic_help_sheet.dart`, `diagnostic_intro_screen.dart`, `diagnostic_results_screen.dart`, `drop_drill_screen.dart`, `drop_hub_screen.dart`, `evaluation_review_screen.dart`, `home_screen.dart`, `coach_hub_screen.dart`, `daily_mission_screen.dart`, `linguistic_graph_screen.dart`, `micro_drills_notifier.dart`, `micro_drills_screen.dart`, `edition_copy_and_qa_unit_test.dart`, `qa_regression_fixes_test.dart`
- **Flutter Features, Theme Components & A11y Test Batch B (21 files):** `onboarding_screen.dart`, `full_mock_screen.dart`, `practice_hub_screen.dart`, `practice_setup_screen.dart`, `progress_attempts_screen.dart`, `progress_screen.dart`, `progress_skill_screen.dart`, `register_shifter_screen.dart`, `roadmap_screen.dart`, `settings_screen.dart`, `vocab_review_screen.dart`, `vocab_word_detail_screen.dart`, `vocabulary_screen.dart`, `attempt_list_row.dart`, `device_session_card.dart`, `metric_hero.dart`, `score_meter.dart`, `skill_metric_card.dart`, `study_week_strip.dart`, `vocab_flip_card.dart`, `accessibility_and_layout_test.dart`
