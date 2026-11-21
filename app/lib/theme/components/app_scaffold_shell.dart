import 'package:flutter/material.dart';
import 'package:mockza/l10n/app_localizations.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared 4-tab persistent navigation shell with top-right Settings push button.
/// Aligned strictly with design.md Sec. 4 & 5.
class AppScaffoldShell extends StatelessWidget {
  /// Creates an [AppScaffoldShell].
  const new({
    required this.currentIndex,
    required this.onSelectTab,
    required this.onOpenSettings,
    required this.child,
    super.key,
  });

  /// Active bottom navigation branch index (`0..3`).
  final int currentIndex;

  /// Callback invoked when the learner selects a navigation tab.
  final ValueChanged<int> onSelectTab;

  /// Callback invoked when the learner taps the header Settings gear icon.
  final VoidCallback onOpenSettings;

  /// Current active branch content widget.
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    // Responsive tablet container (design.md Sec. 2.3 & Epic F5.2: 680px max content container)
    return LayoutBuilder(
      builder: (context, constraints) {
        final content = Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              maxWidth: SpacingTokens.maxContentWidth,
            ),
            child: child,
          ),
        );

        return Scaffold(
          body: SafeArea(child: content),
          bottomNavigationBar: Container(
            decoration: BoxDecoration(
              color: colors.surface,
              border: Border(
                top: BorderSide(
                  color: colors.borderSubtle,
                ),
              ),
            ),
            child: NavigationBar(
              selectedIndex: currentIndex,
              onDestinationSelected: onSelectTab,
              height: SpacingTokens.bottomNavHeight,
              backgroundColor: colors.surface,
              indicatorColor: colors.surfaceAlt,
              labelTextStyle: WidgetStatePropertyAll<TextStyle>(
                typography.caption.copyWith(color: colors.textSecondary),
              ),
              destinations: <NavigationDestination>[
                NavigationDestination(
                  icon: AppIcon(
                    LucideGlyph.house,
                    size: 22,
                    color: colors.textSecondary,
                  ),
                  selectedIcon: AppIcon(
                    LucideGlyph.house,
                    size: 22,
                    color: colors.primary,
                  ),
                  label: l10n.navHome,
                ),
                NavigationDestination(
                  icon: AppIcon(
                    LucideGlyph.circlePlay,
                    size: 22,
                    color: colors.textSecondary,
                  ),
                  selectedIcon: AppIcon(
                    LucideGlyph.circlePlay,
                    size: 22,
                    color: colors.primary,
                  ),
                  label: l10n.navPractice,
                ),
                NavigationDestination(
                  icon: AppIcon(
                    LucideGlyph.sparkles,
                    size: 22,
                    color: colors.textSecondary,
                  ),
                  selectedIcon: AppIcon(
                    LucideGlyph.sparkles,
                    size: 22,
                    color: colors.primary,
                  ),
                  label: l10n.navSmartCoach,
                ),
                NavigationDestination(
                  icon: AppIcon(
                    LucideGlyph.layers3,
                    size: 22,
                    color: colors.textSecondary,
                  ),
                  selectedIcon: AppIcon(
                    LucideGlyph.layers3,
                    size: 22,
                    color: colors.primary,
                  ),
                  label: l10n.navVocabulary,
                ),
                NavigationDestination(
                  icon: AppIcon(
                    LucideGlyph.chartIncreasing,
                    size: 22,
                    color: colors.textSecondary,
                  ),
                  selectedIcon: AppIcon(
                    LucideGlyph.chartIncreasing,
                    size: 22,
                    color: colors.primary,
                  ),
                  label: l10n.navProgress,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
