import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-static';
import { defineConfig } from 'vite';

// Builds plain files into build/, so the app can be hosted for free on any static host.
export default defineConfig(({ command }) => ({
  // Fonts stay separate files, so the strict content policy can allow only this site.
  build: { assetsInlineLimit: 0 },
  plugins: [
    sveltekit({
      // 404.html: hosts serve it, with a real "not found" status, for unknown addresses.
      adapter: adapter({ fallback: '404.html' }),
      // Content Security Policy: the browser only runs this app's own scripts and
      // only talks to Supabase, which limits the damage of any injected content.
      // Left out in dev, where Vite needs its own live-reload connection.
      csp: command === 'build' ? {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          'script-src': ['self'],
          'style-src': ['self', 'unsafe-inline'],
          'font-src': ['self'],
          'img-src': ['self', 'data:', 'blob:'],
          'connect-src': ['self', 'https://*.supabase.co'],
          'worker-src': ['self'],
          'manifest-src': ['self'],
          'object-src': ['none'],
          'base-uri': ['self'],
          'form-action': ['self'],
        },
      } : undefined,
    }),
  ],
}));
