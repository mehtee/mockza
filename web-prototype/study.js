"use strict";

let recording = null;
let lastClip = null;
let mediaRequest = 0;
let soundCheckClip = null;

function miniChart() {
  return `<figure class="mini-chart" aria-label="Study centre visits by weekday">
    <figcaption>Study centre visits</figcaption><div class="chart-columns">${[72, 94, 111, 142, 122].map((count, i) => `<div><span>${count}</span><i style="--level:${Math.round(count / 150 * 100)}%"></i><small>${["Mon", "Tue", "Wed", "Thu", "Fri"][i]}</small></div>`).join("")}</div></figure>`;
}
function setupChoice(name, val, title, detail, selected, detailId = "") {
  return `<label class="choice-option"><input type="radio" name="${name}" value="${val}" ${selected ? "checked" : ""}${detailId ? ` aria-controls="${detailId}"` : ""}><span><b>${title}</b><small>${detail}</small></span></label>`;
}

function setupPage(kind, drillId) {
  const drill = CONTENT.drills.find(item => item.id === drillId);
  if (kind === "drill" && !drill) return notFound();
  const track = activeTrack();
  const skill = drill?.skill ?? (SKILL_KEYS.includes(view.params.get("skill")) ? view.params.get("skill") : "reading");
  const title = {
    diagnostic: L("Find your starting point", "نقطهٔ شروع خودت را پیدا کن"),
    mock: L("Set up a full mock", "شبیه‌ساز کامل را تنظیم کن"),
    practice: L(`Set up ${skillName(skill)}`, `تنظیم تمرین ${skillName(skill)}`),
    drill: drill ? bi(drill.title) : ""
  }[kind];
  const intro = {
    diagnostic: L("Sample four skills or focus on just one. Your report will suggest a next step.", "چهار مهارت را بسنج یا روی یکی تمرکز کن. گزارش یک قدم بعدی پیشنهاد می‌دهد."),
    mock: L("Try four sample sections in exam order, with a break between sections.", "چهار بخش نمونه را به‌ترتیب آزمون و با استراحت بین بخش‌ها انجام بده."),
    practice: L("Choose how you want to work. Your progress is saved in this browser.", "حالت تمرینت را انتخاب کن. پیشرفت در همین مرورگر ذخیره می‌شود."),
    drill: drill ? bi(drill.detail) : ""
  }[kind];
  const singleSkill = ["practice", "drill"].includes(kind);
  const focusedCheck = kind === "diagnostic" && SKILL_KEYS.includes(view.params.get("skill"));
  const starter = kind === "diagnostic" ? L("Begin level check", "شروع تعیین سطح") : kind === "mock" ? L("Begin mock", "شروع شبیه‌ساز") : L("Start practice", "شروع تمرین");
  return `<div class="wrap page narrow setup-page">
    ${link(singleSkill || kind === "mock" ? L("Practice catalog", "تمرین‌ها") : L("Study room", "اتاق مطالعه"), singleSkill || kind === "mock" ? "practice" : "app", "crumb")}
    ${lead(title, intro)}
    <form class="form-stack" data-form="setup" data-kind="${kind}" data-skill="${skill}" ${drill ? `data-drill="${drill.id}"` : ""}>
      <section class="surface form-stack">
        <label>${L("Exam track", "نوع آزمون")}<select name="track">${trackOptions(track.id)}</select></label>
        ${singleSkill ? `<div class="setup-summary"><span class="icon-tile">${icon(CONTENT.skills[skill].icon)}</span><div><b>${skillName(skill)}</b><small>${bi(CONTENT.skills[skill].desc)}</small></div></div>` : ""}
        ${kind === "diagnostic" ? `<fieldset><legend>${L("How much do you want to check?", "چه مقدار را می‌خواهی بسنجی؟")}</legend><div class="choice-grid">
          ${setupChoice("scope", "all", L("All four skills", "هر چهار مهارت"), L("Reading, Listening, Writing and Speaking", "خواندن، شنیدن، نوشتن و صحبت کردن"), !focusedCheck)}
          ${setupChoice("scope", "one", L("One skill", "یک مهارت"), L("Get a focused result in a few minutes", "نتیجهٔ متمرکز در چند دقیقه"), focusedCheck, "diagnostic-skills")}
        </div><label id="diagnostic-skills" ${focusedCheck ? "" : "hidden"}>${L("Skill", "مهارت")}<select name="skill">${SKILL_KEYS.map(key => `<option value="${key}" ${key === skill ? "selected" : ""}>${skillName(key)}</option>`).join("")}</select></label></fieldset>` : ""}
        ${kind === "mock" ? `<div class="skill-sequence">${SKILL_KEYS.map(key => `<span>${icon(CONTENT.skills[key].icon)}${skillName(key)}</span>`).join("")}</div>` : ""}
        <fieldset><legend>${L("Choose a pace", "حالت تمرین را انتخاب کن")}</legend><div class="choice-grid">
          ${setupChoice("mode", "study", L("Study mode", "حالت مطالعه"), L("Work untimed, replay audio, and check evidence.", "بدون زمان‌سنج کار کن، صدا را دوباره بشنو و شاهد پاسخ را ببین."), kind !== "mock")}
          ${setupChoice("mode", "exam", L("Exam mode", "حالت آزمون"), L("Work to a timer with answers hidden until review.", "با زمان‌سنج کار کن و پاسخ‌ها را در مرور ببین."), kind === "mock")}
        </div></fieldset>
      </section>
      <section class="surface preflight">
        <div><h2>${L("Before you start", "پیش از شروع")}</h2><p>${L("This prototype uses a short set of original sample tasks.", "این نمونه مجموعه‌ای کوتاه از تسک‌های تألیفی دارد.")}</p></div>
        <div class="actions">
        ${!singleSkill || skill === "listening" ? actionButton(L("Test sound", "آزمایش صدا"), "test-sound", "btn outline small") : ""}
        ${!singleSkill || skill === "speaking" ? actionButton(L("Check microphone", "بررسی میکروفون"), "check-mic", "btn outline small") : ""}
        </div>
      </section>
      <div class="actions"><button type="submit" class="btn primary with-arrow">${starter}${arrow()}</button>${state.draft ? link(L("Resume current attempt", "ادامهٔ تلاش فعلی"), state.draft.break ? "break" : "session", "btn quiet") : ""}</div>
    </form></div>`;
}

function sectionDraft(draft) {
  const skill = draft.skills[draft.stage];
  const minutes = draft.kind === "drill" ? 3 : draft.kind === "diagnostic" ? 4 : findTrack(draft.track).time[SKILL_KEYS.indexOf(skill)];
  return { ...draft, break: false, deadline: draft.mode === "exam" ? Date.now() + minutes * 60000 : null, seconds: minutes * 60,
    focusIndex: 0, taskIndex: 0, answers: [], flags: [], essays: {}, speak: "", recorded: false, audioEnded: false, audioTime: 0 };
}
function startStudy(form, data) {
  const kind = form.dataset.kind;
  const selected = findTrack(data.get("track"));
  if (!selected) return;
  const skills = kind === "diagnostic" && data.get("scope") === "one" ? [data.get("skill")]
    : ["diagnostic", "mock"].includes(kind) ? SKILL_KEYS.slice() : [form.dataset.skill];
  if (!skills.every(skill => SKILL_KEYS.includes(skill))) return;
  const begin = () => {
    stopActiveMedia(true);
    state.track = selected.id;
    state.draft = sectionDraft({
      id: nowId(), track: selected.id, kind, skills, stage: 0, mode: data.get("mode") === "exam" ? "exam" : "study", drill: form.dataset.drill || null, results: []
    });
    persist();
    go("session");
  };
  if (state.draft) openDialog(L("Start a new attempt?", "تلاش جدید شروع شود؟"), L("Your current unfinished attempt will be replaced.", "تلاش ناتمام فعلی جایگزین می‌شود."), L("Start new attempt", "شروع تلاش جدید"), begin);
  else begin();
}

function questionSet(skill, track, drill = null) {
  const source = CONTENT[skill];
  if (!source?.questions) return [];
  if (drill) {
    const unit = CONTENT.drills.find(item => item.id === drill);
    if (unit?.question !== undefined) return [source.questions[unit.question]];
  }
  if (track === "toefl-ibt" && skill === "reading") {
    return [{ kind: "text", text: "Complete the word: The new rota avoided increas___ the total hours worked.", answer: "ing", evidence: 1, why: "The pattern is ‘avoid’ followed by the -ing form of a verb." }, ...source.questions];
  }
  if (track === "pte-academic" && skill === "listening") {
    return [...source.questions, { kind: "text", text: "Write the reminder that begins with ‘Bring’ exactly as you hear it.", answer: "Bring a water bottle, please.", evidence: 2, why: "The reminder comes just after the speaker explains where lunch is available." }];
  }
  if (track === "det" && skill === "reading") {
    return [{ text: "Is ‘partition’ an English word?", options: ["Yes", "No"], answer: 0, evidence: 2, why: "A partition is something that divides an area into parts." }, ...source.questions];
  }
  return source.questions;
}
function normalAnswer(value) { return String(value ?? "").toLowerCase().replace(/[.,!?]/g, "").trim().replace(/\s+/g, " "); }
function isCorrect(question, answer) {
  if (answer == null || answer === "") return false;
  return question.kind === "text" ? normalAnswer(answer) === normalAnswer(question.answer) : Number(answer) === question.answer;
}
function asAnswer(question, value) {
  if (value == null || value === "") return "—";
  return question.kind === "text" ? esc(value) : esc(question.options[Number(value)] ?? "—");
}

function sessionPage() {
  const draft = state.draft;
  if (!draft || draft.break) return `<div class="wrap page narrow">${lead(L("Ready to practise?", "آمادهٔ تمرینی؟"), L("Choose a task to start a new session.", "برای شروع یک تسک انتخاب کن."))}${link(L("Practice catalog", "تمرین‌ها"), "practice", "btn primary with-arrow")}</div>`;
  const skill = draft.skills[draft.stage];
  const questions = questionSet(skill, draft.track, draft.drill);
  const mode = draft.mode === "exam" ? L("Exam mode", "حالت آزمون") : L("Study mode", "حالت مطالعه");
  const label = draft.kind === "diagnostic" ? L("Level check", "تعیین سطح") : draft.kind === "mock" ? L("Full mock", "شبیه‌ساز کامل") : mode;
  return `<div class="exam">
    <header class="exam-header"><div class="exam-heading">${brandLink("app")}<div><h1>${skillName(skill)}</h1><small>${trackName(findTrack(draft.track))} · ${label}</small></div></div>
      <div class="exam-header-right">${draft.deadline ? `<span class="timer" aria-label="${L("Time remaining", "زمان باقی‌مانده")}">${icon("clock")} <b id="study-clock" dir="ltr">${clockText(draft)}</b></span>` : `<span class="tag">${mode}</span>`}${actionButton(L("Save & exit", "ذخیره و خروج"), "exit-session", "btn outline small")}</div>
    </header>
    <div class="exam-strip"><span>${draft.skills.length > 1 ? `${L("Section", "بخش")} ${num(draft.stage + 1)} / ${num(draft.skills.length)}` : L("Sample practice", "تمرین نمونه")}</span><span>${skillName(skill)} · ${mode}</span></div>
    <div class="exam-grid">
      <section class="exam-pane stimulus" aria-label="${L("Task material", "محتوای تسک")}">${stimulus(draft, skill)}</section>
      <section class="exam-pane response-pane" aria-label="${L("Answer workspace", "فضای پاسخ")}">
        ${questions.length ? `<div id="task-questions">${objectivePanel(draft, questions)}</div>` : skill === "writing" ? writingPanel(draft) : speakingPanel(draft)}</section>
    </div>
    <footer class="exam-footer"><div id="question-palette">${questions.length ? questionPalette(draft, questions) : `<span>${skillName(skill)} · ${L("Response", "پاسخ")}</span>`}</div>
    ${actionButton(draft.stage + 1 < draft.skills.length ? L("Finish section", "پایان بخش") : L("Submit attempt", "ثبت تلاش"), "submit-study", "btn primary with-arrow")}</footer>
  </div>`;
}

function stimulus(draft, skill) {
  if (skill === "reading") {
    return `<div class="english pane-copy" dir="ltr" lang="en"><span class="section-label">Reading passage</span><h2>${CONTENT.reading.title}</h2>
      ${CONTENT.reading.text.map((text, i) => `<p data-paragraph="${i}">${esc(text)}</p>`).join("")}</div>
      ${draft.mode === "study" ? `<div class="pane-tools">${actionButton(L("Save ‘account for’", "ذخیرهٔ account for"), "save-word", "btn outline small", 'data-id="account-for"')}</div>` : ""}`;
  }
  if (skill === "listening") {
    const exam = draft.mode === "exam";
    const bars = Array.from({ length: 44 }, (_, i) => `<i style="--bar:${20 + (i * 73 % 41)}%"></i>`).join("");
    return `<div class="pane-copy"><span class="section-label">${L("THE RECORDING", "فایل صوتی")}</span><h2 lang="en" dir="ltr">${CONTENT.listening.title}</h2>
      <div class="audio-card"><div class="waveform" aria-hidden="true">${bars}</div>
      <audio id="study-audio" preload="metadata" ${exam ? "" : "controls"} src="assets/observatory.mp3"></audio>
      ${exam ? `${actionButton(draft.audioEnded ? L("Audio complete", "پخش به پایان رسید") : draft.audioTime ? L("Resume audio", "ادامهٔ صدا") : L("Play recording", "پخش فایل صوتی"), "play-exam-audio", "btn primary small", draft.audioEnded ? "disabled" : "")}<p class="muted">${L("Audio plays once in exam mode.", "در حالت آزمون صدا یک بار پخش می‌شود.")}</p>` : `<p class="muted">${L("Replay the clip at your own pace.", "با سرعت خودت فایل را دوباره گوش کن.")}</p>`}
      </div>
      ${exam ? "" : `<details class="disclosure"><summary>${L("Read transcript", "خواندن متن صوت")}</summary><div class="english" dir="ltr" lang="en">${CONTENT.listening.text.map(text => `<p>${esc(text)}</p>`).join("")}</div></details>`}
    </div>`;
  }
  const task = skill === "writing" ? CONTENT.writing[draft.track][draft.taskIndex] : CONTENT.speaking[draft.track];
  return `<div class="pane-copy english" dir="ltr" lang="en"><span class="section-label">${esc(task.type)}</span><h2>${esc(task.title)}</h2><p>${esc(task.prompt)}</p>
    ${task.chart ? miniChart() : ""}${task.passage ? CONTENT.reading.text.map(text => `<p>${esc(text)}</p>`).join("") : ""}
    ${skill === "writing" ? `<div class="hint"><b>${task.max ? `${task.min}–${task.max} words` : `Aim for at least ${task.min} words`}</b>${task.single ? "<span>Use one complete sentence.</span>" : ""}</div>` : ""}</div>`;
}

function objectivePanel(draft, questions) {
  const index = draft.focusIndex;
  const question = questions[index];
  const current = draft.answers[index];
  const checked = choice => current != null && Number(current) === choice;
  return `<div class="panel-head"><span class="section-label">${L("QUESTION", "سؤال")} ${num(index + 1)} / ${num(questions.length)}</span>${actionButton(draft.flags.includes(index) ? L("Flagged", "نشان‌دار") : L("Flag for review", "نشان برای مرور"), "flag-question", "btn quiet small", `aria-pressed="${draft.flags.includes(index)}"`)}</div>
    <div class="english question-body" dir="ltr" lang="en"><h2 id="question-title" tabindex="-1">${esc(question.text)}</h2>
    ${question.kind === "text" ? `<label>Your answer<input name="answer-text" data-answer-text maxlength="180" value="${esc(current ?? "")}" placeholder="Type your answer"></label>` : `<fieldset class="answers" aria-labelledby="question-title">${question.options.map((option, i) => `<label class="answer-option"><input type="radio" name="objective" data-answer="${i}" ${checked(i) ? "checked" : ""}><span class="option-key">${String.fromCharCode(65 + i)}</span><span>${esc(option)}</span></label>`).join("")}</fieldset>`}
    </div>
    ${draft.mode === "study" ? `<div class="actions">${actionButton(L("Check the evidence", "دیدن شاهد"), "check-evidence", "btn outline small")}</div><div id="question-evidence" hidden class="hint english" dir="ltr" lang="en"><b>${asAnswer(question, question.answer)}</b><span>${esc(question.why)}</span></div>` : ""}
    <div class="actions question-actions">${index ? actionButton(L("Previous", "قبلی"), "previous-question", "btn outline small") : ""}${index + 1 < questions.length ? actionButton(L("Next question", "سؤال بعدی"), "next-question", "btn outline small with-arrow") : ""}</div>`;
}

function questionPalette(draft, questions) {
  const answered = draft.answers.filter(value => value !== null && value !== "" && value !== undefined).length;
  return `<div class="palette"><span class="muted">${num(answered)} / ${num(questions.length)} ${L("answered", "پاسخ‌داده")}</span><div class="question-numbers">${questions.map((_, index) => {
    const hasAnswer = draft.answers[index] != null && draft.answers[index] !== "";
    const flags = draft.flags.includes(index);
    return actionButton(num(index + 1), "go-question", `q-button ${index === draft.focusIndex ? "current" : ""} ${hasAnswer ? "answered" : ""} ${flags ? "flagged" : ""}`, `data-index="${index}" ${index === draft.focusIndex ? 'aria-current="step"' : ""} aria-label="${L("Question", "سؤال")} ${num(index + 1)}${flags ? L(", flagged", "، نشان‌دار") : ""}"`);
  }).join("")}</div></div>`;
}
function refreshQuestion(focus = false) {
  const draft = state.draft;
  const questions = questionSet(draft.skills[draft.stage], draft.track, draft.drill);
  const panel = document.getElementById("task-questions");
  if (!panel) return;
  panel.innerHTML = objectivePanel(draft, questions);
  document.getElementById("question-palette").innerHTML = questionPalette(draft, questions);
  if (focus) document.getElementById("question-title")?.focus({ preventScroll: true });
}
function wordCount(text) { return text.trim().split(/\s+/).filter(Boolean).length; }

function writingPanel(draft) {
  const tasks = CONTENT.writing[draft.track];
  const text = draft.essays[draft.taskIndex] ?? "";
  return `<div class="panel-head"><span class="section-label">${L("YOUR RESPONSE", "پاسخ تو")}</span><span class="muted">${L("Autosaved", "ذخیرهٔ خودکار")}</span></div>
    <div class="chips">${tasks.map((task, i) => actionButton(L(`Task ${i + 1}`, `تسک ${num(i + 1)}`), "writing-task", `chip ${i === draft.taskIndex ? "selected" : ""}`, `data-index="${i}" aria-pressed="${i === draft.taskIndex}"`)).join("")}</div>
    <label class="essay-label">${L("Write your answer", "پاسخت را بنویس")}<textarea id="essay" data-essay lang="en" dir="ltr" rows="13" maxlength="10000" spellcheck="${draft.mode === "study"}" placeholder="Start your response here…">${esc(text)}</textarea></label>
    <div class="editor-foot"><span>${L("Words", "واژه‌ها")} <b id="words-count">${num(wordCount(text))}</b></span><span class="muted" id="writing-hint">${draftWritingHint(text, tasks[draft.taskIndex])}</span></div>`;
}
function draftWritingHint(text, task) {
  if (!text.trim()) return "";
  const count = wordCount(text);
  if (task.single && text.trim().split(/[.!?]+\s+/).length > 1) return L("Aim for one sentence.", "تلاش کن یک جمله بنویسی.");
  if (task.max && count > task.max) return L("Over the suggested limit.", "بیشتر از حد پیشنهادی است.");
  return "";
}

function clipFor(draftId) { return lastClip?.id === draftId ? lastClip.url : null; }
function speakingPanel(draft) {
  const clip = clipFor(draft.id);
  const active = Boolean(recording);
  return `<div class="panel-head"><span class="section-label">${L("YOUR RESPONSE", "پاسخ تو")}</span></div>
    <div class="record-box"><span class="record-icon ${active ? "recording" : ""}">${icon("mic")}</span><h2>${active ? L("Recording…", "در حال ضبط…") : clip ? L("Recording ready", "صدا آماده است") : L("Record your answer", "پاسخت را ضبط کن")}</h2>
    <p>${active ? L("Stop when your answer is complete.", "بعد از کامل شدن پاسخ ضبط را متوقف کن.") : L("Say your answer aloud. You can listen to it before you submit.", "پاسخت را بلند بگو. پیش از ثبت می‌توانی صدایت را بشنوی.")}</p>
    ${active ? actionButton(L("Stop recording", "توقف ضبط"), "stop-recording", "btn primary") : actionButton(clip ? L("Record again", "ضبط دوباره") : L("Start recording", "شروع ضبط"), "record", "btn primary")}
    ${clip ? `<audio controls src="${esc(clip)}"></audio>` : ""}</div>
    <div class="speech-fallback"><p>${draft.speak ? L("Sample response selected.", "پاسخ نمونه انتخاب شد.") : L("You can use a sample response if you don’t have a microphone.", "اگر میکروفون نداری می‌توانی از پاسخ نمونه استفاده کنی.")}</p>${actionButton(L("Use a sample response", "استفاده از پاسخ نمونه"), "sample-speaking", "btn outline small")}${draft.speak ? `<blockquote class="english" lang="en" dir="ltr">${esc(draft.speak)}</blockquote>` : ""}</div>`;
}

function remainingSeconds(draft) { return Math.max(0, Math.ceil((draft.deadline - Date.now()) / 1000)); }
function clockText(draft) {
  const remaining = remainingSeconds(draft);
  return numText(`${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`);
}
function tickStudyClock() {
  if (view?.page === "session" && state.draft?.deadline && !state.draft.break) {
    const clock = document.getElementById("study-clock");
    if (clock) clock.textContent = clockText(state.draft);
    if (remainingSeconds(state.draft) <= 0) finishSection(true);
  }
  if (view?.page === "pending") {
    const id = view.segments[0];
    const attempt = state.attempts.find(item => item.id === id);
    if (attempt && Date.now() >= attempt.readyAt) go(`review/${attempt.id}`);
  }
}
function finishSection(expired = false) {
  const draft = state.draft;
  if (!draft || draft.break) return;
  if (recording) {
    recording.keep = true;
    recording.finishAfterStop = expired;
    if (recording.recorder.state !== "inactive") recording.recorder.stop();
    return;
  }
  stopActiveMedia();
  const skill = draft.skills[draft.stage];
  const questions = questionSet(skill, draft.track, draft.drill);
  const result = {
    skill, answers: draft.answers, flags: draft.flags, total: questions.length, expired,
    correct: questions.filter((question, index) => isCorrect(question, draft.answers[index])).length,
    essays: draft.essays, speech: draft.speak, recorded: draft.recorded
  };
  draft.results.push(result);
  if (draft.stage + 1 < draft.skills.length) {
    draft.break = true;
    persist();
    go("break");
    return;
  }
  const productive = draft.results.some(item => ["writing", "speaking"].includes(item.skill));
  const date = Date.now();
  const attempt = { id: draft.id, kind: draft.kind, track: draft.track, drill: draft.drill, mode: draft.mode, date, readyAt: productive ? date + 2100 : date, results: draft.results };
  state.attempts.unshift(attempt);
  state.draft = null;
  persist();
  go(`${productive ? "pending" : "review"}/${attempt.id}`);
}
function breakPage() {
  const draft = state.draft;
  if (!draft?.break) return notFound();
  const next = draft.skills[draft.stage + 1];
  return `<div class="wrap room narrow"><div class="room-heading"><div class="room-emblem">${icon("clock")}</div><span class="section-label">${L("SECTION COMPLETE", "بخش کامل شد")}</span>
    <h1>${L("Take a breath.", "نفسی تازه کن.")}</h1><p>${skillName(draft.skills[draft.stage])} · ${L("Saved", "ذخیره شد")}</p></div>
    <div class="surface tint break-next"><b>${L("Up next", "قدم بعدی")}</b><h2>${skillName(next)}</h2><p>${bi(CONTENT.skills[next].desc)}</p>${actionButton(L("Continue to next section", "ادامه به بخش بعد"), "next-section", "btn primary with-arrow")}</div>
    <div class="room-links">${link(L("Finish later", "ادامه در فرصتی دیگر"), "app", "text-link")}</div></div>`;
}
function pendingPage(id) {
  const attempt = state.attempts.find(item => item.id === id);
  if (!attempt) return notFound();
  return `<div class="wrap room narrow"><div class="room-heading"><div class="room-emblem pending-emblem">${icon("route")}</div><span class="section-label">${L("RESPONSE SAVED", "پاسخ ذخیره شد")}</span>
    <h1>${L("Putting your review together.", "در حال آماده‌سازی مرور.")}</h1><p>${L("Your responses are stored in this browser. A practice review will open shortly.", "پاسخ‌ها در همین مرورگر ذخیره شده‌اند. به‌زودی مرور تمرین باز می‌شود.")}</p></div>
    <div class="room-links">${link(L("Back to practice", "بازگشت به تمرین‌ها"), "practice", "text-link")}${link(L("Open review", "باز کردن مرور"), `review/${id}`, "text-link with-arrow")}</div></div>`;
}

function sampleAttempt() {
  const track = "ielts-academic";
  const scored = [
    { skill: "reading", answers: [1, 1, 2, 1], flags: [1] },
    { skill: "listening", answers: [0, 2, 0], flags: [0] }
  ].map(result => {
    const questions = questionSet(result.skill, track);
    return { ...result, total: questions.length, correct: questions.filter((item, i) => isCorrect(item, result.answers[i])).length };
  });
  return { id: "sample", kind: "diagnostic", track, date: 0, mode: "study", results: [
    ...scored,
    { skill: "writing", total: 0, correct: 0, essays: { 0: "The numbers rose between Monday and Thursday, then there was a small decrease on Friday. The highest number was 142 on Thursday." } },
    { skill: "speaking", total: 0, correct: 0, speech: "I study in our small community library because it is quiet. Last Saturday I went there to revise for a test, and I could work for two hours without being interrupted." }
  ] };
}
function reviewPage(id) {
  const sample = id === "sample";
  const attempt = sample ? sampleAttempt() : state.attempts.find(item => item.id === id);
  if (!attempt) return notFound();
  const result = attempt.results.find(item => item.skill === view.params.get("skill")) ?? attempt.results[0];
  const objective = result.total > 0;
  const taskList = questionSet(result.skill, attempt.track, attempt.drill);
  const requested = Number(view.params.get("q"));
  const index = Number.isInteger(requested) && requested >= 0 && requested < taskList.length ? requested : 0;
  const incorrect = taskList.findIndex((question, i) => !isCorrect(question, result.answers[i]));
  const drill = CONTENT.drills.find(item => item.skill === result.skill && item.question === incorrect) ?? CONTENT.drills.find(item => item.skill === result.skill);
  const recommended = sample && !objective ? CONTENT.drills.find(item => item.id === "overview") : drill;
  const title = attempt.kind === "diagnostic" ? L("Your starting point", "نقطهٔ شروع تو") : attempt.kind === "mock" ? L("Your full mock review", "مرور شبیه‌ساز کامل") : L("Your practice review", "مرور تمرین تو");
  return `<div class="wrap page review-page">
    ${link(sample ? L("Website", "وب‌سایت") : L("Practice history", "تاریخچهٔ تمرین"), sample ? "" : "progress", "crumb")}
    ${lead(title, `${trackName(findTrack(attempt.track))} · ${sample ? L("Illustrative sample", "گزارش نمونه") : formatDate(attempt.date)}`, recommended ? link(L("Practise the next step", "تمرین قدم بعدی"), `drill/${recommended.id}`, "btn primary with-arrow") : "")}
    ${sample ? `<p class="banner">${L("This is a sample of what a review looks like. It does not use your study history.", "این پیش‌نمایش یک گزارش است و بر اساس تاریخچهٔ مطالعهٔ تو نیست.")}</p>` : ""}
    <div class="review-summary">${attempt.results.map(item => `<a href="${href(`review/${id}`, { skill: item.skill })}" class="review-stat ${item === result ? "selected" : ""}" ${item === result ? 'aria-current="true"' : ""}><span>${icon(CONTENT.skills[item.skill].icon)} ${skillName(item.skill)}</span><b>${item.total ? `${num(item.correct)} / ${num(item.total)}` : sample ? L("Example", "نمونه") : L("Response", "پاسخ")}</b></a>`).join("")}</div>
    ${objective ? objectiveReview(attempt, result, taskList, index) : productiveReview(attempt, result)}
    ${recommended ? `<article class="next-step surface tint"><span class="icon-tile">${icon("route")}</span><div><span class="section-label">${L("NEXT STEP", "قدم بعدی")}</span><h2>${bi(recommended.title)}</h2><p>${bi(recommended.detail)}</p></div>${link(L("Open drill", "باز کردن تمرین"), `drill/${recommended.id}`, "btn primary with-arrow")}</article>` : ""}
    ${attempt.kind === "diagnostic" && !sample ? `<div class="room-links">${link(L("Retake this skill", "سنجش دوبارهٔ این مهارت"), "diagnostic", "text-link with-arrow", { track: attempt.track, skill: result.skill })}</div>` : ""}
  </div>`;
}
function objectiveReview(attempt, result, questions, index) {
  const question = questions[index];
  const answer = result.answers[index];
  const paragraph = CONTENT[result.skill].text[question.evidence];
  const word = result.skill === "reading" ? "account-for" : "uneven";
  return `<div class="detail-layout review-detail">
    <section class="surface"><h2>${L("Questions", "سؤال‌ها")}</h2><div class="answer-list">${questions.map((item, i) => `<a class="answer-line ${i === index ? "selected" : ""}" href="${href(`review/${attempt.id}`, { skill: result.skill, q: i })}"><span class="q-status ${isCorrect(item, result.answers[i]) ? "right" : "miss"}">${isCorrect(item, result.answers[i]) ? "✓" : result.answers[i] != null && result.answers[i] !== "" ? "×" : "–"}</span><div><b>${L("Question", "سؤال")} ${num(i + 1)}</b><small class="english" dir="ltr" lang="en">${esc(item.text)}</small></div>${arrow()}</a>`).join("")}</div></section>
    <section class="surface"><span class="section-label">${L("ANSWER EVIDENCE", "شاهد پاسخ")}</span><h2 class="english" dir="ltr" lang="en">${esc(question.text)}</h2>
    <dl class="result-list"><div><dt>${L("Your answer", "پاسخ تو")}</dt><dd class="english" dir="ltr" lang="en">${asAnswer(question, answer)}</dd></div><div><dt>${L("Correct answer", "پاسخ درست")}</dt><dd class="english" dir="ltr" lang="en">${asAnswer(question, question.answer)}</dd></div></dl>
    <blockquote class="english evidence-quote" dir="ltr" lang="en">${esc(paragraph)}</blockquote><p class="english" dir="ltr" lang="en">${esc(question.why)}</p>
    ${result.skill === "listening" ? `<audio controls preload="metadata" src="assets/observatory.mp3"></audio>` : ""}
    ${link(L("Explore a word from the task", "دیدن واژه‌ای از تسک"), `word/${word}`, "text-link with-arrow")}
    </section></div>`;
}
function productiveReview(attempt, result) {
  const isWriting = result.skill === "writing";
  const essays = Object.entries(result.essays ?? {}).filter(([, text]) => text.trim());
  const clip = clipFor(attempt.id);
  return `<div class="detail-layout review-detail">
    <section class="surface"><h2>${L("Your response", "پاسخ تو")}</h2>
    ${isWriting && essays.length ? essays.map(([i, text]) => `<article class="english submitted-response" dir="ltr" lang="en"><span class="section-label">${esc(CONTENT.writing[attempt.track][Number(i)].type)}</span><p>${esc(text)}</p><small>${wordCount(text)} words</small></article>`).join("") : result.speech ? `<blockquote class="english" lang="en" dir="ltr">${esc(result.speech)}</blockquote>` : result.recorded ? `<p>${L("A microphone response was recorded.", "پاسخ صوتی ضبط شد.")}</p>${clip ? `<audio src="${esc(clip)}" controls></audio>` : `<p>${L("Recording playback is available during the recording session.", "پخش صدا در نشست ضبط در دسترس است.")}</p>`}` : `<p>${L("No response was submitted for this section.", "برای این بخش پاسخی ثبت نشد.")}</p>`}
    </section><aside class="surface tint"><span class="section-label">${L("SELF-REVIEW", "خودارزیابی")}</span><h2>${L("What to look for", "به چه چیزی توجه کنم؟")}</h2>
    <ul><li>${L("Answer the specific task before adding detail.", "پیش از افزودن جزئیات، به خودِ تسک پاسخ بده.")}</li><li>${isWriting ? L("Make the main idea easy to find.", "ایدهٔ اصلی را به‌سادگی قابل تشخیص بنویس.") : L("Use a specific example and a natural pace.", "از مثال مشخص و سرعت طبیعی استفاده کن.")}</li><li>${L("Review the example to see a possible structure.", "نمونه را ببین تا با یک ساختار ممکن آشنا شوی.")}</li></ul>
    ${link(L("Read a model response", "خواندن پاسخ نمونه"), `sample/${result.skill}/${attempt.track}`, "text-link with-arrow")}</aside></div>`;
}

function stopActiveMedia(clear = false) {
  mediaRequest++;
  const audio = document.getElementById("study-audio");
  if (audio) {
    audio.pause();
    if (state.draft?.mode === "exam" && !state.draft.audioEnded) {
      state.draft.audioTime = audio.currentTime;
      persist();
    }
  }
  soundCheckClip?.pause();
  soundCheckClip = null;
  if (recording && recording.recorder.state !== "inactive") recording.recorder.stop();
  recording?.stream.getTracks().forEach(track => track.stop());
  recording = null;
  if (clear && lastClip) {
    URL.revokeObjectURL(lastClip.url);
    lastClip = null;
  }
}
function refreshSpeaking() {
  const pane = document.querySelector(".response-pane");
  if (pane && state.draft?.skills[state.draft.stage] === "speaking") pane.innerHTML = speakingPanel(state.draft);
}
async function beginRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    announce(L("Microphone unavailable. You can use the sample response.", "میکروفون در دسترس نیست. می‌توانی از پاسخ نمونه استفاده کنی."));
    return;
  }
  const draft = state.draft;
  const request = ++mediaRequest;
  announce(L("Waiting for microphone permission…", "در انتظار اجازهٔ میکروفون…"));
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (request !== mediaRequest || view.page !== "session" || state.draft !== draft) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    const recorder = new MediaRecorder(stream);
    const chunks = [];
    const current = { recorder, stream, keep: false };
    recorder.addEventListener("dataavailable", event => { if (event.data.size) chunks.push(event.data); });
    recorder.addEventListener("stop", () => {
      stream.getTracks().forEach(track => track.stop());
      if (recording !== current) return;
      recording = null;
      if (!current.keep || state.draft !== draft || view.page !== "session") return;
      if (chunks.length) {
        if (lastClip) URL.revokeObjectURL(lastClip.url);
        lastClip = { id: draft.id, url: URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || chunks[0].type })) };
        draft.recorded = true;
        draft.speak = "";
        persist();
        refreshSpeaking();
        announce(L("Recording ready.", "صدا آماده است."));
      }
      if (current.finishAfterStop !== undefined) finishSection(current.finishAfterStop);
    });
    recorder.addEventListener("error", () => {
      if (recording !== current) return;
      stopActiveMedia();
      refreshSpeaking();
      announce(L("Recording failed. Try again or use the sample.", "ضبط انجام نشد. دوباره تلاش کن یا پاسخ نمونه را انتخاب کن."));
    });
    recorder.start();
    recording = current;
    refreshSpeaking();
    announce(L("Recording started.", "ضبط شروع شد."));
  } catch {
    stream?.getTracks().forEach(track => track.stop());
    if (request === mediaRequest) announce(L("Microphone unavailable. You can use the sample response.", "میکروفون در دسترس نیست. می‌توانی از پاسخ نمونه استفاده کنی."));
  }
}
function setupRenderedMedia() {
  const audio = document.getElementById("study-audio");
  const draft = state.draft;
  if (!audio || !draft || draft.mode !== "exam") return;
  const resume = () => {
    if (draft.audioTime && draft.audioTime < audio.duration) audio.currentTime = draft.audioTime;
  };
  if (audio.readyState) resume();
  else audio.addEventListener("loadedmetadata", resume, { once: true });
  audio.addEventListener("timeupdate", () => {
    if (state.draft !== draft || Math.abs(audio.currentTime - draft.audioTime) < 2) return;
    draft.audioTime = audio.currentTime;
    persist();
  });
  audio.addEventListener("ended", () => {
    if (state.draft !== draft) return;
    draft.audioEnded = true;
    persist();
    const button = document.querySelector('[data-action="play-exam-audio"]');
    if (button) {
      button.textContent = L("Audio complete", "پخش به پایان رسید");
      button.disabled = true;
    }
  });
}
function studyChange(input) {
  if (input.name === "scope" && input.checked) {
    document.getElementById("diagnostic-skills").hidden = input.value !== "one";
  }
  if (input.matches("[data-answer]") && input.checked && state.draft) {
    state.draft.answers[state.draft.focusIndex] = +input.dataset.answer;
    persist();
    const questions = questionSet(state.draft.skills[state.draft.stage], state.draft.track, state.draft.drill);
    document.getElementById("question-palette").innerHTML = questionPalette(state.draft, questions);
  }
}
function studyInput(input) {
  const draft = state.draft;
  if (!draft) return;
  if (input.matches("[data-answer-text]")) {
    draft.answers[draft.focusIndex] = input.value;
    persist();
    const questions = questionSet(draft.skills[draft.stage], draft.track, draft.drill);
    document.getElementById("question-palette").innerHTML = questionPalette(draft, questions);
  }
  if (input.matches("[data-essay]")) {
    draft.essays[draft.taskIndex] = input.value;
    persist();
    document.getElementById("words-count").textContent = num(wordCount(input.value));
    document.getElementById("writing-hint").textContent = draftWritingHint(input.value, CONTENT.writing[draft.track][draft.taskIndex]);
  }
}
function studyAction(action, target) {
  const draft = state.draft;
  switch (action) {
    case "test-sound": {
      const audio = new Audio("assets/observatory.mp3");
      soundCheckClip?.pause();
      soundCheckClip = audio;
      target.disabled = true;
      audio.play().then(() => {
        announce(L("Playing a short sound check.", "در حال پخش صدای آزمایشی."));
        setTimeout(() => {
          audio.pause();
          if (soundCheckClip === audio) soundCheckClip = null;
          target.disabled = false;
        }, 2600);
      }).catch(() => {
        target.disabled = false;
        announce(L("Could not play the sound check.", "پخش صدای آزمایشی ممکن نشد."));
      });
      return true;
    }
    case "check-mic":
      if (!navigator.mediaDevices?.getUserMedia) announce(L("Microphone unavailable in this browser.", "میکروفون در این مرورگر در دسترس نیست."));
      else navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop());
        announce(L("Microphone is ready.", "میکروفون آماده است."));
      }).catch(() => announce(L("Microphone permission was not granted.", "اجازهٔ استفاده از میکروفون داده نشد.")));
      return true;
  }
  if (!draft) return false;
  switch (action) {
    case "exit-session":
      stopActiveMedia();
      go("app");
      return true;
    case "go-question":
    case "next-question":
    case "previous-question": {
      const questions = questionSet(draft.skills[draft.stage], draft.track, draft.drill);
      const next = action === "go-question" ? Number(target.dataset.index) : draft.focusIndex + (action === "next-question" ? 1 : -1);
      if (next < 0 || next >= questions.length) return true;
      draft.focusIndex = next;
      persist();
      document.querySelectorAll("[data-paragraph].emphasis").forEach(paragraph => paragraph.classList.remove("emphasis"));
      refreshQuestion(true);
      return true;
    }
    case "flag-question": {
      const index = draft.focusIndex;
      const flagged = draft.flags.includes(index);
      draft.flags = flagged ? draft.flags.filter(flag => flag !== index) : draft.flags.concat(index);
      target.textContent = flagged ? L("Flag for review", "نشان برای مرور") : L("Flagged", "نشان‌دار");
      target.setAttribute("aria-pressed", String(!flagged));
      document.getElementById("question-palette").innerHTML = questionPalette(draft, questionSet(draft.skills[draft.stage], draft.track, draft.drill));
      persist();
      return true;
    }
    case "check-evidence": {
      document.getElementById("question-evidence").hidden = false;
      const question = questionSet(draft.skills[draft.stage], draft.track, draft.drill)[draft.focusIndex];
      document.querySelectorAll("[data-paragraph]").forEach(paragraph => paragraph.classList.toggle("emphasis", +paragraph.dataset.paragraph === question.evidence));
      return true;
    }
    case "play-exam-audio": {
      const audio = document.getElementById("study-audio");
      if (!audio || draft.audioEnded) return true;
      target.disabled = true;
      audio.play().then(() => { target.textContent = L("Playing…", "در حال پخش…"); }).catch(() => {
        target.disabled = false;
        announce(L("Playback failed. Try again.", "پخش انجام نشد. دوباره تلاش کن."));
      });
      return true;
    }
    case "writing-task":
      draft.taskIndex = +target.dataset.index;
      persist();
      render();
      return true;
    case "record":
      if (!recording) void beginRecording();
      return true;
    case "stop-recording":
      if (recording && recording.recorder.state !== "inactive") {
        recording.keep = true;
        recording.recorder.stop();
      }
      return true;
    case "sample-speaking":
      if (recording) stopActiveMedia();
      draft.speak = "I like to study in a quiet space with a large table and plenty of daylight. For example, I used my neighbourhood library to revise recently. I was able to organise my notes and finish my work before dinner.";
      draft.recorded = false;
      if (lastClip?.id === draft.id) {
        URL.revokeObjectURL(lastClip.url);
        lastClip = null;
      }
      persist();
      refreshSpeaking();
      return true;
    case "submit-study":
      openDialog(L("Finish this section?", "این بخش تمام شود؟"), L("Your answers will be saved as they are. You can review them after submission.", "پاسخ‌ها همین‌طور که هستند ذخیره می‌شوند. پس از ثبت می‌توانی آن‌ها را مرور کنی."), L("Submit answers", "ثبت پاسخ‌ها"), () => finishSection());
      return true;
    case "next-section":
      if (draft.break) {
        state.draft = sectionDraft({ ...draft, stage: draft.stage + 1 });
        persist();
        go("session");
      }
      return true;
  }
  return false;
}
