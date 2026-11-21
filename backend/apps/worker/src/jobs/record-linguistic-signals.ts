import {
  type LinguisticSourceKind,
  updateLinguisticGraphSignals,
  type UpdateLinguisticGraphOptions,
} from '@mockza/ai';
import {
  evaluationJobs,
  type MockzaDb,
  upsertLinguisticGraphSignals,
} from '@mockza/db';
import { eq } from 'drizzle-orm';

/**
 * Non-blocking post-evaluation graph signal hook (`ADR-ADV-003`).
 * Never throws or delays the caller's exam grade when System 1 alpha or DB encounters transient issues.
 */
export async function recordPostEvaluationLinguisticSignals(params: {
  db?: MockzaDb;
  jobId?: string;
  accountKey?: string;
  edition: 'glb' | 'irn';
  sourceKind: LinguisticSourceKind;
  sourceRefId: string;
  textSample: string;
  dueTargetPhrases?: string[];
  topicHint?: string;
  aiOptions?: UpdateLinguisticGraphOptions;
}): Promise<void> {
  if (!params.db || !params.textSample || params.textSample.trim().length < 8) {
    return;
  }
  try {
    let accountKey = params.accountKey;
    if (!accountKey && params.jobId) {
      const [job] = await params.db
        .select({ accountKey: evaluationJobs.accountKey })
        .from(evaluationJobs)
        .where(eq(evaluationJobs.jobId, params.jobId))
        .limit(1);
      accountKey = job?.accountKey;
    }
    if (!accountKey) return;

    const analysis = await updateLinguisticGraphSignals(
      {
        edition: params.edition,
        sourceKind: params.sourceKind,
        textSample: params.textSample,
        dueTargetPhrases: params.dueTargetPhrases,
        topicHint: params.topicHint,
      },
      {
        alphaClient: params.aiOptions?.alphaClient,
        allowDemoEvaluator:
          params.aiOptions?.allowDemoEvaluator ?? !process.env['OPENROUTER_API_KEY'],
      },
    );

    if (analysis.signals.length > 0) {
      await upsertLinguisticGraphSignals({
        db: params.db,
        accountKey,
        edition: params.edition,
        sourceKind: params.sourceKind,
        sourceRefId: params.sourceRefId,
        signals: analysis.signals,
      });
    }
  } catch {
    // Explicitly swallowed so main exam/shifter/drop pipeline remains fail-safe
  }
}
