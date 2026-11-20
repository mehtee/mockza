"use strict";

const PUBLIC_PATHS = new Set(["", ...Object.keys(LANDING_SECTIONS), "exams", "guides", "guide", "calculators", "calculator", "library", "sample", "words", "reference", "plans", "help", "privacy", "terms"]);

const CALCULATORS = [
  { id: "ielts", title: ["IELTS band calculator", "محاسبهٔ نمره آیلتس"], desc: ["Convert correct answers in Reading or Listening to a band.", "تعداد پاسخ درست در خواندن یا شنیدن را به نمره تبدیل کن."], scale: "0–9" },
  { id: "toefl", title: ["TOEFL score converter", "تبدیل نمره تافل"], desc: ["Estimate the legacy 120-point score from a 2026 band.", "معادل تقریبی نمرهٔ جدید را در مقیاس ۱۲۰ ببین."], scale: "1–6" },
  { id: "pte", title: ["PTE to IELTS concordance", "هم‌ارزی پی‌تی‌ای و آیلتس"], desc: ["Look up comparable IELTS bands and CEFR levels.", "نمرهٔ هم‌ارز آیلتس و سطح CEFR را پیدا کن."], scale: "10–90" },
  { id: "det", title: ["DET subscore estimator", "تخمین زیرنمره‌های دولینگو"], desc: ["Combine skill scores into the four integrated subscores.", "از نمرهٔ مهارت‌ها، چهار زیرنمرهٔ ترکیبی را به دست بیاور."], scale: "10–160" }
];

function publicHeader() {
  return `<header class="site-header"><div class="wrap topbar">
    ${brandLink()}
    <nav aria-label="${L("Main navigation", "ناوبری اصلی")}">
      ${link(L("Sample report", "گزارش نمونه"), "how")}
      ${link(L("AI feedback", "بازخورد هوش مصنوعی"), "feedback")}
      ${link(L("Exams", "آزمون‌ها"), "guides")}
    </nav>
    <div class="header-actions">
      ${editionLink()}
      ${link(L("Open app", "ورود به برنامه"), "app", "btn primary small")}
    </div>
  </div></header>`;
}

function publicFooter() {
  return `<footer class="site-footer"><div class="wrap footer-grid">
    <div>${brandLink()}<p>${L("A clearer path to exam day.", "مسیری روشن تا روز آزمون.")}</p></div>
    <div><h2>${L("Explore", "کشف کن")}</h2>${link(L("Exam guides", "راهنمای آزمون‌ها"), "guides")}${link(L("Score calculators", "محاسبهٔ نمره"), "calculators")}${link(L("Sample answers", "پاسخ‌های نمونه"), "library")}</div>
    <div><h2>${L("Get started", "شروع کن")}</h2>${link(L("Starting-level check", "تعیین سطح"), "diagnostic")}${link(L("Practice catalog", "تمرین‌ها"), "practice")}${link(L("Plans", "اشتراک"), "plans")}</div>
    <div><h2>${L("Information", "اطلاعات")}</h2>${link(L("Help", "راهنما"), "help")}${link(L("Privacy", "حریم خصوصی"), "privacy")}${link(L("Terms", "شرایط استفاده"), "terms")}</div>
  </div><div class="wrap footer-note"><span>${L("Interactive prototype", "نمونهٔ تعاملی")}</span>${editionLink()}</div></footer>`;
}

function journeyCard(glyph, title, description, path, label) {
  return `<article class="journey-card"><span class="icon-tile">${icon(glyph)}</span><h3>${title}</h3><p>${description}</p>${link(label, path, "text-link with-arrow")}</article>`;
}

function faq(question, answer) {
  return `<details class="disclosure"><summary>${question}</summary><p>${answer}</p></details>`;
}

function guideList() {
  return `<div class="wrap page">${lead(L("Exam guides", "راهنمای آزمون‌ها"), L("Pick the exam that matches your goal. Each guide links to practice in the same format.", "آزمون متناسب با هدفت را پیدا کن. هر راهنما تمرین همان قالب را معرفی می‌کند."))}
    <div class="stack">${CONTENT.tracks.map(track => `<a class="line-card" href="${href(`guide/${track.id}`)}"><span class="track-mark">${esc(track.mark)}</span><div><b>${trackName(track)}</b><small>${bi(track.desc)}</small></div><span class="line-meta">${numText(track.scale)}</span>${arrow()}</a>`).join("")}</div></div>`;
}

function guidePage(id) {
  const selected = findTrack(id);
  if (!selected) return notFound();
  return `<div class="wrap page">
    ${link(L("All exam guides", "همهٔ راهنماها"), "guides", "crumb")}
    ${lead(trackName(selected), bi(selected.desc), link(L("Practise this exam", "تمرین این آزمون"), "practice", "btn primary with-arrow", { track: id }))}
    <div class="detail-layout">
      <section class="surface"><h2>${L("What to practise", "چه چیزی تمرین کنم؟")}</h2><div class="stack">${SKILL_KEYS.map(skill => `<a class="line-card" href="${href("setup", { track: id, skill })}"><span class="icon-tile">${icon(CONTENT.skills[skill].icon)}</span><div><b>${skillName(skill)}</b><small>${bi(CONTENT.skills[skill].desc)}</small></div>${arrow()}</a>`).join("")}</div></section>
      <aside class="surface tint"><span class="section-label">${L("SCORE SCALE", "مقیاس نمره")}</span><strong class="display-value">${numText(selected.scale)}</strong><p>${L("Set a goal on this scale when you start your study plan.", "هنگام شروع برنامهٔ مطالعه، هدفت را روی همین مقیاس تنظیم کن.")}</p>${link(L("Estimate a score", "تخمین نمره"), `calculator/${calculatorForTrack(id)}`, "text-link with-arrow")}</aside>
    </div>
    <div class="subsection"><h2>${L("See an example", "یک نمونه ببین")}</h2><div class="tile-grid two">${["writing", "speaking"].map(skill => `<a class="line-card" href="${href(`sample/${skill}/${id}`)}"><span class="icon-tile">${icon(CONTENT.skills[skill].icon)}</span><div><b>${skillName(skill)}</b><small>${L("Prompt and model response", "صورت سؤال و پاسخ نمونه")}</small></div>${arrow()}</a>`).join("")}</div></div>
  </div>`;
}

function calculatorForTrack(track) {
  return track.startsWith("ielts") ? "ielts" : { "toefl-ibt": "toefl", "pte-academic": "pte", det: "det" }[track];
}

function calculatorsPage() {
  return `<div class="wrap page">${lead(L("Score calculators", "محاسبهٔ نمره"), L("Explore conversions and subscores for your exam.", "تبدیل نمره و زیرنمره‌های آزمونت را بررسی کن."))}
    <div class="tile-grid two">${CALCULATORS.map(item => `<a class="tile" href="${href(`calculator/${item.id}`)}"><span class="tag">${numText(item.scale)}</span><h2>${bi(item.title)}</h2><p>${bi(item.desc)}</p>${arrow()}</a>`).join("")}</div></div>`;
}

function calculatorPage(id) {
  const calc = CALCULATORS.find(item => item.id === id);
  if (!calc) return notFound();
  let fields;
  if (id === "ielts") {
    fields = `<label>${L("Test section", "بخش آزمون")}<select name="section"><option value="academic">${L("Academic Reading", "خواندن آکادمیک")}</option><option value="general">${L("General Training Reading", "خواندن جنرال")}</option><option value="listening">${L("Listening", "شنیدن")}</option></select></label>${rangeField("raw", L("Correct answers out of 40", "پاسخ‌های صحیح از ۴۰"), 0, 40, 1, 30)}`;
  } else if (id === "toefl") {
    fields = rangeField("band", L("2026 band", "نمرهٔ ۲۰۲۶"), 1, 6, .5, 5);
  } else if (id === "pte") {
    fields = rangeField("score", L("PTE Academic score", "نمرهٔ پی‌تی‌ای آکادمیک"), 10, 90, 1, 65);
  } else {
    fields = SKILL_KEYS.map((skill, index) => rangeField(skill, skillName(skill), 10, 160, 5, [125, 120, 115, 115][index])).join("");
  }
  return `<div class="wrap page">${link(L("All calculators", "همهٔ محاسبه‌گرها"), "calculators", "crumb")}${lead(bi(calc.title), bi(calc.desc))}
    <div class="detail-layout"><form class="surface form-stack" data-calculator="${id}">${fields}</form><section class="surface tint calculator-result" aria-live="polite" id="calc-result"></section></div>
    <p class="muted">${L("These mappings are estimates. Use your test provider's score report for official decisions.", "این تبدیل‌ها تقریبی‌اند. برای تصمیم رسمی به کارنامهٔ برگزارکننده مراجعه کن.")}</p></div>`;
}

function rangeField(name, label, min, max, step, value) {
  return `<label><span class="label-line">${label}<output>${num(value)}</output></span><input type="range" name="${name}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
}

function updateCalculator(form) {
  const data = new FormData(form);
  for (const input of form.querySelectorAll("input[type=range]")) input.closest("label").querySelector("output").textContent = num(+input.value);
  const output = document.getElementById("calc-result");
  const label = (title, value, detail = "") => `<span class="section-label">${title}</span><strong class="display-value">${value}</strong>${detail ? `<p>${detail}</p>` : ""}`;
  switch (form.dataset.calculator) {
    case "ielts": {
      const thresholds = {
        academic: [39, 37, 35, 33, 30, 27, 23, 19, 15, 13, 10, 8, 6, 1],
        general: [40, 39, 37, 36, 34, 32, 30, 27, 23, 19, 15, 12, 9, 1],
        listening: [39, 37, 35, 32, 30, 26, 23, 18, 16, 13, 10, 6, 4, 1]
      }[data.get("section")];
      const idx = thresholds.findIndex(threshold => Number(data.get("raw")) >= threshold);
      output.innerHTML = label(L("ESTIMATED BAND", "نمرهٔ تقریبی"), num(idx < 0 ? 0 : 9 - idx * .5, 1), L("Out of 9", "از ۹"));
      break;
    }
    case "toefl": {
      const scores = [5, 14, 25, 38, 51, 64, 78, 90, 100, 110, 117];
      output.innerHTML = label(L("LEGACY SCORE ESTIMATE", "معادل تقریبی نمره"), num(scores[(+data.get("band") - 1) * 2]), L("Out of 120", "از ۱۲۰"));
      break;
    }
    case "pte": {
      const match = [[89, 9, "C2"], [84, 8.5, "C2"], [76, 8, "C1"], [66, 7.5, "C1"], [59, 7, "C1"], [52, 6.5, "B2"], [43, 6, "B2"], [36, 5.5, "B2"]].find(([min]) => +data.get("score") >= min);
      output.innerHTML = label(L("APPROXIMATE IELTS BAND", "نمرهٔ تقریبی آیلتس"), match ? num(match[1], 1) : "—", match ? `CEFR ${match[2]}` : L("Below the displayed concordance range.", "پایین‌تر از محدودهٔ جدول هم‌ارزی."));
      break;
    }
    case "det": {
      const [r, l, w, s] = SKILL_KEYS.map(skill => +data.get(skill));
      const pairs = [[L("Literacy", "سواد زبانی"), r, w], [L("Comprehension", "درک مطلب"), r, l], [L("Conversation", "مکالمه"), l, s], [L("Production", "تولید زبان"), w, s]];
      output.innerHTML = `<span class="section-label">${L("INTEGRATED SUBSCORES", "زیرنمره‌های ترکیبی")}</span><dl class="result-list">${pairs.map(([name, a, b]) => `<div><dt>${name}</dt><dd>${num(Math.round((a + b) / 10) * 5)}</dd></div>`).join("")}</dl>`;
    }
  }
}

function libraryPage(params) {
  const filter = params.get("type") === "speaking" ? "speaking" : "writing";
  return `<div class="wrap page">${lead(L("Study library", "کتابخانهٔ مطالعه"), L("Read model responses, learn useful expressions, and see why an example works.", "پاسخ‌های نمونه و عبارت‌های مفید را ببین و دلیل کارایی یک پاسخ را بخوان."))}
    <div class="chips">${["writing", "speaking"].map(skill => link(skillName(skill), "library", `chip ${skill === filter ? "selected" : ""}`, { type: skill })).join("")}${link(L("Vocabulary reference", "مرجع واژگان"), "words", "chip")}${link(L("Score calculators", "محاسبهٔ نمره"), "calculators", "chip")}</div>
    <div class="tile-grid two">${CONTENT.tracks.map(track => {
      const task = filter === "writing" ? CONTENT.writing[track.id][0] : CONTENT.speaking[track.id];
      return `<a class="tile" href="${href(`sample/${filter}/${track.id}`)}"><span class="tag">${trackName(track)}</span><h2 dir="ltr" lang="en">${esc(task.title)}</h2><p dir="ltr" lang="en">${esc(task.type)}</p>${arrow()}</a>`;
    }).join("")}</div></div>`;
}

function samplePage(skill, track) {
  if (!findTrack(track) || !["speaking", "writing"].includes(skill)) return notFound();
  const task = skill === "writing" ? CONTENT.writing[track][0] : CONTENT.speaking[track];
  const responses = {
    writing: {
      "ielts-academic": "Overall, the number of visits increased through the week before a slight fall on Friday. Thursday was the busiest day, with roughly twice as many visits as Monday.",
      "ielts-general": "Dear Course Organiser, I am writing to ask about evening language classes. My work schedule has changed, so I can no longer attend the afternoon session. I would be available on Mondays and Wednesdays after six.",
      "toefl-ibt": "Dear Ms Carter, our group booked the common room, but it has become too noisy for discussion. Would it be possible to reserve a study room on the second floor on Thursday afternoon?",
      "pte-academic": "After a successful trial, the library chose to extend its opening hours on the two busiest evenings and divide its space so that group learners and quiet readers could use it together.",
      det: "I concentrate best in the small study room at my public library. The desks face a window, so I can work in natural light without seeing people walk past."
    },
    speaking: {
      "ielts-academic": "One place that helps me focus is the small room beside our town library. I go there on Saturday mornings when I need to read something difficult. Last week I used it to prepare for a history seminar.",
      "ielts-general": "I learned basic bicycle repair from a neighbour after I got a flat tyre on my way to work. She showed me how to find the puncture, and then asked me to fix it myself.",
      "toefl-ibt": "I prefer to study with a group if we are working on a difficult subject. Last week, for example, a classmate showed me a simpler way to approach a statistics problem.",
      "pte-academic": "Visits rose from Monday to Thursday, then fell slightly on Friday. Thursday had about a hundred and forty visits, roughly twice the Monday figure.",
      det: "I like learning in the public library. There's a desk beside a big window, and the quiet area has no phones or conversations. Those two things help me stay focused."
    }
  };
  return `<div class="wrap page">${link(L("Study library", "کتابخانهٔ مطالعه"), "library", "crumb", { type: skill })}${lead(esc(task.title), trackName(findTrack(track)), link(L("Try this skill", "تمرین این مهارت"), "setup", "btn primary with-arrow", { track, skill }), true)}
    <div class="detail-layout"><section class="surface english" lang="en" dir="ltr"><span class="section-label">Prompt</span><p>${esc(task.prompt)}</p>${task.chart ? miniChart() : ""}${task.passage ? `<div class="prose">${CONTENT.reading.text.map(text => `<p>${esc(text)}</p>`).join("")}</div>` : ""}<hr><span class="section-label">Sample opening</span><blockquote>${esc(responses[skill][track])}</blockquote></section>
    <aside class="surface tint"><h2>${L("Why it works", "چرا خوب عمل می‌کند؟")}</h2><p>${skill === "speaking" ? L("The opening answers the prompt directly and makes the idea concrete with a detail.", "آغاز پاسخ مستقیم به سؤال جواب می‌دهد و با یک جزئیات، ایده را روشن می‌کند.") : L("The opening responds to the task early. It gives the reader a clear idea of what comes next.", "آغاز پاسخ زود به تسک می‌پردازد و مسیر ادامهٔ پاسخ را برای خواننده روشن می‌کند.")}</p></aside></div></div>`;
}

function planPage(publicView) {
  return `<div class="wrap page narrow">${lead(L("Make room for regular practice.", "برای تمرین منظم جا باز کن."), L("Choose the level of support you need. The checkout here is a prototype.", "سطح پشتیبانی دلخواهت را انتخاب کن. پرداخت اینجا آزمایشی است."))}
    <div class="tile-grid two plan-grid">
    <article class="surface"><h2>${L("Free", "رایگان")}</h2><strong class="display-value">${IRN ? "۰ تومان" : "$0"}</strong><ul><li>${L("Starting-level check and sample report", "تعیین سطح و گزارش نمونه")}</li><li>${L("Sample practice across five exams", "تمرین نمونه برای پنج آزمون")}</li><li>${L("Local attempts and vocabulary review", "تاریخچهٔ محلی و مرور واژگان")}</li></ul>${link(L("Start practising", "شروع تمرین"), "practice", "btn outline")}</article>
    <article class="surface tint"><h2>${L("Pro preview", "پیش‌نمایش حرفه‌ای")}</h2><strong class="display-value">${IRN ? "۲۹۹٬۰۰۰ تومان" : "$12"}</strong><span class="muted">${L(" / month · illustrative", " در ماه · قیمت نمونه")}</span><ul><li>${L("Writing and Speaking feedback", "بازخورد نوشتن و صحبت کردن")}</li><li>${L("Full mock practice", "شبیه‌ساز کامل")}</li><li>${L("One mobile and one desktop slot", "یک جایگاه موبایل و یک دسکتاپ")}</li></ul>
    ${publicView ? link(L("See the app plan", "دیدن اشتراک در برنامه"), "paywall", "btn primary with-arrow") : `<form class="form-stack" data-form="checkout"><label class="check"><input type="checkbox" name="consent" required>${L("I understand the device policy.", "شرایط دستگاه‌ها را خواندم.")}</label><button class="btn primary" type="submit">${L("Preview checkout", "پیش‌نمایش پرداخت")}</button></form>`}
    </article></div></div>`;
}

function informationPage(page) {
  const info = {
    help: [L("Help", "راهنما"), L("Start with a level check or open a practice task. Use Settings to export your demo data or clear it from this browser.", "با تعیین سطح یا باز کردن یک تمرین شروع کن. از تنظیمات می‌توانی دادهٔ آزمایشی را خروجی بگیری یا از این مرورگر پاک کنی.")],
    privacy: [L("Privacy", "حریم خصوصی"), L("This prototype stores your study activity in your browser. Demo sign-in creates a local profile. Microphone recordings stay in the active browser session.", "این نمونه فعالیت مطالعه را در مرورگر ذخیره می‌کند. ورود آزمایشی یک پروفایل محلی می‌سازد. صدای میکروفون در نشست فعلی مرورگر می‌ماند.")],
    terms: [L("Terms", "شرایط استفاده"), L("This is an interactive study prototype. Sample feedback and results are for practice. Plans and checkout are simulated.", "این یک نمونهٔ تعاملی برای تمرین است. بازخورد و نتیجه برای تمرین‌اند. اشتراک و پرداخت شبیه‌سازی شده‌اند.")]
  }[page];
  return `<div class="wrap page narrow">${lead(info[0], info[1])}${link(L("Open the app", "باز کردن برنامه"), "app", "btn primary with-arrow")}</div>`;
}

function publicPage(page, segments, params) {
  if (isLandingRoute(page)) return landingPage(params);
  const content = {
    guides: () => guideList(),
    guide: () => guidePage(segments[0]),
    exams: () => {
      const track = findTrack(params.get("track"));
      return track ? guidePage(track.id) : guideList();
    },
    calculators: () => calculatorsPage(),
    calculator: () => calculatorPage(segments[0]),
    library: () => libraryPage(params),
    sample: () => samplePage(segments[0], segments[1]),
    words: () => vocabularyPage(params, true),
    reference: () => wordPage(segments[0], true),
    plans: () => planPage(true),
    help: () => informationPage("help"),
    privacy: () => informationPage("privacy"),
    terms: () => informationPage("terms")
  }[page]?.() ?? notFound();
  return `<main id="content" tabindex="-1">${content}</main>`;
}
