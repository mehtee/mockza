import {
  type ExplainInvokeOptions,
  type ExplainQuestionInput,
  explainQuestionGraph,
} from '@mockza/ai';
import { aiQuestionExplanations, type MockzaDb } from '@mockza/db';

export const EXPLAIN_JOB_QUEUE = 'explain.question';

export async function handleExplainQuestionJob(
  payload: ExplainQuestionInput,
  db?: MockzaDb,
  invokeOptions?: ExplainInvokeOptions,
) {
  const result = await explainQuestionGraph.invoke(payload, invokeOptions);

  if (db && payload.questionId && payload.packVersion) {
    await db
      .insert(aiQuestionExplanations)
      .values({
        questionId: payload.questionId,
        packVersion: payload.packVersion,
        skill: payload.skill,
        explanationJson: result,
      })
      .onConflictDoNothing();
  }

  return result;
}
