import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mockza/core/exams/exam_spec.dart';
import 'package:mockza/services/diagnostic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';

bool _isFa(BuildContext context) =>
    Localizations.localeOf(context).languageCode == 'fa';

bool _matchesActiveExamScale(String scaleExamId, String activeExamId) {
  if (scaleExamId == activeExamId) return true;
  final scaleTrack = ExamTrack.fromId(scaleExamId);
  final activeTrack = ExamTrack.fromId(activeExamId);
  if (scaleTrack == activeTrack) return true;
  // Both IELTS Academic and IELTS General share the unified IELTS scale tile.
  return scaleTrack.isIelts && activeTrack.isIelts;
}

/// Opens the beginner-friendly "What to do / What not to do" help modal sheet,
/// with an optional action to switch from standard timing to Extended Help mode.
Future<void> showDiagnosticHelpSheet(
  BuildContext context, {
  required bool isTimedSession,
  required bool isActiveSession,
  VoidCallback? onSwitchToExtendedHelp,
}) => showMzBottomSheet<void>(
  context: context,
  title: _isFa(context)
      ? 'نحوه انجام این ارزیابی سریع'
      : 'How This Quick Check Works',
  child: SingleChildScrollView(
    padding: const EdgeInsetsDirectional.fromSTEB(
      SpacingTokens.lg,
      SpacingTokens.md,
      SpacingTokens.lg,
      SpacingTokens.xl,
    ),
    child: _DiagnosticHelpBody(
      isTimedSession: isTimedSession,
      isActiveSession: isActiveSession,
      onSwitchToExtendedHelp: onSwitchToExtendedHelp,
    ),
  ),
);

/// Opens the non-prescriptive official exam scale reference sheet
/// ("About your exam's scores") separated cleanly from Mockza results.
Future<void> showDiagnosticExamScaleSheet(
  BuildContext context, {
  required List<DiagnosticExamScaleInfo> examScales,
  required String activeExamId,
}) {
  final isIran = _isFa(context);
  return showMzBottomSheet<void>(
    context: context,
    title: isIran ? 'درباره مقیاس نمرات آزمون‌ها' : "About Your Exam's Scores",
    child: SingleChildScrollView(
      padding: const EdgeInsetsDirectional.fromSTEB(
        SpacingTokens.lg,
        SpacingTokens.md,
        SpacingTokens.lg,
        SpacingTokens.xl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          StatusBanner(
            message: isIran
                ? 'مقیاس رسمی آزمون‌ها صرفاً برای آشنایی شما نمایش داده می‌شود. این ارزیابی ۱۰ تا ۱۵ دقیقه‌ای سطح شروع تمرین را پیشنهاد می‌دهد و نمره رسمی آزمون را پیش‌بینی نمی‌کند.'
                : 'Official exam scales are shown only for orientation. This ~10–15 minute check suggests your starting practice level and does not predict an official exam score.',
            variant: StatusBannerVariant.offline,
          ),
          const SizedBox(height: SpacingTokens.md),
          for (final info in examScales) ...<Widget>[
            _ExamScaleTile(
              info: info,
              isSelected: _matchesActiveExamScale(info.examId, activeExamId),
            ),
            const SizedBox(height: SpacingTokens.sm),
          ],
        ],
      ),
    ),
  );
}

class _DiagnosticHelpBody extends StatelessWidget {
  const new({
    required this.isTimedSession,
    required this.isActiveSession,
    this.onSwitchToExtendedHelp,
  });

  final bool isTimedSession;
  final bool isActiveSession;
  final VoidCallback? onSwitchToExtendedHelp;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = _isFa(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Text(
          isIran
              ? 'این یک برآورد اولیه است — نه آزمون رسمی. وجود پرسش‌های دشوار طبیعی است تا سریع‌تر سطح شروع مناسب را پیدا کنیم.'
              : 'This is a starting estimate — not an exam. Hard questions are normal so we can find the right starting level quickly.',
          style: typography.body.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: SpacingTokens.md),
        const _DoDontCard(),
        const SizedBox(height: SpacingTokens.md),
        if (isTimedSession && isActiveSession && onSwitchToExtendedHelp != null)
          StatusBanner(
            message: isIran
                ? 'خواندن این راهنما در حالت استاندارد جزو تایمر ۱۵ دقیقه‌ای محاسبه می‌شود. زمان بیشتری نیاز دارید؟'
                : 'Reading this help counts toward your 15-minute timer in standard mode. Need extra time?',
            actionLabel: isIran ? 'زمان بیشتر' : 'Extended Help',
            onTapAction: () {
              Navigator.of(context).pop();
              onSwitchToExtendedHelp!();
            },
          ),
        if (isTimedSession &&
            !isActiveSession &&
            onSwitchToExtendedHelp != null)
          SecondaryButton(
            label: isIran
                ? 'تغییر به حالت بدون محدودیت زمانی'
                : 'Switch to Extended Help (Untimed)',
            onPressed: () {
              Navigator.of(context).pop();
              onSwitchToExtendedHelp!();
            },
          ),
        const SizedBox(height: SpacingTokens.md),
        PrimaryButton(
          label: isIran ? 'متوجه شدم' : 'Got it',
          onPressed: () => Navigator.of(context).pop(),
        ),
      ],
    );
  }
}

class _DoDontCard extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = _isFa(context);

    return MzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            isIran ? 'کارهایی که بهتر است انجام دهید' : 'What to do',
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.sm),
          _RuleRow(
            isPositive: true,
            text: isIran
                ? 'در هر ۴ بخش کوتاه، با جملات خودتان کوتاه پاسخ دهید.'
                : 'Answer briefly in your own words across all 4 short parts.',
          ),
          _RuleRow(
            isPositive: true,
            text: isIran
                ? 'اگر متنی بیش از حد سخت بود، به‌جای حدس تصادفی گزینه «نمی‌دانم» را بزنید.'
                : 'Tap "I don\'t know" if a Reading or Listening passage is too hard instead of guessing randomly.',
          ),
          _RuleRow(
            isPositive: true,
            text: isIran
                ? 'در صورت نیاز می‌توانید هر مهارت را رد کنید (یا بدون اسپیکینگ ادامه دهید).'
                : 'Skip any skill (or continue without Speaking) if needed.',
          ),
          const SizedBox(height: SpacingTokens.md),
          Divider(color: colors.borderSubtle, height: 1),
          const SizedBox(height: SpacingTokens.md),
          Text(
            isIran ? 'کارهایی که نباید انجام دهید' : 'What not to do',
            style: typography.cardTitle,
          ),
          const SizedBox(height: SpacingTokens.sm),
          _RuleRow(
            isPositive: false,
            text: isIran
                ? 'از مترجم، فرهنگ لغت یا ابزارهای نوشتاری هوش مصنوعی استفاده نکنید.'
                : 'Do not use translators, dictionaries, or AI writing tools.',
          ),
          _RuleRow(
            isPositive: false,
            text: isIran
                ? 'روی یک سوال سخت متوقف نشوید — پاسخ کوتاه بسیار بهتر از صفحه خالی است.'
                : 'Do not stay stuck on one tricky item — short answers give a better picture than empty screens.',
          ),
        ],
      ),
    );
  }
}

class _RuleRow extends StatelessWidget {
  const new({required this.isPositive, required this.text});

  final bool isPositive;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return Padding(
      padding: const EdgeInsetsDirectional.only(bottom: SpacingTokens.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Padding(
            padding: const EdgeInsetsDirectional.only(
              top: SpacingTokens.xs / 2,
            ),
            child: AppIcon(
              isPositive ? LucideGlyph.checkCircle2 : LucideGlyph.alertCircle,
              size: 16,
              color: isPositive ? colors.success : colors.warning,
            ),
          ),
          const SizedBox(width: SpacingTokens.sm),
          Expanded(
            child: Text(
              text,
              style: typography.secondary.copyWith(color: colors.textPrimary),
            ),
          ),
        ],
      ),
    );
  }
}

class _ExamScaleTile extends StatelessWidget {
  const new({required this.info, required this.isSelected});

  final DiagnosticExamScaleInfo info;
  final bool isSelected;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = _isFa(context);

    return MzCard(
      variant: isSelected ? MzCardVariant.hero : MzCardVariant.standard,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(info.label, style: typography.cardTitle),
              ),
              if (isSelected)
                Text(
                  isIran ? 'هدف شما' : 'Your Goal',
                  style: typography.caption.copyWith(
                    color: colors.primary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            info.summary,
            style: typography.secondary.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
