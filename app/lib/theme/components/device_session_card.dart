import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mockza/core/auth/auth_models.dart';
import 'package:mockza/theme/app_colors.dart';
import 'package:mockza/theme/app_icons.dart';
import 'package:mockza/theme/app_shapes.dart';
import 'package:mockza/theme/app_typography.dart';
import 'package:mockza/theme/components/mz_card.dart';
import 'package:mockza/theme/components/mz_chip.dart';
import 'package:mockza/theme/components/mz_toast.dart';
import 'package:mockza/theme/primitives.dart';

/// Visual 1-Phone + 1-Desktop-Web slot capacity indicator strip.
class DeviceSlotCapacityStrip extends StatelessWidget {
  /// Creates a [DeviceSlotCapacityStrip].
  const new({
    required this.mobileOccupied,
    required this.desktopWebOccupied,
    super.key,
  });

  /// Whether the single mobile phone slot is signed in.
  final bool mobileOccupied;

  /// Whether the single desktop web browser slot is signed in.
  final bool desktopWebOccupied;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: <Widget>[
        Expanded(
          child: _SlotPill(
            glyph: LucideGlyph.smartphone,
            title: 'Mobile Phone',
            status: mobileOccupied ? '1 / 1 Active' : '0 / 1 Open',
            occupied: mobileOccupied,
          ),
        ),
        const SizedBox(width: SpacingTokens.sm),
        Expanded(
          child: _SlotPill(
            glyph: LucideGlyph.monitor,
            title: 'Desktop Web',
            status: desktopWebOccupied ? '1 / 1 Active' : '0 / 1 Open',
            occupied: desktopWebOccupied,
          ),
        ),
      ],
    );
  }
}

class _SlotPill extends StatelessWidget {
  const new({
    required this.glyph,
    required this.title,
    required this.status,
    required this.occupied,
  });

  final LucideGlyph glyph;
  final String title;
  final String status;
  final bool occupied;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
      decoration: BoxDecoration(
        color: occupied ? colors.surfaceAlt : colors.bgRaised,
        borderRadius: shapes.controlRadius,
        border: Border.all(
          color: occupied ? colors.primary : colors.borderSubtle,
          width: shapes.strokeWidth,
        ),
      ),
      child: Row(
        children: <Widget>[
          AppIcon(
            glyph,
            size: 18,
            color: occupied ? colors.primary : colors.textTertiary,
          ),
          const SizedBox(width: SpacingTokens.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: typography.caption.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  status,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: typography.caption.copyWith(
                    color: occupied ? colors.primary : colors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Gemini / ChatGPT-style row displaying a signed-in device's name, location,
/// surface/method badges, copyable ID, and remote Terminate / Sign Out action.
class DeviceSessionTile extends StatelessWidget {
  /// Creates a [DeviceSessionTile].
  const new({
    required this.session,
    required this.isBusy,
    required this.onTerminate,
    super.key,
  });

  /// Server session record.
  final DeviceSessionInfo session;

  /// Disables action buttons while a termination request is running.
  final bool isBusy;

  /// Callback triggered when tapping `Terminate` or `Sign Out`.
  final VoidCallback onTerminate;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);
    final isWeb = session.slotKind == DeviceSlotKind.desktopWeb;

    return Container(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      decoration: BoxDecoration(
        color: session.isCurrentDevice ? colors.surfaceAlt : colors.bgRaised,
        borderRadius: shapes.controlRadius,
        border: Border.all(
          color: session.isCurrentDevice ? colors.primary : colors.borderSubtle,
          width: session.isCurrentDevice ? 1.5 : shapes.strokeWidth,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: shapes.controlRadius,
                ),
                child: AppIcon(
                  isWeb ? LucideGlyph.monitor : LucideGlyph.smartphone,
                  size: 20,
                  color: session.isCurrentDevice
                      ? colors.primary
                      : colors.textSecondary,
                ),
              ),
              const SizedBox(width: SpacingTokens.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Wrap(
                      spacing: SpacingTokens.xs,
                      runSpacing: SpacingTokens.xs,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: <Widget>[
                        Text(
                          session.deviceName,
                          style: typography.body.copyWith(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (session.isCurrentDevice)
                          const MzChip(label: 'THIS DEVICE', isSelected: true),
                        MzChip(label: session.authMethod.displayLabel),
                      ],
                    ),
                    const SizedBox(height: SpacingTokens.xs),
                    Row(
                      children: <Widget>[
                        AppIcon(
                          LucideGlyph.globe,
                          size: 13,
                          color: colors.textSecondary,
                        ),
                        const SizedBox(width: SpacingTokens.xs),
                        Expanded(
                          child: Text(
                            session.ipMasked != null &&
                                    session.ipMasked!.isNotEmpty
                                ? '${session.locationLabel} · ${session.ipMasked}'
                                : session.locationLabel,
                            style: typography.caption.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.sm),
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: SpacingTokens.sm,
            runSpacing: SpacingTokens.xs,
            children: <Widget>[
              InkWell(
                borderRadius: shapes.pillRadius,
                onTap: () async {
                  await Clipboard.setData(
                    ClipboardData(text: session.deviceId),
                  );
                  if (context.mounted) {
                    showMzToast(
                      context,
                      message: 'Device ID ${session.deviceIdShort} copied.',
                    );
                  }
                },
                child: Padding(
                  padding: const EdgeInsetsDirectional.symmetric(
                    vertical: SpacingTokens.xs,
                  ),
                  child: Text(
                    'ID: ${session.deviceIdShort} · ${session.slotKind.displayLabel}',
                    style: typography.caption.copyWith(
                      color: colors.textTertiary,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
              ),
              TextButton.icon(
                onPressed: isBusy ? null : onTerminate,
                style: TextButton.styleFrom(
                  foregroundColor: session.isCurrentDevice
                      ? colors.textPrimary
                      : colors.error,
                ),
                icon: AppIcon(
                  LucideGlyph.logOut,
                  size: 15,
                  color: session.isCurrentDevice
                      ? colors.textPrimary
                      : colors.error,
                ),
                label: Text(
                  session.isCurrentDevice ? 'Sign Out' : 'Terminate',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// High-clarity conflict card rendered when sign-in hits the strict `1 Phone + 1 Desktop Web` cap.
class DeviceSlotConflictBanner extends StatelessWidget {
  /// Creates a [DeviceSlotConflictBanner].
  const new({
    required this.message,
    this.conflict,
    super.key,
  });

  /// Human-readable server conflict explanation.
  final String message;

  /// Structured details of the currently signed-in occupying device, if provided.
  final OccupyingDeviceConflict? conflict;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final shapes = AppShapes.of(context);
    final typography = AppTypography.of(context);

    return Container(
      padding: const EdgeInsetsDirectional.all(SpacingTokens.md),
      decoration: BoxDecoration(
        color: colors.dangerBg,
        borderRadius: shapes.controlRadius,
        border: Border.all(color: colors.error),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              AppIcon(
                LucideGlyph.alertTriangle,
                size: 18,
                color: colors.error,
              ),
              const SizedBox(width: SpacingTokens.xs),
              Expanded(
                child: Text(
                  conflict != null
                      ? '${conflict!.slotKind.displayLabel} Slot In Use'
                      : 'Device Limit Reached',
                  style: typography.cardTitle.copyWith(color: colors.error),
                ),
              ),
            ],
          ),
          const SizedBox(height: SpacingTokens.xs),
          Text(
            message,
            style: typography.caption.copyWith(color: colors.textPrimary),
          ),
          if (conflict != null) ...<Widget>[
            const SizedBox(height: SpacingTokens.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsetsDirectional.all(SpacingTokens.sm),
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: shapes.controlRadius,
                border: Border.all(color: colors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    'Active device: ${conflict!.deviceName}',
                    style: typography.caption.copyWith(
                      color: colors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    'Location: ${conflict!.locationLabel} · ID: ${conflict!.deviceIdShort}',
                    style: typography.caption.copyWith(
                      color: colors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: SpacingTokens.xs),
            Text(
              'Open Settings -> Signed-In Devices on your other active device (or terminate that session there) to sign in here.',
              style: typography.caption.copyWith(color: colors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}

/// Shared strict ToS device policy disclosure card used on Auth and Paywall screens.
class DevicePolicyNoticeCard extends StatelessWidget {
  /// Creates a [DevicePolicyNoticeCard].
  const new({
    this.title = 'Strict Single-User Device Policy',
    super.key,
  });

  /// Header text.
  final String title;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final typography = AppTypography.of(context);

    return MzCard(
      variant: MzCardVariant.surfaceAlt,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          AppIcon(LucideGlyph.shieldCheck, size: 18, color: colors.primary),
          const SizedBox(width: SpacingTokens.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  title,
                  style: typography.caption.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: SpacingTokens.xs),
                Text(
                  'Each Mockza Pro account allows at most 1 active Mobile Phone and 1 active Desktop Web browser at a time. Account sharing is prohibited under Terms of Service. You can sign out or terminate devices anytime in Settings.',
                  style: typography.caption.copyWith(
                    color: colors.textSecondary,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
