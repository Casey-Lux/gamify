import { writable, get } from 'svelte/store';
import { fetchMissionsPage, MissionApiError } from '$lib/api/missions';
import { getCached, setCached } from '$lib/cache/db';
import { missionsCacheKey } from '$lib/cache/keys';
import type { MissionWithRelations } from '$lib/types/domain';
import {
  DEFAULT_MISSION_SORT,
  EMPTY_MISSION_FILTERS,
  type MissionFilters,
  type MissionSort
} from '$lib/types/mission-query';

export interface MissionsState {
  missions: MissionWithRelations[];
  filters: MissionFilters;
  sort: MissionSort;
  page: number;
  totalCount: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
  /** True when `missions` came from the IndexedDB cache (spec section 27)
   * because the network request for this exact filters/sort/page failed. */
  fromCache: boolean;
  cachedAt: string | null;
}

interface CachedMissionsPage {
  missions: MissionWithRelations[];
  totalCount: number;
  hasMore: boolean;
}

const initialState: MissionsState = {
  missions: [],
  filters: { ...EMPTY_MISSION_FILTERS },
  sort: { ...DEFAULT_MISSION_SORT },
  page: 0,
  totalCount: 0,
  hasMore: false,
  loading: false,
  error: null,
  fromCache: false,
  cachedAt: null
};

function createMissionsStore() {
  const { subscribe, update, set } = writable<MissionsState>(initialState);

  async function load() {
    const state = get({ subscribe });
    update((s) => ({ ...s, loading: true, error: null }));

    const cacheKey = missionsCacheKey(state.filters, state.sort, state.page);

    try {
      const result = await fetchMissionsPage(state.filters, state.sort, state.page);
      update((s) => ({
        ...s,
        missions: result.missions,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        loading: false,
        fromCache: false,
        cachedAt: null
      }));
      void setCached<CachedMissionsPage>('missions', cacheKey, result);
    } catch (err) {
      // Network/RLS failure: fall back to this exact query's last cached
      // result, if any (spec section 27). Only the current view's own cache
      // slot is consulted — never a different filter/sort/page's cache —
      // so the user never sees missions silently reshuffled under a filter
      // they did not ask for.
      const cached = await getCached<CachedMissionsPage>('missions', cacheKey);
      if (cached) {
        update((s) => ({
          ...s,
          missions: cached.data.missions,
          totalCount: cached.data.totalCount,
          hasMore: cached.data.hasMore,
          loading: false,
          fromCache: true,
          cachedAt: cached.cachedAt
        }));
        return;
      }

      const message =
        err instanceof MissionApiError ? err.message : 'No se pudieron cargar las misiones.';
      update((s) => ({ ...s, loading: false, error: message, fromCache: false, cachedAt: null }));
    }
  }

  function setFilters(filters: Partial<MissionFilters>) {
    update((s) => ({ ...s, filters: { ...s.filters, ...filters }, page: 0 }));
    void load();
  }

  function clearFilters() {
    update((s) => ({ ...s, filters: { ...EMPTY_MISSION_FILTERS }, page: 0 }));
    void load();
  }

  function clearFilter(key: keyof MissionFilters) {
    update((s) => ({
      ...s,
      filters: { ...s.filters, [key]: EMPTY_MISSION_FILTERS[key] },
      page: 0
    }));
    void load();
  }

  function setSort(sort: MissionSort) {
    update((s) => ({ ...s, sort, page: 0 }));
    void load();
  }

  function nextPage() {
    update((s) => (s.hasMore ? { ...s, page: s.page + 1 } : s));
    void load();
  }

  function previousPage() {
    update((s) => (s.page > 0 ? { ...s, page: s.page - 1 } : s));
    void load();
  }

  function reset() {
    set(initialState);
  }

  return {
    subscribe,
    load,
    setFilters,
    clearFilters,
    clearFilter,
    setSort,
    nextPage,
    previousPage,
    reset
  };
}

export const missionsStore = createMissionsStore();
