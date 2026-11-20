"use strict";

const CONTENT = {
  tracks: [
    { id: "ielts-academic", name: "IELTS Academic", fa: "آیلتس آکادمیک", short: "IELTS", mark: "IA", scale: "0–9", min: 0, max: 9, step: .5, goal: 7, time: [60, 30, 60, 14], desc: ["University and professional registration", "برای دانشگاه و ثبت حرفه‌ای"] },
    { id: "ielts-general", name: "IELTS General", fa: "آیلتس جنرال", short: "IELTS", mark: "IG", scale: "0–9", min: 0, max: 9, step: .5, goal: 7, time: [60, 30, 60, 14], desc: ["Work, training, and migration", "برای کار، آموزش و مهاجرت"] },
    { id: "toefl-ibt", name: "TOEFL iBT", fa: "تافل iBT", short: "TOEFL", mark: "T", scale: "1–6", min: 1, max: 6, step: .5, goal: 5, time: [30, 29, 23, 8], desc: ["University admissions · 2026 format", "برای پذیرش دانشگاه · فرمت ۲۰۲۶"] },
    { id: "pte-academic", name: "PTE Academic", fa: "پی‌تی‌ای آکادمیک", short: "PTE", mark: "P", scale: "10–90", min: 10, max: 90, step: 1, goal: 65, time: [30, 31, 20, 15], desc: ["Integrated computer-based practice", "تمرین مهارت‌های ترکیبی در محیط کامپیوتری"] },
    { id: "det", name: "Duolingo English Test", fa: "آزمون زبان دولینگو", short: "DET", mark: "D", scale: "10–160", min: 10, max: 160, step: 5, goal: 120, time: [15, 15, 10, 10], desc: ["Short, adaptive English tasks", "تسک‌های کوتاه و تطبیقی زبان انگلیسی"] }
  ],
  skills: {
    reading: { name: ["Reading", "خواندن"], icon: "book", desc: ["Find the evidence behind each answer.", "شاهد هر پاسخ را در متن پیدا کن."] },
    listening: { name: ["Listening", "شنیدن"], icon: "audio", desc: ["Follow a speaker and catch the details.", "صحبت‌ها را دنبال کن و جزئیات را تشخیص بده."] },
    writing: { name: ["Writing", "نوشتن"], icon: "pen", desc: ["Turn a clear argument into a complete response.", "یک استدلال روشن را به پاسخی کامل تبدیل کن."] },
    speaking: { name: ["Speaking", "صحبت کردن"], icon: "mic", desc: ["Give a natural answer with a clear example.", "با یک مثال روشن، پاسخی طبیعی بده."] }
  },
  reading: {
    title: "A library after hours",
    text: [
      "When the town of Bellwick introduced evening hours at its public library, staff expected university students to account for most of the extra visits. A four-week trial revealed a different pattern: more than half of evening visitors were adults attending short courses or preparing for a change of career.",
      "The library originally planned to stay open until ten every weekday. Instead, it chose to open late on Tuesdays and Thursdays. These were the two dates with the highest demand in the trial, and the narrower schedule allowed librarians to arrange their shifts without increasing the total number of hours worked.",
      "One challenge was noise. Regular readers wanted a quiet place to concentrate, but the evening courses encouraged conversation. Adding movable partitions provided a simpler answer than constructing a new room. Groups could still work together, and solo readers could choose desks farther away.",
      "Staff are now monitoring whether the extra hours reach people who could not already visit during the day. For this reason, the library surveys first-time evening users. The project will be expanded only if those surveys show that the service is reaching a new audience."
    ],
    questions: [
      { text: "Who made up more than half of the evening visitors?", options: ["University students", "Adults learning or changing careers", "Regular library employees"], answer: 1, evidence: 0, why: "The trial found that more than half were attending short courses or preparing to change careers." },
      { text: "Why did the library choose Tuesday and Thursday?", options: ["They had the greatest demand", "The library had fewer courses then", "They were cheaper to heat"], answer: 0, evidence: 1, why: "The second paragraph identifies these as the two days with the highest demand." },
      { text: "What was introduced to manage the noise?", options: ["A separate building", "A shorter evening session", "Movable partitions"], answer: 2, evidence: 2, why: "Movable partitions allowed both quiet study and group conversation." },
      { text: "The project will expand as long as overall visits increase.", options: ["True", "False", "Not given"], answer: 1, evidence: 3, why: "Expansion depends on reaching a new audience. An increase in total visits alone is insufficient." }
    ]
  },
  listening: {
    title: "A visit to the coastal observatory",
    text: [
      "Hello, everyone. Before we leave on Saturday, let me confirm the arrangements for our visit to the Cape Fen Observatory. Please meet on the east side of the station at nine fifteen. That is a change from the west entrance mentioned in last week's message.",
      "The coach will take us to the visitor centre. Our guided tour starts at eleven, and afterwards there will be time to walk along the shore. Wear comfortable shoes, because the final part of the path is uneven.",
      "You can buy lunch at the visitor centre, but there is no shop along the shore. Bring a water bottle, please. Finally, if the weather changes, the outdoor walk will be replaced by a short workshop in the main hall."
    ],
    questions: [
      { text: "Where should visitors meet?", options: ["At the west entrance", "On the east side of the station", "Inside the visitor centre"], answer: 1, evidence: 0, why: "The speaker corrects the original location to the east side of the station." },
      { text: "At what time does the guided tour begin?", options: ["9:15", "10:00", "11:00"], answer: 2, evidence: 1, why: "The meeting time and tour time are different. The tour starts at eleven." },
      { text: "What should visitors bring?", options: ["A water bottle", "A packed lunch", "A map of the shore"], answer: 0, evidence: 2, why: "The speaker specifically asks everyone to bring a water bottle." }
    ]
  },
  writing: {
    "ielts-academic": [{ type: "Academic Task 1", min: 150, title: "How learners used a study centre", prompt: "The chart shows the number of visits to a university study centre on five weekdays. Summarise the main features and make comparisons where relevant.", chart: true }, { type: "Task 2 essay", min: 250, title: "Learning in public spaces", prompt: "Some people think towns should provide more shared spaces for learning. Others think funding should go to individual online study. Discuss both views and give your own opinion." }],
    "ielts-general": [{ type: "General Training Task 1", min: 150, title: "Request an evening class", prompt: "You cannot attend your current language class. Write a letter to the course organiser. Explain the problem, ask about evening classes, and say when you are available." }, { type: "Task 2 essay", min: 250, title: "Time for adult education", prompt: "Employers should give staff time to study new skills during working hours. To what extent do you agree or disagree?" }],
    "toefl-ibt": [{ type: "Write an Email", min: 90, title: "A quiet room for group work", prompt: "Your student group needs a different place to meet. Write to the campus librarian, explain why the current room is unsuitable, and ask for a quieter alternative." }, { type: "Academic Discussion", min: 100, title: "Later campus hours", prompt: "Your professor asks whether university study facilities should stay open later. State your opinion and contribute a new reason to the discussion." }],
    "pte-academic": [{ type: "Summarize Written Text", min: 5, max: 75, single: true, title: "A new use for evening libraries", prompt: "Read the passage below. Summarize the main idea and important supporting information in one sentence.", passage: true }, { type: "Write Essay", min: 200, max: 300, title: "Public space and opportunity", prompt: "Do public libraries still play an important role when reliable information is available online? Explain your view with examples." }],
    det: [{ type: "Interactive Writing", min: 60, title: "A place to concentrate", prompt: "Describe a place where you can concentrate easily. Explain what makes it suitable and how you use it when you have something important to learn." }, { type: "Writing Sample", min: 60, title: "Study habits", prompt: "Describe a study habit that has helped you. Explain how you discovered it and why it works for you." }]
  },
  speaking: {
    "ielts-academic": { type: "Part 2 · Long turn", title: "Describe a useful place to study", prompt: "Describe a place where you have studied or worked effectively. Say where it is, when you use it, what you do there, and why it helps you focus." },
    "ielts-general": { type: "Part 2 · Long turn", title: "Describe a skill you learned", prompt: "Describe a practical skill you learned outside a classroom. Say how you learned it, who helped you, and how you use it now." },
    "toefl-ibt": { type: "Take an Interview", title: "Your study routine", prompt: "Some students like to study alone, while others prefer to work with a group. Which do you prefer, and why? Include a specific example." },
    "pte-academic": { type: "Describe Image", title: "Study centre visits", prompt: "Describe the chart in as much detail as you can. Identify the main trend and compare at least two days.", chart: true },
    det: { type: "Interactive Speaking", title: "A place that helps you learn", prompt: "Tell me about a place where you enjoy learning. Give two details about the place and explain why it works for you." }
  },
  drills: [
    { id: "evidence", skill: "reading", title: ["Find the evidence", "شاهد را پیدا کن"], detail: ["Match a claim to the line that supports it.", "هر ادعا را به جملهٔ پشتیبان پیوند بده."], minutes: 3, question: 0 },
    { id: "paraphrase", skill: "reading", title: ["Spot the paraphrase", "بازگویی را تشخیص بده"], detail: ["Recognise a familiar idea in new words.", "یک ایده را در عبارت‌های تازه تشخیص بده."], minutes: 3, question: 1 },
    { id: "detail", skill: "listening", title: ["Catch the correction", "اصلاحیه را بشنو"], detail: ["Tell the current plan apart from an earlier detail.", "برنامهٔ فعلی را از جزئیات قبلی تشخیص بده."], minutes: 3, question: 0 },
    { id: "time", skill: "listening", title: ["Listen for time", "زمان را تشخیص بده"], detail: ["Distinguish a meeting time from an event time.", "زمان قرار را از زمان رویداد جدا کن."], minutes: 3, question: 1 },
    { id: "overview", skill: "writing", title: ["Write an overview", "یک جمع‌بندی بنویس"], detail: ["Describe the overall pattern in two sentences.", "الگوی کلی را در دو جمله توضیح بده."], minutes: 3 },
    { id: "example", skill: "speaking", title: ["Give a specific example", "یک مثال مشخص بزن"], detail: ["Support a short answer with one concrete detail.", "پاسخت را با یک جزئیات روشن پشتیبانی کن."], minutes: 3 },
    { id: "keywords", skill: "reading", title: ["Check the key condition", "شرط اصلی را بررسی کن"], detail: ["Find the condition that makes a statement true.", "شرطی را پیدا کن که گزاره را درست می‌کند."], minutes: 3, question: 3 }
  ],
  vocab: [
    { id: "account-for", word: "account for", ipa: "/əˈkaʊnt fər/", tag: "argument", definition: "To form a stated part of a total, or explain a result.", fa: "تشکیل دادن بخشی از یک کل یا توضیح دادن علت", example: "Evening visitors account for one fifth of all library visits." },
    { id: "partition", word: "partition", ipa: "/pɑːrˈtɪʃən/", tag: "spaces", definition: "A structure that divides one area from another.", fa: "جداکننده، پارتیشن", example: "A partition separated the group desks from the quiet area." },
    { id: "uneven", word: "uneven", ipa: "/ʌnˈiːvən/", tag: "spaces", definition: "Not flat, level, or consistent.", fa: "ناهموار، نامنظم", example: "The footpath becomes uneven near the shore." },
    { id: "whereas", word: "whereas", ipa: "/weərˈæz/", tag: "argument", definition: "Used to introduce a contrast between two facts.", fa: "در حالی‌که، برای نشان دادن تضاد", example: "Monday was quiet, whereas Thursday had the most visits." },
    { id: "trial", word: "trial", ipa: "/ˈtraɪəl/", tag: "research", definition: "A period of testing to find out whether an idea works.", fa: "دورهٔ آزمایشی", example: "A four-week trial helped the library choose its evening schedule." },
    { id: "consistency", word: "consistency", ipa: "/kənˈsɪstənsi/", tag: "research", definition: "The quality of being steady or regular over time.", fa: "ثبات، پیوستگی", example: "Practising with consistency made her more comfortable with timed tasks." }
  ]
};

const SKILL_KEYS = Object.keys(CONTENT.skills);
