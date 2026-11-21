import 'package:flutter/material.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared 3-Gear Register Ladder card (`Casual` -> `Workplace` -> `Academic Band 8.5`)
/// styled exclusively with generated semantic tokens and [LtrExamBoundary].
class RegisterGearLadderCard extends StatelessWidget {
  /// Creates a [RegisterGearLadderCard].
  const new({
    required this.result,
    required this.selectedGear,
    required this.isRtl,
    required this.onSelectGear,
    this.savedPhrases = const <String>{},
    this.onSavePhrase,
    super.key,
  });

  /// Register shifter evaluation result.
  final RegisterShifterResultDto result;

  /// Selected register gear (`0`, `1`, or `2`).
  final int selectedGear;

  /// Whether Persian RTL coaching chrome is active (`irn`).
  final bool isRtl;

  /// Callback when learner taps a gear tab.
  final ValueChanged<int> onSelectGear;

  /// Set of phrases already saved to the SM-2 deck.
  final Set<String> savedPhrases;

  /// Optional 1-tap callback to save an upgraded phrase into SM-2.
  final void Function(String phrase, String rationale)? onSavePhrase;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final shapes = AppShapes.of(context);

    final labels = isRtl
        ? const <String>[
            'دنده ۰ · دوستانه',
            'دنده ۱ · محیط کار',
            'دنده ۲ · آکادمیک ۸.۵',
          ]
        : const <String>[
            'Gear 0 · Casual',
            'Gear 1 · Workplace',
            'Gear 2 · Academic 8.5',
          ];

    final gearColors = <Color>[
      colors.gearCasual,
      colors.gearWork,
      colors.gearAcademic,
    ];

    final activeSentence = selectedGear == 0
        ? result.casual
        : selectedGear == 1
        ? result.workplace
        : result.academic;

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Wrap(
            spacing: SpacingTokens.xs,
            runSpacing: SpacingTokens.xs,
            children: List<Widget>.generate(3, (gear) {
              final active = selectedGear == gear;
              return ChoiceChip(
                label: Text(
                  labels[gear],
                  style: typography.caption.copyWith(
                    color: active ? colors.onPrimary : colors.textSecondary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                selected: active,
                selectedColor: gearColors[gear],
                backgroundColor: colors.bgRaised,
                onSelected: (_) => onSelectGear(gear),
              );
            }),
          ),
          const SizedBox(height: SpacingTokens.md),
          Container(
            padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
            decoration: BoxDecoration(
              color: colors.bgRaised,
              borderRadius: shapes.compactRadius,
              border: Border.all(color: colors.borderSubtle),
            ),
            child: LtrExamBoundary(
              child: Text(
                activeSentence,
                style: typography.cardTitle.copyWith(color: colors.textPrimary),
              ),
            ),
          ),
          if (result.highlights.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.md),
            Text(
              isRtl
                  ? 'چرا این تغییر لحن نمره شما را ارتقا می‌دهد؟'
                  : 'Why This Register Upgrade Raises Your Score',
              style: typography.caption.copyWith(
                color: colors.textSecondary,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: SpacingTokens.sm),
            ...result.highlights.map((h) {
              final isSaved = savedPhrases.contains(h.upgradedPhrase);
              final rationale = isRtl && h.whyFa != null ? h.whyFa! : h.whyEn;
              return Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.sm,
                ),
                child: Container(
                  padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
                  decoration: BoxDecoration(
                    color: colors.bgRaised,
                    borderRadius: shapes.compactRadius,
                    border: Border.all(color: colors.borderSubtle),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: <Widget>[
                      LtrExamBoundary(
                        child: Wrap(
                          spacing: SpacingTokens.xs,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: <Widget>[
                            Text(
                              h.casualPhrase,
                              style: typography.caption.copyWith(
                                color: colors.textSecondary,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                            const AppIcon(LucideGlyph.arrowRight, size: 14),
                            Text(
                              h.upgradedPhrase,
                              style: typography.caption.copyWith(
                                color: colors.primary,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: SpacingTokens.xs),
                      Text(
                        rationale,
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                        ),
                      ),
                      if (onSavePhrase != null) ...<Widget>[
                        const SizedBox(height: SpacingTokens.xs),
                        Align(
                          alignment: AlignmentDirectional.centerStart,
                          child: SecondaryButton(
                            label: isSaved
                                ? (isRtl ? 'ذخیره شد' : 'Saved to SM-2')
                                : (isRtl ? 'ذخیره در دِک' : 'Save to SM-2'),
                            glyph: isSaved
                                ? LucideGlyph.checkCircle2
                                : LucideGlyph.bookmarkPlus,
                            isFullWidth: false,
                            onPressed: isSaved
                                ? null
                                : () => onSavePhrase!(
                                    h.upgradedPhrase,
                                    rationale,
                                  ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              );
            }),
          ],
        ],
      ),
    );
  }
}
