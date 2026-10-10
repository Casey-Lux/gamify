import { describe, expect, it } from 'vitest';
import { planWeekly, weekStartOf } from '../../src/lib/utils/habit-weekly';
import { habitDayInfo } from '../../src/lib/utils/habit-adaptation';
import { isScheduledOn, describeFrequency } from '../../src/lib/utils/habit-schedule';
import { buildHeatmap } from '../../src/lib/utils/habit-heatmap';
import { validateHabitInput } from '../../src/lib/api/habits';
import {
  editableRange,
  firstScheduleDay,
  isEditableDate
} from '../../src/lib/utils/habit-history-edit';
import { invalidate, onInvalidate, versionOf } from '../../src/lib/utils/freshness';
import type { Habit, ScheduleEntry } from '../../src/lib/types/habits';

// 2026-10-05 is a Monday.
const MON = '2026-10-05';
const WED = '2026-10-07';
const THU = '2026-10-08';
const SUN = '2026-10-11';
const ALL = [1, 2, 3, 4, 5, 6, 7];
const WEEKLY3: ScheduleEntry[] = [
  { effective_from: '2026-01-01', days_of_week: ALL, weekly_target: 3 }
];

const base = {
  adaptive: true,
  historyFrom: '2026-08-10'
};

describe('weekStartOf', () => {
  it('returns the Monday of the ISO week', () => {
    expect(weekStartOf(MON)).toBe(MON);
    expect(weekStartOf(SUN)).toBe(MON);
    expect(weekStartOf(THU)).toBe(MON);
  });
});

describe('planWeekly', () => {
  it('spreads the remaining days when there is slack and no history', () => {
    const plan = planWeekly({ ...base, target: 3, completedDates: [], today: MON });
    expect(plan.plannedDates).toEqual([MON, WED, '2026-10-09']);
    expect(plan.scheduledToday).toBe(true);
    expect(plan.progress).toMatchObject({ done: 0, remaining: 3, urgent: false });
  });

  it('prefers the weekdays the user usually completes', () => {
    // Completed on Tuesdays and Thursdays in previous weeks.
    const history = ['2026-09-29', '2026-10-01', '2026-09-22', '2026-09-24'];
    const plan = planWeekly({ ...base, target: 2, completedDates: history, today: MON });
    expect(plan.plannedDates).toEqual(['2026-10-06', THU]);
    expect(plan.scheduledToday).toBe(false);
  });

  it('requires every remaining day once there is no slack (urgent)', () => {
    const plan = planWeekly({
      ...base,
      target: 3,
      completedDates: [MON],
      today: '2026-10-10' // Saturday: 2 left, 2 days remain
    });
    expect(plan.plannedDates).toEqual(['2026-10-10', SUN]);
    expect(plan.progress.urgent).toBe(true);
  });

  it('plans nothing once the weekly target is met', () => {
    const plan = planWeekly({
      ...base,
      target: 2,
      completedDates: [MON, WED],
      today: THU
    });
    expect(plan.plannedDates).toEqual([]);
    expect(plan.scheduledToday).toBe(false);
    expect(plan.progress).toMatchObject({ done: 2, remaining: 0, urgent: false });
  });

  it('keeps today visible (and the plan stable) after completing it', () => {
    const before = planWeekly({ ...base, target: 3, completedDates: [], today: MON });
    const after = planWeekly({ ...base, target: 3, completedDates: [MON], today: MON });
    expect(after.plannedDates).toEqual(before.plannedDates);
    expect(after.doneToday).toBe(true);
    expect(after.scheduledToday).toBe(true);
    expect(after.progress.done).toBe(1);
  });

  it('reminds every remaining day when adaptation is off', () => {
    const plan = planWeekly({
      ...base,
      adaptive: false,
      target: 1,
      completedDates: [],
      today: WED
    });
    expect(plan.plannedDates).toEqual([WED, THU, '2026-10-09', '2026-10-10', SUN]);
  });

  it('does not count completions from previous weeks', () => {
    const plan = planWeekly({
      ...base,
      target: 1,
      completedDates: ['2026-10-04', '2026-10-03'],
      today: MON
    });
    expect(plan.progress.done).toBe(0);
    // Last week's weekend completions only inform WHICH day is preferred.
    expect(plan.plannedDates).toEqual(['2026-10-10']);
  });
});

describe('weekly schedule integration', () => {
  const habit = { adaptive: true } as Pick<Habit, 'adaptive'>;

  it('habitDayInfo exposes weekly progress and always REQUIRED', () => {
    const info = habitDayInfo(habit, WEEKLY3, [MON], WED);
    expect(info.weekly).toMatchObject({ target: 3, done: 1 });
    expect(info.plan).toBe('REQUIRED');
  });

  it('weekly entries have no concrete scheduled days', () => {
    expect(isScheduledOn(WEEKLY3, WED)).toBe(false);
  });

  it('weekday habits keep working exactly as before', () => {
    const daily: ScheduleEntry[] = [{ effective_from: '2026-01-01', days_of_week: ALL }];
    expect(isScheduledOn(daily, WED)).toBe(true);
    expect(habitDayInfo(habit, daily, [], WED).weekly ?? null).toBeNull();
  });

  it('describeFrequency', () => {
    expect(describeFrequency(ALL, 3)).toBe('3 veces por semana');
    expect(describeFrequency(ALL, 1)).toBe('1 vez por semana');
    expect(describeFrequency(ALL, null)).toBe('Todos los días');
  });

  it('heatmap judges a weekly habit per week', () => {
    const h = buildHeatmap(THU, 2, WEEKLY3, [MON, WED]);
    expect(h.mode).toBe('weekly');
    expect(h.scheduled).toBe(6); // 2 weeks x 3
    expect(h.completed).toBe(2);
    const flat = h.weeks.flat();
    expect(flat.find((c) => c.date === MON)?.state).toBe('done');
    expect(flat.find((c) => c.date === '2026-10-06')?.state).toBe('off');
  });
});

describe('validateHabitInput weekly', () => {
  const input = {
    skillId: 's',
    areaId: null,
    title: 'Gym',
    description: '',
    difficulty: 'EASY' as const,
    xpReward: 10,
    coinReward: 5,
    dayPart: 'ANYTIME' as const,
    daily: false,
    days: [1],
    reminderTime: '',
    adaptive: true
  };

  it('uses every weekday when a weekly target is given', () => {
    const v = validateHabitInput({ ...input, weeklyTarget: 3 });
    expect(v.weeklyTarget).toBe(3);
    expect(v.days).toEqual(ALL);
  });

  it('rejects out-of-range targets', () => {
    expect(() => validateHabitInput({ ...input, weeklyTarget: 0 })).toThrow();
    expect(() => validateHabitInput({ ...input, weeklyTarget: 8 })).toThrow();
    expect(() => validateHabitInput({ ...input, weeklyTarget: 2.5 })).toThrow();
  });

  it('leaves weekday habits untouched', () => {
    const v = validateHabitInput(input);
    expect(v.weeklyTarget).toBeNull();
    expect(v.days).toEqual([1]);
  });
});

describe('history edit window', () => {
  it('is limited to 30 days and to the habit lifetime', () => {
    expect(editableRange('2026-10-08', null)).toEqual({ from: '2026-09-08', to: '2026-10-08' });
    const range = editableRange('2026-10-08', '2026-10-01');
    expect(range.from).toBe('2026-10-01');
    expect(isEditableDate('2026-09-30', range)).toBe(false);
    expect(isEditableDate('2026-10-08', range)).toBe(true);
    expect(isEditableDate('2026-10-09', range)).toBe(false);
  });

  it('firstScheduleDay finds the earliest entry', () => {
    expect(
      firstScheduleDay([{ effective_from: '2026-03-02' }, { effective_from: '2026-01-05' }])
    ).toBe('2026-01-05');
    expect(firstScheduleDay([])).toBeNull();
  });
});

describe('freshness bus', () => {
  it('bumps versions and notifies listeners', () => {
    const seen: string[] = [];
    const off = onInvalidate((d) => seen.push(...d));
    const before = versionOf('missions');
    invalidate('missions', 'statistics');
    expect(versionOf('missions')).toBe(before + 1);
    expect(seen).toEqual(['missions', 'statistics']);
    off();
    invalidate('missions');
    expect(seen).toHaveLength(2);
  });
});
