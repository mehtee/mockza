import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockza/features/evaluation_review/presentation/evaluation_review_notifier.dart';

/// Route-scoped [EvaluationReviewState] preventing stale polls from outliving screen exit.
final NotifierProvider<EvaluationReviewNotifier, EvaluationReviewState>
evaluationReviewNotifierProvider =
    NotifierProvider.autoDispose<EvaluationReviewNotifier, EvaluationReviewState>(
      EvaluationReviewNotifier.new,
    );
