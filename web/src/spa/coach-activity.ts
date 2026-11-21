import type { AppDependencies } from '@/spa/deps';

/**
 * Logs Smart Coach study activity into the local DailyStudyLog table so streaks,
 * today's study minutes, and weekly rings update automatically on Web.
 */
export async function recordCoachStudyActivity(
  deps: Pick<AppDependencies, 'attemptStore' | 'clock'>,
  addSeconds: number,
  addCompletedItems = 1,
): Promise<void> {
  try {
    await deps.attemptStore.incrementDailyStudyLog({
      serialDay: deps.clock.todaySerialDay(),
      addSeconds,
      addCompletedItems,
    });
  } catch {
    // Non-fatal in headless or isolated test harnesses.
  }
}
