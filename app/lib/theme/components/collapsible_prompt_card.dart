import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared collapsible prompt card with optional overline, media attachment, and footer slot (`SRP` / `OCP`).
class CollapsiblePromptCard extends StatelessWidget {
  /// Creates a [CollapsiblePromptCard].
  const new({
    required this.title,
    required this.promptBody,
    required this.isCollapsed,
    required this.onToggleCollapsed,
    this.overline,
    this.expandedAttachment,
    this.footer,
    this.showLabel = 'Show prompt',
    this.hideLabel = 'Hide prompt',
    super.key,
  });

  /// Primary prompt heading text.
  final String title;

  /// Task or question prompt body hidden when [isCollapsed] is true.
  final String promptBody;

  /// Whether [promptBody] and [expandedAttachment] are currently collapsed.
  final bool isCollapsed;

  /// Toggles collapsed/expanded visibility.
  final VoidCallback onToggleCollapsed;

  /// Optional small overline displayed above [title] (e.g. "IELTS Writing Task 2").
  final String? overline;

  /// Optional chart or rich widget displayed below [promptBody] when expanded.
  final Widget? expandedAttachment;

  /// Optional widget always shown below the prompt (e.g. guidance & word-count chips).
  final Widget? footer;

  /// Button label shown when collapsed.
  final String showLabel;

  /// Button label shown when expanded.
  final String hideLabel;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  overline ?? title,
                  style: overline != null
                      ? typography.caption.copyWith(color: colors.textSecondary)
                      : typography.cardTitle,
                ),
              ),
              TextButton(
                onPressed: onToggleCollapsed,
                child: Text(isCollapsed ? showLabel : hideLabel),
              ),
            ],
          ),
          if (overline != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(title, style: typography.cardTitle),
          ],
          if (!isCollapsed) ...<Widget>[
            const SizedBox(height: SpacingTokens.xs),
            Text(
              promptBody,
              style: typography.body.copyWith(
                color: colors.textPrimary,
                height: 1.5,
              ),
            ),
            if (expandedAttachment != null) ...<Widget>[
              const SizedBox(height: SpacingTokens.md),
              expandedAttachment!,
            ],
          ],
          if (footer != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            footer!,
          ],
        ],
      ),
    );
  }
}
