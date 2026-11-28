import type { SupportedExamId } from '@mockza/domain';

export type ExamPillarSlug =
  | 'ielts-academic'
  | 'ielts-general'
  | 'toefl-ibt'
  | 'pte-academic'
  | 'duolingo-english-test';

export interface ExamPillarFaqItem {
  readonly question: string;
  readonly answer: string;
}

export interface SampleAnnotatedEssay {
  readonly id: string;
  readonly examLabel: string;
  readonly scoreBadge: string;
  readonly promptTitle: string;
  readonly excerpt: string;
  readonly examinerNote: string;
  readonly upgradedTerms: readonly string[];
}

export interface PublicVocabEntry {
  readonly headword: string;
  readonly ipa: string;
  readonly topic: string;
  readonly definition: string;
  readonly example: string;
  readonly glossFa?: string;
}

export interface ExamPillarGuide {
  readonly slug: ExamPillarSlug;
  readonly examId: SupportedExamId;
  readonly name: string;
  readonly headline: string;
  readonly summary: string;
  readonly scoreScaleLabel: string;
  readonly durationLabel: string;
  readonly keyFacts: readonly { readonly label: string; readonly value: string }[];
  readonly sectionsSummary: readonly string[];
  readonly desktopAdvantage: string;
  readonly faqs: readonly ExamPillarFaqItem[];
}

export interface PublicSiteCopy {
  readonly brandTitle: string;
  readonly navHome: string;
  readonly navCalculators: string;
  readonly navSamples: string;
  readonly navVocab: string;
  readonly navOpenApp: string;
  readonly heroHeadline: string;
  readonly heroSubtitle: string;
  readonly keyFactsHeading: string;
  readonly examPillarsHeading: string;
  readonly ctaDiagnostic: string;
  readonly ctaCatalog: string;
}

export const GLB_PUBLIC_COPY: PublicSiteCopy = {
  brandTitle: 'Mockza',
  navHome: 'Exams',
  navCalculators: 'Score Calculators',
  navSamples: 'Sample Essays',
  navVocab: 'Academic Vocab',
  navOpenApp: 'Start Practicing',
  heroHeadline: 'Desktop-First Simulator for IELTS, TOEFL iBT 2026, PTE & DET',
  heroSubtitle:
    'Train inside authentic desktop split-pane workspaces with UTF-16 passage highlighting, studio audio locks, crash-safe essay drafting, SM-2 spaced repetition, and AI rubric span reviews.',
  keyFactsHeading: 'Platform Key Facts',
  examPillarsHeading: '5 Official-Aligned Exam Simulators',
  ctaDiagnostic: 'Start 10-Min Level Check',
  ctaCatalog: 'Browse Free Packs',
};

export const GLB_EXAM_PILLARS: readonly ExamPillarGuide[] = [
  {
    slug: 'ielts-academic',
    examId: 'ielts_academic',
    name: 'IELTS Academic',
    headline: 'IELTS Academic Desktop Computer-Delivered Simulator',
    summary:
      'Practice full computer-delivered IELTS Academic Reading (55%/45% split pane with inline highlighting), linear-locked Listening, Task 1 Charts + Task 2 Essays, and 3-Part Speaking.',
    scoreScaleLabel: 'Band 0.0 – 9.0 (0.5 increments)',
    durationLabel: '2h 44m Total',
    keyFacts: [
      { label: 'Scale', value: '0.0 – 9.0 (0.5 steps)' },
      { label: 'Sections', value: 'Listening · Reading · Writing · Speaking' },
      { label: 'Writing Tasks', value: 'Task 1 Visual Chart (150w+) & Task 2 Essay (250w+)' },
      { label: 'Speaking Format', value: 'Part 1 Intro, Part 2 Cue Card (60s prep), Part 3 Discussion' },
    ],
    sectionsSummary: [
      'Listening (30 min · 4 parts · 1-play exam audio lock in Exam Mode)',
      'Reading (60 min · 3 passages · UTF-16 yellow/mint/coral highlights & margin notes)',
      'Writing (60 min · interactive zoomable SVG chart stimulus + distraction-free essay pane)',
      'Speaking (11–14 min · 60fps waveform microphone studio with Part 2 60s prep & notes)',
    ],
    desktopAdvantage:
      'Resizable dual panes eliminate mobile tab switching between reading passages/charts and questions.',
    faqs: [
      {
        question: 'Does the Reading pane support highlights and notes like Computer IELTS?',
        answer:
          'Yes. Select any passage span on desktop to highlight in yellow, mint, or coral, attach a margin note, or save the word straight to your SM-2 vocabulary deck.',
      },
      {
        question: 'How is the IELTS Reading and Listening band estimated locally?',
        answer:
          'Objective packs run our deterministic LocalObjectiveScorer immediately offline against 40-item calibrated tables or proportional sample scaling.',
      },
    ],
  },
  {
    slug: 'ielts-general',
    examId: 'ielts_general',
    name: 'IELTS General Training',
    headline: 'IELTS General Training Desktop Simulator & GT Band Converter',
    summary:
      'Master everyday workplace Reading passages, GT-specific band tables, Formal/Semi-Formal/Informal Letters (Task 1 General), and Task 2 Essays.',
    scoreScaleLabel: 'Band 0.0 – 9.0 (GT Reading Table)',
    durationLabel: '2h 44m Total',
    keyFacts: [
      { label: 'Scale', value: '0.0 – 9.0 (GT-calibrated Reading thresholds)' },
      { label: 'Task 1 Writing', value: 'Formal / Semi-Formal / Informal Letter (150w+)' },
      { label: 'Reading Texts', value: 'Workplace & general interest notices + extended prose' },
    ],
    sectionsSummary: [
      'Listening (30 min · identical shared IELTS Listening format)',
      'General Training Reading (60 min · workplace & social survival texts with GT scoring)',
      'Writing (60 min · Task 1 Letter register rubric + Task 2 Essay)',
      'Speaking (11–14 min · full 3-part recorded interview evaluation)',
    ],
    desktopAdvantage:
      'Keyboard-fast TRUE/FALSE/NOT GIVEN, YES/NO/NOT GIVEN, matching headings, and summary gap fill shortcuts.',
    faqs: [
      {
        question: 'Does IELTS General Training use a stricter Reading raw-to-band curve?',
        answer:
          'Yes. General Training Reading applies the official steeper GT raw-to-band conversion curve automatically whenever the GT track is active.',
      },
    ],
  },
  {
    slug: 'toefl-ibt',
    examId: 'toefl_ibt',
    name: 'TOEFL iBT 2026',
    headline: 'TOEFL iBT 2026 Desktop Simulator (1.0–6.0 Band + 0–120 Concordance)',
    summary:
      'Train specifically for the 2026 TOEFL iBT scale (1.0–6.0 in 0.5 steps) with adaptive Reading/Listening, Build a Sentence, Write an Email, Academic Discussion, and zero-prep Interview speaking.',
    scoreScaleLabel: '1.0 – 6.0 (0.5 steps · + 0–120 bridge)',
    durationLabel: '90 min Total',
    keyFacts: [
      { label: 'Scale', value: '1.0 – 6.0 (2026 official band scale + legacy 0–120 estimate)' },
      { label: 'Writing Tasks', value: 'Build a Sentence · Write an Email (85w+) · Academic Discussion (100w+)' },
      { label: 'Speaking Format', value: 'Listen & Repeat + zero-prep Take an Interview' },
    ],
    sectionsSummary: [
      'Adaptive Reading & Listening modules with computerized response mechanics',
      'Build a Sentence interactive clause-order workspace',
      'Write an Email & Academic Discussion split-pane editors',
      'Zero-prep Take an Interview speaking capture (immediate recording without false countdown)',
    ],
    desktopAdvantage:
      'Displays both 2026 1.0–6.0 official scores and estimated 0–120 university admission equivalents side by side.',
    faqs: [
      {
        question: 'How does Mockza convert 2026 TOEFL 1.0–6.0 scores to 0–120?',
        answer:
          'Every dashboard and evaluation view applies ETS-aligned concordance points (6.0 -> 117, 5.5 -> 110, 5.0 -> 100, down to 1.0 -> 5) deterministically.',
      },
    ],
  },
  {
    slug: 'pte-academic',
    examId: 'pte_academic',
    name: 'PTE Academic',
    headline: 'PTE Academic GSE Desktop Simulator (10–90 Scale)',
    summary:
      'Drill integrated computer-scored Speaking & Writing, Re-order Paragraphs drag/keyboard sequences, Single-Sentence Summary rule checks (5–75 words), Describe Image charts, and Dictation.',
    scoreScaleLabel: '10 – 90 GSE (1-point steps)',
    durationLabel: '120 min Total',
    keyFacts: [
      { label: 'Scale', value: '10 – 90 Global Scale of English (1-point steps)' },
      { label: 'Reading Highlight', value: 'Keyboard & drag Re-order Paragraphs (`Alt+Up/Down`)' },
      { label: 'Writing Rule Check', value: 'Summarize Written Text 1-sentence & 5–75w live guard' },
    ],
    sectionsSummary: [
      'Speaking & Writing (Read Aloud, Repeat Sentence, Describe Image, Single-Sentence Summary, Essay)',
      'Reading (Fill in the Blanks + Re-order Paragraphs with canonical pipe-token scoring)',
      'Listening (Summarize Spoken Text + Write from Dictation)',
    ],
    desktopAdvantage:
      'Enforces single-sentence & 5–75 word rules live in the Summarize Written Text editor and supports Alt+Arrow sequence reordering.',
    faqs: [
      {
        question: 'Can I practice Re-order Paragraphs using keyboard shortcuts?',
        answer:
          'Yes. Click, drag-and-drop, or press Alt+ArrowUp / Alt+ArrowDown to move sentence blocks rapidly on desktop.',
      },
    ],
  },
  {
    slug: 'duolingo-english-test',
    examId: 'det',
    name: 'Duolingo English Test',
    headline: 'DET Adaptive Desktop Simulator (10–160 Scale & 4 Subscores)',
    summary:
      'Prepare for the adaptive Duolingo English Test with Literacy, Comprehension, Conversation, and Production subscore breakdowns, Write About the Photo, Interactive Writing, and zero-prep Speaking.',
    scoreScaleLabel: '10 – 160 (5-point steps)',
    durationLabel: '60 min Total',
    keyFacts: [
      { label: 'Scale', value: '10 – 160 (5-point quantized steps)' },
      { label: 'Integrated Subscores', value: 'Literacy · Comprehension · Conversation · Production' },
      { label: 'Writing & Speaking', value: 'Write About the Photo (60s) · Interactive Writing · Speaking Sample' },
    ],
    sectionsSummary: [
      'Adaptive Reading & Listening dictation/comprehension modules',
      '1-minute Write About the Photo + 8-minute Interactive Writing split workspace',
      'Speak About the Photo & Extended Speaking Sample studio',
    ],
    desktopAdvantage:
      'Computes all 4 DET subscores directly from skill performance pairs (Literacy, Comprehension, Conversation, Production).',
    faqs: [
      {
        question: 'How are the 4 DET integrated subscores computed?',
        answer:
          'Literacy combines Reading & Writing, Comprehension combines Reading & Listening, Conversation combines Listening & Speaking, and Production combines Writing & Speaking.',
      },
    ],
  },
];

export const GLB_SAMPLE_ESSAYS: readonly SampleAnnotatedEssay[] = [
  {
    id: 'ielts-t2-urban-transit',
    examLabel: 'IELTS Writing Task 2',
    scoreBadge: 'Band 8.5 Model',
    promptTitle: 'Public Rail Subsidies vs. Urban Highway Expansion',
    excerpt:
      'Expanding suburban expressways temporarily relieves bottlenecks yet induces additional commuter volume within five years. Conversely, dedicated light-rail corridors permanently shift modal share and stabilize per-capita transit emissions.',
    examinerNote:
      'Strong concession-contrast progression (CC 8.5) paired with precise collocations ("induces additional volume", "modal share").',
    upgradedTerms: ['induce', 'modal share', 'bottleneck'],
  },
  {
    id: 'toefl-2026-discussion',
    examLabel: 'TOEFL iBT 2026 · Academic Discussion',
    scoreBadge: 'Band 6.0 Model (120/120)',
    promptTitle: 'Open-Source Benchmarks in University Engineering Courses',
    excerpt:
      'While standardized textbooks solidify mathematical intuition, integrating live open-source repositories teaches students reproducibility, code review discipline, and regression profiling under realistic constraints.',
    examinerNote:
      'Engages directly with peer viewpoints, introduces original engineering nuance, and maintains compact lexical precision.',
    upgradedTerms: ['reproducibility', 'mitigate', 'solidify'],
  },
];

export const GLB_PUBLIC_VOCAB_ENTRIES: readonly PublicVocabEntry[] = [
  {
    headword: 'ubiquitous',
    ipa: '/juːˈbɪk.wɪ.təs/',
    topic: 'Technology',
    definition: 'Present, appearing, or found everywhere across modern environments.',
    example: 'Automated telemetry has become ubiquitous across regional logistics hubs.',
  },
  {
    headword: 'attenuate',
    ipa: '/əˈten.ju.eɪt/',
    topic: 'Science & Environment',
    definition: 'Reduce the force, severity, or intensity of an effect.',
    example: 'Coastal wetlands attenuate storm surges before floodwaters reach densely settled blocks.',
  },
  {
    headword: 'mitigate',
    ipa: '/ˈmɪt.ɪ.ɡeɪt/',
    topic: 'Urban Policy',
    definition: 'Make a harmful outcome or risk less severe or painful.',
    example: 'Off-peak transit pricing helps mitigate morning highway congestion.',
  },
  {
    headword: 'disparate',
    ipa: '/ˈdɪs.pər.ət/',
    topic: 'Research Methods',
    definition: 'Essentially different in kind and not readily comparable without normalization.',
    example: 'Concordance tables reconcile disparate scoring scales cleanly.',
  },
];
