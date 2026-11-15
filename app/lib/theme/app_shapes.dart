import 'dart:ui';

import 'package:flutter/material.dart';

/// Semantic shape, border radius, and elevation geometry tokens.
/// Aligned strictly with design.md Sec. 2.3.
@immutable
class AppShapes extends ThemeExtension<AppShapes> {
  /// Creates an [AppShapes] token bundle.
  const new({
    required this.cardRadius,
    required this.controlRadius,
    required this.compactRadius,
    required this.pillRadius,
    required this.sheetRadius,
    required this.strokeWidth,
  });

  /// Canonical shape system aligned with Mockza design.md Sec. 2.3.
  static const standard = AppShapes(
    cardRadius: BorderRadius.all(Radius.circular(22)),
    controlRadius: BorderRadius.all(Radius.circular(14)),
    compactRadius: BorderRadius.all(Radius.circular(10)),
    pillRadius: BorderRadius.all(Radius.circular(999)),
    sheetRadius: BorderRadius.all(Radius.circular(26)),
    strokeWidth: 1,
  );

  /// Standard card corner radius (`22dp`).
  final BorderRadius cardRadius;

  /// Standard button, input, and tile corner radius (`14dp`).
  final BorderRadius controlRadius;

  /// Compact chip or nested container corner radius (`10dp`).
  final BorderRadius compactRadius;

  /// Full pill / badge radius (`999dp`).
  final BorderRadius pillRadius;

  /// Bottom sheet and modal top corner radius (`26dp`).
  final BorderRadius sheetRadius;

  /// Hairline stroke thickness (`1dp`).
  final double strokeWidth;

  /// Resolves [AppShapes] from [context].
  static AppShapes of(BuildContext context) {
    final ext = Theme.of(context).extension<AppShapes>();
    assert(ext != null, 'AppShapes ThemeExtension is missing from ThemeData');
    return ext!;
  }

  @override
  AppShapes copyWith({
    BorderRadius? cardRadius,
    BorderRadius? controlRadius,
    BorderRadius? compactRadius,
    BorderRadius? pillRadius,
    BorderRadius? sheetRadius,
    double? strokeWidth,
  }) => AppShapes(
    cardRadius: cardRadius ?? this.cardRadius,
    controlRadius: controlRadius ?? this.controlRadius,
    compactRadius: compactRadius ?? this.compactRadius,
    pillRadius: pillRadius ?? this.pillRadius,
    sheetRadius: sheetRadius ?? this.sheetRadius,
    strokeWidth: strokeWidth ?? this.strokeWidth,
  );

  @override
  AppShapes lerp(covariant ThemeExtension<AppShapes>? other, double t) {
    if (other is! AppShapes) return this;
    return AppShapes(
      cardRadius: BorderRadius.lerp(cardRadius, other.cardRadius, t)!,
      controlRadius: BorderRadius.lerp(controlRadius, other.controlRadius, t)!,
      compactRadius: BorderRadius.lerp(compactRadius, other.compactRadius, t)!,
      pillRadius: BorderRadius.lerp(pillRadius, other.pillRadius, t)!,
      sheetRadius: BorderRadius.lerp(sheetRadius, other.sheetRadius, t)!,
      strokeWidth: lerpDouble(strokeWidth, other.strokeWidth, t) ?? strokeWidth,
    );
  }
}
