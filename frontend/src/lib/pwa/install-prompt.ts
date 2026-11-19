import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function createInstallPromptStore() {
  const { subscribe, set } = writable<boolean>(false);
  let deferredEvent: BeforeInstallPromptEvent | null = null;

  function init(): () => void {
    if (!browser) return () => {};

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      deferredEvent = event as BeforeInstallPromptEvent;
      set(true);
    }

    function onAppInstalled() {
      deferredEvent = null;
      set(false);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }

  async function promptInstall(): Promise<void> {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    await deferredEvent.userChoice;

    deferredEvent = null;
    set(false);
  }

  return { subscribe, init, promptInstall };
}

export const installPrompt = createInstallPromptStore();
