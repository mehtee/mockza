# Mockza

Offline-first, AI-native **5-Track English Exam Simulator Hub**, AI Speaking/Writing Rubric Evaluator, Rapid 4-Skill Starting-Level Check, and SM-2 Contextual Vocabulary Coach — packaged with a **Container-First Architecture** (`Docker Compose` & `Podman Compose` ready) and a **low-RAM local developer workflow** (`scripts/dev_local.sh`).

> Live Edition: **Global Clean-Room Edition (`GLB`)** (version `1.0.0+10001.glb` / multi-exam release `v3.0`) serving **IELTS Academic**, **IELTS General Training**, **TOEFL iBT (2026 Format)**, **PTE Academic (Latest)**, and **Duolingo English Test (DET Latest)** inside one consolidated hub.

---

## Core Capabilities

- **5 Exam Tracks & Isolated Scale Calibration:**
  - **IELTS Academic & General Training (`0.0–9.0` Band, `0.5` steps):** 40-question raw-to-band calibration for Reading/Listening, Academic Task 1 charts + General Task 1 letters + Task 2 essays, Parts 1–3 Speaking.
  - **TOEFL iBT (2026 Format, `1.0–6.0` Band, `0.5` steps + `0–120` Concordance):** Reading (*Complete the Words*, *Read in Daily Life*, *Academic Passage*), Listening (*Choose a Response*, campus/academic talks), 3-task Writing (*Build a Sentence*, *Write an Email*, *Academic Discussion*), and Listen & Repeat / zero-prep *Take an Interview* Speaking.
  - **PTE Academic (Latest, `10–90` Integer Score):** *Re-order Paragraphs* drag-free sequential selector (`MzSequenceOrderControl`), *Write from Dictation* (`dictation`), single-sentence *Summarize Written Text* (`5–75w`) & *Write Essay* (`200–300w`), and *Describe Image* Speaking with zoomable SVG charts (`ExamSvgChartCard`).
  - **Duolingo English Test / DET (Latest, `10–160` Score in `5`-pt steps + 4 Subscores):** Displays **Literacy**, **Comprehension**, **Conversation**, and **Production** alongside *Read & Select* (`binary_choice`), *Read & Complete* (`word_completion`), *Listen & Type* (`dictation`), *Write About the Photo* (SVG scene) / *Interactive Writing* / *Writing Sample*, and zero-prep *Interactive Speaking*.
- **Rapid ~10–15 Min 4-Skill Starting-Level Check (`DiagnosticRouter`):** Compact zero-scroll preflight intro & mic check, 2-stage adaptive Reading & Listening routing, short Writing & Speaking samples, **Standard (`900s` cap) / Extended Untimed (`3x`) / Accessible Replayable Audio** modes, and single-skill retake.
- **Full 4-Skill Simulators, Micro-Drills & Full Mock Planner:** Focused single-question mode (scroll-free mobile UX) vs. All-Questions views, Study vs. strict Exam Mode locks, Reading highlights & notes, 500ms crash-safe Writing autosave, queued `.m4a` Speaking turns, 7 targeted 3-minute Micro-Drills, and Mistake-to-Deck **SM-2 Vocabulary SRS** (`320` seeded academic/paraphrase cards).
- **Multi-Surface Auth & Strict `1 Phone + 1 Desktop Web` Device-Slot Policy:** Email/Password, Sign in with Google, and Sign in with Apple (plus `ALLOW_DEV_AUTH_PROVIDERS=true` sandbox mode for local/dev testing before live client credentials are configured), active device/session management in Settings (`mobile` + `desktop_web` slots), remote revocation, and mandatory Paywall ToS consent.
- **SOLID & Open-Closed UI Architecture:** 4 switchable Light/Dark presets (*Midnight Indigo*, *Nordic Emerald*, *Editorial Amber*, *Oceanic Cobalt*), RTL/LTR directional spacing, and verified zero-overflow responsiveness down to `320dp` phones.

---

## Repository Layout

```text
mockza/
├── docs/                       # Product, Architecture, Roadmap & UI Specs
│   ├── PDR.md                  # Global Clean-Room Product Design & Requirements (v3.0)
│   ├── ADR.md                  # System Architecture Decision Records & Schemas (v3.0)
│   ├── PDR-Iran.md             # Iran Domestic Edition (IRN / Sanjia) Requirements
│   ├── ADR-Iran.md             # Iran Domestic Edition Technical Architecture
│   └── design.md · UI-UX-TLDR.md · PLAN.md · RAPID_DIAGNOSTIC_PLAN.md · proposed_backend.md
├── app/                        # Flutter Client (Dart 3 + Impeller, Single-Package Feature-First MVVM)
│   ├── README.md               # Flutter architecture, theme system, flavors & commands
│   ├── Containerfile           # Multi-stage SDK 3.47.9 -> checker -> web-builder -> Nginx runtime
│   ├── nginx.conf              # SPA routing + /v1/* and /openapi.json reverse proxy
│   ├── lib/                    # core/, data/ (Drift SQLite v5, 14 tables), features/ (15), routing/ (24 constants), services/, theme/, l10n/
│   └── test/                   # Unit, Data, Feature, Policy, Service, Theme, A11y & 7 Page-Object E2E suites
├── backend/                    # pnpm TypeScript Monorepo (Node 24 LTS + Hono + Drizzle + pg-boss)
│   ├── Containerfile           # Multi-stage targets: api, worker (+ffmpeg), migrator, cli, toolchain
│   ├── apps/api/               # HTTP ingress behind PgBouncer (OpenAPI /v1/* routes, auth/slots, quota, S3 presign/media)
│   ├── apps/worker/            # pg-boss consumers with execution-generation fencing & 30-day audio purge
│   ├── packages/domain/        # EXAM_SCALES, getExamRubricSpec, DiagnosticBudget/Router, safety/provenance rules
│   ├── packages/contracts/     # Zod OpenAPI contracts exported for Dart/TypeScript parity
│   ├── packages/db/            # PostgreSQL 16 Drizzle schema (24 tables), migrations & seeds (36 packs, 7 drills, 320 vocab)
│   ├── packages/ai/            # Multi-exam rubric prompts, LangGraph writing/speaking graphs, OpenRouter & Langfuse masking
│   ├── packages/storage/       # S3/SeaweedFS & R2 client, bucket init (`mockza-audio-private`, `mockza-media`), seed assets
│   ├── packages/config/        # Zod env config & EDITION (`glb` | `irn`) validation
│   ├── content-pipeline/       # Pre-publish clean-room provenance, evidence-span & SHA-256 validator CLI
│   └── evals/                  # Golden rubric calibration benchmark runner (±0.5 band parity)
├── scripts/                    # Repo automation & gates
│   ├── check_all.sh            # 10 static architectural boundary, LTR/RTL & secret hygiene gates
│   ├── dev_local.sh            # Option-2 low-RAM dev stack (Postgres + SeaweedFS in Docker; host Node & Flutter)
│   ├── serve_web_static.mjs    # Lightweight gzipped static server (~68 MB RSS) serving app/build/web
│   ├── stamp_web_cache_bust.sh # Deterministic SHA cache-busting for main.dart.js & flutter_bootstrap.js
│   ├── run_e2e.sh              # Static gates + backend full-journey E2E + all 7 Flutter E2E journeys
│   └── backup_restore.sh       # Postgres + SeaweedFS backup/restore utility
├── compose.yaml                # Full container stack (Postgres, PgBouncer, SeaweedFS, s3-init, migrate, api, worker, web)
├── Makefile                    # Low-RAM build, dev-*, compose, migrate, check & k6 targets
├── .env.example                # Non-colliding default ports (45280-45933) and environment template
└── .flutter-version            # Pinned Flutter SDK toolchain version (3.47.9)
```

---

## Running Locally

### Option A: Low-RAM Hybrid Dev (`< 5 GiB` Host RAM — Recommended on `<= 8 GiB` Machines)

Runs only PostgreSQL (`:45432`) and SeaweedFS (`:45833`) in Docker while executing compiled Node API/worker and static/debug Flutter Web on the host:

```bash
cp .env.example .env

# 1. Start Docker Postgres & SeaweedFS + run Drizzle migrations, S3 bucket init & 36-pack seed
make dev-infra
make dev-up

# Or run compiled API (:45281) & Worker in daemon/foreground mode:
./scripts/dev_local.sh serve

# 2. Build low-RAM static release Flutter Web bundle (avoids parallel 1.04 GB dart2wasm spike):
cd app
flutter build web --release -O1 --no-pub --no-source-maps --no-tree-shake-icons --no-wasm-dry-run
cd ..
./scripts/stamp_web_cache_bust.sh

# 3. Serve gzipped static bundle on :45280 (~68 MB RSS):
node ./scripts/serve_web_static.mjs
```

### Option B: Full Container Stack (`Docker Compose` / `Podman Compose`)

Builds images sequentially so Flutter Web and TypeScript never compete for RAM:

```bash
cp .env.example .env
make build
make up
```

Or with Podman: `COMPOSE="podman compose" make build up`.

### Default Non-Colliding Host Endpoints

| Service | Host Binding | Purpose |
| :--- | :--- | :--- |
| `web` (Flutter Web SPA) | `0.0.0.0:45280` | Release Web UI (`serve_web_static.mjs` or Nginx proxying `/v1/*` & `/openapi.json`) |
| `api` (Hono + Node 24) | `0.0.0.0:45281` | REST/OpenAPI v1 ingress (`/v1/health`, `/openapi.json`), behind PgBouncer in Compose |
| `postgres` (PostgreSQL 16) | `127.0.0.1:45432` | Primary relational database & `pg-boss` durable queue |
| `pgbouncer` (v1.24.1) | `127.0.0.1:45433` | Transaction connection pool (`PG_PGBOUNCER=true` for API; bypassed by worker & migrate) |
| `seaweedfs` (S3 + Master) | `127.0.0.1:45833`, `45933` | Buckets `mockza-audio-private` (user clips) & `mockza-media` (listening tracks & SVG figures) |

---

## Verification, Testing & Operations

```bash
# 1. Static architecture & hygiene checks (10 boundary rules across app/lib & backend/)
./scripts/check_all.sh all

# 2. Full End-to-End suite (static gates + backend full-journey Vitest + all 7 Flutter E2E journeys)
./scripts/run_e2e.sh

# 3. Flutter analyzer + formatting + full unit/widget/data/service suite (low-RAM concurrency=1)
cd app && dart format --output=none --set-exit-if-changed lib test && flutter analyze --no-pub --fatal-infos && flutter test --no-pub --concurrency=1

# 4. Backend lint, typecheck & Vitest suite across all 10 pnpm workspaces
cd backend && pnpm lint && pnpm typecheck && pnpm test

# 5. Re-seed & validate clean-room exam bundles, micro-drills & 320 vocab cards
cd backend && pnpm --filter @mockza/db seed && pnpm --filter @mockza/content-pipeline validate

# 6. Containerized CI & load-testing tools
make check
docker compose --profile tools run --rm evals
docker compose --profile loadtest run --rm k6
```

---

## Documentation Index

- **[docs/PDR.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR.md)** — Complete Global Edition (`GLB`) Product Design, 5-track exam specs, KPIs, device policy & functional requirements (`v3.0`).
- **[docs/ADR.md](file:///home/mahdi/projects/ideas/mockza/docs/ADR.md)** — System Architecture Decision Records (`ADR-001`–`ADR-018`), Drizzle/Drift schemas, AI routing & repo blueprint (`v3.0`).
- **[docs/PDR-Iran.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR-Iran.md)** & **[docs/ADR-Iran.md](file:///home/mahdi/projects/ideas/mockza/docs/ADR-Iran.md)** — Iran Domestic Edition (`IRN` / *Sanjia*) extensions, BiDi RTL/LTR boundary rules, and domestic payment adapters.
- **[app/README.md](file:///home/mahdi/projects/ideas/mockza/app/README.md)** — Flutter client architecture, modular components, and commands.
- **[app/test/e2e/README.md](file:///home/mahdi/projects/ideas/mockza/app/test/e2e/README.md)** — Hermetic E2E harness and extensible Page-Object Robot guide.
