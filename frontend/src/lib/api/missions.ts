import { supabase } from '$lib/supabase/client';
import type {
  CompleteMissionResult,
  Mission,
  MissionDifficulty,
  MissionStatus,
  MissionSubtask,
  MissionWithRelations
} from '$lib/types/domain';
import { MISSION_PAGE_SIZE, type MissionFilters, type MissionSort } from '$lib/types/mission-query';
import { buildDueValue, startOfLocalDay } from '$lib/utils/due-date';
import { invalidate } from '$lib/utils/freshness';

export class MissionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'MissionApiError';
  }
}

export interface MissionPage {
  missions: MissionWithRelations[];

  totalCount: number;
  hasMore: boolean;
}

const MISSION_SELECT = `
      id, workspace_id, created_by, assigned_to, skill_id, area_id, title,
      description, difficulty, xp_reward, coin_reward, status, due_at, due_has_time,
      completed_at, created_at, updated_at,
      skill:skills(id, name),
      area:areas(id, name),
      subtasks:mission_subtasks(id, mission_id, title, position, completed, completed_at, created_at, updated_at)
      `;

export async function fetchMissionsPage(
  filters: MissionFilters,
  sort: MissionSort,
  page: number
): Promise<MissionPage> {
  let query = supabase.from('missions').select(MISSION_SELECT, { count: 'exact' });

  query = applyFilters(query, filters);

  query = query.is('habit_id', null);
  query = applySort(query, sort);

  const from = page * MISSION_PAGE_SIZE;
  const to = from + MISSION_PAGE_SIZE - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) throw new MissionApiError(error.message, error.code);

  const missions = (data ?? []) as unknown as MissionWithRelations[];
  const totalCount = count ?? missions.length;

  return {
    missions,
    totalCount,
    hasMore: from + missions.length < totalCount
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters(query: any, filters: MissionFilters, now: number = Date.now()) {
  const statusClause = buildStatusClause(filters.statuses, now);
  if (statusClause) query = query.or(statusClause);

  if (filters.areaId) query = query.eq('area_id', filters.areaId);
  if (filters.skillId) query = query.eq('skill_id', filters.skillId);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);

  if (filters.search.trim().length > 0) {
    query = query.ilike('title', `%${filters.search.trim()}%`);
  }

  return query;
}

export function buildStatusClause(statuses: MissionFilters['statuses'], now: number): string {
  const parts: string[] = [];
  for (const status of statuses) {
    if (status === 'OVERDUE') {
      const nowIso = new Date(now).toISOString();
      const todayStartIso = new Date(startOfLocalDay(now)).toISOString();
      parts.push(
        'and(completed_at.is.null,or(' +
          `and(due_has_time.eq.true,due_at.lt.${nowIso}),` +
          `and(due_has_time.eq.false,due_at.lt.${todayStartIso})` +
          '))'
      );
    } else {
      parts.push(`status.eq.${status}`);
    }
  }
  return parts.join(',');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applySort(query: any, sort: MissionSort) {
  const ascending = sort.direction === 'ASC';

  const nullsFirst = sort.field === 'due_at' ? false : undefined;

  query = query.order(sort.field, { ascending, nullsFirst });

  query = query.order('id', { ascending: true });

  return query;
}

export async function completeMission(missionId: string): Promise<CompleteMissionResult> {
  const { data, error } = await supabase.rpc('complete_mission', { p_mission_id: missionId });

  if (error) throw new MissionApiError(error.message, error.code);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new MissionApiError('complete_mission returned no result');

  invalidate('missions', 'statistics');
  return row as CompleteMissionResult;
}

export async function setSubtaskCompleted(
  subtaskId: string,
  completed: boolean
): Promise<MissionSubtask> {
  const { data, error } = await supabase
    .from('mission_subtasks')
    .update({ completed })
    .eq('id', subtaskId)
    .select()
    .single();

  if (error) throw new MissionApiError(error.message, error.code);
  invalidate('missions');
  return data as MissionSubtask;
}

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_REWARD = 1_000_000;

export interface NewMissionInput {
  workspaceId: string;
  createdBy: string;

  assignedTo: string;
  skillId: string;
  areaId: string | null;
  title: string;
  description: string;
  difficulty: MissionDifficulty;
  xpReward: number;
  coinReward: number;
  status: MissionStatus;

  dueDate: string;

  dueTime: string;

  subtaskTitles: string[];
}

type MissionFields = Pick<
  NewMissionInput,
  | 'skillId'
  | 'title'
  | 'description'
  | 'xpReward'
  | 'coinReward'
  | 'dueDate'
  | 'dueTime'
  | 'subtaskTitles'
>;

function validateMissionFields(input: MissionFields) {
  const title = input.title.trim();
  const description = input.description.trim();

  if (title.length === 0) throw new MissionApiError('El título es obligatorio.');
  if (title.length > MAX_TITLE_LENGTH) {
    throw new MissionApiError(`El título no puede superar ${MAX_TITLE_LENGTH} caracteres.`);
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new MissionApiError(
      `La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`
    );
  }
  if (!input.skillId) throw new MissionApiError('Debes elegir una skill.');
  if (!Number.isInteger(input.xpReward) || input.xpReward < 0 || input.xpReward > MAX_REWARD) {
    throw new MissionApiError('La recompensa de XP debe ser un número entero mayor o igual a 0.');
  }
  if (
    !Number.isInteger(input.coinReward) ||
    input.coinReward < 0 ||
    input.coinReward > MAX_REWARD
  ) {
    throw new MissionApiError(
      'La recompensa de monedas debe ser un número entero mayor o igual a 0.'
    );
  }

  let due;
  try {
    due = buildDueValue(input.dueDate, input.dueTime);
  } catch (err) {
    throw new MissionApiError(err instanceof Error ? err.message : 'La fecha límite no es válida.');
  }

  const subtaskTitles = input.subtaskTitles.map((t) => t.trim()).filter((t) => t.length > 0);
  return { title, description, due, subtaskTitles };
}

export async function createMission(input: NewMissionInput): Promise<Mission> {
  const { title, description, due, subtaskTitles } = validateMissionFields(input);

  const { data, error } = await supabase
    .from('missions')
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.createdBy,
      assigned_to: input.assignedTo,
      skill_id: input.skillId,
      area_id: input.areaId,
      title,
      description: description.length > 0 ? description : null,
      difficulty: input.difficulty,
      xp_reward: input.xpReward,
      coin_reward: input.coinReward,
      status: input.status,
      due_at: due.dueAt,
      due_has_time: due.dueHasTime
    })
    .select()
    .single();

  if (error) throw new MissionApiError(error.message, error.code);
  const mission = data as Mission;

  invalidate('missions');

  if (subtaskTitles.length > 0) {
    const rows = subtaskTitles.map((subtaskTitle, index) => ({
      mission_id: mission.id,
      title: subtaskTitle,
      position: index
    }));
    const { error: subtaskError } = await supabase.from('mission_subtasks').insert(rows);

    if (subtaskError) {
      throw new MissionApiError(
        `La misión se creó, pero las submisiones no se pudieron guardar: ${subtaskError.message}`,
        subtaskError.code
      );
    }
  }

  return mission;
}

export interface EditableSubtask {
  id?: string;
  title: string;
}

export interface UpdateMissionInput {
  missionId: string;

  assignedTo: string;
  skillId: string;
  areaId: string | null;
  title: string;
  description: string;
  difficulty: MissionDifficulty;
  xpReward: number;
  coinReward: number;
  status: MissionStatus;
  dueDate: string;
  dueTime: string;
  subtasks: EditableSubtask[];
}

export async function fetchMissionById(missionId: string): Promise<MissionWithRelations | null> {
  const { data, error } = await supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('id', missionId)
    .maybeSingle();

  if (error) throw new MissionApiError(error.message, error.code);
  return (data as unknown as MissionWithRelations | null) ?? null;
}

export async function updateMission(input: UpdateMissionInput): Promise<Mission> {
  const { title, description, due } = validateMissionFields({
    ...input,
    subtaskTitles: []
  });

  const { data, error } = await supabase
    .from('missions')
    .update({
      assigned_to: input.assignedTo,
      area_id: input.areaId,
      title,
      description: description.length > 0 ? description : null,
      difficulty: input.difficulty,
      xp_reward: input.xpReward,
      coin_reward: input.coinReward,
      status: input.status,
      due_at: due.dueAt,
      due_has_time: due.dueHasTime
    })
    .eq('id', input.missionId)
    .select()
    .maybeSingle();

  if (error) throw new MissionApiError(error.message, error.code);

  if (!data)
    throw new MissionApiError('No se encontró la misión o no tienes permiso para editarla.');

  const subtaskError = await syncSubtasks(input.missionId, input.subtasks);
  invalidate('missions');
  if (subtaskError) {
    throw new MissionApiError(
      `La misión se guardó, pero las submisiones no se pudieron actualizar: ${subtaskError.message}`,
      subtaskError.code
    );
  }
  return data as Mission;
}

async function syncSubtasks(missionId: string, edited: EditableSubtask[]) {
  const wanted = edited
    .map((t) => ({ ...t, title: t.title.trim() }))
    .filter((t) => t.title.length > 0);

  const { data: existing, error: listError } = await supabase
    .from('mission_subtasks')
    .select('id, title, position')
    .eq('mission_id', missionId);
  if (listError) return listError;

  const keepIds = new Set(wanted.filter((t) => t.id).map((t) => t.id as string));
  const toDelete = (existing ?? []).filter((row) => !keepIds.has(row.id)).map((row) => row.id);

  if (toDelete.length > 0) {
    const { error } = await supabase.from('mission_subtasks').delete().in('id', toDelete);
    if (error) return error;
  }

  for (const [position, subtask] of wanted.entries()) {
    if (!subtask.id) continue;
    const current = (existing ?? []).find((row) => row.id === subtask.id);
    if (current && current.title === subtask.title && current.position === position) continue;
    const { error } = await supabase
      .from('mission_subtasks')
      .update({ title: subtask.title, position })
      .eq('id', subtask.id);
    if (error) return error;
  }

  const inserts = wanted
    .map((subtask, position) => ({ subtask, position }))
    .filter(({ subtask }) => !subtask.id)
    .map(({ subtask, position }) => ({
      mission_id: missionId,
      title: subtask.title,
      position
    }));
  if (inserts.length > 0) {
    const { error } = await supabase.from('mission_subtasks').insert(inserts);
    if (error) return error;
  }
  return null;
}

export async function deleteMission(missionId: string): Promise<void> {
  const { data, error } = await supabase.from('missions').delete().eq('id', missionId).select('id');

  if (error) {
    if (error.code === '23503') {
      throw new MissionApiError(
        'No se puede eliminar una misión completada: forma parte del historial.',
        error.code
      );
    }
    throw new MissionApiError(error.message, error.code);
  }
  if (!data || data.length === 0) {
    throw new MissionApiError('No se encontró la misión o no tienes permiso para eliminarla.');
  }
  invalidate('missions');
}
