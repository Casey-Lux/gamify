import { describe, expect, it } from 'vitest';
import {
  ADAPTATION_CONFIG,
  computeWeekdayStats,
  habitDayInfo,
  planFromStats
} from '../../src/lib/utils/habit-adaptation';
import { addDays, eachDate, isoWeekday } from '../../src/lib/utils/habit-schedule';

const TODAY = '2026-10-06'; // martes
const DAILY = [{ effective_from: '2026-01-01', days_of_week: [1, 2, 3, 4, 5, 6, 7] }];

/** Completes every day in the lookback EXCEPT the given weekdays. */
function completedExcept(skipWeekdays: number[], keepEvery = 0): string[] {
  const from = addDays(TODAY, -ADAPTATION_CONFIG.windowWeeks * 7);
  let skipped = 0;
  return eachDate(from, addDays(TODAY, -1)).filter((d) => {
    if (!skipWeekdays.includes(isoWeekday(d))) return true;
    skipped += 1;
    return keepEvery > 0 && skipped % keepEvery === 0;
  });
}

describe('planFromStats', () => {
  it('stays REQUIRED without enough samples', () => {
    expect(planFromStats(3, 0)).toBe('REQUIRED');
  });
  it('is REQUIRED at or above the reminder threshold', () => {
    expect(planFromStats(8, 4)).toBe('REQUIRED');
  });
  it('asks for a REMINDER on a weak but not hopeless day', () => {
    expect(planFromStats(8, 3)).toBe('REMINDER');
    expect(planFromStats(4, 0)).toBe('REMINDER'); // not enough samples to relax it yet
  });
  it('relaxes to OPTIONAL only with a clear, well-sampled pattern', () => {
    expect(planFromStats(8, 1)).toBe('OPTIONAL');
    expect(planFromStats(8, 0)).toBe('OPTIONAL');
    expect(planFromStats(5, 0)).toBe('REMINDER');
  });
});

describe('computeWeekdayStats', () => {
  it('detects a day the user never does and leaves the others required', () => {
    const stats = computeWeekdayStats(DAILY, completedExcept([2]), TODAY);
    expect(stats[1]).toMatchObject({ weekday: 2, scheduled: 8, completed: 0, plan: 'OPTIONAL' });
    expect(stats[0]?.plan).toBe('REQUIRED');
    expect(stats[6]?.plan).toBe('REQUIRED');
  });

  it('does not count today as a miss', () => {
    const stats = computeWeekdayStats(DAILY, [], TODAY);
    // 8 previous Tuesdays inside the window, today's is excluded.
    expect(stats[1]?.scheduled).toBe(8);
  });

  it('does not judge a habit that is too new', () => {
    const young = [{ effective_from: addDays(TODAY, -10), days_of_week: [1, 2, 3, 4, 5, 6, 7] }];
    const stats = computeWeekdayStats(young, [], TODAY);
    expect(stats.every((s) => s.plan === 'REQUIRED')).toBe(true);
  });

  it('only evaluates scheduled days (uses the schedule history, not adaptation)', () => {
    const weekdaysOnly = [{ effective_from: '2026-01-01', days_of_week: [1, 3, 5] }];
    const stats = computeWeekdayStats(weekdaysOnly, [], TODAY);
    expect(stats[1]?.scheduled).toBe(0); // Tuesday was never scheduled
    expect(stats[1]?.plan).toBe('REQUIRED');
    expect(stats[0]?.scheduled).toBe(8);
  });

  it('recovers automatically when the user starts doing the day again', () => {
    const recent = eachDate(addDays(TODAY, -28), addDays(TODAY, -1)); // last 4 weeks done
    const older = completedExcept([2]);
    const stats = computeWeekdayStats(DAILY, [...older, ...recent], TODAY);
    expect(stats[1]?.completed).toBe(4);
    expect(stats[1]?.plan).toBe('REQUIRED');
  });
});

describe('habitDayInfo', () => {
  it('ignores the adaptation when the habit is not adaptive', () => {
    const info = habitDayInfo({ adaptive: false }, DAILY, completedExcept([2]), TODAY);
    expect(info.plan).toBe('REQUIRED');
    expect(info.scheduledToday).toBe(true);
  });
  it('reports today as done and OPTIONAL for an adaptive weak day', () => {
    const info = habitDayInfo({ adaptive: true }, DAILY, completedExcept([2]), TODAY);
    expect(info.plan).toBe('OPTIONAL');
    expect(info.doneToday).toBe(false);
    expect(habitDayInfo({ adaptive: true }, DAILY, [TODAY], TODAY).doneToday).toBe(true);
  });
});
