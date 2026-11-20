// Home-page enhancement. The rendered report remains available without JavaScript.
const root = document.querySelector("[data-landing-content]");
const { writing: WRITING_NOTES, speaking: SPEAKING_NOTES, reading: READING_CHECK,
  listening: LISTENING_CHECK, readingNotes: READING_CHECK_NOTES, labels } = JSON.parse(root.dataset.landingContent);
const format = new Intl.NumberFormat(document.documentElement.lang, { useGrouping: false });
const num = value => format.format(value);
const numText = value => value.replace(/[0-9]/g, digit => num(Number(digit)));
const isCorrect = (question, value) => value !== null && value !== "" && Number(value) === question.answer;
function clipTime(seconds) {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
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
  for (const group of root.querySelectorAll("[data-landing-tabs]")) {
    setupLandingTabs(group);
    selectLandingTab(group.querySelector('[aria-selected="true"]'));
  }
  root.dataset.enhanced = "";
  const selectCurrentLink = () => selectLinkedTab(location.hash, new URLSearchParams(location.search).get("skill"));
  selectCurrentLink();
  window.addEventListener("popstate", selectCurrentLink);
  root.addEventListener("click", event => {
    const link = event.target.closest("a[data-demo-link]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const url = new URL(link.href);
    history.pushState(null, "", url);
    selectCurrentLink();
    document.querySelector(url.hash)?.scrollIntoView();
  });
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

function selectLinkedTab(section, skill) {
  const group = section === "#sample-report" ? "report" : section === "#ai-feedback" ? "evaluation" : null;
  if (!group) return;
  const tabs = document.querySelectorAll(`[data-landing-tabs="${group}"] [data-landing-tab]`);
  const active = Array.from(tabs).find(tab => tab.dataset.landingTab === skill);
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
    feedback.querySelector("[data-note-criterion]").textContent = note.criterion;
    feedback.querySelector("[data-note-title]").textContent = note.title;
    feedback.querySelector("[data-note-reason]").textContent = note.reason;
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
    toggle.textContent = revised ? labels.showOriginal : labels.showRevision;
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
    play.setAttribute("aria-label", playing ? labels.pauseSpeaking : labels.playSpeaking);
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

  return loadLandingClip(audio);
}

function loadLandingClip(audio) {
  audio.removeAttribute("controls");
  const container = audio.closest(".report-player, .speaking-audio");
  function enableMetadata() { audio.preload = "metadata"; }
  if (!("IntersectionObserver" in window) || !container) {
    enableMetadata();
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      enableMetadata();
    }
  }, { rootMargin: "220px" });
  observer.observe(container);
  return () => observer.disconnect();
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
      ? READING_CHECK_NOTES[Number(choice)]
      : Number(choice) === 1
        ? labels.arrivalTime
        : labels.updatedTime;
    feedback.innerHTML = `<div class="report-drill-result">
      ${drillMetric(labels.answer, answer, "answer")}
      ${isReading ? drillMetric(labels.evidence, evidence, "evidence") : ""}
    </div><p>${explanation}${evidenceGroup && !evidence ? " " + labels.evidenceNudge : ""}</p>`;
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
    play.setAttribute("aria-label", playing ? labels.pause : labels.play);
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
  const dispose = loadLandingClip(audio);
  return () => {
    cancelAnimationFrame(frame);
    dispose?.();
  };
}

const dispose = setupLanding();
window.addEventListener("pagehide", event => {
  for (const audio of root.querySelectorAll("audio")) audio.pause();
  if (!event.persisted) dispose?.();
});
