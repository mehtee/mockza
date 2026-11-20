# Mockza and Sanjia Web and Flutter redesign plan

Planning baseline is commit `a39349e` on 19 November 2026. The approved prototype is the visual and interaction reference. Product surfaces are the static public site in `web/`, the React study app under `/app/`, and the Flutter client in `app/`. Work on new Reading and Listening capability, content, scoring and AI contracts is specified in the companion backlog. [Reading and Listening backlog](READING_LISTENING_IMPLEMENTATION_BACKLOG.md)

## 1. Decisions

- Put the landing experience in the existing Astro build. Put the learner experience in the existing React router and Flutter GoRouter. Use real catalog items, attempts, profiles, auth and billing when a visitor enters the app.
- Give all three surfaces the prototype’s warm paper, forest green, editorial display type and score-led review. Use shared generated color, typography, shape, spacing and motion values. Give the shared components the same anatomy, semantics, states and copy. Adapt placement to the available width and native navigation.
- Use a report-first landing. Visitors can inspect finished examples immediately, try the two objective drills in place, and explore the existing Writing and Speaking examples. Public examples are authored fixtures. Actual learner work uses the production assessment, content and storage paths.
- Bring the web app and Flutter to the same design through the existing themes and components. Start with the study room and one Reading and Listening journey, then apply the same component patterns across the app. Current Writing and Speaking grading, diagnostic scoring, account, device and billing rules remain the functional references.
- Deliver local evidence, replay and practice first. Release enhanced AI coaching once the current explainer can return validated source references through both clients.

## 2. Source map and integration constraints

| Area | Actual owner and behavior | Consequence for the rollout |
| --- | --- | --- |
| Public entry | `web/src/pages/index.astro` renders the existing homepage. `BaseLayout.astro` owns navigation, theme boot, metadata and footer. `public-catalog-{glb,irn}.ts` supply edition build copy. | Replace homepage composition through Astro. Keep build-time language/brand selection and public routes. |
| Desktop app | Astro emits shells from `pages/app/[...slug].astro`. `DesktopSimulatorApp` mounts React and `router.tsx` owns the TanStack route tree with `/app` as its base. `/app/` routes to Home. | Reskin and reorder actual routes. Keep route IDs, versioned static shell, navigation blocking and existing dependency injection. |
| Flutter | `bootstrap.dart` restores appearance before `runApp`. `app.dart` binds the shared preset, both brightness modes, localization and GoRouter. `app/lib/theme/components/` already has app and exam primitives. | Feed updated generated tokens into current theme extensions and adapt current screens. Declare/bundle the fonts and finish locale-aware style selection. |
| Catalog, scoring, and review | Published content is fetched through the catalog/media or Flutter content service. Web uses IndexedDB and OPFS/cache via gateways. Flutter uses Drift and the installed pack. Both grade objective items locally. | Extend content and submission formats compatibly. Keep the source version and learner score paired. Route the new review through the existing objective result view. |
| Deployable Web | `compose.yaml` currently builds `web/Containerfile` and serves Astro/React with Caddy. `app/Containerfile` and the documented low-RAM Flutter-Web path also exist. `.github/workflows/ci.yml` builds Flutter Web. | Check what each live host actually runs before cutover. Exercise the Astro/Caddy image and both editions in release CI. Track Flutter Web as a separate supported build if it is still served. |
| Performance and security | `scripts/check_web_budget.mjs` currently checks zero `/_astro/` scripts on the homepage and public articles, a 95 KiB gzip initial app budget, and a 4 KiB calculator budget. Edition Caddy headers restrict scripts to same origin. | Make the homepage enhancement an explicit, bounded exception in the budget check. Maintain server-rendered HTML and the other public/article and app budgets. Emit the script as an external hashed asset. |

References for the source map. [Homepage](../web/src/pages/index.astro) · [Base layout](../web/src/layouts/BaseLayout.astro) · [Build copy](../web/src/seo/public-catalog.ts) · [React router](../web/src/spa/router.tsx) · [Astro SPA entry](<../web/src/pages/app/[...slug].astro>) · [Flutter bootstrap](../app/lib/bootstrap.dart) · [Flutter app](../app/lib/app.dart) · [Compose](../compose.yaml) · [Astro container](../web/Containerfile) · [CI](../.github/workflows/ci.yml) · [Budget gate](../scripts/check_web_budget.mjs)

### Phase 0. Establish a reproducible baseline

1. Use a clean implementation branch from current main. Treat `web-prototype/` as a local review reference. It was untracked at audit time. Port reviewed source examples, licensed assets and visual rules into their production owners. Record asset hashes, provenance and the reviewed content fixture revision in the implementing change.
2. Build both `dist-glb` and `dist-irn` with their matching edition and API settings. Verify the HTML, `/app/` shell, dynamic deep-link fallback and same-origin `/v1` routing in the Astro container. Compare those against active deployment configuration before assigning production hostnames.
3. Capture real landing, home, Reading practice and review, Listening practice and review, and Flutter phone/tablet equivalents at matching states. Include English/Persian, light/dark, initial and saved appearance, narrow desktop and text enlargement. Record actual transfer-size and load baselines using the existing static budget script.
4. Establish pilot published content for each edition. Start the staging check with the free seed candidates `ielts-acad-reading-pack-01` and `ielts-listening-seed-01`, both marked `all` in source. The seeded `ielts-micro-drill-04` and `ielts-micro-drill-03` are candidate authored material for the Reading and Listening follow-ups. Verify actual availability, cue quality and content fit in each edition. Link the final published IDs through the current routers. [Starter packs](../backend/packages/db/src/seed-data/starter-exams.ts) · [Starter drills](../backend/packages/db/src/seed-data/starter-drills.ts)
5. Record the approved palette and prototype reference states. Compare real-surface screenshots with them as part of acceptance. Existing detailed requirements on exam mode, auth and isolation still govern the behavior. [Desktop architecture](DESKTOP_WEB_PLAN.md) · [Edition requirements](PDR-Iran.md) · [Rapid diagnostic plan](RAPID_DIAGNOSTIC_PLAN.md)

**Exit** when the three current surfaces build, staging topology is recorded for both editions, real sample exercise IDs and coverage are known, and the baseline UX/tests are reproducible.

## 3. Phase 1. Build the shared visual language

### Token and typography changes

The current default is `midnight_indigo` in dark mode. The existing token source already models four presets and outputs CSS, TypeScript and Dart. The generator, JSON schema, TypeScript exports and some Settings code enumerate those four IDs. The Flutter runtime already consumes generated colors and motion, but its text roles are authored in `AppTypography`, and `pubspec.yaml` currently has no active bundled-font declarations. [Token source](../packages/design-tokens/tokens.json) · [Token schema](../packages/design-tokens/tokens.schema.json) · [Generator](../scripts/sync_design_tokens.mjs) · [Token exports](../packages/design-tokens/src/index.ts) · [Web preset labels](../web/src/spa/features/settings/SettingsScreen.tsx) · [Flutter typography](../app/lib/theme/app_typography.dart) · [Flutter manifest](../app/pubspec.yaml)

Promote the approved design to one new built-in preset, proposed ID `editorial_green`. Set it as the shared fresh-install/default-no-preference preset. Use the prototype light presentation for a fresh install. Keep saved valid preset IDs and explicit light, dark or system choices. Add a clear localized preset name in Settings so returning learners can opt in. Treat a stored choice identical to an old default as a real stored preference when its origin is unknown.

| Semantic surface | Prototype light reference | Prototype dark reference | Production mapping |
| --- | --- | --- | --- |
| Page background | `#F8F6EF` | `#17231C` | Existing `background` |
| Elevated content | `#FFFDF7` | `#202F25` | Existing `surface` |
| Soft inset | `#EDF0E4` | `#283E2E` | Existing `surfaceAlt` |
| Section band | `#F0EEE4` | `#1D2A21` | Existing `bgRaised` where it fits |
| Main and secondary text | `#22372D` and `#56665A` | `#EDF2E6` and `#BDCEBC` | Existing text slots, with contrast checked on each consuming surface |
| Primary action and label | `#264E3B` and `#FFFEFA` | `#A9C9A7` and `#172B20` | Existing `primary` and `onPrimary` |
| Focus | `#745A30` | `#FFD497` | Existing `focus` |
| Missed answer | `#983D37` on `#F6E9E4` | `#FFB6A7` on `#4C2F2A` | Existing error role plus glyph and “Missed” label |
| Score panel | Green from `#3A5A43` to `#233D30` with light text | Same dark green reference, subject to dark surface hierarchy | Add a semantic score-panel surface, foreground and muted foreground only after checking whether the current hero slots satisfy both modes |

Checked reference pairs pass text contrast in isolation. Main text on light paper is 11.75:1. Primary button label in light mode is 9.31:1. Muted score-panel text on the lighter end of its gradient is 4.91:1. The reference border `#D9DCD0` against `#FFFDF7` is 1.37:1 and fits decorative separators. Use a stronger semantic control border or visible state indicator when a boundary carries meaning. Validate the rendered states in both modes and the remaining presets.

1. Edit `tokens.json` as the source. Use existing roles for common colors, type and geometry. Add slots only when a component needs a distinct tested role, such as the foreground of a dark score panel. Tokenize the same radius, stroke, surface, spacing, motion and evidence marks across styles. Keep low-contrast decorative outlines distinct from focus and input boundaries.
2. Extend the schema, validators, generator and preset tests in the same change. Have the generated preset catalog own valid IDs and default lookup on both platforms. Derive `AppearancePresetId` from the generated Web set where layer rules permit. Update typed Settings maps, ARB dictionaries, defaults and fallback paths. Prefer extending the existing generated outputs to authoring another color file. Regenerate `web/src/styles/generated-tokens.css`, `web/src/theme/generated-presets.ts` and `app/lib/theme/generated_tokens.dart` together, then run `pnpm tokens:check`.
3. Generate the typography roles that the clients will share. Use Instrument Serif for English editorial large headings and selected score displays. Use Inter for English body, buttons and task text. Use Vazirmatn for Persian UI and headings with a script-appropriate type scale and letterspacing. Use the agreed exam numeral/mono treatment for timers. Preserve English stimulus, transcript, chart labels, answer editors and technical numbers in LTR, even within IRN.
4. Use licensed, locally served WOFF2 on the web. Declare verified upstream TTF/OTF face families and weights in Flutter, retain the licenses, and register them with `LicenseRegistry`. Supply per-script fallback. Use the existing Web edition-font alias so GLB excludes Vazirmatn. Check all Flutter targets and asset payloads with the pinned SDK. Compare IRN English text and Persian fallback visually on real devices.
5. Build both hand-authored light/dark color schemes and their theme extensions from the shared roles. Inspect Flutter Material controls, dialogs, selection, text fields, progress, scrollbars and focus for unthemed defaults. Feed motion through semantic durations/components and OS reduced-motion preferences. Keep route focus and state change visible at zero animation. Retain pre-paint appearance load through `bootstrap.dart` and `theme-boot.js`. Keep local preference keys, test old defaults, corrupt values and explicit modes, and reconcile Web boot storage with the Dexie Settings path.
6. In the pilot views, remove raw aesthetic literals where tokens already cover them. Add a scoped check through the current repository gates if new design work can bypass them. Snapshot the existing presets before the change. Verify their key panels still render with readable states. [Flutter colors](../app/lib/theme/app_colors.dart) · [Flutter theme](../app/lib/theme/app_theme.dart) · [Flutter motion](../app/lib/theme/app_motion.dart) · [Web theme boot](../web/src/pages/theme-boot.js.ts) · [Web theme controller](../web/src/theme/theme-controller.ts) · [Web styles](../web/src/styles/global.css) · [Web edition font wiring](../web/astro.config.mjs)

### Component parity contract

Use this as the implementation handoff between React and Flutter. Astro uses the same CSS roles and semantic HTML for the public sample. Favor extending the current component in its owning library.

| Component | Shared anatomy and behavior | Web entry point | Flutter entry point |
| --- | --- | --- | --- |
| Shell and header | Brand, current section, action, account access, direction-aware geometry, focus order and no progress clutter | `BaseLayout.astro` for public. `AppRootLayout` in `router.tsx` for app | `AppScaffoldShell` and `BrandHeader` with current GoRouter navigation |
| Button, choice and segmented control | Same primary/secondary options, loading and disabled states, min targets, icon meaning, visible focus and selected semantics | `MzButton`, `MzSegmentedControl`, `MzObjectiveAnswerInput` | `mz_buttons.dart`, themed Material selection, `exam_question_controls.dart` |
| Editorial card and summary | Title, count and status, optional help, one primary action, stable padding across states | `MzCard` and extracted feature-level report summary | `MzCard`, `MetricHero`, `ScoreMeter` and review summary |
| Evidence and answer pair | Question, recorded answer, accepted answer, exact source span or clip, text and icon status and optional coach note | `PassageAnnotatorPane` plus review answer/evidence component | `AnnotatedText` and `EvidenceLink` reused in objective review |
| Listening player and transcript | Play/pause, time, optional rate and seek by mode, active cue/line, loading and missing media | `AudioStudioPlayer` and audio gateway | `AudioPlayerBar`, `TranscriptSegment` and audio gateway |
| Workspace and question palette | Source first in reading order, answer panel, current question, status, flag and scroll behavior by width | `SplitPaneWorkspace`, `QuestionPaletteBar`, `SimulatorWorkspaceShell` | Native simulator bodies, `ExamQuestionControls` and existing responsive layout helpers |
| Status, retry and exclusion | Clear labels for loading, partial data, offline, no access and empty states. Data and controls recover in context | `MzBanner` plus route-specific states | `StatusBanner`, `EmptyState` and existing typed failures |
| Next step and drill feedback | Skill or tag plus one linked task, raw part results and explanation in the same order | `MicroDrillsScreen` and reusable next-step/result components | `RecommendationCard` and `MicroDrillsScreen` |

Shared components render state and emit intents. Web feature hooks use gateways rather than direct Dexie, composition or backend imports. Flutter uses existing feature-first models, Riverpod view models, typed failures and repositories. Reuse the current audio and storage adapters. Keep accurate state and text scaling across screen sizes and platforms. [Web UI kit](../web/src/components/ui/index.ts) · [Web exam kit](../web/src/components/exam-kit/index.ts) · [Flutter components](../app/lib/theme/components) · [Flutter theme catalog](../app/lib/theme/theme_catalog.dart)

**Exit** when the Astro reference panel, React review components and Flutter review widgets match the approved reference on the same seeded state. Use fixtures for this visual comparison before the real review journey is wired. Capture 1440 px desktop, 390 px and 320 px compact Web, and representative Flutter phone and tablet states, with both directions and both theme modes.

## 4. Phase 2. Port the homepage and sample interactions

### Public composition

Implement the home as Astro sections assembled by `index.astro`. Retain existing public exam pillars and references for discoverability. Use meaningful sample data in the visible demos.

| Placement | Content and action |
| --- | --- |
| Header | Brand, Sample Report, AI feedback, Exams and Open app. Keep the edition-specific public links and established locale. Support keyboard focus and skip-to-content. |
| Hero | Port the approved notebook art and type hierarchy. Show one concrete Writing improvement and a Speaking clip preview. Lead with “Check my level” and a nearby route to sample feedback. |
| Writing and Speaking | Preserve the strong prototype interactions. Writing shows a prompt, selectable annotations, revised answer and rubric. Speaking has a playable sample, a transcript linked to coaching and accessible playback. Label sample scores and authored feedback clearly. |
| Reading and Listening Sample Report | Default to a completed Reading report. Listening is a peer tab. Show the one missed answer, source evidence, coach note and targeted next action. The inline follow-up keeps the visitor on the landing. Use the published original examples and the same evidence/scoring fixtures as the real feature. |
| Study resources, FAQ and navigation | Keep the useful exam-guide, calculators, vocab and sample-answer paths. Use short descriptions or grouped links. Refresh the public text and metadata when visible copy changes. |

Keep the homepage discoverable with ordinary meaningful `id` anchors such as `#sample-report` and `#ai-feedback`. Support a validated `?skill=listening#sample-report` link and a default Reading fallback. Use real URLs and native controls in the DOM. On a browser with JavaScript disabled, show both readable sample reports, ordinary transcript and audio controls if audio is available, and enabled links to practice. Show enhanced drills only when they can be scored. Give controls and headings meaningful focus after a user switches panel. Preserve separate temporary state per sample and stop a clip when the visitor switches panels.

### Build, content and performance

- Author the public examples and answer keys as a small versioned static fixture at build time, with bilingual UI strings taken from the active edition’s public-copy module. Store English exam stimulus once. Supply verified excerpts, media duration and range, and checked notes. Keep any public fixture in a portable tracked location outside `web-prototype/`. Where the app also uses this example, use common fixtures or cross-checked published pack IDs and checksums to prevent drift.
- Reuse Astro markup, existing tokens and an isolated dependency-light DOM controller for tabs, source seeks, clip limits and deterministic scoring. Use `HTMLAudioElement` in the public controller and existing player/gateway code inside `/app/`. Load assets on explicit playback or as needed near the section. Pause the previously playing sample and release Blob URLs when applicable.
- Emit the controller as a same-origin hashed external script. Inspect the generated tags so Astro optimization cannot inline executable code against the current CSP. Use escaped fixture text and DOM-safe rendering. Keep `BaseLayout` metadata, canonical URL and current `index.md.ts` representation aligned. Update FAQ schema and the crawler-facing summaries if their referenced claims change. Use local licensed assets and record their source.
- Amend `check_web_budget.mjs` intentionally for this one enhanced page. Keep all other zero-script page checks. Budget the demo controller and its transitive initial JavaScript at **8 KiB gzip** as a starting release target. Verify actual output for both editions and keep its baseline `theme-boot.js` separately accounted for. Avoid loading the SPA, auth, Dexie, billing or AI provider on public pages. Compare images, audio, fonts, CLS, LCP and interaction responsiveness against the measured baseline. Gate by measured impact and move optional work later in the loading path where needed.
- Keep edition builds separate. GLB output must pass the existing IRN strings, packages and font leakage check. Test ordinary navigation with browser JS off, CSP enabled, failed audio, narrow width, reduced motion, and anonymous first visit. [Homepage source](../web/src/pages/index.astro) · [Public catalog](../web/src/seo/public-catalog.ts) · [Markdown twin](../web/src/pages/index.md.ts) · [Crawler summary](../web/src/pages/llms.txt.ts) · [Caddy GLB headers](../web/security-headers.glb.caddy) · [Caddy IRN headers](../web/security-headers.irn.caddy)

### Published handoff destinations

| Landing action | Production destination | Context and behavior |
| --- | --- | --- |
| Open app | `/app/` | Existing app entry forwards to `/app/home`. The study room uses current learner state. |
| Check my level | `/app/diagnostic/intro?track=<examId>` | Use supported target IDs such as `ielts_academic` or `toefl_ibt`. Existing diagnostic entry owns preflight, mode and entitlement. |
| Browse practice | `/app/practice?track=<examId>` | Respect existing track validation and fix precedence if the stored profile silently replaces an explicit valid CTA track. A CTA can select a catalog view while leaving the learner’s saved goal intact. |
| Practise from a sample | `/app/practice/reading/<packId>` or `/app/practice/listening/<packId>` | Link only to the staging-verified published pack for this edition. Preserve the real Study/Exam setup. Use a filtered practice list if the edition has no verified matching pack. |
| Open the recommended drill | `/app/practice/drills/<drillId>` | Link to a published, supported drill after its production implementation. Until then the inline example works and the CTA goes to the relevant practice list. |
| Sign in when access requires it | `/app/auth/login` through the existing auth path | Validate a same-origin known app destination and typed search params. Preserve the intended return through auth and onboarding. Reuse device-slot handling and edition auth. |

The sample report is public content. The real result route expects a locally stored attempt. Keep the landing samples behind their public anchor and open the real result route after a committed learner attempt. Demo exercise activity stays ephemeral. Existing practice UX receives published route parameters, not prototype hash IDs or mock user state. [Router paths](../web/src/spa/router.tsx) · [Auth return handling](../web/src/spa/features/auth/AuthScreen.tsx) · [Catalog gateway](../web/src/gateways/catalog.gateway.ts) · [Exam bundle route](../backend/apps/api/src/routes/exams.ts)

**Exit** when a guest can inspect all four skills’ examples, complete both objective drills, and follow real links in both edition builds. A first visit demonstrates actual output before auth. The built homepage loads with CSP and supports the non-JavaScript reading path.

## 5. Phase 3. Redesign the app around the learner’s next decision

### Keep existing routes and business state

Update `HomeScreen.tsx` and Flutter `home_screen.dart` to prioritize the next useful action. Use current Home controllers, draft repositories, and diagnostic and practice data. Show **Resume attempt** first when an unfinished and resumable attempt actually exists. Otherwise show the current recommended drill or next practice based on saved results. For a new learner show **Check my level** and **Practise a skill**. Keep score and week progress in a compact supporting area with links to Progress. When a draft or recommendation is unavailable, keep an actionable empty state. Preserve different exam scales, target editing and account prompts. Review direct link loads, reloads, profile changes, resumed or retired packs and app restarts. [Web Home](../web/src/spa/features/home/HomeScreen.tsx) · [Web Home controller](../web/src/spa/features/home/useHomeController.ts) · [Flutter Home](../app/lib/features/home/presentation/home_screen.dart)

### Surface adoption matrix

| Surface | Web implementation | Flutter implementation | Acceptance |
| --- | --- | --- | --- |
| Entry, goal and diagnostic | Retheme `WelcomeScreen`, `GoalSetupScreen` and existing diagnostic intro, session and result. Apply the common shell and CTA priority. | Apply shared theme and components to current onboarding and diagnostic screens in place. | A direct link or resume reaches the same selected exam and skill after onboarding. All timing, accommodation, authorization and diagnostic scoring remain correct. |
| Home and search/browse | Condense `AppRootLayout` and Home navigation. Keep `PracticeCatalogScreen` as the routed catalogue with track, mode, offline and availability actions. Audit static loading shell for visual parity. | Reorder `HomeScreen` and existing Practice Hub/setup using current routes and local providers. Keep adaptive navigation. | A returning learner can resume and a new learner can choose a skill without searching a dashboard. Track, access and offline indications remain accurate. |
| Active Reading and Listening | Restyle `ReadingSimulatorScreen` and `ListeningSimulatorScreen` with current exam kit. Keep desktop source/task split and question navigation. | Restyle the existing sim screens and question controls. On phones use readable source/task sections and a reachable question palette. At wide constraints prefer a two-pane layout. | Timed or mock attempt, study attempt, exit guard, reload/resume, flags, notes, audio rules, timer and result restoration still pass. |
| Objective result and follow-up | Use `/app/practice/objective-result/$attemptId`. Refactor `ObjectiveResultScreen` into score, question navigator, selected evidence/answer and next action. Route into current Micro-Drills catalog. | Keep `/results/:attemptId` and the productive review. Extract the objective view from `EvaluationReviewScreen` and extend its state. Use existing native player and passage components. Open the existing drill route. | RL-01 through RL-05 pass from a saved real attempt and shared fixture. Old attempts, unavailable audio, offline/cached content and comparison links remain usable. |
| Writing, Speaking and full mock | Apply tokens and common components to existing workspaces, evaluation pending/result, and `FullMockOrchestratorScreen`. Keep autosave, recording, uploads and queue paths. | Apply the same visual voice to Writing, Speaking, pending and full mock. Follow native touch and platform lifecycle rules. | Existing rubric, recording permissions, draft recovery, retries, stage order, retry policy and entitlement tests still pass. |
| Progress and vocabulary | Reuse current history, score, compare and SM-2 routes. Add new objective history or next-step links as those capabilities become available. | Apply the same chart/row/order rules to history, drill entries, vocabulary and review. Keep local study repositories. | Recorded attempt, saved mistake and score contexts remain traceable and raw drills stay outside calibrated progression. |
| Auth, Settings, Legal and plan | Update established pages and component styling. Exercise current OAuth/OTP paths, active devices and checkout handoff. | Theme existing settings, auth, sheets and paywall. Keep platform capabilities and edition-specific purchases. | Existing saved preferences, privacy/consent, one phone plus one desktop policy and billing handoffs remain consistent. |

For wide screens keep the active exam workspace focused and reserve long answers for a scrollable source/answer pane. On a narrow screen put source, answer and next action in natural reading order. Use a sticky action only when it stays clear of the keyboard, transcript controls and current question. Ensure source pane width, drag/keyboard resize, desktop shortcut scope, screen reader announcements, native Back, safe areas, and zoom stay usable. Test with 200% type scaling and narrow screens. Keep tap targets and focus visible. Use actual contrast of adjacent state backgrounds, glyphs and text.

### Implementation boundaries

- Reuse local objective scoring, stored attempt identity and existing mock-stage joins. Keep Exam Mode policies in the scheduler, session state and audio gateway, with matching UI. Result and sample modes gain evidence and coaching after the answers are locked. Access policies remain edition- and test-specific.
- Extend catalog contracts and client decoding through the backlog. Use the existing Web/Dart versions and shared parity fixtures to verify the formats. Use an additive snapshot in current attempt records and progressive support for old packs. View layers receive typed review state. Keep local reads/write transactions, cache failures and release errors within gateway/repository seams.
- Use actual playable catalog URLs and stable media keys. On Web reuse the existing byte-range or verified Blob flow. On Flutter build bounded cue playback through the `AudioPlayerGateway` and stop/dispose the owner across navigation and lifecycle changes. Size and duration check real media on staging. Active transcripts stay English and the Persian chrome remains RTL. [Media route](../backend/apps/api/src/routes/media.ts) · [Flutter audio gateway](../app/lib/services/audio_player_gateway.dart)
- Flutter’s same look includes native, tablet and any maintained Flutter Web artifact. Test real devices for audio focus/interruption, touch, text size, offline playback and route disposal. Preserve offline and database behavior in the launch profile. Avoid introducing browser-only logic into shared Dart models.
- Review the route inventory against `DESKTOP_WEB_PLAN.md` as part of delivery. Use the current route definitions as the implementation authority. Group shared visual work in components so review, practice, history, settings and placeholders update deliberately. [Web routes](../web/src/spa/router.tsx) · [Flutter routes](../app/lib/routing/routes.dart) · [Web objective session hook](../web/src/spa/useObjectiveSimulatorSession.ts) · [Flutter review provider](../app/lib/features/evaluation_review/presentation/evaluation_review_providers.dart)

**Exit** when both clients can complete genuine Reading and Listening Study and Exam attempts, show the same evidence and raw result from a matching fixture, enter a real targeted drill, and reopen the outcome offline. The other features pass their existing journeys using the shared appearance.

## 6. Phase 4. Enable grounded AI coaching

Implement RL-06 and RL-07 through the existing API, entitlement and client gateways. The app requests coaching for a specific saved question only when the learner asks. Display the authored evidence immediately. Link AI explanation notes to verified passages and audio ranges, distinguish authored and generated text in the UI, and make model failure recoverable. Gate launch on content-version matching, edition/locale cache isolation, typed client responses and a graded audit of the sample and real responses.

Stage with authentic responses from the intended provider configuration in a controlled staging account. Verify logs and metrics use safe identifiers and status counts. Test missing provider credentials, denied entitlement, rate limits, cache miss and timeout, stale content, cancellation and late results after navigation. Keep existing Writing/Speaking quotas and evaluation job behavior separate. After pilot usage, validate demand for RL-08 through RL-10 before expanding published banks. [Question API](../backend/apps/api/src/routes/evaluate.ts) · [AI provider graph](../backend/packages/ai/src/graphs/explain-question.ts) · [Existing evaluate adapter](../web/src/adapters/http/http-evaluation.adapter.ts)

## 7. Qualification and rollout

### Test matrix and release gates

| Gate | Proof to capture |
| --- | --- |
| Shared design | Token validation and deterministic generation. Enumerated preset compatibility. Same active theme before first paint, after restart and when following the public-app handoff. Component snapshots for default/error/empty/focus and light/dark/RTL. Verify all font glyphs and licenses. |
| Public app | Both built Astro editions under CSP and actual ingress, with guest sample use, timed source replay, both drill outcomes, fallback without audio, keyboard tabs, reduced motion, JS-off reading, asset isolation, canonical, sitemap/robots and built static cache headers. |
| Real Web flow | Browser runs from real staging API with a published Reading pack and a published Listening pack. Verify first miss, missing or stale pack, 0 ms cue, exact past result after version update, skill drill, authenticated AI/fallback, return after auth, back/refresh and offline from cached data. |
| Flutter flow | Targeted unit and provider tests plus existing objective and Listening E2E robots. Add unpacking old and new snapshots, exact evidence and cue, stale event handling, write failure/retry without duplicate progress, and route/media disposal cases. Add targeted golden/accessibility layouts for different widths, locale, text scale and modes. Manual Android/iOS and any maintained Flutter Web audio checks. |
| Content and AI | Seed/edition/publish validation with transcript and media-bound checks, OpenAPI export and parity, deterministic scoring parity, payment and entitlement regression, verified cache isolation, and comparison against reviewed model output. |
| Operational | Test current and prior clients with additive APIs. Confirm guest use and Pro access per edition, healthy static assets and Caddy fallbacks, cache safe refresh across revisions, and reversible routing to the prior artifact. Track actual load, play/replay success, submission and scoring errors, and latency/fallback for optional explain. |

Use the current repository checks. Start from the root for the workspace commands and from `app/` for Flutter. Use the pinned toolchains and install the locked dependencies in the target environment first.

```bash
pnpm tokens:sync
pnpm tokens:check
pnpm --filter @mockza/web^... build
pnpm --filter @mockza/web typecheck
pnpm --filter @mockza/web lint
pnpm --filter @mockza/web test
pnpm --filter @mockza/web build:glb
pnpm --filter @mockza/web build:irn
node scripts/check_web_budget.mjs
pnpm --filter @mockza/web test:e2e
pnpm backend:content:validate
bash scripts/check_cross_parity.sh
```

```bash
cd app
flutter gen-l10n
dart format --output=none --set-exit-if-changed lib test
flutter analyze --no-pub --fatal-infos
flutter test --no-pub --concurrency=1
```

Run backend package tests and the OpenAPI parity gate when contracts, DB, content or explanation paths change. The Web Playwright configuration currently uses both prebuilt dist folders and an API harness. Use it for deterministic coverage. Separately verify the real API on staging, including at least one complete journey per edition. Extend CI to build `web/Containerfile` in both release editions and check the actual Caddy artifact, in addition to the existing Flutter build. Update the local production runbook after the cutover. [Root commands](../package.json) · [Web Playwright config](../web/playwright.config.ts) · [Cross-platform parity](../scripts/check_cross_parity.sh) · [Combined gates](../scripts/check_all.sh) · [CI](../.github/workflows/ci.yml) · [Flutter test harness](../app/test/e2e/README.md)

### Deployment and rollback order

1. **Compatibility first.** Publish additive contracts, parsed review evidence and verified pilot content to staging. Document how old clients and cached packs read them. After content/contract tests pass, deploy the required backend and media first. Keep the last stable artifacts and known content revision available.
2. **Build each Web image separately.** Use the existing Astro/Caddy `web/Containerfile` with `PUBLIC_EDITION=glb` or `irn` and the verified `PUBLIC_API_BASE_URL`. Match API edition and host configuration. Compose supplies `MOCKZA_EDITION` and the Web/API settings. Use distinct artifact tags and deployment targets so one build cannot replace the other. Use the staged operator’s credentials and settings for TLS, account provider and billing verification.
3. **Verify the live route layer.** Confirm `/`, `/app/`, a real nested review route on reload, `/v1/health` through the live ingress, `/healthz` on the web service where applicable, theme bootstrap and a local audio range request. Keep hashed `/_astro/` assets immutable and revalidate HTML. The existing `/theme-boot.js` rule caches up to one hour. Revalidate or version that resource in the same release so clients cannot pair a new palette with an old preset catalog. Publish the asset graph atomically and verify cache/CDN behavior for both editions.
4. **Release the Web design and Flutter design in the same milestone.** Prove parity from staging builds first. Run staged mobile distribution with the existing signing/edition process for device QA, then publish through the relevant release channels. Browser rollout must coexist safely with installed previous native builds. Publish catalogue items with new drill formats only after the reply capability is implemented.
5. **Cut traffic by edition.** Open the anonymous landing, sandbox or QA account flows, and real media on each intended domain. Track landing report opens, attempts completed, evidence actions, drill starts/completions and errors using the existing telemetry seams. Collect only the minimum event metadata for aggregate review. Verify through both direct navigation and a previously warmed cache.
6. **Rollback.** Repoint the affected edition to the last known Web artifact and revalidate HTML/theme bootstrap. Keep additive backend/cache data readable by the previous artifact. Keep providing the previous asset revision during the switch. Withdraw new-format content from publication if it fails. Return the authored fallback in the enhanced objective explanation path or revert to the compatible prior API build. Mobile rollback uses the compatible prior build where available and a forward app fix for installed builds. Keep the local saved work readable. Restore operations remain an explicit operational procedure.

[Web image](../web/Containerfile) · [Caddy routing and caching](../web/Caddyfile) · [Compose entry](../compose.yaml) · [Flutter release workflow](../.github/workflows/release.yml)

## 8. Delivery checklist in dependency order

| Delivery | Scope | Prerequisite | Completion proof |
| --- | --- | --- | --- |
| 1 | Baseline and approved sample content for both editions | Current code and deploy topology | Repeatable artifacts and screenshots plus published pilot IDs |
| 2 | Shared palette, fonts, type, shape and component reference | Previous preference behavior captured | Token gate and Web/Flutter parity from the same review fixture |
| 3 | Functional static homepage with four sample skill experiences | Sample fixtures and shared theme | Both public builds, CSP and budget gates, no-JS fallback and live route smoke |
| 4 | Evidence-aware data and old-attempt compatibility | RL-01/02 and reviewed pack examples | Shared vectors and new/old client and pack runs |
| 5 | Practice-first Home, real objective review and two drills on both clients | Shared theme and compatible data | Both editions can complete and reopen both journeys, with offline cached proof |
| 6 | Remaining app surfaces and release tests | Pilot component approach validated | Complete route-family parity and all surface regressions |
| 7 | Verified optional AI explanations | RL-06/07 and published content | Human evaluation and entitlement/cache failure matrix |
| 8 | Staged production and native release | Relevant gates above | Edition-specific actual-host smoke, rollback rehearsal and mobile device verification |

The first production slice includes the homepage and the two real evidence-to-drill journeys. Ship optional AI coaching and longer-term practice analytics after their content, confidence and rollout gates pass. The acceptance evidence is a working flow from public preview through committed results on both the Web and Flutter.

## 9. Local implementation status

- The landing uses production Astro routes and self-hosted media. Both editions can show all four authored examples and run the Reading evidence and Listening audio drills on the homepage.
- The React app and Flutter share Editorial Green as the fresh-install appearance. Existing valid preferences keep their preset and mode. Web groups its primary routes in a horizontal desktop header. Flutter retains native tab navigation. Auth, catalog, scoring, and billing still use their existing services.
- The study room leads with the next action and keeps progress below it. Web can lead with a saved Reading, Writing, or Study Mode Listening draft. Flutter can lead with the existing local Speaking session recovery and otherwise offers a level check or practice recommendation.
- Objective review places the first missed answer earlier and shows authored coaching. Web keeps question details in the attempt snapshot, even if the pack changes. Both clients use matching source versions for new attempts and can jump to or replay available timed audio after submission.
- In-app follow-up links use the published starter drill IDs. Dedicated in-app evidence-choice and audio-choice formats, grounded Reading/Listening AI with verified source references, and the associated quality audit remain in the backlog. Real staging, Caddy ingress, and mobile release validation are separate rollout steps. [Reading and Listening backlog](READING_LISTENING_IMPLEMENTATION_BACKLOG.md)

### Ported sample assets

The notebook artwork came from ImageGen during prototype work. The recordings are synthetic reads of original sample transcripts. The landing uses the same reviewed sample text and media as those prototype demos. Inter, Vazirmatn, and Instrument Serif are bundled with their OFL notices. [Prototype asset notes](../web-prototype/README.md) · [Flutter font licenses](../app/assets/fonts/) · [Web Instrument Serif license](../web/src/styles/fonts/instrument-serif-license.txt)

| Public asset | SHA-256 |
| --- | --- |
| `listening-drill.mp3` | `4687146a202d0508b7f3f939f110498a3567e8db2901dec83acb09e9295aaa26` |
| `listening-review.mp3` | `1e9bf6acac2721ca53a0c509d059efb69c10bc55a4f964cfffd6361dd8751df0` |
| `speaking-feedback.mp3` | `b65f010414bf674766fc3dc68e94509177f5e199a1e77d728c014716bfe4cd61` |
| `study-notebook.webp` | `d8c8720345194773944326dc2edb5904da16cf44e50b920edc50c73d18797e67` |

### Local verification

- Both Astro editions built successfully. The Web budget gate passed, with approximately 4.8 KiB of compressed homepage JavaScript including the versioned theme bootstrap. The public exam guides kept their zero-JavaScript budget.
- Web lint and type checking passed. All 220 Web unit tests and nine Playwright journeys passed. The live API test was skipped. The browser journeys used the local API harness and included offline pack use and the Persian landing with JavaScript disabled.
- Flutter analysis passed. The seven Flutter E2E journeys and targeted theme and persistence tests passed using one test worker. Physical-device playback and store artifacts still need release validation.
- Checks ran sequentially with existing dependencies. There was 13 GiB of free disk before and after the work.
