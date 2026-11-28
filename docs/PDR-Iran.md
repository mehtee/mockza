# Sanjia (Iran Edition) — Product Design & Requirements (PDR-Iran v4.0)

> **Executive Thesis:** **`Sanjia` (`سنجیا` — Iran Domestic Edition `IRN`, `1.0.0+20001.irn`)** is a Persian-first, offline-capable **5-Track High-Stakes English Exam Simulator, Closed-Loop Smart Coach & Adaptive Personalization Platform** tailored specifically for Iranian applicants preparing for **IELTS Academic & General Training**, **TOEFL iBT (2026 & `TPO`/`NEO` formats)**, **PTE Academic**, and the **Duolingo English Test (DET)**. Engineered as a **strictly isolated build flavor & domestic deployment stack** (`:45282` Web / `:45283` API) across both **Flutter (`app/lib/main_iran.dart`)** and **Standalone Astro 5 + React 19 Desktop Web (`web/dist-irn`)**, it supports **Zarinpal / Cafe Bazaar / Myket integer-Rial billing**, **SMS OTP cross-device sync**, **Persian RTL outer UI (`Vazirmatn`) with `LtrExamBoundary` English stimulus isolation**, **Jalali (`شمسی`) exam countdowns**, **Adaptive Step-by-Step Roadmaps (*دورنما*)**, **OpenRouter `hexgrad/kokoro-82m` UK/US Neural TTS**, **Multimodal `google/gemini-3.1-flash-lite` Pronunciation Coaching**, and a built-in cross-funnel with **`Navia` (`ناویا`)** for BS/MS/PhD admissions.

---

## 1. Document Control & Edition Identity

| Field | Specification |
| :--- | :--- |
| **Brand Name** | **`Sanjia` (`سنجیا`)** *(Paired natively with sister admissions platform `Navia` / `ناویا`: «از سنجیا به ناویا»)* |
| **Edition & Versioning Code** | **Iran Domestic Edition (`IRN`)** — Canonical Version `1.0.0+20001.irn` *(Catalog Prefix: `IRN-*`; isolated from Global `GLB-*` in [PDR.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR.md))* |
| **Release Status** | **`v4.0` (Verified `2026-11-28`) — Live & Verified Across Backend (`sanjia-api`, `sanjia-worker`), Standalone Desktop Web (`sanjia-web` `dist-irn`, 85 Static Persian SEO/GEO Pages + RTL React 19 SPA), and Flutter (`main_iran.dart` Mobile & Web `sanjia.mehtea.ir`) with 100% Feature Parity with Global `Mockza`** |
| **Primary Interface Language** | **Persian (`fa-IR`, RTL)** navigation, **Durnama (`دورنما`)** roadmap, Smart Coach, AI rubric explanations & Jalali dates + **Strict LTR (`en`)** exam stimulus isolation (`LtrExamBoundary`) |
| **Target Channels** | **Android:** Cafe Bazaar (`کافه‌بازار`), Myket (`مایکت`), Direct APK (`ir.sanjia.app`); **iOS & Desktop:** Standalone Astro 5 + React 19 Web/PWA (`app.sanjia.ir` / `:45282`) |
| **Supported Exam Tracks (5 Live)** | **IELTS Academic** (`0.0–9.0`), **IELTS General Training** (`0.0–9.0`), **TOEFL iBT 2026 / NEO / TPO** (`1.0–6.0` + `0–120` concordance), **PTE Academic** (`10–90`), **Duolingo English Test (`DET`)** (`10–160` + 4 subscores) |
| **Payment Methods** | Domestic Iranian Rial/Toman via **Zarinpal Web Checkout** (`POST /v1/billing/zarinpal/*`), **Cafe Bazaar Poolakey** (`POST /v1/billing/bazaar/verify`), and **Myket IAB** (`POST /v1/billing/myket/verify`) |
| **Network Posture** | **Zero-VPN Domestic Access** via Iranian edge relay, server-cached OpenRouter `hexgrad/kokoro-82m` TTS audio, and domestic S3/SeaweedFS media storage |

---

## 2. Canonical Multi-Edition Versioning & Parity Contract (`GLB` vs. `IRN`)

| Layer | International Clean-Room (`Mockza`) | Iran Domestic (`Sanjia` / `سنجیا`) | Enforcement & Verification |
| :--- | :--- | :--- | :--- |
| **Edition Code (`EDITION`)** | **`glb`** (`GLB`) | **`irn`** (`IRN`) | Compile-time constant (`main_global.dart` vs `main_iran.dart`; `PUBLIC_EDITION=glb|irn`) |
| **App Package / Domain** | `com.mockza.app` (`:45280` / `:45281`) | `ir.sanjia.app` / `sanjia.ir` (`:45282` / `:45283`) | Disjoint bundles verified by `scripts/check_all.sh` isolation greps |
| **Canonical Full Version String** | **`1.0.0+10001.glb`** | **`1.0.0+20001.irn`** | Shown in Settings & sent in `X-App-Version` + `X-Edition` API headers |
| **AI Rubric & Coaching Output** | English feedback & coaching | **Bilingual Persian commentary (`overallSummaryFa`, `whyFa`, `meaningFa`) + English model rewrites** | Implemented in `packages/ai/src/prompts/persian-overlay.ts` |
| **Feature Parity** | Full `v4.0` feature set | **100% identical `v4.0` feature set** (5 Exam Tracks, Adaptive Roadmap *دورنما*, Smart Coach, Kokoro-82m TTS, Pronunciation Studio, Cross-Device Sync, Admin Trace Console) | Verified by Playwright `web_e2e_irn_and_seo.spec.ts`, `advanced_closed_loop_irn.spec.ts`, `adaptive_personalization_irn.spec.ts`, and Flutter `sanjia_irn_e2e_test.dart` |

---

## 3. Competitive Landscape & `Sanjia` Moat (Iran Domestic)

| Competitor | Observed Focus & Strengths | Gaps Exploited by `Sanjia` (`v4.0`) |
| :--- | :--- | :--- |
| **`Testinno` (`تستینو`)** | Strong desktop TPO/IELTS brand in Iran, analytics, Leitner box | Lacks **Adaptive Step-by-Step Roadmap (`دورنما`)**, **Closed-Loop Error DNA Graph with Active Production Verification**, **3-Gear Register Shifter**, **Kokoro-82m UK/US Neural TTS**, **Multimodal Word-by-Word Pronunciation Studio**, and **`Navia` admissions integration** |
| **`TestHelper` (`تست‌هلپر`)** | Deep TOEFL (`TPO` + Academic Discussion), IELTS, PTE, DET, *Tik8* vocab | Fragmented web-heavy UI; lacks unified mobile-first + desktop studio sync, instant Persian + English AI rewrites, and Drop Anything 2-min drill generator |
| **`MockYar` / Telegram Channels** | Free/cheap PDFs & static simulators | Zero AI Speaking/Writing diagnosis, zero pronunciation coaching, zero adaptive roadmap or Leitner SM-2 sync |

---

## 4. Delivered Functional Requirements (`IRN-FR-001` .. `IRN-FR-018`)

In addition to all 64 core requirements (`FR-001`..`FR-064`) in [PDR.md](file:///home/mahdi/projects/ideas/mockza/docs/PDR.md), the live Iran Edition delivers:

### 4.1 Persian-First BiDi UX, Jalali Calendar & Domestic Auth/Billing (`IRN-FR-001` .. `IRN-FR-008`)
* **`IRN-FR-001` Persian RTL Chrome, Unified Shell & `LtrExamBoundary` Isolation:** All navigation chrome (aligned `h-14` topbar/sidebar bar with persistent collapsible rail, unified calligraphic «س» `<BrandMark />` / `SanjiaMark` emblem across Web & Flutter, `max-w-6xl` unified container, 5-tab mobile bottom nav, and Settings-only exam switching on both clients), **Durnama (`دورنما`)** roadmap cards, Saturday-first weekly strips (`ش..ج`), Smart Coach hubs, official exam-specific CEFR badges (`6.5` -> `فوق‌متوسط B2`), RTL-directional `ScoreMeter` bars, `همنشینی‌ها` collocations, and AI explanations render in crisp Persian (`RTL`, `Vazirmatn` without uppercase/letter-spacing or monospace distortion and with BiDi arrows), while all English passages, question stems, essays, worked diagnostic examples, `[-, slider, +]` numeric steppers, signed score deltas (`+۰.۰`), pronunciation transcripts, timers, and band scores render inside `LtrExamBoundary` (`dir="ltr"`).
* **`IRN-FR-002` Jalali (`شمسی`) Exam Calendar:** Onboarding and Settings display a Jalali date picker (`jalali_formatter.dart` / `jalali.ts`) while storing canonical integer `SerialDay` values.
* **`IRN-FR-003` Bilingual Persian AI Coaching:** Writing, Speaking, Smart Coach, and Pronunciation Studio evaluations return natural Persian explanations (`overallSummaryFa`, `whyFa`, `meaningFa`, Persian pronunciation tips) alongside high-scoring English model rewrites.
* **`IRN-FR-004` Persian-Glossed Mistake-to-Deck SM-2 Flashcards:** Saved vocabulary cards display Persian meanings (`meaningFa`), synonyms, example sentences, UK/US Kokoro-82m audio (`InlineListenButton`), and 1-tap Pronunciation Studio recording.
* **`IRN-FR-005` Iranian SMS OTP Cross-Device Auth:** Phone number OTP login (`/v1/auth/otp/request` & `/verify`, dynamically gated on live `/v1/auth/providers` capabilities) linking mobile and desktop web sessions under the strict **`1 Phone + 1 Desktop Web`** slot policy with lossless guest merge.
* **`IRN-FR-006` Integer-Rial Billing (`Zarinpal`, `Cafe Bazaar`, `Myket`):** All prices are stored and verified in integer Rials (`amountRial`) and displayed in formatted Persian Tomans (`تومان`), with server-side `/v1/billing/zarinpal/verify` callback validation.
* **`IRN-FR-007` `Navia` (`ناویا`) Admissions Score Handoff:** Progress screen includes a 1-tap **Export to Navia** CTA (`POST /v1/account/navia-handoff`) generating a signed JWT deep link carrying the learner's verified mock score trajectory into `Navia`.
* **`IRN-FR-008` Persian 0KB-JS SEO & GEO Discovery Layer (`web/dist-irn`):** 85 static Persian landing, exam guide, calculator, sample bank, vocabulary, and GEO (`llms.txt`, `.md`) pages optimized for Iranian search queries.

### 4.2 Persian Adaptive Roadmap (*دورنما*), Smart Coach, Kokoro TTS, Pronunciation Studio & Tracing (`IRN-FR-009` .. `IRN-FR-018`)
* **`IRN-FR-009` Adaptive Step-by-Step Roadmap (`دورنما` — `/roadmap` & `/app/roadmap`) & Zero-Diagnostic Starter Tier:** Real-time overall and per-skill live band tracking (`LiveBandEngine`), personalized multi-stage roadmap nodes in natural ascending `stepOrder`, consistent `۱۰ دقیقه‌ای` diagnostic duration copy, post-attempt Persian `PlanImpactCard` (`کارت اثرگذاری بر دورنما`), immediate M1 Foundation Starter unlock (`مسیر پایه`) when placement check is deferred (`currentBand == null`), and `429`/offline Dexie cache resilience with natural Persian copy (localized `stage.*` worker codes and sanitized download/network errors — zero leaked English error prose or internal infra tags).
* **`IRN-FR-010` Topic Weakness Rotation & Vocabulary Waves:** Automatic rotation of weak academic topics across 10 domains and progressive unlocking of band-tier vocabulary waves (`VocabWaveScheduler`).
* **`IRN-FR-011` OpenRouter `hexgrad/kokoro-82m` Neural TTS with Accent Propagation:** Global British (`لهجه بریتانیایی` -> `bf_emma`) and American (`لهجه آمریکایی` -> `af_bella`) voice selector in Settings, propagating across all `InlineListenButton` controls, Vocabulary cards, Study-Mode Reading paragraph listen strips (`passage-paragraph-listen-bar`), and Evaluation Review model rewrites.
* **`IRN-FR-012` Multimodal `google/gemini-3.1-flash-lite` Pronunciation Studio:** Interactive voice recording and phoneme/word-level pronunciation grading (`SpeechPracticeSheet` / `SpeechPracticeDrawer`) with Persian coaching feedback and Exam Mode Restraint.
* **`IRN-FR-013` .. `IRN-FR-016` Closed-Loop Smart Coach (`/coach`):** Error DNA Linguistic Graph (`/progress/graph`), Active Production Verification, 10-Minute Daily Mission (`/mission/:missionId`), 3-Gear Register Shifter (`/register-shifter`), and Drop Anything (`/drop`) fully localized in Persian.
* **`IRN-FR-017` .. `IRN-FR-018` Cross-Device Sync & Admin Trace Console (`/app/admin/trace`):** Full synchronization of attempts, SM-2 cards, roadmap state, and pronunciation recordings across devices, plus complete server-side tracking of user activities, audio recordings, token consumption, and USD costs in `ai_usage_ledger` and `user_activity_ledger`.

---

## 5. Toman Monetization Matrix & FX-Safe Economics

| Plan (`طرح اشتراک`) | Suggested Toman Tier *(Indexed Monthly to USD)* | Target Persona | Payment Channel | AI Fair-Use Cap |
| :--- | :--- | :--- | :--- | :--- |
| **رایگان (`Free Starter`)** | **0 تومان** | All new installs | Instant start | **1 Rapid 4-Skill Starting-Level Check** + **Durnama Roadmap preview** + **starter Reading/Listening** + **20 Vocab/day** |
| **فشرده هفتگی (`Cram 7-Day`)** | **~149,000 – 199,000 تومان / هفته** | Urgent Crammers (`۱۰ روز مانده به آزمون`) | Zarinpal / Bazaar / Myket | **8 Speaking + 8 Writing AI evals/day**; 60 req/min TTS cap; full Roadmap, Smart Coach & Pronunciation Studio unlocked |
| **حرفه‌ای ماهانه (`Monthly Pro`)** | **~349,000 – 490,000 تومان / ماه** | Main retakers & *Navia* applicants | Zarinpal (~1–2% PSP fee) / Bazaar | **8 Speaking + 8 Writing AI evals/day** (`120/mo` max AI ceiling); `1 Phone + 1 Desktop Web` |
| **پکیج ۳ ماهه اپلای (`Apply Quarterly`)** | **~790,000 – 1,090,000 تومان / ۳ ماه** | BS/MS/PhD cohort + *Navia* bundle promo | Zarinpal Web Checkout | Full 5-track access + **Navia Bundle Discount Code** |
