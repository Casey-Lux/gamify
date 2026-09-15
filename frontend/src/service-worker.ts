/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';

/**
 * Fase 11 (spec sección 26 "PWA" + sección 39 "Performance"). Scope, on
 * purpose, kept to exactly what those sections ask for:
 *
 *   1. Let the installed app open even with no connectivity (cache the
 *      built app shell + static assets).
 *   2. Never cache Supabase (a different origin) — that data's own,
 *      separate, explicit cache is IndexedDB (`src/lib/cache`), which each
 *      store already falls back to and clearly marks as possibly stale
 *      (spec section 27). A service worker cache has no way to express
 *      "this might be stale" to the UI, so it must never be the thing that
 *      answers a request for business data.
 *   3. Never intercept anything other than same-origin GET requests — in
 *      particular never a mutation (POST/PATCH/RPC calls), so there is no
 *      way this file could make a write appear to succeed while offline
 *      (spec section 27 explicitly rules out offline writes for the MVP).
 */

// This file itself runs in the service worker global scope, not the DOM
// that the rest of the app's (shared) tsconfig assumes — `self` here is a
// ServiceWorkerGlobalScope, not `Window`.
declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = `gamify-cache-${version}`;

// `build`/`files` are empty during `npm run dev` (no production manifest
// exists yet to precache) — install a no-op worker rather than caching
// dev-server URLs that change on every reload. The app shell itself
// (`${base}/`, adapter-static's `fallback: 'index.html'` — see
// svelte.config.js) is not part of `build`/`files` because it's written by
// the adapter step, after this manifest is computed, so it's added
// explicitly.
const PRECACHE_URLS = build.length > 0 ? [...build, ...files, `${base}/`] : [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (PRECACHE_URLS.length > 0) {
        const cache = await caches.open(CACHE_NAME);
        // `{ cache: 'reload' }` bypasses the HTTP cache for each precache
        // fetch so a stale intermediary copy never gets baked into a fresh
        // service worker cache.
        await cache.addAll(PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload' })));
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('gamify-cache-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept mutations, and never anything cross-origin (Supabase
  // Auth/REST/RPC/Storage all live on a different origin) — see the header
  // comment above.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (PRECACHE_URLS.length === 0) return; // dev: pass everything straight through

  // SPA navigations: network-first (so a logged-in user always gets a live
  // page when online), falling back to the cached app shell when offline
  // instead of the browser's own "no internet" error page. The client-side
  // router (src/routes/+layout.ts) + the auth guard then take over exactly
  // as they do on a normal load.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const shell = await cache.match(`${base}/`);
        return shell ?? Response.error();
      })
    );
    return;
  }

  // Everything else same-origin (hashed JS/CSS bundles, icons, manifest,
  // favicon): cache-first, since these are content-hashed/immutable for a
  // given `version` and safe to serve without hitting the network at all;
  // still falls back to the network (and opportunistically stores the
  // result) for anything not swept up by the precache list above.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          void cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })()
  );
});
