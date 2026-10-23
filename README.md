# Rentora — Residential Property & Tenant Management

React + TypeScript + Vite + Tailwind frontend, Supabase (Postgres, Auth, RLS, Storage) backend. No custom server.

## What is built
Landing/pricing/FAQ/legal pages, auth (signup, email confirm, login, reset), onboarding, multi-organization workspaces with roles
(owner, property manager, accountant, maintenance, tenant), properties & units, tenants, leases (overlap protection, renew, end),
rent invoices (one per lease per month), partial payments, reversals, adjustments, void, expenses, maintenance workflow,
private documents, in-app notifications, reports with CSV export, team invitations, tenant portal, support tickets,
and a Super Admin Panel at `/admin` (users, organizations, plans & subscriptions, tickets, flags, jobs, admin roles, audit log).

## Not built / not claimed
Online payments, automated billing, email delivery (invitations are shared by code), error monitoring, MFA enforcement
(enable it in Supabase Auth), impersonation (deliberately not implemented). See `docs/AUDIT_READINESS.md`.

## Deploy (no computer needed beyond a browser)
1. **Supabase** — the migrations in `supabase/migrations` (001 to 005) are already applied to the `rentora` project that was created for you.
   For a new project, run the files in order in the SQL editor.
2. **Supabase Auth settings** (Dashboard → Authentication → URL Configuration): set *Site URL* to your deployed URL and add it under *Redirect URLs*
   (also add `https://YOUR-DOMAIN/reset-password`). Without this, confirmation and reset emails link to the wrong place.
3. **Host the frontend** (Vercel/Netlify/Cloudflare Pages): import this folder (push to GitHub first), framework *Vite*,
   build command `npm run build`, output `dist`.
4. **Environment variables** on the host: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (use the *publishable/anon* key only, never a secret/service key).
5. Open the site, sign up, confirm your email, create your workspace.

## Create the first Super Admin (one time, in the Supabase SQL editor)
Public signup can never grant admin rights. After you have signed up with your own email, run:
```sql
insert into public.platform_admins (user_id, role)
select id, 'super_admin' from auth.users where email = 'YOUR-EMAIL@example.com';
```
Then reload the app: an "Admin panel" link appears. Further admins are granted from Admin → Admin roles.

## Scripts
`npm run dev` · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test` (Vitest) · `npm run e2e` (Playwright, needs `npx playwright install`).

## Database tests
`supabase/tests/*.sql` — run in a **development** project's SQL editor; each ends with an intentional error that rolls everything back and prints a RESULT list of checks.

## Daily job (optional scheduling)
`select public.run_daily_job();` activates/ends leases and creates reminder notifications (deduplicated). Super Admin can run it from Admin → Operations.
To schedule: enable the `pg_cron` extension, then `select cron.schedule('rentora-daily', '0 2 * * *', 'select public.run_daily_job()');`.

## Demo accounts (for customers to look around)
Migration `006_demo_accounts.sql` creates two accounts with sample data (2 properties, 6 units, 4 tenants, leases, invoices with paid/partial/overdue states, expenses, maintenance):
- Landlord: `demo.landlord@example.com` / `RentoraDemo#2026`
- Tenant portal: `demo.tenant@example.com` / `RentoraDemo#2026`

The landing page and login page have "Try demo" buttons that sign in with these accounts. They are fake addresses (no real mailbox). Their email/password cannot be changed, and they cannot create organizations.
Reset the demo data any time (SQL editor): `select public.seed_demo();` — optionally schedule it with pg_cron like the daily job.
Known limits: anyone using the demo can add/edit sample data until the next reset, upload files up to 10 MB each, and create support tickets; reset removes all of that. To remove the demo entirely, delete those two users in Supabase Auth and the organization "Demo Properties (sample data)".
