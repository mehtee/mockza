import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/components/brand_header.dart';
import 'package:mockza/theme/primitives.dart';

/// Shared scrollable body frame for tab views and pushed feature scaffolds.
class FeatureModuleBody extends StatelessWidget {
  /// Creates a [FeatureModuleBody].
  const new({
    required this.title,
    required this.subtitle,
    required this.children,
    super.key,
  });

  /// Module title passed to [BrandHeader].
  final String title;

  /// Short subtitle describing the module state or scope.
  final String subtitle;

  /// Feature-specific cards and controls rendered inside the list.
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(color: colors.background),
      child: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.lg),
        children: <Widget>[
          BrandHeader(title: title, subtitle: subtitle),
          const SizedBox(height: SpacingTokens.lg),
          ...children,
        ],
      ),
    );
  }
}
