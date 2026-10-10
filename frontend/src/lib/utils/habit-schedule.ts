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

/** The schedule version in force on `dateStr`, or null before the habit started. */
export function entryInForce(entries: ScheduleEntry[], dateStr: string): ScheduleEntry | null {
  let current: ScheduleEntry | null = null;
  for (const entry of entries) {
    if (
      entry.effective_from <= dateStr &&
      (!current || entry.effective_from >= current.effective_from)
    ) {
      current = entry;
    }
  }
  return current;
}

/** The days_of_week in force on `dateStr`, or null before the habit started. */
export function daysInForce(entries: ScheduleEntry[], dateStr: string): number[] | null {
  return entryInForce(entries, dateStr)?.days_of_week ?? null;
}

/** The "X veces por semana" target in force on `dateStr`, or null when the
 * habit is scheduled by weekdays (or had not started yet). */
export function weeklyTargetInForce(entries: ScheduleEntry[], dateStr: string): number | null {
  return entryInForce(entries, dateStr)?.weekly_target ?? null;
}

/** True when `dateStr` is a concrete scheduled weekday. A habit configured as
 * "X veces por semana" has no concrete days, so this is false for those dates
 * (see utils/habit-weekly.ts for how its days are decided). */
export function isScheduledOn(entries: ScheduleEntry[], dateStr: string): boolean {
  const entry = entryInForce(entries, dateStr);
  if (!entry || entry.weekly_target != null) return false;
  return entry.days_of_week.includes(isoWeekday(dateStr));
}

export function isDaily(days: number[]): boolean {
  return ALL_WEEKDAYS.every((d) => days.includes(d));
}

/** "3 veces por semana". */
export function describeWeeklyTarget(target: number): string {
  return `${target} ${target === 1 ? 'vez' : 'veces'} por semana`;
}

/** Frequency label of a habit: weekly target when set, otherwise its weekdays. */
export function describeFrequency(days: number[], weeklyTarget: number | null | undefined): string {
  return weeklyTarget != null ? describeWeeklyTarget(weeklyTarget) : describeDays(days);
}

/** "Todos los días" or "Lun, Mié, Vie". */
export function describeDays(days: number[]): string {
  if (isDaily(days)) return 'Todos los días';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => (WEEKDAY_LABEL[d] ?? '').slice(0, 3))
    .join(', ');
}
