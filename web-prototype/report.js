"use strict";

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
  source: "assets/listening-review.mp3",
  duration: 7.06,
  levels: [5, 28, 82, 69, 93, 53, 78, 71, 53, 17, 60, 67, 53, 54, 53, 62, 67, 45, 73, 83, 45, 61, 39, 72, 36, 57, 70, 59, 16, 68, 74, 13, 69, 84, 72, 67, 44, 79, 54, 63, 69, 75, 59, 81, 74, 64, 49, 56, 50, 58, 70, 51, 41, 10]
};
const LISTENING_DRILL_CLIP = {
  source: "assets/listening-drill.mp3",
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
  return `<section class="report-showcase" id="how-it-works" aria-labelledby="report-showcase-title">
    <div class="wrap">
      <header class="report-showcase-heading" data-enter>
        <span class="section-label">${L("Sample IELTS report", "گزارش نمونهٔ آیلتس")}</span>
        <h2 id="report-showcase-title" tabindex="-1">${L("What cost this learner a point?", "یک امتیاز کجا از دست رفت؟")}</h2>
        <p>${L("Find the line or listen for the correction. Then try a new question.", "جملهٔ کلیدی را پیدا کن یا اصلاحیه را بشنو. بعد یک سؤال تازه حل کن.")}</p>
      </header>
      <div class="report-deck" data-enter>
        <div class="report-top">
          ${tabs(["reading", "listening"].map(skill => [skill, `${icon(CONTENT.skills[skill].icon)} <span>${skillName(skill)}</span>`]), "report", active, L("Sample report skill", "مهارت گزارش نمونه"))}
          <span class="report-exam">${trackName(findTrack(attempt.track))}</span>
        </div>
        ${reportPanel(attempt, "reading", active === "reading")}
        ${reportPanel(attempt, "listening", active === "listening")}
      </div>
    </div>
  </section>`;
}

function reportPanel(attempt, skill, active) {
  const isReading = skill === "reading";
  const result = attempt.results.find(item => item.skill === skill);
  const questions = questionSet(skill, attempt.track);
  const drill = CONTENT.drills.find(item => item.id === (isReading ? "paraphrase" : "detail"));
  const index = drill.question;
  const question = questions[index];
  const source = isReading
    ? `<blockquote class="report-evidence" lang="en" dir="ltr">${markEvidence(CONTENT.reading.text[question.evidence], "highest demand")}</blockquote>`
    : listeningReviewSource();

  return `<section class="report-panel" id="report-panel-${skill}" role="tabpanel" aria-labelledby="report-tab-${skill}" data-sample-report="${skill}" ${active ? "" : "hidden"}>
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
      ${link(L("Open the full sample report", "دیدن گزارش کامل نمونه"), `review/${attempt.id}`, "text-link with-arrow", { skill, q: index })}
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
    <audio data-src="${clip.source}" preload="metadata"></audio>
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

function setupSampleReport(panel) {
  const isReading = panel.dataset.sampleReport === "reading";
  const review = panel.querySelector("[data-report-review]");
  const drill = panel.querySelector("[data-report-drill]");
  const form = drill.querySelector("form");
  const feedback = form.querySelector("[data-report-feedback]");
  const transcript = drill.querySelector(".report-drill-transcript");
  const answerGroup = form.querySelector('[data-report-part="answer"]');
  const evidenceGroup = form.querySelector('[data-report-part="evidence"]');

  panel.addEventListener("click", event => {
    const toggle = event.target.closest("[data-report-toggle]");
    if (!toggle) return;
    const showDrill = toggle.dataset.reportToggle === "drill";
    (showDrill ? review : drill).querySelector("audio")?.pause();
    review.hidden = showDrill;
    drill.hidden = !showDrill;
    (showDrill ? drill : review).querySelector("h3").focus();
  });

  form.addEventListener("change", () => {
    delete answerGroup.dataset.result;
    if (evidenceGroup) delete evidenceGroup.dataset.result;
    feedback.textContent = "";
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.checkValidity()) return;
    const response = new FormData(form);
    const choice = response.get("answer");
    const answer = isCorrect(isReading ? READING_CHECK : LISTENING_CHECK, choice);
    answerGroup.dataset.result = answer ? "correct" : "incorrect";
    const evidence = isReading && Number(response.get("evidence")) === READING_CHECK.evidence;
    if (evidenceGroup) evidenceGroup.dataset.result = evidence ? "correct" : "incorrect";
    const explanation = isReading
      ? bi(READING_CHECK_NOTES[Number(choice)])
      : Number(choice) === 1
        ? L("Ten minutes before class gives the arrival time. Listen for “moved it to” to find the start time.", "ده دقیقه زودتر زمان حضور است. برای ساعت شروع به عبارت moved it to گوش بده.")
        : L("“Was going to” gives the old time. “Moved it to” gives the updated start time.", "عبارت was going to ساعت قبلی و moved it to ساعت جدید شروع را نشان می‌دهد.");
    feedback.innerHTML = `<div class="report-drill-result">
      ${drillMetric(L("Answer", "پاسخ"), answer, "answer")}
      ${isReading ? drillMetric(L("Evidence", "شاهد"), evidence, "evidence") : ""}
    </div><p>${explanation}${evidenceGroup && !evidence ? " " + L("Choose the line that mentions bookings to support your answer.", "برای اثبات پاسخ، جمله‌ای را انتخاب کن که به تعداد رزروها اشاره می‌کند.") : ""}</p>`;
    if (transcript) {
      drill.querySelector("audio").pause();
      transcript.open = true;
    }
  });

  if (!isReading) {
    const disposeReview = setupReportAudio(review);
    const disposeDrill = setupReportAudio(drill);
    return () => { disposeReview(); disposeDrill(); };
  }
}

function drillMetric(label, correct, part) {
  return `<span class="${correct ? "metric-correct" : "metric-missed"}"><span>${label}</span><bdi dir="ltr" data-drill-count="${part}">${num(correct ? 1 : 0)} / ${num(1)}</bdi></span>`;
}

function setupReportAudio(pane) {
  const audio = pane.querySelector("audio");
  const play = pane.querySelector("[data-report-play]");
  const rate = pane.querySelector("[data-report-speed]");
  const seek = pane.querySelector("[data-report-seek]");
  const wave = pane.querySelector("[data-report-wave]");
  const bars = [...wave.querySelectorAll("i")];
  const elapsed = pane.querySelector("[data-report-time]");
  const duration = pane.querySelector("[data-report-duration]");
  const message = pane.querySelector("[data-report-audio-error]");
  const cues = [...pane.querySelectorAll("[data-report-cue]")];
  let stopAt = null;
  let frame = 0;

  function sync() {
    const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0;
    seek.value = audio.currentTime;
    wave.style.setProperty("--played", `${progress * 100}%`);
    bars.forEach((bar, i) => bar.classList.toggle("was-played", i + .5 < bars.length * progress));
    elapsed.textContent = clipTime(audio.currentTime);
    seek.setAttribute("aria-valuetext", `${numText(elapsed.textContent)} / ${numText(duration.textContent)}`);
    const playing = !audio.paused && !audio.ended;
    play.firstElementChild.textContent = playing ? "Ⅱ" : "▶";
    play.setAttribute("aria-label", playing ? L("Pause recording", "توقف صدا") : L("Play recording", "پخش صدا"));
    for (const cue of cues) {
      cue.classList.toggle("is-playing-line", playing && audio.currentTime >= Number(cue.dataset.reportCue) && audio.currentTime < Number(cue.dataset.end));
    }
  }

  function stopCueAtBoundary() {
    if (stopAt !== null && (audio.ended || audio.currentTime >= stopAt)) {
      audio.pause();
      stopAt = null;
    }
  }

  function monitorCue() {
    stopCueAtBoundary();
    frame = stopAt === null || audio.paused ? 0 : requestAnimationFrame(monitorCue);
  }

  function start() {
    message.hidden = true;
    audio.play().catch(error => {
      if (error.name !== "AbortError") message.hidden = false;
    });
    if (stopAt !== null && !frame) frame = requestAnimationFrame(monitorCue);
  }

  play.addEventListener("click", () => {
    stopAt = null;
    if (audio.paused) start();
    else audio.pause();
  });
  rate.addEventListener("click", () => {
    const slow = audio.playbackRate === 1;
    audio.playbackRate = slow ? .75 : 1;
    rate.setAttribute("aria-pressed", String(slow));
    rate.firstElementChild.textContent = `${num(audio.playbackRate)}×`;
  });
  seek.addEventListener("input", () => {
    stopAt = null;
    audio.currentTime = Number(seek.value);
    sync();
  });
  for (const cue of cues) {
    cue.addEventListener("click", () => {
      audio.currentTime = Number(cue.dataset.reportCue);
      stopAt = Number(cue.dataset.end);
      start();
    });
  }
  for (const name of ["play", "pause", "ended", "seeked"]) audio.addEventListener(name, sync);
  audio.addEventListener("timeupdate", () => { stopCueAtBoundary(); sync(); });
  audio.addEventListener("loadedmetadata", () => {
    seek.max = audio.duration;
    duration.textContent = clipTime(audio.duration);
    for (const control of [play, seek, rate, ...cues]) control.disabled = false;
    sync();
  });
  function unavailable() {
    message.hidden = false;
    for (const control of [play, seek, rate, ...cues]) control.disabled = true;
  }
  audio.addEventListener("error", unavailable);
  const dispose = loadLandingClip(audio, unavailable);
  return () => {
    cancelAnimationFrame(frame);
    dispose?.();
  };
}
