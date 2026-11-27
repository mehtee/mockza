import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/diagnostic/diagnostic_models.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_help_sheet.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_notifier.dart';
import 'package:mockza/features/diagnostic/presentation/diagnostic_providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/routing/safe_pop.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/icon_well.dart';
import 'package:mockza/theme/components/mic_preflight_card.dart';
import 'package:mockza/theme/components/mz_bottom_sheet.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/components/mz_sticky_bottom_bar.dart';
import 'package:mockza/theme/components/status_banner.dart';
import 'package:mockza/theme/primitives.dart';

/// Step 0 (`/diagnostic/intro`): beginner-safe orientation, sound/mic check,
/// mode choice, consent note, and skip/later options before the 15-minute timer starts.
class DiagnosticIntroScreen extends ConsumerStatefulWidget {
  /// Creates a [DiagnosticIntroScreen].
  const new({
    this.examId,
    this.initialMode,
    super.key,
  });

  /// Optional target exam identifier from route query parameters.
  final String? examId;

  /// Optional initial timing/accessibility mode wire string.
  final String? initialMode;

  @override
  ConsumerState<DiagnosticIntroScreen> createState() =>
      _DiagnosticIntroScreenState();
}

class _DiagnosticIntroScreenState extends ConsumerState<DiagnosticIntroScreen> {
  @override
  void initState() {
    super.initState();
    final mode = widget.initialMode != null
        ? DiagnosticMode.fromWire(widget.initialMode!)
        : null;
    unawaited(
      Future<void>.microtask(() {
        if (!mounted) return;
        unawaited(
          ref
              .read(diagnosticNotifierProvider.notifier)
              .prepareIntro(
                examIdOverride: widget.examId,
                modeOverride: mode,
              ),
        );
      }),
    );
  }

  void _exitSafe() => context.safePopOrGo(AppRoutes.home);

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(diagnosticNotifierProvider);
    final notifier = ref.read(diagnosticNotifierProvider.notifier);
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isIran = Localizations.localeOf(context).languageCode == 'fa';

    final modeLabel = switch (state.mode) {
      DiagnosticMode.standard =>
        isIran ? 'استاندارد (۱۵ دقیقه) ▾' : 'Standard (15m) ▾',
      DiagnosticMode.extended =>
        isIran ? 'بدون محدودیت زمانی ▾' : 'Untimed Help ▾',
      DiagnosticMode.accessible =>
        isIran ? 'حالت صوتی دسترس‌پذیر ▾' : 'Accessible Audio ▾',
    };

    return MzScaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: isIran ? 'بستن' : 'Close',
          onPressed: _exitSafe,
          icon: const AppIcon(LucideGlyph.x, size: 22),
        ),
        title: Text(isIran ? 'ارزیابی سریع اولیه' : 'Quick Starting Check'),
        actions: <Widget>[
          IconButton(
            tooltip: isIran ? 'راهنمای ارزیابی' : 'How this works',
            onPressed: () {
              unawaited(
                showDiagnosticHelpSheet(
                  context,
                  isTimedSession: state.isTimed,
                  isActiveSession: false,
                  onSwitchToExtendedHelp: () =>
                      notifier.setMode(DiagnosticMode.extended),
                ),
              );
            },
            icon: const AppIcon(LucideGlyph.info, size: 22),
          ),
        ],
      ),
      bottomBar: MzStickyBottomBar(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            PrimaryButton(
              label: state.isLoadingBank
                  ? (isIran
                        ? 'در حال آماده‌سازی پرسش‌ها...'
                        : 'Preparing questions...')
                  : (isIran ? 'شروع ارزیابی' : 'Start check'),
              onPressed: state.isLoadingBank || state.bank == null
                  ? null
                  : () async {
                      final router = GoRouter.of(context);
                      final diagId = await notifier.startDiagnosticSession();
                      if (diagId != null) {
                        router.go(AppRoutes.buildDiagnosticSession(diagId));
                      }
                    },
            ),
            const SizedBox(height: SpacingTokens.xs),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: SpacingTokens.md,
              children: <Widget>[
                if (!state.speakingOptOut)
                  TextButton(
                    onPressed: state.isLoadingBank || state.bank == null
                        ? null
                        : () async {
                            notifier.setSpeakingOptOut(
                              optOut: true,
                              reason: NoEvidenceReason.skipped,
                            );
                            final router = GoRouter.of(context);
                            final diagId = await notifier
                                .startDiagnosticSession();
                            if (diagId != null) {
                              router.go(
                                AppRoutes.buildDiagnosticSession(diagId),
                              );
                            }
                          },
                    child: Text(
                      isIran
                          ? 'ادامه بدون بخش اسپیکینگ'
                          : 'Continue without Speaking',
                    ),
                  ),
                TextButton(
                  onPressed: () => context.go(AppRoutes.home),
                  child: Text(isIran ? 'بعداً انجام می‌دهم' : 'Do this later'),
                ),
              ],
            ),
          ],
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsetsDirectional.symmetric(
          vertical: SpacingTokens.sm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            // Compact orientation hero + 1-tap Timing & Accessibility mode chip
            MzCard(
              variant: MzCardVariant.hero,
              padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      const IconWell(
                        glyph: LucideGlyph.sparkles,
                        tint: IconWellTint.blue,
                        size: 36,
                        iconSize: 18,
                      ),
                      const SizedBox(width: SpacingTokens.sm),
                      Expanded(
                        child: Text(
                          isIran
                              ? 'تعیین سطح اولیه (~۱۰ تا ۱۵ دقیقه)'
                              : 'Find Your Starting Level (~10–15 Min)',
                          style: typography.cardTitle,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: SpacingTokens.xs),
                  Text(
                    isIran
                        ? '۴ بخش کوتاه • نمونه‌های بدون نمره منفی • امکان رد کردن هر مهارت.'
                        : '4 short checks • unscored examples • skip any skill.',
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: SpacingTokens.sm),
                  Align(
                    alignment: AlignmentDirectional.centerStart,
                    child: MzChip(
                      label: modeLabel,
                      glyph: LucideGlyph.slidersHorizontal,
                      variant: state.mode == DiagnosticMode.standard
                          ? MzChipVariant.target
                          : MzChipVariant.positive,
                      onTap: () => _openHelpOptions(context, state, notifier),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.sm),

            if (state.bankLoadError != null) ...<Widget>[
              StatusBanner(
                message: isIran
                    ? 'بارگذاری پرسش‌های ارزیابی ناموفق بود: ${state.bankLoadError}'
                    : 'Could not load check questions: ${state.bankLoadError}',
                variant: StatusBannerVariant.error,
                actionLabel: isIran ? 'تلاش مجدد' : 'Retry',
                onTapAction: notifier.retryLoadBank,
              ),
              const SizedBox(height: SpacingTokens.sm),
            ],

            // Compact side-by-side Sound & Microphone check card
            _DeviceCheckCard(state: state, notifier: notifier),
            const SizedBox(height: SpacingTokens.sm),

            // Scannable 3-item beginner guidelines
            const _CompactDoDontSummary(),
            const SizedBox(height: SpacingTokens.xs),

            // Compact privacy & audio consent link
            InkWell(
              onTap: () => _showPrivacySheet(context),
              borderRadius: shapes.controlRadius,
              child: Padding(
                padding: const EdgeInsetsDirectional.symmetric(
                  vertical: SpacingTokens.xs,
                  horizontal: SpacingTokens.xs,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: <Widget>[
                    AppIcon(
                      LucideGlyph.info,
                      size: 14,
                      color: colors.textTertiary,
                    ),
                    const SizedBox(width: SpacingTokens.xs),
                    Flexible(
                      child: Text(
                        isIran
                            ? 'نکته حریم خصوصی و پردازش صدا'
                            : 'Audio & privacy notice',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: typography.caption.copyWith(
                          color: colors.textSecondary,
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openHelpOptions(
    BuildContext context,
    DiagnosticState state,
    DiagnosticNotifier notifier,
  ) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = Localizations.localeOf(context).languageCode == 'fa';

    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: isIran
            ? 'گزینه‌های زمان‌بندی و دسترس‌پذیری'
            : 'Accessibility & Timing Options',
        child: Builder(
          builder: (sheetCtx) => Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(
              SpacingTokens.lg,
              SpacingTokens.md,
              SpacingTokens.lg,
              SpacingTokens.xl,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                _ModeChoiceTile(
                  title: isIran
                      ? 'ارزیابی استاندارد ۱۵ دقیقه‌ای'
                      : 'Standard 15-Minute Check',
                  subtitle: isIran
                      ? 'روند ۴ مهارته با زمان‌بندی منظم و انتقال خودکار مراحل.'
                      : 'Paced 4-skill flow with automatic stage transitions.',
                  selected: state.mode == DiagnosticMode.standard,
                  onTap: () {
                    notifier.setMode(DiagnosticMode.standard);
                    Navigator.of(sheetCtx).pop();
                  },
                ),
                const SizedBox(height: SpacingTokens.sm),
                _ModeChoiceTile(
                  title: isIran
                      ? 'زمان بیشتر (بدون محدودیت زمانی)'
                      : 'Extended Help (Untimed)',
                  subtitle: isIran
                      ? 'محدودیت زمانی سخت‌گیرانه را برمی‌دارد تا با آرامش پاسخ دهید.'
                      : 'Removes strict countdown limits so you can work without rush.',
                  selected: state.mode == DiagnosticMode.extended,
                  onTap: () {
                    notifier.setMode(DiagnosticMode.extended);
                    Navigator.of(sheetCtx).pop();
                  },
                ),
                const SizedBox(height: SpacingTokens.sm),
                _ModeChoiceTile(
                  title: isIran
                      ? 'حالت صوتی دسترس‌پذیر'
                      : 'Accessible Audio Mode',
                  subtitle: isIran
                      ? 'امکان پخش مجدد فایل صوتی و مشاهده متن پس از پخش را فراهم می‌کند.'
                      : 'Allows audio replay and post-audio transcript if needed.',
                  selected: state.mode == DiagnosticMode.accessible,
                  onTap: () {
                    notifier.setMode(DiagnosticMode.accessible);
                    Navigator.of(sheetCtx).pop();
                  },
                ),
                const SizedBox(height: SpacingTokens.md),
                Text(
                  isIran
                      ? 'حالت انتخاب‌شده در کنار نتیجه تعیین سطح اولیه شما نمایش داده می‌شود.'
                      : 'Your selected mode is shown alongside your starting placement.',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showPrivacySheet(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isIran = Localizations.localeOf(context).languageCode == 'fa';
    unawaited(
      showMzBottomSheet<void>(
        context: context,
        title: isIran ? 'حریم خصوصی و پردازش صدا' : 'Audio & Privacy Notice',
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(
            SpacingTokens.lg,
            SpacingTokens.md,
            SpacingTokens.lg,
            SpacingTokens.xl,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                isIran
                    ? '• تست ۳ ثانیه‌ای میکروفون فقط روی دستگاه شما اجرا می‌شود و فایل آزمایشی آن فوراً حذف می‌گردد.\n'
                          '• در مرحله اسپیکینگ، پاسخ صوتی شما به‌صورت امن برای تحلیل روانی گفتار و وضوح ارسال می‌شود.\n'
                          '• هر زمان که بخواهید می‌توانید همه داده‌های محلی را از بخش تنظیمات پاک کنید.'
                    : '• The 3-second microphone check runs locally and deletes its temporary test audio right away.\n'
                          '• During the live Speaking step, your spoken answer is uploaded securely to calculate fluency and clarity feedback.\n'
                          '• You can remove all local data anytime in Settings.',
                style: typography.body.copyWith(color: colors.textSecondary),
              ),
              const SizedBox(height: SpacingTokens.lg),
              PrimaryButton(
                label: isIran ? 'بستن' : 'Close',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CompactDoDontSummary extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isIran = Localizations.localeOf(context).languageCode == 'fa';
    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _GuidelineRow(
            glyph: LucideGlyph.check,
            iconColor: colors.success,
            text: isIran
                ? 'فقط با دانش خودتان پاسخ دهید — بدون مترجم یا هوش مصنوعی.'
                : 'Own words only — no translators or AI.',
          ),
          const SizedBox(height: SpacingTokens.xs),
          _GuidelineRow(
            glyph: LucideGlyph.shieldCheck,
            iconColor: colors.primary,
            text: isIran
                ? 'مطمئن نیستید؟ هر زمان گزینه «نمی‌دانم» را بزنید.'
                : 'Unsure? Tap "I don\'t know" anytime.',
          ),
          const SizedBox(height: SpacingTokens.xs),
          _GuidelineRow(
            glyph: LucideGlyph.headphones,
            iconColor: colors.listeningAccent,
            text: isIran
                ? 'فایل صوتی در حالت استاندارد یک‌بار پخش می‌شود.'
                : 'Audio plays once in Standard mode.',
          ),
        ],
      ),
    );
  }
}

class _GuidelineRow extends StatelessWidget {
  const new({
    required this.glyph,
    required this.iconColor,
    required this.text,
  });

  final LucideGlyph glyph;
  final Color iconColor;
  final String text;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        AppIcon(glyph, size: 16, color: iconColor),
        const SizedBox(width: SpacingTokens.sm),
        Expanded(
          child: Text(
            text,
            style: typography.caption.copyWith(color: colors.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _DeviceCheckCard extends StatelessWidget {
  const new({required this.state, required this.notifier});

  final DiagnosticState state;
  final DiagnosticNotifier notifier;

  @override
  Widget build(BuildContext context) {
    final isIran = Localizations.localeOf(context).languageCode == 'fa';
    final micHasPermission =
        state.micStatus != MicPreflightStatus.permissionDenied &&
        state.micStatus != MicPreflightStatus.unavailable;

    final soundLabel = state.isPlayingPreflightAudio
        ? (isIran ? 'در حال پخش...' : 'Playing...')
        : (state.soundConfirmed
              ? (isIran ? 'صدا آماده است' : 'Sound OK')
              : (isIran ? 'تست صدا' : 'Test sound'));
    final micLabel = state.micStatus == MicPreflightStatus.checking
        ? (isIran ? 'صحبت کنید (۳ ثانیه)...' : 'Speak (3s)...')
        : (state.micStatus == MicPreflightStatus.ready
              ? (isIran ? 'میکروفون آماده است' : 'Mic OK')
              : (state.speakingOptOut
                    ? (isIran ? 'میکروفون رد شد' : 'Mic skipped')
                    : (isIran ? 'تست میکروفون' : 'Test mic')));

    final statusBanners = <Widget>[
      if (state.preflightAudioError != null)
        StatusBanner(
          message: state.preflightAudioError!,
          actionLabel: isIran ? 'صدای پخش را می‌شنوم' : 'I can hear',
          onTapAction: notifier.confirmSoundReady,
        ),
      if (state.micStatusMessage != null &&
          state.micStatus != MicPreflightStatus.ready)
        StatusBanner(
          message: state.micStatusMessage!,
          actionLabel: !state.speakingOptOut
              ? (isIran ? 'ادامه بدون اسپیکینگ' : 'Continue without Speaking')
              : null,
          onTapAction: !state.speakingOptOut
              ? () => notifier.setSpeakingOptOut(
                  optOut: true,
                  reason: state.micStatus == MicPreflightStatus.noisyOrSilent
                      ? NoEvidenceReason.unusableAudio
                      : NoEvidenceReason.micDenied,
                )
              : null,
        ),
      if (state.speakingOptOut)
        StatusBanner(
          message: isIran
              ? 'اسپیکینگ در این ارزیابی رد می‌شود. بخش‌های ریدینگ، لیسنینگ و رایتینگ به‌صورت عادی اجرا می‌شوند.'
              : 'Speaking will be skipped in this check. Reading, Listening, and Writing still run normally.',
          variant: StatusBannerVariant.offline,
          actionLabel: isIran ? 'افزودن اسپیکینگ' : 'Include Speaking',
          onTapAction: () => notifier.setSpeakingOptOut(optOut: false),
        ),
    ];

    Widget? footer;
    if (statusBanners.isNotEmpty) {
      footer = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          for (var i = 0; i < statusBanners.length; i += 1) ...<Widget>[
            if (i > 0) const SizedBox(height: SpacingTokens.sm),
            statusBanners[i],
          ],
        ],
      );
    }

    return MicPreflightCard(
      title: isIran ? 'بررسی سریع صدا و میکروفون' : 'Quick Sound & Mic Check',
      trailingLabel: isIran ? 'اختیاری' : 'Optional',
      soundButtonLabel: soundLabel,
      soundButtonGlyph: state.soundConfirmed
          ? LucideGlyph.checkCircle2
          : LucideGlyph.volume2,
      onTapSoundCheck: state.bank == null || state.isPlayingPreflightAudio
          ? null
          : notifier.playPreflightSampleSound,
      micButtonLabel: micLabel,
      micButtonGlyph: state.micStatus == MicPreflightStatus.ready
          ? LucideGlyph.checkCircle2
          : (state.speakingOptOut ? LucideGlyph.micOff : LucideGlyph.mic),
      onTapMicCheck: state.micStatus == MicPreflightStatus.checking
          ? null
          : notifier.runMicPreflightCheck,
      showLiveMeter: state.micStatus == MicPreflightStatus.checking,
      normalizedLevel: state.micLevel,
      isPreviewing: true,
      hasPermission: micHasPermission,
      statusFooter: footer,
    );
  }
}

class _ModeChoiceTile extends StatelessWidget {
  const new({
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        decoration: BoxDecoration(
          color: selected ? colors.surfaceAlt : colors.surface,
          borderRadius: shapes.cardRadius,
          border: Border.all(
            color: selected ? colors.primary : colors.borderSubtle,
            width: shapes.strokeWidth,
          ),
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: typography.cardTitle),
                  const SizedBox(height: SpacingTokens.xs / 2),
                  Text(
                    subtitle,
                    style: typography.secondary.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            AppIcon(
              selected ? LucideGlyph.checkCircle2 : LucideGlyph.chevronRight,
              size: 20,
              color: selected ? colors.primary : colors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}
