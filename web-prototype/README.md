# Mockza and Sanjia desktop web prototype

Open [Mockza](index.html) or [Sanjia](sanjia.html) in a browser. The two entry files share one implementation in plain HTML, CSS, and JavaScript. Fonts, artwork, and audio are bundled locally.

## Walk through the prototype

- Start with the AI feedback examples on the landing page. In Writing, select highlighted phrases and compare the original with a suggested revision. In Speaking, play the clip or select a transcript line to hear that moment and read the linked feedback.
- Open the Sample Report and choose Reading or Listening. Reading shows the source of a missed answer and scores both the answer and supporting line in a new drill. Listening pairs two replayable transcript lines with a slower playback option, then scores a fresh listening question and reveals the transcript. Exam guides link to practice for all five tracks.
- Open the study room. Set a goal, run a four-skill or single-skill level check, or choose a task from the practice catalog.
- Try Study and Exam modes. The four workspaces support answering, audio, writing drafts, microphone recording or a sample response, and review. A full mock advances through all four skills with breaks.
- Follow a review to a drill or a word. Practise recall in the vocabulary queue, reopen past attempts, or compare two attempts.
- Try demo sign-in, the device and appearance settings, data export, and checkout preview. Sanjia’s phone flow displays its own demo code.

The landing displays prewritten feedback and example bands for its original sample responses. The practice app scores objective questions locally and offers self-review for Writing and Speaking. Sign-in, device status, and plan activation are local simulations. A real recording requires browser microphone permission and stays in the browser tab. If your browser blocks the microphone for local files, try the sample response or open the folder from a localhost static server.

Mockza uses an English interface. Sanjia uses Persian RTL, Persian numbers, and Jalali dates in displays. English prompts, answers, and response editors stay LTR. The editions keep separate browser storage.

## Files

- `index.html` and `sanjia.html` select the edition.
- `landing.js` and `landing.css` own the landing and AI feedback demos. `report.js` owns the Reading and Listening reports and their scored drills.
- `public.js` owns public navigation, guides, resources, and the four calculators.
- `study.js` owns setup, preflight, sessions, timing, breaks, and results.
- `app.js` owns navigation, the study room, local state, history, vocabulary, and account previews.
- `data.js` contains the sample tasks and exam metadata.
- `styles.css` defines the shared visual system and layouts.

## References and assets

Navia informed the typography, restrained palette, and use of annotated examples to explain AI feedback. Testinno informed exam discovery, study tools, preflight, the split-pane workspace, and answer review. The interface and sample content were created for this prototype.

[Study notebook artwork](assets/study-notebook.webp) was generated with built-in ImageGen. The Listening practice and Speaking feedback clips are synthetic readings of original transcripts. The Listening report uses an excerpt from the practice recording and a separate synthetic read for the drill. The Inter, Instrument Serif, and Vazirmatn licenses are in `assets/`.

### Artwork prompt

> Photorealistic editorial still life for an elegant independent language-learning website, portrait crop 4:5. Viewed at a slightly oblique overhead angle, a single open ivory study notebook with faint ruled lines and a hand-drawn understated forest-green route with four unlabeled round checkpoints. A quietly tactile muted olive-green closed book peeks underneath and a single dark green pencil lies to its right. All on warm pale cream linen desk surface with late afternoon window light and soft diffuse shadows. Restrained olive, ochre and cream color palette, premium magazine photography with fine paper texture, generous breathing room and the notebook placed towards upper center. No text, letters, numbers, branding, hands, devices, gradients, graphic overlays or border. It should look like an actual photograph made for an exam-prep brand. The bottom quarter should be quiet to support a real UI card rendered separately in HTML.
