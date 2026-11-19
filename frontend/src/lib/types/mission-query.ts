import type { MissionDifficulty } from './domain';

export type MissionStatusFilter = 'TODO' | 'DOING' | 'DONE' | 'OVERDUE';

export const MISSION_STATUS_FILTER_OPTIONS: MissionStatusFilter[] = [
  'TODO',
  'DOING',
  'DONE',
  'OVERDUE'
];

export interface MissionFilters {
  statuses: MissionStatusFilter[];
  areaId: string | null;
  skillId: string | null;
  difficulty: MissionDifficulty | null;
  search: string;
}

export const EMPTY_MISSION_FILTERS: MissionFilters = {
  statuses: ['DOING'],
  areaId: null,
  skillId: null,
  difficulty: null,
  search: ''
};

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

export interface MissionCursor {
  sortValue: string | number | null;
  id: string;
}
