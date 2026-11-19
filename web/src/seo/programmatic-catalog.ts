import { STARTER_VOCAB_CARDS, type SeedVocabCard } from '../../../backend/packages/db/src/seed-data/starter-vocab';
import type { ExamPillarSlug } from './public-catalog-glb';

export interface WritingSampleEntry {
  readonly trackSlug: ExamPillarSlug;
  readonly examId: string;
  readonly slug: string;
  readonly title: string;
  readonly titleFa: string;
  readonly taskLabel: string;
  readonly scoreBadge: string;
  readonly prompt: string;
  readonly modelResponse: string;
  readonly examinerNoteEn: string;
  readonly examinerNoteFa: string;
  readonly upgradedTerms: readonly string[];
}

export interface SpeakingTopicEntry {
  readonly trackSlug: ExamPillarSlug;
  readonly examId: string;
  readonly slug: string;
  readonly title: string;
  readonly titleFa: string;
  readonly partLabel: string;
  readonly prepSec: number;
  readonly responseSec: number;
  readonly prompt: string;
  readonly outlineBullets: readonly string[];
  readonly highBandPhrases: readonly string[];
  readonly tipFa: string;
}

export interface VocabCategoryPageData {
  readonly trackSlug: ExamPillarSlug;
  readonly examId: string;
  readonly category: string;
  readonly categoryLabelEn: string;
  readonly categoryLabelFa: string;
  readonly cards: readonly SeedVocabCard[];
}

const TRACK_META: readonly { readonly slug: ExamPillarSlug; readonly examId: string }[] = [
  { slug: 'ielts-academic', examId: 'ielts_academic' },
  { slug: 'ielts-general', examId: 'ielts_general' },
  { slug: 'toefl-ibt', examId: 'toefl_ibt' },
  { slug: 'pte-academic', examId: 'pte_academic' },
  { slug: 'duolingo-english-test', examId: 'det' },
];

const CATEGORY_LABELS: Record<string, { readonly en: string; readonly fa: string }> = {
  academic_linking: { en: 'Academic Cohesion & Linking', fa: 'انسجام و کلمات ربط آکادمیک' },
  education: { en: 'Education & Research', fa: 'آموزش و پژوهش دانشگاهی' },
  environment: { en: 'Environment & Climate', fa: 'محیط زیست و اقلیم' },
  reading_synonyms: { en: 'Paraphrase & Reading Synonyms', fa: 'مترادف‌های ریدینگ و پارافریز' },
  society_economics: { en: 'Society & Economics', fa: 'جامعه و اقتصاد' },
  technology: { en: 'Technology & AI Infrastructure', fa: 'فناوری و زیرساخت دیجیتال' },
  urbanization: { en: 'Urbanization & Public Transit', fa: 'شهرنشینی و حمل‌ونقل شهری' },
};

export const WRITING_SAMPLES_CATALOG: readonly WritingSampleEntry[] = [
  {
    trackSlug: 'ielts-academic',
    examId: 'ielts_academic',
    slug: 'urban-light-rail-subsidies',
    title: 'Public Rail Subsidies vs. Highway Expansion',
    titleFa: 'سرمایه‌گذاری در حمل‌ونقل ریلی در برابر بزرگراه‌ها',
    taskLabel: 'IELTS Task 2 Essay',
    scoreBadge: 'Band 8.5 Model',
    prompt:
      'Some policymakers argue that municipalities should fund public light-rail expansion rather than widening suburban highways. Discuss both views and give your opinion.',
    modelResponse:
      'Expanding suburban expressways temporarily relieves traffic bottlenecks yet induces additional private-vehicle commuting within five years. Conversely, dedicated light-rail corridors permanently shift commuter modal share, stabilize per-capita transit emissions, and revitalize dense commercial districts around stations.',
    examinerNoteEn:
      'Balances concession and rebuttal cleanly (CC 8.5) while deploying domain-exact verbs ("induces", "stabilize") and noun phrases ("modal share").',
    examinerNoteFa:
      'استفاده دقیق از ساختار تضاد و علل (CC 8.5) همراه با کلوکیشن‌های تخصصی بدون کلیشه‌گویی.',
    upgradedTerms: ['induce demand', 'modal share', 'bottleneck', 'per-capita'],
  },
  {
    trackSlug: 'ielts-academic',
    examId: 'ielts_academic',
    slug: 'solar-output-regional-comparison',
    title: 'Regional Solar Megawatt Generation (Task 1 Visual)',
    titleFa: 'تحلیل نمودار تولید برق خورشیدی منطقه‌ای (Task 1)',
    taskLabel: 'IELTS Task 1 Academic',
    scoreBadge: 'Band 8.0 Model',
    prompt: 'Summarize the main trends in utility-scale solar capacity across arid, temperate, and coastal grids.',
    modelResponse:
      'Overall, arid zones accounted for the highest installed output throughout the decade, whereas coastal regions recorded the steepest proportional surge after grid-storage tariffs declined.',
    examinerNoteEn:
      'Clear overview sentence contrasting absolute dominance with fastest relative growth (TA 8.0).',
    examinerNoteFa:
      'ارائه Overview شفاف با مقایسه سهم مطلق و نرخ رشد نسبی.',
    upgradedTerms: ['proportional surge', 'installed capacity', 'outpace'],
  },
  {
    trackSlug: 'ielts-general',
    examId: 'ielts_general',
    slug: 'flexible-hybrid-schedule-request',
    title: 'Requesting Flexible Remote Work Arrangements',
    titleFa: 'نامه رسمی درخواست برنامه کاری ترکیبی',
    taskLabel: 'IELTS GT Task 1 Letter',
    scoreBadge: 'Band 8.5 Model',
    prompt: 'Write a letter to your department manager proposing a two-day remote schedule supported by weekly deliverables.',
    modelResponse:
      'Dear Ms. Chen, I am writing to propose transitioning our documentation sprint schedule to two remote days per week while maintaining core in-office collaboration Tuesdays through Thursdays.',
    examinerNoteEn:
      'Appropriate formal register, immediate purpose statement, and concrete team coverage plan.',
    examinerNoteFa:
      'لحن کاملاً حرفه‌ای و بیان شفاف هدف در پاراگراف اول نامه.',
    upgradedTerms: ['transition', 'deliverable', 'in-office collaboration'],
  },
  {
    trackSlug: 'ielts-general',
    examId: 'ielts_general',
    slug: 'lifelong-vocational-retraining',
    title: 'Adult Vocational Reskilling Initiatives',
    titleFa: 'اهمیت بازآموزی شغلی بزرگسالان',
    taskLabel: 'IELTS GT Task 2 Essay',
    scoreBadge: 'Band 8.0 Model',
    prompt: 'Why should employers co-finance mid-career technical reskilling for experienced staff?',
    modelResponse:
      'Co-financing short modular credentials retains institutional memory while preventing skill obsolescence during rapid automation shifts.',
    examinerNoteEn:
      'Develops practical workplace mechanisms rather than abstract generalities.',
    examinerNoteFa:
      'پرداختن به راهکارهای اجرایی محیط کار به جای کلی‌گویی.',
    upgradedTerms: ['institutional memory', 'obsolescence', 'modular credentials'],
  },
  {
    trackSlug: 'toefl-ibt',
    examId: 'toefl_ibt',
    slug: 'open-source-engineering-courses',
    title: 'Open-Source Benchmarks in Engineering Education',
    titleFa: 'استفاده از پروژه‌های متن‌باز در دانشگاه (Academic Discussion)',
    taskLabel: 'TOEFL 2026 Academic Discussion',
    scoreBadge: 'Band 6.0 (120/120)',
    prompt: 'Should introductory engineering courses integrate live open-source repositories alongside theory?',
    modelResponse:
      'Building on Maya’s point about foundational math, pairing core lectures with audited open-source pull requests teaches reproducibility, automated testing, and peer code review without sacrificing conceptual rigor.',
    examinerNoteEn:
      'Synthesizes peer contributions organically and maintains concise 120+ word precision.',
    examinerNoteFa:
      'ارجاع طبیعی به دیدگاه دانشجوی هم‌کلاسی و افزودن استدلال جدید.',
    upgradedTerms: ['reproducibility', 'conceptual rigor', 'automated testing'],
  },
  {
    trackSlug: 'toefl-ibt',
    examId: 'toefl_ibt',
    slug: 'lab-equipment-maintenance-email',
    title: 'Resolving Shared Lab Calibration Delays (Write an Email)',
    titleFa: 'نگارش ایمیل اداری برای زمان‌بندی کالیبراسیون آزمایشگاه',
    taskLabel: 'TOEFL 2026 Write an Email',
    scoreBadge: 'Band 5.5 (110/120)',
    prompt: 'Email the campus lab coordinator to reschedule microscope calibration without delaying thesis teams.',
    modelResponse:
      'Subject: Proposed Night-Window Calibration for Optical Bench B — Could we schedule routine optical alignment for Friday evening so daytime thesis cohorts retain uninterrupted bench hours?',
    examinerNoteEn:
      'Direct subject line, polite request, and pragmatic schedule trade-off within 7 minutes.',
    examinerNoteFa:
      'موضوع ایمیل دقیق و پیشنهاد زمان جایگزین بدون ایجاد وقفه.',
    upgradedTerms: ['uninterrupted', 'alignment', 'cohort'],
  },
  {
    trackSlug: 'pte-academic',
    examId: 'pte_academic',
    slug: 'renewable-microgrid-single-sentence',
    title: 'Coastal Microgrid Resilience (Single-Sentence Summary)',
    titleFa: 'خلاصه‌نویسی تک‌جمله‌ای PTE (Summarize Written Text)',
    taskLabel: 'PTE Summarize Written Text',
    scoreBadge: '86 / 90 Model',
    prompt: 'Summarize the 300-word passage in one grammatical sentence between 5 and 75 words.',
    modelResponse:
      'Decentralized coastal microgrids enhance municipal resilience by integrating rooftop photovoltaics with battery storage, thereby isolating critical clinics from severe storm outages and lowering peak transmission losses.',
    examinerNoteEn:
      '42 words, single main clause + participial modifier, zero period mid-sentence.',
    examinerNoteFa:
      'تک‌جمله‌ای استاندارد ۴۲ کلمه‌ای با رعایت کامل محدودیت نقطه‌گذاری.',
    upgradedTerms: ['decentralized', 'thereby', 'transmission losses'],
  },
  {
    trackSlug: 'pte-academic',
    examId: 'pte_academic',
    slug: 'ai-tutoring-personalized-feedback',
    title: 'Automated Feedback vs. Seminar Mentorship',
    titleFa: 'مقاله PTE درباره بازخورد هوشمند و آموزش کلاسی',
    taskLabel: 'PTE Write Essay',
    scoreBadge: '85 / 90 Model',
    prompt: 'Discuss how formative AI diagnostics complement seminar instructors in university writing centers.',
    modelResponse:
      'Automated diagnostics excel at flagging surface syntax patterns instantly, freeing faculty mentors to focus office hours on argument architecture and evidence synthesis.',
    examinerNoteEn:
      'Crisp 240-word structure with zero spelling variance and balanced paragraph symmetry.',
    examinerNoteFa:
      'بندی‌بندی استاندارد ۲۰۰ تا ۳۰۰ کلمه با واژگان علمی دقیق.',
    upgradedTerms: ['formative', 'argument architecture', 'evidence synthesis'],
  },
  {
    trackSlug: 'duolingo-english-test',
    examId: 'det',
    slug: 'community-botanical-conservatory',
    title: 'Community Botanical Conservatory (Write About the Photo)',
    titleFa: 'توصیف تصویر گلخانه شهری (DET Write About the Photo)',
    taskLabel: 'DET Write About the Photo (60s)',
    scoreBadge: '145 / 160 Production',
    prompt: 'Write three detailed sentences describing the glasshouse atrium and visitors in the scene.',
    modelResponse:
      'Sunlight streams through arched steel trusses across a lush indoor conservatory lined with palm fronds and terraced ferns. Along the stone walkway in the foreground, a child points upward toward a hanging epiphyte display while two visitors pause beside an interpretive plaque.',
    examinerNoteEn:
      'Specific spatial prepositions ("in the foreground") and vivid concrete nouns.',
    examinerNoteFa:
      'استفاده از قیدهای مکانی دقیق و اسم‌های ملموس در زمان کوتاه ۶۰ ثانیه.',
    upgradedTerms: ['lush', 'foreground', 'interpretive'],
  },
  {
    trackSlug: 'duolingo-english-test',
    examId: 'det',
    slug: 'bicycle-lane-pedestrian-plaza',
    title: 'Pedestrian-First Transit Plazas (Interactive Writing)',
    titleFa: 'رایتینگ تعاملی دو‌مرحله‌ای DET',
    taskLabel: 'DET Interactive Writing',
    scoreBadge: '140 / 160 Literacy',
    prompt: 'Respond in 5 minutes to a city proposal closing central streets to private cars, then expand for 3 minutes.',
    modelResponse:
      'Converting congested retail blocks into protected bike lanes and pedestrian plazas increases local foot traffic for independent merchants while cutting street-level particulate pollution.',
    examinerNoteEn:
      'Immediate thesis statement followed by commercial + environmental evidence in Step 2.',
    examinerNoteFa:
      'شروع سریع با نظر اصلی و گسترش استدلال در گام ۳ دقیقه‌ای دوم.',
    upgradedTerms: ['foot traffic', 'particulate pollution', 'pedestrian-first'],
  },
];

export const SPEAKING_TOPICS_CATALOG: readonly SpeakingTopicEntry[] = [
  {
    trackSlug: 'ielts-academic',
    examId: 'ielts_academic',
    slug: 'quiet-public-library-space',
    title: 'A Public Learning Space You Enjoy Visiting',
    titleFa: 'توصیف یک کتابخانه یا فضای مطالعه آرام (Part 2)',
    partLabel: 'IELTS Part 2 Cue Card',
    prepSec: 60,
    responseSec: 120,
    prompt: 'Describe a quiet public library or study space you enjoy visiting, what makes its architecture comfortable, and why you feel productive there.',
    outlineBullets: [
      'Setting & lighting: timber desks, acoustic panels, daylight windows',
      'Personal routine: two-hour deep-reading blocks without phone alerts',
      'Why it helps: visual calmness reduces cognitive fatigue',
    ],
    highBandPhrases: ['acoustic insulation', 'conducive to deep focus', 'visual clutter'],
    tipFa: 'در ۶۰ ثانیه آماده‌سازی فقط ۶ کلمه کلیدی بنویسید و در صحبت با زمان‌های متنوع (گذشته و حال) روایت کنید.',
  },
  {
    trackSlug: 'ielts-academic',
    examId: 'ielts_academic',
    slug: 'scientific-literacy-public-debate',
    title: 'Scientific Literacy & Public Policy (Part 3)',
    titleFa: 'سواد علمی در جامعه (IELTS Part 3)',
    partLabel: 'IELTS Part 3 Discussion',
    prepSec: 0,
    responseSec: 60,
    prompt: 'How can researchers explain probabilistic climate or health findings more clearly to non-specialists?',
    outlineBullets: [
      'Replace jargon with everyday risk comparisons',
      'Show confidence ranges visually instead of single absolute numbers',
    ],
    highBandPhrases: ['communicate uncertainty', 'plain-language summary', 'public trust'],
    tipFa: 'در Part 3 مثال کلی و تحلیلی بزنید و از گفتن داستان شخصی صرف پرهیز کنید.',
  },
  {
    trackSlug: 'ielts-general',
    examId: 'ielts_general',
    slug: 'practical-workplace-skill',
    title: 'A Practical Skill You Learned on the Job',
    titleFa: 'توصیف یک مهارت عملی آموخته‌شده در محیط کار',
    partLabel: 'IELTS GT Part 2 Cue Card',
    prepSec: 60,
    responseSec: 120,
    prompt: 'Describe a practical workplace skill you picked up from a colleague and how it improved team workflows.',
    outlineBullets: [
      'Context & problem solved (e.g., automated spreadsheet validation)',
      'How a colleague coached you step by step',
      'Measurable time saved weekly',
    ],
    highBandPhrases: ['streamline handoffs', 'cut manual errors', 'peer mentoring'],
    tipFa: 'داستان واقعی محیط کار را با کلمات کاربردی و لحن طبیعی بیان کنید.',
  },
  {
    trackSlug: 'ielts-general',
    examId: 'ielts_general',
    slug: 'city-park-community-events',
    title: 'Neighborhood Parks & Weekend Markets',
    titleFa: 'پارک‌های محلی و رویدادهای اجتماعی (Part 1)',
    partLabel: 'IELTS GT Part 1 Intro',
    prepSec: 0,
    responseSec: 40,
    prompt: 'Do residents in your neighborhood gather at local parks during weekends?',
    outlineBullets: [
      'Direct yes + sensory detail (evening walking loops, tea kiosks)',
      'Short contrast between summer evenings and winter mornings',
    ],
    highBandPhrases: ['social hub', 'intergenerational space', 'shaded walkways'],
    tipFa: 'پاسخ Part 1 را بین ۲۰ تا ۳۰ ثانیه در ۲ یا ۳ جمله کامل نگه دارید.',
  },
  {
    trackSlug: 'toefl-ibt',
    examId: 'toefl_ibt',
    slug: 'zero-prep-campus-interview',
    title: 'Zero-Prep Interview: Choosing Research Electives',
    titleFa: 'مصاحبه فوری بدون زمان آماده‌سازی (تافل ۲۰۲۶)',
    partLabel: 'TOEFL 2026 Take an Interview',
    prepSec: 0,
    responseSec: 45,
    prompt: 'Immediate prompt: When choosing university electives, do you prioritize practical portfolio projects or theoretical depth?',
    outlineBullets: [
      'Instant stance in first 4 seconds ("I lean toward project-heavy electives...")',
      'One concrete example + quick wrap-up before 45s finishes',
    ],
    highBandPhrases: ['bridge theory with practice', 'tangible portfolio artifact', 'steep learning curve'],
    tipFa: 'در تافل ۲۰۲۶ زمان Prep وجود ندارد؛ بلافاصله با جمله موضع‌گیری شروع کنید تا وقفه‌ای ثبت نشود.',
  },
  {
    trackSlug: 'toefl-ibt',
    examId: 'toefl_ibt',
    slug: 'listen-and-repeat-campus-tour',
    title: 'Listen & Repeat: Engineering Makerspace Tour',
    titleFa: 'شنیدن و تکرار جملات محیط دانشگاهی (TOEFL 2026)',
    partLabel: 'TOEFL 2026 Listen & Repeat',
    prepSec: 0,
    responseSec: 15,
    prompt: 'Listen once to the campus guide’s sentence about 3D printer safety reservations and repeat verbatim with natural stress.',
    outlineBullets: [
      'Chunk the clause into meaning groups rather than single words',
      'Match rising/falling intonation on key nouns',
    ],
    highBandPhrases: ['reservation window', 'ventilator switch', 'bench safety'],
    tipFa: 'روی ریتم و تکیه کلمات کلیدی تمرکز کنید تا سیستم تلفظ و روانی نمره کامل بدهد.',
  },
  {
    trackSlug: 'pte-academic',
    examId: 'pte_academic',
    slug: 'read-aloud-ocean-acoustics',
    title: 'Read Aloud: Marine Bioacoustics Monitoring',
    titleFa: 'روان‌خوانی متن علمی با لحن طبیعی (PTE Read Aloud)',
    partLabel: 'PTE Read Aloud',
    prepSec: 35,
    responseSec: 40,
    prompt: 'Hydrophone arrays deployed along shipping corridors allow marine biologists to map seasonal whale migrations without disturbing fragile pods.',
    outlineBullets: [
      'Use 35s prep to softly rehearse "hydrophone arrays" & "biologists"',
      'Maintain steady ~135 WPM pace without skipping trailing /s/ or /ed/ endings',
    ],
    highBandPhrases: ['hydrophone arrays', 'shipping corridors', 'fragile pods'],
    tipFa: 'پس از بوق شروع در کمتر از ۳ ثانیه خواندن را آغاز کنید تا میکروفون متوقف نشود.',
  },
  {
    trackSlug: 'pte-academic',
    examId: 'pte_academic',
    slug: 'describe-image-transit-modal-chart',
    title: 'Describe Image: Commuter Mode Share Breakdown',
    titleFa: 'توصیف نمودار حمل‌ونقل شهری (PTE Describe Image)',
    partLabel: 'PTE Describe Image',
    prepSec: 25,
    responseSec: 40,
    prompt: 'Speak clearly for 40 seconds summarizing the stacked bar chart comparing rail, bus, bicycle, and car trips.',
    outlineBullets: [
      'Chart type + axis units -> highest category -> lowest category -> closing conclusion',
    ],
    highBandPhrases: ['the bar chart illustrates', 'accounts for the largest share', 'in stark contrast'],
    tipFa: 'پیوستگی گفتار بدون مکث طولانی حتی از جزئیات عددی فرعی مهم‌تر است.',
  },
  {
    trackSlug: 'duolingo-english-test',
    examId: 'det',
    slug: 'speak-about-photo-workshop',
    title: 'Speak About the Photo: Ceramics Workshop Studio',
    titleFa: 'صحبت فوری درباره تصویر کارگاه سفالگری (DET)',
    partLabel: 'DET Speak About the Photo',
    prepSec: 20,
    responseSec: 90,
    prompt: 'Examine the workshop photograph for 20 seconds, then describe the tools, lighting, and artisan posture aloud for 90 seconds.',
    outlineBullets: [
      'Overall scene -> foreground action -> background shelves -> mood/inference',
    ],
    highBandPhrases: ['carefully balanced', 'natural north-facing light', 'well-worn apron'],
    tipFa: 'ابتدا کلیت تصویر، سپس مرکز صحنه، پس‌زمینه و در پایان یک نتیجه‌گیری کوتاه بگویید.',
  },
  {
    trackSlug: 'duolingo-english-test',
    examId: 'det',
    slug: 'extended-speaking-urban-trees',
    title: 'Extended Speaking Sample: Urban Tree Canopies',
    titleFa: 'نمونه اسپیکینگ تحلیلی DET (سایه‌بان شهری)',
    partLabel: 'DET Speaking Sample',
    prepSec: 30,
    responseSec: 180,
    prompt: 'Discuss how municipal tree-planting initiatives reduce urban heat islands and improve neighborhood mental well-being.',
    outlineBullets: [
      'Thermal cooling benefit via shade + evapotranspiration',
      'Long-term watering & maintenance challenge in dry summers',
    ],
    highBandPhrases: ['urban heat island', 'evapotranspiration', 'maintenance budget'],
    tipFa: '۳۰ ثانیه قبل از ضبط فقط محورهای اصلی دو پاراگراف گفتاری را در ذهن مرتب کنید.',
  },
];

export function getVocabCategoriesForBuild(): readonly VocabCategoryPageData[] {
  const byCategory = new Map<string, SeedVocabCard[]>();
  for (const card of STARTER_VOCAB_CARDS) {
    const arr = byCategory.get(card.topicTag) ?? [];
    arr.push(card);
    byCategory.set(card.topicTag, arr);
  }

  const pages: VocabCategoryPageData[] = [];
  for (const track of TRACK_META) {
    for (const [category, cards] of byCategory.entries()) {
      const labels = CATEGORY_LABELS[category] ?? { en: category, fa: category };
      pages.push({
        trackSlug: track.slug,
        examId: track.examId,
        category,
        categoryLabelEn: labels.en,
        categoryLabelFa: labels.fa,
        cards,
      });
    }
  }
  return pages;
}

export function getWritingSampleBySlug(
  trackSlug: string,
  slug: string,
): WritingSampleEntry | undefined {
  return WRITING_SAMPLES_CATALOG.find(
    (entry) => entry.trackSlug === trackSlug && entry.slug === slug,
  );
}

export function getSpeakingTopicBySlug(
  trackSlug: string,
  slug: string,
): SpeakingTopicEntry | undefined {
  return SPEAKING_TOPICS_CATALOG.find(
    (entry) => entry.trackSlug === trackSlug && entry.slug === slug,
  );
}
