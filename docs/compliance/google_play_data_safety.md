# Google Play Data Safety Form Documentation (Epic X3.3)

This document provides exact responses required for the Google Play Console Data Safety questionnaire for Mockza v1.0.

---

## 1. Overview of Data Collection & Sharing

- **Does your app collect or share any of the required user data types?**: Yes
- **Is all of the user data collected by your app encrypted in transit?**: Yes (all network communication uses HTTPS / TLS 1.2+)
- **Do you provide a way for users to request that their data be deleted?**: Yes (via in-app button "Wipe Account & Study Data" calling `DELETE /v1/account`, and via operator privacy portal at `https://mockza.mehtea.ir/privacy/data-deletion` — configure per deployment host)

---

## 2. Collected Data Types & Disclosures

### A. Audio Files & User Essays
- **Data type**: Voice or sound recordings & written essay responses
- **Collected?**: Yes
- **Shared?**: Yes — transmitted securely to the configured AI model inference provider (via OpenRouter with `no-retention` headers where supported) solely to generate IELTS evaluation feedback when the user requests AI grading
- **Processed ephemerally?**: Audio stored in private S3 bucket with a 30-day auto-purge TTL (`AUDIO_TTL_DAYS`), or deleted immediately on `DELETE /v1/account`
- **Is this data required or optional?**: Optional (only collected when the user undertakes Speaking or Writing AI evaluations)
- **Purpose**: App functionality (providing IELTS Speaking fluency, lexical, grammatical, and pronunciation AI scoring)

### B. Financial Info
- **Data type**: Purchase history
- **Collected?**: Yes
- **Shared?**: Yes (with RevenueCat, Google Play Billing)
- **Processed ephemerally?**: No
- **Purpose**: App functionality & Fraud prevention (unlocking Pro subscription and managing daily/monthly AI evaluation quotas)

### C. App Info and Performance
- **Data type**: Crash logs & Diagnostics
- **Collected?**: Yes
- **Shared?**: No (stored in local ring buffer `crash.log` and optionally submitted on unhandled fatal error)
- **Purpose**: Analytics & App functionality (monitoring app stability and performance)

### D. Device or other identifiers
- **Data type**: Device ID (pseudonymous UUIDv4 generated locally)
- **Collected?**: Yes
- **Shared?**: No
- **Purpose**: App functionality, Account management, and Quota enforcement

---

## 3. Privacy Policy URL
`https://mockza.mehtea.ir/privacy` (replace with canonical production domain before store submission)
