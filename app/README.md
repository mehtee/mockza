# Mockza & Sanjia Flutter Client (`app/`)

Single-package **Feature-First Layered MVVM** client built on **Flutter `3.47.9`** (Dart 3 + Impeller), **Riverpod 3.x**, **`go_router`**, and **`drift` SQLite** (`schemaVersion == 10`, 20 tables), serving Mobile (iOS / Android) and Web SPA targets across two isolated compile-time flavors (`main_global.dart` for `glb` / Mockza `1.0.0+10001.glb` and `main_iran.dart` for `irn` / Sanjia `1.0.0+20001.irn`).

---

## Architecture & Strict Layering Rules (`ADR-002`)

Enforced by `analysis_options.yaml` (`very_good_analysis`) and [check_all.sh](file:///home/mahdi/projects/ideas/mockza/scripts/check_all.sh):

```text
app/lib/
├── main_global.dart · main_iran.dart   # Flavor-isolated composition roots (GLB vs IRN Sanjia)
├── bootstrap.dart                      # Ordered launch hook, CrashLog, Drift WAL/FK open, pre-paint theme load
├── providers.dart                      # Root DI providers (including PreferredTtsAccentNotifier) overridden in bootstrap() & tests
├── app.dart                            # MaterialApp.router, dynamic ThemeCatalog preset, EN/FA locale & lifecycle flush
├── core/                               # PURE DART ONLY (zero flutter, dart:io, drift, or DateTime.now())
│   ├── auth/                           # AuthSession, DeviceSlotKind, ActiveDeviceSession, DevicePolicyState
│   ├── config/                         # Sealed EditionConfig (glb vs irn)
│   ├── diagnostic/                     # DiagnosticBudget (900s/90s), DiagnosticModels, DiagnosticRouter
│   ├── exams/                          # ExamTrack (5 tracks), ExamDescriptor, LocalObjectiveScorer, StudyMetricsCalculator, ToeflIntegratedFlow, DetMicroScorer
│   ├── formatting/                     # Pure Jalali (Shamsi) edge calendar formatter
│   ├── linguistic_core/                # Closed-Loop Error DNA Graph, FaultCode taxonomy, ActiveProductionVerifier, DropInputPolicy, MissionModels
│   ├── models/                         # Immutable AttemptStatus, Writing/SpeakingEvaluationResult, UserProfile
│   ├── personalization/                # LiveBandEngine, RoadmapGenerator, TopicTaxonomy, TopicWeaknessRotator, ObjectiveWeaknessExtractor, VocabWaveScheduler
│   ├── preferences/                    # AppearanceSettings
│   ├── result/                         # Sealed Result<T, Failure> + typed Failure hierarchy
│   └── vocab/                          # SerialDay calendar math & pure SM-2 scheduler
├── data/                               # ONLY directory allowed to import package:drift / sqlite3
│   ├── db/                             # AppDatabase (schemaVersion 10, 20 tables), connection pragmas & migrations v1->v10
│   ├── daos/                           # Single-table Drift accessors (Attempts, Packs, Profile, Vocab)
│   └── repositories/                   # Transactional write paths (Attempt, Catalog, Diagnostic, Linguistic, Personalization, Profile, StudyLog, Vocab)
├── services/                           # Segregated gateways + live Dio / just_audio / record / RevenueCat / Zarinpal / Bazaar / Myket / SMS OTP / Personalization / SpeechPractice / OutboxSync bridges
├── routing/                            # Single GoRouter (31 AppRoutes constants, 5-tab StatefulShellRoute, RoadmapRouteResolver, PopScope guards)
├── theme/                              # Generated SSOT tokens (`generated_tokens.dart`) & Open-Closed theme/component primitives
│   ├── theme_preset.dart · theme_catalog.dart   # 4 switchable Light/Dark presets synced with packages/design-tokens
│   ├── ltr_exam_boundary.dart                   # Mandatory LTR isolation wrapper for English exam stimuli inside RTL Persian chrome
│   ├── responsive_layout.dart · primitives.dart # Responsive spacing/gutters verified down to 320dp
│   └── components/                              # Polymorphic shared exam, personalization & speech controls:
│       ├── exam_question_controls.dart          # MzObjectiveAnswerInput (11 types) & MzSequenceOrderControl
│       ├── chart_stage_card.dart                # ExamSvgChartCard (Task 1, PTE Describe Image, DET Photo)
│       ├── inline_listen_button.dart            # OpenRouter Kokoro-82m neural TTS button (UK bf_emma / US af_bella)
│       ├── speech_practice_sheet.dart           # Interactive TTS + Gemini 3.1 Flash Lite Pronunciation Studio bottom sheet
│       ├── plan_impact_card.dart                # Post-attempt roadmap & live band delta card
│       ├── register_gear_ladder_card.dart       # 3-Gear Register Shifter visual ladder
│       ├── trend_chart.dart                     # Score trajectory chart (solid calibrated vs hollow practice points)
│       └── vocab_flip_card.dart · mic_preflight_card.dart · score_meter.dart · compare_attempts.dart · device_session_card.dart
├── l10n/                               # Bilingual ARB localization (`app_en.arb` + `app_fa.arb`) & EdgeInsetsDirectional BiDi support
└── features/                           # 19 isolated vertical feature modules (zero cross-feature imports)
    ├── onboarding/         auth/               diagnostic/         home/               roadmap/
    ├── practice_hub/       reading_sim/        listening_sim/      writing_sim/        speaking_sim/
    ├── micro_drills/       evaluation_review/  vocabulary/         progress/           settings/
    ├── paywall/            linguistic_mission/ register_shifter/   drop_anything/
```

---

## Key Capabilities & Parity Highlights

- **5-Track Exam Polymorphism:** `ExamTrack` ([exam_spec.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/exams/exam_spec.dart)) and `ExamDescriptor` ([exam_descriptor.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/exams/exam_descriptor.dart)) power **IELTS Academic**, **IELTS General**, **TOEFL iBT (2026)**, **PTE Academic**, and **Duolingo English Test (DET)**.
- **Adaptive Personalization & Step-by-Step Roadmap (`/roadmap`):** `LiveBandEngine` ([live_band_engine.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/personalization/live_band_engine.dart)) and `RoadmapGenerator` ([roadmap_generator.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/personalization/roadmap_generator.dart)) compute live overall/skill band estimates, rotate weak topics (`TopicWeaknessRotator`), schedule progressive vocabulary waves (`VocabWaveScheduler`), and sync bidirectionally via `PersonalizationGateway` ([personalization_gateway.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/personalization_gateway.dart)).
- **OpenRouter Kokoro-82m TTS & Pronunciation Studio:** `SpeechPracticeGateway` ([speech_practice_gateway.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/services/speech_practice_gateway.dart)), `InlineListenButton` ([inline_listen_button.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/inline_listen_button.dart)), and `SpeechPracticeSheet` ([speech_practice_sheet.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/speech_practice_sheet.dart)) provide UK/US neural TTS playback and multimodal pronunciation scoring across Vocabulary, Study-Mode Reading passages, and Evaluation Review.
- **Closed-Loop Smart Coach (`/coach`):** Combines `CoachHubScreen`, `DailyMissionScreen`, `LinguisticGraphScreen`, `RegisterShifterScreen`, and `DropDrillScreen` for targeted fault remediation and active production verification.
- **100% Cross-Codebase Parity:** Verified against `@mockza/domain` and `@mockza/web` via [cross_codebase_parity_test.dart](file:///home/mahdi/projects/ideas/mockza/app/test/parity/cross_codebase_parity_test.dart) (`372/372` shared fixture vectors).

---

## Common Commands (Strict Low-RAM Policy — See [AGENTS.md](file:///home/mahdi/projects/ideas/mockza/AGENTS.md))

### 1. Check Available RAM First

```bash
free -m   # Require >= 900 MiB available before running analyzer, tests, or builds
```

### 2. Format, Static Analysis & Architecture Gates

```bash
cd app
dart format --output=none --set-exit-if-changed lib test
DART_VM_OPTIONS="--old_gen_heap_size=768" flutter analyze --no-pub --fatal-infos
cd .. && ./scripts/check_all.sh --app-only
```

### 3. Running Tests in Low-RAM Batches (`<= 10` Files per Invocation)

> **Never** pass the entire `test/` directory (39 files / 409 tests) to a single `flutter test` invocation on an `<= 8 GiB` host. Run in sequential batches of `<= 10` files with `DART_VM_OPTIONS="--old_gen_heap_size=768"`:

```bash
cd app

# Batch 1: Core & Data (10 files)
DART_VM_OPTIONS="--old_gen_heap_size=768" flutter test --no-pub --concurrency=1 \
  test/core/diagnostic_router_test.dart test/core/local_objective_scorer_test.dart \
  test/core/multi_exam_descriptor_and_scorer_test.dart test/core/result_test.dart \
  test/core/sm2_scheduler_test.dart test/core/study_metrics_calculator_test.dart \
  test/data/attempt_cursor_pagination_test.dart test/data/database_foreign_keys_test.dart \
  test/data/database_migration_upgrade_test.dart test/data/database_migration_v6_v7_test.dart

# Batch 2: Data, Features & Smoke (10 files)
DART_VM_OPTIONS="--old_gen_heap_size=768" flutter test --no-pub --concurrency=1 \
  test/data/outbox_queue_test.dart test/data/vocab_repository_test.dart \
  test/data/writing_drafts_and_annotations_test.dart test/app_smoke_test.dart \
  test/features/adaptive_roadmap_speech_test.dart test/features/diagnostic_flow_test.dart \
  test/features/phase2_durability_test.dart test/features/phase3_review_test.dart \
  test/features/phase4_content_scoring_test.dart test/features/phase6_ux_a11y_test.dart

# Batch 3: Features, IRN, Services, Theme, Policy, Parity & A11y (10 files)
DART_VM_OPTIONS="--old_gen_heap_size=768" flutter test --no-pub --concurrency=1 \
  test/features/provider_container_gateway_test.dart test/iran/edge_numerals_test.dart \
  test/iran/jalali_edge_formatter_test.dart test/iran/sanjia_auth_paywall_bidi_test.dart \
  test/services/contract_payload_parity_test.dart test/services/erasure_recovery_test.dart \
  test/theme/shared_exam_components_test.dart test/policy/architecture_policy_test.dart \
  test/a11y/accessibility_and_layout_test.dart test/parity/cross_codebase_parity_test.dart

# Batch 4: Full-Router E2E Journeys (9 files)
DART_VM_OPTIONS="--old_gen_heap_size=768" flutter test --no-pub --concurrency=1 test/e2e/*_test.dart
```

### 4. Low-RAM Release Flutter Web Build

```bash
cd app
DART_VM_OPTIONS="--old_gen_heap_size=768" flutter build web --release -O1 --no-pub --no-source-maps --no-tree-shake-icons --no-wasm-dry-run
cd ..
./scripts/stamp_web_cache_bust.sh
```
