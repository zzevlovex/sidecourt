// Makes Sidecourt work offline (gym Wi-Fi drops) and installable on phones.
// SvelteKit registers this file automatically.
/// <reference types="@sveltejs/kit" />
import { immutable, assets, prerendered } from '$app/manifest';
import { version } from '$app/env';

const paths = (list) => list.map(({ path: p }) => (p.startsWith('/') ? p : `/${p}`));

const CACHE = `sidecourt-${version}`;
// "_headers" is a settings file for the host, not something browsers can fetch:
// leaving it in would make the offline install fail.
// Fonts come in many alphabets: only the ones this app's text uses are stored for offline.
const wanted = (file) => !file.endsWith('.woff2') || /-latin-wght-/.test(file);
const APP_FILES = [...paths(immutable).filter(wanted), ...paths(assets).filter((file) => !['/_headers', '/robots.txt'].includes(file)), ...paths(prerendered)];

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
  if (!sameSite) return;

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
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    } catch (error) {
      const hit = (await cache.match(event.request)) || (sameSite && (await cache.match(url.pathname)));
      if (hit) return hit;
      throw error;
    }
  })());
});
