# Sanjia (`IRN` / سنجیا) — Flutter App Complete Architecture & Implementation Plan (`sanjia_flutter_plan.md`)

> **Document Purpose:** Complete engineering audit, Architecture Decision Extensions, and step-by-step implementation blueprint to bring the **Sanjia (`IRN` — `1.0.0+20001.irn`)** Persian-first **Flutter** application (Android APK for Cafe Bazaar / Myket / Direct + Responsive Flutter Web / iOS Safari PWA) to full production parity with [PDR-Iran.md](./PDR-Iran.md), [ADR-Iran.md](./ADR-Iran.md), and our live Web (`web/` `PUBLIC_EDITION=irn`) & Backend (`EDITION=irn`) implementations.
>
> **Audit Baseline:** Repository `main` (`b2f3f0d`) | Flutter `3.47.9` (`app/`, Drift `schemaVersion: 5`) | Reference Implementations: [web/src/edition/](../web/src/edition/), [web/src/i18n/fa.ts](../web/src/i18n/fa.ts), [backend/apps/api/src/routes/auth.ts](../backend/apps/api/src/routes/auth.ts), [backend/apps/api/src/routes/billing.ts](../backend/apps/api/src/routes/billing.ts), [backend/packages/ai/src/prompts/rubrics.ts](../backend/packages/ai/src/prompts/rubrics.ts)

---

## Table of Contents

1. [Baseline Audit: What Already Exists vs. What Is Missing](#1-baseline-audit-what-already-exists-vs-what-is-missing)
2. [Architecture Decisions for Sanjia Flutter (`ADR-SF-001` – `ADR-SF-008`)](#2-architecture-decisions-for-sanjia-flutter-adr-sf-001--adr-sf-008)
3. [Technical Specifications by Layer](#3-technical-specifications-by-layer)
   - [3.1 Native Flavors, Bundle IDs, PWA Manifest & Zero-VPN Assets](#31-native-flavors-bundle-ids-pwa-manifest--zero-vpn-assets)
   - [3.2 Full Persian `l10n` (`app_fa.arb` + `BrandIdentity`) & Screen Extraction](#32-full-persian-l10n-app_faarb--brandidentity--screen-extraction)
   - [3.3 BiDi Engine (`LtrExamBoundary`) & Edge Persian Numerals / Currency](#33-bidi-engine-ltrexamboundary--edge-persian-numerals--currency)
   - [3.4 Edge-Only Jalali (`شمسی`) Formatter & Picker](#34-edge-only-jalali-شمسی-formatter--picker)
   - [3.5 `+98` SMS OTP Authentication & Session Slot Parity](#35-98-sms-otp-authentication--session-slot-parity)
   - [3.6 Iran Billing Adapters (Zarinpal + Cafe Bazaar + Myket) & Backend Endpoints](#36-iran-billing-adapters-zarinpal--cafe-bazaar--myket--backend-endpoints)
   - [3.7 Bilingual AI Coaching, `VocabCards.glossFa` & `Navia` Cross-App Handoff](#37-bilingual-ai-coaching-vocabcardsglossfa--navia-cross-app-handoff)
4. [Phased Implementation Roadmap (`Phase SF0` – `Phase SF6`)](#4-phased-implementation-roadmap-phase-sf0--phase-sf6)
5. [Automated Verification, Zero-VPN, Isolation & Store Release Gates](#5-automated-verification-zero-vpn-isolation--store-release-gates)

---

## 1. Baseline Audit: What Already Exists vs. What Is Missing

An audit of `app/`, `backend/`, and `web/` confirms that **`backend/` (`EDITION=irn`) and `web/` (`PUBLIC_EDITION=irn`) already have complete Sanjia support**, whereas **Flutter (`app/`) currently has only foundational scaffolding**.

| Layer / Capability | Current Observed State in Repo | Concrete Gap in Flutter (`app/`) & Fixes Needed |
| :--- | :--- | :--- |
| **Flavor Entrypoint & Theme Hook** | `app/lib/main_iran.dart` passes `EditionConfig.iranDefault`. `app/lib/app.dart` checks `persian = edition == AppEdition.iran`, sets `Locale('fa')`, and passes `persian: true` to `AppTheme.build` (`Vazirmatn` font). | Only switches font and outer locale; lacks edition-aware branding (`سنجیا` vs `موکزا`), BiDi exam islands, Jalali dates, OTP auth, and live Iran billing. |
| **Android & iOS Packaging** | `app/android/app/build.gradle.kts` sets `iran` flavor with `applicationIdSuffix = ".ir"` on `com.mockza.mockza` -> **`com.mockza.mockza.ir`**. `AndroidManifest.xml` hardcodes `android:label="Mockza"`. `ios/Runner/Info.plist` hardcodes `Mockza` and IELTS English mic copy. | Fix Android `iran` `applicationId` to canonical **`ir.sanjia.app`** (`ADR-Iran.md`), add `manifestPlaceholders["appLabel"]` (`سنجیا`), add Zarinpal App Link / custom scheme (`sanjia://billing/callback`), isolate `iran` icons/splash in `src/iran/`, and configure iOS scheme / Info.plist variants if Enterprise/AdHoc distributed. |
| **Flutter Web / iOS PWA (`app/web/`)** | `app/web/index.html` and `app/web/manifest.json` hardcode `"Mockza — IELTS AI Prep"`, `lang="en"`, English description, and `#0C0F19` theme color (`Editorial Green` not yet reflected in manifest). CanvasKit runtime loads fonts/WASM from `fonts.gstatic.com` / `gstatic.com` by default unless overridden. | Support an `iran` Web template (`lang="fa"`, `dir="rtl"`, title `سنجیا`, Persian PWA manifest) AND host CanvasKit/fonts locally inside the built bundle (`canvasKitBaseUrl: "/canvaskit/"`, `0` external `gstatic.com` calls) to satisfy **Zero-VPN** (`PDR-Iran` Q3 & `ADR-IRN-005`). Also fix missing `COPY assets ./assets` in `app/Containerfile`! |
| **`l10n` ARB Strings** | `app/lib/l10n/app_fa.arb` has only `55` lines (`"appTitle": "موکزا"`). Only ~4 presentation files (`home`, `onboarding`, `evaluation_review`, `app_scaffold_shell`) reference `AppLocalizations`; `auth`, `paywall`, `settings`, `diagnostic`, `practice_hub`, `vocabulary`, `progress`, `reading_sim`, `listening_sim`, `writing_sim`, `speaking_sim`, and `micro_drills` still contain hardcoded English strings. `web/src/i18n/fa.ts` (`628` lines) already contains the complete Persian copy glossary. | Extract **all** UI literals across all 15 feature modules, shared widgets, and core enums into `app_en.arb` + `app_fa.arb` (reusing verified phrasing from `web/src/i18n/fa.ts`), regenerate `app_localizations*.dart` (`flutter gen-l10n`), and enforce a brand helper (`BrandIdentity`) returning `Sanjia` / `سنجیا` in `AppEdition.iran`. |
| **BiDi Isolation (`LtrExamBoundary`)** | `0` occurrences of `LtrExamBoundary` in `app/lib/`. Web already has [web/src/edition/bidi/LtrExamBoundary.tsx](../web/src/edition/bidi/LtrExamBoundary.tsx) and [numerals.ts](../web/src/edition/bidi/numerals.ts). `check_all.sh` Gate 9 enforces `EdgeInsetsDirectional` / `AlignmentDirectional`. | Without `LtrExamBoundary`, setting `Locale('fa')` (`Directionality.rtl`) breaks English Reading passages, `?`/`.` punctuation, MCQ letters, `Writing` text-editor carets, SVG chart labels, `MM:SS` timers, and band scores (`7.5`). Implement **`LtrExamBoundary`** + **`EdgeNumeralsFormatter`** across every exam stimulus & review panel. |
| **Jalali (`شمسی`) Dates** | `0` occurrences of `jalali` or `shamsi` in `app/lib/` and `app/pubspec.yaml`. Web already has [web/src/edition/calendar/jalali-edge.ts](../web/src/edition/calendar/jalali-edge.ts). | Add `shamsi_date` to `pubspec.yaml`, build pure edge `JalaliEdgeFormatter` + **`MzJalaliDatePickerSheet`** while keeping all SQLite Drift columns & SM-2 math strictly canonical UTC integer `SerialDay`. |
| **SMS OTP Auth (`+98`)** | **Backend ready:** `POST /v1/auth/otp/request`, `POST /v1/auth/otp/verify`, `GET /v1/auth/providers` (`smsOtp`). **Flutter missing:** `AuthProviderType` in `auth_models.dart` lacks `smsOtp`; `AuthSessionService` lacks OTP methods; `AuthScreen` renders Google & Apple OAuth buttons for both editions. | Add `AuthProviderType.smsOtp`, wire `requestSmsOtp` / `verifySmsOtp` into `AuthSessionService`, and update `AuthScreen` to show **`+98` SMS OTP** + Email/Password in `AppEdition.iran` while hiding Google/Apple OAuth buttons. |
| **Iran Billing (`Zarinpal` / `Bazaar` / `Myket`)** | **Backend:** `/v1/billing/zarinpal/{request,verify}` are live in `billing.ts`; `CAFEBAZAAR_SECRET`, `MYKET_SECRET`, and `BillingSourceSchema` enums (`'bazaar'`, `'myket'`) exist in config/contracts/db, **but `/v1/billing/bazaar/verify` & `/v1/billing/myket/verify` API routes are not yet registered in `billing.ts`**. **Flutter:** `IranBillingGateway` returns Toman package strings and hardcoded `Ok(false)` / `ValidationFailure` errors; `PaywallScreen` blocks all purchases when `kIsWeb` is true! | Enable `ZarinpalBillingGateway` on both Flutter Web/PWA (`kIsWeb`) and Direct APK builds (`url_launcher` + `app_links` deep-link `/billing/callback` verification), add quarantined `BazaarBillingGateway` (Poolakey) & `MyketBillingGateway` Android adapters selected via compile-time channel, and register `/v1/billing/{bazaar,myket}/verify` on backend. |
| **Bilingual AI & `VocabCards.glossFa`** | **Backend ready:** `rubrics.ts` populates Persian examiner prose & `vocabUpgrades[].glossFa` (`schemas.ts` line 479) when `edition === 'irn'`. **Flutter missing:** `0` references to `glossFa` in `core/models/`, `core_tables.dart`, `grading_gateway.dart`, or `vocabulary/`. | Add `glossFa` to `VocabUpgrade`, Drift `VocabCards` (schema bump), `HttpGradingGateway`, `ContentSyncService`, `VocabRepository`, Flashcard Review, and Evaluation Review (`RTL` Persian notes beside `LtrExamBoundary` English excerpts/rewrites). |
| **`Navia` Ecosystem Handoff** | Live in `web/src/i18n/fa.ts` (`https://navia.ir`). Absent in `app/lib/features/progress/`. | Add `AppEdition.iran`-gated `NaviaHandoffCard` inside `ProgressScreen` + `EvaluationReviewScreen` linking target readiness cleanly via `url_launcher`. |
| **CI & Tests for `IRN`** | `app/test/` only has `1` RTL `Locale('fa')` semantics test (`accessibility_and_layout_test.dart`). `.github/workflows/release.yml` validates `.irn` tags (with doc comment `+10001.irn`). | Add comprehensive `app/test/iran/` unit/widget tests + **`app/test/e2e/sanjia_irn_e2e_test.dart`**, update CI to check `lib/main_iran.dart`, enforce `+20001+` build numbers for `irn`, and audit Web/APK isolation. |

---

## 2. Architecture Decisions for Sanjia Flutter (`ADR-SF-001` – `ADR-SF-008`)

### `ADR-SF-001`: Canonical Package Identity, Native Isolation & Asset Bundling
* **Decision:**
  * Update `app/android/app/build.gradle.kts` so `iran` uses **`applicationId = "ir.sanjia.app"`** directly (removing the conflicting `applicationIdSuffix = ".ir"` which produced `com.mockza.mockza.ir`), while `global` retains `com.mockza.app` (clean aligned ID).
  * Define Android `manifestPlaceholders["appLabel"]`: `"Mockza"` for `global`, `"سنجیا"` (`Sanjia`) for `iran`.
  * Store flavor-specific Android launcher icons, adaptive foregrounds, and `MainActivity` deep-link intent filters inside `app/android/app/src/global/` vs `app/android/app/src/iran/`.
  * Use disjoint release build numbers (`10001+` for `glb`, `20001+` for `irn` per `ADR-Iran.md`).
  * Ensure **RevenueCat (`Purchases.configure`)** is never called when `edition == AppEdition.iran`, and Bazaar Poolakey / Myket Android SDK dependencies in `build.gradle.kts` are scoped strictly to `iranImplementation` dependencies so **zero Iranian store SDK code ever compiles into `global` `.aab`/`.apk` binaries**.

### `ADR-SF-002`: Zero-VPN Flutter Web / iOS PWA Sovereignty (`app/web/` + `app/Containerfile`)
* **Context:** Because official Apple App Store does not support Shetab/Zarinpal billing (`PDR-Iran.md` Sec. 4 Q2), Iranian iOS users install **Sanjia Web/PWA (`app.sanjia.ir`)**. Currently, Flutter Web's default CanvasKit loader requests `gstatic.com/flutter-canvaskit/...` and Google Roboto fonts from `fonts.gstatic.com` — both unreliable or blocked without VPN inside Iran.
* **Decision:**
  * Add `COPY assets ./assets` to `app/Containerfile` (`source` stage) so bundled `Inter.ttf`, `Vazirmatn.ttf`, and `InstrumentSerif.ttf` ship in Docker builds.
  * For `MOCKZA_EDITION=iran` Web builds:
    1. Swap in `app/web/index.iran.html` (`<html lang="fa" dir="rtl">`, title `سنجیا — شبیه‌ساز هوشمند آزمون زبان`, `<link rel="manifest" href="manifest.iran.json">`, explicit `flutter_bootstrap.js` configuration using self-hosted `canvasKitBaseUrl: "/canvaskit/"`).
    2. Pre-bundle CanvasKit `.wasm`/`.js` assets locally inside `/canvaskit/` during Web packaging (and provide a local fallback font override so CanvasKit never fires outbound network requests to `fonts.gstatic.com` or `fonts.googleapis.com`).
    3. Verify via headless Chromium network trace (`check_web_budget` / `check_all.sh`) that `app.sanjia.ir` Flutter Web makes **zero requests** outside its configured origin (`app.sanjia.ir` / `api.sanjia.ir` / domestic S3).

### `ADR-SF-003`: Complete `ARB` Localization + Edition-Aware `BrandIdentity`
* **Decision:**
  * Extract every visible string across all `15` feature folders, `theme/components/*`, and core domain enum formatters into `app/lib/l10n/app_en.arb` and `app/lib/l10n/app_fa.arb` (`synthetic-package: false` or generated `AppLocalizations` already configured via `app/l10n.yaml`), reusing approved terminology from [web/src/i18n/fa.ts](../web/src/i18n/fa.ts).
  * Separate UI **locale** from **distribution brand**: add `BrandIdentity` (`name`: `'Mockza'` vs `'سنجیا'`, `shortMark`: `'M'` vs `'س'`, `supportDomain`: `'mockza.com'` vs `'sanjia.ir'`, `disclaimerText`) resolved from `EditionConfig.edition` (`global` vs `iran`) + `AppLocalizations`. This guarantees `main_iran.dart` consistently displays **سنجیا** across Onboarding, Paywall, Auth, About, and Share messages without modifying `global` branding.
  * Refactor core UI label helpers (such as `AuthProviderType.displayLabel`, `DeviceSlotKind.displayLabel`, `WritingTaskType.fullTitle` UI wrappers) so localized labels resolve in UI/Presentation helpers via `AppLocalizations` rather than hardcoded English strings in `core/`.

### `ADR-SF-004`: Mandatory `LtrExamBoundary` & Asymmetric Numeral Discipline
* **Decision:** Mirror [web/src/edition/bidi/LtrExamBoundary.tsx](../web/src/edition/bidi/LtrExamBoundary.tsx) and [numerals.ts](../web/src/edition/bidi/numerals.ts) identically in Flutter:
  * Create `app/lib/theme/components/ltr_exam_boundary.dart`:
    * Wraps `Directionality(textDirection: TextDirection.ltr)` + `Localizations.override(context: context, locale: const Locale('en', 'US'))` (fixing Android/iOS text selection toolbar & cursor arrow orientation inside English essay editors!) + `DefaultTextStyle.merge(style: TextStyle(fontFamily: AppTypography.sansFamily, fontFeatures: [FontFeature.tabularFigures()]))`.
  * Create `app/lib/core/formatting/edge_numerals.dart` (pure Dart, `0` Flutter imports):
    * `toPersianDigits(String)` / `toAsciiDigits(String)`
    * `formatChromeNumber(numOrString, AppEdition)` (Persian `۰–۹` for streaks, due card counts, day counters, Toman prices in `iran`)
    * `formatTomanFromRial(int amountRial)` -> e.g. `۳۹۰,۰۰۰ تومان`
  * **Hard Invariant:** **All** exam stimuli, passages, questions, sequence-order pills, word-completion boxes, essays, speaking cue cards, countdown timers (`19:45`), audio timestamps (`01:12`), SVG charts, IELTS/TOEFL/PTE/DET numerical scores (`7.5`, `115/160`), and English vocabulary headwords/examples sit inside `LtrExamBoundary` with **Western ASCII digits** (`FontFeature.tabularFigures()`).

### `ADR-SF-005`: Edge-Only Jalali (`شمسی`) Presentation (`shamsi_date`)
* **Decision:**
  * Storage (`Drift`, `Postgres`, `SM-2`, `CountdownClockTracker`) remains strictly canonical **UTC integer `SerialDay` and UTC epoch milliseconds** (`ADR-006`, `ADR-IRN-002`).
  * Add pure Dart `JalaliEdgeFormatter` in `app/lib/core/formatting/jalali_edge_formatter.dart` wrapping `shamsi_date`:
    * `serialDayToJalaliYmd(int serialDay)` & `jalaliYmdToSerialDay(int jy, int jm, int jd)` (explicit validation for leap-year `Esfand 29/30`, exact parity with `web/src/edition/calendar/jalali-edge.ts`).
    * `formatDisplayDate(int utcMs, AppEdition)` & `formatSerialDay(int serialDay, AppEdition)` outputting `۱۴۰۵/۰۹/۲۵` in `AppEdition.iran`.
  * Create `MzJalaliDatePickerSheet` under `app/lib/theme/components/` so Onboarding Goal Setup and Settings Exam Date open a responsive, `320dp`-safe Jalali wheel/grid date picker whenever `edition == AppEdition.iran`.

### `ADR-SF-006`: `+98` SMS OTP Auth & Disabled Foreign OAuth in `IRN`
* **Decision:**
  * Add `AuthProviderType.smsOtp` (`'sms_otp'`) to `app/lib/core/auth/auth_models.dart` and add `SmsOtpProviderDescriptor` parsed from existing `GET /v1/auth/providers`.
  * Extend `AuthSessionService` (`app/lib/services/auth_session_service.dart`) with `requestSmsOtp({required String phoneE164})` and `verifySmsOtp({required String phoneE164, required String otpCode, String? replaceSessionId})` calling backend `/v1/auth/otp/request` and `/v1/auth/otp/verify`.
  * Normalize Iranian mobile formats (`0912...`, `۹۱۲...`, `+۹۸۹۱۲...`) deterministically to E.164 `+989XXXXXXXXX`.
  * In `AuthScreen`: when `edition == AppEdition.iran`, render **Mobile SMS OTP (`تایید پیامکی`)** as primary + Email/Password as secondary; **never render Google or Apple OAuth buttons** (`Zero-VPN` compliance); handle `409 DEVICE_SLOT_OCCUPIED` identically for `1 Mobile + 1 Desktop Web`.

### `ADR-SF-007`: Modular Iran Billing Gateways (`Zarinpal` + `Bazaar` + `Myket`) & Backend Store Verify
* **Decision:** Support all three `PDR-Iran.md` domestic payment channels behind the unified `BillingGateway` interface (`providers.dart`) controlled cleanly by `AppEdition.iran` and compile-time `--dart-define=IRN_BILLING_CHANNEL=zarinpal|bazaar|myket`:
  * **`zarinpal` (Default on `kIsWeb` PWA + Direct APK):**
    1. `ZarinpalBillingGateway` displays integer Rial amounts converted cleanly to Toman (`۱۹۹,۰۰۰`, `۳۹۰,۰۰۰`, `۸۹۰,۰۰۰ تومان`) via `/v1/billing/catalog` or tier constants synced with backend `billingOrders`.
    2. On checkout tap (after mandatory `1 Phone + 1 Desktop Web` consent checkbox), calls existing `POST /v1/billing/zarinpal/request` with `acceptedSingleDevicePerSlotTos: true` and `returnUrl` (`https://app.sanjia.ir/billing/callback` on Web/PWA or `sanjia://billing/callback` on Android Direct APK).
    3. Opens Zarinpal URL via `url_launcher` (`LaunchMode.externalApplication` / same-window on Web PWA).
    4. `GoRouter` route `/billing/callback` extracts `Authority` & `Status` query params and calls **`POST /v1/billing/zarinpal/verify`** — strictly trusting server verification before updating `ProfileRepository.isPro`.
  * **`bazaar` & `myket` (Android In-App Store Channels):**
    1. Implement `BazaarBillingGateway` and `MyketBillingGateway` invoking quarantined native `MethodChannel` adapters in `app/lib/services/native/iran_iap_channel.dart` (`package:flutter/services.dart` allowed only inside `services/native/` per `check_all.sh`).
    2. Forward returned `purchaseToken` + `productId` to new backend routes **`POST /v1/billing/bazaar/verify`** and **`POST /v1/billing/myket/verify`** inside `backend/apps/api/src/routes/billing.ts` (server validates against Cafe Bazaar Developer API / Myket Verify API using existing `CAFEBAZAAR_SECRET` and `MYKET_SECRET`, writes `billingOrders` + `entitlements`, enforces `1+1` ToS consent, and supports `restorePurchases()` by checking active store receipts via backend verify!).
  * **Paywall Web Unlock:** Remove the `if (kIsWeb)` purchase blocker in `PaywallScreen` whenever `edition == AppEdition.iran`, because Web/iOS PWA checkout via Zarinpal is a core `IRN` acquisition channel!

### `ADR-SF-008`: Bilingual Coaching, `VocabCards.glossFa` & `Navia` Cross-Funnel
* **Decision:**
  * Extend `VocabUpgrade` (`app/lib/core/models/evaluation_models.dart`) with `final String? glossFa;`, parse `glossFa` in `HttpGradingGateway` and `ContentSyncService` (`/v1/vocab/deck`), and add nullable `glossFa` (`TextColumn`) to Drift `VocabCards` (upgrading Drift to the next sequential `schemaVersion` — `v6` if shipped prior to `advanced_plan.md`, or merged cleanly if combined).
  * Update `EvaluationReviewScreen`, `DiagnosticResultsScreen`, `ListeningEvidenceSheet`, `ReadingSimScreen` (AI Question Tutor), and `VocabReviewScreen` / `VocabWordDetailScreen` so Persian coaching fields render in RTL `Vazirmatn` alongside `LtrExamBoundary`-wrapped English verbatim quotes, rewrites, headwords, and IPA!
  * Add `NaviaHandoffCard` inside `app/lib/features/progress/presentation/widgets/` (gated strictly to `edition == AppEdition.iran`) exporting verified readiness summary to `https://navia.ir` via `url_launcher` without hard DB coupling (`ADR-IRN-006`).

---

## 3. Technical Specifications by Layer

### 3.1 Native Flavors, Bundle IDs, PWA Manifest & Zero-VPN Assets

| Target | Exact Changes Required | Owned Files |
| :--- | :--- | :--- |
| **Android Flavor Config** | Set `global` `applicationId = "com.mockza.app"` and `iran` `applicationId = "ir.sanjia.app"` (drop `applicationIdSuffix = ".ir"`). Parameterize `appLabel` (`Mockza` vs `سنجیا`), add `IRN_BILLING_CHANNEL` manifest/gradle config, keep Bazaar Poolakey & Myket SDKs isolated under `iranImplementation` dependencies. Add release keystore config support for dedicated `iran` keystore. | `app/android/app/build.gradle.kts` |
| **Android Manifest & Icons** | Replace hardcoded `android:label="Mockza"` with `android:label="${appLabel}"`. Add `sanjia://billing/callback` and `https://app.sanjia.ir/billing/callback` `intent-filter` in `app/android/app/src/iran/AndroidManifest.xml` (+ Cafe Bazaar/Myket billing queries/permissions scoped to `src/iran/`). Add Sanjia launcher/notification icons in `src/iran/res/`. | `app/android/app/src/main/AndroidManifest.xml`, `app/android/app/src/iran/` |
| **iOS Runner (if AdHoc/Enterprise)** | Optional `Release-Iran` Xcode configuration with `PRODUCT_BUNDLE_IDENTIFIER = ir.sanjia.app`, `INFOPLIST_KEY_CFBundleDisplayName = سنجیا`, localized `InfoPlist.strings` (`NSMicrophoneUsageDescription` in Persian), and `sanjia://` URL scheme. | `app/ios/Runner/Info.plist`, Xcode schemes |
| **Flutter Web / iOS PWA (`app/web/`)** | Add `app/web/index.iran.html` (`<html lang="fa" dir="rtl">`, `<title>سنجیا — شبیه‌ساز آزمون زبان</title>`, local splash `#F8F6EF`) and `app/web/manifest.iran.json` (`"name": "سنجیا — آمادگی آیلتس، تافل و PTE"`, `"short_name": "سنجیا"`, `Editorial Green` `#264E3B` theme color). Add local `canvaskit` bundling script + `flutter_bootstrap.js` `canvasKitBaseUrl: "/canvaskit/"` so **0** requests hit `gstatic.com` or `fonts.gstatic.com`. | `app/web/index.iran.html`, `app/web/manifest.iran.json`, `app/web/flutter_bootstrap.iran.js` |
| **Docker & Release Scripts** | Fix missing `COPY assets ./assets` in `app/Containerfile`, select `index.iran.html` & `manifest.iran.json` when `MOCKZA_EDITION=iran`, bundle local CanvasKit in `web-builder`, and update `.github/workflows/release.yml` comment/validation for `+20001+` `irn` build numbers (`ADR-Iran.md`). | `app/Containerfile`, `.github/workflows/release.yml`, `scripts/stamp_web_cache_bust.sh` |

### 3.2 Full Persian `l10n` (`app_fa.arb` + `BrandIdentity`) & Screen Extraction

Audit across `app/lib/features/` showed the following unlocalized surfaces requiring complete extraction into `app_en.arb` + `app_fa.arb`:

1. **Navigation, Global Shell & Brand (`BrandIdentity`):** Onboarding brand titles, non-affiliation legal disclaimer (`PDR-Iran` Persian disclaimer), offline banner, ephemeral RAM storage warning, server job status pills, and version footer (`سنجیا 1.0.0+20001.irn`).
2. **Auth (`259+314` lines) & Device Slots (`DeviceSessionCard`):** Sign-In / Sign-Up headers, phone number validation (`+989...`), OTP 6-digit challenge screen, resend countdown, active slot badges (`تلفن همراه` / `وب دسکتاپ`), and `409 DEVICE_SLOT_OCCUPIED` modal dialog.
3. **Paywall (`456` lines) & Settings (`950` lines):** Free vs Pro matrix, `10+10/day` & `150/mo` (or IRN `8+8/day`, `120/mo`) fair-use labels, Toman pricing (`formatTomanFromRial`), mandatory `1 Phone + 1 Desktop Web` consent copy, 4+ OCP Theme Preset names (*سبز تحریریه*, *نیلی نیمه‌شب*, *زمرد نوردیک*, *کهربایی تحریریه*, *کبالت اقیانوسی*), Dark/Light/System switch, cached media cleanup, quota meter labels, and **"حذف کامل داده‌ها و فایل‌های صوتی"** (`DELETE /v1/account`).
4. **Onboarding (`488` lines) & Diagnostic (`2,627+` lines):** All 5 exam track names/descriptions (`آیلتس آکادمیک`, `آیلتس جنرال`, `تافل iBT (نسخه ۲۰۲۶)`, `PTE آکادمیک`, `آزمون دولینگو (DET)`), Goal target steppers, Jalali exam date prompt, Diagnostic zero-scroll intro, speaker/mic check diagnostics, `Standard / Extended 3x / Accessible Audio` pills, retake options, and partial/insufficient evidence messages.
5. **Practice Hub, All 4 Simulators, Full Mock, Micro-Drills, Review, Vocab & Progress:** Study/Exam toggle, ExamExitGuard dialog, Speaking/Writing recording & upload banners, Reading highlight/note/vocab toolbar tooltips, Listening speed & Study transcript banners, Vocabulary SM-2 rating labels (`دوباره / سخت / خوب / آسان`), Progress charts & `CompareAttempts` headings.

### 3.3 BiDi Engine (`LtrExamBoundary`) & Edge Persian Numerals / Currency

* **`app/lib/theme/components/ltr_exam_boundary.dart`:**
  ```dart
  // Architectural signature (wraps Directionality.ltr + Localizations.override('en','US') + Inter/Tabular style)
  class LtrExamBoundary extends StatelessWidget {
    const LtrExamBoundary({required this.child, this.preserveParentTextStyle = false, super.key});
    ...
  }
  ```
* **Mandatory Wrap Checklist across Flutter (`AppEdition.iran` & any `fa` locale):**
  * `ReadingSimScreen` & `DiagnosticSessionScreen` Reading step: Passage container, `SelectableText` / highlight spans, MCQ/TFNG/YNNG/Matching question prompts, and answer blanks (`TextField` inside `LtrExamBoundary`).
  * `ListeningSimScreen` & `DiagnosticSessionScreen` Listening step: Audio timeline (`01:24 / 03:45`), transcript segments, dictation text box, word-completion slots.
  * `WritingSimScreen`: Prompt box, SVG chart/diagram (`ExamSvgChartCard`), live word/sentence counter (`184 / 250 w`), and the essay `TextField` (`textDirection: TextDirection.ltr` + `Localizations.override('en','US')`).
  * `SpeakingSimScreen`: Prep/record countdown (`00:45`), cue card bullets, live RMS/recording timer, playback bar.
  * `MicroDrillsScreen`, `EvaluationReviewScreen`, `VocabularyScreen`, `VocabReviewScreen`, `ProgressScreen`, `HomeScreen`: Numeric bands/scores (`7.5`, `115/160`, `65/90`), English `vocabUpgrades[].term`, `evidenceExcerpt`, `modelRewrite.rewrittenText`, `headword`, `ipa`, `contextSentence`, `paraphrases`.
* **Edge Numerals (`app/lib/core/formatting/edge_numerals.dart`):** Converts chrome-only counters (e.g., streak `۱۲ روز`, `۲۰ کارت امروز`, Toman `۳۹۰,۰۰۰ تومان`, Jalali `۱۴۰۵/۰۹/۲۵`) to Persian digits (`۰–۹`) in `AppEdition.iran`, while normalizing any Persian digits typed into SMS OTP inputs or Jalali date inputs back to ASCII `0–9` before API serialization.

### 3.4 Edge-Only Jalali (`شمسی`) Formatter & Picker

* **Dependency:** `shamsi_date: ^1.0.4` (pure Dart).
* **`JalaliEdgeFormatter` (`app/lib/core/formatting/jalali_edge_formatter.dart`):**
  * Mirrors `web/src/edition/calendar/jalali-edge.ts` using identical UTC epoch base (`DateTime.fromMillisecondsSinceEpoch(serialDay * 86400000, isUtc: true)`), guaranteeing **0-day drift** regardless of device timezone!
  * `serialDayToJalaliYmd(int serialDay)` -> `(year, month, day)`.
  * `jalaliYmdToSerialDay(int jy, int jm, int jd)` -> canonical UTC integer `SerialDay` stored directly in `UserProfiles.targetDateSerial`.
  * `formatJalaliDateString(int serialDay, {bool includeMonthName = false})` -> `۱۴۰۵/۰۹/۲۵` or `۲۵ آذر ۱۴۰۵`.
* **`MzJalaliDatePickerSheet` (`app/lib/theme/components/mz_jalali_date_picker.dart`):** Token-driven bottom sheet / dialog (`Editorial Green` & all presets Light/Dark compatible, `320dp` & `textScaler = 2.0` overflow-safe) supporting Persian month grid selection, Esfand `29/30` leap-year awareness, quick shortcuts (*۳۰ روز آینده*, *۹۰ روز آینده*, *حذف تاریخ*), returning canonical UTC `int serialDay`.

### 3.5 `+98` SMS OTP Authentication & Session Slot Parity

* **Model & Service Layer:**
  * `AuthProviderType` adds `smsOtp('sms_otp')` in `app/lib/core/auth/auth_models.dart`.
  * `AuthProvidersStatus` parses optional `smsOtp` (`enabled`, `mode`: `'sms_gateway' | 'dev_sandbox' | 'disabled'`).
  * `AuthSessionService` implements:
    * `requestSmsOtp({required String phoneInput})`: normalizes Persian digits (`۰۹...`) / `09...` / `+989...` -> validates regex `^\+989\d{9}$`, calls `POST /v1/auth/otp/request`, returns retry cooldown & optional dev hint.
    * `verifySmsOtp({required String phoneInput, required String otpCode, String? replaceSessionId})`: calls `POST /v1/auth/otp/verify` with `DeviceClientMeta` (`slotKind: mobile` on native Android/iOS APK; `slotKind: desktop_web` vs `mobile` cleanly detected on responsive `app.sanjia.ir` Web!). Preserves full **`409 DEVICE_SLOT_OCCUPIED`** resolution dialog with Persian labels so an active Android phone session cleanly coexists with a Desktop Web `Sanjia` session, while conflicting second phone logins prompt confirmation before replacing!
* **Edition UI Isolation (`AuthScreen` & `AuthNotifier`):**
  * When `editionConfig.edition == AppEdition.iran`, hide Google & Apple OAuth widgets completely and default the Auth form to a clean 2-step **`شماره موبایل (+۹۸)` -> `کد ۶ رقمی پیامکی`** flow, keeping `ایمیل و رمز عبور` as a secondary collapsible tab for email-registered learners.

### 3.6 Iran Billing Adapters (Zarinpal + Cafe Bazaar + Myket) & Backend Endpoints

1. **Backend Route Completion (`backend/apps/api/src/routes/billing.ts`, `backend/apps/api/src/services/web-billing.ts`, `backend/packages/contracts/src/schemas.ts`):**
   * Zarinpal (`POST /v1/billing/zarinpal/request` & `POST /v1/billing/zarinpal/verify`) is already implemented in `billing.ts`.
   * Add **`BazaarVerifyRequestSchema`** & **`MyketVerifyRequestSchema`** (`planId`, `productId`, `purchaseToken`, `acceptedSingleDevicePerSlotTos: true`) in `packages/contracts`.
   * Register **`POST /v1/billing/bazaar/verify`** and **`POST /v1/billing/myket/verify`** (strictly gated `env.EDITION === 'irn'` -> `403 edition_forbidden` otherwise) inside `billing.ts`, validating purchase receipts server-side against Cafe Bazaar (`CAFEBAZAAR_SECRET`) / Myket (`MYKET_SECRET`) or deterministic sandbox verifier when `ALLOW_DEV_BILLING_SANDBOX` / test override is active, and writing atomic `billingOrders` + `entitlements` (`source: 'bazaar' | 'myket'`).
   * Add **`GET /v1/billing/irn/plans`** (or include inside catalog/entitlement config) returning authoritative server-side integer `amountRial` tiers (`weekly`, `monthly`, `quarterly`) so Toman prices can adapt to FX changes without an APK update!
2. **Flutter Gateway Dispatch (`app/lib/providers.dart` + `app/lib/services/`):**
   * Configure compile-time constant `const irnBillingChannel = String.fromEnvironment('IRN_BILLING_CHANNEL', defaultValue: 'zarinpal');` (`'zarinpal' | 'bazaar' | 'myket'`).
   * On `kIsWeb` PWA builds, force `'zarinpal'` regardless of channel flag (`ADR-IRN-001` / `PDR-Iran` Q2).
   * Implement:
     * `ZarinpalBillingGateway` (`app/lib/services/zarinpal_billing_gateway.dart`): Calls `/v1/billing/zarinpal/request`, opens payment gateway via `url_launcher`, and verifies Authority via `/v1/billing/zarinpal/verify` on `/billing/callback` deep-link / Web return!
     * `BazaarBillingGateway` & `MyketBillingGateway` (`app/lib/services/store_iran_billing_gateway.dart`): Wraps `IranIapPlatformChannel` (`app/lib/services/native/iran_iap_channel.dart`) communicating with Kotlin Android Poolakey (`ir.cafebazaar.sdk:poolakey`) or Myket SDK inside `app/android/app/src/iran/kotlin/...` + verifying token on `/v1/billing/{bazaar,myket}/verify`.
   * **`PaywallScreen` Update:** Remove `kIsWeb` checkout lockout when `edition == AppEdition.iran`, render Persian plan cards with `formatTomanFromRial`, expose clear **Zarinpal / Cafe Bazaar / Myket** pay CTA, and keep explicit mandatory `1 Mobile + 1 Desktop Web` consent checkbox active on all channels.

### 3.7 Bilingual AI Coaching, `VocabCards.glossFa` & `Navia` Cross-App Handoff

* **Data & Models (`core/` + `data/` + `services/`):**
  * Add `final String? glossFa;` to `VocabUpgrade` (`evaluation_models.dart`), `VocabCardRow` / `VocabCards` table (`app/lib/data/db/tables/core_tables.dart`, bumping Drift schema cleanly — `schemaVersion => 6`, or coordinated cleanly if combined with `advanced_plan.md`), and optional `glossFa` / `rationaleFa` support where payloads supply them.
  * Update `HttpGradingGateway` (`app/lib/services/grading_gateway.dart`) to deserialize `vocabUpgrades[].glossFa` alongside already-returned Persian prose in `feedbackNote`, `rationale`, `preservedIdeasNote`, `bandRationale`, `actionableNextStep`, `explanation`, and `whyWrongOptions[].reason`.
  * Update `ContentSyncService` (`app/lib/services/content_sync_service.dart`) and `VocabRepository` (`app/lib/data/repositories/vocab_repository.dart`) to sync & store `glossFa` on both downloaded `/v1/vocab/deck` cards and newly captured **Mistake-to-Deck** cards.
* **UI Rendering Rules:**
  * `EvaluationReviewScreen` & `ListeningEvidenceSheet`: Render examiner prose in RTL `Vazirmatn`, while wrapping quoted learner excerpts, model rewrites, upgraded English terms, and numerical bands cleanly inside `LtrExamBoundary`.
  * `VocabReviewScreen` & `VocabWordDetailScreen`: When `edition == AppEdition.iran`, show concise Persian meaning (`glossFa`) cleanly on reveal card back and word inspector alongside academic synonyms & LTR English context sentences.
* **`Navia` Ecosystem Handoff (`ProgressScreen` & `EvaluationReviewScreen`):**
  * Add `NaviaHandoffCard` (`app/lib/features/progress/presentation/widgets/navia_handoff_card.dart`), visible strictly when `edition == AppEdition.iran`, displaying verified target achievement + deep-link CTA (`https://navia.ir` / `app.navia.ir/import-score?edition=irn&track=...&score=...` via `url_launcher`).

---

## 4. Phased Implementation Roadmap (`Phase SF0` – `Phase SF7`)

### Phase `SF0`: Native Flavors, App Identity & `Containerfile` Fixes
1. Fix `app/android/app/build.gradle.kts` (`iran` `applicationId = "ir.sanjia.app"`, `appLabel` manifest placeholders, isolated `iranImplementation` hooks).
2. Add `app/android/app/src/iran/res/` Sanjia launcher icons & Zarinpal callback `intent-filter` (`sanjia://billing/callback` + verified `https://app.sanjia.ir/billing/callback`).
3. Create `app/web/index.iran.html`, `app/web/manifest.iran.json`, local CanvasKit bundling/bootstrap (`canvasKitBaseUrl: "/canvaskit/"`), and fix `COPY assets ./assets` + `MOCKZA_EDITION=iran` Web assets selection inside `app/Containerfile`.
4. Add `shamsi_date`, `url_launcher`, and `app_links` to `app/pubspec.yaml`.

* **Exit Gate:** `flutter build apk --flavor iran -t lib/main_iran.dart --debug` (or `--no-wasm-dry-run` web build for `iran`) compiles with `ir.sanjia.app` / `سنجیا` metadata and passes `check_all.sh` Flutter static gates.

### Phase `SF1`: `LtrExamBoundary`, Edge Numerals & Jalali Picker
1. Build pure Dart `edge_numerals.dart` & `jalali_edge_formatter.dart` under `app/lib/core/formatting/`.
2. Build `LtrExamBoundary` & `MzJalaliDatePickerSheet` under `app/lib/theme/components/`.
3. Wire `MzJalaliDatePickerSheet` into Onboarding `GoalSetup` and `Settings` when `edition == AppEdition.iran`; wrap all exam stimuli, timers, scores, essays, and SVG chart cards in `LtrExamBoundary`.
4. Add unit parity tests verifying `jalali_edge_formatter.dart` matches `web/src/edition/calendar/jalali-edge.ts` across leap years `1403`–`1406`.

* **Exit Gate:** `flutter test --no-pub --concurrency=1 test/theme test/core test/a11y` passes with RTL/BiDi golden checks (`320dp` and `textScaler = 2.0`).

### Phase `SF2`: Full Persian `ARB` Localization & `BrandIdentity` Extraction
1. Add `BrandIdentity` helper differentiating `Mockza` / `موکزا` vs `Sanjia` / `سنجیا`.
2. Audit all `15` feature modules, shared UI kit components, and domain label helpers; extract all hardcoded English strings into `app/lib/l10n/app_en.arb` and translate into natural Persian in `app/lib/l10n/app_fa.arb` matching `web/src/i18n/fa.ts`.
3. Verify `flutter gen-l10n` produces zero missing keys or placeholder mismatches across `en` and `fa`.

* **Exit Gate:** Visual screenshot sweep of all `app/` routes in `AppEdition.iran` shows zero unlocalized English UI chrome (`0` leaked `"Mockza Pro"`, `"Google"`, or English button chrome outside English exam stimuli).

### Phase `SF3`: `+98` SMS OTP Auth Integration
1. Add `AuthProviderType.smsOtp`, `SmsOtpProviderDescriptor`, `requestSmsOtp`, and `verifySmsOtp` in `app/lib/core/auth/` & `app/lib/services/auth_session_service.dart`.
2. Update `AuthScreen` & `AuthNotifier` to hide Google/Apple OAuth when `edition == AppEdition.iran` and present `+98` SMS OTP (+ resend timer + `devOtpHint` banner in sandbox + Email fallback) alongside Persian `409 DEVICE_SLOT_OCCUPIED` slot replacement.
3. Update `SettingsScreen` Active Devices manager with Persian slot names and Jalali `lastSeenAt` formatting.

* **Exit Gate:** Live API integration test against backend `EDITION=irn` proves `+98912...` OTP login, `409` desktop/mobile coexistence & takeover, and `Settings` remote revocation from Flutter.

### Phase `SF4`: Iran Billing Adapters (`Zarinpal` PWA/APK + `Bazaar` / `Myket`) & Backend Store Verify
1. Register `POST /v1/billing/bazaar/verify` and `POST /v1/billing/myket/verify` in `backend/apps/api/src/routes/billing.ts` + contracts + Postgres `billingOrders` tests.
2. Implement `ZarinpalBillingGateway` + GoRouter `/billing/callback` verification flow (`url_launcher` + `app_links` / Web return URL).
3. Implement quarantined `app/lib/services/native/iran_iap_channel.dart` + Android `src/iran/kotlin/...` Poolakey/Myket handlers + `BazaarBillingGateway` / `MyketBillingGateway`.
4. Update `PaywallScreen` so `kIsWeb && edition == AppEdition.iran` uses Zarinpal checkout cleanly with Toman pricing (`formatTomanFromRial`) and mandatory `1+1` consent.

* **Exit Gate:** End-to-end sandbox checkout verified on both Flutter Web (`kIsWeb`, Zarinpal sandbox redirect -> server verify -> Pro unlocked) and Android `iran` APK (`Bazaar`/`Myket` mock receipt -> server verify -> Pro unlocked + restore).

### Phase `SF5`: Bilingual AI Commentary, `VocabCards.glossFa` & `Navia` Funnel
1. Add `VocabCards.glossFa` (`TextColumn nullable()`) via sequential Drift `MigrationStrategy` upgrade + migration test on populated `v5` DB fixture.
2. Wire `glossFa` parsing across `VocabUpgrade`, `HttpGradingGateway`, `ContentSyncService`, `VocabRepository`, `EvaluationReviewScreen`, and `VocabReviewScreen` / `VocabWordDetailScreen`.
3. Implement `AppEdition.iran`-only `NaviaHandoffCard` inside `app/lib/features/progress/` & review completion flow.

* **Exit Gate:** Submit mock Writing & Speaking in `EDITION=irn` -> Flutter renders Persian `feedbackNote` + English `evidenceExcerpt` in `LtrExamBoundary` -> 1-tap captures SM-2 card carrying `glossFa` -> `Vocabulary` displays Persian gloss cleanly.

### Phase `SF6`: Zero-VPN Network Audit, Isolation CI & Comprehensive `IRN` Testing
1. Build **`app/test/e2e/sanjia_irn_e2e_test.dart`** (`E2E_iran` Page-Object Robot covering Onboarding w/ Jalali picker -> `+98` SMS OTP -> Diagnostic -> Zarinpal Paywall -> Reading/Listening w/ `LtrExamBoundary` -> Bilingual Writing/Speaking Review -> Vocab `glossFa` -> Progress & `Navia` handoff -> `DELETE /v1/account`).
2. Add Zero-VPN headless network test checking built `iran` Web bundle makes `0` external requests to `gstatic.com`, `fonts.googleapis.com`, `revenuecat`, `stripe`, `accounts.google.com`, or `appleid.apple.com`.
3. Extend `scripts/check_all.sh` and `.github/workflows/ci.yml` / `release.yml`: verify `main_iran.dart` compiles cleanly (`checker` + Web `iran` build), enforce `+20001+` build numbers for `.irn`, and fail CI if `global` APKs/bundles reference `bazaar`, `myket`, `zarinpal`, `sanjia`, or `navia`.

* **Exit Gate:** `./scripts/check_all.sh all`, `flutter analyze --no-pub --fatal-infos`, `flutter test --no-pub --concurrency=1` (including `sanjia_irn_e2e_test.dart`), and backend billing Vitest suite are 100% green.

---

## 5. Automated Verification, Zero-VPN, Isolation & Store Release Gates

| Verification Gate | Command / Validation Procedure | Required Pass Criteria |
| :--- | :--- | :--- |
| **Static Hygiene & Architecture** | `./scripts/check_all.sh all` | `0` physical LTR padding/alignment (`EdgeInsets.only`), `0` raw visual literals outside `lib/theme/`, `0` `MethodChannel` outside `services/native/`, `0` cross-feature imports, `0` cross-edition package leaks |
| **Flutter Analysis & Headless Tests (Low-RAM)** | `cd app && flutter gen-l10n && dart format --output=none --set-exit-if-changed lib test && flutter analyze --no-pub --fatal-infos && flutter test --no-pub --concurrency=1` | `100%` pass across Tiers 1–4, Jalali parity tests, BiDi `LtrExamBoundary` layout tests (`320dp` & `2.0x` scale), Drift `onUpgrade` tests, and `sanjia_irn_e2e_test.dart` |
| **Backend `IRN` Billing & OTP** | `cd backend && pnpm --filter @mockza/api test` | `100%` pass covering `/v1/auth/otp/{request,verify}`, `/v1/billing/zarinpal/{request,verify}`, `/v1/billing/{bazaar,myket}/verify`, `403 edition_forbidden` against `glb`, and `409 DEVICE_SLOT_OCCUPIED` |
| **Zero-VPN Web PWA Check (`app.sanjia.ir`)** | Build `MOCKZA_EDITION=iran` Web container & capture headless Chromium network log | `0` network calls to Google (`fonts.gstatic.com`, `gstatic.com`, `accounts.google.com`), Apple, RevenueCat, or Stripe; Persian RTL chrome + LTR exam stimuli confirmed |
| **Native Store Artifacts** | Android `iran` APK/AAB (`ir.sanjia.app`, `+20001+`) tested on physical device without VPN | Clean installation alongside `com.mockza.app`, Zarinpal deep-link callback & Bazaar/Myket sandbox purchase verified, real audio recording & offline playback verified |
