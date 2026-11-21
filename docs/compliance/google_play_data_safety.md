# Google Play Data Safety Form Documentation (Epic X3.3)

This document provides exact responses required for the Google Play Console Data Safety questionnaire for Mockza v1.0.

---

## 1. Overview of Data Collection & Sharing

- **Does your app collect or share any of the required user data types?**: Yes
- **Is all of the user data collected by your app encrypted in transit?**: Yes (all network communication uses HTTPS / TLS 1.2+)
- **Do you provide a way for users to request that their data be deleted?**: Yes (via in-app "Delete All My Data & Account" calling `DELETE /v1/account`, backed by receipt-authenticated `POST /v1/erasure/:erasureId/retry` resumption if transient object-storage cleanup fails)

---

## 2. Collected Data Types & Disclosures

### A. Audio Files & User Essays
- **Data type**: Voice or sound recordings & written essay responses
- **Collected?**: Yes
- **Shared?**: Yes — transmitted over TLS to OpenRouter and configured upstream model inference providers solely to generate IELTS evaluation feedback when the user requests AI grading (subject to upstream API provider zero/limited-retention terms; never claim guaranteed zero-retention across third parties without signed DPA verification)
- **Processed ephemerally?**: Audio stored in private S3 bucket with a configurable auto-purge TTL (`AUDIO_TTL_DAYS`), or deleted on `DELETE /v1/account`
- **Is this data required or optional?**: Optional (only collected when the user undertakes Speaking, Writing, or Register Shifter AI evaluations)
- **Purpose**: App functionality (providing speaking fluency, register transfer, lexical, grammatical, and pronunciation AI feedback)

### A2. Drop Anything User-Shared Text, URLs & Bounded Images/Audio (`ACTION_SEND` / In-App Composer)
- **Data type**: User-shared URLs, text excerpts (<= 15,000 chars), screenshots/photos (up to 4, EXIF-stripped before inference), and optional bounded voice memos (<= 180s)
- **Collected?**: Yes (exclusively when initiated by user via OS Share Sheet or Drop composer)
- **Shared?**: Transmitted securely over TLS to Mockza/Sanjia private APIs and configured OpenRouter zero/limited-retention inference endpoints to extract study vocabulary and 2-minute micro-drills; never published to any shared/public feed
- **Processed ephemerally?**: Uploaded drop media stored ephemerally in private S3 bucket and auto-purged after `AUDIO_TTL_DAYS` (<= 30 days) or wiped immediately on `DELETE /v1/account`
- **Purpose**: App functionality (personalized vocabulary & micro-drill generation + Linguistic Graph adaptation)

### B. Financial Info
- **Data type**: Purchase history
- **Collected?**: Yes
- **Shared?**: Yes (with RevenueCat, Apple App Store / Google Play Billing)
- **Processed ephemerally?**: No
- **Purpose**: App functionality & Fraud prevention (unlocking Pro subscription and managing daily/monthly AI evaluation quotas)

### C. App Info and Performance
- **Data type**: Crash logs & Diagnostics
- **Collected?**: Yes
- **Shared?**: No (stored in local ring buffer `crash.log`)
- **Purpose**: Analytics & App functionality (monitoring app stability and performance)

### D. Device or other identifiers
- **Data type**: Device ID & App User ID (pseudonymous UUIDv4 generated locally, mapped to RevenueCat `appUserID` and linked account identity on GLB edition)
- **Collected?**: Yes
- **Shared?**: Yes — shared with RevenueCat as `appUserID` (`GLB` edition) solely for subscription entitlement synchronization and restore across devices
- **Purpose**: App functionality, Account management, Purchase restoration, and Quota enforcement

---

## 3. Privacy Policy URL
`https://mockza.mehtea.ir/privacy` (replace with canonical production domain before store submission)
