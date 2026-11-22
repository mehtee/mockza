import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDbClient } from '../client.js';
import { acknowledgeBandShift, recordBandEventAndRecalculate } from '../personalization-store.js';
import {
  learnerBandEvents,
  learnerProfiles,
  learnerRoadmapPlans,
  learnerTopicWeaknessCoverage,
  linguisticEvidenceEvents,
  linguisticNodes,
  userAttemptsSync,
  userVocabSrsSync,
} from '../schema.js';
import {
  listAdminUsageExportRows,
  listAdminUsageSummary,
  upsertUserAttemptSync,
  upsertVocabSrsSyncBatch,
} from '../usage-ledger-store.js';

const testDbUrl =
  process.env['DATABASE_URL'] ?? 'postgres://mockza:mockza_dev_password@127.0.0.1:45432/mockza';

let pgReachable = false;
const { db, sql } = createDbClient(testDbUrl, { max: 4, prepare: false });

beforeAll(async () => {
  try {
    await sql`SELECT 1`;
    pgReachable = true;
  } catch {
    pgReachable = false;
  }
});

afterAll(async () => {
  await sql.end();
});

describe('Live PostgreSQL Usage Ledger & Personalization Persistence', () => {
  it('upserts user attempts, vocab SRS batches, band events, and date-bounded admin queries without Date/sql driver errors', async (ctx) => {
    if (!pgReachable) {
      ctx.skip();
      return;
    }

    const accountKey = `test_pg_${randomUUID()}`;
    const attemptId = randomUUID();
    const cardId = `card_${randomUUID()}`;

    try {
      await upsertUserAttemptSync({
        db,
        attemptId,
        accountKey,
        edition: 'glb',
        packId: 'ielts-acad-reading-seed-01',
        examId: 'ielts_academic',
        skill: 'reading',
        mode: 'practice',
        status: 'completed',
        scoreBand: 7.5,
        durationSeconds: 180,
        topicKeys: ['technology_ai'],
        deviceId: null,
      });

      // Trigger onConflictDoUpdate on completed_at + scoreBand both non-null and null paths
      await upsertUserAttemptSync({
        db,
        attemptId,
        accountKey,
        edition: 'glb',
        packId: 'ielts-acad-reading-seed-01',
        examId: 'ielts_academic',
        skill: 'reading',
        mode: 'practice',
        status: 'in_progress',
        scoreBand: null,
        durationSeconds: 200,
        topicKeys: [],
        deviceId: null,
      });

      const [attemptRow] = await db
        .select()
        .from(userAttemptsSync)
        .where(eq(userAttemptsSync.attemptId, attemptId))
        .limit(1);
      expect(attemptRow).toBeTruthy();
      expect(attemptRow?.scoreBand).toBe(7.5);
      expect(attemptRow?.completedAt).not.toBeNull();

      const nowIso = new Date().toISOString();
      const count1 = await upsertVocabSrsSyncBatch({
        db,
        accountKey,
        edition: 'glb',
        cards: [
          {
            cardId,
            easeFactorMilli: 2500,
            intervalDays: 1,
            repetitions: 1,
            dueSerialDay: 20400,
            lapses: 0,
            lastReviewedAt: nowIso,
            sourceKind: 'seeded',
            cardSnapshotJson: { headword: 'ephemeral', ipa: '/ɪˈfɛmərəl/' },
          },
        ],
      });
      expect(count1).toBe(1);

      // Update conflict path with valid lastReviewedAt
      await upsertVocabSrsSyncBatch({
        db,
        accountKey,
        edition: 'glb',
        cards: [
          {
            cardId,
            easeFactorMilli: 2600,
            intervalDays: 3,
            repetitions: 2,
            dueSerialDay: 20403,
            lapses: 0,
            lastReviewedAt: nowIso,
            sourceKind: 'seeded',
            cardSnapshotJson: { headword: 'ephemeral', ipa: '/ɪˈfɛmərəl/', example: 'short-lived' },
          },
        ],
      });

      const state = await recordBandEventAndRecalculate({
        db,
        accountKey,
        edition: 'glb',
        examTrack: 'ielts_academic',
        skill: 'reading',
        sourceKind: 'practice_section',
        sourceId: 'ielts-acad-reading-seed-01',
        rawScore: 7.5,
        accuracyRatio: 0.78,
        questionTypeStats: [{ questionType: 'trueFalseNotGiven', correct: 2, total: 5 }],
        topicKeys: ['technology_ai'],
      });
      expect(state.liveBand.currentBand).toBeTypeOf('number');

      const acked = await acknowledgeBandShift({
        db,
        accountKey,
        edition: 'glb',
      });
      expect(acked).toBeTypeOf('number');

      const summary = await listAdminUsageSummary({
        db,
        accountKey,
        fromIso: new Date(Date.now() - 86_400_000).toISOString(),
        toIso: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(summary.byFeatureAndModel).toBeInstanceOf(Array);

      const exportRows = await listAdminUsageExportRows({
        db,
        accountKey,
        fromIso: new Date(Date.now() - 86_400_000).toISOString(),
        toIso: new Date(Date.now() + 86_400_000).toISOString(),
      });
      expect(exportRows).toBeInstanceOf(Array);
    } finally {
      await db.delete(userVocabSrsSync).where(eq(userVocabSrsSync.accountKey, accountKey));
      await db.delete(userAttemptsSync).where(eq(userAttemptsSync.accountKey, accountKey));
      await db
        .delete(learnerTopicWeaknessCoverage)
        .where(eq(learnerTopicWeaknessCoverage.accountKey, accountKey));
      await db.delete(learnerBandEvents).where(eq(learnerBandEvents.accountKey, accountKey));
      await db.delete(learnerRoadmapPlans).where(eq(learnerRoadmapPlans.accountKey, accountKey));
      await db
        .delete(linguisticEvidenceEvents)
        .where(eq(linguisticEvidenceEvents.accountKey, accountKey));
      await db.delete(linguisticNodes).where(eq(linguisticNodes.accountKey, accountKey));
      await db.delete(learnerProfiles).where(eq(learnerProfiles.accountKey, accountKey));
    }
  });
});
