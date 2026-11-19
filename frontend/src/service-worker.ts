/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { base, build, files, version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = `gamify-cache-${version}`;

const PRECACHE_URLS =
  build.length > 0
    ? [...build, ...files.filter((f) => !/\/_(headers|redirects)$/.test(f)), `${base}/`]
    : [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (PRECACHE_URLS.length > 0) {
        const cache = await caches.open(CACHE_NAME);

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

  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  if (PRECACHE_URLS.length === 0) return;

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
