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
  /// **'Practice'**
  String get navPractice;

  /// No description provided for @navVocabulary.
  ///
  /// In en, this message translates to:
  /// **'Vocabulary'**
  String get navVocabulary;

  /// No description provided for @navProgress.
  ///
  /// In en, this message translates to:
  /// **'Progress'**
  String get navProgress;

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
