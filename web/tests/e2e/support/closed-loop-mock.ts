import type { Page, Route } from '@playwright/test';

export async function attachClosedLoopRoutes(
  page: Page,
  options: { edition: 'glb' | 'irn' },
): Promise<void> {
  const isIrn = options.edition === 'irn';
  const jobs = new Map<string, Record<string, unknown>>();
  const pinnedTopics: Array<{
    nodeId: string;
    edition: 'glb' | 'irn';
    nodeKind: 'interest_topic';
    canonicalKey: string;
    displayLabelEn: string;
    displayLabelFa: string | null;
    masteryScoreMilli: number;
    signalWeightMilli: number;
    evidenceCount: number;
    lastSeenDaySerial: number;
    lastExampleEn: null;
    coachNoteEn: string;
    coachNoteFa: string | null;
    isPinned: boolean;
    isMuted: boolean;
  }> = [
    {
      nodeId: '00000000-0000-4000-8600-000000000003',
      edition: options.edition,
      nodeKind: 'interest_topic',
      canonicalKey: 'topic:artificial_intelligence',
      displayLabelEn: 'Artificial Intelligence',
      displayLabelFa: isIrn ? 'هوش مصنوعی' : null,
      masteryScoreMilli: 640,
      signalWeightMilli: 800,
      evidenceCount: 4,
      lastSeenDaySerial: 20770,
      lastExampleEn: null,
      coachNoteEn: 'Pinned active topic.',
      coachNoteFa: isIrn ? 'موضوع پین‌شده شما' : null,
      isPinned: true,
      isMuted: false,
    },
  ];

  const drops: Array<Record<string, unknown>> = [];
  const dropItem: Record<string, unknown> = {
    dropId: '00000000-0000-4000-8700-000000000001',
    inputKind: 'text',
    sourceDomainOrLabel: 'Paste Snippet',
    title: 'Quantization Trade-offs in Edge AI',
    cefrEstimate: 'C1',
    detectedTopics: ['artificial_intelligence'],
    extractedPhrases: [
      {
        headword: 'albeit',
        ipa: '/ɔːlˈbiː.ɪt/',
        definitionEn: 'Although; even though.',
        glossFa: isIrn ? 'هرچند؛ با وجود اینکه' : null,
        exampleSentence: 'Inference sped up markedly, albeit with slightly higher variance.',
        startUtf16: 62,
        endUtf16: 68,
      },
      {
        headword: 'trade-off',
        ipa: '/ˈtreɪd ɒf/',
        definitionEn: 'A balance achieved between two competing qualities.',
        glossFa: isIrn ? 'بده‌بستان / موازنه' : null,
        exampleSentence: 'Every compression scheme involves an accuracy trade-off.',
        startUtf16: null,
        endUtf16: null,
      },
      {
        headword: 'memory bandwidth',
        ipa: null,
        definitionEn: 'Rate at which data is read from or stored into memory.',
        glossFa: isIrn ? 'پهنای باند حافظه' : null,
        exampleSentence: 'Smaller weights cut memory bandwidth pressure.',
        startUtf16: null,
        endUtf16: null,
      },
    ],
    drillPayload: {
      comprehensionPrompt: 'What is the main benefit of smaller quantized weights?',
      comprehensionOptions: [
        'Lower memory bandwidth usage with tolerable fidelity loss',
        'Guaranteed infinite context windows',
      ],
      correctOptionIndex: 0,
      clozeSentence: 'Latency fell rapidly, ___ at minor quantization noise.',
      clozeAnswer: 'albeit',
      shadowingPrompt: 'Inference sped up markedly, albeit with slightly higher variance.',
    },
    createdAt: '2026-11-21T12:00:00Z',
  };

  let missionCompleted = false;

  const fulfillJson = (route: Route, body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

  await page.route('**/v1/**', async (route) => {
    const req = route.request();
    const pathname = new URL(req.url()).pathname;

    if (pathname === '/v1/quota/me') {
      await fulfillJson(route, {
        isPro: true,
        activePlanId: 'mockza_pro_monthly',
        expiresAt: null,
        source: 'dev_sandbox',
        freeDiagnosticUsed: true,
        dailySpeakingUsed: 0,
        dailySpeakingLimit: 10,
        dailyWritingUsed: 0,
        dailyWritingLimit: 10,
        monthlyUsed: 1,
        monthlyLimit: 150,
        dailyResetAt: '2026-11-22T00:00:00Z',
        monthlyResetAt: '2026-12-01T00:00:00Z',
        advancedQuota: {
          isPro: true,
          freeSampleUsed: false,
          shifterRemainingToday: 9,
          dropsRemainingToday: 9,
          audioDropAllowed: true,
          monthlyRemaining: 149,
        },
      });
      return;
    }

    if (pathname === '/v1/missions/today/refresh') {
      const body = (req.postDataJSON() ?? {}) as { focusTopic?: string };
      await fulfillJson(route, {
        missionId: '00000000-0000-4000-8800-000000000001',
        edition: options.edition,
        examTrack: 'ielts_academic',
        missionDaySerial: 20770,
        status: 'ready',
        focusTopic: body.focusTopic || 'Science & Climate',
        payload: {
          estimatedSeconds: 600,
          warmupCardIds: [],
          forcedTargets: [
            {
              canonicalKey: 'grammar:conditionals',
              phraseEn: 'Had engineers prioritized',
              hintEn: 'Inverted third conditional clause.',
              hintFa: isIrn ? 'ساختار شرطی وارونه نوع سوم.' : null,
            },
            {
              canonicalKey: 'vocab:albeit',
              phraseEn: 'albeit',
              hintEn: 'Concessive linker for C1 nuance.',
              hintFa: isIrn ? 'قید ربط تضاد برای ارتقای نمره.' : null,
            },
          ],
          promptTitle: `${body.focusTopic || 'Climate'} Transfer Mission`,
          promptTextEn: 'Argue the tradeoffs using both forced target structures.',
          promptTextFa: null,
          responseMode: 'writing',
        },
        evaluationResult: null,
      });
      return;
    }

    if (pathname === '/v1/missions/today') {
      await fulfillJson(route, {
        missionId: '00000000-0000-4000-8800-000000000001',
        edition: options.edition,
        examTrack: 'ielts_academic',
        missionDaySerial: 20770,
        status: missionCompleted ? 'completed' : 'ready',
        focusTopic: 'Artificial Intelligence',
        payload: {
          estimatedSeconds: 600,
          warmupCardIds: [],
          forcedTargets: [
            {
              canonicalKey: 'grammar:conditionals',
              phraseEn: 'Had engineers prioritized',
              hintEn: 'Inverted third conditional clause.',
              hintFa: isIrn ? 'ساختار شرطی وارونه نوع سوم.' : null,
            },
            {
              canonicalKey: 'vocab:albeit',
              phraseEn: 'albeit',
              hintEn: 'Concessive linker for C1 nuance.',
              hintFa: isIrn ? 'قید ربط تضاد برای ارتقای نمره.' : null,
            },
          ],
          promptTitle: 'AI Deployment & Conditional Reasoning',
          promptTextEn: 'Argue why edge inference matters, using both forced target structures.',
          promptTextFa: isIrn
            ? 'با استفاده از دو ساختار هدف، درباره مزایا و محدودیت‌های هوش مصنوعی روی دستگاه بنویسید.'
            : null,
          responseMode: 'writing',
        },
        evaluationResult: missionCompleted
          ? {
              feedbackEn: 'Excellent! Both forced structures verified.',
              feedbackFa: isIrn ? 'عالی! هر دو ساختار هدف در پاسخ شما تایید شد.' : null,
              matchedTargets: ['Had engineers prioritized', 'albeit'],
              updatedMasteryDeltaMilli: 80,
            }
          : null,
      });
      return;
    }

    if (pathname.startsWith('/v1/missions/') && pathname.endsWith('/complete')) {
      missionCompleted = true;
      await fulfillJson(route, {
        missionId: '00000000-0000-4000-8800-000000000001',
        edition: options.edition,
        examTrack: 'ielts_academic',
        missionDaySerial: 20770,
        status: 'completed',
        focusTopic: 'Artificial Intelligence',
        payload: {
          estimatedSeconds: 600,
          warmupCardIds: [],
          forcedTargets: [
            {
              canonicalKey: 'grammar:conditionals',
              phraseEn: 'Had engineers prioritized',
              hintEn: 'Inverted third conditional clause.',
              hintFa: isIrn ? 'ساختار شرطی وارونه نوع سوم.' : null,
            },
            {
              canonicalKey: 'vocab:albeit',
              phraseEn: 'albeit',
              hintEn: 'Concessive linker for C1 nuance.',
              hintFa: isIrn ? 'قید ربط تضاد برای ارتقای نمره.' : null,
            },
          ],
          promptTitle: 'AI Deployment & Conditional Reasoning',
          promptTextEn: 'Argue why edge inference matters, using both forced target structures.',
          promptTextFa: isIrn
            ? 'با استفاده از دو ساختار هدف، درباره مزایا و محدودیت‌های هوش مصنوعی روی دستگاه بنویسید.'
            : null,
          responseMode: 'writing',
        },
        evaluationResult: {
          feedbackEn: 'Excellent! Both forced structures verified.',
          feedbackFa: isIrn ? 'عالی! هر دو ساختار هدف در پاسخ شما تایید شد.' : null,
          matchedTargets: ['Had engineers prioritized', 'albeit'],
          updatedMasteryDeltaMilli: 80,
        },
      });
      return;
    }

    if (pathname === '/v1/graph/me' || pathname === '/v1/graph/interests') {
      if (pathname === '/v1/graph/interests' && req.method() === 'PATCH') {
        const body = (req.postDataJSON() ?? {}) as { pinTopics?: string[] };
        for (const t of body.pinTopics ?? []) {
          pinnedTopics.push({
            nodeId: `00000000-0000-4000-8600-${String(pinnedTopics.length + 10).padStart(12, '0')}`,
            edition: options.edition,
            nodeKind: 'interest_topic',
            canonicalKey: `topic:${t.toLowerCase().replace(/\s+/g, '_')}`,
            displayLabelEn: t,
            displayLabelFa: isIrn ? t : null,
            masteryScoreMilli: 500,
            signalWeightMilli: 850,
            evidenceCount: 1,
            lastSeenDaySerial: 20770,
            lastExampleEn: null,
            coachNoteEn: 'Pinned by learner.',
            coachNoteFa: isIrn ? 'توسط شما اضافه شد.' : null,
            isPinned: true,
            isMuted: false,
          });
        }
      }
      await fulfillJson(route, {
        bottlenecks: [
          {
            nodeId: '00000000-0000-4000-8600-000000000001',
            edition: options.edition,
            nodeKind: 'bottleneck',
            canonicalKey: 'lexis:evaluative_overuse_good_bad',
            displayLabelEn: 'Overuses generic "good/bad"',
            displayLabelFa: isIrn ? 'تکرار صفت‌های ساده (good/bad)' : null,
            masteryScoreMilli: 360,
            signalWeightMilli: 900,
            evidenceCount: 5,
            lastSeenDaySerial: 20770,
            lastExampleEn: 'The model was really good.',
            coachNoteEn: 'Prefer substantial, pivotal, or compelling.',
            coachNoteFa: isIrn ? 'از صفت‌های دقیق‌تر مثل substantial استفاده کنید.' : null,
            isPinned: false,
            isMuted: false,
          },
        ],
        targetStructures: [
          {
            nodeId: '00000000-0000-4000-8600-000000000002',
            edition: options.edition,
            nodeKind: 'target_structure',
            canonicalKey: 'vocab:albeit',
            displayLabelEn: 'albeit',
            displayLabelFa: null,
            masteryScoreMilli: 810,
            signalWeightMilli: 640,
            evidenceCount: 3,
            lastSeenDaySerial: 20770,
            lastExampleEn: null,
            coachNoteEn: null,
            coachNoteFa: null,
            isPinned: false,
            isMuted: false,
          },
        ],
        interestTopics: pinnedTopics,
        totalEvidenceCount: 9,
      });
      return;
    }

    if (pathname === '/v1/register-shifter/shift') {
      const jobId = 'adv-job-shift-1';
      jobs.set(jobId, {
        jobId,
        status: 'completed',
        advancedResult: {
          runId: '00000000-0000-4000-8500-000000000001',
          examTrack: 'ielts_academic',
          sourceTranscript: 'This movie was really good and had cool scenes.',
          gears: {
            casual: 'This movie was really good and had cool scenes.',
            workplace: 'The presentation delivered strong pacing and compelling technical demos.',
            academic:
              'The documentary achieved remarkable analytical depth, albeit relying on compact pacing.',
          },
          shiftHighlights: [
            {
              casualPhrase: 'really good',
              upgradedPhrase: 'remarkable analytical depth',
              targetGear: 'academic',
              whyEn: 'Replaces generic modifier with Band 8.5 Lexical Resource collocation.',
              whyFa: isIrn ? 'جایگزینی صفت کلی good با ترکیب آکادمیک نمره ۸.۵.' : null,
            },
          ],
          repeatAloudTarget: {
            gearLevel: 2,
            targetSentence:
              'The documentary achieved remarkable analytical depth, albeit relying on compact pacing.',
            targetPhrases: ['remarkable analytical depth', 'albeit'],
          },
        },
      });
      await fulfillJson(route, { jobId, status: 'queued' }, 202);
      return;
    }

    if (pathname.startsWith('/v1/register-shifter/') && pathname.endsWith('/verify-repeat')) {
      await fulfillJson(route, {
        fluencyScore1To5: 5,
        matchedTargets: ['remarkable analytical depth', 'albeit'],
      });
      return;
    }

    if (pathname === '/v1/drop/presign-media') {
      const body = (req.postDataJSON() ?? {}) as { files?: Array<{ contentType: string }> };
      const count = Math.max(1, body.files?.length ?? 1);
      await fulfillJson(route, {
        items: Array.from({ length: count }, (_, idx) => ({
          objectKey: `drops/e2e/item-${idx}.webp`,
          uploadUrl: `${new URL(req.url()).origin}/v1/uploads/signed-put`,
        })),
      });
      return;
    }

    if (pathname === '/v1/uploads/signed-put') {
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    if (pathname === '/v1/drop/ingest') {
      drops.splice(0, drops.length, dropItem);
      const jobId = 'adv-job-drop-1';
      jobs.set(jobId, {
        jobId,
        status: 'completed',
        advancedResult: dropItem,
      });
      await fulfillJson(route, { jobId, status: 'queued' }, 202);
      return;
    }

    if (pathname === '/v1/drop/history') {
      await fulfillJson(route, { items: drops });
      return;
    }

    if (pathname === `/v1/drop/${dropItem['dropId']}`) {
      if (req.method() === 'DELETE') {
        drops.length = 0;
        await fulfillJson(route, { deleted: true });
        return;
      }
      await fulfillJson(route, dropItem);
      return;
    }

    if (pathname.startsWith('/v1/jobs/adv-')) {
      const id = decodeURIComponent(pathname.replace('/v1/jobs/', ''));
      await fulfillJson(route, jobs.get(id) ?? { jobId: id, status: 'queued' });
      return;
    }

    await route.fallback();
  });
}
