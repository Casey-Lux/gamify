import { ALL_WEEKDAYS, WEEKDAY_LABEL, type ScheduleEntry } from '$lib/types/habits';

/** `YYYY-MM-DD` of a Date in the user's LOCAL time zone (habits are about
 * the user's own calendar day, never UTC). */
export function toLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parse(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** ISO weekday of a local date string: 1 = lunes ... 7 = domingo. */
export function isoWeekday(dateStr: string): number {
  const dow = parse(dateStr).getDay();
  return dow === 0 ? 7 : dow;
}

export function addDays(dateStr: string, days: number): string {
  const d = parse(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

/** Every date from `from` to `to`, inclusive, oldest first. */
export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The days_of_week in force on `dateStr`, or null before the habit started. */
export function daysInForce(entries: ScheduleEntry[], dateStr: string): number[] | null {
  let current: ScheduleEntry | null = null;
  for (const entry of entries) {
    if (
      entry.effective_from <= dateStr &&
      (!current || entry.effective_from >= current.effective_from)
    ) {
      current = entry;
    }
  }
  return current ? current.days_of_week : null;
}

export function isScheduledOn(entries: ScheduleEntry[], dateStr: string): boolean {
  const days = daysInForce(entries, dateStr);
  return days !== null && days.includes(isoWeekday(dateStr));
}

export function isDaily(days: number[]): boolean {
  return ALL_WEEKDAYS.every((d) => days.includes(d));
}

/** "Todos los días" or "Lun, Mié, Vie". */
export function describeDays(days: number[]): string {
  if (isDaily(days)) return 'Todos los días';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => (WEEKDAY_LABEL[d] ?? '').slice(0, 3))
    .join(', ');
}
