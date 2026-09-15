import { w as writable } from "./index3.js";
import { s as supabase } from "./client.js";
import { s as setCached, g as getCached } from "./db.js";
function createAuthStore() {
  const { subscribe, set, update } = writable({
    session: null,
    profile: null,
    loading: true,
    profileFromCache: false,
    profileCachedAt: null
  });
  async function loadProfile(userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    if (!error && data) {
      const profile = data;
      update((s) => ({ ...s, profile, profileFromCache: false, profileCachedAt: null }));
      void setCached("profile", userId, profile);
      return;
    }
    const cached = await getCached("profile", userId);
    if (cached) {
      update((s) => ({
        ...s,
        profile: cached.data,
        profileFromCache: true,
        profileCachedAt: cached.cachedAt
      }));
    }
  }
  async function init() {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    set({ session, profile: null, loading: false, profileFromCache: false, profileCachedAt: null });
    if (session) await loadProfile(session.user.id);
    supabase.auth.onAuthStateChange((_event, newSession) => {
      set({
        session: newSession,
        profile: null,
        loading: false,
        profileFromCache: false,
        profileCachedAt: null
      });
      if (newSession) void loadProfile(newSession.user.id);
    });
  }
  async function refreshProfile() {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (session) await loadProfile(session.user.id);
  }
  async function signOut() {
    await supabase.auth.signOut();
  }
  return { subscribe, init, refreshProfile, signOut };
}
const auth = createAuthStore();
export {
  auth as a
};
