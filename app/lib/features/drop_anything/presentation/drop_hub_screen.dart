import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mockza/core/advanced/drop_input_policy.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/result/failure.dart';
import 'package:mockza/core/result/result.dart';
import 'package:mockza/providers.dart';
import 'package:mockza/routing/routes.dart';
import 'package:mockza/services/linguistic_gateway.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/ltr_exam_boundary.dart';
import 'package:mockza/theme/components/mz_buttons.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_scaffold.dart';
import 'package:mockza/theme/primitives.dart';

/// Drop Anything composer supporting URL, Text Excerpt, Screenshot/Image & OS Share Intent (`/drop`).
class DropHubScreen extends ConsumerStatefulWidget {
  /// Creates a [DropHubScreen].
  const new({
    this.initialUrl,
    this.initialText,
    super.key,
  });

  /// Pre-populated shared URL from Android/iOS Share Sheet.
  final String? initialUrl;

  /// Pre-populated shared text excerpt from Android/iOS Share Sheet.
  final String? initialText;

  @override
  ConsumerState<DropHubScreen> createState() => _DropHubScreenState();
}

class _DropHubScreenState extends ConsumerState<DropHubScreen> {
  final TextEditingController _urlCtrl = TextEditingController();
  final TextEditingController _textCtrl = TextEditingController();
  int _modeIndex = 0; // 0 = URL, 1 = Text
  bool _submitting = false;
  String? _error;
  List<DroppedContentDto> _history = const <DroppedContentDto>[];

  @override
  void initState() {
    super.initState();
    if (widget.initialUrl != null && widget.initialUrl!.isNotEmpty) {
      _urlCtrl.text = widget.initialUrl!;
      _modeIndex = 0;
    } else if (widget.initialText != null && widget.initialText!.isNotEmpty) {
      _textCtrl.text = widget.initialText!;
      _modeIndex = 1;
    }
    unawaited(_loadHistory());
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _textCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final repo = ref.read(linguisticRepositoryProvider);
    final cached = await repo.listCachedDrops();
    if (mounted && cached.isNotEmpty) {
      setState(() => _history = cached);
    }
    final res = await ref.read(linguisticGatewayProvider).getDropHistory();
    if (!mounted) return;
    res.when(
      success: (items) => setState(() => _history = items),
      failure: (_) {},
    );
  }

  Future<void> _submit() async {
    final isRtl = ref.read(editionConfigProvider).edition == AppEdition.iran;
    final gateway = ref.read(linguisticGatewayProvider);
    final repo = ref.read(linguisticRepositoryProvider);
    setState(() => _error = null);

    final Result<String, Failure> res;
    if (_modeIndex == 0) {
      final url = _urlCtrl.text.trim();
      final check = DropInputPolicy.validateUrlPreFlight(
        url,
        allowHttpInDev: true,
      );
      if (!check.ok) {
        setState(
          () => _error = isRtl
              ? 'لینک ویدئو یا آدرس مسدود پشتیبانی نمی‌شود؛ لینک مقاله یا متن را وارد کنید.'
              : (check.reason ?? 'Blocked or unsupported URL.'),
        );
        return;
      }
      setState(() => _submitting = true);
      res = await gateway.enqueueDropIngest(
        inputKind: 'text_url',
        examTrack: 'ielts_academic',
        sourceUrl: url,
      );
    } else {
      final txt = _textCtrl.text.trim();
      final tCheck = DropInputPolicy.validateTextSnippet(txt);
      if (!tCheck.ok) {
        setState(
          () => _error = tCheck.reason ?? 'Text must be 40..15,000 chars.',
        );
        return;
      }
      setState(() => _submitting = true);
      res = await gateway.enqueueDropIngest(
        inputKind: 'text',
        examTrack: 'ielts_academic',
        rawText: txt,
      );
    }

    if (!mounted) return;
    if (res.isFailure) {
      setState(() {
        _submitting = false;
        _error = res.failureOrNull?.message ?? 'Drop failed.';
      });
      return;
    }

    final jobId = res.valueOrNull ?? '';
    for (var i = 0; i < 16 && mounted; i++) {
      final poll = await gateway.pollAdvancedJob(jobId);
      final snap = poll.valueOrNull;
      if (snap != null &&
          snap.status == 'completed' &&
          snap.advancedResult != null) {
        final dto = DroppedContentDto.fromJson(snap.advancedResult!);
        await repo.cacheDroppedContent(dto);
        if (!mounted) return;
        setState(() => _submitting = false);
        unawaited(context.push(AppRoutes.buildDropDrill(dto.dropId)));
        return;
      }
      if (snap != null && snap.status == 'failed') {
        setState(() {
          _submitting = false;
          _error = isRtl
              ? 'این لینک در دسترس نبود؛ متن را پیست کنید.'
              : 'Extraction failed; paste text excerpt instead.';
        });
        return;
      }
      await Future<void>.delayed(const Duration(microseconds: 400000));
    }
    if (mounted) setState(() => _submitting = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);
    final isRtl = ref.watch(editionConfigProvider).edition == AppEdition.iran;

    return MzScaffold(
      appBar: AppBar(
        title: Text(
          isRtl ? 'ورود هر محتوایی (Drop Anything)' : 'Drop Anything',
        ),
      ),
      body: ListView(
        padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
        children: <Widget>[
          MzCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Wrap(
                  spacing: SpacingTokens.xs,
                  children: <Widget>[
                    ChoiceChip(
                      key: const ValueKey<String>('drop_mode_url'),
                      label: Text(isRtl ? 'لینک مقاله' : 'Article URL'),
                      selected: _modeIndex == 0,
                      onSelected: (_) => setState(() {
                        _modeIndex = 0;
                        _error = null;
                      }),
                    ),
                    ChoiceChip(
                      key: const ValueKey<String>('drop_mode_text'),
                      label: Text(isRtl ? 'چسباندن متن' : 'Paste Text'),
                      selected: _modeIndex == 1,
                      onSelected: (_) => setState(() {
                        _modeIndex = 1;
                        _error = null;
                      }),
                    ),
                  ],
                ),
                const SizedBox(height: SpacingTokens.md),
                LtrExamBoundary(
                  child: _modeIndex == 0
                      ? TextField(
                          key: const ValueKey<String>('drop_url_field'),
                          controller: _urlCtrl,
                          decoration: const InputDecoration(
                            hintText: 'https://example.com/article',
                            border: OutlineInputBorder(),
                          ),
                        )
                      : TextField(
                          key: const ValueKey<String>('drop_text_field'),
                          controller: _textCtrl,
                          maxLines: 5,
                          decoration: const InputDecoration(
                            hintText: 'Paste English article, book quote, or podcast transcript (40..15,000 chars)...',
                            border: OutlineInputBorder(),
                          ),
                        ),
                ),
                if (_error != null) ...<Widget>[
                  const SizedBox(height: SpacingTokens.sm),
                  Text(
                    _error!,
                    key: const ValueKey<String>('drop_error_text'),
                    style: typography.caption.copyWith(color: colors.error),
                  ),
                ],
                const SizedBox(height: SpacingTokens.md),
                PrimaryButton(
                  key: const ValueKey<String>('drop_submit_btn'),
                  label: isRtl
                      ? 'ساخت میکرودریل ۲ دقیقه‌ای'
                      : 'Build 2-Min Micro-Drill',
                  glyph: LucideGlyph.sparkles,
                  isLoading: _submitting,
                  onPressed: _submitting ? null : _submit,
                ),
              ],
            ),
          ),
          if (_history.isNotEmpty) ...<Widget>[
            const SizedBox(height: SpacingTokens.lg),
            Text(
              isRtl ? 'محتوای ارسالی اخیر' : 'Recent Drops',
              style: typography.cardTitle.copyWith(color: colors.textPrimary),
            ),
            const SizedBox(height: SpacingTokens.sm),
            ..._history.map(
              (item) => Padding(
                padding: const EdgeInsetsDirectional.only(
                  bottom: SpacingTokens.sm,
                ),
                child: MzCard(
                  onTap: () =>
                      context.push(AppRoutes.buildDropDrill(item.dropId)),
                  child: Row(
                    children: <Widget>[
                      Expanded(
                        child: LtrExamBoundary(
                          child: Text(
                            item.title,
                            style: typography.body.copyWith(
                              color: colors.textPrimary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                      Text(
                        item.cefrEstimate,
                        style: typography.caption.copyWith(
                          color: colors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
