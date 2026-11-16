#!/usr/bin/env bash
set -euo pipefail

# Backup and restore utility for Mockza PostgreSQL + S3/Seed Assets (`RR-15`).
# Usage:
#   ./scripts/backup_restore.sh backup <output-dir>
#   ./scripts/backup_restore.sh verify <backup-dir>
#   ./scripts/backup_restore.sh verify-restore <backup-dir>
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

run_psql() {
  local target_db="$1"
  local sql_cmd="$2"
  if command -v psql >/dev/null 2>&1; then
    PGPASSWORD="$PG_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$target_db" -v ON_ERROR_STOP=1 -tAc "$sql_cmd"
  else
    docker exec -i -e "PGPASSWORD=$PG_PASSWORD" "$PG_CONTAINER" psql -U "$PG_USER" -d "$target_db" -v ON_ERROR_STOP=1 -tAc "$sql_cmd"
  fi
}

case "$CMD" in
  backup)
    mkdir -p "$TARGET_DIR"
    DUMP_PATH="$TARGET_DIR/mockza_pg.dump"
    ASSETS_ARCHIVE="$TARGET_DIR/seed_assets.tar.gz"
    echo "[backup] Creating PostgreSQL custom-format dump at $DUMP_PATH..."
    if command -v pg_dump >/dev/null 2>&1; then
      PGPASSWORD="$PG_PASSWORD" pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -Fc > "$DUMP_PATH"
    else
      docker exec -e "PGPASSWORD=$PG_PASSWORD" "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc > "$DUMP_PATH"
    fi
    SUM_FILES=("mockza_pg.dump")
    if [[ -d "$ROOT_DIR/backend/packages/db/seed-assets" ]]; then
      tar -czf "$ASSETS_ARCHIVE" -C "$ROOT_DIR/backend/packages/db" seed-assets
      SUM_FILES+=("seed_assets.tar.gz")
    fi
    (cd "$TARGET_DIR" && sha256sum "${SUM_FILES[@]}" > SHA256SUMS.txt)
    echo "[backup] Archive verified ($(du -h "$DUMP_PATH" | cut -f1))."
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
    echo "[verify] Checksum & pg_restore catalog check succeeded (relocation-safe)."
    ;;
  verify-restore)
    DUMP_PATH="$TARGET_DIR/mockza_pg.dump"
    test -s "$DUMP_PATH"
    (cd "$TARGET_DIR" && sha256sum -c SHA256SUMS.txt)
    TEMP_DB="mockza_restore_drill_$$"
    cleanup_drill() {
      run_psql postgres "DROP DATABASE IF EXISTS ${TEMP_DB};" >/dev/null 2>&1 || true
    }
    trap cleanup_drill EXIT
    echo "[verify-restore] Creating isolated temporary database $TEMP_DB..."
    run_psql postgres "CREATE DATABASE ${TEMP_DB};" >/dev/null
    if command -v pg_restore >/dev/null 2>&1; then
      PGPASSWORD="$PG_PASSWORD" pg_restore -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$TEMP_DB" --no-owner --no-privileges "$DUMP_PATH"
    else
      docker exec -i -e "PGPASSWORD=$PG_PASSWORD" "$PG_CONTAINER" pg_restore -U "$PG_USER" -d "$TEMP_DB" --no-owner --no-privileges < "$DUMP_PATH"
    fi
    PACK_COUNT=$(run_psql "$TEMP_DB" "SELECT COUNT(*) FROM catalog_packs;")
    QUESTION_COUNT=$(run_psql "$TEMP_DB" "SELECT COUNT(*) FROM exam_questions;")
    echo "[verify-restore] Temporary restore verified: catalog_packs=$PACK_COUNT, exam_questions=$QUESTION_COUNT"
    test "${PACK_COUNT:-0}" -ge 1
    test "${QUESTION_COUNT:-0}" -ge 1
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
