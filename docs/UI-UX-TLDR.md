# Mockza — Product & Capability TLDR (For UI/UX Design)

> **What It Is:** A mobile-native **All-4-Skill High-Stakes English Exam Simulator & AI Coach** (`Speaking`, `Writing`, `Reading`, `Listening` + `Mistake-to-Deck Vocabulary`) spanning **IELTS**, **PTE Academic**, **TOEFL iBT**, and **Duolingo English Test (`DET`)**. Fully English, **LTR**, and ad-free.
>
> *Note for the Designer:* This document defines **what capabilities, states, actions, and constraints exist**—intentionally without proposing screens, pages, tabs, or navigation layouts.

---

## 1. Core Mechanism (How the Product Works End-to-End)

1. **Calibrate & Try Free:** New users pick a target exam, target score, and optional test date (no forced login upfront) to start an immediate risk-free sample (`1 AI Speaking or Writing diagnostic`, `1 sample Reading`, `1 sample Listening`, `20 vocab reviews/day`).
2. **Simulate (`Exam Mode` vs. `Study Mode`):**
   * *Exam Mode* mirrors official test pressure (strict countdown timers, OS autocorrect off, single-play Listening audio, distraction-free environment).
   * *Study Mode* relaxes rules for learning (optional outline hints, Listening speed/replay controls, optional transcripts/subtitles).
3. **Evaluate & Diagnose:**
   * **Reading & Listening** grade **offline & instantaneously (< 0.1s)** via deterministic answer keys and band-conversion lookup tables.
   * **Speaking & Writing** grade via **Multimodal AI (~6–12s)**: AI listens directly to raw compressed `.m4a` speech (hearing pauses, filler words, intonation, and pronunciation) or evaluates essays, returning criterion scores, line-level rationale, and a **"+1.5 Band" Model Rewrite using the student's own ideas**.
4. **Capture Mistakes (`Mistake-to-Deck`):** One tap on any AI suggestion or highlighted Reading word saves a flashcard (the student's own sentence + academic synonyms + context) into an offline **SM-2 spaced-repetition deck**.
5. **Drill Weaknesses:** Rather than endlessly repeating full multi-hour exams, users trigger focused 3-minute micro-drills targeting their lowest scoring rubric criterion.

---

## 2. Complete Capability & Feature Inventory

### A. Exam Catalog, Account & Monetization State
* **Multi-Exam Hub:** Switch cleanly across **IELTS** (Academic/General), **PTE Academic** (`10–90`), **TOEFL iBT** (Integrated & Academic Discussion), and **DET** (`10–160`), tracking an optional exam-date countdown.
* **Entitlements & Fair-Use Transparency:** Separate Free Starter limits vs. paid tiers (`Weekly Cram`, `Monthly Pro`, `Quarterly Pack`) via StoreKit/Play Billing (`Restore Purchases`), surface remaining daily AI evaluations (`e.g., 8/10 left today`), and allow optional Apple/Google sign-in later for cross-device sync.
* **Trust & Compliance Controls:** Expose a clear **independent-simulator non-affiliation disclaimer**, a pre-mic **AI data transmission notice**, and **Delete All Data & Audio**.

### B. Speaking Engine & AI Audio Feedback
* **Pre-Flight Check:** Microphone permission verification plus a brief live audio-level test before any timed prompt begins.
* **Timed Simulation Mechanics:**
  * *IELTS (Parts 1–3):* Spoken examiner prompts (audio-only in Exam Mode, toggleable captions in Study Mode); Part 2 enforces **1:00 preparation + user scratchpad notes**, audible chime, and **up to 2:00 recording** with live amplitude feedback and automatic hard stop.
  * *TOEFL / PTE / DET Flows:* Timed independent prompts (`15s prep / 45s speak`) and chained **Integrated Read -> Listen -> Prep -> Record** sequences (`45s` read -> `60–90s` audio -> `30s` prep -> `60s` speak), plus rapid Read Aloud / Describe Image sprints.
* **Offline Audio Safety:** Persists `.m4a` clips locally *before* network upload; if offline or timed out, keeps recordings visibly queued with a **1-tap Retry** without losing work or burning quota.
* **AI Evaluation Outputs:**
  * Overall score (`Band 0–9` / `0–30` / `10–90` / `10–160`) + criterion breakdown meters (*Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy, Pronunciation*).
  * Playback of the user's **own voice recording** synchronized with a **verbatim transcript** flagging hesitation pauses (`[2.1s pause]`), fillers, grammar slips, and stronger phrasing options.
  * Concise examiner rationale + natural spoken model answer + **1-tap Save Word** + **"Retry Same Prompt"** (`Attempt 1 vs. Attempt 2` comparison) + **3-min micro-drill** trigger.

### C. Writing Engine & AI Text Critique
* **Prompt Variants:** IELTS Task 1 (zoomable chart/table/process SVG + ≥150w, `20m`), IELTS Task 2 essay (≥250w, `40m`), TOEFL Integrated (`3m` Reading -> `2m` Audio Lecture + notes -> `20m` Essay with Reading visible), TOEFL Academic Discussion (`10m`), PTE Summarize/Essay, and DET photo/writing tasks.
* **Editor Mechanics:** Clean text entry, OS autocorrect lock in Exam Mode, live word counter (`current / target`), countdown timer, silent `500ms` & app-background autosave indicator, and hard input lock when time expires.
* **AI Evaluation Outputs:**
  * Overall score + criterion breakdown meters (*Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical Range*).
  * Interactive highlighted spans inside the user's essay showing each error, why the rubric penalized it, the upgraded phrase, and **1-tap Save Word**.
  * Clear comparison between the user's submission and a **"+1.5" Personalized Model Rewrite** preserving their original arguments + **3-min weak-criterion micro-drill** trigger.

### D. Reading Engine (Offline Deterministic)
* **Passage & Question Interaction:** Scroll-independent access to long academic passages (`750–900` words) and exam questions (*True/False/Not Given, Yes/No/Not Given, MCQ, Matching Headings, Summary/Gap Fill* with word-limit cues).
* **Active Reading Tools:** Multi-color sentence highlighting, persistent user notes attached to passage sections, and **tap-any-word Save to Vocab**.
* **Instant Review:** Offline score calculation (`raw/40 -> Band`), instant jump from any missed question directly to the highlighted evidence sentence in the passage, and pre-authored answer rationale (+ optional **"Ask AI Why?"** deep explanation).

### E. Listening Engine (Offline-Cached CDN Audio)
* **Audio Pack Readiness:** Shows accent mix (`UK / AU / US / NZ`), pack size, download progress, and **Offline Cached ✓** state.
* **Playback Policies:** *Exam Mode* plays once linearly (disabling pause and timeline scrubbing while honoring pre-audio reading timers); *Study Mode* enables seeking, replay, playback speed (`0.85x / 1.0x / 1.25x`), and an **interactive synced transcript** highlighting speaker self-correction distractors.

### F. Contextual Vocabulary (`Mistake-to-Deck` Spaced Repetition)
* **Card Sources:** (1) Personal upgrades captured in 1 tap from Writing, Speaking, or Reading sessions; (2) Curated high-yield Academic Word List collocations and Reading paraphrase pairs.
* **Review Interaction:** Daily `Due Today` counter, prompt side (target word/phrase + cloze sentence from *the user's own attempt*), reveal side (concise definition, academic paraphrases/synonyms, audio pronunciation, origin attempt reference), and 4 SM-2 difficulty ratings (**Again | Hard | Good | Easy**).

### G. Progress & Retention Analytics
* Overall and per-skill score trends over time, study streaks, and a filterable attempt archive (clearly surfacing any offline Speaking recordings still pending retry/upload).

---

## 3. Hard UX & Engineering Constraints for the Interface

1. **Interrupt-Free Timed Tests:** Active simulators must suppress surrounding navigation distractions and **intercept accidental back swipes/exits** with an explicit confirmation prompt so live attempts cannot be lost unintentionally.
2. **Colorblind & Accessibility Compliance:** Never communicate score tiers, error categories, or Reading highlights using color alone—always pair with icons, badges, or distinct underline styles; ensure full readability and button clearance up to **`2.0x` system font scaling** even with mobile keyboards open.
3. **Calm Academic Visual Tone:** Design for sustained 60-minute reading and writing focus using clean light and dark contrast modes, without noisy gamification confetti or banner/interstitial ads.
4. **Transparent Asynchronous & Offline States:** Clearly signal multi-stage AI progress (*Saving audio locally -> Evaluating speech & grammar -> Generating rewrite*), downloaded offline readiness, and calm 1-tap retry states when offline.
