import 'dart:io';

import 'package:drift/native.dart';
import 'package:mockza/data/db/app_database.dart';
import 'package:sqlite3/sqlite3.dart' as sqlite;
import 'package:test/test.dart';

void main() {
  group('Drift Schema Migration Upgrade Tests (TD-44)', () {
    test('upgrades real v1 SQLite database to v3 preserving seeded rows', () async {
      final tempDir = await Directory.systemTemp.createTemp('mockza_mig_v1_');
      addTearDown(() => tempDir.delete(recursive: true));
      final dbFile = File('${tempDir.path}/mockza_v1.sqlite');

      final rawDb = sqlite.sqlite3.open(dbFile.path)
        ..execute('''
        CREATE TABLE user_profiles (
          device_id TEXT NOT NULL PRIMARY KEY,
          target_band REAL NOT NULL DEFAULT 7.0,
          exam_module TEXT NOT NULL DEFAULT 'academic',
          is_pro INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE exam_packs (
          pack_id TEXT NOT NULL PRIMARY KEY,
          skill TEXT NOT NULL,
          version TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          local_path TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE exam_attempts (
          attempt_id TEXT NOT NULL PRIMARY KEY,
          pack_id TEXT NOT NULL,
          skill TEXT NOT NULL,
          status TEXT NOT NULL,
          remote_job_id TEXT NULL,
          submission_json TEXT NOT NULL,
          evaluation_json TEXT NULL,
          overall_band REAL NULL,
          error_code TEXT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE audio_recordings (
          recording_id TEXT NOT NULL PRIMARY KEY,
          attempt_id TEXT NOT NULL REFERENCES exam_attempts(attempt_id) ON DELETE CASCADE,
          part_index INTEGER NOT NULL,
          local_file_path TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          sha256 TEXT NULL,
          upload_status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE vocab_cards (
          card_id TEXT NOT NULL PRIMARY KEY,
          headword TEXT NOT NULL,
          ipa TEXT NULL,
          definition TEXT NOT NULL,
          topic_tag TEXT NOT NULL,
          repetitions INTEGER NOT NULL DEFAULT 0,
          interval_days INTEGER NOT NULL DEFAULT 0,
          ease_factor REAL NOT NULL DEFAULT 2.5,
          due_day INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE daily_study_logs (
          serial_day INTEGER NOT NULL PRIMARY KEY,
          study_seconds INTEGER NOT NULL DEFAULT 0,
          completed_items INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE outbox_sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      ''');

      const ts = 1763294400;
      rawDb
        ..execute(
          "INSERT INTO user_profiles (device_id, target_band, exam_module, is_pro, created_at, updated_at) VALUES ('dev-v1-uuid', 7.5, 'academic', 1, $ts, $ts);",
        )
        ..execute(
          "INSERT INTO exam_attempts (attempt_id, pack_id, skill, status, submission_json, overall_band, created_at, updated_at) VALUES ('att-v1-1', 'r-01', 'reading', 'scored', '{}', 7.0, $ts, $ts);",
        )
        ..execute(
          "INSERT INTO vocab_cards (card_id, headword, definition, topic_tag, repetitions, interval_days, due_day, created_at, updated_at) VALUES ('v-1', 'resilient', 'able to recover', 'env', 2, 6, 20050, $ts, $ts);",
        )
        ..execute('PRAGMA user_version = 1;')
        ..close();

      final db = AppDatabase(NativeDatabase(dbFile));
      addTearDown(db.close);

      final profiles = await db.select(db.userProfiles).get();
      expect(profiles, hasLength(1));
      expect(profiles.single.deviceId, 'dev-v1-uuid');
      expect(profiles.single.targetBand, 7.5);
      expect(profiles.single.isPro, isTrue);
      expect(profiles.single.themeMode, 'system');

      final attempts = await db.select(db.examAttempts).get();
      expect(attempts, hasLength(1));
      expect(attempts.single.attemptId, 'att-v1-1');
      expect(attempts.single.overallBand, 7.0);
      expect(attempts.single.examId, 'ielts_academic');

      final cards = await db.select(db.vocabCards).get();
      expect(cards, hasLength(1));
      expect(cards.single.easeFactorMilli, 2500);

      // Verify v2 + v3 tables are writable post-upgrade
      final payloads = await db.select(db.examPayloads).get();
      expect(payloads, isEmpty);
      final drills = await db.select(db.cachedDrills).get();
      expect(drills, isEmpty);
      final drafts = await db.select(db.writingDrafts).get();
      expect(drafts, isEmpty);
    });

    test('upgrades v2 SQLite database to v3 without losing data', () async {
      final tempDir = await Directory.systemTemp.createTemp('mockza_mig_v2_');
      addTearDown(() => tempDir.delete(recursive: true));
      final dbFile = File('${tempDir.path}/mockza_v2.sqlite');

      final rawDb = sqlite.sqlite3.open(dbFile.path)
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
        CREATE TABLE exam_packs (
          pack_id TEXT NOT NULL PRIMARY KEY,
          skill TEXT NOT NULL,
          version TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          local_path TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE exam_attempts (
          attempt_id TEXT NOT NULL PRIMARY KEY,
          exam_id TEXT NOT NULL DEFAULT 'ielts_academic',
          pack_id TEXT NOT NULL,
          skill TEXT NOT NULL,
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
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE audio_recordings (
          recording_id TEXT NOT NULL PRIMARY KEY,
          attempt_id TEXT NOT NULL REFERENCES exam_attempts(attempt_id) ON DELETE CASCADE,
          part_index INTEGER NOT NULL,
          local_file_path TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          sha256 TEXT NULL,
          upload_status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE writing_drafts (
          attempt_id TEXT NOT NULL PRIMARY KEY,
          pack_id TEXT NOT NULL,
          task_type TEXT NOT NULL,
          draft_text TEXT NOT NULL,
          word_count INTEGER NOT NULL DEFAULT 0,
          timer_remaining_sec INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE reading_annotations (
          annotation_id TEXT NOT NULL PRIMARY KEY,
          pack_id TEXT NOT NULL,
          passage_index INTEGER NOT NULL DEFAULT 0,
          start_offset INTEGER NOT NULL,
          end_offset INTEGER NOT NULL,
          color_code TEXT NOT NULL DEFAULT 'yellow',
          note_text TEXT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE vocab_cards (
          card_id TEXT NOT NULL PRIMARY KEY,
          headword TEXT NOT NULL,
          ipa TEXT NULL,
          definition TEXT NOT NULL,
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
        CREATE TABLE vocab_review_logs (
          log_id TEXT NOT NULL PRIMARY KEY,
          card_id TEXT NOT NULL REFERENCES vocab_cards(card_id) ON DELETE CASCADE,
          rating INTEGER NOT NULL,
          reviewed_day_serial INTEGER NOT NULL,
          reviewed_at_utc_ms INTEGER NOT NULL
        );
        CREATE TABLE daily_study_logs (
          serial_day INTEGER NOT NULL PRIMARY KEY,
          study_seconds INTEGER NOT NULL DEFAULT 0,
          completed_items INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE outbox_sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      ''');

      const ts = 1763294400;
      rawDb
        ..execute(
          "INSERT INTO exam_packs (pack_id, skill, version, sha256, local_path, created_at, updated_at) VALUES ('p-v2', 'reading', '1.0.0', 'abc', '/p', $ts, $ts);",
        )
        ..execute('PRAGMA user_version = 2;')
        ..close();

      final db = AppDatabase(NativeDatabase(dbFile));
      addTearDown(db.close);

      final packs = await db.select(db.examPacks).get();
      expect(packs, hasLength(1));
      expect(packs.single.packId, 'p-v2');
      expect(packs.single.track, 'academic');
      expect(packs.single.questionCount, 0);
    });

    test('RR-10/RR-11: upgrades v3 SQLite database to v4 adding calibration & mock session schema', () async {
      final tempDir = await Directory.systemTemp.createTemp('mockza_mig_v3_');
      addTearDown(() => tempDir.delete(recursive: true));
      final dbFile = File('${tempDir.path}/mockza_v3.sqlite');

      final rawDb = sqlite.sqlite3.open(dbFile.path)
        ..execute('''
        CREATE TABLE user_profiles (
          device_id TEXT NOT NULL PRIMARY KEY,
          exam_id TEXT NOT NULL DEFAULT 'ielts_academic',
          target_band REAL NOT NULL DEFAULT 7.0,
          exam_module TEXT NOT NULL DEFAULT 'academic',
          is_pro INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE exam_packs (
          pack_id TEXT NOT NULL PRIMARY KEY,
          skill TEXT NOT NULL,
          version TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          local_path TEXT NOT NULL,
          track TEXT NOT NULL DEFAULT 'academic',
          title TEXT NOT NULL DEFAULT '',
          description TEXT NOT NULL DEFAULT '',
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          question_count INTEGER NOT NULL DEFAULT 0,
          accent TEXT NULL,
          media_url TEXT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE exam_payloads (
          pack_id TEXT NOT NULL PRIMARY KEY,
          bundle_json TEXT NOT NULL,
          size_bytes INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE cached_drills (
          drill_id TEXT NOT NULL PRIMARY KEY,
          title TEXT NOT NULL,
          drill_type TEXT NOT NULL,
          skill TEXT NOT NULL DEFAULT 'reading',
          duration_seconds INTEGER NOT NULL DEFAULT 180,
          items_json TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE exam_attempts (
          attempt_id TEXT NOT NULL PRIMARY KEY,
          exam_id TEXT NOT NULL DEFAULT 'ielts_academic',
          pack_id TEXT NOT NULL,
          skill TEXT NOT NULL,
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
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE audio_recordings (
          recording_id TEXT NOT NULL PRIMARY KEY,
          attempt_id TEXT NOT NULL REFERENCES exam_attempts(attempt_id) ON DELETE CASCADE,
          part_index INTEGER NOT NULL,
          local_file_path TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          sha256 TEXT NULL,
          upload_status TEXT NOT NULL DEFAULT 'pending',
          remote_object_key TEXT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE writing_drafts (
          attempt_id TEXT NOT NULL PRIMARY KEY REFERENCES exam_attempts(attempt_id) ON DELETE CASCADE,
          pack_id TEXT NOT NULL,
          task_type TEXT NOT NULL,
          draft_text TEXT NOT NULL,
          word_count INTEGER NOT NULL,
          timer_remaining_sec INTEGER NOT NULL,
          last_saved_at INTEGER NOT NULL
        );
        CREATE TABLE reading_annotations (
          annotation_id TEXT NOT NULL PRIMARY KEY,
          pack_id TEXT NOT NULL,
          passage_index INTEGER NOT NULL DEFAULT 0,
          start_offset INTEGER NOT NULL,
          end_offset INTEGER NOT NULL,
          color_code TEXT NOT NULL DEFAULT 'yellow',
          note_text TEXT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE vocab_cards (
          card_id TEXT NOT NULL PRIMARY KEY,
          headword TEXT NOT NULL,
          ipa TEXT NULL,
          definition TEXT NOT NULL,
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
        CREATE TABLE vocab_review_logs (
          log_id TEXT NOT NULL PRIMARY KEY,
          card_id TEXT NOT NULL REFERENCES vocab_cards(card_id) ON DELETE CASCADE,
          rating INTEGER NOT NULL,
          reviewed_day_serial INTEGER NOT NULL,
          reviewed_at_utc_ms INTEGER NOT NULL
        );
        CREATE TABLE daily_study_logs (
          serial_day INTEGER NOT NULL PRIMARY KEY,
          study_seconds INTEGER NOT NULL DEFAULT 0,
          completed_items INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE outbox_sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      ''');

      const ts = 1763294400;
      rawDb
        ..execute(
          "INSERT INTO exam_attempts (attempt_id, pack_id, skill, status, submission_json, overall_band, created_at, updated_at) VALUES ('att-v3-1', 'r-40', 'reading', 'scored', '{}', 7.5, $ts, $ts);",
        )
        ..execute('PRAGMA user_version = 3;')
        ..close();

      final db = AppDatabase(NativeDatabase(dbFile));
      addTearDown(db.close);

      final attempts = await db.select(db.examAttempts).get();
      expect(attempts, hasLength(1));
      expect(attempts.single.attemptId, 'att-v3-1');
      expect(attempts.single.questionCount, 0);
      expect(attempts.single.isCalibratedFullPack, isTrue);

      await db.attemptDao.upsertMockSession(
        MockSessionsCompanion.insert(
          mockId: 'mock-acad-01',
          startedAtUtcMs: ts * 1000,
          createdAt: DateTime.fromMillisecondsSinceEpoch(
            ts * 1000,
            isUtc: true,
          ),
          updatedAt: DateTime.fromMillisecondsSinceEpoch(
            ts * 1000,
            isUtc: true,
          ),
        ),
      );
      final mockSession = await db.attemptDao.getMockSession('mock-acad-01');
      expect(mockSession, isNotNull);
      expect(mockSession!.examMode, isTrue);
    });

    test('upgrades v4 SQLite database to v5 preserving rows and creating diagnostic_sessions', () async {
      final tempDir = await Directory.systemTemp.createTemp('mockza_mig_v4_');
      addTearDown(() => tempDir.delete(recursive: true));
      final dbFile = File('${tempDir.path}/mockza_v4.sqlite');

      final rawDb = sqlite.sqlite3.open(dbFile.path)
        ..execute('''
        CREATE TABLE user_profiles (
          device_id TEXT NOT NULL PRIMARY KEY,
          exam_id TEXT NOT NULL DEFAULT 'ielts_academic',
          target_band REAL NOT NULL DEFAULT 7.0,
          exam_module TEXT NOT NULL DEFAULT 'academic',
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
        CREATE TABLE exam_packs (
          pack_id TEXT NOT NULL PRIMARY KEY,
          skill TEXT NOT NULL,
          exam_id TEXT NOT NULL DEFAULT 'ielts_academic',
          track TEXT NOT NULL DEFAULT 'academic',
          title TEXT NOT NULL DEFAULT 'Practice Pack',
          duration_seconds INTEGER NOT NULL DEFAULT 600,
          version TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          local_path TEXT NOT NULL,
          is_downloaded INTEGER NOT NULL DEFAULT 0,
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
        CREATE TABLE mock_sessions (
          mock_id TEXT NOT NULL PRIMARY KEY,
          track TEXT NOT NULL DEFAULT 'academic',
          started_at_utc_ms INTEGER NOT NULL,
          completed_at_utc_ms INTEGER NULL,
          exam_mode INTEGER NOT NULL DEFAULT 1,
          stage_attempt_ids_json TEXT NOT NULL DEFAULT '{}',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE vocab_cards (
          card_id TEXT NOT NULL PRIMARY KEY,
          headword TEXT NOT NULL,
          ipa TEXT NULL,
          definition TEXT NOT NULL,
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
        CREATE TABLE vocab_review_logs (
          log_id TEXT NOT NULL PRIMARY KEY,
          card_id TEXT NOT NULL REFERENCES vocab_cards(card_id) ON DELETE CASCADE,
          rating INTEGER NOT NULL,
          reviewed_day_serial INTEGER NOT NULL,
          reviewed_at_utc_ms INTEGER NOT NULL
        );
        CREATE TABLE writing_drafts (
          draft_id TEXT NOT NULL PRIMARY KEY,
          task_id TEXT NOT NULL,
          task_index INTEGER NOT NULL,
          draft_text TEXT NOT NULL,
          word_count INTEGER NOT NULL,
          timer_remaining_sec INTEGER NOT NULL,
          last_saved_at INTEGER NOT NULL
        );
        CREATE TABLE reading_annotations (
          annotation_id TEXT NOT NULL PRIMARY KEY,
          pack_id TEXT NOT NULL,
          passage_index INTEGER NOT NULL DEFAULT 0,
          start_offset INTEGER NOT NULL,
          end_offset INTEGER NOT NULL,
          color_code TEXT NOT NULL DEFAULT 'yellow',
          note_text TEXT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          is_deleted INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE daily_study_logs (
          serial_day INTEGER NOT NULL PRIMARY KEY,
          study_seconds INTEGER NOT NULL DEFAULT 0,
          completed_items INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE outbox_sync_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          action_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_attempt_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE audio_recordings (
          recording_id TEXT NOT NULL PRIMARY KEY,
          attempt_id TEXT NOT NULL REFERENCES exam_attempts(attempt_id) ON DELETE CASCADE,
          part_index INTEGER NOT NULL,
          local_file_path TEXT NOT NULL,
          duration_ms INTEGER NOT NULL DEFAULT 0,
          sha256 TEXT NULL,
          remote_object_key TEXT NULL,
          upload_status TEXT NOT NULL DEFAULT 'pending',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      ''');

      const ts = 1763294400;
      rawDb
        ..execute(
          "INSERT INTO user_profiles (device_id, target_band, onboarding_completed, created_at, updated_at) VALUES ('dev-v4-1', 7.5, 1, $ts, $ts);",
        )
        ..execute('PRAGMA user_version = 4;')
        ..close();

      final db = AppDatabase(NativeDatabase(dbFile));
      addTearDown(db.close);

      final profiles = await db.select(db.userProfiles).get();
      expect(profiles, hasLength(1));
      expect(profiles.single.deviceId, 'dev-v4-1');
      expect(profiles.single.freeDiagnosticUsed, isFalse);

      final now = DateTime.fromMillisecondsSinceEpoch(ts * 1000, isUtc: true);
      await db.attemptDao.upsertDiagnosticSession(
        DiagnosticSessionsCompanion.insert(
          diagId: 'diag-v5-test',
          examId: 'ielts_academic',
          policyVersion: '2026-11-17.v1',
          contentVersion: 'diag-2026-11-17.v1',
          selectionSeed: 'seed-1',
          startedAtUtcMs: ts * 1000,
          collectionDeadlineUtcMs: (ts + 540) * 1000,
          resultsDeadlineUtcMs: (ts + 600) * 1000,
          createdAt: now,
          updatedAt: now,
        ),
      );
      final diag = await db.attemptDao.getDiagnosticSession('diag-v5-test');
      expect(diag, isNotNull);
      expect(diag!.diagId, 'diag-v5-test');
      expect(diag.mode, 'standard');
    });
  });
}
