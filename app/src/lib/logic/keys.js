// Account keys and player codes.
//
// Account key: 16 random characters, shown as XXXX-XXXX-XXXX-XXXX (80 bits).
//   It is the account's password (Supabase stores it hashed).
// Lookup id: 8 characters computed from the key by a one-way hash, used to find
//   which account a key belongs to. It reveals nothing about the key.
//   Accounts made before this existed used the key's first 8 characters; they
//   are moved to a lookup id the next time they sign in.
// Player code: 6 random characters, public. Managers use it to check a player in.
//
// The alphabet has 32 characters (no 0/O or 1/I, which people mix up), so each
// random byte maps to a character with no bias using & 31.
export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function randomChars(n, randomBytes) {
  return Array.from(randomBytes(n), (byte) => ALPHABET[byte & 31]).join('');
}

const cryptoBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export function newKey(randomBytes = cryptoBytes) {
  return randomChars(16, randomBytes).match(/.{4}/g).join('-');
}

export function newPlayerCode(randomBytes = cryptoBytes) {
  return randomChars(6, randomBytes);
}

// Accepts what people actually type: lower case, spaces, missing dashes.
// Returns { key, keyId } or null when it cannot be a valid key.
export function parseKey(input) {
  const chars = String(input).toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (chars.length !== 16 || [...chars].some((c) => !ALPHABET.includes(c))) return null;
  return { key: chars.match(/.{4}/g).join('-'), keyId: chars.slice(0, 8) };
}

// The one-way lookup id for a key (XXXX-XXXX-XXXX-XXXX).
export async function keyLookupId(key) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`sidecourt-key-id:${key}`)));
  return randomChars(8, () => bytes.slice(0, 8));
}

// The sign-in address Supabase needs. Never shown and never emailed:
// ".invalid" is a reserved domain that cannot receive mail.
export const keyEmail = (keyId) => `${keyId.toLowerCase()}@keys.sidecourt.invalid`;
