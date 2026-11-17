import type { DiagnosticBlockDef } from '@mockza/domain';

export interface DiagnosticWritingPromptDef {
  promptId: string;
  title: string;
  basePrompt: string;
  suggestedWordsLabel: string;
  supportiveFollowUp: string;
  extensionFollowUp: string;
}

export interface DiagnosticSpeakingPromptDef {
  promptId: string;
  title: string;
  basePrompt: string;
  cueLabels: [string, string, string];
  supportiveFollowUp: string;
  extensionFollowUp: string;
}

export interface DiagnosticWorkedExampleDef {
  skill: 'reading' | 'listening';
  passageOrTranscript: string;
  mediaObjectKey?: string;
  questionPrompt: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
  explanation: string;
}

export const DIAGNOSTIC_EXAM_SCALE_INFO = [
  {
    examId: 'ielts_academic',
    label: 'IELTS (Academic & General Training)',
    summary:
      'Official IELTS scores are reported from Band 0 to 9 in 0.5 steps across Listening, Reading, Writing, and Speaking. Official CEFR mappings are approximate.',
  },
  {
    examId: 'toefl_ibt',
    label: 'TOEFL iBT (2026 Scale)',
    summary:
      'For tests on or after January 21, 2026, ETS reports sections and overall scores on a 1–6 scale in 0.5 increments (with legacy 0–120 comparisons during the transition).',
  },
  {
    examId: 'det',
    label: 'Duolingo English Test (DET)',
    summary:
      'Official DET scores run from 10 to 160 in 5-point increments alongside subscores and integrated Literacy, Comprehension, Conversation, and Production metrics.',
  },
  {
    examId: 'pte_academic',
    label: 'PTE Academic',
    summary:
      'Official PTE Academic scores use the 10–90 Global Scale of English across four communicative skills.',
  },
] as const;

export const DIAGNOSTIC_WORKED_EXAMPLES: {
  reading: DiagnosticWorkedExampleDef;
  listening: DiagnosticWorkedExampleDef;
} = {
  reading: {
    skill: 'reading',
    passageOrTranscript:
      'The community kitchen opens at nine. Visitors must bring their own container if they want to take soup home.',
    questionPrompt: 'What do visitors need to take soup home?',
    options: ['A ticket', 'Their own container', 'An invitation'],
    correctIndex: 1,
    explanation:
      'The second sentence directly states: "Visitors must bring their own container if they want to take soup home."',
  },
  listening: {
    skill: 'listening',
    passageOrTranscript:
      'Speaker A: Did the morning yoga class stay in Room 4?\nSpeaker B: We actually moved it to Room 7 because of a floor repair.',
    mediaObjectKey: 'media/listening/diagnostic/example_reading_room.m4a',
    questionPrompt: 'Which room is the yoga class in now?',
    options: ['Room 4', 'Room 7', 'Room 9'],
    correctIndex: 1,
    explanation:
      'Room 4 was mentioned first as a question, and the second speaker corrected it to Room 7.',
  },
};

export const DIAGNOSTIC_READING_BANK: readonly DiagnosticBlockDef[] = [
  // A1 (25-40w)
  {
    blockId: 'DR-A1-1',
    skill: 'reading',
    tier: 'A1',
    scenarioId: 'community_spaces',
    title: 'Bus Stop Note',
    passageText:
      'The morning bus stops in front of the green park. On Sundays, the first bus leaves at eight thirty instead of seven.',
    minRequiredSeconds: 18,
    questions: [
      {
        questionId: 'DR-A1-1-Q1',
        prompt: 'Where does the morning bus stop?',
        options: [
          'In front of the green park',
          'Behind the train station',
          'Next to the post office',
        ],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-A1-1-Q2',
        prompt: 'When does the first Sunday bus leave?',
        options: ['At seven', 'At eight thirty', 'At nine'],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DR-A1-2',
    skill: 'reading',
    tier: 'A1',
    scenarioId: 'community_spaces',
    title: 'Garden Bench Sign',
    passageText:
      'Please put empty bottles in the blue bin near the gate. Water from the fountain is safe to drink, and dogs must stay on a lead.',
    minRequiredSeconds: 18,
    questions: [
      {
        questionId: 'DR-A1-2-Q1',
        prompt: 'Where should empty bottles go?',
        options: ['In the blue bin', 'On the bench', 'Under the fountain'],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-A1-2-Q2',
        prompt: 'What rule applies to dogs here?',
        options: ['They cannot enter', 'They must wear a lead', 'They must stay outside the gate'],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // A2 (25-40w)
  {
    blockId: 'DR-A2-1',
    skill: 'reading',
    tier: 'A2',
    scenarioId: 'community_spaces',
    title: 'Neighborhood Book Swap',
    passageText:
      'Last month, neighbors built a wooden shelf outside the bakery for free books. People leave novels they have finished and borrow new ones for the weekend without paying anything.',
    minRequiredSeconds: 20,
    questions: [
      {
        questionId: 'DR-A2-1-Q1',
        prompt: 'How much does it cost to borrow a book from the shelf?',
        options: ['One dollar', 'Five dollars', 'Nothing'],
        correctIndex: 2,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-A2-1-Q2',
        prompt: 'Why was the wooden shelf built?',
        options: [
          'So neighbors can share books',
          'So the bakery can sell magazines',
          'To store extra bread',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DR-A2-2',
    skill: 'reading',
    tier: 'A2',
    scenarioId: 'learning_routines',
    title: 'Evening Study Room',
    passageText:
      'The town study room used to close at six on weekdays. After several students asked for quiet evening tables, the council kept it open until nine from Tuesday to Thursday.',
    minRequiredSeconds: 20,
    questions: [
      {
        questionId: 'DR-A2-2-Q1',
        prompt: 'On which days does the study room stay open until nine?',
        options: ['Monday to Friday', 'Tuesday to Thursday', 'Only weekends'],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-A2-2-Q2',
        prompt: 'What led to the longer opening hours?',
        options: [
          'Fewer students arrived in the morning',
          'Staff wanted shorter weekend shifts',
          'Students requested quiet places to study later',
        ],
        correctIndex: 2,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // B1 (40-65w, 3 blocks so start + mixed + fallback paths are covered)
  {
    blockId: 'DR-B1-1',
    skill: 'reading',
    tier: 'B1',
    scenarioId: 'community_spaces',
    title: 'Friday Library Workshop',
    passageText:
      'The neighborhood library usually closes at six. This Friday, however, it will stay open until eight for a free workshop on digital photos. Visitors can attend the talk without booking ahead, though anyone who wants to borrow a practice tablet must reserve one online by Thursday evening.',
    minRequiredSeconds: 22,
    questions: [
      {
        questionId: 'DR-B1-1-Q1',
        prompt: 'When does the library close this Friday?',
        options: ['At six', 'At eight', 'On Thursday'],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-B1-1-Q2',
        prompt: 'Who needs to make an online reservation?',
        options: [
          'Anyone visiting the library',
          'Every speaker at the workshop',
          'Visitors who want to use a practice tablet',
        ],
        correctIndex: 2,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DR-B1-2',
    skill: 'reading',
    tier: 'B1',
    scenarioId: 'community_spaces',
    title: 'Shaded Market Courtyard',
    passageText:
      'Two summers ago, shopkeepers noticed fewer families lingered in the central courtyard at midday because direct sun made the stone benches too hot. After volunteers planted four fast-growing maple trees and hung cloth sails above the walkway, afternoon visits quickly recovered.',
    minRequiredSeconds: 22,
    questions: [
      {
        questionId: 'DR-B1-2-Q1',
        prompt: 'Why did fewer families stay in the courtyard at midday?',
        options: [
          'The benches became uncomfortable in strong sun',
          'Several nearby shops closed for renovations',
          'Parking fees increased across the street',
        ],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-B1-2-Q2',
        prompt: 'What effect did the trees and cloth sails have?',
        options: [
          'They blocked customers from seeing shop windows',
          'More people began spending afternoons there again',
          'Volunteers stopped caring for the plants',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DR-B1-3',
    skill: 'reading',
    tier: 'B1',
    scenarioId: 'learning_routines',
    title: 'Shared Tool Shed',
    passageText:
      'Instead of buying expensive drills they use once a year, residents in Maple District pay a small annual fee to borrow tools from a converted garage. Experienced volunteers check returned items every Saturday morning so beginners receive safe, working equipment.',
    minRequiredSeconds: 22,
    questions: [
      {
        questionId: 'DR-B1-3-Q1',
        prompt: 'How do residents gain access to the tool collection?',
        options: [
          'By donating new furniture',
          'By paying a modest yearly fee',
          'By working on Saturday shifts',
        ],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-B1-3-Q2',
        prompt: 'Why do volunteers inspect returned items weekly?',
        options: [
          'To ensure the tools remain safe for newcomers',
          'To sell older machines to local builders',
          'To charge extra fees for dirty handles',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // B2 (40-65w)
  {
    blockId: 'DR-B2-1',
    skill: 'reading',
    tier: 'B2',
    scenarioId: 'community_spaces',
    title: 'Street-Corner Pocket Parks',
    passageText:
      'Replacing two curbside parking spaces with timber planters and seating often alarms nearby merchants, who assume fewer car spaces automatically reduce daily sales. Yet surveys across three commercial streets showed steady or rising revenue: pedestrians walked past displays more slowly and stopped for coffee more often once traffic noise softened.',
    minRequiredSeconds: 24,
    questions: [
      {
        questionId: 'DR-B2-1-Q1',
        prompt: 'Why do shop owners initially worry about losing curbside parking?',
        options: [
          'They expect sales to drop when drivers have fewer spots',
          'They dislike paying extra fees for timber planters',
          'They fear delivery trucks will block the sidewalk',
        ],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-B2-1-Q2',
        prompt: 'How did the surveys challenge the merchants’ assumption?',
        options: [
          'By showing shoppers paid higher prices for parking',
          'By proving quieter walkways encouraged pedestrians to pause and buy',
          'By reporting that cyclists bought fewer groceries',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DR-B2-2',
    skill: 'reading',
    tier: 'B2',
    scenarioId: 'learning_routines',
    title: 'Short Daily Study vs Cramming',
    passageText:
      'Learners frequently mistake mental fatigue at the end of a three-hour weekend study block for lasting progress. Cognitive trials consistently indicate that twenty-minute recall sessions spaced across five days produce stronger long-term retention, even when total study minutes remain identical.',
    minRequiredSeconds: 24,
    questions: [
      {
        questionId: 'DR-B2-2-Q1',
        prompt: 'What common mistake do learners make with long study sessions?',
        options: [
          'Assuming tiredness proves they learned deeply',
          'Forgetting to bring a notebook',
          'Spending too much time reviewing easy words',
        ],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-B2-2-Q2',
        prompt: 'What does the passage imply about spaced 20-minute sessions?',
        options: [
          'They require twice as many total study hours',
          'They outperform single marathon blocks of equal total time',
          'They only work for advanced learners',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // C1 (60-80w)
  {
    blockId: 'DR-C1-1',
    skill: 'reading',
    tier: 'C1',
    scenarioId: 'community_spaces',
    title: 'Acoustic Design in Public Halls',
    passageText:
      'Many renovated community halls look striking with bare concrete walls and soaring glass windows, yet residents quietly avoid them during social evenings. Because hard surfaces reflect mid-frequency speech, overlapping conversations fuse into an exhausting hum, forcing visitors to raise their voices in an escalating spiral. Adding subtle felt panels beneath tables restores clarity without sacrificing the minimalist aesthetic.',
    minRequiredSeconds: 25,
    questions: [
      {
        questionId: 'DR-C1-1-Q1',
        prompt: 'What drives visitors to speak louder inside concrete halls?',
        options: [
          'Reflected voices merge into background glare, prompting louder speech',
          'Outdoor street noise leaks through thin window frames',
          'Event organizers play music above safe limits',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
      {
        questionId: 'DR-C1-1-Q2',
        prompt: 'Why does the author mention felt panels beneath tables?',
        options: [
          'To argue that concrete renovations are too expensive',
          'To show acoustic comfort can improve without altering visual style',
          'To criticize architects who ignore structural safety',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DR-C1-2',
    skill: 'reading',
    tier: 'C1',
    scenarioId: 'learning_routines',
    title: 'Measuring Real Fluency Gains',
    passageText:
      'Speeding through practice exercises often creates an illusion of mastery because short-term cues remain active in working memory. True communicative agility, however, shows up days later under mild pressure, when a speaker must select precise phrasing without rehearsed prompts. Assessments that reward only rapid recognition can therefore overestimate readiness for spontaneous conversation.',
    minRequiredSeconds: 25,
    questions: [
      {
        questionId: 'DR-C1-2-Q1',
        prompt: 'Why can rapid practice drills create false confidence?',
        options: [
          'Recent hints stay temporarily active rather than transferring to spontaneous use',
          'Working memory removes accurate grammar patterns',
          'Learners deliberately avoid checking answer keys',
        ],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DR-C1-2-Q2',
        prompt: 'What limitation of speed-only recognition tests is highlighted?',
        options: [
          'They penalize thoughtful learners with slow internet connections',
          'They overlook whether language holds up in unscripted speech',
          'They focus too heavily on regional pronunciation differences',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // C2 (60-80w)
  {
    blockId: 'DR-C2-1',
    skill: 'reading',
    tier: 'C2',
    scenarioId: 'community_spaces',
    title: 'The Paradox of Over-Curated Plazas',
    passageText:
      'Planners eager to eliminate idle loitering occasionally choreograph every square meter of a public plaza with scheduled markets and fixed seating layouts. While attendance figures initially climb, spontaneous civic life quietly thins out: residents become spectators at programmed events rather than co-authors of shared space, and small informal gatherings migrate elsewhere precisely because nothing remains unassigned.',
    minRequiredSeconds: 26,
    questions: [
      {
        questionId: 'DR-C2-1-Q1',
        prompt: 'How do initial attendance metrics mislead planners in the passage?',
        options: [
          'High headcounts can mask a decline in unscripted community interaction',
          'Scheduled markets underreport ticket revenue from visitors',
          'Fixed seating reduces the total physical capacity of the plaza',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
      {
        questionId: 'DR-C2-1-Q2',
        prompt: 'What causes informal gatherings to leave the plaza?',
        options: [
          'Excessive entry rules for evening events',
          'A lack of flexible, unprogrammed space for residents to shape',
          'Competition from indoor neighborhood cafés',
        ],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
    ],
  },
  {
    blockId: 'DR-C2-2',
    skill: 'reading',
    tier: 'C2',
    scenarioId: 'learning_routines',
    title: 'Precision vs Surface Complexity',
    passageText:
      'Advanced language users are sometimes advised to showcase rare idioms regardless of context, yet seasoned raters distinguish ornamental flourish from genuine rhetorical control. An unremarkable verb chosen to register an exact shade of skepticism does far more persuasive work than an ornate metaphor grafted onto an imprecise claim—and misapplied sophistication invites sharper scrutiny than plain clarity.',
    minRequiredSeconds: 26,
    questions: [
      {
        questionId: 'DR-C2-2-Q1',
        prompt: 'What contrast does the author draw regarding advanced vocabulary?',
        options: [
          'Rare idioms should replace ordinary verbs in formal essays',
          'Context-exact plain phrasing outweighs decorative but imprecise wording',
          'Raters ignore subtle skepticism when essays use simple grammar',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
      {
        questionId: 'DR-C2-2-Q2',
        prompt: 'What risk accompanies "misapplied sophistication"?',
        options: [
          'It slows reading speed only for non-native readers',
          'It attracts closer critical penalty than straightforward accuracy',
          'It forces writers to exceed recommended word limits',
        ],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
    ],
  },
];

export const DIAGNOSTIC_LISTENING_BANK: readonly DiagnosticBlockDef[] = [
  // A1 (10-15s)
  {
    blockId: 'DL-A1-1',
    skill: 'listening',
    tier: 'A1',
    scenarioId: 'community_spaces',
    title: 'Desk Hours',
    scriptText:
      'A: Excuse me, is the help desk open now? B: Sorry, we open at ten. You can wait in the café next door.',
    mediaObjectKey: 'media/listening/diagnostic/dl_a1_1.m4a',
    durationSeconds: 11,
    minRequiredSeconds: 18,
    questions: [
      {
        questionId: 'DL-A1-1-Q1',
        prompt: 'When does the help desk open?',
        options: ['At nine', 'At ten', 'At twelve'],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-A1-1-Q2',
        prompt: 'Where can the visitor wait?',
        options: ['In the café next door', 'Outside the park', 'At the bus stop'],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DL-A1-2',
    skill: 'listening',
    tier: 'A1',
    scenarioId: 'community_spaces',
    title: 'Garden Watering',
    scriptText:
      'A: Do we need to bring water cans today? B: No, they are already by the back door. Just wear comfortable shoes.',
    mediaObjectKey: 'media/listening/diagnostic/dl_a1_2.m4a',
    durationSeconds: 11,
    minRequiredSeconds: 18,
    questions: [
      {
        questionId: 'DL-A1-2-Q1',
        prompt: 'Where are the watering cans?',
        options: ['At home', 'By the back door', 'In the blue car'],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-A1-2-Q2',
        prompt: 'What does the speaker advise wearing?',
        options: ['Warm gloves', 'A raincoat', 'Comfortable shoes'],
        correctIndex: 2,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // A2 (12-16s)
  {
    blockId: 'DL-A2-1',
    skill: 'listening',
    tier: 'A2',
    scenarioId: 'community_spaces',
    title: 'Saturday Reading Group',
    scriptText:
      'A: Are we still reading chapter four on Saturday? B: Yes, but let us meet in the sunny garden behind the café because the indoor room is getting painted.',
    mediaObjectKey: 'media/listening/diagnostic/dl_a2_1.m4a',
    durationSeconds: 13,
    minRequiredSeconds: 20,
    questions: [
      {
        questionId: 'DL-A2-1-Q1',
        prompt: 'Where will the reading group meet?',
        options: ['In the indoor room', 'In the garden behind the café', 'At the train station'],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-A2-1-Q2',
        prompt: 'Why did they change the meeting spot?',
        options: ['The room is being painted', 'Too many people joined', 'The café closed early'],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DL-A2-2',
    skill: 'listening',
    tier: 'A2',
    scenarioId: 'learning_routines',
    title: 'Evening Language Exchange',
    scriptText:
      'A: Hi, is the Spanish practice table free to join? B: Yes, every Tuesday at six thirty. Just put your name on the sheet and bring a notebook if you like.',
    mediaObjectKey: 'media/listening/diagnostic/dl_a2_2.m4a',
    durationSeconds: 13,
    minRequiredSeconds: 20,
    questions: [
      {
        questionId: 'DL-A2-2-Q1',
        prompt: 'When does the Spanish practice table meet?',
        options: ['Tuesdays at six thirty', 'Thursdays at five', 'Saturdays at noon'],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-A2-2-Q2',
        prompt: 'What must new visitors do to join?',
        options: [
          'Pay a monthly ticket',
          'Write their name on the sheet',
          'Pass a short grammar test',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // B1 (14-18s, 3 clips covering start + mixed/confirm)
  {
    blockId: 'DL-B1-1',
    skill: 'listening',
    tier: 'B1',
    scenarioId: 'community_spaces',
    title: 'Art Club Schedule Change',
    scriptText:
      'A: Are we still meeting for the community art club on Wednesday afternoon? B: Actually, the main hall is booked for a school fair then, so we moved our session to Thursday. Please bring a pencil; sketching paper will be provided.',
    mediaObjectKey: 'media/listening/diagnostic/dl_b1_1.m4a',
    durationSeconds: 15,
    minRequiredSeconds: 22,
    questions: [
      {
        questionId: 'DL-B1-1-Q1',
        prompt: 'Which day will the art club meet?',
        options: ['Wednesday', 'Thursday', 'Friday'],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-B1-1-Q2',
        prompt: 'What should attendees bring themselves?',
        options: ['A pencil', 'Sketching paper', 'Paint brushes'],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DL-B1-2',
    skill: 'listening',
    tier: 'B1',
    scenarioId: 'community_spaces',
    title: 'Bike Repair Morning',
    scriptText:
      'A: How busy was the free bike repair stand last weekend? B: Quiet at nine, then packed after ten thirty. Next time we should bring an extra air pump because three cyclists had flat tires waiting in line.',
    mediaObjectKey: 'media/listening/diagnostic/dl_b1_2.m4a',
    durationSeconds: 15,
    minRequiredSeconds: 22,
    questions: [
      {
        questionId: 'DL-B1-2-Q1',
        prompt: 'When did the repair stand get crowded?',
        options: ['Before nine', 'After ten thirty', 'In the late evening'],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-B1-2-Q2',
        prompt: 'What improvement does the speaker suggest for next time?',
        options: [
          'Bring an extra air pump',
          'Cancel early morning slots',
          'Charge for spare tires',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DL-B1-3',
    skill: 'listening',
    tier: 'B1',
    scenarioId: 'learning_routines',
    title: 'Podcast Walking Habit',
    scriptText:
      'A: Did you manage to finish that history audio book yet? B: Almost! Listening while walking to work helped way more than sitting at my desk at night, when I kept falling asleep after ten minutes.',
    mediaObjectKey: 'media/listening/diagnostic/dl_b1_3.m4a',
    durationSeconds: 15,
    minRequiredSeconds: 22,
    questions: [
      {
        questionId: 'DL-B1-3-Q1',
        prompt: 'When did the speaker listen most successfully?',
        options: ['During morning walks to work', 'Late at a desk at night', 'During lunch breaks'],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-B1-3-Q2',
        prompt: 'What happened when they tried listening at night?',
        options: [
          'The audio file stopped working',
          'They got sleepy very quickly',
          'Traffic noise made it impossible',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // B2 (16-19s)
  {
    blockId: 'DL-B2-1',
    skill: 'listening',
    tier: 'B2',
    scenarioId: 'community_spaces',
    title: 'Pocket Forest Watering Plan',
    scriptText:
      'A: Once the council drops off the young saplings on Tuesday, who checks the watering schedule? B: They actually pushed delivery back to Friday so soil sensors can be fitted first. Neighbors on Maple Row offered to handle morning watering if the heat rises.',
    mediaObjectKey: 'media/listening/diagnostic/dl_b2_1.m4a',
    durationSeconds: 17,
    minRequiredSeconds: 24,
    questions: [
      {
        questionId: 'DL-B2-1-Q1',
        prompt: 'Why was tree delivery moved from Tuesday to Friday?',
        options: [
          'Soil sensors need to be installed first',
          'Maple Row neighbors are away until Friday',
          'Too few saplings arrived at the nursery',
        ],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-B2-1-Q2',
        prompt: 'Who volunteered to water the trees in hot weather?',
        options: ['City parks staff', 'Residents living on Maple Row', 'Local school gardeners'],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DL-B2-2',
    skill: 'listening',
    tier: 'B2',
    scenarioId: 'learning_routines',
    title: 'Library Locker Trial',
    scriptText:
      'A: Have the new pickup lockers outside the library reduced evening queues at the front counter? B: Slightly, though half of our regular readers still come inside anyway because they like chatting with staff about what to borrow next.',
    mediaObjectKey: 'media/listening/diagnostic/dl_b2_2.m4a',
    durationSeconds: 16,
    minRequiredSeconds: 24,
    questions: [
      {
        questionId: 'DL-B2-2-Q1',
        prompt: 'How successful were the outdoor pickup lockers?',
        options: [
          'They completely emptied the front counter',
          'They reduced queues only a modest amount',
          'Readers rejected them due to broken doors',
        ],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-B2-2-Q2',
        prompt: 'Why do many regular visitors still step inside?',
        options: [
          'To ask staff for book recommendations and conversation',
          'To avoid standing outdoors in cold weather',
          'Because pickup lockers require a paid card',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // C1 (17-20s)
  {
    blockId: 'DL-C1-1',
    skill: 'listening',
    tier: 'C1',
    scenarioId: 'community_spaces',
    title: 'Quiet-Zone Café Policy',
    scriptText:
      'A: You sounded hesitant when the café announced laptop-free afternoons. Wouldn’t quieter tables bring more local regulars back? B: In theory, sure—provided they don’t rely on remote workers spending money between morning and evening rushes. Otherwise the calm atmosphere costs them their steadiest weekday margin.',
    mediaObjectKey: 'media/listening/diagnostic/dl_c1_1.m4a',
    durationSeconds: 18,
    minRequiredSeconds: 25,
    questions: [
      {
        questionId: 'DL-C1-1-Q1',
        prompt: 'What is Speaker B’s main reservation about banning laptops in the afternoon?',
        options: [
          'It risks losing dependable mid-day revenue from remote workers',
          'Locals prefer noisy tables over quiet afternoons',
          'Installing Wi-Fi locks costs too much to maintain',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
      {
        questionId: 'DL-C1-1-Q2',
        prompt: 'How does Speaker B characterize the morning and evening rushes?',
        options: [
          'Less predictable than mid-day sales',
          'Separate from the mid-day gap that remote workers bridge',
          'Too crowded for students with laptops',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DL-C1-2',
    skill: 'listening',
    tier: 'C1',
    scenarioId: 'learning_routines',
    title: 'Note-Taking vs Audio Review',
    scriptText:
      'A: Our study survey showed students who typed every word of a lecture scored lower than peers who jotted brief outlines. B: That tracks with memory studies—verbatim typing bypasses deeper processing. Still, pure outlines leave gaps when a speaker rattles off unfamiliar technical terms.',
    mediaObjectKey: 'media/listening/diagnostic/dl_c1_2.m4a',
    durationSeconds: 18,
    minRequiredSeconds: 25,
    questions: [
      {
        questionId: 'DL-C1-2-Q1',
        prompt: 'Why does Speaker B say verbatim typing led to lower scores?',
        options: [
          'Students can transcribe speech without deeply analyzing ideas',
          'Laptop keyboards distract nearby classmates',
          'Typed notes are harder to search before exams',
        ],
        correctIndex: 0,
        focusTag: 'explicit_detail',
      },
      {
        questionId: 'DL-C1-2-Q2',
        prompt: 'What drawback of short outlines does Speaker B acknowledge?',
        options: [
          'They take too long during fast discussions',
          'They may miss exact unfamiliar terminology',
          'They discourage reviewing slides after class',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },

  // C2 (18-20s)
  {
    blockId: 'DL-C2-1',
    skill: 'listening',
    tier: 'C2',
    scenarioId: 'community_spaces',
    title: 'Participatory Budgeting Trade-Off',
    scriptText:
      'A: Letting residents vote directly on park upgrades boosted turnout, yet three under-resourced streets still ended up empty-handed. B: Predictably so—majority ballots favor high-visibility amenities where well-organized blocks mobilize fast, which subtly cements existing advantages unless equity weights are built in beforehand.',
    mediaObjectKey: 'media/listening/diagnostic/dl_c2_1.m4a',
    durationSeconds: 19,
    minRequiredSeconds: 26,
    questions: [
      {
        questionId: 'DL-C2-1-Q1',
        prompt: 'According to Speaker B, why did under-resourced streets lose out?',
        options: [
          'Better-organized neighborhoods rallied votes around visible projects',
          'Voters misunderstood instructions on the online ballot',
          'Park funds ran out before counting was finished',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
      {
        questionId: 'DL-C2-1-Q2',
        prompt: 'What safeguard does Speaker B imply is necessary before voting?',
        options: [
          'Lowering voter turnout requirements',
          'Embedding explicit equity criteria into funding rules',
          'Replacing public ballots with private merchant panels',
        ],
        correctIndex: 1,
        focusTag: 'meaning_relationship',
      },
    ],
  },
  {
    blockId: 'DL-C2-2',
    skill: 'listening',
    tier: 'C2',
    scenarioId: 'learning_routines',
    title: 'Self-Correction in Natural Speech',
    scriptText:
      'A: Learners often apologize whenever they backtrack mid-sentence during oral interviews. B: Ironically, brief self-repair signals attentive monitoring, whereas overly rehearsed delivery sounds brittle the moment an unexpected follow-up knocks the speaker off script.',
    mediaObjectKey: 'media/listening/diagnostic/dl_c2_2.m4a',
    durationSeconds: 18,
    minRequiredSeconds: 26,
    questions: [
      {
        questionId: 'DL-C2-2-Q1',
        prompt: 'How does Speaker B interpret brief self-corrections while speaking?',
        options: [
          'As evidence of active linguistic monitoring rather than failure',
          'As a habit listeners find distracting in interviews',
          'As proof that a response was memorized beforehand',
        ],
        correctIndex: 0,
        focusTag: 'meaning_relationship',
      },
      {
        questionId: 'DL-C2-2-Q2',
        prompt: 'When does Speaker B say overly rehearsed speech breaks down?',
        options: [
          'During routine greetings at the start',
          'When an unscripted question disrupts memorized phrasing',
          'Whenever interviewers ask for personal opinions',
        ],
        correctIndex: 1,
        focusTag: 'explicit_detail',
      },
    ],
  },
];

export const DIAGNOSTIC_WRITING_PROMPT: DiagnosticWritingPromptDef = {
  promptId: 'DW-COMMUNITY-LIB-01',
  title: 'New Neighborhood Library',
  basePrompt:
    'A new library opens near you. Would you visit? Say when, explain why, and give one example. Write a few complete sentences in your own words.',
  suggestedWordsLabel: 'Target roughly 35–55 words (simple, clear sentences are welcome)',
  supportiveFollowUp: 'What is one thing you would like to do there, and why?',
  extensionFollowUp: 'What might make a visit difficult? Suggest a solution.',
};

export const DIAGNOSTIC_ALT_WRITING_PROMPT: DiagnosticWritingPromptDef = {
  promptId: 'DW-DAILY-ROUTINE-02',
  title: 'Evening Walk vs Indoor Screen Time',
  basePrompt:
    'Your friend wants to replace one hour of evening phone scrolling with a walk outside. What advice would you give, and why? Write a few complete sentences in your own words.',
  suggestedWordsLabel: 'Target roughly 35–55 words (simple, clear sentences are welcome)',
  supportiveFollowUp: 'When would you personally prefer to walk, and why?',
  extensionFollowUp: 'What might stop someone from keeping that routine after a busy workday?',
};

export const DIAGNOSTIC_SPEAKING_PROMPT: DiagnosticSpeakingPromptDef = {
  promptId: 'DS-FAVORITE-PLACE-01',
  title: 'A Place You Like to Spend Time',
  basePrompt:
    'Tell us about a place where you like to spend time. What do you do there, and why do you like it?',
  cueLabels: ['Place', 'What you do', 'Why'],
  supportiveFollowUp: 'What is one thing you do there?',
  extensionFollowUp: 'What would you change about that place, and why?',
};

export const DIAGNOSTIC_ALT_SPEAKING_PROMPT: DiagnosticSpeakingPromptDef = {
  promptId: 'DS-LEARN-SKILL-02',
  title: 'Learning Something New',
  basePrompt:
    'Tell us about a practical skill you learned recently or would like to learn. How did you practice it, and why is it useful?',
  cueLabels: ['Skill', 'How you practice', 'Why it helps'],
  supportiveFollowUp: 'Who helped you or what resource did you use?',
  extensionFollowUp: 'What is the hardest part of practicing that skill consistently?',
};
