import 'package:flutter/material.dart';
import 'package:mockza/theme/app_typography.dart';

/// Isolates English exam passages, blanks (`____`), option letters (`A.`–`D.`),
/// countdown timers (`19:45`), essay editors, SVG charts, and band/score badges (`7.5`)
/// inside a strict LTR boundary when rendered within `Sanjia` (`IRN`) RTL chrome.
///
/// Mirrors `web/src/edition/bidi/LtrExamBoundary.tsx`.
class LtrExamBoundary extends StatelessWidget {
  /// Creates an [LtrExamBoundary].
  const new({
    required this.child,
    this.useLatinFont = true,
    super.key,
  });

  /// English exam subtree to isolate from surrounding RTL directionality.
  final Widget child;

  /// Whether to enforce `Inter` tabular font styling inside this boundary.
  final bool useLatinFont;

  @override
  Widget build(BuildContext context) {
    var content = child;
    if (useLatinFont) {
      content = DefaultTextStyle.merge(
        style: const TextStyle(
          fontFamily: AppTypography.sansFamily,
          fontFeatures: <FontFeature>[FontFeature.tabularFigures()],
        ),
        child: content,
      );
    }

    return Directionality(
      textDirection: TextDirection.ltr,
      child: Localizations.override(
        context: context,
        locale: const Locale('en', 'US'),
        child: content,
      ),
    );
  }
}
