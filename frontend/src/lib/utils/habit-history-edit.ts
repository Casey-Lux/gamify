import { HABIT_HISTORY_EDIT_DAYS } from '$lib/types/habits';
import { addDays } from './habit-schedule';

/**
 * Which dates of a habit's history can be edited (added or moved). Mirrors
 * `habit_date_is_editable` in supabase/migrations/0029 — the database is the
 * authority and re-checks every edit; this only decides what the UI offers.
 */
export interface EditableRange {
  from: string;
  to: string;
}

/** Earliest day a habit ever had a schedule (null when there is none yet). */
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
