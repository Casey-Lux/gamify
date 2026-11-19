import type { StatBucket, StatGranularity } from '$lib/types/statistics';

const LOOKBACK: Record<StatGranularity, number> = { day: 30, week: 12, month: 12 };

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function mondayOfWeekUTC(d: Date): Date {
  const day = startOfDayUTC(d);
  const dow = day.getUTCDay();
  const diffFromMonday = (dow + 6) % 7;
  day.setUTCDate(day.getUTCDate() - diffFromMonday);
  return day;
}

function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

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

export function findBucketIndex(buckets: StatBucket[], dateIso: string): number {
  const t = new Date(dateIso).getTime();
  return buckets.findIndex((b) => t >= b.start.getTime() && t < b.end.getTime());
}

export function windowStartIso(granularity: StatGranularity, now: Date = new Date()): string {
  const buckets = generateBuckets(granularity, now);
  const first = buckets[0];
  return (first ?? { start: startOfDayUTC(now) }).start.toISOString();
}
