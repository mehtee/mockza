# Mockza Flutter Client (`app/`)

Single-package **Feature-First Layered MVVM** client built on **Flutter `3.47.9`** (Dart 3 + Impeller), **Riverpod 3.x**, **`go_router`**, and **`drift` SQLite** (`schemaVersion == 5`), serving Mobile (iOS / Android) and Web SPA targets across two isolated compile-time flavors (`main_global.dart` for `glb` / Mockza and `main_iran.dart` for `irn` / Sanjia).

---

## Architecture & Strict Layering Rules (`ADR-002`)

Enforced by `analysis_options.yaml` (`very_good_analysis`) and [check_all.sh](file:///home/mahdi/projects/ideas/mockza/scripts/check_all.sh):

```text
app/lib/
├── main_global.dart · main_iran.dart   # Flavor-isolated composition roots
├── bootstrap.dart                      # Ordered launch hook, CrashLog, Drift WAL/FK open, pre-paint theme load
├── providers.dart                      # Throwing root DI providers overridden in bootstrap() & tests
├── app.dart                            # MaterialApp.router, dynamic ThemeCatalog preset, lifecycle flush
├── core/                               # PURE DART ONLY (zero flutter, dart:io, drift, or DateTime.now())
│   ├── auth/                           # AuthSession, DeviceSlotKind, ActiveDeviceSession, DevicePolicyState
│   ├── config/                         # Sealed EditionConfig (glb vs irn)
│   ├── diagnostic/                     # DiagnosticBudget (900s/90s), DiagnosticModels, DiagnosticRouter
│   ├── exams/                          # ExamTrack (5 tracks), ExamDescriptor, LocalObjectiveScorer, StudyMetricsCalculator
│   ├── models/                         # Immutable AttemptStatus, WritingEvaluationResult, SpeakingEvaluationResult, UserProfile
│   ├── preferences/                    # AppearanceSettings
│   ├── result/                         # Sealed Result<T, Failure> + typed Failure hierarchy
│   └── vocab/                          # SerialDay calendar math & pure SM-2 scheduler
├── data/                               # ONLY directory allowed to import package:drift / sqlite3
│   ├── db/                             # AppDatabase (schemaVersion 5, 14 tables), connection pragmas
│   ├── daos/                           # Single-table Drift accessors
│   └── repositories/                   # Single transactional write path + keyset cursor pagination
├── services/                           # Abstract gateways + live Dio / just_audio / record / RevenueCat / native bridges
├── routing/                            # Single GoRouter (24 AppRoutes constants), StatefulShellRoute, PopScope guards
├── theme/                              # Raw visual tokens & Open-Closed theme/component primitives
│   ├── theme_preset.dart · theme_catalog.dart   # 4 switchable Light/Dark presets
│   ├── responsive_layout.dart · primitives.dart # Responsive spacing/gutters verified down to 320dp
│   └── components/                     # Polymorphic shared exam controls (MzObjectiveAnswerInput, MzSequenceOrderControl, ExamSvgChartCard, MicPreflightCard, ScoreMeter, TrendChart, DeviceSessionCard, SocialAuthButtons)
├── l10n/                               # ARB localization (`app_en.arb`) + EdgeInsetsDirectional RTL support
└── features/                           # 15 isolated vertical feature modules (zero cross-feature imports)
    ├── onboarding/         auth/               diagnostic/         home/
    ├── practice_hub/       reading_sim/        listening_sim/      writing_sim/
    ├── speaking_sim/       micro_drills/       evaluation_review/  vocabulary/
    ├── progress/           settings/           paywall/
```

---

## Multi-Exam & SOLID UI Highlights

- **Exam Track Polymorphism:** Adding or extending an exam track runs through `ExamTrack` ([exam_spec.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/exams/exam_spec.dart)) and `ExamDescriptor` ([exam_descriptor.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/core/exams/exam_descriptor.dart)) covering **IELTS Academic**, **IELTS General**, **TOEFL iBT (2026)**, **PTE Academic**, and **Duolingo English Test (DET)**.
- **Shared Objective & Media Widgets:** `MzObjectiveAnswerInput` & `MzSequenceOrderControl` ([exam_question_controls.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/exam_question_controls.dart)) unify `tfng`, `ynng`, `mcqSingle`, `mcqMulti`, `matchingHeadings`, `summaryGapFill`, `shortAnswer`, `wordCompletion`, `binaryChoice`, `reorderSequence`, and `dictation`; `ExamSvgChartCard` ([chart_stage_card.dart](file:///home/mahdi/projects/ideas/mockza/app/lib/theme/components/chart_stage_card.dart)) unifies Writing Task 1, DET photo writing, and PTE Describe Image SVG views.
- **Open-Closed Theme System:** 4 presets (`Midnight Indigo`, `Nordic Emerald`, `Editorial Amber`, `Oceanic Cobalt`) switch dynamically across Light and Dark brightness via `AppearanceSettings`.

---

## Common Commands

### Format, Static Analysis & Architecture Gates

```bash
cd app
dart format --output=none --set-exit-if-changed lib test
flutter analyze --no-pub --fatal-infos
cd .. && ./scripts/check_all.sh all
```

### Running Tests (Low-RAM Mode)

```bash
# Run full suite sequentially or with low concurrency on <= 8 GiB hosts
cd app
flutter test --no-pub --concurrency=1

# Run full-router Page-Object E2E tests (`E2E 1`–`E2E 7`)
flutter test --no-pub --concurrency=1 test/e2e
```

See [app/test/e2e/README.md](file:///home/mahdi/projects/ideas/mockza/app/test/e2e/README.md) for how to extend the Page-Object Robot E2E suite when adding new features.

### Low-RAM Release Web Build

> Always pass `--no-wasm-dry-run` on Flutter `3.47.x` in memory-constrained environments so `dart2wasm --dry-run` (`~1.04 GB` RSS) does not spawn concurrently alongside `dart compile js`.

```bash
cd app
flutter build web --release -O1 --no-pub --no-source-maps --no-tree-shake-icons --no-wasm-dry-run
cd ..
./scripts/stamp_web_cache_bust.sh
node ./scripts/serve_web_static.mjs
```
