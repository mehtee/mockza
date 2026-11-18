import type { TranslationKey } from './types';

export const faMessages = {
  // Seeded from app/lib/l10n/app_fa.arb (adapted for Sanjia IRN brand)
  appTitle: 'سنجیا',
  navHome: 'خانه',
  navPractice: 'تمرین',
  navVocabulary: 'واژگان',
  navProgress: 'پیشرفت',
  settingsTitle: 'تنظیمات',
  onboardingTitle: 'به سنجیا خوش آمدید',
  onboardingSubtitle:
    'مسیر آزمون و نمره هدف خود را انتخاب کنید و پیش از شروع میکروفون را آزمایش کنید.',
  paywallTitle: 'سنجیا پرو',
  speakingSimTitle: 'شبیه‌ساز اسپیکینگ',
  writingSimTitle: 'شبیه‌ساز رایتینگ',
  readingSimTitle: 'شبیه‌ساز ریدینگ',
  listeningSimTitle: 'شبیه‌ساز لیسنینگ',
  microDrillsTitle: 'تمرین‌های کوتاه',
  evaluationReviewTitle: 'بررسی ارزیابی',
  placeholderStatus: 'آماده برای تمرین',
  backToHome: 'بازگشت به خانه',
  routeNotFoundTitle: 'صفحه پیدا نشد',
  examTrackAcademic: 'آکادمیک',
  examTrackGeneral: 'جنرال ترینینگ',
  targetBandLabel: 'نمره هدف',
  practiceModeExam: 'حالت آزمون',
  practiceModeStudy: 'حالت مطالعه',
  continueAction: 'ادامه',
  skipAction: 'رد شدن',
  retryAction: 'تلاش مجدد',
  saveAction: 'ذخیره',
  cancelAction: 'لغو',
  submitAction: 'ارسال',
  loadingLabel: 'در حال بارگذاری...',
  syncNowLabel: 'همگام‌سازی محتوا',
  micTestLabel: 'تست میکروفون',
  fullMockTitle: 'آزمون کامل آزمایشی',
  startAudioLabel: 'شروع پخش صدا',
  exportStudyDataLabel: 'خروجی داده‌های مطالعه (JSON)',
  comingSoonLabel: 'به‌زودی',
  partialEstimateLabel: 'برآورد جزئی',
  readingPassagesLabel: 'متن‌های ریدینگ',

  // Desktop navigation rail & chrome
  brandShort: 'سنجیا',
  navAriaLabel: 'ناوبری اصلی',
  navCollapseLabel: 'جمع کردن منوی کناری',
  navExpandLabel: 'باز کردن منوی کناری',
  navSettings: 'تنظیمات',
  navPaywall: 'اشتراک پرو',
  scaffoldBadgeLabel: 'ساختار پایه W1.1',

  // All 24 mapped route titles & descriptions
  routeWelcomeTitle: 'به نسخه دسکتاپ سنجیا خوش آمدید',
  routeWelcomeDescription: 'نقطه ورود و آشنایی اولیه با شبیه‌ساز.',
  routeGoalSetupTitle: 'تنظیم هدف و مسیر آزمون',
  routeGoalSetupDescription:
    'انتخاب آزمون از میان ۵ مسیر، اسلایدر نمره هدف و انتخاب تاریخ آزمون.',
  routeDiagnosticIntroTitle: 'پیش‌نیاز تعیین سطح سریع',
  routeDiagnosticIntroDescription:
    'تست سریع صدا و میکروفون و انتخاب حالت زمان‌بندی آزمون تعیین سطح.',
  routeDiagnosticSessionTitle: 'جلسه تعیین سطح سریع',
  routeDiagnosticSessionDescription:
    'محیط تطبیقی چهار مهارت برای سنجش سطح پایه زبان.',
  routeDiagnosticResultTitle: 'کارنامه سطح پایه',
  routeDiagnosticResultDescription:
    'نمره پایه، بازه اطمینان و برنامه اقدام پیشنهادی.',
  routeLoginTitle: 'ورود به حساب کاربری',
  routeLoginDescription:
    'احراز هویت با پیامک یا ایمیل و مدیریت نشست هم‌زمان دستگاه.',
  routeHomeTitle: 'داشبورد دسکتاپ',
  routeHomeDescription:
    'شاخص آمادگی، تغییر مسیر آزمون، کارت‌های چهار مهارت و مرور واژگان SM-2.',
  routePracticeTitle: 'کاتالوگ تمرین‌ها',
  routePracticeDescription:
    'فهرست بسته‌های آزمون با فیلتر مهارت و دانلود آفلاین.',
  routeReadingSimDescription:
    'محیط دو‌ستونه قابل تغییر اندازه برای مطالعه متن و پاسخ به پرسش‌ها.',
  routeListeningSimDescription:
    'پخش‌کننده استودیویی صدا و محیط چندبخش لیسنینگ.',
  routeWritingSimDescription:
    'محیط دو‌ستونه موضوع رایتینگ و ویرایشگر بدون حواس‌پرتی.',
  routeSpeakingSimDescription:
    'کارت موضوع اسپیکینگ و استودیوی ضبط صدا با موج زنده.',
  routeMicroDrillsDescription:
    '۷ تمرین سریع سه‌دقیقه‌ای با افزودن خطاها به دفترچه واژگان.',
  routeMicroDrillSessionTitle: 'جلسه تمرین کوتاه',
  routeMicroDrillSessionDescription: 'تمرین متمرکز سه‌دقیقه‌ای مهارت.',
  routeFullMockTitle: 'برگزارکننده آزمون کامل آزمایشی',
  routeFullMockDescription:
    'آزمون آزمایشی چندبخشی زمان‌بندی‌شده مطابق ترتیب رسمی.',
  routeFullMockSessionTitle: 'جلسه آزمون کامل آزمایشی',
  routeFullMockSessionDescription: 'اجرای مرحله‌به‌مرحله آزمون آزمایشی.',
  routeEvaluationPendingTitle: 'در حال ارزیابی هوشمند',
  routeEvaluationPendingDescription: 'پیگیری زنده مراحل تصحیح هوشمند پاسخ.',
  routeEvaluationResultDescription:
    'نمای دوتایی بررسی معیارها، هایلایت خطاها و بازنویسی نمونه.',
  routeObjectiveResultTitle: 'بررسی نتیجه آزمون عینی',
  routeObjectiveResultDescription:
    'مرور پاسخ‌ها همراه با ارجاع به متن و راهنمای هوشمند.',
  routeVocabularyTitle: 'مرکز واژگان SM-2',
  routeVocabularyDescription:
    'صف مرور امروز و مرورگر سریع واژگان آکادمیک و خطاها.',
  routeVocabReviewTitle: 'استودیوی مرور فلش‌کارت SM-2',
  routeVocabReviewDescription: 'مرور فاصله‌دار واژگان با میانبرهای صفحه‌کلید.',
  routeVocabWordDetailTitle: 'جزئیات واژه',
  routeVocabWordDetailDescription: 'معنی، مثال و برنامه مرور دوره‌ای واژه.',
  routeProgressTitle: 'تحلیل پیشرفت',
  routeProgressDescription:
    'نمودار روند نمرات، رادار مهارت‌ها و جدول نقاط ضعف.',
  routeCompareAttemptsTitle: 'مقایسه دو آزمون',
  routeCompareAttemptsDescription: 'مقایسه دقیق جزئیات و تغییر نمره بین دو تلاش.',
  routeSettingsDescription:
    'حساب کاربری، دستگاه‌های فعال (۱ موبایل + ۱ دسکتاپ)، ظاهر و حافظه آفلاین.',
  routePaywallTitle: 'طرح‌های پرو و خرید اشتراک',
  routePaywallDescription:
    'مقایسه امکانات رایگان و پرو و پرداخت امن ریالی.',
  routePublicLandingTitle: 'صفحه اصلی و راهنماها',
  routeNotFoundDescription: 'مسیر درخواستی در شبیه‌ساز یافت نشد.',

  // Exam navigation blocker
  examBlockerTitle: 'آزمون در حال اجرا است',
  examBlockerMessageWithLabel:
    'در حال خروج از «{sessionLabel}» هستید. برای باز کردن قفل و خروج تایید کنید.',
  examBlockerMessageGeneric:
    'یک جلسه آزمون زمان‌بندی‌شده قفل است. برای خروج تایید کنید.',
  examBlockerStayAction: 'ماندن در آزمون',
  examBlockerLeaveAction: 'خروج از جلسه',

  // Auth & 1+1 Device Slot
  authSignInAction: 'ورود',
  authSignUpAction: 'ثبت‌نام',
  authSignOutAction: 'خروج از حساب',
  authEmailLabel: 'نشانی ایمیل',
  authPasswordLabel: 'رمز عبور',
  authContinueWithGoogle: 'ورود با حساب جایگزین',
  authContinueWithApple: 'ورود با شناسه جایگزین',
  authPhoneNumberLabel: 'شماره موبایل (+۹۸)',
  authSendOtpAction: 'ارسال کد تایید پیامکی',
  authVerifyOtpAction: 'تایید کد',
  authDeviceSlotBadge: '۱ موبایل + ۱ مرورگر دسکتاپ',
  authSlotOccupiedTitle: 'نشست دسکتاپ روی مرورگر دیگری فعال است',
  authSlotOccupiedDescription:
    'مرورگر دیگری ({deviceName} در {location}) هم‌اکنون متصل است. آن نشست را ببندیم و اینجا ادامه دهید؟',
  authSlotReplaceAction: 'خروج از مرورگر قبلی و ورود در اینجا',
  authSessionRevokedBanner:
    'نشست دسکتاپ شما از دستگاه دیگری بسته شد. لطفاً دوباره وارد شوید.',
  authHeroSubtitle:
    'اشتراک پرو و تاریخچه تمرین‌های خود را هم‌زمان روی ۱ گوشی موبایل و ۱ مرورگر دسکتاپ همگام‌سازی کنید.',
  authDisplayNameLabel: 'نام نمایشی (اختیاری)',
  authPasswordHintMin8: 'حداقل ۸ کاراکتر',
  authOrEmailDivider: 'یا ورود با ایمیل',
  authOtpCodeLabel: 'کد تایید ۶ رقمی',
  authOtpResendCountdown: 'ارسال مجدد تا {sec} ثانیه دیگر',
  authOtpChangePhoneAction: 'ویرایش شماره',
  authOtpDevHintBadge: 'کد آزمایشی توسعه: {code}',
  authTabSmsOtp: 'ورود پیامکی',
  authTabEmail: 'ایمیل',
  authDevSandboxBadge: 'محیط توسعه',
  authDevPersonaModalTitle: 'انتخاب حساب آزمایشی ({provider})',
  authDevPersonaModalDesc:
    'تا زمان تنظیم کلیدهای نهایی، یکی از حساب‌های آزمایشی را انتخاب کنید.',
  authSlotActiveBadge: '۱ از ۱ فعال',
  authSlotOpenBadge: '۰ از ۱ آزاد',
  authMobileSlotTitle: 'گوشی موبایل',
  authDesktopSlotTitle: 'مرورگر دسکتاپ',
  authPolicyNoticeBody:
    'هر اشتراک هم‌زمان شامل ۱ گوشی موبایل و ۱ مرورگر دسکتاپ است. در هر زمان می‌توانید نشست‌ها را در تنظیمات مدیریت یا لغو کنید.',
  authAlreadySignedInBanner: 'با حساب {identity} وارد شده‌اید.',
  authContinueHomeAction: 'ورود به داشبورد',
  authMultiExamSyncBullet:
    'همگام‌سازی پیشرفت در هر ۵ آزمون: آیلتس آکادمیک و جنرال، تافل iBT ۲۰۲۶، پی‌تی‌ای و دولینگو (DET).',

  // Settings & Paywall
  settingsAccountSection: 'حساب کاربری',
  settingsActiveDevicesSection: 'دستگاه‌های فعال (۱ موبایل + ۱ دسکتاپ)',
  settingsRevokeDeviceAction: 'لغو دسترسی دستگاه',
  settingsCurrentDeviceBadge: 'این مرورگر',
  settingsExamTrackSection: 'مسیر آزمون و نمره هدف',
  settingsAppearanceSection: 'ظاهر برنامه',
  settingsThemeDark: 'تیره',
  settingsThemeLight: 'روشن',
  settingsThemeSystem: 'هماهنگ با سیستم',
  settingsAudioSection: 'تنظیمات صدا و میکروفون',
  settingsOfflineCacheSection: 'حافظه آفلاین و کش',
  settingsDeleteAccountAction: 'حذف حساب کاربری',
  paywallTosConsentLabel:
    'می‌پذیرم هر حساب به‌صورت هم‌زمان فقط روی ۱ گوشی موبایل و ۱ مرورگر دسکتاپ فعال باشد.',
  paywallWeeklyLabel: 'گذرنامه فشرده ۷ روزه',
  paywallMonthlyLabel: 'اشتراک ماهانه پرو',
  paywallQuarterlyLabel: 'بسته سه‌ماهه آمادگی کامل',
  paywallSubscribeAction: 'ارتقا به نسخه پرو',

  // 5 Exam Tracks
  trackIeltsAcademic: 'آیلتس آکادمیک (IELTS Academic)',
  trackIeltsGeneral: 'آیلتس جنرال (IELTS General)',
  trackToeflIbt: 'تافل iBT ۲۰۲۶',
  trackPteAcademic: 'پی‌تی‌ای آکادمیک (PTE Academic)',
  trackDet: 'آزمون دولینگو (DET)',

  // Theme Presets
  presetMidnightIndigo: 'نیلی نیمه‌شب',
  presetNordicEmerald: 'زمرد نوردیک',
  presetEditorialAmber: 'کهربایی تحریریه',
  presetOceanicCobalt: 'کبالت اقیانوسی',

  // Workspace chrome
  workspaceTimerRemaining: 'زمان باقی‌مانده: {time}',
  workspaceWordCount: '{count} واژه',
  workspaceQuestionProgress: 'پرسش {current} از {total}',
  workspaceShortcutsHint: 'میانبرهای صفحه‌کلید (?)',
  scoreSummaryBand: 'نمره {score} ({track})',
  progressTargetDateLabel: 'تاریخ هدف آزمون: {date}',
  ecosystemEligibilityCta: 'ارسال نمره تاییدشده به ناویا (Navia)',
} as const satisfies Record<TranslationKey, string>;
