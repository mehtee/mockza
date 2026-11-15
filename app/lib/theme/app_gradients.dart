import 'package:flutter/material.dart';

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

  /// Canonical dark mode gradients.
  static const dark = AppGradients(
    primaryButton: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      colors: <Color>[Color(0xFF6B8CFF), Color(0xFF8D70F7)],
    ),
    scoreFill: LinearGradient(
      colors: <Color>[Color(0xFF6CCEFF), Color(0xFF917AFB)],
    ),
    heroCard: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      stops: <double>[0, 0.63, 1],
      colors: <Color>[
        Color(0xFF222840),
        Color(0xFF1C2036),
        Color(0xFF28234C),
      ],
    ),
    recommendationCard: LinearGradient(
      begin: Alignment(-0.7, -0.7),
      end: Alignment(0.7, 0.7),
      colors: <Color>[Color(0xFF252841), Color(0xFF211F38)],
    ),
  );

  /// Canonical light mode gradients.
  static const light = AppGradients(
    primaryButton: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      colors: <Color>[Color(0xFF5E4CCF), Color(0xFF7A65DF)],
    ),
    scoreFill: LinearGradient(
      colors: <Color>[Color(0xFF1968BD), Color(0xFF6049BA)],
    ),
    heroCard: LinearGradient(
      begin: Alignment(-0.8, -0.6),
      end: Alignment(0.8, 0.6),
      stops: <double>[0, 0.63, 1],
      colors: <Color>[
        Color(0xFFF0F2FA),
        Color(0xFFE8ECF7),
        Color(0xFFE2E7F5),
      ],
    ),
    recommendationCard: LinearGradient(
      begin: Alignment(-0.7, -0.7),
      end: Alignment(0.7, 0.7),
      colors: <Color>[Color(0xFFF0F2FA), Color(0xFFE5E8F5)],
    ),
  );

  /// Primary CTA button gradient (`110deg #6B8CFF -> #8D70F7`).
  final LinearGradient primaryButton;

  /// Score progress fill gradient (`90deg #6CCEFF -> #917AFB`).
  final LinearGradient scoreFill;

  /// Dashboard hero card background gradient (`125deg #222840 -> #1C2036 63% -> #28234C`).
  final LinearGradient heroCard;

  /// Recommendation & action card background gradient (`135deg #252841 -> #211F38`).
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
