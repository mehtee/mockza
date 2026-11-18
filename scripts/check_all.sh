#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_LIB="$ROOT_DIR/app/lib"
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

case "$MODE" in
  --app-only)
    check_token_sync_gate
    check_app_gates
    ;;
  --backend-only)
    check_backend_gates
    ;;
  all)
    check_token_sync_gate
    check_app_gates
    check_backend_gates
    ;;
  *)
    echo "Usage: $0 [all|--app-only|--backend-only]" >&2
    exit 2
    ;;
esac

if [[ "$ERRORS" -gt 0 ]]; then
  echo "Gate script finished with $ERRORS failure(s)." >&2
  exit 1
fi
echo "ALL STATIC GATES PASSED."
