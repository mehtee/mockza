# Phase 6 Specification: TOEFL iBT & Duolingo English Test (DET) Engine (Epic X4.3)

---

## 1. Executive Summary

To capture broader North American and global university applicant markets, Phase 6 (Epic X4.3) introduces test tracks for:
1. **TOEFL iBT** (Educational Testing Service): 4 sections, 0–120 score scale (0–30 per section).
2. **Duolingo English Test (DET)**: Computer Adaptive Test (CAT) utilizing 1-parameter/2-parameter Item Response Theory (IRT), 10–160 score scale with 4 integrated subscores (Literacy, Comprehension, Conversation, Production).

---

## 2. TOEFL iBT Architecture & Rubrics

### Test Structure (Post-July 2023 2-Hour Format)
- **Reading** (20 questions, 35 minutes): 2 academic passages (~700 words each).
- **Listening** (28 questions, 36 minutes): 3 lectures and 2 campus conversations.
- **Speaking** (4 tasks, 16 minutes):
  - Task 1: Independent Speaking (familiar topic, 15s prep, 45s speech).
  - Tasks 2–4: Integrated Speaking (read passage + listen to audio clip, 30s prep, 60s speech).
- **Writing** (2 tasks, 29 minutes):
  - Task 1: Integrated Writing (read academic passage, listen to lecture refuting points, 20-minute synthesis).
  - Task 2: Writing for an Academic Discussion (10-minute online class forum post, >= 100 words).

### Scoring & Rubric Model
- Evaluated on standard ETS 0–5 raw rubric and mapped to scaled scores (0–30 per section, 0–120 composite).

---

## 3. Duolingo English Test (DET) Computer Adaptive Engine

### Adaptive Testing Loop (Item Response Theory)
Unlike static linear exams, the DET adapts question difficulty in real time based on the learner's latent ability ($\theta$ parameter):

$$\theta_{t+1} = \theta_t + \frac{I(\theta_t)}{\sum I} \cdot (y_t - P(y_t = 1 | \theta_t))$$

```
[Start Session (Prior θ = 0.0)]
          │
          ▼
1. Serve Medium Difficulty Item (b = 0.0)
          │
          ▼
2. Score Response (Correct / Incorrect / Spoken Fluency)
          │
          ▼
3. Update Latent Ability Estimate θ via Newton-Raphson IRT
          │
          ▼
4. Select Next Optimal Item maximizing Fisher Information I(θ)
          │
          ▼
5. Check Stopping Criterion (Standard Error SE(θ) < 0.28 or Max Items Reached)
          │
          ▼
6. Map Final θ to 10–160 Composite & Subscores (Literacy, Comprehension, Conversation, Production)
```

### DET Item Types Supported
1. **Read and Complete**: C-test where missing letters in words within an authentic text are filled in.
2. **Read and Select**: Identify real English words from simulated pseudo-words.
3. **Listen and Select**: Listen to recorded words and identify genuine words.
4. **Listen and Type**: Dictation test with up to 3 replays.
5. **Read Aloud**: Spoken recording of short displayed sentence.
6. **Write About the Photo**: Write 1 or more sentences describing an image within 1 minute.
7. **Speak About the Photo**: 90-second spoken description of an image.
8. **Interactive Reading**: Complete missing sentences in passage, identify highlighted ideas.
9. **Writing & Speaking Sample**: Extended open-ended prompts for university admissions portfolios.
