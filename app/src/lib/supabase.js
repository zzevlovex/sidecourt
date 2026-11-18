// The connection to the Supabase project. Values come from src/env.js.
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL as url, PUBLIC_SUPABASE_PUBLISHABLE_KEY as key } from '$app/env/public';

// null when the settings are empty: the app still works offline, without accounts.
export const supabase = url && key ? createClient(url, key) : null;
