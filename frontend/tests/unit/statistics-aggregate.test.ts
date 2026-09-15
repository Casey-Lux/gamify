import { describe, expect, it } from 'vitest';
import { generateBuckets } from '../../src/lib/utils/date-buckets';
import { countByBucket, groupCount, sumByBucket } from '../../src/lib/utils/statistics-aggregate';

describe('countByBucket', () => {
  it('counts dates into their matching bucket, leaving others at zero', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const buckets = generateBuckets('day', now);
    const dates = [
      '2026-01-10T08:00:00.000Z',
      '2026-01-10T20:00:00.000Z',
      '2026-01-09T00:00:00.000Z'
    ];
    const counts = countByBucket(buckets, dates);
    expect(counts.at(-1)).toBe(2);
    expect(counts.at(-2)).toBe(1);
    expect(counts.slice(0, -2).every((c) => c === 0)).toBe(true);
  });

  it('silently drops dates outside the window rather than throwing', () => {
    const buckets = generateBuckets('day', new Date('2026-01-10T00:00:00.000Z'));
    expect(() => countByBucket(buckets, ['1999-01-01T00:00:00.000Z'])).not.toThrow();
  });
});

describe('sumByBucket', () => {
  it('sums values per bucket', () => {
    const now = new Date('2026-01-10T00:00:00.000Z');
    const buckets = generateBuckets('day', now);
    const entries = [
      { date: '2026-01-10T08:00:00.000Z', value: 30 },
      { date: '2026-01-10T20:00:00.000Z', value: 20 }
    ];
    expect(sumByBucket(buckets, entries).at(-1)).toBe(50);
  });
});

describe('groupCount', () => {
  it('groups and counts by an arbitrary key function', () => {
    const rows = [{ skill: 'Fitness' }, { skill: 'Fitness' }, { skill: 'Estudio' }];
    const result = groupCount(rows, (r) => r.skill);
    expect(result.get('Fitness')).toBe(2);
    expect(result.get('Estudio')).toBe(1);
  });

  it('returns an empty map for no rows', () => {
    expect(groupCount([], (r: never) => String(r)).size).toBe(0);
  });
});
