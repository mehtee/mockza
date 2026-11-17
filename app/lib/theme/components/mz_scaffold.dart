import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/primitives.dart';
import 'package:mockza/theme/responsive_layout.dart';

/// Variant modes for [MzScaffold].
enum MzScaffoldMode {
  /// Standard view with app bar and normal responsive padding.
  standard,

  /// Immersive exam workspace with minimal distractions, no bottom nav.
  immersive,

  /// Onboarding presentation with brand focus.
  onboarding,
}

/// Standard root surface scaffold complying with design.md Sec. 5.
/// Applies single-level responsive horizontal gutters (`16dp` on tight phones,
/// `20dp` otherwise), centers narrow-flow screens at `680dp` on wide viewports
/// unless [centerOnWide] is `false`, and optionally pins a [bottomBar].
class MzScaffold extends StatelessWidget {
  /// Creates an [MzScaffold].
  const new({
    required this.body,
    this.mode = MzScaffoldMode.standard,
    this.appBar,
    this.bottomNavigationBar,
    this.bottomBar,
    this.floatingActionButton,
    this.padding,
    this.centerOnWide = true,
    this.maxContentWidth = SpacingTokens.maxContentWidth,
    super.key,
  });

  /// Main content body.
  final Widget body;

  /// Scaffold layout mode.
  final MzScaffoldMode mode;

  /// Optional top app bar.
  final PreferredSizeWidget? appBar;

  /// Optional persistent bottom navigation bar.
  final Widget? bottomNavigationBar;

  /// Optional pinned action bar rendered cleanly above the safe bottom edge.
  final Widget? bottomBar;

  /// Optional floating action button.
  final Widget? floatingActionButton;

  /// Custom content padding override (`EdgeInsetsDirectional.zero` to opt out).
  final EdgeInsetsGeometry? padding;

  /// Whether to cap body width to [maxContentWidth] on tablet/desktop screens.
  final bool centerOnWide;

  /// Max width applied when [centerOnWide] is `true` (default `680dp`).
  final double maxContentWidth;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final gutter = MzResponsive.horizontalGutterOf(context);

    final defaultPadding = switch (mode) {
      MzScaffoldMode.standard => EdgeInsetsDirectional.symmetric(
        horizontal: gutter,
      ),
      MzScaffoldMode.immersive => EdgeInsetsDirectional.symmetric(
        horizontal: gutter,
        vertical: SpacingTokens.sm,
      ),
      MzScaffoldMode.onboarding => EdgeInsetsDirectional.symmetric(
        horizontal: gutter,
        vertical: SpacingTokens.md,
      ),
    };

    final paddedBody = Padding(
      padding: padding ?? defaultPadding,
      child: body,
    );

    final constrainedBody = centerOnWide
        ? Center(
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxContentWidth),
              child: paddedBody,
            ),
          )
        : paddedBody;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar ?? bottomBar,
      body: SafeArea(
        bottom: bottomBar == null,
        child: constrainedBody,
      ),
    );
  }
}
