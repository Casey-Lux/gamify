import { supabase } from '$lib/supabase/client';
import type {
  CompleteMissionResult,
  Mission,
  MissionDifficulty,
  MissionSubtask,
  MissionWithRelations
} from '$lib/types/domain';
import { MISSION_PAGE_SIZE, type MissionFilters, type MissionSort } from '$lib/types/mission-query';

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
  /** Total rows matching the current filters (for "página X de Y" / hasMore). */
  totalCount: number;
  hasMore: boolean;
}

/**
 * Spec sections 21-22: filters are acumulative (AND), sort is a single field
 * + direction with a deterministic secondary order by id, and the frontend
 * never loads more than one page's worth of rows.
 *
 * Pagination strategy (documented secondary decision, spec section 56 — pick
 * the simplest option when not fully specified): `range()`-based
 * offset pagination rather than a keyset cursor. The spec allows either
 * ("paginación/cursor pagination"); for the expected MVP data volumes (one
 * person's or one small team's missions) offset pagination is simpler to
 * reason about, still bounds the rows fetched per request, and composes
 * trivially with arbitrary sort fields + filters. If a workspace's mission
 * count later grows large enough for `OFFSET` cost to matter, this is an
 * isolated change to this one function.
 */
export async function fetchMissionsPage(
  filters: MissionFilters,
  sort: MissionSort,
  page: number
): Promise<MissionPage> {
  let query = supabase.from('missions').select(
    `
      id, workspace_id, created_by, assigned_to, skill_id, area_id, title,
      description, difficulty, xp_reward, coin_reward, due_at, completed_at,
      created_at, updated_at,
      skill:skills(id, name),
      area:areas(id, name),
      subtasks:mission_subtasks(id, mission_id, title, position, completed, completed_at, created_at, updated_at)
      `,
    { count: 'exact' }
  );

  query = applyFilters(query, filters);
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

// Exported (not just used internally) so filter/sort logic can be unit
// tested against a fake query-builder double, without a real Supabase client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyFilters(query: any, filters: MissionFilters) {
  if (filters.status === 'PENDING') query = query.is('completed_at', null);
  if (filters.status === 'COMPLETED') query = query.not('completed_at', 'is', null);

  if (filters.areaId) query = query.eq('area_id', filters.areaId);
  if (filters.skillId) query = query.eq('skill_id', filters.skillId);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);

  if (filters.dueAfter) query = query.gte('due_at', filters.dueAfter);
  if (filters.dueBefore) query = query.lte('due_at', filters.dueBefore);

  if (filters.xpMin !== null) query = query.gte('xp_reward', filters.xpMin);
  if (filters.xpMax !== null) query = query.lte('xp_reward', filters.xpMax);
  if (filters.coinsMin !== null) query = query.gte('coin_reward', filters.coinsMin);
  if (filters.coinsMax !== null) query = query.lte('coin_reward', filters.coinsMax);

  if (filters.search.trim().length > 0) {
    query = query.ilike('title', `%${filters.search.trim()}%`);
  }

  return query;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applySort(query: any, sort: MissionSort) {
  const ascending = sort.direction === 'ASC';

  // Documented deterministic NULL behaviour (spec section 22): due_at NULL
  // values always sort LAST, regardless of ASC/DESC — a mission "sin fecha
  // límite" is treated as "further away" than any dated mission in both
  // directions, which matches how the Missions UI groups undated missions at
  // the bottom of the list either way.
  const nullsFirst = sort.field === 'due_at' ? false : undefined;

  query = query.order(sort.field, { ascending, nullsFirst });
  // Deterministic secondary order (spec: "Usar orden secundario determinista
  // por id."), independent of the primary sort direction.
  query = query.order('id', { ascending: true });

  return query;
}

/** Spec section 13: calls the `complete_mission` RPC and returns its result. */
export async function completeMission(missionId: string): Promise<CompleteMissionResult> {
  const { data, error } = await supabase.rpc('complete_mission', { p_mission_id: missionId });

  if (error) throw new MissionApiError(error.message, error.code);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new MissionApiError('complete_mission returned no result');

  return row as CompleteMissionResult;
}

/** Toggles one subtask's `completed` flag (spec section 10). */
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
  return data as MissionSubtask;
}

const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 2000;
const MAX_REWARD = 1_000_000; // sanity cap only — Postgres just requires >= 0 (0007), this
// only stops an obvious typo (e.g. an extra zero) before it ever reaches the network.

export interface NewMissionInput {
  workspaceId: string;
  createdBy: string;
  /** Spec section 4: a MEMBER may only assign to themselves; an OWNER may
   * assign to anyone (enforced for real by RLS `missions_insert`, 0016). */
  assignedTo: string;
  skillId: string;
  areaId: string | null;
  title: string;
  description: string;
  difficulty: MissionDifficulty;
  xpReward: number;
  coinReward: number;
  /** Datetime-local input value, or empty string for "sin fecha límite"
   * (spec section 9: due_at is nullable and not required). */
  dueAt: string;
  /** Subtask titles, in display order. Spec section 10: subtasks carry no
   * reward of their own, so only the title is collected here. */
  subtaskTitles: string[];
}

/**
 * Spec section 9 "Misiones" + section 10 "Submisiones". Client-side checks
 * here mirror (but do not replace) the real constraints in
 * `0007_areas_missions.sql` / `0008_mission_subtasks.sql` — spec section 32:
 * "Las validaciones frontend son para UX." Two inserts (mission, then its
 * subtasks) rather than one RPC: unlike `complete_mission`/`purchase_item`
 * this isn't an economic operation with a race condition to close (nobody
 * else can see or act on a mission until its own creator finishes creating
 * it), so a plain multi-step client flow is the simplest option that
 * satisfies section 56 without inventing a `create_mission` RPC the spec
 * never asked for.
 */
export async function createMission(input: NewMissionInput): Promise<Mission> {
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
  const subtaskTitles = input.subtaskTitles.map((t) => t.trim()).filter((t) => t.length > 0);

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
      due_at: input.dueAt.length > 0 ? new Date(input.dueAt).toISOString() : null
    })
    .select()
    .single();

  if (error) throw new MissionApiError(error.message, error.code);
  const mission = data as Mission;

  if (subtaskTitles.length > 0) {
    const rows = subtaskTitles.map((subtaskTitle, index) => ({
      mission_id: mission.id,
      title: subtaskTitle,
      position: index
    }));
    const { error: subtaskError } = await supabase.from('mission_subtasks').insert(rows);
    // The mission itself was already created successfully at this point;
    // surface the subtask failure distinctly so the UI can say so instead of
    // implying the whole mission creation failed.
    if (subtaskError) {
      throw new MissionApiError(
        `La misión se creó, pero las submisiones no se pudieron guardar: ${subtaskError.message}`,
        subtaskError.code
      );
    }
  }

  return mission;
}
