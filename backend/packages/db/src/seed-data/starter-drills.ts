export interface SeedMicroDrillItem {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface SeedMicroDrill {
  drillId: string;
  edition: string;
  title: string;
  drillType: string;
  skill: string;
  durationSeconds: number;
  itemsJson: SeedMicroDrillItem[];
  isPublished: boolean;
}

export const STARTER_MICRO_DRILLS: SeedMicroDrill[] = [
  {
    drillId: 'ielts-micro-drill-01',
    edition: 'all',
    title: 'TFNG Speed Trap Identifier',
    drillType: 'speed_tfng',
    skill: 'reading',
    durationSeconds: 180,
    itemsJson: [
      {
        id: 'MD1-01',
        prompt:
          "Passage: The solar array generated 45 megawatts during the summer solstice, exceeding the town's baseline consumption of 40 megawatts.\nStatement: The solar array generated more power than the town needed during the summer solstice.",
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'TRUE',
        explanation: 'Direct comparison: 45 MW generated > 40 MW consumed.',
      },
      {
        id: 'MD1-02',
        prompt:
          "Passage: While wind power grew rapidly in the northern province, geothermal exploration remained confined to small experimental test wells.\nStatement: Geothermal energy became the northern province's primary source of industrial electricity.",
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        explanation:
          'The text states geothermal was confined to small experimental test wells, contradicting primary source.',
      },
      {
        id: 'MD1-03',
        prompt:
          'Passage: The municipal authority hired twelve additional civil engineers to inspect older bridge pilings across the river.\nStatement: The bridge inspection team discovered severe structural cracks in three bridges.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'NOT GIVEN',
        explanation: 'The hiring is mentioned, but what the inspection discovered is never stated.',
      },
    ],
    isPublished: true,
  },
  {
    drillId: 'ielts-micro-drill-02',
    edition: 'all',
    title: 'Academic Collocation Matcher',
    drillType: 'collocation_matcher',
    skill: 'reading',
    durationSeconds: 180,
    itemsJson: [
      {
        id: 'ielts-micro-drill-02-01',
        prompt: 'Match the best partner/paraphrase for: "mitigate"',
        options: [
          'an environment conducive to learning',
          'existing socioeconomic disparities',
          'the impact of climate change',
          'the kinetic power of marine tides',
        ],
        answer: 'the impact of climate change',
        explanation: 'mitigate -> the impact of climate change',
      },
      {
        id: 'ielts-micro-drill-02-02',
        prompt: 'Match the best partner/paraphrase for: "exacerbate"',
        options: [
          'an environment conducive to learning',
          'existing socioeconomic disparities',
          'the impact of climate change',
          'the kinetic power of marine tides',
        ],
        answer: 'existing socioeconomic disparities',
        explanation: 'exacerbate -> existing socioeconomic disparities',
      },
      {
        id: 'ielts-micro-drill-02-03',
        prompt: 'Match the best partner/paraphrase for: "foster"',
        options: [
          'an environment conducive to learning',
          'existing socioeconomic disparities',
          'the impact of climate change',
          'the kinetic power of marine tides',
        ],
        answer: 'an environment conducive to learning',
        explanation: 'foster -> an environment conducive to learning',
      },
      {
        id: 'ielts-micro-drill-02-04',
        prompt: 'Match the best partner/paraphrase for: "harness"',
        options: [
          'an environment conducive to learning',
          'existing socioeconomic disparities',
          'the impact of climate change',
          'the kinetic power of marine tides',
        ],
        answer: 'the kinetic power of marine tides',
        explanation: 'harness -> the kinetic power of marine tides',
      },
      {
        id: 'ielts-micro-drill-02-05',
        prompt: 'Match the best partner/paraphrase for: "scrutinize"',
        options: [
          'an environment conducive to learning',
          'existing socioeconomic disparities',
          'the empirical methodology',
          'the impact of climate change',
        ],
        answer: 'the empirical methodology',
        explanation: 'scrutinize -> the empirical methodology',
      },
    ],
    isPublished: true,
  },
  {
    drillId: 'ielts-micro-drill-03',
    edition: 'all',
    title: 'Listening Distractor Spotter',
    drillType: 'distractor_spotter',
    skill: 'listening',
    durationSeconds: 180,
    itemsJson: [
      {
        id: 'MD3-01',
        prompt:
          'A: Is the lecture on Monday the 14th? B: No, it was rescheduled to Wednesday the 16th.\nQuestion: What is the correct date of the lecture?',
        options: [],
        answer: 'Wednesday 16th',
        explanation: 'Monday 14th was the original canceled date.',
      },
      {
        id: 'MD3-02',
        prompt:
          "A: That will be \u00a345 for the textbook. B: But with student discount? A: Ah, then it's \u00a336.\nQuestion: How much does the student pay?",
        options: [],
        answer: '\u00a336',
        explanation: '\u00a345 was the non-discounted price.',
      },
    ],
    isPublished: true,
  },
  {
    drillId: 'ielts-micro-drill-04',
    edition: 'all',
    title: 'Paraphrase Recognition Speed Round',
    drillType: 'paraphrase_matcher',
    skill: 'reading',
    durationSeconds: 180,
    itemsJson: [
      {
        id: 'ielts-micro-drill-04-01',
        prompt: 'Match the best partner/paraphrase for: "ubiquitous"',
        options: [
          'highly profitable / commercially gainful',
          'historic / never previously recorded',
          'injurious / causing significant harm',
          'omnipresent / found everywhere',
        ],
        answer: 'omnipresent / found everywhere',
        explanation: 'ubiquitous -> omnipresent / found everywhere',
      },
      {
        id: 'ielts-micro-drill-04-02',
        prompt: 'Match the best partner/paraphrase for: "lucrative"',
        options: [
          'highly profitable / commercially gainful',
          'historic / never previously recorded',
          'injurious / causing significant harm',
          'omnipresent / found everywhere',
        ],
        answer: 'highly profitable / commercially gainful',
        explanation: 'lucrative -> highly profitable / commercially gainful',
      },
      {
        id: 'ielts-micro-drill-04-03',
        prompt: 'Match the best partner/paraphrase for: "detrimental"',
        options: [
          'highly profitable / commercially gainful',
          'historic / never previously recorded',
          'injurious / causing significant harm',
          'omnipresent / found everywhere',
        ],
        answer: 'injurious / causing significant harm',
        explanation: 'detrimental -> injurious / causing significant harm',
      },
      {
        id: 'ielts-micro-drill-04-04',
        prompt: 'Match the best partner/paraphrase for: "unprecedented"',
        options: [
          'highly profitable / commercially gainful',
          'historic / never previously recorded',
          'injurious / causing significant harm',
          'omnipresent / found everywhere',
        ],
        answer: 'historic / never previously recorded',
        explanation: 'unprecedented -> historic / never previously recorded',
      },
      {
        id: 'ielts-micro-drill-04-05',
        prompt: 'Match the best partner/paraphrase for: "tangible"',
        options: [
          'highly profitable / commercially gainful',
          'injurious / causing significant harm',
          'omnipresent / found everywhere',
          'palpable / concrete and measurable',
        ],
        answer: 'palpable / concrete and measurable',
        explanation: 'tangible -> palpable / concrete and measurable',
      },
    ],
    isPublished: true,
  },
];
