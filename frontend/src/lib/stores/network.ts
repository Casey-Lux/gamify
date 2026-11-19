import { writable } from 'svelte/store';
import { browser } from '$app/environment';

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
