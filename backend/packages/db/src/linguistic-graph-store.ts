import { randomUUID } from 'node:crypto';
import {
  computeNodePriorityScore,
  slugifyTopicCanonicalKey,
} from '@mockza/domain';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { MockzaDb } from './client.js';
import { linguisticEvidenceEvents, linguisticNodes } from './schema.js';

export interface SignalDeltaRecord {
  nodeKind: 'bottleneck' | 'target_structure' | 'interest_topic';
  canonicalKey: string;
  displayLabelEn: string;
  displayLabelFa: string;
  coachNoteEn: string;
  coachNoteFa: string;
  observedPolarity: 'gap_observed' | 'target_used' | 'interest_matched';
  excerptText: string | null;
}

export function getUtcDaySerial(date: Date = new Date()): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/**
 * Persists System 1 graph deltas cleanly using deterministic mastery EMA (`computeNextMasteryMilli`),
 * strictly scoped to `(accountKey, edition)`.
 */
export async function upsertLinguisticGraphSignals(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  sourceKind:
    | 'writing'
    | 'speaking'
    | 'diagnostic'
    | 'register_shifter'
    | 'drop_anything'
    | 'mission';
  sourceRefId: string;
  signals: readonly SignalDeltaRecord[];
  now?: Date;
}): Promise<number> {
  if (params.signals.length === 0) return 0;
  const now = params.now ?? new Date();
  const daySerial = getUtcDaySerial(now);

  await params.db.transaction(async (tx) => {
    for (const s of params.signals) {
      const initialMastery =
        s.observedPolarity === 'gap_observed'
          ? 270
          : s.observedPolarity === 'target_used'
            ? 588
            : 570;
      const weightBump = s.observedPolarity === 'gap_observed' ? 120 : 80;
      const initialWeight = Math.min(1000, 450 + weightBump);

      const masteryUpdateSql =
        s.observedPolarity === 'gap_observed'
          ? sql`GREATEST(0, ${linguisticNodes.masteryScoreMilli} - GREATEST(40, 140 - LEAST(${linguisticNodes.evidenceCount} + 1, 10) * 8))`
          : s.observedPolarity === 'target_used'
            ? sql`LEAST(1000, ${linguisticNodes.masteryScoreMilli} + GREATEST(60, ROUND((1000 - ${linguisticNodes.masteryScoreMilli}) * 0.25)::int))`
            : sql`LEAST(1000, ${linguisticNodes.masteryScoreMilli} + 120)`;

      const [upserted] = await tx
        .insert(linguisticNodes)
        .values({
          nodeId: randomUUID(),
          accountKey: params.accountKey,
          edition: params.edition,
          nodeKind: s.nodeKind,
          canonicalKey: s.canonicalKey,
          displayLabelEn: s.displayLabelEn,
          displayLabelFa: s.displayLabelFa,
          masteryScoreMilli: initialMastery,
          signalWeightMilli: initialWeight,
          evidenceCount: 1,
          firstSeenDaySerial: daySerial,
          lastSeenDaySerial: daySerial,
          lastExampleEn: s.excerptText,
          coachNoteEn: s.coachNoteEn,
          coachNoteFa: s.coachNoteFa,
          isPinned: false,
          isMuted: false,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            linguisticNodes.accountKey,
            linguisticNodes.edition,
            linguisticNodes.nodeKind,
            linguisticNodes.canonicalKey,
          ],
          set: {
            displayLabelEn: s.displayLabelEn,
            displayLabelFa: s.displayLabelFa,
            masteryScoreMilli: masteryUpdateSql,
            signalWeightMilli: sql`LEAST(1000, ${linguisticNodes.signalWeightMilli} + ${weightBump})`,
            evidenceCount: sql`${linguisticNodes.evidenceCount} + 1`,
            lastSeenDaySerial: daySerial,
            lastExampleEn: sql`COALESCE(${s.excerptText}, ${linguisticNodes.lastExampleEn})`,
            coachNoteEn: s.coachNoteEn,
            coachNoteFa: s.coachNoteFa,
            updatedAt: now,
          },
        })
        .returning({ nodeId: linguisticNodes.nodeId });

      const nodeId = upserted!.nodeId;

      await tx.insert(linguisticEvidenceEvents).values({
        eventId: randomUUID(),
        accountKey: params.accountKey,
        edition: params.edition,
        nodeId,
        sourceKind: params.sourceKind,
        sourceRefId: params.sourceRefId,
        observedPolarity: s.observedPolarity,
        excerptText: s.excerptText ? s.excerptText.slice(0, 240) : null,
        createdAt: now,
      });
    }
  });

  return params.signals.length;
}

export async function listLinguisticGraphForAccount(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  now?: Date;
}) {
  const daySerial = getUtcDaySerial(params.now);
  const rows = await params.db
    .select()
    .from(linguisticNodes)
    .where(
      and(
        eq(linguisticNodes.accountKey, params.accountKey),
        eq(linguisticNodes.edition, params.edition),
      ),
    );

  const byDecayedPriorityDesc = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    const pA = computeNodePriorityScore({
      node: {
        nodeKind: a.nodeKind as 'bottleneck' | 'target_structure' | 'interest_topic',
        masteryScoreMilli: a.masteryScoreMilli,
        signalWeightMilli: a.signalWeightMilli,
        lastSeenDaySerial: a.lastSeenDaySerial,
      },
      currentDaySerial: daySerial,
    });
    const pB = computeNodePriorityScore({
      node: {
        nodeKind: b.nodeKind as 'bottleneck' | 'target_structure' | 'interest_topic',
        masteryScoreMilli: b.masteryScoreMilli,
        signalWeightMilli: b.signalWeightMilli,
        lastSeenDaySerial: b.lastSeenDaySerial,
      },
      currentDaySerial: daySerial,
    });
    if (pB !== pA) return pB - pA;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  };

  const bottlenecks = rows.filter((r) => r.nodeKind === 'bottleneck').sort(byDecayedPriorityDesc);
  const targetStructures = rows
    .filter((r) => r.nodeKind === 'target_structure')
    .sort(byDecayedPriorityDesc);
  const interestTopics = rows
    .filter((r) => r.nodeKind === 'interest_topic')
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return byDecayedPriorityDesc(a, b);
    });
  const totalEvidenceCount = rows.reduce((sum, r) => sum + r.evidenceCount, 0);

  return {
    bottlenecks,
    targetStructures,
    interestTopics,
    totalEvidenceCount,
  };
}

export async function updateGraphInterestPreferences(params: {
  db: MockzaDb;
  accountKey: string;
  edition: 'glb' | 'irn';
  pinTopics: string[];
  muteTopics: string[];
  now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const daySerial = getUtcDaySerial(now);

  await params.db.transaction(async (tx) => {
    for (const rawTopic of params.pinTopics) {
      const label = rawTopic.trim();
      const canonicalKey = slugifyTopicCanonicalKey(label);
      await tx
        .insert(linguisticNodes)
        .values({
          nodeId: randomUUID(),
          accountKey: params.accountKey,
          edition: params.edition,
          nodeKind: 'interest_topic',
          canonicalKey,
          displayLabelEn: label,
          displayLabelFa: label,
          masteryScoreMilli: 500,
          signalWeightMilli: 800,
          evidenceCount: 1,
          firstSeenDaySerial: daySerial,
          lastSeenDaySerial: daySerial,
          isPinned: true,
          isMuted: false,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            linguisticNodes.accountKey,
            linguisticNodes.edition,
            linguisticNodes.nodeKind,
            linguisticNodes.canonicalKey,
          ],
          set: {
            displayLabelEn: label,
            displayLabelFa: label,
            isPinned: true,
            isMuted: false,
            updatedAt: now,
          },
        });
    }

    if (params.muteTopics.length > 0) {
      const keys = params.muteTopics.map((t) => slugifyTopicCanonicalKey(t));
      await tx
        .update(linguisticNodes)
        .set({ isMuted: true, isPinned: false, updatedAt: now })
        .where(
          and(
            eq(linguisticNodes.accountKey, params.accountKey),
            eq(linguisticNodes.edition, params.edition),
            eq(linguisticNodes.nodeKind, 'interest_topic'),
            inArray(linguisticNodes.canonicalKey, keys),
          ),
        );
    }
  });
}
