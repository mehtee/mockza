# Mockza — Backend Architecture Proposal (TypeScript)

Scope: the backend for the Mockza Flutter app, aligned with `ADR.md` (ADR-007, ADR-008, ADR-014) and `PDR.md`.
Each component below lists **what it is** and **what it is used for**.

---

## 1. Repository Layout

```text
mockza/
├── app/        # Flutter app (single-package, feature-first). Entrypoints: main_global.dart, main_iran.dart (ADR-014)
├── backend/    # TypeScript backend (this document)
└── docs/       # PDR.md, PDR-Iran.md, ADR.md, ADR-Iran.md
```

---

## 2. Stack and Purpose

| Component | Used for |
|---|---|
| **Node.js (LTS) + TypeScript (strict)** | Single language for API, workers, evals and content tooling, so schemas and domain code are shared everywhere. |
| **pnpm workspaces** | Monorepo with separate apps (`api`, `worker`) and shared packages without duplicating code. |
| **Hono + `@hono/zod-openapi`** | HTTP API. Routes are typed from Zod schemas and produce an OpenAPI spec, which generates the Dart client for the Flutter app. |
| **Zod** | Single source of truth for request/response contracts, environment config, and validation of LLM JSON output. |
| **PostgreSQL 16 + Drizzle ORM** | Durable storage: users, entitlements, attempts, quota ledger, AI cache, catalog packs. Drizzle gives typed queries and forward-only migrations. |
| **pg-boss** | Job queue on top of Postgres. Runs Speaking/Writing grading asynchronously with retries, idempotency keys and scheduled jobs (30-day audio purge). Avoids running a separate Redis service in v1. |
| **Postgres quota ledger** | Atomic per-user daily/monthly counters (10 Speaking + 10 Writing per day, 150 per month) checked before any paid model call. |
| **S3-compatible object storage** | Stores Speaking `.m4a` uploads and serves Listening/Reading packs. Accessed only through the S3 API with a configurable endpoint. |
| **SeaweedFS (local / self-hosted)** | S3-compatible store for local development and self-hosted deployments (e.g. `irn`). Chosen because the MinIO Community Edition repository was archived in April 2026 and official images stopped in October 2025. Garage is an equivalent alternative. |
| **Cloudflare R2 + CDN (`glb` production)** | Pack delivery to mobile clients at CDN scale, so downloads create zero API load (ADR-007). |
| **LangChain (`@langchain/core`, `@langchain/openai`)** | Model abstraction. `ChatOpenAI` pointed at the OpenRouter base URL, with structured-output support bound to Zod schemas. |
| **LangGraph (`@langchain/langgraph`)** | In-process graphs inside worker jobs. Each grading flow is explicit nodes: prepare input → call model → Zod-validate → repair loop → persist. |
| **`@langchain/langgraph-cli`** | Development only: `langgraphjs dev` to run and debug graphs locally, configured by `langgraph.json`. Not part of the deployed backend. |
| **OpenRouter** | Single API for many models. Lets the grading model be changed or A/B-tested through configuration, with fallbacks. |
| **Langfuse Cloud** | Tracing, cost/latency monitoring and evaluation datasets. Connected through `@langfuse/langchain` (CallbackHandler) and `@langfuse/otel` (OpenTelemetry span processor). |
| **Vitest** | Unit/integration tests for contracts, quota logic, graphs (with fake models) and DB access. |
| **Biome** | Lint and format for the whole workspace. |
| **Docker + docker-compose** | Local environment: Postgres 16 + SeaweedFS. Single container image for deployment. |

---

## 3. Backend Structure

```text
backend/
├── package.json · pnpm-workspace.yaml · tsconfig.base.json · biome.json
├── langgraph.json                 # dev-only config for langgraphjs dev
├── Dockerfile · docker-compose.yml  # Postgres 16 + SeaweedFS (S3 API)
├── apps/
│   ├── api/src/
│   │   ├── server.ts              # Hono app, graceful shutdown, health
│   │   ├── routes/                # evaluate, jobs, uploads (presign), catalog,
│   │   │                          #   webhooks-revenuecat, account
│   │   └── middleware/            # attest, auth, edition-guard, quota, request-id
│   └── worker/src/                # pg-boss consumers: grade-speaking, grade-writing,
│                                  #   explain-question, purge-audio (30-day cron)
├── packages/
│   ├── contracts/                 # Zod schemas → OpenAPI → Dart client
│   ├── domain/                    # rubrics, EvaluationPayload, quota + edition rules, error codes
│   ├── db/                        # Drizzle schema + forward-only migrations
│   ├── ai/
│   │   ├── models/                # OpenRouter model registry (id, capabilities, cost, calibrated flag)
│   │   ├── graphs/                # LangGraph: grade-writing, grade-speaking, explain-question
│   │   ├── prompts/               # versioned rubrics (e.g. glb_ielts_en_v1.0)
│   │   ├── audio/                 # S3 → base64 (+ ffmpeg → WAV fallback)
│   │   └── observability/         # Langfuse init, handler factory, masking
│   ├── storage/                   # S3 client (S3_ENDPOINT / S3_PUBLIC_ENDPOINT), presign, delete sweep
│   └── config/                    # Zod-parsed env + EDITION
├── evals/                         # Langfuse datasets + per-model experiment runner (±0.5 band target)
└── content-pipeline/              # provenance validator, SHA-256, TTS packager
```

### What each part is for

| Path | Purpose |
|---|---|
| `apps/api` | Thin request layer: verifies attestation and identity, checks edition and quota, creates jobs, returns `202 Accepted` and job status. Never calls the model directly. |
| `apps/worker` | Does the slow work: loads the clip/essay, runs the grading graph, stores the result. Isolated so API latency does not depend on model latency. |
| `packages/contracts` | One definition of every request/response shared by API, worker tests and the Flutter client. |
| `packages/domain` | Business rules independent of frameworks (rubric schemas, quota math, edition rules). |
| `packages/db` | Schema and migrations for Postgres, including the quota ledger, AI cache and job idempotency. |
| `packages/ai/models` | Records which OpenRouter models support audio input and JSON-schema output, their cost, and whether they have passed band calibration. |
| `packages/ai/graphs` | Grading flows as explicit steps so each step appears separately in Langfuse traces. |
| `packages/ai/prompts` | Versioned rubric prompts; the rubric version includes the model ID so results are traceable. |
| `packages/ai/audio` | Fetches the `.m4a` from S3 and base64-encodes it for OpenRouter; transcodes to WAV when a model/provider does not accept `m4a`. |
| `packages/ai/observability` | Initializes Langfuse and masks essay/transcript content before traces are sent. |
| `packages/storage` | S3 access, presigned upload URLs for the app, and the sweep that deletes audio older than 30 days. |
| `evals` | Golden Speaking/Writing set run through Langfuse experiments for each candidate model. |
| `content-pipeline` | Pre-publish CLI that enforces `contentOrigin`, `humanQaReviewed`, evidence spans and SHA-256 checks (ADR-008). |

---

## 4. Request Flows

### Speaking evaluation
1. App calls `POST /v1/uploads/presign` and uploads the `.m4a` directly to object storage.
2. App calls `POST /v1/evaluate/speaking` with `Idempotency-Key = attemptId`.
3. API verifies App Attest / Play Integrity, edition, entitlement and quota, enqueues a pg-boss job, and returns `202`.
4. Worker fetches the clip, base64-encodes it, runs the `grade-speaking` graph through OpenRouter, validates the JSON with Zod (repair loop on failure), and stores the result.
5. App polls `GET /v1/jobs/:id` until the graded payload is available.

### Pack delivery
The app reads `GET /v1/catalog/manifest` (CDN URLs + SHA-256 + provenance) and downloads packs directly from object storage/CDN. The API serves no pack bytes.

### "Ask AI Why?"
Results are cached by `(questionId, packVersion)` in Postgres, so each explanation is generated once and reused.

### Account deletion
`DELETE /v1/account` removes database rows and audio objects; the purge job enforces the 30-day audio limit.

---

## 5. Editions (ADR-014)

One codebase, two deployments selected by `EDITION=glb|irn`. Each deployment has its own database, bucket, secrets and OpenRouter/Langfuse configuration. The edition guard rejects cross-edition catalog requests with `403 EDITION_FORBIDDEN`.

---

## 6. Constraints and Notes

- **Audio via OpenRouter:** audio is sent base64-encoded (URLs are not supported) and supported formats vary by provider, so `m4a` is tested per model with the WAV fallback available.
- **Structured output:** support differs per model, so routing requires the capabilities recorded in the model registry.
- **Calibration:** the ±0.5 band target is measured per model; a model change triggers a new Langfuse experiment run.
- **Privacy:** user audio/essays pass through OpenRouter and the upstream provider, and traces go to Langfuse Cloud. Provider routing is restricted to no-retention/no-training options, trace content is masked, and the Langfuse region is chosen explicitly. The privacy disclosure (NFR-006) and store privacy declarations cover both.
- **Cost:** the PDR unit-economics estimate assumed Gemini Flash pricing and is re-checked per model; quota caps limit exposure.
- **Presigned URLs:** generated against the public storage hostname (`S3_PUBLIC_ENDPOINT`), not the internal Docker hostname.
- **LangGraph checkpointer / Agent Server:** not used; pg-boss provides job durability and idempotency.
- **Pending decision:** the first audio-capable default model for Speaking.

---

## Sources

- OpenRouter audio docs: https://www.openrouter.ai/docs/guides/overview/multimodal/audio
- Langfuse LangChain/LangGraph integration: https://langfuse.com/docs/langchain/typescript
- MinIO archive timeline: https://wz-it.com/en/blog/minio-successor-s3-storage-comparison/
- MinIO alternatives: https://pinggy.io/amp/blog/minio_archived_self_hosted_s3_alternatives/
- LangGraph CLI: https://docs.langchain.com/langsmith/cli
