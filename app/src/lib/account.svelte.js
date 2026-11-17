// The signed-in account: create with a key, sign in with a key, optional email
// for recovery, new key. Uses Supabase Auth: the key is the account password
// (Supabase stores it hashed and limits wrong guesses).
import { supabase } from './supabase.js';
import { newKey, newPlayerCode, parseKey, keyEmail } from './logic/keys.js';
import { remove } from './storage.js';

class Account {
  ready = $state(!supabase); // true once we know whether someone is signed in
  user = $state.raw(null);
  profile = $state.raw(null);
  recovering = $state(false); // opened from a "forgot key" email link
  creating = false; // while true, the sign-in event must not load the (not yet saved) profile

  get enabled() {
    return Boolean(supabase);
  }

  // The email the person added, if any (not the hidden key address).
  get email() {
    const e = this.user?.email ?? '';
    return e.endsWith('@keys.sidecourt.invalid') ? null : e;
  }

  // An email change waiting for the person to click the confirmation link.
  get pendingEmail() {
    return this.user?.new_email ?? null;
  }

  async loadProfile() {
    if (!this.user) {
      this.profile = null;
      return;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', this.user.id).maybeSingle();
    if (error) throw error;
    this.profile = data;
  }

  // Create an account. Returns the new key: it must be shown to the person once.
  async create(displayName) {
    const name = displayName.trim();
    if (!name) throw new Error('Enter your name.');
    const key = newKey();
    const { keyId } = parseKey(key);
    this.creating = true;
    try {
      return await this.#createWithKey(name, key, keyId);
    } finally {
      this.creating = false;
    }
  }

  async #createWithKey(name, key, keyId) {
    const { data, error } = await supabase.auth.signUp({ email: keyEmail(keyId), password: key });
    if (error) throw error;
    if (!data.session) throw new Error('Supabase asked to confirm the sign-up by email. Turn off "Confirm email" (see app/supabase/SETUP.md).');
    this.user = data.user;

    // A clash of random player codes is possible but very rare: try a few times.
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = { id: data.user.id, key_id: keyId, player_code: newPlayerCode(), display_name: name };
      const { error: insertError } = await supabase.from('profiles').insert(row);
      if (!insertError) {
        this.profile = row;
        return key;
      }
      if (insertError.code !== '23505') throw insertError; // 23505 = already taken
    }
    throw new Error('Could not create a player code. Try again.');
  }

  async signIn(input) {
    const parsed = parseKey(input);
    if (!parsed) throw new Error('That does not look like a key. It has 16 letters and numbers, like ABCD-EFGH-JKMN-PQRS.');
    const { data: email, error } = await supabase.rpc('login_email', { p_key_id: parsed.keyId });
    if (error) throw error;
    if (!email) throw new Error('No account has that key.');
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: parsed.key });
    if (signInError) throw new Error(signInError.status === 429 ? 'Too many tries. Wait a few minutes and try again.' : 'That key is not right.');
  }

  async signOut() {
    await supabase.auth.signOut();
  }

  // Supabase sends a confirmation link to the new address.
  async addEmail(email) {
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    if (error) throw error;
  }

  // Replaces the key: the old one stops working. Returns the new key to show once.
  async replaceKey() {
    const key = newKey();
    const { keyId } = parseKey(key);
    const { error } = await supabase.auth.updateUser({ password: key });
    if (error) throw error;
    const { error: updateError } = await supabase.from('profiles').update({ key_id: keyId }).eq('id', this.user.id);
    if (updateError) throw updateError;
    this.profile = { ...this.profile, key_id: keyId };
    this.recovering = false;
    return key;
  }

  // Permanently deletes the account (see supabase/04_delete_account.sql).
  async deleteAccount() {
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    remove('sidecourt.outbox'); // games waiting to upload were recorded by this account
    await supabase.auth.signOut({ scope: 'local' }); // the account is gone; just forget it here
    this.user = null;
    this.profile = null;
  }

  // Forgot the key: email a link that signs them in so they can get a new key.
  async sendRecovery(email, redirectTo) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) throw error;
  }
}

export const account = new Account();

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    account.user = session?.user ?? null;
    if (event === 'PASSWORD_RECOVERY') account.recovering = true;
    if (account.creating) return;
    // Load the profile outside this callback (Supabase advises against awaiting in it).
    setTimeout(() => {
      account.loadProfile().catch(() => {}).finally(() => (account.ready = true));
    });
  });
}
