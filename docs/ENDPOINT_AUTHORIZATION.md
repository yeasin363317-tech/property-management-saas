# Authentication and roles on every mutating endpoint

There is no custom API server. Every write reaches Postgres through Supabase with the caller's JWT and is authorized **in the database**. `anon` (not logged in) has no write access to anything, and no EXECUTE on any function except via grants listed here (all functions are revoked from `public`/`anon` and granted to `authenticated` only; internal helpers are revoked from `authenticated` too).

## RPC functions (mutating)
| Function | Required identity |
|---|---|
| create_organization | logged-in, active (not suspended), not a demo account |
| accept_invitation | logged-in; invitation email must equal the caller's email |
| generate_invoices | org role owner, property_manager or accountant |
| record_payment | owner, property_manager, accountant (invoice row locked) |
| reverse_payment, add_invoice_adjustment, void_invoice | owner, accountant; reason required |
| end_lease, renew_lease | owner, property_manager |
| admin_set_user_status, admin_update_ticket, admin_add_ticket_note | platform super_admin or support_admin; reason required for user status |
| admin_set_subscription, admin_upsert_plan | platform super_admin or billing_admin; reason required |
| admin_set_org_status, admin_set_flag, admin_set_setting, admin_set_platform_role, admin_run_daily_job, admin_find_user_by_email, admin_list_admins | platform super_admin; reason required for changes; cannot change own role |
Read-only RPCs also check identity: org_dashboard (owner/manager/accountant), portal_overview (logged-in tenant), admin_stats/admin_list_users/admin_list_orgs (any platform admin; emails masked unless super_admin).

## Direct table writes (RLS + column grants)
| Table | INSERT | UPDATE | DELETE |
|---|---|---|---|
| properties, units, tenants, leases | owner, property_manager | owner, property_manager | none |
| expenses | owner, property_manager, accountant | owner, accountant | owner |
| maintenance_requests | owner, property_manager, maintenance staff; tenant (own unit only, status new) | owner, property_manager; maintenance staff if assigned (status/costs only, trigger-enforced) | none |
| maintenance_updates | request visible to caller | none | none |
| organization_members | none (RPC only) | owner (role/status; last owner protected) | owner |
| invitations | owner | owner (revoke only) | none |
| organizations | none (RPC only) | owner (name/currency/timezone) | none |
| documents (+ Storage objects) | owner, property_manager, accountant, maintenance | none | owner, property_manager |
| profiles | trigger only | self (name, phone, notification flag) | none |
| notifications | job only | self (read_at) | none |
| support_tickets, ticket_notes | ticket creator (own, non-internal) | none (admin RPC) | none |
| rent_invoices, payments, invoice_adjustments, subscriptions, plans, platform_admins, feature_flags, platform_settings, audit_logs, job_runs | **no direct writes by any client role** (SELECT only) | none | none |

Suspended users/organizations lose all of the above immediately (checked inside `org_role()` on every call).
Evidence: `supabase/tests/core_and_admin_test.sql` and `tenant_isolation_test.sql` exercise these rules (33 checks; executed against the live project before this release).

## Tenant portal reads (defense in depth)
`portal_overview()` returns only tenant records whose `tenants.user_id = auth.uid()` and where the caller has an active `tenant` membership; the invoice and maintenance queries in the UI add `tenant_id = <that tenant>`; and RLS on `rent_invoices`, `payments`, `leases`, `maintenance_requests` independently restricts a tenant to rows whose `tenant_id` belongs to a tenant record linked to their own login. A tenant cannot read another tenant's rows even by editing the request (checked in `supabase/tests/tenant_isolation_test.sql`).
The maintenance UI only shows edit controls to maintenance staff for requests assigned to them; the database trigger and policy enforce the same rule.
