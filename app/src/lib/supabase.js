// The connection to the Supabase project. Values come from app/.env.
import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

const url = env.PUBLIC_SUPABASE_URL;
const key = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// null when .env is not filled in: the app still works offline, without accounts.
export const supabase = url && key ? createClient(url, key) : null;
