# Mockza — Product Design & Requirements (PDR v3.0)

> **Executive Thesis:** Mockza is a consolidated, offline-first, AI-native **5-Track High-Stakes English Exam Simulator Hub** (`Listening`, `Reading`, `Writing`, `Speaking` + `Micro-Drills` + `Contextual Exam Vocabulary`) covering **IELTS Academic**, **IELTS General Training**, **TOEFL iBT (2026 Format)**, **PTE Academic (Latest)**, and **Duolingo English Test (DET Latest)**. Built mobile-first in Flutter for iOS, Android, and responsive Web (with a strict **`1 Phone + 1 Desktop Web`** multi-surface subscription policy), it pairs **100% clean-room blueprint-calibrated Reading/Listening mocks & Mistake-to-Deck Spaced Repetition** (`$0` marginal AI cost) with **AI-graded Speaking & Writing rubric evaluation** (`$0.002–$0.045/eval`) — targeting **\$350–\$1,000/month net** as App #1 toward a **\$1,000+/month** indie portfolio.

---

## 1. Document Control & Product Identity

| Field | Specification |
| :--- | :--- |
| **Product Name** | `Mockza` *(verified low-collision 6-char brand preserving ASO keyword budget)* |
| **Edition & Versioning Code** | **Global Edition (`GLB`)** — Canonical Version `1.0.0+10001.glb` *(Catalog Prefix: `GLB-*`; separated from Iran Domestic Edition `IRN` in [docs/PDR-Iran.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR-Iran.md))* |
| **Release Status** | **`v3.0` — Live Multi-Exam Core Implementation (`IELTS Ac/GT`, `TOEFL iBT 2026`, `PTE Academic`, `DET` implemented across Backend, AI Evaluators, DB & Flutter App + E2E Verified)** |
| **Supported Exam Tracks (5 Live)** | **IELTS Academic** (`0.0–9.0`), **IELTS General Training** (`0.0–9.0`), **TOEFL iBT 2026** (`1.0–6.0` + `0–120` concordance), **PTE Academic** (`10–90`), **Duolingo English Test / DET** (`10–160` + 4 integrated subscores) |
| **Primary App Store Title** | `Mockza: IELTS, PTE, TOEFL Prep` *(30 / 30 chars max)* |
| **iOS Subtitle (Default)** | `AI English Speaking & Writing` *(29 / 30 chars max; `listening`, `reading`, `vocabulary` targeted in Keywords)* |
| **Multi-Surface Access Policy** | Strict **`1 Mobile Phone + 1 Desktop Web`** concurrent active session policy per subscription (standalone non-Flutter Desktop Web client planned to share backend slots) |
| **Content IP Posture** | **100% Clean-Room Original / Commercial-Permissive Content** *(verified across 36 seeded exam bundles, 7 drills & 320 vocab cards; official books never copied)* |
| **Target Unit Economics** | `>= 80%` blended gross margin per active subscriber after 15% store fee and AI inference COGS |

---

## 2. Stakeholder Q&A Matrix

| # | Stakeholder Question | Verified Answer & Current Strategy |
| :--- | :--- | :--- |
| **Q1** | **Why will learners pay Mockza \$5.99–\$14.99/mo over ChatGPT Voice or free PDFs?** | Generic chatbots lack authentic multi-part timers, exam-specific task sequences (e.g., TOEFL *Build a Sentence*/*Academic Discussion*, PTE *Re-order Paragraphs*/*Summarize Written Text*, DET *Write About Photo*), calibrated rubric bounds (`1.0–6.0`, `10–90`, `10–160`, `0.0–9.0`), and Reading/Listening sync. Users pay for **authentic 4-skill exam simulation + criterion-level AI rewrites + instant Mistake-to-Deck flashcards in one mobile-ergonomic flow**. |
| **Q2** | **Why ship iOS first, then Android, plus Desktop Web parity?** | iOS drives ~75–77% of consumer subscription launches with lower involuntary churn; Google Play requires **12 testers × 14 consecutive days** closed testing for newer personal accounts. Shipping our Flutter Web SPA first validates live flows while preparing for iOS/Play submission and a future dedicated non-Flutter Desktop Web client sharing our strict **`1 Phone + 1 Desktop Web`** account policy. |
| **Q3** | **Why house IELTS Ac/GT, TOEFL iBT (2026), PTE, and DET in one app (`Mockza`)?** | **Apple App Store Guideline 4.3 (Spam)** rejects cloned apps. A schema-driven polymorphic hub consolidates ratings/ASO, isolates each track's score scale cleanly (preventing score leakage across Home & Progress), and multiplies addressable global test-takers in one codebase. |
| **Q4** | **Why invest in Reading, Listening, Micro-Drills, and Vocab alongside AI Speaking/Writing?** | All-4-skill coverage removes the *"half an app"* review objection, keeps blended AI COGS low (objective sections & SM-2 score offline for `$0`), and drives daily commute D7/D30 retention when learners cannot speak aloud. |
| **Q5** | **How do we source exam content legally without DMCA/account risk?** | **Zero Cambridge, British Council, ETS, Pearson, or Duolingo texts/MP3s enter Mockza.** Official blueprints inform structure only; every bundle ships with `contentOrigin` provenance tags (`mockza_original_v1`, `public_domain`, `cc_by_4_attributed`), verified evidence spans, and `.m4a` + `.svg` media generated cleanly (`content-pipeline`). |
| **Q6** | **How do we hook undecided visitors quickly without burning AI quota on free riders?** | Two streamlined entry paths: a **Rapid ~10–15 Min 4-Skill Starting-Level Check** (zero-scroll intro/mic check + 2-stage adaptive Reading/Listening + short Writing/Speaking + Extended/Accessible timing options) AND bounded offline sample packs + 20 starter vocab cards/day — turning curiosity into a concrete diagnostic baseline before presenting the Pro paywall. |
| **Q7** | **How do we prevent subscription/account sharing across friends or groups?** | Every authenticated account (`Email/Password`, `Google`, `Apple`) enforces an atomic backend limit of **`1 Mobile Phone` + `1 Desktop Web`** concurrent active session. New log-ins on an occupied slot must terminate or sign out the prior device, with full visibility (device name, platform, location/masked IP) and remote termination inside Settings, explicitly consented to on Paywall checkout. |
| **Q8** | **How do we prevent AI inference bills from eroding subscription margin?** | Offline Reading/Listening/Vocab absorb >50% of engagement; single-pass `google/gemini-3.1-flash-lite` Speaking audio and `deepseek/deepseek-v4.1-flash-1017` Writing keep inference low (`$0.002–$0.045/eval`); server enforces atomic quota reservation (`10 Speaking + 10 Writing/day`, `150/mo`), automatic failure refunds, and no Lifetime unlimited tier. |
| **Q9** | **How do we prevent Apple/Google trademark rejections?** | Never use `"Official"` in store metadata or UI; omit `"Duolingo"` from the 30-char App Title (`Mockza: IELTS, PTE, TOEFL Prep`); show an explicit non-affiliation disclaimer on Onboarding, exam switching, and Settings. |
| **Q10** | **Won't users churn after passing their exam in 4–8 weeks?** | Exam prep has natural graduation churn. Pricing matches prep timelines with **\$5.99/wk Cram Pass**, **\$14.99/mo Pro**, and **\$29.99/3-mo Prep** so unit payback completes immediately in Week 1. |

---

## 3. Target Market, Personas & Jobs-to-Be-Done

| Persona | Profile & Exam Track | Core Pain / Anxiety | Job-to-Be-Done (JTBD) | Preferred Plan |
| :--- | :--- | :--- | :--- | :--- |
| **1. The Deadline Crammer** | Candidate with **IELTS, TOEFL iBT, PTE, or DET** booked in **7–21 days**. | Needs realistic timed practice & instant AI scoring at midnight on phone and laptop without paying \$60/hr tutors. | *"Run a realistic ~15-min baseline check tonight, drill my lowest rubric criterion across phone and desktop, and see where I stand."* | **\$5.99 / week** Cram Pass |
| **2. The Plateau Retaker** | Stuck just below target (e.g., **6.0 IELTS**, **4.5 TOEFL**, **58 PTE**, or **110 DET** Writing/Speaking). | Repeats identical lexical/grammar mistakes across expensive retakes (\$215–\$280 official fee). | *"Highlight every line costing me score points, give me a target rewrite, and turn missed words into daily SM-2 flashcards."* | **\$14.99 / mo** Pro or **\$29.99 / 3-mo** |
| **3. The Commuting Professional / Student** | Nurse, engineer, or applicant practicing 15–20 min/day on transit (**IELTS Ac/GT, PTE, TOEFL, DET**). | Cannot record aloud on transit; hates endless mobile scrolling and cramped timers. | *"Switch cleanly to single-question Focused mode for Listening/Reading/Vocab on my commute, then submit Writing/Speaking at home."* | **\$29.99 / 3-mo** Exam Prep |

### Explicit Non-Personas (Out of Scope)
* Casual hobbyist language learners seeking gamified travel phrases.
* Homework cheating / auto-essay generation seekers.
* Public social feeds, peer chat, or live human-tutor marketplaces.

---

## 4. Competitive Landscape & Positioning

| Alternative | Strengths | Gaps Exploited by Mockza |
| :--- | :--- | :--- |
| **Official Prep Portals** (*IELTS Ready*, *DET*, *ETS*) | Authoritative formats | Clunky mobile UI, scarce line-by-line essay/speech rewrites, zero integrated Mistake-to-Deck SM-2 flashcards |
| **Multi-Exam Leaders** (*Pocket Prep*, *Zutobi*) | Single-hub subscription packaging | Focused on static MCQs; lack multimodal `.m4a` Speaking evaluation, visual SVG Writing/Speaking prompts, & adaptive multi-track scoring |
| **Recycled PDF / Clone Sites** | High static volume | Copyright/DMCA risk, stale memorized exams, broken audio links, zero AI rubric feedback |
| **Generic Chatbots** (*ChatGPT Voice*) | Open-ended conversation | No exam timers, no TOEFL 2026 / PTE / DET task structures, no 11-type offline objective engine, no SRS Vocab deck |

---

## 5. Goals, North-Star Metrics & Stage Gates

### 5.1 Business & Portfolio Goals
1. **Store Launch Execution:** Finalize live OAuth (`Google`, `Apple`) & RevenueCat production store keys, launch **iOS App Store** (`v1.0+`) alongside **Google Play 12×14 closed test**, and ship standalone **Desktop Web**.
2. **Day-30 Validation:** **`>= $150/mo` net MRR**, **`>= 80%` blended gross margin**, crash-free sessions **`>= 99.5%`**, zero IP complaints.
3. **Day-90 Target:** **`$350–$1,000/mo` net MRR** (~30–80 active subscribers across Cram/Monthly/Quarterly tiers).

### 5.2 North-Star & Core KPI Summary
* **Product North-Star:** **Multi-Skill Weekly Engagement — `>= 4` scored sessions across `>= 2` skills per active paid user/week**.
* **Commercial North-Star:** **Gross-Margin-Adjusted Net MRR** (`Store Payout - AI COGS - Media Egress`).
* **Diagnostic Conversion Benchmark:** Starting-Check completion **`>= 55%` (D30) / `>= 65%` (D90)**; Install-to-Paid **`>= 4.0%` (D30) / `>= 6.0%` (D90)**; Blended AI COGS **`<= $1.00/paid user/mo`**.

---

## 6. Product Scope, Current State & Roadmap

### Delivered & Verified in Current Version (`v3.0`)
* **All 5 Exam Tracks Live:** Full support across **IELTS Academic**, **IELTS General Training**, **TOEFL iBT (2026)**, **PTE Academic**, and **Duolingo English Test (DET)** with isolated per-track analytics, scale formatting, target-switching resets, and Full Mock stage sequences.
* **All 4 Simulators + Micro-Drills + Vocabulary + Full Mock:**
  * *Reading:* Split/tabbed passage & questions, persistent color highlights & notes, Focused vs. All-Questions UX, evidence scroll-to-quote, 11 deterministic question mechanics.
  * *Listening:* Multi-accent original `.m4a` streaming/caching (`SeaweedFS` / `R2`), Exam linear vs. Study variable-speed + interactive transcript, Focused/All navigation, dictation & missing-word support.
  * *Writing:* 11 task types (`task1Academic`, `task1General`, `task2Essay`, `toeflSentenceBuild`, `toeflEmail`, `toeflAcademicDiscussion`, `pteSummarizeWrittenText` 5–75w single-sentence, `pteEssay` 200–300w, `detWriteAboutPhoto`, `detInteractiveWriting`, `detWritingSample`), live word range counter, zoomable SVG charts (`ExamSvgChartCard`), 500ms Drift autosave.
  * *Speaking:* Pre-flight waveform check, multi-turn recording & local playback, timed prep + scratchpad (`>0s` prep / Part 2) and immediate zero-prep capture (TOEFL Interview, DET Interactive Speaking), PTE Describe Image SVG prompts, queued `.m4a` uploads.
  * *Contextual SM-2 Vocabulary & Micro-Drills:* 1-tap capture from Reading & AI reviews, `320` curated cards, `7` 3-minute drills across tracks.
* **Rapid ~10–15 Min 4-Skill Starting-Level Check:** Compact zero-scroll intro/mic check, 2-stage adaptive Reading/Listening, short Writing/Speaking samples, *Standard / Extended (3×) / Accessible* modes, and single-skill retake.
* **Multi-Surface Auth & Strict `1 Phone + 1 Desktop Web` Device Governance:** Email/Password + Google + Apple (live OIDC ready + `ALLOW_DEV_AUTH_PROVIDERS=true` dev sandbox), Settings active-device viewer & remote revocation, and Paywall ToS consent.
* **SOLID & Accessible UX Overhaul:** 4 Open-Closed Light/Dark color presets (*Midnight Indigo*, *Nordic Emerald*, *Editorial Amber*, *Oceanic Cobalt*) and `320dp`-safe responsive layout verified by 7 full E2E journeys.

### Next Launch & Post-v3.0 Operational Milestones (`v3.1+`)
1. Inject production `APPLE_CLIENT_ID`, `GOOGLE_CLIENT_ID`, `OPENROUTER_API_KEY`, `LANGFUSE_*`, and RevenueCat Store keys (`APP_ATTEST_ENFORCED=true`, `ALLOW_DEV_AUTH_PROVIDERS=false`).
2. Ship dedicated standalone non-Flutter **Desktop Web Portal** connecting to the existing `desktop_web` session slot & OpenAPI `/v1/*` backend.
3. Hardware verification checklist (real iOS/Android mic, background audio focus, live StoreKit/Play IAP round-trip) -> iOS App Store + Google Play 12×14 launch.
4. Expand monthly clean-room OTA packs (+8 packs/mo), native-language AI explanations, and phoneme-level PTE/speaking pronunciation diagnostics.

---

## 7. Functional Requirements (`FR-001` .. `FR-046`)

### Onboarding, Hub & Identity (`FR-001` .. `FR-004`)
* **`FR-001` Consolidated 5-Track Hub:** Learners choose and switch seamlessly between `IELTS Academic`, `IELTS General Training`, `TOEFL iBT (2026)`, `PTE Academic`, and `Duolingo English Test` via Onboarding, Home header switcher, Practice Hub filter, and Settings — preserving independent targets and metrics per scale.
* **`FR-002` Goal & Exam Date Calibration:** Users set track-appropriate targets (e.g., `7.5` IELTS, `5.0` TOEFL, `65` PTE, `125` DET) and optional exam countdown date; switching tracks resets incompatible targets via `nextTargetWhenSwitchingFrom`.
* **`FR-003` Non-Affiliation & Provenance Disclosure:** Present explicit independent-practice notice on Onboarding, exam pickers, and Settings.
* **`FR-004` Guest-First Launch & Seamless Account Upgrade:** Immediate anonymous UUID practice with lossless merge when registering or signing in via Email, Google, or Apple.

### Free Tier, Quotas & Paywall (`FR-005` .. `FR-008`)
* **`FR-005` Bounded Zero-COGS Starter Access:** Free users receive **1 Rapid 4-Skill Starting-Level Check**, **starter Reading/Listening samples**, **3-min Micro-Drills**, and **20 starter Vocab reviews/day**.
* **`FR-006` Conversion Paywall & Explicit Device Policy Consent:** RevenueCat plans (`Weekly Cram`, `Monthly Pro`, `Quarterly Prep`) + explicit acknowledgment of the strict `1 Phone + 1 Desktop Web` device policy before upgrading (`accepted_device_policy_at`).
* **`FR-007` Instant Entitlement Reactivity:** Purchasing or restoring immediately unlocks all Pro packs and syncs entitlements across linked devices.
* **`FR-008` Transparent Daily/Monthly Quota Meter:** Display live AI evaluation balances (`Speaking` / `Writing`) in Settings and protect failed jobs with automatic quota refund.

### 4-Skill Exam & AI Review Engines (`FR-009` .. `FR-037`)
* **`FR-009` .. `FR-014` Speaking Simulator:** Pre-flight RMS mic test, timed prep + notes scratchpad (e.g., IELTS Part 2, PTE Describe Image/Retell Lecture) AND immediate zero-prep capture (TOEFL Interview, DET Interactive Speaking), visual SVG stimulus (`ExamSvgChartCard`), `ExamExitGuard` back confirmation, local `.m4a` persistence + idempotent retry queue.
* **`FR-015` .. `FR-019` Writing Simulator:** Supports all `11` task types across the 5 exam tracks (including single-sentence PTE Summaries `5–75w`, PTE Essay `200–300w`, TOEFL 3-task tabs, DET Photo SVG), live word range counter, strict Exam autocorrect lock, 500ms Crash-safe Drift autosave, and `00:00` expiry lock.
* **`FR-020` .. `FR-024` AI Evaluation Review & Micro-Drills:** Scale-accurate overall score & criterion breakdowns (`TR`/`TA`/`CC`/`LR`/`GRA`/`FC`/`PR` + `DEV`/`ORG`/`LANG`/`DEL`/`TOP`/`CONT`/`FORM`/`GRAM`/`VOC`/`FLU`/`PRON`/`LIT`/`COMP`/`CONV`/`PROD`), TOEFL `0–120` concordance chip, inline coaching edits, personalized model rewrites, timestamped transcripts, baseline comparisons (same-track isolated), and 1-tap weakest-pillar Micro-Drills.
* **`FR-025` .. `FR-029` Reading Simulator:** Responsive split/tabbed passage + questions, Focus single-question & All-Questions modes, persistent color highlights & margin notes, 11 deterministic question types (`tfng`, `ynng`, `mcq_single`, `mcq_multi`, `matching_headings`, `gap_fill`, `short_answer`, `word_completion`, `binary_choice`, `reorder_sequence`), offline calibrated scoring (`40` IELTS / `>= 4` multi-exam), evidence sentence jump, and Pro *Ask AI Why?*.
* **`FR-030` .. `FR-033` Listening Simulator:** Lazy CDN/SeaweedFS `.m4a` caching with SHA-256 verification, Exam single-play vs. Study `0.85x–1.25x` playback + synced transcript, MCQ, gap-fill, and `dictation` (*Write from Dictation* / *Listen and Type*) deterministic scoring.
* **`FR-034` .. `FR-037` Contextual SM-2 Vocabulary Engine:** 1-tap Mistake-to-Deck capture from AI feedback & Reading items, integer `SerialDay` SM-2 scheduler (`Again / Hard / Good / Easy`), and `320` seeded exam cards across academic & paraphrase topics.

### Rapid Starting-Level Check (`FR-038` .. `FR-040`)
* **`FR-038` Zero-Scroll Streamlined Preflight:** Concise intro card (~10–15 min estimate), quick sound/mic test, timing & accessibility options drawer, and instant start/defer controls.
* **`FR-039` 2-Stage Adaptive Assessment:** Adaptive Stage 1 -> upper/lower Stage 2 Reading & Listening routing (`DiagnosticRouter`) plus focused short Writing & Speaking samples calibrated cleanly within `900s` (with `Extended 3x` and `Accessible` replayable audio options).
* **`FR-040` Partial Results & Single-Skill Retake:** Users can skip Speaking in quiet environments or retake an individual diagnostic skill (`/v1/diagnostic/sessions/:diagId/retake-skill`) without repeating the entire check.

### Multi-Surface Auth & Device Governance (`FR-041` .. `FR-044`)
* **`FR-041` Multi-Provider Authentication:** Email/Password registration & sign-in, Sign in with Google, and Sign in with Apple (`/v1/auth/*` + `ALLOW_DEV_AUTH_PROVIDERS` sandbox for pre-production testing).
* **`FR-042` Strict `1 Phone + 1 Desktop Web` Concurrent Session Limit:** Enforce at most 1 active `mobile` session and 1 active `desktop_web` session per user account (`409 DEVICE_SLOT_OCCUPIED` on collision).
* **`FR-043` Active Devices & Session Termination Panel:** Settings displays active phone and desktop web sessions with device name, platform, last active time, and masked IP/location, letting learners sign out of another device or revoke all other sessions in 1 tap.
* **`FR-044` Subscription ToS Enforcement:** Require explicit consent to the single-phone + single-desktop-web policy during subscription/upgrade and display it clearly in account/device management.

### Mobile-First Ergonomics & Theme Personalization (`FR-045` .. `FR-046`)
* **`FR-045` Focused vs. All-Questions Mobile Ergonomics:** Compact header badges, collapsible prompts, 44dp question jump pills, and one-question-at-a-time *Focused* mode eliminating repetitive vertical scrolling on small screens (`320dp+`).
* **`FR-046` Dynamic Light/Dark Color Presets (OCP):** Settings allows live switching between *Midnight Indigo*, *Nordic Emerald*, *Editorial Amber*, and *Oceanic Cobalt* in Light or Dark mode with zero app restart.

---

## 8. Exam Domain Reference Matrix (All 5 Live Tracks)

### 8.1 Supported Exam Tracks & Scoring Specifications

| Exam Track | Scale & Step | Target Default | Objective Calibration | Key Reading & Listening Mechanics | Writing Tasks | Speaking Format & Criteria |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **IELTS Academic** (`ielts_academic`) | `0.0–9.0` Band (`0.5`) | `7.5` | `40` Qs (raw conversion table) | `TFNG`, `YNNG`, `MCQ`, `Matching Headings`, `Gap Fill` (`UK/US` variants) | `task1Academic` (SVG chart, ≥150w, 20m) + `task2Essay` (≥250w, 40m) | Parts 1–3 (`1m` prep / `2m` turn in Part 2); `FC`, `LR`, `GRA`, `PR` |
| **IELTS General** (`ielts_general`) | `0.0–9.0` Band (`0.5`) | `7.0` | `40` Qs (GT conversion table) | Everyday & workplace texts + `TFNG`, `Matching`, `Gap Fill` | `task1General` (letter, ≥150w) + `task2Essay` (≥250w) | Parts 1–3; `FC`, `LR`, `GRA`, `PR` |
| **TOEFL iBT (2026)** (`toefl_ibt`) | `1.0–6.0` Band (`0.5`) + `0–120` bridge | `5.0` (`~100/120`) | `>= 4` Qs (scaled accuracy) | `word_completion` (*Complete the Words*), *Read in Daily Life*, *Academic Passage*, *Listen & Choose Response*, campus talks | `toeflSentenceBuild`, `toeflEmail`, `toeflAcademicDiscussion` | *Listen & Repeat* + zero-prep *Take an Interview*; `DEL`, `LANG`, `TOP` (Writing: `DEV`, `ORG`, `LANG`) |
| **PTE Academic** (`pte_academic`) | `10–90` Score (`1`-pt int) | `65` | `>= 4` Qs (scaled accuracy) | R&W Blanks, `reorder_sequence` (*Re-order Paragraphs*), *MCQ Multi*, *Highlight Summary*, *Gap-Fill*, *Missing Word*, `dictation` (*Write from Dictation*) | `pteSummarizeWrittenText` (`5–75w` single sentence) + `pteEssay` (`200–300w`) | *Read Aloud*, *Repeat Sentence*, *Describe Image* (SVG chart + `25s` prep), *Respond to a Situation*, *Retell Lecture*; `CONT`, `FORM`, `GRAM`, `VOC`, `FLU`, `PRON` |
| **Duolingo (DET)** (`det`) | `10–160` Score (`5`-pt int) + 4 Subscores | `125` | `>= 4` Qs (scaled accuracy) | `binary_choice` (*Read & Select* REAL/NOT REAL), `word_completion` (*Read & Complete*), *Interactive Reading*, `dictation` (*Listen & Type*), *Interactive Listening* | `detWriteAboutPhoto` (`det_photo_scene.svg`), `detInteractiveWriting`, `detWritingSample` | Zero-prep *Interactive Speaking*, *Read Then Speak*, *Speaking Sample*; `LIT`, `COMP`, `CONV`, `PROD` subscores |

> **Mandatory Legal Disclaimer:** *"Mockza provides independent AI-simulated practice and original test-format materials for educational use. Mockza is not affiliated with, endorsed by, or an official preparation product of British Council, IDP IELTS, Cambridge University Press, Pearson (PTE), ETS (TOEFL), or Duolingo."*

### 8.2 Clean-Room Content Provenance Policy
* Zero scraped or copyrighted official tests/audio.
* Every shipped seed pack (`36` packs: `32` catalog + `4` diagnostic), `7` micro-drills, and `320` vocab cards passes `backend/content-pipeline` checks verifying `contentOrigin`, `humanQaReviewed: true`, verified evidence spans for `TFNG`/`YNNG`, and `.m4a` SHA-256 digests.

---

## 9. Non-Functional Requirements (`NFR-001` .. `NFR-012`)

* **`NFR-001` Cold-Start Performance:** First usable UI frame renders cleanly; SQLite WAL/FK pragmas & theme presets load pre-paint without splash blockage.
* **`NFR-002` Grading Latency:** Offline deterministic Reading/Listening/Micro-Drills score instantaneously (`< 100ms`); async Writing/Speaking evaluations settle via idempotent `202 Accepted` queue + worker fencing.
* **`NFR-003` Rendering Fluidity:** Smooth scrolling inside highlighted Reading passages, editors, and waveforms; **zero overflow verified across `320dp` phones, `360dp`/`390dp` handsets, tablets, and `2.0x` text scale**.
* **`NFR-004` Offline & Crash Resilience:** Offline packs, 500ms Writing autosave, disk-first Speaking clips, durable `OutboxSyncQueue`, and automatic worker quota refund on exhausted upstream failures.
* **`NFR-005` API, Key & Device Security:** Zero upstream AI/OAuth secrets in clients; Bearer JWTs, `X-Edition`, `X-Device-Id`, strict 1-phone + 1-desktop-web enforcement, HMAC webhooks.
* **`NFR-006` Privacy & Erasure:** Explicit pre-mic & AI disclosures; automated 30-day `.m4a` TTL purge; 1-tap **"Delete All My Data & Audio"** (`DELETE /v1/account` + durable `erasure_requests` recovery).
* **`NFR-007` Store Privacy Declarations:** Maintain accurate `PrivacyInfo.xcprivacy` and Play Data Safety declarations matching live auth/AI/billing SDKs.
* **`NFR-008` Accessibility:** Semantics labels on timers/waveforms/sequence controls, 44dp touch targets, WCAG AA contrast across all 4 color presets in Light & Dark modes.
* **`NFR-009` RTL & Localization Readiness:** Strict `EdgeInsetsDirectional` / `AlignmentDirectional` across all feature modules (`check_all.sh` verified).
* **`NFR-010` Low-RAM Web & Compact App Size:** Release Flutter Web SPA compiled with `-O1 --no-wasm-dry-run` (~`1.35 MB` gzipped `main.dart.js`); native media streamed/cached lazily from CDN/SeaweedFS rather than bloating mobile binaries.
* **`NFR-011` Content Provenance Integrity:** Automated pre-publish validation ensuring `contentOrigin`, evidence spans, and media checksums across all 36 packs.
* **`NFR-012` Vocabulary Schedule Accuracy:** SM-2 `dueDaySerial` uses local integer `SerialDay` math immune to DST/timezone drift.

---

## 10. Monetization, Pricing & Unit-Economics Safeguards

| Tier / SKU | Store Price | Net Payout *(15% Small Business Fee)* | Access Included | Fair-Use / Anti-Sharing Guardrail |
| :--- | :--- | :--- | :--- | :--- |
| **Free Starter** | \$0.00 | \$0.00 | **1 Rapid ~10–15 Min 4-Skill Starting-Level Check** + starter Reading/Listening/Drill samples + **20 Vocab cards/day** | Device-attested 1-time starter check; starter Reading/Listening/Vocab score offline at `$0` AI burn |
| **Weekly Cram Pass** | **\$5.99 / week** | ~**\$5.09 / week** | All 5 exam tracks unlocked (full Reading & Listening banks, unlimited Mistake-to-Deck SM-2, AI Speaking & Writing + rewrites) | **10 Speaking + 10 Writing/day** cap; strict **`1 Phone + 1 Desktop Web`** ToS consent required |
| **Monthly Pro** *(Hero)* | **\$14.99 / month** | ~**\$12.74 / month** | Full 5-track library + OTA packs + Ask AI Why + unlimited SM-2 Vocabulary across phone & web | **10 Speaking + 10 Writing/day** (`150/mo` ceiling); `1 Phone + 1 Desktop Web` |
| **Quarterly Prep** | **\$29.99 / 3 months** | ~**\$25.49 / 3 months** | Full 90-day multi-exam access (33% savings vs monthly) | Same daily fair-use & 1+1 device limits |

---

## 11. ASO, Store Compliance & Launch Operations

* **Apple Title (`30 / 30`):** `Mockza: IELTS, PTE, TOEFL Prep`
* **Apple Subtitle (`29 / 30`):** `AI English Speaking & Writing`
* **Apple Keywords (`93 / 100`):** `exam,simulator,reading,listening,vocabulary,band,score,rubric,essay,fluency,academic,practice`
* **Pre-Launch Operational Checklist:**
  * [ ] Inject production `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID`, `OPENROUTER_API_KEY`, `LANGFUSE_*`, and RevenueCat keys (set `ALLOW_DEV_AUTH_PROVIDERS=false` in prod).
  * [ ] Enroll in Apple Small Business Program (15%), complete `PrivacyInfo.xcprivacy` + Play Data Safety + `DELETE /v1/account` + ToS device-limit copy review.
  * [ ] Attach v1.0 IAP SKUs on initial Apple App Review (**Guideline 2.1(b)**) and run Google Play **12 testers × 14 days** closed testing alongside hardware verification ([HARDWARE_VERIFICATION_CHECKLIST.md](file:///home/mahdi/projects/ideas/mockza/docs/HARDWARE_VERIFICATION_CHECKLIST.md)).

---

## 12. Risk Register & Mitigation Matrix

| Risk | Likelihood | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| **Account Sharing via Shared Credentials** | High | High | Atomic DB enforcement of **1 Mobile + 1 Desktop Web** concurrent slot (`409 DEVICE_SLOT_OCCUPIED`), Settings remote termination, mandatory Paywall policy consent. |
| **Copyright / DMCA Strike on Exam Packs** | Near-Zero *(clean-room)* | Critical | Strictly original passages/scripts/SVGs + `content-pipeline` provenance/SHA-256 verification before publish. |
| **Apple Guideline 4.3 or Trademark Rejection** | Medium | High | Consolidated 5-track single hub, brand-first title, zero `"Official"`/`"Duolingo"` in App Title, explicit disclaimer. |
| **Cross-Scale Score Pollution (`125` DET vs `7.5` IELTS)** | High *(without isolation)* | High | `ExamTrack`-keyed metric filtering across Home, Progress & Compare Attempts + shared `nextTargetWhenSwitchingFrom` reset rule. |
| **Low-RAM (`<= 8 GiB`) OOM on Flutter Web Compiles** | High *(without flags)* | Medium | `--no-wasm-dry-run -O1` single compiler pass, sequential `Makefile` builds, `<= 5 GiB` `scripts/dev_local.sh` hybrid stack & `serve_web_static.mjs`. |
| **AI Inference Cost Spike** | Low–Medium | Critical | Offline objective scoring across Reading/Listening/Drills/Vocab + atomic quota reservation & refund ledger (`10+10/day`, `150/mo`). |
