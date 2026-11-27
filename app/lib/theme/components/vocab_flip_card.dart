import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mockza/core/formatting/edge_numerals.dart';
import 'package:mockza/core/vocab/sm2_scheduler.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/inline_listen_button.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/speech_practice_sheet.dart';
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
    this.cardId,
    this.ipa,
    this.glossFa,
    this.contextSentence,
    this.synonyms = const <String>[],
    this.sourceLabel,
    this.onTapSpeaker,
    this.previewIntervals,
    this.enableSpeechPractice = true,
    super.key,
  });

  /// Optional card identifier linked to server-side pronunciation history.
  final String? cardId;

  /// Target headword or collocation term.
  final String headword;

  /// Learner definition and usage guidance.
  final String definition;

  /// Optional concise Persian meaning/gloss (`IRN` Sanjia edition).
  final String? glossFa;

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

  /// Whether to render the Kokoro Listen + Shadow Pronunciation studio buttons.
  final bool enableSpeechPractice;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isFa = Localizations.localeOf(context).languageCode == 'fa';

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
                Flexible(
                  child: MzChip(
                    label: sourceLabel!,
                  ),
                )
              else
                const SizedBox.shrink(),
              if (onTapSpeaker != null)
                IconButton(
                  tooltip: isFa ? 'تلفظ' : 'Pronunciation',
                  onPressed: onTapSpeaker,
                  icon: AppIcon(
                    LucideGlyph.volume2,
                    size: 20,
                    color: colors.vocabAccent,
                  ),
                )
              else if (enableSpeechPractice)
                InlineListenButton(
                  text: headword,
                  sourceContext: 'vocab_card',
                  compact: true,
                ),
            ],
          ),
          if (enableSpeechPractice) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Align(
              alignment: AlignmentDirectional.centerEnd,
              child: InkWell(
                onTap: () => unawaited(
                  SpeechPracticeSheet.show(
                    context,
                    targetText: headword,
                    practiceKind: headword.contains(' ')
                        ? 'collocation'
                        : 'word',
                    sourceRefType: 'vocab_card',
                    sourceRefId: cardId ?? headword,
                    sourceContext: 'vocab_card',
                  ),
                ),
                borderRadius: shapes.pillRadius,
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    horizontal: SpacingTokens.sm,
                    vertical: SpacingTokens.xs,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: <Widget>[
                      AppIcon(
                        LucideGlyph.mic,
                        size: 14,
                        color: colors.primary,
                      ),
                      const SizedBox(width: SpacingTokens.xs),
                      Text(
                        AppLocalizations.of(context).practiceSpeechCta,
                        style: typography.caption.copyWith(
                          color: colors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
          const SizedBox(height: SpacingTokens.lg),
          // Headword & IPA inside strict LTR boundary
          LtrExamBoundary(
            child: Column(
              children: <Widget>[
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
              ],
            ),
          ),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  LtrExamBoundary(
                    child: Text(
                      '“$contextSentence”',
                      style: typography.body.copyWith(
                        height: 1.5,
                        color: colors.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  if (enableSpeechPractice) ...<Widget>[
                    const SizedBox(height: SpacingTokens.sm),
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: SpacingTokens.sm,
                      runSpacing: SpacingTokens.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: <Widget>[
                        InlineListenButton(
                          text: contextSentence!,
                          sourceContext: 'vocab_example',
                        ),
                        ActionChip(
                          avatar: AppIcon(
                            LucideGlyph.mic,
                            size: 14,
                            color: colors.primary,
                          ),
                          label: Text(
                            AppLocalizations.of(context).practiceSpeechCta,
                            style: typography.caption,
                          ),
                          onPressed: () => unawaited(
                            SpeechPracticeSheet.show(
                              context,
                              targetText: contextSentence!,
                              sourceRefType: 'vocab_example',
                              sourceRefId: cardId ?? headword,
                              sourceContext: 'vocab_example',
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.lg),
          ],
          if (!isRevealed) ...<Widget>[
            // Tap hint
            Padding(
              padding: const EdgeInsets.symmetric(vertical: SpacingTokens.xl),
              child: Text(
                isFa
                    ? 'برای مشاهده معنی روی کارت بزنید'
                    : 'Tap card to reveal definition',
                style: typography.secondary.copyWith(
                  color: colors.textTertiary,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ] else ...<Widget>[
            // Optional Persian gloss for Sanjia IRN
            if (glossFa != null && glossFa!.trim().isNotEmpty) ...<Widget>[
              Text(
                glossFa!.trim(),
                style: typography.cardTitle.copyWith(
                  color: colors.primary,
                  fontWeight: FontWeight.w700,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: SpacingTokens.sm),
            ],
            // Revealed content: Definition
            LtrExamBoundary(
              child: Text(
                definition,
                style: typography.body.copyWith(
                  color: colors.textPrimary,
                  height: 1.5,
                ),
                textAlign: TextAlign.center,
              ),
            ),
            if (synonyms.isNotEmpty) ...<Widget>[
              const SizedBox(height: SpacingTokens.lg),
              Text(
                isFa ? 'مترادف‌های آکادمیک' : 'Academic Synonyms',
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
                  label: isFa ? 'دوباره' : 'Again',
                  intervalText: _formatInterval(
                    previewIntervals?[ReviewQuality.again] ?? '1m',
                    isFa: isFa,
                  ),
                  quality: ReviewQuality.again,
                  color: colors.error,
                  onPressed: () => onSelectRating(ReviewQuality.again),
                ),
                const SizedBox(width: SpacingTokens.xs + 2),
                _Sm2Button(
                  label: isFa ? 'سخت' : 'Hard',
                  intervalText: _formatInterval(
                    previewIntervals?[ReviewQuality.hard] ?? '1d',
                    isFa: isFa,
                  ),
                  quality: ReviewQuality.hard,
                  color: colors.warning,
                  onPressed: () => onSelectRating(ReviewQuality.hard),
                ),
                const SizedBox(width: SpacingTokens.xs + 2),
                _Sm2Button(
                  label: isFa ? 'خوب' : 'Good',
                  intervalText: _formatInterval(
                    previewIntervals?[ReviewQuality.good] ?? '4d',
                    isFa: isFa,
                  ),
                  quality: ReviewQuality.good,
                  color: colors.success,
                  onPressed: () => onSelectRating(ReviewQuality.good),
                ),
                const SizedBox(width: SpacingTokens.xs + 2),
                _Sm2Button(
                  label: isFa ? 'آسان' : 'Easy',
                  intervalText: _formatInterval(
                    previewIntervals?[ReviewQuality.easy] ?? '7d',
                    isFa: isFa,
                  ),
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

  String _formatInterval(String raw, {required bool isFa}) {
    if (!isFa) return raw;
    var text = raw;
    if (text.endsWith('mo')) {
      text = '${text.substring(0, text.length - 2)} ماه';
    } else if (text.endsWith('m')) {
      text = '${text.substring(0, text.length - 1)} دقیقه';
    } else if (text.endsWith('d')) {
      text = '${text.substring(0, text.length - 1)} روز';
    } else if (text.endsWith('y')) {
      text = '${text.substring(0, text.length - 1)} سال';
    }
    return EdgeNumerals.toPersianDigits(text);
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
