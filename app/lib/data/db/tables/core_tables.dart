import 'package:drift/drift.dart';
import 'package:mockza/data/db/tables/audit_columns.dart';

/// Local learner profile and target settings (single active row per device).
@DataClassName('UserProfileRow')
class UserProfiles extends Table with AuditColumns {
  /// Stable device-bound learner identifier.
  TextColumn get deviceId => text()();

  /// Learner target IELTS band score (`0.0..9.0`).
  RealColumn get targetBand => real().withDefault(const Constant(7))();

  /// Selected IELTS track (`academic` or `generalTraining`).
  TextColumn get examModule => text().withDefault(const Constant('academic'))();

  /// Active exam track (`ielts_academic`, `ielts_general`, `pte_academic`, etc.).
  TextColumn get examId =>
      text().withDefault(const Constant('ielts_academic'))();

  /// Target exam date represented as a UTC serial day.
  IntColumn get targetDateSerial => integer().nullable()();

  /// Whether the user has completed the onboarding flow.
  BoolColumn get onboardingCompleted =>
      boolean().withDefault(const Constant(false))();

  /// Whether the single free diagnostic trial has been consumed.
  BoolColumn get freeDiagnosticUsed =>
      boolean().withDefault(const Constant(false))();

  /// User theme preference (`system`, `dark`, `light`).
  TextColumn get themeMode => text().withDefault(const Constant('system'))();

  /// Optional email linked for account recovery and cross-device sync.
  TextColumn get linkedEmail => text().nullable()();

  /// Server-assigned pseudonymous user identifier.
  TextColumn get appUserId => text().nullable()();

  /// Cached entitlement status mirrored from billing verification.
  BoolColumn get isPro => boolean().withDefault(const Constant(false))();

  /// Learner study focus from onboarding screening (`exams`, `coach`, or `both`).
  TextColumn get studyFocus => text().withDefault(const Constant('both'))();

  @override
  Set<Column<Object>> get primaryKey => {deviceId};
}

/// Downloaded offline exam packs and integrity digests.
@DataClassName('ExamPackRow')
class ExamPacks extends Table with AuditColumns {
  /// Unique pack identifier (`ielts-acad-pack-001`, etc.).
  TextColumn get packId => text()();

  /// Exam track (`academic`, `general_training`).
  TextColumn get track => text().withDefault(const Constant('academic'))();

  /// Primary skill covered (`speaking`, `writing`, `reading`, `listening`, `fullMock`).
  TextColumn get skill => text()();

  /// Display title from backend catalog.
  TextColumn get title => text().withDefault(const Constant(''))();

  /// Concise subtitle/description from backend catalog.
  TextColumn get description => text().withDefault(const Constant(''))();

  /// Total allotted duration in seconds.
  IntColumn get durationSeconds => integer().withDefault(const Constant(0))();

  /// Total question or task count.
  IntColumn get questionCount => integer().withDefault(const Constant(0))();

  /// Speaker accent when applicable (`UK`, `AU`, `US`, `NZ`).
  TextColumn get accent => text().nullable()();

  /// Backend media proxy path or relative object key.
  TextColumn get mediaUrl => text().nullable()();

  /// Monotonic content version string.
  TextColumn get version => text()();

  /// SHA-256 hex digest verified after archive extraction.
  TextColumn get sha256 => text()();

  /// Local relative asset root or cache key.
  TextColumn get localPath => text()();

  @override
  Set<Column<Object>> get primaryKey => {packId};
}

/// Offline-first exam and practice attempts synced asynchronously for AI grading.
@DataClassName('ExamAttemptRow')
class ExamAttempts extends Table with AuditColumns {
  /// Client-generated UUIDv4 identifier used as backend idempotency key.
  TextColumn get attemptId => text()();

  /// Target exam track (`ielts_academic`, `ielts_general`, `pte_academic`, etc.).
  TextColumn get examId =>
      text().withDefault(const Constant('ielts_academic'))();

  /// Owning content pack identifier.
  TextColumn get packId => text()();

  /// Primary skill (`speaking`, `writing`, `reading`, `listening`).
  TextColumn get skill => text()();

  /// Lifecycle state matching `AttemptStatus.name`.
  TextColumn get status => text()();

  /// Server evaluation job ID once queued on the backend.
  TextColumn get remoteJobId => text().nullable()();

  /// JSON-serialized submission payload (answers map or essay text).
  TextColumn get submissionJson => text()();

  /// JSON-serialized local or AI rubric evaluation output.
  TextColumn get evaluationJson => text().nullable()();

  /// Final IELTS band if already scored (`0.0..9.0`).
  RealColumn get overallBand => real().nullable()();

  /// Non-secret user-visible retry reason when upload/evaluation fails.
  TextColumn get errorCode => text().nullable()();

  /// Session start timestamp in UTC milliseconds.
  IntColumn get startedAtUtcMs => integer().nullable()();

  /// Session completion timestamp in UTC milliseconds.
  IntColumn get completedAtUtcMs => integer().nullable()();

  /// Total duration spent active in seconds.
  IntColumn get durationSeconds => integer().withDefault(const Constant(0))();

  /// Whether the attempt was conducted in untimed study mode rather than exam mode.
  BoolColumn get usedStudyMode =>
      boolean().withDefault(const Constant(false))();

  /// Total scored items in this attempt (`0` for essay/speaking).
  IntColumn get questionCount => integer().withDefault(const Constant(0))();

  /// Whether this attempt satisfies official IELTS full-pack calibration (e.g. 40 items for Reading/Listening, exam mode).
  BoolColumn get isCalibratedFullPack =>
      boolean().withDefault(const Constant(true))();

  /// Content pack version captured when the attempt was submitted.
  TextColumn get contentVersion => text().nullable()();

  /// Optional Full Mock session identifier linking child skill attempts.
  TextColumn get mockSessionId => text().nullable()();

  /// Optional stage key within a Full Mock (`listening`, `reading`, `writing_task1`, `writing_task2`, `speaking`).
  TextColumn get mockStageKey => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {attemptId};
}

/// Captured local `.m4a` speaking turn metadata linked to an attempt.
@DataClassName('AudioRecordingRow')
class AudioRecordings extends Table with AuditColumns {
  /// Unique recording chunk identifier.
  TextColumn get recordingId => text()();

  /// Parent attempt identifier.
  TextColumn get attemptId => text().references(
    ExamAttempts,
    #attemptId,
    onDelete: KeyAction.cascade,
  )();

  /// IELTS Speaking part index (`1`, `2`, or `3`).
  IntColumn get partIndex => integer()();

  /// Local path inside app support audio directory.
  TextColumn get localFilePath => text()();

  /// Audio length in milliseconds for duration guard checks.
  IntColumn get durationMs => integer()();

  /// Object key returned after presigned S3 upload completes.
  TextColumn get remoteObjectKey => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {recordingId};
}

/// Real-time 500ms auto-saved writing drafts protecting student work against crash/quit.
@DataClassName('WritingDraftRow')
class WritingDrafts extends Table {
  /// Attempt foreign key and primary key (1:1 with ExamAttempts).
  TextColumn get attemptId => text().references(
    ExamAttempts,
    #attemptId,
    onDelete: KeyAction.cascade,
  )();

  /// Owning content pack identifier.
  TextColumn get packId => text()();

  /// Task category (`task1Academic`, `task1General`, `task2Essay`).
  TextColumn get taskType => text()();

  /// In-progress raw essay draft text.
  TextColumn get draftText => text()();

  /// Calculated word count.
  IntColumn get wordCount => integer().withDefault(const Constant(0))();

  /// Remaining exam timer seconds when draft was saved.
  IntColumn get timerRemainingSec => integer().withDefault(const Constant(0))();

  /// UTC millisecond timestamp when last updated.
  IntColumn get updatedAtUtcMs => integer()();

  @override
  Set<Column<Object>> get primaryKey => {attemptId};

  @override
  bool get isStrict => true;
}

/// Learner text highlights and margins notes preserved across reading passages.
@DataClassName('ReadingAnnotationRow')
class ReadingAnnotations extends Table with AuditColumns {
  /// Unique annotation identifier.
  TextColumn get annotationId => text()();

  /// Owning reading pack identifier.
  TextColumn get packId => text()();

  /// Passage index within pack (0, 1, or 2).
  IntColumn get passageIndex => integer().withDefault(const Constant(0))();

  /// Start UTF-16 character offset in passage text.
  IntColumn get startOffset => integer()();

  /// End UTF-16 character offset in passage text.
  IntColumn get endOffset => integer()();

  /// Highlight color category ('yellow', 'green', 'pink').
  TextColumn get colorCode => text().withDefault(const Constant('yellow'))();

  /// Optional attached student marginal note text.
  TextColumn get noteText => text().nullable()();

  /// Soft-deletion flag.
  BoolColumn get isDeleted => boolean().withDefault(const Constant(false))();

  @override
  Set<Column<Object>> get primaryKey => {annotationId};

  @override
  bool get isStrict => true;
}

/// Spaced-repetition vocabulary deck cards scheduled via pure SM-2 math.
@DataClassName('VocabCardRow')
class VocabCards extends Table with AuditColumns {
  /// Unique lexical card identifier.
  TextColumn get cardId => text()();

  /// Target headword or collocation.
  TextColumn get headword => text()();

  /// IPA pronunciation string when available.
  TextColumn get ipa => text().nullable()();

  /// Learner definition and band-8 context example.
  TextColumn get definition => text()();

  /// Optional concise Persian translation/gloss (`IRN` Sanjia edition).
  TextColumn get glossFa => text().nullable()();

  /// Topic tag (`environment`, `technology`, `education`, etc.).
  TextColumn get topicTag => text()();

  /// SM-2 consecutive repetition streak.
  IntColumn get repetitions => integer().withDefault(const Constant(0))();

  /// Scheduled review interval in days.
  IntColumn get intervalDays => integer().withDefault(const Constant(0))();

  /// Legacy ease multiplier (float).
  RealColumn get easeFactor => real().withDefault(const Constant(2.5))();

  /// Integer ease factor in thousandths (floor 1300, default 2500) per ADR-006 / ADR-013.
  IntColumn get easeFactorMilli =>
      integer().withDefault(const Constant(2500))();

  /// Integer UTC serial day when the card next becomes due.
  IntColumn get dueDay => integer()();

  /// Alias for integer UTC serial day due date.
  IntColumn get dueDaySerial => integer().withDefault(const Constant(0))();

  /// Example context sentence illustrating band 8+ usage.
  TextColumn get contextSentence => text().nullable()();

  /// JSON list of academic paraphrase hints.
  TextColumn get paraphraseHintsJson => text().nullable()();

  /// Register / collocation usage guidance.
  TextColumn get usageNote => text().nullable()();

  /// Source skill where mistake was captured (`writing`, `speaking`, `reading`).
  TextColumn get sourceSkill => text().nullable()();

  /// Attempt ID from which this card was captured.
  TextColumn get sourceAttemptId => text().nullable()();

  /// Reference label (e.g. "Task 2 Essay", "Part 2 Cue Card").
  TextColumn get sourceRefLabel => text().nullable()();

  @override
  Set<Column<Object>> get primaryKey => {cardId};
}

/// Immutable audit log for every SM-2 card review session.
@DataClassName('VocabReviewLogRow')
class VocabReviewLogs extends Table {
  /// Unique log entry identifier.
  TextColumn get logId => text()();

  /// Parent card foreign key.
  TextColumn get cardId => text().references(
    VocabCards,
    #cardId,
    onDelete: KeyAction.cascade,
  )();

  /// User rating (0=Again, 1=Hard, 2=Good, 3=Easy, or 0..5 SM-2 scale).
  IntColumn get rating => integer()();

  /// UTC serial day when reviewed.
  IntColumn get reviewedDaySerial => integer()();

  /// Timestamp in UTC milliseconds when reviewed.
  IntColumn get reviewedAtUtcMs => integer()();

  @override
  Set<Column<Object>> get primaryKey => {logId};

  @override
  bool get isStrict => true;
}

/// Daily study minutes ledger keyed by UTC [serialDay] for accurate streak tracking.
@DataClassName('DailyStudyLogRow')
class DailyStudyLogs extends Table with AuditColumns {
  /// UTC integer day number since Unix epoch.
  IntColumn get serialDay => integer()();

  /// Accumulated study seconds recorded on this day.
  IntColumn get studySeconds => integer().withDefault(const Constant(0))();

  /// Completed drill/review items count.
  IntColumn get completedItems => integer().withDefault(const Constant(0))();

  @override
  Set<Column<Object>> get primaryKey => {serialDay};
}

/// Durable offline retry queue for uploads, evaluations, and account actions.
@DataClassName('OutboxSyncItemRow')
class OutboxSyncQueue extends Table with AuditColumns {
  /// Auto-increment queue sequence key.
  IntColumn get id => integer().autoIncrement()();

  /// Operation type (`evaluate_speaking`, `evaluate_writing`, `sync_log`).
  TextColumn get actionType => text()();

  /// JSON payload required to replay the operation.
  TextColumn get payloadJson => text()();

  /// Attempt counter for exponential backoff.
  IntColumn get retryCount => integer().withDefault(const Constant(0))();

  /// Earliest UTC timestamp for the next scheduled retry.
  DateTimeColumn get nextAttemptAt => dateTime()();
}

/// Locally cached exam bundle JSON synced from PostgreSQL `/v1/exams/:packId`.
@DataClassName('ExamPayloadRow')
class ExamPayloads extends Table with AuditColumns {
  /// Pack primary key matching `ExamPacks.packId`.
  TextColumn get packId => text()();

  /// Serialized `ExamBundle` JSON payload (sections, prompts, questions).
  TextColumn get bundleJson => text()();

  /// Byte size of the cached payload for storage diagnostics.
  IntColumn get sizeBytes => integer().withDefault(const Constant(0))();

  @override
  Set<Column<Object>> get primaryKey => {packId};
}

/// Locally cached 3-minute micro-drills synced from PostgreSQL `/v1/drills`.
@DataClassName('CachedDrillRow')
class CachedDrills extends Table with AuditColumns {
  /// Unique drill identifier.
  TextColumn get drillId => text()();

  /// Drill display title.
  TextColumn get title => text()();

  /// Weakness/criterion category code (`CC`, `LR`, `GRA`, `FC`).
  TextColumn get drillType => text()();

  /// Associated IELTS skill (`speaking`, `writing`, `reading`, `listening`).
  TextColumn get skill => text().withDefault(const Constant('reading'))();

  /// Timer allowance in seconds.
  IntColumn get durationSeconds => integer().withDefault(const Constant(180))();

  /// JSON-serialized array of drill exercise items.
  TextColumn get itemsJson => text()();

  @override
  Set<Column<Object>> get primaryKey => {drillId};
}

/// Durable Full Mock session state replacing legacy synthetic WritingDrafts markers (`RR-11`).
@DataClassName('MockSessionRow')
class MockSessions extends Table with AuditColumns {
  /// Full Mock identifier (e.g. `mock-acad-01`, `mock-gt-01`).
  TextColumn get mockId => text()();

  /// IELTS module track (`academic` or `general`).
  TextColumn get track => text().withDefault(const Constant('academic'))();

  /// UTC millisecond timestamp when this mock session was started/reset.
  IntColumn get startedAtUtcMs => integer()();

  /// Whether sections launch in timed Exam Mode.
  BoolColumn get examMode => boolean().withDefault(const Constant(true))();

  /// JSON object mapping stage keys (`listening`, `reading`, `writing_task1`, `writing_task2`, `speaking`) to attempt IDs.
  TextColumn get stageAttemptIdsJson =>
      text().withDefault(const Constant('{}'))();

  @override
  Set<Column<Object>> get primaryKey => {mockId};
}

/// Durable rapid 4-skill adaptive starting-level session state (`RAPID_DIAGNOSTIC_PLAN.md`).
@DataClassName('DiagnosticSessionRow')
class DiagnosticSessions extends Table with AuditColumns {
  /// Client/server shared UUIDv4 diagnostic session identifier.
  TextColumn get diagId => text()();

  /// Active exam goal identifier at start of session (`ielts_academic`, `toefl_ibt`, etc.).
  TextColumn get examId => text()();

  /// Mode (`standard`, `extended`, `accessible`).
  TextColumn get mode => text().withDefault(const Constant('standard'))();

  /// Policy version frozen at session creation.
  TextColumn get policyVersion => text()();

  /// Content version frozen at session creation.
  TextColumn get contentVersion => text()();

  /// Deterministic tie-breaking seed.
  TextColumn get selectionSeed => text()();

  /// Persisted start timestamp (UTC ms).
  IntColumn get startedAtUtcMs => integer()();

  /// Persisted 540s collection deadline (UTC ms).
  IntColumn get collectionDeadlineUtcMs => integer()();

  /// Persisted 600s results/status window deadline (UTC ms).
  IntColumn get resultsDeadlineUtcMs => integer()();

  /// Active stage (`intro`, `reading`, `listening`, `writing`, `speaking`, `results`).
  TextColumn get currentStage => text().withDefault(const Constant('intro'))();

  /// Lifecycle status (`in_progress`, `submitted`, `completed`, `abandoned`).
  TextColumn get status => text().withDefault(const Constant('in_progress'))();

  /// Serialized adaptive history, stop reasons, writing/speaking refs, and cached snapshot JSON.
  TextColumn get stateJson => text().withDefault(const Constant('{}'))();

  @override
  Set<Column<Object>> get primaryKey => {diagId};
}

/// Persistent Linguistic Graph nodes tracking bottlenecks, target structures, and topic affinities.
@DataClassName('LinguisticNodeRow')
class LinguisticNodes extends Table {
  /// Node primary UUID.
  TextColumn get nodeId => text()();

  /// Edition isolation tag (`glb` or `irn`).
  TextColumn get edition => text().withDefault(const Constant('glb'))();

  /// Node kind (`bottleneck`, `target_structure`, or `interest_topic`).
  TextColumn get nodeKind => text()();

  /// Canonical classifier key.
  TextColumn get canonicalKey => text()();

  /// English label.
  TextColumn get displayLabelEn => text()();

  /// Optional Persian label (`irn`).
  TextColumn get displayLabelFa => text().nullable()();

  /// Mastery progress milliscore `[0..1000]`.
  IntColumn get masteryScoreMilli =>
      integer().withDefault(const Constant(400))();

  /// Decayed mission priority weight `[0..1000]`.
  IntColumn get signalWeightMilli =>
      integer().withDefault(const Constant(500))();

  /// Total recorded observation count.
  IntColumn get evidenceCount => integer().withDefault(const Constant(1))();

  /// UTC SerialDay of last signal.
  IntColumn get lastSeenDaySerial => integer()();

  /// Latest short learner excerpt.
  TextColumn get lastExampleEn => text().nullable()();

  /// English coaching guidance.
  TextColumn get coachNoteEn => text().nullable()();

  /// Persian coaching guidance (`irn`).
  TextColumn get coachNoteFa => text().nullable()();

  /// Whether topic interest node is pinned by user.
  BoolColumn get isPinned => boolean().withDefault(const Constant(false))();

  /// Whether topic interest node is muted/hidden by user.
  BoolColumn get isMuted => boolean().withDefault(const Constant(false))();

  /// Last UTC update epoch millis.
  IntColumn get updatedAtUtcMs => integer()();

  @override
  Set<Column<Object>> get primaryKey => {nodeId};
}

/// Cached Daily 10-Minute Mission synchronized per UTC serial day.
@DataClassName('DailyMissionRow')
class DailyMissions extends Table {
  /// Mission primary UUID.
  TextColumn get missionId => text()();

  /// UTC SerialDay index.
  IntColumn get missionDaySerial => integer()();

  /// Target exam track identifier.
  TextColumn get examTrack =>
      text().withDefault(const Constant('ielts_academic'))();

  /// Completion status (`ready`, `in_progress`, `completed`, `skipped`).
  TextColumn get status => text().withDefault(const Constant('ready'))();

  /// Topic theme for this mission.
  TextColumn get focusTopic => text()();

  /// Full mission payload JSON.
  TextColumn get missionPayloadJson => text()();

  /// Optional evaluation feedback JSON.
  TextColumn get resultJson => text().nullable()();

  /// Last UTC update epoch millis.
  IntColumn get updatedAtUtcMs => integer()();

  @override
  Set<Column<Object>> get primaryKey => {missionId};
}

/// Private user-dropped articles/images/bounded-audio micro-drills.
@DataClassName('DroppedContentRow')
class DroppedContents extends Table {
  /// Drop primary UUID.
  TextColumn get dropId => text()();

  /// Input kind (`text_url`, `text`, `image`, or `audio`).
  TextColumn get inputKind => text()();

  /// Extracted title.
  TextColumn get title => text()();

  /// Domain or custom source label.
  TextColumn get sourceLabel => text()();

  /// Estimated CEFR band.
  TextColumn get cefrEstimate => text().withDefault(const Constant('B2'))();

  /// Serialized JSON list of extracted idioms/phrases.
  TextColumn get extractedPhrasesJson => text()();

  /// Serialized JSON 2-minute micro-drill payload.
  TextColumn get drillPayloadJson => text()();

  /// Optional relative preview image path.
  TextColumn get localPreviewPath => text().nullable()();

  /// Completion timestamp UTC millis.
  IntColumn get completedAtUtcMs => integer().nullable()();

  /// Creation timestamp UTC millis.
  IntColumn get createdAtUtcMs => integer()();

  @override
  Set<Column<Object>> get primaryKey => {dropId};
}
