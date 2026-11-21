import type { RecordedClip } from '@/gateways/audio.gateway';
import type {
  CompleteDailyMissionInput,
  DailyMissionSnapshot,
  DropHistoryPage,
  DropIngestInput,
  DroppedContentItem,
  ILinguisticGateway,
  LinguisticGatewayError,
  LinguisticGraphSnapshot,
  RegisterShifterResult,
  UpdateGraphInterestsInput,
  VerifyRepeatAloudResponse,
} from '@/gateways/linguistic.gateway';
import { err, ok, type Result } from '@/gateways/result';
import type { EditionCode } from '@/edition/edition-config';
import { validateDropUrlPreFlight } from '@mockza/domain';

export class FakeLinguisticAdapter implements ILinguisticGateway {
  private readonly edition: EditionCode;
  private graph: LinguisticGraphSnapshot;
  private mission: DailyMissionSnapshot;
  private drops: Map<string, DroppedContentItem>;
  private jobs = new Map<string, { status: string; result: unknown }>();
  private counter = 0;

  constructor(options: { readonly edition?: EditionCode } = {}) {
    this.edition = options.edition ?? 'glb';
    const isIrn = this.edition === 'irn';

    this.graph = {
      bottlenecks: [
        {
          nodeId: '10000000-0000-4000-8000-000000000001',
          edition: this.edition,
          nodeKind: 'bottleneck',
          canonicalKey: 'grammar:conditional_avoidance',
          displayLabelEn: 'Conditional Clause Avoidance',
          displayLabelFa: 'پرهیز از جملات شرطی',
          masteryScoreMilli: 340,
          signalWeightMilli: 780,
          evidenceCount: 3,
          lastSeenDaySerial: 20778,
          lastExampleEn: 'AI changes work a lot and people use it every day.',
          coachNoteEn: 'Add inverted or second conditionals to boost Grammatical Range.',
          coachNoteFa: 'در استدلال‌ها از جملات شرطی نوع دوم یا ساختار معکوس استفاده کنید.',
          isPinned: false,
          isMuted: false,
        },
      ],
      targetStructures: [
        {
          nodeId: '10000000-0000-4000-8000-000000000002',
          edition: this.edition,
          nodeKind: 'target_structure',
          canonicalKey: 'cohesion:albeit_contrast',
          displayLabelEn: 'albeit + adj / clause',
          displayLabelFa: 'ساختار تقابلی albeit',
          masteryScoreMilli: 680,
          signalWeightMilli: 640,
          evidenceCount: 4,
          lastSeenDaySerial: 20778,
          lastExampleEn: 'Automated scoring is consistent, albeit strict.',
          coachNoteEn: 'Keep reinforcing albeit in speaking Part 3.',
          coachNoteFa: 'کاربرد albeit در اسپیکینگ پارت ۳ بسیار امتیازآور است.',
          isPinned: false,
          isMuted: false,
        },
      ],
      interestTopics: [
        {
          nodeId: '10000000-0000-4000-8000-000000000003',
          edition: this.edition,
          nodeKind: 'interest_topic',
          canonicalKey: 'topic:artificial_intelligence',
          displayLabelEn: 'Artificial Intelligence',
          displayLabelFa: 'هوش مصنوعی',
          masteryScoreMilli: 700,
          signalWeightMilli: 820,
          evidenceCount: 5,
          lastSeenDaySerial: 20778,
          isPinned: true,
          isMuted: false,
        },
      ],
      totalEvidenceCount: 12,
    };

    this.mission = {
      missionId: '20000000-0000-4000-8000-000000000001',
      edition: this.edition,
      examTrack: 'ielts_academic',
      missionDaySerial: 20778,
      status: 'ready',
      focusTopic: 'Artificial Intelligence',
      payload: {
        estimatedSeconds: 600,
        warmupCardIds: ['vocab-albeit'],
        forcedTargets: [
          {
            canonicalKey: 'grammar:conditional_avoidance',
            phraseEn: 'Were companies to adopt...',
            hintEn: 'Use inverted conditional framing.',
            hintFa: isIrn ? 'در شروع پاسخ از یک شرطی معکوس (Were ... to ...) استفاده کنید.' : null,
          },
          {
            canonicalKey: 'lexis:albeit',
            phraseEn: 'albeit',
            hintEn: 'Although / even though in compact clauses.',
            hintFa: isIrn ? 'به معنی «اگرچه / هرچند» برای اتصال ظریف تضادها' : null,
          },
        ],
        promptTitle: '10-Min AI Transfer Mission',
        promptTextEn:
          'In 4–6 crisp sentences on AI tools at work, weigh efficiency against skill atrophy using both forced structures.',
        promptTextFa: isIrn
          ? 'مأموریت ۱۰ دقیقه‌ای درباره ابزارهای هوش مصنوعی در محیط کار: در ۴ تا ۶ جمله انگلیسی، تعادل میان سرعت و تسلط مهارتی را تحلیل کنید و هر دو ساختار هدف را به کار ببرید.'
          : null,
        responseMode: 'writing',
      },
      evaluationResult: null,
    };

    this.drops = new Map([
      [
        '30000000-0000-4000-8000-000000000001',
        {
          dropId: '30000000-0000-4000-8000-000000000001',
          edition: this.edition,
          inputKind: 'text',
          sourceDomainOrLabel: 'AI Weekly Essay',
          title: 'Deliberate Practice in Technical Fluency',
          cefrEstimate: 'C1',
          detectedTopics: ['artificial_intelligence'],
          extractedPhrases: [
            {
              headword: 'deliberate practice',
              ipa: '/dɪˈlɪbərət ˈpræktɪs/',
              definitionEn: 'Purposeful repetition targeting identified bottlenecks.',
              glossFa: isIrn ? 'تمرین هدفمند روی گلوگاه‌های مشخص' : null,
              exampleSentence: 'Deliberate practice turns passive reading into speaking accuracy.',
              startUtf16: 0,
              endUtf16: 19,
            },
          ],
          drillPayload: {
            comprehensionPrompt: 'What distinguishes deliberate practice from passive exposure?',
            comprehensionOptions: [
              'Immediate corrective feedback on weak structures',
              'Listening without speaking aloud',
            ],
            correctOptionIndex: 0,
            clozeSentence: 'Replacing passive reading with ______ speeds up Band 8 growth.',
            clozeAnswer: 'deliberate practice',
            shadowingPrompt: 'Deliberate practice turns passive reading into speaking accuracy.',
          },
          createdAt: '2026-11-21T10:00:00.000Z',
        },
      ],
    ]);
  }

  async getMyGraph(): Promise<Result<LinguisticGraphSnapshot, LinguisticGatewayError>> {
    return ok(structuredClone(this.graph));
  }

  async updateInterests(
    input: UpdateGraphInterestsInput,
  ): Promise<Result<LinguisticGraphSnapshot, LinguisticGatewayError>> {
    for (const raw of input.pinTopics) {
      const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const existing = this.graph.interestTopics.find((t) => t.canonicalKey === `topic:${slug}`);
      if (existing) {
        existing.isPinned = true;
        existing.isMuted = false;
      } else {
        this.graph.interestTopics.push({
          nodeId: `10000000-0000-4000-8000-000000000${this.graph.interestTopics.length + 10}`,
          edition: this.edition,
          nodeKind: 'interest_topic',
          canonicalKey: `topic:${slug}`,
          displayLabelEn: raw,
          displayLabelFa: raw,
          masteryScoreMilli: 500,
          signalWeightMilli: 800,
          evidenceCount: 1,
          lastSeenDaySerial: 20778,
          isPinned: true,
          isMuted: false,
        });
      }
    }
    for (const muted of input.muteTopics) {
      const t = this.graph.interestTopics.find(
        (x) => x.canonicalKey === muted || x.displayLabelEn.toLowerCase() === muted.toLowerCase(),
      );
      if (t) {
        t.isMuted = true;
        t.isPinned = false;
      }
    }
    return ok(structuredClone(this.graph));
  }

  async getTodayMission(): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>> {
    return ok(structuredClone(this.mission));
  }

  async completeMission(
    _missionId: string,
    input: CompleteDailyMissionInput,
  ): Promise<Result<DailyMissionSnapshot, LinguisticGatewayError>> {
    const text = (input.responseText ?? '').toLowerCase();
    const matchedTargets = this.mission.payload.forcedTargets
      .filter((t) => text.includes(t.phraseEn.split(' ')[0]!.toLowerCase()))
      .map((t) => t.phraseEn);
    this.mission = {
      ...this.mission,
      status: 'completed',
      evaluationResult: {
        matchedTargets,
        feedbackEn: 'Mission recorded and transferred into your Linguistic Graph.',
        feedbackFa: this.edition === 'irn' ? 'مأموریت ثبت شد و گراف زبانی شما به‌روز شد.' : null,
        clarityScore1To5: matchedTargets.length > 0 ? 5 : 4,
      },
    };
    return ok(structuredClone(this.mission));
  }

  async shiftRegisterFromClip(params: {
    readonly clip: RecordedClip;
    readonly examTrack: string;
    readonly topicHint?: string;
  }): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>> {
    this.counter += 1;
    const jobId = `40000000-0000-4000-8000-00000000000${this.counter}`;
    const isIrn = this.edition === 'irn';
    const res: RegisterShifterResult = {
      runId: jobId,
      examTrack: params.examTrack,
      sourceTranscript: 'Today I watched a really good tech film and it was super interesting.',
      gears: {
        casual: 'Today I watched a really good tech film and it was super interesting.',
        workplace:
          'I watched a compelling technology documentary today that sparked great ideas for our team.',
        academic:
          'A thought-provoking technology film I viewed underscored how rapidly digital systems reshape modern collaboration.',
      },
      shiftHighlights: [
        {
          casualPhrase: 'really good',
          upgradedPhrase: 'thought-provoking',
          targetGear: 'academic',
          whyEn: 'Replaces generic modifier "really good" with C1 evaluative adjective.',
          whyFa: isIrn
            ? 'صفت کلی "really good" به ترکیب آکادمیک "thought-provoking" تبدیل شد.'
            : null,
        },
        {
          casualPhrase: 'was super interesting',
          upgradedPhrase: 'underscored how rapidly',
          targetGear: 'academic',
          whyEn: 'Uses analytical reporting verb for Band 8+ lexical control.',
          whyFa: isIrn ? 'فعل تحلیلی "underscored" عمق استدلالی جمله را بالا برد.' : null,
        },
      ],
      repeatAloudTarget: {
        gearLevel: 2,
        targetSentence:
          'A thought-provoking technology film I viewed underscored how rapidly digital systems reshape modern collaboration.',
        targetPhrases: ['thought-provoking', 'underscored how rapidly'],
      },
    };
    this.jobs.set(jobId, { status: 'completed', result: res });
    return ok({ jobId });
  }

  async verifyRepeatAloud(runId: string): Promise<Result<VerifyRepeatAloudResponse, LinguisticGatewayError>> {
    return ok({
      runId,
      matchedTargets: ['thought-provoking', 'underscored how rapidly'],
      meaningPreserved: true,
      fluencyScore1To5: 5,
      graphUpdated: true,
    });
  }

  async uploadDropMediaFile(params: {
    readonly dropId: string;
    readonly index: number;
  }): Promise<Result<{ readonly objectKey: string }, LinguisticGatewayError>> {
    return ok({
      objectKey: `users/fake-device/drops/${params.dropId}/item-${params.index}.png`,
    });
  }

  async ingestDrop(input: DropIngestInput): Promise<Result<{ readonly jobId: string }, LinguisticGatewayError>> {
    if (input.inputKind === 'text_url') {
      const pre = validateDropUrlPreFlight(input.sourceUrl, { allowHttpInDev: true });
      if (!pre.ok) {
        return err({
          kind: 'validation',
          message: pre.reason ?? 'Unsupported or blocked URL',
          details: { code: pre.code },
        });
      }
    }
    this.counter += 1;
    const dropId = `30000000-0000-4000-8000-00000000001${this.counter}`;
    const jobId = `50000000-0000-4000-8000-00000000000${this.counter}`;
    const item: DroppedContentItem = {
      dropId,
      edition: this.edition,
      inputKind: input.inputKind,
      sourceDomainOrLabel:
        input.inputKind === 'text_url'
          ? new URL(input.sourceUrl).hostname
          : input.inputKind === 'image'
            ? 'Screenshot Drop'
            : input.inputKind === 'audio'
              ? 'Bounded Audio Drop'
              : 'Personal Text',
      title:
        input.inputKind === 'text_url'
          ? 'Dropped Article Micro-Drill'
          : 'Extracted Fluency Micro-Drill',
      cefrEstimate: 'C1',
      detectedTopics: ['artificial_intelligence'],
      extractedPhrases: [
        {
          headword: 'mitigate bottlenecks',
          ipa: '/ˈmɪtɪɡeɪt/',
          definitionEn: 'Reduce constraints slowing down performance.',
          glossFa: this.edition === 'irn' ? 'کاهش گلوگاه‌های بازدارنده' : null,
          exampleSentence: 'Daily targeted drills mitigate persistent grammar bottlenecks.',
          startUtf16: null,
          endUtf16: null,
        },
      ],
      drillPayload: {
        comprehensionPrompt: 'Which strategy resolves recurring output bottlenecks?',
        comprehensionOptions: [
          'Targeted recycling in real-world topics',
          'Ignoring speaking feedback completely',
        ],
        correctOptionIndex: 0,
        clozeSentence: 'Targeted drills help learners ______ long-standing habits.',
        clozeAnswer: 'mitigate bottlenecks',
        shadowingPrompt: 'Daily targeted drills mitigate persistent grammar bottlenecks.',
      },
      createdAt: new Date().toISOString(),
    };
    this.drops.set(dropId, item);
    this.jobs.set(jobId, { status: 'completed', result: item });
    return ok({ jobId });
  }

  async getDropHistory(): Promise<Result<DropHistoryPage, LinguisticGatewayError>> {
    return ok({ items: Array.from(this.drops.values()), nextCursor: null });
  }

  async getDropById(dropId: string): Promise<Result<DroppedContentItem, LinguisticGatewayError>> {
    const item = this.drops.get(dropId);
    if (!item) {
      return err({ kind: 'unexpected', message: 'Drop not found' });
    }
    return ok(structuredClone(item));
  }

  async pollAdvancedJob<T>(jobId: string) {
    const j = this.jobs.get(jobId);
    if (!j) {
      return ok({ status: 'completed', result: undefined as unknown as T });
    }
    return ok({ status: j.status, result: j.result as T });
  }
}
