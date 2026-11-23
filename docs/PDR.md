# Mockza — Product Design & Requirements (PDR v4.0)

> **Executive Thesis:** Mockza (`GLB`) and its Persian domestic twin Sanjia (`IRN`, [docs/PDR-Iran.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR-Iran.md)) form a consolidated, offline-first, AI-native **5-Track High-Stakes English Exam Simulator, Closed-Loop Smart Coach & Adaptive Personalization Platform** covering **IELTS Academic**, **IELTS General Training**, **TOEFL iBT (2026 Format)**, **PTE Academic (Latest)**, and **Duolingo English Test (DET Latest)**. Shipped across both a **Flutter Mobile/Web Client (`app/`)** and a **Standalone Astro 5 + React 19 Desktop Web Studio (`web/`)** under a strict **`1 Phone + 1 Desktop Web`** multi-surface subscription policy, it combines **100% clean-room Reading/Listening mocks & SM-2 Spaced Repetition** (`$0` marginal AI cost) with **AI Speaking & Writing rubric evaluation**, **Adaptive Step-by-Step Roadmaps (*Durnama*)**, **OpenRouter `hexgrad/kokoro-82m` Neural TTS**, **Multimodal `google/gemini-3.1-flash-lite` Pronunciation Coaching**, **Closed-Loop Error DNA Remediation**, and **Full Server-Side User, Recording, Token & USD Cost Observability**.

---

## 1. Document Control & Product Identity

| Field | Specification |
| :--- | :--- |
| **Product Name** | `Mockza` *(verified low-collision 6-char brand preserving ASO keyword budget)* |
| **Edition & Versioning Code** | **Global Edition (`GLB`)** — Canonical Version `1.0.0+10001.glb` *(Catalog Prefix: `GLB-*`; separated from Iran Domestic Edition `IRN` `1.0.0+20001.irn` in [docs/PDR-Iran.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR-Iran.md))* |
| **Release Status** | **`v4.0` — Live Dual-Client (`Flutter` + `Astro 5 / React 19 Desktop Web`), Dual-Edition (`GLB` + `IRN`), 5-Track Exam Hub, Closed-Loop Smart Coach, Adaptive Personalization & Roadmap (*Durnama*), Kokoro-82m Neural TTS, Gemini 3.1 Flash Lite Pronunciation Studio, Cross-Device Sync & End-to-End Server Tracing** |
| **Supported Exam Tracks (5 Live)** | **IELTS Academic** (`0.0–9.0`), **IELTS General Training** (`0.0–9.0`), **TOEFL iBT 2026** (`1.0–6.0` + `0–120` concordance), **PTE Academic** (`10–90`), **Duolingo English Test / DET** (`10–160` + 4 integrated subscores) |
| **Primary App Store Title** | `Mockza: IELTS, PTE, TOEFL Prep` *(30 / 30 chars max)* |
| **iOS Subtitle (Default)** | `AI English Speaking & Writing` *(29 / 30 chars max; `listening`, `reading`, `vocabulary` targeted in Keywords)* |
| **Multi-Surface Access Policy** | Strict **`1 Mobile Phone + 1 Desktop Web`** concurrent active session policy per subscription across Flutter Mobile (`mobile`) and Standalone Desktop Web (`desktop_web`) with seamless cross-device sync |
| **Content IP Posture** | **100% Clean-Room Original / Commercial-Permissive Content** *(verified across 36 seeded exam bundles, 7 drills & 320 vocab cards; official books never copied)* |
| **Target Unit Economics** | `>= 80%` blended gross margin per active subscriber after 15% store fee and AI inference COGS, tracked to the sub-cent in `ai_usage_ledger` |

---

## 2. Stakeholder Q&A Matrix

| # | Stakeholder Question | Verified Answer & Current Strategy |
| :--- | :--- | :--- |
| **Q1** | **Why will learners pay Mockza \$5.99–\$14.99/mo over ChatGPT Voice or free PDFs?** | Generic chatbots lack authentic multi-part timers, exam-specific task sequences (TOEFL *Build a Sentence*/*Academic Discussion*, PTE *Re-order Paragraphs*/*Summarize Written Text*, DET *Write About Photo*), calibrated rubric bounds (`1.0–6.0`, `10–90`, `10–160`, `0.0–9.0`), **Step-by-Step Adaptive Roadmaps (*Durnama*)**, **Error DNA Graphs with Active Production Verification**, **OpenRouter Kokoro-82m UK/US Neural TTS**, and **Multimodal Phoneme Pronunciation Coaching**. |
| **Q2** | **Why pair a native Flutter app (`app/`) with a standalone Astro 5 + React 19 Desktop Web portal (`web/`)?** | High-stakes exams (IELTS Computer-Delivered, TOEFL iBT, PTE, DET) are taken on desktop monitors with physical keyboards, while daily vocabulary, roadmap checks, and commute listening happen on phones. Furthermore, Astro 5's **0KB-JS static SEO & GEO pages** (85 pages/edition, `<1KB` calculators, sample essays, `llms.txt`, `.md` twins) drive organic search and AI-engine discovery at zero CAC, feeding directly into the React 19 `/app/*` simulator studio and mobile app under our **`1 Phone + 1 Desktop Web`** account policy. |
| **Q3** | **Why house IELTS Ac/GT, TOEFL iBT (2026), PTE, and DET in one app (`Mockza`)?** | **Apple App Store Guideline 4.3 (Spam)** rejects cloned apps. A schema-driven polymorphic hub consolidates ratings/ASO, isolates each track's score scale cleanly (preventing score leakage across Home, Roadmap & Progress), and multiplies addressable global test-takers in one codebase. |
| **Q4** | **How does the app guide a learner day-by-day from their current band to their target band?** | Upon completing Onboarding and the Rapid Diagnostic (or first practice), **`LiveBandEngine`** and **`RoadmapGenerator`** create a personalized **Step-by-Step Roadmap (*Durnama*)**. After every attempt, **`ObjectiveWeaknessExtractor`**, **`TopicWeaknessRotator`**, **`VocabWaveScheduler`**, and the **Closed-Loop Smart Coach** update the learner's skill bands, rotate weak topic domains, unlock progressive vocabulary waves, and show a **`PlanImpactCard`** with the next recommended action. |
| **Q5** | **Why use OpenRouter `hexgrad/kokoro-82m` API TTS instead of browser/OS `speechSynthesis`?** | Browser and OS TTS voices vary wildly across devices, sound robotic, and frequently break on Linux/WebView/mobile containers. Server-side **`hexgrad/kokoro-82m`** delivers consistent, studio-grade British (`bf_emma`) and American (`af_bella`) neural pronunciation everywhere, cached by SHA-256 in S3/SeaweedFS so repeated plays cost `$0` and load instantly. |
| **Q6** | **How do we track every user's actions, audio recordings, token consumption, and AI costs?** | Every user action, synced attempt, SM-2 review batch, pronunciation clip, and AI model call is persisted on our backend (`ai_usage_ledger`, `user_activity_ledger`, `user_attempts_sync`, `user_vocab_srs_sync`, `pronunciation_practices`) with exact prompt/completion/audio tokens, latency, and USD cost—inspectable in real time via the **Admin Trace Console** (`/app/admin/trace` & `/v1/admin/usage/*`). |
| **Q7** | **How do we prevent subscription/account sharing across friends or groups?** | Every authenticated account (`Email/Password`, `Google`, `Apple`, or `SMS OTP` in IRN) enforces an atomic backend limit of **`1 Mobile Phone` + `1 Desktop Web`** concurrent active session (`409 DEVICE_SLOT_OCCUPIED` with 1-tap `replaceSessionId` takeover or Settings device revocation), explicitly consented to on Paywall checkout. |
| **Q8** | **How do we prevent AI inference bills from eroding subscription margin?** | Offline Reading/Listening/Vocab absorb >50% of engagement; SHA-256 S3 caching deduplicates Kokoro-82m TTS audio globally; `google/gemini-3.1-flash-lite` and `deepseek/deepseek-v4.1-flash-1017` keep per-call inference low; and the server enforces atomic quota reservation (`10 Speaking + 10 Writing/day`, `150/mo`), 60 req/min TTS burst limits, and automatic failure refunds. |

---

## 3. Target Market, Personas & Jobs-to-Be-Done

| Persona | Profile & Exam Track | Core Pain / Anxiety | Job-to-Be-Done (JTBD) | Preferred Plan |
| :--- | :--- | :--- | :--- | :--- |
| **1. The Deadline Crammer** | Candidate with **IELTS, TOEFL iBT, PTE, or DET** booked in **7–21 days**. | Overwhelmed by what to study next; needs realistic timed practice & instant AI scoring on laptop and phone. | *"Give me an adaptive day-by-day roadmap tonight, drill my weakest topic and rubric criterion, and show my live band shift after each session."* | **\$5.99 / week** Cram Pass |
| **2. The Plateau Retaker** | Stuck just below target (e.g., **6.0 IELTS**, **4.5 TOEFL**, **58 PTE**, or **110 DET** Writing/Speaking). | Repeats identical lexical, grammar, and pronunciation habits across expensive retakes (\$215–\$280 official fee). | *"Map my Error DNA graph, force me to shift casual sentences to Band 8.5+ academic register, grade my spoken pronunciation word-by-word, and verify I actually use new vocab in my next essay."* | **\$14.99 / mo** Pro or **\$29.99 / 3-mo** |
| **3. The Commuting Professional / Student** | Nurse, engineer, or applicant practicing 15–20 min/day on transit (**IELTS Ac/GT, PTE, TOEFL, DET**). | Cannot take full 2-hour mocks on transit; switches between phone on commute and desktop laptop at home. | *"Complete my 10-minute Daily Mission and UK/US audio vocabulary waves on my phone, then open my laptop at home with everything synced."* | **\$29.99 / 3-mo** Exam Prep |

---

## 4. Product Scope & Delivered Capabilities (`v4.0`)

### 4.1 All 5 Exam Tracks & 4-Skill Simulators
* **5 Isolated Exam Tracks:** **IELTS Academic**, **IELTS General Training**, **TOEFL iBT (2026)**, **PTE Academic**, and **Duolingo English Test (DET)** with isolated per-track analytics, scale formatting, target-switching resets, and Full Mock stage sequences.
* **Reading Simulator:** Responsive split-pane passage & questions, persistent color highlights & notes, Focused vs. All-Questions UX, evidence scroll-to-quote, 11 deterministic question mechanics, Pro *Ask AI Why?*, and **Study-Mode per-paragraph Listen & Pronunciation Studio controls** (`passage-paragraph-listen-bar`, suppressed in strict Exam Mode).
* **Listening Simulator:** Multi-accent original `.m4a` streaming/caching (`SeaweedFS` / `R2`), Exam single-play linear mode vs. Study variable-speed + interactive transcript, Focused/All navigation, dictation & missing-word support.
* **Writing Simulator:** All 11 task types (`task1Academic`, `task1General`, `task2Essay`, `toeflSentenceBuild`, `toeflEmail`, `toeflAcademicDiscussion`, `pteSummarizeWrittenText` 5–75w single-sentence, `pteEssay` 200–300w, `detWriteAboutPhoto`, `detInteractiveWriting`, `detWritingSample`), live word range counter, zoomable SVG charts (`ExamSvgChartCard`), 500ms crash-safe autosave.
* **Speaking Simulator:** Pre-flight waveform check, multi-turn recording & local playback, timed prep + scratchpad (`>0s` prep / Part 2) and immediate zero-prep capture (TOEFL Interview, DET Interactive Speaking), PTE Describe Image SVG prompts, presigned + `PUT /v1/uploads/signed-put` fallback uploads.

### 4.2 Adaptive Personalization & Step-by-Step Roadmap (*Durnama* / دورنما)
* **Live Band Evolution (`LiveBandEngine`):** Real-time overall and per-skill (`Reading`, `Listening`, `Writing`, `Speaking`) current vs. target band tracking from diagnostic baselines and exponentially weighted attempts, with milestone band-shift celebrations and solid (calibrated) vs. hollow (practice) trajectory nodes on `TrendChart`.
* **Personalized Step-by-Step Curriculum (`RoadmapGenerator` & `RoadmapScreen`):** Interactive multi-node roadmap adapting dynamically after every attempt; displays `PlanImpactCard` on Evaluation Review and Diagnostic Results showing exact score deltas, resolved weaknesses, and a 1-tap launch into the next roadmap step.
* **Topic Weakness Rotation & Progressive Vocabulary Waves:** `ObjectiveWeaknessExtractor` and `TopicWeaknessRotator` prioritize high-error topic domains across 10 academic categories without back-to-back topic fatigue; `VocabWaveScheduler` unlocks progressive band-tier vocabulary waves and injects remedial cards from recent mistakes.

### 4.3 OpenRouter `hexgrad/kokoro-82m` Neural TTS & `google/gemini-3.1-flash-lite` Pronunciation Studio
* **API-Only Neural TTS (`InlineListenButton`):** British (`uk` -> `bf_emma`) and American (`us` -> `af_bella`) synthesis via `POST /v1/tts/synthesize` with SHA-256 S3 audio caching (`GET /v1/tts/audio/:cacheKey`), global accent preference in Settings (`preferredTtsAccent`), and variable playback speed (`0.75x–1.25x`).
* **Interactive Pronunciation & Fluency Studio (`SpeechPracticeDrawer` / `SpeechPracticeSheet`):** Record and evaluate spoken pronunciation of any vocabulary card, model rewrite sentence, or Study-Mode reading paragraph via multimodal `google/gemini-3.1-flash-lite` (`POST /v1/pronunciation/analyze`), displaying overall `0–100` score, band equivalent, IPA phoneme breakdown, word-level color heatmap (`good` / `minor` / `error`), prosody metrics, and coaching tips.
* **Exam Mode Restraint:** Zero TTS, pronunciation coaching, or hint buttons appear during timed Exam Mode sessions.

### 4.4 Closed-Loop Smart Coach Engine (`/coach`)
* **Error DNA Linguistic Graph (`/progress/graph`):** Visualizes recurring grammar, lexical, coherence, and pronunciation fault nodes (`LinguisticNodes`), tracking occurrence counts, severity decay, and **Active Production Verification** (confirming when a learner actively deploys target vocabulary/structures in a new essay or speaking response).
* **10-Minute Daily Mission (`/mission/:missionId`):** Personalized daily 3-step loop combining fault-node warmups, micro-drills, and active production tasks.
* **3-Gear Register Shifter (`/register-shifter`):** Transforms casual sentences across *Gear 1 (Casual)* -> *Gear 2 (Academic)* -> *Gear 3 (Band 8.5+ Executive)* with spoken/written repeat verification.
* **Drop Anything (`/drop`):** Ingests any learner-supplied text/article into an instant 2-minute active vocabulary & structure upgrade drill.

### 4.5 Standalone Desktop Web (`web/`), SEO/GEO Discovery & Full-Stack Tracing
* **0KB-JS SEO & GEO Static Pages:** 85 prerendered pages per edition (`GLB` & `IRN`), 5 exam pillar guides, `<1KB` score calculators, annotated sample banks, public vocabulary decks, `robots.txt`, `llms.txt`, `llms-full.txt`, Markdown `.md` twins, and dynamic SVG/PNG social cards.
* **Cross-Device Sync & Admin Trace Console (`/app/admin/trace`):** Bidirectional sync of attempts, SM-2 vocabulary deck, roadmap state, and pronunciation history across devices, paired with complete server-side logging of every user activity, audio recording stream, AI token count, latency, and exact USD cost (`ai_usage_ledger`, `user_activity_ledger`).

---

## 5. Functional Requirements (`FR-001` .. `FR-064`)

### Onboarding, Hub & Identity (`FR-001` .. `FR-004`)
* **`FR-001` Focused 5-Track Exam Flow (`Onboarding` + `Settings`):** Learners select their active exam track once during streamlined Onboarding (`/app/welcome`) from `IELTS Academic`, `IELTS General Training`, `TOEFL iBT (2026)`, `PTE Academic`, and `Duolingo English Test` using custom `ExamTrackSelector` cards, and can switch tracks later inside Settings (`/app/settings`)—keeping top command bars (calm read-only exam indicator chip), Home, and Practice distraction-free without repeated dropdowns or track-pill clutter.
* **`FR-002` Goal Calibration, Official CEFR Mapping & Exam Date:** Users set track-appropriate targets (`7.5` IELTS, `5.0` TOEFL, `65` PTE, `125` DET) with official exam-specific CEFR tier readouts (`resolveOfficialCefrTier` — e.g., IELTS `6.5` -> `B2`, `7.0–8.0` -> `C1`, `8.5–9.0` -> `C2`), `LtrExamBoundary`-aligned `[-, slider, +]` steppers, daily study minutes (`15–60+ min`), preferred TTS accent (`UK` / `US`), and exam countdown date (Gregorian in `GLB`, Jalali in `IRN`).
* **`FR-003` Non-Affiliation & Provenance Disclosure:** Present explicit independent-practice notice on Onboarding, exam pickers, landing footers, and Settings.
* **`FR-004` Guest-First Launch & Lossless Account Merge:** Immediate anonymous UUID practice with lossless server + local merge (`POST /v1/personalization/merge-guest`) when registering or signing in via Email, Google, Apple, or SMS OTP.

### Free Tier, Quotas & Paywall (`FR-005` .. `FR-008`)
* **`FR-005` Bounded Zero-COGS Starter Access:** Free users receive **1 Rapid 4-Skill Starting-Level Check**, **starter Reading/Listening samples**, **3-min Micro-Drills**, and **20 starter Vocab reviews/day**.
* **`FR-006` Conversion Paywall & Explicit Device Policy Consent:** RevenueCat & Web Checkout plans (`Weekly Cram`, `Monthly Pro`, `Quarterly Prep`) + mandatory acknowledgment of the strict `1 Phone + 1 Desktop Web` device policy (`accepted_device_policy_at`).
* **`FR-007` Instant Entitlement Reactivity:** Purchasing or restoring immediately unlocks all Pro packs, Smart Coach loops, and AI evaluations across linked phone and desktop web sessions.
* **`FR-008` Transparent Daily/Monthly Quota Meter:** Display live AI evaluation balances (`Speaking` / `Writing`) in Settings and protect failed jobs with automatic quota refund.

### 4-Skill Exam & AI Review Engines (`FR-009` .. `FR-037`)
* **`FR-009` .. `FR-014` Speaking Simulator:** Pre-flight RMS mic test, timed prep + notes scratchpad AND immediate zero-prep capture, visual SVG stimulus (`ExamSvgChartCard`), `ExamExitGuard` back confirmation, local audio persistence + presigned/`signed-put` upload & idempotent retry queue.
* **`FR-015` .. `FR-019` Writing Simulator:** All `11` task types across the 5 exam tracks, live word range counter, strict Exam autocorrect lock, 500ms crash-safe autosave, and `00:00` expiry lock.
* **`FR-020` .. `FR-024` AI Evaluation Review & Micro-Drills:** Scale-accurate overall score & criterion breakdowns, TOEFL `0–120` concordance chip, inline coaching edits, personalized model rewrites with **Kokoro-82m Listen & Pronunciation Practice triggers**, timestamped transcripts, baseline comparisons, `PlanImpactCard`, and 1-tap weakest-pillar Micro-Drills.
* **`FR-025` .. `FR-029` Reading Simulator:** Responsive split/tabbed passage + questions, Focus single-question & All-Questions modes, persistent color highlights & margin notes, 11 deterministic question types, offline calibrated scoring, evidence sentence jump, Pro *Ask AI Why?*, and **Study-Mode per-paragraph Listen strip**.
* **`FR-030` .. `FR-033` Listening Simulator:** Lazy CDN/SeaweedFS `.m4a` caching with SHA-256 verification, Exam single-play vs. Study `0.85x–1.25x` playback + synced transcript, MCQ, gap-fill, and `dictation` deterministic scoring.
* **`FR-034` .. `FR-037` Contextual SM-2 Vocabulary Engine:** 1-tap Mistake-to-Deck capture from AI feedback & Reading items, integer `SerialDay` SM-2 scheduler (`Again / Hard / Good / Easy`), `320` seeded exam cards, UK/US Kokoro-82m TTS audio, and interactive pronunciation practice on every card.

### Rapid Starting-Level Check (`FR-038` .. `FR-040`)
* **`FR-038` Zero-Scroll Streamlined Preflight:** Concise intro card (~10–15 min estimate), quick sound/mic test, timing & accessibility options drawer, and instant start/defer controls.
* **`FR-039` 2-Stage Adaptive Assessment:** Adaptive Stage 1 -> upper/lower Stage 2 Reading & Listening routing (`DiagnosticRouter`) plus focused short Writing & Speaking samples calibrated within `900s` (with `Extended 3x` and `Accessible` replayable audio options).
* **`FR-040` Partial Results, Zero-Diagnostic Foundation Mode & Single-Skill Retake:** Diagnostic completion immediately seeds the learner's **Adaptive Roadmap (*Durnama*)** and supports single-skill retake (`/v1/diagnostic/sessions/:diagId/retake-skill`). Learners who defer or skip the placement check immediately unlock an **M1 Foundation Starter Plan** (entry `B1` tier, Wave 1 vocabulary, and starter topic rotation) without fabricating a numeric score.

### Multi-Surface Auth, Device Governance & Ergonomics (`FR-041` .. `FR-046`)
* **`FR-041` .. `FR-044` Auth & Strict `1 Phone + 1 Desktop Web` Governance:** Email/Password, Google, Apple (+ IRN SMS OTP), atomic `mobile` + `desktop_web` session slots (`409 DEVICE_SLOT_OCCUPIED` with 1-tap takeover), Settings active-device viewer & remote revocation, and Paywall ToS consent.
* **`FR-045` .. `FR-046` Ergonomics & OCP Themes:** Focused vs. All-Questions mobile view (`320dp+`) and 4 dynamic Light/Dark color presets (*Midnight Indigo*, *Nordic Emerald*, *Editorial Amber*, *Oceanic Cobalt*) generated from `packages/design-tokens`.

### Standalone Desktop Web & SEO/GEO Discovery (`FR-047` .. `FR-050`)
* **`FR-047` 0KB-JS Static SEO Landing & 5 Exam Pillar Guides:** Prerendered static HTML pages for all 5 exam tracks with JSON-LD structured data and zero client JS bundle overhead.
* **`FR-048` Interactive `<1KB` Calculators & Public Content Banks:** IELTS Band Calculator, TOEFL 6-to-120 Converter, PTE-to-IELTS Concordance, DET Subscore Estimator, annotated Writing/Speaking samples, and public Vocabulary preview decks.
* **`FR-049` Generative Engine Optimization (GEO):** Auto-generated `/robots.txt`, `/llms.txt`, `/llms-full.txt`, Markdown `/*.md` twins, and `/og/*.svg` & `.png` cards.
* **`FR-050` Desktop Split-Pane Simulator Studio (`/app/*`):** Keyboard-driven (`Space` / `1–4` SRS review, dynamic `measureElement` virtualized Vocabulary list, split passage/question panes, waveform studio) offline-capable React 19 SPA with Dexie v4 + `429` cache fallback + OPFS caching, unified `max-w-6xl` container width across all regular views, aligned `h-14` header/sidebar bar with consistent `h-10` chrome controls, persistent `localStorage` animated collapsible rail with shared geometric `<BrandMark />` SVG, and 5-tab mobile bottom navigation (`>= 40px` touch targets).

### Closed-Loop Smart Coach (`FR-051` .. `FR-054`)
* **`FR-051` Error DNA Linguistic Graph:** Persistent fault-node tracking (`LinguisticNodes`) across grammar, vocabulary, coherence, and pronunciation with mastery decay and interest topic tagging.
* **`FR-052` Active Production Verification:** Automatically scans new Writing and Speaking submissions to verify whether the learner actively used due target words and grammatical structures under exam pressure.
* **`FR-053` 10-Minute Daily Mission & Drop Anything:** Daily 3-stage adaptive mission (`/mission/:missionId`) plus user-pasted text-to-drill transformation (`/drop`).
* **`FR-054` 3-Gear Pragmatic Register Shifter:** Interactive sentence upgrading across *Gear 1 (Casual)* -> *Gear 2 (Academic)* -> *Gear 3 (Band 8.5+ Executive)* with spoken/written repeat verification.

### Adaptive Personalization, Roadmap (*Durnama*), Neural TTS, Pronunciation Studio & Tracing (`FR-055` .. `FR-064`)
* **`FR-055` Dynamic Live Band Engine:** Real-time overall and per-skill current vs. target score tracking with exponential recency weighting, calibrated vs. practice differentiation on `TrendChart`, and band-shift notifications.
* **`FR-056` Step-by-Step Personalized Roadmap (*Durnama* / `/roadmap`):** Multi-stage adaptive curriculum with completed, current, and upcoming nodes, skip/pin/complete actions, and automatic re-ordering after every attempt.
* **`FR-057` Post-Attempt `PlanImpactCard`:** Displays band delta, newly unlocked vocabulary waves, resolved fault nodes, and 1-tap navigation to the next recommended roadmap step on Evaluation Review and Diagnostic Results.
* **`FR-058` Topic Weakness Rotator & Progressive Vocabulary Waves:** Rotates weak topic domains across 10 academic categories and unlocks progressive band-tier vocabulary waves (`Wave 1..3+`) with remedial mistake injection.
* **`FR-059` OpenRouter `hexgrad/kokoro-82m` Neural TTS:** Server-synthesized, S3-cached British (`bf_emma`) and American (`af_bella`) TTS audio across Vocabulary, Study-Mode Reading paragraphs, Evaluation Review model rewrites, and Speech Practice sheets, honoring the learner's global `preferredTtsAccent` setting.
* **`FR-060` Multimodal `google/gemini-3.1-flash-lite` Pronunciation Studio:** Records learner speech on any word, sentence, or excerpt and returns `0–100` pronunciation score, band equivalent, IPA phoneme breakdown, word-level color heatmap, prosody feedback, and coaching tips.
* **`FR-061` Strict Exam Mode Restraint:** Suppresses all TTS listen buttons, paragraph listen bars, pronunciation studio triggers, and AI hints during timed Exam Mode sessions.
* **`FR-062` Bidirectional Cross-Device Sync:** Syncs roadmap progress, live band history, exam attempts, SM-2 vocabulary SRS state, and pronunciation practice history across Phone and Desktop Web (`/v1/personalization/*`, `/v1/sync/*`).
* **`FR-063` End-to-End Server-Side User, Recording, Token & USD Cost Ledger:** Records every user activity event, audio object key, AI model call, prompt/completion/audio tokens, latency, and exact USD cost in PostgreSQL (`ai_usage_ledger`, `user_activity_ledger`).
* **`FR-064` Admin Usage, Cost & Recording Trace Console (`/app/admin/trace`):** Allows authorized operators (`x-admin-api-key`) to inspect aggregate and per-user AI costs, token breakdowns by feature and model, activity timelines, and stream user Speaking/Pronunciation recordings directly in the browser.

---

## 6. Exam Domain Reference Matrix (All 5 Live Tracks)

| Exam Track | Scale & Step | Target Default | Objective Calibration | Key Reading & Listening Mechanics | Writing Tasks | Speaking Format & Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IELTS Academic** (`ielts_academic`) | `0.0–9.0` Band (`0.5`) | `7.5` | `40` Qs (raw conversion table) | `TFNG`, `YNNG`, `MCQ`, `Matching Headings`, `Gap Fill` (`UK/US` variants) | `task1Academic` (SVG chart, ≥150w, 20m) + `task2Essay` (≥250w, 40m) | Parts 1–3 (`1m` prep / `2m` turn in Part 2); `FC`, `LR`, `GRA`, `PR` |
| **IELTS General** (`ielts_general`) | `0.0–9.0` Band (`0.5`) | `7.0` | `40` Qs (GT conversion table) | Everyday & workplace texts + `TFNG`, `Matching`, `Gap Fill` | `task1General` (letter, ≥150w) + `task2Essay` (≥250w) | Parts 1–3; `FC`, `LR`, `GRA`, `PR` |
| **TOEFL iBT (2026)** (`toefl_ibt`) | `1.0–6.0` Band (`0.5`) + `0–120` bridge | `5.0` (`~100/120`) | `>= 4` Qs (scaled accuracy) | `word_completion` (*Complete the Words*), *Read in Daily Life*, *Academic Passage*, *Listen & Choose Response*, campus talks | `toeflSentenceBuild`, `toeflEmail`, `toeflAcademicDiscussion` | *Listen & Repeat* + zero-prep *Take an Interview*; `DEL`, `LANG`, `TOP` (Writing: `DEV`, `ORG`, `LANG`) |
| **PTE Academic** (`pte_academic`) | `10–90` Score (`1`-pt int) | `65` | `>= 4` Qs (scaled accuracy) | R&W Blanks, `reorder_sequence` (*Re-order Paragraphs*), *MCQ Multi*, *Highlight Summary*, *Gap-Fill*, *Missing Word*, `dictation` (*Write from Dictation*) | `pteSummarizeWrittenText` (`5–75w` single sentence) + `pteEssay` (`200–300w`) | *Read Aloud*, *Repeat Sentence*, *Describe Image* (SVG chart + `25s` prep), *Respond to a Situation*, *Retell Lecture*; `CONT`, `FORM`, `GRAM`, `VOC`, `FLU`, `PRON` |
| **Duolingo (DET)** (`det`) | `10–160` Score (`5`-pt int) + 4 Subscores | `125` | `>= 4` Qs (scaled accuracy) | `binary_choice` (*Read & Select* REAL/NOT REAL), `word_completion` (*Read & Complete*), *Interactive Reading*, `dictation` (*Listen & Type*), *Interactive Listening* | `detWriteAboutPhoto` (`det_photo_scene.svg`), `detInteractiveWriting`, `detWritingSample` | Zero-prep *Interactive Speaking*, *Read Then Speak*, *Speaking Sample*; `LIT`, `COMP`, `CONV`, `PROD` subscores |

> **Mandatory Legal Disclaimer:** *"Mockza provides independent AI-simulated practice and original test-format materials for educational use. Mockza is not affiliated with, endorsed by, or an official preparation product of British Council, IDP IELTS, Cambridge University Press, Pearson (PTE), ETS (TOEFL), or Duolingo."*

---

## 7. Non-Functional Requirements (`NFR-001` .. `NFR-015`)

* **`NFR-001` Cold-Start & Zero-Flash Paint:** Desktop Web renders static HTML immediately with external `/theme-boot.js` pre-paint theme application; Flutter loads SQLite WAL/FK pragmas & theme presets pre-paint without splash blockage.
* **`NFR-002` Grading & TTS Latency:** Offline deterministic Reading/Listening/Micro-Drills score instantaneously (`< 100ms`); cached Kokoro-82m TTS streams in `< 150ms`; async Writing/Speaking evaluations settle via idempotent `202 Accepted` queue + worker fencing.
* **`NFR-003` Rendering Fluidity & Pixel Audits:** Zero horizontal overflow verified across `320dp` phones, `390px` mobile Web, tablets, `1440px` desktop viewports, and `2.0x` text scale (`docs/ui_ux_audit_screenshots/after_fix/`).
* **`NFR-004` Offline & Crash Resilience:** Offline packs, 500ms Writing autosave, disk-first Speaking/Pronunciation clips, durable `OutboxSyncQueue`, and automatic worker quota refund on exhausted upstream failures.
* **`NFR-005` API, CSP, Key & Device Security:** Zero upstream AI/OAuth secrets in clients; strict CSP without `unsafe-inline`; DOMPurify SVG sanitization; Bearer JWTs, `X-Edition`, `X-Device-Id`, strict 1-phone + 1-desktop-web enforcement, and 60 req/min per-account TTS burst rate limiting.
* **`NFR-006` Privacy & Cascading Erasure:** Explicit pre-mic & AI disclosures; automated 30-day audio TTL purge; 1-tap **"Delete All My Data & Audio"** (`DELETE /v1/account`) cascading cleanly across all 41 PostgreSQL tables and S3 objects.
* **`NFR-007` .. `NFR-009` Accessibility & BiDi RTL/LTR Isolation:** WCAG AA contrast across all 4 color presets in Light & Dark modes, keyboard accessibility, and strict `EdgeInsetsDirectional` / logical CSS properties + `LtrExamBoundary` (`check_all.sh` verified).
* **`NFR-010` Low-RAM Build & Test Discipline (`AGENTS.md`):** All builds and tests operate safely on `<= 8 GiB` hosts with mandatory `free -m >= 900 MiB` pre-flight checks, sequential execution, capped VM heaps, and Brotli/Gzip static bundle budgets (`scripts/check_web_budget.mjs`).
* **`NFR-011` .. `NFR-015` Cross-Codebase Parity & Observability Accuracy:** `349` fixture vectors (`373` parity test assertions each across TypeScript & Flutter/Dart) and `36` Web Vitest files (`231` tests) pass; `ai_usage_ledger` records 100% of AI calls with exact token counts and USD cost calculations.

---

## 8. Monetization, Pricing & Unit-Economics Safeguards

| Tier / SKU | Store / Web Price | Net Payout *(15% Small Business / Stripe)* | Access Included | Fair-Use / Anti-Sharing Guardrail |
| :--- | :--- | :--- | :--- | :--- |
| **Free Starter** | \$0.00 | \$0.00 | **1 Rapid ~10–15 Min 4-Skill Starting-Level Check** + Personalized Roadmap preview + starter Reading/Listening/Drill samples + **20 Vocab cards/day** | Device-attested 1-time starter check; starter Reading/Listening/Vocab score offline at `$0` AI burn |
| **Weekly Cram Pass** | **\$5.99 / week** | ~**\$5.09 / week** | All 5 exam tracks unlocked (full Reading & Listening banks, Adaptive Roadmap, Smart Coach, Kokoro TTS, Pronunciation Studio, AI Speaking & Writing) | **10 Speaking + 10 Writing/day** cap; 60 req/min TTS cap; strict **`1 Phone + 1 Desktop Web`** ToS consent required |
| **Monthly Pro** *(Hero)* | **\$14.99 / month** | ~**\$12.74 / month** | Full 5-track library + Adaptive Roadmap + Smart Coach + Pronunciation Studio + Ask AI Why + unlimited SM-2 Vocabulary across phone & web | **10 Speaking + 10 Writing/day** (`150/mo` ceiling); `1 Phone + 1 Desktop Web` |
| **Quarterly Prep** | **\$29.99 / 3 months** | ~**\$25.49 / 3 months** | Full 90-day multi-exam access (33% savings vs monthly) | Same daily fair-use & 1+1 device limits |
