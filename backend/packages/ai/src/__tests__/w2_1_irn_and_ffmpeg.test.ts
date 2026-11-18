import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectAudioContainer, prepareAudioForModel } from '../audio/processor.js';
import { gradeSpeakingGraph } from '../graphs/grade-speaking.js';
import { gradeWritingGraph } from '../graphs/grade-writing.js';
import { buildEditionOverlayAppendix } from '../prompts/rubrics.js';

describe('W2.1 IRN Persian Coaching Overlay & WebM->M4A Normalization', () => {
  it('injects Persian coaching appendix only for irn edition while keeping GLB prompts clean', async () => {
    expect(buildEditionOverlayAppendix('glb')).toBe('');
    expect(buildEditionOverlayAppendix('irn')).toContain('PERSIAN COACHING');
    expect(buildEditionOverlayAppendix('irn')).toContain('glossFa');

    const capturedPrompts: string[] = [];
    const mockClient = {
      createChatCompletion: async (req: { messages: Array<{ content: unknown }> }) => {
        const text =
          typeof req.messages[0]?.content === 'string'
            ? req.messages[0].content
            : JSON.stringify(req.messages[0]?.content);
        capturedPrompts.push(text);
        return {
          id: 'mock-irn-eval',
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
                      evidenceExcerpt: 'Sample essay sentence',
                      feedbackNote: 'پاسخ منسجم است.',
                    },
                    {
                      code: 'CC',
                      label: 'Coherence and Cohesion',
                      band: 7.0,
                      evidenceExcerpt: 'Sample essay sentence',
                      feedbackNote: 'انسجام پاراگراف‌ها خوب است.',
                    },
                    {
                      code: 'LR',
                      label: 'Lexical Resource',
                      band: 6.5,
                      evidenceExcerpt: 'Sample essay sentence',
                      feedbackNote: 'واژگان مناسب است.',
                    },
                    {
                      code: 'GRA',
                      label: 'Grammatical Range and Accuracy',
                      band: 7.0,
                      evidenceExcerpt: 'Sample essay sentence',
                      feedbackNote: 'تنوع گرامری قابل قبول است.',
                    },
                  ],
                  vocabUpgrades: [
                    {
                      id: 'v1',
                      term: 'ubiquitous',
                      definition: 'present everywhere',
                      glossFa: 'همه‌گیر و فراگیر',
                      contextSentence: 'Smartphones have become ubiquitous in modern life.',
                      paraphrases: ['omnipresent'],
                      bandRationale: 'ارتقای واژگان آکادمیک در معیار LR.',
                    },
                  ],
                  actionableNextStep: 'روی جملات مرکب شرطی تمرین کنید.',
                }),
              },
            },
          ],
        };
      },
    };

    const irnRes = await gradeWritingGraph.invoke(
      {
        attemptId: randomUUID(),
        packId: 'ielts_acad_w1',
        examId: 'ielts_academic',
        edition: 'irn',
        taskType: 'task2Essay',
        promptTitle: 'Urban Growth',
        promptBody: 'Discuss urban growth.',
        essayText:
          'Sample essay sentence demonstrating structured academic writing across paragraphs.',
      },
      { client: mockClient },
    );
    expect(capturedPrompts[0]).toContain(
      'EDITION LOCALE OVERLAY (IRN / SANJIA — PERSIAN COACHING)',
    );
    expect(irnRes.vocabUpgrades[0]?.glossFa).toBe('همه‌گیر و فراگیر');
    expect(irnRes.overallBand).toBe(7.0);

    const demoIrnSpeaking = await gradeSpeakingGraph.invoke(
      {
        attemptId: randomUUID(),
        packId: 'ielts_spk_1',
        examId: 'ielts_academic',
        edition: 'irn',
        partSequence: 'part1',
        turns: [
          { partIndex: 1, promptText: 'Describe your hometown.', objectKey: 'users/a/b/c.m4a' },
        ],
      },
      { allowDemoEvaluator: true },
    );
    expect(demoIrnSpeaking.criteria[0]?.feedbackNote).toContain('دمو');
  });

  it('normalizes WebM/Opus desktop browser audio into 16 kHz mono .m4a using ffmpeg', async () => {
    const hasFfmpeg = existsSync('/usr/bin/ffmpeg');
    if (!hasFfmpeg) {
      return;
    }

    // Generate 0.6s synthetic WebM/Opus bytes purely in stdout pipe without writing source files
    const webmBytes = execFileSync(
      '/usr/bin/ffmpeg',
      [
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=0.6',
        '-c:a',
        'libopus',
        '-f',
        'webm',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );

    expect(detectAudioContainer(webmBytes)).toBe('webm');
    const normalized = await prepareAudioForModel(
      webmBytes,
      'users/test/clips/attempt/turn-1.webm',
    );
    expect(normalized.format).toBe('m4a');
    const outBuf = Buffer.from(normalized.base64Data, 'base64');
    expect(detectAudioContainer(outBuf)).toBe('m4a');
  });
});
