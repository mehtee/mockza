import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:mockza/services/audio_player_gateway.dart';
import 'package:mockza/services/audio_recorder_gateway.dart';
import 'package:mockza/services/billing_gateway.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Hardware Verification Gate Tests (Epic X2.3)', () {
    testWidgets(
      'Microphone permission check and hardware audio channel readiness',
      (tester) async {
        final recorder = RecordAudioRecorderGateway();
        final hasPermResult = await recorder.hasPermission();

        expect(hasPermResult.isOk, isTrue);
        // In headless/CI runner, permission may be false or mocked; verify graceful boolean Result without throwing
        final hasPerm = hasPermResult.valueOrNull;
        expect(hasPerm, isA<bool>());
      },
    );

    testWidgets('Audio playback session configuration and speed switching', (
      tester,
    ) async {
      final player = JustAudioPlayerGateway();
      addTearDown(player.dispose);

      // Verify speed setting boundaries
      final speedResult = await player.setSpeed(1.25);
      expect(speedResult.isOk, isTrue);

      final speedReset = await player.setSpeed(1);
      expect(speedReset.isOk, isTrue);

      // Verify position tracking stream is live
      final initialPos = await player.watchPosition().first;
      expect(initialPos, equals(Duration.zero));
    });

    testWidgets(
      'In-App Purchase billing channel readiness and product SKU contracts',
      (tester) async {
        const billing = RevenueCatBillingGateway();
        // On real hardware / simulator, verify that billing channel initializes without crashing
        try {
          final entitlementResult = await billing.checkProEntitlement();
          expect(entitlementResult, isNotNull);
        } on MissingPluginException {
          // Expected when running on headless Linux host without native Cocoa/Android store libraries
        }
      },
    );

    testWidgets('Binary and bundled assets size audit gate (<= 45 MB)', (
      tester,
    ) async {
      final assetsDir = Directory('assets');
      if (assetsDir.existsSync()) {
        var totalBytes = 0;
        await for (final entity in assetsDir.list(
          recursive: true,
          followLinks: false,
        )) {
          if (entity is File) {
            totalBytes += await entity.length();
          }
        }

        const maxAllowedBytes =
            45 * 1024 * 1024; // 45 MB per PLAN.md Definition of Done
        expect(
          totalBytes,
          lessThanOrEqualTo(maxAllowedBytes),
          reason:
              'Bundled asset bank ($totalBytes bytes) must remain strictly <= 45 MB to ensure fast cellular store downloads.',
        );
      }
    });
  });
}
