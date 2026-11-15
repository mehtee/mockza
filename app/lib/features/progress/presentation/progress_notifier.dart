import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/models/attempt_status.dart';
import 'package:mockza/data/repositories/attempt_repository.dart';
import 'package:mockza/features/progress/presentation/progress_providers.dart';

/// Immutable UI state summarizing four-skill progress toward the learner's target band.
@immutable
class ProgressState {
  /// Creates a [ProgressState].
  const new({
    this.speakingBand,
    this.writingBand,
    this.readingBand,
    this.listeningBand,
  });

  /// Latest scored Speaking band, or null if none completed.
  final double? speakingBand;

  /// Latest scored Writing band, or null if none completed.
  final double? writingBand;

  /// Latest scored Reading band, or null if none completed.
  final double? readingBand;

  /// Latest scored Listening band, or null if none completed.
  final double? listeningBand;

  /// Computed IELTS overall mean rounded to nearest `0.5` across scored skills, or null if unestimated.
  double? get overallBand {
    final values = <double>[
      ?speakingBand,
      ?writingBand,
      ?readingBand,
      ?listeningBand,
    ];
    if (values.isEmpty) return null;
    final mean = values.reduce((a, b) => a + b) / values.length;
    return ExamSpec.roundIeltsBand(mean);
  }
}

/// Computes live skill summaries strictly from persisted Drift [AttemptSummary] rows.
class ProgressNotifier extends Notifier<ProgressState> {
  @override
  ProgressState build() {
    final attempts =
        ref.watch(recentAttemptsProvider).asData?.value ??
        const <AttemptSummary>[];

    double? avgFor(SkillKind skill) {
      final scored = attempts
          .where((a) => a.skill == skill && a.overallBand != null)
          .map((a) => a.overallBand!)
          .toList(growable: false);
      if (scored.isEmpty) return null;
      final sum = scored.reduce((a, b) => a + b);
      return ExamSpec.roundIeltsBand(sum / scored.length);
    }

    return ProgressState(
      speakingBand: avgFor(SkillKind.speaking),
      writingBand: avgFor(SkillKind.writing),
      readingBand: avgFor(SkillKind.reading),
      listeningBand: avgFor(SkillKind.listening),
    );
  }
}
