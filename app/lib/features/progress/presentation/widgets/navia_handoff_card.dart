import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mockza/core/config/brand_identity.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/core/localization/edition_copy.dart';
import 'package:mockza/services/external_link_platform.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Iran-only (`Sanjia`) cross-funnel card allowing learners who reached their target score
/// to carry readiness metrics directly into `Navia` (`https://navia.ir`) for university applications.
class NaviaHandoffCard extends StatelessWidget {
  /// Creates a [NaviaHandoffCard].
  const new({
    required this.track,
    required this.estimatedScore,
    required this.targetScore,
    super.key,
  });

  /// Active exam track.
  final ExamTrack track;

  /// Latest estimated overall score on [track] scale.
  final double? estimatedScore;

  /// User's target score on [track] scale.
  final double targetScore;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final reachedTarget =
        estimatedScore != null && estimatedScore! >= targetScore;

    return MzCard(
      variant: MzCardVariant.hero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              AppIcon(
                LucideGlyph.sparkles,
                size: 20,
                color: colors.primary,
              ),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: Text(
                  'انتقال نمره تاییدشده به ناویا (Navia)',
                  style: typography.cardTitle.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            reachedTarget
                ? 'به نمره هدف خود رسیده‌اید! می‌توانید خلاصه شبیه‌سازی داخلی سنجیا را با رضایت خود به ناویا ارسال کنید (جایگزین مدرک رسمی آزمون نیست).'
                : estimatedScore != null
                ? 'پس از رسیدن به نمره هدف، می‌توانید خلاصه شبیه‌سازی داخلی سنجیا را به ناویا ارسال کنید (ارزیابی تمرینی داخلی؛ جایگزین کارنامه رسمی نیست).'
                : 'برای فعال‌سازی ارسال خلاصه به ناویا، ابتدا یک آزمون شبیه‌سازی کامل کالیبره‌شده را تکمیل کنید. این گزارش تمرینی داخلی است و جایگزین کارنامه رسمی نیست.',
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: SpacingTokens.sm),
          Text(
            estimatedScore != null
                ? '${track.shortName} · ${EditionCopy.formatScoreFor(track, estimatedScore!, isIran: true)} / هدف ${EditionCopy.formatScoreFor(track, targetScore, isIran: true)}'
                : '${track.shortName} · هدف ${EditionCopy.formatScoreFor(track, targetScore, isIran: true)}',
            style: typography.caption.copyWith(
              color: colors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: SpacingTokens.md),
          SecondaryButton(
            label: estimatedScore != null
                ? 'ارسال خلاصه شبیه‌سازی به ناویا (navia.ir)'
                : 'نیازمند تکمیل آزمون شبیه‌سازی کامل',
            glyph: LucideGlyph.globe,
            onPressed: estimatedScore == null
                ? null
                : () {
                    final scoreParam = track.formatScore(estimatedScore!);
                    final handoffUrl = Uri.parse(BrandIdentity.iran.naviaUrl)
                        .replace(
                          path: '/import-score',
                          queryParameters: <String, String>{
                            'edition': 'irn',
                            'track': track.id,
                            'score': scoreParam,
                            'target': track.formatScore(targetScore),
                          },
                        )
                        .toString();
                    unawaited(openExternalUrlImpl(handoffUrl));
                  },
          ),
        ],
      ),
    );
  }
}
