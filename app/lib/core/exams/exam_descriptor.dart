import 'package:meta/meta.dart';
import 'package:mockza/core/exams/band_conversion_table.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/core/models/writing_evaluation.dart';

/// Four integrated Duolingo English Test subscores (`Literacy`, `Comprehension`,
/// `Conversation`, `Production`) quantized in official 5-point increments.
@immutable
class DetSubscores {
  /// Creates a [DetSubscores] snapshot.
  const new({
    this.literacy,
    this.comprehension,
    this.conversation,
    this.production,
  });

  /// Integrated Reading + Writing score (`10..160`, step `5`).
  final double? literacy;

  /// Integrated Reading + Listening score (`10..160`, step `5`).
  final double? comprehension;

  /// Integrated Listening + Speaking score (`10..160`, step `5`).
  final double? conversation;

  /// Integrated Writing + Speaking score (`10..160`, step `5`).
  final double? production;

  /// Non-null labeled entries ready for UI badge display.
  List<({String label, double score})> get populatedEntries =>
      <({String label, double score})>[
        if (literacy != null) (label: 'Literacy', score: literacy!),
        if (comprehension != null)
          (label: 'Comprehension', score: comprehension!),
        if (conversation != null) (label: 'Conversation', score: conversation!),
        if (production != null) (label: 'Production', score: production!),
      ];
}

/// Strategy & metadata descriptor binding each [ExamTrack] to its scale,
/// starter packs, writing task sequence, timing profile, and scoring rules.
///
/// Serves as the single Open/Closed source of truth across pure-Dart domain
/// calculators and Flutter simulators.
@immutable
class ExamDescriptor {
  const new _({
    required this.track,
    required this.subtitle,
    required this.formatHint,
    required this.readingPackId,
    required this.listeningPackId,
    required this.writingPackId,
    required this.speakingPackId,
    required this.drillPackId,
    required this.writingTasks,
    required this.fullMockTotalSeconds,
    this.speakingDefaultPrepSeconds = 0,
    this.speakingDefaultSpeakSeconds = 60,
  });

  /// Target exam track.
  final ExamTrack track;

  /// Concise learner-facing subtitle in track pickers.
  final String subtitle;

  /// Scale and structure hint shown in setup & settings cards.
  final String formatHint;

  /// Default curated starter Reading pack ID for this track.
  final String readingPackId;

  /// Default curated starter Listening pack ID for this track.
  final String listeningPackId;

  /// Default curated starter Writing pack ID for this track.
  final String writingPackId;

  /// Default curated starter Speaking pack ID for this track.
  final String speakingPackId;

  /// Default micro-drill pack ID tailored to this track.
  final String drillPackId;

  /// Ordered Writing task sequence for the Writing Simulator tabs.
  final List<WritingTaskType> writingTasks;

  /// Approximate full-exam duration across the 4 sections in seconds.
  final int fullMockTotalSeconds;

  /// Default preparation seconds per speaking turn when section metadata omits it.
  final int speakingDefaultPrepSeconds;

  /// Default response seconds per speaking turn when section metadata omits it.
  final int speakingDefaultSpeakSeconds;

  /// Minimum objective items required for calibrated full-pack metrics (`TD-33`).
  int get minCalibratedObjectiveCount => track.isIelts ? 40 : 4;

  /// Resolves the curated starter pack ID for [skill].
  String defaultPackIdForSkill(SkillKind skill) => switch (skill) {
    SkillKind.reading => readingPackId,
    SkillKind.listening => listeningPackId,
    SkillKind.writing => writingPackId,
    SkillKind.speaking => speakingPackId,
    SkillKind.vocabulary => drillPackId,
  };

  /// Computes a track-accurate objective score for Reading or Listening.
  double scoreObjective({
    required SkillKind skill,
    required int correctCount,
    required int totalCount,
    required bool isFullLength,
  }) {
    if (skill != SkillKind.reading && skill != SkillKind.listening) {
      return track.minScore;
    }
    if (track.isIelts) {
      final scaledCorrect = (totalCount > 0 && totalCount != 40)
          ? ((correctCount / totalCount) * 40).round().clamp(0, 40)
          : correctCount;
      if (skill == SkillKind.listening) {
        return BandConversionTable.listeningBandFor(scaledCorrect);
      }
      return BandConversionTable.readingBandFor(
        scaledCorrect,
        moduleType: track == ExamTrack.ieltsGeneral
            ? ExamModuleType.generalTraining
            : ExamModuleType.academic,
      );
    }

    if (totalCount <= 0) return track.minScore;
    final ratio = (correctCount / totalCount).clamp(0.0, 1.0);
    return track.scoreFromRatio(ratio);
  }

  /// Maps an objective or drill accuracy ratio `[0.0..1.0]` onto this track's scale.
  double scaleCorrectRatio(double accuracyRatio) =>
      track.scoreFromRatio(accuracyRatio);

  /// Computes supplementary score context badges (TOEFL legacy `/120`, DET 4 subscores).
  List<({String label, String detail})> buildScoreInsights({
    required double overallScore,
    double? reading,
    double? listening,
    double? writing,
    double? speaking,
  }) {
    if (track == ExamTrack.toeflIbt) {
      final legacy = ExamSpec.estimateToeflLegacy120(overallScore);
      return <({String label, String detail})>[
        (label: 'Comparable 0–120', detail: '$legacy / 120'),
      ];
    }
    if (track == ExamTrack.det) {
      final subs = computeDetSubscores(
        reading: reading,
        listening: listening,
        writing: writing,
        speaking: speaking,
      );
      return subs.populatedEntries
          .map((e) => (label: e.label, detail: track.formatScore(e.score)))
          .toList(growable: false);
    }
    return const <({String label, String detail})>[];
  }

  /// Computes DET's 4 integrated subscores (`Literacy`, `Comprehension`,
  /// `Conversation`, `Production`) from whichever skill scores exist.
  static DetSubscores computeDetSubscores({
    double? reading,
    double? listening,
    double? writing,
    double? speaking,
  }) {
    double? pairAvg(double? a, double? b) {
      if (a == null && b == null) return null;
      if (a != null && b != null) {
        return ExamTrack.det.quantizeScore((a + b) / 2.0);
      }
      return ExamTrack.det.quantizeScore(a ?? b!);
    }

    return DetSubscores(
      literacy: pairAvg(reading, writing),
      comprehension: pairAvg(reading, listening),
      conversation: pairAvg(listening, speaking),
      production: pairAvg(writing, speaking),
    );
  }

  static const Map<ExamTrack, ExamDescriptor>
  _registry = <ExamTrack, ExamDescriptor>{
    ExamTrack.ieltsAcademic: ExamDescriptor._(
      track: ExamTrack.ieltsAcademic,
      subtitle: 'University & Professional · Bands 0–9 (0.5 steps)',
      formatHint: 'Reading 60m · Listening 30m · Writing 60m · Speaking ~14m',
      readingPackId: 'ielts-acad-reading-seed-01',
      listeningPackId: 'ielts-listening-seed-01',
      writingPackId: 'ielts-writing-seed-01',
      speakingPackId: 'ielts-speaking-seed-01',
      drillPackId: 'ielts-micro-drill-01',
      writingTasks: <WritingTaskType>[
        WritingTaskType.task1Academic,
        WritingTaskType.task2Essay,
      ],
      fullMockTotalSeconds: 164 * 60,
      speakingDefaultPrepSeconds: 60,
      speakingDefaultSpeakSeconds: 120,
    ),
    ExamTrack.ieltsGeneral: ExamDescriptor._(
      track: ExamTrack.ieltsGeneral,
      subtitle: 'Migration & Career · Bands 0–9 (0.5 steps)',
      formatHint: 'Everyday & Workplace texts · Letter + Essay · Speaking ~14m',
      readingPackId: 'ielts-gt-reading-seed-01',
      listeningPackId: 'ielts-listening-seed-01',
      writingPackId: 'ielts-gt-writing-pack-01',
      speakingPackId: 'ielts-speaking-seed-01',
      drillPackId: 'ielts-micro-drill-01',
      writingTasks: <WritingTaskType>[
        WritingTaskType.task1General,
        WritingTaskType.task2Essay,
      ],
      fullMockTotalSeconds: 164 * 60,
      speakingDefaultPrepSeconds: 60,
      speakingDefaultSpeakSeconds: 120,
    ),
    ExamTrack.toeflIbt: ExamDescriptor._(
      track: ExamTrack.toeflIbt,
      subtitle: '2026 Format · 1.0–6.0 Scale (+ 0–120 bridge)',
      formatHint: 'Adaptive R & L · Build Sentence/Email/Discussion · Repeat & Interview',
      readingPackId: 'toefl-reading-pack-01',
      listeningPackId: 'toefl-listening-pack-01',
      writingPackId: 'toefl-writing-pack-01',
      speakingPackId: 'toefl-speaking-pack-01',
      drillPackId: 'toefl-micro-drill-01',
      writingTasks: <WritingTaskType>[
        WritingTaskType.toeflSentenceBuild,
        WritingTaskType.toeflEmail,
        WritingTaskType.toeflAcademicDiscussion,
      ],
      fullMockTotalSeconds: 90 * 60,
      speakingDefaultSpeakSeconds: 45,
    ),
    ExamTrack.pteAcademic: ExamDescriptor._(
      track: ExamTrack.pteAcademic,
      subtitle: 'Latest GSE Format · Score 10–90 (1-pt steps)',
      formatHint:
          'Integrated S&W · Re-order Paragraphs · Situation & Discussion',
      readingPackId: 'pte-reading-pack-01',
      listeningPackId: 'pte-listening-pack-01',
      writingPackId: 'pte-writing-pack-01',
      speakingPackId: 'pte-speaking-pack-01',
      drillPackId: 'pte-micro-drill-01',
      writingTasks: <WritingTaskType>[
        WritingTaskType.pteSummarizeWrittenText,
        WritingTaskType.pteEssay,
      ],
      fullMockTotalSeconds: 120 * 60,
      speakingDefaultPrepSeconds: 25,
      speakingDefaultSpeakSeconds: 40,
    ),
    ExamTrack.det: ExamDescriptor._(
      track: ExamTrack.det,
      subtitle: 'Latest Adaptive Format · Score 10–160 (5-pt steps)',
      formatHint:
          'Literacy, Comprehension, Conversation & Production subscores',
      readingPackId: 'det-reading-pack-01',
      listeningPackId: 'det-listening-pack-01',
      writingPackId: 'det-writing-pack-01',
      speakingPackId: 'det-speaking-pack-01',
      drillPackId: 'det-micro-drill-01',
      writingTasks: <WritingTaskType>[
        WritingTaskType.detWriteAboutPhoto,
        WritingTaskType.detInteractiveWriting,
        WritingTaskType.detWritingSample,
      ],
      fullMockTotalSeconds: 60 * 60,
      speakingDefaultPrepSeconds: 20,
      speakingDefaultSpeakSeconds: 90,
    ),
  };

  /// Returns the descriptor registered for [track].
  static ExamDescriptor forTrack(ExamTrack track) =>
      _registry[track] ?? _registry[ExamTrack.ieltsAcademic]!;

  /// Resolves an [ExamTrack] from [examId] and returns its descriptor.
  static ExamDescriptor forExamId(String examId) =>
      forTrack(ExamTrack.fromId(examId));
}
