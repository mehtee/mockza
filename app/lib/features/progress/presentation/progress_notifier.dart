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
    this.track = ExamTrack.ieltsAcademic,
    this.speakingBand,
    this.writingBand,
    this.readingBand,
    this.listeningBand,
  });

  /// Active learner track.
  final ExamTrack track;

  /// Latest scored Speaking score, or null if none completed.
  final double? speakingBand;

  /// Latest scored Writing score, or null if none completed.
  final double? writingBand;

  /// Latest scored Reading score, or null if none completed.
  final double? readingBand;

  /// Latest scored Listening score, or null if none completed.
  final double? listeningBand;

  /// Computed overall mean rounded to active track increment, or null if unestimated.
  double? get overallBand {
    final values = <double>[
      ?speakingBand,
      ?writingBand,
      ?readingBand,
      ?listeningBand,
    ];
    if (values.isEmpty) return null;
    final mean = values.reduce((a, b) => a + b) / values.length;
    return track.isIelts
        ? ExamSpec.roundIeltsBand(mean)
        : track.quantizeScore(mean);
  }
}

/// Computes live skill summaries strictly from persisted Drift [AttemptSummary] rows.
class ProgressNotifier extends Notifier<ProgressState> {
  @override
  ProgressState build() {
    final profile = ref.watch(progressProfileProvider).asData?.value;
    final track = ExamTrack.fromId(profile?.examId ?? 'ielts_academic');
    final attempts =
        ref.watch(recentAttemptsProvider).asData?.value ??
        const <AttemptSummary>[];

    double? avgFor(SkillKind skill) {
      final scored = attempts
          .where((a) {
            if (a.skill != skill || a.overallBand == null) return false;
            final aTrack = ExamTrack.fromId(a.examId);
            return (track.isIelts && aTrack.isIelts) || aTrack == track;
          })
          .map((a) => a.overallBand!)
          .toList(growable: false);
      if (scored.isEmpty) return null;
      final sum = scored.reduce((a, b) => a + b);
      final mean = sum / scored.length;
      return track.isIelts
          ? ExamSpec.roundIeltsBand(mean)
          : track.quantizeScore(mean);
    }

    return ProgressState(
      track: track,
      speakingBand: avgFor(SkillKind.speaking),
      writingBand: avgFor(SkillKind.writing),
      readingBand: avgFor(SkillKind.reading),
      listeningBand: avgFor(SkillKind.listening),
    );
  }
}
