import { writable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Captures the browser's own "install this PWA" prompt (Chromium's
 * `beforeinstallprompt`) so Profile can offer an explicit, low-key
 * "Instalar aplicación" button (spec section 26: "La aplicación debe
 * instalarse en Android y navegadores desktop compatibles") instead of
 * only relying on the browser's own (easy to miss) address-bar icon.
 *
 * `beforeinstallprompt` is a Chromium-only event — it never fires on
 * Firefox or Safari/iOS. There is no cross-browser API for a programmatic
 * install prompt, so on those browsers `canInstall` simply stays `false`
 * forever and Profile shows nothing extra; iOS's own manual "Add to Home
 * Screen" flow is still enabled by the `apple-mobile-web-app-*` tags in
 * app.html (Fase 11), it just can't be triggered from inside the page.
 */
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
      // Prevent the browser's default mini-infobar; we surface our own
      // button instead, fired on the user's own action rather than
      // automatically the moment Chromium considers the app "installable".
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
    // Per spec, a captured prompt can only be used once — regardless of the
    // outcome, it is now spent and the button hides until (if ever) the
    // browser fires another `beforeinstallprompt`.
    deferredEvent = null;
    set(false);
  }

  return { subscribe, init, promptInstall };
}

export const installPrompt = createInstallPromptStore();
