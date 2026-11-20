"use strict";

const LANDING_SECTIONS = { how: "how-it-works", feedback: "ai-feedback" };

function isLandingRoute(page) {
  return page === "" || Object.hasOwn(LANDING_SECTIONS, page);
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

function landingPage(params) {
  const demo = params.get("skill") === "speaking" ? "speaking" : "writing";
  return `<main class="product-landing" id="content" tabindex="-1">
    ${landingHero()}
    ${evaluationShowcase(demo)}
    ${reportShowcase(params.get("skill") === "listening" ? "listening" : "reading")}
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
      <img src="assets/study-notebook.webp" alt="" width="840" height="1050" fetchpriority="high">
      <div class="hero-art-wash" aria-hidden="true"></div>
      <a class="hero-evaluation" href="${href("feedback", { skill: "writing" })}" aria-label="${L("Explore the sample Writing feedback", "نمونهٔ بازخورد نوشتن را ببین")}">
        <div class="hero-evaluation-top"><span class="icon-tile">${icon("pen")}</span><div><strong>${L("Writing review", "مرور نوشتن")}</strong><small>${L("IELTS Academic · Task 1", "آیلتس آکادمیک · تسک ۱")}</small></div><span class="mini-tag">${L("Sample", "نمونه")}</span></div>
        <div class="hero-evaluation-edit" dir="ltr" lang="en"><del>there was a very big increase</del><ins>visits almost doubled, from 72 to 142</ins></div>
        <div class="hero-evaluation-foot"><span>${L("Explain the size of the change", "اندازهٔ تغییر را دقیق بگو")}</span>${arrow()}</div>
      </a>
      <a class="hero-playing" href="${href("feedback", { skill: "speaking" })}">
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
      ${evaluationPanel("writing", active === "writing")}
      ${evaluationPanel("speaking", active === "speaking")}
    </div>
    <p class="evaluation-caption">${L("This demo uses built-in responses, feedback, and example bands.", "این نمایش از پاسخ‌ها، بازخوردها و نمره‌های نمونه استفاده می‌کند.")}</p>
  </div></section>`;
}

function evaluationPanel(skill, active) {
  const writing = skill === "writing";
  const notes = writing ? WRITING_NOTES : SPEAKING_NOTES;
  const title = writing ? L("How learners used a study centre", "مراجعه به مرکز مطالعه") : L("A place that helps me focus", "جایی که تمرکز را آسان می‌کند");
  const assessment = writing ? L("Writing · Chart description", "نوشتن · توصیف نمودار") : L("Speaking · Sample recording", "صحبت کردن · صدای نمونه");
  return `<section class="evaluation-panel" id="evaluation-panel-${skill}" role="tabpanel" aria-labelledby="evaluation-tab-${skill}" data-demo-panel="${skill}" ${active ? "" : "hidden"}>
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
      <audio data-demo-audio preload="metadata" data-src="assets/speaking-feedback.mp3"></audio>
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
  const practise = [
    [L("Full mocks", "شبیه‌ساز کامل"), L("Practise four sections in order, with timed practice and breaks.", "چهار بخش را به‌ترتیب و با زمان‌سنج و استراحت تمرین کن."), "mock", "clock"],
    [L("Short drills", "تمرین‌های کوتاه"), L("Use a few minutes for one skill or question type.", "چند دقیقه روی یک مهارت یا نوع سؤال کار کن."), "drills", "route"],
    [L("Vocabulary review", "مرور واژگان"), L("Save words in context and review them when they are due.", "واژه را در جمله ذخیره کن و در زمان مرور به آن برگرد."), "vocabulary", "bookmark"]
  ];
  const reference = [
    [L("Model answers", "پاسخ‌های نمونه"), L("Compare openings and structures in Writing and Speaking.", "آغاز و ساختار پاسخ‌های نوشتن و صحبت کردن را مقایسه کن."), "library", "pen"],
    [L("Score calculators", "محاسبهٔ نمره"), L("Check a band conversion or explore a subscore.", "تبدیل نمره یا زیرنمره‌ها را بررسی کن."), "calculators", "chart"],
    [L("Practice history", "تاریخچهٔ تمرین"), L("Reopen a review and compare two attempts.", "مرور قبلی را باز کن و دو تلاش را مقایسه کن."), "progress", "book"]
  ];
  return `<section class="wrap landing-resources" aria-labelledby="resources-title">
    ${landingLead(L("Study tools", "ابزارهای مطالعه"), L("Keep going between attempts.", "بین تلاش‌ها هم ادامه بده."), "", "resources-title")}
    <div class="resource-columns">
      ${resourceList(L("Make time to practise", "برای تمرین وقت بگذار"), practise)}
      ${resourceList(L("Plan and review", "برنامه‌ریزی و مرور"), reference)}
    </div>
  </section>`;
}

function resourceList(title, resources) {
  return `<section class="landing-resource-list" data-enter><h3>${title}</h3>${resources.map(([name, desc, path, glyph]) => `<a href="${href(path)}"><span class="icon-tile">${icon(glyph)}</span><div><b>${name}</b><small>${desc}</small></div>${arrow()}</a>`).join("")}</section>`;
}

function landingFaq() {
  return `<section class="wrap landing-faq" aria-labelledby="landing-faq-title">
    <h2 id="landing-faq-title">${L("Before you start", "پیش از شروع")}</h2><div>
      ${faq(L("What does the AI feedback show?", "بازخورد هوش مصنوعی چه چیزی نشان می‌دهد؟"), L("The Writing example marks phrases and suggests a revision. The Speaking example links feedback to moments you can replay.", "نمونهٔ نوشتن عبارت‌ها را نشانه‌گذاری می‌کند و بازنویسی پیشنهاد می‌دهد. در نمونهٔ صحبت کردن، بازخورد به لحظه‌هایی وصل است که می‌توانی دوباره پخش کنی."))}
      ${faq(L("Will I get an official score?", "آیا نمرهٔ رسمی می‌گیرم؟"), L("Sample bands are for illustration. The level check reports performance on its practice questions and suggests what to work on.", "نمره‌های نمونه برای نمایش‌اند. تعیین سطح نتیجهٔ سؤال‌های تمرینی را نشان می‌دهد و برای ادامه پیشنهاد می‌دهد."))}
      ${faq(L("Can I try it as a guest?", "می‌توانم به‌عنوان مهمان امتحان کنم؟"), L("Yes. Explore the samples, take a level check, and practise in this browser as a guest.", "بله. نمونه‌ها را ببین، تعیین سطح انجام بده و به‌عنوان مهمان در همین مرورگر تمرین کن."))}
      ${faq(L("What if I don’t have a microphone?", "اگر میکروفون نداشته باشم چه؟"), L("You can play the Speaking sample and use its transcript. Speaking practice also has a sample-response option.", "می‌توانی نمونهٔ صحبت را پخش کنی و متنش را بخوانی. در تمرین صحبت کردن هم گزینهٔ پاسخ نمونه وجود دارد."))}
    </div>
  </section>`;
}

function landingEnd() {
  return `<section class="landing-end"><div class="wrap landing-end-inner" data-enter>
    <div><h2>${L("Start with one skill.", "با یک مهارت شروع کن.")}</h2><p>${L("Try a short check, or go straight to a task from your exam.", "یک تعیین سطح کوتاه انجام بده یا مستقیم سراغ تسک آزمونت برو.")}</p></div>
    <div class="actions">${link(L("Check my level", "سطحم را بسنج"), "diagnostic", "btn primary with-arrow")}${link(L("Browse practice", "دیدن تمرین‌ها"), "practice", "btn outline")}</div>
  </div></section>`;
}

function setupLanding() {
  const root = document.querySelector(".product-landing");
  if (!root) return;
  const cleanup = [];
  root.addEventListener("play", event => {
    if (!(event.target instanceof HTMLAudioElement)) return;
    for (const audio of root.querySelectorAll("audio")) {
      if (audio !== event.target) audio.pause();
    }
  }, true);
  for (const group of root.querySelectorAll("[data-landing-tabs]")) setupLandingTabs(group);
  const writing = setupDemoNotes(root.querySelector('[data-demo-panel="writing"]'), WRITING_NOTES);
  const speaking = setupDemoNotes(root.querySelector('[data-demo-panel="speaking"]'), SPEAKING_NOTES);
  setupWritingRevision(writing);
  root.querySelectorAll("[data-sample-report]").forEach(panel => cleanup.push(setupSampleReport(panel)));
  cleanup.push(setupSpeakingAudio(speaking));
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.dataset.entered = "";
        observer.unobserve(entry.target);
      }
    }, { threshold: .13 });
    root.querySelectorAll("[data-enter]").forEach(element => observer.observe(element));
    cleanup.push(() => observer.disconnect());
  }
  return () => cleanup.forEach(dispose => dispose?.());
}

function selectLandingTab(active) {
  const group = active.closest("[data-landing-tabs]");
  for (const tab of group.querySelectorAll("[data-landing-tab]")) {
    const panel = document.getElementById(tab.getAttribute("aria-controls"));
    const selected = tab === active;
    tab.tabIndex = selected ? 0 : -1;
    tab.setAttribute("aria-selected", String(selected));
    panel.hidden = !selected;
    if (!selected) panel.querySelectorAll("audio").forEach(audio => audio.pause());
  }
}

function selectLandingRouteTab(page, params) {
  const group = page === "feedback" ? "evaluation" : page === "how" ? "report" : null;
  if (!group) return;
  const key = params.get("skill");
  const tabs = document.querySelectorAll(`[data-landing-tabs="${group}"] [data-landing-tab]`);
  const active = Array.from(tabs).find(tab => tab.dataset.landingTab === key);
  if (active) selectLandingTab(active);
}

function setupLandingTabs(group) {
  const tabs = [...group.querySelectorAll("[data-landing-tab]")];
  group.addEventListener("click", event => {
    const target = event.target.closest("[data-landing-tab]");
    if (target) selectLandingTab(target);
  });
  group.addEventListener("keydown", event => {
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    const direction = group.closest("[dir]")?.dir === "rtl" ? -1 : 1;
    const target = {
      Home: 0, End: tabs.length - 1,
      ArrowLeft: (index - direction + tabs.length) % tabs.length,
      ArrowRight: (index + direction + tabs.length) % tabs.length
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectLandingTab(tabs[target]);
    tabs[target].focus();
  });
}

function setupDemoNotes(panel, notes) {
  let index = 0;
  const markers = [...panel.querySelectorAll("[data-demo-note]")];
  const feedback = panel.querySelector("[data-note-details]");
  function select(next, fromMarker = false) {
    index = next;
    const note = notes[index];
    markers.forEach((marker, i) => marker.setAttribute("aria-pressed", String(i === index)));
    panel.querySelector("[data-note-progress]").textContent = `${num(index + 1)} / ${num(notes.length)}`;
    feedback.querySelector("[data-note-criterion]").textContent = bi(note.criterion);
    feedback.querySelector("[data-note-title]").textContent = bi(note.title);
    feedback.querySelector("[data-note-reason]").textContent = bi(note.reason);
    feedback.querySelector("[data-note-suggestion]").textContent = note.revision;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) feedback.animate([{ opacity: .72, transform: "translateY(3px)" }, { opacity: 1, transform: "none" }], { duration: 210 });
    panel.dispatchEvent(new CustomEvent("feedback-select", { detail: { note, fromMarker } }));
  }
  panel.addEventListener("click", event => {
    const marker = event.target.closest("[data-demo-note]");
    const step = event.target.closest("[data-note-step]");
    if (marker) {
      select(Number(marker.dataset.demoNote), true);
      if (event.detail > 0 && matchMedia("(max-width: 800px)").matches) {
        feedback.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      }
    } else if (step) {
      select((index + (step.dataset.noteStep === "next" ? 1 : -1) + notes.length) % notes.length);
    }
  });
  return { panel, markers };
}

function setupWritingRevision({ panel, markers }) {
  const toggle = panel.querySelector("[data-demo-revise]");
  toggle.addEventListener("click", () => {
    const revised = toggle.getAttribute("aria-pressed") !== "true";
    toggle.setAttribute("aria-pressed", String(revised));
    toggle.textContent = revised ? L("Show original response", "دیدن پاسخ اصلی") : L("Show suggested revision", "دیدن نسخهٔ پیشنهادی");
    panel.classList.toggle("showing-revision", revised);
    markers.forEach((marker, i) => { marker.textContent = revised ? WRITING_NOTES[i].revision : WRITING_NOTES[i].original; });
  });
}

function setupSpeakingAudio({ panel, markers }) {
  const audio = panel.querySelector("[data-demo-audio]");
  const play = panel.querySelector("[data-demo-play]");
  const seek = panel.querySelector("[data-demo-seek]");
  const wave = panel.querySelector("[data-demo-wave]");
  const message = panel.querySelector("[data-audio-message]");
  const elapsed = panel.querySelector("[data-demo-time]");
  const duration = panel.querySelector("[data-demo-duration]");
  let cueStart = 0;
  function unavailable() {
    message.hidden = false;
    play.disabled = true;
    seek.disabled = true;
  }
  function playSample() {
    message.hidden = true;
    audio.play().catch(error => {
      if (error.name !== "AbortError") message.hidden = false;
    });
  }
  audio.addEventListener("error", unavailable);
  play.addEventListener("click", () => {
    if (audio.paused) playSample();
    else audio.pause();
  });
  const updatePlaying = () => {
    const playing = !audio.paused && !audio.ended;
    play.setAttribute("aria-label", playing ? L("Pause sample recording", "توقف صدای نمونه") : L("Play sample recording", "پخش صدای نمونه"));
    play.firstElementChild.textContent = playing ? "Ⅱ" : "▶";
  };
  function updateTime() {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      seek.max = audio.duration;
      duration.textContent = clipTime(audio.duration);
      wave.style.setProperty("--playhead", `${audio.currentTime / audio.duration * 100}%`);
    }
    seek.value = audio.currentTime;
    elapsed.textContent = clipTime(audio.currentTime);
    seek.setAttribute("aria-valuetext", `${elapsed.textContent} / ${duration.textContent}`);
    const index = SPEAKING_NOTES.findLastIndex(note => audio.currentTime >= note.start);
    markers.forEach((marker, i) => marker.classList.toggle("is-playing-line", i === index && !audio.paused));
  }
  seek.addEventListener("input", () => { audio.currentTime = Number(seek.value); });
  panel.addEventListener("feedback-select", event => {
    const { note, fromMarker } = event.detail;
    cueStart = note.start;
    if (!audio.readyState) return;
    audio.currentTime = cueStart;
    if (fromMarker && audio.paused) playSample();
    updateTime();
  });
  for (const name of ["play", "pause", "ended"]) audio.addEventListener(name, () => { updatePlaying(); updateTime(); });
  for (const name of ["timeupdate", "seeked"]) audio.addEventListener(name, updateTime);
  audio.addEventListener("loadedmetadata", () => {
    audio.currentTime = cueStart;
    play.disabled = false;
    seek.disabled = false;
    updateTime();
  });
  updateTime();

  return loadLandingClip(audio, unavailable);
}

function loadLandingClip(audio, unavailable) {
  if (location.protocol === "file:") {
    audio.src = audio.dataset.src;
    return;
  }
  // Load short demo clips in full so seeking works on static servers without byte ranges.
  const request = new AbortController();
  let clipUrl;
  fetch(audio.dataset.src, { signal: request.signal })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.blob();
    })
    .then(clip => {
      if (request.signal.aborted) return;
      clipUrl = URL.createObjectURL(clip);
      audio.src = clipUrl;
    })
    .catch(() => {
      if (!request.signal.aborted) unavailable();
    });
  return () => {
    request.abort();
    if (clipUrl) URL.revokeObjectURL(clipUrl);
  };
}
