# Mockza

Offline-first IELTS Exam Simulator, AI Speaking/Writing Evaluator, and SM-2 Vocabulary Coach — packaged with a **Container-First Architecture** (`Docker Compose` & `Podman Compose` ready).

## Repository Layout

```text
mockza/
├── docs/                  # Architecture & planning specs (ADR.md, PLAN.md, ADR-Iran.md, PDR.md, UI/)
├── app/                   # Single-package Flutter client + app/Containerfile + nginx.conf
├── backend/               # pnpm TS monorepo + backend/Containerfile + Drizzle migrations
├── scripts/               # Monorepo static & architectural boundary gates (check_all.sh)
├── .github/workflows/     # Container-first CI verification pipeline (ci.yml)
├── compose.yaml           # Unified full-stack compose (Postgres, PgBouncer, SeaweedFS, API, Worker, Web)
├── Makefile               # Sequential low-RAM build, run, migrate & check shortcuts
├── .env.example           # Non-colliding default ports and environment template
└── .flutter-version       # Pinned Flutter SDK toolchain version (3.47.9)
```

## Container-First Quickstart

1. Copy the environment template (defaults use non-colliding `45280`–`45933` host ports):

```bash
cp .env.example .env
```

2. Build images sequentially (recommended on 8 GiB hosts so Flutter Web and TypeScript never compete for RAM) and start the stack:

```bash
make build
make up
```

Or run with `podman compose` (`COMPOSE="podman compose" make build up`): both `Containerfile` and `Dockerfile` symlinks plus `compose.yaml` are supported identically.

### Default Exposed Endpoints

| Service | Host Port Binding | Notes |
| --- | --- | --- |
| `web` (Flutter Web + Nginx) | `0.0.0.0:45280 -> 8080` | Serves SPA & proxies `/v1/*` and `/openapi.json` to `api` |
| `api` (Hono + Node 24) | `0.0.0.0:45281 -> 8787` | Connects to PostgreSQL via `pgbouncer:6432` |
| `postgres` (PostgreSQL 16) | `127.0.0.1:45432 -> 5432` | Auto-migrated on boot by one-shot `migrate` service |
| `pgbouncer` (v1.24.1) | `127.0.0.1:45433 -> 6432` | Transaction pooling for API (`PG_PGBOUNCER=true`) |
| `seaweedfs` (S3 + Master) | `127.0.0.1:45833 -> 8333`, `45933 -> 9333` | Bucket `mockza-audio-private` initialized by `s3-init` |

## Containerized Verification & Operations

```bash
# Static architecture boundaries & secret hygiene
./scripts/check_all.sh all

# Containerized backend checks (Biome, tsc --noEmit, Vitest)
make check-backend

# Containerized Flutter checks (dart format, flutter analyze --fatal-infos, flutter test)
make check-flutter

# One-shot operational tools
docker compose --profile tools run --rm content-validate
docker compose --profile tools run --rm evals
docker compose --profile loadtest up --abort-on-container-exit k6
```
