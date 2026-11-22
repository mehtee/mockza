import { createMemoryHistory } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDependencies } from '@/composition/bootstrap-test';
import type { VocabCardRecord } from '@/gateways/storage.gateway';
import { DesktopSimulatorApp } from '@/spa/DesktopSimulatorApp';
import { createAppRouter } from '@/spa/router';

function makeSeededCards(count: number, nowMs: number): VocabCardRecord[] {
  const list: VocabCardRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    list.push({
      cardId: `seed-card-${i + 1}`,
      examId: 'ielts_academic',
      headword: i === 0 ? 'ubiquitous' : `lexeme-${i + 1}`,
      ipa: i === 0 ? '/juːˈbɪk.wɪ.təs/' : null,
      definition: i === 0 ? 'Present, appearing, or found everywhere.' : `Academic term #${i + 1}`,
      glossFa: i === 0 ? 'همه‌جایی و فراگیر' : `معنی فارسی ${i + 1}`,
      topicTag: i % 2 === 0 ? 'environment' : 'technology',
      sourceKind: 'seeded',
      tags: ['ielts'],
      contextSentence: 'Smart meters have become ubiquitous in modern grids.',
      paraphraseHints: ['omnipresent', 'pervasive'],
      usageNote: 'Common formal adjective.',
      sourceSkill: null,
      sourceAttemptId: null,
      sourceRefLabel: null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });
  }
  return list;
}

describe('W6.2 Virtualized SM-2 Vocabulary Hub, Keyboard Review & Detail', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('virtualizes 330+ cards, filters Mistake-to-Deck, and navigates to Word Detail (GLB)', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const nowMs = deps.clock.nowMs();
    await deps.vocabStore.upsertSeededDeckPreservingSrs(makeSeededCards(330, nowMs));
    await deps.vocabStore.upsertMistakeCard({
      cardId: 'mistake-1',
      examId: 'ielts_academic',
      headword: 'mitigate',
      ipa: '/ˈmɪt.ɪ.ɡeɪt/',
      definition: 'Reduce the severity of harm.',
      glossFa: 'کاهش دادن',
      topicTag: 'policy',
      sourceKind: 'mistake_to_deck',
      tags: ['writing'],
      contextSentence: 'Public transit helps mitigate congestion.',
      paraphraseHints: ['alleviate'],
      usageNote: null,
      sourceSkill: 'writing',
      sourceAttemptId: 'att-1',
      sourceRefLabel: 'Writing Task 2',
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    });

    const history = createMemoryHistory({ initialEntries: ['/app/vocabulary'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      // Progressive Wave 1 unlocks exactly 15 priority cards (saved mistake card + 14 top wave cards) out of 331 total
      expect(screen.getByTestId('vocab-total-counter').textContent).toBe('15 / 331');
    });

    // Expand all waves to verify 330+ virtualized list performance (< 40 DOM rows)
    fireEvent.click(screen.getByTestId('vocab-preview-all-waves'));
    await waitFor(() => {
      expect(screen.getByTestId('vocab-total-counter').textContent).toBe('331 / 331');
    });

    // Virtualizer only materializes viewport rows (far fewer than 331 DOM nodes!)
    const renderedRows = document.querySelectorAll('[data-testid^="vocab-row-"]').length;
    expect(renderedRows).toBeGreaterThan(0);
    expect(renderedRows).toBeLessThan(40);

    // Filter My Saved Mistakes -> shows only "mitigate"
    fireEvent.click(screen.getByRole('tab', { name: 'My Saved Mistakes' }));
    await waitFor(() => {
      expect(screen.getByTestId('vocab-row-mistake-1')).toBeTruthy();
    });

    // Navigate to Word Detail Inspector
    fireEvent.click(screen.getByTestId('vocab-inspect-mistake-1'));
    await waitFor(() => {
      expect(screen.getByTestId('vocab-word-detail-screen')).toBeTruthy();
      expect(screen.getByTestId('vocab-srs-schedule-card')).toBeTruthy();
    });
    expect(screen.getByText('alleviate')).toBeTruthy();
  });

  it('conducts Space/1-4 keyboard SM-2 review and renders IRN Persian glosses', async () => {
    const deps = createTestDependencies({ edition: 'irn' });
    const nowMs = deps.clock.nowMs();
    await deps.vocabStore.upsertSeededDeckPreservingSrs(makeSeededCards(1, nowMs));

    const history = createMemoryHistory({ initialEntries: ['/app/vocabulary/review'] });
    const router = createAppRouter(history);
    render(<DesktopSimulatorApp router={router} dependencies={deps} />);

    await waitFor(() => {
      expect(screen.getByTestId('vocab-card-headword').textContent).toBe('ubiquitous');
    });

    // Press Space to reveal definition + Persian gloss + SM-2 interval previews
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    await waitFor(() => {
      expect(screen.getByTestId('vocab-card-back')).toBeTruthy();
    });
    expect(screen.getByText('همه‌جایی و فراگیر')).toBeTruthy();
    expect(screen.getByTestId('vocab-rate-easy').textContent).toContain('4');

    // Press '3' (Good) -> persists SM-2 review and shows completion card
    fireEvent.keyDown(window, { key: '3' });
    await waitFor(() => {
      expect(screen.getByTestId('vocab-session-complete')).toBeTruthy();
    });

    const logs = await deps.vocabStore.listVocabReviewLogs();
    expect(logs.ok).toBe(true);
    if (logs.ok) {
      expect(logs.value.length).toBe(1);
      expect(logs.value[0]?.rating).toBe(2);
    }
  });
});
