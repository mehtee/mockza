import 'package:flutter/material.dart';
import 'package:mockza/theme/primitives.dart';

/// Semantic gradient tokens specified in design.md Sec. 2.1 & 12.
@immutable
class AppGradients extends ThemeExtension<AppGradients> {
  /// Creates an [AppGradients] theme extension.
  const new({
    required this.primaryButton,
    required this.scoreFill,
    required this.heroCard,
    required this.recommendationCard,
  });

  /// Canonical dark mode gradients (Midnight Indigo default).
  static const dark = AppGradients(
    primaryButton: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      colors: <Color>[
        PalettePrimitives.indigoBtnStart,
        PalettePrimitives.indigoBtnEnd,
      ],
    ),
    scoreFill: LinearGradient(
      colors: <Color>[
        PalettePrimitives.indigoScoreStart,
        PalettePrimitives.indigoScoreEnd,
      ],
    ),
    heroCard: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      stops: <double>[0, 0.63, 1],
      colors: <Color>[
        PalettePrimitives.indigoHero1,
        PalettePrimitives.indigoHero2,
        PalettePrimitives.indigoHero3,
      ],
    ),
    recommendationCard: LinearGradient(
      begin: Alignment(-0.7, -0.7),
      end: Alignment(0.7, 0.7),
      colors: <Color>[
        PalettePrimitives.indigoRecStart,
        PalettePrimitives.indigoRecEnd,
      ],
    ),
  );

  /// Canonical light mode gradients (Midnight Indigo default).
  static const light = AppGradients(
    primaryButton: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      colors: <Color>[
        PalettePrimitives.lightAccent,
        PalettePrimitives.darkAccentPressed,
      ],
    ),
    scoreFill: LinearGradient(
      colors: <Color>[
        PalettePrimitives.lightBlue,
        PalettePrimitives.lightViolet,
      ],
    ),
    heroCard: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      stops: <double>[0, 0.63, 1],
      colors: <Color>[
        PalettePrimitives.lightSurfaceAlt,
        PalettePrimitives.lightHeroMid,
        PalettePrimitives.lightHeroEnd,
      ],
    ),
    recommendationCard: LinearGradient(
      begin: Alignment(-0.7, -0.7),
      end: Alignment(0.7, 0.7),
      colors: <Color>[
        PalettePrimitives.lightSurfaceAlt,
        PalettePrimitives.lightSurfaceHover,
      ],
    ),
  );

  /// Primary CTA button gradient.
  final LinearGradient primaryButton;

  /// Score progress fill gradient.
  final LinearGradient scoreFill;

  /// Dashboard hero card background gradient.
  final LinearGradient heroCard;

  /// Recommendation & action card background gradient.
  final LinearGradient recommendationCard;

  /// Resolves [AppGradients] from [context].
  static AppGradients of(BuildContext context) {
    final ext = Theme.of(context).extension<AppGradients>();
    assert(
      ext != null,
      'AppGradients ThemeExtension is missing from ThemeData',
    );
    return ext!;
  }

  @override
  AppGradients copyWith({
    LinearGradient? primaryButton,
    LinearGradient? scoreFill,
    LinearGradient? heroCard,
    LinearGradient? recommendationCard,
  }) => AppGradients(
    primaryButton: primaryButton ?? this.primaryButton,
    scoreFill: scoreFill ?? this.scoreFill,
    heroCard: heroCard ?? this.heroCard,
    recommendationCard: recommendationCard ?? this.recommendationCard,
  );

  @override
  AppGradients lerp(covariant ThemeExtension<AppGradients>? other, double t) {
    if (other is! AppGradients) return this;
    return AppGradients(
      primaryButton: LinearGradient.lerp(
        primaryButton,
        other.primaryButton,
        t,
      )!,
      scoreFill: LinearGradient.lerp(scoreFill, other.scoreFill, t)!,
      heroCard: LinearGradient.lerp(heroCard, other.heroCard, t)!,
      recommendationCard: LinearGradient.lerp(
        recommendationCard,
        other.recommendationCard,
        t,
      )!,
    );
  }
}
