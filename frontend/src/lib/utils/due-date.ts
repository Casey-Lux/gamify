/**
 * Mission deadline helpers. A deadline is either
 *   - a date only  (dueHasTime = false): the user picked a day and NO time —
 *     `due_at` holds that day's local midnight purely as a sortable anchor,
 *     and the app never displays or assumes a time for it; or
 *   - a date + time (dueHasTime = true): an exact instant.
 * Everything here works in the browser's local time zone, because that is
 * what the calendar / time inputs show the user.
 */

export interface DueParts {
  /** `YYYY-MM-DD` (the value of an `<input type="date">`), or ''. */
  date: string;
  /** `HH:MM` (the value of an `<input type="time">`), or ''. */
  time: string;
}

export interface DueValue {
  dueAt: string | null;
  dueHasTime: boolean;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local midnight of the day containing `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Form inputs -> the two values persisted in Supabase. Returns `null` due_at
 * for "sin fecha límite". A time without a date is rejected (there is no
 * sensible reading of it); a date without a time stays date-only.
 */
export function buildDueValue(date: string, time: string): DueValue {
  const d = date.trim();
  const t = time.trim();

  if (d === '') {
    if (t !== '') throw new Error('Elige una fecha antes de indicar una hora.');
    return { dueAt: null, dueHasTime: true };
  }

  const dm = DATE_RE.exec(d);
  if (!dm) throw new Error('La fecha límite no es válida.');
  const [year, month, day] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];

  if (t === '') {
    const local = new Date(year, month - 1, day);
    if (local.getMonth() !== month - 1 || local.getDate() !== day) {
      throw new Error('La fecha límite no es válida.');
    }
    return { dueAt: local.toISOString(), dueHasTime: false };
  }

  const tm = TIME_RE.exec(t);
  if (!tm) throw new Error('La hora límite no es válida.');
  const local = new Date(year, month - 1, day, Number(tm[1]), Number(tm[2]));
  if (local.getMonth() !== month - 1 || local.getDate() !== day) {
    throw new Error('La fecha límite no es válida.');
  }
  return { dueAt: local.toISOString(), dueHasTime: true };
}

/** Persisted values -> form inputs (inverse of buildDueValue). */
export function splitDueValue(dueAt: string | null, dueHasTime: boolean): DueParts {
  if (!dueAt) return { date: '', time: '' };
  const d = new Date(dueAt);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { date, time: dueHasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '' };
}

/**
 * "Vencida" rule.
 *  - exact deadline: overdue as soon as that instant has passed;
 *  - date-only deadline: overdue only once the whole day has passed
 *    (i.e. from local midnight of the following day), since no time was chosen.
 * Completed missions and missions without a deadline are never overdue.
 */
export function isDueOverdue(
  dueAt: string | null,
  completedAt: string | null,
  dueHasTime: boolean = true,
  now: number = Date.now()
): boolean {
  if (!dueAt || completedAt) return false;
  const due = new Date(dueAt).getTime();
  if (dueHasTime) return due < now;
  return startOfLocalDay(due) < startOfLocalDay(now);
}
