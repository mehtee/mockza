import { evaluationJobs, type MockzaDb } from '@mockza/db';
import { and, eq, notInArray } from 'drizzle-orm';

export const JOB_LEASE_DURATION_MS = 180_000;

/** Keeps a live execution fenced while audio preparation or model I/O is pending. */
export function startEvaluationLeaseRenewal(params: {
  db: MockzaDb;
  jobId: string;
  generation: number;
  claimToken: string;
}): () => void {
  let renewing = false;
  const timer = setInterval(() => {
    if (renewing) return;
    renewing = true;
    void params.db
      .update(evaluationJobs)
      .set({
        claimExpiresAt: new Date(Date.now() + JOB_LEASE_DURATION_MS),
      })
      .where(
        and(
          eq(evaluationJobs.jobId, params.jobId),
          eq(evaluationJobs.executionGeneration, params.generation),
          eq(evaluationJobs.claimToken, params.claimToken),
          notInArray(evaluationJobs.status, ['completed', 'failed']),
        ),
      )
      .returning({ jobId: evaluationJobs.jobId })
      .then((rows) => {
        if (rows.length === 0) clearInterval(timer);
      })
      .catch(() => {
        // Transient DB outages may recover before expiry; final writes remain claim-fenced.
        process.stderr.write(`Unable to renew evaluation lease for job ${params.jobId}.\n`);
      })
      .finally(() => {
        renewing = false;
      });
  }, JOB_LEASE_DURATION_MS / 3).unref();
  return () => clearInterval(timer);
}
