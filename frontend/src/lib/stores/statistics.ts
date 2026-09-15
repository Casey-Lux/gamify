import { writable } from 'svelte/store';
import { fetchCompletions, fetchSkillProgress, fetchWalletTransactions } from '$lib/api/statistics';
import { windowStartIso } from '$lib/utils/date-buckets';
import { getCached, setCached } from '$lib/cache/db';
import { statisticsCacheKey } from '$lib/cache/keys';
import type { WalletTransaction } from '$lib/types/domain';
import type { CompletionWithContext, SkillProgress, StatGranularity } from '$lib/types/statistics';

export interface StatisticsState {
  granularity: StatGranularity;
  completions: CompletionWithContext[];
  walletTransactions: WalletTransaction[];
  skillProgress: SkillProgress[];
  loading: boolean;
  error: string | null;
  /** True when the current data came from the IndexedDB cache (spec
   * section 27) instead of a successful network read for this granularity. */
  fromCache: boolean;
  cachedAt: string | null;
}

interface CachedStatistics {
  completions: CompletionWithContext[];
  walletTransactions: WalletTransaction[];
  skillProgress: SkillProgress[];
}

const initialState: StatisticsState = {
  granularity: 'day',
  completions: [],
  walletTransactions: [],
  skillProgress: [],
  loading: false,
  error: null,
  fromCache: false,
  cachedAt: null
};

function createStatisticsStore() {
  const { subscribe, update, set } = writable<StatisticsState>(initialState);

  async function load(granularity: StatGranularity) {
    update((s) => ({ ...s, granularity, loading: true, error: null }));
    const sinceIso = windowStartIso(granularity);
    const cacheKey = statisticsCacheKey(granularity);

    try {
      const [completions, walletTransactions, skillProgress] = await Promise.all([
        fetchCompletions(sinceIso),
        fetchWalletTransactions(sinceIso),
        fetchSkillProgress()
      ]);
      update((s) => ({
        ...s,
        completions,
        walletTransactions,
        skillProgress,
        loading: false,
        fromCache: false,
        cachedAt: null
      }));
      void setCached<CachedStatistics>('statistics', cacheKey, {
        completions,
        walletTransactions,
        skillProgress
      });
    } catch {
      const cached = await getCached<CachedStatistics>('statistics', cacheKey);
      if (cached) {
        update((s) => ({
          ...s,
          completions: cached.data.completions,
          walletTransactions: cached.data.walletTransactions,
          skillProgress: cached.data.skillProgress,
          loading: false,
          fromCache: true,
          cachedAt: cached.cachedAt
        }));
        return;
      }
      update((s) => ({
        ...s,
        loading: false,
        error: 'No se pudieron cargar las estadísticas.',
        fromCache: false,
        cachedAt: null
      }));
    }
  }

  function setGranularity(granularity: StatGranularity) {
    void load(granularity);
  }

  function reset() {
    set(initialState);
  }

  return { subscribe, load, setGranularity, reset };
}

export const statisticsStore = createStatisticsStore();
