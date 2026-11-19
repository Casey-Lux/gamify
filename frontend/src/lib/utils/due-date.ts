export interface DueParts {
  date: string;

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

export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

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

export function splitDueValue(dueAt: string | null, dueHasTime: boolean): DueParts {
  if (!dueAt) return { date: '', time: '' };
  const d = new Date(dueAt);
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { date, time: dueHasTime ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '' };
}

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
