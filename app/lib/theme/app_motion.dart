import 'package:flutter/material.dart';

/// Semantic motion duration and easing curves registered on [ThemeData].
/// Aligned strictly with design.md Sec. 2.4.
@immutable
class AppMotion extends ThemeExtension<AppMotion> {
  /// Creates an [AppMotion] token set.
  const new({
    required this.microDuration,
    required this.standardDuration,
    required this.sheetDuration,
    required this.standardCurve,
    required this.decelerateCurve,
  });

  /// Canonical motion timing bundle.
  static const standard = AppMotion(
    microDuration: Duration(milliseconds: 150),
    standardDuration: Duration(milliseconds: 200),
    sheetDuration: Duration(milliseconds: 240),
    standardCurve: Curves.easeOut,
    decelerateCurve: Curves.easeOutCubic,
  );

  /// Reduced motion bundle collapsing transitions.
  static const reduced = AppMotion(
    microDuration: Duration.zero,
    standardDuration: Duration.zero,
    sheetDuration: Duration.zero,
    standardCurve: Curves.linear,
    decelerateCurve: Curves.linear,
  );

  /// Fast press/selection interaction duration (`150ms`).
  final Duration microDuration;

  /// Default navigation / state transition duration (`200ms`).
  final Duration standardDuration;

  /// Bottom sheet reveal and modal dialog duration (`240ms`).
  final Duration sheetDuration;

  /// Standard ease-out curve.
  final Curve standardCurve;

  /// Enter / deceleration curve.
  final Curve decelerateCurve;

  /// Compatibility getter for existing code.
  Duration get emphasisDuration => sheetDuration;

  /// Resolves [AppMotion] from [context], respecting prefers-reduced-motion.
  static AppMotion of(BuildContext context) {
    if (MediaQuery.disableAnimationsOf(context)) {
      return reduced;
    }
    final ext = Theme.of(context).extension<AppMotion>();
    return ext ?? standard;
  }

  @override
  AppMotion copyWith({
    Duration? microDuration,
    Duration? standardDuration,
    Duration? sheetDuration,
    Curve? standardCurve,
    Curve? decelerateCurve,
  }) => AppMotion(
    microDuration: microDuration ?? this.microDuration,
    standardDuration: standardDuration ?? this.standardDuration,
    sheetDuration: sheetDuration ?? this.sheetDuration,
    standardCurve: standardCurve ?? this.standardCurve,
    decelerateCurve: decelerateCurve ?? this.decelerateCurve,
  );

  @override
  AppMotion lerp(covariant ThemeExtension<AppMotion>? other, double t) =>
      t < 0.5 ? this : (other is AppMotion ? other : this);
}
