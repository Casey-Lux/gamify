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

  plan: WeekdayPlan;
  stat: WeekdayStat;

  weekly?: WeeklyProgress | null;
}

export function habitDayInfo(
  habit: Pick<Habit, 'adaptive'>,
  schedule: ScheduleEntry[],
  completedDates: string[],
  today: string,
  config: AdaptationConfig = ADAPTATION_CONFIG
): HabitDayInfo {
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
