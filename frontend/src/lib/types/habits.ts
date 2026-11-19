import type { MissionDifficulty } from './domain';

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

  days_of_week: number[];

  weekly_target: number | null;
  schedule_effective_from: string;
  day_part: HabitDayPart;

  reminder_time: string | null;
  adaptive: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  skill?: { id: string; name: string } | null;
}

export interface ScheduleEntry {
  effective_from: string;
  days_of_week: number[];

  weekly_target?: number | null;
}

export interface WeeklyProgress {
  target: number;

  done: number;

  remaining: number;

  urgent: boolean;
}

export interface HabitsOverview {
  habits: Habit[];
  schedules: Record<string, ScheduleEntry[]>;

  completed: Record<string, string[]>;
}

export type WeekdayPlan = 'REQUIRED' | 'REMINDER' | 'OPTIONAL';

export interface WeekdayStat {
  weekday: number;
  scheduled: number;
  completed: number;

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

export const HABIT_HISTORY_EDIT_DAYS = 30;

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
