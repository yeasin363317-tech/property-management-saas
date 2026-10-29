# Rentora — Residential Property & Tenant Management

Rentora is a React + TypeScript + Vite + Tailwind frontend backed by Supabase (Postgres, Auth, RLS, Storage). It has no custom server. The current package version is **1.1.3**.

## Live demo

Reviewer/demo site: **https://rentora1.vercel.app**

The demo uses fake accounts and sample data only. Do not enable the demo password on a deployment containing real customer data. Use the optional `VITE_DEMO_PASSWORD` only with a unique throwaway password and rotate it through `seed_demo` when needed.

## Five differentiators

1. **Database-enforced workspace isolation:** organization membership and RLS protect tenant data at the database boundary, not only in the UI.
2. **Role-specific workflows:** owner, property manager, accountant, maintenance staff, and tenant roles have separate operational views.
3. **Auditable rent corrections:** invoices and payments use RPCs for generation, partial payment, reversal, adjustment, and void flows instead of direct client updates.
4. **Tenant-ready onboarding:** invitation links can be bound to a tenant record and are checked for email match, expiry, and single use.
5. **Practical property operations:** leases, rent status, expenses, maintenance, private documents, notifications, exports, and a tenant portal share one workspace model.

## What is built

Landing/pricing/FAQ/legal pages, auth (signup, email confirmation, login, reset), onboarding, multi-organization workspaces with roles (owner, property manager, accountant, maintenance, tenant), properties and units, tenants, leases with overlap protection, rent invoices, partial payments, reversals, adjustments, void, expenses, maintenance workflow, private documents, in-app notifications, reports with CSV export, team invitations, tenant portal, support tickets, and a Super Admin Panel at `/admin`.

## Screenshot and supporting evidence

The repository includes `public/favicon.svg` and a presentation-quality verification summary is delivered as `Rentora_v1.1.3_Repair_Pass.pdf`. Deploy the site to view the responsive UI and dashboard screens. Audit and remediation evidence is documented in `docs/AUDIT_1345_ASSESSMENT.md`, `docs/VERIFICATION_REPORT.md`, and `docs/REMEDIATION_MATRIX.md`.

## Not built / not claimed

Online payments, automated billing, email delivery (invitations are shared by link or code), error monitoring, MFA enforcement (enable it in Supabase Auth), and impersonation are not claimed. See `docs/AUDIT_READINESS.md`.

## Prerequisites

Node.js 20 (exact version in `.nvmrc`) and npm 9+ for local builds; a free Supabase project; and a static host such as Vercel.

## Deploy

1. On a **new empty Supabase project**, use `database/schema.sql` once in the SQL editor, then optionally use `database/seed.sql`. The ordered `supabase/migrations/` path is the CLI source of truth; do not run both paths on the same database.
2. In Supabase Auth URL Configuration, set the Site URL to the deployed URL and add the deployed login and reset-password URLs.
3. Import this folder into Vercel, choose the Vite preset, use `npm run build`, and publish `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the publishable/anon key only. `VITE_*` values are public browser settings; never place a `service_role` or secret key in a `VITE_` variable or client bundle.
5. Open the site, sign up, confirm the email, and create the first workspace.

## First Super Admin

After signing up with your own email, run this once in the Supabase SQL editor:

```sql
insert into public.platform_admins (user_id, role)
select id, 'super_admin' from auth.users where email = 'YOUR-EMAIL@example.com';
```

## Dependencies, tests, and lockfile

Commit `package-lock.json` and install with `npm ci`. Use `npm audit --omit=dev` for the production dependency check. Available scripts are:

```text
npm run dev · npm run build · npm run typecheck · npm run lint · npm test · npm run e2e
```

Playwright authenticated tests require disposable `E2E_*` Supabase credentials. SQL isolation tests live under `supabase/tests/` and must run only against a development project.

## Demo accounts

Run `database/schema.sql`, optionally `database/seed.sql`, and then `select public.seed_demo('your-12-plus-char-password');`. The two fake accounts are `demo.landlord@example.com` and `demo.tenant@example.com`. The password is not stored in this repository; if the demo buttons are enabled, the same unique throwaway value is supplied as `VITE_DEMO_PASSWORD` and is necessarily visible in the public browser bundle. Demo accounts cannot create organizations or become platform admins.

## License

This repository includes `LICENSE-NOTE.md`. The application source is provided for the authorized Rentora project and is not represented as an open-source license grant unless a separate license is supplied by the project owner. Third-party packages retain their own licenses.

More detail is available in `HowToSetup.md`, `docs/DEPLOYMENT.md`, `docs/SECURITY.md`, `docs/RLS_POLICY_MATRIX.md`, and `docs/AUDIT_1345_ASSESSMENT.md`.
