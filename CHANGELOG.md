# Changelog

## 1.1.1 (bug fixes, not yet built or tested)
- Fixed: tenants ended up as landlords because every new user saw "Create your workspace". Onboarding now shows the invitation code first and says the workspace form is for landlords only.
- Fixed: invitation codes never reached tenants. Team page now creates a ready-to-send invitation link (copy link, copy message, WhatsApp, email app). The link opens Sign up with the email pre-filled and the code is accepted automatically after sign up and login.
- Tenants page has an Invite link for owners; invite role now defaults to Tenant and shows what each role can see.
- Remembered workspace is cleared on sign out so one user's workspace is never reused for the next login.
- Still true: Rentora does not send emails by itself. The landlord shares the link.

## 1.1.0 (UI redesign, not yet built or tested)
- New design tokens (Tailwind config), Rentora logo component, inline icon set, restyled shared components (buttons, inputs, cards, badges, tables, modals with focus trap, skeleton, permission-denied view).
- New app shell: responsive sidebar drawer, top bar, breadcrumbs, skip link, icons for every existing nav item.
- Premium landing page with dashboard illustration, five feature visuals, benefits, how-it-works, FAQ, final CTA.
- Split-layout auth pages; tenant portal header restyled.
- `/admin/*` guard now waits for the session and shows a 403 page instead of silently redirecting.
- No database, RLS, RPC or business-logic changes.

## 1.0.2
- Added indexes on remaining foreign key columns (migration 007, also in `database/schema.sql`).
- Demo buttons are disabled unless `VITE_DEMO_PASSWORD` has at least 12 characters (matches the database check).
- Maintenance edit controls are shown only to managers or to the assigned maintenance staff member.
- Shared Zod schemas in `src/lib/formSchemas.ts`.
- Documented Node.js version (`engines`, `.nvmrc`), setup order, and the lockfile requirement.
- Added a GitHub Actions workflow template to generate `package-lock.json`, typecheck, test and build (`ci/lockfile.yml`).

## 1.0.0
Initial release.
- Public site: landing, pricing from database plans, FAQ, Terms and Privacy templates.
- Auth: signup with email confirmation, login, password reset, session restore, onboarding, invitation codes.
- Multi-organization workspaces with roles: owner, property manager, accountant, maintenance staff, tenant.
- Properties, units, tenants, leases (overlap protection, renew, end), rent invoices, partial payments, reversals, adjustments, void.
- Expenses, maintenance workflow with enforced status transitions, private documents, in-app notifications, reports with CSV export.
- Tenant portal (own lease, invoices, maintenance requests).
- Super Admin panel at /admin: dashboard, users, organizations, plans and subscriptions, support tickets, feature flags, scheduled job status, admin roles, audit log.
- Demo accounts with sample data (`database/seed.sql`).
- Database: `database/schema.sql` (from scratch) and `supabase/migrations/`; SQL test scripts in `supabase/tests/`.

### Fixes during 1.0.0 preparation
- Demo guard trigger no longer blocks login/signup (made SECURITY DEFINER).
- Demo reset no longer deletes from storage tables (Supabase forbids it).
- Demo password removed from the repository (now `VITE_DEMO_PASSWORD` / a function argument).
