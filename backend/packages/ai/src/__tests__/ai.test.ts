import { describe, expect, it } from 'vitest';
import { encodeAudioForModel } from '../audio/processor.js';
import { explainQuestionGraph } from '../graphs/explain-question.js';
import { gradeSpeakingGraph } from '../graphs/grade-speaking.js';
import { gradeWritingGraph } from '../graphs/grade-writing.js';
import { MODEL_METADATA, MODEL_REGISTRY } from '../models/registry.js';
import { maskPiiObject, maskPiiText } from '../observability/langfuse.js';

describe('@mockza/ai model registry, graphs, and audio processor', () => {
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
    const maskedObj = maskPiiObject(obj) as any;
    expect(maskedObj.email).toBe('[REDACTED_EMAIL]');
    expect(maskedObj.device).toBe('[REDACTED_UUID]');
    expect(maskedObj.nested.audioBlob).toBe('[AUDIO_BLOB_REDACTED]');
  });

  it('evaluates writing prompt and computes overall band server-side', async () => {
    const output = await gradeWritingGraph.invoke({
      attemptId: '123e4567-e89b-12d3-a456-426614174001',
      packId: 'writing-pack-01',
      examId: 'ielts_academic',
      taskType: 'task2Essay',
      promptTitle: 'Urban Planning',
      promptBody: 'Discuss both views on urban green spaces.',
      essayText:
        'In contemporary urban planning, the allocation of space for public parks and recreational areas has generated significant debate. While some argue that commercial developments should take priority, I contend that green spaces are indispensable for sustainable community well-being.\n\nFurthermore, empirical research indicates that access to natural environments fosters both physical health and psychological restoration. In conclusion, preserving green zones is fundamental.',
    });

    expect(output.overallBand).toBeGreaterThanOrEqual(5.0);
    expect(output.overallBand).toBeLessThanOrEqual(9.0);
    expect(output.criteria).toHaveLength(4);
    expect(output.modelId).toBe('deepseek/deepseek-v4.1-flash-1017');
    expect(output.inlineEdits).toBeDefined();
    expect(output.modelRewrite).toBeDefined();
    expect(output.vocabUpgrades.length).toBeGreaterThan(0);
  });

  it('evaluates speaking session with criteria and transcript annotations', async () => {
    const output = await gradeSpeakingGraph.invoke({
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
    });

    expect(output.overallBand).toBeGreaterThanOrEqual(5.0);
    expect(output.criteria).toHaveLength(4);
    expect(output.criteria.map((c) => c.code)).toEqual(['FC', 'LR', 'GRA', 'PR']);
    expect(output.modelId).toBe('google/gemini-3.1-flash-lite');
    expect(output.transcriptSegments?.length).toBeGreaterThan(0);
  });

  it('explains Reading/Listening questions', async () => {
    const res = await explainQuestionGraph.invoke({
      packId: 'pack-1',
      packVersion: '1.0.0',
      questionId: 'q-10',
      skill: 'reading',
      questionType: 'TFNG',
      userAnswer: 'TRUE',
      correctAnswer: 'NOT GIVEN',
    });

    expect(res.explanation).toBeDefined();
    expect(res.whyWrongOptions.length).toBeGreaterThan(0);
  });

  it('encodes audio for model without WAV transcode', () => {
    const buffer = Buffer.from('fake-audio-m4a-data');
    const prepared = encodeAudioForModel(buffer);
    expect(prepared.format).toBe('m4a');
    expect(prepared.base64Data).toBe(buffer.toString('base64'));
  });
});
