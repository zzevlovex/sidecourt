import adapter from '@sveltejs/adapter-static';

// Builds plain HTML/CSS/JS files into build/, so the app can be hosted for free
// on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).
/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
  },
};

export default config;
