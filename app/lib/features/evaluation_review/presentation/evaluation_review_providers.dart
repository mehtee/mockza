import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_notifier.dart';

/// Provides [EvaluationReviewState] via [EvaluationReviewNotifier].
final NotifierProvider<EvaluationReviewNotifier, EvaluationReviewState>
evaluationReviewNotifierProvider =
    NotifierProvider<EvaluationReviewNotifier, EvaluationReviewState>(
      EvaluationReviewNotifier.new,
    );
