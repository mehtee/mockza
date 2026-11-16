import { EvaluationModelError } from '@mockza/ai';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runRubricEvals } from '../run-evals.js';

describe('@mockza/evals held-out rubric benchmark contract', () => {
  const prevApiKey = process.env['OPENROUTER_API_KEY'];

  beforeEach(() => {
    delete process.env['OPENROUTER_API_KEY'];
  });

  afterEach(() => {
    if (prevApiKey !== undefined) process.env['OPENROUTER_API_KEY'] = prevApiKey;
    else delete process.env['OPENROUTER_API_KEY'];
  });

  it('fails closed when OPENROUTER_API_KEY is absent instead of passing via fake fallbacks', async () => {
    await expect(runRubricEvals()).rejects.toBeInstanceOf(EvaluationModelError);
  });

  it('requires real audio content parts for speaking evaluation samples', async () => {
    let sawAudioPart = false;
    const client = {
      async createChatCompletion(req: { messages: Array<{ content: unknown }>; model: string }) {
        const content = req.messages[0]?.content;
        const isSpeaking = Array.isArray(content);
        const promptStr = typeof content === 'string' ? content : '';
        const isTask1 = promptStr.includes('Task Type: task1');
        if (isSpeaking) {
          sawAudioPart = content.some((part: { type?: string }) => part.type === 'input_audio');
        }
        return {
          id: 'eval-contract-check',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  criteria: isSpeaking
                    ? [
                        {
                          code: 'FC',
                          label: 'Fluency and Coherence',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                        {
                          code: 'LR',
                          label: 'Lexical Resource',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                        {
                          code: 'GRA',
                          label: 'Grammatical Range and Accuracy',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                        {
                          code: 'PR',
                          label: 'Pronunciation',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                      ]
                    : [
                        {
                          code: isTask1 ? 'TA' : 'TR',
                          label: isTask1 ? 'Task Achievement' : 'Task Response',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                        {
                          code: 'CC',
                          label: 'Coherence and Cohesion',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                        {
                          code: 'LR',
                          label: 'Lexical Resource',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                        {
                          code: 'GRA',
                          label: 'Grammatical Range and Accuracy',
                          band: 6.5,
                          evidenceExcerpt: 'Excerpt',
                          feedbackNote: 'Note',
                        },
                      ],
                }),
              },
            },
          ],
        };
      },
    };

    // Constant 6.5 predictions fail the >=80% threshold while exercising strict protocol contracts
    // (explicit opt-out of real audio is permitted only with an injected offline mock client).
    await expect(runRubricEvals({ client, requireAudioForSpeaking: false })).rejects.toThrow(
      'Calibration benchmark failed',
    );
    expect(sawAudioPart).toBe(true);
  });

  it('refuses speaking calibration samples that omit real audio by default', async () => {
    const client = {
      async createChatCompletion() {
        return {
          id: 'eval-contract-check',
          choices: [
            {
              finish_reason: 'stop',
              message: { role: 'assistant', content: '{}' },
            },
          ],
        };
      },
    };
    await expect(runRubricEvals({ client })).rejects.toThrow(
      'without real human-rated audio recording',
    );
  });
});
