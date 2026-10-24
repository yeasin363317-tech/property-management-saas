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
1. **Supabase** — on a NEW empty project, run `database/schema.sql` once in the SQL editor (it creates everything). `supabase/migrations/` holds the same schema as ordered files for the Supabase CLI. Do not run both on the same database.
2. **Supabase Auth settings** (Dashboard → Authentication → URL Configuration): set *Site URL* to your deployed URL and add it under *Redirect URLs*
   (also add `https://YOUR-DOMAIN/reset-password`). Without this, confirmation and reset emails link to the wrong place.
3. **Host the frontend** (Vercel/Netlify/Cloudflare Pages): import this folder (push to GitHub first), framework *Vite*,
   build command `npm run build`, output `dist`.
4. **Environment variables** on the host: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (use the *publishable/anon* key only, never a secret/service key). Optional: `VITE_DEMO_PASSWORD` for the demo buttons (see Demo accounts).
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

## Database script
`database/schema.sql` creates the whole database from scratch; `database/seed.sql` adds optional demo data. See HowToSetup.md.

## Database tests
`supabase/tests/*.sql` — run in a **development** project's SQL editor; each ends with an intentional error that rolls everything back and prints a RESULT list of checks.

## Daily job (optional scheduling)
`select public.run_daily_job();` activates/ends leases and creates reminder notifications (deduplicated). Super Admin can run it from Admin → Operations.
To schedule: enable the `pg_cron` extension, then `select cron.schedule('rentora-daily', '0 2 * * *', 'select public.run_daily_job()');`.

## Demo accounts (for customers and reviewers to look around)
`database/seed.sql` creates two fake accounts with sample data (2 properties, 6 units, 4 tenants, leases, invoices that are paid / partial / overdue, expenses, maintenance requests):
- Landlord: `demo.landlord@example.com`
- Tenant portal: `demo.tenant@example.com`

The password is **not stored in this repository**. You choose it: run `select public.seed_demo('your-12-plus-char-password');` in the SQL editor, then set the same value as the `VITE_DEMO_PASSWORD` environment variable on your host and redeploy. The landing page and login page then show **Try demo as landlord / tenant** buttons that sign in with one click (no password typing).
Reset the demo any time with the same `select public.seed_demo(...)` call. Demo accounts cannot change their credentials, cannot create organizations and are not platform admins. Files uploaded by demo users must be removed from Storage manually (SQL cannot delete storage objects).
To remove the demo entirely: delete the two users in Supabase Auth and the organization "Demo Properties (sample data)".
