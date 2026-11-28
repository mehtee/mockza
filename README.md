# Mockza & Sanjia

Offline-first, AI-native **5-Track High-Stakes English Exam Simulator Hub**, **Adaptive Personalization & Step-by-Step Roadmap (*Durnama* / دورنما)**, **Closed-Loop Smart Coach Engine**, **OpenRouter `hexgrad/kokoro-82m` Neural TTS & `google/gemini-3.1-flash-lite` Pronunciation Studio**, **SM-2 Contextual Vocabulary Coach**, and **End-to-End User/Recording/Token/Cost Observability Platform** — engineered with a **Dual-Edition (`GLB` Mockza & `IRN` Sanjia)**, **Dual-Client (`Astro 5 + React 19` Desktop Web + `Flutter 3.47.9` Mobile/Web)**, and **Container-First Low-RAM Architecture** (`Docker Compose` & `Podman Compose` ready).

> **Live Release (`v4.0` — Verified `2026-11-28`):**
> - **Global Clean-Room Edition (`GLB` — `Mockza`, `1.0.0+10001.glb`):** English-first clean-room hub (Astro Web `:45280` / API `127.0.0.1:45281`, Flutter Web `mockza.mehtea.ir`) with RevenueCat & Web Checkout USD billing, Email + Google + Apple OAuth.
> - **Iran Domestic Edition (`IRN` — `Sanjia` / `سنجیا`, `1.0.0+20001.irn`):** Persian-first RTL BiDi hub (Astro Web `:45282` / API `:45283`, Flutter Web `sanjia.mehtea.ir`) with `LtrExamBoundary` stimulus isolation, Jalali (`شمسی`) calendar, SMS OTP auth, Zarinpal/Cafe Bazaar/Myket integer-Rial billing, Persian examiner rubrics (`irn_*_fa_v1.0`), and `Navia` (`ناویا`) admissions handoff.

---

## Core Capabilities

- **5 Exam Tracks & Isolated Scale Calibration (`@mockza/domain` + `app/lib/core/exams/`):**
  - **IELTS Academic & General Training (`0.0–9.0` Band, `0.5` steps):** 40-question raw-to-band calibration for Reading/Listening, Academic Task 1 SVG charts + General Task 1 letters + Task 2 essays, Parts 1–3 Speaking.
  - **TOEFL iBT (2026 Format, `1.0–6.0` Band, `0.5` steps + `0–120` Concordance):** Reading (*Complete the Words*, *Read in Daily Life*, *Academic Passage*), Listening (*Choose a Response*, campus/academic talks), 3-task Writing (*Build a Sentence*, *Write an Email*, *Academic Discussion*), and *Listen & Repeat* / zero-prep *Take an Interview* Speaking.
  - **PTE Academic (Latest, `10–90` Integer Score):** *Re-order Paragraphs* drag-free sequential selector (`MzSequenceOrderControl`), *Write from Dictation* (`dictation`), single-sentence *Summarize Written Text* (`5–75w`) & *Write Essay* (`200–300w`), and *Describe Image* Speaking with zoomable SVG charts (`ExamSvgChartCard`).
  - **Duolingo English Test / DET (Latest, `10–160` Score in `5`-pt steps + 4 Subscores):** Displays **Literacy**, **Comprehension**, **Conversation**, and **Production** alongside *Read & Select* (`binary_choice`), *Read & Complete* (`word_completion`), *Listen & Type* (`dictation`), *Write About the Photo* (SVG scene) / *Interactive Writing* / *Writing Sample*, and zero-prep *Interactive Speaking*.
- **Adaptive Personalization, Live Band Engine & Step-by-Step Roadmap (*Durnama* / دورنما):**
  - **Dynamic Live Band Evolution (`LiveBandEngine`):** Computes real-time overall and per-skill (`Reading`, `Listening`, `Writing`, `Speaking`) current vs. target scores from diagnostic baselines and exponentially decayed recent attempts, distinguishing calibrated full exams (solid nodes) from practice estimates (hollow dashed nodes) on `TrendChart`.
  - **Personalized Step-by-Step Roadmap (`RoadmapGenerator`) & Zero-Diagnostic Foundation Mode:** Builds an interactive multi-phase learning path (*Foundation*, *Core Practice*, *Weakness Remediation*, *Vocabulary Wave*, *Pronunciation Clinic*, *Register/Drop Drill*, *Milestone Check*, *Full Mock*) that dynamically re-prioritizes after every attempt and displays a post-attempt `PlanImpactCard`. When a learner defers or skips the onboarding placement check (`currentBand == null`), unlocks a **Provisional M1 Foundation Starter Plan** (entry `B1` tier without fabricating a baseline score) so Home, Roadmap, Vocab Wave 1, and Smart Coach remain immediately usable.
  - **Topic Weakness Rotation & Vocabulary Waves (`TopicWeaknessRotator`, `ObjectiveWeaknessExtractor`, `VocabWaveScheduler`):** Tracks performance across 10 academic topic domains (`environment`, `technology`, `healthcare`, `education`, `economy`, etc.), rotates weak topics without repetition fatigue, and unlocks progressive band-tier vocabulary waves.
- **OpenRouter `hexgrad/kokoro-82m` Neural TTS & `google/gemini-3.1-flash-lite` Pronunciation Studio:**
  - **100% API-Driven Neural TTS (`POST /v1/tts/synthesize` + `GET /v1/tts/audio/:cacheKey`):** Zero reliance on robotic browser `speechSynthesis` or OS TTS. Synthesizes natural British (`uk` -> `bf_emma`) and American (`us` -> `af_bella`) speech with SHA-256 S3/SeaweedFS caching, 60 req/min per-account burst protection, variable speed (`0.75x–1.25x`), and global Settings accent propagation across `InlineListenButton`, Vocabulary cards, Study-Mode Reading paragraph listen strips (`passage-paragraph-listen-bar`), Evaluation Review model rewrites, and Speech Practice drawers/sheets (*Exam Mode Restraint* hides all coaching/TTS buttons during strict timed Exam Mode).
  - **Multimodal Pronunciation & Fluency Studio (`POST /v1/pronunciation/analyze`):** Learners record themselves reading vocabulary headwords, collocations, model sentences, or reading paragraphs; `google/gemini-3.1-flash-lite` returns a `0–100` score, band equivalent, IPA phoneme breakdown, word-level accuracy heatmap (`good` / `minor` / `error`), prosody metrics, and bilingual coaching tips.
- **Closed-Loop Smart Coach Engine (`CoachHub`, `LinguisticGraph`, `DailyMission`, `RegisterShifter`, `DropAnything`):**
  - **Personal Linguistic Error DNA Graph (`/v1/graph/me`):** Tracks recurring grammar, lexical, coherence, and pronunciation fault nodes (`LinguisticNodes`) with decay/mastery scoring and active-production verification when target words/structures are used in subsequent Writing/Speaking attempts.
  - **10-Minute Daily Mission (`/v1/missions/today`):** Closed-loop daily workout combining weak-node warmups, targeted micro-drills, and active production verification.
  - **3-Gear Pragmatic Register Shifter (`/v1/register-shifter/*`):** Upgrades learner sentences across *Gear 1 (Casual)* -> *Gear 2 (Academic)* -> *Gear 3 (Band 8.5+ Executive)* with spoken/written repeat verification.
  - **Drop Anything Micro-Drill Generator (`/v1/drop/*`):** Turns any pasted article, paragraph, or note into an instant 2-minute active upgrade drill.
- **Standalone Desktop Web (`web/` — Astro 5 Static SEO/GEO + React 19 SPA) & Mobile/Web Flutter Client (`app/`):**
  - **0KB-JS SEO & Generative Engine Optimization (GEO):** 85 prerendered pages per edition (`dist-glb` & `dist-irn`), 5 exam pillar guides, `<1KB` interactive score calculators (including PTE↔IELTS concordance), instant lazy-loaded landing audio previews, annotated writing/speaking sample banks, public vocabulary hubs, `robots.txt`, `llms.txt`, `llms-full.txt`, Markdown `.md` twins, `/favicon.ico`, and dynamic `/og/*.svg` & `.png` cards.
  - **Hexagonal React 19 Desktop Studio (`/app/*`):** Unified `max-w-6xl` SPA layout with aligned `h-14` topbar/sidebar chrome, animated `localStorage`-persisted collapsible desktop rail (`240px <-> 80px`), 5-tab mobile bottom nav (`>= 40px` touch targets, `0px` horizontal overflow), shared calligraphic `BrandMark` icon, Settings-only exam-track focus (`ExamTrackSelector`), single primary CTA hierarchy on Home, natural `stepOrder` Roadmap sorting, `10m`/`۱۰ دقیقه‌ای` diagnostic copy consistency, `sessionStorage`-scoped reactive auth with strict shape validation & coalesced token refresh, `useMemo`-stabilized translators, BiDi RTL/LTR helpers (`DirectionIcon`, `LtrExamBoundary`, zero monospace on Persian text), dynamic `measureElement` virtualized Vocab cards, Dexie v4 + `429`-resilient caching, OPFS media cache, Web Audio API waveform recorder/player, strict CSP (zero `unsafe-inline`), DOMPurify SVG sanitization, and Brotli/Gzip pre-compression (`~62.1 KB` GLB / `~64.5 KB` IRN gzip main chunks).
  - **Systemic Responsive Flutter Client (`app/`):** Device-adaptive UI across mobile, tablet, and desktop (`ChartStageCard` automatic SVG header/legend collision prevention, `AudioPlayerBar` compact `LayoutBuilder` wrap, `VocabularyScreen` 2×2 mobile / 4-col tablet+ grid, responsive `CoachHubScreen` buttons, RTL-aware `ScoreMeter`), pure-Dart `EditionCopy` localization mirroring Web labels & structured worker `stage.*` codes, unified `SanjiaMark` emblem parity, sanitized `ContentSyncService._friendlyDioError` network errors, and nested Reading `evidence.exactQuote` parsing.
- **Bidirectional Cross-Device Sync & End-to-End Server Tracing (`AdminTraceConsole`):**
  - Syncs roadmap progress, live band snapshots, exam attempts, SM-2 vocabulary SRS cards, and pronunciation history across Phone and Desktop Web (`/v1/personalization/*`, `/v1/sync/*`).
  - Records every user activity event, audio recording object key, AI model call, prompt/completion/audio token count, latency, and exact USD cost in PostgreSQL (`ai_usage_ledger`, `user_activity_ledger`), inspectable and exportable via `/v1/admin/usage/*` and the Web **Admin Trace Console** (`/app/admin/trace`).

---

## Repository Layout

```text
mockza/
├── AGENTS.md                   # Mandatory low-RAM execution rules & GLB/IRN + Web/Flutter parity policy
├── docs/                       # Product, Architecture, Roadmap & Audit Specs
│   ├── PDR.md                  # Global Clean-Room Product Design & Requirements (v4.0)
│   ├── ADR.md                  # System Architecture Decision Records & Schemas (v4.0)
│   ├── PDR-Iran.md             # Iran Domestic Edition (IRN / Sanjia) Requirements (v4.0)
│   ├── ADR-Iran.md             # Iran Domestic Edition Technical Architecture (v4.0)
│   ├── DESKTOP_WEB_PLAN.md     # Standalone Desktop Web (Astro 5 + React 19) Architecture & Plan
│   ├── ADAPTIVE_PERSONALIZATION_AND_ROADMAP_PLAN.md
│   ├── ADAPTIVE_PERSONALIZATION_AUDIT_AND_REMEDIATION_PLAN.md
│   ├── UI_UX_PERFECTION_PLAN.md & ui_ux_audit_screenshots/  # Responsive & RTL/BiDi audit plan and visual captures
│   ├── QA_REPORT.md · QA_BUGS_AND_TECHNICAL_DEBTS.md · CODE_REVIEW_ISSUES_2026-11-27.md  # QA & 95-file audit logs
│   ├── nov-28-screenshots.zip · nov-28-flutter-screenshots.zip  # Verified 50 Web + 52 Flutter visual captures
│   └── SMART_COACH_PRODUCTION_UX_AND_RELIABILITY_PLAN.md · advanced_plan.md · sanjia_flutter_plan.md
├── packages/
│   └── design-tokens/          # Canonical W3C design tokens SSOT (tokens.json + schema) for Flutter & Web
├── shared-fixtures/            # 8 cross-codebase parity vector suites (349 vectors -> 373 assertions across Backend, Web & Flutter)
├── web/                        # Standalone Desktop Web Client (Astro 5 Static SEO/GEO + React 19 SPA + Tailwind v4)
│   ├── Containerfile           # Multi-stage builder + Caddy/Nginx Brotli/Gzip runtime
│   ├── src/
│   │   ├── pages/              # 0KB-JS SEO landing, 5 exam guides, calculators, samples, vocab, GEO (.md, llms.txt) & /app/[...slug]
│   │   ├── spa/                # React 19 SPA features + persistent layout.store.ts + resilient router/hooks
│   │   ├── components/         # bidi/, exam-kit/, personalization/, speech/, ui/ (BrandMark, ExamTrackSelector, Mz*)
│   │   ├── adapters/           # Hexagonal adapters (dexie/, http/ with 429 cache fallback, media/ opfs, glb/, irn/, fakes/)
│   │   └── edition/            # Compile-time GLB/IRN config, LtrExamBoundary BiDi & edge Jalali calendar
│   └── tests/                  # 36 Vitest unit/contract test files (231 tests) + 7 Playwright Desktop E2E suites
├── app/                        # Flutter Client (SDK 3.47.9, Dart 3 + Impeller, Single-Package Feature-First MVVM)
│   ├── README.md               # Flutter architecture, 19 feature modules, 20 Drift tables & commands
│   ├── Containerfile           # Multi-stage SDK 3.47.9 -> checker -> web-builder -> Nginx runtime
│   ├── lib/                    # core/, data/ (Drift SQLite v10, 20 tables), features/ (19), routing/ (31 routes), services/, theme/, l10n/ (EN + FA)
│   └── test/                   # 39 test files (409 tests): Core, Data, Feature, Policy, Service, Parity, Theme, A11y & 9 Full-Router E2E suites
├── backend/                    # pnpm TypeScript Monorepo (Node 24 LTS + Hono + Drizzle + pg-boss, 10 workspaces)
│   ├── Containerfile           # Multi-stage targets: api, worker (+ffmpeg), migrator, cli, toolchain
│   ├── apps/api/               # HTTP ingress behind PgBouncer (OpenAPI /v1/* routes, auth/OTP/slots, quota, TTS, pronunciation, personalization, admin trace)
│   ├── apps/worker/            # pg-boss consumers with execution-generation fencing, outbox sweep lock & 30-day audio purge
│   ├── packages/domain/        # Pure TS domain engines (EXAM_SCALES, rubrics, DiagnosticRouter, SM-2, LiveBandEngine, RoadmapGenerator, LinguisticGraphMath)
│   ├── packages/contracts/     # Zod OpenAPI contracts & snapshot exported for Dart/TypeScript parity
│   ├── packages/db/            # PostgreSQL 16 Drizzle schema (41 tables), migrations, usage/personalization stores & seeds (36 packs, 7 drills, 320 vocab)
│   ├── packages/ai/            # Multi-exam EN/FA rubric prompts, LangGraph writing/speaking/mission/pronunciation/TTS runners, OpenRouter & Langfuse masking
│   ├── packages/storage/       # S3/SeaweedFS & R2 client, bucket init (`mockza-audio-private`, `mockza-media`), seed assets
│   ├── packages/config/        # Zod env config & EDITION (`glb` | `irn`) validation
│   ├── content-pipeline/       # Pre-publish clean-room provenance, evidence-span & SHA-256 validator CLI
│   └── evals/                  # Golden rubric calibration benchmark runner (±0.5 band parity)
├── scripts/                    # Repo automation, token sync & static/parity gates
│   ├── check_all.sh            # Master gate: Design tokens + 10 Flutter gates + Backend hygiene + Web TS/ESLint/BiDi/Vitest/Dual-Build/Budget + Cross-Parity
│   ├── check_cross_parity.sh   # Runs 372 shared parity vectors across Backend, Web, and Flutter
│   ├── sync_design_tokens.mjs  # Generates Dart & CSS/TS theme tokens from packages/design-tokens/tokens.json
│   ├── check_web_budget.mjs    # Verifies Brotli/Gzip budgets, 0KB-JS SEO pages & bundle isolation
│   ├── dev_local.sh            # Low-RAM hybrid dev stack (Postgres + SeaweedFS in Docker; host Node & Web/Flutter)
│   └── run_e2e.sh              # End-to-end verification runner
├── compose.yaml                # Full container stack (Postgres, PgBouncer, SeaweedFS, s3-init, migrate, api, worker, web, tools, k6)
├── Makefile                    # Sequential low-RAM build, dev-*, compose, migrate, check & loadtest targets
└── pnpm-workspace.yaml         # Root pnpm workspace unifying packages/*, web, and backend/* (12 workspaces)
```

---

## Low-RAM Execution Policy (`AGENTS.md`)

On memory-constrained hosts (`<= 8 GiB` RAM), always follow [AGENTS.md](file:///home/mahdi/projects/ideas/mockza/AGENTS.md):
1. **Check available RAM first:** Run `free -m` and ensure `available >= 900 MiB` before starting any test, typecheck, or build.
2. **Never run heavy processes concurrently:** Run Backend, Web, and Flutter builds/tests strictly sequentially (`maxWorkers=1`, `--concurrency=1`).
3. **Cap VM heaps:**
   - Web/Backend Vitest & Astro builds: `NODE_OPTIONS="--max-old-space-size=768"` with `--pool=forks --poolOptions.forks.singleFork --maxWorkers=1`
   - Flutter test batches (`<= 10` files per batch): `DART_VM_OPTIONS="--old_gen_heap_size=768" flutter test --no-pub --concurrency=1 ...`
   - Flutter web release builds (`<= 8 GiB` hosts): `DART_VM_OPTIONS="--old_gen_heap_size=640" flutter build web --release --no-wasm-dry-run -t lib/main_global.dart` (or `lib/main_iran.dart`), never run concurrently with other builds.

---

## Running Locally

### Option A: Low-RAM Hybrid Dev (`< 5 GiB` Host RAM — Recommended on `<= 8 GiB` Machines)

Runs PostgreSQL (`:45432`) and SeaweedFS (`:45833`) in Docker while running compiled Node API/worker and Web/Flutter on the host:

```bash
cp .env.example .env

# 1. Start Docker Postgres & SeaweedFS + run Drizzle migrations, S3 bucket init & 36-pack seed
make dev-infra
make dev-up

# Or run compiled API (:45281) & Worker in foreground/daemon mode:
./scripts/dev_local.sh serve

# 2. Build standalone Astro 5 + React 19 Desktop Web bundles (GLB & IRN):
PUBLIC_EDITION=glb NODE_OPTIONS="--max-old-space-size=384" pnpm --filter @mockza/web build:glb
PUBLIC_EDITION=irn NODE_OPTIONS="--max-old-space-size=384" pnpm --filter @mockza/web build:irn
```

### Option B: Full Container Stack (`Docker Compose` / `Podman Compose`)

Builds images sequentially so Web and Backend never compete for RAM:

```bash
cp .env.example .env
make build
make up
```

### Live Endpoints (Dual-Edition Deployment)

| Service | Host Binding | Purpose |
| :--- | :--- | :--- |
| `mockza-web` (`GLB` Web) | `0.0.0.0:45280` | Standalone Astro 5 + React 19 Global Edition (`dist-glb`, Brotli/Gzip, `/v1/*` proxy) |
| `mockza-api` (`GLB` API) | `127.0.0.1:45281` *(configurable via `MOCKZA_API_BIND`)* | Global Edition Hono REST/OpenAPI v1 ingress (`EDITION=glb`, CIDR-aware `TRUSTED_PROXY_IPS`) |
| `sanjia-web` (`IRN` Web) | `0.0.0.0:45282` | Standalone Astro 5 + React 19 Iran Domestic Edition (`dist-irn`, Persian RTL + BiDi) |
| `sanjia-api` (`IRN` API) | `127.0.0.1:45283` | Iran Domestic Edition Hono REST/OpenAPI v1 ingress (`EDITION=irn`, CIDR-aware `TRUSTED_PROXY_IPS`) |
| `mockza-flutter` / `sanjia-flutter` | `mockza.mehtea.ir` / `sanjia.mehtea.ir` | Live Nginx-served Flutter Web editions (`main_global.dart` & `main_iran.dart`, preserving `/v1/*` API proxy) |
| `postgres` (PostgreSQL 16) | `127.0.0.1:45432` | Primary relational database (41 Drizzle tables) & `pg-boss` durable queue |
| `pgbouncer` (v1.24.1) | `127.0.0.1:45433` | Transaction connection pool (`PG_PGBOUNCER=true` for API; bypassed by worker & migrate) |
| `seaweedfs` (S3 + Master) | `127.0.0.1:45833`, `45933` | Buckets `mockza-audio-private` (speaking/pronunciation clips & TTS cache) & `mockza-media` |

---

## Verification, Testing & Operations

```bash
# Always check available RAM first (require >= 900 MiB available)
free -m

# 1. Full static, token-sync, web dual-build, budget & 349-vector (373 assertions) cross-parity gates
./scripts/check_all.sh all

# 2. Backend Vitest suite across pnpm workspaces (single-fork low-RAM mode)
cd backend && NODE_OPTIONS="--max-old-space-size=768" pnpm -r --workspace-concurrency=1 exec vitest run --pool=forks --poolOptions.forks.singleFork --maxWorkers=1

# 3. Web Vitest unit & contract suite (36 files / 231 tests)
NODE_OPTIONS="--max-old-space-size=768" pnpm --filter @mockza/web exec vitest run --pool=forks --poolOptions.forks.singleFork --maxWorkers=1

# 4. Flutter analyzer + batched low-RAM test execution (39 files / 409 tests, <= 10 files per batch)
cd app && dart format --output=none --set-exit-if-changed lib test && DART_VM_OPTIONS="--old_gen_heap_size=768" flutter analyze --no-pub --fatal-infos

# 5. Re-seed & validate clean-room exam bundles, micro-drills & 320 vocab cards
cd backend && pnpm --filter @mockza/db seed && pnpm --filter @mockza/content-pipeline validate
```

---

## Documentation Index

- **[AGENTS.md](file:///home/mahdi/projects/ideas/mockza/AGENTS.md)** — Mandatory low-RAM operational guardrails and GLB/IRN + Web/Flutter architectural parity rules.
- **[docs/PDR.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR.md)** — Complete Global Edition (`GLB`) Product Design, 5-track exam specs, Adaptive Roadmap, Smart Coach, Kokoro TTS, Pronunciation Studio & tracing requirements (`v4.0`).
- **[docs/ADR.md](file:///home/mahdi/projects/ideas/mockza/docs/ADR.md)** — System Architecture Decision Records (`ADR-001`–`ADR-022`), 41-table Postgres & 20-table Drift schemas, Astro 5 + React 19 Web architecture, AI routing & observability (`v4.0`).
- **[docs/PDR-Iran.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR-Iran.md)** & **[docs/ADR-Iran.md](file:///home/mahdi/projects/ideas/mockza/docs/ADR-Iran.md)** — Iran Domestic Edition (`IRN` / *Sanjia*) full implementation specifications, BiDi RTL/LTR boundary rules, Jalali calendar, SMS OTP, and Zarinpal/Bazaar/Myket billing (`v4.0`).
- **[docs/DESKTOP_WEB_PLAN.md](file:///home/mahdi/projects/ideas/mockza/docs/DESKTOP_WEB_PLAN.md)** — Standalone Desktop Web (`Astro 5 Static + React 19 SPA`) architecture, SSOT token/engine sync, and SEO+GEO layer.
- **[docs/ADAPTIVE_PERSONALIZATION_AND_ROADMAP_PLAN.md](file:///home/mahdi/projects/ideas/mockza/docs/ADAPTIVE_PERSONALIZATION_AND_ROADMAP_PLAN.md)** & **[docs/ADAPTIVE_PERSONALIZATION_AUDIT_AND_REMEDIATION_PLAN.md](file:///home/mahdi/projects/ideas/mockza/docs/ADAPTIVE_PERSONALIZATION_AUDIT_AND_REMEDIATION_PLAN.md)** — Adaptive roadmap (*Durnama*), live band evolution, Kokoro TTS, pronunciation studio, and full-stack tracing blueprints.
- **[docs/UI_UX_PERFECTION_PLAN.md](file:///home/mahdi/projects/ideas/mockza/docs/UI_UX_PERFECTION_PLAN.md)** & **[docs/ui_ux_audit_screenshots/](file:///home/mahdi/projects/ideas/mockza/docs/ui_ux_audit_screenshots)** — End-to-end responsive, BiDi/RTL, shell consistency, onboarding, CEFR calibration, and Playwright visual audit documentation.
- **[docs/QA_REPORT.md](file:///home/mahdi/projects/ideas/mockza/docs/QA_REPORT.md)**, **[docs/QA_BUGS_AND_TECHNICAL_DEBTS.md](file:///home/mahdi/projects/ideas/mockza/docs/QA_BUGS_AND_TECHNICAL_DEBTS.md)** & **[docs/CODE_REVIEW_ISSUES_2026-11-27.md](file:///home/mahdi/projects/ideas/mockza/docs/CODE_REVIEW_ISSUES_2026-11-27.md)** — End-to-end QA report (`QA-001`–`QA-014`), technical debt log, and 95-file full code review resolution record.
- **[app/README.md](file:///home/mahdi/projects/ideas/mockza/app/README.md)** — Flutter client architecture, 19 feature modules, components, and low-RAM commands.
- **[app/test/e2e/README.md](file:///home/mahdi/projects/ideas/mockza/app/test/e2e/README.md)** — Hermetic 9-suite Flutter E2E harness and Page-Object Robot guide.
