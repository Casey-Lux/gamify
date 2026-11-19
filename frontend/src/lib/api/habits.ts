import { supabase } from '$lib/supabase/client';
import type { CompleteMissionResult, MissionDifficulty } from '$lib/types/domain';
import {
  ALL_WEEKDAYS,
  HABIT_HISTORY_EDIT_DAYS,
  type Habit,
  type HabitDayPart,
  type HabitsOverview,
  type ScheduleEntry
} from '$lib/types/habits';
import { addDays, toLocalDateStr } from '$lib/utils/habit-schedule';
import { lookbackStart } from '$lib/utils/habit-adaptation';
import { invalidate } from '$lib/utils/freshness';

export class HabitApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'HabitApiError';
  }
}

const HABIT_SELECT = '*, skill:skills(id, name)';
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_REWARD = 1_000_000;
const PAGE = 1000;

export interface HabitInput {
  title: string;
  description: string;
  skillId: string;
  areaId: string | null;
  difficulty: MissionDifficulty;
  xpReward: number;
  coinReward: number;

  daily: boolean;
  days: number[];

  weeklyTarget?: number | null;
  dayPart: HabitDayPart;

  reminderTime: string;
  adaptive: boolean;
}

export function validateHabitInput(input: HabitInput) {
  const title = input.title.trim();
  const description = input.description.trim();
  if (title.length === 0) throw new HabitApiError('El título es obligatorio.');
  if (title.length > MAX_TITLE_LENGTH) {
    throw new HabitApiError(`El título no puede superar ${MAX_TITLE_LENGTH} caracteres.`);
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new HabitApiError(
      `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`
    );
  }
  if (!input.skillId) throw new HabitApiError('Debes elegir una skill.');
  for (const [value, label] of [
    [input.xpReward, 'XP'],
    [input.coinReward, 'monedas']
  ] as const) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_REWARD) {
      throw new HabitApiError(
        `La recompensa de ${label} debe ser un número entero mayor o igual a 0.`
      );
    }
  }
  const weeklyTarget = input.weeklyTarget ?? null;
  if (
    weeklyTarget !== null &&
    (!Number.isInteger(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 7)
  ) {
    throw new HabitApiError('Las veces por semana deben ser un número entero entre 1 y 7.');
  }

  const days =
    input.daily || weeklyTarget !== null
      ? [...ALL_WEEKDAYS]
      : [...new Set(input.days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
  if (days.length === 0) throw new HabitApiError('Elige al menos un día de la semana.');
  if (input.reminderTime !== '' && !/^\d{2}:\d{2}$/.test(input.reminderTime)) {
    throw new HabitApiError('La hora del recordatorio no es válida.');
  }
  return {
    title,
    description: description.length > 0 ? description : null,
    days,
    weeklyTarget,
    reminderTime: input.reminderTime === '' ? null : `${input.reminderTime}:00`
  };
}

export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_SELECT)
    .order('created_at', { ascending: true });
  if (error) throw new HabitApiError(error.message, error.code);
  return (data ?? []) as unknown as Habit[];
}

export async function fetchHabitById(id: string): Promise<Habit | null> {
  const { data, error } = await supabase
    .from('habits')
    .select(HABIT_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new HabitApiError(error.message, error.code);
  return (data as unknown as Habit | null) ?? null;
}

export async function createHabit(
  workspaceId: string,
  userId: string,
  input: HabitInput
): Promise<Habit> {
  const v = validateHabitInput(input);
  const { data, error } = await supabase
    .from('habits')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      skill_id: input.skillId,
      area_id: input.areaId,
      title: v.title,
      description: v.description,
      difficulty: input.difficulty,
      xp_reward: input.xpReward,
      coin_reward: input.coinReward,
      days_of_week: v.days,
      weekly_target: v.weeklyTarget,

      schedule_effective_from: toLocalDateStr(),
      day_part: input.dayPart,
      reminder_time: v.reminderTime,
      adaptive: input.adaptive
    })
    .select()
    .single();
  if (error) throw new HabitApiError(error.message, error.code);
  invalidate('habits');
  return data as Habit;
}

export async function updateHabit(habit: Habit, input: HabitInput): Promise<Habit> {
  const v = validateHabitInput(input);
  const sameDays =
    v.days.length === habit.days_of_week.length &&
    v.days.every((d, i) => d === [...habit.days_of_week].sort((a, b) => a - b)[i]);
  const sameSchedule = sameDays && v.weeklyTarget === (habit.weekly_target ?? null);

  const { data, error } = await supabase
    .from('habits')
    .update({
      area_id: input.areaId,
      title: v.title,
      description: v.description,
      difficulty: input.difficulty,
      xp_reward: input.xpReward,
      coin_reward: input.coinReward,
      day_part: input.dayPart,
      reminder_time: v.reminderTime,
      adaptive: input.adaptive,
      ...(sameSchedule
        ? {}
        : {
            days_of_week: v.days,
            weekly_target: v.weeklyTarget,
            schedule_effective_from: toLocalDateStr()
          })
    })
    .eq('id', habit.id)
    .select()
    .maybeSingle();
  if (error) throw new HabitApiError(error.message, error.code);
  if (!data) throw new HabitApiError('No se encontró el hábito o no tienes permiso para editarlo.');
  invalidate('habits');
  return data as Habit;
}

export async function setHabitArchived(habitId: string, archived: boolean): Promise<void> {
  const { data, error } = await supabase
    .from('habits')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', habitId)
    .select('id');
  if (error) throw new HabitApiError(error.message, error.code);
  if (!data || data.length === 0) throw new HabitApiError('No se encontró el hábito.');
  invalidate('habits');
}

const COMPLETE_ERRORS: Record<string, string> = {
  GM001: 'Debes iniciar sesión.',
  GM002: 'Este hábito no es tuyo.',
  GM003: 'Este hábito ya no existe.',
  GM004: 'Este hábito ya está cumplido para hoy.',
  GM008: 'No se puede completar este hábito (archivado o fecha no válida).'
};

function habitRpcError(
  error: { code?: string; message: string },
  fallback?: Record<string, string>
) {
  const messages = { ...COMPLETE_ERRORS, ...fallback };
  return new HabitApiError((error.code && messages[error.code]) || error.message, error.code);
}

export async function completeHabit(habitId: string, date: string): Promise<CompleteMissionResult> {
  const { data, error } = await supabase.rpc('complete_habit', {
    p_habit_id: habitId,
    p_date: date
  });
  if (error) throw habitRpcError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new HabitApiError('complete_habit returned no result');
  invalidate('habits', 'statistics');
  return row as CompleteMissionResult;
}

const EDIT_ERRORS: Record<string, string> = {
  GM002: 'Este hábito no es tuyo.',
  GM003: 'No hay ningún registro en esa fecha.',
  GM004: 'Ese día ya está registrado como cumplido.',
  GM008: `Solo se pueden editar los últimos ${HABIT_HISTORY_EDIT_DAYS} días, desde que existe el hábito y si no está archivado.`
};

export async function backfillHabitCompletion(
  habitId: string,
  date: string
): Promise<CompleteMissionResult> {
  const { data, error } = await supabase.rpc('backfill_habit_completion', {
    p_habit_id: habitId,
    p_date: date
  });
  if (error) throw habitRpcError(error, EDIT_ERRORS);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new HabitApiError('backfill_habit_completion returned no result');
  invalidate('habits', 'statistics');
  return row as CompleteMissionResult;
}

export async function moveHabitCompletion(
  habitId: string,
  fromDate: string,
  toDate: string
): Promise<void> {
  const { error } = await supabase.rpc('move_habit_completion', {
    p_habit_id: habitId,
    p_from: fromDate,
    p_to: toDate
  });
  if (error) throw habitRpcError(error, EDIT_ERRORS);
  invalidate('habits');
}

export async function fetchHabitCompletions(
  sinceDate: string,
  habitId?: string
): Promise<Record<string, string[]>> {
  const out: Record<string, string[]> = {};
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from('missions')
      .select('habit_id, habit_date')
      .not('habit_id', 'is', null)
      .not('completed_at', 'is', null)
      .gte('habit_date', sinceDate)
      .order('habit_date', { ascending: true })
      .order('id', { ascending: true });
    if (habitId) query = query.eq('habit_id', habitId);
    const { data, error } = await query.range(from, from + PAGE - 1);
    if (error) throw new HabitApiError(error.message, error.code);
    const rows = (data ?? []) as { habit_id: string; habit_date: string }[];
    for (const row of rows) (out[row.habit_id] ??= []).push(row.habit_date);
    if (rows.length < PAGE) return out;
  }
}

export async function fetchScheduleHistory(
  habitIds?: string[]
): Promise<Record<string, ScheduleEntry[]>> {
  let query = supabase
    .from('habit_schedule_history')
    .select('habit_id, effective_from, days_of_week, weekly_target');
  if (habitIds) query = query.in('habit_id', habitIds);
  const { data, error } = await query;
  if (error) throw new HabitApiError(error.message, error.code);
  const out: Record<string, ScheduleEntry[]> = {};
  for (const row of (data ?? []) as (ScheduleEntry & { habit_id: string })[]) {
    (out[row.habit_id] ??= []).push({
      effective_from: row.effective_from,
      days_of_week: row.days_of_week,
      weekly_target: row.weekly_target ?? null
    });
  }
  return out;
}

export async function fetchHabitsOverview(
  today: string = toLocalDateStr()
): Promise<HabitsOverview> {
  const [habits, schedules, completed] = await Promise.all([
    fetchHabits(),
    fetchScheduleHistory(),
    fetchHabitCompletions(addDays(lookbackStart(today), -1))
  ]);
  return { habits, schedules, completed };
}
