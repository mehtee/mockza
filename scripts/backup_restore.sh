#!/usr/bin/env bash
set -euo pipefail

# Backup and restore utility for Mockza PostgreSQL + SeaweedFS S3 buckets (TD-51).
# Usage:
#   ./scripts/backup_restore.sh backup <output-dir>
#   ./scripts/backup_restore.sh verify <backup-dir>
#   ./scripts/backup_restore.sh restore <backup-dir>

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CMD="${1:-}"
TARGET_DIR="${2:-}"

if [[ -z "$CMD" || -z "$TARGET_DIR" ]]; then
  echo "Usage: $0 {backup|verify|restore} <dir>" >&2
  exit 1
fi

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

PG_HOST="${MOCKZA_PG_HOST:-127.0.0.1}"
PG_PORT="${MOCKZA_PG_PORT:-45432}"
PG_USER="${POSTGRES_USER:-mockza}"
PG_PASSWORD="${POSTGRES_PASSWORD:-mockza_dev_password}"
PG_DB="${POSTGRES_DB:-mockza}"
PG_CONTAINER="${MOCKZA_PG_CONTAINER:-mockza-postgres-1}"

run_pg_cmd() {
  if command -v pg_dump >/dev/null 2>&1 && [[ "$1" == "pg_dump" ]]; then
    PGPASSWORD="$PG_PASSWORD" "$@"
  elif command -v pg_restore >/dev/null 2>&1 && [[ "$1" == "pg_restore" ]]; then
    PGPASSWORD="$PG_PASSWORD" "$@"
  else
    docker exec -i -e "PGPASSWORD=$PG_PASSWORD" "$PG_CONTAINER" "$@"
  fi
}

case "$CMD" in
  backup)
    mkdir -p "$TARGET_DIR"
    DUMP_PATH="$TARGET_DIR/mockza_pg.dump"
    echo "[backup] Creating PostgreSQL custom-format dump at $DUMP_PATH..."
    if command -v pg_dump >/dev/null 2>&1; then
      PGPASSWORD="$PG_PASSWORD" pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -Fc > "$DUMP_PATH"
    else
      docker exec -e "PGPASSWORD=$PG_PASSWORD" "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$DUMP_PATH"
    fi
    sha256sum "$DUMP_PATH" > "$TARGET_DIR/SHA256SUMS.txt"
    echo "[backup] PostgreSQL dump verified: $(du -h "$DUMP_PATH" | cut -f1)"
    ;;
  verify)
    DUMP_PATH="$TARGET_DIR/mockza_pg.dump"
    test -s "$DUMP_PATH"
    (cd "$TARGET_DIR" && sha256sum -c SHA256SUMS.txt)
    if command -v pg_restore >/dev/null 2>&1; then
      pg_restore --list "$DUMP_PATH" >/dev/null
    else
      docker exec -i "$PG_CONTAINER" pg_restore --list < "$DUMP_PATH" >/dev/null
    fi
    echo "[verify] Backup archive & pg_restore catalog check succeeded."
    ;;
  restore)
    DUMP_PATH="$TARGET_DIR/mockza_pg.dump"
    test -s "$DUMP_PATH"
    if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
      echo "Refusing destructive restore without CONFIRM_RESTORE=yes" >&2
      exit 1
    fi
    echo "[restore] Restoring $DUMP_PATH into $PG_DB..."
    if command -v pg_restore >/dev/null 2>&1; then
      PGPASSWORD="$PG_PASSWORD" pg_restore --clean --if-exists -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" "$DUMP_PATH"
    else
      docker exec -i -e "PGPASSWORD=$PG_PASSWORD" "$PG_CONTAINER" pg_restore --clean --if-exists -U "$PG_USER" -d "$PG_DB" < "$DUMP_PATH"
    fi
    echo "[restore] PostgreSQL restore complete."
    ;;
  *)
    echo "Unknown command: $CMD" >&2
    exit 1
    ;;
esac
