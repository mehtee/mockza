#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES_DIR="$ROOT_DIR/shared-fixtures"

echo "=== [1/4] Verifying shared-fixtures/*.json existence and vector count (>= 250) ==="
node -e '
const fs = require("node:fs");
const path = require("node:path");

const dir = process.argv[1];
const files = [
  "exam_specs_vectors.json",
  "band_conversion_vectors.json",
  "objective_scorer_vectors.json",
  "diagnostic_router_vectors.json",
  "sm2_scheduler_vectors.json",
  "study_metrics_vectors.json",
];

for (const f of files) {
  const full = path.join(dir, f);
  if (!fs.existsSync(full)) {
    console.error(`Missing fixture file: ${full}`);
    process.exit(1);
  }
}

const load = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
const exam = load("exam_specs_vectors.json");
const band = load("band_conversion_vectors.json");
const scorer = load("objective_scorer_vectors.json");
const diag = load("diagnostic_router_vectors.json");
const sm2 = load("sm2_scheduler_vectors.json");
const metrics = load("study_metrics_vectors.json");

const counts = {
  exam_specs_vectors:
    exam.roundIeltsBand.length +
    exam.calculateWritingOverallBand.length +
    exam.estimateToeflLegacy120.length +
    exam.examTrackScale.length +
    exam.examDescriptorsAndTasks.descriptors.length +
    exam.examDescriptorsAndTasks.writingTasks.length,
  band_conversion_vectors:
    band.ieltsListening.length +
    band.ieltsReadingAcademic.length +
    band.ieltsReadingGeneralTraining.length +
    band.descriptorScoreObjective.length,
  objective_scorer_vectors:
    scorer.normalize.length +
    scorer.normalizeSequence.length +
    scorer.score.length,
  diagnostic_router_vectors:
    diag.selectNextObjectiveBlock.length +
    diag.classifyBlockOutcome.length +
    1 +
    diag.diagnosticBudget.deadlineCases.length,
  sm2_scheduler_vectors:
    sm2.serialDay.length +
    sm2.schedule.length +
    sm2.previewIntervalsAndFormatDays.previewCases.length +
    sm2.previewIntervalsAndFormatDays.formatDaysCases.length,
  study_metrics_vectors:
    metrics.calculateEstimatedOverallBand.length +
    metrics.calculateSkillMetrics.length +
    metrics.calculateCurrentStreak.length +
    metrics.calculateStudyWeek.length,
};

const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log("Fixture vector counts:", JSON.stringify(counts), "TOTAL:", total);
if (total < 250) {
  console.error(`Expected at least 250 golden vectors, found ${total}`);
  process.exit(1);
}
' "$FIXTURES_DIR"

echo "=== [2/4] Running TypeScript domain parity suite ==="
NODE_OPTIONS="--max-old-space-size=768" pnpm --dir "$ROOT_DIR" --filter @mockza/domain exec vitest run src/__tests__/cross-codebase-parity.test.ts

echo "=== [3/4] Running Flutter analyzer & Dart parity suite ==="
(
  cd "$ROOT_DIR/app"
  flutter analyze --no-pub --fatal-infos test/parity/cross_codebase_parity_test.dart
  flutter test --no-pub --concurrency=1 test/parity/cross_codebase_parity_test.dart
)

echo "=== [4/4] Running OpenAPI export, zero-diff check & contracts tests ==="
NODE_OPTIONS="--max-old-space-size=768" pnpm --dir "$ROOT_DIR" --filter @mockza/contracts export:openapi
diff -u "$ROOT_DIR/backend/packages/contracts/openapi.json" "$ROOT_DIR/backend/packages/contracts/dist/openapi.json"
NODE_OPTIONS="--max-old-space-size=768" pnpm --dir "$ROOT_DIR" --filter @mockza/contracts test

echo "CROSS-CODEBASE PARITY GATES PASSED."
