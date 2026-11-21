import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockza/core/config/edition_config.dart';
import 'package:mockza/core/vocab/serial_day.dart';
import 'package:mockza/services/native/share_intent_bridge.dart';

import 'harness/e2e_app_harness.dart';

void _attachClosedLoopApiMock(E2eAppHarness harness, {required bool isRtl}) {
  final day = SerialDay.fromUtcDateTime(harness.clock.current.toUtc()).value;
  var missionStatus = 'ready';
  final drops = <Map<String, Object?>>[];

  final dropItem = <String, Object?>{
    'dropId': 'drop-e2e-1',
    'inputKind': 'text',
    'sourceDomainOrLabel': 'Paste Snippet',
    'title': 'Why Tactical Pressing Wins Matches',
    'cefrEstimate': 'C1',
    'extractedPhrases': <Map<String, Object?>>[
      <String, Object?>{
        'headword': 'albeit',
        'ipa': '/ɔːlˈbiː.ɪt/',
        'definitionEn': 'Although; even though.',
        if (isRtl) 'glossFa': 'هرچند؛ با وجود اینکه',
        'exampleSentence':
            'The midfield pressed aggressively, albeit at high physical cost.',
      },
    ],
    'drillPayload': <String, Object?>{
      'comprehensionPrompt': 'What was the cost of pressing high?',
      'comprehensionOptions': <String>[
        'Significant physical fatigue in late minutes',
        'Lower stadium ticket sales',
      ],
      'correctOptionIndex': 0,
      'clozeSentence': 'They kept possession, ___ slowly.',
      'clozeAnswer': 'albeit',
      'shadowingPrompt':
          'The midfield pressed aggressively, albeit at high physical cost.',
    },
    'createdAt': '2026-11-21T12:00:00Z',
  };

  final shifterResult = <String, Object?>{
    'runId': 'shift-e2e-1',
    'examTrack': 'ielts_academic',
    'sourceTranscript': 'This movie was really good and had cool tech scenes.',
    'gears': <String, Object?>{
      'casual': 'This movie was really good and had cool tech scenes.',
      'workplace': 'The film delivered strong pacing and compelling technical sequences.',
      'academic': 'The cinema piece achieved remarkable narrative cohesion, albeit through demanding visual effects.',
    },
    'shiftHighlights': <Map<String, Object?>>[
      <String, Object?>{
        'casualPhrase': 'really good',
        'upgradedPhrase': 'remarkable narrative cohesion',
        'targetGear': 'academic',
        'whyEn': 'Replaces generic adjective "good" with precise Band 8.5 lexical collocation.',
        if (isRtl)
          'whyFa':
              'جایگزینی صفت کلی good با ترکیب آکادمیک دقیق‌تر برای نمره ۸.۵.',
      },
    ],
    'repeatAloudTarget': <String, Object?>{
      'targetSentence': 'The cinema piece achieved remarkable narrative cohesion, albeit through demanding visual effects.',
      'targetPhrases': <String>['remarkable narrative cohesion', 'albeit'],
    },
  };

  harness.dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) {
        final path = options.path;
        if (options.method == 'PUT') {
          return handler.resolve(
            Response<void>(requestOptions: options, statusCode: 200),
          );
        }
        if (path == '/v1/quota/me') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'advancedQuota': <String, Object?>{
                  'isPro': true,
                  'freeSampleUsed': false,
                  'shifterRemainingToday': 9,
                  'dropsRemainingToday': 9,
                  'audioDropAllowed': true,
                  'monthlyRemaining': 149,
                },
              },
            ),
          );
        }
        if (path == '/v1/missions/today') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'missionId': 'mission-e2e-1',
                'edition': isRtl ? 'irn' : 'glb',
                'examTrack': 'ielts_academic',
                'missionDaySerial': day,
                'status': missionStatus,
                'focusTopic': isRtl ? 'Football & AI' : 'Football & AI',
                'payload': <String, Object?>{
                  'promptTitle': 'Tactical AI & Football Transfer',
                  'promptTextEn': 'Explain whether tactical AI models improve match strategy.',
                  if (isRtl)
                    'promptTextFa':
                        'درباره نقش هوش مصنوعی در تاکتیک فوتبال بنویسید.',
                  'forcedTargets': <Map<String, Object?>>[
                    <String, Object?>{
                      'canonicalKey': 'grammar:conditionals',
                      'phraseEn': 'had managers relied',
                      'hintEn': 'Inverted third conditional clause.',
                      if (isRtl) 'hintFa': 'جمله شرطی وارونه نوع سوم.',
                    },
                    <String, Object?>{
                      'canonicalKey': 'vocab:albeit',
                      'phraseEn': 'albeit',
                      'hintEn': 'Concessive linker for Band 8 cohesion.',
                      if (isRtl) 'hintFa': 'ربط‌دهنده تضاد برای نمره ۸.',
                    },
                  ],
                },
                if (missionStatus == 'completed')
                  'evaluationResult': <String, Object?>{
                    'feedbackEn': 'Mission passed! Both structures verified.',
                    if (isRtl)
                      'feedbackFa': 'مأموریت ثبت شد! هر دو ساختار استفاده شد.',
                    'matchedTargets': <String>['had managers relied', 'albeit'],
                  },
              },
            ),
          );
        }
        if (path == '/v1/missions/mission-e2e-1/complete') {
          missionStatus = 'completed';
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'missionId': 'mission-e2e-1',
                'edition': isRtl ? 'irn' : 'glb',
                'examTrack': 'ielts_academic',
                'missionDaySerial': day,
                'status': 'completed',
                'focusTopic': 'Football & AI',
                'payload': <String, Object?>{
                  'promptTitle': 'Tactical AI & Football Transfer',
                  'promptTextEn': 'Explain whether tactical AI models improve match strategy.',
                  'forcedTargets': const <Object?>[],
                },
                'evaluationResult': <String, Object?>{
                  'feedbackEn': 'Mission passed! Both structures verified.',
                  if (isRtl)
                    'feedbackFa': 'مأموریت ثبت شد! هر دو ساختار استفاده شد.',
                  'matchedTargets': <String>['had managers relied', 'albeit'],
                },
              },
            ),
          );
        }
        if (path == '/v1/graph/me' || path == '/v1/graph/interests') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'bottlenecks': <Map<String, Object?>>[
                  <String, Object?>{
                    'nodeId': 'node-b-e2e',
                    'edition': isRtl ? 'irn' : 'glb',
                    'nodeKind': 'bottleneck',
                    'canonicalKey': 'vocab:overuse_good',
                    'displayLabelEn': 'Overuses generic "good/bad"',
                    if (isRtl)
                      'displayLabelFa': 'استفاده بیش‌ازحد از good و bad',
                    'masteryScoreMilli': 350,
                    'signalWeightMilli': 880,
                    'evidenceCount': 4,
                    'lastSeenDaySerial': day,
                  },
                ],
                'targetStructures': <Map<String, Object?>>[
                  <String, Object?>{
                    'nodeId': 'node-t-e2e',
                    'edition': isRtl ? 'irn' : 'glb',
                    'nodeKind': 'target_structure',
                    'canonicalKey': 'vocab:albeit',
                    'displayLabelEn': 'albeit',
                    'masteryScoreMilli': 810,
                    'signalWeightMilli': 600,
                    'evidenceCount': 2,
                    'lastSeenDaySerial': day,
                  },
                ],
                'interestTopics': <Map<String, Object?>>[
                  <String, Object?>{
                    'nodeId': 'node-i-e2e',
                    'edition': isRtl ? 'irn' : 'glb',
                    'nodeKind': 'interest_topic',
                    'canonicalKey': 'topic:football',
                    'displayLabelEn': 'Football',
                    if (isRtl) 'displayLabelFa': 'فوتبال',
                    'masteryScoreMilli': 600,
                    'signalWeightMilli': 750,
                    'evidenceCount': 5,
                    'lastSeenDaySerial': day,
                    'isPinned': true,
                  },
                ],
                'totalEvidenceCount': 11,
              },
            ),
          );
        }
        if (path == '/v1/register-shifter/shift') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 202,
              data: <String, Object?>{'jobId': 'job-shift-e2e'},
            ),
          );
        }
        if (path == '/v1/register-shifter/shift-e2e-1/verify-repeat') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'fluencyScore1To5': 5,
                'matchedTargets': <String>[
                  'remarkable narrative cohesion',
                  'albeit',
                ],
              },
            ),
          );
        }
        if (path == '/v1/drop/ingest') {
          drops
            ..clear()
            ..add(dropItem);
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 202,
              data: <String, Object?>{'jobId': 'job-drop-e2e'},
            ),
          );
        }
        if (path == '/v1/drop/history') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{'items': drops},
            ),
          );
        }
        if (path == '/v1/drop/drop-e2e-1') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: dropItem,
            ),
          );
        }
        if (path == '/v1/jobs/job-shift-e2e') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'status': 'completed',
                'advancedResult': shifterResult,
              },
            ),
          );
        }
        if (path == '/v1/jobs/job-drop-e2e') {
          return handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'status': 'completed',
                'advancedResult': dropItem,
              },
            ),
          );
        }
        return handler.next(options);
      },
    ),
  );
}

void main() {
  testWidgets(
    'E2E 8 (GLB): Mission -> Graph -> Register Shifter 3-Gear + SM-2 -> Drop Anything YouTube reject & Text Drill',
    (tester) async {
      final harness = E2eAppHarness.create();
      addTearDown(() => harness.dispose(tester));
      _attachClosedLoopApiMock(harness, isRtl: false);
      await harness.completeOnboardingSeed(tester);

      await harness.mountApp(tester, surfaceSize: const Size(412, 915));

      // 1. Home renders MissionProgressCard (Today's 10-Min Coach) and opens Daily Mission.
      await harness.scrollToAndTap(
        tester,
        find.text('Start 10-Min Session'),
      );
      expect(find.text("Today's 10-Min Coach"), findsOneWidget);
      expect(find.text('Tactical AI & Football Transfer'), findsOneWidget);

      await tester.enterText(
        find.byKey(const ValueKey<String>('mission_response_field')),
        'Had managers relied on pressing earlier, they would have controlled tempo, albeit at higher fatigue.',
      );
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('mission_complete_btn')),
      );
      expect(
        find.byKey(const ValueKey<String>('mission_completed_card')),
        findsOneWidget,
      );

      // 2. Navigate to My Weak Spots from Daily Mission AppBar.
      await tester.tap(find.byTooltip('My Weak Spots'));
      await harness.pumpFrames(tester);
      expect(
        find.textContaining('Overuses generic "good/bad"'),
        findsOneWidget,
      );

      // Return to Home via back navigation.
      await tester.pageBack();
      await harness.pumpFrames(tester);
      await tester.pageBack();
      await harness.pumpFrames(tester);

      // 3. Open Upgrade My Speaking from Home, record, stop, inspect gears & verify repeat.
      await harness.scrollToAndTap(tester, find.text('Upgrade Speaking'));
      await tester.tap(
        find.byKey(const ValueKey<String>('shifter_record_btn')),
      );
      await harness.pumpFrames(tester);
      await tester.tap(
        find.byKey(const ValueKey<String>('shifter_record_btn')),
      );
      await harness.pumpFrames(tester, count: 6);

      expect(
        find.text(
          'The cinema piece achieved remarkable narrative cohesion, albeit through demanding visual effects.',
        ),
        findsOneWidget,
      );

      await harness.scrollToAndTap(tester, find.text('Everyday · Casual'));
      expect(
        find.text('This movie was really good and had cool tech scenes.'),
        findsOneWidget,
      );

      await harness.scrollToAndTap(
        tester,
        find.text('Save to Vocab Deck').first,
      );
      expect(find.text('Saved to Vocab Deck'), findsOneWidget);

      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('shifter_verify_repeat_btn')),
      );
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('shifter_verify_repeat_btn')),
      );
      expect(
        find.byKey(const ValueKey<String>('shifter_repeat_result')),
        findsOneWidget,
      );

      await tester.pageBack();
      await harness.pumpFrames(tester);

      // 4. Open Learn From Anything, test blocked YouTube URL preflight, then submit text snippet.
      await harness.scrollToAndTap(tester, find.text('Learn From Anything'));
      await tester.enterText(
        find.byKey(const ValueKey<String>('drop_url_field')),
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
      );
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('drop_submit_btn')),
      );
      expect(
        find.byKey(const ValueKey<String>('drop_error_text')),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const ValueKey<String>('drop_mode_text')));
      await harness.pumpFrames(tester);
      await tester.enterText(
        find.byKey(const ValueKey<String>('drop_text_field')),
        'The midfield pressed aggressively throughout the second half, albeit at considerable physical cost.',
      );
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('drop_submit_btn')),
      );
      await harness.pumpFrames(tester, count: 6);

      // Lands on 2-Min Micro-Drill screen with LtrExamBoundary, 1-tap Vocab Deck capture, MCQ & Cloze recall.
      expect(find.text('Why Tactical Pressing Wins Matches'), findsOneWidget);
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('save_drop_albeit')),
      );
      expect(find.text('Saved to Vocab Deck'), findsOneWidget);
      await harness.scrollToAndTap(
        tester,
        find.text('Significant physical fatigue in late minutes'),
      );
      expect(
        find.byKey(const ValueKey<String>('drop_mcq_feedback')),
        findsOneWidget,
      );
      await tester.enterText(
        find.byKey(const ValueKey<String>('drop_cloze_field')),
        'albeit',
      );
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('drop_cloze_check_btn')),
      );
      expect(
        find.byKey(const ValueKey<String>('drop_cloze_feedback')),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'E2E 8-IRN (Sanjia RTL): Persian coaching Chrome + LtrExamBoundary + ShareIntentBridge event emission',
    (tester) async {
      final harness = E2eAppHarness.create(
        editionConfig: EditionConfig.iranDefault,
      );
      addTearDown(() => harness.dispose(tester));
      _attachClosedLoopApiMock(harness, isRtl: true);
      await harness.completeOnboardingSeed(tester);

      await harness.mountApp(tester, surfaceSize: const Size(430, 900));

      expect(find.text('مربی ۱۰ دقیقه‌ای امروز'), findsOneWidget);
      await harness.scrollToAndTap(
        tester,
        find.text('شروع تمرین ۱۰ دقیقه‌ای'),
      );
      expect(find.text('مربی ۱۰ دقیقه‌ای امروز'), findsOneWidget);
      expect(
        Directionality.of(
          tester.element(
            find.text(
              'Explain whether tactical AI models improve match strategy.',
            ),
          ),
        ),
        TextDirection.ltr,
      );

      // Verify ShareIntentBridge synthetic OS share emission delivers URL/text payloads cleanly.
      final bridge = ShareIntentBridge();
      addTearDown(bridge.dispose);
      final received = <InboundSharePayload>[];
      final sub = bridge.incomingShares.listen(received.add);
      addTearDown(sub.cancel);

      bridge.emitSyntheticShare(
        const InboundSharePayload(
          kind: 'url',
          textOrUrl: 'https://arxiv.org/abs/2501.00001',
        ),
      );
      await tester.pump();
      expect(received, hasLength(1));
      expect(received.single.kind, 'url');
      expect(received.single.textOrUrl, 'https://arxiv.org/abs/2501.00001');
    },
  );

  testWidgets(
    'E2E 9: Onboarding Exams vs Smart Coach screening prioritizes Home and opens dedicated Coach tab',
    (tester) async {
      final harness = E2eAppHarness.create();
      addTearDown(() => harness.dispose(tester));
      _attachClosedLoopApiMock(harness, isRtl: false);

      await harness.mountApp(tester, surfaceSize: const Size(412, 915));

      // Step 0: Advance from Welcome to Goal Setup & Screening.
      await harness.scrollToAndTap(tester, find.text('Continue'));

      // Step 1: Select Smart Coach focus card + 1-tap topic chip and complete onboarding.
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('onboarding_focus_coach')),
      );
      await harness.scrollToAndTap(
        tester,
        find.byKey(const ValueKey<String>('onboarding_topic_technology_ai')),
      );
      await harness.scrollToAndTap(tester, find.text('Get Started'));
      await harness.pumpFrames(tester, count: 6);

      // Launches directly into Today's 10-Min Coach, with CoachHubScreen + NavigationBar on back.
      expect(
        find.byKey(const ValueKey<String>('mission_response_field')),
        findsOneWidget,
      );
      await tester.pageBack();
      await harness.pumpFrames(tester, count: 6);
      expect(
        find.byKey(const ValueKey<String>('coach_start_daily_btn')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('coach_upgrade_speaking_tile')),
        findsOneWidget,
      );
      harness.expectNoOverflow(tester);
    },
  );
}
