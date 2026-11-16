#!/usr/bin/env bash
set -euo pipefail

WEB_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/app/build/web}"
MAIN_JS="$WEB_DIR/main.dart.js"
BOOTSTRAP_JS="$WEB_DIR/flutter_bootstrap.js"
INDEX_HTML="$WEB_DIR/index.html"

if [[ ! -f "$MAIN_JS" || ! -f "$BOOTSTRAP_JS" || ! -f "$INDEX_HTML" ]]; then
  echo "Missing built web assets in $WEB_DIR" >&2
  exit 1
fi

BUILD_HASH="$(sha256sum "$MAIN_JS" | cut -c1-12)"

# Stamp both main.dart.js and flutter_bootstrap.js with content-hash query strings
# so CDNs/proxies (e.g. Cloudflare 4h JS cache) never pair stale bootstrap or app bundles (`RR-16`).
sed -i -E "s|main\.dart\.js(\?v=[a-f0-9]+)?|main.dart.js?v=${BUILD_HASH}|g" "$BOOTSTRAP_JS"
BOOTSTRAP_HASH="$(sha256sum "$BOOTSTRAP_JS" | cut -c1-12)"
sed -i -E "s|flutter_bootstrap\.js(\?v=[a-f0-9]+)?|flutter_bootstrap.js?v=${BOOTSTRAP_HASH}|g" "$INDEX_HTML"

echo "Stamped web bundle cache-busters: main=${BUILD_HASH}, bootstrap=${BOOTSTRAP_HASH}"
