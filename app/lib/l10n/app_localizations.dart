import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_fa.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('fa'),
  ];

  /// No description provided for @homeResumeAttempt.
  ///
  /// In en, this message translates to:
  /// **'Resume attempt'**
  String get homeResumeAttempt;

  /// No description provided for @homeResumeDescription.
  ///
  /// In en, this message translates to:
  /// **'Your saved work is ready to pick up.'**
  String get homeResumeDescription;

  /// No description provided for @homeCheckLevel.
  ///
  /// In en, this message translates to:
  /// **'Check my level'**
  String get homeCheckLevel;

  /// No description provided for @homeLevelCheckDescription.
  ///
  /// In en, this message translates to:
  /// **'Find what to practise next with a short assessment.'**
  String get homeLevelCheckDescription;

  /// No description provided for @homePractiseSkill.
  ///
  /// In en, this message translates to:
  /// **'Practise a skill'**
  String get homePractiseSkill;

  /// No description provided for @homeStudyRoom.
  ///
  /// In en, this message translates to:
  /// **'Your study room'**
  String get homeStudyRoom;

  /// No description provided for @homeStudyRoomDescription.
  ///
  /// In en, this message translates to:
  /// **'Pick up where you left off or choose your next practice.'**
  String get homeStudyRoomDescription;

  /// No description provided for @studyStart.
  ///
  /// In en, this message translates to:
  /// **'Start'**
  String get studyStart;

  /// No description provided for @objectiveAudioReplay.
  ///
  /// In en, this message translates to:
  /// **'Replay audio cue'**
  String get objectiveAudioReplay;

  /// No description provided for @objectiveAudioPause.
  ///
  /// In en, this message translates to:
  /// **'Pause'**
  String get objectiveAudioPause;

  /// No description provided for @objectiveAudioLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading the original audio'**
  String get objectiveAudioLoading;

  /// No description provided for @objectiveAudioUnavailable.
  ///
  /// In en, this message translates to:
  /// **'The original audio is unavailable. Your answers and score are saved.'**
  String get objectiveAudioUnavailable;

  /// No description provided for @objectiveReviewMissed.
  ///
  /// In en, this message translates to:
  /// **'Review the first missed answer'**
  String get objectiveReviewMissed;

  /// No description provided for @objectiveNextDrill.
  ///
  /// In en, this message translates to:
  /// **'Try a follow-up drill'**
  String get objectiveNextDrill;

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Mockza'**
  String get appTitle;

  /// No description provided for @navHome.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get navHome;

  /// No description provided for @navPractice.
  ///
  /// In en, this message translates to:
  /// **'Exams'**
  String get navPractice;

  /// No description provided for @navSmartCoach.
  ///
  /// In en, this message translates to:
  /// **'Coach'**
  String get navSmartCoach;

  /// No description provided for @navVocabulary.
  ///
  /// In en, this message translates to:
  /// **'Vocab'**
  String get navVocabulary;

  /// No description provided for @navProgress.
  ///
  /// In en, this message translates to:
  /// **'Progress'**
  String get navProgress;

  /// No description provided for @smartCoachTitle.
  ///
  /// In en, this message translates to:
  /// **'Smart Coach'**
  String get smartCoachTitle;

  /// No description provided for @smartCoachSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Daily personalized practice: fix weak spots, upgrade your speaking, and turn any real-world content into a quick drill.'**
  String get smartCoachSubtitle;

  /// No description provided for @learningModeLabel.
  ///
  /// In en, this message translates to:
  /// **'How would you like to study?'**
  String get learningModeLabel;

  /// No description provided for @learningModeSectionSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Choose your focus — you can always switch or use both tabs anytime.'**
  String get learningModeSectionSubtitle;

  /// No description provided for @learningModeExams.
  ///
  /// In en, this message translates to:
  /// **'Mock Exams Only'**
  String get learningModeExams;

  /// No description provided for @learningModeExamsSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Timed practice tests and score estimates across Reading, Listening, Writing, and Speaking.'**
  String get learningModeExamsSubtitle;

  /// No description provided for @learningModeCoach.
  ///
  /// In en, this message translates to:
  /// **'Smart Coach Only'**
  String get learningModeCoach;

  /// No description provided for @learningModeCoachSubtitle.
  ///
  /// In en, this message translates to:
  /// **'10-minute daily coaching, speaking upgrades, and turning articles/audio into quick drills.'**
  String get learningModeCoachSubtitle;

  /// No description provided for @learningModeBoth.
  ///
  /// In en, this message translates to:
  /// **'Both — Complete Prep (Recommended)'**
  String get learningModeBoth;

  /// No description provided for @learningModeBothSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Combine timed Mock Exams with daily Smart Coach habits to boost your score faster.'**
  String get learningModeBothSubtitle;

  /// No description provided for @settingsTitle.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settingsTitle;

  /// No description provided for @onboardingTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome to Mockza'**
  String get onboardingTitle;

  /// No description provided for @onboardingSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Personalize your IELTS target and check your microphone before starting.'**
  String get onboardingSubtitle;

  /// No description provided for @paywallTitle.
  ///
  /// In en, this message translates to:
  /// **'Mockza Pro'**
  String get paywallTitle;

  /// No description provided for @speakingSimTitle.
  ///
  /// In en, this message translates to:
  /// **'Speaking Simulator'**
  String get speakingSimTitle;

  /// No description provided for @writingSimTitle.
  ///
  /// In en, this message translates to:
  /// **'Writing Simulator'**
  String get writingSimTitle;

  /// No description provided for @readingSimTitle.
  ///
  /// In en, this message translates to:
  /// **'Reading Simulator'**
  String get readingSimTitle;

  /// No description provided for @listeningSimTitle.
  ///
  /// In en, this message translates to:
  /// **'Listening Simulator'**
  String get listeningSimTitle;

  /// No description provided for @microDrillsTitle.
  ///
  /// In en, this message translates to:
  /// **'Micro Drills'**
  String get microDrillsTitle;

  /// No description provided for @evaluationReviewTitle.
  ///
  /// In en, this message translates to:
  /// **'Evaluation Review'**
  String get evaluationReviewTitle;

  /// No description provided for @placeholderStatus.
  ///
  /// In en, this message translates to:
  /// **'Ready for practice'**
  String get placeholderStatus;

  /// No description provided for @backToHome.
  ///
  /// In en, this message translates to:
  /// **'Return Home'**
  String get backToHome;

  /// No description provided for @routeNotFoundTitle.
  ///
  /// In en, this message translates to:
  /// **'Page Not Found'**
  String get routeNotFoundTitle;

  /// No description provided for @examTrackAcademic.
  ///
  /// In en, this message translates to:
  /// **'Academic'**
  String get examTrackAcademic;

  /// No description provided for @examTrackGeneral.
  ///
  /// In en, this message translates to:
  /// **'General Training'**
  String get examTrackGeneral;

  /// No description provided for @targetBandLabel.
  ///
  /// In en, this message translates to:
  /// **'Target Band'**
  String get targetBandLabel;

  /// No description provided for @practiceModeExam.
  ///
  /// In en, this message translates to:
  /// **'Exam Mode'**
  String get practiceModeExam;

  /// No description provided for @practiceModeStudy.
  ///
  /// In en, this message translates to:
  /// **'Study Mode'**
  String get practiceModeStudy;

  /// No description provided for @continueAction.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueAction;

  /// No description provided for @skipAction.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get skipAction;

  /// No description provided for @retryAction.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retryAction;

  /// No description provided for @saveAction.
  ///
  /// In en, this message translates to:
  /// **'Save'**
  String get saveAction;

  /// No description provided for @cancelAction.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelAction;

  /// No description provided for @submitAction.
  ///
  /// In en, this message translates to:
  /// **'Submit'**
  String get submitAction;

  /// No description provided for @loadingLabel.
  ///
  /// In en, this message translates to:
  /// **'Loading...'**
  String get loadingLabel;

  /// No description provided for @syncNowLabel.
  ///
  /// In en, this message translates to:
  /// **'Sync Catalog Now'**
  String get syncNowLabel;

  /// No description provided for @micTestLabel.
  ///
  /// In en, this message translates to:
  /// **'Test Microphone'**
  String get micTestLabel;

  /// No description provided for @fullMockTitle.
  ///
  /// In en, this message translates to:
  /// **'Full Mock Exam'**
  String get fullMockTitle;

  /// No description provided for @startAudioLabel.
  ///
  /// In en, this message translates to:
  /// **'Start Audio'**
  String get startAudioLabel;

  /// No description provided for @exportStudyDataLabel.
  ///
  /// In en, this message translates to:
  /// **'Export Study Data (JSON)'**
  String get exportStudyDataLabel;

  /// No description provided for @comingSoonLabel.
  ///
  /// In en, this message translates to:
  /// **'Soon'**
  String get comingSoonLabel;

  /// No description provided for @partialEstimateLabel.
  ///
  /// In en, this message translates to:
  /// **'Partial Estimate'**
  String get partialEstimateLabel;

  /// No description provided for @readingPassagesLabel.
  ///
  /// In en, this message translates to:
  /// **'Reading Passages'**
  String get readingPassagesLabel;

  /// No description provided for @authTitleSignIn.
  ///
  /// In en, this message translates to:
  /// **'Sign In'**
  String get authTitleSignIn;

  /// No description provided for @authTitleSignUp.
  ///
  /// In en, this message translates to:
  /// **'Create Account'**
  String get authTitleSignUp;

  /// No description provided for @authSmsPhoneLabel.
  ///
  /// In en, this message translates to:
  /// **'Iran Mobile Number'**
  String get authSmsPhoneLabel;

  /// No description provided for @authSendOtp.
  ///
  /// In en, this message translates to:
  /// **'Send SMS Verification Code'**
  String get authSendOtp;

  /// No description provided for @authVerifyOtp.
  ///
  /// In en, this message translates to:
  /// **'Verify & Sign In'**
  String get authVerifyOtp;

  /// No description provided for @practiceHubTitle.
  ///
  /// In en, this message translates to:
  /// **'Practice Hub'**
  String get practiceHubTitle;

  /// No description provided for @practiceHubSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Offline exam library · Sync & download packs'**
  String get practiceHubSubtitle;

  /// No description provided for @vocabularyTitle.
  ///
  /// In en, this message translates to:
  /// **'Vocabulary Deck'**
  String get vocabularyTitle;

  /// No description provided for @progressTitle.
  ///
  /// In en, this message translates to:
  /// **'Progress & Analytics'**
  String get progressTitle;

  /// No description provided for @targetDateLabel.
  ///
  /// In en, this message translates to:
  /// **'Target Exam Date'**
  String get targetDateLabel;

  /// No description provided for @jalaliPickerTitle.
  ///
  /// In en, this message translates to:
  /// **'Select Exam Date (Jalali)'**
  String get jalaliPickerTitle;

  /// No description provided for @naviaHandoffTitle.
  ///
  /// In en, this message translates to:
  /// **'Send Verified Score to Navia'**
  String get naviaHandoffTitle;

  /// No description provided for @missionCardTitle.
  ///
  /// In en, this message translates to:
  /// **'Today\'s 10-Min Coach'**
  String get missionCardTitle;

  /// No description provided for @missionCardSubtitle.
  ///
  /// In en, this message translates to:
  /// **'Targets your real mistakes and due vocabulary inside topics you enjoy.'**
  String get missionCardSubtitle;

  /// No description provided for @missionStartAction.
  ///
  /// In en, this message translates to:
  /// **'Start 10-Min Session'**
  String get missionStartAction;

  /// No description provided for @dailyMissionTitle.
  ///
  /// In en, this message translates to:
  /// **'Today\'s 10-Min Coach'**
  String get dailyMissionTitle;

  /// No description provided for @linguisticGraphTitle.
  ///
  /// In en, this message translates to:
  /// **'My Weak Spots'**
  String get linguisticGraphTitle;

  /// No description provided for @activeBottlenecksLabel.
  ///
  /// In en, this message translates to:
  /// **'Recurring Weak Spots'**
  String get activeBottlenecksLabel;

  /// No description provided for @targetStructuresLabel.
  ///
  /// In en, this message translates to:
  /// **'Mastered Expressions'**
  String get targetStructuresLabel;

  /// No description provided for @pinnedInterestsLabel.
  ///
  /// In en, this message translates to:
  /// **'Favorite Topics'**
  String get pinnedInterestsLabel;

  /// No description provided for @pinTopicAction.
  ///
  /// In en, this message translates to:
  /// **'Add Topic'**
  String get pinTopicAction;

  /// No description provided for @registerShifterTitle.
  ///
  /// In en, this message translates to:
  /// **'Upgrade My Speaking'**
  String get registerShifterTitle;

  /// No description provided for @registerShifterShortTitle.
  ///
  /// In en, this message translates to:
  /// **'Upgrade Speaking'**
  String get registerShifterShortTitle;

  /// No description provided for @dropAnythingTitle.
  ///
  /// In en, this message translates to:
  /// **'Learn From Anything'**
  String get dropAnythingTitle;

  /// No description provided for @dropDrillTitle.
  ///
  /// In en, this message translates to:
  /// **'2-Min Study Quiz'**
  String get dropDrillTitle;

  /// No description provided for @saveToSm2.
  ///
  /// In en, this message translates to:
  /// **'Save to Vocab Deck'**
  String get saveToSm2;

  /// No description provided for @savedToSm2.
  ///
  /// In en, this message translates to:
  /// **'Saved to Vocab Deck'**
  String get savedToSm2;

  /// No description provided for @recentDropsLabel.
  ///
  /// In en, this message translates to:
  /// **'Saved Study Materials'**
  String get recentDropsLabel;

  /// No description provided for @roadmapTitle.
  ///
  /// In en, this message translates to:
  /// **'Your Learning Roadmap'**
  String get roadmapTitle;

  /// No description provided for @roadmapPanoramaLabel.
  ///
  /// In en, this message translates to:
  /// **'4-Milestone Panorama'**
  String get roadmapPanoramaLabel;

  /// No description provided for @roadmapActiveStepsLabel.
  ///
  /// In en, this message translates to:
  /// **'Step-by-Step Next Actions'**
  String get roadmapActiveStepsLabel;

  /// No description provided for @roadmapUpcomingLabel.
  ///
  /// In en, this message translates to:
  /// **'Upcoming Steps'**
  String get roadmapUpcomingLabel;

  /// No description provided for @roadmapViewFullCta.
  ///
  /// In en, this message translates to:
  /// **'View Full Roadmap'**
  String get roadmapViewFullCta;

  /// No description provided for @roadmapCompleteStepCta.
  ///
  /// In en, this message translates to:
  /// **'Mark Step Done'**
  String get roadmapCompleteStepCta;

  /// No description provided for @roadmapSkipStepCta.
  ///
  /// In en, this message translates to:
  /// **'Skip'**
  String get roadmapSkipStepCta;

  /// No description provided for @liveBandTitle.
  ///
  /// In en, this message translates to:
  /// **'Live Estimated Band'**
  String get liveBandTitle;

  /// No description provided for @confidenceProvisional.
  ///
  /// In en, this message translates to:
  /// **'Provisional · Initial Check'**
  String get confidenceProvisional;

  /// No description provided for @confidenceDeveloping.
  ///
  /// In en, this message translates to:
  /// **'Developing · Updating'**
  String get confidenceDeveloping;

  /// No description provided for @confidenceCalibrated.
  ///
  /// In en, this message translates to:
  /// **'Calibrated · High Confidence'**
  String get confidenceCalibrated;

  /// No description provided for @listenCta.
  ///
  /// In en, this message translates to:
  /// **'Listen'**
  String get listenCta;

  /// No description provided for @listenSlowCta.
  ///
  /// In en, this message translates to:
  /// **'0.8×'**
  String get listenSlowCta;

  /// No description provided for @practiceSpeechCta.
  ///
  /// In en, this message translates to:
  /// **'Practice Pronunciation'**
  String get practiceSpeechCta;

  /// No description provided for @speechStudioTitle.
  ///
  /// In en, this message translates to:
  /// **'Pronunciation Practice Studio'**
  String get speechStudioTitle;

  /// No description provided for @speechRecordStart.
  ///
  /// In en, this message translates to:
  /// **'Record My Voice'**
  String get speechRecordStart;

  /// No description provided for @speechRecordStop.
  ///
  /// In en, this message translates to:
  /// **'Stop Recording'**
  String get speechRecordStop;

  /// No description provided for @speechAnalyzeCta.
  ///
  /// In en, this message translates to:
  /// **'Analyze Pronunciation'**
  String get speechAnalyzeCta;

  /// No description provided for @speechAnalyzing.
  ///
  /// In en, this message translates to:
  /// **'Analyzing articulation, stress & fluency...'**
  String get speechAnalyzing;

  /// No description provided for @speechReplayMine.
  ///
  /// In en, this message translates to:
  /// **'Play My Take'**
  String get speechReplayMine;

  /// No description provided for @speechHistoryTitle.
  ///
  /// In en, this message translates to:
  /// **'Past Synced Takes'**
  String get speechHistoryTitle;

  /// No description provided for @vocabWaveTitle.
  ///
  /// In en, this message translates to:
  /// **'Wave {current} of {total}'**
  String vocabWaveTitle(int current, int total);

  /// No description provided for @vocabUnlockNextWave.
  ///
  /// In en, this message translates to:
  /// **'Unlock Next 15 Words'**
  String get vocabUnlockNextWave;

  /// No description provided for @vocabPreviewAllWaves.
  ///
  /// In en, this message translates to:
  /// **'Preview All Waves'**
  String get vocabPreviewAllWaves;

  /// No description provided for @syncDevicesNow.
  ///
  /// In en, this message translates to:
  /// **'Sync Across Devices Now'**
  String get syncDevicesNow;

  /// No description provided for @syncSuccessBanner.
  ///
  /// In en, this message translates to:
  /// **'Synced across devices'**
  String get syncSuccessBanner;

  /// No description provided for @favoriteTopicsLabel.
  ///
  /// In en, this message translates to:
  /// **'Favorite Topics (Start Here)'**
  String get favoriteTopicsLabel;

  /// No description provided for @roadmapBandUpTitle.
  ///
  /// In en, this message translates to:
  /// **'+{delta} Band Up! Live estimate rose to {band}'**
  String roadmapBandUpTitle(String delta, String band);

  /// No description provided for @roadmapBandUpBody.
  ///
  /// In en, this message translates to:
  /// **'Your roadmap has been recalibrated for your next target.'**
  String get roadmapBandUpBody;

  /// No description provided for @roadmapCollapseCompleted.
  ///
  /// In en, this message translates to:
  /// **'Completed Milestone · {count} steps'**
  String roadmapCollapseCompleted(int count);

  /// No description provided for @roadmapJumpAheadCta.
  ///
  /// In en, this message translates to:
  /// **'Jump ahead anyway'**
  String get roadmapJumpAheadCta;

  /// No description provided for @roadmapEditTopicsPace.
  ///
  /// In en, this message translates to:
  /// **'Topics & Pace'**
  String get roadmapEditTopicsPace;

  /// No description provided for @planImpactTitle.
  ///
  /// In en, this message translates to:
  /// **'How This Updated Your Plan'**
  String get planImpactTitle;

  /// No description provided for @planImpactBandLabel.
  ///
  /// In en, this message translates to:
  /// **'Live Band Estimate'**
  String get planImpactBandLabel;

  /// No description provided for @planImpactNextStepCta.
  ///
  /// In en, this message translates to:
  /// **'Continue Next Roadmap Step'**
  String get planImpactNextStepCta;

  /// No description provided for @practiceTabForYourPath.
  ///
  /// In en, this message translates to:
  /// **'For Your Path'**
  String get practiceTabForYourPath;

  /// No description provided for @practiceTabAllTests.
  ///
  /// In en, this message translates to:
  /// **'All Tests'**
  String get practiceTabAllTests;

  /// No description provided for @vocabTabTodaysWave.
  ///
  /// In en, this message translates to:
  /// **'Today\'s Wave'**
  String get vocabTabTodaysWave;

  /// No description provided for @vocabTabSavedMistakes.
  ///
  /// In en, this message translates to:
  /// **'My Saved Mistakes'**
  String get vocabTabSavedMistakes;

  /// No description provided for @vocabTabFullDeck.
  ///
  /// In en, this message translates to:
  /// **'Full Deck'**
  String get vocabTabFullDeck;

  /// No description provided for @vocabWhyThisWord.
  ///
  /// In en, this message translates to:
  /// **'Why this word'**
  String get vocabWhyThisWord;

  /// No description provided for @vocabWaveAutoUnlocked.
  ///
  /// In en, this message translates to:
  /// **'60% of Wave {wave} learned! Wave {next} is now unlocked.'**
  String vocabWaveAutoUnlocked(int wave, int next);

  /// No description provided for @speechPreviewHint.
  ///
  /// In en, this message translates to:
  /// **'Listen back to your recording before analyzing, or re-record for free.'**
  String get speechPreviewHint;

  /// No description provided for @speechQuotaRemaining.
  ///
  /// In en, this message translates to:
  /// **'{remaining}/{limit} analyses left today'**
  String speechQuotaRemaining(int remaining, int limit);

  /// No description provided for @speechWordTapHint.
  ///
  /// In en, this message translates to:
  /// **'Tap any highlighted word for IPA comparison & 0.8x audio'**
  String get speechWordTapHint;

  /// No description provided for @speechListenWordSlow.
  ///
  /// In en, this message translates to:
  /// **'Listen to \"{word}\" (0.8x)'**
  String speechListenWordSlow(String word);

  /// No description provided for @settingsDailyNewCapTitle.
  ///
  /// In en, this message translates to:
  /// **'Daily New Vocab Cap'**
  String get settingsDailyNewCapTitle;

  /// No description provided for @settingsTtsAccentTitle.
  ///
  /// In en, this message translates to:
  /// **'Reference Voice Accent (Kokoro AI)'**
  String get settingsTtsAccentTitle;

  /// No description provided for @settingsTtsAccentUs.
  ///
  /// In en, this message translates to:
  /// **'American (af_bella)'**
  String get settingsTtsAccentUs;

  /// No description provided for @settingsTtsAccentUk.
  ///
  /// In en, this message translates to:
  /// **'British (bf_emma)'**
  String get settingsTtsAccentUk;

  /// No description provided for @graphCoverageTitle.
  ///
  /// In en, this message translates to:
  /// **'Topic × Weakness Adaptation Matrix'**
  String get graphCoverageTitle;

  /// No description provided for @graphCoveragePhaseLabel.
  ///
  /// In en, this message translates to:
  /// **'Current Phase'**
  String get graphCoveragePhaseLabel;

  /// No description provided for @graphCoverageFavoriteMastered.
  ///
  /// In en, this message translates to:
  /// **'Mastered in Favorite Topics'**
  String get graphCoverageFavoriteMastered;

  /// No description provided for @graphCoverageTransferred.
  ///
  /// In en, this message translates to:
  /// **'Transferred to Other Topics'**
  String get graphCoverageTransferred;

  /// No description provided for @diagStartStepCta.
  ///
  /// In en, this message translates to:
  /// **'Start Step 1 on Your Roadmap'**
  String get diagStartStepCta;

  /// No description provided for @audioLoadFailed.
  ///
  /// In en, this message translates to:
  /// **'Audio load failed'**
  String get audioLoadFailed;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'fa'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'fa':
      return AppLocalizationsFa();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
