import type {
  Habit,
  ScheduleEntry,
  WeekdayPlan,
  WeekdayStat,
  WeeklyProgress
} from '$lib/types/habits';
import {
  addDays,
  eachDate,
  isoWeekday,
  isScheduledOn,
  weeklyTargetInForce
} from './habit-schedule';
import { planWeekly } from './habit-weekly';

/**
 * Adaptive planning — first version, deliberately simple and explainable.
 *
 * For each weekday we look at the last `windowWeeks` weeks and count, among
 * the days the habit was SCHEDULED (according to its schedule history, never
 * according to previous adaptations), how many were actually completed.
 *
 *   - fewer than `minSamples` scheduled days  -> REQUIRED (not enough evidence)
 *   - rate >= `reminderBelowRate`             -> REQUIRED
 *   - rate between the two thresholds         -> REMINDER (still required, with
 *                                                a special reminder)
 *   - rate <= `optionalAtOrBelowRate` and at least `optionalMinSamples`
 *     scheduled days                          -> OPTIONAL (not required)
 *
 * The result is DERIVED on the fly: it never edits `days_of_week` or any
 * stored history, so it is fully reversible (if the user starts doing that
 * day again the rate rises and the day becomes required again) and the
 * thresholds can be tuned here in one place.
 */
export const ADAPTATION_CONFIG = {
  windowWeeks: 8,
  minSamples: 4,
  reminderBelowRate: 0.5,
  optionalAtOrBelowRate: 0.2,
  optionalMinSamples: 6
};

export type AdaptationConfig = typeof ADAPTATION_CONFIG;

export function lookbackStart(today: string, config: AdaptationConfig = ADAPTATION_CONFIG): string {
  return addDays(today, -config.windowWeeks * 7);
}

export function planFromStats(
  scheduled: number,
  completed: number,
  config: AdaptationConfig = ADAPTATION_CONFIG
): WeekdayPlan {
  if (scheduled < config.minSamples) return 'REQUIRED';
  const rate = completed / scheduled;
  if (rate <= config.optionalAtOrBelowRate && scheduled >= config.optionalMinSamples) {
    return 'OPTIONAL';
  }
  if (rate < config.reminderBelowRate) return 'REMINDER';
  return 'REQUIRED';
}

/** Per-weekday stats over the lookback window, ending YESTERDAY (today is not
 * over yet, so it never counts as a miss). Index 0 = Monday ... 6 = Sunday. */
export function computeWeekdayStats(
  schedule: ScheduleEntry[],
  completedDates: Iterable<string>,
  today: string,
  config: AdaptationConfig = ADAPTATION_CONFIG
): WeekdayStat[] {
  const done = new Set(completedDates);
  const first = schedule.reduce<string | null>(
    (min, e) => (min === null || e.effective_from < min ? e.effective_from : min),
    null
  );
  const stats: WeekdayStat[] = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    scheduled: 0,
    completed: 0,
    rate: null,
    plan: 'REQUIRED'
  }));

  if (first !== null) {
    const from = [lookbackStart(today, config), first].sort().at(-1) as string;
    const to = addDays(today, -1);
    if (from <= to) {
      for (const date of eachDate(from, to)) {
        if (!isScheduledOn(schedule, date)) continue;
        const stat = stats[isoWeekday(date) - 1] as WeekdayStat;
        stat.scheduled += 1;
        if (done.has(date)) stat.completed += 1;
      }
    }
  }

  for (const stat of stats) {
    stat.rate = stat.scheduled > 0 ? stat.completed / stat.scheduled : null;
    stat.plan = planFromStats(stat.scheduled, stat.completed, config);
  }
  return stats;
}

export interface HabitDayInfo {
  scheduledToday: boolean;
  doneToday: boolean;
  /** Plan for today's weekday; always REQUIRED when the habit is not adaptive. */
  plan: WeekdayPlan;
  stat: WeekdayStat;
  /** Set only for "X veces por semana" habits: this week's progress. */
  weekly?: WeeklyProgress | null;
}

export function habitDayInfo(
  habit: Pick<Habit, 'adaptive'>,
  schedule: ScheduleEntry[],
  completedDates: string[],
  today: string,
  config: AdaptationConfig = ADAPTATION_CONFIG
): HabitDayInfo {
  // "X veces por semana": there are no concrete weekdays to adapt, so the
  // days that "tocan" come from this week's progress instead (habit-weekly.ts),
  // learning the user's usual weekdays from the same lookback window.
  const weeklyTarget = weeklyTargetInForce(schedule, today);
  if (weeklyTarget !== null) {
    const weekly = planWeekly({
      target: weeklyTarget,
      completedDates: completedDates,
      today,
      adaptive: habit.adaptive,
      historyFrom: lookbackStart(today, config)
    });
    return {
      scheduledToday: weekly.scheduledToday,
      doneToday: weekly.doneToday,
      plan: 'REQUIRED',
      stat: {
        weekday: isoWeekday(today),
        scheduled: 0,
        completed: 0,
        rate: null,
        plan: 'REQUIRED'
      },
      weekly: weekly.progress
    };
  }

  const stats = computeWeekdayStats(schedule, completedDates, today, config);
  const stat = stats[isoWeekday(today) - 1] as WeekdayStat;
  return {
    scheduledToday: isScheduledOn(schedule, today),
    doneToday: completedDates.includes(today),
    plan: habit.adaptive ? stat.plan : 'REQUIRED',
    stat
  };
}
