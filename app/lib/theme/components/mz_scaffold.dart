import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/primitives.dart';

/// Variant modes for [MzScaffold].
enum MzScaffoldMode {
  /// Standard view with app bar and normal padding.
  standard,

  /// Immersive exam workspace with minimal distractions, no bottom nav.
  immersive,

  /// Onboarding presentation with brand focus.
  onboarding,
}

/// Standard root surface scaffold complying with design.md Sec. 5.
class MzScaffold extends StatelessWidget {
  /// Creates an [MzScaffold].
  const new({
    required this.body,
    this.mode = MzScaffoldMode.standard,
    this.appBar,
    this.bottomNavigationBar,
    this.floatingActionButton,
    this.padding,
    super.key,
  });

  /// Main content body.
  final Widget body;

  /// Scaffold layout mode.
  final MzScaffoldMode mode;

  /// Optional top app bar.
  final PreferredSizeWidget? appBar;

  /// Optional bottom navigation bar.
  final Widget? bottomNavigationBar;

  /// Optional floating action button.
  final Widget? floatingActionButton;

  /// Custom content padding override.
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    final defaultPadding = switch (mode) {
      MzScaffoldMode.standard => const EdgeInsets.symmetric(
        horizontal: SpacingTokens.pageInset,
      ),
      MzScaffoldMode.immersive => const EdgeInsets.symmetric(
        horizontal: SpacingTokens.pageInset,
        vertical: SpacingTokens.md,
      ),
      MzScaffoldMode.onboarding => const EdgeInsets.all(
        SpacingTokens.pageInset,
      ),
    };

    return Scaffold(
      backgroundColor: colors.background,
      appBar: appBar,
      floatingActionButton: floatingActionButton,
      bottomNavigationBar: bottomNavigationBar,
      body: SafeArea(
        child: Padding(
          padding: padding ?? defaultPadding,
          child: body,
        ),
      ),
    );
  }
}
