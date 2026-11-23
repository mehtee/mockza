# Mockza & Sanjia Extensible End-to-End (E2E) Test Architecture

This suite drives the **entire `MockzaApp`** (`GoRouter`, Riverpod providers, SQLite/Drift v10 database, and all 19 feature modules across both `GLB` Mockza and `IRN` Sanjia editions) end-to-end without OS channels or live network dependencies.

## Structure
- `harness/e2e_app_harness.dart` — Hermetic container builder with:
  - In-memory SQLite (`createTestDatabase`, `schemaVersion == 10`, 20 tables) + deterministic clock & entropy
  - Real file-backed `E2eAudioRecorderGateway` for Speaking & Pronunciation Studio uploads
  - Offline `Dio` adapter (`_OfflineE2eHttpAdapter`) handling `/v1/auth/*`, `/v1/billing/*`, `/v1/personalization/*`, `/v1/tts/*`, `/v1/pronunciation/*`, `/v1/graph/*`, `/v1/missions/*`, `/v1/register-shifter/*`, `/v1/drop/*`, and `/v1/account` erasure
  - `seedStarterCatalog` for Reading, Listening, Writing, Speaking, Micro-Drills, and Vocabulary SRS across all 5 exam tracks (`IELTS Academic/General, TOEFL iBT 2026, PTE Academic, Duolingo English Test`)
  - Responsive viewport helpers (`320×640`, `360×640`, `390×844`) + zero-overflow assertions
- `robots/*.dart` — Feature-owned Page-Object Robots separating UI selectors from test assertions.
- `9` End-to-End Journey Suites (`*_e2e_test.dart`):
  1. `onboarding_and_diagnostic_e2e_test.dart` — Onboarding -> Rapid ~10–15 min 4-skill Diagnostic -> Results & Single-Skill Retake.
  2. `objective_practice_and_vocab_srs_e2e_test.dart` — Practice Setup -> Reading Simulator -> Evaluation Review -> Mistake Capture -> Vocabulary SRS.
  3. `listening_and_micro_drills_e2e_test.dart` — Listening Simulator (Study transcript & Focused Q nav) -> Micro-Drills workout.
  4. `productive_sims_and_full_mock_e2e_test.dart` — Writing Sim (AI Rubric) -> Speaking Sim (Record & AI Rubric) -> Full Mock 5-Stage Planner.
  5. `progress_settings_themes_and_responsive_e2e_test.dart` — Compact `360×640` sweep, Progress Analytics, 4 OCP Theme Presets & Account Wipe.
  6. `auth_devices_and_subscription_policy_e2e_test.dart` — Email, Google & Apple Auth, Strict 1-Phone + 1-Desktop-Web Slot Conflict, Settings Device Termination & Paywall Consent.
  7. `multi_exam_tracks_e2e_test.dart` — Cross-Exam Track Switching & Journeys across TOEFL iBT (2026), PTE Academic, and DET + `320×640` overflow checks.
  8. `advanced_closed_loop_e2e_test.dart` — Smart Coach Hub (`/coach`), 10-Min Daily Mission, Error DNA Linguistic Graph, 3-Gear Register Shifter, and Drop Anything Micro-Drills.
  9. `sanjia_irn_e2e_test.dart` — Sanjia (`IRN`) Persian RTL UI, `LtrExamBoundary` English stimulus isolation, Jalali date picker, SMS OTP Auth, Zarinpal integer-Rial checkout, and `Navia` score handoff.

## Running Low-RAM E2E Suites
Always check `free -m` first (`>= 900 MiB` available per [AGENTS.md](file:///home/mahdi/projects/ideas/mockza/AGENTS.md)):
```bash
cd app && DART_VM_OPTIONS="--old_gen_heap_size=768" flutter test --no-pub --concurrency=1 test/e2e/*_test.dart
```
