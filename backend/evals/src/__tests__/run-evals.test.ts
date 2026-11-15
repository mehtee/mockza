import { describe, expect, it } from 'vitest';
import { runRubricEvals } from '../run-evals.js';

describe('@mockza/evals golden rubric benchmark', () => {
  it('achieves >= 80% band alignment within ±0.5 band on 40+ golden samples', async () => {
    const report = await runRubricEvals();
    expect(report.totalSamples).toBeGreaterThanOrEqual(40);
    expect(report.accuracyPercentage).toBeGreaterThanOrEqual(80);
    expect(report.meanAbsoluteError).toBeLessThanOrEqual(0.5);
    expect(report.withinHalfBandCount).toBeGreaterThanOrEqual(
      Math.floor(report.totalSamples * 0.8),
    );
  });
});
