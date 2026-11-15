import { describe, expect, it } from 'vitest';
import { handleExplainQuestionJob } from '../jobs/explain-question.js';
import { handleGradeSpeakingJob, SPEAKING_JOB_QUEUE } from '../jobs/grade-speaking.js';
import { handleGradeWritingJob, WRITING_JOB_QUEUE } from '../jobs/grade-writing.js';

describe('@mockza/worker job execution handlers', () => {
  it('exposes standard pg-boss queue names', () => {
    expect(WRITING_JOB_QUEUE).toBe('evaluation.writing');
    expect(SPEAKING_JOB_QUEUE).toBe('evaluation.speaking');
  });

  it('processes writing grading job and returns complete evaluation output', async () => {
    const result = await handleGradeWritingJob({
      jobId: '123e4567-e89b-12d3-a456-426614174099',
      attemptId: '123e4567-e89b-12d3-a456-426614174098',
      packId: 'writing-pack-01',
      examId: 'ielts_academic',
      taskType: 'task2Essay',
      promptTitle: 'Urban Planning',
      promptBody: 'Discuss both views on green spaces.',
      essayText:
        'In recent years, the allocation of urban land to public parks has generated considerable debate. Proponents argue green spaces foster health, whereas opponents prioritize commercial construction.',
    });

    expect(result.overallBand).toBeDefined();
    expect(result.criteria).toHaveLength(4);
    expect(result.modelId).toBe('deepseek/deepseek-v4.1-flash-1017');
    expect(result.rubricVersion).toBe('ielts-v2026-01');
  });

  it('processes speaking grading job and returns criteria and annotations', async () => {
    const result = await handleGradeSpeakingJob({
      jobId: '123e4567-e89b-12d3-a456-426614174097',
      attemptId: '123e4567-e89b-12d3-a456-426614174096',
      packId: 'speaking-pack-01',
      examId: 'ielts_academic',
      partSequence: 'part1',
      turns: [
        {
          partIndex: 1,
          promptText: 'Where are you from?',
          objectKey: 'users/dev-1/clips/att-1/part-1.m4a',
        },
      ],
    });

    expect(result.overallBand).toBeDefined();
    expect(result.criteria).toHaveLength(4);
    expect(result.criteria.map((c) => c.code)).toEqual(['FC', 'LR', 'GRA', 'PR']);
    expect(result.modelId).toBe('google/gemini-3.1-flash-lite');
  });

  it('processes explain-question job', async () => {
    const result = await handleExplainQuestionJob({
      packId: 'p-1',
      packVersion: '1.0.0',
      questionId: 'q-1',
      skill: 'reading',
      questionType: 'TFNG',
      userAnswer: 'FALSE',
      correctAnswer: 'TRUE',
    });

    expect(result.explanation).toBeDefined();
    expect(result.whyWrongOptions).toBeDefined();
  });
});
