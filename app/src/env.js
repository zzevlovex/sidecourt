// Settings read when the site is built (from .env locally, from Cloudflare online).
// Both are public: every browser receives them. Never add the sb_secret_ key here.
// Left unset, the app still works offline, without accounts.
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value) => value || undefined;

export const variables = defineEnvVars({
  PUBLIC_SUPABASE_URL: { public: true, static: true, schema: optional, description: 'Supabase project address' },
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: { public: true, static: true, schema: optional, description: 'Supabase publishable key' },
});
