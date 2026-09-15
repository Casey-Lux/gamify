import { describe, expect, it } from 'vitest';
import { findBucketIndex, generateBuckets, windowStartIso } from '../../src/lib/utils/date-buckets';

describe('generateBuckets', () => {
  it('generates 30 daily buckets ending with the day containing `now`', () => {
    const now = new Date('2026-01-31T15:00:00.000Z');
    const buckets = generateBuckets('day', now);
    expect(buckets).toHaveLength(30);
    const last = buckets.at(-1)!;
    expect(last.start.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(last.end.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    const first = buckets[0]!;
    expect(first.start.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('generates 12 weekly buckets aligned to Monday', () => {
    // 2026-01-31 is a Saturday.
    const now = new Date('2026-01-31T00:00:00.000Z');
    const buckets = generateBuckets('week', now);
    expect(buckets).toHaveLength(12);
    for (const bucket of buckets) {
      expect(bucket.start.getUTCDay()).toBe(1); // Monday
      const spanMs = bucket.end.getTime() - bucket.start.getTime();
      expect(spanMs).toBe(7 * 24 * 60 * 60 * 1000);
    }
  });

  it('generates 12 monthly buckets aligned to the 1st, ending with the current month', () => {
    const now = new Date('2026-03-15T00:00:00.000Z');
    const buckets = generateBuckets('month', now);
    expect(buckets).toHaveLength(12);
    const last = buckets.at(-1)!;
    expect(last.start.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(last.end.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('never leaves a gap between consecutive buckets', () => {
    for (const granularity of ['day', 'week', 'month'] as const) {
      const buckets = generateBuckets(granularity, new Date('2026-06-15T00:00:00.000Z'));
      for (let i = 1; i < buckets.length; i++) {
        expect(buckets[i]!.start.getTime()).toBe(buckets[i - 1]!.end.getTime());
      }
    }
  });
});

describe('findBucketIndex', () => {
  const now = new Date('2026-01-31T00:00:00.000Z');
  const buckets = generateBuckets('day', now);

  it('finds the bucket containing a date inside the window', () => {
    const idx = findBucketIndex(buckets, '2026-01-31T12:00:00.000Z');
    expect(idx).toBe(buckets.length - 1);
  });

  it('returns -1 for a date before the window', () => {
    const idx = findBucketIndex(buckets, '2020-01-01T00:00:00.000Z');
    expect(idx).toBe(-1);
  });

  it('returns -1 for a date after the window', () => {
    const idx = findBucketIndex(buckets, '2030-01-01T00:00:00.000Z');
    expect(idx).toBe(-1);
  });

  it('treats the bucket end as exclusive', () => {
    const idx = findBucketIndex(buckets, buckets[0]!.end.toISOString());
    expect(idx).toBe(1);
  });
});

describe('windowStartIso', () => {
  it('matches the start of the first generated bucket', () => {
    const now = new Date('2026-01-31T00:00:00.000Z');
    const buckets = generateBuckets('week', now);
    expect(windowStartIso('week', now)).toBe(buckets[0]!.start.toISOString());
  });
});
