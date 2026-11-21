import type { MockzaDexieDb } from './mockza-db';
import type {
  DailyMissionSnapshot,
  DroppedContentItem,
  LinguisticGraphSnapshot,
} from '@/gateways/linguistic.gateway';
import type { EditionCode } from '@/edition/edition-config';
import { normalizeSupportedExamId } from '@mockza/domain';

export class DexieLinguisticCache {
  private readonly db: MockzaDexieDb;

  constructor(db: MockzaDexieDb) {
    this.db = db;
  }

  async cacheGraph(snapshot: LinguisticGraphSnapshot, edition: EditionCode): Promise<void> {
    const allNodes = [
      ...snapshot.bottlenecks,
      ...snapshot.targetStructures,
      ...snapshot.interestTopics,
    ];
    await this.db.linguisticNodes.where('edition').equals(edition).delete();
    if (allNodes.length > 0) {
      await this.db.linguisticNodes.bulkPut(
        allNodes.map((n) => ({
          nodeId: n.nodeId,
          edition,
          nodeKind: n.nodeKind,
          canonicalKey: n.canonicalKey,
          displayLabelEn: n.displayLabelEn,
          displayLabelFa: n.displayLabelFa ?? null,
          masteryScoreMilli: n.masteryScoreMilli,
          signalWeightMilli: n.signalWeightMilli,
          evidenceCount: n.evidenceCount,
          lastSeenDaySerial: n.lastSeenDaySerial,
          lastExampleEn: n.lastExampleEn ?? null,
          coachNoteEn: n.coachNoteEn ?? null,
          coachNoteFa: n.coachNoteFa ?? null,
          isPinned: Boolean(n.isPinned),
          isMuted: Boolean(n.isMuted),
          updatedAtMs: Date.now(),
        })),
      );
    }
  }

  async readCachedGraph(edition: EditionCode): Promise<LinguisticGraphSnapshot> {
    const rows = await this.db.linguisticNodes.where('edition').equals(edition).toArray();
    const mapDto = (r: (typeof rows)[number]) => ({
      nodeId: r.nodeId,
      edition: r.edition,
      nodeKind: r.nodeKind,
      canonicalKey: r.canonicalKey,
      displayLabelEn: r.displayLabelEn,
      displayLabelFa: r.displayLabelFa,
      masteryScoreMilli: r.masteryScoreMilli,
      signalWeightMilli: r.signalWeightMilli,
      evidenceCount: r.evidenceCount,
      lastSeenDaySerial: r.lastSeenDaySerial,
      lastExampleEn: r.lastExampleEn,
      coachNoteEn: r.coachNoteEn,
      coachNoteFa: r.coachNoteFa,
      isPinned: r.isPinned,
      isMuted: r.isMuted,
    });
    const bottlenecks = rows.filter((r) => r.nodeKind === 'bottleneck').map(mapDto);
    const targetStructures = rows.filter((r) => r.nodeKind === 'target_structure').map(mapDto);
    const interestTopics = rows.filter((r) => r.nodeKind === 'interest_topic').map(mapDto);
    const totalEvidenceCount = rows.reduce((s, r) => s + r.evidenceCount, 0);
    return { bottlenecks, targetStructures, interestTopics, totalEvidenceCount };
  }

  async cacheDailyMission(mission: DailyMissionSnapshot): Promise<void> {
    await this.db.dailyMissions.put({
      missionId: mission.missionId,
      edition: mission.edition,
      examTrack: normalizeSupportedExamId(mission.examTrack),
      missionDaySerial: mission.missionDaySerial,
      status: mission.status,
      focusTopic: mission.focusTopic,
      payloadJson: JSON.stringify(mission.payload),
      resultJson: mission.evaluationResult ? JSON.stringify(mission.evaluationResult) : null,
      updatedAtMs: Date.now(),
    });
  }

  async cacheDropItem(item: DroppedContentItem): Promise<void> {
    await this.db.droppedContents.put({
      dropId: item.dropId,
      edition: item.edition,
      inputKind: item.inputKind,
      title: item.title,
      sourceLabel: item.sourceDomainOrLabel,
      cefrEstimate: item.cefrEstimate,
      extractedPhrasesJson: JSON.stringify(item.extractedPhrases),
      drillPayloadJson: JSON.stringify(item.drillPayload),
      completedAtMs: null,
      createdAtMs: Date.parse(item.createdAt) || Date.now(),
    });
  }
}
