import adapter from '@sveltejs/adapter-static';

// Builds plain HTML/CSS/JS files into build/, so the app can be hosted for free
// on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).
/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    // Content Security Policy: the browser only runs this app's own scripts and
    // only talks to Supabase, which limits the damage of any injected content.
    // Left out in dev, where Vite needs its own live-reload connection.
    csp: process.argv.includes('dev') ? undefined : {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'font-src': ['self', 'https://fonts.gstatic.com'],
        'img-src': ['self', 'data:', 'blob:'],
        'connect-src': ['self', 'https://*.supabase.co'],
        'worker-src': ['self'],
        'manifest-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
      },
    },
  },
};

export default config;
