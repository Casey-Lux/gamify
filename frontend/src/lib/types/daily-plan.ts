import type { MissionWithRelations } from './domain';

export const EASY_MISSION_HOURS = 2;
export const MAX_DAILY_MISSIONS = 3;

export const WEEKDAY_COLUMNS = [
  'monday_hours',
  'tuesday_hours',
  'wednesday_hours',
  'thursday_hours',
  'friday_hours',
  'saturday_hours',
  'sunday_hours'
] as const;

export interface DailyPlanSettings {
  hours: number[];
}

export const DEFAULT_DAILY_PLAN_SETTINGS: DailyPlanSettings = {
  hours: [0, 0, 0, 0, 0, 0, 0]
};

export function dailyMissionSlots(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(MAX_DAILY_MISSIONS, Math.floor(hours / EASY_MISSION_HOURS));
}

export interface DailyPlanMissionEntry {
  position: number;
  mission: MissionWithRelations;
}

export interface DailyPlan {
  date: string;
  hours: number;
  slots: number;
  locked: boolean;
  entries: DailyPlanMissionEntry[];
}
