# Mockza × Sanjia — Cross-Platform Capability Parity Manifest

**Version:** 1.0 · 28 November 2026  
**Variants:** `MF` (Mockza Flutter), `SF` (Sanjia Flutter), `MW` (Mockza Desktop Web), `SW` (Sanjia Desktop Web).  
**Source of truth:** `web/src/spa/router.tsx`, `app/lib/routing/routes.dart`, `backend/apps/api/src/routes/`.

| Capability ID | Requirement Refs | Editions | Flutter Route (`MF`/`SF`) | Desktop Web Route (`MW`/`SW`) | Parity Status | Notes |
|---|---|---|---|---|---|---|
| `CAP-01` Public Landing & SEO Calculators | FR-047–050 | `GLB`, `IRN` | N/A (Web-public) | `/`, `/calculators/*`, `/exams/*`, `/samples/*`, `/vocab/*` | `verified_existing` | Static Astro pages with interactive calculators placed above reference tables (`W02`, `W03`). |
| `CAP-02` Welcome & 5-Track Selection | FR-001 | `GLB`, `IRN` | `/onboarding` | `/app/welcome` | `verified_existing` | Settings-only track switching enforced after onboarding (`C05`). |
| `CAP-03` Goal, Date, Interests & Pace | FR-002, IRN-FR-002 | `GLB`, `IRN` | `/onboarding/goal` | `/app/onboarding/goal` | `verified_existing` | Jalali edge formatting in `IRN`; canonical UTC/SerialDay storage. |
| `CAP-04` Guest / Auth & 1+1 Device Slots | FR-041–044 | `GLB`, `IRN` | `/auth` | `/app/auth/login` | `verified_existing` | Dynamic `/v1/auth/providers` gating; truthful guest local-only state (`C13`). |
| `CAP-05` Rapid 4-Skill Diagnostic | FR-038–040 | `GLB`, `IRN` | `/diagnostic/intro`, `/diagnostic/session`, `/diagnostic/result` | `/app/diagnostic/intro`, `/app/diagnostic/session/$diagId`, `/app/diagnostic/result/$diagId` | `confirmed_fixed` | Consistent ~10m (15m standard cap) copy (`C04`); Persian observation localization & Assess/Retake labels (`W08`). |
| `CAP-06` Home / Study Room | FR-055–057 | `GLB`, `IRN` | `/home` | `/app/home` | `confirmed_fixed` | Truthful `"Not assessed yet"` when unassessed (`C10`); bounded due vocab batch (`C06`). |
| `CAP-07` Durnama & Step-by-Step Roadmap | FR-056 | `GLB`, `IRN` | `/roadmap` | `/app/roadmap` | `verified_existing` | Natural `stepOrder` sorting, pin/skip/complete semantics, shared route resolver. |
| `CAP-08` Practice Hub & Skill Setup | FR-009–033 | `GLB`, `IRN` | `/practice`, `/practice/setup/:skill` | `/app/practice` | `confirmed_fixed` | Skill-specific Exam/Study mode descriptions fixed for Reading/Listening/Writing/Speaking (`M08`). |
| `CAP-09` Reading Simulator & Annotations | FR-025–029 | `GLB`, `IRN` | `/practice/reading/:packId` | `/app/practice/reading/$packId` | `confirmed_fixed` | Split pane + `PassageAnnotatorPane` highlights/notes on Web; Exam Mode lock once started (`C21`). |
| `CAP-10` Listening Simulator | FR-030–033 | `GLB`, `IRN` | `/practice/listening/:packId` | `/app/practice/listening/$packId` | `confirmed_fixed` | `[GAP]` rendered as visual blank (`W16`); LTR audio clock (`L02`); Exam Mode lock (`C21`). |
| `CAP-11` Writing Simulator (11 Task Types) | FR-015–019 | `GLB`, `IRN` | `/practice/writing/:packId` | `/app/practice/writing/$packId` | `confirmed_fixed` | SVG title/legend overlap prevention on both Flutter & Web (`C15`); LTR word count (`L02`); empty submit guard (`C22`). |
| `CAP-12` Speaking Simulator (Multi-Turn) | FR-009–014 | `GLB`, `IRN` | `/practice/speaking/:packId` | `/app/practice/speaking/$packId` | `confirmed_fixed` | Per-question turn parsing & 1-based Part 2 prep timing parity on Web (`C07`); mic permission gate on Flutter (`M12`); empty submit guard (`C22`). |
| `CAP-13` Full Mock Exam | FR-009–033 | `GLB`, `IRN` | `/practice/full-mock` | `/app/practice/full-mock`, `/app/practice/full-mock/$mockId` | `confirmed_fixed` | Removed duplicate mode toggle & raw `seed-01` IDs (`W14`, `L06`). |
| `CAP-14` Micro-Drills | FR-025–033 | `GLB`, `IRN` | `/practice/drills` | `/app/practice/drills`, `/app/practice/drills/$drillId` | `confirmed_fixed` | De-duplicated recommended hero drill from grid (`W13`). |
| `CAP-15` Smart Coach Hub & Daily Mission | FR-051–054 | `GLB`, `IRN` | `/coach`, `/mission/:id` | `/app/coach`, `/app/mission/$missionId` | `verified_existing` | Full 3-stage Daily Mission route exists on both clients. |
| `CAP-16` Register Shifter | FR-052 | `GLB`, `IRN` | `/register-shifter` | `/app/register-shifter`, `/app/register-shifter/$runId` | `verified_existing` | Full text/audio 3-register route exists on both clients. |
| `CAP-17` Drop Anything | FR-053 | `GLB`, `IRN` | `/drop` | `/app/drop`, `/app/drop/drill/$dropId` | `verified_existing` | Full URL/text/image/audio ingestion + drill route exists on both clients. |
| `CAP-18` Error DNA / Linguistic Graph | FR-054 | `GLB`, `IRN` | `/progress/graph` | `/app/progress/graph` | `confirmed_fixed` | Raw `favorite_topics` phase chip localized on Flutter (`L06`, `M24`). |
| `CAP-19` Vocabulary Deck & SM-2 Review | FR-034–037, FR-058 | `GLB`, `IRN` | `/vocabulary`, `/vocabulary/review` | `/app/vocabulary`, `/app/vocabulary/review`, `/app/vocabulary/$wordId` | `confirmed_fixed` | Seeded unseen cards separated from due reviews (`C06`); centered focused desktop flashcard (`W20`). |
| `CAP-20` Progress, Filters, Compare & Navia | FR-055, IRN-FR-007 | `GLB`, `IRN` | `/progress`, `/progress/skill/:skill`, `/progress/attempts` | `/app/progress`, `/app/progress/compare` | `confirmed_fixed` | Hidden empty radar polygon (`C10`); 7/30/90/all + clickable skill filters (`W21`); helpful Compare empty state (`W22`); Navia gated on qualifying score with non-official provenance (`C11`). |
| `CAP-21` Settings, Sync & Mic Preflight | FR-041–046, FR-062 | `GLB`, `IRN` | `/settings` | `/app/settings` | `confirmed_fixed` | Truthful guest local-only state, topbar badge, 0-device mic copy & Pro vs Free quota wording (`C03`, `C13`). |
| `CAP-22` Plans & Paywall | FR-005–008, IRN-FR-006 | `GLB`, `IRN` | `/paywall` | `/app/paywall` | `confirmed_fixed` | Exact 10+10/day + 120/150 monthly comparison copy (`C03`), exact IRN 24% quarterly badge (`C18`), guest direct sign-in CTA (`W25`). |
| `CAP-23` Admin Trace Console | FR-063–064 | Ops Web | N/A (Ops-only) | `/app/admin/trace` | `verified_existing` | Role-gated operational surface; zero upstream keys in client bundles. |
