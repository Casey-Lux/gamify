import { describe, expect, it } from 'vitest';
import { isOverdue, formatDueDate, formatCacheAge } from '../../src/lib/utils/format';

describe('isOverdue', () => {
  it('returns false when there is no due date', () => {
    expect(isOverdue(null, null)).toBe(false);
  });

  it('returns false when the mission is already completed, even if the due date passed', () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString();
    const completedAt = new Date().toISOString();
    expect(isOverdue(pastDate, completedAt)).toBe(false);
  });

  it('returns true for a past due date on a pending mission', () => {
    const pastDate = new Date(Date.now() - 86_400_000).toISOString();
    expect(isOverdue(pastDate, null)).toBe(true);
  });

  it('returns false for a future due date', () => {
    const futureDate = new Date(Date.now() + 86_400_000).toISOString();
    expect(isOverdue(futureDate, null)).toBe(false);
  });
});

describe('formatDueDate', () => {
  it('returns a fixed label when due_at is null', () => {
    expect(formatDueDate(null)).toBe('Sin fecha límite');
  });

  it('formats a real date', () => {
    const result = formatDueDate('2026-01-15T00:00:00.000Z');
    expect(result).not.toBe('Sin fecha límite');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatCacheAge', () => {
  const now = new Date('2026-01-15T12:00:00.000Z').getTime();

  it('reports under a minute for a very recent timestamp', () => {
    const cachedAt = new Date(now - 10_000).toISOString();
    expect(formatCacheAge(cachedAt, now)).toBe('hace menos de un minuto');
  });

  it('reports minutes, singular vs plural', () => {
    expect(formatCacheAge(new Date(now - 60_000).toISOString(), now)).toBe('hace 1 minuto');
    expect(formatCacheAge(new Date(now - 5 * 60_000).toISOString(), now)).toBe('hace 5 minutos');
  });

  it('reports hours once past 60 minutes', () => {
    expect(formatCacheAge(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('hace 3 horas');
  });

  it('reports days once past 24 hours', () => {
    expect(formatCacheAge(new Date(now - 2 * 86_400_000).toISOString(), now)).toBe('hace 2 días');
  });

  it('never reports a negative age for a timestamp in the future (clock skew)', () => {
    const future = new Date(now + 60_000).toISOString();
    expect(formatCacheAge(future, now)).toBe('hace menos de un minuto');
  });
});
