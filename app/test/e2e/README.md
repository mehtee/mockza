# Mockza Extensible End-to-End (E2E) Test Architecture

This suite drives the **entire `MockzaApp`** (`GoRouter`, Riverpod providers, SQLite/Drift database, and all feature screens) end-to-end without OS channels or live network dependencies.

## Structure
- `harness/e2e_app_harness.dart` — Hermetic container builder with:
  - In-memory SQLite (`createTestDatabase`) + deterministic clock & entropy
  - Real file-backed `E2eAudioRecorderGateway` for Speaking uploads
  - Offline `Dio` adapter (`_OfflineE2eHttpAdapter`) handling `/v1/auth/*` and `/v1/account` erasure
  - `seedStarterCatalog` for Reading, Listening, Writing, Speaking, Micro-Drills, and Vocabulary SRS
  - Responsive viewport helpers (`360×640`, `390×844`) + overflow assertions
- `robots/*.dart` — Feature-owned Page-Object Robots separating UI selectors from test assertions.
- `*_e2e_test.dart` — End-to-end user journeys covering every screen, timer, and theme preset.

## How to Add E2E Tests for a Future Feature
1. Seed any new exam packs or local tables in `E2eAppHarness.seedStarterCatalog` (or add an extension helper method on `E2eAppHarness`).
2. Add a small focused Robot in `app/test/e2e/robots/<feature>_robot.dart` containing only high-level user actions and assertions (with `///` doc comments).
3. Add or extend a journey test in `app/test/e2e/<feature>_e2e_test.dart`, verifying both standard (`390×844`) and compact phone (`360×640`) viewports with `harness.expectNoOverflow(tester)`, then call `await harness.dispose(tester);` at the end.

## Running Low-RAM E2E Suites
From the repo root:
```bash
bash scripts/run_e2e.sh
```
Or Flutter E2E only:
```bash
cd app && flutter test --no-pub --concurrency=1 test/e2e
```
