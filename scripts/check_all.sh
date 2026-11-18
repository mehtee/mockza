#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_LIB="$ROOT_DIR/app/lib"
WEB_DIR="$ROOT_DIR/web"
MODE="${1:-all}"

ERRORS=0

fail() {
  echo "FAIL: $1" >&2
  ERRORS=$((ERRORS + 1))
}

strip_comments() {
  sed -E 's://.*$::' "$1"
}

check_app_gates() {
  if [[ ! -d "$APP_LIB" ]]; then
    fail "Missing $APP_LIB"
    return
  fi

  # 1. No junk utility directories (utils, helpers, common, misc)
  local junk_dirs
  junk_dirs=$(find "$APP_LIB" -type d \( -name utils -o -name helpers -o -name common -o -name misc \) || true)
  if [[ -n "$junk_dirs" ]]; then
    fail "Banned catch-all directories found:\n$junk_dirs"
  fi

  # 2. No sibling-named barrel files next to directories
  while IFS= read -r -d '' d; do
    local b="${d}.dart"
    if [[ -f "$b" ]]; then
      fail "Sibling barrel file $b next to directory $d"
    fi
  done < <(find "$APP_LIB" -mindepth 1 -type d -print0)

  # 3. Package imports only inside hand-authored app/lib
  while IFS= read -r -d '' f; do
    if strip_comments "$f" | grep -Eq "^\s*import\s+['\"][^:]*\.dart['\"]"; then
      fail "Relative import forbidden in $f"
    fi
  done < <(find "$APP_LIB" -name '*.dart' -type f ! -name '*.g.dart' ! -name '*.drift.dart' ! -path "$APP_LIB/l10n/*" -print0)

  # 4. Pure Dart core/ (no Flutter/IO/UI/DateTime.now)
  if [[ -d "$APP_LIB/core" ]]; then
    while IFS= read -r -d '' f; do
      if strip_comments "$f" | grep -Eq "package:flutter/|dart:io|dart:ui|DateTime\.now\("; then
        fail "Forbidden Flutter/IO/UI/DateTime.now reference in core file $f"
      fi
    done < <(find "$APP_LIB/core" -name '*.dart' -type f -print0)
  fi

  # 5. Drift confined to lib/data/ and sqflite banned everywhere
  while IFS= read -r -d '' f; do
    if [[ "$f" != "$APP_LIB/data/"* ]]; then
      if strip_comments "$f" | grep -Eq "package:drift/|package:sqlite3/|Companion\b"; then
        fail "Drift/sqlite3/Companion leaked outside lib/data/: $f"
      fi
    fi
    if strip_comments "$f" | grep -Eq "package:sqflite/"; then
      fail "Banned package:sqflite in $f"
    fi
  done < <(find "$APP_LIB" -name '*.dart' -type f ! -name '*.g.dart' ! -name '*.drift.dart' -print0)

  # 6. Ban legacy state management & banned DI
  while IFS= read -r -d '' f; do
    if strip_comments "$f" | grep -Eq "package:flutter_riverpod/legacy\.dart|package:get_it/|package:provider/|package:flutter_bloc/|StateProvider\(|StateNotifierProvider\(|ChangeNotifierProvider\("; then
      fail "Legacy/banned provider or DI construct in $f"
    fi
  done < <(find "$APP_LIB" -name '*.dart' -type f ! -name '*.g.dart' ! -name '*.drift.dart' -print0)

  # 7. Ban raw visual literals outside lib/theme/
  while IFS= read -r -d '' f; do
    if [[ "$f" == "$APP_LIB/theme/"* ]] || [[ "$f" == "$APP_LIB/l10n/"* ]] || [[ "$f" == "$APP_LIB/services/"* ]] || [[ "$f" == *"/presentation/"*_notifier.dart ]] || [[ "$f" == "$APP_LIB/data/"* ]]; then
      continue
    fi
    if strip_comments "$f" | sed -E 's/Colors\.transparent//g; s/Duration\.zero//g' | grep -Eq "Color\(0x|Color\.from|(^[[:space:]]*|[^A-Za-z0-9_])Colors\.|(^[[:space:]]*|[^A-Za-z0-9_])Curves\.|BorderRadius\.circular\(|Radius\.circular\(|fontSize:|Duration\((milliseconds|seconds):"; then
      fail "Raw visual literal outside lib/theme/ in $f"
    fi
  done < <(find "$APP_LIB" -name '*.dart' -type f ! -name '*.g.dart' ! -name '*.drift.dart' -print0)

  # 8. Ban DateTime.now() outside clock wrappers & Random() outside entropy wrappers
  while IFS= read -r -d '' f; do
    if strip_comments "$f" | grep -Eq "DateTime\.now\("; then
      fail "Direct DateTime.now() forbidden (inject Clock via clockProvider): $f"
    fi
    if strip_comments "$f" | grep -Eq "PlatformDispatcher\.instance|MethodChannel\(|EventChannel\(|BasicMessageChannel\("; then
      if [[ "$f" != "$APP_LIB/services/native/"* && "$f" != "$APP_LIB/bootstrap.dart" ]]; then
        fail "Platform channel or PlatformDispatcher outside services/native or bootstrap: $f"
      fi
    fi
  done < <(find "$APP_LIB" -name '*.dart' -type f ! -name '*.g.dart' ! -name '*.drift.dart' -print0)

  # 9. Feature isolation & bidirectional safety
  if [[ -d "$APP_LIB/features" ]]; then
    for feat_dir in "$APP_LIB/features"/*/; do
      local feat
      feat="$(basename "$feat_dir")"
      while IFS= read -r -d '' f; do
        if strip_comments "$f" | grep -Eq "package:mockza/features/(?!$feat/)" 2>/dev/null; then
          fail "Cross-feature import detected in $f"
        fi
        # Portable check without PCRE negative lookahead
        local other_feat
        other_feat=$(strip_comments "$f" | grep -Eo "package:mockza/features/[a-zA-Z0-9_]+" | grep -v "package:mockza/features/$feat$" || true)
        if [[ -n "$other_feat" ]]; then
          fail "Cross-feature import ($other_feat) in $f"
        fi
        if strip_comments "$f" | grep -Eq "EdgeInsets\.only\([^)]*(left:|right:)|Alignment\.[a-zA-Z]*(Left|Right)|TextAlign\.(left|right)"; then
          fail "Physical LTR-only alignment/padding in $f (use EdgeInsetsDirectional/AlignmentDirectional)"
        fi
      done < <(find "$feat_dir" -name '*.dart' -type f -print0)
    done
  fi

  # 10. Exactly one GoRouter definition inside lib/routing/
  local router_count
  router_count=$(grep -rn "GoRouter(" "$APP_LIB" --include='*.dart' | wc -l | tr -d ' ')
  if [[ "$router_count" -ne 1 ]]; then
    fail "Expected exact 1 GoRouter( inside app/lib/routing/, found $router_count"
  fi
  local router_outside
  router_outside=$(grep -rn "GoRouter(" "$APP_LIB" --include='*.dart' | grep -v "$APP_LIB/routing/" || true)
  if [[ -n "$router_outside" ]]; then
    fail "GoRouter( defined outside lib/routing/: $router_outside"
  fi

  echo "App static gates checked."
}

check_backend_gates() {
  if [[ ! -d "$ROOT_DIR/backend" ]]; then
    fail "Missing $ROOT_DIR/backend"
    return
  fi
  # Ensure zero leaked secrets / real env files
  if find "$ROOT_DIR/backend" -maxdepth 3 \( -name '.env' -o -name '.env.local' \) | grep -q .; then
    fail "Real .env file committed in backend/"
  fi
  echo "Backend static gates checked."
}

check_token_sync_gate() {
  if [[ ! -f "$ROOT_DIR/scripts/sync_design_tokens.mjs" ]]; then
    fail "Missing $ROOT_DIR/scripts/sync_design_tokens.mjs"
    return
  fi
  if ! node "$ROOT_DIR/scripts/sync_design_tokens.mjs" --check; then
    fail "Design tokens out of sync (run: pnpm tokens:sync)"
  fi
  echo "Design token sync gate checked."
}

check_cross_parity_gate() {
  if [[ ! -f "$ROOT_DIR/scripts/check_cross_parity.sh" ]]; then
    fail "Missing $ROOT_DIR/scripts/check_cross_parity.sh"
    return
  fi
  if ! bash "$ROOT_DIR/scripts/check_cross_parity.sh"; then
    fail "Cross-codebase parity gates failed"
  fi
  echo "Cross-codebase parity gate checked."
}

require_min_ram_mb() {
  local min_mb="${1:-500}"
  local hard_floor_mb=450
  local max_retries=5
  local attempt=0
  if command -v free >/dev/null 2>&1; then
    while true; do
      local avail_mb
      avail_mb=$(free -m | awk '/^Mem:/ {print $7}')
      if [[ -z "$avail_mb" || "$avail_mb" -ge "$min_mb" ]]; then
        return 0
      fi
      if [[ "$avail_mb" -ge "$hard_floor_mb" && "$attempt" -lt "$max_retries" ]]; then
        attempt=$((attempt + 1))
        echo "INFO: Available RAM ${avail_mb} MiB < ${min_mb} MiB; waiting 3s to settle (${attempt}/${max_retries})..." >&2
        sleep 3
        continue
      fi
      if [[ "$avail_mb" -ge "$hard_floor_mb" ]]; then
        echo "WARN: Available RAM ${avail_mb} MiB (< ${min_mb} MiB target, >= ${hard_floor_mb} MiB floor); proceeding cautiously." >&2
        return 0
      fi
      fail "Insufficient available RAM (${avail_mb} MiB < ${hard_floor_mb} MiB floor required for sequential web build/test gates)."
      return 1
    done
  fi
  return 0
}

check_web_gates() {
  if [[ ! -d "$WEB_DIR/src" ]]; then
    fail "Missing $WEB_DIR/src"
    return
  fi

  export NODE_OPTIONS="--max-old-space-size=320"

  # 0. Low-RAM preflight check
  require_min_ram_mb 500 || return

  # 1. TypeScript strict check (640 MiB heap for growing web surface)
  if ! (cd "$ROOT_DIR" && NODE_OPTIONS="--max-old-space-size=640" pnpm --filter @mockza/web typecheck); then
    fail "Web TypeScript typecheck failed"
  fi

  # 2. ESLint 9 boundary & code quality check
  if ! (cd "$ROOT_DIR" && pnpm --filter @mockza/web lint); then
    fail "Web ESLint boundary check failed"
  fi

  # 3. Static grep verifying 0 forbidden imports in web/src/spa/features, web/src/spa/routes & web/src/components
  for target_dir in "$WEB_DIR/src/spa/features" "$WEB_DIR/src/spa/routes" "$WEB_DIR/src/components"; do
    if [[ -d "$target_dir" ]]; then
      while IFS= read -r -d '' f; do
        if strip_comments "$f" | grep -Eq "(from|import)\s+['\"](@/)?(adapters(/|['\"])|composition(/|['\"])|dexie(/|['\"])|@mockza/db(/|['\"])|@mockza/ai(/|['\"]))|import\s*\(\s*['\"](@/)?(adapters(/|['\"])|composition(/|['\"])|dexie(/|['\"])|@mockza/db(/|['\"])|@mockza/ai(/|['\"]))|['\"](\.\./)+(adapters|composition)(/|['\"])"; then
          fail "Forbidden adapter/composition/dexie/db/ai import in $f"
        fi
      done < <(find "$target_dir" \( -name '*.ts' -o -name '*.tsx' \) -type f -print0)
    fi
  done

  # 4. Static grep verifying 0 physical LTR CSS classes outside LtrExamBoundary
  for target_dir in "$WEB_DIR/src/spa" "$WEB_DIR/src/components"; do
    if [[ -d "$target_dir" ]]; then
      while IFS= read -r -d '' f; do
        if [[ "$(basename "$f")" == "LtrExamBoundary.tsx" ]]; then
          continue
        fi
        if strip_comments "$f" | sed -E "s/(data|aria)-[a-zA-Z0-9_-]+=['\"][^'\"]*['\"]//g" | grep -Eq "(^|[[:space:]'\"\`:\[])(-?(ml|mr|pl|pr)-(0|px|auto|[0-9][^[:space:]'\"\`]*|\[[^[:space:]'\"\`]+\])|-?(left|right)-(0|px|auto|full|[0-9][^[:space:]'\"\`]*|\[[^[:space:]'\"\`]+\])|(border-l|border-r|rounded-l|rounded-r|rounded-(tl|tr|bl|br))(-[^[:space:]'\"\`]+)?|(text|float|clear|origin)-(left|right))([[:space:]'\"\`]|$)"; then
          fail "Physical LTR-only CSS class found outside LtrExamBoundary in $f"
        fi
      done < <(find "$target_dir" \( -name '*.ts' -o -name '*.tsx' \) -type f -print0)
    fi
  done

  # 5. Design token SSOT sync check
  check_token_sync_gate

  # 6. Vitest unit + contract tests (single fork worker, sequential)
  require_min_ram_mb 500 || return
  if ! (cd "$ROOT_DIR" && pnpm --filter @mockza/web exec vitest run --pool=forks --poolOptions.forks.singleFork --maxWorkers=1); then
    fail "Web Vitest unit/contract tests failed"
  fi

  # 7. Dual GLB & IRN Astro static builds + bundle isolation greps (strictly sequential)
  require_min_ram_mb 500 || return
  rm -rf "$WEB_DIR/dist-glb"
  if ! (cd "$ROOT_DIR" && (PUBLIC_EDITION=glb NODE_OPTIONS="--max-old-space-size=320" pnpm --filter @mockza/web build:glb || (echo "Retrying GLB build with 384 MiB heap..." >&2 && rm -rf "$WEB_DIR/dist-glb" && PUBLIC_EDITION=glb NODE_OPTIONS="--max-old-space-size=384" pnpm --filter @mockza/web build:glb))); then
    fail "Web GLB Astro build failed"
  elif grep -rnEIi "sanjia|navia|zarinpal|zibal|kavenegar|jalaali|تومان|formatTomanFromRial" "$WEB_DIR/dist-glb/"; then
    fail "GLB bundle isolation breach: IRN-only identifier/domain found in web/dist-glb/"
  fi

  require_min_ram_mb 500 || return
  rm -rf "$WEB_DIR/dist-irn"
  if ! (cd "$ROOT_DIR" && (PUBLIC_EDITION=irn NODE_OPTIONS="--max-old-space-size=320" pnpm --filter @mockza/web build:irn || (echo "Retrying IRN build with 384 MiB heap..." >&2 && rm -rf "$WEB_DIR/dist-irn" && PUBLIC_EDITION=irn NODE_OPTIONS="--max-old-space-size=384" pnpm --filter @mockza/web build:irn))); then
    fail "Web IRN Astro build failed"
  elif grep -rnEI "stripe|revenuecat|accounts\.google\.com|appleid\.apple\.com|googletagmanager|firebase" "$WEB_DIR/dist-irn/"; then
    fail "IRN bundle isolation breach: GLB-only tracker/billing identifier found in web/dist-irn/"
  fi

  # 8. Pre-compress .br/.gz static assets & verify SEO/zero-JS/header/burst budget
  if [[ -f "$ROOT_DIR/scripts/check_web_budget.mjs" ]]; then
    require_min_ram_mb 500 || return
    if ! (cd "$ROOT_DIR" && node "$ROOT_DIR/scripts/check_web_budget.mjs"); then
      fail "Web static asset budget / compression check failed"
    fi
  fi

  echo "Web static, test & dual-edition bundle isolation gates checked."
}

case "$MODE" in
  --app-only)
    check_token_sync_gate
    check_app_gates
    ;;
  --backend-only)
    check_backend_gates
    ;;
  --web-only)
    check_web_gates
    ;;
  --parity-only)
    check_cross_parity_gate
    ;;
  all)
    check_token_sync_gate
    check_app_gates
    check_backend_gates
    check_web_gates
    check_cross_parity_gate
    ;;
  *)
    echo "Usage: $0 [all|--app-only|--backend-only|--web-only|--parity-only]" >&2
    exit 2
    ;;
esac

if [[ "$ERRORS" -gt 0 ]]; then
  echo "Gate script finished with $ERRORS failure(s)." >&2
  exit 1
fi
echo "ALL STATIC GATES PASSED."
