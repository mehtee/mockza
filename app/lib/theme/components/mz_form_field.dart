import 'package:flutter/material.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/primitives.dart';

/// Standard form field with label, input, and validation support (design.md Sec. 5).
class MzFormField extends StatelessWidget {
  /// Creates an [MzFormField].
  const new({
    required this.label,
    this.controller,
    this.hintText,
    this.helperText,
    this.errorText,
    this.obscureText = false,
    this.keyboardType,
    this.maxLines = 1,
    this.onChanged,
    this.onSubmitted,
    this.textInputAction,
    this.autofillHints,
    this.suffixIcon,
    this.autofocus = false,
    super.key,
  });

  /// Form field label.
  final String label;

  /// Optional text editing controller.
  final TextEditingController? controller;

  /// Placeholder hint text.
  final String? hintText;

  /// Supporting helper note below input.
  final String? helperText;

  /// Textual error message.
  final String? errorText;

  /// Whether text is obscured.
  final bool obscureText;

  /// Input keyboard type.
  final TextInputType? keyboardType;

  /// Max lines for multiline inputs.
  final int maxLines;

  /// Value change callback.
  final ValueChanged<String>? onChanged;

  /// Keyboard submission callback.
  final ValueChanged<String>? onSubmitted;

  /// Soft keyboard action button type.
  final TextInputAction? textInputAction;

  /// Platform autofill hints (`AutofillHints.email`, etc.).
  final Iterable<String>? autofillHints;

  /// Optional trailing action icon inside the input decoration.
  final Widget? suffixIcon;

  /// Autofocus flag.
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          label,
          style: typography.caption.copyWith(
            color: colors.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: SpacingTokens.xs),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          maxLines: maxLines,
          autofocus: autofocus,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          onChanged: onChanged,
          onSubmitted: onSubmitted,
          style: typography.body.copyWith(color: colors.textPrimary),
          decoration: InputDecoration(
            hintText: hintText,
            hintStyle: typography.body.copyWith(color: colors.textTertiary),
            helperText: helperText,
            helperStyle: typography.caption.copyWith(
              color: colors.textTertiary,
            ),
            errorText: errorText,
            errorStyle: typography.caption.copyWith(color: colors.error),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: colors.surface,
            contentPadding: const EdgeInsetsDirectional.symmetric(
              horizontal: SpacingTokens.md,
              vertical: SpacingTokens.md,
            ),
            border: OutlineInputBorder(
              borderRadius: shapes.controlRadius,
              borderSide: BorderSide(
                color: colors.borderSubtle,
                width: shapes.strokeWidth,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: shapes.controlRadius,
              borderSide: BorderSide(
                color: colors.borderSubtle,
                width: shapes.strokeWidth,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: shapes.controlRadius,
              borderSide: BorderSide(
                color: colors.focus,
                width: 1.5,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: shapes.controlRadius,
              borderSide: BorderSide(
                color: colors.error,
                width: shapes.strokeWidth,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
