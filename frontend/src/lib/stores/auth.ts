import { get, writable } from 'svelte/store';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '$lib/supabase/client';
import { getCached, setCached } from '$lib/cache/db';
import type { Profile } from '$lib/types/domain';

export interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;

  profileFromCache: boolean;

  profileCachedAt: string | null;
}

function createAuthStore() {
  const store = writable<AuthState>({
    session: null,
    profile: null,
    loading: true,
    profileFromCache: false,
    profileCachedAt: null
  });
  const { subscribe, set, update } = store;

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
      const currentUserId = get(store).session?.user.id ?? null;
      if (newSession && newSession.user.id === currentUserId) return;

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

export const auth = createAuthStore();
