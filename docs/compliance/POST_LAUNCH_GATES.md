# Post-Launch Stability, Conversion & Portfolio Gate Documentation (Epic X3.4)

This document establishes the operational thresholds, commercial conversion gates, and post-launch stability metrics required for Mockza v1.0 following initial store release.

---

## 1. Technical Stability & Quality Gates (7-Day & 30-Day Post-Launch)

| Metric | Target SLA | Warning Threshold | Critical Breach Action |
| :--- | :--- | :--- | :--- |
| **Crash-Free Users** | `>= 99.5%` | `< 99.0%` | Halt marketing spend; hotfix release within 24h |
| **Crash-Free Sessions** | `>= 99.9%` | `< 99.5%` | Prioritize top 3 crash traces in `crash.log` / Sentry |
| **Hono API P95 Latency** | `< 100ms` | `> 250ms` | Scale PgBouncer pool connections; audit slow queries |
| **AI Evaluation P95 Latency** | `< 35s` | `> 50s` | Enable fast-fallback model in OpenRouter router |
| **Audio Upload Failure Rate** | `< 0.5%` | `> 1.5%` | Investigate S3/SeaweedFS presign URL TTLs |
| **Quota Double-Spend Count** | `0` | `> 0` | Immediate database lock inspection on `quota_reservations` |
| **Eval Rubric Drift (Golden)** | `<= 0.25 band` | `> 0.50 band` | Re-run eval benchmarks; update system prompt anchors |

---

## 2. Business & Conversion Gates (4-Week Review)

### Target Conversion Metrics
1. **Free-to-Paid Conversion Rate**:
   - Minimum Viable Threshold: **3.5%**
   - Target Objective: **5.5%**
   - Trigger Points: Paywall impression at 3rd evaluation completion or during full mock results unlock.
2. **Product SKU Mix**:
   - `mockza_cram_weekly` ($9.99): Projected 45% of total paid volume (target for urgent 1–2 week test-takers).
   - `mockza_pro_monthly` ($19.99): Projected 40% of total volume (target for longer-term academic preparation).
   - `mockza_quarterly` ($44.99): Projected 15% of total volume (high LTV power learners).
3. **User Retention**:
   - Day 1 (D1): `>= 45%`
   - Day 7 (D7): `>= 25%`
   - Day 30 (D30): `>= 15%`

---

## 3. Phase 6 Expansion Portfolio Gates

Before initiating Phase 6 fast-follow investments (PTE Academic, TOEFL iBT, Duolingo English Test, and isolated Iran edition deployment), the product must satisfy the following gates over an unbroken 14-day window:

1. **Gate A: Technical Stability Verified**:
   - Crash-free user rate `>= 99.5%` across both iOS and Android.
   - P95 AI evaluation latency `< 35s`.
   - Zero unresolved data integrity bugs in Drift local database.

2. **Gate B: Commercial Viability Verified**:
   - Daily active users (DAU) `>= 1,000`.
   - Net subscriber retention month-over-month `>= 60%`.
   - Customer Acquisition Cost (CAC) payback period `<= 60 days`.

3. **Gate C: Content Integrity & Quality Verified**:
   - Zero copyright or trademark infringement disputes.
   - Learner feedback rating `>= 4.6 / 5.0` stars on Apple App Store & Google Play.
   - Evaluation accuracy dispute rate `< 2%` of all graded submissions.

---

## 4. Emergency Incident Escalation Protocol

If any Critical Breach threshold is triggered:
1. PagerDuty alerts on-call infrastructure and mobile release engineers.
2. Status page automatically flips to "Degraded Service" at `status.mockza.example.com`.
3. If LLM provider suffers sustained outage (> 15 minutes), the API automatically switches into queued asynchronous mode, holding jobs in `pg-boss` and alerting users that results will be ready within 1 hour.
