import { writable } from 'svelte/store';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase/client';
import { getCached, setCached } from '$lib/cache/db';
import type { Profile } from '$lib/types/domain';

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** True while `profile` came from the IndexedDB cache instead of a
   * successful network read (spec section 27). */
  profileFromCache: boolean;
  /** When `profileFromCache` is true, when that cached copy was written. */
  profileCachedAt: string | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    session: null,
    profile: null,
    loading: true,
    profileFromCache: false,
    profileCachedAt: null
  });

  /**
   * Network-first, cache-fallback (spec section 27: "La base de datos
   * remota siempre es la autoridad" — try it first every time — but
   * "permitir lectura de datos cacheados cuando no haya conexión"). A
   * successful read always overwrites the IndexedDB copy so the next
   * offline session has the freshest possible snapshot.
   */
  async function loadProfile(userId: string) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();

    if (!error && data) {
      const profile = data as Profile;
      update((s) => ({ ...s, profile, profileFromCache: false, profileCachedAt: null }));
      void setCached('profile', userId, profile);
      return;
    }

    const cached = await getCached<Profile>('profile', userId);
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

  /** Re-fetches the profile row — call after any mutation that can change
   * total_xp / level / coins (mission completion, purchase). */
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

export const auth = createAuthStore();
