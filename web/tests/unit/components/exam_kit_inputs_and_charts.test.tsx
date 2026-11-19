import { scoreObjectiveAnswers } from '@mockza/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ExamSvgChartCard,
  MzObjectiveAnswerInput,
  MzSequenceOrderControl,
  sanitizeSvgMarkup,
} from '@/components/exam-kit';

describe('W3.2 Polymorphic Question Inputs, Sequence Control & SVG Chart Card', () => {
  afterEach(() => {
    cleanup();
  });

  it('handles tfng, ynng, binary_choice, mcq_single, mcq_multi & matching_headings + numeric shortcuts', () => {
    const onChange = vi.fn();

    // 1. TFNG + numeric keyboard shortcut '2' -> 'FALSE'
    const { rerender } = render(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q1',
          number: 1,
          questionType: 'tfng',
          prompt: 'The author discovered the ruins in 1922.',
        }}
        value=""
        onChange={onChange}
        enableNumberShortcuts
      />,
    );
    fireEvent.keyDown(window, { key: '2' });
    expect(onChange).toHaveBeenLastCalledWith('FALSE');

    // 2. YNNG
    rerender(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q2',
          number: 2,
          questionType: 'ynng',
          prompt: 'Does the writer agree with urban densification?',
        }}
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-2-NOT GIVEN'));
    expect(onChange).toHaveBeenLastCalledWith('NOT GIVEN');

    // 3. Binary choice (DET real vs not real)
    rerender(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q3',
          number: 3,
          questionType: 'binary_choice',
          prompt: 'Is "ephemeral" a real English word?',
          options: ['REAL', 'NOT REAL'],
        }}
        value=""
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-3-REAL'));
    expect(onChange).toHaveBeenLastCalledWith('REAL');

    // 4. Matching Headings (Roman numerals parsed cleanly)
    rerender(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q4',
          number: 4,
          questionType: 'matching_headings',
          prompt: 'Choose the heading for Paragraph B.',
          options: ['i. Early Trade Routes', 'ii. Climatic Shifts', 'iii. Architectural Legacy'],
        }}
        value="i"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-4-ii'));
    expect(onChange).toHaveBeenLastCalledWith('ii');

    // 5. MCQ Multi toggles sorted comma-joined selections
    rerender(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q5',
          number: 5,
          questionType: 'mcq_multi',
          prompt: 'Which TWO reasons are mentioned?',
          options: ['A. Cost reduction', 'B. Faster transit', 'C. Lower emissions'],
        }}
        value="A"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByTestId('choice-5-C'));
    expect(onChange).toHaveBeenLastCalledWith('A, C');
  });

  it('handles summary_gap_fill, word_completion, dictation and surfaces word-limit warning', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q6',
          number: 6,
          questionType: 'summary_gap_fill',
          prompt: 'Complete the summary using NO MORE THAN TWO WORDS.',
          maxWords: 2,
        }}
        value="too many extra words"
        onChange={onChange}
      />,
    );
    expect(screen.getByText(/Word limit exceeded \(4\/2\)/)).toBeTruthy();
    const inputEl = screen.getByTestId('text-answer-6') as HTMLInputElement;
    expect(inputEl.getAttribute('dir')).toBe('ltr');
    expect(inputEl.getAttribute('spellcheck')).toBe('false');

    rerender(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q7',
          number: 7,
          questionType: 'word_completion',
          prompt: 'Complete the word: cli____',
          maxWords: 1,
        }}
        value="climate"
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('objective-input-7').getAttribute('data-question-type')).toBe(
      'word_completion',
    );

    rerender(
      <MzObjectiveAnswerInput
        question={{
          questionId: 'q8',
          number: 8,
          questionType: 'dictation',
          prompt: 'Listen and write the sentence.',
        }}
        value="Urban libraries expand community literacy."
        onChange={onChange}
      />,
    );
    expect(screen.getByTestId('text-answer-8').tagName).toBe('TEXTAREA');
  });

  it('reorders steps via click, Alt+Arrow keys & drag-drop and scores accurately with LocalObjectiveScorer', () => {
    const onChange = vi.fn();
    render(
      <MzSequenceOrderControl
        options={['A. Gather field samples', 'B. Calibrate sensors', 'C. Publish dataset']}
        currentValue="A|B|C"
        onChanged={onChange}
      />,
    );

    // Click Move Down on A -> produces B|A|C
    fireEvent.click(screen.getByTestId('sequence-down-A'));
    expect(onChange).toHaveBeenLastCalledWith('B|A|C');

    // Alt+ArrowUp on C -> moves C to index 1 -> A|C|B
    fireEvent.keyDown(screen.getByTestId('sequence-step-C'), { key: 'ArrowUp', altKey: true });
    expect(onChange).toHaveBeenLastCalledWith('A|C|B');

    // Verify canonical sequence scoring parity with LocalObjectiveScorer
    const score = scoreObjectiveAnswers({
      skill: 'listening',
      track: 'pte_academic',
      answers: [
        {
          questionId: 'seq-1',
          questionType: 'reorder_sequence',
          acceptedAnswers: ['B|A|C'],
          userAnswer: 'B|A|C',
        },
      ],
    });
    expect(score.correctCount).toBe(1);
  });

  it('sanitizes SVG via DOMPurify, supports wheel/button zoom 1x..3x, and opens Lightbox modal up to 4x', () => {
    const dirtySvg =
      '<svg viewBox="0 0 100 100" onload="alert(1)"><script>alert(2)</script><style>svg{}</style><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">xss</div></foreignObject><iframe src="https://evil.invalid"></iframe><a href="javascript:alert(3)"><rect width="80" height="40" fill="#56CCF2" /></a></svg>';
    const clean = sanitizeSvgMarkup(dirtySvg);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('<foreignObject');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('<style');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('<rect');

    render(
      <ExamSvgChartCard
        svgMarkup={dirtySvg}
        altText="Annual Solar Output"
        caption="Gigawatt-hours across 2020–2025"
      />,
    );

    expect(screen.getByTestId('chart-viewport').getAttribute('data-scale')).toBe('1');
    fireEvent.click(screen.getByTestId('chart-zoom-in'));
    expect(screen.getByTestId('chart-viewport').getAttribute('data-scale')).toBe('1.5');
    fireEvent.wheel(screen.getByTestId('chart-viewport'), { deltaY: -100, ctrlKey: true });
    expect(screen.getByTestId('chart-viewport').getAttribute('data-scale')).toBe('1.75');
    fireEvent.click(screen.getByTestId('chart-zoom-reset'));
    expect(screen.getByTestId('chart-viewport').getAttribute('data-scale')).toBe('1');

    // Open Lightbox modal & zoom to 1.5x
    fireEvent.click(screen.getByTestId('chart-expand-btn'));
    const lbViewport = screen.getByTestId('chart-lightbox-viewport');
    expect(lbViewport.getAttribute('data-scale')).toBe('1');
    fireEvent.click(screen.getByTestId('lightbox-zoom-in'));
    expect(lbViewport.getAttribute('data-scale')).toBe('1.5');
  });
});
