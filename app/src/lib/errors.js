// Records app crashes in Supabase (table client_errors), so they can be found and fixed.
// Sends only the error text and the page path, never addresses with their query
// (scorer links hold a secret), and blanks anything shaped like an account key.
import { version } from '$app/env';
import { supabase } from './supabase.js';

const MAX_PER_PAGE_LOAD = 5;
const sent = new Set();

export const cleanMessage = (text) => String(text ?? 'unknown')
  .replace(/https?:\/\/\S+/g, '[link]')
  .replace(/[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}/gi, '[key]')
  .slice(0, 300);

export function reportError(error) {
  if (!supabase || !navigator.onLine) return;
  const message = cleanMessage(error?.message ?? error);
  if (sent.has(message) || sent.size >= MAX_PER_PAGE_LOAD) return;
  sent.add(message);
  supabase.rpc('report_client_error', { p_message: message, p_path: location.pathname, p_version: version }).then(() => {}, () => {});
}

export function watchForErrors() {
  window.addEventListener('error', (event) => reportError(event.error ?? event.message));
  window.addEventListener('unhandledrejection', (event) => reportError(event.reason));
}
