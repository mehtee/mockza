import type {
  ExamPillarGuide,
  PublicSiteCopy,
  PublicVocabEntry,
  SampleAnnotatedEssay,
} from './public-catalog-glb';

export const IRN_PUBLIC_COPY: PublicSiteCopy = {
  brandTitle: 'سنجیا (Sanjia)',
  navHome: 'آزمون‌ها',
  navCalculators: 'ماشین‌حساب نمره',
  navSamples: 'نمونه رایتینگ',
  navVocab: 'واژگان آکادمیک',
  navOpenApp: 'ورود به شبیه‌ساز دسکتاپ',
  heroHeadline: 'شبیه‌ساز دسکتاپ آیلتس، تافل ۲۰۲۶، PTE و دولینگو بدون فیلترشکن',
  heroSubtitle:
    'محیط کامل دو‌ستونه دسکتاپ با هایلایت متن انگلیسی، پخش صوت استودیویی قفل‌شده، ذخیره آفلاین پیش‌نویس، مرور لغات SM-2 با ترجمه فارسی و انتقال نمره تاییدشده به ناویا (Navia).',
  keyFactsHeading: 'ویژگی‌های کلیدی پلتفرم سنجیا',
  examPillarsHeading: '۵ شبیه‌ساز تخصصی آزمون‌های بین‌المللی',
  ctaDiagnostic: 'شروع تعیین سطح ۱۰ دقیقه‌ای',
  ctaCatalog: 'مشاهده بسته‌های رایگان',
};

export const IRN_EXAM_PILLARS: readonly ExamPillarGuide[] = [
  {
    slug: 'ielts-academic',
    examId: 'ielts_academic',
    name: 'آیلتس آکادمیک (IELTS Academic)',
    headline: 'شبیه‌ساز دسکتاپ کامپیوتری آیلتس آکادمیک با تصحیح هوشمند فارسی',
    summary:
      'تمرین کامل بخش‌های Reading دو‌ستونه با امکان هایلایت و یادداشت، Listening با قفل یک‌بار پخش، Task 1 نمودار و Task 2 رایتینگ، و Speaking سه مرحله‌ای با تحلیل فارسی.',
    scoreScaleLabel: 'نمره ۰ تا ۹ (گام ۰.۵)',
    durationLabel: '۲ ساعت و ۴۴ دقیقه',
    keyFacts: [
      { label: 'مقیاس نمره', value: '۰ تا ۹ (گام‌های ۰.۵)' },
      { label: 'مهارت‌ها', value: 'Listening · Reading · Writing · Speaking' },
      { label: 'تصحیح هوشمند', value: 'تحلیل معیارها به انگلیسی + راهنمای فارسی' },
      { label: 'پرداخت ریالی', value: 'درگاه زرین‌پال با قیمت شفاف به تومان' },
    ],
    sectionsSummary: [
      'لیسنینگ ۳۰ دقیقه‌ای با ۴ بخش و قفل پخش خطی در حالت آزمون',
      'ریدینگ ۶۰ دقیقه‌ای چپ‌به‌راست ایزوله با هایلایت زرد/سبز/قرمز و ذخیره در جعبه لغات SM-2',
      'رایتینگ ۶۰ دقیقه‌ای همراه با بزرگ‌نمایی SVG نمودارهای Task 1',
      'اسپیکینگ استودیویی همراه با تایمر ۶۰ ثانیه‌ای آماده شدن برای Part 2',
    ],
    desktopAdvantage:
      'در چیدمان دسکتاپ دو‌ستونه سنجیا، متن و سوالات انگلیسی همواره چپ‌به‌راست (LTR) ایزوله هستند در حالی که منو و راهنمای هوشمند کاملاً فارسی و راست‌به‌چپ نمایش داده می‌شوند.',
    faqs: [
      {
        question: 'آیا برای استفاده از سنجیا و تصحیح هوشمند نیاز به VPN است؟',
        answer:
          'خیر. زیرساخت سنجیا روی سرورهای داخلی بهینه‌سازی شده و بدون نیاز به تغییر IP یا فیلترشکن در دسترس است.',
      },
      {
        question: 'آیا کارنامه شبیه‌ساز به سرویس‌های پذیرش تحصیلی متصل می‌شود؟',
        answer:
          'بله. در بخش تحلیل پیشرفت می‌توانید نمره تاییدشده خود را مستقیماً برای استفاده در پلتفرم ناویا (Navia) ارسال کنید.',
      },
    ],
  },
  {
    slug: 'ielts-general',
    examId: 'ielts_general',
    name: 'آیلتس جنرال (IELTS General)',
    headline: 'شبیه‌ساز آیلتس جنرال مخصوص مهاجرت کاری با جدول نمره دقیق GT',
    summary:
      'تمرین متن‌های محیط کار و زندگی روزمره، نگارش نامه رسمی و غیررسمی Task 1 و مقاله Task 2 همراه با محاسبه دقیق نمره ریدینگ جنرال.',
    scoreScaleLabel: 'نمره ۰ تا ۹ (منحنی اختصاصی GT)',
    durationLabel: '۲ ساعت و ۴۴ دقیقه',
    keyFacts: [
      { label: 'مقیاس نمره', value: '۰ تا ۹ (با آستانه واقعی IELTS GT Reading)' },
      { label: 'رایتینگ اول', value: 'نامه رسمی، نیمه‌رسمی یا دوستانه (۱۵۰+ کلمه)' },
      { label: 'تاریخ آزمون', value: 'انتخابگر شمسی بدون خطا با ذخیره استاندارد UTC' },
    ],
    sectionsSummary: [
      'لیسنینگ استاندارد ۳۰ دقیقه‌ای مشترک آکادمیک و جنرال',
      'ریدینگ جنرال ۶۰ دقیقه‌ای با متون شغلی و روزمره',
      'رایتینگ نامه + مقاله با ذخیره خودکار پیش‌نویس هر ۵۰۰ میلی‌ثانیه',
      'اسپیکینگ مصاحبه سه‌بخشی همراه با بازنویسی نمره ۸.۵',
    ],
    desktopAdvantage:
      'پشتیبانی کامل از کلیدهای میانبر صفحه‌کلید برای سوالات TRUE/FALSE/NOT GIVEN و جدول‌ها.',
    faqs: [
      {
        question: 'آیا سنجیا تفاوت جدول تبدیل نمره خام IELTS General Reading را اعمال می‌کند؟',
        answer:
          'بله. موتور امتیازدهی محلی به محض انتخاب مسیر General Training از جدول دقیق GT برای ریدینگ استفاده می‌کند.',
      },
    ],
  },
  {
    slug: 'toefl-ibt',
    examId: 'toefl_ibt',
    name: 'تافل iBT نسخه ۲۰۲۶',
    headline: 'شبیه‌ساز تافل ۲۰۲۶ با مقیاس ۱.۰ تا ۶.۰ و تبدیل آنی به ۰–۱۲۰',
    summary:
      'تمرین فرمت جدید تافل ۲۰۲۶ شامل Build a Sentence، نوشتن ایمیل، Academic Discussion، Listen & Repeat و مصاحبه فوری بدون زمان آماده‌سازی اضافه.',
    scoreScaleLabel: '۱.۰ تا ۶.۰ (هم‌ارز ۰ تا ۱۲۰)',
    durationLabel: '۹۰ دقیقه',
    keyFacts: [
      { label: 'مقیاس ۲۰۲۶', value: '۱.۰ تا ۶.۰ + نمایش معادل قدیمی ۰–۱۲۰' },
      { label: 'رایتینگ تافل', value: 'ساخت جمله · ایمیل · بحث دانشگاهی' },
      { label: 'اسپیکینگ', value: 'ضبط فوری بدون تایمر آماده شدن غیرواقعی' },
    ],
    sectionsSummary: [
      'ریدینگ و لیسنینگ تطبیقی استاندارد با متن ایزوله انگلیسی',
      'سوالات مرتب‌سازی اجزای جمله (Build a Sentence)',
      'نگارش ایمیل رسمی و بحث کلاسی با محدودیت کلمه واقعی',
      'مصاحبه اسپیکینگ فوری (Zero-Prep Interview)',
    ],
    desktopAdvantage:
      'نمایش هم‌زمان نمره جدید ۶.۰ و معادل قدیمی از ۱۲۰ در صفحه کارنامه و داشبورد.',
    faqs: [
      {
        question: 'چگونه نمره جدید تافل از ۶ به سیستم قدیمی ۱۲۰ تبدیل می‌شود؟',
        answer:
          'جدول هم‌ارز استاندارد تافل (برای مثال نمره ۵.۰ معادل ۱۰۰ و نمره ۵.۵ معادل ۱۱۲ از ۱۲۰) در کل اپ و ماشین‌حساب آنلاین اعمال می‌شود.',
      },
    ],
  },
  {
    slug: 'pte-academic',
    examId: 'pte_academic',
    name: 'آزمون PTE Academic',
    headline: 'شبیه‌ساز دسکتاپ PTE Academic در مقیاس ۱۰ تا ۹۰',
    summary:
      'تمرین تخصصی Re-order Paragraphs با کلیدهای Alt+فلش، خلاصه‌سازی تک‌جمله‌ای Summarize Written Text با کنترل ۵ تا ۷۵ کلمه و تحلیل نمودار Describe Image.',
    scoreScaleLabel: '۱۰ تا ۹۰ (گام ۱ امتیازی GSE)',
    durationLabel: '۱۲۰ دقیقه',
    keyFacts: [
      { label: 'مقیاس نمره', value: '۱۰ تا ۹۰ GSE' },
      { label: 'کنترل تک‌جمله', value: 'بررسی لحظه‌ای قانون یک جمله و ۵–۷۵ کلمه در SWT' },
      { label: 'چیدمان پاراگراف', value: 'پشتیبانی کامل از درگ و میانبر کیبورد' },
    ],
    sectionsSummary: [
      'بخش ترکیبی اسپیکینگ و رایتینگ (Read Aloud تا Essay)',
      'بخش ریدینگ شامل جایگذاری جاخالی و Re-order Paragraphs',
      'بخش لیسنینگ و دیکته دقیق Write from Dictation',
    ],
    desktopAdvantage:
      'بررسی خودکار تک‌جمله‌ای بودن پاسخ و شمارش دقیق کلمات برای خلاصه‌نویسی PTE.',
    faqs: [
      {
        question: 'آیا بخش Summarize Written Text خطای نوشتن بیش از یک جمله را تشخیص می‌دهد؟',
        answer:
          'بله. ویرایشگر سنجیا تعداد جملات و سقف ۷۵ کلمه را در لحظه کنترل و هشدار قرمز نمایش می‌دهد.',
      },
    ],
  },
  {
    slug: 'duolingo-english-test',
    examId: 'det',
    name: 'آزمون دولینگو (DET)',
    headline: 'شبیه‌ساز آزمون دولینگو (DET) با محاسبه ۴ زیرمجموعه ۱۰ تا ۱۶۰',
    summary:
      'آمادگی کامل برای آزمون تطبیقی دولینگو شامل توصیف عکس در ۶۰ ثانیه، رایتینگ تعاملی، نمونه نگارش و محاسبه زیرمقیاس‌های Literacy، Comprehension، Conversation و Production.',
    scoreScaleLabel: '۱۰ تا ۱۶۰ (گام ۵ امتیازی)',
    durationLabel: '۶۰ دقیقه',
    keyFacts: [
      { label: 'مقیاس نمره', value: '۱۰ تا ۱۶۰ (مضرب ۵)' },
      { label: 'زیرمقیاس‌ها', value: 'Literacy · Comprehension · Conversation · Production' },
      { label: 'زمان کوتاه', value: 'تمرین‌های ۶۰ ثانیه‌ای عکس و رایتینگ تعاملی' },
    ],
    sectionsSummary: [
      'ارزیابی تطبیقی درک متن و شنیداری دولینگو',
      'نگارش توصیف تصویر ۶۰ ثانیه‌ای و رایتینگ تعاملی دو‌مرحله‌ای',
      'اسپیکینگ فوری درباره تصویر و موضوع تحلیلی',
    ],
    desktopAdvantage:
      'محاسبه دقیق هر چهار زیرنمره اصلی دولینگو روی داشبورد و گزارش نهایی.',
    faqs: [
      {
        question: 'چهار زیرنمره آزمون دولینگو چگونه محاسبه می‌شوند؟',
        answer:
          'هر زیرنمره از ترکیب جفت مهارت‌های مرتبط (مانند ریدینگ+رایتینگ برای Literacy و لیسنینگ+اسپیکینگ برای Conversation) به‌صورت دقیق استخراج می‌شود.',
      },
    ],
  },
];

export const IRN_SAMPLE_ESSAYS: readonly SampleAnnotatedEssay[] = [
  {
    id: 'ielts-t2-urban-transit',
    examLabel: 'رایتینگ آیلتس Task 2',
    scoreBadge: 'مدل نمره ۸.۵',
    promptTitle: 'سرمایه‌گذاری در حمل‌ونقل ریلی در برابر توسعه بزرگراه‌ها',
    excerpt:
      'Expanding suburban expressways temporarily relieves bottlenecks yet induces additional commuter volume within five years. Conversely, dedicated light-rail corridors permanently shift modal share and stabilize per-capita transit emissions.',
    examinerNote:
      'ساختار مقایسه علت و معلول بسیار منسجم است (CC 8.5) و استفاده از کلوکیشن‌های دقیق باعث ارتقای Lexical Resource شده است.',
    upgradedTerms: ['induce', 'modal share', 'bottleneck'],
  },
  {
    id: 'toefl-2026-discussion',
    examLabel: 'تافل ۲۰۲۶ · Academic Discussion',
    scoreBadge: 'نمره ۶.۰ (معادل ۱۲۰)',
    promptTitle: 'استفاده از پروژه‌های متن‌باز در دروس مهندسی دانشگاه',
    excerpt:
      'While standardized textbooks solidify mathematical intuition, integrating live open-source repositories teaches students reproducibility, code review discipline, and regression profiling under realistic constraints.',
    examinerNote:
      'پاسخ مستقیم به دیدگاه‌های هم‌کلاسی با افزودن مثال کاربردی و پرهیز از جملات کلیشه‌ای.',
    upgradedTerms: ['reproducibility', 'mitigate', 'solidify'],
  },
];

export const IRN_PUBLIC_VOCAB_ENTRIES: readonly PublicVocabEntry[] = [
  {
    headword: 'ubiquitous',
    ipa: '/juːˈbɪk.wɪ.təs/',
    topic: 'فناوری',
    definition: 'Present, appearing, or found everywhere across modern environments.',
    glossFa: 'همه‌جا حاضر و فراگیر',
    example: 'Automated telemetry has become ubiquitous across regional logistics hubs.',
  },
  {
    headword: 'attenuate',
    ipa: '/əˈten.ju.eɪt/',
    topic: 'علوم و محیط زیست',
    definition: 'Reduce the force, severity, or intensity of an effect.',
    glossFa: 'کاهش شدت یا تضعیف اثر',
    example: 'Coastal wetlands attenuate storm surges before floodwaters reach densely settled blocks.',
  },
  {
    headword: 'mitigate',
    ipa: '/ˈmɪt.ɪ.ɡeɪt/',
    topic: 'سیاست شهری',
    definition: 'Make a harmful outcome or risk less severe or painful.',
    glossFa: 'تخفیف دادن یا کم کردن آسیب',
    example: 'Off-peak transit pricing helps mitigate morning highway congestion.',
  },
  {
    headword: 'disparate',
    ipa: '/ˈdɪs.pər.ət/',
    topic: 'روش پژوهش',
    definition: 'Essentially different in kind and not readily comparable without normalization.',
    glossFa: 'ناهمگون و متفاوت از نظر ساختار',
    example: 'Concordance tables reconcile disparate scoring scales cleanly.',
  },
];
