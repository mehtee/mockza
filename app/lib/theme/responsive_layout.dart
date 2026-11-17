import 'package:flutter/material.dart';
import 'package:mockza/theme/primitives.dart';

/// Viewport width classification aligned with Material 3 adaptive breakpoints.
enum WindowSizeClass {
  /// Phone portrait width (`< 600dp`).
  compact,

  /// Tablet portrait / large foldable width (`600dp..839dp`).
  medium,

  /// Tablet landscape / desktop width (`>= 840dp`).
  expanded,
}

/// Pure breakpoint & spacing helpers so screens never hardcode raw breakpoints.
abstract final class MzResponsive {
  /// Breakpoint separating compact phones from medium screens (`600dp`).
  static const double mediumBreakpoint = 600;

  /// Breakpoint separating medium screens from desktop/expanded (`840dp`).
  static const double expandedBreakpoint = 840;

  /// Threshold below which tight phone horizontal padding (`16dp`) applies.
  static const double tightPhoneThreshold = 380;

  /// Returns the [WindowSizeClass] for [context].
  static WindowSizeClass sizeClassOf(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    if (width >= expandedBreakpoint) return WindowSizeClass.expanded;
    if (width >= mediumBreakpoint) return WindowSizeClass.medium;
    return WindowSizeClass.compact;
  }

  /// Whether the current viewport width is a compact phone (`< 600dp`).
  static bool isCompactOf(BuildContext context) =>
      sizeClassOf(context) == WindowSizeClass.compact;

  /// Whether the viewport is a tight sub-380dp phone (e.g. `320dp–360dp`).
  static bool isTightPhoneOf(BuildContext context) =>
      MediaQuery.sizeOf(context).width < tightPhoneThreshold;

  /// Responsive horizontal page gutter (`16dp` on tight phones, `20dp` otherwise).
  static double horizontalGutterOf(BuildContext context) =>
      isTightPhoneOf(context) ? SpacingTokens.lg : SpacingTokens.pageInset;
}
