# Supabase setup for Sidecourt accounts

Do these once in the Supabase dashboard (https://supabase.com/dashboard), in your project.

## 1. Create the tables

1. Open **SQL Editor** (left sidebar) and click **New query**.
2. Paste everything from `app/supabase/01_accounts.sql`.
3. Click **Run**. It should say "Success. No rows returned".

## 2. Sign-in settings

Go to **Authentication > Sign In / Providers > Email** and set:

- **Confirm email: OFF.** Accounts sign up with a key, not an email, so there is nothing to confirm.
- **Secure email change: OFF.** Otherwise adding a recovery email waits for a confirmation
  sent to the hidden key address, which can never arrive.

Leave **Enable Email provider** ON. Click **Save**.

## 3. Links in emails

Go to **Authentication > URL Configuration**:

- **Site URL:** `http://localhost:5173` (change it to the real address when the app goes online).
- **Redirect URLs:** add `http://localhost:5173/account`. Later also add the online address,
  for example `https://your-site.netlify.app/account`.

## Never

Never put the **secret key** (`sb_secret_...`) in the app or in `.env`. The app only needs the
publishable key.
