# Mockza × Sanjia — Unified Product, UX, UI, Functionality & Engineering Audit

**Version:** 1.0 · 28 November 2026  
**Audience:** Product owner, design team, engineering team, and repository-aware agents (Codex / Antigravity).  
**Scope:** Mockza Flutter (MF), Sanjia Flutter (SF), Mockza desktop web (MW), Sanjia desktop web (SW), shared backend and public Astro pages.  
**Objective:** Make all four experiences coherent, trustworthy, accessible, visually polished, and functionally equivalent wherever the platform and edition allow. The desktop web product must be desktop-native, not a cut-down version of Flutter.

## 0. Read this first — implementation instructions and evidence boundaries

The evidence consists of **102 supplied screenshots** (26 Flutter screens per edition and 25 desktop web screens per edition), the earlier 52-screen mobile audit (`mockza-sanjia-agent-audit.md`), and the four supplied v4.0 specifications (`PDR(2).md`, `ADR(1).md`, `PDR-Iran.md`, `ADR-Iran.md`). The filename inventory and cross-platform screen mapping are at the end of this document. The screenshot corpus is predominantly IELTS Academic, light theme, guest/new learner, with empty or initial states. No source repository, API logs, live browser interaction, device testing, paid account, populated attempt reports, dark-theme captures, or official score-validation study was supplied. The documents describe many capabilities as implemented/live; those claims are not independent proof of runtime behavior. No alleged customer complaint or backend defect is presented as fact without evidence.

**Evidence codes:** `O` = directly observed in one or more supplied screenshots; `D` = contradiction or ambiguity between documents/screenshots; `V` = verify via repository/runtime/official reference; `R` = proposed improvement. `O+V` means the visible problem is real but its implementation cause/impact requires investigation. An absent screenshot is never proof that a feature is absent. Priorities: **P0** = release-blocking correctness, safety, assessment integrity, privacy, financial or data-loss issue (conditional on verification for V items); **P1** = high-impact usability, product, parity, accessibility or reliability; **P2** = quality/polish; **P3** = separately approved strategic extension. No subjective scores are used as release criteria.

### 0.1 Non-negotiable implementation contract

- Read `AGENTS.md`, current PRD/ADR, route inventory, existing tests, and source of truth before making changes. Do not perform a wholesale rewrite or create a second competing design system.
- Preserve the warm Editorial Green / ivory / sage identity, exam-specific domain engines, offline-first persistence, edition isolation, original content IP, existing user data, and strict one mobile + one desktop active-slot policy. Preserve Flutter mobile ergonomics and React desktop keyboard/split-pane ergonomics. Do not blindly replicate mobile layout on desktop.
- Use `packages/design-tokens/tokens.json` and its existing generated outputs, shared contracts and parity vectors. Fix repeated problems in the common component/domain layer; avoid screen-specific hacks and hardcoded pricing, scores, counts, or sample user data.
- Treat `GLB` and `IRN` as distinct deployments, not an arbitrary language toggle. Preserve market-specific pricing, auth, billing, Navia and Persian explanations, unless the owner explicitly changes the policy. User feature parity does not require identical payment providers or an end-user admin console in Flutter.
- No AI hints, TTS coaching, pronunciation studio, answer revelation, transcript or study-only assistance in strict Exam Mode, except authorized accessibility/accommodation behavior explicitly classified and communicated. Do not invent assessment scales, promise official results, or make a short practice pack look like a calibrated full exam.
- For each ID below: inspect code, reproduce with fixture/account, record route(s), screenshot(s), source file(s), root cause, owner, solution, regression test and status. If already correctly implemented, mark **verified existing** with evidence rather than duplicate it. If policy conflicts, record a decision before altering behavior. No placeholder fake charts or counters.
- Run builds/tests sequentially per `ADR-015/018`: check `free -m` available >=900 MiB, respect repo heap caps and Flutter batches <=10 files, do not run heavy jobs together. Preserve Astro static-page and lazy SPA budgets, cross-parity tests, edition greps and schema compatibility.

## 1. Executive product assessment and release priorities

The product's strength is not another IELTS practice library. The specification describes a **closed-loop learner model** that identifies weaknesses, builds Durnama, prioritizes practice, captures evidence, verifies active production, and adapts. Screenshots instead emphasize independent tools, repeated calls to start, a static starter path, large empty charts, a technical catalogue and restrictive account copy. The interface must make the machine's reasoning and the learner's next meaningful action legible, without exposing model or implementation jargon.

**Desired experience:** A new learner chooses a track and target, receives a sensible starter activity (even if diagnostic is deferred), completes it, sees evidence-based feedback, understands what changed in their plan, and resumes the next activity on either client. An experienced learner can open the desktop app and immediately resume a timed simulation, write comfortably, compare real attempts, study vocabulary, use all Coach tools, and see the same learning state as on phone. Exam practice and communicative learning reinforce each other, rather than becoming two unrelated products.

| Order | Release concern | Impact | What success looks like |
|---|---|---|---|
| 1 | Assessment parity and integrity | Wrong questions/timers/score claims destroy trust | Same canonical pack, scoring, task and timing contracts; skill-specific rules and no exam assistance leakage |
| 2 | Data correctness & commercial truth | Contradictory counts, quotas, prices, sync | Server-backed entitlements, evidence semantics, accurate reset/renewal/discount copy |
| 3 | Persian BiDi and accessibility | English exam text and numeric fields become confusing | Native Persian chrome plus coherent LTR exam workspaces; keyboard, screen reader and text scaling work |
| 4 | Feature reachability and continuity | Desktop feels reduced; people cannot find results | Every learner capability has an equivalent desktop route, entry point and end-to-end test |
| 5 | Home / Coach / Roadmap guidance | Choice overload, low retention | One evidence-based next action, clear alternatives, adaptive feedback |
| 6 | Design system & responsiveness | Inconsistent polish, density and scrolling | Shared tokens and component contracts with platform-appropriate layouts |
| 7 | Commercial and operational reliability | Failed payments, recordings, offline work | State machines, recovery, privacy, secure sync and reliable cost accounting |

## 2. Requirement conflicts and high-risk correctness backlog (resolve before redesign)

The sources of truth below identify where to investigate, not a license to silently choose whichever value is convenient. Product owner must decide intentional commercial differences; technical owner verifies runtime settings. Capture exact build SHA/edition/account in tests.

| ID | Scope / evidence / priority | Problem, customer impact and proposed resolution | Requirement / acceptance |
|---|---|---|---|
| C01 | All · O+D · P0 | Global screenshots show $9.99 weekly, $19.99 monthly, $44.99 quarterly (desktop; quarterly below Flutter crop). PDR §8 and personas say $5.99, $14.99, $29.99. A customer may see different prices across checkout, store, FAQ and paywall. Decide actual SKU policy; fetch provider-confirmed prices, local currency/interval, tax and renewal terms. Use server/store authoritative values, not localization literals. | FR-006/007, ADR-010. Tests compare both clients, store/paywall/checkout/callback; updated docs. |
| C02 | SF/SW · O+D · P0 | IRN PDR §5 says 8+8 evaluations per day and 120/month; screenshots and ADR-IRN-007/008 describe 10+10 and 120/month. Proposed: confirm production quota, use one versioned entitlement source and explicitly document both daily per-skill cap and combined monthly cap. | FR-008, IRN-FR-006. Boundary tests across daily/monthly exhaustion, edition, restoration, failures. |
| C03 | MW/SW · O+D · P0 | Global and Iran paywall comparison table says 10/day while benefit header says 10 Speaking + 10 Writing/day; IRN table says 120/month; GLB 150. These are not interchangeable. Show `Speaking remaining`, `Writing remaining`, `Total monthly remaining`, reset time, and effective constraint. Free-plan Settings currently advertises Pro-like daily allowances; identify as Pro benefit or real free balance. | FR-005/008; `/v1/quota/me`; UI matches quota responses. |
| C04 | All · O+D · P1 | Diagnostic is ~10–15m Flutter, ~10m home/roadmap, 12m desktop goal and preflight, 15m Standard cap. FR-038 says consistent ~10m estimate with 900s cap. Use one policy-derived copy `About 10 min · maximum 15 min in standard mode`, disclose extended/replay options separately. | ADR-017; all surfaces including public, paywall and translations tested. |
| C05 | MF/SF vs MW/SW · O+D · P1 | Flutter Home track chip has dropdown affordance; docs FR-001 and ADR-IRN-002 say Settings-only switching. Verify interaction. Make chip read-only or a clearly labeled link to Settings, not hidden alternate switcher; practice filter must not alter learner track. | Changing track preserves history per track, resets/retrieves correct target and plan; no cross-scale leakage. |
| C06 | All · O+D · P0 | Vocabulary initial state shows 200 due on Home/mobile, 320 due on desktop list, 15/320 unlocked, 0 new introduced, 320 learning, 15 saved, 20 selected vs review capture 1/10. The captures may be different states/sessions. Distinguish total library, unlocked, introduced, due reviews, mistakes saved, daily new limit and session batch. Seeded unseen words are not due reviews merely because they exist. | FR-005/034–037/058; `VocabWaveScheduler`, `SerialDay`, SRS state. Fresh guest, introduced, partially completed, midnight and cross-device fixtures. |
| C07 | All · O+D · P0 | Desktop speaking Part 1 shows only topic string, 59s prep and 4m recording cap, 3 turns; Flutter same pack shows actual question, six turns (`P1.1..P3.6`) and 1:20 while microphone not allowed. IELTS domain matrix says 1m prep/2m turn belongs to Part 2. Verify task rendering and stage policy rather than use generic defaults. | FR-009–014, PDR §6, ADR-009. Every prompt/turn shown once, stage-specific prep/response/notes, identical content version and correct permissions. |
| C08 | All · O+D · P0 | Full Mock Flutter lists five stages (writing split 20m/40m); desktop lists four and uses IDs such as `ielts-listening-seed-01`. Writing screen shows 19:59 vs 59:59 for Task 1; listening 29:59 Flutter vs 03:39 web with same 3:40 recording. Differences might be deliberate stage policies or shortened packs. Define section/task/recording clocks distinctly; validate canonical session definition, timing and scoring aggregation. | FR-009–033, PDR §6, ADR-003/008/009; identical exam-equivalent policy across clients, not necessarily identical layout. |
| C09 | MW/SW · O+V · P0 | Full Mock uses seed IDs and catalog includes 3–4 question reading packs and 10 question listening packs. Confirm full mock actually contains appropriate full-length, calibrated content rather than short practice. If not, label it mini mock or practice and do not issue full-exam calibrated score. | `isCalibratedFullPack`, `LiveBandEngine`, FR-025–033/055. Validate pack manifests per track and time/sample minimum. |
| C10 | All · O+D · P0 | Short diagnostic described as calibrating an “exact band”; starter B1 and quick drill A2 recommendation coexist with no baseline. `currentBand == null` must mean unknown; B1 is a curriculum default, not assessed CEFR. No `+0.0` delta without baseline, no made-up confidence or chart polygon. | FR-040/055/056; ADR-021. Test no evidence, partial evidence, uncalibrated/calibrated scores, mode and track switch. |
| C11 | SF/SW · O+D · P0 | Navia copy suggests verified score usable for academic admission. Internal signed/mock validation is not official language certification or acceptance by universities. Show provenance, eligibility, explanation of limitations and consent. Disable/ineligible path when no qualifying score, not a green active send button. | IRN-FR-007, ADR-IRN-005/006, `/v1/account/navia-handoff`; backend rejects unqualified requests, preview and consent. |
| C12 | All · O+D · P1 | Four color presets documented, five displayed (Editorial Green plus four). Decide whether Green is base or fifth supported theme and correct requirements/test matrix. Never delete a working theme to match text. | FR-046, NFR-007–009, design token SSOT. All actual palettes × dark/light/system × locales. |
| C13 | MW/SW · O+V · P0 | Settings says microphone ready (0 input devices detected), active devices `0/1` and topbar `Synced` while Sign In is present. These are inconsistent or ambiguous UI states; permission/readiness and cloud sync must come from real state, guest can be local-only. | FR-041–044/062, ADR-003/016/022. Simulate no hardware, guest, offline, stale sync and live auth. |
| C14 | All · O+D · P1 | Raw identifiers, mixed untranslated app chrome, English punctuation reversed in Sanjia, conflicting native vs web labels. ADR claims sanitized UI and LTR boundary. Fix runtime paths, not merely static string scans. | IRN-FR-001/003/004/009, ADR-IRN-002/007/008. BiDi visual and semantic regressions. |
| C15 | MW/SW · O+D · P1 | Desktop Writing SVG title overlaps legend and tiny axis labels despite FR-046 explicitly requiring collision prevention. Fix shared renderer/layout on desktop and mobile with real data/asset tests; preserve units, values and legend meaning. | `ExamSvgChartCard`, `ChartStageCard`; screenshot at 100%, resized pane, 200% zoom. |
| C16 | SF/SW · O+D · P1 | Jalali setup is numeric day/month/year with prefilled-looking 1405/08/27, unclear selected “no date”, and no visible calendar picker. Verify null vs selected date; support accessible Jalali selection and calendar validation without storing Jalali as canonical data. | IRN-FR-002, ADR-IRN-002; leap Esfand, month rollover, timezone and date roundtrip fixtures. |
| C17 | MW/SW · O+V · P0 | Score calculators describe exact/official raw conversion curve and PTE/IELTS equivalence for immigration; thresholds shown are partial, PTE 10–35 missing and IELTS rows below 16 absent. Score mappings can vary by form/date/policy; avoid universal exact claim. Validate against versioned primary-source tables, specify estimates, purpose, publication date, ranges, no official guarantee; don't silently extrapolate. | FR-048, exam domain; cross-client fixtures for every legal value and boundary, out-of-range rejection. |
| C18 | SW · O · P1 | Quarterly badge 25% off vs 390,000 × 3 = 1,170,000 and 890,000 total gives ~23.9% savings; 25% is not exact unless another actual reference price exists. Global 44.99 vs 3 × 19.99 is ~25%. Compute from current same-currency same-period comparison and document rounding. | FR-006, pricing source. Automated display assertions. |
| C19 | All · O+D · P1 | Marketing, welcome and paywall emphasize IELTS even though architecture supports five tracks; avoid promising every task or AI grading on every exam without actual content coverage. Tailor feature copy to selected track and catalog. | FR-001/009–037; all five track screenshots and test data. |
| C20 | All · D+V · P1 | Documentation claims exact counts (e.g. 8/9 vector suites, 349 vectors, 372/373 assertions, 4/5 themes), 100% parity and verified production. Current captures contradict some claims. Generate measured inventory/version/test counts in CI; don't treat doc numbers as executable truth. | ADR-012/018 and NFR-011–015; update report from actual runs. |
| C21 | All · O+V · P0 | Mode switchers inside active web simulator while countdown runs, plus duplicated mode chips; changing to Study could reveal answers then switch back to Exam. Verify behavior; freeze assessment integrity once started or create clearly separate uncalibrated Study session, track provenance server-side. | FR-061, ADR-008/009/021; switching, refresh, direct URL and offline replay tests. |
| C22 | All · O+V · P0 | Paid AI action visible with empty writing/zero recordings and microphone denial. Confirm invalid empty jobs don't consume allowance; allow intentionally incomplete exam submission with review warning according to exam rules, not fabricated result. | FR-008/009–024; server validates content, job status and refunds. |
| C23 | MF/SF/MW/SW · O+V · P1 | Audio lock appears on Coach hub but intake screen still shows audio option; free sample wording repeated, different modality limits/availability by brand. Clarify shared vs per-feature sample and supported input limits, gate before capture/upload. | FR-005/008/053, ADR-020; entitlement matrix with real errors/retry. |
| C24 | All · O+D · P1 | PDR free starter allows 20 vocab reviews/day, Settings offers 5/10/20 new words per day, desktop 10 review session and wave of 15. Separate daily introduction preference, review entitlement, wave size and selected batch. | FR-005/034–037/058; do not conflate settings with entitlement. |
| C25 | All · D+V · P1 | Source says `exact USD cost` while ledger field is `estimatedCostUsd` and audio token count may not always be supplied by upstream. Record actual provider usage when available, estimated vs reconciled cost, currency/rate/pricing revision, and unknown token counters explicitly. | FR-063/064, ADR-022; reconcile ledger with provider invoices, failure and cached requests. |

## 3. Feature parity — desktop must be complete, not a mobile replica

### 3.1 Current screenshot evidence matrix

`Shown` means visible destination or surface, not complete verification. `Entry` means a label or CTA is visible, deeper screen/state not supplied. `Unseen` means no supplied capture establishes it. `Mismatch` means screenshot-level difference requiring reconciliation. Requirements are mandatory where specified even if no screenshot exists. The only legitimate exceptions are platform/edition-specific integrations, not silent omissions of core learning capabilities. Matrix includes public web-only pages and ops-only console for clarity.

| Capability / source | Flutter both editions | Desktop both editions | Required action / desktop behavior |
|---|---|---|---|
| Public landing, exam guides, sample banks, calculators, vocabulary, GEO | Platform-specific | Landing + 2 calculator captures shown; other pages unseen | Keep static Astro discovery separate; preserve deep link to matching simulator or mobile landing. |
| Welcome/5 track selection | Shown | Shown | Same localized descriptors/scale, optional diagnostic and guest behavior. |
| Goal/date/mode/interests/study time | Shown partially | Shown | Expose required daily minutes and correct date; persistence/back/skip and accent preference discoverable. |
| Guest/account, merge, auth provider choices | Shown | Shown | Recovery, provider capabilities, slots, sign in return, guest merge; verify OAuth/OTP only when supported. |
| Diagnostic preflight and accommodation | Shown | Shown | Same timing policy, audio/mic readiness, defer and partial coverage. |
| Diagnostic running/result/retake | Unseen | Shown (Reading + empty baseline) | All 4 skills and partial/retake cases must work both clients; PlanImpactCard with actual evidence. |
| Home / focus modes | Shown | Shown | One recommended action; resume; same learner state. |
| Durnama roadmap / topics & pace | Shown | Shown | Same order, pin/skip/start/completion semantics, milestone details and explanation of adaptation. |
| Practice hub and skill setup | Shown; reading setup | Shown catalogue | Desktop selection must support per-pack mode, skill rules, search, topic/difficulty/status, offline eligibility. Avoid adding redundant setup page if a contextual preflight works. |
| Reading annotations, focus/all, evidence review | Passage + color tools shown | Focused pane shown; annotation tools not visible | Keyboard and selection-based highlights/notes, independent scroll, review evidence; Study paragraph audio; no hints in exam. |
| Listening exam/study transcript & speed | Exam shown | Exam shown | Single-play, buffered start, consistent durations, study controls and synchronized transcript; offline asset readiness. |
| Writing all 11 task types, chart expand, drafts | IELTS chart shown | IELTS chart shown | Each task renders correct editor/interaction, autosave/recovery, task rules, chart keyboard zoom and export results. |
| Speaking all formats/turns and local capture | Actual Part 1 question + mic issue | Topic-only Part 1 + prep shown | Resolve C07; actual cue/question, mic readiness, recording state, playback when permitted, upload/retry. |
| Full mock, resumable stages | 5 stages shown | 4 shown | Reconcile schema not layout; stage durations, status, total, scoring and recovery. |
| Micro-drill catalogue and execution | Catalogue shown | Catalogue shown | Same drill coverage, recommendation and result/feedback, Mistake-to-Deck. |
| AI evaluation pending/result/inline rewrite and PlanImpact | Unseen | Unseen | Mandatory FR-020–024/057; full desktop review, pending recovery, evidence/criteria, new plan, TTS & pronunciation. |
| Coach hub | Shown | Shown | Shared mission and individual tools. |
| Daily Mission three-stage activity | **Shown** | **Entry only** | Verify `/app/mission/:missionId` (actual route inventory may differ); implement/repair complete generation, warmup, practice, production, submit, feedback, history, topic change. Desktop editor/audio layout. |
| Register Shifter | **Shown** | **Entry only** | Verify `/app/register-shifter` and run/result/verify-repeat; keyboard/recording, three registers, meaning, evidence, retry and follow-up. |
| Drop Anything | **Shown** | **Entry only** | Verify `/app/drop` and drill/history; URL, text, photo and audio if entitled; drag/drop + paste, generated quiz, vocabulary saves, original content, follow-up. |
| Error DNA / Weak spots and transfer matrix | **Shown** | **Entry only** | Verify `/app/progress/graph`; evidence, mastered expressions, topic customization, cross-topic transfer, drill launch and empty state. Desktop should exploit width, not omit details. |
| Vocabulary deck and SM-2 | Shown | Shown | Shared card state, personalization, save from mistakes, filters, due/session counts. |
| Flashcard review & card details | Review shown; definition example on front | Review shown; details entry | Same reveal/rating/review counts, audio, accent, IPA, examples, Persian glosses, source and active usage. Desktop keyboard shortcuts and centered reading card. |
| TTS and Pronunciation Studio | Entry on mission/vocab | Entry on vocab/review | Verify feature on all supported sources, history and result heatmap, appropriate privacy, no exam leakage. |
| Progress and individual skill analytics | Dashboard + Reading detail shown | Dashboard only (skill cards visible, no drilldown capture) | Provide clickable skill cards/explicit details, per-skill metrics, date/mode filters, recommendations. |
| Attempt history and attempt detail | History shown | Comparison shown, history unseen | Provide searchable attempt timeline, review/pending/retry, dates/track/skill/mode, compatible side-by-side selection. |
| Side-by-side comparison and export | Unseen | Shown empty comparison, export button | User data portable from both when supported; implement equivalent mobile comparison or sensible stacked view. Do not infer export formats from button. |
| Settings, devices, offline cache, preferences | Visible top portion | Shown comprehensive page | Expose all required settings on both, correct save state and eligibility; hide internal diagnostics in ordinary view. |
| Plans/purchase/restore/management | Shown top portion | Shown | Same per-edition terms, quota, state, restore, cross-device entitlement; platform-appropriate provider. |
| Navia score handoff | SF shown | SW shown | IRN only; eligibility, consent and accurate provenance; no GLB bundle leak. |
| Data deletion/export/privacy and audio retention | Settings lower portion unseen | Delete Account shown | Account-only plus guest local deletion flow; explicit retention/cascade status and secure export. |
| Admin trace console | Not required as learner UI | Documented; unseen | Role-protected operational surface; never distribute privileged key to browser/client or expose to learners. |

### 3.2 How to prove parity, not just count routes

Create a versioned capability manifest in existing test/docs structure, e.g. `docs/capability-parity.md` plus machine-readable fixture generated from real route/contract inventory. Each capability has `id`, requirement refs, edition scope, platform scope, entry point, route, prerequisite, entitlement, online/offline behavior, domain input/output, persistent state, error/recovery, accessibility semantics, owner and test names. Check **behavioral parity**, not just button presence. Build a navigation crawl from Home/Coach/Progress/Settings and direct links with appropriate guest/auth/entitlement gates; broken route, blank screen, missing navigation or unavailable equivalent is a bug. Desktop equivalents may be split-pane/dialog/route; mobile equivalents stacked/tabbed/sheet. For documented mobile-only capabilities shown in table, first inspect existing React route; don't duplicate an already implemented but undiscoverable screen. Test a learner completing a task on one client and reviewing its actual impact on the other. Use common fixture IDs, not copied screenshots. Every applicable capability must pass in MF/SF/MW/SW; exception must be documented and approved.

## 4. System-wide visual design, UI architecture, navigation and accessibility

The following are shared actionable issues. Proposed sizes are starting design-token targets in CSS px / Flutter logical dp, not blindly enforceable pixel values. Existing approved tokens and actual accessibility requirements win; verify contrast and layout. `O/R` indicates visible weakness plus a proposed redesign.

| ID | Scope / priority / evidence | Issue → target behavior and acceptance |
|---|---|---|
| U01 | All · P1 · O/R | Too many rounded bordered cards of equal visual weight, nested pills and similar green fills. Establish hierarchy: page title, one lead task, secondary groups, quiet text links; flatten ordinary lists and reduce nested decoration. Preserve brand palette. A card is a meaningful grouping, not a default wrapper. |
| U02 | All · P1 · O | Mobile is too tall/dense in routine cards; desktop often has tiny text and huge inactive horizontal/vertical areas. Introduce compact/comfortable density variants per surface; consistent 4/8 spacing scale (e.g. 16–24 card padding desktop, 12–16 mobile), moderate corner radii; keep buttons >=40 per documented spec and target 44–48 for touch. |
| U03 | MW/SW · P1 · O | Full-width flashcard, wide segmented bars, single-question listening and giant empty comparison area waste monitor space. Use content-aware widths: regular shell per ADR (`max-w-6xl`), reading text measure ~60–85 Latin chars, focused forms/card study workspace ~560–800px as appropriate, split panes full width where valuable; don't fill unused area with decoration. |
| U04 | All · P1 · O | Serif editorial headings are attractive but English display face extremely condensed on many desktop functional headings; body, badge and subtitle small. Use serif for identity/hero and selected large headings, clear sans for operational titles, body/controls/reading text; adopt explicit semantic type ramp (e.g. desktop body 15–16, metadata 12–13 not default for essential text), line-height and weight; Persian Vazirmatn with natural joining. |
| U05 | All · P1 · O | Monospace digits/score chips often overused and sometimes wrap incorrectly. Tabular numerals only for values/clock; do not apply Latin mono to Persian prose or IPA unsupported glyphs. Unify score scale, decimal separators and thousands formatting. |
| U06 | All · P1 · O+V | Buttons, filter chips, radio cards, toggle groups, icon-only affordances have varying outlines/selected/disabled treatment (mobile black outlined topics vs soft web pills, thick double-outline active milestone). Define common variants: primary, secondary, tertiary, destructive, selected, disabled, pending, icon button, segmented/tab and radio; distinguish selection/focus/disabled without relying on color. |
| U07 | MF/SF · P1 · O | Fixed bottom nav and CTA cut content below visible area; title/long descriptions truncated and chips clip. Add safe-area/scroll padding, keyboard-aware sticky action, full labels or accessible tooltip/details, wrap or intentionally scroll filter groups with discoverable affordance. Test 320dp and 2x type. |
| U08 | MW/SW · P1 · O+V | Topbar, fixed rail, page scroll and exam wrapper leave visible empty bottom strip below 852px in 900px captures; long screenshot rail ends at viewport height (may be intentional fixed sidebar). Verify true viewport behavior not crop artifact. Use `100dvh`/flex min-height/overflow boundaries, sticky footer within workspace, independent pane scroll; no unreachable content or layout shift. |
| U09 | All · P1 · O | Conflicting primary actions, repeated “Start step”/practice/home, multiple redundant mode indicators and tabs. One dominant CTA per state; secondary links, not competing solid buttons. Align label and action (start/resume/review/retake). Back/Exit behavior consistent, destination preserved. |
| U10 | MW/SW · P1 · O | Sidebar label `Mock Exams` includes drills and catalogue; mobile `Exams` vs `Practice Hub`; Home `Study room`, Coach, Roadmap duplicate entry actions. Standardize learner vocabulary across surfaces, e.g. Home, My Plan, Practice, Coach, Vocabulary, Progress, Settings; retain deep links. Pro accessible as account/subscription, not confusing learning destination. Preserve 5-tab mobile shell. |
| U11 | All · P1 · O+V | Refresh/sync icons, gear, undo/history glyphs and unlabeled mic controls lack obvious meaning. Name every control; tooltip for desktop icon-only actions, accessible label and visible intent for destructive/recovery. Don't equate generic network connected with data synced. |
| U12 | All · P1 · O | Empty screens use blank panels, tiny text and black inconsistent icon, no CTA. Shared EmptyState with purpose, actual prerequisite, one meaningful action and optional example explicitly marked sample; distinguish empty, loading, error, unavailable, no matches, locked, partial evidence. Hide fake graph/delta. |
| U13 | All · P1 · V | Validate actual text contrast for muted sage on ivory, ghost controls, link states, dark mode, chart axes and chips; design to WCAG AA as NFR says (normal text 4.5:1, large text 3:1; meaningful non-text boundaries/focus 3:1 where applicable). Do not infer conformance from screenshots. |
| U14 | All · P1 · V | Keyboard/screen-reader semantics: landmark/main/nav, headings, labels, radio/select/tab patterns, dialog trap/return focus, accessible pane separator, announcement of results and errors, avoid announcing timer every second. Visible focus independent of selected status. No shortcut hijacks typing, Persian IME, media controls or browser commands. Flutter Semantics equivalents. |
| U15 | All · P1 · V | Responsive reflow: test 320/360/390/430dp phones, tablet, 768/1024/1280/1440/1920 desktop, browser zoom 125/200% and large text, OS safe area/keyboard, landscape, collapsed rail. Intentional exam pane scroll allowed; page-wide accidental horizontal scrolling prohibited. Don't assume screenshot image dimensions equal CSS viewport. |
| U16 | All · P2 · R | Systematic icon consistency, logo parity (current mark is a strength), wordmark usage, semantic status colors, consistent hover/pressed/loading. Avoid “AI slop”: no excessive gradients, celebratory confetti, distracting mascots or gratuitous animation. Respect reduced motion. |
| U17 | All · P1 · V | Consistent loading/skeleton/error/retry and async state. Don't show placeholders as actual numbers, wrong “synced”, or multiple active CTA during pending request. Preserve typed data/scroll across re-render and navigation. Show stale date when using cached data. |
| U18 | MW/SW · P1 · O/R | Sidebar Sign In at very bottom only; little account/guest context; track chip + theme + sync disconnected. Keep stable header with track, truthful local/cloud state, profile/guest and theme; group secondary settings/plan actions. Collapse rail accessible, tooltips and focus retained; update `layout.store.ts` with existing storage key contract. |
| U19 | All · P1 · R | Make distinction between Exam Mode and Study Mode a coherent product concept (what help is allowed, timing, scoring eligibility), not a repeated generic toggle. Contextual descriptions per skill and mode. Confirm active-mode changes and lock calibration provenance. |
| U20 | All · P2 · R | Standardize microcopy tone: plain action labels, no “Orchestrator,” “calibration”, “target lock”, “band push”, “seed”, “wave” unexplained. Explain new concepts where needed, progressive disclosure of technical details. Don't overpromise exact bands or guaranteed improvement. |

### 4.1 Design system implementation

Extend existing tokens/components, not a new dependency. Define semantic tokens for canvas, surface, elevated surface, text, muted text, border, accent, focus, success, warning, danger, disabled, graph evidence/estimate and target. Verify both light/dark all actual presets. Use shared component API contracts across React and Flutter: `PageHeader`, `SectionHeading`, `PrimaryAction`, `StatusChip`, `SelectionCard`, `ModeSelector`, `EmptyState`, `ScoreValue`, `AudioPlayer`, `ProgressBar`, `ExamShell`, `QuestionNavigator`, `PlanImpactCard`, `EntitlementGate`, `InlineError`, `SyncStatus`, `ReviewCard`. Reuse existing equivalents when present; names are proposed, not mandatory rewrites. Build component state catalogue with long Persian text and English text islands. Export screenshot baseline for real fixtures, not generic design mockups.

### 4.2 BiDi, Persian localization and locale engineering (all Sanjia surfaces)

| ID | Priority / evidence | Observed or risk → required fix and test |
|---|---|---|
| L01 | P0 · O | SF Reading setup truncates English title from wrong side; SW card descriptions punctuation/phrase order corrupted (e.g. `question full ...-13`, `...card, 2 Part 3 Qs.`), SW Home English definition begins with period. Wrap complete English blocks with `lang=en dir=ltr` and matching `text-align:start`, not only individual words. English title and definition form same visual column in vocab; do not put word at far right and definition far left. |
| L02 | P0 · O | SF audio `03:40 / 00:00`, writing `150w / 0`, SW speaking `3 / 0`, calculators `40 / 39`, `۱۲۰ / ۱۰۰~`, reversed score ranges. Preserve semantic value-first ordering and explicit LTR isolation (`bdi dir=ltr`, `LtrExamBoundary`, Flutter `Directionality`). Test rendered text order, screen reader and copy/paste. |
| L03 | P1 · O | SF app controls include `Time Remaining`, `Save Offline`, `Submit Test`, `Allow Mic`, `Retry Permission`, `Open Settings`, `Start Recording Answer`, `Your Response`, `Hide prompt`, `Previous/Next`, `Focused/All`, `Exam`, `Sec 1`. SW report `No responses collected yet.` and catalogue raw English metadata. Translate app chrome, status and helper copy into natural Persian; keep English learning stimuli intact. Use `app_fa.arb`, `EditionCopy`, `web/src/i18n/fa.ts`, localized metadata mapping. Audit fallback strings, runtime errors and server stage codes. |
| L04 | P1 · O | English question/title alignment inconsistent in SW diagnostic and reading, English question counter and RTL nav conflict. Adopt explicit exam direction policy. **Recommended:** realistic LTR English workspace (passage/prompt left, response right, numeric question strip ascending LTR) even within RTL outer shell; if owner chooses mirrored layout, maintain complete LTR islands and chronological order. Do not mirror play/pause, clock or chart axes accidentally. |
| L05 | P1 · O | Numeric steppers `[-, slider, +]` already LTR on goal/settings but other bars/sliders mirror (calculator). Define directional policy by semantics (score scale/timer/decimal/calculator LTR, Persian reading-order progress bars may be RTL). Document ticks/min/max and target markers; fix ambiguously centered labels. |
| L06 | P1 · O | Raw `favorite_topics`, `marine_biology`, `af_bella`, `bf_emma`, `Kokoro AI`, `ielts-...-seed-01`, OPFS and cache values show implementation detail. Map stable IDs to localized human labels (e.g. «زیست‌شناسی دریایی»، «انگلیسی آمریکایی»، «دانلودشده»). Advanced diagnostics may show technical info in expandable section. |
| L07 | P1 · O | Inconsistent names «نقشه راه»، «دورنما»، «ریتم مطالعه»، «آزمون»، «تمرین»، «ارتقای اسپیکینگ»، «همایندها/همنشینی‌ها»; awkward translations and mixed `Band 7.5`. Establish Persian editorial glossary with native review; standardize half-space, punctuation, plural, Persian numerals for app chrome and Latin exam content. No blanket digit replacement of IPA, URLs, IDs, answer inputs. |
| L08 | P1 · O+V | Persian sample landing text is small; mixed direction in feedback/rubric and charts. Font shaping, line height, fallback, high contrast and alignment tests. `lang=fa-IR` on shell; `lang=en` on original English passages/rewrites; use localized labels for feedback and Persian meanings. |
| L09 | P1 · O+V | Jalali picker, Saturday-first weekly rhythm, Toman display, E.164 phone entry. Use existing edge formatting and stable UTC/SerialDay store. Test locale/timezone/reset behavior around midnight, leap calendar, mixed punctuation and Rial/Toman conversion. |
| L10 | P1 · V | Edition isolation is more than strings grep: ensure wrong edition credentials/headers rejected, assets/analytics/billing provider isolated, canonical/hreflang only valid markets, no IRN-only Navia in GLB. Verify actual runtime composition roots and manifests. |

## 5. Desktop web — detailed page-by-page audit (50 screenshots)

Each numbered item covers the English and Persian equivalent unless a brand is named. Apply shared IDs from §§2–4 as well. The desktop captures are mostly full-page 1440px views, not evidence of actual behavior at narrower widths. A large empty region is not intrinsically bad; judge it by task focus and efficient use of the workspace.

### W01 — Public landing (`01-landing`) · P1 · O/R

- **Value proposition:** “Practise today. Know what to fix.” is attractive but does not communicate adaptive learner modeling, the five exam tracks, or what the first session achieves. Keep editorial treatment; make headline/subtitle specify outcome, audience and method. Lead with a brief free level check OR a free practice path, not an unexplained simulator. Persian copy should sound natural and make benefit equally clear.
- **Conversion:** Header CTA says “Open Desktop Simulator”, which sounds like a separate download/tool rather than a browser application. Prefer “Start practicing” or localized equivalent; tell mobile visitors what works on their device and when desktop is recommended. Preserve meaningful public deep links; don't force sign-in before free practice. On the landing page distinguish sample feedback from an actual learner report.
- **Visual hierarchy:** In the supplied tall screenshot, header/nav/body and interactive demo labels appear much smaller than hero typography; verify at real viewport size. The notebook stock-like graph illustration is pleasant but says less about the product than an actual learning loop. Prefer a crisp representative sample showing prompt → mistake → evidence → correction → next practice. Don't add stock decoration or fake testimonials.
- **Demos:** Writing review has highlighted phrases, rubric bars, pagination and practice CTA. Ensure accessible keyboard selection, readable evidence and rubric labels, a clear current item and corresponding feedback, non-color-only highlights, and audio controls in speaking mode. Explain that sample scores are illustrative and independent. Reading/Listening report shows 3/4 and a sample explanation; make correct answer and distractor rationale prominent, then “Try a similar question.” Avoid low-contrast secondary text on dark green panel.
- **Information architecture:** Mock Exams + Smart Coach cards make sense, but explain how both improve the same plan rather than two products. Give concrete use cases (short daily practice, full desktop mock, weaknesses, real content). Add honest access/pricing overview, device policy, privacy/audio FAQ and non-affiliation disclosure at useful decision points, not hidden in footer. Public navigation is inconsistent between landing and calculators (Sample report/AI feedback/Study tools vs Score Calculators/Sample Essays/Academic Vocab); use consistent destinations/anchor behavior and active navigation.
- **SEO/GEO:** Keep primary copy, examples and links available without JS; use semantic headings, descriptive titles, meta/OG, localized canonical URLs and real crawlable guides. Preserve static budgets, lazy-load optional audio and image dimensions; test no JS, keyboard and slow connection. `llms.txt` belongs in machine-discovery surface rather than ordinary primary footer nav; verify content parity of Markdown twins, structured data and indexability. Do not assume 85 pages alone produces organic traffic. See FR-047–050.

### W02 — IELTS calculator (`02-calc-ielts`) · P0/P1 · O/V

- **Primary tool buried:** Large static threshold table appears before the converter, so the interactive task is below the fold. Put the IELTS calculator first: choose module, input correct answers 0–40 with slider and editable numeric field, show resulting estimated band and explanation. Place reference table beneath with full ranges, source/version and other tools as secondary links.
- **Score truth:** “Exact engine curve” and Persian “official curve” can imply universal official mapping. See C17. Distinguish reference thresholds from guaranteed official score, Academic vs GT and Listening; show missing score ranges or explicitly label excerpt. Ensure number entry, step sizes, clamp/validation, keyboard accessibility and no unsupported conversion outside mapped domain.
- **DET/TOEFL cards:** Labels `Lit`, `Comp`, `Conv`, `Prod` are abbreviated and unexplained, sliders lack visible scale endpoints; show named integrated subscores and underlying score range, rounding/methodology. If result is an approximate concordance, express range or clearly qualified value; do not imply an exact cross-exam conversion. Verify DET actual canonical computation instead of copying screenshot labels. Add descriptive labels and output live announcements. For SW, fix `40 / 39`, `۱۲۰ / ۱۰۰~`, range, digit and slider direction errors (L02/L05).

### W03 — PTE–IELTS concordance (`03-calc-pte-concordance`) · P0/P1 · O/V

- Table starts at 36 although slider range is advertised 10–90; explain or cover missing range, including unsupported equivalence. Verify updated provider tables and version. Do not claim concordance meets a particular Australian/Canadian immigration or university threshold; those organizations may use specific test/component requirements. Give an informational caveat and sources when implementing.
- Current slider shows 65 → IELTS 7.0 / CEFR C1. Verify mapping, ranges, step behavior, anchors and rounding against actual official published data; do not change scoring based solely on visual review. Add numeric input, exact score/range label, full table caption and accessible headers; distinguish comparison from conversion.
- Other calculators repeat across pages; make relevant tools useful links or compact related tools rather than generic repeated cards when they distract. Preserve cross-linking for SEO. Sanjia score ranges visually reversed (e.g. ۹۰–۸۵), mixed text/direction; isolate values (L02).

### W04 — Welcome & exam selection (`04-app-welcome`) · P1 · O/R

- Two-column 5-choice list and summary card are a reasonable desktop approach, but sparse intro and large bottom blank region do not explain the platform. Add concise product purpose and next step, visible step indicator, clear selected radio state, and explicit “Continue”. Keep card click keyboard/label semantics, meaningful default selection, and non-affiliation notice.
- No visible way to learn what exams are appropriate; optional “Not sure which exam?” explains differences without creating a separate unapproved track. Keep required track selection as FR-001. If general English-only path is desired, it is a future product decision (P3), not an unauthorized change to exam architecture.
- Sanjia mixed exam names are legitimate, but descriptive labels, score ranges and step number need isolation. Sign-in link should return to this flow after authentication or preserve existing progress. Do not show wizard to returning learner who already has a plan unless explicitly requested.

### W05 — Goal setup (`05-app-onboarding-goal`) · P1 · O/R

- The page simultaneously asks mode, interests, score and date; mode cards contain lengthy copy and topics appear all equally selected/unselected. Set goal first, then optional preferences (interests, pace, accent), default sensible values with clear selections and editable later. No date is a genuine null state. Provide selected chips with check/ARIA state and custom topics where existing feature permits.
- Daily study minutes (FR-002) not visible. Add an easy pace control (15/30/45/60 min or existing domain values) and clarify estimated daily plan. Avoid forcing all optional values. Target score field should support precise input, plus/minus and slider with scale/step and useful limits. CEFR helper must be approximate and exam-specific, not a claim of university acceptance. “Advanced · Top Universities” is misleading generalization; prefer reference CEFR level only where valid.
- Date presets and actual picker should stay in sync; date in past invalid or handled explicitly, optional date and locale display accurate. SW displays Jalali fields with low-contrast placeholder-looking date; clarify current/selected and use accessible Jalali picker.
- `Save Goal & Start 12m Level Check` vs `Go Straight to Dashboard` — use consistent duration per C04, make skip clearly save preferences too, e.g. “Save & start level check” and “Skip for now — start my plan.” Confirm both paths persist and back/refresh do not lose choices.

### W06 — Diagnostic intro (`06-app-diagnostic-intro`) · P1 · O/V

- Large horizontally stretched Standard/Extended/Accessible segmented bar suggests mutually exclusive accommodations even though time and replay may be independent; confirm actual policy. Use short description, default Standard and a clearly labeled accessibility settings group. Explain scoring impact of modified mode (if applicable), not a penalty.
- Speaker chime, mic check and 0% unlabeled progress bar share a row. Name status (speaker verified, mic permission/input, not tested). Do not confuse level meter with overall diagnostic progress. Use concise readiness checklist and clear skip speaking/defer. Preflight should not consume test timer.
- Worked example answers are displayed before test (soup container, yoga Room 7). Label “Unscored example” and ensure none of these items overlap selected diagnostic questions; never display live answers ahead of test. Use accessible sample audio/preview.
- `Continue without Speaking` and `Do This Later` need distinct explanations: partial diagnostic vs foundation plan. Show 4 skills, what is estimated, duration and privacy. Use a focused layout rather than three wide strips and lots of blank area.

### W07 — Diagnostic session (`07-app-diagnostic-session`) · P0/P1 · O/V

- At 14:59, two short reading questions occupy one large pane; no stage progress beyond header. Show “Reading · Block 1/… (adaptive)” where counts are known, remaining standard cap and actual answer state; don't claim fixed total if adaptive. Explain skip block vs skip skill without redundant controls. `Next Adaptive Block` disabled with no explanation; allow actual “I don't know” or defined response, tell user what is required.
- For SW, passage title right aligned while English paragraphs left aligned and questions in left pane. Implement L04 chosen workspace direction consistently. Full text and question cards should have matching LTR semantics. Resizable divider has tiny grip; keyboard access, minimum widths, accessible resize and independent scroll.
- Verify deterministic adaptive routing and deadlines on partial/skip/time expiry, fresh vs resumed, tab close and duplicate submit. No answer hints in diagnostic unless explicitly unscored. Save answers and preserve selection after resize or navigation. Keep Exit safe; communicate whether it abandons or saves partial progress.

### W08 — Diagnostic result (`08-app-diagnostic-result`) · P1 · O/V

- Empty baseline report has four equal cards all “Insufficient Evidence”, while top banner repeats four navigation actions and milestone strip. Distinguish not started, skipped, submitted, pending, completed, failed and insufficient evidence. If no responses, call screen “Your starting plan” (not a completed baseline report), show one starter CTA and skill-specific optional retake. If partial, show actual skills scored and explain missing evidence.
- SW has `No responses collected yet.` in English; fix localization. “Retake Skill” is misleading before first attempt; use “Assess Reading” etc. when never assessed. Do not present overall score from insufficient data. Show actual PlanImpactCard and roadmap recommendation only when supported by evidence; no invented changes. Remove manual Refresh as normal prerequisite; use reactive query state with explicit retry on error.
- Populated state not supplied. Verify all four skill scores/scales, sample coverage, confidence/provenance as measured, actual rubric evidence, retake results, plan revision, and cross-device sync. See FR-038–040, FR-055–057 and C10.

### W09 — Authentication (`09-app-auth-login`) · P1 · O/V

- Large centered split composition is clean but device restriction consumes nearly half screen before benefit/credentials. Explain value of sync and protected progress; present one-device-per-slot rule concisely with details. Guest choice and back/return context should be visible. “0/1 Open” is unclear and potentially misleading before sign-in; label slots as unknown until account fetched, then actual active devices.
- Email/password form lacks visible recovery, provider buttons, verification/resend, help or legal links. Verify current supported providers via `/v1/auth/providers`; do not advertise unavailable ones. Add password recovery/verification paths if not implemented (security reviewed). Support password managers, paste, autocomplete, keyboard, loading/error, show/hide with accessible label. Distinguish sign-in vs create account, prevent accidental account creation and merge confusion.
- SW SMS unavailable banner is truthful in test environment but a production-quality experience should not lead with infrastructure failure. If provider disabled, hide unsupported login tab and show simple email alternative; if temporary, state recovery path. Never claim domestic SMS works if not configured. Preserve guest progress when auth fails, signed-in route return, slot takeover/confirmation, account data isolation.

### W10 — Home / Study room (`10-app-home`) · P1 · O/R

- **Most important product issue:** The screen displays optional level check in hero, two feature cards, starter practice card with 3 CTAs, daily coach strip with 3 CTAs, readiness card with another level check, four skill links, and vocabulary due. The user must choose between many equally legitimate next actions. Reframe home around **Today's plan** and one next activity from `RoadmapGenerator`/mission/attempt state. Prioritize interrupted task (when valid), then recommended step. Explain why, time and expected skill outcome, not “calibrate exact band.” Secondary practice tools grouped below.
- Unknown band shown dash + “Building confidence”; this sounds like actual estimation. Use “Not assessed yet” and evidence coverage, not fake progress bar. Show target and date only if set; avoid auto-fabricated countdown. Weekly rhythm shows 0/7 and 0-day streak; frame as achievable progress, not punishment, weekday abbreviations accessible (Sanjia Saturday-first).
- Four skill cards are thin, redundant empty progress strips; use meaningful `Not assessed` per skill with links to a detail or recommended sample. Once assessed, show score, evidence type, target/gap and next practice. Make entire card keyboard-accessible or clear CTA.
- Vocabulary due 200 on new user vs 320 on deck page; fix C06. Show achievable review batch and new words separately. SW English definitions incorrectly ordered/aligned. Avoid repeated large section labels and tiny text. Use desktop grid with main plan and compact supporting sidebar (goal/evidence/weekly activity); preserve all capabilities as manual shortcuts and sidebar nav. User sees one primary above fold.

### W11 — Roadmap (`11-app-roadmap`) · P1 · O/R

- Four milestone cards fit desktop width but active double border, lock icons, jargon and tiny descriptions make roadmap look static. Use clear current/completed/upcoming/locked status and reason; show estimated workload and progress grounded in real tasks. Future milestones should be previewable unless deliberately gated; don't confuse learning dependency with payment lock.
- Each of three active steps offers Start, Mark Step Done, Skip. Emphasize one current recommendation; other actions as secondary/menu. Self-marked completion is not verified mastery or assessment. Pin/skip/complete semantics in FR-056 must exist with reversible actions where appropriate and explain plan reorder. Do not force optional level check before foundational activities.
- Show evidence basis: “Start with familiar topics while we learn your level,” or observed error/task opportunities, why recommendation now, target skill, next planned step. Do not label B1 as measured if diagnostic skipped. “Topics & Pace” should open real settings with explicit daily minutes, interests, date and effect on plan. Make count of upcoming steps actual and expanded view stable.
- SW use ascending milestone numbering in chosen RTL chrome and correct mixed numeric chips; both clients should share stable step IDs and route resolver. After task completion, reflect PlanImpact, not a static checkmark list. Test concurrent updates across phone/desktop and stale plan revisions.

### W12 — Practice catalog (`12-app-practice`) · P1 · O/R

- Dense 3-column uniform cards, long scientific titles and repeated launch/save buttons make catalogue hard to scan. Introduce compact list/grid choice or responsive list for desktop; recommended next pack first; concise localized metadata (skill, duration, item count, difficulty/level only when known, completion, offline state), full title wrap and search/filter. Group `For Your Path` vs `All Tests` with explicit active scope; skill filter not duplicate selected track chip. Show real results count and reset filters.
- Every card shows `Save Offline` even if not available/ready; display actual states and storage use in understandable terms. Move `OPFS Cache` and KB details to storage manager or compact status. `Sync Catalog` is manual implementation jargon; automatic refresh/cached date and clear retry. Don't repeatedly fetch when offline or 429. Verify asset media included (a cached manifest alone is not a playable listening pack).
- SW descriptions contain raw `marine_biology`, truncated/reordered English strings and technical tokens; fix L01–L06. Translate supporting summaries, retain original English titles. Remove “Seed Pack” names where user-facing. Distinguish 3-item drills, section simulations and full calibrated tests; avoid confusing practice packs with actual full test.
- Mode/setup parity: Flutter shows dedicated setup and skill mode selection; desktop launch buttons don't show chosen rules. Add contextual preflight per pack/skill, default from user choice only where explicit, mode-specific rules, download/entitlement and estimate. Keep quick launch when safe. Test search, sorting, filters, download/cancel/retry, offline launch, resume, and different track catalogs.

### W13 — Quick drills (`13-app-practice-drills`) · P1 · O/R

- Recommended Academic Collocation Matcher shown twice (hero + grid); remove duplication or mark it in list. Only four cards with large repeated green “Start 3-Min Drill” buttons and blank bottom. Use compact skill groups, recommendation reason grounded in learner evidence, expected outcome and item count. Provide progress/history or next suggested drill based on real attempts.
- `A2 fit` is shown with no measured baseline and B1 foundation plan. Clarify recommendation is starter difficulty or inferred level, not assessment (C10). Use approachable names, e.g. “True, False or Not Given — avoid common traps”. SW English titles vs Persian descriptions inconsistent: localized UI name with original English educational content. Verify track filtering and all documented seven seeded drills; four visible is not proof others missing.
- Drill execution/result not captured. Verify deterministic scoring, keyboard and accessible feedback, evidence, mistake-to-deck, adaptation and status sync, no paid allowance consumed for deterministic drills.

### W14 — Full mock (`14-app-practice-full-mock`) · P0/P1 · O/V

- Duplicate Exam/Study segmented switchers top and inside preflight, repeated identical intro, and `Full Mock Day Orchestrator` jargon. One mode selector before start, concise real rules, expected total length, stage durations and availability, ready state. Use labels “Full mock exam” and “Start Listening” for first stage rather than vague `Start Next Stage`.
- Desktop four stage rows show raw `ielts-...-seed-01` and no times/status; Flutter five stages and durations. Resolve C08/C09. Use canonical stage metadata and stable internal IDs, hide IDs, distinguish two writing tasks and official section structure. Show stages as actual progress: upcoming, current, saved, submitted, scoring pending, scored, failed. Explain whether break is a simulation accommodation vs exam-format behavior; no blanket “authentic” claim without track validation.
- Speaker/mic meter 0% unlabeled, same preflight as diagnostic. Show whether each required device checked, offer explicit continuation without mic only in allowed study/partial modes. Start timer only after readiness. Support session resume according to strict policy, guard exit, persist stage IDs and score aggregation, prevent duplicate evaluation, don't call scored while pending. Partial results clearly labeled; paid grading eligibility and quota before committing full mock.

### W15 — Reading simulator (`15-app-practice-reading`) · P0/P1 · O/V

- Good desktop-native split layout with separate reading/questions. Improve default readable line length (current passage stretches >100 characters on some lines), font and paragraph spacing, resizable divider usable with keyboard and pointer; persist pane choice per user/device, allow reset. Avoid unnecessary nested scroll traps. SW mirror policy L04.
- Header has exam/study toggle and repeated `Exam Mode` chip, focused/all, timer, shortcuts; title repeats in pane. Reduce clutter: actual title, mode badge (not switch during assessed attempt), remaining time, progress and exit; focus/all and shortcut menu contextual. Footer currently question numbers, Previous/Next and Submit; add answered/unanswered/flagged status and count, clear flag toggle (“Flag for review” vs “Flagged” state), navigation that doesn't reset text selection unnecessarily. Confirm submit and report unanswered; support legit incomplete exam submission.
- Flutter reading exposes highlight colors/notes; web capture lacks obvious annotation tool. Verify parity and expose selection toolbar with named colors, note add/edit/delete, preserve UTF-16 offsets against content version, review/evidence jump. Study-only paragraph listening/pronunciation and AI hints; no coaching in exam. Follow exact allowed exam annotation policy. Keyboard shortcuts discoverable and not intercepted while typing.
- Reading pack 4 items; clearly mark mini/section practice, time cap not official full length. Test all 11 supported objective mechanics and proper content/score provenance, long passages, matching headings, drag alternative, focus/all mode, resize, reload, timer and submit.

### W16 — Listening simulator (`16-app-practice-listening`) · P0/P1 · O/V

- Screen dedicates entire half to a small player and half to one question; lots of blank space. Use persistent compact player above question list or purposeful split with instructions and question group. Default all/grouped questions for short audio where exam format requires preview; focused option retained. Place answer label and word-limit close to input. Replace raw `[GAP]` with actual form blank or clear label. Avoid forcing navigation for every short gap if authentic task presents a form.
- `Studio Audio Ready` and `Single-play Exam Lock` technical-looking badges; clear “Audio ready · plays once” and relevant restrictions. Timer starts at 03:39 while audio 00:00/03:40; verify mismatch in timing/session start (C08), buffering, preload/asset checksum, browser autoplay restriction and accessible start. Distinguish test time from playback position; don't lose answer time because of fetch.
- Preserve single play/no seeking/no transcript in Exam Mode; Study mode supports speed, transcript and replay only according to policy. On interruption (network, tab background, OS audio route), follow documented policy, never secretly reset or allow score inflation. Correct SW duration, placeholder and question LTR; use label input type, spelling/word rules, answer persistence, offline and end-of-track behavior. Footer question strip must handle full-length counts without inaccessible overflow.

### W17 — Writing simulator (`17-app-practice-writing`) · P0/P1 · O/V

- Chart title and legend overlap, axis values tiny, dark chart clashes with rest of surface. The readability problem is real, dark style is optional. Fix layout/collision using existing SVG renderer, preserve source data/units/legend; adapt accessible chart size/expand and keyboard zoom/pan/reset. Provide equivalent neutral high-contrast chart where permitted; alternative text/accessibility accommodation must not reveal answers. Review title combines desalination and workplace automation while Task 1 focuses on desalination; use task-specific title and check chart/description mapping.
- Left prompt/right editor is appropriate desktop pattern; SW header wraps to two rows; compact header to preserve editor. Keep task tabs clearly selected, both task word counts and shared section clock versus recommended task pacing. Current Task 1 text says 20m, timer 59:59; explain total section time and recommended 20m/40m, not necessarily a bug if configured. Reconcile C08. Actual timer policy must match track/task; lock at expiry per FR-015–019.
- Editor visually looks disabled because muted beige fill equals inactive controls; give clear text editing affordance, label, focus, readable measure and scroll. Live word counter and minimum/range (not universal 150), clear draft save/sync state; characters only if needed. Use English LTR editor and note language in SW. Verify word count hyphens/IME/paste, both task drafts, 500ms save + flush on exit, reload, offline and cross-tab conflict.
- `1/1 AI checks left today` unclear quota; show exact skill/free allowance and monthly where applicable. `Submit for AI Grading` enabled-looking at 0 words; validate real state and warn for incomplete/empty submission without consuming allowance incorrectly. Exam spelling/grammar lock must actually disable application assistance; browser extensions cannot be guaranteed blocked, disclose limitations. Pending/result/retry/failed states and no data loss; both tasks and all 11 variants tested.

### W18 — Speaking simulator (`18-app-practice-speaking`) · P0 · O/V

- **Critical visible content mismatch:** same Science Fiction & Academic Research pack Part 1 desktop prompt is just the topic; Flutter shows “Do you enjoy reading science fiction books or watching sci-fi movies?” Desktop tabs Turn 1–3, bottom 0/3, Flutter six turn buttons. Desktop Part 1 prep 59s and recording 04:00 look like generic session defaults inconsistent with documented Part 2 prep/turn timing. Inspect prompt indexing, selected turn mapping, schema, preparation and response policies (C07). Render actual question/cue card with appropriate instructions, one turn at a time, exact part/question progression; no forced prep/notes in zero-prep tasks unless supported.
- Multiple countdown/status indicators (timer top, prep chip in prompt, prep panel), disabled Start Recording and Skip Prep as main action, flat waveform “microphone ready”; simplify into explicit state machine with one primary action and readiness. Show actual input level test, permission, missing hardware, muted/silent detection, recording elapsed/remaining, active recording indicator, stop/save, next turn; no accidental upload of silence. Browser permission must be acquired before scored time where policy allows. Explain re-record/playback permissions in Study vs Exam, upload progress and local saved status.
- Footer `Upload & Submit Speaking` prominent despite 0 recorded; validation and warning, prevent invalid paid evaluation. SW reverses count `3 / 0` and translated tabs “بخش” vs actual Turn; correct semantics. English prompt and learner audio controls accessible. Handle device interruption, denied/revoked permission, Safari/WebM/M4A codec negotiation, microphone switching, tab/visibility and network upload fallback. Never tell user actual microphone ready without measurable evidence. Test all speaking formats, not just IELTS.

### W19 — Vocabulary studio (`19-app-vocabulary`) · P1 · O/R

- Wave 1 · 15/320 unlocked, new 0/10, 320 due now, 0 mastered and CTA Start Due Review (10) conflict with mobile 200/20. See C06/C24. Design summary with separate new and reviews, selected batch size and true progress. Start manageable review (actual count) or introduce first words when none reviewed. Do not show all seeded vocabulary as learned/saved.
- Tabs Today's Wave/My Saved Mistakes/Full Deck, plus unlock and preview buttons. Explain unlocking policy, distinction between preview and entitlement; lock icon not enough. Preserve user's mistake cards and provenance. Search with meaningful filters (topic, mastery, source, due, track), count/empty state, clear filter. Dynamic virtual list should preserve focus, scroll position, row height after expansion and screen-reader navigation; verify `measureElement` at large text and Persian definitions.
- Row headword/IPA + definition, New badge and three buttons repeated. More compact, align English word, IPA, example and definition together; primary audio and pronunciation controls, details via keyboard-accessible link. SW word far right, definition far left; keep complete English islands and Persian gloss next to them. Verify Persian meaning availability vs promise; don't translate IPA or headword. Use actual accent and pronunciation status. Provide real usage examples and contextual practice.

### W20 — Flashcard review (`20-app-vocabulary-review`) · P1 · O/R

- Very wide 1104px card and full-width reveal button for one word, word and IPA at opposite edges, large gaps and blank area. Use focused centered flashcard with compact progress/exit, word/IPA/audio together, optional context sentence/“why this word,” clear reveal. Flutter includes example sentence before reveal; web does not in screenshot. Support consistent optional context/scaffold; verify reveal doesn't accidentally expose answer via sentence/voice if assessing recall.
- `Space` reveal shortcut, documented 1–4 rating controls; discoverable accessible labels (`Again`, `Hard`, `Good`, `Easy`) and real next review intervals after reveal, not visible yet. Test keyboard and focus, no double advancement, session batch/resume, undo/review correction if supported. Distinguish review count vs total. Show end summary actual cards reviewed, new vs due and next steps, no fabricated mastery.
- Listen, speed 0.8x, pronunciation CTA need feedback on loading/playing, voice and errors, no paid surprise. Keep SW `0.8×` isolated. Verify source example, pronunciation history and active production follow-up across clients.

### W21 — Progress (`21-app-progress`) · P1/P0 · O/R

- Three large KPI cards with duplicate Estimated Band, target and 0-day streak; trend panel is giant empty text, radar draws small green polygon despite no measured skills. Remove polygon/fake baseline; distinguish no evidence and 0. Show compact coverage/first action, hide unsupported visualizations until sufficient real evidence. A single scored skill cannot yield a reliable 4-skill balance; label missing axes.
- Unlike Flutter, no visible 7/30/90/all filters, skill cards lack clear links and history not visible. Verify route and feature parity; provide time, skill, track, mode, calibrated vs practice filters and clickable skill drilldowns, attempt history and detail. Show actual attempts and confidence/provenance where measured. Export and comparison secondary, disabled/hidden with explanation when no eligible records. No data export of fabricated/other-account data.
- Populated chart should show score scale, dates, target line, calibrated solid vs practice hollow nodes (ADR-021), distinct series, accessible table, evidence/attempt link and why changed; avoid misleading smoothing or mixing scales/assisted attempts. Radar optional; a small aligned bar chart with explicit values may be more understandable. Show plan next step and weakest evidence-based criterion.
- SW Navia transfer CTA active-looking when score absent (C11), copy implies admission. Put below relevant qualified outcome, show eligibility and consent; no official claim. SF card currently before progress content; same principle. Test backend authorization and UI gating.

### W22 — Compare attempts (`22-app-progress-compare`) · P1 · O/R

- Empty page only narrow notice and Back/Progress, then blank region. When <2 compatible scored attempts, show helpful prerequisites, existing count and direct action “Start a practice” / “View history”; do not dead-end. Disable entry or explain why where reached from Progress. Consider sample comparison clearly labeled demonstration, not personal data.
- For populated state (unseen), show two selectors with date, skill, exam, task/mode/calibration and score. Restrict comparison to meaningful comparable attempts or clearly explain non-comparability, not arbitrary raw delta. Show criterion differences, timing, actual answer/evidence and actionable follow-up; do not imply learning improvement based solely on changed AI grader/model or task difficulty. Compare text inline diff with accessible non-color meaning. Link to attempt review; preserve selection via route/state. Provide stacked mobile equivalent if supported. FR-020–024/055.

### W23 — Smart Coach (`23-app-coach`) · P1 · O/R

- Attractive simple hero, but it exposes one generic daily prompt with free sample pill and three separate features. Coach should be the learner's intelligent workspace, not another catalog. Lead with today's mission (time, goal, why from actual evidence or starter reason), progress steps, weak spots and follow-up. Make manual tools discoverable secondary actions. If no recurring errors yet, say “We're learning your strengths” and propose one appropriate first activity, not pretend personalization.
- Desktop missing capture of actual Daily Mission, Register Shifter, Drop Anything and Weak Spots; all appear as entries. Verify full parity (§3), including actual outcomes, recording/text, history and PlanImpact. Design mission workspace with prompt, targeted expression/evidence and writing/speaking production; no forced register complexity. Register Shifter use side-by-side examples and audio/meaning; Drop Anything drag/paste and generation states; Weak Spots evidence timeline/transfer matrix. See mobile M15–M18/M24 (Appendix A).
- `1 free sample included` with Upgrade, audio lock, “Band 8+” wording; clarify allowance and modalities before submitting, no exact/guaranteed band. SW `۳۰ث` compact label can be clearer “۳۰ ثانیه”; localize topic copy but preserve English prompts. Coach must use relevant track/context and return actual next action, no forced unrelated mock.

### W24 — Settings (`24-app-settings`) · P1/P0 · O/V

- Long masonry-like two columns with left column account/track/preferences/appearance and right subscription/audio/cache/legal/danger, unbalanced as page scrolls. Create navigable settings sections: Account & devices; Exam & study goals; Learning preferences; Vocabulary & voice; Appearance/accessibility; Offline & sync; Subscription & usage; Privacy & support. Use desktop section navigation and responsive stacking; avoid overly large five exam cards repeated unless needed. Preserve settings-only track switching and clarify consequences/history.
- Active Devices says sign in, 0/1 Open, but Sync Across Devices Now active. If guest, truthful local-only state and sign-in CTA, optional guest data export/delete; don't pretend cloud sync. Device slots after auth show actual type/last active/this device, replace/revoke flow and clear current subscription policy. Diagnostics collapsible only for support. No action without permissions.
- Free Plan header plus allowance “10 Speaking & 10 Writing AI evaluations/day” ambiguous (C03). Show actual current/free/paid usage, reset, plan details, restore/manage payment. `Microphone ready (0 input device(s) detected)` contradictory (C13): use permission + device + test state, separate live input meter and chime, explicit device selector if browser supports. Voice accent choice labels natural, allow preview.
- Offline storage count/MB vs catalog 0 B captured perhaps different times; distinguish content, audio, drafts and database. Clear Cache should not wipe unsynced user work or recordings; confirm scope and reclaimable size, protect local-only data, show retry/persistence. Track settings date not visible; ensure changeable daily time/date/interests/accent, persist instantly or show save button/status. Theme settings five presets vs four docs; test dark/system.
- Danger Zone prominent alongside routine preferences; move destructive flow into Privacy/account section, still findable. Guest cannot delete nonexistent server account; separate local data reset. Confirm scope, reauth as appropriate, export option, 30-day audio retention and actual erase job status, distinguish server and this-device deletion, handle failures. Do not misrepresent all data removed if external providers/backups have documented retention. Support/contact/terms/privacy links and app version (doc says shown in Settings; not visible). No raw internal names.

### W25 — Paywall (`25-app-paywall`) · P0/P1 · O/V

- Two-column plan selection + benefits/comparison is appropriate desktop. Current copy repeats restrictions three times, duplicates Recommended/Most Popular and displays upgrade disabled plus separate sign-in. Lead with real benefit and transparent plan options, radio/check selected state and clear price period, total billed amount, auto-renewing vs one-time, cancellation/restore/refund/support terms, current entitlement and free samples. One actionable CTA based on state: guest “Sign in to subscribe” preserving selected plan; eligible authenticated “Continue to checkout”; current subscriber “Manage plan.” Explain any disabled CTA prerequisites. Do not hide required consent or device policy; avoid repeated intimidating wording. Make checkbox semantic and links accessible.
- C01/C02/C03/C18 apply: runtime price, daily/combined monthly quota, quarterly discount, caps for weekly vs monthly/quarterly must match provider terms. “Unlimited” refers to specific mistake-card saves not unlimited AI, clarify. Free/pro comparison should distinguish 10+10 daily, combined monthly, free diagnostic, offline packs, TTS/pronunciation and Smart Coach allowances. Verify `36+ packs` actual available by edition/track. Most Popular only if evidence supports; otherwise remove and use neutral “Best for monthly practice.”
- SW Toman billing, no USD/Stripe/RevenueCat leakage; show integer Rial server amount converted once to Toman, exact period, payment path, verification/pending/failure/retry and entitlement reactivity. GLB use correct provider and restore/manage. Use independent-practice notice and “estimated rubric feedback” not official scoring or guaranteed score gains. Test redirect return, browser refresh, duplicate callback, cancellation, expiry, grace period, offline, device slot and purchase on one client immediately reflected in other. Billing cannot be corrected merely by CSS/localization.

## 6. Desired product experience — intelligent guidance, not isolated features

The following is a proposed design direction grounded in FR-051–061 and ADR-020/021. It is not a mandate to introduce a new AI architecture. Use existing `LiveBandEngine`, `RoadmapGenerator`, `LinguisticGraphMath`, `TopicWeaknessRotator`, `VocabWaveScheduler`, `ActiveProductionVerifier`, `DailyMission`, `RegisterShifter`, `DropAnything`, and `PlanImpactCard` before adding a new engine.

### 6.1 Closed-loop experience contract

1. **Understand:** Track, target, optional date, pace, interests, diagnostic or unknown baseline; no forced login/diagnostic or synthetic score. Foundation B1 material is a choice of starting difficulty, not proficiency assessment.
2. **Choose next useful action:** Prioritize a resumable in-progress activity, then time/goal/observed weakness/coverage/due reviews and learner preference using actual plan state. One primary action and why now. If multiple candidate tasks, explain reason in plain language, not internal route codes.
3. **Teach in context:** Use interesting topics, real-life material or exam tasks, focused practice, optional scaffolds/audio, natural communicative purpose. Teach vocabulary in context, not a 320-word dump. Preserve user control to choose manual practice, topic or mode.
4. **Observe:** Deterministic objective scoring and versioned AI rubric/phoneme estimates; link exact evidence, errors, contexts and assistance. Separate raw correctness, assessment coverage, confidence when empirically calibrated, and actual mastery. Do not infer mastery from merely clicking “Mark Done.”
5. **Verify:** Ask learner to reuse expression or structure appropriately in a new context, not word-for-word forced insertion. Identify evidence of active production, exposure and repetitions. Use review/decay schedules; distinguish not assessed vs incorrect vs mastered. Avoid overstating pronunciation precision or score equivalence.
6. **Adapt:** Show what changed (e.g. new activity unlocked, criterion needs more evidence, repeat planned) with actual `PlanImpactSummary`. If score did not change or no valid estimate, explain without false celebration. Retain traceable reason for roadmap reorder. Learner can skip/pin/reschedule without falsifying results.
7. **Continue anywhere:** After local save, synchronize verified evidence and plan, show clear status; phone and desktop next actions agree under same server revision. Resume where policy permits, do not promise in-progress cross-device resume unless implemented and valid for exam integrity.

### 6.2 Screen hierarchy and sample content contracts

| Surface | Recommended primary hierarchy | Secondary capabilities |
|---|---|---|
| New Home | Welcome + goal; “Start your first 10-minute activity” or resume; why this choice; today’s manageable plan | Optional level check, skills, manual practice, vocab, roadmap, target/date |
| Returning Home | Resume/next recommended activity; estimated time; recent actual PlanImpact; today’s tasks | Score coverage, weekly rhythm, vocabulary batch, browse tools |
| Roadmap | Current milestone, next step, reason, evidence-based completion; upcoming path | Topic/pacing, pin/skip, milestone preview, actual history |
| Coach | Daily mission and purpose, actual weak spots, production step, feedback → follow-up | Register Shifter, imported content, pronunciation and vocabulary; remaining allowance |
| Results | Result type (practice vs calibrated), evidence, rubric/answer rationale, actual learner impact | Review corrections, retry comparable activity, Mistake-to-Deck, TTS/repeat (Study/review only) |
| Progress | Goal + meaningful evidence coverage, trend when eligible, skill-specific next action | Date/mode/track filters, attempt history/compare/export, IRN Navia only when eligible |
| Vocabulary | New vs due review queue, one review action, personalized reason | Saved mistakes/full library, details/IPA/examples/voice/filters/history |

Illustrative copy only (never hard-code as personal evidence): “Today: practice contrast in a short workplace discussion. We suggested it because your last two assessed responses had unclear transitions. About 8 minutes.” If no such evidence exists: “Start with a topic you like. We'll use your first practice to learn what to focus on next.” Show real reasons or honest absence. A progress UI should communicate “used correctly in one familiar topic; next: try a new context,” not arbitrary 78% mastery. For a learner with no evidence, show the next useful action instead of a dashboard full of zeros.

### 6.3 Strategic improvements requiring product approval (P3)

Preserve the current five exam tracks; consider expanding real-world/academic learning beyond exams only as an explicit roadmap decision. Possible extensions: guided real-life tasks (email, discussion, interview), learner-imported article/video/audio with contextual comprehension and production, friend conversation missions with consent/privacy and asynchronous feedback, adaptive reading/listening with genuine interest-based progression. These need discovery, content rights/moderation, user controls, assessment boundaries and cost estimates. Do not implement arbitrary chat/social features or use generative models to invent proficiency. Measure learning retention/transfer and accessibility, not merely number of features. First make the documented closed loop usable on all four versions.

## 7. Technical, functional, data, security and operational verification backlog

These are not alleged vulnerabilities or source-code defects. They are specific engineering checks derived from the screenshot problems and documented architecture. Severity P0 is conditional on reproduction of the stated failure. Preserve the existing implementation where correct; add regression coverage for each outcome.

| ID | Priority | Area / failure to prevent | Implementation direction and acceptance |
|---|---|---|---|
| T01 | P0 | Exam schema and pack equivalence | Compare TS `ExamDescriptor` / `EXAM_SCALES` and Dart `ExamTrack`, pack `version`, task IDs, prompt order, asset hashes, instructions, scoring and timer policy. Build fixture for every supported task mechanic, including non-IELTS. Same canonical content and score for same answers on both clients. |
| T02 | P0 | Clock correctness | Use injected monotonic elapsed-time policy for active clock, persist authoritative start/deadline and reconcile after suspend/reload/background/tab. Define exam vs study pause, preflight, accessibility, zero-prep and interruption rules; timeout locks answers exactly once; no timer reset from refresh, mode toggle, system clock change or network latency. Test fake clocks and real lifecycle. |
| T03 | P0 | Assessment integrity | Separate practice, assisted, diagnostic and calibrated assessment provenance; server validates track, pack version, mode, eligible evidence and allowed task types. Hide hints in Exam Mode across routes/direct links, not just CSS; don't trust mutable client claims for official-like summaries or Navia. Distinguish local offline score from authenticated verified simulation. |
| T04 | P0 | Diagnostic routing/calibration | Verify two-stage routing seed/version, upper/lower block decisions, partial skills, timeout, skip, retake, result state. No synthetic B1 numerical estimate; report evidence and unknowns. Use versioned calibration methodology and human benchmark before claiming exact band. |
| T05 | P0 | Objective scoring and answer normalization | Test all 11 task types, word limits, apostrophes, whitespace, case, acceptable alternatives, unicode/punctuation, multiple selections, order and partial credit per exam; do not introduce arbitrary normalization that changes correct answer. Use shared fixtures and content review for ambiguous keys/evidence. |
| T06 | P0 | Productive scoring & reliability | Validate AI structured rubric schemas, criterion bounds, track/task-specific weighting, prompt/model/rubric versions, transcript/audio quality and insufficient-evidence handling. Evaluate against licensed/original human-rated diverse samples; compare error/consistency and bias across accents, proficiency, native language and noise. A multimodal LLM's phoneme/prosody scores are estimates, not clinically precise acoustic measurement. Never present unvalidated band-equivalence as fact. |
| T07 | P0 | Recording lifecycle | Preflight permission/device/actual signal separate from ready state; handle missing/denied/revoked mic, codec mismatch, silence, clipped audio, interruption/background and permission UI. Persist validated recording before navigation/upload, explicit recording indicator and stop. Validate max duration/size/MIME/signature, deterministic object key, checksum, retry; no silent loss or empty AI job. Test Chrome/Firefox/Safari and real Android/iOS. |
| T08 | P0 | Writing / response persistence | Verify 500ms autosave and reliable flush on blur/exit/visibility changes and transactional task switch. Crash, refresh, timeout, network loss, multiple tabs, IME composition and long response tests. Do not show “saved locally” until committed. Persist attempt and draft IDs, clock policy and content version. |
| T09 | P0 | Async grading state machine | `202 Accepted` → queued → processing → completed/failed/expired, durable job ID and retry policy; separate uploaded vs graded and actual plan update. Idempotent submission key, transactionally reserve quota, publish outbox, pg-boss lease fencing/execution_generation, terminal failures refund once, late worker cannot overwrite newer state. Test double click, retry, crash between commit and dispatch, lost acknowledgement and concurrent devices. |
| T10 | P0 | Quotas and billing correctness | Server-owned plan SKU/currency, daily per-feature and combined monthly caps with reset policy/timezone, free sample, week/quarter behavior, entitlement expiry and reservations; provider receipt/signature validation and webhook replay/idempotency, reconcile late/cancelled payments, device slot consent timestamp. Client reads effective balances and checkout amount, never grants access from UI. Verify GLB/IRN policy C01–03. |
| T11 | P0 | Account/device/session isolation | Partial unique `uq_active_user_slot`, server-bound edition/device, atomic takeover 409, old session revocation, refresh serialization, session bootstrap and guest merge. Test browser tab reload, duplicated tabs, mobile reinstall, cookie/storage clear, expired token, stale outbox, logout and switching account. No cross-account cache exposure or duplicate usage. Avoid treating browser user-agent as secure identity alone. |
| T12 | P0 | Guest merge | Preserve attempts, SRS, diagnostics, drafts (where supported), preferences, recordings and plan evidence without duplicate or lost records. Define deterministic merge order/conflicts; handle retry after partial server success, existing account with active slot, logout while merge pending. Maintain explicit ownership and edition. |
| T13 | P0 | Offline and synchronization | Durable SQLite/Dexie outbox with stable event IDs, retry/backoff, transactional application and acknowledgement, pull cursors/revisions/tombstones. Define conflict per entity: SRS event replay/order, preferences latest valid revision, attempt immutable, roadmap actions versioned, deletion wins. Do not mark cloud sync if only local commit. Handle network 429/5xx, stale cache and concurrent edits; test offline on both devices then reconnect and converge. |
| T14 | P0 | Media/cache correctness | Verify manifest checksum/version, atomic download, included assets, OPFS support and fallback, storage quota/eviction/browser private mode, cancelled download, stale or corrupted media, expired signed URL. Clear content cache never destroys unsynced drafts, attempts or recording; distinguish user data vs replaceable packs. Test offline cold start and actual audio playback. |
| T15 | P0 | Security boundaries | Zero client upstream keys; admin authorization server side, short-lived/scoped sessions and role checks; validate no API key or privileged token bundled in client, no secret in logs; ownership and edition checks on all IDs, signed uploads scoped to object/owner/type/expiry, prevent arbitrary key reads. Verify CSP, XSS, sanitized SVG/HTML, CSRF protections for cookie-bearing flows, CORS, trusted proxy rate limits, JWT validation and replay. No exploit claimed from screenshot. |
| T16 | P0 | Drop Anything threat model | For URL fetch validate scheme and every redirect, DNS/rebinding/private/loopback/link-local and metadata endpoints; limit size/time/content, prevent SSRF and uncontrolled fetch. Treat imported text/image/audio as untrusted prompt data; constrain tools, validate structured outputs and sanitize render, strip unnecessary metadata, protect copyright/privacy. Reject unsupported/oversized payload early; show clear fallback paste path. |
| T17 | P0 | Privacy and data lifecycle | Explicit mic/upload/AI disclosure before collection, recording scope and retention, opt-in/consent for Navia, data export and account deletion. Verify 30-day audio TTL including object and metadata, erasure cascade across 41 documented tables, both clients/local stores, jobs/outbox/cache, provider retention disclosure, retry/status. Admin access audited, least privilege; redact personal text/keys from Langfuse and logs. No arbitrary recording browser stream without ownership/role. |
| T18 | P0 | Navia handoff | Server validates qualifying calibrated mock/provenance, explicit data preview/consent, signed token audience/issuer/expiry/nonce and replay protection, no sensitive scores in URL logs/referrer if avoidable. Receiver validates; user-visible completion/error/return. Distinguish internal verified mock vs official certificate; test unknown/unqualified/expired/replayed/wrong-edition. |
| T19 | P1 | Learner evidence modeling | Canonical event IDs, `usedStudyMode`, source kind/attempt version, skill, item count, timestamp, target form and verification state. Derive LiveBand/weakness/roadmap/SRS exactly once after actual result; distinguish no evidence, weak evidence, calibrated, assisted and mastery. Exponential recency weighting and error decay test fixtures; no false precision, stale plan rollback or double progress. |
| T20 | P1 | Recommendation quality | `RoadmapRouteResolver` must resolve actual available pack/skill/track/entitlement/online state; no dead-end next task. Preserve learner control (skip/pin/pace), explain fallback when diagnostic omitted or no topic match, avoid repeat fatigue and content above/below learner needs. Compare recommendations across TS/Dart using same evidence and revision. |
| T21 | P1 | Vocabulary scheduling | Define introduced vs unlocked vs due, personal vs library, `SerialDay` timezone, SM-2 ease/interval/ratings/rounding, final partial wave, remediation injection, daily new vs review cap. Replay same review events in both clients, dedupe cross-device and test day boundary, clock skew and 20-vs-10 batch selection. |
| T22 | P1 | TTS and pronunciation | Keep API-only Kokoro, accent propagation and cache normalized `(text, voice, speed, model/version)` key. Confirm no cross-user leakage for personal text, authorized playback, cache invalidation, 60 req/min and 429 handling. Show loading/playing/retry, exact supported speeds, no reliance on browser/OS TTS. Pronunciation studio returns validated heatmap/evidence/feedback and explicit limitations, handles noisy/short audio. |
| T23 | P1 | Result review / evidence linking | Inspect `/results/:attemptId`, job pending/result and diagnostic result routes. Ensure exact quotes/offsets and paragraph references correspond to canonical content version, accessible highlight selection, objective explanation, AI rubric/rewrite, timestamped speech evidence, weakest micro-drill and one-tap Mistake-to-Deck; prevent duplicate saved mistakes. PlanImpact derived from actual persisted before/after event, not local guess. |
| T24 | P1 | API resiliency | Map documented typed failures to locale-appropriate actionable UI, coalesce auth refresh and inflight query dedupe, 10s memory cache and Dexie fallback for 429/offline. Avoid endless retries/refetch loops, stale closures, uncancelled effects and deadlocked refresh. Honour Retry-After, backoff and request cancellation; test 401/403/404/409/429/5xx/timeouts and partial results. |
| T25 | P1 | Render performance | React lazy routes, stable translator/hooks/store subscriptions and memoization where measured; preserve virtual-list focus/scroll and dynamic height. Flutter rebuild only needed subtree, avoid expensive work on UI thread; animation and list performance measured on representative low-end mobile/desktop. Don't solve performance by removing features. |
| T26 | P1 | Observability quality | `ai_usage_ledger` and `user_activity_ledger`: correlation IDs linking user/device/edition/attempt/feature/job/model/latency/usage, distinguish cache hit/failed/retried and actual vs estimated cost; no double-count, redact content, restricted admin export. Add product event funnel without tracking sensitive payload by default. Test with synthetic fixtures, reconcile provider billing. |
| T27 | P1 | Content quality and authenticity | Review pack title, stimulus, questions, answer keys, distractor quality, chart units, audio/transcript agreement, task length and level, repeated/generated content and copyright. Maintain version/source provenance and report-question flow `/v1/feedback/question-flag`. Do not market short generic tasks as full official simulations. |
| T28 | P1 | Deployment and edition controls | Check `main_global.dart`/`main_iran.dart`, `web/src/composition/irn.ts` and GLB equivalent, API edition guard, store/billing credentials, storage prefixes, deployment origin/CSP and separate bundle builds. Test real Iran domestic access/no-VPN claim on permitted network, OTP availability and graceful outage; no unsupported provider exposure. |
| T29 | P1 | Localization and dynamic content | Unit/visual test format helpers for all 5 scales, plural, digit order, localized enums/error/stage labels, Jalali conversion edge cases, English LTR text and Persian chrome, all runtime status messages. Ensure token-generated CSS/Dart parity, no duplicated translations in widgets. |
| T30 | P1 | Public web quality | Measure Core Web Vitals on representative devices/connections, verify static SEO content, JS budget, no broken links, no crawlable personal app state, structured data truthful and localized, no duplicate canonical across editions; actual production availability distinct from local 0 HTTP >=400 screenshot claim. |
| T31 | P1 | Recovery and support | Preserve local work through session expiration or recoverable failures; actionable recovery, progress, contact/support and safe export. Help users report issue with redacted diagnostics, not raw provider errors. Verify no hidden dead-end after payment/auth/OTP/recording/AI failures. |
| T32 | P1 | Schema migrations and compatibility | Validate existing SQLite v1–10, Dexie migrations and Postgres changes with real upgrade fixtures; new features need backward-compatible contracts, rollback/migration plan, outbox older schema handling; do not wipe local data to fix counters. |

### 7.1 Required implementation ownership (inspect actual repo paths)

- **Domain / contracts:** `@mockza/domain`, `@mockza/contracts`, `app/lib/core/`, `shared-fixtures/`; C06–10, C17, C21, T01–06, T19–21. Extend pure functions and parity tests first.
- **Flutter:** `app/lib/features/`, `app/lib/routing/`, `app/lib/data/`, `app/lib/services/`, `app/lib/l10n/`, `app/lib/theme/`, `app/lib/core/localization/edition_copy.dart`; preserve Riverpod/MVVM, Drift, GoRouter and `LtrExamBoundary`; use common widgets, not per-screen overrides.
- **React desktop:** `web/src/spa/`, `web/src/components/`, `web/src/adapters/`, `web/src/edition/`, `web/src/i18n/`, `layout.store.ts`, `router.tsx`; preserve hexagonal domain ports, Dexie/OPFS, React stores, persistent rail and split-pane design. Audit every required route including deeper Coach/results/analytics routes. Astro public routes retain static architecture.
- **Backend:** `backend/apps/api/src/routes/`, worker, database schema/stores, billing, AI prompt/contract packages; verify authorization, idempotency, quota and edition policies at server. Use documented endpoints as starting map (ADR-007/020–022), don't invent endpoints until current implementation inspected.
- **Design/QA:** shared design tokens, screenshot baselines, `scripts/check_all.sh`, `scripts/check_cross_parity.sh`, `scripts/check_web_budget.mjs`, Playwright, Vitest, Flutter unit/widget/E2E. Keep CI constraints and meaningful screenshots, not only HTTP/overflow checks.

## 8. Release execution plan and test matrix

Do not instruct an agent to rewrite every feature in one commit. Use reviewable slices, maintain a persistent issue register and record policy decisions first. The following phases are ordered dependencies, not a delivery promise or estimated schedule.

| Phase | Work | Exit condition |
|---|---|---|
| 0 — Inventory | Baseline commits, actual four builds, route/API/entitlement matrix, reproduction with seed fixtures; resolve pricing/quotas/clock/score/locale direction decisions | Every issue classified confirmed, verified existing, needs decision, or proposed; no assumptions hidden |
| 1 — Correctness | Exam task/timing/pack, score provenance, recording, bidi numeric order, quota and Navia, auth/sync safety | P0 failures corrected and negative tests; no data loss or misleading paid/score state |
| 2 — Shared visual foundation | Tokens, component contracts, shell/nav, layout, accessibility, localization, status and empty states | Common components validated on both clients, all editions/themes/sizes |
| 3 — Feature parity | Complete desktop deeper routes and all learner functions, mobile equivalents for comparison where required; verify no unreachable capability | Full capability manifest + route and behavior tests across four variants |
| 4 — Learning UX | Home, Durnama, Coach, vocabulary, diagnostic/results/progress loop | Learner can start, get feedback, see actual plan impact, continue on another device |
| 5 — Commercial/public readiness | Billing, account/recovery, privacy, public calculators/landing/SEO, support | Provider test purchases/restore/expiry, truthful prices/claims and accessible public flow |
| 6 — Release qualification | Regression, visual baselines, load/cost checks, real devices, learner usability | All release gates passed; remaining P2/P3 explicitly approved and tracked |

### 8.1 Minimum test combinations

| Dimension | Values / scenarios |
|---|---|
| Product variants | MF, SF, MW, SW; Flutter web/native platform differences as supported; GLB and IRN deployment smoke |
| Exam tracks | IELTS Academic, IELTS General, TOEFL iBT 2026, PTE Academic, DET; all documented objective/writing/speaking task types and scale boundaries |
| User state | Fresh guest; deferred diagnostic; partial assessment; calibrated and practice attempts; returning learner; signed-in free; paid; expired; occupied device slot; account change/logout; insufficient quota |
| Network | Online; offline cold launch with/without pack; delayed request; timeout; 401/403/404/409/429/5xx; disconnected during upload/grading/sync; retries and concurrent devices |
| Visual | 320/360/390/430dp; tablet; 1024/1280/1440/1920 desktop; viewport height 768/900; 125/200% browser zoom; 2x text; landscape, safe-area and virtual keyboard; rail expanded/collapsed |
| Locale | English; Persian RTL with English content; mixed numbers, slashes/ranges/IPA/email/URLs, dates/currency, long localized copy; all actual theme presets and dark/light/system |
| Accessibility | Keyboard only, visible focus, screen reader on supported platforms, contrast, reduced motion, switch/radio/tab semantics, accessible chart and media controls, touch target and reflow |
| Lifecycle | Fresh install, upgrade/migration, refresh, browser close, background/suspend, process crash, multiple tabs, permission denial/revocation, account takeover, cache eviction |
| Commercial | Free sample, per-skill and monthly bounds, weekly/monthly/quarterly, pending/failed/refunded evaluation, restore, duplicate checkout callback, subscription expiry and renew/cancel, IRN Rial/Toman |
| Data | 0/partial/many attempts, no/known target date, 0/10/20 reviews, final wave, saved mistakes, long text, mixed Unicode, chart assets, audio missing/invalid, stale or conflicting state |

Use pairwise coverage for lower-risk visual combinations and full coverage for P0 domain/edition/entitlement cases; no claim of exhaustive Cartesian coverage unless actually run. Build the following scenario tests using stable fixtures rather than external AI/billing calls where possible, plus controlled real integration smoke tests.

### 8.2 Required end-to-end scenarios / definition of done

- [ ] **E01 New learner:** both editions, select track, choose target/optional date/pace/topic, skip diagnostic; next foundation action works, no synthetic score; change preferences and see real plan change; reload and guest persistence.
- [ ] **E02 Diagnostic:** standard/extended/accessible, full and partial, mic unavailable, skip block/skill, retake, actual results and PlanImpact; no leaked worked example or fabricated overall band; correct timing.
- [ ] **E03 Exam content:** per track, compare canonical pack versions, question/prompt count, scoring, clock and allowed assistance between clients; answer flags, annotations, resize and resume/exit/timeout; exact objective parity.
- [ ] **E04 Productive attempt:** write both tasks, autosave/reload/timeout; record all turns with permission checks, local save, upload retry; submit once, pending and result, quota charged/refunded correctly; model rewrite and evidence, PlanImpact and next step.
- [ ] **E05 Closed loop:** objective mistake or rubric error becomes actual evidence node; save to deck; generated mission addresses real error; practise and verify usage across new topic; roadmap reflects actual evidence and not arbitrary manual completion.
- [ ] **E06 Full Coach parity:** Daily Mission all stages, Register Shifter text/audio and three registers/repeat, Drop Anything modalities/entitlements/history/quiz, Weak Spots/evidence/transfer, TTS/pronunciation supported sources; desktop route and outcomes match Flutter.
- [ ] **E07 Vocabulary:** new user counts coherent, introduce selected wave, review batch, reveal/rate via keyboard/touch, correct due date, mistake capture, details/IPA/meaning, selected voice, review history/sync; no duplicates.
- [ ] **E08 Analytics:** empty, partial, practice vs calibrated, multiple compatible attempts; per-skill drilldown, date/mode filters, attempt history, result, comparison and export; no fake chart/delta. IRN Navia eligibility and consent only on qualified data.
- [ ] **E09 Continuity:** perform task on phone offline, reconnect, open desktop with actual updated result/roadmap/vocab; concurrent review/change on both and merge deterministically. Guest to account no loss; logout/revoke protects data.
- [ ] **E10 Commercial:** verify provider price/interval and currency, correct quotas/reset, device policy consent, purchase/restore on one client visible other, occupied slot takeover, expiry, callback replay, error/retry, no duplicate charge. No disabled dead-end.
- [ ] **E11 Privacy:** permission consent, recording access ownership, TTL, erase status and retries, local cache separation, guest reset and data export, authorized admin access only, redacted logs.
- [ ] **E12 Public + BiDi/accessibility:** landing → converter → appropriate practice, correct score input/ranges/provenance, static content and budget; RTL/LTR ordering, keyboard/screen reader/zoom, no clipping, all theme states.

For each scenario record variant, commit, account fixture, viewport/device/browser, route, expected vs actual, screenshot or automated artifact, assertions and outcome. A green build or zero HTTP errors alone is not a pass. Verify all P0/P1 items that are requirements; proposed P1 design work can be accepted/rejected by owner with rationale. No unresolved P0 release. No missing mandatory parity feature. Use measured accessibility, scoring, reliability and user testing instead of declaring “perfect.”

### 8.3 Product metrics and usability acceptance (proposed; establish baseline before targets)

Measure task completion and time to first meaningful practice, diagnostic defer success, time to resume, correct next-action identification, practice-to-feedback conversion, plan-impact comprehension, review retention/active production across new contexts, cross-device continuity, payment completion/refund/support rates, recording failure/recovery, sync reliability, app responsiveness and accessibility success. Separate new/returning, track, edition, platform, mode and network cohorts. Run moderated usability tests in English and Persian with realistic goals: start practice, finish a mock, recover recording, interpret estimated vs official score, explain quota and transfer consent, and resume on another device. Ask participants to explain what to do next and why. Never invent conversion or learning improvements from visual review; collect evidence and iterate.

### 8.4 Coding agent final report format

Return `issue_id`, `status` (`confirmed_fixed`, `verified_existing`, `not_reproduced`, `decision_required`, `deferred_approved`, `blocked`), severity, affected variants, file/route, root cause, implemented solution, tests run + outcomes, before/after screenshot references, migration/API changes, policy decisions, remaining risks. Update PDR/ADR only when verified behavior or approved policy changes; do not inflate status. Run existing gates and list any failed/skipped tests, exact cause and workaround. Include the capability manifest and evidence for all four variants. Do not hide blockers or claim verified runtime based on this document.

## Appendix A — Flutter mobile screen-by-screen findings (52 screenshots)

The earlier mobile review is retained here for implementation traceability, with its recommendations subordinated to the current v4.0 requirements and conflict table above. The numbered mobile screen pairs are not the same file names/numbers as the desktop set. A visible UI issue remains valid; missing controls outside a viewport and unseen deeper flows are verification items, not confirmed omissions. Where an earlier suggestion conflicts with §§0–8 (e.g. arbitrary new goals, scoring, quota or direction policies), the current contract supersedes it. Treat illustrative data and suggestions as examples only.

### M01 — Welcome & Exam Selection (`01-onboarding-step1`) — P1

The first screen immediately asks customers to choose an exam, before properly communicating the product's value.

- Five oversized exam cards: use compact but accessible selection controls.
- Scoring scales and technical details appear early; reveal detail when the exam is selected. Preserve correct exam names and scoring formats.
- Default IELTS Academic selection could be accidental; make selection and confirmation explicit.
- No obvious general-English path for learners not preparing for an exam: propose real-world language learning goal if supported.
- Legal disclaimer competes with content; preserve it but reduce competing visual weight.
- Sanjia exam descriptions remain English: localize explanatory metadata as appropriate while retaining exam names.
- The two editions are intentionally isolated. Do not add a cross-edition language selector without product approval; provide appropriate localized settings and help within each edition.
- Explain learner benefit, personalized learning, exam practice and offline capabilities accurately before demanding choices.

### M02 — Study Preferences & Target Score (`02-onboarding-step2`) — P1

One long screen asks for mode, interests, target score and understanding of Smart Coach. English score section is below visible area; Persian shows an oversized `Band 7.5`. The fixed Get Started button appears before all configuration is clearly presented. Progress indicator is not visible. Cards and topic chips are large and wrap heavily; Complete Prep/Smart Coach terminology may be confusing.

Proposed onboarding flow:

1. Ask goal (academic, migration, professional, everyday English).
2. Choose exam if relevant.
3. Configure target score, optional exam date, available study time.
4. Personalize interests, experience, preferred activities.
5. Build initial plan: optional diagnostic or immediate practice.

Use progressive disclosure, short steps, progress indicator, back/skip where appropriate, save/resume and visible validation. Avoid forcing account creation or assessment unless product policy requires it. Ensure CTA does not obscure fields and is enabled according to required inputs.

### M03 — Authentication (`03-auth`) — P1

- Large gap above the login form; use intentional layout and keep key actions reachable with the keyboard open.
- Forgot Password not visible: verify and surface recovery.
- Strict Single-User Device Policy receives disproportionate emphasis and feels restrictive. Present a concise explanation with details accessible separately; preserve actual device rules (one mobile and one desktop browser in visible policy).
- Persian SMS-unavailable banner exposes a server limitation. If SMS is unavailable, present email authentication directly unless an explanation is necessary.
- No visible alternative authentication: evaluate supported options without inventing providers.
- Validation/error behavior not visible: test field errors, credential failure, verification, expired sessions and recovery.
- Clarify benefits of signed-in versus guest access and synchronization. Maintain account security, device management and privacy.

### M04 — Quick Starting Check (`04-diagnostic-intro`) — P1

- Inconsistent duration language: 10–15 minutes, Standard 15m and 10-minute checks elsewhere. Align durations with actual modes.
- Excessive blank space; show a compact assessment preview.
- Clarify four skills, unscored examples vs diagnostic answers, and what the learner receives afterward.
- Coordinate sound check, mic check, privacy notice and optional speaking in a coherent preparation step.
- Explain how skipping speaking or another skill affects coverage and score uncertainty. Do not fabricate an overall score based on missing evidence.
- Suggested value statement: complete four short activities and receive a personalized learning plan with an estimated starting level.

### M05 — Home / Study Room (`05-home`) — P1, major redesign

Home currently behaves more like a menu than an intelligent study room.

| Issue | Required direction |
|---|---|
| Check my level title and CTA repeat | Reduce redundant copy |
| Exams and Coach are both tabs and bottom destinations | Clarify their distinct roles or consolidate redundant navigation |
| Diagnostic, practice, roadmap, daily coach and tools compete | One dominant next recommended activity; other actions secondary |
| Large cards hide important content | Compact dashboard and responsive layout |
| Limited personalization | Explain why today's activity is recommended using actual evidence |
| Daily goal and progress not prominent | Show meaningful progress and achievable plan |
| No visible resume action | Resume interrupted activity when supported |

Recommended structure: study-room title, exam countdown/goal, estimated level and target with appropriate evidence, one primary personalized next action, daily plan (e.g. speaking, vocabulary review, reading), progress/completion, compact shortcuts to manual tools.

Illustrative only: learner band 6.0 → target 7.5; recommended task “Improve your speaking coherence” because recent answers need clearer transitions; 10-minute speaking practice, 5-minute vocabulary review and 8-minute reading challenge. Do not hard-code these scores, diagnoses or times as user data. Use a meaningful, correctly defined progress indicator or omit it.

### M06 — Learning Roadmap (`06-roadmap`) — P1

- `-- → 7.5` needs a clear “starting level not established” explanation.
- `+0.0` without baseline is meaningless; hide until valid.
- Four-milestone panorama clips adjacent cards and descriptions: show a clear timeline, allow access to full labels and explanations, use desktop width effectively.
- Large next-step cards: compact expandable timeline.
- Start, Mark Step Done and Skip compete: emphasize expected action. Distinguish self-reported completion from evidence of mastery.
- Show why a step is recommended, what competency it develops and what outcome is expected. Explain plan adaptations and why they happen.
- “Calibrate your exact band” overstates a short diagnostic: use estimated band with coverage/uncertainty.
- Roadmap should track competencies and not merely check off activities. Preserve flexibility to skip/reschedule optional steps and reflect that correctly in the learner model.

### M07 — Practice Hub (`07-practice`) — P1

- Oversized simulator cards: compact list or responsive grid.
- Skill filters clip horizontally: improve scroll affordance or adaptive wrapping/sizing.
- Generic descriptions: communicate actual simulator benefits.
- Search, difficulty/topic filtering, completed/new/in-progress status and personalized recommended pack are not visible; verify and improve discoverability.
- Show download/availability status and pack metadata.
- Roadmap shortcut competes with practice library: make contextual and secondary.
- Preserve Exam Mode (timed, defined constraints) and Study Mode (untimed/hints where supported); explain differences consistently per skill.

### M08 — Reading Practice Setup (`08-practice-setup-reading`) — P0/P1

**Observed content defect:** Reading setup says “Official timer & linear audio” for Exam Mode and “Transcripts, speed & AI hints” for Study Mode. These descriptions are suited primarily to Listening. Inspect shared configuration and correct skill-specific text for every exam/skill/mode/locale.

| Reading Exam Mode | Reading Study Mode |
|---|---|
| Timed reading assessment | Untimed/flexible reading practice |
| Exam-style questions | Hints and explanations where supported |
| No answer assistance | Vocabulary/comprehension support |
| Results after submission | Flexible feedback as appropriate |

Additional problems: heavily truncated pack titles, RTL truncation from wrong side in Sanjia, raw topic identifiers, repeated duration metadata, missing visible difficulty/topic filters and prior attempt status. Compact rows and allow full title access. Do not promise official exam timing for a shortened pack unless accurate.

### M09 — Reading Simulator (`09-reading-sim`) — P0/P1

- Passage/question tabs require frequent switching on mobile; preserve independent scroll positions and selected question/annotation state.
- No visible passage position indicator; help user resume reading position.
- Three unexplained highlight colors need accessible labels or clear purpose. Place highlighting/note tools contextually rather than crowding title.
- Large header and generous line spacing reduce usable reading area; keep comfortable readability with compact controls.
- No visible annotation management or review/flag state; verify and provide useful controls.
- Four-question short pack should be clearly labeled as practice rather than full simulation.
- Verify Persian question-navigation order, English answer field direction and official-style workspace consistency.
- On desktop use resizable split panes, passage on left and questions on right for English exam content, independent scrolling, compact header (timer, progress, exit) and persistent footer (question navigation, flagged/answered status, submit).
- Confirm submission and handle unanswered questions according to rules. Preserve responses/annotations during switching and recoverable failures. Ensure exam vs study assistance rules.

### M10 — Listening Simulator (`10-listening-sim`) — P0/P1

Current layout dedicates large space to one question, with much of lower screen unused. Improve question workspace and navigation.

- Fix Persian audio duration order (`00:00 / 03:40`).
- Replace raw `[GAP]` token with a clear blank/input and appropriate word-limit label.
- Focused/All, Previous/Next and numbered question navigation may be redundant; clarify roles and disabled states. Keep unanswered/answered/flagged status accessible.
- Provide clear playback progress and consistent localization.
- Timer 29:59 alongside 3:40 track and ten-question section may be intentional; distinguish overall test/section time and recording duration.
- Verify timing before playback, buffering, interruption/recovery, accidental exit, and exam playback restrictions. Avoid unfair loss of time in preparation or infrastructure failures unless explicitly required and communicated by the simulation rules.
- In Study Mode expose replay, transcript and speed controls when supported; in Exam Mode enforce declared restrictions.
- Desktop: persistent audio player with question workspace; avoid showing an inappropriate transcript in exam mode.

### M11 — Writing Simulator (`11-writing-sim`) — P0/P1

| Observed issue | Required improvement |
|---|---|
| Title combines desalination and workplace automation, but Task 1 is about desalination | Show task-specific title; verify prompt/asset mapping |
| Dark navy/purple chart differs from app identity | Use readable neutral chart styling when original asset can safely be restyled; do not alter source data |
| Small chart labels | Accessible readable expansion/zoom |
| Prompt occupies much of screen | Collapsible prompt; preserve easy access while writing |
| Editor below lengthy prompt | Prioritize typing area, including with keyboard visible |
| Persian word count reversed | LTR isolate counter |
| Draft autosave claim without status | Visible saved/saving/error status based on real persistence |
| Task switching unclear | Preserve drafts and correct timer state per exam rules |
| Submit appears primary with 0 words | Define incomplete-submission behavior, warn appropriately; avoid invalid blocking of legitimate exam submission |

Desktop: prompt/chart on one side, response editor on other; compact timer/task selection/word count, autosave indicator and submit. Ensure word counting and task rules are accurate per exam, and spelling/grammar assistance obeys Exam vs Study mode. Test keyboard, paste behavior as appropriate, timer/timeout, drafts and switching.

### M12 — Speaking Simulator (`12-speaking-sim`) — P0, critical verification

Observed: timer 01:20, unresolved mic permission, and Start Recording Answer styled as a primary action. Screenshot cannot prove countdown or button functionality. Verify that permission/preparation does not consume scored response time unfairly and that recording cannot start without required permission.

- Allow Mic, Retry Permission and Open Settings overlap; present a clear state-dependent action and recovery help instead of three competing options.
- Explain turn numbering and part progression. Fix mixed Persian/English permission UI and sequence direction.
- Show mic input level or test feedback, recording status, elapsed/remaining time, and recording progress/waveform where appropriate.
- Protect recorded answers from loss, invalid/empty audio, network errors and duplicate uploads/evaluations.

Recommended session state machine: microphone preparation → ready (prompt/preparation rules) → recording → answer saved/validated → evaluation → actionable feedback and follow-up. Start scored timer after readiness according to exam rules. Handle denied/revoked/unavailable mic, stop, interruptions and retry. Separate pronunciation evidence from broader speaking quality and disclose scoring limitations. Evaluate fluency, coherence, grammar, vocabulary and pronunciation according to supported rubric.

### M13 — Micro-Drills (`13-micro-drills`) — P1

The screen resembles a static catalogue. Oversized cards repeat duration; technical names such as TFNG Speed Trap Identifier may confuse beginners. Skill grouping, difficulty, completed status and recommendation rationale are not visible.

Use compact grouped rows, localized user-friendly labels, skill/time/difficulty/status where meaningful, and personalized explanations. Example (only with real evidence): “Recommended because you frequently confuse False with Not Given questions.” Fix mixed-language metadata and RTL chevrons in Sanjia. Connect outcomes to the learner profile and future drills rather than treating drills as isolated tasks.

### M14 — Full Mock (`14-full-mock`) — P1

- Current progress counts scored stages only: differentiate not started, in progress, submitted, evaluating, scored and failed where applicable.
- Start Next Stage label is truncated; make fully readable.
- Show estimated total time commitment and stage durations; distinguish flexible staged practice from a realistic continuous exam simulation.
- Highlight current stage and support resume/interruption according to defined rules.
- Explain result aggregation, including writing task weighting and individual skill coverage, with appropriate score caveats.
- Provide pre-exam checklist (audio, mic, conditions) and completion/result access. Verify stage completion only after final scoring as declared, without losing pending submissions.

### M15 — Smart Coach (`15-coach`) — P1, major product improvement

Currently appears as three independent tools (daily mission, speaking upgrade, content ingestion), not a coherent intelligent coaching experience. Free sample/Upgrade and roadmap shortcuts precede or compete with the learning content. Cards are large. Audio is visibly locked on both Coach hubs, while both intake screens expose audio as an option; verify actual market/plan entitlement and gating before capture or upload.

Coach should answer: What do I struggle with? What should I learn next? Why this activity? What have I improved? What will happen next? Show diagnosed weaknesses and evidence, one prioritized personalized activity, mastery and adaptive follow-up. Keep manual tools accessible as secondary actions. Clarify free sample and upgrade rules without distracting from initial learning.

### M16 — Daily 10-Minute Mission (`16-daily-mission`) — P1

- “Required Transfer Targets” is technical; call them expressions/structures to practise and explain communicative purpose.
- Two mandatory structures can feel rigid; evaluate natural and appropriate usage, not merely string inclusion. Do not reward awkward forced insertion.
- Group Listen, playback speed and pronunciation controls coherently.
- Long guidance before task: progressive disclosure, concise examples and expandable explanation.
- Writing and speaking need appropriate distinct evaluation criteria and response controls.
- Show mission stages, progress, expected feedback and next step.
- Improve mixed-language Persian explanations and isolate English expressions and input direction.
- Changing topic should preserve intended learning objectives or explicitly update them.
- Provide starter frames as optional scaffolding; record whether assistance was used when relevant to scoring.

The educational goal is effective communication and transfer across contexts, not mere checklist completion.

### M17 — Upgrade My Speaking (`17-register-shifter`) — P1

Minimal form (record or type, topic hint, recording button) leaves much screen space unused and gives little explanation of the output before spending a free sample.

- Show a compact example of original sentence, everyday English, workplace English and academic/exam-appropriate English, with explanation of why each differs.
- Clarify when free sample/allowance is consumed, recording duration (English shows 30 seconds; Persian does not visibly state duration), privacy and audio handling.
- Provide recording guidance, playback/re-record where appropriate, and validation/processing/feedback states.
- Do not conflate complexity with proficiency: sophisticated vocabulary alone does not make a Band 8+ response. Assess naturalness, accuracy, context, register and wider rubric criteria.

Illustrative output (not actual user data or official band scoring):

- Original: “AI makes work faster, but sometimes it makes mistakes.”
- Everyday: “AI helps us work faster, but it doesn't always get things right.”
- Workplace: “AI can improve productivity, although its output still requires human oversight.”
- Academic: “While AI can substantially enhance operational efficiency, its reliability remains a significant concern.”
- Learning focus: contrast, precision, appropriate register.

Ensure rewritten examples preserve the intended meaning unless the system clearly explains a semantic change. Offer practical usage guidance, audio comparison and follow-up transfer practice if supported.

### M18 — Learn From Anything (`18-drop-ingest`) — P1

A potentially exceptional feature currently looks like a basic upload form. Connect imported content to learner goals rather than merely generating generic two-minute quizzes.

| Issue | Recommendation |
|---|---|
| Output not explained | Preview a generated quiz and vocabulary cards |
| Input limits inconsistent across locales | Explain supported formats, image count and audio duration limits; visible English limits are 1–4 images and ≤180s audio |
| Audio entitlement appears inconsistent | Verify actual regional rules; show consistent entitlement states |
| No visible upload progress | Provide input validation, upload/processing progress, safe retry |
| Learning objective not visible | Allow comprehension, vocabulary, listening, speaking or relevant activity selection |
| Source context not visible | Retain attribution and links/context where appropriate |
| No visible ingestion history | Let learners revisit imported material if supported |
| No visible difficulty controls | Adapt content to learner level and goals |

Verify URL ingestion security, file limits, permissions, privacy, source attribution, prompt injection defenses and data handling as described in §3.8. Integrate saved phrases, observed mistakes and generated exercises into the continuing learner model.

### M19 — Vocabulary Deck (`19-vocabulary`) — P1

Initial display shows 200 due, 320 learning, zero mastered, 22 waves and 15 saved words. These may represent seeded library words rather than actual learner activity. This is ambiguous and can overwhelm a new learner.

- Reconcile and label counters by distinct collection; explain seeded vs personal vocabulary.
- Avoid presenting a large artificial review backlog to a new learner. Define scheduling, introduction and daily limits coherently; allow an achievable first session.
- Reduce oversized stat cards and clarify relationship between due backlog, daily new-word cap (10 shown), wave size (15), current wave, and selected session size (15/20/30/All).
- Surface search, organization, source context, review status and mastery criteria. Verify which features already exist below fold.
- Track active usage separately from memorized definition or passive recognition.

Recommended vocabulary semantics (map to actual data model):

| Category | Meaning |
|---|---|
| Available vocabulary | Words in learning library |
| Personal vocabulary | Words explicitly saved by learner |
| Learning | Introduced but not yet retained |
| Due today | Scheduled for review |
| Mastered | Demonstrated retention under defined criteria |
| Applied successfully | Used appropriately in meaningful activity |

The final category is essential for real-world language acquisition; memorization and appropriate usage are different outcomes.

### M20 — Vocabulary Review (`20-vocab-review`) — P1/P2

The flashcard itself is attractive. Improve interaction without sacrificing focused review.

- Excessive space above card on mobile; use intentional centered layout and adapt to smaller screens.
- Audio and pronunciation controls appear twice; clearly differentiate word audio and example-sentence audio and consolidate redundant controls.
- Reveal Answer instructions repeated inside/outside card; use one clear action and accessible card interaction.
- Add a visible progress indicator when useful (existing “Card 1 of 10” is a start). Verify selected batch size as in §3.5.
- Support active recall, context, pronunciation and spaced-repetition scheduling. After reveal, show simple recall difficulty/rating controls if appropriate to the scheduling algorithm.
- The revealed-answer state was not supplied, so existing rating and definition behavior must be inspected rather than assumed absent.
- Desktop: centered distraction-free flashcard workspace; consider keyboard shortcuts with accessible alternatives.

### M21 — Progress & Analytics (`21-progress`) — P1

Currently primarily a statistical dashboard, rather than actionable learning intelligence.

| Issue | Recommendation |
|---|---|
| Estimated band dominates | Include confidence/coverage and provenance where supported |
| Attempts and streak are prominent but limited measures | Include meaningful learning outcomes and assessed competencies |
| Empty chart consumes much space | Actionable initial-state card instead of large empty plot |
| Individual skills low on screen | Present four skills compactly |
| Date filters before any data | Adapt empty-state controls |
| No visible strengths/weaknesses | Explain what scores mean |
| No visible recommended next step | Convert analytics to action |
| Exam vs Study results not distinguished | Label assessment mode/type and compare like with like |

Illustrative populated state only: estimated 6.5, baseline 6.0 (+0.5), target 7.5 (gap 1.0). Example trend values 5.5, 6.0, 6.0, 6.5 across four weeks; target line 7.5. Example skills Listening 7.0, Reading 7.0, Writing 5.5, Speaking 6.0; recommend writing practice because of task development and grammatical accuracy. These values are hypothetical and not necessarily a single consistent scoring snapshot. Never fabricate them or override the actual aggregation rubric. Chart axes must use the correct scale for the selected exam; show uncertainty/coverage where meaningful.

**Sanjia-specific:** Navia transfer card occupies significant area above basic analytics. Make it contextual/secondary, especially before eligibility is met. Clarify «نمره تأییدشده»: a validated internal simulation score is not an official IELTS result. Require eligibility verification, explicit user authorization, clear destination and explanation of data shared, score provenance, and appropriate error/success states. Inspect existing integration and consent before changes.

### M22 — Individual Skill Analytics (`22-progress-skill`) — P1

Visible Reading empty state has a practice button and is functional but uses a lot of whitespace. Explain what will unlock, recommend an appropriate first activity, include estimated duration and clear return navigation.

For populated states, inspect existing metrics and implement supported, evidence-based analytics:

| Skill | Useful metrics |
|---|---|
| Reading | Question-type accuracy, comprehension, reading efficiency, paraphrase recognition |
| Listening | Detail recognition, distractor errors, spelling, comprehension by task type |
| Writing | Task achievement/response, coherence and cohesion, lexical resource, grammatical range and accuracy |
| Speaking | Fluency and coherence, lexical resource, grammar, pronunciation |

Do not invent arbitrary percentages or treat a single response as definitive mastery. Link feedback to actual attempts and relevant follow-up. Populated states were not supplied; existing metrics are unverified.

### M23 — Attempt History (`23-progress-attempts`) — P1/P2

- Empty state reports no attempts but no obvious CTA to create first attempt. Add contextually appropriate practice action.
- Filters clip horizontally; improve responsive scrolling/wrapping and semantics.
- Unexplained history-like header icon: label/action tooltip or clear accessible name.
- Black empty-state icon is inconsistent with palette; align icon system.
- Large unused space; use focused, useful initial experience.
- Inspect populated history and support discoverable search/filter by skill, date, mode, status; reopen feedback, compare comparable attempts, retry, show pending evaluation and failed states as appropriate.
- Distinguish scored attempts, study sessions and drills instead of ambiguously grouping everything as exams.

### M24 — My Weak Spots / Linguistic Graph (`24-linguistic-graph`) — P1, strategically important

Current screen includes recurring mistakes, mastered expressions, topic–weakness adaptation matrix and favorite topics. It does not visually communicate a rich learner model. Favorite topics dominate even though diagnosed needs should be central.

| Issue | Recommendation |
|---|---|
| Raw `favorite_topics` | Localized human-readable label |
| Weakness categories not visible | Group grammar, vocabulary, pronunciation, fluency, coherence, etc. |
| No visible priority | Rank by frequency, severity, learning relevance and evidence |
| No visible evidence | Link to actual mistakes/examples and assessment context |
| No visible mastery progression | Introduced, practising, improving, demonstrated/mastered under defined criteria |
| No visible confidence | Avoid overstating conclusions based on limited evidence |
| Abstract matrix terminology | Practical cross-topic transfer presentation |
| Cumbersome topic controls | Simplify management, including custom topic input (visible in Sanjia) |

Illustrative example, not actual user data: article usage (12 observed errors, high priority); connecting ideas (8, needs practice); word stress (5, improving); academic collocations (2, nearly mastered). Error count alone is insufficient to infer mastery or priority; use exposure/opportunity counts and evidence when available.

Illustrative transfer matrix:

| Expression | Technology | Travel | Work |
|---|---|---|---|
| Despite | Demonstrated | Demonstrated | Practising |
| Albeit | Demonstrated | Not assessed | Practising |
| If…then | Demonstrated | Demonstrated | Demonstrated |
| Provided that | Practising | Not assessed | Not assessed |

“Not assessed” is not failure. Use accessible states, supporting examples, and next reinforcement task. Show how the system knows each competency and allow correction of inaccurate diagnoses where appropriate. Do not present hypothetical mastery bars as measured probabilities.

### M25 — Settings (`25-settings`) — P1

Current settings are dense: large card combines learning focus, topic buttons, vocabulary limits and voice choices, followed by exam calibration. Routine preferences should not require oversized cards and long scrolling. Group settings in logical sections; use compact controls with visible selected state, save behavior, and explanatory copy.

| Category | Potential settings (verify scope/existing behavior) |
|---|---|
| Learning preferences | Focus, daily study time, difficulty |
| Personalization | Interests, recommendation preferences |
| Exam goals | Exam track, target score, date |
| Vocabulary | Daily new-word limit, review preferences |
| Audio and speech | Accent, speed, mic, voice preview |
| Appearance | Language, theme, text size |
| Account | Profile, email, password, devices |
| Offline and storage | Downloaded packs, sync, storage |
| Subscription | Plan, usage, renewal |
| Privacy | Recordings, consent, export, deletion |
| Support | Help, feedback, policies |

Some may already exist below screenshot boundaries. Improve organization and discoverability rather than duplicate. Hide internal Kokoro AI voice IDs in ordinary UI; present natural labels and preview pronunciation if supported. Ensure changes have clear persistence and effect, especially exam track changes, target recalibration and language switching.

### M26 — Premium / Paywall (`26-paywall`) — P0/P1, commercial priority

Visible regional differences:

| Feature | Mockza | Sanjia |
|---|---|---|
| Seven-day plan | $9.99 | ۱۹۹٬۰۰۰ تومان (199,000 Toman) |
| Monthly plan | $19.99 | ۳۹۰٬۰۰۰ تومان (390,000 Toman) |
| Three-month plan | Not visible | ۸۹۰٬۰۰۰ تومان (890,000 Toman) |
| Monthly AI evaluation allowance | 150 | 120 |
| Daily speaking allowance | 10 | 10 |
| Daily writing allowance | 10 | 10 |

These are screenshot values, not confirmed current billing configuration. Regional pricing and entitlement differences can be deliberate. Verify authoritative backend/store configuration and do not silently equalize them.

| Issue | Customer impact / required improvement |
|---|---|
| Daily and monthly limits presented separately | Users may assume 20 evaluations every day all month. Explain both caps apply and how resets work |
| Seven-day allowance not fully differentiated | Clarify exact pass eligibility, duration, usage limits and comparison with monthly plan |
| Best Value / Most Popular label | Give meaningful basis or remove unsupported claim |
| Billing interval/renewal details not fully visible | Show duration, total price, recurring vs one-time, renewal and cancellation terms |
| Long dense feature list | Summarize primary benefits, retain complete transparent fair-use details |
| No visible remaining free usage | Explain sample allowance, consumption and reason to upgrade |
| No visible premium feedback example | Preview concrete personalized rubric feedback and useful improvements |
| Mobile-store management message | Explain actual desktop purchase path; if purchase is unavailable, give clear supported steps without dead end |
| Restoration/cancellation controls not visible | Verify and surface supported purchase management and restore flow |
| Persian claims of accurate AI assessment | Validate and qualify scoring claims |

Preserve the approved core benefits after resolving C01–C03: screenshots say 10 speaking + 10 writing evaluations/day subject to other applicable caps, but IRN PDR says 8+8; monthly cap differs by brand; unlimited mistake-to-deck saves; offline reading/listening packs; AI rationale/explanation. Sanjia mentions Persian vocabulary meanings. Verify what “unlimited” actually means, offline access behavior, and all regional terms. The seven-day pass text suggests 10+10 daily in Mockza; do not infer a monthly cap or total entitlement for this pass without checking configuration.

Use centralized entitlement configuration as source of truth rather than scattered translation strings. Clearly differentiate locked/unavailable/free/paid states. Server-side accounting, retries, receipt validation, restoration, cancellation, expiry and device policy must agree with actual store/backend behavior. Do not hide material limits to improve conversion. Lead with learner value and outcomes, followed by transparent plan comparison.

## Appendix B — Exact screenshot inventory and cross-platform mapping

All files listed below were present in the supplied corpus. MF/SF are 824×1830 images; desktop regular captures are 1440px wide (landing images are tall resized captures). File names contain `-app-` for the desktop SPA despite the confusing naming convention. An em dash means no corresponding screenshot in this corpus, not a confirmed absence of the feature. Desktop landing/calculators are intentionally web-public; mobile native launch need not reproduce the static website.

| Reference | Mockza file | Sanjia file |
|---|---|---|
| M01 | `mockza-01-onboarding-step1.png` | `sanjia-01-onboarding-step1.png` |
| M02 | `mockza-02-onboarding-step2.png` | `sanjia-02-onboarding-step2.png` |
| M03 | `mockza-03-auth.png` | `sanjia-03-auth.png` |
| M04 | `mockza-04-diagnostic-intro.png` | `sanjia-04-diagnostic-intro.png` |
| M05 | `mockza-05-home.png` | `sanjia-05-home.png` |
| M06 | `mockza-06-roadmap.png` | `sanjia-06-roadmap.png` |
| M07 | `mockza-07-practice.png` | `sanjia-07-practice.png` |
| M08 | `mockza-08-practice-setup-reading.png` | `sanjia-08-practice-setup-reading.png` |
| M09 | `mockza-09-reading-sim.png` | `sanjia-09-reading-sim.png` |
| M10 | `mockza-10-listening-sim.png` | `sanjia-10-listening-sim.png` |
| M11 | `mockza-11-writing-sim.png` | `sanjia-11-writing-sim.png` |
| M12 | `mockza-12-speaking-sim.png` | `sanjia-12-speaking-sim.png` |
| M13 | `mockza-13-micro-drills.png` | `sanjia-13-micro-drills.png` |
| M14 | `mockza-14-full-mock.png` | `sanjia-14-full-mock.png` |
| M15 | `mockza-15-coach.png` | `sanjia-15-coach.png` |
| M16 | `mockza-16-daily-mission.png` | `sanjia-16-daily-mission.png` |
| M17 | `mockza-17-register-shifter.png` | `sanjia-17-register-shifter.png` |
| M18 | `mockza-18-drop-ingest.png` | `sanjia-18-drop-ingest.png` |
| M19 | `mockza-19-vocabulary.png` | `sanjia-19-vocabulary.png` |
| M20 | `mockza-20-vocab-review.png` | `sanjia-20-vocab-review.png` |
| M21 | `mockza-21-progress.png` | `sanjia-21-progress.png` |
| M22 | `mockza-22-progress-skill.png` | `sanjia-22-progress-skill.png` |
| M23 | `mockza-23-progress-attempts.png` | `sanjia-23-progress-attempts.png` |
| M24 | `mockza-24-linguistic-graph.png` | `sanjia-24-linguistic-graph.png` |
| M25 | `mockza-25-settings.png` | `sanjia-25-settings.png` |
| M26 | `mockza-26-paywall.png` | `sanjia-26-paywall.png` |
| W01 | `mockza-01-landing.png` | `sanjia-01-landing(3).png` |
| W02 | `mockza-02-calc-ielts.png` | `sanjia-02-calc-ielts(3).png` |
| W03 | `mockza-03-calc-pte-concordance.png` | `sanjia-03-calc-pte-concordance(3).png` |
| W04 | `mockza-04-app-welcome.png` | `sanjia-04-app-welcome.png` |
| W05 | `mockza-05-app-onboarding-goal.png` | `sanjia-05-app-onboarding-goal.png` |
| W06 | `mockza-06-app-diagnostic-intro.png` | `sanjia-06-app-diagnostic-intro.png` |
| W07 | `mockza-07-app-diagnostic-session.png` | `sanjia-07-app-diagnostic-session.png` |
| W08 | `mockza-08-app-diagnostic-result.png` | `sanjia-08-app-diagnostic-result.png` |
| W09 | `mockza-09-app-auth-login.png` | `sanjia-09-app-auth-login.png` |
| W10 | `mockza-10-app-home.png` | `sanjia-10-app-home.png` |
| W11 | `mockza-11-app-roadmap.png` | `sanjia-11-app-roadmap.png` |
| W12 | `mockza-12-app-practice.png` | `sanjia-12-app-practice.png` |
| W13 | `mockza-13-app-practice-drills.png` | `sanjia-13-app-practice-drills.png` |
| W14 | `mockza-14-app-practice-full-mock.png` | `sanjia-14-app-practice-full-mock.png` |
| W15 | `mockza-15-app-practice-reading.png` | `sanjia-15-app-practice-reading.png` |
| W16 | `mockza-16-app-practice-listening.png` | `sanjia-16-app-practice-listening.png` |
| W17 | `mockza-17-app-practice-writing.png` | `sanjia-17-app-practice-writing.png` |
| W18 | `mockza-18-app-practice-speaking.png` | `sanjia-18-app-practice-speaking.png` |
| W19 | `mockza-19-app-vocabulary.png` | `sanjia-19-app-vocabulary.png` |
| W20 | `mockza-20-app-vocabulary-review.png` | `sanjia-20-app-vocabulary-review.png` |
| W21 | `mockza-21-app-progress.png` | `sanjia-21-app-progress.png` |
| W22 | `mockza-22-app-progress-compare.png` | `sanjia-22-app-progress-compare.png` |
| W23 | `mockza-23-app-coach.png` | `sanjia-23-app-coach.png` |
| W24 | `mockza-24-app-settings.png` | `sanjia-24-app-settings.png` |
| W25 | `mockza-25-app-paywall.png` | `sanjia-25-app-paywall.png` |

### Cross-reference by task

| Flutter | Desktop |
|---|---|
| M01 | W04 |
| M02 | W05 |
| M03 | W09 |
| M04 | W06 |
| — | W07–08 |
| M05 | W10 |
| M06 | W11 |
| M07–08 | W12 |
| M09 | W15 |
| M10 | W16 |
| M11 | W17 |
| M12 | W18 |
| M13 | W13 |
| M14 | W14 |
| M15 | W23 |
| M16–18 | W23 entries only |
| M19 | W19 |
| M20 | W20 |
| M21 | W21 |
| M22–23 | W21 verify drilldown/history; W22 comparison |
| M24 | W23 Weak Spots entry |
| M25 | W24 |
| M26 | W25 |
| — | W01–03 public pages |

## Appendix C — Source references and limits

- `PDR(2).md` v4.0 — §1–8; FR-001–064, NFR-001–015, domain reference matrix, monetization.
- `ADR(1).md` v4.0 — ADR-001–022, architecture, route and API surface, persistence, AI, testing and traceability.
- `PDR-Iran.md` v4.0 — IRN-FR-001–018, edition contract, Persian UX, Navia, monetization.
- `ADR-Iran.md` v4.0 — ADR-IRN-001–008, flavor isolation, LTR boundary, Jalali, payment/auth, parity.
- `mockza-sanjia-agent-audit.md` — previous detailed mobile audit, retained/adapted in Appendix A; no source code or actual user research.
- 102 screenshot files listed in Appendix B. No independent external score-table verification or source-code execution performed; calculator concordance, grading calibration, security, runtime and provider claims are verification requirements rather than confirmed defects.

**Final instruction:** Treat this document as an engineering and product-quality backlog with explicit acceptance evidence, not a demand to implement all speculative features or to pretend all tests passed. Preserve what works; make all four variants genuinely complete, and report every unresolved blocker or owner decision.
