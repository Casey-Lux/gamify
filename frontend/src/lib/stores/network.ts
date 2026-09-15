import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Tracks browser connectivity (spec section 27: "dejando claro cuándo los
 * datos pueden estar desactualizados"). Deliberately based on
 * `navigator.onLine` + the `online`/`offline` window events rather than
 * polling Supabase — it only needs to answer "should I warn the user that
 * what they're seeing might be stale", not "is Supabase specifically
 * reachable right now" (each store's own network call already handles that
 * distinction: a store falls back to its IndexedDB cache whenever its own
 * fetch fails, online flag or not).
 *
 * `browser` guard: this module is imported from `+layout.svelte`, which
 * runs during SSR-less prerendering too (see `+layout.ts`); `navigator` does
 * not exist at that point.
 */
function createNetworkStore() {
  const { subscribe, set } = writable<boolean>(browser ? navigator.onLine : true);

  function init() {
    if (!browser) return () => {};
    const goOnline = () => set(true);
    const goOffline = () => set(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    set(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }

  return { subscribe, init };
}

export const online = createNetworkStore();
