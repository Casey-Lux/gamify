import { HABIT_HISTORY_EDIT_DAYS } from '$lib/types/habits';
import { addDays } from './habit-schedule';

export interface EditableRange {
  from: string;
  to: string;
}

export function firstScheduleDay(entries: { effective_from: string }[]): string | null {
  let first: string | null = null;
  for (const e of entries) if (first === null || e.effective_from < first) first = e.effective_from;
  return first;
}

export function editableRange(today: string, firstDay: string | null): EditableRange {
  const windowStart = addDays(today, -HABIT_HISTORY_EDIT_DAYS);
  return { from: firstDay && firstDay > windowStart ? firstDay : windowStart, to: today };
}

export function isEditableDate(date: string, range: EditableRange): boolean {
  return date >= range.from && date <= range.to;
}
