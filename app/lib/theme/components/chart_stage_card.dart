import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Dark-canvas inspection frame for Writing Task 1 vector charts.
///
/// Chart SVGs use crisp light/cyan accents; rendering them on a fixed dark
/// slate surface preserves visual contrast across Light and Dark app modes.
class ChartStageCard extends StatelessWidget {
  /// Creates a [ChartStageCard].
  const new({required this.chartBuilder, this.caption, super.key});

  /// Builds the chart graphic (used inline and inside the zoom dialog).
  final WidgetBuilder chartBuilder;

  /// Optional descriptive caption shown below the chart viewport.
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    final stageBg = AppColors.dark.surface;
    final captionColor = AppColors.dark.textSecondary;
    final actionColor = AppColors.dark.primary;

    return Container(
      decoration: BoxDecoration(
        color: stageBg,
        borderRadius: shapes.compactRadius,
        border: Border.all(color: colors.borderSubtle),
      ),
      padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          SizedBox(
            height: 220,
            child: ClipRRect(
              borderRadius: shapes.compactRadius,
              child: InteractiveViewer(
                minScale: 1,
                maxScale: 3,
                child: chartBuilder(context),
              ),
            ),
          ),
          const SizedBox(height: SpacingTokens.xs),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  caption != null && caption!.isNotEmpty
                      ? caption!
                      : 'Pinch or zoom to inspect chart values',
                  style: typography.caption.copyWith(color: captionColor),
                ),
              ),
              TextButton.icon(
                onPressed: () {
                  unawaited(
                    showDialog<void>(
                      context: context,
                      builder: (dialogCtx) => Dialog(
                        backgroundColor: stageBg,
                        child: Padding(
                          padding: const EdgeInsetsDirectional.all(
                            SpacingTokens.md,
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: <Widget>[
                              SizedBox(
                                height: 340,
                                width: 460,
                                child: InteractiveViewer(
                                  minScale: 1,
                                  maxScale: 4,
                                  child: chartBuilder(dialogCtx),
                                ),
                              ),
                              const SizedBox(height: SpacingTokens.sm),
                              TextButton(
                                onPressed: () => Navigator.of(dialogCtx).pop(),
                                child: Text(
                                  'Close',
                                  style: typography.body.copyWith(
                                    color: actionColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                },
                icon: AppIcon(LucideGlyph.search, size: 14, color: actionColor),
                label: Text(
                  'Expand',
                  style: typography.caption.copyWith(
                    color: actionColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Shared dark-canvas SVG prompt viewer for Writing Task 1, DET photo prompts,
/// and PTE Describe Image speaking tasks (`DRY` reuse over [ChartStageCard]).
class ExamSvgChartCard extends StatelessWidget {
  /// Creates an [ExamSvgChartCard].
  const new({
    required this.chartSvgOrPath,
    required this.resolvedUrl,
    this.caption,
    super.key,
  });

  /// Raw inline `<svg...>` XML or relative/absolute media path.
  final String chartSvgOrPath;

  /// Resolved HTTP(S) URL for network SVG fallback when not inline XML.
  final String resolvedUrl;

  /// Optional figure caption displayed below the graphic.
  final String? caption;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isInlineSvg = chartSvgOrPath.trimLeft().startsWith('<svg');

    Widget buildSvgWidget(BuildContext _) => isInlineSvg
        ? SvgPicture.string(chartSvgOrPath)
        : SvgPicture.network(
            resolvedUrl,
            placeholderBuilder: (_) => Center(
              child: Padding(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                child: CircularProgressIndicator(color: colors.primary),
              ),
            ),
            errorBuilder: (_, _, _) => Center(
              child: Padding(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
                child: Text(
                  caption != null && caption!.isNotEmpty
                      ? caption!
                      : 'Visual figure preview unavailable offline',
                  style: typography.caption.copyWith(
                    color: AppColors.dark.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
          );

    return ChartStageCard(chartBuilder: buildSvgWidget, caption: caption);
  }
}
