import { describe, expect, it } from 'vitest';
import { validateHabitInput, HabitApiError, type HabitInput } from '../../src/lib/api/habits';
import { cumulativeByBucket } from '../../src/lib/utils/statistics-aggregate';
import { generateBuckets } from '../../src/lib/utils/date-buckets';

const valid: HabitInput = {
  title: ' Meditar ',
  description: '',
  skillId: 's1',
  areaId: null,
  difficulty: 'EASY',
  xpReward: 10,
  coinReward: 5,
  daily: true,
  days: [],
  dayPart: 'ANYTIME',
  reminderTime: '',
  adaptive: true
};

describe('validateHabitInput', () => {
  it('daily ignores the day list and uses all seven days', () => {
    const v = validateHabitInput(valid);
    expect(v.days).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(v.title).toBe('Meditar');
    expect(v.description).toBeNull();
    expect(v.reminderTime).toBeNull();
  });

  it('custom weekly schedule is sorted and deduplicated; reminder gets seconds', () => {
    const v = validateHabitInput({
      ...valid,
      daily: false,
      days: [5, 1, 1],
      reminderTime: '07:30'
    });
    expect(v.days).toEqual([1, 5]);
    expect(v.reminderTime).toBe('07:30:00');
  });

  it('rejects a missing title, no days, and bad rewards', () => {
    expect(() => validateHabitInput({ ...valid, title: '  ' })).toThrow(HabitApiError);
    expect(() => validateHabitInput({ ...valid, daily: false, days: [] })).toThrow(/día/);
    expect(() => validateHabitInput({ ...valid, xpReward: -1 })).toThrow(HabitApiError);
    expect(() => validateHabitInput({ ...valid, skillId: '' })).toThrow(HabitApiError);
  });
});

describe('cumulativeByBucket', () => {
  it('accumulates from a baseline and never decreases', () => {
    const buckets = generateBuckets('day', new Date(Date.UTC(2026, 9, 6, 12)));
    const last = buckets[buckets.length - 1]!;
    const prev = buckets[buckets.length - 2]!;
    const out = cumulativeByBucket(
      buckets,
      [
        { date: prev.start.toISOString(), value: 10 },
        { date: last.start.toISOString(), value: 5 }
      ],
      100
    );
    expect(out[0]).toBe(100);
    expect(out[out.length - 2]).toBe(110);
    expect(out[out.length - 1]).toBe(115);
  });
});
