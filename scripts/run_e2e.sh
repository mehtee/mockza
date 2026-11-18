#!/usr/bin/env bash
set -euo pipefail

export PATH="/home/mahdi/.gemini/antigravity-cli/bin:/home/mahdi/.local/share/pnpm/bin:/home/mahdi/development/flutter/bin:$PATH"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== 1/4 Static Policy & Architecture Gates ==="
bash "$ROOT_DIR/scripts/check_all.sh" all

echo "=== 2/4 Backend Full-Journey E2E ==="
pnpm --dir "$ROOT_DIR/backend" --filter @mockza/api exec vitest run src/__tests__/e2e_full_journey.test.ts

echo "=== 3/4 Playwright Desktop Web E2E (GLB + Sanjia IRN + SEO/GEO) ==="
pnpm --dir "$ROOT_DIR" --filter @mockza/web test:e2e

echo "=== 4/4 Flutter Full-Router E2E Suite (low-RAM concurrency=1) ==="
(cd "$ROOT_DIR/app" && flutter test --no-pub --concurrency=1 test/e2e)

echo "ALL E2E SUITES PASSED."
