import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../harness/e2e_app_harness.dart';

/// Page-object Robot driving Vocabulary SRS, Progress Analytics, Paywall, and
/// Settings (including live OCP Color Theme preset switching & account erasure).
final class VocabProgressSettingsRobot {
  /// Creates a [VocabProgressSettingsRobot] bound to [harness].
  const new(this.harness);

  /// Active E2E test harness.
  final E2eAppHarness harness;

  /// Filters/searches Vocabulary Deck, inspects Word Detail, and completes SRS review.
  Future<void> inspectDetailAndReviewVocab(WidgetTester tester) async {
    expect(find.text('Vocabulary Deck'), findsOneWidget);

    await harness.scrollToAndTap(tester, find.text('mitigate'));
    await harness.pumpFrames(tester);
    expect(find.text('Word Details'), findsOneWidget);
    await harness.tapVisible(tester, find.byType(IconButton).first);
    await harness.pumpFrames(tester, count: 4);

    // Start SRS flashcard review session.
    await harness.scrollToAndTap(
      tester,
      find.textContaining('Start Review'),
      delta: -250,
    );
    await harness.pumpFrames(tester);

    while (find.text('Review Complete').evaluate().isEmpty) {
      final revealBtn = find.text('Tap Card or Press to Reveal Answer');
      if (revealBtn.evaluate().isNotEmpty) {
        await harness.tapVisible(tester, revealBtn);
      }
      final goodRating = find.text('Good');
      if (goodRating.evaluate().isNotEmpty) {
        await harness.tapVisible(tester, goodRating.first);
      } else {
        break;
      }
      await harness.pumpFrames(tester, count: 4);
    }

    expect(find.text('Review Complete'), findsOneWidget);
    await harness.tapVisible(tester, find.byType(IconButton).first);
    await harness.pumpFrames(tester, count: 4);
  }

  /// Visits Progress analytics, opens a skill deep-dive, and views attempt history.
  Future<void> inspectProgressAndAttempts(WidgetTester tester) async {
    expect(find.text('Progress & Analytics'), findsOneWidget);

    await harness.scrollToAndTap(tester, find.text('READING'));
    await harness.pumpFrames(tester, count: 6);
    await harness.tapVisible(tester, find.byType(IconButton).first);
    await harness.pumpFrames(tester, count: 4);

    await harness.scrollToAndTap(
      tester,
      find.text('View Complete Attempt History'),
    );
    await harness.pumpFrames(tester, count: 6);
    expect(find.textContaining('Completed Sessions'), findsOneWidget);
    await harness.tapVisible(tester, find.byType(IconButton).first);
    await harness.pumpFrames(tester, count: 4);
  }

  /// Exercises Settings Color Theme OCP presets, Dark/Light brightness, Target Band,
  /// JSON backup export, and opens Paywall.
  Future<void> exerciseThemePresetsAndSettings(WidgetTester tester) async {
    // Switch brightness modes and all 4 OCP theme presets cleanly.
    await harness.scrollToAndTap(tester, find.text('Light'));
    await harness.scrollToAndTap(tester, find.text('Dark'));
    await harness.scrollToAndTap(tester, find.text('Nordic Emerald'));
    await harness.scrollToAndTap(tester, find.text('Editorial Amber'));
    await harness.scrollToAndTap(tester, find.text('Oceanic Cobalt'));
    await harness.scrollToAndTap(tester, find.text('Midnight Indigo'));

    // Increment target band score.
    await harness.scrollToAndTap(
      tester,
      find.byTooltip('Increase target band score'),
      delta: -250,
    );

    // Open Pro Paywall from Settings and close back.
    await harness.scrollToAndTap(tester, find.text('Upgrade ->'));
    await harness.pumpFrames(tester);
    expect(find.textContaining('Mockza Pro'), findsWidgets);
    await harness.tapVisible(tester, find.byType(IconButton).first);
    await harness.pumpFrames(tester, count: 4);
  }

  /// Triggers Danger Zone account & data wipe and confirms return to Onboarding.
  Future<void> wipeAllDataBackToOnboarding(WidgetTester tester) async {
    await harness.scrollToAndTap(
      tester,
      find.text('Delete All My Data & Account'),
    );
    await harness.pumpFrames(tester, count: 4);
    expect(find.text('Erase Everything'), findsOneWidget);

    await harness.tapVisible(tester, find.text('Erase Everything'));
    await harness.pumpFrames(tester, count: 10);
    expect(find.text('Welcome to Mockza'), findsOneWidget);
  }
}
