import 'package:flutter/material.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/primitives.dart';

/// Interactive spaced repetition flashcard with tap-to-flip (design.md Sec. 5, Screenshot 17).
class VocabFlipCard extends StatelessWidget {
  /// Creates a [VocabFlipCard].
  const new({
    required this.headword,
    required this.definition,
    required this.isRevealed,
    required this.onTapFlip,
    required this.onSelectRating,
    this.ipa,
    this.contextSentence,
    this.synonyms = const <String>[],
    this.sourceLabel,
    this.onTapSpeaker,
    this.previewIntervals,
    super.key,
  });

  /// Target headword or collocation term.
  final String headword;

  /// Learner definition and usage guidance.
  final String definition;

  /// Whether card back has been revealed.
  final bool isRevealed;

  /// Tap callback to flip/reveal the card.
  final VoidCallback onTapFlip;

  /// Rating selection callback (Again, Hard, Good, Easy).
  final ValueChanged<ReviewQuality> onSelectRating;

  /// Optional IPA pronunciation string.
  final String? ipa;

  /// Example or cloze sentence from learner's own attempt.
  final String? contextSentence;

  /// Academic synonyms list.
  final List<String> synonyms;

  /// Provenance tag (e.g. "From Writing Task 2").
  final String? sourceLabel;

  /// Optional speaker audio pronunciation callback.
  final VoidCallback? onTapSpeaker;

  /// Dynamic intervals preview map (Again -> "1m", Hard -> "1d", etc.).
  final Map<ReviewQuality, String>? previewIntervals;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      onTap: isRevealed ? null : onTapFlip,
      padding: const EdgeInsets.all(SpacingTokens.pageInset),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // Top row: Source tag + Audio button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              if (sourceLabel != null)
                MzChip(
                  label: sourceLabel!,
                )
              else
                const SizedBox.shrink(),
              if (onTapSpeaker != null)
                IconButton(
                  tooltip: 'Pronunciation',
                  onPressed: onTapSpeaker,
                  icon: AppIcon(
                    LucideGlyph.volume2,
                    size: 20,
                    color: colors.vocabAccent,
                  ),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.lg),
          // Headword
          Text(
            headword,
            style: typography.headline.copyWith(
              color: colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
            textAlign: TextAlign.center,
          ),
          if (ipa != null && ipa!.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              ipa!,
              style: typography.body.copyWith(
                color: colors.textSecondary,
                fontStyle: FontStyle.italic,
              ),
              textAlign: TextAlign.center,
            ),
          ],
          const SizedBox(height: SpacingTokens.xl),
          // Context sentence
          if (contextSentence != null &&
              contextSentence!.isNotEmpty) ...<Widget>[
            Container(
              padding: const EdgeInsets.all(SpacingTokens.md),
              decoration: BoxDecoration(
                color: colors.surfaceAlt,
                borderRadius: shapes.controlRadius,
              ),
              child: Text(
                '“$contextSentence”',
                style: typography.body.copyWith(
                  height: 1.5,
                  color: colors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            const SizedBox(height: SpacingTokens.lg),
          ],
          if (!isRevealed) ...<Widget>[
            // Tap hint
            Padding(
              padding: const EdgeInsets.symmetric(vertical: SpacingTokens.xl),
              child: Text(
                'Tap card to reveal definition',
                style: typography.secondary.copyWith(
                  color: colors.textTertiary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ] else ...<Widget>[
            // Revealed content: Definition
            Text(
              definition,
              style: typography.body.copyWith(
                color: colors.textPrimary,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            if (synonyms.isNotEmpty) ...<Widget>[
              const SizedBox(height: SpacingTokens.lg),
              Text(
                'Academic Synonyms',
                style: typography.caption.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SpacingTokens.sm),
              Wrap(
                alignment: WrapAlignment.center,
                spacing: SpacingTokens.sm,
                runSpacing: SpacingTokens.xs,
                children: synonyms.map((syn) {
                  return MzChip(
                    label: syn,
                  );
                }).toList(),
              ),
            ],
            const SizedBox(height: SpacingTokens.xl),
            // Bottom 4 SM-2 buttons with dynamic calculated intervals
            Row(
              children: <Widget>[
                _Sm2Button(
                  label: 'Again',
                  intervalText: previewIntervals?[ReviewQuality.again] ?? '1m',
                  quality: ReviewQuality.again,
                  color: colors.error,
                  onPressed: () => onSelectRating(ReviewQuality.again),
                ),
                const SizedBox(width: SpacingTokens.xs + 2),
                _Sm2Button(
                  label: 'Hard',
                  intervalText: previewIntervals?[ReviewQuality.hard] ?? '1d',
                  quality: ReviewQuality.hard,
                  color: colors.warning,
                  onPressed: () => onSelectRating(ReviewQuality.hard),
                ),
                const SizedBox(width: SpacingTokens.xs + 2),
                _Sm2Button(
                  label: 'Good',
                  intervalText: previewIntervals?[ReviewQuality.good] ?? '4d',
                  quality: ReviewQuality.good,
                  color: colors.success,
                  onPressed: () => onSelectRating(ReviewQuality.good),
                ),
                const SizedBox(width: SpacingTokens.xs + 2),
                _Sm2Button(
                  label: 'Easy',
                  intervalText: previewIntervals?[ReviewQuality.easy] ?? '7d',
                  quality: ReviewQuality.easy,
                  color: colors.speakingAccent,
                  onPressed: () => onSelectRating(ReviewQuality.easy),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Sm2Button extends StatelessWidget {
  const new({
    required this.label,
    required this.intervalText,
    required this.quality,
    required this.color,
    required this.onPressed,
  });

  final String label;
  final String intervalText;
  final ReviewQuality quality;
  final Color color;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Expanded(
      child: InkWell(
        onTap: onPressed,
        borderRadius: shapes.controlRadius,
        child: Container(
          padding: const EdgeInsets.symmetric(
            vertical: SpacingTokens.sm,
            horizontal: 2,
          ),
          decoration: BoxDecoration(
            color: colors.surfaceAlt,
            borderRadius: shapes.controlRadius,
            border: Border.all(
              color: color.withValues(alpha: 0.4),
              width: shapes.strokeWidth,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                intervalText,
                style: typography.caption.copyWith(
                  color: color,
                  fontWeight: FontWeight.w700,
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                label,
                style: typography.caption.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
