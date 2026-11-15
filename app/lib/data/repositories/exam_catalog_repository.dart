import 'dart:async';
import 'dart:convert';

import 'package:clock/clock.dart';
import 'package:drift/drift.dart';
import 'package:meta/meta.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/db/app_database.dart';

/// Domain summary of an exam pack synced from PostgreSQL catalog.
@immutable
class InstalledExamPack {
  /// Creates an [InstalledExamPack].
  const new({
    required this.packId,
    required this.skill,
    required this.version,
    required this.localPath,
    this.track = 'academic',
    this.title = '',
    this.description = '',
    this.durationSeconds = 0,
    this.questionCount = 0,
    this.accent,
    this.mediaUrl,
    this.sha256 = '',
    this.isCachedOffline = false,
  });

  /// Pack identifier.
  final String packId;

  /// Exam track (`academic` or `general`).
  final String track;

  /// Primary IELTS skill covered by this pack.
  final SkillKind skill;

  /// Human-readable pack title.
  final String title;

  /// Concise description.
  final String description;

  /// Expected duration in seconds.
  final int durationSeconds;

  /// Total question or task count.
  final int questionCount;

  /// Optional speaker accent (`UK`, `AU`, `US`, `NZ`).
  final String? accent;

  /// Relative `/v1/media/...` path or URL for associated audio/SVG media.
  final String? mediaUrl;

  /// Content version string.
  final String version;

  /// SHA-256 content checksum.
  final String sha256;

  /// Local cache path or route identifier.
  final String localPath;

  /// Whether the full exam bundle JSON is cached in local `ExamPayloads`.
  final bool isCachedOffline;

  /// Alias for [isCachedOffline].
  bool get isDownloaded => isCachedOffline;
}

/// Repository managing PostgreSQL-synced IELTS packs, cached bundles, and micro-drills in Drift.
final class ExamCatalogRepository {
  /// Creates an [ExamCatalogRepository].
  const new({
    required this._db,
    required this._clock,
  });

  final AppDatabase _db;
  final Clock _clock;

  /// Streams catalog packs merged with local offline payload cache status.
  Stream<List<InstalledExamPack>> watchInstalledPacks() {
    late StreamController<List<InstalledExamPack>> controller;
    var currentRows = const <ExamPackRow>[];
    var cachedIds = const <String>{};
    StreamSubscription<List<ExamPackRow>>? packsSub;
    StreamSubscription<List<String>>? cacheSub;

    void emitMerged() {
      if (controller.isClosed) return;
      controller.add(
        currentRows
            .map(
              (row) => InstalledExamPack(
                packId: row.packId,
                track: row.track,
                skill: SkillKind.values.firstWhere(
                  (e) => e.name == row.skill,
                  orElse: () => SkillKind.reading,
                ),
                title: row.title,
                description: row.description,
                durationSeconds: row.durationSeconds,
                questionCount: row.questionCount,
                accent: row.accent,
                mediaUrl: row.mediaUrl,
                version: row.version,
                sha256: row.sha256,
                localPath: row.localPath,
                isCachedOffline: cachedIds.contains(row.packId),
              ),
            )
            .toList(growable: false),
      );
    }

    controller = StreamController<List<InstalledExamPack>>(
      onListen: () {
        packsSub = _db.catalogDao.watchDownloadedPacks().listen(
          (rows) {
            currentRows = rows;
            emitMerged();
          },
          onError: controller.addError,
        );
        cacheSub = _db.catalogDao.watchCachedPackIds().listen(
          (ids) {
            cachedIds = ids.toSet();
            emitMerged();
          },
          onError: controller.addError,
        );
      },
      onCancel: () async {
        await packsSub?.cancel();
        await cacheSub?.cancel();
      },
    );

    return controller.stream;
  }

  /// Registers or updates a single catalog pack entry.
  Future<void> registerPack({
    required String packId,
    required SkillKind skill,
    required String version,
    required String sha256,
    required String localPath,
    String track = 'academic',
    String title = '',
    String description = '',
    int durationSeconds = 0,
    int questionCount = 0,
    String? accent,
    String? mediaUrl,
  }) {
    final now = _clock.now().toUtc();
    return _db.catalogDao.upsertPack(
      ExamPacksCompanion.insert(
        packId: packId,
        track: Value(track),
        skill: skill.name,
        title: Value(title),
        description: Value(description),
        durationSeconds: Value(durationSeconds),
        questionCount: Value(questionCount),
        accent: Value(accent),
        mediaUrl: Value(mediaUrl),
        version: version,
        sha256: sha256,
        localPath: localPath,
        createdAt: now,
        updatedAt: now,
      ),
    );
  }

  /// Upserts catalog manifest summaries synced from `/v1/catalog/manifest`.
  Future<void> saveCatalogManifestPacks(List<Map<String, dynamic>> rawPacks) {
    final now = _clock.now().toUtc();
    final companions = rawPacks
        .map(
          (p) => ExamPacksCompanion.insert(
            packId: p['packId'] as String,
            track: Value((p['track'] as String?) ?? 'academic'),
            skill: (p['skill'] as String?) ?? 'reading',
            title: Value((p['title'] as String?) ?? (p['packId'] as String)),
            description: Value((p['description'] as String?) ?? ''),
            durationSeconds: Value(
              (p['durationSeconds'] as num?)?.toInt() ?? 0,
            ),
            questionCount: Value((p['questionCount'] as num?)?.toInt() ?? 0),
            accent: Value(p['accent'] as String?),
            mediaUrl: Value(p['mediaUrl'] as String?),
            version: (p['version'] as String?) ?? '1.0.0',
            sha256: (p['sha256'] as String?) ?? '',
            localPath:
                (p['downloadUrl'] as String?) ?? '/v1/exams/${p['packId']}',
            createdAt: now,
            updatedAt: now,
          ),
        )
        .toList(growable: false);
    return _db.catalogDao.upsertPacksBatch(companions);
  }

  /// Stores a full `/v1/exams/:packId` payload JSON in Drift for offline access.
  Future<void> saveExamPayload({
    required String packId,
    required Map<String, dynamic> bundle,
  }) {
    final now = _clock.now().toUtc();
    final encoded = jsonEncode(bundle);
    return _db.catalogDao.upsertExamPayload(
      ExamPayloadsCompanion.insert(
        packId: packId,
        bundleJson: encoded,
        sizeBytes: Value(utf8.encode(encoded).length),
        createdAt: now,
        updatedAt: now,
      ),
    );
  }

  /// Reads cached `/v1/exams/:packId` bundle JSON if downloaded locally.
  Future<Map<String, dynamic>?> getCachedExamBundle(String packId) async {
    final row = await _db.catalogDao.getExamPayload(packId);
    if (row == null) return null;
    final decoded = jsonDecode(row.bundleJson);
    return decoded is Map<String, dynamic> ? decoded : null;
  }

  /// Removes offline cached bundle payload for [packId].
  Future<int> deleteCachedExamBundle(String packId) =>
      _db.catalogDao.deleteExamPayload(packId);

  /// Streams total cached bundle byte size across offline packs.
  Stream<int> watchTotalCacheBytes() => _db.catalogDao.watchTotalCacheBytes();

  /// Streams the set of pack IDs that have offline bundle payloads cached locally.
  Stream<Set<String>> watchCachedPackIds() =>
      _db.catalogDao.watchCachedPackIds().map((ids) => ids.toSet());

  /// Clears all cached exam bundle payloads while preserving user progress.
  Future<void> clearOfflineCache() => _db.catalogDao.clearCachedPayloads();

  /// Persists synced micro-drills from `/v1/drills`.
  Future<void> saveSyncedDrills(List<Map<String, dynamic>> rawDrills) {
    final now = _clock.now().toUtc();
    final companions = rawDrills
        .map(
          (d) => CachedDrillsCompanion.insert(
            drillId: d['drillId'] as String,
            title: (d['title'] as String?) ?? 'Micro-Drill',
            drillType: (d['drillType'] as String?) ?? 'LR',
            skill: Value((d['skill'] as String?) ?? 'reading'),
            durationSeconds: Value(
              (d['durationSeconds'] as num?)?.toInt() ?? 180,
            ),
            itemsJson: jsonEncode(d['items'] ?? const <dynamic>[]),
            createdAt: now,
            updatedAt: now,
          ),
        )
        .toList(growable: false);
    return _db.catalogDao.upsertDrillsBatch(companions);
  }

  /// Streams all locally cached micro-drills.
  Stream<List<MicroDrillSpec>> watchDrills() => _db.catalogDao
      .watchCachedDrills()
      .map((rows) => rows.map(_mapDrillRow).toList(growable: false));

  /// Looks up a cached micro-drill by [drillId].
  Future<MicroDrillSpec?> getDrillById(String drillId) async {
    final row = await _db.catalogDao.getCachedDrillById(drillId);
    if (row == null) return null;
    return _mapDrillRow(row);
  }

  /// Parses an exam bundle JSON map into a [ReadingPackSpec].
  ReadingPackSpec parseReadingPack(Map<String, dynamic> bundle) {
    final pack =
        (bundle['pack'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    final rawSections =
        (bundle['sections'] as List<dynamic>?) ?? const <dynamic>[];
    final rawQuestions =
        (bundle['questions'] as List<dynamic>?) ?? const <dynamic>[];

    final questionsBySection = <String, List<QuestionSpec>>{};
    for (final qItem in rawQuestions.whereType<Map<String, dynamic>>()) {
      final secId = (qItem['sectionId'] as String?) ?? '';
      questionsBySection
          .putIfAbsent(secId, () => <QuestionSpec>[])
          .add(
            _parseQuestionSpec(qItem),
          );
    }

    final passages = rawSections
        .whereType<Map<String, dynamic>>()
        .map((s) {
          final secId = (s['sectionId'] as String?) ?? '';
          final rawParas = s['paragraphs'];
          final paragraphs = <String>[];
          if (rawParas is Map) {
            final keys = rawParas.keys.map((k) => k.toString()).toList()
              ..sort();
            for (final k in keys) {
              paragraphs.add(rawParas[k].toString());
            }
          } else if (rawParas is List) {
            for (final p in rawParas) {
              paragraphs.add(p.toString());
            }
          } else {
            final body = (s['contentText'] as String?) ?? '';
            paragraphs.addAll(
              body
                  .split('\n\n')
                  .map((p) => p.trim())
                  .where((p) => p.isNotEmpty),
            );
          }

          return ReadingPassageSpec(
            passageIndex: (s['sectionIndex'] as num?)?.toInt() ?? 1,
            title: (s['title'] as String?) ?? 'Reading Passage',
            paragraphs: paragraphs,
            questions: questionsBySection[secId] ?? const <QuestionSpec>[],
          );
        })
        .toList(growable: false);

    return ReadingPackSpec(
      packId: (pack['packId'] as String?) ?? '',
      title: (pack['title'] as String?) ?? 'Reading Practice',
      passages: passages,
      durationSeconds: (pack['durationSeconds'] as num?)?.toInt() ?? 3600,
    );
  }

  /// Parses an exam bundle JSON map into a [ListeningPackSpec].
  ListeningPackSpec parseListeningPack(Map<String, dynamic> bundle) {
    final pack =
        (bundle['pack'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    final rawSections =
        (bundle['sections'] as List<dynamic>?) ?? const <dynamic>[];
    final rawQuestions =
        (bundle['questions'] as List<dynamic>?) ?? const <dynamic>[];

    final questionsBySection = <String, List<QuestionSpec>>{};
    for (final qItem in rawQuestions.whereType<Map<String, dynamic>>()) {
      final secId = (qItem['sectionId'] as String?) ?? '';
      questionsBySection
          .putIfAbsent(secId, () => <QuestionSpec>[])
          .add(
            _parseQuestionSpec(qItem),
          );
    }

    final sections = rawSections
        .whereType<Map<String, dynamic>>()
        .map((s) {
          final secId = (s['sectionId'] as String?) ?? '';
          final transcriptJson = s['transcript'];
          final transcriptText = transcriptJson != null
              ? jsonEncode(transcriptJson)
              : (s['contentText'] as String?) ?? '';
          return ListeningSectionSpec(
            sectionIndex: (s['sectionIndex'] as num?)?.toInt() ?? 1,
            title: (s['title'] as String?) ?? 'Listening Section',
            accent: (pack['accent'] as String?) ?? 'UK',
            preAudioReadingSeconds: 30,
            questions: questionsBySection[secId] ?? const <QuestionSpec>[],
            transcriptText: transcriptText,
          );
        })
        .toList(growable: false);

    return ListeningPackSpec(
      packId: (pack['packId'] as String?) ?? '',
      title: (pack['title'] as String?) ?? 'Listening Test',
      audioRelativePath: (pack['mediaUrl'] as String?) ?? '',
      sha256: (pack['sha256'] as String?) ?? '',
      sections: sections,
      durationSeconds: (pack['durationSeconds'] as num?)?.toInt() ?? 1800,
    );
  }

  /// Parses an exam bundle JSON map into a list of [WritingTaskSpec] items.
  List<WritingTaskSpec> parseWritingTasks(Map<String, dynamic> bundle) {
    final pack =
        (bundle['pack'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    final rawSections =
        (bundle['sections'] as List<dynamic>?) ?? const <dynamic>[];
    return rawSections
        .whereType<Map<String, dynamic>>()
        .map((s) {
          final secType = (s['sectionType'] as String?) ?? 'task2Essay';
          final isTask1 = secType.toLowerCase().contains('task1');
          final meta =
              (s['metadata'] as Map<String, dynamic>?) ??
              const <String, dynamic>{};
          final normalizedType = switch (secType) {
            'task1_academic' || 'task1Academic' => 'task1Academic',
            'task1_general' || 'task1General' => 'task1General',
            _ =>
              isTask1
                  ? ((pack['track'] == 'general')
                        ? 'task1General'
                        : 'task1Academic')
                  : 'task2Essay',
          };
          return WritingTaskSpec(
            taskId: (s['sectionId'] as String?) ?? '${pack['packId']}-t',
            taskType: normalizedType,
            title:
                (s['title'] as String?) ??
                (isTask1 ? 'Writing Task 1' : 'Writing Task 2'),
            promptBody:
                (s['contentText'] as String?) ??
                (s['instructions'] as String?) ??
                '',
            minWords:
                (meta['minWords'] as num?)?.toInt() ?? (isTask1 ? 150 : 250),
            recommendedSeconds:
                (s['durationSeconds'] as num?)?.toInt() ??
                (isTask1 ? 1200 : 2400),
            chartSvg:
                (s['mediaUrl'] as String?) ?? (pack['mediaUrl'] as String?),
            chartCaption: meta['chartCaption'] as String?,
          );
        })
        .toList(growable: false);
  }

  /// Parses an exam bundle JSON map into a [SpeakingSessionSpec].
  SpeakingSessionSpec parseSpeakingSession(Map<String, dynamic> bundle) {
    final pack =
        (bundle['pack'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    final rawSections =
        (bundle['sections'] as List<dynamic>?) ?? const <dynamic>[];
    final prompts = rawSections
        .whereType<Map<String, dynamic>>()
        .map((s) {
          final partIndex = (s['sectionIndex'] as num?)?.toInt() ?? 1;
          final meta =
              (s['metadata'] as Map<String, dynamic>?) ??
              const <String, dynamic>{};
          final rawBullets =
              (meta['bulletPoints'] as List<dynamic>?) ??
              (meta['cueCardBullets'] as List<dynamic>?) ??
              const <dynamic>[];
          return SpeakingPromptSpec(
            promptId: (s['sectionId'] as String?) ?? 'part-$partIndex',
            partIndex: partIndex,
            promptText:
                (s['contentText'] as String?) ?? (s['title'] as String?) ?? '',
            bulletPoints: rawBullets
                .map((b) => b.toString())
                .toList(growable: false),
            prepSeconds:
                (meta['prepSeconds'] as num?)?.toInt() ??
                (partIndex == 2 ? 60 : 0),
            speakSeconds:
                (s['durationSeconds'] as num?)?.toInt() ??
                (partIndex == 2 ? 120 : 60),
          );
        })
        .toList(growable: false);

    return SpeakingSessionSpec(
      sessionId: (pack['packId'] as String?) ?? '',
      title: (pack['title'] as String?) ?? 'Speaking Simulator',
      prompts: prompts,
    );
  }

  MicroDrillSpec _mapDrillRow(CachedDrillRow row) {
    final decoded = jsonDecode(row.itemsJson);
    final rawItems = decoded is List ? decoded : const <dynamic>[];
    final items = rawItems
        .whereType<Map<String, dynamic>>()
        .map((item) {
          final opts = (item['options'] as List<dynamic>?) ?? const <dynamic>[];
          final ans =
              (item['acceptedAnswers'] as List<dynamic>?) ?? const <dynamic>[];
          return MicroDrillItemSpec(
            itemId: (item['itemId'] as String?) ?? '',
            prompt: (item['prompt'] as String?) ?? '',
            options: opts.map((o) => o.toString()).toList(growable: false),
            acceptedAnswers: ans
                .map((a) => a.toString())
                .toList(growable: false),
            explanation: (item['explanation'] as String?) ?? '',
          );
        })
        .toList(growable: false);

    return MicroDrillSpec(
      drillId: row.drillId,
      weaknessCode: row.drillType,
      title: row.title,
      subtitle: 'Focused ${row.skill} weakness drill',
      items: items,
      durationSeconds: row.durationSeconds,
    );
  }

  QuestionSpec _parseQuestionSpec(Map<String, dynamic> qItem) {
    final rawType = ((qItem['questionType'] as String?) ?? 'short_answer')
        .toLowerCase();
    final qType = switch (rawType) {
      'tfng' => ObjectiveQuestionType.tfng,
      'ynng' => ObjectiveQuestionType.ynng,
      'mcq_single' || 'mcqsingle' || 'mcq' => ObjectiveQuestionType.mcqSingle,
      'mcq_multi' || 'mcqmulti' => ObjectiveQuestionType.mcqMulti,
      'matching_headings' ||
      'matchingheadings' ||
      'matching' => ObjectiveQuestionType.matchingHeadings,
      'summary_gap_fill' ||
      'summarygapfill' ||
      'gap_fill' ||
      'form_completion' => ObjectiveQuestionType.summaryGapFill,
      _ => ObjectiveQuestionType.shortAnswer,
    };

    final rawEv = qItem['evidence'] as Map<String, dynamic>?;
    final evidenceSpan = rawEv != null
        ? EvidenceSpanSpec(
            paragraphIndex: (rawEv['paragraphIndex'] as num?)?.toInt() ?? 1,
            startOffset: (rawEv['startOffset'] as num?)?.toInt() ?? 0,
            endOffset: (rawEv['endOffset'] as num?)?.toInt() ?? 0,
            exactQuote: (rawEv['exactQuote'] as String?) ?? '',
            notGivenOmissionReason: rawEv['notGivenOmissionReason'] as String?,
          )
        : null;

    final rawOpts = qItem['options'];
    final options = rawOpts is List
        ? rawOpts.map((e) => e.toString()).toList(growable: false)
        : const <String>[];
    final rawAnswers = qItem['acceptedAnswers'];
    final accepted = rawAnswers is List
        ? rawAnswers.map((e) => e.toString()).toList(growable: false)
        : const <String>[];

    return QuestionSpec(
      questionId: (qItem['questionId'] as String?) ?? '',
      number: (qItem['questionNumber'] as num?)?.toInt() ?? 1,
      prompt: (qItem['prompt'] as String?) ?? '',
      questionType: qType,
      acceptedVariants: accepted,
      options: options,
      evidenceSpan: evidenceSpan,
      distractorExplanation: rawEv?['distractorExplanation'] as String?,
    );
  }
}
