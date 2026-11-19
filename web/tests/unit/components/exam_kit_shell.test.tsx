import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioRecorderAdapter } from '@/adapters/fakes';
import {
  CompactPreflightHeader,
  QuestionPaletteBar,
  SimulatorWorkspaceShell,
  SplitPaneWorkspace,
  clampSplitRatioPercent,
  formatMmSs,
  resolveQuestionPaletteVisualState,
} from '@/components/exam-kit';
import { createTestDependencies } from '@/composition/bootstrap-test';
import { AppDependenciesProvider } from '@/spa/deps';

describe('W3.1 Workspace Chrome, SplitPane, QuestionPaletteBar & CompactPreflight', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn());
    vi.stubGlobal(
      'ResizeObserver',
      class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('formats MM:SS timers, shows urgent alert <=30s, pauses only in Study Mode, and opens ? shortcut legend', () => {
    expect(formatMmSs(90)).toBe('01:30');
    expect(formatMmSs(0)).toBe('00:00');

    const togglePause = vi.fn();
    const requestExit = vi.fn();

    const { rerender } = render(
      <SimulatorWorkspaceShell
        breadcrumb="IELTS Academic · Reading"
        subtitle="Passage 1"
        remainingSeconds={25}
        examMode="exam"
        onRequestExit={requestExit}
        shortcuts={[
          { keys: 'H', description: 'Highlight selection' },
          { keys: 'J / K', description: 'Next / Previous question' },
        ]}
      >
        <input data-testid="dummy-input" />
      </SimulatorWorkspaceShell>,
    );

    const timerChip = screen.getByTestId('workspace-timer-chip');
    expect(timerChip.textContent).toContain('00:25');
    expect(timerChip.getAttribute('data-urgent')).toBe('true');
    expect(screen.queryByTestId('workspace-timer-pause-btn')).toBeNull();

    // Pressing '?' inside an <input> must NOT intercept typing
    const input = screen.getByTestId('dummy-input');
    fireEvent.keyDown(input, { key: '?', shiftKey: true });
    expect(screen.queryByText('Desktop Keyboard Shortcuts')).toBeNull();

    // Pressing '?' outside inputs opens shortcut cheat-sheet modal
    fireEvent.keyDown(window, { key: '?', shiftKey: true });
    expect(screen.getByText('Desktop Keyboard Shortcuts')).toBeTruthy();
    expect(screen.getByText('Highlight selection')).toBeTruthy();

    fireEvent.click(screen.getByTestId('workspace-exit-btn'));
    expect(requestExit).toHaveBeenCalledTimes(1);

    // Study mode exposes Pause Timer control
    rerender(
      <SimulatorWorkspaceShell
        breadcrumb="IELTS Academic · Reading"
        remainingSeconds={600}
        examMode="study"
        isPaused={false}
        onTogglePause={togglePause}
        shortcuts={[{ keys: 'H', description: 'Highlight selection' }]}
      >
        <div>Body</div>
      </SimulatorWorkspaceShell>,
    );

    const pauseBtn = screen.getByTestId('workspace-timer-pause-btn');
    fireEvent.click(pauseBtn);
    expect(togglePause).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('workspace-timer-chip').getAttribute('data-urgent')).toBe('false');
  });

  it('clamps SplitPaneWorkspace ratio 40%–65%, persists to Dexie store, and resets to 50/50 on divider double-click', async () => {
    expect(clampSplitRatioPercent(15)).toBe(40);
    expect(clampSplitRatioPercent(88)).toBe(65);
    expect(clampSplitRatioPercent(0.57)).toBe(57);

    const deps = createTestDependencies({ edition: 'glb' });
    await deps.attemptStore.saveSplitPaneRatio('reading:pack-1', 0.62);

    const onRatioSpy = vi.fn();
    let mountCount = 0;
    function ProbeChild() {
      mountCount += 1;
      return <p data-testid="split-probe-child">Passage Content</p>;
    }

    render(
      <AppDependenciesProvider dependencies={deps}>
        <SplitPaneWorkspace
          viewKey="reading:pack-1"
          initialRatio={0.5}
          leftLabel="Passage"
          rightLabel="Questions"
          leftPane={<ProbeChild />}
          rightPane={<p>Question Items</p>}
          onRatioChange={onRatioSpy}
        />
      </AppDependenciesProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('split-pane-workspace').getAttribute('data-split-percent')).toBe(
        '62',
      );
    });

    const initialMounts = mountCount;
    fireEvent.doubleClick(screen.getByTestId('split-pane-divider'));

    await waitFor(async () => {
      expect(screen.getByTestId('split-pane-workspace').getAttribute('data-split-percent')).toBe(
        '50',
      );
      expect(onRatioSpy).toHaveBeenCalledWith(0.5);
      const saved = await deps.attemptStore.getSplitPaneRatio('reading:pack-1');
      expect(saved.ok && saved.value).toBe(0.5);
    });
    // Resetting split ratio must NOT unmount/remount child panes.
    expect(mountCount).toBe(initialMounts);
  });

  it('keeps QuestionPaletteBar current, answered, current+answered, and flagged states distinct', () => {
    expect(resolveQuestionPaletteVisualState(true, false)).toBe('current');
    expect(resolveQuestionPaletteVisualState(false, true)).toBe('answered');
    expect(resolveQuestionPaletteVisualState(true, true)).toBe('current_answered');
    expect(resolveQuestionPaletteVisualState(false, false)).toBe('unanswered');

    const onSelect = vi.fn();
    const { rerender } = render(
      <QuestionPaletteBar
        activeIndex={0}
        onSelectQuestion={onSelect}
        items={[
          { index: 0, number: 1, isAnswered: false, isFlagged: false },
          { index: 1, number: 2, isAnswered: true, isFlagged: false },
          { index: 2, number: 3, isAnswered: false, isFlagged: true },
        ]}
      />,
    );

    expect(screen.getByTestId('palette-item-1').getAttribute('data-palette-state')).toBe('current');
    expect(screen.getByTestId('palette-item-2').getAttribute('data-palette-state')).toBe('answered');
    expect(screen.getByTestId('palette-check-2')).toBeTruthy();
    expect(screen.getByTestId('palette-item-3').getAttribute('data-palette-state')).toBe(
      'unanswered',
    );
    expect(screen.getByTestId('palette-item-3').getAttribute('data-flagged')).toBe('true');
    expect(screen.getByTestId('palette-flag-3')).toBeTruthy();

    // Selecting answered Q2 gives distinct current_answered state + retains inner check badge
    fireEvent.click(screen.getByTestId('palette-item-2'));
    expect(onSelect).toHaveBeenCalledWith(1);

    rerender(
      <QuestionPaletteBar
        activeIndex={1}
        onSelectQuestion={onSelect}
        items={[
          { index: 0, number: 1, isAnswered: false, isFlagged: false },
          { index: 1, number: 2, isAnswered: true, isFlagged: true },
          { index: 2, number: 3, isAnswered: false, isFlagged: false },
        ]}
      />,
    );

    expect(screen.getByTestId('palette-item-2').getAttribute('data-palette-state')).toBe(
      'current_answered',
    );
    expect(screen.getByTestId('palette-check-2')).toBeTruthy();
    expect(screen.getByTestId('palette-flag-2')).toBeTruthy();
  });

  it('renders CompactPreflightHeader with speaker test, live mic meter, rules popover & mode selector', async () => {
    const deps = createTestDependencies({ edition: 'glb' });
    const fakeMic = deps.audioRecorder as FakeAudioRecorderAdapter;
    fakeMic.setSimulatedPeakRms(0.65);

    const onModeChange = vi.fn();
    const onSpeakerTest = vi.fn();
    const onMicReady = vi.fn();

    render(
      <AppDependenciesProvider dependencies={deps}>
        <CompactPreflightHeader
          title="Rapid Starting-Level Check"
          subtitle="~12 min adaptive calibration"
          selectedMode="standard"
          onModeChange={onModeChange}
          onPlaySpeakerTest={onSpeakerTest}
          onMicStatusReady={onMicReady}
          modeOptions={[
            { value: 'standard', label: 'Standard (900s)' },
            { value: 'extended', label: 'Extended (3x)' },
            { value: 'accessible', label: 'Accessible Audio' },
          ]}
          rulesSummary={[
            'Adaptive Reading and Listening stage transitions automatically.',
            'Writing & Speaking answers save before offline handoff.',
          ]}
        />
      </AppDependenciesProvider>,
    );

    expect(screen.queryByTestId('preflight-rules-popover')).toBeNull();
    fireEvent.click(screen.getByTestId('preflight-rules-toggle'));
    expect(screen.getByTestId('preflight-rules-popover')).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Extended (3x)' }));
    expect(onModeChange).toHaveBeenCalledWith('extended');

    fireEvent.click(screen.getByTestId('preflight-speaker-btn'));
    await waitFor(() => {
      expect(onSpeakerTest).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByTestId('preflight-mic-btn'));
    await waitFor(() => {
      expect(screen.getByText('65%')).toBeTruthy();
      expect(onMicReady).toHaveBeenCalledWith(true);
    });
  });
});
