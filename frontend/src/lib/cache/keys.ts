import type { MissionFilters, MissionSort } from '$lib/types/mission-query';
import type { StatGranularity } from '$lib/types/statistics';

/**
 * Deterministic IndexedDB keys for each cached "misiones recientes" /
 * "estadísticas recientes" query (spec section 27). Pulled out as pure,
 * unit-testable functions (spec section 40: "no duplicar reglas… en
 * componentes o tests" — the exact key shape lives in exactly one place)
 * rather than inlined `JSON.stringify(...)` calls scattered across stores.
 *
 * Keying missions by the *exact* filters + sort + page (rather than a
 * single fixed "last missions" slot) means that reopening the same filtered
 * view offline shows the right cached page instead of a mismatched one from
 * a different filter combination — at the cost of only ever having a cache
 * hit for a query the user has actually already run while online, which is
 * the realistic case (spec section 27 explicitly rules out offline writes
 * or conflict resolution — offline is read-only "as you last saw it").
 */
export function missionsCacheKey(filters: MissionFilters, sort: MissionSort, page: number): string {
  return JSON.stringify({ filters, sort, page });
}

export function statisticsCacheKey(granularity: StatGranularity): string {
  return granularity;
}

export function catalogCacheKey(workspaceId: string): string {
  return workspaceId;
}
