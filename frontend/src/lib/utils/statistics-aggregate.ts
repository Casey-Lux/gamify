import { findBucketIndex } from './date-buckets';
import type { StatBucket } from '$lib/types/statistics';

export function countByBucket(buckets: StatBucket[], dates: string[]): number[] {
  const counts = new Array(buckets.length).fill(0) as number[];
  for (const date of dates) {
    const idx = findBucketIndex(buckets, date);
    if (idx >= 0) counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return counts;
}

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

export function groupCount<T>(rows: T[], keyFn: (row: T) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function cumulativeByBucket(
  buckets: StatBucket[],
  entries: { date: string; value: number }[],
  baseline: number
): number[] {
  const perBucket = sumByBucket(buckets, entries);
  let running = baseline;
  return perBucket.map((value) => (running += value));
}
