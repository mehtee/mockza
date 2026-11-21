import { randomUUID } from 'node:crypto';
import { computeNextMasteryMilli, clampMilli } from '@mockza/domain';
import { and, desc, eq, inArray } from 'drizzle-orm';
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
      const existingRows = await tx
        .select()
        .from(linguisticNodes)
        .where(
          and(
            eq(linguisticNodes.accountKey, params.accountKey),
            eq(linguisticNodes.edition, params.edition),
            eq(linguisticNodes.nodeKind, s.nodeKind),
            eq(linguisticNodes.canonicalKey, s.canonicalKey),
          ),
        )
        .limit(1);

      const existing = existingRows[0];
      const nextEvidenceCount = (existing?.evidenceCount ?? 0) + 1;
      const baseMastery =
        existing?.masteryScoreMilli ?? (s.nodeKind === 'bottleneck' ? 350 : 450);
      const nextMastery = computeNextMasteryMilli({
        currentMilli: baseMastery,
        polarity: s.observedPolarity,
        evidenceCount: nextEvidenceCount,
      });
      const baseWeight = existing?.signalWeightMilli ?? 450;
      const weightBump = s.observedPolarity === 'gap_observed' ? 120 : 80;
      const nextWeight = clampMilli(baseWeight + weightBump);

      let nodeId: string;
      if (existing) {
        nodeId = existing.nodeId;
        await tx
          .update(linguisticNodes)
          .set({
            displayLabelEn: s.displayLabelEn,
            displayLabelFa: s.displayLabelFa,
            masteryScoreMilli: nextMastery,
            signalWeightMilli: nextWeight,
            evidenceCount: nextEvidenceCount,
            lastSeenDaySerial: daySerial,
            lastExampleEn: s.excerptText ?? existing.lastExampleEn,
            coachNoteEn: s.coachNoteEn,
            coachNoteFa: s.coachNoteFa,
            updatedAt: now,
          })
          .where(eq(linguisticNodes.nodeId, existing.nodeId));
      } else {
        nodeId = randomUUID();
        await tx.insert(linguisticNodes).values({
          nodeId,
          accountKey: params.accountKey,
          edition: params.edition,
          nodeKind: s.nodeKind,
          canonicalKey: s.canonicalKey,
          displayLabelEn: s.displayLabelEn,
          displayLabelFa: s.displayLabelFa,
          masteryScoreMilli: nextMastery,
          signalWeightMilli: nextWeight,
          evidenceCount: 1,
          firstSeenDaySerial: daySerial,
          lastSeenDaySerial: daySerial,
          lastExampleEn: s.excerptText,
          coachNoteEn: s.coachNoteEn,
          coachNoteFa: s.coachNoteFa,
          isPinned: false,
          isMuted: false,
          updatedAt: now,
        });
      }

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
}) {
  const rows = await params.db
    .select()
    .from(linguisticNodes)
    .where(
      and(
        eq(linguisticNodes.accountKey, params.accountKey),
        eq(linguisticNodes.edition, params.edition),
      ),
    )
    .orderBy(desc(linguisticNodes.signalWeightMilli), desc(linguisticNodes.updatedAt));

  const bottlenecks = rows.filter((r) => r.nodeKind === 'bottleneck');
  const targetStructures = rows.filter((r) => r.nodeKind === 'target_structure');
  const interestTopics = rows.filter((r) => r.nodeKind === 'interest_topic');
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
      const slug = rawTopic.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      const canonicalKey = `topic:${slug || 'general'}`;
      const existing = await tx
        .select()
        .from(linguisticNodes)
        .where(
          and(
            eq(linguisticNodes.accountKey, params.accountKey),
            eq(linguisticNodes.edition, params.edition),
            eq(linguisticNodes.nodeKind, 'interest_topic'),
            eq(linguisticNodes.canonicalKey, canonicalKey),
          ),
        )
        .limit(1);
      if (existing[0]) {
        await tx
          .update(linguisticNodes)
          .set({ isPinned: true, isMuted: false, updatedAt: now })
          .where(eq(linguisticNodes.nodeId, existing[0].nodeId));
      } else {
        await tx.insert(linguisticNodes).values({
          nodeId: randomUUID(),
          accountKey: params.accountKey,
          edition: params.edition,
          nodeKind: 'interest_topic',
          canonicalKey,
          displayLabelEn: rawTopic.trim(),
          displayLabelFa: rawTopic.trim(),
          masteryScoreMilli: 500,
          signalWeightMilli: 800,
          evidenceCount: 1,
          firstSeenDaySerial: daySerial,
          lastSeenDaySerial: daySerial,
          isPinned: true,
          isMuted: false,
          updatedAt: now,
        });
      }
    }

    if (params.muteTopics.length > 0) {
      const keys = params.muteTopics.map((t) =>
        t.startsWith('topic:')
          ? t
          : `topic:${t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`,
      );
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
