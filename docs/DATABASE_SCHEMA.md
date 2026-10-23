# Database schema (source of truth: `supabase/migrations`)
Money = `numeric(14,2)`. Child tables carry `organization_id` and use **composite foreign keys** `(id, organization_id)` so a row can never reference another organization's parent.

| Table | Purpose / key rules |
|---|---|
| profiles | 1:1 with auth.users; status active/suspended; created by trigger on signup |
| platform_admins | platform roles (super/support/billing); no client write access |
| organizations / organization_members | workspaces; roles owner, property_manager, accountant, maintenance, tenant; last owner protected |
| invitations | email-bound token, 7-day expiry, optional tenant link |
| properties, units | archive not delete; unit status vacant/occupied/reserved/unavailable guarded by trigger |
| tenants | optional `user_id` after portal invitation accepted |
| leases | exclusion constraint prevents overlapping upcoming/active leases per unit; due_day 1-28 (handles month ends) |
| rent_invoices | unique (lease, period_start) where not void; stored status open/paid/void; `base_amount + adjustment_total = amount_due` |
| invoice_adjustments | signed amount + reason; originals never edited |
| payments | amount > 0; status valid/reversed; idempotency key unique per org |
| expenses | category check, amount > 0 |
| maintenance_requests / maintenance_updates | status transitions enforced by trigger; every status change logged |
| documents | metadata only; files in private bucket `documents` (path starts with org id) |
| notifications | unique (user, dedupe_key) prevents duplicate reminders |
| audit_logs | scope org/platform; written only by trusted functions/triggers |
| plans, subscriptions, subscription_events | limits enforced by triggers; events label source (system / manual_admin / payment_provider) |
| support_tickets, ticket_notes | internal notes hidden from users |
| feature_flags, platform_settings, job_runs | admin-controlled, audited |

## Derived vs stored
Stored (maintained by `recompute_invoice`): `amount_paid`, `adjustment_total`, `amount_due`, `status` (open/paid/void).
Derived in queries/UI: outstanding = due − paid; display status partial/overdue from due date and today.
## Relationships (text ER)
organizations 1─* organization_members *─1 auth.users · organizations 1─* properties 1─* units 1─* leases *─1 tenants · leases 1─* rent_invoices 1─* payments · rent_invoices 1─* invoice_adjustments · properties 1─* expenses · properties 1─* maintenance_requests 1─* maintenance_updates · organizations 1─1 subscriptions *─1 plans.
## Retention
No hard delete of properties, units, tenants, leases, invoices or payments from the app. Tenants "anonymize/delete on request" is handled via support ticket (open question).
