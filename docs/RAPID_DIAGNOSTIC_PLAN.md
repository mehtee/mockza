# Mockza — Rapid Adaptive Starting-Level Check

> **Status:** Proposed product and implementation plan. Placement rules require learner validation before public release; precise exam-score prediction is a later, separately validated capability.  
> **Revised:** 2026-11-17  
> **Scope:** A short Reading, Listening, Writing, and Speaking profile for onboarding and practice selection across exam goals, including IELTS Academic/General Training, TOEFL iBT, Duolingo English Test, and PTE Academic.  
> **Related specifications:** [PDR.md](./PDR.md) · [design.md](./design.md) · [ADR.md](./ADR.md) · [PLAN.md](./PLAN.md)

## 1. Product objective and limits

Give a new learner a useful starting practice plan without requiring a full mock or prior knowledge of English exams. Use one simple activity format per skill, with a few short adaptive probes where they add useful evidence. A single scenario can reduce context switching, but a single question cannot establish every aspect of four skills.

The standard guided attempt has a **10-minute budget from opening its introduction to showing a results/status screen**. Help, device checks, transitions, and a bounded results wait are included. Aim to finish sooner; a typical completion time must be measured in usability trials rather than advertised as established fact.

The first release provides **provisional, broad practice placement for each observed skill**. It does not promise official-test equivalence, a precise CEFR certification, or a fixed IELTS/DET error margin. Accurate short-form placement is a validation objective, not a consequence of adding psychometric terminology.

Supporting a general placement profile for an exam goal does not unlock that exam's unavailable practice modules. Keep existing catalog availability and “Coming soon” behavior until the corresponding content is implemented.

### Required invariants

1. **Direct evidence for each skill:** Reading cannot supply a missing Speaking estimate. A goal score never acts as evidence of current ability.
2. **Time has priority over extra testing:** Stop collecting responses at the deadline, save partial work, and report limited evidence honestly.
3. **Difficulty adapts; certainty is evaluated separately:** Two consecutive outcomes trigger an evidence check. They do not automatically establish a level or permit stopping.
4. **Missing evidence is distinct from incorrect answers:** Skips, playback failures, microphone denial, and empty timeouts never become zero-ability scores.
5. **Skill differences remain visible:** Preserve strong Reading and weak Speaking instead of smoothing them toward a common average.
6. **No synchronous AI dependency between activities:** Writing and Speaking evaluation may finish asynchronously. An upstream failure must not fabricate scores or block access to available results.
7. **An unfamiliar format must not determine placement:** Provide a worked example and accessible instructions before collecting evidence.

This design takes inspiration from adaptive testing, including DET. DET estimates item properties from prior response data and uses a substantial item bank; its published methodology does not establish a universal two-attempt stopping rule [S1].

## 2. Time budget and deadline behavior

### Standard-mode allocations

| Phase | Maximum seconds | What the allocation includes |
| :--- | ---: | :--- |
| Introduction and device check | 45 | Essential help, privacy disclosure, sound/microphone check, permission request, and readiness confirmation |
| Reading | 120 | Worked example, passage display, answers, any additional adaptive block, and saving |
| Listening | 120 | Worked example, question preview, all clip playback, answers, and saving |
| Writing | 135 | Prompt reading, a short response, an optional follow-up, and saving |
| Speaking | 105 | Instructions, preparation, recording, an optional follow-up, and saving |
| Inter-stage transitions | 15 | Three transitions of at most 5 seconds; advance sooner when the learner is ready |
| Results/status window | 60 | Remaining upload/evaluation wait and rendering available results or pending states |
| **Total** | **600** | **10:00, including preparation and the results/status window** |

These are ceilings, not required durations. Finishing a phase early shortens the attempt; the first version does not redistribute unused time into longer tasks. The normal response-collection budget is **540 seconds**, with **60 seconds** reserved for the results/status window.

### Clock and recovery rules

- Establish a persisted global deadline when the introduction opens. Each stage also has a deadline bounded by its own allocation and the remaining collection budget. Opening help, changing tabs, or reloading does not restart either deadline.
- Reuse the existing injected clock and [countdown tracker](../app/lib/core/exams/countdown_clock_tracker.dart). Recompute remaining time on resume instead of counting timer callbacks. Test suspension and reload behavior explicitly.
- Do not begin a block whose authored display/playback and minimum answer time cannot fit. End the stage with its existing evidence instead.
- At a stage deadline, preserve answered items and current text, stop/finalize active recording safely, and advance. An unanswered item remains missing. A device or browser failure remains a technical failure.
- If setup is still incomplete at 45 seconds, offer continuation with available skills, a clearly separate longer session, or deferral. Never auto-start microphone capture or assume consent. Setup and content-download delays count toward the standard budget.
- At the global collection deadline, accept no new responses for that attempt. Finalization and upload recovery may continue asynchronously. At the end of the results window, show available results with explicit pending/failed components and a route to practice.
- The app cannot guarantee that an OS permission dialog closes or that a suspended browser paints a screen at a particular instant. On return, enforce the elapsed deadline. Network completion and final AI feedback are not guaranteed within 10 minutes.
- Longer help, accessibility timing adjustments, an explicit pause, or returning after a long interruption use a visibly labeled extended/resumed mode. Do not include those sessions in claims about standard-mode timing or equivalent scores without validation.

Prefetch the selected content family's likely branches during goal selection and introduction, using existing cache/checksum mechanisms. Do not make a learner wait through an unbounded loading screen to preserve the ten-minute claim. If essential content is unavailable, offer deferral or an explicitly incomplete check.

## 3. Beginner help and UI/UX

### 3.1 Introduction (`/diagnostic/intro`)

Use existing [design-system components and tokens](./design.md), responsive constraints, and the immersive workspace pattern. Do not introduce a separate visual language or hardcode a dark-only palette.

Suggested copy:

> **Find your starting practice level**  
> Read something short, listen to a short clip, write a few sentences, and speak briefly. No exam experience needed. Questions adjust to your answers. The standard check takes up to 10 minutes; some feedback may arrive later.

A short reassurance line explains: **“This is a starting estimate. Hard questions are normal. You can skip a skill.”** Difficulty changes must not be described as a reward, punishment, or a way to unlock faster finishes.

Keep essential preparation short:

- Use your own English. Avoid translation tools, answer assistance, and prepared answers. Explain that this helps select suitable practice.
- Play a sample sound. Ask the learner to confirm hearing it; successful playback alone does not establish audibility.
- With permission, record a brief test and offer playback. Separate denied permission, absent input, and possible noise. Discard this test recording after preflight; it is not proficiency evidence.
- Explain that submitted writing and recordings are sent for evaluation, with a link to existing retention/deletion information. Do not record or upload before consent.

Primary action: **Start check**. Secondary action: **Do this later**. Also expose **Continue without Speaking** and **Need more help/time** when relevant. A skipped diagnostic remains reachable from Home.

### 3.2 One instruction pattern per skill

Show each instruction at the start of its stage, inside that stage's budget. Supply one tiny, unscored worked example. Further explanation belongs in an optional help sheet.

| Skill | What to do | What to avoid |
| :--- | :--- | :--- |
| Reading | Read the short text and choose answers supported by it. | Do not answer from outside knowledge or spend the whole stage on one question. |
| Listening | Read the brief choices, listen, then answer what you heard. | Do not infer the answer only from the first word or number. |
| Writing | Write a few complete sentences in your own words. Simple language is welcome. | Do not paste a prepared answer or inflate length with unrelated text. |
| Speaking | Use the preparation time, then explain your own idea naturally. Self-correction is fine. | Do not read a prepared script. If the microphone fails, report the problem instead of forcing a recording. |

Avoid requiring exam-specific techniques such as C-test completion, sentence rearrangement, or distinguishing “False” from “Not mentioned” during this onboarding check. Those can be taught in later exam practice.

### 3.3 Accessible, calm interaction

- Show skill progress and approximate remaining time. Use neutral transitions such as “Next: a short listening activity.” Do not expose live level changes or correctness colors during scored activities.
- Keep a persistent help action. In standard mode, help consumes the shared budget; provide an explicit option to leave standard timing for more help. Do not quietly disadvantage learners who need instructions repeated.
- Support keyboard navigation, screen-reader labels, visible focus, appropriate touch targets, text scaling, and narrow screens. Allow scrolling; a fixed half-screen/no-scroll layout is not an invariant.
- Localize instructional UI while keeping assessment stimuli in the intended English form. Record instruction language/mode for validation.
- Prevent the on-screen keyboard from hiding the writing prompt or submit action. Preserve the draft through focus and layout changes.
- Label recording states clearly: ready, recording, saved, uploading, evaluating, and failed. Confirm exit and retain saved work; a deep-linked exit must have a Home fallback.
- Provide permission-denied and no-microphone paths without blocking other skills. For hearing/speech disabilities, offer supported accommodations or omit the affected skill. Captions change a listening task; typed text does not measure spoken pronunciation. Record the mode and validate comparability before claiming equivalent scores.
- Assistive input, slow typing, accent, and device quality are not evidence of dishonesty or low proficiency. Do not grade keystroke cadence or automatically penalize pasted text.

## 4. Content: short, coherent, and independently interpretable

Use original, commercially permitted content under [ADR-008](./ADR.md). Start with a small set of everyday scenario families, such as community spaces, travel plans, or learning routines. Avoid specialist knowledge and culturally narrow assumptions.

A shared theme reduces task switching, but each passage, clip, and productive prompt must make sense independently. Earlier material must not disclose a later answer or supply wording that the scorer treats as independent vocabulary evidence. Test topic familiarity and cueing during the pilot.

Author enough distinct blocks to cover every supported routing path, including repeated same-tier confirmations. Verify this by enumerating paths against the actual bank. Reserve alternate forms for retakes and validation; a memorized block cannot count as fresh evidence. Expert review establishes intended coverage, not empirical calibration.

### 4.1 Reading: two to four short blocks within 120 seconds

Each block contains a short passage and **two three-option comprehension questions**, using the same interaction throughout. Cover an explicit detail and a meaning/relationship question appropriate to the text. At the lowest tiers, the latter can be a simple sequence or purpose question.

| Authoring tier | Initial text-length target | Intended evidence |
| :--- | :--- | :--- |
| A1–A2-oriented | 25–40 words | Concrete information, everyday vocabulary, simple relationships |
| B1–B2-oriented | 40–65 words | Main point, paraphrase, reasons, and clear inference |
| C1–C2-oriented | 60–80 words | Qualification, stance, implied relationships, and scope |

These are authoring targets, not calibrated difficulty values. Natural complexity and item performance matter more than word count. A tiny advanced passage cannot establish mastery of sustained academic reading or reliably separate C1 from C2 on its own.

Illustrative, **unvalidated** block:

> The library usually closes at six. This Friday it will stay open until eight for a free workshop. Visitors can join the workshop without booking, but anyone who wants to borrow a laptop must reserve one online before Friday.

1. When does the library close this Friday? **Six / Eight / Before Friday**. Key: **Eight**.
2. What requires advance booking? **Attending the workshop / Entering the library / Borrowing a laptop**. Key: **Borrowing a laptop**.

Pilot pacing target: reserve approximately 10 seconds for the worked example and 5 seconds for final saving, leaving 105 seconds for blocks. Three blocks averaging 35 seconds fit; a fourth is possible only when earlier responses leave enough time. Never force it by shortening the minimum reading/answer window. Validate these pacing assumptions on real learners.

### 4.2 Listening: two to three short blocks within 120 seconds

Each block contains a **10–20 second clip and two three-option comprehension questions**. Reserve approximately 10 seconds for the worked example and 5 seconds for final saving. Three blocks averaging 35 seconds then fit: for example, 5 seconds preview, 20 seconds playback, and 10 seconds answering. These are pilot pacing assumptions, not response-speed requirements. If a learner needs longer, preserve the minimum answer window and collect fewer blocks instead of treating speed as ability.

- Vary language complexity, explicitness, discourse relationships, and natural delivery across authoring tiers. Do not define CEFR difficulty solely through words per minute, accent, background noise, or overlapping speech.
- Use clear recordings with reviewed scripts, keys, and timestamps. Check synthesized speech with human listeners; generated audio does not establish calibrated difficulty or pronunciation validity.
- Standard mode plays each clip once. If playback fails, void the affected exposure and retry when feasible or mark it unavailable. An accessibility replay mode must be identified and separately validated.
- Use comprehension answers as Listening evidence. Do not require spoken echoes or typed dictation; those introduce speech, memory, spelling, and typing effects beyond the intended task.

Illustrative, **unvalidated** script:

> A: “Are we meeting at the art club on Wednesday?”  
> B: “The room is busy then, so we've moved it to Thursday. Please bring a pencil. Paper will be provided, and beginners are welcome.”

Ask **which day** and **what to bring**, using three concise options each. This illustrates explicit-detail sampling; other blocks must cover purpose or inference where appropriate.

### 4.3 Writing: one short response and an optional follow-up within 135 seconds

Use an accessible prompt that permits both simple and sophisticated language. Do not cap productive ability based on Reading/Listening placement.

Example base prompt:

> A new library opens near you. Would you visit? Say when, explain why, and give one example. Write a few complete sentences in your own words.

Initial allocation: **15 seconds to read, up to 75 seconds to write, up to 40 seconds for a follow-up, and 5 seconds to save**. Target approximately **35–55 words** for the base answer. A further **15–30 words** may help, but targets are guidance rather than automatic ability cutoffs.

The follow-up stays in the same format:

- **Supportive:** If the learner asks for help or the first response is too limited to assess, ask: “What is one thing you would like to do there, and why?”
- **Extension:** Otherwise, ask: “What might make a visit difficult? Suggest a solution.”
- Both allow natural language at different levels. A validated response-based routing model may later select more demanding variants. The initial version must not infer advanced proficiency from rare words or clause counts.

The learner may submit early or decline the follow-up. Record reduced sampling when relevant. There is no scrambled-sentence substitute for actual writing and no synchronous AI call required to unlock the next stage.

Autosave through the existing draft/repository boundary with a short debounce and explicit flush on submit, transition, and lifecycle events. Document the residual loss window and handle persistence failures visibly; a timer tick alone is not proof of saving.

### 4.4 Speaking: one personal response and an optional follow-up within 105 seconds

Use direct spontaneous speech instead of an imitation test. The preflight already checked the microphone.

Example base prompt:

> Tell us about a place where you like to spend time. What do you do there, and why do you like it?

Initial allocation: **10 seconds for instructions, 15 seconds preparation, up to 45 seconds recording, up to 25 seconds for follow-up instruction/recording, and 10 seconds to finalize/save**.

Show short cue labels: **Place · What you do · Why**. A short accessible prompt may also be played aloud; include playback in the instruction budget.

- **Supportive follow-up:** “What is one thing you do there?” if the learner asks for help or supplies little usable speech.
- **Extension:** “What would you change about that place, and why?” when an additional sample is feasible.
- The follow-up is optional and bounded by remaining time. Do not require instant ASR or model grading to choose it.
- Stop capture on time, interruption, explicit cancellation, or consent withdrawal. Save recorded audio before upload; keep failed uploads recoverable.
- No universal 45-second threshold guarantees stable fluency/pronunciation measurement. Sample length, quality, task coverage, and empirical validation determine what can be inferred.

## 5. Adaptation and stopping: one consistent policy

### 5.1 Initial objective-task routing policy

Apply this policy only to **Reading and Listening**. Writing/Speaking use the direct-response follow-ups above; they do not pretend to generate independent binary IRT observations.

Use six **ordered authoring tiers** labeled A1-oriented through C2-oriented. The labels refer to intended content demands, not fixed logits or certified learner levels. Validate item order and the initial tier in the pilot.

Start at **B1-oriented content** as a provisional usability choice. Compare it with alternatives in the pilot; do not assume B2 is appropriate for every beginner. Selected exam and target score do not change the initial ability estimate.

Each presented block receives exactly one routing category when it ends. Preserve any valid individual answers even when an incomplete block has no usable block-level routing signal:

| Observed outcome | Category | Default next action |
| :--- | :--- | :--- |
| Two correct answers | `strong` | Try the next harder tier; if a failed tier bounds the next step, use an independent confirmation as described below |
| One correct answer | `mixed` | Use a fresh block at the same tier |
| No correct answers, both attempted | `low` | Use a tier strictly below the lowest `low` tier seen so far, unless already at A1 |
| Skipped, incomplete, or invalid exposure | `no_evidence` | Record the reason; offer easier content after “I don't know,” or a technical retry/skip without assigning incorrect answers |

More exact selection rules:

1. After `low`, choose the next lower tier below the lowest failed tier, bounded at A1. At A1, use a fresh A1 block if time permits; report limited lower-range evidence if difficulty remains unresolved.
2. After `strong`, if there is an observed `low` tier above the current tier, select an untested tier between them when available. Otherwise, confirm the successful tier with a fresh block. Without such a bound, move one tier harder, bounded at C2.
3. After `mixed`, choose a fresh same-tier block. If the bank cannot supply one, stop with a content-limit reason rather than repeating memorized material.
4. If a harder tier has a `strong` result despite an easier `low` result, flag contradictory evidence. After `strong`, this conflict rule takes precedence over rule 2: select a fresh block at the lowest conflicting `low` tier when feasible. Keep all outcomes; do not erase a possible slip or lucky guess. After `low`, rule 1 still applies.
5. At C2 with continued success, confirm using a fresh block if useful and feasible. Otherwise report a ceiling-limited practice suggestion; do not assert that maximum ability has been identified.
6. Use only unused, eligible blocks. Resolve ties with a persisted selection seed and record the selected block IDs. A reload must not change the already selected task.

State includes presented/answered block IDs, individual responses, authoring tiers, response-quality reasons, coverage tags, streaks, remaining budgets, selection seed, and content/policy versions. Recompute outcomes from answers; do not accept a client-supplied ability score as authoritative.

### 5.2 Evidence check versus budget stop

**Pilot policy:** Target **three valid, independently authored blocks** per objective skill, subject to the cap of **four presented Reading blocks** and **three presented Listening blocks**. After three valid blocks, end planned sampling. Reading may use a fourth block only to investigate a `mixed`/contradictory result or an unresolved lower-range failure, and only if it fits. This is an administration limit, not a claim of psychometric convergence. Skipped or invalid blocks consume presentation/time budget but do not satisfy the three-block target. A technical replay of an unanswered block is not a second observation.

Two consecutive `strong` or `low` outcomes trigger the coverage/uncertainty check. In the initial uncalibrated pilot, they do **not** enable early completion after two blocks. In particular, two failures require easier probing while budget remains, not an automatic beginner label.

A future validated policy may stop after two blocks **only if that exact short path meets all the following conditions in held-out learner data**:

- Enough direct, usable evidence and the required content coverage for that skill.
- Sufficient information under an empirically fitted model, accounting for dependent questions within a block.
- A validated uncertainty/placement-error criterion, including performance at ability extremes and for relevant learner groups.
- No unresolved response contradiction, technical problem, or unmeasured floor/ceiling distinction relevant to the reported range.

Covering adjacent difficulty tiers or observing a pass/fail reversal is useful routing evidence. Neither proves a precise ability boundary. Multiple questions about one text are not automatically independent observations. Content coverage includes detail, meaning, and relationships, not merely a numerical difficulty span.

**Budget stop:** Reaching the stage deadline, presentation cap, global deadline, or available-bank limit always ends the stage. It does not mean the evidence check passed. Persist the stop reason and produce a broad provisional suggestion or insufficient-evidence result, as appropriate.

Keep `sampling_complete`, `stage_timeout`, `global_timeout`, `presentation_limit`, `content_limit`, and any later `validated_evidence_stop` distinct. Fewer than three valid pilot blocks must be flagged as reduced sampling and cannot satisfy the pilot's full sampling target.

Check global expiry before stage expiry. Otherwise apply the sampling-completion rule, then the presentation cap, then next-block availability/fit before selecting another task. Record coincident limit flags alongside the primary stop reason. This ordering must match in client and server fixtures.

Illustrative pilot paths; outcomes show content sampling, not known “true levels”:

| Response pattern | Next action | Permitted conclusion |
| :--- | :--- | :--- |
| B1 `strong`, B2 `strong` | Try C1 if time permits | Higher practice may suit the learner; two successes alone do not establish C1/C2 |
| B1 `low`, A2 `low` | Try A1 if time permits | Lower-range evidence remains unresolved; do not stop solely because two attempts failed |
| B1 `low`, A2 `strong` | Confirm A2 using another block | Gather evidence around a possible transition; no exact boundary is proven |
| B1 `mixed`, B1 `strong` | Try B2 if time permits | Preserve mixed evidence and continue sampling |
| Playback failure or empty timeout | Retry/skip within remaining budget | Missing or invalid evidence, never an inferred low skill |

## 6. Scoring and uncertainty

### 6.1 Initial placement outputs

Report each skill separately. Store a status of **`provisional`**, **`pending`**, **`insufficient_evidence`**, **`unscorable`**, **`failed`**, or **`skipped`**, with a reason and observed evidence. Unscorable refers to unusable input; insufficient evidence includes samples too limited to support placement; failed refers to an evaluation/upload failure with an appropriate retry action. Missing numerical scores are `null`, never zero.

The initial placement policy must be versioned and reviewed by language-assessment specialists:

- **Reading/Listening:** Use the full pattern of answers, task demands, coverage, and contradictions to suggest a broad practice range. Do not average ordinal CEFR labels or convert raw percent correct across different routes into an exam band.
- **Writing/Speaking:** Use short-form, descriptor-based rubrics and direct response evidence. Outputs support broad practice suggestions and specific observations; they do not inherit full-exam rubric accuracy.
- Where a range is not defensible, show an available observation and “More evidence needed.” Do not force every attempt to produce four levels.
- Until empirical CEFR alignment is demonstrated, use labels such as **“Suggested practice: intermediate — provisional.”** CEFR-labeled content may be offered as a practice recommendation, explicitly distinguished from the learner's measured CEFR level.
- Qualitative evidence labels describe sampling limitations. They are not calibrated confidence percentages. Do not show “high confidence” or a fixed numerical margin based only on word count or recording duration.

### 6.2 Productive-skill rubrics

| Skill | Assess from the actual response | Sufficiency and distortion controls |
| :--- | :--- | :--- |
| Writing | Task fulfillment; clarity and local organization; appropriate vocabulary; grammatical control and demonstrated range | Cite exact response excerpts. Accept simple effective language. Short text cannot establish sustained essay organization or every advanced structure. Judge errors in context. Word count and lexical variety are supporting descriptors, not direct ability scores. |
| Speaking | Comprehensibility and pronunciation; continuity and organization; vocabulary; grammatical control and demonstrated range | Evaluate raw audio with an audio-capable model. Link observations to verified audio segments. A transcript alone cannot establish pronunciation. Distinguish recording failure from learner performance; do not invent causes for pauses or treat a non-native accent as an error. |

Prompt-specific descriptors must recognize what the task actually gives the learner an opportunity to demonstrate. A supportive prompt must not impose a ceiling on a strong response; an advanced prompt must not turn unfamiliar subject matter into a language penalty. Exclude the learner's goal band from grading prompts.

Use the existing evaluation pipeline with diagnostic-specific, versioned rubrics. Treat user text/audio as untrusted assessment data, not model instructions. Validate structured output, allowed ranges/statuses, and quoted evidence. A malformed or failed evaluation remains pending/failed or unscorable as applicable; use bounded retries and the existing failure/refund policy rather than a fallback invented grade.

Do not introduce a deterministic text-complexity scorer, live ASR dependency, or a new NLP stack for the first release. If lexical metrics are researched later, use correct definitions—Guiraud's index is `V / sqrt(N)`—and validate their incremental usefulness on short responses. Do not use arbitrary feature/LLM blending weights, paste ratios, absolute microphone thresholds, or speech-rate rules as proficiency calibration.

### 6.3 Later calibrated scoring

Introduce an IRT model only after collecting suitable response data and testing model fit, local dependence, item stability, and group effects. Begin with the simplest model that fits; do not assume a 3PL, partial-credit model, or multidimensional model is necessary.

- CEFR labels are not item difficulty parameters. Estimate parameters from data and establish alignment through independent evidence.
- Blind chance on a three-option item is `1/3`; this is not automatically an estimated IRT lower-asymptote parameter. Do not assign guessing/discrimination constants or information-per-second multipliers without evidence.
- Compute EAP uncertainty from the fitted posterior distribution. An inverse-Fisher-information approximation is not identical to posterior standard deviation, especially with very short tests or boundary responses.
- Estimate and test prior sensitivity. A chosen normal prior is not “uninformative” by assertion. Goal preferences must not narrow an estimate's uncertainty.
- Do not enable cross-skill smoothing in the initial implementation. Any later correlated model must show out-of-sample improvement while preserving genuinely uneven profiles. It must never turn unusable/missing audio into a directly measured Speaking result.
- Numerical intervals require empirical coverage checks at a stated level, such as a 95% prediction interval for a specified reference outcome. Include item, rater, model, and linking uncertainty where relevant. A narrow latent-trait posterior does not by itself justify a narrow exam-score prediction interval.

## 7. Cross-exam use and score-prediction policy

The shared diagnostic supplies general practice placement. The selected exam controls later practice content and explanations, not an unvalidated conversion of the baseline into every test's scores. IELTS Academic/General Training, TOEFL, DET, and PTE have different task coverage and scoring rules.

**Initial results contain no universal exam-score conversion table or instant predicted-score switcher.** An optional “About your exam's scores” link may explain official scales, clearly separated from the learner's result.

Reference guardrails, checked 2026-11-17:

- **IELTS:** Official CEFR comparisons are approximate and the published overall-score chart does not establish individual-skill equivalence [S2].
- **TOEFL iBT:** For tests on/after January 21, 2026, ETS uses a 1–6 scale in half-point increments. Its CEFR comparison associates B1 with 3/3.5, A2 with 2/2.5, and A1 with 1/1.5. Comparable overall 0–120 reporting during the transition follows ETS's guidance [S3].
- **PTE Academic:** Pearson's July 2025 updated IELTS Academic concordance lists minimum PTE thresholds of **55 for IELTS 6.5** and **63 for IELTS 7.0**. These are official-test comparisons, not Mockza calibration values or admissions guarantees [S4].
- **DET:** Use official documentation to describe its scale and assessment methodology. Do not chain IELTS/CEFR comparisons into Mockza DET predictions [S1].

To enable a particular exam prediction later, collect suitably matched diagnostic/reference-exam data, validate predictions on held-out learners and prompts, report errors across the ability range, and establish useful individual prediction intervals. Validate each exam, version, and overall/skill output being claimed. Overall concordance cannot silently substitute for per-skill linking.

Store source, test version/effective date, applicable population, output type, and validation version for every future linking model. If evidence is insufficient for a target exam or ability range, leave that prediction unavailable. A disclaimer does not remedy an unsupported numerical score.

## 8. Results, recovery, and first useful action

Proposed route: `/diagnostic/results/:diagId`.

- Show four skill rows with broad practice suggestions or explicit **Evaluating**, **More evidence needed**, **Recording unavailable**, or **Skipped** states. Do not fill missing skills with copied values or draw precise charts from placeholder numbers.
- Present one or two verified observations per evaluated skill and a short explanation of the limitation: **“A short starting check. Your profile improves as you practise.”**
- Start Writing evaluation as soon as its response is safely submitted; Speaking evaluation follows saved/uploaded audio. They may overlap. Show saved/uploading/evaluating states and permit leaving safely instead of trapping the learner in a spinner.
- At the results deadline, surface available information and **Continue to practice**, even if AI work remains pending. Updates must not overwrite a newer retake or discard previously completed skill results.
- Recommend a short drill for a weakness supported by direct evidence. If no weakness is established, offer a neutral starter activity rather than inventing a lowest skill.
- Offer **Check this skill again** using an alternate form. Explain that it is a separate activity outside the original ten-minute budget. Retaking one skill preserves the other results, with visible timestamps and versions.
- Refine the profile through subsequent ordinary practice. Do not equate practice improvement or a longer mock with a guaranteed error margin. Keep assisted/study-mode observations distinct from validated assessment evidence.
- Preserve access to the produced baseline when entering existing paywall/navigation flows. Avoid adding conversion interruptions before the learner receives the initial useful result.

## 9. Implementation ownership and durability

This section describes proposed changes; it does not claim they are already implemented.

| Responsibility | Existing owner / proposed extension | Required behavior |
| :--- | :--- | :--- |
| Onboarding and navigation | [onboarding notifier](../app/lib/features/onboarding/presentation/onboarding_notifier.dart), [routes](../app/lib/routing/routes.dart), [router](../app/lib/routing/app_router.dart) | Replace the current diagnostic-to-Speaking destination with intro/session/results routes. Preserve skip/Home navigation and deep-link exit safety. |
| Session UI/state | Proposed `app/lib/features/diagnostic/` | Use existing feature-first Riverpod/repository patterns for stage state, help, drafts, timeouts, and recovery. Keep widgets free of scoring/network policy. |
| Objective checking and routing | Extend [core/exams](../app/lib/core/exams/) and [backend domain](../backend/packages/domain/src/) where responsibility fits | Reuse objective answer normalization/checking. Add the small pure tier-routing policy and immutable diagnostic types; do not build a parallel full-exam framework. Use shared versioned fixtures to verify Dart/TypeScript behavior. |
| Timing | [countdown tracker](../app/lib/core/exams/countdown_clock_tracker.dart) and injected clock | One persisted global deadline plus bounded stage deadlines. Correct resume/timeout semantics; no deadline reset on rebuild or help. |
| Local persistence | [database](../app/lib/data/db/app_database.dart), [tables](../app/lib/data/db/tables/core_tables.dart), existing repositories/outbox | Reuse suitable attempt/draft/audio records; add a diagnostic session record only for state not represented elsewhere. Choose the next schema version at implementation time and prove upgrade, export, deletion, and recovery behavior. |
| Capture, playback, upload | [recorder gateway](../app/lib/services/audio_recorder_gateway.dart), [player gateway](../app/lib/services/audio_player_gateway.dart), [outbox sync](../app/lib/services/outbox_sync_service.dart) | Local save before upload, checksummed content, consent, bounded recording, permission handling, and recoverable upload failures. No diagnostic-only native stack. |
| API/contracts | [contracts](../backend/packages/contracts/src/), [evaluation routes](../backend/apps/api/src/routes/evaluate.ts) | Add a diagnostic-session contract and asynchronous submission/status aggregation around existing evaluation services. Reuse auth, ownership checks, input limits, idempotency, quota reservation, and dispatch recovery. |
| Evaluation | [AI package](../backend/packages/ai/), [worker jobs](../backend/apps/worker/src/jobs/) | Diagnostic-specific versioned rubrics and structured results; reuse audio processing and existing job infrastructure. No new MIRT, ASR, concordance-spline, or deterministic NLP service in the first release. |
| Content and verification | [content pipeline](../backend/content-pipeline/), [evals](../backend/evals/) | Original reviewed banks, answer evidence, usable alternate blocks, pilot datasets, route simulations, independent validation, and versioned release reports. |

### Session, API, and quota invariants

- Persist the attempt ID, collection/deadline timestamps, current stage, content/policy versions, block selection and answer history, drafts, audio references, mode, per-skill status/stop reason, and submission/result revision. Use existing storage records rather than duplicating large payloads in session JSON.
- Freeze the relevant content, rubric, and scoring versions for an attempt. The server recomputes objective answers and checks the submitted route against that version. Treat client timing as potentially unverifiable; do not claim proctored integrity from offline/client logs.
- Authenticate every new endpoint, enforce attempt/audio ownership, and bound response counts, text length, file size/duration, and provider work. Polling or aggregation must not create evaluations for another account.
- Give each skill submission an idempotency key and payload/version hash. Retries of an accepted revision reuse its job/reservation. Reject conflicting reuse and prevent stale completions from overwriting newer revisions.
- Reuse transactional job dispatch, leases, and reservation/refund behavior. Failure of one component must not erase successful components or trigger duplicate AI charges. Handle quota exhaustion visibly without blocking saved objective results.
- The current product specification describes one free Speaking **or** Writing diagnostic. This proposal needs both evaluations. Align the diagnostic bundle allowance, per-component reservations, retake limits, and measured cost with [PDR.md](./PDR.md) and [ADR.md](./ADR.md) before activation; do not silently reinterpret existing billing rules.
- Apply existing retention, user export/deletion, and provider restrictions to diagnostic text/audio. Deletion must also stop pending work from recreating deleted results. Keep raw responses, recordings, and personal identifiers out of analytics/logs unless explicitly covered by the existing privacy policy.

## 10. Validation and release sequence

### Phase 1 — Usability prototype and engineering proof

Use educator-reviewed but explicitly **uncalibrated** content with the deterministic routing policy. Test beginners and experienced learners on actual supported devices. Check comprehension of instructions, fatigue, mistakes caused by task mechanics, permission failures, keyboard behavior, and time-to-useful-practice.

Before progressing, verify:

- Every routing branch, all-correct/all-incorrect paths, mixed/contradictory results, floor/ceiling limits, skipped blocks, exhausted banks, and distinct budget/evidence stop reasons.
- Exact budget arithmetic, fit checks, no new collection after deadlines, background/resume/reload behavior, autosave failure recovery, and pending results at timeout.
- Client/server policy parity through shared fixtures; migration/recovery tests if persistence changes; authenticated ownership, quota, idempotency, and retry behavior for the new workflow.
- Narrow layouts, large text, screen readers, keyboard-only use, supported accommodations, missing microphones, interrupted audio, offline transitions, and slow networks.

Simulations prove policy behavior under assumed inputs; they do not prove learner accuracy or real-device timing. Report both simulated and observed timing. Measure time to status screen and time to final feedback separately.

### Phase 2 — Learner pilot and placement validation

Recruit a sufficiently varied learner sample across intended abilities, first languages/accents, ages within the supported audience, devices, and relevant accessibility modes. Determine sample size from the intended error estimates and subgroup analyses; an arbitrary small pilot cannot justify narrow margins.

- Obtain independent reference assessments. Use qualified raters for Writing/Speaking, blinded to Mockza output, with duplicate ratings and adjudication of material disagreement. Measure reference-rater reliability.
- Establish objective-task difficulty/order and broad placement-policy performance using suitable independent references. Check dependence within passages/clips, distractor quality, topic effects, response speed, timeouts, and repeated exposure.
- Split training/tuning/validation by **learner and prompt/scenario family** to prevent leakage. Keep a final held-out set untouched while choosing routing, rubrics, or thresholds.
- Evaluate broad placement agreement, materially harmful over/under-placement, abstention/insufficient-evidence rates, and performance by ability and learner group. Include incomplete attempts rather than reporting accuracy only for easy-to-score completers.
- Check short-form rubric consistency and bias. Evaluate whether supportive prompts and device/assistive modes affect interpretation. Treat slow typing or noisy recordings as potential confounds, not automatic language weaknesses.
- Predefine placement acceptance thresholds and subgroup tolerances with assessment expertise before opening the held-out results. If they are not met, revise the scope, widen the practice recommendation, or gather more evidence.

Release broad provisional placement only after its intended use is supported. CEFR learner labels require a documented alignment study; expert-labeled authoring tiers alone are insufficient [S5].

### Phase 3 — Optional calibrated adaptation and exam prediction

Add calibrated item selection/early stopping only if it improves held-out placement and completion outcomes over the simple policy. Choose uncertainty targets and any two-block paths from validated results, not from convenient logit constants.

For each proposed exam prediction, separately evaluate individual prediction error, bias, interval coverage and width, ability-level errors, and subgroup performance against that exam's reference scores. MAE or test-retest ICC alone cannot establish a claimed individual error margin. Report uncertainty in the validation metrics themselves.

Compare with simpler baselines and preserve a reproducible policy/rubric version for rollback. Revalidate material changes to content, model, provider, prompt, scoring, timing, or exam version. Do not enable complex cross-skill fusion merely because it is available.

### Operational and product measurements

Track consented, minimal events for stage completion, skips, stop reasons, technical failures, time-to-practice, retakes, and later evidence-driven placement changes. Measure upload/evaluation latency, success rate, total cost per completed profile, retry cost, and queue saturation under representative load. Do not publish a fixed latency or AI-cost promise before measurement.

The release decision should combine placement validity with completion, accessibility, fatigue, and the usefulness of the first practice recommendation. A faster test that consistently misroutes learners does not meet the objective.

## 11. Sources and interpretation boundaries

Official sources checked on **2026-11-17**. They inform assessment principles and descriptions of official scales; none validates Mockza's diagnostic or its future exam predictions.

- **[S1] DET — [An Overview of Duolingo English Test Administration and Scoring](https://duolingo-papers.s3.us-east-1.amazonaws.com/reports/Duolingo_whitepaper_test_scoring_current.pdf)**, updated August 2025, describing the July 2025 assessment. Supports response-dependent routing, prior-data item estimation, and the distinction between adaptive/non-adaptive sections. It does not establish Mockza's task counts or stopping thresholds.
- **[S2] IELTS — [IELTS and the CEFR](https://ielts.org/organisations/ielts-for-organisations/compare-ielts/ielts-and-the-cefr).** Explains why CEFR/test-score relationships are not precise one-to-one equivalences and identifies the overall-score scope of its comparison.
- **[S3] ETS — [TOEFL iBT 1–6 score-scale guidance and comparisons](https://www.ets.org/toefl/institutions/ibt/score-scale-update.html).** Gives the January 21, 2026 scale, CEFR comparisons, and transition guidance. Official comparison data must not be presented as a validated Mockza prediction model.
- **[S4] Pearson — [PTE Academic scoring and updated concordance](https://www.pearsonpte.com/pte-academic/scoring/).** Identifies the July 2025 IELTS Academic comparison and its minimum-threshold interpretation. Does not establish equivalence for a separate short diagnostic.
- **[S5] Council of Europe — [CEFR descriptors](https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors).** Provides the descriptor framework and links to the 2020 Companion Volume. Alignment of this diagnostic requires its own empirical and expert evidence.
