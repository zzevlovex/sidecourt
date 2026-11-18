# Supabase setup

Never put the **secret key** (`sb_secret_...`) in the app, in `.env` or in Cloudflare.
The app only needs the project URL and the publishable key.

## New project

### 1. Run the database files

In **SQL Editor > New query**, paste and run each file once, in this order:

| File | What it adds |
|---|---|
| `01_accounts.sql` | Accounts and key sign-in |
| `02_history.sql` | Check-in by code and game history |
| `03_lobby.sql` | Open play lobbies |
| `04_delete_account.sql` | Delete my account |
| `05_sessions.sql` | Open play history |
| `06_court_scores.sql` | Scorer links |
| `07_security.sql` | Size limits, rate limits, "Not me" |
| `08_reliability.sql` | Lower data use, session resume, error log |

Every file is safe to run again. To see what a project already has, run
`select * from schema_migrations order by file;`. It lists the files up to `08` once `08` has run.
**Changing the database later:** add the next numbered file, run it on staging first, then on production,
and add a line for it to `schema_migrations`.

### 2. Sign-in settings

**Authentication > Sign In / Providers > Email**: keep **Enable Email provider** on, and turn
**Confirm email** and **Secure email change** off. Accounts use a key, so there is no address to confirm.

### 3. Links in emails

**Authentication > URL Configuration**: set **Site URL** to the site's address, and add
`<that address>/account` to **Redirect URLs**.

## Staging: test without touching real players

1. Create a second free Supabase project called `sidecourt-staging` and do the steps above in it.
   Use `http://localhost:5173` as its Site URL and `http://localhost:5173/account` as its redirect.
2. Put the staging URL and publishable key in `app/.env`. Local development now uses staging.
3. In Cloudflare Pages > Settings > Variables, give the **Preview** environment the staging values and
   **Production** the real ones. Pushing a branch other than `main` then makes a test site that uses staging.

## Backups

`.github/workflows/backup.yml` makes an encrypted backup every Sunday, kept 30 days.
To turn it on, in GitHub go to **Settings > Secrets and variables > Actions** and add:

- `SUPABASE_DB_URL`: in Supabase, click **Connect** and copy the **Session pooler** connection string,
  with your database password filled in.
- `BACKUP_PASSPHRASE`: a long password you make up. **Save it in a password manager**: without it the
  backups cannot be opened.

Test it with **Actions > Database backup > Run workflow**. Never paste either value into chat or a file.

To restore, download the backup from the run's page, then:

```bash
gpg --output backup.sql --decrypt backup.sql.gpg
psql "<connection string of an empty project>" -f backup.sql
```

## Seeing app errors

Crashes are listed in **Table Editor > client_errors**, newest at the bottom. Entries are kept for 30 days.
