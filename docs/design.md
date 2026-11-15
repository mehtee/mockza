# Mockza — Universal Mobile Design System & Component Specification

**Version:** 1.0 · **Status:** Implementation handoff · **Primary mode:** Dark · **Product:** Mockza (IELTS, PTE Academic, TOEFL iBT, DET) · **Language/direction:** English / LTR

> **Hand this document to an implementation agent.** Build a consistent **app-wide visual language**, not a one-off screen. Reuse the same tokens, geometry, icons, components, behaviors, and spacing in every destination, form, practice workflow, exam, review, vocabulary card, and modal. **The reference image is illustrative rather than a source of exact measured pixels**; the specifications and tokens below are the implementation source of truth.

**Included in the downloadable package:** `MOCKZA_DESIGN_SYSTEM.md` (this self-contained spec, including CSS), `mockza.css` (standalone stylesheet), `tokens.json` (portable tokens), `example.html` (offline-openable visual example), and `assets/mockza-dark-reference.png` (original concept reference).

![Dark visual reference](assets/mockza-dark-reference.png)

---

## 1. Design intent / non-negotiables

1. **Calm and premium.** Near-black canvas, charcoal/navy surfaces, small purposeful accents, strong white typography, no noise or unnecessary decorative illustrations.
2. **Habit-app simplicity for exam preparation.** Progress is visually satisfying, but clarity and academic credibility outrank gamification.
3. **One obvious next step.** Every major surface should have one primary action; the rest should be secondary, tertiary, or contextual.
4. **Consistent visual grammar.** Same spacing scale, corner radii, card shells, icons, buttons, state feedback, progress bars, and bottom navigation across all routes.
5. **The shell disappears during timed tests.** Exam mode uses an immersive workspace with only essential controls and confirmation on exit.
6. **Honest data.** Estimated score ≠ official result. “+0.5 this month” only when supported by sufficient attempts. Never fabricate a band, trend, study day, or offline-ready state.
7. **Easy to recover.** All writing and speaking work must be locally safe before a network evaluation. Retry must not waste credit when failure occurred before a completed evaluation.
8. **Accessibility first.** 44×44 minimum hit targets (48 preferred), dynamic type up to **2.0×**, visible focus, readable contrast, icons + text for categories, never color-only status.
9. **Ad-free and quiet.** No banners, intrusive prompts, celebratory confetti, cluttered charts, or carousel overload.
10. **Native-feeling.** Follow iOS/Android safe areas, keyboard avoidance, hardware back, haptic conventions, reduced motion, and OS screen-reader semantics.

### Design vocabulary

**Keywords:** precise, warm-dark, spacious, focused, polished, understandable, supportive, academic.

**Avoid:** generic AI neon dashboards, glassmorphism everywhere, glowing edges on every card, 3D illustrations, several competing CTAs, tiny labels, excessive metric cards, emoji as primary icons, saturated red/green score judgments.

---

## 2. Visual tokens (the reusable foundation)

### 2.1 Color — canonical dark palette

| Semantic token | Hex | Purpose |
|---|---|---|
| `bg` | `#0C0F19` | Main app background |
| `bg-raised` | `#111522` | Sheets and lifted containers |
| `surface` | `#191D2D` | Default card, input, toolbar |
| `surface-alt` | `#20243A` | Nested accents, pills, icon backgrounds |
| `surface-hover` | `#292E47` | Press/hover feedback |
| `border` | `#353B52` | Subtle 1px borders, separators |
| `border-strong` | `#4B5270` | Hover/selected outlines |
| `text` | `#F6F8FC` | Primary information |
| `text-secondary` | `#B6BDCD` | Descriptions and metadata |
| `text-tertiary` | `#949DB2` | Less important hints (still legible) |
| `accent` | `#9580FF` | Active navigation, focus on selected interactive elements |
| `accent-pressed` | `#7A65DF` | Pressed accent |
| `focus` | `#A8CFFF` | Keyboard accessibility outline |
| `blue` | `#70BEFF` | Speaking accent / alternate data series |
| `violet` | `#AC91FF` | Writing accent |
| `mint` | `#66DBB5` | Reading accent |
| `amber` | `#F2C16B` | Attention / neutral warning |
| `success` | `#6EE2BA` | Confirmed success (with label/icon) |
| `warning` | `#F2C16B` | Recoverable issue (with label/icon) |
| `danger` | `#FF949C` | Destructive/failed state (with label/icon) |
| `track` | `#34394E` | Empty progress/slider track |

**Gradients:** primary CTA `linear-gradient(110deg, #6B8CFF, #8D70F7)`; score fill `linear-gradient(90deg, #6CCEFF, #917AFB)`; hero card `linear-gradient(125deg, #222840, #1C2036 63%, #28234C)`; recommendation card `linear-gradient(135deg, #252841, #211F38)`.

**Usage limits:** Use gradients on *at most one hero surface and one primary CTA per visible viewport*. Do not fill all cards with gradients. Outlines and lower contrast, not glowing shadows, separate components. Use tint only for icon wells and statuses. Colors are never the sole indicator of an exam criterion or grade.

**Light mode:** Product supports it, but **dark is the visual reference**. Use the semantic overrides in `mockza.css`/`tokens.json`; do not invert hex values programmatically.

### 2.2 Typography

- **Family:** `Inter`; fallback to system San Francisco on iOS and Roboto on Android. Use bundled/system typography only according to licenses; do not embed random decorative fonts.
- **Weight choices:** Regular 400, Medium 500, Semibold 600/650, Bold 700/750. Avoid ultra-thin and extreme black weights.
- **Scale (logical px / dp / pt equivalent, not physical pixels):**

| Role | Size / line height | Weight | Notes |
|---|---|---|---|
| Hero score | 72 / 0.95 | 750 | Tabular numerals; shrink safely on small screens |
| Page headline | 34 / 1.12 | 750 | Tight letter spacing `-0.04em` |
| Section heading | 24 / 1.18 | 750 | `-0.035em` tracking |
| Card/row title | 18 / 1.30 | 650 | Usually one or two lines |
| Card score | 29 / 1.12 | 750 | Tabular numerals |
| Body | 16 / 1.50 | 400–600 | Main readable copy |
| Secondary | 14 / 1.45 | 400–600 | Controls/helpful metadata |
| Caption | 12 / 1.45 | 400–600 | Only where genuinely secondary |

- Maintain meaningful hierarchy, not many font sizes. Keep secondary labels short. Respect platform accessibility font scaling up to 200%; **never disable dynamic type to preserve a screenshot**.
- User essays and long passages: 16–18px equivalent, line height 1.65–1.85, selection, zoom, and comfortable reading measure.

### 2.3 Spacing / geometry

| Token | Value | Rule |
|---|---|---|
| Spacing steps | `4, 8, 12, 16, 20, 24, 28, 32, 40` | Use scale, no arbitrary 11/17/23px |
| Horizontal page inset | `20` | `16` on narrow devices ≤360px |
| Sections | `28` top separation | Title → content `14` |
| Card internals | `20` | Compact cards `12–16` |
| Card gaps | `12` | Skill-grid / paired cards |
| Default corner radius | `22` | All major cards |
| Compact corner radius | `14–18` | Inputs/buttons/tiles |
| Hero radius | `22` | No over-rounded “bubble” surfaces |
| Pill radius | `999` | Only chips and badges |
| Border | `1px` | Subtle and consistent |
| Preferred tap target | `48×48` | Minimum `44×44` |
| Bottom navigation | `76` plus safe-area inset | Fixed/sticky; content scrolls underneath with bottom padding |
| Content width | `100%` on phones; max `680` on wide devices | Do not stretch phone cards full desktop width |
| Icons | `22–24` | Action well `40–48` |

**Responsive behavior:** On narrow screens preserve readable text and vertical scroll; on tablets expand content modestly. Never force the entire dashboard into a single viewport. On 200% font size, two-column skill cards may switch to one column. Keep the CTA visible without obscuring the keyboard. The bottom navigation hides during any immersive session.

### 2.4 Elevation and motion

- Mostly flat surfaces with a border; shadows only for overlays, bottom sheets, and prominent floating elements.
- Interaction durations: `140–180ms` for press/selection; `180–240ms` for navigation/sheet reveal. Easing `ease-out`; no bouncing or nonessential continuous animation.
- Haptics: light selection on flashcard reveal/saved phrase, soft success only when an action actually succeeded. Respect OS preferences.
- `prefers-reduced-motion`: disable nonessential transitions and animations.

---

## 3. Iconography — one icon language throughout

**Use Lucide** icon set (`lucide-react`, `lucide-react-native`, or matching platform vector assets). Default outline strokes: **1.9–2px**, round caps/joins, consistent optical 24px box. Active nav may be filled only if the family supports a consistent matched glyph; outline + accent color is the safe default. Never mix with emoji, Material icons, Font Awesome, etc. on the same surface.

| Intent / feature | Lucide icon | Accessibility label when icon-only |
|---|---|---|
| Product mark | Custom gradient “M” wordmark | Mockza |
| Main overview destination | `house` | Overview |
| Practice destination | `circle-play` | Practice |
| Vocabulary destination | `layers-3` | Vocabulary |
| Progress destination | `chart-no-axes-column-increasing` | Progress |
| Settings | `settings` | Settings |
| Exam switch | `chevron-down` | Change exam |
| Target score | `target` | Target score |
| Speaking | `mic` | Speaking |
| Writing | `pencil` | Writing |
| Reading | `book-open` | Reading |
| Listening | `headphones` | Listening |
| Personalized drill | `audio-lines` | Recommended speaking drill |
| Continue / next | `arrow-right` | Continue |
| Positive trend | `trending-up` | Score improved |
| Study streak | `flame` | Study streak |
| Completed study day | `check` / `check-circle-2` | Completed |
| Calendar/date | `calendar-days` | Test date |
| Timer | `timer` | Time remaining |
| Mic readiness | `mic` / `mic-off` | Microphone status |
| Audio replay | `rotate-ccw` | Replay audio |
| Save to vocabulary | `bookmark-plus` | Save word |
| Download/offline | `download` / `check-circle-2` | Download or ready offline |
| Evaluation pending | `loader-circle` / `cloud-upload` | Upload/evaluation state |
| Recovery/retry | `refresh-cw` | Retry |
| Pause/play | `pause` / `play` | Pause/play |
| Back/exit | `arrow-left` / `x` | Go back / close |
| Information/privacy | `info` / `shield-check` | Details / privacy |
| Compare attempts | `git-compare-arrows` | Compare attempts |
| Errors and warnings | `alert-circle` / `alert-triangle` | Status and guidance |

**Icon category palette:** Speaking → blue, Writing → violet, Reading → mint, Listening → blue. When blue appears in two skills, their *labels and distinct icons* maintain clear differentiation. In charts, also distinguish by markers/line styles and direct labels.

---

## 4. App shell and repeated composition rules

### 4.1 Global shell (outside active timed exams)

1. **Top/identity area:** brand mark + “Mockza”; compact exam selector directly below/beside the brand; one icon-only settings button at top-right. Keep background plain; avoid a giant colored header.
2. **Context headline area:** one short motivating or task-specific headline (e.g., “Keep improving.”), one secondary line (exam deadline/current task context), optional target pill. Do not make every page use the same headline.
3. **Primary content area:** one leading hero or key task, then supporting sections with left-aligned semibold headings and `28px` section separation.
4. **Cards:** consistent `22px` radius, subtle 1px border, dark elevated fill; compact cards for two-column metrics; no more than one decorative gradient card in the immediate visual hierarchy.
5. **Bottom tabs (exactly four):** **Home**, **Practice**, **Vocabulary**, **Progress**. Icon above label, active accent, fixed with safe-area and full-width tap target. Hide on onboarding, deep-focus tests, and full-screen feedback where relevant.
6. **Sheets:** use anchored bottom sheets for filters, exam pickers, task metadata, saved-word actions, and subscription explanation. Do not turn every small interaction into a route.
7. **Feedback surfaces:** non-blocking toast for success, inline status for failure, bottom sheet for decisions, full-screen confirmation only when loss of work/privacy/payment merits it.

### 4.2 Repeatable visual rhythm

`identity → context → one key metric/action → 2–4 supporting items → recommendation/recovery → optional study habit/progress → navigation`

This is a **composition guideline**, not a mandate that every route shows scores. For practice, the key item is a task; for vocabulary, it is due cards; for progress, it is a trend; for feedback, it is a result; for settings, it is a grouping of preferences.

### 4.3 Reference composition (illustrative fixture)

The bundled image shows a concrete sample of this system. Build these *reusable components*, not one screen-specific arrangement:

- **BrandHeader:** small gradient “M”, “Mockza”, “IELTS Academic” chip, settings button.
- **ContextIntro:** “Keep improving.” + “12 days until your exam” + “Target 7.5” pill.
- **MetricHero:** “Estimated Band”, a large `6.5`, positive change pill `+0.5 this month`, a normalized score progress bar, target tick and labels.
- **SkillMetricGrid:** four two-column cards (Speaking 6.0; Writing 6.5; Reading 7.0; Listening 6.5) with icon well, numeric score and thin progress bar.
- **RecommendationCard:** audio-lines icon, “Improve your speaking fluency”, “3-minute AI micro-drill”, one gradient “Start” CTA.
- **StudyWeekStrip:** 7 labeled days, checkmarks for completed days, distinct today outline, `4/7 days studied` textual summary.
- **PrimaryTabBar:** four destinations with consistent icons, one selected state.

**All numbers above are screenshot fixtures only.** Never hardcode them in production. `target`, `estimatedScore`, `confidence`, `lastDelta`, `skillScores`, `recommendedTask`, and `daysStudied` come from app state.

### 4.4 Score progress semantics

- Show genuine test-specific scales: IELTS 0–9, PTE 10–90, DET 10–160, TOEFL current official scale only when verified for the relevant exam version. Do not apply an IELTS `Band` label across all exam types.
- A bar uses `position = (value - min) / (max - min)`. The **target marker** independently uses the same formula. Never use the target as the bar maximum without explicitly labeling the scale.
- For unavailable/insufficient data: **“Not yet estimated”**, with a diagnostic CTA; do not render zero as if it were a failing exam score.
- Show improvements only when measured; if sample size is low, say “Early estimate” or “Based on X attempts.” All AI estimates should be labeled **estimated**, not certified/official.
- For criteria, use a visual meter **and** exact value, label, and a plain-language interpretation.

---

## 5. Component library: contract, appearance, states

These names are **suggested implementation names**, not mandatory technology choices. Build composable primitives first; avoid copying entire page JSX per route.

| Component | Contents / appearance | Required variants and behavior |
|---|---|---|
| `AppScaffold` | Safe-area layout, optional top header, content, bottom tabs | `standard`, `immersive`, `onboarding`; keyboard avoidance |
| `BrandHeader` | M wordmark, product title, exam selector, settings | Compact on scroll; picker shows exam + variant |
| `SectionHeader` | Semibold title, optional right metadata/action | One-line when possible, wraps at 2× type |
| `Card` | Surface, 1px border, radius 22, padding 20 | Default, highlighted, interactive, disabled, loading |
| `IconWell` | 40–48 box, 12–14 radius, tinted background | Blue, violet, mint, amber, neutral; paired with text |
| `Chip` | 36–40 height, pill border, icon optional | Selectable, info/target, positive, warning, quota |
| `MetricHero` | Label, dominant score, trend, scale/tick | `value`, `pending`, `notEnoughData`, `offline`, `stale` |
| `SkillMetricCard` | Icon, skill name, score, progress cue | Value and no-data variants; press opens skill analytics |
| `ScoreMeter` | 7–10px track, gradient fill, target marker | Numeric min/max, text labels, accessibility value |
| `RecommendationCard` | Icon, strong 1–2 line title, short subtitle, CTA | Loading, available, locked, interrupted, resume/retry |
| `PrimaryButton` | 48+ height, rounded 14, accent gradient | Default, pressed, disabled, loading; one primary CTA/region |
| `SecondaryButton` | Surface-alt, border, same height | Optional icon, pressed, disabled |
| `IconButton` | 48×48 focusable outlined container | Accessible label required; destructive variant distinct |
| `WeekDayTile` | Small tile, day abbreviation, status glyph | `completed`, `current`, `missed`, `upcoming` |
| `StudyWeekStrip` | 7 day tiles + text fraction | Scroll or reflow gracefully at large fonts |
| `TabBar` | 4 icons + labels with active state | Active, inactive, focus, a11y labels; hidden in Exam Mode |
| `BottomSheet` | Dim backdrop, grabber, title, actions | Snap/collapse, keyboard-aware, escape/back closure |
| `StatusBanner` | Inline icon, title, explanation, action | Success, warning, error, uploading, offline, queued |
| `EmptyState` | Quiet icon, title, explanation, one CTA | No attempts, no due words, no downloaded pack |
| `Skeleton` | Low-contrast shape placeholders | No flashing/pulsing if reduced motion |
| `Toast` | Short confirmation with label/icon | Screen-reader announcement; auto-dismiss; undo if relevant |
| `FormField` | Label, input, supporting text and validation | Error message textual, keyboard and focus support |
| `TaskCard` | Skill icon, exam type, time, difficulty, mode | Ready, locked, in-progress, downloaded, unavailable |
| `TimerBar` | Large readable countdown + status | Preparation, response, paused in study, hard stop in exam |
| `AudioLevelMeter` | Microphone input visual and spoken indicator | Permission denied, silence, clipping, recording |
| `AudioPlayer` | Play/pause, clock, scrubber only if permitted | Exam single-play; study seek/speed/replay |
| `TranscriptSegment` | Synced text span with annotations | Filler, pause, grammar, phrasing; icons/underline, not color only |
| `AnnotatedText` | Highlighted writing span and suggestion detail | Tap/keyboard open rationale, Save Word, apply view |
| `EvidenceLink` | Answer → cited passage sentence | Scroll/focus to anchor; preserves reading position |
| `VocabCard` | Cloze prompt and reveal, synonyms, origin | `front`, `revealed`, reviewed; ratings Again/Hard/Good/Easy |
| `TrendChart` | Low-ink trend lines with values | Labeled axes, accessible data table equivalent |
| `AttemptListRow` | Type, date, score, completion state | Open, queued, pending, failed with inline retry |
| `CompareAttempts` | Two attempts and criterion deltas | Explicit labels, diff markers, no unexplained colors |

### Common component state machine

- **Loading:** preserve layout dimensions; explain if wait is material. Avoid spinners with no context.
- **Empty:** state why, how to begin, and one clear action.
- **Success:** say what completed; do not exaggerate evaluation certainty.
- **Offline:** make capability explicit: reading/listening keys and cached assets available, AI evaluation queued if network is unavailable.
- **Uploading/evaluating:** persist local audio first, then show distinct `Saved locally → Uploading → Evaluating → Preparing feedback → Ready` steps.
- **Interrupted:** offer `Resume`, `Retry upload`, or `Discard` (confirmation required); never silently lose an attempt.
- **Quota limited:** show remaining AI uses and the reset/entitlement rule exactly as supplied by backend; paywall appears contextually, not as a full-screen interruption during tests.
- **Permission denied:** state why mic is needed and open device settings when supported.

---

## 6. Navigation and destinations (apply this design system everywhere)

Keep navigation shallow: four top-level tabs plus supporting screens and contextual sheets.

| Destination | Primary reusable layout blocks |
|---|---|
| **Home** | BrandHeader, ContextIntro, MetricHero, SkillMetricGrid, RecommendationCard, StudyWeekStrip |
| **Practice** | SectionHeader, skill selection cards, task catalog, Full Mock action, mode chips, downloaded status |
| **Vocabulary** | Due-count hero, Start Review CTA, saved phrases, spaced repetition card, review summary |
| **Progress** | Score trend, criterion breakdown, skill cards, attempt list, comparison picker, streak |
| **Onboarding** | Simplified logo/header, exam picker, score target, optional exam date, sample CTA; skip mandatory sign-in |
| **Task selection/setup** | TaskCard, Study/Exam segmented choice, rules summary, preflight mic/cache check, Start CTA |
| **Immersive Exam Workspace** | TimerBar, task content, input/audio tools, safe local save, confirm-exit; **no tab bar** |
| **AI evaluation/review** | ScoreHero, criterion meters, transcript/essay annotations, model rewrite, Save Word, retry, drill |
| **Attempt details** | Attempt metadata, original work, feedback, answer evidence, compare versions, retry upload |
| **Profile/settings** | Surface-grouped sections, target, exam profile, purchases, quota, offline packs, sync, privacy |
| **Upgrade** | Minimal plan comparison sheet/screen, quotas, restore purchases, no misleading urgency |

### Exam-specific UI adaptations

- **Speaking:** mic preflight; prep and speak timers; animated-but-calm waveform; local `.m4a` persistence; transcript synchronized to playback; `Retry Same Prompt`.
- **Writing:** clean editor, timer, saved indicator, word count, optional reference prompt/passage, annotated result, side-by-side or stacked rewrite on mobile.
- **Reading:** independently scrollable passage/questions where screen space permits; highlight + notes + evidence jump; no tiny split view on phones.
- **Listening:** pre-audio reading cue; single play in Exam Mode; offline cache status; study-only replay, speed and transcript.
- **Vocabulary:** front/back flashcard, optional audio, concise explanation, four SM-2 buttons, provenance to original attempt.
- **Full Mock:** task sequencing, clear stage counter, duration, resume rules, quiet summary at end.

**Do not put every exam brand/type on the surface at once.** The selected exam changes vocabulary, scale, timer policies and task catalog, while layout primitives remain consistent.

---

## 7. Layout blueprints

### A. Standard app view

```text
┌──────────────────────────────────────────┐
│ Safe area                                 │
│ [Mockza]  [Exam ▾]              [Settings]│
│                                          │
│ Context headline             [small chip]│
│ Short supporting explanation             │
│                                          │
│ ┌── Primary metric / activity ─────────┐ │
│ │ Label / value / honest progress      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Section heading                          │
│ ┌────────── Card ───────┐ ┌── Card ────┐ │
│ │ icon + data + meter  │ │ ...        │ │
│ └──────────────────────┘ └────────────┘ │
│                                          │
│ Section heading                          │
│ ┌── Recommended next action ───────────┐ │
│ │ Explanation                 [Start]  │ │
│ └──────────────────────────────────────┘ │
│ ...scrollable content...                 │
├──────────────────────────────────────────┤
│  Home      Practice   Vocabulary Progress│
│  icon      icon       icon       icon    │
└──────────────────────────────────────────┘
```

### B. Immersive timed workspace

```text
┌──────────────────────────────────────────┐
│ [Exit*]  Task 2 / 4        [03:42 left]  │
│──────────────────────────────────────────│
│ Prompt and required reference material   │
│                                          │
│ Large reading / writing / speaking area   │
│ (keyboard / passage / recording waveform)│
│                                          │
│ Clear status: Saved locally ✓            │
│                                          │
│             [Submit / Finish]            │
└──────────────────────────────────────────┘
* Exit confirms save/abandon and never loses work accidentally.
```

### C. Result and AI explanation view

```text
┌──────────────────────────────────────────┐
│ [Back]     Your result                    │
│ Estimated score + rubric criterion values│
│                                          │
│ Your answer / own audio + synced text     │
│ Tap highlighted issue → why / better way │
│                                          │
│ Personalized rewrite / model answer       │
│                                          │
│ [Save Word]   [Retry]   [3-min Drill]     │
└──────────────────────────────────────────┘
```

---

## 8. Detailed visual and interaction rules

### Metric hero

- Prominent score on left; small explanatory trend badge next to/below; contextual target on right. Keep all three semantically labeled.
- One 10px soft progress track. If a target tick exists, mark it as a **distinct line** and expose target in text.
- Don't crop dynamic-type score. On very narrow screens stack the target below; do not shrink body text below 14.
- No score if no validated estimate; show “Take a diagnostic” action instead.

### Skill cards

- Two-column grid by default; 1 column when space/font scaling demands.
- Top row contains icon well, label, numeric value; below is 7px meter. All four share size and spacing.
- Visual colors are decorative; distinguish skills by readable names and symbols.
- Entire card may be tappable; accessible label e.g., “Speaking, estimated band 6.0, view details.”

### Recommendation card

- Exactly one primary next action. Title describes **what to improve**, subtext gives **time/format**, CTA verb is short (“Start”, “Resume”, “Retry”).
- If no personalized recommendation exists, show a valid default diagnostic or latest activity; label it appropriately.
- On narrow screens put CTA on a new row/full width; don't crush title.

### Weekly strip

- Seven tiles with day abbreviations; completed shows check icon, current day has 2px accent outline, future has empty ring. Other statuses require text available to assistive technology.
- Use local calendar and actual user activity. “4/7 days studied” is separate readable summary. User can inspect days without interpreting green alone.
- On accessibility fonts, horizontal scroll or alternate compact list; never overlap labels.

### Buttons, sheets, feedback

- Exactly one high-emphasis filled CTA per major card or flow step; secondary actions outlined/surface-based.
- Dialogs are for destructive/permanent decisions, not routine information.
- Bottom sheets have handle + clear title + dismiss affordance + keyboard accessibility, and don't cover focused inputs.
- Non-blocking upload status can be seen across tabs and in attempt archive until resolved.
- Status always uses label + icon; color is supplemental.

---

## 9. Accessibility / UX engineering acceptance criteria

- [ ] **At 200% system type, all content remains operable.** Allow wrapping, scrolling, reflow and taller cards; no clipped score, labels, timers or CTAs.
- [ ] **Touch targets** are ≥44×44 logical px, preferably 48×48, with ≥8px spacing between dangerous/adjacent actions.
- [ ] All text passes **WCAG AA** applicable contrast; dynamic text on gradients is checked at the lightest background location.
- [ ] All icon-only actions have voice labels and hints; all scores announce units and estimated status.
- [ ] Keyboard focus order is logical; `:focus-visible` and native focus indicators are visible.
- [ ] Screen-reader progress bars expose min/max/current/target as text; charts have a readable text/table alternative.
- [ ] A score tier, mistake type, or completion status is **never communicated with hue alone**.
- [ ] Exam exit/back swipe/hardware back prompts explicit save/leave choice; task is autosaved locally.
- [ ] Reading & Listening offline answer checking works without AI; Study Mode audio controls differ correctly from Exam Mode.
- [ ] Audio is stored locally **before upload**; any failed upload offers retry, preserves recording, and clarifies quota accounting.
- [ ] Writing autosave persists after backgrounding and before focus loss; shows real saved/saving/error status.
- [ ] During Exam Mode autocorrect/assistive writing restrictions follow supported platform APIs without harming accessibility.
- [ ] No navigation distractions during timed tests. Back controls must be usable and safe, not suppressed without alternative.
- [ ] Reduce-motion, high-contrast, light theme, offline, keyboard-open, smallest device, and tablet states are tested.
- [ ] Do not claim independent AI score estimates are official or guaranteed (“+1.5” rewrite is a learning target, not promised score gain).

---

## 10. Implementation agent instructions

**Goal:** Turn the attached reference and design specifications into a production-quality, app-wide reusable UI kit and apply it consistently across existing routes. The reference is only one *composition* of universal parts. Do not build a screen-specific set of hardcoded widgets.

**Implementation sequence:**

1. Inspect the existing repo/framework/routes; preserve current architecture, state management and business logic.
2. Create semantic theme tokens (dark first, light via same semantic keys), typography and spacing; use supplied CSS/JSON as the design contract.
3. Install/use one Lucide icon family; add any custom brand mark as a project asset (do not substitute emoji).
4. Implement core primitives: `AppScaffold`, `Card`, `IconWell`, `SectionHeader`, `Button`, `Chip`, `ScoreMeter`, `TabBar`, `BottomSheet`, `StatusBanner`, `FormField`.
5. Implement composite components: `MetricHero`, `SkillMetricCard`, `RecommendationCard`, `StudyWeekStrip`, `TaskCard`, `AttemptListRow`, `VocabCard`, `TranscriptSegment`, `AnnotatedText`, `CompareAttempts`.
6. Apply them to all existing Mockza destinations, including immersive workspaces and offline/evaluation states, without changing examination rules.
7. Wire all UI to **real** app state, navigation, quotas, saved work and backend signals. Replace example values with fixtures only in demos/tests.
8. Audit every route for large text, dark/light, small screens, safe areas, permission denied, offline, progress waiting, completed feedback, error, no-data and screen readers.
9. Compare visual rhythm to `assets/mockza-dark-reference.png`, but follow this spec where generated text/scale/geometry is inconsistent.
10. Deliver clean reusable components, no duplicated style literals, and runnable previews/tests.

**Preferred file structure (adapt to actual stack):**

```text
src/
  design/
    tokens.(ts|json)
    themes.(ts|css)
    typography.(ts|css)
    icons.(ts|tsx)
  components/
    primitives/  AppScaffold Card Button Chip IconWell ScoreMeter
    navigation/  BrandHeader TabBar BottomSheet
    progress/    MetricHero SkillMetricCard StudyWeekStrip TrendChart
    practice/    TaskCard TimerBar AudioLevelMeter AudioPlayer
    feedback/    AnnotatedText TranscriptSegment CompareAttempts
    vocabulary/  VocabCard
    states/      StatusBanner EmptyState Skeleton Toast
  features/      ... existing route/business logic ...
```

**Example domain contracts (adapt to project types):**

```ts
type ExamId = 'ielts-academic' | 'ielts-general' | 'pte' | 'toefl-ibt' | 'det';
type SkillId = 'speaking' | 'writing' | 'reading' | 'listening';
type AsyncState = 'idle' | 'saved-local' | 'queued' | 'uploading' | 'evaluating' | 'ready' | 'failed';
type ScoreEstimate = {
  examId: ExamId;
  label: string;                   // Band / Score / exam-specific label
  min: number;
  max: number;
  value: number | null;            // null => do not invent score
  target: number | null;
  change?: number | null;
  sampleSize?: number;
  estimated: true;
};
type SkillMetric = { skill: SkillId; score: number | null; scoreLabel: string };
type Recommendation = {
  id: string; skill: SkillId; title: string; durationMinutes: number;
  state: 'available' | 'locked' | 'resume' | 'queued';
  actionLabel: 'Start' | 'Resume' | 'Retry' | 'Upgrade';
};
type StudyDay = { dateISO: string; completed: boolean; isToday: boolean };
```

**Example composition (framework-neutral pseudocode):**

```tsx
<AppScaffold bottomTabs={<TabBar activeTab={route.tab} />}>
  <BrandHeader exam={selectedExam} onSelectExam={openExamPicker} onSettings={openSettings} />
  <ContextIntro title={context.title} subtitle={context.subtitle} target={score.target} />
  <MetricHero estimate={score} />
  <SectionHeader title="Your skills" />
  <SkillMetricGrid metrics={skills} onSelect={openSkillAnalytics} />
  <SectionHeader title="Recommended next" />
  <RecommendationCard task={nextTask} onAction={startOrResume} />
  <StudyWeekStrip days={recentDays} />
</AppScaffold>
```

> **Mandatory:** `MetricHero` derives min/max from selected exam. `TaskCard`/`TimerBar` obey exam policy. `TabBar` is not present during active timed test. `onAction` is genuinely wired. All example text/data can be changed based on context. Nothing here should force a route called “Home” for reuse.

---

## 11. Visual QA checklist / done definition

- [ ] One shared color and typography source; dark UI matches the reference's calm, rich contrast.
- [ ] Every major card has consistent fill, border, padding, radius and section rhythm.
- [ ] All four top-level tabs use same icon size, baseline, label typography and active-state color.
- [ ] A 375–393px device matches the intended density without overflow; smaller devices scroll rather than compress illegibly.
- [ ] One prominent action per surface, visually subordinate secondary actions.
- [ ] The same `ScoreMeter`, `Card`, `Chip`, `Button`, and `StatusBanner` styles appear across exam setups, results, vocabulary and analytics.
- [ ] Generated reference score text is **not used as production data**.
- [ ] Empty, loading, queued, failed and retry states have useful text and reliable action controls.
- [ ] Immersive timed session does not accidentally show global tab bar or distracting cards.
- [ ] `prefers-reduced-motion`, 2× font scale, safe areas and low-connectivity flows pass checks.
- [ ] Visual/regression screenshots cover both themes, critical pages, and selected/unselected tab states.

---

## 12. Full baseline CSS (copy/paste)

The code below is identical to the accompanying `mockza.css`. Use CSS variables for web/React; convert to semantic theme objects and `StyleSheet`/design tokens for React Native/SwiftUI/Compose. **Do not treat HTML CSS units as literal hardware pixels.**

```css
/* Mockza universal UI foundation • v1.0
   Use across all app surfaces. Source reference is a visual guide,
   not a pixel-perfect specification. Dark is canonical; light is optional.
   Unit convention: CSS px on web ~= logical dp/pt on native (not device pixels).
*/
:root, [data-theme="dark"] {
  color-scheme: dark;
  --mz-bg: #0C0F19;
  --mz-bg-raised: #111522;
  --mz-surface: #191D2D;
  --mz-surface-alt: #20243A;
  --mz-surface-hover: #292E47;
  --mz-border: #353B52;
  --mz-border-strong: #4B5270;
  --mz-text: #F6F8FC;
  --mz-text-secondary: #B6BDCD;
  --mz-text-tertiary: #949DB2;
  --mz-accent: #9580FF;
  --mz-accent-pressed: #7A65DF;
  --mz-accent-contrast: #090B14;
  --mz-focus: #A8CFFF;
  --mz-blue: #70BEFF;
  --mz-violet: #AC91FF;
  --mz-mint: #66DBB5;
  --mz-amber: #F2C16B;
  --mz-success: #6EE2BA;
  --mz-warning: #F2C16B;
  --mz-danger: #FF949C;
  --mz-success-bg: #15362F;
  --mz-warning-bg: #3C301B;
  --mz-danger-bg: #3B2029;
  --mz-track: #34394E;
  --mz-shadow: 0 10px 28px rgba(0,0,0,.22);
  --mz-gradient-primary: linear-gradient(110deg,#6B8CFF 0%,#8D70F7 100%);
  --mz-gradient-score: linear-gradient(90deg,#6CCEFF 0%,#917AFB 100%);
  --mz-gradient-hero: linear-gradient(125deg,#222840 0%,#1C2036 63%,#28234C 100%);
  --mz-gradient-action: linear-gradient(135deg,#252841 0%,#211F38 100%);
  --mz-font: Inter, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  --mz-space-1: 4px;
  --mz-space-2: 8px;
  --mz-space-3: 12px;
  --mz-space-4: 16px;
  --mz-space-5: 20px;
  --mz-space-6: 24px;
  --mz-space-7: 28px;
  --mz-space-8: 32px;
  --mz-space-10: 40px;
  --mz-radius-sm: 10px;
  --mz-radius-md: 14px;
  --mz-radius-lg: 18px;
  --mz-radius-xl: 22px;
  --mz-radius-2xl: 26px;
  --mz-radius-pill: 999px;
  --mz-page-inline: 20px;
  --mz-bottom-nav-height: 76px;
  --mz-max-content: 680px;
}
[data-theme="light"] {
  color-scheme: light;
  --mz-bg: #F7F8FC;
  --mz-bg-raised: #FFFFFF;
  --mz-surface: #FFFFFF;
  --mz-surface-alt: #F0F2FA;
  --mz-surface-hover: #E9EDF9;
  --mz-border: #D7DCE9;
  --mz-border-strong: #BAC3D6;
  --mz-text: #161A2B;
  --mz-text-secondary: #454F63;
  --mz-text-tertiary: #5B667C;
  --mz-accent: #5E4CCF;
  --mz-accent-pressed: #483AA5;
  --mz-accent-contrast: #FFFFFF;
  --mz-focus: #2858C0;
  --mz-blue: #1968BD;
  --mz-violet: #6049BA;
  --mz-mint: #147E62;
  --mz-amber: #956116;
  --mz-success: #147E62;
  --mz-warning: #956116;
  --mz-danger: #B22A44;
  --mz-success-bg: #DDF6EC;
  --mz-warning-bg: #FFF1D8;
  --mz-danger-bg: #FFE7EC;
  --mz-track: #DCE1EF;
  --mz-shadow: 0 8px 28px rgba(26,36,74,.08);
  --mz-gradient-primary: linear-gradient(110deg,#5269D8 0%,#6C52CF 100%);
  --mz-gradient-score: linear-gradient(90deg,#3E86DC 0%,#7962D8 100%);
  --mz-gradient-hero: linear-gradient(125deg,#F1F4FF 0%,#F7F5FF 100%);
  --mz-gradient-action: linear-gradient(135deg,#EDF0FF 0%,#F4F0FF 100%);
}
* { box-sizing: border-box; }
html { font-family: var(--mz-font); background: var(--mz-bg); }
body { margin: 0; color: var(--mz-text); background: var(--mz-bg); font-family: var(--mz-font); -webkit-font-smoothing: antialiased; }
button, input, textarea, select { font: inherit; }
button, a, input, textarea, select { -webkit-tap-highlight-color: transparent; }
button { cursor: pointer; }
button:disabled, [aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
:focus-visible { outline: 3px solid var(--mz-focus); outline-offset: 3px; }
[hidden] { display: none !important; }
.mz-app { min-height: 100dvh; background: var(--mz-bg); }
.mz-page { width: 100%; max-width: var(--mz-max-content); margin-inline: auto; padding: max(12px,env(safe-area-inset-top)) var(--mz-page-inline) calc(var(--mz-bottom-nav-height) + env(safe-area-inset-bottom) + 28px); }
.mz-page--immersive { max-width: 100%; padding-bottom: max(20px,env(safe-area-inset-bottom)); }
.mz-stack { display: flex; flex-direction: column; gap: var(--mz-space-4); }
.mz-row { display: flex; align-items: center; gap: var(--mz-space-3); }
.mz-row--between { justify-content: space-between; }
.mz-grow { flex: 1; min-width: 0; }
.mz-grid-2 { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.mz-grid-4 { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; }
.mz-section { margin-top: 28px; }
.mz-section-title { margin: 0 0 14px; font-size: 24px; line-height: 1.18; font-weight: 750; letter-spacing: -.035em; }
.mz-heading { margin: 0; font-size: clamp(28px,7vw,34px); line-height: 1.12; font-weight: 750; letter-spacing: -.04em; }
.mz-title { font-size: 18px; line-height: 1.3; font-weight: 650; letter-spacing: -.02em; }
.mz-body { font-size: 16px; line-height: 1.5; }
.mz-small { font-size: 14px; line-height: 1.45; }
.mz-caption { font-size: 12px; line-height: 1.45; }
.mz-metric { font-size: clamp(52px,15vw,72px); line-height: .95; letter-spacing: -.055em; font-weight: 750; font-variant-numeric: tabular-nums; }
.mz-metric-sm { font-size: 29px; line-height: 1.12; font-weight: 750; font-variant-numeric: tabular-nums; }
.mz-secondary { color: var(--mz-text-secondary); }
.mz-tertiary { color: var(--mz-text-tertiary); }
.mz-brand { display: inline-flex; gap: 10px; align-items: center; font-size: 27px; line-height: 1; font-weight: 750; letter-spacing: -.04em; }
.mz-brand-mark { color: var(--mz-accent); font-size: 30px; font-weight: 850; font-style: italic; letter-spacing: -.12em; }
.mz-icon { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; flex: none; }
.mz-icon--sm { width: 18px; height: 18px; }
.mz-icon--lg { width: 26px; height: 26px; }
.mz-icon-box { width: 48px; height: 48px; flex: 0 0 48px; border-radius: 14px; display: grid; place-items: center; background: var(--mz-surface-alt); }
.mz-icon-box--blue { color: var(--mz-blue); background: color-mix(in srgb,var(--mz-blue) 16%,var(--mz-surface)); }
.mz-icon-box--violet { color: var(--mz-violet); background: color-mix(in srgb,var(--mz-violet) 16%,var(--mz-surface)); }
.mz-icon-box--mint { color: var(--mz-mint); background: color-mix(in srgb,var(--mz-mint) 16%,var(--mz-surface)); }
.mz-icon-box--amber { color: var(--mz-amber); background: color-mix(in srgb,var(--mz-amber) 16%,var(--mz-surface)); }
.mz-icon-button { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; color: var(--mz-text); background: var(--mz-surface); border: 1px solid var(--mz-border); }
.mz-icon-button:hover { background: var(--mz-surface-hover); }
.mz-pill { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: var(--mz-radius-pill); border: 1px solid var(--mz-border); background: var(--mz-surface-alt); color: var(--mz-text); padding: 7px 12px; font-size: 14px; line-height: 1.2; font-weight: 600; min-height: 36px; }
.mz-pill--target { border-color: color-mix(in srgb,var(--mz-accent) 48%,var(--mz-border)); background: color-mix(in srgb,var(--mz-accent) 15%,var(--mz-surface)); }
.mz-pill--positive { color: var(--mz-success); border-color: color-mix(in srgb,var(--mz-success) 24%,transparent); background: var(--mz-success-bg); }
.mz-card { background: var(--mz-surface); border: 1px solid var(--mz-border); border-radius: var(--mz-radius-xl); padding: 20px; min-width: 0; }
.mz-card--hero { background: var(--mz-gradient-hero); padding: 22px 20px; }
.mz-card--action { background: var(--mz-gradient-action); }
.mz-card--interactive { transition: background .16s ease, border-color .16s ease, transform .16s ease; }
.mz-card--interactive:hover { border-color: var(--mz-border-strong); }
.mz-card--interactive:active { transform: scale(.992); }
.mz-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 8px 0 12px; }
.mz-intro { display: flex; align-items: end; justify-content: space-between; gap: 10px; margin: 26px 0 22px; }
.mz-intro-copy { min-width: 0; }
.mz-intro-copy p { margin: 8px 0 0; font-size: 16px; line-height: 1.4; color: var(--mz-text-secondary); }
.mz-progress-track { position: relative; width: 100%; height: 10px; background: var(--mz-track); border-radius: 999px; overflow: visible; }
.mz-progress-fill { height: 100%; max-width: 100%; border-radius: inherit; background: var(--mz-gradient-score); }
.mz-progress-target { position: absolute; width: 2px; top: -6px; bottom: -6px; border-radius: 2px; background: var(--mz-text); opacity: .8; }
.mz-progress-labels { display: flex; justify-content: space-between; color: var(--mz-text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; margin-top: 10px; }
.mz-skill-card { padding: 16px; border-radius: 18px; }
.mz-skill-card .mz-skill-meta { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; }
.mz-skill-card .mz-skill-name { flex: 1; font-size: 15px; font-weight: 600; line-height: 1.2; }
.mz-skill-card .mz-metric-sm { font-size: 26px; }
.mz-skill-card .mz-icon-box { width: 40px; height: 40px; flex-basis: 40px; border-radius: 12px; }
.mz-skill-card .mz-progress-track { height: 7px; }
.mz-skill-card .mz-progress-fill { background: var(--skill-color,var(--mz-gradient-score)); }
.mz-button { min-height: 48px; display: inline-flex; justify-content: center; align-items: center; gap: 8px; border: 1px solid transparent; border-radius: 14px; padding: 11px 18px; font-size: 15px; font-weight: 700; line-height: 1.25; text-decoration: none; white-space: normal; text-align: center; }
.mz-button--primary { color: #FFFFFF; background: var(--mz-gradient-primary); border-color: rgba(255,255,255,.18); }
.mz-button--secondary { color: var(--mz-text); background: var(--mz-surface-alt); border-color: var(--mz-border); }
.mz-button--ghost { color: var(--mz-text); background: transparent; }
.mz-button--destructive { color: var(--mz-danger); background: var(--mz-danger-bg); }
.mz-action { display: flex; align-items: center; gap: 14px; }
.mz-action .mz-action-copy { flex: 1; min-width: 0; }
.mz-action .mz-action-copy strong { display: block; font-size: 17px; line-height: 1.32; letter-spacing: -.015em; }
.mz-action .mz-action-copy span { display: block; margin-top: 4px; color: var(--mz-text-secondary); font-size: 13px; }
.mz-day-strip { display: grid; grid-template-columns: repeat(7,minmax(0,1fr)); gap: 7px; }
.mz-day { min-height: 70px; min-width: 0; padding: 9px 3px 7px; display: flex; flex-direction: column; justify-content: space-between; align-items: center; gap: 5px; border-radius: 14px; border: 1px solid var(--mz-border); color: var(--mz-text-secondary); background: var(--mz-surface); font-size: 12px; }
.mz-day--done { background: var(--mz-success-bg); border-color: color-mix(in srgb,var(--mz-success) 20%,var(--mz-border)); }
.mz-day--current { border: 2px solid var(--mz-accent); color: var(--mz-text); background: color-mix(in srgb,var(--mz-accent) 14%,var(--mz-surface)); }
.mz-day-mark { width: 23px; height: 23px; border-radius: 50%; border: 2px solid var(--mz-border-strong); display: grid; place-items: center; }
.mz-day--done .mz-day-mark { border: none; color: var(--mz-accent-contrast); background: var(--mz-success); }
.mz-day--current .mz-day-mark { border-color: var(--mz-accent); }
.mz-bottom-nav { position: fixed; z-index: 30; bottom: 0; left: 0; right: 0; background: color-mix(in srgb,var(--mz-bg) 92%,transparent); border-top: 1px solid var(--mz-border); backdrop-filter: blur(18px); padding-bottom: env(safe-area-inset-bottom); }
.mz-bottom-nav__inner { width: 100%; max-width: var(--mz-max-content); margin: auto; min-height: var(--mz-bottom-nav-height); display: grid; grid-template-columns: repeat(4,1fr); }
.mz-tab { display: flex; align-items: center; flex-direction: column; justify-content: center; gap: 5px; color: var(--mz-text-secondary); background: transparent; border: 0; padding: 8px 3px; font-size: 12px; font-weight: 550; min-width: 0; }
.mz-tab[aria-current="page"] { color: var(--mz-accent); font-weight: 700; }
.mz-tab .mz-icon { width: 24px; height: 24px; }
.mz-sheet-backdrop { position: fixed; inset: 0; z-index: 39; background: rgba(0,0,0,.56); }
.mz-sheet { position: fixed; bottom: 0; left: 0; right: 0; z-index: 40; background: var(--mz-bg-raised); border: 1px solid var(--mz-border); border-radius: 26px 26px 0 0; padding: 12px 20px max(20px,env(safe-area-inset-bottom)); max-height: min(90dvh,960px); overflow-y: auto; }
.mz-sheet-handle { height: 5px; width: 42px; border-radius: 5px; background: var(--mz-border-strong); margin: 0 auto 16px; }
.mz-toast { border-radius: 14px; background: var(--mz-surface-alt); color: var(--mz-text); border: 1px solid var(--mz-border); padding: 12px 16px; box-shadow: var(--mz-shadow); }
.mz-state { border: 1px solid var(--mz-border); border-radius: 18px; background: var(--mz-surface); padding: 20px; }
.mz-state--error { border-color: color-mix(in srgb,var(--mz-danger) 36%,var(--mz-border)); }
.mz-state--success { border-color: color-mix(in srgb,var(--mz-success) 36%,var(--mz-border)); }
.mz-field { display: flex; flex-direction: column; gap: 8px; }
.mz-field label { font-size: 14px; font-weight: 650; }
.mz-input { color: var(--mz-text); background: var(--mz-surface); min-height: 48px; border: 1px solid var(--mz-border); border-radius: 12px; padding: 12px 14px; width: 100%; }
.mz-input::placeholder { color: var(--mz-text-tertiary); }
.mz-input[aria-invalid="true"] { border-color: var(--mz-danger); }
.mz-focus-bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--mz-bg); padding: 12px 0; border-bottom: 1px solid var(--mz-border); }
.mz-exam-workspace { min-height: 100dvh; background: var(--mz-bg); }
.mz-editor { min-height: 40dvh; resize: vertical; font-size: 16px; line-height: 1.75; }
.mz-reading-layout { display: grid; grid-template-columns: minmax(0,1.2fr) minmax(280px,.8fr); gap: 16px; }
.mz-reading-panel { overflow: auto; max-height: calc(100dvh - 160px); }
.mz-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
@media (max-width: 600px) {
  .mz-reading-layout { display: flex; flex-direction: column; }
  .mz-reading-panel { max-height: none; }
}
@media (max-width: 360px) {
  :root { --mz-page-inline: 16px; }
  .mz-grid-2 { gap: 9px; }
  .mz-skill-card { padding: 12px; }
  .mz-skill-card .mz-icon-box { width: 34px; height: 34px; flex-basis: 34px; }
  .mz-skill-card .mz-skill-name { font-size: 14px; }
  .mz-action { flex-wrap: wrap; }
  .mz-action .mz-button { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; scroll-behavior: auto !important; }
}
/* Large accessibility fonts: prefer wrapping/scrolling instead of clipping. */
@media (max-width: 420px) and (min-resolution: 1dppx) {
  .mz-pill, .mz-tab, .mz-skill-name, .mz-action-copy { overflow-wrap: anywhere; }
}

```

---

**End of specification.** Keep this document and `tokens.json` in the implementation repo as the visual contract. The screenshot is a design reference, not a source of fake metrics or unverified exam policies.
