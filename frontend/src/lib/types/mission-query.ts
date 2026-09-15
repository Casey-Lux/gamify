import type { MissionDifficulty } from './domain';

/**
 * Spec section 21 "Filtros de misiones": all filters are optional and
 * combine with AND (acumulativos). `undefined`/`null` means "not applied".
 */
export interface MissionFilters {
  status: 'ALL' | 'PENDING' | 'COMPLETED';
  areaId: string | null;
  skillId: string | null;
  difficulty: MissionDifficulty | null;
  dueBefore: string | null; // ISO date, inclusive upper bound on due_at
  dueAfter: string | null; // ISO date, inclusive lower bound on due_at
  xpMin: number | null;
  xpMax: number | null;
  coinsMin: number | null;
  coinsMax: number | null;
  search: string; // matches title (client-side ILIKE via query)
}

export const EMPTY_MISSION_FILTERS: MissionFilters = {
  status: 'PENDING',
  areaId: null,
  skillId: null,
  difficulty: null,
  dueBefore: null,
  dueAfter: null,
  xpMin: null,
  xpMax: null,
  coinsMin: null,
  coinsMax: null,
  search: ''
};

/** Spec section 22 "Ordenamiento". */
export type MissionSortField =
  'xp_reward' | 'coin_reward' | 'difficulty' | 'due_at' | 'created_at' | 'updated_at';

export type SortDirection = 'ASC' | 'DESC';

export interface MissionSort {
  field: MissionSortField;
  direction: SortDirection;
}

export const DEFAULT_MISSION_SORT: MissionSort = {
  field: 'created_at',
  direction: 'DESC'
};

export const MISSION_PAGE_SIZE = 20;

/**
 * Cursor for keyset pagination: the sort-field value and id of the last row
 * of the previous page. Using (sort value, id) as a compound cursor gives a
 * stable, deterministic order even when many rows share the same sort value
 * (spec section 22: "Usar orden secundario determinista por id.").
 */
export interface MissionCursor {
  sortValue: string | number | null;
  id: string;
}
