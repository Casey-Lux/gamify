import { describe, expect, it } from 'vitest';
import {
  addDays,
  describeDays,
  eachDate,
  isoWeekday,
  isScheduledOn,
  toLocalDateStr
} from '../../src/lib/utils/habit-schedule';

describe('habit-schedule', () => {
  it('formats local dates and ISO weekdays', () => {
    expect(toLocalDateStr(new Date(2026, 9, 6))).toBe('2026-10-06');
    expect(isoWeekday('2026-10-06')).toBe(2); // martes
    expect(isoWeekday('2026-10-04')).toBe(7); // domingo
    expect(isoWeekday('2026-10-05')).toBe(1); // lunes
  });

  it('adds days across month boundaries and lists ranges', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(eachDate('2026-10-05', '2026-10-07')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07'
    ]);
  });

  it('uses the schedule version in force on each date', () => {
    const schedule = [
      { effective_from: '2026-09-01', days_of_week: [1, 2, 3, 4, 5, 6, 7] },
      { effective_from: '2026-10-01', days_of_week: [1] }
    ];
    expect(isScheduledOn(schedule, '2026-08-31')).toBe(false); // before the habit existed
    expect(isScheduledOn(schedule, '2026-09-29')).toBe(true); // a Tuesday under the old, daily schedule
    expect(isScheduledOn(schedule, '2026-10-06')).toBe(false); // a Tuesday under the new schedule
    expect(isScheduledOn(schedule, '2026-10-05')).toBe(true); // a Monday under the new schedule
  });

  it('describes frequencies', () => {
    expect(describeDays([1, 2, 3, 4, 5, 6, 7])).toBe('Todos los días');
    expect(describeDays([5, 1])).toBe('Lun, Vie');
  });
});
