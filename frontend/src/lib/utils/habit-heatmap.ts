import type { ScheduleEntry } from '$lib/types/habits';
import { addDays, entryInForce, isoWeekday, isScheduledOn } from './habit-schedule';

/**
 * - done:    completed that day (even if it was not a scheduled day)
 * - missed:  scheduled, already over, not completed
 * - pending: scheduled today, not completed yet
 * - off:     not scheduled (or before the habit existed). Also every day that
 *            was not completed under an "X veces por semana" schedule: those
 *            habits have no concrete days, their goal is judged per week.
 * - future:  after today
 */
export type HeatmapState = 'done' | 'missed' | 'pending' | 'off' | 'future';

export interface HeatmapCell {
  date: string;
  state: HeatmapState;
}

export interface Heatmap {
  /** One column per week (oldest first); each has 7 cells, Monday..Sunday. */
  weeks: HeatmapCell[][];
  /** Scheduled days up to today (today included) and how many were completed. */
  scheduled: number;
  completed: number;
  /** 'weekly' when some week was judged against an "X veces por semana" goal: then
   * `scheduled` / `completed` count weekly goals' completions, not days. */
  mode: 'days' | 'weekly';
}

/** First date shown: the Monday of the week that is `weeks - 1` weeks before today's. */
export function heatmapStart(today: string, weeks: number): string {
  const monday = addDays(today, -(isoWeekday(today) - 1));
  return addDays(monday, -(weeks - 1) * 7);
}

export function buildHeatmap(
  today: string,
  weeks: number,
  schedule: ScheduleEntry[],
  completedDates: Iterable<string>
): Heatmap {
  const done = new Set(completedDates);
  const start = heatmapStart(today, weeks);
  const columns: HeatmapCell[][] = [];
  let scheduled = 0;
  let completed = 0;
  let weeklyUsed = false;

  for (let w = 0; w < weeks; w++) {
    const column: HeatmapCell[] = [];
    // "X veces por semana": goal of this column's week and what was done.
    let weekTarget: number | null = null;
    let weekDone = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      let state: HeatmapState;
      if (date > today) state = 'future';
      else if (entryInForce(schedule, date)?.weekly_target != null) {
        weekTarget = entryInForce(schedule, date)?.weekly_target ?? null;
        if (done.has(date)) {
          weekDone += 1;
          state = 'done';
        } else state = 'off';
      } else {
        const isScheduled = isScheduledOn(schedule, date);
        if (isScheduled) scheduled += 1;
        if (done.has(date)) {
          state = 'done';
          if (isScheduled) completed += 1;
        } else if (!isScheduled) state = 'off';
        else state = date === today ? 'pending' : 'missed';
      }
      column.push({ date, state });
    }
    if (weekTarget !== null) {
      weeklyUsed = true;
      scheduled += weekTarget;
      completed += Math.min(weekDone, weekTarget);
    }
    columns.push(column);
  }
  return { weeks: columns, scheduled, completed, mode: weeklyUsed ? 'weekly' : 'days' };
}
