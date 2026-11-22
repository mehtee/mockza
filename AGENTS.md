# Mockza / Sanjia Agent Rules (`AGENTS.md`)

## 1. Strict Low-RAM Execution Policy (CRITICAL — NEVER VIOLATE)

This host has ~7.7 GiB total RAM and 1 GiB swap shared with live Docker stacks. Peaking RAM causes host OOM/swap thrashing and server restarts.

1. **Always check RAM first (`free -m`)** before running ANY build, test suite, analyzer, or container restart.
   - If `available` RAM is `< 900 MiB`, DO NOT start builds or test suites — stop, inspect what is holding memory, and report to the user.
2. **Never run heavy builds or tests in parallel:**
   - NEVER run `flutter test`, `flutter analyze`, `astro build`, `tsc`, or `vitest` concurrently. Run strictly one command at a time.
3. **Cap Node.js heaps & Vitest workers explicitly:**
   - Vitest / unit tests: `NODE_OPTIONS="--max-old-space-size=640"` (and single-threaded flags when running full suites: `--poolOptions.threads.maxThreads=1 --fileParallelism=false`).
   - `@mockza/web` (`astro build`) & `@mockza/worker`: `NODE_OPTIONS="--max-old-space-size=768"`.
   - `@mockza/api` (`tsc -p tsconfig.build.json`): `NODE_OPTIONS="--max-old-space-size=1152"`.
4. **Cap Dart/Flutter VM heap & batch full `flutter test` runs:**
   - ALWAYS set `DART_VM_OPTIONS="--old_gen_heap_size=768"` and `--concurrency=1`.
   - **NEVER run `flutter test --concurrency=1` across all 50+ test files in a single invocation** — `flutter_tester` accumulates isolate/Skia memory across files and spikes host RAM. Always split `flutter test` into small batches (max 8–10 test files per invocation) and check `free -m` between batches!
5. **Respect Docker stack memory:**
   - Do not leave extra background watchers/daemons running during builds or tests.

## 2. Architecture, Edition Parity & Guardrails

- **GLB ↔ IRN & Web ↔ Flutter Parity:** All features (Adaptive Personalization, Durnama + Step-by-Step Roadmap, Kokoro TTS, Pronunciation Studio, Cross-Device Sync, Admin Tracing & Cost Ledger) must maintain 100% behavioral parity across Web GLB, Web IRN, Flutter GLB, and Flutter IRN.
- **API-Only TTS:** Never use OS/browser local TTS (`flutter_tts`, `window.speechSynthesis`). Use OpenRouter `hexgrad/kokoro-82m` via `/v1/tts/synthesize` and `/v1/tts/audio/:cacheKey`.
- **Exam Mode Restraint:** Never show Kokoro Listen or Pronunciation Shadow controls when `isExamMode === true`.
- **Bidirectional / RTL Safety:** Use `EdgeInsetsDirectional`, `AlignmentDirectional`, `TextAlign.start`/`end`, and Tailwind logical properties (`ps-`, `pe-`, `ms-`, `me-`).
- **Verify against `scripts/check_all.sh all` and `scripts/check_cross_parity.sh`** after final edits (respecting Section 1 RAM caps).
