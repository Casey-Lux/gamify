import type { WeeklyProgress } from '$lib/types/habits';
import { addDays, eachDate, isoWeekday } from './habit-schedule';

/**
 * "X veces por semana" habits have no concrete weekdays. The days that
 * "toca" the habit are DERIVED here, every day, from this week's progress —
 * nothing is stored and nothing past is rewritten (same philosophy as the
 * adaptive weekday plan in habit-adaptation.ts):
 *
 *   remaining = target - completions before today (this ISO week, Mon-Sun)
 *   days left = today ... Sunday
 *
 *   - target already met                       -> no day is required
 *   - remaining >= days left (no slack left)   -> every remaining day is
 *                                                 required (and "urgent")
 *   - adaptive off                             -> every remaining day is
 *                                                 required until the target is met
 *   - otherwise (adaptive on)                  -> pick the `remaining` days
 *     where the user usually completes the habit (completions per weekday in
 *     the lookback window); without history, spread them evenly over the
 *     days left. Each day the plan is recomputed, so skipping a planned day
 *     simply moves the remaining ones later in the week.
 *
 * The plan for TODAY only uses completions BEFORE today, so completing the
 * habit never changes what was planned for today.
 */

export interface WeeklyPlan {
  progress: WeeklyProgress;
  /** Days (today .. Sunday) on which the habit is expected, oldest first. */
  plannedDates: string[];
  scheduledToday: boolean;
  doneToday: boolean;
}

/** Monday of the ISO week that contains `dateStr`. */
export function weekStartOf(dateStr: string): string {
  return addDays(dateStr, -(isoWeekday(dateStr) - 1));
}

/** Completions per ISO weekday (index 0 = Monday) in [from, today - 1]. */
function weekdayCompletionCounts(done: Set<string>, from: string, today: string): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const to = addDays(today, -1);
  if (from > to) return counts;
  for (const date of eachDate(from, to)) {
    if (done.has(date)) counts[isoWeekday(date) - 1] = (counts[isoWeekday(date) - 1] ?? 0) + 1;
  }
  return counts;
}

function pickDays(candidates: string[], needed: number, counts: number[]): string[] {
  const n = candidates.length;
  // Evenly spread indexes (always includes today when nothing else decides).
  const spread = new Set<number>();
  for (let k = 0; k < needed; k++) spread.add(Math.floor((k * n) / needed));

  return candidates
    .map((date, index) => ({
      date,
      score: counts[isoWeekday(date) - 1] ?? 0,
      spread: spread.has(index) ? 0 : 1
    }))
    .sort((a, b) => b.score - a.score || a.spread - b.spread || a.date.localeCompare(b.date))
    .slice(0, needed)
    .map((c) => c.date)
    .sort();
}

export function planWeekly(input: {
  target: number;
  completedDates: Iterable<string>;
  today: string;
  adaptive: boolean;
  /** First day of the history used to learn the usual weekdays. */
  historyFrom: string;
}): WeeklyPlan {
  const { target, today, adaptive, historyFrom } = input;
  const done = new Set(input.completedDates);
  const monday = weekStartOf(today);
  const doneToday = done.has(today);

  const doneBefore =
    today === monday ? 0 : eachDate(monday, addDays(today, -1)).filter((d) => done.has(d)).length;
  const remainingBefore = Math.max(0, target - doneBefore);
  const candidates = eachDate(today, addDays(monday, 6));

  let plannedDates: string[] = [];
  if (remainingBefore > 0) {
    plannedDates =
      !adaptive || remainingBefore >= candidates.length
        ? candidates
        : pickDays(candidates, remainingBefore, weekdayCompletionCounts(done, historyFrom, today));
  }

  const total = doneBefore + (doneToday ? 1 : 0);
  return {
    progress: {
      target,
      done: total,
      remaining: Math.max(0, target - total),
      urgent: remainingBefore > 0 && remainingBefore >= candidates.length
    },
    plannedDates,
    scheduledToday: doneToday || plannedDates.includes(today),
    doneToday
  };
}
