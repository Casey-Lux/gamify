import type { MissionFilters, MissionSort } from '$lib/types/mission-query';
import type { StatGranularity } from '$lib/types/statistics';

export function missionsCacheKey(filters: MissionFilters, sort: MissionSort, page: number): string {
  return JSON.stringify({ filters, sort, page });
}

export function statisticsCacheKey(granularity: StatGranularity): string {
  return granularity;
}

export function catalogCacheKey(workspaceId: string): string {
  return workspaceId;
}
