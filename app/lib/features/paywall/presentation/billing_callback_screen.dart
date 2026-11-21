import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/features/paywall/presentation/paywall_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Handles Zarinpal payment gateway redirect callbacks (`/billing/callback`)
/// and strictly verifies payment server-side before activating Sanjia Pro.
class BillingCallbackScreen extends ConsumerStatefulWidget {
  /// Creates a [BillingCallbackScreen].
  const new({
    required this.authority,
    this.status,
    super.key,
  });

  /// Returned Zarinpal authority identifier.
  final String authority;

  /// Returned Zarinpal query status (`OK` or `NOK`).
  final String? status;

  @override
  ConsumerState<BillingCallbackScreen> createState() =>
      _BillingCallbackScreenState();
}

class _BillingCallbackScreenState extends ConsumerState<BillingCallbackScreen> {
  bool _isVerifying = true;
  bool _succeeded = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    unawaited(_verify());
  }

  Future<void> _verify() async {
    if (widget.authority.trim().isEmpty) {
      setState(() {
        _isVerifying = false;
        _succeeded = false;
        _message = 'کد رهگیری پرداخت (Authority) یافت نشد.';
      });
      return;
    }

    final ok = await ref
        .read(paywallNotifierProvider.notifier)
        .verifyZarinpalCallback(
          authority: widget.authority.trim(),
          status: widget.status,
        );
    if (!mounted) return;
    final state = ref.read(paywallNotifierProvider);
    setState(() {
      _isVerifying = false;
      _succeeded = ok;
      _message = state.statusMessage;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzScaffold(
      appBar: AppBar(title: const Text('تایید پرداخت سنجیا')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: MzCard(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Center(
                  child: _isVerifying
                      ? CircularProgressIndicator(color: colors.primary)
                      : AppIcon(
                          _succeeded
                              ? LucideGlyph.checkCircle2
                              : LucideGlyph.alertCircle,
                          size: 48,
                          color: _succeeded ? colors.success : colors.error,
                        ),
                ),
                const SizedBox(height: SpacingTokens.md),
                Text(
                  _isVerifying
                      ? 'در حال استعلام و تایید تراکنش...'
                      : (_succeeded
                            ? 'اشتراک سنجیا پرو فعال شد'
                            : 'پرداخت تایید نشد'),
                  textAlign: TextAlign.center,
                  style: typography.sectionHeading.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                const SizedBox(height: SpacingTokens.sm),
                if (_message != null)
                  Text(
                    _message!,
                    textAlign: TextAlign.center,
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                if (widget.authority.isNotEmpty) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  LtrExamBoundary(
                    child: Text(
                      'Authority: ${widget.authority}',
                      textAlign: TextAlign.center,
                      style: typography.caption.copyWith(
                        color: colors.textTertiary,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: SpacingTokens.lg),
                if (!_isVerifying)
                  PrimaryButton(
                    label: _succeeded
                        ? 'بازگشت به داشبورد'
                        : 'بازگشت به صفحه اشتراک',
                    onPressed: () => context.go(
                      _succeeded ? AppRoutes.home : AppRoutes.paywall,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
