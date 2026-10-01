import { describe, expect, it } from 'vitest';
import {
  buildDueValue,
  isDueOverdue,
  splitDueValue,
  startOfLocalDay
} from '../../src/lib/utils/due-date';
import { formatDueDate, isOverdue } from '../../src/lib/utils/format';

describe('buildDueValue', () => {
  it('returns no deadline when nothing is chosen', () => {
    expect(buildDueValue('', '')).toEqual({ dueAt: null, dueHasTime: true });
  });

  it('keeps a date-only deadline at local midnight, flagged as having no time', () => {
    const v = buildDueValue('2026-06-15', '');
    expect(v.dueHasTime).toBe(false);
    expect(new Date(v.dueAt!).getTime()).toBe(new Date(2026, 5, 15).getTime());
  });

  it('keeps the chosen time when one is given', () => {
    const v = buildDueValue('2026-06-15', '18:45');
    expect(v.dueHasTime).toBe(true);
    expect(new Date(v.dueAt!).getTime()).toBe(new Date(2026, 5, 15, 18, 45).getTime());
  });

  it('keeps an explicit midnight time distinct from "no time"', () => {
    expect(buildDueValue('2026-06-15', '00:00').dueHasTime).toBe(true);
  });

  it('rejects a time without a date and malformed values', () => {
    expect(() => buildDueValue('', '10:00')).toThrow();
    expect(() => buildDueValue('2026-13-01', '')).toThrow();
    expect(() => buildDueValue('2026-02-30', '')).toThrow();
    expect(() => buildDueValue('2026-06-15', '25:00')).toThrow();
  });
});

describe('splitDueValue', () => {
  it('round-trips date-only and date+time values', () => {
    const dateOnly = buildDueValue('2026-06-15', '');
    expect(splitDueValue(dateOnly.dueAt, dateOnly.dueHasTime)).toEqual({
      date: '2026-06-15',
      time: ''
    });
    const withTime = buildDueValue('2026-06-15', '09:05');
    expect(splitDueValue(withTime.dueAt, withTime.dueHasTime)).toEqual({
      date: '2026-06-15',
      time: '09:05'
    });
    expect(splitDueValue(null, true)).toEqual({ date: '', time: '' });
  });
});

describe('isDueOverdue ("vencida")', () => {
  const NOW = new Date(2026, 5, 15, 14, 30).getTime();

  it('never overdue without a deadline or when completed', () => {
    expect(isDueOverdue(null, null, true, NOW)).toBe(false);
    const past = new Date(2026, 5, 1).toISOString();
    expect(isDueOverdue(past, new Date().toISOString(), true, NOW)).toBe(false);
  });

  it('exact deadline: overdue right after the instant passes', () => {
    const before = new Date(2026, 5, 15, 14, 0).toISOString();
    const after = new Date(2026, 5, 15, 15, 0).toISOString();
    expect(isDueOverdue(before, null, true, NOW)).toBe(true);
    expect(isDueOverdue(after, null, true, NOW)).toBe(false);
  });

  it('date-only deadline: still on time during the whole chosen day', () => {
    const today = new Date(2026, 5, 15).toISOString();
    expect(isDueOverdue(today, null, false, NOW)).toBe(false);
    expect(isDueOverdue(today, null, false, new Date(2026, 5, 15, 23, 59).getTime())).toBe(false);
  });

  it('date-only deadline: overdue from the next day on', () => {
    const yesterday = new Date(2026, 5, 14).toISOString();
    expect(isDueOverdue(yesterday, null, false, NOW)).toBe(true);
    expect(
      isDueOverdue(
        new Date(2026, 5, 15).toISOString(),
        null,
        false,
        new Date(2026, 5, 16, 0, 0).getTime()
      )
    ).toBe(true);
  });

  it('is exposed through format.isOverdue with the same semantics', () => {
    expect(isOverdue(new Date(2026, 5, 15).toISOString(), null, false, NOW)).toBe(false);
  });
});

describe('formatDueDate', () => {
  it('shows no time for a date-only deadline and a time otherwise', () => {
    const iso = new Date(2026, 5, 15, 18, 30).toISOString();
    expect(formatDueDate(iso, false)).not.toMatch(/18:30/);
    expect(formatDueDate(iso, true)).toMatch(/18:30/);
  });
});

describe('startOfLocalDay', () => {
  it('returns local midnight', () => {
    expect(startOfLocalDay(new Date(2026, 5, 15, 23, 59).getTime())).toBe(
      new Date(2026, 5, 15).getTime()
    );
  });
});
