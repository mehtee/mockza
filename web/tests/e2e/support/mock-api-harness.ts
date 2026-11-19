import { createHash } from 'node:crypto';
import type { Page } from '@playwright/test';

function stableJsonStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : stableJsonStringify(item))).join(',')}]`;
  }
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>;
    const keys = Object.keys(rec).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const parts: string[] = [];
    for (const k of keys) {
      if (rec[k] === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${stableJsonStringify(rec[k])}`);
    }
    return `{${parts.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function computeBundleSha256(sections: unknown, questions: unknown): string {
  const encoded = stableJsonStringify({
    questions: questions ?? [],
    sections: sections ?? [],
  });
  return createHash('sha256').update(encoded).digest('hex');
}

export interface E2eHarnessState {
  edition: 'glb' | 'irn';
  simulateDesktopConflictOnNextLogin: boolean;
  isPro: boolean;
  diagnosticCount: number;
  requests: { method: string; path: string }[];
  sessions: {
    sessionId: string;
    deviceId: string;
    deviceIdShort: string;
    slotKind: 'mobile' | 'desktop_web';
    platform: 'android' | 'web_desktop';
    appSurface: 'mobile_app' | 'web_app';
    deviceName: string;
    locationLabel: string;
    ipMasked: string | null;
    authMethod: 'email' | 'sms_otp';
    isCurrentDevice: boolean;
    createdAt: string;
    lastSeenAt: string;
  }[];
  jobs: Map<string, Record<string, unknown>>;
}

function buildDiagnosticBlocks(skill: 'reading' | 'listening') {
  const tiers = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
  return tiers.map((tier) => {
    const id = `diag-${skill}-${tier.toLowerCase()}-1`;
    return {
      blockId: id,
      skill,
      tier,
      scenarioId: `${tier}-1`,
      title: `${tier} Coastal Grid Storage`,
      ...(skill === 'reading'
        ? {
            passageText: `${tier} Passage: Coastal towns deploy salt-tolerant battery arrays to keep clinics powered during summer cyclones.`,
          }
        : {
            scriptText: `${tier} Audio: The archive desk closes at five thirty on Fridays.`,
            mediaUrl: null,
            durationSeconds: 30,
          }),
      minRequiredSeconds: 0,
      questions: [
        {
          questionId: `${id}-q1`,
          prompt: `(${tier}) Primary fact stated in the brief`,
          options: ['Secondary footnote', 'Key mechanism in focus', 'Unrelated exception'],
          correctIndex: 1,
          focusTag: `${tier.toLowerCase()}_detail`,
        },
        {
          questionId: `${id}-q2`,
          prompt: `(${tier}) Practical outcome summarized`,
          options: ['Reliable clinic backup power', 'Complete grid shutdown', 'Canceled schedule'],
          correctIndex: 0,
          focusTag: `${tier.toLowerCase()}_inference`,
        },
      ],
    };
  });
}

function buildDiagnosticBank() {
  return {
    policyVersion: '2026-11-diag-v1',
    contentVersion: 'diag-e2e.v1',
    preflightAudioUrl: null,
    budgetSeconds: {
      intro: 45,
      reading: 210,
      listening: 150,
      writing: 240,
      speaking: 120,
      transitions: 60,
      collectionTotal: 780,
      resultsWindow: 120,
      total: 900,
    },
    workedExamples: {
      reading: {
        skill: 'reading',
        passageOrTranscript: 'Short research summary on urban cooling.',
        questionPrompt: 'Choose the statement matching the excerpt.',
        options: ['Costs tripled', 'Green roofs lower cooling loads', 'No effect observed'],
        correctIndex: 1,
        explanation: 'Match synonyms carefully rather than repeating single words.',
      },
      listening: {
        skill: 'listening',
        passageOrTranscript: 'Speaker moves the lab to Monday.',
        questionPrompt: 'Identify the speaker final recommendation.',
        options: ['Monday morning', 'Friday afternoon', 'Cancel session'],
        correctIndex: 0,
        explanation: 'Watch for contrast markers.',
      },
    },
    readingBlocks: buildDiagnosticBlocks('reading'),
    listeningBlocks: buildDiagnosticBlocks('listening'),
    writingPrompt: {
      promptId: 'diag-w-01',
      title: 'Quick Opinion Paragraph',
      basePrompt: 'Should city centers allocate wider lanes for bicycles?',
      suggestedWordsLabel: 'Write ~40-80 words.',
      supportiveFollowUp: 'Add one short concrete example.',
      extensionFollowUp: 'Evaluate safety trade-offs.',
    },
    speakingPrompt: {
      promptId: 'diag-s-01',
      title: 'Quick Spoken Answer',
      basePrompt: 'Describe a quiet neighborhood park you enjoy visiting.',
      cueLabels: ['Where it is', 'How often you visit', 'Why it helps focus'],
      supportiveFollowUp: 'What sounds do you notice there?',
      extensionFollowUp: 'Should cities invest more in green corridors?',
    },
    examScaleInfo: [
      { examId: 'ielts_academic', label: 'IELTS (0-9)', summary: '0.5 band steps.' },
      { examId: 'toefl_ibt', label: 'TOEFL iBT', summary: '1.0-6.0 + /120 bridge.' },
    ],
  };
}

function makePackBundle(
  edition: 'glb' | 'irn',
  packId: string,
  examId: string,
  skill: string,
) {
  let sections: Record<string, unknown>[] = [];
  let questions: Record<string, unknown>[] = [];
  let title = `${examId} ${skill}`;

  if (skill === 'reading') {
    title = 'Municipal Microgrids Reading';
    const contentText =
      'Municipal microgrids stabilize hospital feeders during extreme heatwaves. Engineers recorded forty percent fewer blackouts.';
    sections = [
      {
        sectionId: 'r-sec-1',
        sectionIndex: 0,
        sectionType: 'reading_passage',
        title: 'Passage 1: Microgrids',
        instructions: 'Answer Q1 and Q2.',
        durationSeconds: 900,
        wordCount: 16,
        contentText,
      },
    ];
    questions = [
      {
        questionId: 'q-r1',
        sectionId: 'r-sec-1',
        questionNumber: 1,
        questionType: 'tfng',
        prompt: 'Microgrids stabilize hospital feeders during heatwaves.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        acceptedAnswers: ['TRUE'],
        evidence: { exactQuote: 'stabilize hospital feeders during extreme heatwaves' },
      },
      {
        questionId: 'q-r2',
        sectionId: 'r-sec-1',
        questionNumber: 2,
        questionType: 'summary_gap_fill',
        prompt: 'Engineers recorded forty percent fewer ______.',
        options: null,
        acceptedAnswers: ['blackouts'],
        maxWords: 2,
        evidence: { exactQuote: 'forty percent fewer blackouts' },
      },
    ];
  } else if (skill === 'listening') {
    title = 'Campus Orientation Listening';
    sections = [
      {
        sectionId: 'l-sec-1',
        sectionIndex: 0,
        sectionType: 'listening_part',
        title: 'Part 1: Orientation',
        instructions: 'Listen once in Exam Mode.',
        durationSeconds: 600,
        wordCount: 12,
        contentText: '',
        mediaUrl: null,
        transcript: [
          {
            startMs: 0,
            endMs: 12000,
            speaker: 'Coordinator',
            text: 'Welcome to Room B. Badges unlock after orientation.',
          },
        ],
      },
    ];
    questions = [
      {
        questionId: 'q-l1',
        sectionId: 'l-sec-1',
        questionNumber: 1,
        questionType: 'form_completion',
        prompt: 'Room: Room ______',
        options: null,
        acceptedAnswers: ['B'],
        maxWords: 1,
      },
    ];
  } else if (skill === 'writing') {
    title = examId === 'pte_academic' ? 'PTE Academic Writing' : 'IELTS Writing Task 1 & 2';
    sections =
      examId === 'pte_academic'
        ? [
            {
              sectionId: 'w-pte-swt',
              sectionIndex: 0,
              sectionType: 'pteSummarizeWrittenText',
              title: 'Summarize Written Text (1 Sentence)',
              instructions: 'Summarize in one single sentence (5–75 words).',
              durationSeconds: 600,
              wordCount: 25,
              contentText: 'Coastal wetlands shield cities from seasonal storm surges.',
              metadata: { taskType: 'pteSummarizeWrittenText', minWords: 5, maxWords: 75 },
            },
          ]
        : [
            {
              sectionId: 'w-sec-1',
              sectionIndex: 0,
              sectionType: 'task2Essay',
              title: 'Task 2: Urban Rail Investment',
              instructions: 'Write at least 250 words.',
              durationSeconds: 2400,
              wordCount: 20,
              contentText: 'Should municipal budgets prioritize public transit over highways?',
              metadata: { taskType: 'task2Essay', minWords: 250 },
            },
          ];
  } else {
    title = examId === 'toefl_ibt' ? 'TOEFL Take an Interview' : 'IELTS Speaking Part 2';
    sections = [
      {
        sectionId: 'sp-sec-1',
        sectionIndex: 0,
        sectionType: 'speaking_part',
        title: examId === 'toefl_ibt' ? 'Interview Question' : 'Cue Card Turn',
        instructions: 'Respond clearly into your microphone.',
        durationSeconds: 45,
        wordCount: 15,
        contentText: 'Why do learners benefit from quiet split-pane study spaces?',
        metadata: { prepSeconds: examId === 'toefl_ibt' ? 0 : 60, responseSeconds: 45 },
      },
    ];
  }

  const sha256 = computeBundleSha256(sections, questions);
  const trackMap: Record<string, string> = {
    ielts_academic: 'academic',
    ielts_general: 'general',
    toefl_ibt: 'toefl',
    pte_academic: 'pte',
    det: 'det',
  };
  const pack = {
    packId,
    edition,
    examId,
    track: trackMap[examId] ?? 'academic',
    skill,
    title,
    description: `${title} clean-room pack`,
    durationSeconds: 1800,
    questionCount: Math.max(1, questions.length),
    isFreeSample: true,
    version: '1.0.0',
    sha256,
    byteLength: 2048,
    downloadUrl: `/v1/exams/${packId}`,
    contentOrigin: 'authored_original',
    humanQaReviewed: true,
    accent: null,
    mediaUrl: null,
  };
  return { pack, sections, questions };
}

export async function attachE2eApiHarness(
  page: Page,
  options: { readonly edition: 'glb' | 'irn' },
): Promise<E2eHarnessState> {
  const nowIso = new Date().toISOString();
  const state: E2eHarnessState = {
    edition: options.edition,
    simulateDesktopConflictOnNextLogin: false,
    isPro: false,
    diagnosticCount: 0,
    requests: [],
    sessions: [
      {
        sessionId: 'sess-mobile-1',
        deviceId: 'dev-mobile-1',
        deviceIdShort: 'dev-mob1',
        slotKind: 'mobile',
        platform: 'android',
        appSurface: 'mobile_app',
        deviceName: 'Pixel 9 Phone',
        locationLabel: 'San Jose, US',
        ipMasked: '203.0.113.*',
        authMethod: 'email',
        isCurrentDevice: false,
        createdAt: nowIso,
        lastSeenAt: nowIso,
      },
    ],
    jobs: new Map(),
  };

  const bundles = new Map<string, ReturnType<typeof makePackBundle>>([
    ['ielts-acad-reading-seed-01', makePackBundle(options.edition, 'ielts-acad-reading-seed-01', 'ielts_academic', 'reading')],
    ['ielts-listening-seed-01', makePackBundle(options.edition, 'ielts-listening-seed-01', 'ielts_academic', 'listening')],
    ['ielts-writing-seed-01', makePackBundle(options.edition, 'ielts-writing-seed-01', 'ielts_academic', 'writing')],
    ['ielts-speaking-seed-01', makePackBundle(options.edition, 'ielts-speaking-seed-01', 'ielts_academic', 'speaking')],
    ['pte-writing-pack-01', makePackBundle(options.edition, 'pte-writing-pack-01', 'pte_academic', 'writing')],
    ['toefl-speaking-pack-01', makePackBundle(options.edition, 'toefl-speaking-pack-01', 'toefl_ibt', 'speaking')],
  ]);

  const jsonOk = (data: unknown, status = 200) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });

  await page.route('**/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;
    state.requests.push({ method: req.method(), path: pathname });

    if (pathname === '/v1/auth/providers') {
      await route.fulfill(
        jsonOk({
          emailPasswordEnabled: true,
          smsOtpEnabled: state.edition === 'irn',
          smsOtp: {
            enabled: state.edition === 'irn',
            mode: state.edition === 'irn' ? 'dev_sandbox' : 'disabled',
          },
          google: {
            enabled: state.edition === 'glb',
            mode: state.edition === 'glb' ? 'dev_sandbox' : 'disabled',
          },
          apple: {
            enabled: state.edition === 'glb',
            mode: state.edition === 'glb' ? 'dev_sandbox' : 'disabled',
          },
          devicePolicy: {
            maxMobileSessions: 1,
            maxDesktopSessions: 1,
            summaryText: '1 Phone + 1 Desktop Browser',
          },
        }),
      );
      return;
    }

    if (pathname === '/v1/auth/anonymous') {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      const hasBoundDesktopSecret = body['deviceSecret'] === 'sec-desktop-1';
      await route.fulfill(
        jsonOk({
          accessToken: hasBoundDesktopSecret ? 'tok-desktop-1' : 'tok-anon',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          deviceId: hasBoundDesktopSecret ? 'dev-desktop-current' : 'dev-anon-1',
          deviceSecret: hasBoundDesktopSecret ? 'sec-desktop-1' : 'sec-anon-1',
          linkedUserId: hasBoundDesktopSecret ? 'user-e2e-1' : null,
          linkedEmail:
            hasBoundDesktopSecret && state.edition === 'glb' ? 'learner@mockza.test' : null,
        }),
      );
      return;
    }

    if (pathname === '/v1/auth/login' || pathname === '/v1/auth/register' || pathname === '/v1/auth/oauth' || pathname === '/v1/auth/otp/verify') {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      if (state.simulateDesktopConflictOnNextLogin && !body['replaceSessionId']) {
        await route.fulfill(
          jsonOk(
            {
              code: 'device_slot_limit_reached',
              conflictCode: 'DEVICE_SLOT_OCCUPIED',
              message: 'Another desktop browser already occupies your desktop slot.',
              occupyingDevice: {
                sessionId: 'sess-desktop-old',
                deviceId: 'dev-desktop-old',
                deviceName: 'Existing Desktop Firefox',
                slotKind: 'desktop_web',
                locationLabel: 'Austin, US',
                ipCountry: 'US',
                city: 'Austin',
                lastSeenAt: nowIso,
              },
            },
            409,
          ),
        );
        return;
      }

      state.simulateDesktopConflictOnNextLogin = false;
      const newSession = {
        sessionId: 'sess-desktop-current',
        deviceId: String(body['deviceId'] ?? 'dev-desktop-current'),
        deviceIdShort: 'desk-e2e',
        slotKind: 'desktop_web' as const,
        platform: 'web_desktop' as const,
        appSurface: 'web_app' as const,
        deviceName: 'Desktop Chrome Browser',
        locationLabel: 'San Jose, US',
        ipMasked: '198.51.100.*',
        authMethod: (state.edition === 'irn' ? 'sms_otp' : 'email') as 'email' | 'sms_otp',
        isCurrentDevice: true,
        createdAt: nowIso,
        lastSeenAt: nowIso,
      };
      state.sessions = [
        ...state.sessions.filter((s) => s.slotKind !== 'desktop_web'),
        newSession,
      ];
      await route.fulfill(
        jsonOk({
          accessToken: 'tok-desktop-1',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          deviceId: newSession.deviceId,
          deviceSecret: 'sec-desktop-1',
          user: {
            userId: 'user-e2e-1',
            email: state.edition === 'irn' ? null : String(body['email'] ?? 'learner@mockza.test'),
            phoneE164: state.edition === 'irn' ? String(body['phoneE164'] ?? '+989121234567') : null,
            displayName: 'E2E Learner',
            linkedProviders: [state.edition === 'irn' ? 'sms_otp' : 'email'],
            isPro: state.isPro,
          },
          currentSession: { sessionId: newSession.sessionId },
        }),
      );
      return;
    }

    if (pathname === '/v1/auth/otp/request') {
      await route.fulfill(jsonOk({ retryAfterSec: 60, devOtpHint: '123456' }));
      return;
    }

    if (pathname === '/v1/account/me') {
      const currentSession = state.sessions.find((s) => s.isCurrentDevice) ?? state.sessions[0];
      const hasDesktopAuth = Boolean(currentSession);
      await route.fulfill(
        jsonOk({
          isAuthenticated: hasDesktopAuth,
          user: hasDesktopAuth
            ? {
                userId: 'user-e2e-1',
                email: state.edition === 'glb' ? 'learner@mockza.test' : null,
                phoneE164: state.edition === 'irn' ? '+989121234567' : null,
                displayName: 'E2E Learner',
                linkedProviders: [state.edition === 'irn' ? 'sms_otp' : 'email'],
                isPro: state.isPro,
                acceptedDevicePolicyAt: nowIso,
              }
            : null,
          currentDeviceId: currentSession?.deviceId ?? 'dev-anon-1',
          sessions: state.sessions,
        }),
      );
      return;
    }

    if (pathname === '/v1/account/devices') {
      await route.fulfill(
        jsonOk({
          isAuthenticated: state.sessions.length > 0,
          user: null,
          currentDeviceId: state.sessions[0]?.deviceId ?? 'dev-anon-1',
          sessions: state.sessions,
        }),
      );
      return;
    }

    if (pathname.startsWith('/v1/account/devices/')) {
      const targetId = decodeURIComponent(pathname.split('/').pop() ?? '');
      const removed = state.sessions.filter(
        (s) => s.deviceId === targetId || s.sessionId === targetId,
      );
      const signedOutCurrentDevice = removed.some((s) => s.isCurrentDevice);
      state.sessions = state.sessions.filter(
        (s) => s.deviceId !== targetId && s.sessionId !== targetId,
      );
      await route.fulfill(
        jsonOk({
          success: true,
          revokedDeviceIds: removed.map((s) => s.deviceId),
          signedOutCurrentDevice,
          sessions: state.sessions,
        }),
      );
      return;
    }

    if (pathname === '/v1/account/device-policy-consent') {
      await route.fulfill(jsonOk({ recorded: true }));
      return;
    }

    if (pathname === '/v1/account' && req.method() === 'DELETE') {
      await route.fulfill(jsonOk({ deleted: true, receiptId: 'del-e2e-1', deletedAt: nowIso }));
      return;
    }

    if (pathname === '/v1/quota/me') {
      await route.fulfill(
        jsonOk({
          isPro: state.isPro,
          freeDiagnosticUsed: state.diagnosticCount > 0,
          activePlanId: state.isPro ? 'mockza_pro_monthly' : null,
          expiresAt: null,
          source: state.isPro ? 'dev_sandbox' : 'free_tier',
          dailySpeakingUsed: 0,
          dailySpeakingLimit: state.isPro ? 10 : 2,
          dailyWritingUsed: 0,
          dailyWritingLimit: state.isPro ? 10 : 2,
          monthlyUsed: 0,
          monthlyLimit: state.isPro ? 150 : 6,
          dailyResetAt: nowIso,
          monthlyResetAt: nowIso,
        }),
      );
      return;
    }

    if (pathname === '/v1/billing/glb/checkout') {
      await route.fulfill(
        jsonOk({
          redirectUrl: '/app/paywall?session_id=stripe_e2e_ok',
          sessionId: 'stripe_e2e_ok',
        }),
      );
      return;
    }

    if (pathname === '/v1/billing/glb/verify' || pathname === '/v1/billing/zarinpal/verify') {
      state.isPro = true;
      await route.fulfill(
        jsonOk({
          isPro: true,
          activePlanId: 'mockza_pro_monthly',
          expiresAt: null,
          source: state.edition === 'irn' ? 'zarinpal' : 'stripe_web',
        }),
      );
      return;
    }

    if (pathname === '/v1/billing/zarinpal/request') {
      await route.fulfill(
        jsonOk({
          authority: 'A000000000000000000000000000e2e',
          redirectUrl: '/app/paywall?Authority=A000000000000000000000000000e2e&Status=OK',
          paymentUrl: '/app/paywall?Authority=A000000000000000000000000000e2e&Status=OK',
          amountRial: 9900000,
        }),
      );
      return;
    }

    if (pathname === '/v1/diagnostic/packs') {
      await route.fulfill(jsonOk(buildDiagnosticBank()));
      return;
    }

    const makeSkillOutcome = (
      skill: 'reading' | 'listening' | 'writing' | 'speaking',
      status: 'provisional' | 'skipped' | 'insufficient_evidence',
      level: string | null,
      weakness: string | null,
    ) => ({
      skill,
      status,
      suggestedPracticeLevel: level,
      suggestedTier: status === 'provisional' ? 'B2' : undefined,
      observations: [`${skill} diagnostic recorded.`],
      weaknessFocus: weakness,
      recommendedDrillType: weakness ?? undefined,
      quotaRefunded: false,
      reducedSampling: status !== 'provisional',
      hasContradictoryEvidence: false,
    });

    if (pathname === '/v1/diagnostic/sessions' && req.method() === 'POST') {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      const diagId = String(body['diagId'] ?? '00000000-0000-4000-8100-000000000001');
      const sessionPayload = {
        diagId,
        examId: body['examId'] ?? 'ielts_academic',
        mode: body['mode'] ?? 'standard',
        policyVersion: '2026-11-diag-v1',
        contentVersion: 'diag-e2e.v1',
        status: 'in_progress',
        startedAt: nowIso,
        collectionDeadlineAt: new Date(Date.now() + 780_000).toISOString(),
        resultsDeadlineAt: new Date(Date.now() + 900_000).toISOString(),
        resultRevision: 1,
        skills: {
          reading: makeSkillOutcome('reading', 'insufficient_evidence', null, null),
          listening: makeSkillOutcome('listening', 'insufficient_evidence', null, null),
          writing: makeSkillOutcome('writing', 'insufficient_evidence', null, null),
          speaking: makeSkillOutcome('speaking', 'insufficient_evidence', null, null),
        },
        recommendedFirstAction: {
          title: 'Start Diagnostic Drills',
          description: 'Begin with a focused 3-minute diagnostic follow-up.',
          drillType: 'speed_tfng',
          targetSkill: 'reading',
        },
      };
      state.jobs.set(`diag:${diagId}`, sessionPayload);
      await route.fulfill(jsonOk(sessionPayload));
      return;
    }

    if (pathname.endsWith('/submit') && pathname.includes('/v1/diagnostic/sessions/')) {
      const diagId = decodeURIComponent(
        pathname.replace('/v1/diagnostic/sessions/', '').replace('/submit', ''),
      );
      state.diagnosticCount += 1;
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      const prev = state.jobs.get(`diag:${diagId}`) ?? {};
      const speakingObj = (body['speaking'] ?? {}) as Record<string, unknown>;
      const writingObj = (body['writing'] ?? {}) as Record<string, unknown>;
      const completed = {
        ...prev,
        diagId,
        examId: prev['examId'] ?? 'ielts_academic',
        mode: prev['mode'] ?? 'standard',
        policyVersion: '2026-11-diag-v1',
        contentVersion: 'diag-e2e.v1',
        status: 'completed',
        startedAt: prev['startedAt'] ?? nowIso,
        collectionDeadlineAt: prev['collectionDeadlineAt'] ?? new Date(Date.now() + 780_000).toISOString(),
        resultsDeadlineAt: prev['resultsDeadlineAt'] ?? new Date(Date.now() + 900_000).toISOString(),
        resultRevision: 2,
        skills: {
          reading: makeSkillOutcome('reading', 'provisional', 'Suggested practice: Band 6.5 (B2-C1 focus)', 'speed_tfng'),
          listening: makeSkillOutcome('listening', 'provisional', 'Suggested practice: Band 6.5 (B2-C1 focus)', 'form_completion'),
          writing: makeSkillOutcome(
            'writing',
            writingObj['skipped'] ? 'skipped' : 'provisional',
            writingObj['skipped'] ? null : 'Suggested practice: Band 6.5 (B2-C1 focus)',
            writingObj['skipped'] ? null : 'lexical_precision',
          ),
          speaking: makeSkillOutcome(
            'speaking',
            speakingObj['skipped'] ? 'skipped' : 'provisional',
            speakingObj['skipped'] ? null : 'Suggested practice: Band 6.5 (B2-C1 focus)',
            speakingObj['skipped'] ? null : 'pronunciation_rhythm',
          ),
        },
        recommendedFirstAction: {
          title: 'Sharpen TFNG Precision',
          description: 'Practice true/false/not given speed drills.',
          drillType: 'speed_tfng',
          targetSkill: 'reading',
        },
      };
      state.jobs.set(`diag:${diagId}`, completed);
      await route.fulfill(jsonOk(completed));
      return;
    }

    if (pathname.startsWith('/v1/diagnostic/sessions/') && req.method() === 'GET') {
      const diagId = decodeURIComponent(pathname.replace('/v1/diagnostic/sessions/', ''));
      const found = state.jobs.get(`diag:${diagId}`);
      await route.fulfill(jsonOk(found ?? { diagId, status: 'completed', resultRevision: 1 }));
      return;
    }

    if (pathname === '/v1/catalog/manifest') {
      await route.fulfill(
        jsonOk({
          packs: Array.from(bundles.values()).map((b) => b.pack),
        }),
      );
      return;
    }

    if (pathname.startsWith('/v1/exams/')) {
      const packId = decodeURIComponent(pathname.replace('/v1/exams/', ''));
      const found = bundles.get(packId) ?? makePackBundle(state.edition, packId, 'ielts_academic', 'reading');
      await route.fulfill(jsonOk(found));
      return;
    }

    if (pathname === '/v1/drills') {
      await route.fulfill(
        jsonOk({
          drills: [
            {
              drillId: 'drill-tfng-e2e-1',
              examId: 'ielts_academic',
              skill: 'reading',
              title: 'TFNG Precision Drill',
              estimatedMinutes: 3,
              items: [
                {
                  itemId: 'd-item-1',
                  questionType: 'tfng',
                  prompt: 'Thermal mass slows afternoon temperature spikes inside brick courtyards.',
                  options: ['TRUE', 'FALSE', 'NOT GIVEN'],
                  acceptedAnswers: ['TRUE'],
                  explanation: 'Brick mass absorbs heat and buffers afternoon peaks.',
                },
              ],
            },
          ],
        }),
      );
      return;
    }

    if (pathname === '/v1/vocab/deck') {
      await route.fulfill(
        jsonOk({
          totalCount: 2,
          cards: [
            {
              cardId: 'voc-e2e-1',
              headword: 'ubiquitous',
              ipa: '/juːˈbɪk.wɪ.təs/',
              definition: 'Present, appearing, or found everywhere.',
              glossFa: 'همه‌جایی و فراگیر',
              topicTag: 'Academic Environment',
              contextSentence: 'Microgrids have become ubiquitous across island municipalities.',
              paraphrases: ['omnipresent', 'pervasive'],
              collocations: ['ubiquitous presence', 'become ubiquitous'],
              easeFactorMilli: 2500,
            },
            {
              cardId: 'voc-e2e-2',
              headword: 'mitigate',
              ipa: '/ˈmɪt.ɪ.ɡeɪt/',
              definition: 'Make less severe, serious, or painful.',
              glossFa: 'کاهش دادن شدت',
              topicTag: 'Climate & Policy',
              contextSentence: 'Coastal wetlands mitigate storm surges during cyclones.',
              paraphrases: ['alleviate', 'attenuate'],
              collocations: ['mitigate risk', 'mitigate impact'],
              easeFactorMilli: 2500,
            },
          ],
        }),
      );
      return;
    }

    if (pathname === '/v1/evaluate/explain-question') {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      await route.fulfill(
        jsonOk({
          cached: false,
          explanation:
            state.edition === 'irn'
              ? 'پاسخ صحیح مستقیماً بر اساس جمله داخل متن تایید می‌شود.'
              : 'The credited key aligns directly with the exact sentence inside the passage.',
          evidenceQuote: 'forty percent fewer blackouts',
          whyWrongOptions: [
            { option: String(body['userAnswer'] || 'Distractor'), reason: 'Not supported by text.' },
          ],
        }),
      );
      return;
    }

    if (pathname === '/v1/evaluate/writing') {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      const jobId = '00000000-0000-4000-8200-000000000001';
      const essay = String(body['essayText'] ?? '');
      state.jobs.set(jobId, {
        jobId,
        attemptId: body['attemptId'],
        status: 'completed',
        createdAt: nowIso,
        updatedAt: nowIso,
        result: {
          attemptId: body['attemptId'],
          overallBand: 7.0,
          isEstimated: true,
          criteria: [
            { code: 'TR', label: 'Task Response', band: 7.0, evidenceExcerpt: essay.slice(0, 20), feedbackNote: 'Clear thesis stance.' },
            { code: 'CC', label: 'Coherence & Cohesion', band: 7.0, evidenceExcerpt: essay.slice(0, 20), feedbackNote: 'Well linked.' },
            { code: 'LR', label: 'Lexical Resource', band: 7.0, evidenceExcerpt: essay.slice(0, 20), feedbackNote: 'Precise academic register.' },
            { code: 'GRA', label: 'Grammar', band: 7.0, evidenceExcerpt: essay.slice(0, 20), feedbackNote: 'Strong control.' },
          ],
          inlineEdits:
            essay.length >= 10
              ? [
                  {
                    editId: 'edit-1',
                    startOffset: 0,
                    endOffset: Math.min(12, essay.length),
                    originalText: essay.slice(0, Math.min(12, essay.length)),
                    suggestedText: 'Critically, rail',
                    criterionCode: 'LR',
                    rationale: 'Sharper academic phrasing raises Lexical Resource.',
                  },
                ]
              : [],
          modelRewrite: {
            targetBandDelta: 1.5,
            title: 'Band 8.5 Upgrade',
            rewrittenText: `${essay} Moreover, dedicated transit corridors curb congestion.`,
            preservedIdeasNote: 'Preserves your core argument.',
          },
          vocabUpgrades: [
            {
              id: 'vu-e2e-1',
              term: 'mitigate',
              ipa: '/ˈmɪt.ɪ.ɡeɪt/',
              definition: 'Reduce the severity of harm',
              glossFa: state.edition === 'irn' ? 'کاهش دادن شدت' : undefined,
              contextSentence: 'Rail transit helps mitigate peak congestion.',
              paraphrases: ['alleviate'],
              bandRationale: 'High-value policy verb.',
            },
          ],
          modelId: 'e2e-eval-v1',
          rubricVersion: 'v1',
        },
      });
      await route.fulfill(jsonOk({ jobId, status: 'queued' }));
      return;
    }

    if (pathname.startsWith('/v1/jobs/')) {
      const jobId = decodeURIComponent(pathname.replace('/v1/jobs/', ''));
      const found = state.jobs.get(jobId);
      if (found) {
        await route.fulfill(jsonOk(found));
      } else {
        await route.fulfill(
          jsonOk({ jobId, attemptId: '00000000-0000-4000-8200-000000000099', status: 'queued', createdAt: nowIso, updatedAt: nowIso }),
        );
      }
      return;
    }

    if (pathname === '/v1/evaluate/speaking') {
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      const jobId = '00000000-0000-4000-8300-000000000001';
      state.jobs.set(jobId, {
        jobId,
        attemptId: body['attemptId'],
        status: 'completed',
        createdAt: nowIso,
        updatedAt: nowIso,
        result: {
          attemptId: body['attemptId'],
          overallBand: 7.0,
          isEstimated: true,
          transcript: 'Quiet split-pane workspaces help students concentrate without switching windows.',
          criteria: [
            { code: 'FC', label: 'Fluency & Coherence', band: 7.0, evidenceExcerpt: 'help students concentrate', feedbackNote: 'Natural pacing.' },
            { code: 'LR', label: 'Lexical Resource', band: 7.0, evidenceExcerpt: 'split-pane workspaces', feedbackNote: 'Appropriate topic lexis.' },
            { code: 'GRA', label: 'Grammar', band: 7.0, evidenceExcerpt: 'without switching windows', feedbackNote: 'Clean complex clause.' },
            { code: 'PR', label: 'Pronunciation', band: 7.0, evidenceExcerpt: 'clear articulation', feedbackNote: 'Steady stress.' },
          ],
          inlineEdits: [],
          modelRewrite: {
            targetBandDelta: 1.0,
            title: 'Band 8.0 Spoken Upgrade',
            rewrittenText: 'Dedicated split-screen study workspaces eliminate cognitive switching costs during timed reading drills.',
            preservedIdeasNote: 'Retains your focus argument.',
          },
          vocabUpgrades: [],
          modelId: 'e2e-eval-v1',
          rubricVersion: 'v1',
        },
      });
      await route.fulfill(jsonOk({ jobId, status: 'queued' }));
      return;
    }

    if (pathname === '/v1/uploads/presign') {
      await route.fulfill(
        jsonOk({
          uploadUrl: `${url.origin}/v1/mock-s3-put`,
          objectKey: 'audio/e2e/part-1.webm',
          expiresInSeconds: 600,
        }),
      );
      return;
    }

    if (pathname === '/v1/mock-s3-put') {
      await route.fulfill({ status: 200, body: '' });
      return;
    }

    if (pathname === '/v1/billing/glb/portal') {
      await route.fulfill(jsonOk({ portalUrl: '/app/paywall?portal=e2e' }));
      return;
    }

    if (pathname === '/v1/auth/logout') {
      await route.fulfill(jsonOk({ loggedOut: true }));
      return;
    }

    if (pathname === '/v1/telemetry/events') {
      const parsed = (req.postDataJSON() as { events?: unknown[] } | null) ?? {};
      const acceptedCount = Array.isArray(parsed.events) ? parsed.events.length : 0;
      await route.fulfill(jsonOk({ acceptedCount }));
      return;
    }

    if (pathname === '/v1/feedback/question-flag') {
      await route.fulfill(jsonOk({ success: true, flagId: 'flag-mock-1' }));
      return;
    }

    await route.fulfill(jsonOk({ ok: true }));
  });

  return state;
}
