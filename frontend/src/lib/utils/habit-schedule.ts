import { ALL_WEEKDAYS, WEEKDAY_LABEL, type ScheduleEntry } from '$lib/types/habits';

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

export function isoWeekday(dateStr: string): number {
  const dow = parse(dateStr).getDay();
  return dow === 0 ? 7 : dow;
}

export function addDays(dateStr: string, days: number): string {
  const d = parse(dateStr);
  d.setDate(d.getDate() + days);
  return toLocalDateStr(d);
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

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

export function daysInForce(entries: ScheduleEntry[], dateStr: string): number[] | null {
  return entryInForce(entries, dateStr)?.days_of_week ?? null;
}

export function weeklyTargetInForce(entries: ScheduleEntry[], dateStr: string): number | null {
  return entryInForce(entries, dateStr)?.weekly_target ?? null;
}

export function isScheduledOn(entries: ScheduleEntry[], dateStr: string): boolean {
  const entry = entryInForce(entries, dateStr);
  if (!entry || entry.weekly_target != null) return false;
  return entry.days_of_week.includes(isoWeekday(dateStr));
}

export function isDaily(days: number[]): boolean {
  return ALL_WEEKDAYS.every((d) => days.includes(d));
}

export function describeWeeklyTarget(target: number): string {
  return `${target} ${target === 1 ? 'vez' : 'veces'} por semana`;
}

export function describeFrequency(days: number[], weeklyTarget: number | null | undefined): string {
  return weeklyTarget != null ? describeWeeklyTarget(weeklyTarget) : describeDays(days);
}

export function describeDays(days: number[]): string {
  if (isDaily(days)) return 'Todos los días';
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => (WEEKDAY_LABEL[d] ?? '').slice(0, 3))
    .join(', ');
}
