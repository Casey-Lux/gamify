import type { StatBucket, StatGranularity } from '$lib/types/statistics';

/**
 * How far back each granularity looks (spec section 35: "actividad por
 * día/semana/mes" — the spec doesn't pin an exact window, so this picks a
 * fixed, documented lookback per granularity: enough history to see a trend
 * without ever loading an unbounded amount of data. 30 days / 12 weeks /
 * 12 months all show roughly "the last quarter" at their own resolution.
 */
const LOOKBACK: Record<StatGranularity, number> = { day: 30, week: 12, month: 12 };

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday of the week containing `d` (ISO week starts Monday), at UTC
 * midnight. Using "the Monday's date" as the week's identity — rather than
 * an official ISO week *number* — sidesteps ISO week-numbering's own
 * year-boundary edge cases (e.g. Dec 31 sometimes belonging to week 1 of
 * the next year) while still being a stable, sortable, unique key. */
function mondayOfWeekUTC(d: Date): Date {
  const day = startOfDayUTC(d);
  const dow = day.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffFromMonday = (dow + 6) % 7;
  day.setUTCDate(day.getUTCDate() - diffFromMonday);
  return day;
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/**
 * Builds an ordered list of buckets ending at (and including) the bucket
 * containing `now`, oldest first. Every bucket in the window is included
 * even if it will end up with zero activity — a chart with gaps silently
 * skipped would misrepresent "no activity that day" as "that day doesn't
 * exist".
 */
export function generateBuckets(
  granularity: StatGranularity,
  now: Date = new Date()
): StatBucket[] {
  const count = LOOKBACK[granularity];
  const buckets: StatBucket[] = [];

  for (let i = count - 1; i >= 0; i--) {
    let start: Date;
    let end: Date;
    let label: string;

    if (granularity === 'day') {
      start = startOfDayUTC(now);
      start.setUTCDate(start.getUTCDate() - i);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      label = start.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    } else if (granularity === 'week') {
      const thisMonday = mondayOfWeekUTC(now);
      start = new Date(thisMonday);
      start.setUTCDate(start.getUTCDate() - i * 7);
      end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      label = start.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
    } else {
      const thisMonth = startOfMonthUTC(now);
      start = new Date(Date.UTC(thisMonth.getUTCFullYear(), thisMonth.getUTCMonth() - i, 1));
      end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
      label = start.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
    }

    buckets.push({ key: start.toISOString(), label, start, end });
  }

  return buckets;
}

/** Index of the bucket containing `dateIso`, or -1 if it falls outside the
 * whole window (e.g. older than the lookback — those rows are meant to be
 * excluded from the chart, not crash it). */
export function findBucketIndex(buckets: StatBucket[], dateIso: string): number {
  const t = new Date(dateIso).getTime();
  return buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
}

/** ISO timestamp of the start of the whole window — the value to pass as
 * the lower bound of the `completed_at`/`created_at` server-side filter, so
 * we never fetch more history than the chart can show. */
export function windowStartIso(granularity: StatGranularity, now: Date = new Date()): string {
  const buckets = generateBuckets(granularity, now);
  const first = buckets[0];
  return (first ?? { start: startOfDayUTC(now) }).start.toISOString();
}
