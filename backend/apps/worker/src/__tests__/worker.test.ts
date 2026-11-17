import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { handleExplainQuestionJob } from '../jobs/explain-question.js';
import { handleGradeSpeakingJob, SPEAKING_JOB_QUEUE } from '../jobs/grade-speaking.js';
import { handleGradeWritingJob, WRITING_JOB_QUEUE } from '../jobs/grade-writing.js';

function createMockWritingClient() {
  return {
    async createChatCompletion() {
      return {
        id: 'worker-test-w',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify({
                criteria: [
                  {
                    code: 'TR',
                    label: 'Task Response',
                    band: 6.5,
                    evidenceExcerpt: 'Public parks',
                    feedbackNote: 'Clear.',
                  },
                  {
                    code: 'CC',
                    label: 'Coherence and Cohesion',
                    band: 6.5,
                    evidenceExcerpt: 'Proponents',
                    feedbackNote: 'Coherent.',
                  },
                  {
                    code: 'LR',
                    label: 'Lexical Resource',
                    band: 6.5,
                    evidenceExcerpt: 'allocation',
                    feedbackNote: 'Good lexis.',
                  },
                  {
                    code: 'GRA',
                    label: 'Grammatical Range and Accuracy',
                    band: 6.5,
                    evidenceExcerpt: 'whereas',
                    feedbackNote: 'Complex syntax.',
                  },
                ],
              }),
            },
          },
        ],
      };
    },
  };
}

function createMockSpeakingClient() {
  return {
    async createChatCompletion() {
      return {
        id: 'worker-test-s',
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: JSON.stringify({
                criteria: [
                  {
                    code: 'FC',
                    label: 'Fluency and Coherence',
                    band: 7.0,
                    evidenceExcerpt: 'From Shiraz',
                    feedbackNote: 'Steady.',
                  },
                  {
                    code: 'LR',
                    label: 'Lexical Resource',
                    band: 6.5,
                    evidenceExcerpt: 'gardens',
                    feedbackNote: 'Natural.',
                  },
                  {
                    code: 'GRA',
                    label: 'Grammatical Range and Accuracy',
                    band: 6.5,
                    evidenceExcerpt: 'which is',
                    feedbackNote: 'Accurate.',
                  },
                  {
                    code: 'PR',
                    label: 'Pronunciation',
                    band: 7.0,
                    evidenceExcerpt: 'Clear stress',
                    feedbackNote: 'Clear.',
                  },
                ],
                transcriptSegments: [
                  {
                    segmentId: 's-1',
                    partIndex: 1,
                    startMs: 0,
                    endMs: 3000,
                    text: 'I am from a historic city known for its gardens.',
                    annotations: [],
                  },
                ],
              }),
            },
          },
        ],
      };
    },
  };
}

describe('@mockza/worker job execution handlers', () => {
  it('exposes standard pg-boss queue names', () => {
    expect(WRITING_JOB_QUEUE).toBe('evaluation.writing');
    expect(SPEAKING_JOB_QUEUE).toBe('evaluation.speaking');
  });

  it('processes writing grading job and returns complete evaluation output', async () => {
    const result = await handleGradeWritingJob(
      {
        jobId: '123e4567-e89b-12d3-a456-426614174099',
        attemptId: '123e4567-e89b-12d3-a456-426614174098',
        packId: 'writing-pack-01',
        examId: 'ielts_academic',
        taskType: 'task2Essay',
        promptTitle: 'Urban Planning',
        promptBody: 'Discuss both views on green spaces.',
        essayText:
          'In recent years, the allocation of urban land to public parks has generated considerable debate. Proponents argue green spaces foster health, whereas opponents prioritize commercial construction.',
      },
      undefined,
      { client: createMockWritingClient() },
    );

    if (!result) {
      throw new Error('Expected non-null writing evaluation result');
    }
    expect(result.overallBand).toBe(6.5);
    expect(result.criteria).toHaveLength(4);
    expect(result.modelId).toBe('deepseek/deepseek-v4.1-flash-1017');
    expect(result.rubricVersion).toBe('ielts-v2026-01');
  });

  it('processes speaking grading job with verified audio and fails closed when audio is missing', async () => {
    await expect(
      handleGradeSpeakingJob(
        {
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
        },
        undefined,
        undefined,
        undefined,
        { client: createMockSpeakingClient() },
      ),
    ).rejects.toMatchObject({ code: 'audio_missing' });

    const result = await handleGradeSpeakingJob(
      {
        jobId: '123e4567-e89b-12d3-a456-426614174097',
        attemptId: '123e4567-e89b-12d3-a456-426614174096',
        packId: 'speaking-pack-01',
        examId: 'ielts_academic',
        partSequence: 'part1',
        base64AudioData: Buffer.from('valid-audio').toString('base64'),
        turns: [
          {
            partIndex: 1,
            promptText: 'Where are you from?',
            objectKey: 'users/dev-1/clips/att-1/part-1.m4a',
          },
        ],
      },
      undefined,
      undefined,
      undefined,
      { client: createMockSpeakingClient() },
    );

    if (!result) {
      throw new Error('Expected non-null speaking evaluation result');
    }
    expect(result.overallBand).toBe(7.0);
    expect(result.criteria.map((c) => c.code)).toEqual(['FC', 'LR', 'GRA', 'PR']);
    expect(result.modelId).toBe('google/gemini-3.1-flash-lite');
  });

  it('processes explain-question job with verified model response', async () => {
    const result = await handleExplainQuestionJob(
      {
        packId: 'p-1',
        packVersion: '1.0.0',
        questionId: 'q-1',
        skill: 'reading',
        questionType: 'TFNG',
        userAnswer: 'FALSE',
        correctAnswer: 'TRUE',
      },
      undefined,
      {
        client: {
          async createChatCompletion() {
            return {
              id: 'worker-test-e',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      explanation: 'The passage directly confirms this statement.',
                      evidenceQuote: 'Solar array output exceeded demand.',
                      whyWrongOptions: [{ option: 'FALSE', reason: 'Contradicts text.' }],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    );

    expect(result.explanation).toBeDefined();
    expect(result.whyWrongOptions).toBeDefined();
  });

  it('TD-20: fetches and submits ALL speaking turns to the evaluator', async () => {
    let seenAudioParts = 0;
    const dataSize = 16_000;
    const validWav = Buffer.alloc(44 + dataSize);
    validWav.write('RIFF', 0);
    validWav.writeUInt32LE(36 + dataSize, 4);
    validWav.write('WAVE', 8);
    validWav.write('fmt ', 12);
    validWav.writeUInt32LE(16, 16); // PCM chunk size
    validWav.writeUInt16LE(1, 20); // PCM format
    validWav.writeUInt16LE(1, 22); // mono
    validWav.writeUInt32LE(16_000, 24); // sample rate
    validWav.writeUInt32LE(32_000, 28); // byte rate
    validWav.writeUInt16LE(2, 32); // block align
    validWav.writeUInt16LE(16, 34); // bits per sample
    validWav.write('data', 36);
    validWav.writeUInt32LE(dataSize, 40);

    const mockS3 = {
      async send() {
        return { Body: Readable.from([validWav]) };
      },
    } as never;

    const multiClient = {
      async createChatCompletion(req: { messages: Array<{ content: unknown }> }) {
        const content = req.messages[0]?.content;
        if (Array.isArray(content)) {
          seenAudioParts = content.filter(
            (p: { type?: string }) => p.type === 'input_audio',
          ).length;
        }
        return createMockSpeakingClient().createChatCompletion();
      },
    };

    await handleGradeSpeakingJob(
      {
        jobId: '123e4567-e89b-12d3-a456-426614174050',
        attemptId: '123e4567-e89b-12d3-a456-426614174051',
        packId: 'speaking-pack-01',
        examId: 'ielts_academic',
        partSequence: 'full',
        turns: [
          { partIndex: 1, promptText: 'Part 1', objectKey: 'users/d1/clips/a1/part-1.wav' },
          { partIndex: 2, promptText: 'Part 2', objectKey: 'users/d1/clips/a1/part-2.wav' },
          { partIndex: 3, promptText: 'Part 3', objectKey: 'users/d1/clips/a1/part-3.wav' },
        ],
      },
      undefined,
      mockS3,
      'mockza-audio-private',
      { client: multiClient },
    );

    expect(seenAudioParts).toBe(3);
  });
});
