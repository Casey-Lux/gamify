import { w as writable } from "./index3.js";
import { f as fetchSkillProgress } from "./CachedNotice.js";
import { s as setCached, g as getCached } from "./db.js";
const CACHE_KEY = "current";
function createUserSkillsStore() {
  const { subscribe, set, update } = writable({
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
      void setCached("user-skills", CACHE_KEY, skills);
    } catch {
      const cached = await getCached("user-skills", CACHE_KEY);
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
const userSkillsStore = createUserSkillsStore();
export {
  userSkillsStore as u
};
