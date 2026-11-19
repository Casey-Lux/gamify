import { supabase } from '$lib/supabase/client';
import { fetchMissionsByIds } from '$lib/api/missions';
import {
  DEFAULT_DAILY_PLAN_SETTINGS,
  WEEKDAY_COLUMNS,
  type DailyPlan,
  type DailyPlanMissionEntry,
  type DailyPlanSettings
} from '$lib/types/daily-plan';

export class DailyPlanApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'DailyPlanApiError';
  }
}

interface PlanRow {
  id: string;
  hours: unknown;
  slots: number;
}

interface PlanMissionRow {
  mission_id: string;
  position: number;
}

function toHours(value: unknown): number {
  const hours = Number(value ?? 0);
  return Number.isFinite(hours) ? hours : 0;
}

export async function fetchDailyPlanSettings(userId: string): Promise<DailyPlanSettings> {
  const { data, error } = await supabase
    .from('daily_plan_settings')
    .select(WEEKDAY_COLUMNS.join(', '))
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new DailyPlanApiError(error.message, error.code);
  if (!data) return { hours: [...DEFAULT_DAILY_PLAN_SETTINGS.hours] };

  return {
    hours: WEEKDAY_COLUMNS.map((column) =>
      toHours((data as unknown as Record<string, unknown>)[column])
    )
  };
}

export async function saveDailyPlanSettings(
  userId: string,
  hours: number[]
): Promise<DailyPlanSettings> {
  if (
    hours.length !== WEEKDAY_COLUMNS.length ||
    hours.some((value) => !Number.isFinite(value) || value < 0 || value > 24)
  ) {
    throw new DailyPlanApiError('Las horas libres deben estar entre 0 y 24.');
  }

  const normalized = hours.map((value) => Math.round(value * 10) / 10);
  const row: Record<string, string | number> = { user_id: userId };
  WEEKDAY_COLUMNS.forEach((column, index) => {
    row[column] = normalized[index] ?? 0;
  });

  const { error } = await supabase
    .from('daily_plan_settings')
    .upsert(row, { onConflict: 'user_id' });

  if (error) throw new DailyPlanApiError(error.message, error.code);
  return { hours: normalized };
}

async function findPlan(
  userId: string,
  workspaceId: string,
  planDate: string
): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from('daily_plans')
    .select('id, hours, slots')
    .eq('user_id', userId)
    .eq('workspace_id', workspaceId)
    .eq('plan_date', planDate)
    .maybeSingle();

  if (error) throw new DailyPlanApiError(error.message, error.code);
  return data;
}

async function loadEntries(planId: string): Promise<DailyPlanMissionEntry[]> {
  const { data, error } = await supabase
    .from('daily_plan_missions')
    .select('mission_id, position')
    .eq('plan_id', planId)
    .order('position', { ascending: true });

  if (error) throw new DailyPlanApiError(error.message, error.code);

  const rows = (data ?? []) as PlanMissionRow[];
  const missions = await fetchMissionsByIds(rows.map((row) => row.mission_id));
  const byId = new Map(missions.map((mission) => [mission.id, mission]));

  return rows.flatMap((row) => {
    const mission = byId.get(row.mission_id);
    return mission ? [{ position: row.position, mission }] : [];
  });
}

async function buildPlan(plan: PlanRow, date: string): Promise<DailyPlan> {
  return {
    date,
    hours: toHours(plan.hours),
    slots: plan.slots,
    locked: true,
    entries: await loadEntries(plan.id)
  };
}

async function pickMissionIds(
  userId: string,
  workspaceId: string,
  slots: number
): Promise<string[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('assigned_to', userId)
    .eq('status', 'DOING')
    .eq('difficulty', 'EASY')
    .is('completed_at', null)
    .is('habit_id', null)
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('xp_reward', { ascending: false })
    .order('coin_reward', { ascending: false })
    .limit(slots);

  if (error) throw new DailyPlanApiError(error.message, error.code);
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

export interface GetOrCreateDailyPlanInput {
  userId: string;
  workspaceId: string;
  planDate: string;
  hours: number;
  slots: number;
}

export async function getOrCreateDailyPlan(input: GetOrCreateDailyPlanInput): Promise<DailyPlan> {
  const { userId, workspaceId, planDate, hours, slots } = input;

  const existing = await findPlan(userId, workspaceId, planDate);
  if (existing) return buildPlan(existing, planDate);
  if (slots <= 0) return { date: planDate, hours, slots, locked: false, entries: [] };

  const missionIds = await pickMissionIds(userId, workspaceId, slots);
  if (missionIds.length === 0) return { date: planDate, hours, slots, locked: false, entries: [] };

  const { data: created, error: planError } = await supabase
    .from('daily_plans')
    .insert({ user_id: userId, workspace_id: workspaceId, plan_date: planDate, hours, slots })
    .select('id, hours, slots')
    .single();

  if (planError) {
    if (planError.code === '23505') {
      const raced = await findPlan(userId, workspaceId, planDate);
      if (raced) return buildPlan(raced, planDate);
    }
    throw new DailyPlanApiError(planError.message, planError.code);
  }

  const { error: missionsError } = await supabase.from('daily_plan_missions').insert(
    missionIds.map((missionId, index) => ({
      plan_id: created.id,
      mission_id: missionId,
      position: index + 1
    }))
  );

  if (missionsError) {
    await supabase.from('daily_plans').delete().eq('id', created.id);
    throw new DailyPlanApiError(missionsError.message, missionsError.code);
  }

  return buildPlan(created, planDate);
}
