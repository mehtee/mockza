"use strict";

const IRN = document.documentElement.dataset.edition === "sanjia";
const BRAND = IRN ? "سنجیا" : "Mockza";
const STORAGE_KEY = IRN ? "sanjia-web-prototype-v1" : "mockza-web-prototype-v1";
const app = document.getElementById("app");
const formatNumber = new Intl.NumberFormat(IRN ? "fa-IR" : "en", { useGrouping: false, maximumFractionDigits: 2 });
const ICONS = { route: "⌁", compass: "✧", book: "▤", audio: "≋", pen: "✎", mic: "◉", chart: "▥", clock: "◷", play: "▶", check: "✓", flag: "⚑", bookmark: "♧", sun: "☼", moon: "☾" };
let state = readState();
let view;
let dialogAction;
let disposeLanding;
let wordFlipped = false;
let notice = "";
let noticeTimer;
let demoPhoneChallenge = false;

function L(en, fa) { return IRN ? fa : en; }
function bi(pair) { return L(pair[0], pair[1]); }
function num(value, decimals) {
  if (decimals === undefined) return formatNumber.format(value);
  return Number(value).toLocaleString(IRN ? "fa-IR" : "en", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function numText(value) { return IRN ? String(value).replace(/[0-9]/g, digit => "۰۱۲۳۴۵۶۷۸۹"[digit]) : String(value); }
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function findTrack(id) { return CONTENT.tracks.find(track => track.id === id); }
function activeTrack() { return findTrack(state.track) ?? CONTENT.tracks[0]; }
function trackName(track) { return IRN ? track.fa : track.name; }
function skillName(skill) { return bi(CONTENT.skills[skill].name); }
function icon(name) { return `<span class="glyph" aria-hidden="true">${ICONS[name] ?? ICONS.route}</span>`; }
function arrow() { return `<span class="arrow" aria-hidden="true">→</span>`; }
function href(path = "", params = {}) {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value != null && value !== ""));
  return `#/${path}${search.size ? "?" + search.toString() : ""}`;
}
function link(label, path, className = "", params = {}) {
  return `<a${className ? ` class="${className}"` : ""} href="${esc(href(path, params))}">${esc(label)}${className.includes("with-arrow") ? arrow() : ""}</a>`;
}
function actionButton(label, action, className = "btn outline", extras = "") {
  return `<button type="button" class="${className}" data-action="${action}" ${extras}>${esc(label)}${className.includes("with-arrow") ? arrow() : ""}</button>`;
}
function brandLink(path = "") {
  return `<a class="brand" href="${href(path)}" aria-label="${esc(BRAND)}"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span>${BRAND}<span class="brand-period" aria-hidden="true">.</span></span></a>`;
}
function editionHref() {
  return `${IRN ? "index.html" : "sanjia.html"}${location.search}${location.hash}`;
}
function editionLink() {
  return `<a class="edition-link" href="${esc(editionHref())}" lang="${L("fa", "en")}" dir="${L("rtl", "ltr")}">${L("سنجیا", "Mockza")}</a>`;
}
function lead(title, detail = "", action = "", english = false) {
  return `<header class="page-lead"><div><h1 ${english ? 'dir="ltr" lang="en"' : ""}>${title}</h1>${detail ? `<p>${detail}</p>` : ""}</div>${action}</header>`;
}
function nowId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function getRoute() {
  const [path, search = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const [page, ...segments] = path.split("/");
  return { page, segments, params: new URLSearchParams(search) };
}
function go(path, params) {
  const target = href(path, params);
  if (location.hash === target) render();
  else location.hash = target;
}
function goRaw(target) {
  if (/^#\/(?!\/)[a-z0-9/?=&%_-]*$/i.test(target ?? "")) {
    if (location.hash === target) render();
    else location.hash = target;
  } else go("app");
}
function defaultState() {
  return { track: CONTENT.tracks[0].id, profile: null, goal: null, theme: "light", pro: false, attempts: [], words: {}, draft: null };
}
function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultState(), ...(value && typeof value === "object" ? value : {}) };
  } catch { return defaultState(); }
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {
    // The active screen still works in memory.
  }
}
function formatDate(value) {
  return new Date(value).toLocaleDateString(IRN ? "fa-IR-u-ca-persian" : "en", { month: "short", day: "numeric", year: "numeric" });
}

function appHeader() {
  const position = view.page;
  const nav = [
    ["app", L("Study room", "اتاق مطالعه"), ["app", "welcome", "goal", "diagnostic"]],
    ["practice", L("Practice", "تمرین"), ["practice", "setup", "mock", "drills", "drill"]],
    ["vocabulary", L("Vocabulary", "واژگان"), ["vocabulary", "word", "flashcards"]],
    ["progress", L("Progress", "پیشرفت"), ["progress", "compare", "review", "pending"]]
  ];
  return `<header class="site-header app-header"><div class="wrap topbar">${brandLink("app")}
    <nav aria-label="${L("Study navigation", "ناوبری مطالعه")}">${nav.map(([path, label, match]) => `<a href="${href(path)}"${match.includes(position) ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav>
    <div class="header-actions">
      ${link(L("Website", "وب‌سایت"), "", "plain-link header-site")}
      ${state.profile ? `<a class="avatar" aria-label="${L("Settings", "تنظیمات")}" href="${href("settings")}">${esc(state.profile.name.slice(0, 1).toUpperCase())}</a>` : link(L("Sign in", "ورود"), "auth", "btn outline small", { next: location.hash || href("app") })}
    </div></div></header>`;
}
function appFooter() {
  return `<footer class="wrap app-footer"><span>${BRAND} · ${L("Prototype", "نسخهٔ آزمایشی")}</span><div>${link(L("Help", "راهنما"), "help")}${link(L("Settings", "تنظیمات"), "settings")}${editionLink()}</div></footer>`;
}

function welcomePage() {
  const draft = state.draft;
  const goal = state.goal && findTrack(state.goal.track);
  const recent = state.attempts.find(attempt => attempt.kind === "diagnostic");
  return `<div class="wrap room">
    <section class="room-heading">
      <div class="room-emblem">${icon("compass")}</div>
      <span class="section-label">${L("YOUR STUDY ROOM", "اتاق مطالعهٔ تو")}</span>
      <h1>${state.profile ? L(`Welcome, ${esc(state.profile.name)}.`, `خوش آمدی، ${esc(state.profile.name)}.`) : L("What would you like<br>to work on?", "امروز روی چه چیزی<br>کار می‌کنی؟")}</h1>
      <p>${goal ? `${esc(trackName(goal))} · ${L("Target", "هدف")} ${num(state.goal.target)}${state.goal.date ? ` · ${formatDate(state.goal.date + "T12:00:00")}` : ""}` : L("Pick a starting point. You can choose a different exam whenever you need.", "نقطهٔ شروع را انتخاب کن. هر زمان بخواهی می‌توانی آزمونت را عوض کنی.")}</p>
    </section>
    ${draft ? `<section class="continue-card"><div><span class="section-label">${L("IN PROGRESS", "در حال انجام")}</span><h2>${skillName(draft.skills[draft.stage])} · ${esc(trackName(findTrack(draft.track)))}</h2></div>${link(L("Continue attempt", "ادامهٔ تمرین"), draft.break ? "break" : "session", "btn primary with-arrow")}</section>` : ""}
    <div class="room-choices">
      <a class="room-choice featured" href="${href("diagnostic")}"><span class="icon-tile">${icon("compass")}</span><div><h2>${L("Check my level", "تعیین سطح")}</h2><p>${L("Find what to practise next with a short assessment.", "با یک ارزیابی کوتاه، قدم بعدی تمرین را پیدا کن.")}</p></div>${arrow()}</a>
      <a class="room-choice" href="${href("practice")}"><span class="icon-tile">${icon("book")}</span><div><h2>${L("Practise a skill", "تمرین یک مهارت")}</h2><p>${L("Pick an exam, a skill, and your pace.", "آزمون، مهارت و حالت تمرینت را انتخاب کن.")}</p></div>${arrow()}</a>
    </div>
    <div class="room-links">${link(goal ? L("Edit my goal", "ویرایش هدف") : L("Set an exam goal", "تعیین هدف آزمون"), "goal", "text-link")}${link(L("Try a short drill", "تمرین کوتاه"), "drills", "text-link")}${link(recent ? L("View my level check", "دیدن تعیین سطح من") : L("View a sample report", "دیدن گزارش نمونه"), `review/${recent?.id ?? "sample"}`, "text-link")}</div>
  </div>`;
}
function trackOptions(selected) {
  return CONTENT.tracks.map(track => `<option value="${track.id}" ${track.id === selected ? "selected" : ""}>${trackName(track)}</option>`).join("");
}
function goalPage() {
  const selected = findTrack(view.params.get("track")) ?? activeTrack();
  const goal = state.goal?.track === selected.id ? state.goal : null;
  return `<div class="wrap page narrow">${link(L("Study room", "اتاق مطالعه"), "app", "crumb")}${lead(L("Give your practice a goal.", "برای تمرینت هدف بگذار."), L("Choose an exam and a target. Add your exam date if you know it.", "آزمون و نمرهٔ هدف را انتخاب کن. اگر تاریخ آزمون را می‌دانی آن را اضافه کن."))}
    <form class="surface form-stack" data-form="goal"><label>${L("Exam track", "نوع آزمون")}<select name="track" data-goal-track>${trackOptions(selected.id)}</select></label>
    <div class="form-row"><label>${L("Target score", "نمرهٔ هدف")}<input type="number" name="target" min="${selected.min}" max="${selected.max}" step="${selected.step}" required value="${goal?.target ?? selected.goal}"><small data-target-scale>${numText(selected.scale)}</small></label>
    <label>${L("Exam date (optional)", "تاریخ آزمون (اختیاری)")}<input type="date" name="date" value="${esc(goal?.date ?? "")}"></label></div>
    <div class="actions"><button type="submit" class="btn primary">${L("Save goal", "ذخیرهٔ هدف")}</button>${link(L("Choose later", "بعداً انتخاب می‌کنم"), "app", "btn quiet")}</div></form>
  </div>`;
}
function authPage() {
  const mode = view.params.get("mode");
  const creating = mode === "create";
  const phone = IRN && !creating;
  const verify = phone && mode === "verify" && demoPhoneChallenge;
  const next = view.params.get("next") ?? "";
  const title = verify ? L("Enter demo code", "کد آزمایشی را وارد کن") : creating ? L("Make a study profile", "یک پروفایل مطالعه بساز") : L("Sign in to your study room", "ورود به اتاق مطالعه");
  const detail = verify ? "کد نمونه ۲۴۶۸۱۰ است. پیامکی ارسال نشده." : phone ? "این ورود آزمایشی است و شماره‌ات ذخیره نمی‌شود." : L("Use any display name to try a local demo profile.", "برای امتحان پروفایل محلی، یک نام نمایشی وارد کن.");
  const formType = verify ? "verify-phone" : phone ? "demo-phone" : "sign-in";
  const fields = verify ? '<label>کد یک‌بارمصرف<input type="text" name="code" inputmode="numeric" dir="ltr" autocomplete="off" maxlength="6" required placeholder="۲۴۶۸۱۰"></label>'
    : phone ? '<label>شمارهٔ موبایل<input type="tel" name="phone" dir="ltr" autocomplete="off" placeholder="۰۹۱۲۳۴۵۶۷۸۹" required></label>'
    : `<label>${L("Display name", "نام نمایشی")}<input type="text" name="name" required maxlength="40" autocomplete="nickname" placeholder="${L("Your name", "نام تو")}"></label>`;
  const submitLabel = verify ? "تأیید و ورود" : phone ? "دریافت کد آزمایشی" : creating ? L("Create demo profile", "ساخت پروفایل آزمایشی") : L("Continue with demo profile", "ادامه با پروفایل آزمایشی");
  return `<div class="wrap page auth-page">
    <div class="auth-art" aria-hidden="true"><div class="room-emblem">${icon("compass")}</div><p>${L("One step closer<br>to exam day.", "یک قدم نزدیک‌تر<br>به روز آزمون.")}</p></div>
    <div class="auth-content">${link(L("Study room", "اتاق مطالعه"), "app", "crumb")}${lead(title, detail)}
      <form class="form-stack" data-form="${formType}">${fields}<input type="hidden" name="next" value="${esc(next)}"><button class="btn primary" type="submit">${submitLabel}</button></form>
      <div class="room-links">${link(verify ? "ویرایش شماره" : creating ? L("Back to sign in", "بازگشت به ورود") : L("Create a demo profile", "ساخت پروفایل آزمایشی"), "auth", "text-link", { mode: creating || verify ? "" : "create", next })}${link(L("Continue as guest", "ادامه به‌عنوان مهمان"), "app", "text-link")}</div>
    </div>
  </div>`;
}

function practicePage() {
  const selected = findTrack(view.params.get("track")) ?? activeTrack();
  const filter = SKILL_KEYS.includes(view.params.get("skill")) ? view.params.get("skill") : "";
  const detailFor = {
    reading: [CONTENT.reading.title, L("Practice passage · 4 questions", "متن تمرینی · ۴ سؤال")],
    listening: [CONTENT.listening.title, L("Short recording · 3 questions", "صدای کوتاه · ۳ سؤال")],
    writing: [CONTENT.writing[selected.id][0].title, CONTENT.writing[selected.id][0].type],
    speaking: [CONTENT.speaking[selected.id].title, CONTENT.speaking[selected.id].type]
  };
  return `<div class="wrap page">${lead(L("Practice catalog", "تمرین‌ها"), L("Choose a task from your exam, then decide how you want to work.", "تسکی از آزمونت انتخاب کن و بعد حالت تمرین را مشخص کن."))}
    <div class="catalog-controls"><label>${L("Exam track", "نوع آزمون")}<select data-track-filter>${trackOptions(selected.id)}</select></label>
      <label class="search-label">${L("Find a task", "جستجوی تمرین")}<input type="search" data-filter-list placeholder="${L("Search tasks or skills…", "تسک یا مهارت را جستجو کن…")}"></label></div>
    <nav class="chips" aria-label="${L("Filter by skill", "فیلتر مهارت")}">${link(L("All skills", "همهٔ مهارت‌ها"), "practice", `chip ${!filter ? "selected" : ""}`, { track: selected.id })}${SKILL_KEYS.map(skill => link(skillName(skill), "practice", `chip ${skill === filter ? "selected" : ""}`, { track: selected.id, skill })).join("")}</nav>
    <div class="catalog-list">
    ${SKILL_KEYS.filter(skill => !filter || filter === skill).map(skill => {
      const [title, type] = detailFor[skill];
      return `<a class="catalog-item" href="${href("setup", { track: selected.id, skill })}" data-searchable="${esc(`${title} ${type} ${skill} ${skillName(skill)}`)}">
        <span class="icon-tile">${icon(CONTENT.skills[skill].icon)}</span><div><span class="eyebrow">${skillName(skill)}</span><h2 lang="en" dir="ltr">${esc(title)}</h2><p>${esc(type)}</p></div><span class="label-time">${L("Sample task", "تسک نمونه")}</span>${arrow()}</a>`;
    }).join("")}<p class="muted" data-empty-search hidden>${L("No tasks match that search.", "تمرینی مطابق جستجو پیدا نشد.")}</p></div>
    <section class="subsection"><h2>${L("Different ways to practise", "روش‌های دیگر تمرین")}</h2><div class="tile-grid two">
    ${journeyCard("clock", L("Full mock", "شبیه‌ساز کامل"), L("Work through four skills in order, at exam pace.", "چهار مهارت را به‌ترتیب و در زمان آزمون انجام بده."), "mock", L("Set up a mock", "تنظیم شبیه‌ساز"))}
    ${journeyCard("route", L("Short drills", "تمرین‌های کوتاه"), L("Spend a few minutes on one skill or question type.", "چند دقیقه روی یک مهارت یا نوع سؤال کار کن."), "drills", L("Find a drill", "انتخاب تمرین کوتاه"))}</div></section>
  </div>`;
}
function drillsPage() {
  const requested = view.params.get("skill");
  const filter = SKILL_KEYS.includes(requested) ? requested : "";
  return `<div class="wrap page">${link(L("Practice catalog", "تمرین‌ها"), "practice", "crumb")}${lead(L("Short drills", "تمرین‌های کوتاه"), L("Choose one thing to improve in your next few minutes.", "برای چند دقیقهٔ بعد تنها یک چیز را برای بهبود انتخاب کن."))}
    <div class="chips">${link(L("All drills", "همهٔ تمرین‌ها"), "drills", `chip ${!filter ? "selected" : ""}`)}${SKILL_KEYS.map(skill => link(skillName(skill), "drills", `chip ${filter === skill ? "selected" : ""}`, { skill })).join("")}</div>
    <div class="stack">${CONTENT.drills.filter(drill => !filter || filter === drill.skill).map(drill => `<a class="line-card" href="${href(`drill/${drill.id}`)}"><span class="icon-tile">${icon(CONTENT.skills[drill.skill].icon)}</span><div><b>${bi(drill.title)}</b><small>${bi(drill.detail)}</small></div><span class="line-meta">${num(drill.minutes)} ${L("min", "دقیقه")}</span>${arrow()}</a>`).join("")}</div>
  </div>`;
}

function vocabularyPage(params, publicView = false) {
  const base = publicView ? "words" : "vocabulary";
  const category = params.get("category") ?? "";
  const words = CONTENT.vocab.filter(word => !category || (category === "saved" ? state.words[word.id]?.saved : word.tag === category));
  const due = dueWords().length;
  const tags = [[L("All words", "همهٔ واژه‌ها"), ""], [L("Arguments", "استدلال"), "argument"], [L("Places", "مکان‌ها"), "spaces"], [L("Research", "پژوهش"), "research"]];
  if (!publicView) tags.push([L("Saved", "ذخیره‌شده"), "saved"]);
  return `<div class="wrap page">${publicView ? link(L("Study library", "کتابخانهٔ مطالعه"), "library", "crumb") : ""}${lead(publicView ? L("Vocabulary reference", "مرجع واژگان") : L("Words worth keeping", "واژه‌هایی که می‌ارزد به خاطر بسپاری"), L("Learn each word in a sentence and come back to it when it’s due.", "هر واژه را در جمله یاد بگیر و در زمان مرور به آن برگرد."), publicView ? "" : link(L(`Review ${num(due)} due`, `مرور ${num(due)} واژهٔ موعددار`), "flashcards", "btn primary with-arrow"))}
    <div class="chips">${tags.map(([label, key]) => link(label, base, `chip ${key === category ? "selected" : ""}`, { category: key })).join("")}</div>
    <label class="search-label standalone-search">${L("Find a word", "جستجوی واژه")}<input type="search" data-filter-list placeholder="${L("Search vocabulary…", "جستجوی واژگان…")}"></label>
    <div class="stack">${words.map(word => `<a class="line-card" href="${href(`${publicView ? "reference" : "word"}/${word.id}`)}" data-searchable="${esc(`${word.word} ${word.definition} ${word.fa}`)}"><span class="icon-tile">${icon("bookmark")}</span><div><b lang="en" dir="ltr">${esc(word.word)}</b><small>${esc(IRN ? word.fa : word.definition)}</small></div>${arrow()}</a>`).join("") || `<p>${L("No saved words yet. Open a word to save it.", "هنوز واژه‌ای ذخیره نشده. یکی را باز کن تا ذخیره‌اش کنی.")}</p>`}<p data-empty-search class="muted" hidden>${L("No words match.", "واژه‌ای پیدا نشد.")}</p></div>
  </div>`;
}
function wordPage(id, publicView = false) {
  const word = CONTENT.vocab.find(word => word.id === id);
  if (!word) return notFound();
  const saved = Boolean(state.words[word.id]?.saved);
  return `<div class="wrap page narrow">${link(L("Vocabulary", "واژگان"), publicView ? "words" : "vocabulary", "crumb")}${lead(esc(word.word), esc(word.ipa), "", true)}
    <section class="surface"><div class="english" dir="ltr" lang="en"><span class="section-label">Definition</span><p>${esc(word.definition)}</p><span class="section-label">In context</span><blockquote>${esc(word.example)}</blockquote></div>${IRN ? `<p>${esc(word.fa)}</p>` : ""}<div class="actions">${actionButton(saved ? L("Remove bookmark", "برداشتن نشان") : L("Save to my words", "ذخیره در واژه‌های من"), "save-word", saved ? "btn outline" : "btn primary", `data-id="${word.id}"`)}${link(L("Review words", "مرور واژه‌ها"), "flashcards", "btn quiet with-arrow")}</div></section></div>`;
}
function dueWords() {
  return CONTENT.vocab.filter(word => (state.words[word.id]?.due ?? 0) <= Date.now()).sort((a, b) => (state.words[a.id]?.due ?? 0) - (state.words[b.id]?.due ?? 0));
}
function flashcardPage() {
  const next = dueWords();
  const word = next[0];
  if (!word) return `<div class="wrap page narrow">${link(L("Vocabulary", "واژگان"), "vocabulary", "crumb")}${lead(L("You're caught up.", "مرور امروز تمام شد."), L("Come back when a word is due, or browse the full list.", "در زمان مرور بعدی برگرد یا فهرست کامل را ببین."))}${link(L("Browse all words", "دیدن همهٔ واژه‌ها"), "vocabulary", "btn primary")}</div>`;
  return `<div class="wrap page narrow">${link(L("Vocabulary", "واژگان"), "vocabulary", "crumb")}${lead(L("Review words", "مرور واژه‌ها"), L(`${num(next.length)} due`, `${num(next.length)} واژهٔ موعددار`))}
    <article class="surface flashcard"><span class="section-label">${wordFlipped ? L("MEANING", "معنا") : L("RECALL THE MEANING", "معنا را به یاد بیاور")}</span><h2 lang="en" dir="ltr">${esc(word.word)}</h2><p dir="ltr" lang="en">${wordFlipped ? esc(word.definition) : esc(word.ipa)}</p>
    ${wordFlipped ? `<blockquote dir="ltr" lang="en">${esc(word.example)}</blockquote>${IRN ? `<p>${esc(word.fa)}</p>` : ""}<div class="actions centered">${[[L("Again", "دوباره"), "again"], [L("Hard", "سخت"), "hard"], [L("Good", "خوب"), "good"], [L("Easy", "آسان"), "easy"]].map(([label, rating]) => actionButton(label, "rate-word", rating === "good" ? "btn primary" : "btn outline", `data-id="${word.id}" data-rating="${rating}"`)).join("")}</div>` : actionButton(L("Reveal answer", "دیدن پاسخ"), "flip-word", "btn primary")}</article></div>`;
}

function attemptLabel(attempt) {
  return attempt.kind === "diagnostic" ? L("Level check", "تعیین سطح") : attempt.kind === "mock" ? L("Full mock", "شبیه‌ساز کامل") : skillName(attempt.results[0].skill);
}
function resultSummary(result) {
  return result.total ? `${num(result.correct)} / ${num(result.total)}` : L("Response saved", "پاسخ ذخیره شد");
}
function progressPage() {
  const attempts = state.attempts;
  const scores = attempts.flatMap(attempt => attempt.results).filter(result => result.total).slice(0, 12).reverse().map(result => ({
    label: `${skillName(result.skill)} · ${resultSummary(result)}`,
    percent: Math.round(result.correct / result.total * 100)
  }));
  return `<div class="wrap page">${lead(L("Your practice history", "تاریخچهٔ تمرین تو"), L("See what you have worked on and reopen a review when you need it.", "تمرین‌های انجام‌شده را ببین و گزارش دلخواهت را دوباره باز کن."), attempts.length > 1 ? link(L("Compare attempts", "مقایسهٔ تلاش‌ها"), "compare", "btn outline with-arrow") : "")}
    ${attempts.length ? `<div class="progress-summary"><article class="surface"><span class="section-label">${L("ATTEMPTS", "تلاش‌ها")}</span><strong class="display-value">${num(attempts.length)}</strong><p>${L("Completed in this browser", "انجام‌شده در این مرورگر")}</p></article><article class="surface tint"><h2>${L("Recent answer accuracy", "دقت پاسخ‌های اخیر")}</h2>${scores.length ? `<div class="history-chart" aria-label="${L("Recent objective accuracy", "دقت اخیر پاسخ‌های عینی")}">${scores.map(result => `<div title="${esc(result.label)}"><i style="--height:${Math.max(3, Math.round(result.percent * .75))}px"></i><span>${num(result.percent)}%</span></div>`).join("")}</div>` : `<p>${L("Answer Reading or Listening questions to see an accuracy trend.", "برای دیدن روند دقت، به سؤال‌های خواندن یا شنیدن پاسخ بده.")}</p>`}</article></div>
    <section class="subsection"><h2>${L("Recent attempts", "تلاش‌های اخیر")}</h2><div class="stack">${attempts.map(attempt => `<a class="line-card" href="${href(`review/${attempt.id}`)}"><span class="icon-tile">${icon(CONTENT.skills[attempt.results[0].skill].icon)}</span><div><b>${attemptLabel(attempt)}</b><small>${trackName(findTrack(attempt.track))} · ${formatDate(attempt.date)}</small></div><span class="line-meta">${attempt.results.length > 1 ? `${num(attempt.results.length)} ${L("skills", "مهارت")}` : resultSummary(attempt.results[0])}</span>${arrow()}</a>`).join("")}</div></section>` : `<section class="surface empty-state"><span class="icon-tile">${icon("chart")}</span><h2>${L("Your first attempt starts here.", "اولین تلاش تو از اینجا شروع می‌شود.")}</h2><p>${L("Complete a practice task to start a history.", "برای ساخت تاریخچه یک تمرین را کامل کن.")}</p>${link(L("Find a practice task", "پیدا کردن تمرین"), "practice", "btn primary with-arrow")}</section>`}</div>`;
}
function comparePage() {
  const attempts = state.attempts;
  if (attempts.length < 2) return `<div class="wrap page narrow">${lead(L("Compare attempts", "مقایسهٔ تلاش‌ها"), L("Complete two attempts to compare them here.", "برای مقایسه، دو تمرین را کامل کن."))}${link(L("Practice catalog", "تمرین‌ها"), "practice", "btn primary")}</div>`;
  const first = attempts.find(value => value.id === view.params.get("a")) ?? attempts[0];
  const second = attempts.find(value => value.id === view.params.get("b")) ?? attempts[1];
  return `<div class="wrap page">${link(L("Practice history", "تاریخچهٔ تمرین"), "progress", "crumb")}${lead(L("Compare attempts", "مقایسهٔ تلاش‌ها"), L("Choose two attempts on the same task for a meaningful comparison.", "برای مقایسهٔ معنادار دو تلاش از یک تسک را انتخاب کن."))}
    <form class="tile-grid two" data-compare>${[first, second].map((attempt, i) => `<article class="surface"><label>${i ? L("Attempt B", "تلاش دوم") : L("Attempt A", "تلاش اول")}<select name="${i ? "b" : "a"}">${attempts.map(option => `<option value="${esc(option.id)}" ${option.id === attempt.id ? "selected" : ""}>${attemptLabel(option)} · ${esc(formatDate(option.date))}</option>`).join("")}</select></label><p>${trackName(findTrack(attempt.track))}</p><dl class="result-list">${attempt.results.map(result => `<div><dt>${skillName(result.skill)}</dt><dd>${resultSummary(result)}</dd></div>`).join("")}</dl>${link(L("Open review", "باز کردن مرور"), `review/${attempt.id}`, "text-link with-arrow")}</article>`).join("")}</form></div>`;
}
function settingsPage() {
  return `<div class="wrap page narrow">${lead(L("Settings", "تنظیمات"), L("Manage this browser’s profile and study preferences.", "پروفایل و ترجیحات مطالعهٔ همین مرورگر را مدیریت کن."))}
    <div class="settings-stack">
      <section class="surface"><h2>${L("Study profile", "پروفایل مطالعه")}</h2><p>${state.profile ? esc(state.profile.name) : L("Guest profile", "پروفایل مهمان")} · ${trackName(activeTrack())}</p><div class="actions">${link(L("Edit exam goal", "ویرایش هدف آزمون"), "goal", "btn outline")}${state.profile ? actionButton(L("Sign out", "خروج"), "sign-out") : link(L("Create demo profile", "ساخت پروفایل آزمایشی"), "auth", "btn outline", { mode: "create", next: href("settings") })}</div></section>
      <section class="surface"><h2>${L("Appearance", "ظاهر")}</h2><div class="actions">${actionButton(L("Light", "روشن"), "theme", state.theme === "light" ? "btn primary" : "btn outline", 'data-theme-value="light"')}${actionButton(L("Dark", "تیره"), "theme", state.theme === "dark" ? "btn primary" : "btn outline", 'data-theme-value="dark"')}${editionLink()}</div></section>
      <section class="surface"><h2>${L("Plan and devices", "اشتراک و دستگاه‌ها")}</h2><p>${state.pro ? L("Demo Pro active", "اشتراک آزمایشی فعال") : L("Free preview", "پیش‌نمایش رایگان")}</p><dl class="result-list"><div><dt>${L("Desktop browser", "مرورگر دسکتاپ")}</dt><dd>${L("This device", "این دستگاه")}</dd></div><div><dt>${L("Phone", "موبایل")}</dt><dd>${L("Available", "خالی")}</dd></div></dl>${link(L("Explore plans", "دیدن اشتراک‌ها"), "paywall", "btn outline")}</section>
      <section class="surface"><h2>${L("Study data", "داده‌های مطالعه")}</h2><p>${L("Download your settings, attempts, and review progress as JSON.", "تنظیمات، تلاش‌ها و پیشرفت مرور را در قالب JSON دانلود کن.")}</p><div class="actions">${actionButton(L("Export study data", "خروجی داده‌ها"), "export")}${actionButton(L("Clear local data", "پاک کردن داده‌های محلی"), "clear-data", "btn danger")}</div></section>
    </div></div>`;
}
function checkoutPage() {
  return `<div class="wrap page narrow">${link(L("Plans", "اشتراک‌ها"), "paywall", "crumb")}${lead(L("Checkout preview", "پیش‌نمایش پرداخت"), L("Review the plan and payment method. No payment is collected in this prototype.", "اشتراک و روش پرداخت را مرور کن. در این نمونه پرداخت واقعی انجام نمی‌شود."))}
    <section class="surface"><dl class="result-list"><div><dt>${L("Monthly Pro", "اشتراک ماهانهٔ حرفه‌ای")}</dt><dd>${IRN ? "۲۹۹٬۰۰۰ تومان" : "$12"}</dd></div><div><dt>${L("Payment provider", "درگاه پرداخت")}</dt><dd>${IRN ? "زرین‌پال" : "Stripe"}</dd></div></dl>${actionButton(L("Activate demo plan", "فعال‌سازی اشتراک آزمایشی"), "activate-plan", "btn primary")}</section></div>`;
}
function notFound() {
  return `<div class="wrap page narrow">${lead(L("Page not found", "صفحه پیدا نشد"))}${link(L("Go to study room", "رفتن به اتاق مطالعه"), "app", "btn primary with-arrow")}</div>`;
}
function appPage() {
  const id = view.segments[0];
  const pages = {
    app: welcomePage, welcome: welcomePage, goal: goalPage, auth: authPage,
    practice: practicePage, drills: drillsPage, diagnostic: () => setupPage("diagnostic"), mock: () => setupPage("mock"),
    setup: () => setupPage("practice"), drill: () => setupPage("drill", id), session: sessionPage, break: breakPage,
    pending: () => pendingPage(id), review: () => reviewPage(id), vocabulary: () => vocabularyPage(view.params),
    word: () => wordPage(id), flashcards: flashcardPage, progress: progressPage, compare: comparePage,
    settings: settingsPage, paywall: () => planPage(false), checkout: checkoutPage
  };
  return Object.hasOwn(pages, view.page) ? pages[view.page]() : notFound();
}
function focusRoute(smooth = false) {
  const behavior = smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "auto";
  const section = Object.hasOwn(LANDING_SECTIONS, view.page) ? document.getElementById(LANDING_SECTIONS[view.page]) : null;
  if (isLandingRoute(view.page)) {
    for (const item of app.querySelectorAll(".site-header nav a")) {
      if (item.hash === href(view.page)) item.setAttribute("aria-current", "location");
      else item.removeAttribute("aria-current");
    }
  }
  if (section) {
    section.scrollIntoView({ behavior });
    section.querySelector("h2").focus({ preventScroll: true });
  } else {
    window.scrollTo({ top: 0, left: 0, behavior });
    app.querySelector("main")?.focus({ preventScroll: true });
  }
}
function render(navigation = false) {
  const lastPage = view?.page;
  view = getRoute();
  if (navigation && isLandingRoute(lastPage) && isLandingRoute(view.page)) {
    selectLandingRouteTab(view.page, view.params);
    const section = document.getElementById(LANDING_SECTIONS[view.page]);
    for (const audio of app.querySelectorAll(".product-landing audio")) {
      if (!section?.contains(audio)) audio.pause();
    }
    for (const edition of app.querySelectorAll(".edition-link")) edition.href = editionHref();
    focusRoute(true);
    return;
  }
  disposeLanding?.();
  if (lastPage !== view.page) wordFlipped = false;
  if (lastPage && lastPage !== view.page) stopActiveMedia();
  app.querySelectorAll("audio").forEach(audio => audio.pause());
  const requestedTrack = findTrack(view.params.get("track"));
  if (requestedTrack && ["practice", "setup", "diagnostic", "mock", "goal"].includes(view.page) && requestedTrack.id !== state.track) {
    state.track = requestedTrack.id;
    persist();
  }
  document.documentElement.dataset.theme = state.theme;
  const publicView = PUBLIC_PATHS.has(view.page);
  const immersive = view.page === "session" && state.draft && !state.draft.break;
  const content = publicView ? publicPage(view.page, view.segments, view.params) : `<main id="content" tabindex="-1" class="${immersive ? "immersive" : "app-content"}">${appPage()}</main>`;
  app.innerHTML = `<a class="skip-link" href="#content">${L("Skip to content", "پرش به محتوا")}</a>${immersive ? "" : publicView ? publicHeader() : appHeader()}${content}${immersive ? "" : publicView ? publicFooter() : appFooter()}<div id="notice" role="status" aria-live="polite">${esc(notice)}</div><dialog id="dialog" aria-labelledby="dialog-title"></dialog>`;
  setupRenderedMedia();
  const calculator = app.querySelector("[data-calculator]");
  if (calculator) updateCalculator(calculator);
  disposeLanding = setupLanding();
  const heading = app.querySelector("h1")?.innerText?.trim().replace(/\s+/g, " ");
  document.title = heading ? `${heading} · ${BRAND}` : BRAND;
  if (navigation) focusRoute();
  notice = "";
}
function announce(message) {
  clearTimeout(noticeTimer);
  const element = document.getElementById("notice");
  if (element) element.textContent = message;
  notice = message;
  noticeTimer = setTimeout(() => {
    notice = "";
    const current = document.getElementById("notice");
    if (current) current.textContent = "";
  }, 4000);
}
function asciiDigits(value) {
  return String(value ?? "").replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) % 16));
}
function openDialog(title, body, label, callback, danger = false) {
  const dialog = document.getElementById("dialog");
  dialogAction = callback;
  dialog.innerHTML = `<h2 id="dialog-title">${esc(title)}</h2><p>${esc(body)}</p><div class="actions">${actionButton(L("Cancel", "لغو"), "cancel-dialog")}${actionButton(label, "confirm-dialog", `btn ${danger ? "danger" : "primary"}`)}</div>`;
  dialog.showModal();
}

app.addEventListener("click", event => {
  const skip = event.target.closest(".skip-link");
  if (skip) {
    event.preventDefault();
    document.getElementById("content").focus();
    return;
  }
  const anchor = event.target.closest('a[href^="#/"]');
  if (anchor?.hash === location.hash && isLandingRoute(view.page) && event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    event.preventDefault();
    render(true);
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (studyAction(action, target)) return;
  switch (action) {
    case "cancel-dialog":
      document.getElementById("dialog").close();
      dialogAction = null;
      break;
    case "confirm-dialog": {
      document.getElementById("dialog").close();
      const callback = dialogAction;
      dialogAction = null;
      callback?.();
      break;
    }
    case "theme":
      state.theme = target.dataset.themeValue === "dark" ? "dark" : "light";
      persist();
      render();
      break;
    case "sign-out":
      state.profile = null;
      persist();
      announce(L("Signed out of the demo profile.", "از پروفایل آزمایشی خارج شدی."));
      render();
      break;
    case "save-word": {
      const word = CONTENT.vocab.find(item => item.id === target.dataset.id);
      if (!word) break;
      const old = state.words[word.id] ?? {};
      state.words[word.id] = { ...old, saved: !old.saved };
      persist();
      announce(state.words[word.id].saved ? L("Word saved.", "واژه ذخیره شد.") : L("Bookmark removed.", "نشان برداشته شد."));
      if (["word", "reference"].includes(view.page)) render();
      break;
    }
    case "flip-word":
      wordFlipped = true;
      render();
      break;
    case "rate-word": {
      const { id, rating } = target.dataset;
      const record = state.words[id] ?? {};
      const interval = { again: 0, hard: Math.max(1, record.interval ?? 1), good: Math.max(3, (record.interval ?? 1) * 2), easy: Math.max(6, (record.interval ?? 1) * 3) }[rating];
      state.words[id] = { ...record, interval, due: Date.now() + (interval * 86400000 || 600000), reviewed: (record.reviewed ?? 0) + 1 };
      persist();
      wordFlipped = false;
      render();
      break;
    }
    case "activate-plan":
      state.pro = true;
      persist();
      announce(L("Demo Pro is active.", "اشتراک آزمایشی فعال شد."));
      go("settings");
      break;
    case "export": {
      const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `${IRN ? "sanjia" : "mockza"}-prototype-study.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      break;
    }
    case "clear-data":
      openDialog(L("Clear study data?", "داده‌های مطالعه پاک شود؟"), L("This removes the profile, attempts, and saved words for this edition in this browser.", "پروفایل، تلاش‌ها و واژه‌های ذخیره‌شدهٔ این نسخه در همین مرورگر پاک می‌شوند."), L("Clear data", "پاک کردن داده‌ها"), () => {
        stopActiveMedia(true);
        state = defaultState();
        persist();
        go("app");
      }, true);
      break;
  }
});
app.addEventListener("submit", event => {
  const form = event.target;
  event.preventDefault();
  const data = new FormData(form);
  switch (form.dataset.form) {
    case "goal": {
      const track = findTrack(data.get("track"));
      if (!track) return;
      state.track = track.id;
      state.goal = { track: track.id, target: +data.get("target"), date: data.get("date") || null };
      persist();
      announce(L("Goal saved.", "هدف ذخیره شد."));
      go("app");
      break;
    }
    case "sign-in": {
      const name = String(data.get("name") ?? "").trim().slice(0, 40);
      if (!name) return;
      state.profile = { name };
      persist();
      goRaw(String(data.get("next") ?? ""));
      break;
    }
    case "demo-phone": {
      const phone = asciiDigits(data.get("phone")).replace(/[\s-]/g, "");
      if (!/^(?:0|\+98)9[0-9]{9}$/.test(phone)) {
        announce("شمارهٔ موبایل باید با ۰۹ یا ۹۸+ شروع شود.");
        return;
      }
      demoPhoneChallenge = true;
      go("auth", { mode: "verify", next: data.get("next") });
      break;
    }
    case "verify-phone":
      if (!demoPhoneChallenge || asciiDigits(data.get("code")) !== "246810") {
        announce("کد آزمایشی درست نیست.");
        return;
      }
      demoPhoneChallenge = false;
      state.profile = { name: "زبان‌آموز" };
      persist();
      goRaw(String(data.get("next") ?? ""));
      break;
    case "setup":
      startStudy(form, data);
      break;
    case "checkout":
      if (data.get("consent")) go("checkout");
      break;
  }
});
app.addEventListener("change", event => {
  const input = event.target;
  if (input.matches("[data-track-filter]")) go("practice", { track: input.value, skill: view.params.get("skill") });
  if (input.matches("[data-goal-track]")) {
    const selected = findTrack(input.value);
    const field = input.form.elements.target;
    Object.assign(field, { min: selected.min, max: selected.max, step: selected.step, value: selected.goal });
    input.form.querySelector("[data-target-scale]").textContent = numText(selected.scale);
  }
  if (input.form?.hasAttribute("data-compare")) go("compare", Object.fromEntries(new FormData(input.form)));
  if (input.form?.hasAttribute("data-calculator")) updateCalculator(input.form);
  studyChange(input);
});
app.addEventListener("input", event => {
  const input = event.target;
  if (input.form?.hasAttribute("data-calculator")) updateCalculator(input.form);
  if (input.matches("[data-filter-list]")) {
    const query = input.value.trim().toLowerCase();
    let matches = 0;
    for (const item of app.querySelectorAll("[data-searchable]")) {
      item.hidden = !item.dataset.searchable.toLowerCase().includes(query);
      if (!item.hidden) matches++;
    }
    const empty = app.querySelector("[data-empty-search]");
    if (empty) empty.hidden = matches > 0;
  }
  studyInput(input);
});
window.addEventListener("hashchange", () => render(true));
setInterval(tickStudyClock, 300);
render(true);
