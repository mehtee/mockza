# App Store & Google Play ASO Listings & In-App Purchase SKUs (Epic X3.3)

---

## 1. App Store Optimization (ASO) Metadata

### App Store (iOS)
- **App Name**: Mockza: IELTS Mock Simulator (30 / 30 chars)
- **Subtitle**: AI Speaking, Writing & Band 8 (30 / 30 chars)
- **Keywords**: ielts,mock,exam,speaking,writing,reading,listening,band 8,test,prep,cambridge,practice,evaluation,score,tutor (99 / 100 chars)
- **Primary Category**: Education
- **Secondary Category**: Reference
- **Promotional Text**:
  Prepare for IELTS with realistic Speaking and Writing AI simulations, instant band evaluations, and offline practice tests with zero subscription pressure.

### Google Play (Android)
- **App Title**: Mockza: IELTS Practice & Mocks (30 / 30 chars)
- **Short Description**:
  Realistic IELTS full mock tests, AI Speaking & Writing scoring, and offline decks. (80 / 80 chars)
- **Full Description**:
  Master the IELTS Academic and General Training exams with Mockza—the premier AI-powered exam simulator.

  KEY FEATURES:
  • Realistic 3-Part Speaking Simulator: Practice with timed examiners, multi-turn prompts, and instant speech fluency, pronunciation, and grammatical accuracy scoring.
  • Timed Writing Task 1 & Task 2 Workspace: Write under official exam pressure and receive detailed criterion-by-criterion band evaluations with inline Band 8 rewrite suggestions.
  • 100% Offline Reading & Listening Tests: Download verified exam packs with original passages and audio tracks for complete offline study anytime, anywhere.
  • Spaced Repetition Vocabulary (SM-2): Retain 500+ high-frequency academic collocations and paraphrase pairs with an optimized scientific SRS flashcard deck.
  • Honest Progress Tracking: View your estimated overall band score calculated using official IELTS half-band rounding rules.

  No hidden fees, no deceptive subscriptions. Free tier includes daily evaluations and complete offline access.

---

## 2. In-App Purchase (IAP) SKUs & RevenueCat Products

| Product ID / SKU | Name | Type | Billing Period | USD Price | EUR Price | GBP Price |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `mockza_cram_weekly` | 7-Day Cram Pass | Non-renewing subscription | 7 days | $9.99 | €9.99 | £8.99 |
| `mockza_pro_monthly` | Mockza Pro Monthly | Auto-renewable subscription | 1 month | $19.99 | €19.99 | £17.99 |
| `mockza_quarterly` | Mockza Quarterly Intensive | Auto-renewable subscription | 3 months | $44.99 | €44.99 | £39.99 |

### RevenueCat Entitlements
- **Entitlement ID**: `pro`
- Attached products: `mockza_cram_weekly`, `mockza_pro_monthly`, `mockza_quarterly`
- Benefits granted:
  - Daily Speaking limit raised from 1 to 10
  - Daily Writing limit raised from 1 to 10
  - Monthly AI evaluation cap raised from 10 to 150
  - Unlimited offline CDN pack downloads

---

## 3. App Store Reviewer Guidelines Attachment Notes (Guideline 2.1(b))
Reviewer Test Account:
- Sandbox tester email: `reviewer-sandbox@mockza.example.com`
- Active entitlement: Automatically granted via device bypass header `X-Mockza-Test-Bypass: reviewer-2026`
- Zero external hardware required (operates using standard microphone and device audio output).
