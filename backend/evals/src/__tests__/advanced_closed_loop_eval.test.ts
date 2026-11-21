import { OpenRouterAlphaClient } from '@mockza/ai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runClosedLoopEvals } from '../run-closed-loop-evals.js';

describe('@mockza/evals Closed-Loop 20-Scenario Contract Benchmark (Phase A6)', () => {
  const prevKey = process.env['OPENROUTER_API_KEY'];

  beforeEach(() => {
    delete process.env['OPENROUTER_API_KEY'];
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (prevKey !== undefined) process.env['OPENROUTER_API_KEY'] = prevKey;
    else delete process.env['OPENROUTER_API_KEY'];
  });

  it('validates all 20 golden Register Shifter, Drop Anything, and Linguistic Graph/Mission cases cleanly', async () => {
    process.env['OPENROUTER_API_KEY'] = 'sk-eval-contract-test';

    const mockClient = {
      async createChatCompletion(req: {
        messages: Array<{ role: string; content: unknown }>;
        model: string;
      }) {
        const sys = String(req.messages[0]?.content ?? '');
        const usr = String(
          Array.isArray(req.messages[1]?.content)
            ? JSON.stringify(req.messages[1]?.content)
            : (req.messages[1]?.content ?? ''),
        );
        const isIrn = sys.includes('fa-IR') || sys.includes('Persian');

        if (sys.includes('3 authentic register variants')) {
          return {
            id: 'eval-rs',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    runId: '00000000-0000-4000-8000-000000000099',
                    examTrack: 'ielts_academic',
                    sourceTranscript: usr.slice(0, 80),
                    gears: {
                      casual: 'Today was really good and saved lots of time.',
                      workplace: 'Today delivered solid efficiency gains across our workflow.',
                      academic:
                        'Today yielded substantial productivity gains, albeit requiring careful coordination across engineering workflows.',
                    },
                    shiftHighlights: [
                      {
                        casualPhrase: 'really good',
                        upgradedPhrase: 'substantial productivity gains',
                        targetGear: 'academic',
                        whyEn: 'Replaces generic modifier with precise C1 collocation.',
                        whyFa: isIrn ? 'جایگزینی عبارت ساده با ترکیب آکادمیک نمره ۸.۵.' : null,
                      },
                    ],
                    repeatAloudTarget: {
                      gearLevel: 2,
                      targetSentence:
                        'Today yielded substantial productivity gains, albeit requiring careful coordination across engineering workflows.',
                      targetPhrases: ['substantial productivity gains', 'albeit'],
                    },
                  }),
                },
              },
            ],
          };
        }

        if (sys.includes('forcedTargets') || sys.includes('10-minute Daily Mission')) {
          return {
            id: 'eval-mission',
            choices: [
              {
                finish_reason: 'stop',
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    estimatedSeconds: 600,
                    warmupCardIds: ['c-1'],
                    forcedTargets: [
                      {
                        canonicalKey: 'grammar:conditionals',
                        phraseEn: 'had they accounted for',
                        hintEn: 'Inverted conditional structure.',
                        hintFa: isIrn ? 'ساختار شرطی وارونه.' : null,
                      },
                      {
                        canonicalKey: 'vocab:albeit',
                        phraseEn: 'albeit',
                        hintEn: 'Concessive linker.',
                        hintFa: isIrn ? 'قید ربط تضاد.' : null,
                      },
                    ],
                    promptTitle: '10-Min Transfer Mission',
                    promptTextEn: 'Analyze a tactical engineering trade-off in 5 sentences.',
                    promptTextFa: isIrn ? 'یک بده‌بستان فنی را در ۵ جمله تحلیل کنید.' : null,
                    responseMode: 'writing',
                  }),
                },
              },
            ],
          };
        }

        return {
          id: 'eval-drop',
          choices: [
            {
              finish_reason: 'stop',
              message: {
                role: 'assistant',
                content: JSON.stringify({
                  title: 'Golden Study Drop',
                  cefrEstimate: 'C1',
                  detectedTopics: ['artificial_intelligence'],
                  extractedPhrases: [
                    {
                      headword: 'trade-off',
                      ipa: '/ˈtreɪd ɒf/',
                      definitionEn: 'Balance between two competing qualities.',
                      glossFa: isIrn ? 'بده‌بستان' : null,
                      exampleSentence: 'Every cache layer involves a freshness trade-off.',
                      startUtf16: 39,
                      endUtf16: 48,
                    },
                    {
                      headword: 'albeit',
                      ipa: '/ɔːlˈbiː.ɪt/',
                      definitionEn: 'Although; even though.',
                      glossFa: isIrn ? 'هرچند' : null,
                      exampleSentence: 'Latency dropped fast, albeit at higher RAM cost.',
                      startUtf16: null,
                      endUtf16: null,
                    },
                    {
                      headword: 'mitigate',
                      ipa: '/ˈmɪt.ɪ.ɡeɪt/',
                      definitionEn: 'Make less severe.',
                      glossFa: isIrn ? 'کاهش دادن شدت' : null,
                      exampleSentence: 'Buffered writes mitigate disk spikes.',
                      startUtf16: null,
                      endUtf16: null,
                    },
                  ],
                  drillPayload: {
                    comprehensionPrompt: 'What trade-off is highlighted?',
                    comprehensionOptions: ['Memory efficiency vs fidelity', 'Font choice vs margin'],
                    correctOptionIndex: 0,
                    clozeSentence: 'Design choices balance every ___ cleanly.',
                    clozeAnswer: 'trade-off',
                    shadowingPrompt: 'Say aloud: Latency dropped fast, albeit at higher cost.',
                  },
                }),
              },
            },
          ],
        };
      },
    };

    const alphaClient = new OpenRouterAlphaClient({ apiKey: 'sk-eval-contract-test' });
    vi.spyOn(alphaClient, 'callDecisionsApi').mockResolvedValue({
      modelUsed: 'google/gemini-decision-1',
      usedFallback: false,
      latencyMs: 120,
      outcomes: {
        is_safe_educational: { id: 'is_safe_educational', kind: 'noul', boolValue: true, probability: 0.99 },
        is_mostly_english: { id: 'is_mostly_english', kind: 'noul', boolValue: true, probability: 0.98 },
        cefr_level: { id: 'cefr_level', kind: 'choice', choiceValue: 'C1', confidence: 0.9 },
        topic: { id: 'topic', kind: 'choice', choiceValue: 'artificial_intelligence', confidence: 0.92 },
        avoided_conditionals: { id: 'avoided_conditionals', kind: 'noul', boolValue: true, probability: 0.88 },
        overused_basic_modifiers: { id: 'overused_basic_modifiers', kind: 'noul', boolValue: true, probability: 0.85 },
        primary_topic: { id: 'primary_topic', kind: 'choice', choiceValue: 'topic:artificial_intelligence', confidence: 0.92 },
        grammatical_variety: { id: 'grammatical_variety', kind: 'score', scoreValue: 3, confidence: 0.87 },
      },
    });
    vi.spyOn(alphaClient, 'callExtractionsApi').mockResolvedValue({
      modelUsed: 'cloudflare/clairic',
      usedFallback: false,
      latencyMs: 180,
      fields: {
        idioms: {
          items: [{ text: 'trade-off', startUtf16: 39, endUtf16: 48, confidence: 0.94 }],
          pNull: 0.02,
        },
      },
    });

    const report = await runClosedLoopEvals({ client: mockClient, alphaClient });
    expect(report.totalCases).toBe(20);
    expect(report.registerShifterPassed).toBe(7);
    expect(report.dropAnythingPassed).toBe(7);
    expect(report.graphAndMissionPassed).toBe(6);
    expect(report.bilingualSeparationValid).toBe(20);
    expect(report.repeatWordLimitValid).toBe(7);
    expect(report.passed).toBe(true);
  });
});
