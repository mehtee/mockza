// Build-time presentation for the public, authored practice examples.
import CONTENT from "./sample-content.mjs";

const ICONS = { book:"▤", audio:"≋", pen:"✎", mic:"◉", route:"⌁", clock:"◷", bookmark:"♧", chart:"▥" };
const ROUTES = {
  diagnostic: "/app/diagnostic/intro?track=ielts_academic",
  welcome: "/app/welcome",
  coach: "/app/coach",
  mission: "/app/mission/today",
  shifter: "/app/register-shifter",
  drop: "/app/drop",
  practice: "/app/practice",
  mock: "/app/practice/full-mock",
  drills: "/app/practice/drills",
  vocabulary: "/app/vocabulary",
  progress: "/app/progress",
  library: "/samples",
  calculators: "/calculators",
};
const PACKS = {
  reading:"ielts-acad-reading-pack-01", listening:"ielts-listening-seed-01",
  writing:"ielts-writing-seed-01", speaking:"ielts-speaking-seed-01",
};
const GUIDE_SLUG = { det:"duolingo-english-test" };
const escapeTable = { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" };
const esc = value => String(value ?? "").replace(/[&<>"']/g, character => escapeTable[character]);
const arrow = () => '<span class="arrow" aria-hidden="true">→</span>';
const icon = name => `<span class="glyph" aria-hidden="true">${ICONS[name] ?? ICONS.route}</span>`;
const isCorrect = (question, value) => value != null && Number(value) === question.answer;
const asAnswer = (question, answer) => esc(question.options[answer] ?? "—");
const questionSet = skill => CONTENT[skill].questions;
const sampleAttempt = () => ({ results: [
  { skill:"reading", answers:[1,1,2,1], correct:3, total:4 },
  { skill:"listening", answers:[0,2,0], correct:2, total:3 },
] });
function href(route, params = {}) {
  if (route === "feedback") return params.skill ? `?skill=${params.skill}#ai-feedback` : "#ai-feedback";
  if (route === "setup") return `/app/practice/${params.skill}/${PACKS[params.skill]}`;
  if (route.startsWith("guide/")) {
    const slug = route.slice(6);
    return "/" + (GUIDE_SLUG[slug] ?? slug);
  }
  return ROUTES[route];
}
function link(label, route, classes = "", params) {
  const extra = route === "diagnostic" ? ' data-testid="landing-cta-diagnostic"' : route === "practice" ? ' data-testid="landing-cta-catalog"' : "";
  return `<a class="${classes}" href="${esc(href(route, params))}"${extra}>${esc(label)}${classes.includes("with-arrow") ? arrow() : ""}</a>`;
}
const faq = (question, answer) => `<details class="disclosure"><summary>${esc(question)}</summary><p>${esc(answer)}</p></details>`;

export function landingFaqEntries(irn) {
  return [
  [
    "What does the AI feedback show?",
    "بازخورد هوش مصنوعی چه چیزی نشان می‌دهد؟",
    "The Writing example marks phrases and suggests a revision. The Speaking example links feedback to moments you can replay.",
    "نمونهٔ نوشتن عبارت‌ها را نشانه‌گذاری می‌کند و بازنویسی پیشنهاد می‌دهد. در نمونهٔ صحبت کردن، بازخورد به لحظه‌هایی وصل است که می‌توانی دوباره پخش کنی."
  ],
  [
    "Will I get an official score?",
    "آیا نمرهٔ رسمی می‌گیرم؟",
    "Sample bands are for illustration. The level check reports performance on its practice questions and suggests what to work on.",
    "نمره‌های نمونه برای نمایش‌اند. تعیین سطح نتیجهٔ سؤال‌های تمرینی را نشان می‌دهد و برای ادامه پیشنهاد می‌دهد."
  ],
  [
    "Can I try it as a guest?",
    "می‌توانم به‌عنوان مهمان امتحان کنم؟",
    "Yes. Explore the samples, take a level check, and practise in this browser as a guest.",
    "بله. نمونه‌ها را ببین، تعیین سطح انجام بده و به‌عنوان مهمان در همین مرورگر تمرین کن."
  ],
  [
    "What if I don’t have a microphone?",
    "اگر میکروفون نداشته باشم چه؟",
    "You can play the Speaking sample and use its transcript. Speaking practice also has a sample-response option.",
    "می‌توانی نمونهٔ صحبت را پخش کنی و متنش را بخوانی. در تمرین صحبت کردن هم گزینهٔ پاسخ نمونه وجود دارد."
  ]
].map(([enQ, faQ, enA, faA]) => irn ? { q:faQ, a:faA } : { q:enQ, a:enA });
}
export function renderLanding(irn) {
  const language = irn ? "fa" : "en";
  const format = new Intl.NumberFormat(language, { useGrouping:false });
  const num = (value, places) => places == null ? format.format(value) : Number(value).toLocaleString(language, {minimumFractionDigits:places, maximumFractionDigits:places});
  const numText = value => value.replace(/[0-9]/g, digit => num(Number(digit)));
  const L = (en, fa) => irn ? fa : en;
  const bi = pair => pair[irn ? 1 : 0];
  const skillName = id => bi(CONTENT.skills[id].name);
  const localNotes = items => items.map(({criterion,title,reason,...item}) => ({ ...item, criterion:bi(criterion),title:bi(title),reason:bi(reason) }));
  function interactionData() {
    const labels = Object.fromEntries(Object.entries({
  "showOriginal": [
    "Show original response",
    "دیدن پاسخ اصلی"
  ],
  "showRevision": [
    "Show suggested revision",
    "دیدن نسخهٔ پیشنهادی"
  ],
  "pauseSpeaking": [
    "Pause sample recording",
    "توقف صدای نمونه"
  ],
  "playSpeaking": [
    "Play sample recording",
    "پخش صدای نمونه"
  ],
  "arrivalTime": [
    "Ten minutes before class gives the arrival time. Listen for “moved it to” to find the start time.",
    "ده دقیقه زودتر زمان حضور است. برای ساعت شروع به عبارت moved it to گوش بده."
  ],
  "updatedTime": [
    "“Was going to” gives the old time. “Moved it to” gives the updated start time.",
    "عبارت was going to ساعت قبلی و moved it to ساعت جدید شروع را نشان می‌دهد."
  ],
  "answer": [
    "Answer",
    "پاسخ"
  ],
  "evidence": [
    "Evidence",
    "شاهد"
  ],
  "evidenceNudge": [
    "Choose the line that mentions bookings to support your answer.",
    "برای اثبات پاسخ، جمله‌ای را انتخاب کن که به تعداد رزروها اشاره می‌کند."
  ],
  "pause": [
    "Pause recording",
    "توقف صدا"
  ],
  "play": [
    "Play recording",
    "پخش صدا"
  ]
}).map(([key,value]) => [key,bi(value)]));
    return JSON.stringify({
      writing:localNotes(WRITING_NOTES), speaking:localNotes(SPEAKING_NOTES),
      reading:{answer:READING_CHECK.answer,evidence:READING_CHECK.evidence},
      listening:{answer:LISTENING_CHECK.answer}, readingNotes:READING_CHECK_NOTES.map(bi), labels
    });
  }

  const WRITING_NOTES = [
    {
      original: "there was a very big increase",
      revision: "visits almost doubled, from 72 to 142",
      criterion: ["Task achievement", "انجام تسک"],
      title: ["Make the comparison precise", "مقایسه را دقیق‌تر کن"],
      reason: ["“Very big” leaves the reader guessing. Name the start and end values so the size of the change is clear.", "عبارت «خیلی زیاد» مبهم است. عدد شروع و پایان را بگو تا اندازهٔ تغییر مشخص شود."]
    },
    {
      original: "was more higher",
      revision: "was higher",
      criterion: ["Grammatical range and accuracy", "تنوع و دقت دستوری"],
      title: ["Use one comparative form", "از یک ساختار مقایسه‌ای استفاده کن"],
      reason: ["“Higher” already expresses the comparison. Removing “more” makes the sentence grammatical.", "کلمهٔ higher خودش مقایسه را بیان می‌کند. با حذف more جمله از نظر دستوری درست می‌شود."]
    },
    {
      original: "went down a little",
      revision: "dipped slightly",
      criterion: ["Lexical resource", "دامنهٔ واژگان"],
      title: ["Use a verb that fits the chart", "فعلی متناسب با نمودار انتخاب کن"],
      reason: ["This phrase is understandable. “Dipped slightly” describes the small fall more concisely.", "عبارت قابل فهم است. dipped slightly افت کوچک را کوتاه‌تر و دقیق‌تر بیان می‌کند."]
    }
  ];

  const SPEAKING_NOTES = [
    {
      start: 0,
      original: "I usually study at the library because, um, it is more quiet.",
      revision: "I usually study at the library because it’s quieter.",
      criterion: ["Fluency and coherence", "روانی و انسجام"],
      title: ["Give your reason in one phrase", "دلیلت را در یک عبارت بگو"],
      reason: ["Listen for the hesitation after “because”. Try the shorter phrasing aloud and keep the reason in the same breath.", "به مکث بعد از because گوش بده. عبارت کوتاه‌تر را بلند تکرار کن و دلیل را در همان جمله بگو."]
    },
    {
      start: 3.88,
      original: "Last week I had to prepare for an exam.",
      revision: "Last week, when I was preparing for an exam, I sat near the window.",
      criterion: ["Fluency and coherence", "روانی و انسجام"],
      title: ["Build a smoother bridge to the example", "مقدمه را روان‌تر به مثال وصل کن"],
      reason: ["There is a pause before the example. Link the setup to what happened next so the listener can follow the story.", "پیش از مثال مکثی هست. مقدمه را به اتفاق بعدی وصل کن تا شنونده راحت‌تر روایت را دنبال کند."]
    },
    {
      start: 7.89,
      original: "I sat near the window and finished two chapters before lunch.",
      revision: "I finished TWO chapters before LUNCH.",
      criterion: ["Pronunciation", "تلفظ"],
      title: ["Stress the words that carry the result", "روی واژه‌های مهم جمله تأکید کن"],
      reason: ["Keep the concrete detail. Give “two” and “lunch” more stress so the listener catches how much you finished and when.", "جزئیات مشخص را نگه دار. روی two و lunch تأکید کن تا شنونده بفهمد چه مقدار و تا چه زمانی مطالعه کردی."]
    }
  ];

  // Normalized audio levels from equal slices of speaking-feedback.mp3.
  const SPEAKING_PEAKS = [
    6, 73, 81, 76, 70, 42, 73, 55, 68, 60, 66, 30, 57, 30, 66, 43,
    63, 74, 33, 65, 22, 6, 47, 67, 56, 72, 78, 56, 33, 55, 61, 54,
    71, 61, 72, 59, 6, 6, 6, 6, 6, 6, 6, 6, 71, 55, 80, 75,
    83, 91, 73, 66, 82, 65, 45, 46, 50, 65, 44, 46, 66, 67, 11, 7
  ];

  function landingPage() {
    const demo = "writing";
    return `<main class="product-landing" id="content" tabindex="-1" data-landing-content="${esc(interactionData())}">
      ${landingHero()}
      ${evaluationShowcase(demo)}
      ${reportShowcase("reading")}
      ${landingResources()}
      ${landingFaq()}
      ${landingEnd()}
    </main>`;
  }

  function landingHero() {
    return `<section class="wrap landing-intro">
      <div class="landing-intro-copy">
        <span class="section-label">${L("English exam prep", "آمادگی آزمون زبان")}</span>
        <h1>${L("Practise today.<br><em>Know what to fix.</em>", "تمرین کن.<br><em>بهتر جواب بده.</em>")}</h1>
        <p>${L("Find your starting level, practise the real task formats, and see exactly what AI feedback can help you improve in Writing and Speaking.", "نقطهٔ شروع خودت را پیدا کن، قالب‌های آزمون را تمرین کن و ببین بازخورد هوش مصنوعی چطور به بهتر شدن نوشته و صحبتت کمک می‌کند.")}</p>
        <div class="actions">${link(L("Check my level", "سطحم را بسنج"), "diagnostic", "btn primary with-arrow")}${link(L("See AI feedback", "دیدن بازخورد هوش مصنوعی"), "feedback", "btn quiet with-arrow")}</div>
        <div class="landing-exam-links" aria-label="${L("Supported exams", "آزمون‌های قابل تمرین")}">
          ${[[L("IELTS", "آیلتس"), "ielts-academic"], [L("TOEFL", "تافل"), "toefl-ibt"], [L("PTE", "پی‌تی‌ای"), "pte-academic"], [L("DET", "دولینگو"), "det"]].map(([name, track]) => link(name, `guide/${track}`)).join("")}
        </div>
      </div>
      <div class="landing-intro-art">
        <img src="/sample-media/study-notebook.webp" alt="" width="840" height="1050" fetchpriority="high">
        <div class="hero-art-wash" aria-hidden="true"></div>
        <a class="hero-evaluation" data-demo-link href="${href("feedback", { skill: "writing" })}" aria-label="${L("Explore the sample Writing feedback", "نمونهٔ بازخورد نوشتن را ببین")}">
          <div class="hero-evaluation-top"><span class="icon-tile">${icon("pen")}</span><div><strong>${L("Writing review", "مرور نوشتن")}</strong><small>${L("IELTS Academic · Task 1", "آیلتس آکادمیک · تسک ۱")}</small></div><span class="mini-tag">${L("Sample", "نمونه")}</span></div>
          <div class="hero-evaluation-edit" dir="ltr" lang="en"><del>there was a very big increase</del><ins>visits almost doubled, from 72 to 142</ins></div>
          <div class="hero-evaluation-foot"><span>${L("Explain the size of the change", "اندازهٔ تغییر را دقیق بگو")}</span>${arrow()}</div>
        </a>
        <a class="hero-playing" data-demo-link href="${href("feedback", { skill: "speaking" })}">
          <span class="hero-play-icon" aria-hidden="true">▶</span><span><strong>${L("Speaking review", "مرور صحبت کردن")}</strong><small>${L("Hear a sample", "صدای نمونه را بشنو")}</small></span>
        </a>
      </div>
    </section>`;
  }

  function landingLead(label, title, detail, id) {
    return `<div class="landing-section-heading" data-enter><span class="section-label">${label}</span><h2 id="${id}" tabindex="-1">${title}</h2>${detail ? `<p>${detail}</p>` : ""}</div>`;
  }

  function tabs(entries, group, active, label) {
    return `<div class="landing-tabs ${group}-tabs" role="tablist" aria-label="${esc(label)}" data-landing-tabs="${group}">
      ${entries.map(([key, label]) => `<button type="button" id="${group}-tab-${key}" role="tab" aria-controls="${group}-panel-${key}" aria-selected="${key === active}" tabindex="${key === active ? 0 : -1}" data-landing-tab="${key}">${label}</button>`).join("")}
    </div>`;
  }

  function evaluationShowcase(active) {
    return `<section class="landing-feedback" id="ai-feedback" aria-labelledby="feedback-title"><div class="wrap">
      ${landingLead(L("AI feedback", "بازخورد هوش مصنوعی"), L("See the feedback in action.", "بازخورد را در عمل ببین."), L("Select a highlighted phrase in Writing or replay a line from the Speaking transcript.", "در نمونهٔ نوشتن روی عبارت رنگی بزن یا یک جمله از متن صحبت را پخش کن."), "feedback-title")}
      <div class="evaluation-demo" data-enter>
        <div class="evaluation-top">
          ${tabs([["writing", `${icon("pen")} ${skillName("writing")}`], ["speaking", `${icon("mic")} ${skillName("speaking")}`]], "evaluation", active, L("Feedback sample", "نمونهٔ بازخورد"))}
          <span class="sample-label">${L("IELTS sample", "نمونهٔ آیلتس")}</span>
        </div>
        ${evaluationPanel("writing")}
        ${evaluationPanel("speaking")}
      </div>
      <p class="evaluation-caption">${L("This demo uses built-in responses, feedback, and example bands.", "این نمایش از پاسخ‌ها، بازخوردها و نمره‌های نمونه استفاده می‌کند.")}</p>
    </div></section>`;
  }

  function evaluationPanel(skill) {
    const writing = skill === "writing";
    const notes = writing ? WRITING_NOTES : SPEAKING_NOTES;
    const title = writing ? L("How learners used a study centre", "مراجعه به مرکز مطالعه") : L("A place that helps me focus", "جایی که تمرکز را آسان می‌کند");
    const assessment = writing ? L("Writing · Chart description", "نوشتن · توصیف نمودار") : L("Speaking · Sample recording", "صحبت کردن · صدای نمونه");
    return `<section class="evaluation-panel" id="evaluation-panel-${skill}" role="tabpanel" aria-labelledby="evaluation-tab-${skill}" data-demo-panel="${skill}" >
      <div class="evaluation-response">
        <span class="section-label">${assessment}</span><h3>${title}</h3>
        ${writing ? writingExample() : speakingExample()}
      </div>
      <aside class="evaluation-notes">
        <div class="note-navigation">
          <span>${L("Feedback", "بازخورد")} <strong dir="ltr" data-note-progress>${num(1)} / ${num(notes.length)}</strong></span>
          <div>${noteStep("prev", L("Previous feedback point", "نکتهٔ قبلی"), "←")}${noteStep("next", L("Next feedback point", "نکتهٔ بعدی"), "→")}</div>
        </div>
        <div class="evaluation-note" data-note-details aria-live="polite" aria-atomic="true">
          <span class="note-criterion" data-note-criterion>${bi(notes[0].criterion)}</span>
          <h4 data-note-title>${bi(notes[0].title)}</h4>
          <p data-note-reason>${bi(notes[0].reason)}</p>
          <div class="note-suggestion"><span>${L("Try this", "این را امتحان کن")}</span><b lang="en" dir="ltr" data-note-suggestion>${esc(notes[0].revision)}</b></div>
        </div>
        ${exampleRubric(skill)}
      </aside>
      <div class="evaluation-bottom">
        <span>${writing ? L("Make one change and try the task again.", "یک تغییر بده و دوباره تسک را حل کن.") : L("Replay a moment and say the revised line aloud.", "یک لحظه را دوباره پخش کن و جملهٔ پیشنهادی را بلند بگو.")}</span>
        ${link(writing ? L("Practise Writing", "تمرین نوشتن") : L("Practise Speaking", "تمرین صحبت کردن"), "setup", "btn primary small with-arrow", { track: "ielts-academic", skill })}
      </div>
    </section>`;
  }

  function noteStep(direction, label, glyph) {
    return `<button type="button" class="note-step" data-note-step="${direction}" aria-label="${label}"><span class="arrow" aria-hidden="true">${glyph}</span></button>`;
  }

  function writingExample() {
    const phrase = i => `<button type="button" class="writing-mark" data-demo-note="${i}" aria-pressed="${i === 0}">${esc(WRITING_NOTES[i].original)}</button>`;
    return `<details class="demo-prompt"><summary>${L("View the prompt", "دیدن صورت سؤال")}</summary><div lang="en" dir="ltr"><p>${esc(CONTENT.writing["ielts-academic"][0].prompt)}</p>${miniChart()}</div></details>
      <div class="writing-sample" lang="en" dir="ltr">
        <p>The chart compares visits to a university study centre on five weekdays. Overall, the centre was busiest towards the end of the week.</p>
        <p>From Monday to Thursday, ${phrase(0)}. The Thursday figure ${phrase(1)} than Wednesday's. On Friday, visits ${phrase(2)}, to 122.</p>
      </div>
      <button type="button" class="btn outline small revision-toggle" data-demo-revise aria-pressed="false">${L("Show suggested revision", "دیدن نسخهٔ پیشنهادی")}</button>`;
  }

  function speakingExample() {
    const waveform = SPEAKING_PEAKS.map(height => `<i style="--bar:${height}%"></i>`).join("");
    return `<div class="speaking-audio" dir="ltr">
        <audio data-demo-audio preload="none" data-src="/sample-media/speaking-feedback.mp3"></audio>
        <div class="speaking-wave" data-demo-wave aria-hidden="true">${waveform}</div>
        <div class="speaking-controls">
          <button type="button" class="demo-play" data-demo-play aria-label="${L("Play sample recording", "پخش صدای نمونه")}" disabled><span aria-hidden="true">▶</span></button>
          <span data-demo-time>0:00</span>
          <input type="range" min="0" max="12" step=".05" value="0" data-demo-seek aria-label="${L("Recording playback position", "موقعیت پخش صدا")}" disabled>
          <span data-demo-duration>0:12</span>
        </div>
        <p class="audio-message" data-audio-message role="status" hidden>${L("Audio could not be played. The transcript is available below.", "صدا پخش نشد. متن را می‌توانی در ادامه بخوانی.")}</p>
      </div>
      <div class="speaking-transcript" lang="en" dir="ltr">
        ${SPEAKING_NOTES.map((line, i) => `<button type="button" class="transcript-line" data-demo-note="${i}" aria-pressed="${i === 0}"><time>${clipTime(line.start)}</time><span>${esc(line.original)}</span></button>`).join("")}
      </div>`;
  }

  function clipTime(seconds) {
    const whole = Math.round(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  }

  function exampleRubric(skill) {
    const values = skill === "writing" ? [
      [L("Task achievement", "انجام تسک"), 6],
      [L("Coherence", "انسجام"), 6],
      [L("Vocabulary", "واژگان"), 6],
      [L("Grammar", "دستور زبان"), 5.5]
    ] : [
      [L("Fluency", "روانی"), 6],
      [L("Vocabulary", "واژگان"), 6.5],
      [L("Grammar", "دستور زبان"), 6],
      [L("Pronunciation", "تلفظ"), 7]
    ];
    return `<details class="demo-rubric" open><summary><span>${L("Example rubric", "معیارهای نمونه")}</span><b><bdi dir="ltr">${num(skill === "writing" ? 6 : 6.5, 1)} / ${num(9)}</bdi></b></summary>
      <dl>${values.map(([label, score]) => `<div><dt>${label}</dt><dd><i style="--score:${score / 9 * 100}%"></i><span>${num(score, 1)}</span></dd></div>`).join("")}</dl>
    </details>`;
  }

  function landingResources() {
    const exams = [
      [L("Full timed exams", "شبیه‌ساز کامل آزمون"), L("Practise all four IELTS, TOEFL, PTE, or DET sections in test timing.", "چهار بخش آیلتس، تافل، پی‌تی‌ای یا دولینگو را با زمان‌بندی واقعی تمرین کن."), "mock", "clock"],
      [L("Skill drills & mocks", "تمرین مهارتی و نمونه‌سؤال"), L("Focus on one Listening, Reading, Writing, or Speaking task with AI grading.", "روی یک بخش شنیداری، خواندن، نوشتن یا صحبت کردن با نمره‌دهی هوش مصنوعی کار کن."), "practice", "route"],
      [L("Score & study review", "مرور و تحلیل پیشرفت"), L("Compare past attempts, inspect mistakes, and estimate band conversions.", "تلاش‌های قبلی را مقایسه کن، اشتباهاتت را ببین و معادل نمره را بسنج."), "progress", "chart"]
    ];
    const coach = [
      [L("Today's 10-Min Coach", "مربی ۱۰ دقیقه‌ای امروز"), L("One daily mission built from your weak spots, due words, and favorite topics.", "یک تمرین روزانه بر اساس نقاط ضعف، واژگان سررسید و موضوعات مورد علاقه‌ات."), "mission", "bookmark"],
      [L("Upgrade My Speaking", "ارتقای لحن و سطح گفتار"), L("Speak or type casually and compare Everyday, Workplace, and Band 8+ rewrites.", "جمله‌ات را بگو یا بنویس و نسخه روزمره، کاری و نمره ۸+ را با تلفظ مقایسه کن."), "shifter", "audio"],
      [L("Learn From Anything", "ساخت تمرین از هر محتوا"), L("Turn any article link, photo, note, or clip into a 2-minute quiz and flashcards.", "هر لینک مقاله، عکس صفحه، متن یا صدا را به آزمونک ۲ دقیقه‌ای و فلش‌کارت تبدیل کن."), "drop", "book"]
    ];
    return `<section class="wrap landing-resources" id="study-tools" aria-labelledby="resources-title">
      ${landingLead(L("Two ways to improve", "دو مسیر مکمل برای پیشرفت"), L("Mock Exams + Smart AI Coach.", "آزمون‌های آزمایشی + مربی هوشمند."), L("Measure your exam readiness under timing, then fix everyday grammar and speaking habits in 10 minutes a day.", "با شبیه‌ساز آمادگی آزمون خودت را بسنج و با مربی هوشمند در ۱۰ دقیقه روزانه اشکالات گفتار و گرامر را برطرف کن."), "resources-title")}
      <div class="resource-columns">
        ${resourceList(L("1 · Timed Mock Exams", "۱ · آزمون‌های آزمایشی استاندارد"), exams)}
        ${resourceList(L("2 · Smart AI Coach", "۲ · مربی هوشمند روزانه"), coach)}
      </div>
    </section>`;
  }

  function resourceList(title, resources) {
    return `<section class="landing-resource-list" data-enter><h3>${title}</h3>${resources.map(([name, desc, path, glyph]) => `<a href="${href(path)}"><span class="icon-tile">${icon(glyph)}</span><div><b>${name}</b><small>${desc}</small></div>${arrow()}</a>`).join("")}</section>`;
  }

  function landingFaq() {
    return `<section class="wrap landing-faq" aria-labelledby="landing-faq-title">
      <h2 id="landing-faq-title">${L("Before you start", "پیش از شروع")}</h2>
      <div>${landingFaqEntries(irn).map(entry => faq(entry.q, entry.a)).join("")}</div>
    </section>`;
  }

  function landingEnd() {
    return `<section class="landing-end"><div class="wrap landing-end-inner" data-enter>
      <div><h2>${L("Start with one skill.", "با یک مهارت شروع کن.")}</h2><p>${L("Try a short check, or go straight to a task from your exam.", "یک تعیین سطح کوتاه انجام بده یا مستقیم سراغ تسک آزمونت برو.")}</p></div>
      <div class="actions"><a class="btn primary with-arrow" href="${href("diagnostic")}">${L("Check my level", "سطحم را بسنج")}${arrow()}</a>${link(L("Browse practice", "دیدن تمرین‌ها"), "practice", "btn outline")}</div>
    </div></section>`;
  }

  const READING_CHECK = {
    text: "Why did the shop offer a discount between 8 and 10 a.m.?",
    options: [
      "The shop's operating costs were lower in the morning.",
      "The early time slots were the least popular.",
      "The morning bikes were older than the others."
    ],
    answer: 1,
    lines: [
      "The bike shop offered a discount on weekend rentals starting between 8 and 10 a.m.",
      "Those hours had drawn the fewest bookings.",
      "Riders could borrow a helmet with each rental."
    ],
    evidence: 1
  };

  const LISTENING_CHECK = {
    text: "When does the pottery class now start?",
    options: ["10:15 a.m.", "10:40 a.m.", "10:50 a.m."],
    answer: 2
  };

  const READING_CHECK_NOTES = [
    ["The passage gives a demand clue. “Fewest bookings” means those hours were least popular.", "سرنخ متن به میزان استقبال مربوط است. عبارت fewest bookings یعنی آن ساعت‌ها کمترین استقبال را داشتند."],
    ["“Fewest bookings” and “least popular” express the same idea.", "عبارت‌های fewest bookings و least popular یک مفهوم را بیان می‌کنند."],
    ["The question asks why the shop offered a discount. The number of bookings gives the reason.", "سؤال دلیل تخفیف را می‌پرسد. تعداد رزروها دلیل تخفیف را نشان می‌دهد."]
  ];

  // Each bar represents the level in one slice of the bundled recording.
  const LISTENING_REVIEW_CLIP = {
    source: "/sample-media/listening-review.mp3",
    duration: 7.06,
    levels: [5, 28, 82, 69, 93, 53, 78, 71, 53, 17, 60, 67, 53, 54, 53, 62, 67, 45, 73, 83, 45, 61, 39, 72, 36, 57, 70, 59, 16, 68, 74, 13, 69, 84, 72, 67, 44, 79, 54, 63, 69, 75, 59, 81, 74, 64, 49, 56, 50, 58, 70, 51, 41, 10]
  };
  const LISTENING_DRILL_CLIP = {
    source: "/sample-media/listening-drill.mp3",
    duration: 10.17,
    levels: [5, 52, 87, 77, 53, 78, 67, 65, 93, 62, 62, 51, 67, 59, 55, 59, 27, 65, 66, 29, 81, 76, 39, 60, 41, 80, 66, 52, 70, 41, 63, 56, 78, 79, 83, 44, 54, 56, 81, 50, 13, 78, 77, 82, 37, 90, 92, 46, 69, 63, 51, 76, 48, 5]
  };
  const LISTENING_CUES = [
    { start: 0, end: 3.21, text: "Please meet on the east side of the station at nine fifteen.", evidence: "east side of the station", label: ["Updated location", "محل جدید"] },
    { start: 3.21, end: 7.06, text: "That is a change from the west entrance mentioned in last week's message.", evidence: "west entrance", label: ["Earlier location", "محل قبلی"] }
  ];
  const LISTENING_DRILL_TRANSCRIPT = [
    "The pottery class was going to start at ten fifteen.",
    "We've moved it to ten fifty because the studio opens later.",
    "Please arrive ten minutes before class."
  ];

  function markEvidence(text, phrase) {
    const start = text.indexOf(phrase);
    if (start < 0) return esc(text);
    return `${esc(text.slice(0, start))}<mark>${esc(phrase)}</mark>${esc(text.slice(start + phrase.length))}`;
  }

  function reportShowcase(active) {
    const attempt = sampleAttempt();
    return `<section class="report-showcase" id="sample-report" aria-labelledby="report-showcase-title">
      <div class="wrap">
        <header class="report-showcase-heading" data-enter>
          <span class="section-label">${L("Sample IELTS report", "گزارش نمونهٔ آیلتس")}</span>
          <h2 id="report-showcase-title" tabindex="-1">${L("What cost this learner a point?", "یک امتیاز کجا از دست رفت؟")}</h2>
          <p>${L("Find the line or listen for the correction. Then try a new question.", "جملهٔ کلیدی را پیدا کن یا اصلاحیه را بشنو. بعد یک سؤال تازه حل کن.")}</p>
        </header>
        <div class="report-deck" data-enter>
          <div class="report-top">
            ${tabs(["reading", "listening"].map(skill => [skill, `${icon(CONTENT.skills[skill].icon)} <span>${skillName(skill)}</span>`]), "report", active, L("Sample report skill", "مهارت گزارش نمونه"))}
            <span class="report-exam">${L("IELTS Academic", "آیلتس آکادمیک")}</span>
          </div>
          ${reportPanel(attempt, "reading")}
          ${reportPanel(attempt, "listening")}
        </div>
      </div>
    </section>`;
  }

  function reportPanel(attempt, skill) {
    const isReading = skill === "reading";
    const result = attempt.results.find(item => item.skill === skill);
    const questions = questionSet(skill);
    const drill = CONTENT.drills.find(item => item.id === (isReading ? "paraphrase" : "detail"));
    const index = drill.question;
    const question = questions[index];
    const source = isReading
      ? `<blockquote class="report-evidence" lang="en" dir="ltr">${markEvidence(CONTENT.reading.text[question.evidence], "highest demand")}</blockquote>`
      : listeningReviewSource();

    return `<section class="report-panel" id="report-panel-${skill}" role="tabpanel" aria-labelledby="report-tab-${skill}" data-sample-report="${skill}" >
      <aside class="report-summary" aria-label="${L("Sample score", "نتیجهٔ نمونه")}">
        <span class="report-track">${skillName(skill)}</span>
        <div class="report-score"><bdi dir="ltr">${num(result.correct)}<span> / ${num(result.total)}</span></bdi><span>${L("correct answers", "پاسخ درست")}</span></div>
        <ol class="report-marks" style="--question-count:${questions.length}" aria-label="${L("Question results", "نتیجهٔ سؤال‌ها")}">
          ${questions.map((item, i) => {
            const correct = isCorrect(item, result.answers[i]);
            const status = correct ? L("correct", "درست") : L("incorrect", "نادرست");
            return `<li class="${correct ? "" : "is-missed"}" aria-label="${L("Question", "سؤال")} ${num(i + 1)} · ${status}"><span aria-hidden="true">${num(i + 1)}</span><b aria-hidden="true">${correct ? "✓" : "×"}</b></li>`;
          }).join("")}
        </ol>
        <div class="report-recommendation"><span>${L("What to practise", "چه چیزی تمرین کنم؟")}</span><b>${bi(drill.title)}</b><p>${bi(drill.detail)}</p></div>
        ${link(L("Practise this skill", "تمرین این مهارت"), "setup", "text-link with-arrow", { skill })}
      </aside>
      <div class="report-panel-body">
        <div class="report-pane" data-report-review>
          <span class="section-label">${L("Question", "سؤال")} ${num(index + 1)} · ${L("Answer review", "مرور پاسخ")}</span>
          <h3 lang="en" dir="ltr" tabindex="-1">${esc(question.text)}</h3>
          ${source}
          <dl class="report-answer-pair">
            <div><dt>${L("Sample answer", "پاسخ این نمونه")}</dt><dd lang="en" dir="ltr">${asAnswer(question, result.answers[index])}</dd></div>
            <div><dt>${L("Correct answer", "پاسخ درست")}</dt><dd lang="en" dir="ltr">${markEvidence(question.options[question.answer], isReading ? "greatest demand" : "east side of the station")}</dd></div>
          </dl>
          <details class="report-coach" open>
            <summary>${L("Why the sample answer was tempting", "چرا پاسخ نمونه می‌توانست درست به نظر برسد؟")}</summary>
            <p>${isReading
              ? L("Courses do come up in the passage. To answer why the library chose those days, follow the trial results. “Highest demand” and “greatest demand” express the same reason.", "در متن به کلاس‌ها هم اشاره شده است. برای فهمیدن دلیل انتخاب آن دو روز، به نتیجهٔ دورهٔ آزمایشی توجه کن. عبارت‌های highest demand و greatest demand یک دلیل را بیان می‌کنند.")
              : L("The clip mentions the west entrance last. Follow the instruction “Please meet” for the current plan. “A change from” introduces the earlier location.", "در این بخش، ورودی غربی آخرین مکانی است که می‌شنوی. برای برنامهٔ فعلی به دستور Please meet توجه کن. عبارت a change from محل قبلی را معرفی می‌کند.")}</p>
          </details>
          <button type="button" class="btn primary with-arrow" data-report-toggle="drill">${isReading ? L("Try a new question", "یک سؤال تازه حل کن") : L("Try a new clip", "یک فایل تازه را امتحان کن")}${arrow()}</button>
        </div>
        ${reportDrill(isReading)}
      </div>
    </section>`;
  }

  function listeningReviewSource() {
    return `<div class="report-listening-source">
      ${reportPlayer(LISTENING_REVIEW_CLIP, LISTENING_CUES[1].start)}
      <div class="report-cues" aria-label="${L("Replay a transcript line", "پخش یک جمله از متن")}">
        ${LISTENING_CUES.map((cue, i) => `<button type="button" class="report-cue ${i ? "cue-earlier" : ""}" data-report-cue="${cue.start}" data-end="${cue.end}" disabled>
          <span class="cue-time"><span aria-hidden="true">▶</span> <bdi dir="ltr">${numText(clipTime(cue.start))}</bdi></span>
          <span class="cue-copy"><b>${bi(cue.label)}</b><span lang="en" dir="ltr">${markEvidence(cue.text, cue.evidence)}</span></span>
        </button>`).join("")}
      </div>
    </div>`;
  }

  function reportPlayer(clip, cue) {
    return `<div class="report-player" aria-label="${L("Listening audio", "فایل شنیداری")}">
      <audio src="${clip.source}" preload="none" controls></audio>
      <div class="report-player-controls">
        <button type="button" class="demo-play" data-report-play aria-label="${L("Play recording", "پخش صدا")}" disabled><span aria-hidden="true">▶</span></button>
        <div class="report-player-track" dir="ltr">
          <div class="report-wave" data-report-wave aria-hidden="true">
            ${clip.levels.map(height => `<i style="--height:${height}%"></i>`).join("")}
            ${cue == null ? "" : `<span style="--cue:${cue / clip.duration * 100}%"></span>`}
          </div>
          <div class="report-seek">
            <span data-report-time>0:00</span><input type="range" min="0" max="${clip.duration}" step="0.01" value="0" data-report-seek aria-label="${L("Recording playback position", "موقعیت پخش صدا")}" disabled><span data-report-duration>${clipTime(clip.duration)}</span>
          </div>
        </div>
        <button type="button" class="report-speed" data-report-speed aria-label="${L("Slow playback to three-quarter speed", "پخش با سه‌چهارم سرعت")}" aria-pressed="false" disabled><bdi dir="ltr">${num(1)}×</bdi></button>
      </div>
      <p class="report-audio-error" data-report-audio-error role="status" hidden>${L("Audio is unavailable. You can read the transcript.", "صدا در دسترس نیست. می‌توانی متن را بخوانی.")}</p>
    </div>`;
  }

  function drillChoices(legend, name, options, key, englishLegend) {
    return `<fieldset data-report-part="${name}">
      <legend ${englishLegend ? 'lang="en" dir="ltr"' : ""}>${esc(legend)}</legend>
      ${options.map((option, i) => `<label lang="en" dir="ltr" ${i === key ? "data-correct-choice" : ""}><input type="radio" name="${name}" value="${i}" required><span>${esc(option)}</span></label>`).join("")}
    </fieldset>`;
  }

  function reportDrill(isReading) {
    const task = isReading ? READING_CHECK : LISTENING_CHECK;
    return `<div class="report-pane" data-report-drill hidden>
      <span class="section-label">${isReading ? L("Paraphrase drill", "تمرین بازگویی") : L("Listening drill", "تمرین شنیدن")}</span>
      <h3 tabindex="-1">${isReading ? L("Find the line that proves it", "جمله‌ای را پیدا کن که پاسخ را ثابت می‌کند") : L("Catch the change of time", "تغییر ساعت را تشخیص بده")}</h3>
      ${isReading ? "" : reportPlayer(LISTENING_DRILL_CLIP)}
      <form class="report-drill-form">
        ${isReading ? drillChoices(L("Read the passage and choose the line that supports your answer.", "متن را بخوان و جمله‌ای را انتخاب کن که پاسخ تو را تأیید می‌کند."), "evidence", READING_CHECK.lines, READING_CHECK.evidence, false) : ""}
        ${drillChoices(task.text, "answer", task.options, task.answer, true)}
        <div class="report-drill-feedback" data-report-feedback role="status"></div>
        <div class="actions">
          <button type="submit" class="btn primary">${L("Check my answer", "بررسی پاسخ")}</button>
          <button type="button" class="btn quiet" data-report-toggle="review">${L("Back to answer review", "بازگشت به مرور پاسخ")}</button>
        </div>
      </form>
      ${isReading ? "" : `<details class="report-drill-transcript">
        <summary>${L("Read the transcript", "خواندن متن فایل صوتی")}</summary>
        <blockquote class="report-evidence" lang="en" dir="ltr">${LISTENING_DRILL_TRANSCRIPT.map(text => markEvidence(text, "moved it to ten fifty")).join(" ")}</blockquote>
        <button type="button" class="btn outline small" data-report-cue="3.64" data-end="7.63" disabled>${L("Replay the new start time", "پخش دوبارهٔ ساعت جدید")}</button>
      </details>`}
    </div>`;
  }

  function miniChart() {
    return `<figure class="mini-chart" aria-label="Study centre visits by weekday">
      <figcaption>Study centre visits</figcaption><div class="chart-columns">${[72, 94, 111, 142, 122].map((count, i) => `<div><span>${count}</span><i style="--level:${Math.round(count / 150 * 100)}%"></i><small>${["Mon", "Tue", "Wed", "Thu", "Fri"][i]}</small></div>`).join("")}</div></figure>`;
  }
  return landingPage();
}
