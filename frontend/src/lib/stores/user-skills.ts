import { writable } from 'svelte/store';
import { fetchSkillProgress } from '$lib/api/statistics';
import { getCached, setCached } from '$lib/cache/db';
import type { SkillProgress } from '$lib/types/statistics';

const CACHE_KEY = 'current';

export interface UserSkillsState {
  skills: SkillProgress[];
  loading: boolean;
  /** True when `skills` came from the IndexedDB cache (spec section 27) —
   * keeps the User Card showing something on the Missions/Profile pages
   * instead of going blank the moment the network read fails. */
  fromCache: boolean;
  cachedAt: string | null;
}

/**
 * Reuses `fetchSkillProgress` (built for the Fase 9 radar chart) rather
 * than duplicating a "current level per skill" query — both need exactly
 * the same rows (player_skills joined to skills.name).
 */
function createUserSkillsStore() {
  const { subscribe, set, update } = writable<UserSkillsState>({
    skills: [],
    loading: false,
    fromCache: false,
    cachedAt: null
  });

  async function load() {
    update((s) => ({ ...s, loading: true }));
    try {
      const skills = await fetchSkillProgress();
      set({ skills, loading: false, fromCache: false, cachedAt: null });
      void setCached('user-skills', CACHE_KEY, skills);
    } catch {
      const cached = await getCached<SkillProgress[]>('user-skills', CACHE_KEY);
      if (cached) {
        set({ skills: cached.data, loading: false, fromCache: true, cachedAt: cached.cachedAt });
        return;
      }
      update((s) => ({ ...s, loading: false }));
    }
  }

  function reset() {
    set({ skills: [], loading: false, fromCache: false, cachedAt: null });
  }

  return { subscribe, load, reset };
}

export const userSkillsStore = createUserSkillsStore();
