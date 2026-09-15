import { findBucketIndex } from './date-buckets';
import type { StatBucket } from '$lib/types/statistics';

/** Count of `dates` falling into each bucket, aligned index-for-index with `buckets`. */
export function countByBucket(buckets: StatBucket[], dates: string[]): number[] {
  const counts = new Array(buckets.length).fill(0) as number[];
  for (const date of dates) {
    const idx = findBucketIndex(buckets, date);
    if (idx >= 0) counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts;
}

/** Sum of `{ date, value }.value` falling into each bucket. */
export function sumByBucket(
  buckets: StatBucket[],
  entries: { date: string; value: number }[]
): number[] {
  const sums = new Array(buckets.length).fill(0) as number[];
  for (const entry of entries) {
    const idx = findBucketIndex(buckets, entry.date);
    if (idx >= 0) sums[idx] = (sums[idx] ?? 0) + entry.value;
  }
  return sums;
}

/** Groups `rows` by `keyFn(row)`, counting occurrences per key. Used for
 * "actividad por skill" / "actividad por área" (spec section 35), where the
 * X axis is a category, not a time bucket. */
export function groupCount<T>(rows: T[], keyFn: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
