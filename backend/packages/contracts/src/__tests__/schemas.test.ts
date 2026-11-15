import { describe, expect, it } from 'vitest';
import { buildContractDocument, writeOpenApiArtifact } from '../export-openapi.js';
import * as schemas from '../schemas.js';

describe('@mockza/contracts schemas & openapi export', () => {
  it('validates EvaluationOutputSchema structure with inlineEdits, transcriptSegments, modelRewrite', () => {
    const validOutput = {
      attemptId: '123e4567-e89b-12d3-a456-426614174000',
      overallBand: 7.0,
      isEstimated: true,
      criteria: [
        {
          code: 'TR',
          label: 'Task Response',
          band: 7.0,
          evidenceExcerpt: 'The author clearly states their position throughout.',
          feedbackNote: 'Strong argument development.',
        },
        {
          code: 'CC',
          label: 'Coherence and Cohesion',
          band: 7.0,
          evidenceExcerpt: 'Paragraph transitions are well signaled.',
          feedbackNote: 'Good linking devices used.',
        },
        {
          code: 'LR',
          label: 'Lexical Resource',
          band: 7.0,
          evidenceExcerpt: 'Wide range of vocabulary with occasional minor inaccuracies.',
          feedbackNote: 'Accurate word choice.',
        },
        {
          code: 'GRA',
          label: 'Grammatical Range and Accuracy',
          band: 7.0,
          evidenceExcerpt: 'Mix of simple and complex sentence structures.',
          feedbackNote: 'Frequent error-free sentences.',
        },
      ],
      inlineEdits: [
        {
          editId: 'edit-1',
          startOffset: 10,
          endOffset: 25,
          originalText: 'people is thinking',
          suggestedText: 'people believe',
          criterionCode: 'GRA',
          rationale: 'Subject-verb agreement and more academic register.',
        },
      ],
      modelRewrite: {
        targetBandDelta: 1.5,
        title: 'Band 8.5 Exemplar Rewrite',
        rewrittenText: 'In contemporary society, individuals increasingly argue...',
        preservedIdeasNote: 'Preserved core student stance on technology in classrooms.',
      },
      vocabUpgrades: [
        {
          id: 'v1',
          term: 'proliferation',
          ipa: '/prəˌlɪf.əˈreɪ.ʃən/',
          definition: 'rapid increase in the number or amount of something',
          contextSentence: 'The proliferation of digital tools has transformed education.',
          paraphrases: ['rapid spread', 'surge'],
          bandRationale: 'Academic word list band 8+ item.',
        },
      ],
      recommendedDrill: {
        drillType: 'grammatical_cohesion',
        weakestCriterionCode: 'GRA',
        title: 'Complex Sentence Structures',
        durationMinutes: 3,
      },
      actionableNextStep: 'Practice complex subordinating conjunctions in your next essay.',
      modelId: 'deepseek/deepseek-v4.1-flash-1017',
      rubricVersion: 'ielts-v2026-01',
    };

    const parsed = schemas.EvaluationOutputSchema.parse(validOutput);
    expect(parsed.overallBand).toBe(7.0);
    expect(parsed.criteria).toHaveLength(4);
    expect(parsed.inlineEdits).toHaveLength(1);
    expect(parsed.modelRewrite?.targetBandDelta).toBe(1.5);
  });

  it('validates QuotaStatusResponseSchema', () => {
    const quotaData = {
      isPro: true,
      freeDiagnosticUsed: true,
      dailySpeakingUsed: 2,
      dailySpeakingLimit: 10,
      dailyWritingUsed: 1,
      dailyWritingLimit: 10,
      monthlyUsed: 25,
      monthlyLimit: 150,
      dailyResetAt: '2026-11-16T00:00:00.000Z',
      monthlyResetAt: '2026-12-01T00:00:00.000Z',
    };
    const parsed = schemas.QuotaStatusResponseSchema.parse(quotaData);
    expect(parsed.dailySpeakingLimit).toBe(10);
    expect(parsed.monthlyLimit).toBe(150);
  });

  it('exports OpenAPI 3.1 contract document and writes artifact', () => {
    const doc = buildContractDocument();
    expect(doc['openapi']).toBe('3.1.0');
    expect(doc['info']).toBeDefined();

    const artifactPath = writeOpenApiArtifact();
    expect(artifactPath).toContain('openapi.json');
  });
});
