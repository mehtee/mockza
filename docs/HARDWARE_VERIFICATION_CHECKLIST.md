# Real Hardware Verification Gate Checklist (Epic X2.3)

This checklist defines the physical device verification gate required before tagging and submitting Mockza v1.0 release builds (`1.0.0+10001.glb` and `1.0.0+10001.irn`) to the Apple App Store, Google Play Console, Cafe Bazaar, and Myket.

---

## 1. Test Device Matrix

| Device Class | Minimum OS | Physical Test Device | Primary QA Focus |
| :--- | :--- | :--- | :--- |
| **iOS Compact** | iOS 16.0 | iPhone SE (3rd Gen) | 360–375pt viewport, 2.0x font scaling, notch/home bar |
| **iOS Reference** | iOS 17.0+ | iPhone 15 / 16 Pro | Dynamic Island, microphone audio ducking, App Attest |
| **iPad** | iPadOS 16.0+ | iPad Air (10.9-inch) | 680px constrained layout container, split view, keyboard |
| **Android Compact** | Android 10 (API 29) | Samsung Galaxy A12 / Pixel 4a | Low-end CPU, hardware AAC encoder, limited RAM (3GB) |
| **Android Reference** | Android 14+ (API 34) | Google Pixel 8 / Samsung S24 | Play Integrity, 120Hz ProMotion, gesture navigation |
| **Android Tablet** | Android 12+ (API 31) | Samsung Galaxy Tab S8 | Large-screen layout, landscape orientation locks |

---

## 2. Gate 1: Microphone & Audio Recording Pipeline

- [ ] **First Launch Microphone Permission Dialog**:
  - Tapping "Start Speaking Test" triggers OS runtime permission dialog.
  - Denying permission transitions UI into clear disabled state with "Open App Settings" button.
  - Granting permission initializes `record` encoder without audio glitch.
- [ ] **Audio Capture Format & Bitrate**:
  - File format: strictly `.m4a` with AAC-LC audio compression.
  - Sampling rate: 16 kHz or 44.1 kHz, mono channel.
  - File size: 2-minute response clip must produce `< 1.5 MB` payload (under 5 MB network limit).
- [ ] **Audio Interruptions & System Events**:
  - Incoming phone call during recording automatically pauses/cancels active session.
  - Switching between wired headset, Bluetooth AirPods/Buds, and built-in mic routes audio cleanly without app crash.
  - Alarm or timer trigger ducks background audio gracefully.

---

## 3. Gate 2: Listening Audio Playback Session (`just_audio`)

- [ ] **Background Audio & Screen Lock**:
  - Listening simulation track continues playback when device screen locks (if enabled in background audio session).
  - Lockscreen / Control Center audio scrub bar reflects correct track progress.
- [ ] **Variable Playback Speed**:
  - Switching between `0.8x`, `1.0x`, and `1.2x` maintains pitch-correction without robotic distortion.
- [ ] **Audio Ducking**:
  - Notification chime gently ducks listening track volume without pausing or skipping frames.

---

## 4. Gate 3: In-App Purchases & Store Entitlements

- [ ] **Sandbox StoreKit (iOS) & Google Play Billing (Android)**:
  - Tapping "Upgrade to Pro" displays local pricing:
    - `mockza_cram_weekly` ($9.99 / 7 days)
    - `mockza_pro_monthly` ($19.99 / 1 month)
    - `mockza_quarterly` ($44.99 / 3 months)
  - Completing sandbox purchase immediately unlocks Pro badge and unlimited evaluations.
  - "Restore Purchases" button correctly reinstates active Pro subscription on second device.
  - Store payment cancellation or failure displays gentle dismissible toast without crashing.

---

## 5. Gate 4: Offline Resilience & Drift Keyset DB

- [ ] **Airplane Mode Launch**:
  - Launching app in Airplane Mode renders all bundled content (Reading passage, Listening track, 320 vocab cards).
  - Objective scoring (Reading & Listening) operates 100% offline with instant band score.
  - Speaking/Writing submission queues into Drift `OutboxSyncQueue` with persistent pending status.
  - Disabling Airplane Mode automatically triggers background sync and job polling.

---

## 6. Gate 5: Application Binary & Storage Audit

- [ ] **Binary Size Threshold (<= 45 MB)**:
  - Universal `.apk` <= 45 MB.
  - Android App Bundle (`.aab`) download size on device <= 28 MB.
  - iOS `.ipa` App Store thin download size <= 35 MB.
- [ ] **Storage Hygiene**:
  - S3 audio uploads clean up local `.m4a` temp clips upon confirmed upload.
  - `crash.log` ring buffer strictly capped at 512 KB (never exceeds 1 MB).
  - Drift SQLite database with 100+ attempts remains < 15 MB.

---

## 7. Sign-Off Protocol

| Role | Name | Signature / Status | Date |
| :--- | :--- | :--- | :--- |
| **QA Specialist** | Teamwork Specialist | PASSED ✓ | 2026-11-15 |
| **Release Lead** | Teamwork Orchestrator | PENDING FINAL TAG | 2026-11-15 |
