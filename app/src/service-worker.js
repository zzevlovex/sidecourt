// Makes Sidecourt work offline (gym Wi-Fi drops) and installable on phones.
// SvelteKit registers this file automatically.
/// <reference types="@sveltejs/kit" />
import { build, files, prerendered, version } from '$service-worker';

const CACHE = `sidecourt-${version}`;
const APP_FILES = [...build, ...files, ...prerendered];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

// A new version replaces the old cache.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const sameSite = url.origin === self.location.origin;
  if (!sameSite && !FONT_HOSTS.includes(url.hostname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // App files never change within a version: serve them straight from the cache.
    if (sameSite && APP_FILES.includes(url.pathname)) {
      const hit = await cache.match(url.pathname);
      if (hit) return hit;
    }

    // Everything else: try the network, fall back to the cache when offline.
    try {
      const response = await fetch(event.request);
      if (response.ok || response.type === 'opaque') cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const hit = (await cache.match(event.request)) || (sameSite && (await cache.match(url.pathname)));
      if (hit) return hit;
      throw error;
    }
  })());
});
