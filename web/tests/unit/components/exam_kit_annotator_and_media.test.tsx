import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioRecorderAdapter } from '@/adapters/fakes';
import {
  AudioStudioPlayer,
  DistractionFreeEssayEditor,
  PassageAnnotatorPane,
  WaveformMicRecorder,
  countEssaySentences,
  countEssayWords,
  extractContextSentence,
  slicePassageSegments,
} from '@/components/exam-kit';
import { createTestDependencies } from '@/composition/bootstrap-test';
import type { PassageAnnotationRecord } from '@/gateways/storage.gateway';
import { AppDependenciesProvider } from '@/spa/deps';

describe('W3.3 PassageAnnotatorPane, EssayEditor, AudioStudioPlayer & WaveformMicRecorder', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('maps DOM selection to canonical UTF-16 offsets, handles highlights/notes/vocab, and scrolls evidence', () => {
    const passage = 'Solar 🌆 expansion lowers grid emissions. Coastal cities adopt microgrids quickly.';
    const startTarget = passage.indexOf('lowers');
    const endTarget = startTarget + 'lowers grid'.length;

    expect(extractContextSentence(passage, startTarget, endTarget)).toBe(
      'Solar 🌆 expansion lowers grid emissions.',
    );

    const initialAnnotations: PassageAnnotationRecord[] = [
      {
        annotationId: 'ann-1',
        packId: 'pack-1',
        passageIndex: 0,
        startOffset: startTarget,
        endOffset: endTarget,
        colorCode: 'mint',
        noteText: 'Key causality verb',
        isDeleted: 0,
        createdAtMs: 1000,
        updatedAtMs: 1000,
      },
    ];

    const segs = slicePassageSegments(passage, initialAnnotations, {
      startOffset: passage.indexOf('microgrids'),
      endOffset: passage.indexOf('microgrids') + 'microgrids'.length,
    });
    expect(segs.some((s) => s.annotation?.annotationId === 'ann-1')).toBe(true);
    expect(segs.some((s) => s.isEvidence && s.text === 'microgrids')).toBe(true);

    const onAdd = vi.fn();
    const onDelete = vi.fn();
    const onSaveVocab = vi.fn();

    render(
      <PassageAnnotatorPane
        title="Passage 1"
        rawText={passage}
        annotations={initialAnnotations}
        evidenceSpan={{
          startOffset: passage.indexOf('microgrids'),
          endOffset: passage.indexOf('microgrids') + 'microgrids'.length,
          label: 'Q1 Evidence',
        }}
        onAddAnnotation={onAdd}
        onDeleteAnnotation={onDelete}
        onSaveToVocab={onSaveVocab}
      />,
    );

    // Existing highlight inspector + delete action
    fireEvent.click(screen.getByTestId('annotation-span-ann-1'));
    expect(screen.getByTestId('annotator-inspector-popover')).toBeTruthy();
    expect(screen.getByText('Key causality verb')).toBeTruthy();
    fireEvent.click(screen.getByTestId('annotator-delete-btn'));
    expect(onDelete).toHaveBeenCalledWith('ann-1');

    // Programmatic DOM Range selection across first text node ("Solar 🌆 expansion ")
    const textBody = screen.getByTestId('passage-text-body');
    const firstTextNode = textBody.querySelector('span')?.firstChild;
    expect(firstTextNode).toBeTruthy();

    const range = document.createRange();
    range.setStart(firstTextNode!, 0);
    range.setEnd(firstTextNode!, 8); // "Solar 🌆" = 8 UTF-16 code units (5 + 1 + 2)
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    fireEvent.mouseUp(textBody);
    expect(screen.getByTestId('annotator-selection-popover')).toBeTruthy();

    // Save selected phrase + context to SM-2 Vocab
    fireEvent.click(screen.getByTestId('annotator-save-vocab-btn'));
    expect(onSaveVocab).toHaveBeenCalledWith(
      expect.objectContaining({
        startOffset: 0,
        endOffset: 8,
        selectedText: 'Solar 🌆',
      }),
    );

    // Trigger highlight again & add Coral highlight with note
    selection.removeAllRanges();
    selection.addRange(range);
    fireEvent.mouseUp(textBody);
    fireEvent.click(screen.getByTestId('annotator-note-toggle'));
    fireEvent.change(screen.getByTestId('annotator-note-input'), {
      target: { value: 'Look at energy example' },
    });
    fireEvent.click(screen.getByTestId('annotator-save-note-btn'));

    expect(onAdd).toHaveBeenCalledWith({
      startOffset: 0,
      endOffset: 8,
      colorCode: 'yellow',
      noteText: 'Look at energy example',
    });
  });

  it('enforces Exam Mode spellcheck/Grammarly lock and single-sentence & word rules in DistractionFreeEssayEditor', () => {
    expect(countEssayWords('  One   two\nthree. ')).toBe(3);
    expect(countEssaySentences('First point. Second point!')).toBe(2);

    const onChange = vi.fn();
    const { rerender } = render(
      <DistractionFreeEssayEditor
        value="Sentence one. Sentence two."
        onChange={onChange}
        examMode="exam"
        minWords={5}
        maxWords={75}
        requiresSingleSentence
        draftSaved
      />,
    );

    const textarea = screen.getByTestId('essay-editor-textarea') as HTMLTextAreaElement;
    expect(textarea.getAttribute('dir')).toBe('ltr');
    expect(textarea.getAttribute('spellcheck')).toBe('false');
    expect(textarea.getAttribute('data-gramm')).toBe('false');
    expect(textarea.getAttribute('data-enable-grammarly')).toBe('false');
    expect(screen.getByTestId('essay-sentence-rule').textContent).toContain('2 detected');
    expect(screen.getByTestId('essay-spellcheck-locked-badge')).toBeTruthy();

    // Study mode unlocks spellcheck and single sentence validates when merged into 1 sentence
    rerender(
      <DistractionFreeEssayEditor
        value="Renewable grid storage reduces peak emissions across cities."
        onChange={onChange}
        examMode="study"
        minWords={5}
        maxWords={75}
        requiresSingleSentence
      />,
    );

    expect(screen.getByTestId('essay-editor-textarea').getAttribute('spellcheck')).toBe('true');
    expect(screen.getByTestId('essay-sentence-rule').textContent).toContain('Single-sentence rule met');
  });

  it('enforces exam_linear_locked vs study_interactive playback, speed cycle & transcript seek in AudioStudioPlayer', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const onEnded = vi.fn();

    const { unmount } = render(
      <AppDependenciesProvider dependencies={deps}>
        <AudioStudioPlayer
          source={{ mediaKey: 'pack-l-1', fallbackUrl: 'https://cdn.mockza.local/l1.m4a' }}
          playbackMode="exam_linear_locked"
          transcriptSegments={[{ id: 'seg1', startSec: 12, text: 'Welcome to the lecture.' }]}
          onEnded={onEnded}
        />
      </AppDependenciesProvider>,
    );

    const playBtn = (await screen.findByTestId('audio-play-pause-btn')) as HTMLButtonElement;
    await waitFor(() => expect(playBtn.disabled).toBe(false));

    expect(screen.getByTestId('audio-exam-locked-badge')).toBeTruthy();
    expect(screen.queryByTestId('audio-transcript-panel')).toBeNull();
    expect((screen.getByTestId('audio-seek-slider') as HTMLInputElement).disabled).toBe(true);

    // Single linear play -> reaches ended -> locks replay in exam mode
    fireEvent.click(playBtn);
    await waitFor(() => {
      expect(onEnded).toHaveBeenCalled();
      expect(playBtn.disabled).toBe(true);
    });

    unmount();

    // Study Interactive mode unlocks speed cycle (1x -> 1.25x -> 0.85x) & clickable transcript
    render(
      <AppDependenciesProvider dependencies={deps}>
        <AudioStudioPlayer
          source={{ mediaKey: 'pack-l-1', fallbackUrl: 'https://cdn.mockza.local/l1.m4a' }}
          playbackMode="study_interactive"
          transcriptSegments={[{ id: 'seg1', startSec: 12, text: 'Welcome to the lecture.' }]}
        />
      </AppDependenciesProvider>,
    );

    const speedBtn = await screen.findByTestId('audio-speed-btn');
    await waitFor(() => expect((screen.getByTestId('audio-seek-slider') as HTMLInputElement).disabled).toBe(false));
    expect(speedBtn.textContent).toBe('1x');
    fireEvent.click(speedBtn);
    await waitFor(() => expect(speedBtn.textContent).toBe('1.25x'));

    fireEvent.click(screen.getByTestId('transcript-segment-seg1'));
    await waitFor(() => expect(screen.getByTestId('audio-current-time').textContent).toBe('00:12'));
  });

  it('records audio via IAudioRecorderGateway, emits RecordedClip & flags muted mic warning', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const fakeRecorder = deps.audioRecorder as FakeAudioRecorderAdapter;
    fakeRecorder.setSimulatedPeakRms(0); // trigger muted mic warning

    const onComplete = vi.fn();

    render(
      <AppDependenciesProvider dependencies={deps}>
        <WaveformMicRecorder
          maxDurationSec={45}
          onRecordingComplete={onComplete}
        />
      </AppDependenciesProvider>,
    );

    fireEvent.click(screen.getByTestId('recorder-start-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('waveform-mic-recorder').getAttribute('data-recording')).toBe('true');
      expect(screen.getByTestId('recorder-stop-btn')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('recorder-stop-btn'));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          strippedContentType: fakeRecorder.activeContentType,
          isMutedWarning: true,
        }),
      );
      expect(screen.getByText(/No microphone signal detected/)).toBeTruthy();
    });
  });
});
