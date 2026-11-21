import { describe, expect, it } from 'vitest';
import { handleDropIngestJob } from '../jobs/drop-ingest.js';
import { handleRegisterShifterJob } from '../jobs/register-shifter.js';

describe('Phase A3-A4: Worker Register Shifter & Drop Ingest Jobs (IRN + GLB)', () => {
  it('runs handleRegisterShifterJob cleanly in demo mode for IRN Persian overlay and keeps repeatAloud <= 35 words', async () => {
    const res = await handleRegisterShifterJob(
      {
        jobId: '44444444-4444-4444-8444-444444444444',
        attemptId: '55555555-5555-4555-8555-555555555555',
        accountKey: 'acct-irn-1',
        deviceId: '66666666-6666-4666-8666-666666666666',
        edition: 'irn',
        objectKey: 'users/66666666-6666-4666-8666-666666666666/clips/555/part-1.m4a',
        examTrack: 'ielts_academic',
        sourceTextFallback: 'Today I watched a really good tech movie and it made me think a lot.',
      },
      undefined,
      undefined,
      undefined,
      { allowDemoEvaluator: true },
    );

    expect(res).toBeTruthy();
    expect(res!.gears.casual).toContain('really good');
    expect(res!.gears.academic.length).toBeGreaterThan(20);
    expect(res!.shiftHighlights[0]?.whyFa).toBeTruthy();
    const repeatWords = res!.repeatAloudTarget.targetSentence.split(/\s+/).filter(Boolean);
    expect(repeatWords.length).toBeLessThanOrEqual(35);
  });

  it('runs handleDropIngestJob cleanly for Mode A raw text with valid UTF-16 phrase spans', async () => {
    const res = await handleDropIngestJob(
      {
        jobId: '77777777-7777-4777-8777-777777777777',
        attemptId: '88888888-8888-4888-8888-888888888888',
        dropId: '99999999-9999-4999-8999-999999999999',
        accountKey: 'acct-glb-1',
        deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        edition: 'glb',
        request: {
          inputKind: 'text',
          rawText:
            'Real-world artificial intelligence systems rely on deliberate practice and transparent feedback loops.',
          examTrack: 'ielts_academic',
        },
      },
      undefined,
      undefined,
      undefined,
      { allowDemoEvaluator: true },
    );

    expect(res).toBeTruthy();
    expect(res!.extractedPhrases.length).toBeGreaterThanOrEqual(3);
    const first = res!.extractedPhrases[0]!;
    expect(first.startUtf16).toBe(0);
    expect(first.endUtf16).toBeGreaterThan(0);
    expect(res!.drillPayload.comprehensionOptions.length).toBeGreaterThanOrEqual(2);
  });
});
