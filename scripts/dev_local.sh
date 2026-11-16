#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
APP_DIR="$ROOT_DIR/app"
STATE_DIR="$ROOT_DIR/.local-dev"
PID_DIR="$STATE_DIR/pids"
LOG_DIR="$STATE_DIR/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

load_env() {
  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    if [[ -f "$ROOT_DIR/.env.example" ]]; then
      cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
      echo "Created .env from .env.example"
    else
      echo "Missing .env and .env.example in $ROOT_DIR" >&2
      exit 1
    fi
  fi

  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a

  export EDITION="${MOCKZA_EDITION:-glb}"
  export NODE_ENV="${NODE_ENV:-development}"
  export PORT="${MOCKZA_API_PORT:-45281}"
  export MOCKZA_PG_PORT="${MOCKZA_PG_PORT:-45432}"
  export MOCKZA_S3_PORT="${MOCKZA_S3_PORT:-45833}"
  export MOCKZA_WEB_PORT="${MOCKZA_WEB_PORT:-45280}"

  export POSTGRES_USER="${POSTGRES_USER:-mockza}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-mockza_dev_password}"
  export POSTGRES_DB="${POSTGRES_DB:-mockza}"
  export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${MOCKZA_PG_PORT}/${POSTGRES_DB}"
  export PG_PGBOUNCER="false"

  export S3_ENDPOINT="http://127.0.0.1:${MOCKZA_S3_PORT}"
  export S3_PUBLIC_ENDPOINT="${S3_PUBLIC_ENDPOINT:-http://127.0.0.1:${MOCKZA_S3_PORT}}"
  export S3_REGION="${S3_REGION:-us-east-1}"
  export S3_BUCKET="${S3_BUCKET:-mockza-audio-private}"
  export S3_MEDIA_BUCKET="${S3_MEDIA_BUCKET:-mockza-media}"
  export S3_PUBLIC_MODE="${S3_PUBLIC_MODE:-proxy}"
  export S3_ACCESS_KEY="${S3_ACCESS_KEY:-mockza_s3_access}"
  export S3_SECRET_KEY="${S3_SECRET_KEY:-mockza_s3_secret}"
}

resolve_pnpm() {
  local pnpm_home="${PNPM_HOME:-$HOME/.local/share/pnpm}"
  if [[ -d "$pnpm_home/bin" ]]; then
    export PATH="$pnpm_home/bin:$PATH"
  elif [[ -d "$pnpm_home" ]]; then
    export PATH="$pnpm_home:$PATH"
  fi
  if command -v pnpm >/dev/null 2>&1; then
    PNPM_CMD=(pnpm)
    return
  fi
  if command -v corepack >/dev/null 2>&1; then
    corepack enable >/dev/null 2>&1 || true
    if command -v pnpm >/dev/null 2>&1; then
      PNPM_CMD=(pnpm)
      return
    fi
    PNPM_CMD=(corepack pnpm)
    return
  fi
  echo "pnpm not found. Install Node.js >=22 with corepack or pnpm." >&2
  exit 1
}

wait_for_service_healthy() {
  local service="$1"
  local attempts=30
  local i=0
  while (( i < attempts )); do
    local cid status
    cid="$(docker compose -f "$ROOT_DIR/compose.yaml" ps -q "$service" || true)"
    if [[ -n "$cid" ]]; then
      status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || echo "unknown")"
      if [[ "$status" == "healthy" || "$status" == "running" ]]; then
        echo "  $service: $status"
        return 0
      fi
    fi
    i=$((i + 1))
    sleep 2
  done
  echo "Timed out waiting for $service to become healthy." >&2
  exit 1
}

stop_proc() {
  local name="$1"
  local pid_file="$PID_DIR/${name}.pid"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      for _ in 1 2 3 4 5; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 1
      done
      kill -9 "$pid" 2>/dev/null || true
      echo "Stopped $name (PID $pid)"
    fi
    rm -f "$pid_file"
  fi
}

start_proc() {
  local name="$1"
  local entrypoint="$2"
  stop_proc "$name"
  local log_file="$LOG_DIR/${name}.log"
  nohup node "$entrypoint" > "$log_file" 2>&1 < /dev/null &
  local pid=$!
  echo "$pid" > "$PID_DIR/${name}.pid"
  echo "Started $name (PID $pid, log: $log_file)"
}

wait_for_api_health() {
  local url="http://127.0.0.1:${PORT}/v1/health"
  for _ in $(seq 1 20); do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS "$url" >/dev/null 2>&1; then
        echo "API healthy at $url"
        return 0
      fi
    elif node -e "fetch('$url').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" 2>/dev/null; then
      echo "API healthy at $url"
      return 0
    fi
    sleep 1
  done
  echo "API failed to respond at $url. Tail of $LOG_DIR/api.log:" >&2
  tail -n 30 "$LOG_DIR/api.log" >&2 || true
  exit 1
}

cmd_infra() {
  load_env
  echo "Starting Postgres + SeaweedFS containers only (no image builds)..."
  docker compose -f "$ROOT_DIR/compose.yaml" up -d postgres seaweedfs
  wait_for_service_healthy postgres
  wait_for_service_healthy seaweedfs
}

cmd_up() {
  local force_install=0
  if [[ "${1:-}" == "--install" ]]; then
    force_install=1
  fi

  cmd_infra
  resolve_pnpm

  if [[ ! -d "$BACKEND_DIR/node_modules" || "$force_install" -eq 1 ]]; then
    echo "Installing backend dependencies..."
    "${PNPM_CMD[@]}" --dir "$BACKEND_DIR" install --frozen-lockfile
  fi

  echo "Building backend packages..."
  "${PNPM_CMD[@]}" --dir "$BACKEND_DIR" build

  echo "Running Postgres migrations & seed..."
  "${PNPM_CMD[@]}" --dir "$BACKEND_DIR" --filter @mockza/db migrate:prod

  echo "Initializing SeaweedFS buckets & seed media..."
  "${PNPM_CMD[@]}" --dir "$BACKEND_DIR" --filter @mockza/storage init-buckets

  start_proc api "$BACKEND_DIR/apps/api/dist/server.js"
  start_proc worker "$BACKEND_DIR/apps/worker/dist/index.js"
  wait_for_api_health

  echo ""
  echo "Mockza Option-2 local stack is UP:"
  echo "  API:       http://127.0.0.1:${PORT}/v1/health"
  echo "  SeaweedFS: http://127.0.0.1:${MOCKZA_S3_PORT}"
  echo "  Postgres:  127.0.0.1:${MOCKZA_PG_PORT}"
  echo "  Run Web:   ./scripts/dev_local.sh web"
  echo "  Stop All:  ./scripts/dev_local.sh down"
}

resolve_flutter() {
  if command -v flutter >/dev/null 2>&1; then
    FLUTTER_BIN="$(command -v flutter)"
    return
  fi
  for candidate in \
    "${FLUTTER_ROOT:-}/bin/flutter" \
    "$HOME/development/flutter/bin/flutter" \
    "$HOME/flutter/bin/flutter" \
    "/opt/flutter/bin/flutter"; do
    if [[ -n "$candidate" && -x "$candidate" ]]; then
      export PATH="$(dirname "$candidate"):$PATH"
      FLUTTER_BIN="$candidate"
      return
    fi
  done
  echo "flutter not found. Set FLUTTER_ROOT or add flutter/bin to PATH." >&2
  exit 1
}

cmd_web() {
  load_env
  resolve_flutter
  cd "$APP_DIR"
  if [[ ! -d "$APP_DIR/.dart_tool" ]]; then
    "$FLUTTER_BIN" pub get
  fi
  local device="${MOCKZA_WEB_DEVICE:-}"
  if [[ -z "$device" ]]; then
    if [[ -n "${DISPLAY:-}" ]]; then
      device="chrome"
    else
      device="web-server"
    fi
  fi
  local web_host="${MOCKZA_WEB_HOST:-127.0.0.1}"
  local public_host="${MOCKZA_PUBLIC_HOST:-127.0.0.1}"
  local api_url="${MOCKZA_API_BASE_URL:-http://${public_host}:${PORT}}"
  exec "$FLUTTER_BIN" run -d "$device" \
    --web-hostname "$web_host" \
    --web-port "$MOCKZA_WEB_PORT" \
    --dart-define="MOCKZA_API_BASE_URL=${api_url}"
}

cmd_serve() {
  load_env
  trap 'kill 0 2>/dev/null || true' EXIT INT TERM
  node "$BACKEND_DIR/apps/api/dist/server.js" > "$LOG_DIR/api.log" 2>&1 &
  echo $! > "$PID_DIR/api.pid"
  node "$BACKEND_DIR/apps/worker/dist/index.js" > "$LOG_DIR/worker.log" 2>&1 &
  echo $! > "$PID_DIR/worker.pid"
  wait_for_api_health
  wait
}

cmd_down() {
  stop_proc api
  stop_proc worker
  if [[ "${1:-}" == "--clean" ]]; then
    docker compose -f "$ROOT_DIR/compose.yaml" down
  else
    docker compose -f "$ROOT_DIR/compose.yaml" stop postgres seaweedfs
  fi
}

cmd_status() {
  load_env
  docker compose -f "$ROOT_DIR/compose.yaml" ps postgres seaweedfs
  for name in api worker; do
    local pid_file="$PID_DIR/${name}.pid"
    if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "$name: running (PID $(cat "$pid_file"))"
    else
      echo "$name: stopped"
    fi
  done
  if command -v curl >/dev/null 2>&1; then
    curl -sS "http://127.0.0.1:${PORT}/v1/health" && echo "" || echo "API health check failed"
  fi
}

cmd_logs() {
  tail -n 60 -f "$LOG_DIR/api.log" "$LOG_DIR/worker.log"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [options]

Option 2 (Lightweight <5 GB): runs ONLY postgres + seaweedfs in Docker,
and runs backend (api + worker) + Flutter directly on the host.

Commands:
  infra            Start only postgres and seaweedfs containers
  up [--install]   Start infra, migrate DB, init S3, and launch api + worker
  web              Run Flutter Web in Chrome against the local API
  down [--clean]   Stop local api/worker and stop (or remove with --clean) containers
  status           Show container, process, and API health status
  logs             Tail local api and worker logs
EOF
}

case "${1:-up}" in
  infra)  cmd_infra ;;
  up)     shift || true; cmd_up "${1:-}" ;;
  serve)  cmd_serve ;;
  web)    cmd_web ;;
  down)   shift || true; cmd_down "${1:-}" ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  -h|--help|help) usage ;;
  *) echo "Unknown command: $1" >&2; usage; exit 1 ;;
esac
