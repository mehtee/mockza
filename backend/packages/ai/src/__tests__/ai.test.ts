import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeAudioForModel, prepareAudioForModel } from '../audio/processor.js';
import { EvaluationModelError } from '../errors.js';
import { explainQuestionGraph } from '../graphs/explain-question.js';
import { gradeSpeakingGraph } from '../graphs/grade-speaking.js';
import { gradeWritingGraph } from '../graphs/grade-writing.js';
import { MODEL_METADATA, MODEL_REGISTRY } from '../models/registry.js';
import { maskPiiObject, maskPiiText } from '../observability/langfuse.js';

function createMockWritingClient(essayText: string) {
  return {
    async createChatCompletion() {
      const snippet = essayText.slice(0, Math.min(24, essayText.length));
      return {
        id: 'mock-or-w-1',
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
                    band: 7.0,
                    evidenceExcerpt: snippet,
                    feedbackNote: 'Clear position.',
                  },
                  {
                    code: 'CC',
                    label: 'Coherence and Cohesion',
                    band: 7.0,
                    evidenceExcerpt: snippet,
                    feedbackNote: 'Logical structure.',
                  },
                  {
                    code: 'LR',
                    label: 'Lexical Resource',
                    band: 7.5,
                    evidenceExcerpt: snippet,
                    feedbackNote: 'Strong academic lexis.',
                  },
                  {
                    code: 'GRA',
                    label: 'Grammatical Range and Accuracy',
                    band: 6.5,
                    evidenceExcerpt: snippet,
                    feedbackNote: 'Good subordination.',
                  },
                ],
                inlineEdits: [
                  {
                    editId: 'e1',
                    startOffset: 0,
                    endOffset: snippet.length,
                    originalText: snippet,
                    suggestedText: snippet,
                    criterionCode: 'LR',
                    rationale: 'Clear opening.',
                  },
                ],
                modelRewrite: {
                  targetBandDelta: 1.0,
                  title: 'Band 8.0 Rewrite',
                  rewrittenText: essayText,
                  preservedIdeasNote: 'Preserved argument.',
                },
                vocabUpgrades: [
                  {
                    id: 'v1',
                    term: 'indispensable',
                    ipa: '/ˌɪn.dɪˈspen.sə.bəl/',
                    definition: 'absolutely necessary',
                    contextSentence: 'Green spaces are indispensable for urban well-being.',
                    paraphrases: ['essential', 'vital'],
                    bandRationale: 'Accurate formal register.',
                  },
                ],
                recommendedDrill: {
                  drillType: 'complex_grammar',
                  weakestCriterionCode: 'GRA',
                  title: 'Complex Clause Subordination',
                  durationMinutes: 3,
                },
                actionableNextStep: 'Vary clause structures.',
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
        id: 'mock-or-s-1',
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
                    evidenceExcerpt: 'I live in a coastal city.',
                    feedbackNote: 'Smooth flow.',
                  },
                  {
                    code: 'LR',
                    label: 'Lexical Resource',
                    band: 6.5,
                    evidenceExcerpt: 'coastal city',
                    feedbackNote: 'Natural phrasing.',
                  },
                  {
                    code: 'GRA',
                    label: 'Grammatical Range and Accuracy',
                    band: 6.5,
                    evidenceExcerpt: 'which has grown',
                    feedbackNote: 'Good relative clauses.',
                  },
                  {
                    code: 'PR',
                    label: 'Pronunciation',
                    band: 7.0,
                    evidenceExcerpt: 'clear rhythm',
                    feedbackNote: 'Intelligible throughout.',
                  },
                ],
                transcriptSegments: [
                  {
                    segmentId: 'seg-1',
                    partIndex: 1,
                    startMs: 0,
                    endMs: 4200,
                    text: 'I live in a coastal city which has grown rapidly over recent decades.',
                    annotations: [],
                  },
                ],
                vocabUpgrades: [],
                actionableNextStep: 'Develop examples further.',
              }),
            },
          },
        ],
      };
    },
  };
}

describe('@mockza/ai model registry, fail-closed guarantees, and audio processor', () => {
  const prevApiKey = process.env['OPENROUTER_API_KEY'];
  const prevDemo = process.env['ALLOW_DEMO_EVALUATOR'];

  beforeEach(() => {
    delete process.env['OPENROUTER_API_KEY'];
    delete process.env['ALLOW_DEMO_EVALUATOR'];
  });

  afterEach(() => {
    if (prevApiKey !== undefined) process.env['OPENROUTER_API_KEY'] = prevApiKey;
    else delete process.env['OPENROUTER_API_KEY'];
    if (prevDemo !== undefined) process.env['ALLOW_DEMO_EVALUATOR'] = prevDemo;
    else delete process.env['ALLOW_DEMO_EVALUATOR'];
  });

  it('enforces strictly locked models with zero fallback models', () => {
    expect(MODEL_REGISTRY.writingPrimary).toBe('deepseek/deepseek-v4.1-flash-1017');
    expect(MODEL_REGISTRY.speakingAudioPrimary).toBe('google/gemini-3.1-flash-lite');
    expect(MODEL_REGISTRY.drillFast).toBe('deepseek/deepseek-v4.1-flash-1017');

    const audioMeta = MODEL_METADATA[MODEL_REGISTRY.speakingAudioPrimary];
    expect(audioMeta?.supportsAudioInput).toBe(true);
    expect(audioMeta?.acceptedAudioFormats).toContain('m4a');

    const writingMeta = MODEL_METADATA[MODEL_REGISTRY.writingPrimary];
    expect(writingMeta?.supportsAudioInput).toBe(false);
  });

  it('fails closed (no fake heuristic grades) when API key or audio is missing or upstream fails', async () => {
    await expect(
      gradeWritingGraph.invoke({
        attemptId: '123e4567-e89b-12d3-a456-426614174001',
        packId: 'writing-pack-01',
        examId: 'ielts_academic',
        taskType: 'task2Essay',
        promptTitle: 'Urban Planning',
        promptBody: 'Discuss urban green spaces.',
        essayText: 'Green spaces improve urban life and reduce city heat substantially.',
      }),
    ).rejects.toBeInstanceOf(EvaluationModelError);

    await expect(
      gradeSpeakingGraph.invoke(
        {
          attemptId: '123e4567-e89b-12d3-a456-426614174002',
          packId: 'speaking-pack-01',
          examId: 'ielts_academic',
          partSequence: 'part1',
          turns: [
            {
              partIndex: 1,
              promptText: 'Describe your hometown.',
              objectKey: 'users/dev-1/clips/att-1/part-1.m4a',
            },
          ],
        },
        { client: createMockSpeakingClient() },
      ),
    ).rejects.toMatchObject({ code: 'audio_missing' });

    await expect(
      explainQuestionGraph.invoke({
        packId: 'pack-1',
        packVersion: '1.0.0',
        questionId: 'q-10',
        skill: 'reading',
        questionType: 'TFNG',
        userAnswer: 'TRUE',
      }),
    ).rejects.toBeInstanceOf(EvaluationModelError);

    await expect(
      gradeWritingGraph.invoke(
        {
          attemptId: '123e4567-e89b-12d3-a456-426614174001',
          packId: 'writing-pack-01',
          examId: 'ielts_academic',
          taskType: 'task2Essay',
          promptTitle: 'Test',
          promptBody: 'Test',
          essayText: 'Sample essay text exceeding minimum length for validation check.',
        },
        {
          client: {
            async createChatCompletion() {
              throw new EvaluationModelError('upstream_rate_limited', '429 rate limited', true);
            },
          },
        },
      ),
    ).rejects.toMatchObject({ code: 'upstream_rate_limited', retryable: true });
  });

  it('masks emails, UUIDs, phones, and base64 audio in Langfuse filter', () => {
    const raw =
      'User test.user@example.com with device 123e4567-e89b-12d3-a456-426614174000 called +1 (555) 123-4567 data:audio/mp4;base64,AAAA';
    const masked = maskPiiText(raw);
    expect(masked).not.toContain('test.user@example.com');
    expect(masked).toContain('[REDACTED_EMAIL]');
    expect(masked).toContain('[REDACTED_UUID]');
    expect(masked).toContain('[REDACTED_PHONE]');
    expect(masked).toContain('[BASE64_AUDIO_REDACTED]');

    const obj = {
      email: 'john@doe.com',
      device: '123e4567-e89b-12d3-a456-426614174000',
      nested: { audioBlob: 'A'.repeat(300) },
    };
    const maskedObj = maskPiiObject(obj) as Record<string, unknown> & {
      nested: { audioBlob: string };
    };
    expect(maskedObj['email']).toBe('[REDACTED_EMAIL]');
    expect(maskedObj['device']).toBe('[REDACTED_UUID]');
    expect(maskedObj.nested.audioBlob).toBe('[AUDIO_BLOB_REDACTED]');
  });

  it('evaluates writing and speaking cleanly with verified model output and computes overall band server-side', async () => {
    const essayText =
      'In contemporary urban planning, the allocation of space for public parks and recreational areas has generated significant debate. Green spaces are indispensable for sustainable community well-being.';

    const writingOutput = await gradeWritingGraph.invoke(
      {
        attemptId: '123e4567-e89b-12d3-a456-426614174001',
        packId: 'writing-pack-01',
        examId: 'ielts_academic',
        taskType: 'task2Essay',
        promptTitle: 'Urban Planning',
        promptBody: 'Discuss both views on urban green spaces.',
        essayText,
      },
      { client: createMockWritingClient(essayText) },
    );

    expect(writingOutput.overallBand).toBe(7.0);
    expect(writingOutput.criteria).toHaveLength(4);
    expect(writingOutput.modelId).toBe(MODEL_REGISTRY.writingPrimary);

    const speakingOutput = await gradeSpeakingGraph.invoke(
      {
        attemptId: '123e4567-e89b-12d3-a456-426614174002',
        packId: 'speaking-pack-01',
        examId: 'ielts_academic',
        partSequence: 'part1',
        base64AudioData: Buffer.from('audio-bytes').toString('base64'),
        turns: [
          {
            partIndex: 1,
            promptText: 'Describe your hometown.',
            objectKey: 'users/dev-1/clips/att-1/part-1.m4a',
          },
        ],
      },
      { client: createMockSpeakingClient() },
    );

    expect(speakingOutput.overallBand).toBe(7.0);
    expect(speakingOutput.criteria.map((c) => c.code)).toEqual(['FC', 'LR', 'GRA', 'PR']);
    expect(speakingOutput.modelId).toBe(MODEL_REGISTRY.speakingAudioPrimary);

    const explainRes = await explainQuestionGraph.invoke(
      {
        packId: 'pack-1',
        packVersion: '1.0.0',
        questionId: 'q-10',
        skill: 'reading',
        questionType: 'TFNG',
        userAnswer: 'TRUE',
        correctAnswer: 'NOT GIVEN',
      },
      {
        client: {
          async createChatCompletion() {
            return {
              id: 'mock-or-e-1',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      explanation: 'The passage neither confirms nor denies this claim.',
                      evidenceQuote: 'Scientists observed varied patterns.',
                      whyWrongOptions: [{ option: 'TRUE', reason: 'Not stated in text.' }],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    );
    expect(explainRes.explanation).toContain('neither confirms nor denies');
  });

  it('encodes audio for model cleanly and rejects corrupt containers', async () => {
    const buffer = Buffer.from('fake-audio-m4a-data');
    const prepared = encodeAudioForModel(buffer);
    expect(prepared.format).toBe('m4a');
    expect(prepared.base64Data).toBe(buffer.toString('base64'));

    await expect(
      prepareAudioForModel(Buffer.from('not-an-audio-file-at-all'), 'clip.webm'),
    ).rejects.toMatchObject({ code: 'audio_missing' });
  });

  it('RR-18: rejects duplicate/mismatched criterion codes and strips ungrounded writing edits', async () => {
    await expect(
      gradeWritingGraph.invoke(
        {
          attemptId: '123e4567-e89b-12d3-a456-426614174101',
          packId: 'writing-pack-01',
          examId: 'ielts_academic',
          taskType: 'task1Academic',
          promptTitle: 'Chart Comparison',
          promptBody: 'Summarize the chart.',
          essayText: 'The bar chart illustrates urban energy usage across four decades.',
        },
        {
          client: {
            async createChatCompletion() {
              return {
                id: 'bad-code',
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
                            band: 7,
                            evidenceExcerpt: 'bar chart',
                            feedbackNote: 'Wrong code for Task 1.',
                          },
                          {
                            code: 'CC',
                            label: 'Coherence',
                            band: 7,
                            evidenceExcerpt: 'across',
                            feedbackNote: 'Ok.',
                          },
                          {
                            code: 'LR',
                            label: 'Lexis',
                            band: 7,
                            evidenceExcerpt: 'illustrates',
                            feedbackNote: 'Ok.',
                          },
                          {
                            code: 'GRA',
                            label: 'Grammar',
                            band: 7,
                            evidenceExcerpt: 'four decades',
                            feedbackNote: 'Ok.',
                          },
                        ],
                      }),
                    },
                  },
                ],
              };
            },
          },
        },
      ),
    ).rejects.toThrow('expected TA, CC, LR, GRA');

    const essayText = 'Urban energy usage rose sharply across four decades.';
    const sanitized = await gradeWritingGraph.invoke(
      {
        attemptId: '123e4567-e89b-12d3-a456-426614174102',
        packId: 'writing-pack-01',
        examId: 'ielts_academic',
        taskType: 'task2Essay',
        promptTitle: 'Energy',
        promptBody: 'Discuss energy trends.',
        essayText,
      },
      {
        client: {
          async createChatCompletion() {
            return {
              id: 'mixed-edits',
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
                          band: 7,
                          evidenceExcerpt: 'Urban energy usage',
                          feedbackNote: 'Clear focus.',
                        },
                        {
                          code: 'CC',
                          label: 'Coherence',
                          band: 7,
                          evidenceExcerpt: 'rose sharply',
                          feedbackNote: 'Logical.',
                        },
                        {
                          code: 'LR',
                          label: 'Lexis',
                          band: 7,
                          evidenceExcerpt: 'four decades',
                          feedbackNote: 'Natural.',
                        },
                        {
                          code: 'GRA',
                          label: 'Grammar',
                          band: 7,
                          evidenceExcerpt: 'across four decades',
                          feedbackNote: 'Accurate.',
                        },
                      ],
                      inlineEdits: [
                        {
                          editId: 'bad-offset-hallucinated',
                          startOffset: 999,
                          endOffset: 1020,
                          originalText: 'nonexistent phrase',
                          suggestedText: 'better phrase',
                          criterionCode: 'LR',
                          rationale: 'Hallucinated span should be stripped.',
                        },
                        {
                          editId: 'drifted-but-unique',
                          startOffset: 0,
                          endOffset: 4,
                          originalText: 'rose sharply',
                          suggestedText: 'increased markedly',
                          criterionCode: 'LR',
                          rationale: 'Snaps cleanly to unique verbatim match.',
                        },
                      ],
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    );
    expect(sanitized.inlineEdits).toHaveLength(1);
    const firstEdit = sanitized.inlineEdits?.[0];
    expect(firstEdit?.editId).toBe('drifted-but-unique');
    expect(firstEdit ? essayText.slice(firstEdit.startOffset, firstEdit.endOffset) : '').toBe(
      'rose sharply',
    );
  });

  it('loads speaking prompt from YAML and normalizes v2 rich JSON contract', async () => {
    let capturedPrompt = '';
    const result = await gradeSpeakingGraph.invoke(
      {
        attemptId: '123e4567-e89b-12d3-a456-426614174102',
        packId: 'speaking-pack-01',
        examId: 'ielts_academic',
        partSequence: 'part1',
        turns: [
          {
            partIndex: 1,
            promptText: 'Describe your hometown.',
            objectKey: 'k1',
            durationMs: 5000,
          },
        ],
        base64AudioData: Buffer.from('fake-audio').toString('base64'),
      },
      {
        client: {
          async createChatCompletion(req) {
            const parts = Array.isArray(req.messages[0]?.content) ? req.messages[0].content : [];
            const textPart = parts.find(
              (p): p is { type: 'text'; text: string } => p.type === 'text',
            );
            capturedPrompt = textPart?.text ?? '';
            return {
              id: 'v2-speaking',
              choices: [
                {
                  finish_reason: 'stop',
                  message: {
                    role: 'assistant',
                    content: JSON.stringify({
                      assessment: { status: 'complete', overallBand: 7.0 },
                      criteria: [
                        {
                          code: 'FC',
                          label: 'Fluency and Coherence',
                          band: 7,
                          evidence: [{ segmentId: 's1', quote: 'I grew up in Shiraz' }],
                          strengths: ['Smooth pacing.'],
                          limitations: [],
                        },
                        {
                          code: 'LR',
                          label: 'Lexical Resource',
                          band: 7,
                          evidenceExcerpt: 'vibrant cultural heritage',
                          feedbackNote: 'Natural collocations.',
                        },
                        {
                          code: 'GRA',
                          label: 'Grammatical Range and Accuracy',
                          band: 6,
                          evidenceExcerpt: 'it have many gardens',
                          feedbackNote: 'Occasional subject-verb agreement slip.',
                        },
                        {
                          code: 'PR',
                          label: 'Pronunciation',
                          band: 7,
                          evidenceExcerpt: 'distinctive architecture',
                          feedbackNote: 'Clear stress and intonation.',
                        },
                      ],
                      transcriptSegments: [
                        {
                          segmentId: 's1',
                          audioIndex: 1,
                          partIndex: 1,
                          startMs: null,
                          endMs: null,
                          text: 'I grew up in Shiraz and it have many gardens.',
                          annotations: [
                            {
                              issueId: 'i1',
                              criterionCode: 'GRA',
                              category: 'grammar',
                              startMs: null,
                              endMs: null,
                              note: 'Subject-verb agreement slip',
                            },
                          ],
                        },
                      ],
                      issues: [
                        {
                          id: 'i1',
                          criterionCode: 'GRA',
                          category: 'grammar',
                          suggestedCorrection: 'it has many gardens',
                          explanation: 'Singular subject requires "has".',
                        },
                      ],
                      vocabUpgrades: [
                        {
                          id: 'u1',
                          term: 'renowned for',
                          ipa: null,
                          definition: 'well known for',
                          contextSentence: 'Shiraz is renowned for its gardens.',
                          paraphrases: ['famous for'],
                          bandRationale: 'Natural collocation.',
                        },
                      ],
                      recommendedDrill: {
                        drillType: 'grammar_error_correction',
                        weakestCriterionCode: null,
                        title: 'Third-person singular agreement',
                        durationMinutes: 4,
                      },
                    }),
                  },
                },
              ],
            };
          },
        },
      },
    );

    expect(capturedPrompt).toContain('# ROLE AND PROFESSIONAL STANDARD');
    expect(capturedPrompt).toContain('Audio #1 (Part 1): Describe your hometown.');
    expect(result.overallBand).toBe(7.0);
    expect(result.transcriptSegments?.[0]?.startMs).toBe(0);
    expect(result.transcriptSegments?.[0]?.annotations[0]).toMatchObject({
      type: 'grammar',
      suggestion: 'it has many gardens',
      rationale: 'Subject-verb agreement slip',
    });
    expect(result.vocabUpgrades[0]?.ipa).toBeUndefined();
    expect(result.recommendedDrill?.weakestCriterionCode).toBe('GRA');
  });
});
