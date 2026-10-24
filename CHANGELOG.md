# Changelog

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
