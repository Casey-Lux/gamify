import type { MissionDifficulty } from './domain';

/** Planificación dentro del plan diario. */
export type HabitDayPart = 'ANYTIME' | 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface Habit {
  id: string;
  workspace_id: string;
  user_id: string;
  skill_id: string;
  area_id: string | null;
  title: string;
  description: string | null;
  difficulty: MissionDifficulty;
  xp_reward: number;
  coin_reward: number;
  /** ISO weekday numbers, 1 = lunes ... 7 = domingo. All 7 = "Diario". */
  days_of_week: number[];
  schedule_effective_from: string;
  day_part: HabitDayPart;
  /** `HH:MM:SS` local time, or null when there is no reminder. */
  reminder_time: string | null;
  adaptive: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  skill?: { id: string; name: string } | null;
}

/** One row of habit_schedule_history: from `effective_from` on, the habit
 * was scheduled on `days_of_week` (until the next entry). */
export interface ScheduleEntry {
  effective_from: string; // YYYY-MM-DD (user's local date)
  days_of_week: number[];
}

/** Whole-overview payload shared by the habits store and the notifications. */
export interface HabitsOverview {
  habits: Habit[];
  schedules: Record<string, ScheduleEntry[]>;
  /** habit id -> completed local dates (YYYY-MM-DD) inside the lookback window. */
  completed: Record<string, string[]>;
}

/** Whether the adaptive logic wants a weekday treated as required, as
 * required-with-special-reminder, or as not required. */
export type WeekdayPlan = 'REQUIRED' | 'REMINDER' | 'OPTIONAL';

export interface WeekdayStat {
  weekday: number; // 1..7
  scheduled: number;
  completed: number;
  /** completed / scheduled, or null when nothing was scheduled. */
  rate: number | null;
  plan: WeekdayPlan;
}

export const HABIT_DAY_PART_LABEL: Record<HabitDayPart, string> = {
  ANYTIME: 'En cualquier momento',
  MORNING: 'Mañana',
  AFTERNOON: 'Tarde',
  EVENING: 'Noche'
};

export const HABIT_DAY_PART_ORDER: Record<HabitDayPart, number> = {
  MORNING: 0,
  AFTERNOON: 1,
  EVENING: 2,
  ANYTIME: 3
};

export const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_LABEL: Record<number, string> = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo'
};
export const WEEKDAY_SHORT: Record<number, string> = {
  1: 'L',
  2: 'M',
  3: 'X',
  4: 'J',
  5: 'V',
  6: 'S',
  7: 'D'
};
