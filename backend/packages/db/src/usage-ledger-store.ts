import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import type { MockzaDb } from './client.js';
import {
  aiUsageLedger,
  dailyMissions,
  diagnosticSessions,
  droppedContents,
  evaluationJobs,
  learnerBandEvents,
  learnerProfiles,
  learnerRoadmapPlans,
  pronunciationPractices,
  userActivityLedger,
  userAttemptsSync,
  userVocabSrsSync,
} from './schema.js';

export interface RecordAiUsageParams {
  db: MockzaDb;
  accountKey: string;
  deviceId?: string | null;
  edition: 'glb' | 'irn';
  featureKind: string;
  entityType: string;
  entityId: string;
  modelId: string;
  providerRequestId?: string | null;
  promptTokens?: number;
  completionTokens?: number;
  cachedTokens?: number;
  totalTokens?: number;
  estimatedCostUsdMicros?: number;
  costUsdSource?: 'openrouter_usage' | 'registry_estimate' | 'unknown';
  latencyMs?: number;
  audioDurationMs?: number | null;
  ttsCharacters?: number | null;
}

export async function recordAiUsageLedger(params: RecordAiUsageParams): Promise<string> {
  const usageId = randomUUID();
  const promptTokens = Math.max(0, Math.round(params.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.round(params.completionTokens ?? 0));
  const cachedTokens = Math.max(0, Math.round(params.cachedTokens ?? 0));
  const totalTokens = Math.max(
    promptTokens + completionTokens,
    Math.round(params.totalTokens ?? 0),
  );
  await params.db.insert(aiUsageLedger).values({
    usageId,
    accountKey: params.accountKey,
    deviceId: params.deviceId ?? null,
    edition: params.edition,
    featureKind: params.featureKind,
    entityType: params.entityType,
    entityId: params.entityId,
    modelId: params.modelId,
    providerRequestId: params.providerRequestId ?? null,
    promptTokens,
    completionTokens,
    cachedTokens,
    totalTokens,
    estimatedCostUsdMicros: Math.max(0, Math.round(params.estimatedCostUsdMicros ?? 0)),
    costUsdSource: params.costUsdSource ?? 'registry_estimate',
    latencyMs: Math.max(0, Math.round(params.latencyMs ?? 0)),
    audioDurationMs: params.audioDurationMs ?? null,
    ttsCharacters: params.ttsCharacters ?? null,
  });
  return usageId;
}

export async function recordUserActivityLedger(params: {
  db: MockzaDb;
  accountKey: string;
  deviceId?: string | null;
  edition: 'glb' | 'irn';
  activityKind: string;
  entityType: string;
  entityId: string;
  topicKey?: string | null;
  weaknessKeys?: string[];
  durationSeconds?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const activityId = randomUUID();
  await params.db.insert(userActivityLedger).values({
    activityId,
    accountKey: params.accountKey,
    deviceId: params.deviceId ?? null,
    edition: params.edition,
    activityKind: params.activityKind,
    entityType: params.entityType,
    entityId: params.entityId,
    topicKey: params.topicKey ?? null,
    weaknessKeysJson: params.weaknessKeys ?? [],
    durationSeconds: params.durationSeconds ?? null,
    metadataJson: params.metadata ?? {},
  });
  return activityId;
}

export async function upsertUserAttemptSync(params: {
  db: MockzaDb;
  attemptId: string;
  accountKey: string;
  edition: 'glb' | 'irn';
  packId: string;
  examId: string;
  skill: string;
  mode: string;
  status: string;
  scoreBand?: number | null;
  durationSeconds?: number;
  answersJson?: Record<string, unknown> | null;
  feedbackJson?: Record<string, unknown> | null;
  topicKeys?: string[];
  deviceId?: string | null;
  completedAt?: Date | null;
}): Promise<void> {
  const now = new Date();
  await params.db
    .insert(userAttemptsSync)
    .values({
      attemptId: params.attemptId,
      accountKey: params.accountKey,
      edition: params.edition,
      packId: params.packId,
      examId: params.examId,
      skill: params.skill,
      mode: params.mode,
      status: params.status,
      scoreBand: params.scoreBand ?? null,
      durationSeconds: Math.max(0, Math.round(params.durationSeconds ?? 0)),
      answersJson: params.answersJson ?? null,
      feedbackJson: params.feedbackJson ?? null,
      topicKeysJson: params.topicKeys ?? [],
      deviceId: params.deviceId ?? null,
      completedAt: params.completedAt ?? (params.status === 'completed' ? now : null),
      updatedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: userAttemptsSync.attemptId,
      set: {
        status: params.status,
        ...(params.scoreBand != null ? { scoreBand: params.scoreBand } : {}),
        durationSeconds: Math.max(0, Math.round(params.durationSeconds ?? 0)),
        ...(params.answersJson !== undefined ? { answersJson: params.answersJson } : {}),
        ...(params.feedbackJson !== undefined ? { feedbackJson: params.feedbackJson } : {}),
        topicKeysJson:
          params.topicKeys && params.topicKeys.length > 0
            ? params.topicKeys
            : userAttemptsSync.topicKeysJson,
        ...(params.completedAt != null || params.status === 'completed'
          ? { completedAt: params.completedAt ?? now }
          : {}),
        updatedAt: now,
      },
    });
}

export async function upsertVocabSrsSyncBatch(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  cards: Array<{
    cardId: string;
    easeFactorMilli: number;
    intervalDays: number;
    repetitions: number;
    dueSerialDay: number;
    lapses: number;
    lastReviewedAt?: string | null;
    sourceKind?: string;
    cardSnapshotJson?: Record<string, unknown> | null;
  }>;
}): Promise<number> {
  if (params.cards.length === 0) return 0;
  const now = new Date();
  for (const c of params.cards) {
    const parsedReviewed = c.lastReviewedAt ? new Date(c.lastReviewedAt) : null;
    const validReviewedAt =
      parsedReviewed && !Number.isNaN(parsedReviewed.getTime()) ? parsedReviewed : null;
    await params.db
      .insert(userVocabSrsSync)
      .values({
        accountKey: params.accountKey,
        cardId: c.cardId,
        edition: params.edition,
        easeFactorMilli: c.easeFactorMilli,
        intervalDays: c.intervalDays,
        repetitions: c.repetitions,
        dueSerialDay: c.dueSerialDay,
        lapses: c.lapses,
        lastReviewedAt: validReviewedAt,
        sourceKind: c.sourceKind ?? 'seeded',
        cardSnapshotJson: c.cardSnapshotJson ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          userVocabSrsSync.accountKey,
          userVocabSrsSync.edition,
          userVocabSrsSync.cardId,
        ],
        set: {
          easeFactorMilli: sql`CASE WHEN ${c.repetitions} >= ${userVocabSrsSync.repetitions} THEN ${c.easeFactorMilli} ELSE ${userVocabSrsSync.easeFactorMilli} END`,
          intervalDays: sql`CASE WHEN ${c.repetitions} >= ${userVocabSrsSync.repetitions} THEN ${c.intervalDays} ELSE ${userVocabSrsSync.intervalDays} END`,
          repetitions: sql`GREATEST(${userVocabSrsSync.repetitions}, ${c.repetitions})`,
          dueSerialDay: sql`CASE WHEN ${c.repetitions} >= ${userVocabSrsSync.repetitions} THEN ${c.dueSerialDay} ELSE ${userVocabSrsSync.dueSerialDay} END`,
          lapses: sql`GREATEST(${userVocabSrsSync.lapses}, ${c.lapses})`,
          ...(validReviewedAt ? { lastReviewedAt: validReviewedAt } : {}),
          ...(c.cardSnapshotJson ? { cardSnapshotJson: c.cardSnapshotJson } : {}),
          updatedAt: now,
        },
      });
  }
  return params.cards.length;
}

export async function listAdminUsageSummary(params: {
  db: MockzaDb;
  sinceDays?: number;
  fromIso?: string;
  toIso?: string;
  edition?: 'glb' | 'irn';
  featureKind?: string;
  accountKey?: string;
}) {
  const days = Math.max(1, Math.min(365, params.sinceDays ?? 30));
  const parsedFrom = params.fromIso ? new Date(params.fromIso) : null;
  const parsedTo = params.toIso ? new Date(params.toIso) : null;
  const since =
    parsedFrom && !Number.isNaN(parsedFrom.getTime())
      ? parsedFrom
      : new Date(Date.now() - days * 86_400_000);
  const filters = [gte(aiUsageLedger.createdAt, since)];
  if (parsedTo && !Number.isNaN(parsedTo.getTime())) {
    filters.push(lte(aiUsageLedger.createdAt, parsedTo));
  }
  if (params.edition) filters.push(eq(aiUsageLedger.edition, params.edition));
  if (params.featureKind) filters.push(eq(aiUsageLedger.featureKind, params.featureKind));
  if (params.accountKey) filters.push(eq(aiUsageLedger.accountKey, params.accountKey));

  const byFeatureAndModel = await params.db
    .select({
      featureKind: aiUsageLedger.featureKind,
      modelId: aiUsageLedger.modelId,
      calls: sql<number>`count(*)::int`,
      promptTokens: sql<number>`coalesce(sum(${aiUsageLedger.promptTokens}), 0)::bigint`,
      completionTokens: sql<number>`coalesce(sum(${aiUsageLedger.completionTokens}), 0)::bigint`,
      cachedTokens: sql<number>`coalesce(sum(${aiUsageLedger.cachedTokens}), 0)::bigint`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageLedger.totalTokens}), 0)::bigint`,
      totalCostUsdMicros: sql<number>`coalesce(sum(${aiUsageLedger.estimatedCostUsdMicros}), 0)::bigint`,
      totalTtsChars: sql<number>`coalesce(sum(${aiUsageLedger.ttsCharacters}), 0)::bigint`,
    })
    .from(aiUsageLedger)
    .where(and(...filters))
    .groupBy(aiUsageLedger.featureKind, aiUsageLedger.modelId)
    .orderBy(desc(sql`coalesce(sum(${aiUsageLedger.estimatedCostUsdMicros}), 0)`));

  const topAccounts = await params.db
    .select({
      accountKey: aiUsageLedger.accountKey,
      calls: sql<number>`count(*)::int`,
      totalTokens: sql<number>`coalesce(sum(${aiUsageLedger.totalTokens}), 0)::bigint`,
      totalCostUsdMicros: sql<number>`coalesce(sum(${aiUsageLedger.estimatedCostUsdMicros}), 0)::bigint`,
    })
    .from(aiUsageLedger)
    .where(and(...filters))
    .groupBy(aiUsageLedger.accountKey)
    .orderBy(desc(sql`coalesce(sum(${aiUsageLedger.estimatedCostUsdMicros}), 0)`))
    .limit(50);

  return {
    sinceIso: since.toISOString(),
    byFeatureAndModel: byFeatureAndModel.map((r) => ({
      ...r,
      promptTokens: Number(r.promptTokens),
      completionTokens: Number(r.completionTokens),
      cachedTokens: Number(r.cachedTokens),
      totalTokens: Number(r.totalTokens),
      totalCostUsdMicros: Number(r.totalCostUsdMicros),
      totalCostUsd: Number((Number(r.totalCostUsdMicros) / 1_000_000).toFixed(6)),
      totalTtsChars: Number(r.totalTtsChars),
    })),
    topAccounts: topAccounts.map((r) => ({
      ...r,
      totalTokens: Number(r.totalTokens),
      totalCostUsdMicros: Number(r.totalCostUsdMicros),
      totalCostUsd: Number((Number(r.totalCostUsdMicros) / 1_000_000).toFixed(6)),
    })),
  };
}

export async function getAdminUserTrace(params: {
  db: MockzaDb;
  accountKey: string;
}) {
  const [profile] = await params.db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.accountKey, params.accountKey))
    .limit(1);

  const [bandEvents, activities, evaluations, pronunciation, missions, drops, attempts, roadmap, usageRows] =
    await Promise.all([
      params.db
        .select()
        .from(learnerBandEvents)
        .where(eq(learnerBandEvents.accountKey, params.accountKey))
        .orderBy(desc(learnerBandEvents.createdAt))
        .limit(100),
      params.db
        .select()
        .from(userActivityLedger)
        .where(eq(userActivityLedger.accountKey, params.accountKey))
        .orderBy(desc(userActivityLedger.createdAt))
        .limit(200),
      params.db
        .select()
        .from(evaluationJobs)
        .where(eq(evaluationJobs.accountKey, params.accountKey))
        .orderBy(desc(evaluationJobs.createdAt))
        .limit(100),
      params.db
        .select()
        .from(pronunciationPractices)
        .where(eq(pronunciationPractices.accountKey, params.accountKey))
        .orderBy(desc(pronunciationPractices.createdAt))
        .limit(100),
      params.db
        .select()
        .from(dailyMissions)
        .where(eq(dailyMissions.accountKey, params.accountKey))
        .orderBy(desc(dailyMissions.createdAt))
        .limit(60),
      params.db
        .select()
        .from(droppedContents)
        .where(eq(droppedContents.accountKey, params.accountKey))
        .orderBy(desc(droppedContents.createdAt))
        .limit(60),
      params.db
        .select()
        .from(userAttemptsSync)
        .where(eq(userAttemptsSync.accountKey, params.accountKey))
        .orderBy(desc(userAttemptsSync.updatedAt))
        .limit(100),
      params.db
        .select()
        .from(learnerRoadmapPlans)
        .where(eq(learnerRoadmapPlans.accountKey, params.accountKey))
        .orderBy(desc(learnerRoadmapPlans.updatedAt))
        .limit(1),
      params.db
        .select()
        .from(aiUsageLedger)
        .where(eq(aiUsageLedger.accountKey, params.accountKey))
        .orderBy(desc(aiUsageLedger.createdAt))
        .limit(200),
    ]);

  const totalCostMicros = usageRows.reduce((s, r) => s + r.estimatedCostUsdMicros, 0);
  const totalTokens = usageRows.reduce((s, r) => s + r.totalTokens, 0);

  return {
    accountKey: params.accountKey,
    profile: profile ?? null,
    roadmap: roadmap[0] ?? null,
    totals: {
      totalAiCalls: usageRows.length,
      totalTokens,
      totalCostUsdMicros: totalCostMicros,
      totalCostUsd: Number((totalCostMicros / 1_000_000).toFixed(6)),
    },
    bandEvents,
    activities,
    evaluations,
    pronunciationPractices: pronunciation,
    dailyMissions: missions,
    droppedContents: drops,
    attempts,
    aiUsageLedger: usageRows,
  };
}

export async function listAdminUsageExportRows(params: {
  db: MockzaDb;
  sinceDays?: number;
  fromIso?: string;
  toIso?: string;
  edition?: 'glb' | 'irn';
  featureKind?: string;
  accountKey?: string;
  limit?: number;
}) {
  const days = Math.max(1, Math.min(365, params.sinceDays ?? 30));
  const parsedFrom = params.fromIso ? new Date(params.fromIso) : null;
  const parsedTo = params.toIso ? new Date(params.toIso) : null;
  const since =
    parsedFrom && !Number.isNaN(parsedFrom.getTime())
      ? parsedFrom
      : new Date(Date.now() - days * 86_400_000);
  const filters = [gte(aiUsageLedger.createdAt, since)];
  if (parsedTo && !Number.isNaN(parsedTo.getTime())) {
    filters.push(lte(aiUsageLedger.createdAt, parsedTo));
  }
  if (params.edition) filters.push(eq(aiUsageLedger.edition, params.edition));
  if (params.featureKind) filters.push(eq(aiUsageLedger.featureKind, params.featureKind));
  if (params.accountKey) filters.push(eq(aiUsageLedger.accountKey, params.accountKey));

  return params.db
    .select()
    .from(aiUsageLedger)
    .where(and(...filters))
    .orderBy(desc(aiUsageLedger.createdAt))
    .limit(Math.min(5000, params.limit ?? 2000));
}
