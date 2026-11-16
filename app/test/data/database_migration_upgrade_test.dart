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
  });
}
