# Phase 6 Specification: PTE Academic & Phoneme Assessment Engine (Epic X4.2)

---

## 1. Executive Summary & Market Fit

The Pearson Test of English (PTE Academic) is widely accepted for university admissions and skilled immigration in Australia, the United Kingdom, Canada, and New Zealand. Unlike IELTS which relies heavily on human examiner grading, PTE Academic is 100% computer-automated.

Mockza's Phase 6 extension (Epic X4.2) introduces first-class PTE Academic test simulations, powered by a fine-grained phoneme-level acoustic model for automated pronunciation and oral fluency assessment.

---

## 2. PTE Question Types & Test Specifications

### Part 1: Speaking & Writing (54–67 Minutes)
1. **Read Aloud (RA)**:
   - 30–40s preparation, read a 60-word passage out loud into microphone.
   - Evaluated on: Content (word matching), Pronunciation (phoneme accuracy), Oral Fluency.
2. **Repeat Sentence (RS)**:
   - Listen to 3–9s sentence (played once), immediately repeat verbatim.
   - Strict sequence and memory retention scoring.
3. **Describe Image (DI)**:
   - 25s preparation to view bar chart, line graph, map, or process diagram.
   - 40s continuous spoken analysis.
4. **Re-tell Lecture (RL)**:
   - 60–90s lecture track with accompanying graphic.
   - 40s spoken summary of core concepts.
5. **Answer Short Question (ASQ)**:
   - Simple 1-word or short-phrase general knowledge spoken answers.
6. **Summarize Written Text (SWT)**:
   - 10-minute timer: read 300-word passage, write a single-sentence summary (5–75 words).
7. **Write Essay (WE)**:
   - 20-minute timer: 200–300 word argumentative essay.

### Part 2 & 3: Reading & Listening
- Multiple Choice (Single & Multiple Answer), Re-order Paragraphs, Reading Fill in the Blanks, Summarize Spoken Text (SST), Write From Dictation (WFD).

---

## 3. Automated Phoneme Assessment Pipeline

```
[Student Audio Stream (16kHz WAV)]
              │
              ▼
1. Acoustic Preprocessing (Voice Activity Detection + Noise Gate)
              │
              ▼
2. Phoneme Forced Alignment (CTC / Wav2Vec2-XLSR-53 fine-tuned on Timit/VoxCeleb)
              │
              ▼
3. IPA Phoneme Distance Calculation (Levenshtein distance against reference phonetic transcript)
              │
              ├── Pronunciation Score: 10–90 GSE based on phonemic substitution/insertion/deletion rates
              ├── Fluency Score: 10–90 GSE based on hesitation pauses, syllables/second, and run length
              └── Content Score: 10–90 GSE based on recognized keyword coverage
```

---

## 4. GSE 10–90 Band Mapping & Score Conversion

```
Pearson GSE Score  │  IELTS Equivalent Band
───────────────────┼───────────────────────
       84–90       │         9.0
       76–83       │         8.0 – 8.5
       66–75       │         7.0 – 7.5
       56–65       │         6.0 – 6.5
       46–55       │         5.0 – 5.5
       36–45       │         4.0 – 4.5
       10–35       │         0.0 – 3.5
```
