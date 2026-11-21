import 'dart:io';

import 'package:drift/native.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:mockza/data/repositories/linguistic_repository.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:sqlite3/sqlite3.dart' as sqlite;
import 'package:test/test.dart';

import '../support/fakes.dart';

void main() {
  group('Drift v6 -> v7 Closed-Loop Migration Tests (Phase A6)', () {
    test(
      'upgrades real v6 SQLite database to v7 creating linguistic_nodes, daily_missions, dropped_contents and wipes cleanly',
      () async {
        final tempDir = await Directory.systemTemp.createTemp('mockza_mig_v6_');
        addTearDown(() => tempDir.delete(recursive: true));
        final dbFile = File('${tempDir.path}/mockza_v6.sqlite');

        const ts = 1763294400;
        sqlite.sqlite3.open(dbFile.path)
          ..execute('''
            CREATE TABLE user_profiles (
              device_id TEXT NOT NULL PRIMARY KEY,
              target_band REAL NOT NULL DEFAULT 7.0,
              exam_module TEXT NOT NULL DEFAULT 'academic',
              exam_id TEXT NOT NULL DEFAULT 'ielts_academic',
              target_date_serial INTEGER NULL,
              onboarding_completed INTEGER NOT NULL DEFAULT 0,
              free_diagnostic_used INTEGER NOT NULL DEFAULT 0,
              theme_mode TEXT NOT NULL DEFAULT 'system',
              linked_email TEXT NULL,
              app_user_id TEXT NULL,
              is_pro INTEGER NOT NULL DEFAULT 0,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
            CREATE TABLE exam_attempts (
              attempt_id TEXT NOT NULL PRIMARY KEY,
              pack_id TEXT NOT NULL,
              skill TEXT NOT NULL,
              exam_id TEXT NOT NULL DEFAULT 'ielts_academic',
              status TEXT NOT NULL,
              remote_job_id TEXT NULL,
              submission_json TEXT NOT NULL,
              evaluation_json TEXT NULL,
              overall_band REAL NULL,
              error_code TEXT NULL,
              started_at_utc_ms INTEGER NULL,
              completed_at_utc_ms INTEGER NULL,
              duration_seconds INTEGER NOT NULL DEFAULT 0,
              used_study_mode INTEGER NOT NULL DEFAULT 0,
              question_count INTEGER NOT NULL DEFAULT 0,
              is_calibrated_full_pack INTEGER NOT NULL DEFAULT 1,
              content_version TEXT NULL,
              mock_session_id TEXT NULL,
              mock_stage_key TEXT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
            CREATE TABLE vocab_cards (
              card_id TEXT NOT NULL PRIMARY KEY,
              headword TEXT NOT NULL,
              ipa TEXT NULL,
              definition TEXT NOT NULL,
              gloss_fa TEXT NULL,
              topic_tag TEXT NOT NULL,
              repetitions INTEGER NOT NULL DEFAULT 0,
              interval_days INTEGER NOT NULL DEFAULT 0,
              ease_factor REAL NOT NULL DEFAULT 2.5,
              ease_factor_milli INTEGER NOT NULL DEFAULT 2500,
              due_day INTEGER NOT NULL,
              due_day_serial INTEGER NOT NULL DEFAULT 0,
              context_sentence TEXT NULL,
              paraphrase_hints_json TEXT NULL,
              usage_note TEXT NULL,
              source_skill TEXT NULL,
              source_attempt_id TEXT NULL,
              source_ref_label TEXT NULL,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL
            );
          ''')
          ..execute(
            "INSERT INTO user_profiles (device_id, target_band, onboarding_completed, created_at, updated_at) VALUES ('dev-v6-1', 8.0, 1, $ts, $ts);",
          )
          ..execute(
            "INSERT INTO vocab_cards (card_id, headword, definition, gloss_fa, topic_tag, due_day, due_day_serial, created_at, updated_at) VALUES ('v6-card-1', 'albeit', 'although', 'هرچند', 'academic', 20770, 20770, $ts, $ts);",
          )
          ..execute('PRAGMA user_version = 6;')
          ..close();

        final db = AppDatabase(NativeDatabase(dbFile));
        addTearDown(db.close);

        // Verify v6 rows survived intact with v9 defaults.
        final profiles = await db.select(db.userProfiles).get();
        expect(profiles, hasLength(1));
        expect(profiles.single.deviceId, 'dev-v6-1');
        expect(profiles.single.studyFocus, 'both');

        final cards = await db.select(db.vocabCards).get();
        expect(cards, hasLength(1));
        expect(cards.single.headword, 'albeit');
        expect(cards.single.glossFa, 'هرچند');

        // Verify all 3 v7 tables exist and accept repository writes + reads.
        final clock = fixedTestClock();
        final repo = LinguisticRepository(db: db, clock: clock);
        final day = SerialDay.fromUtcDateTime(clock.now()).value;

        await repo.cacheGraphSnapshot(
          LinguisticGraphSnapshot(
            bottlenecks: <LinguisticNodeDto>[
              LinguisticNodeDto(
                nodeId: 'node-b-1',
                edition: 'irn',
                nodeKind: 'bottleneck',
                canonicalKey: 'grammar:conditionals',
                displayLabelEn: 'Avoids conditional clauses',
                displayLabelFa: 'اجتناب از جملات شرطی',
                masteryScoreMilli: 340,
                signalWeightMilli: 860,
                evidenceCount: 3,
                lastSeenDaySerial: day,
              ),
            ],
            targetStructures: <LinguisticNodeDto>[
              LinguisticNodeDto(
                nodeId: 'node-t-1',
                edition: 'irn',
                nodeKind: 'target_structure',
                canonicalKey: 'vocab:albeit',
                displayLabelEn: 'albeit',
                masteryScoreMilli: 790,
                signalWeightMilli: 640,
                evidenceCount: 2,
                lastSeenDaySerial: day,
              ),
            ],
            interestTopics: <LinguisticNodeDto>[
              LinguisticNodeDto(
                nodeId: 'node-i-1',
                edition: 'irn',
                nodeKind: 'interest_topic',
                canonicalKey: 'topic:football',
                displayLabelEn: 'Football',
                displayLabelFa: 'فوتبال',
                masteryScoreMilli: 600,
                signalWeightMilli: 700,
                evidenceCount: 4,
                lastSeenDaySerial: day,
                isPinned: true,
              ),
            ],
            totalEvidenceCount: 9,
          ),
          edition: 'irn',
        );

        final cachedGraph = await repo.readCachedGraphSnapshot(edition: 'irn');
        expect(cachedGraph.bottlenecks, hasLength(1));
        expect(
          cachedGraph.bottlenecks.single.displayLabelFa,
          'اجتناب از جملات شرطی',
        );
        expect(cachedGraph.targetStructures, hasLength(1));
        expect(cachedGraph.interestTopics.single.displayLabelEn, 'Football');
        expect(cachedGraph.interestTopics.single.signalWeightMilli, 700);

        await repo.cacheDailyMission(
          DailyMissionSnapshot(
            missionId: 'mission-v7-1',
            edition: 'irn',
            examTrack: 'ielts_academic',
            missionDaySerial: day,
            status: 'ready',
            focusTopic: 'Football',
            promptTitle: 'Tactical Analysis & Conditionals',
            promptTextEn: 'Explain how a team could have won if they had pressed earlier.',
            promptTextFa: 'با استفاده از جملات شرطی نوع سوم توضیح دهید.',
            forcedTargets: const <ForcedTargetDto>[
              ForcedTargetDto(
                canonicalKey: 'grammar:conditionals',
                phraseEn: 'had + past participle, would have',
                hintEn: 'Use a third conditional for unrealized past tactics.',
                hintFa: 'از شرطی نوع سوم استفاده کنید.',
              ),
            ],
          ),
        );
        final cachedMission = await repo.readTodayCachedMission();
        expect(cachedMission?.missionId, 'mission-v7-1');

        await repo.cacheDroppedContent(
          const DroppedContentDto(
            dropId: 'drop-v7-1',
            inputKind: 'text',
            sourceDomainOrLabel: 'AI Newsletter',
            title: 'Edge Inference Tradeoffs',
            cefrEstimate: 'C1',
            extractedPhrases: <DroppedPhraseDto>[
              DroppedPhraseDto(
                headword: 'trade-off',
                definitionEn:
                    'A balance achieved between incompatible features.',
                glossFa: 'موازنه / بده‌بستان',
                exampleSentence: 'Quantization strikes a deliberate trade-off between memory and accuracy.',
              ),
            ],
            comprehensionPrompt: 'What does quantization trade off?',
            comprehensionOptions: <String>[
              'Memory footprint and exact numeric precision',
              'Display brightness and network speed',
            ],
            correctOptionIndex: 0,
            clozeSentence:
                'Engineering requires a ___ between latency and size.',
            clozeAnswer: 'trade-off',
            shadowingPrompt: 'Repeat aloud clearly.',
            createdAtIso: '2026-11-21T10:00:00Z',
          ),
        );
        final cachedDrops = await repo.listCachedDrops();
        expect(cachedDrops, hasLength(1));
        expect(cachedDrops.single.title, 'Edge Inference Tradeoffs');
      },
    );

    test(
      'wipeAllData removes all v7 linguistic_nodes, daily_missions, and dropped_contents rows cleanly',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final clock = fixedTestClock();
        final repo = LinguisticRepository(db: db, clock: clock);
        final day = SerialDay.fromUtcDateTime(clock.now()).value;

        await repo.cacheGraphSnapshot(
          LinguisticGraphSnapshot(
            bottlenecks: <LinguisticNodeDto>[
              LinguisticNodeDto(
                nodeId: 'wipe-node-1',
                edition: 'glb',
                nodeKind: 'bottleneck',
                canonicalKey: 'grammar:conditionals',
                displayLabelEn: 'Conditionals',
                masteryScoreMilli: 400,
                signalWeightMilli: 800,
                evidenceCount: 2,
                lastSeenDaySerial: day,
              ),
            ],
            targetStructures: const <LinguisticNodeDto>[],
            interestTopics: const <LinguisticNodeDto>[],
            totalEvidenceCount: 2,
          ),
          edition: 'glb',
        );
        await repo.cacheDailyMission(
          DailyMissionSnapshot(
            missionId: 'wipe-mission-1',
            edition: 'glb',
            examTrack: 'ielts_academic',
            missionDaySerial: day,
            status: 'ready',
            focusTopic: 'AI',
            promptTitle: 'Title',
            promptTextEn: 'Prompt',
            forcedTargets: const <ForcedTargetDto>[],
          ),
        );
        await repo.cacheDroppedContent(
          const DroppedContentDto(
            dropId: 'wipe-drop-1',
            inputKind: 'text',
            sourceDomainOrLabel: 'Notes',
            title: 'Wipe Drop',
            cefrEstimate: 'B2',
            extractedPhrases: <DroppedPhraseDto>[],
            comprehensionPrompt: 'Q?',
            comprehensionOptions: <String>['A', 'B'],
            correctOptionIndex: 0,
            clozeSentence: '___',
            clozeAnswer: 'x',
            shadowingPrompt: 'Say x',
            createdAtIso: '2026-11-21T10:00:00Z',
          ),
        );

        await db.wipeAllData();
        expect(
          (await repo.readCachedGraphSnapshot(edition: 'glb'))
              .totalEvidenceCount,
          0,
        );
        expect(await repo.readTodayCachedMission(), isNull);
        expect(await repo.listCachedDrops(), isEmpty);
      },
    );

    test(
      'preserves isPinned and isMuted flags on linguistic_nodes across Drift v8 persistence',
      () async {
        final db = createTestDatabase();
        addTearDown(db.close);
        final clock = fixedTestClock();
        final repo = LinguisticRepository(db: db, clock: clock);
        final day = SerialDay.fromUtcDateTime(clock.now()).value;

        await repo.cacheGraphSnapshot(
          LinguisticGraphSnapshot(
            bottlenecks: const <LinguisticNodeDto>[],
            targetStructures: const <LinguisticNodeDto>[],
            interestTopics: <LinguisticNodeDto>[
              LinguisticNodeDto(
                nodeId: 'pin-node-1',
                edition: 'irn',
                nodeKind: 'interest_topic',
                canonicalKey: 'topic:cinema',
                displayLabelEn: 'Cinema',
                displayLabelFa: 'سینما',
                masteryScoreMilli: 500,
                signalWeightMilli: 750,
                evidenceCount: 1,
                lastSeenDaySerial: day,
                isPinned: true,
              ),
              LinguisticNodeDto(
                nodeId: 'mute-node-1',
                edition: 'irn',
                nodeKind: 'interest_topic',
                canonicalKey: 'topic:finance',
                displayLabelEn: 'Finance',
                masteryScoreMilli: 400,
                signalWeightMilli: 200,
                evidenceCount: 1,
                lastSeenDaySerial: day,
                isMuted: true,
              ),
            ],
            totalEvidenceCount: 2,
          ),
          edition: 'irn',
        );

        final loaded = await repo.readCachedGraphSnapshot(edition: 'irn');
        expect(loaded.interestTopics, hasLength(2));
        final cinema = loaded.interestTopics.firstWhere(
          (n) => n.nodeId == 'pin-node-1',
        );
        final finance = loaded.interestTopics.firstWhere(
          (n) => n.nodeId == 'mute-node-1',
        );
        expect(cinema.isPinned, isTrue);
        expect(cinema.isMuted, isFalse);
        expect(finance.isPinned, isFalse);
        expect(finance.isMuted, isTrue);
      },
    );
  });
}
