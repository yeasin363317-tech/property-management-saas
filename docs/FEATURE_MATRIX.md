# Feature matrix
| Feature | User | Rules (summary) | Entities | Priority | Release | Status |
|---|---|---|---|---|---|---|
| Auth, reset, session | all | email confirm, 8+ char password | auth.users, profiles | P0 | MVP | built |
| Org + roles | owner | one owner minimum, switch org | organizations, organization_members | P0 | MVP | built |
| Properties/units | owner, manager | unique unit number per property, plan limits, archive not delete | properties, units | P0 | MVP | built |
| Tenants | owner, manager | minimal PII, status | tenants | P0 | MVP | built |
| Leases | owner, manager | no overlapping active/upcoming lease per unit, due day 1-28, renew, end | leases | P0 | MVP | built |
| Invoices | owner, manager, accountant | one per lease per month, void with reason, adjustments | rent_invoices, invoice_adjustments | P0 | MVP | built |
| Payments | same | no overpayment, no future date, idempotent, reversal not deletion | payments | P0 | MVP | built |
| Maintenance | owner, manager, staff, tenant | status transitions enforced in DB | maintenance_requests, maintenance_updates | P0 | MVP | built |
| Dashboard | fin roles | defined metrics via RPC | all | P0 | MVP | built |
| Expenses | owner, accountant, manager | amount > 0, delete owner only | expenses | P1 | built | built |
| Documents | staff | private bucket, type/size limits, signed URLs | documents + storage | P1 | built | built |
| Notifications | staff | daily job, dedupe keys | notifications, job_runs | P1 | built (in-app only) | built |
| Reports/CSV | fin roles | CSV formula-injection safe | views over data | P1 | built | built |
| Team invitations | owner | email-bound code, 7 days | invitations | P1 | built | built |
| Tenant portal | tenant | own data only, flag-controlled | tenants.user_id, RPC | P1 | built | built |
| Email reminders | all | — | — | P1 | later | **not built** |
| Online payments / billing | — | — | — | P2 | later | **not built** |
| Admin: dashboard, users, orgs | admins | reason + audit | profiles, organizations | P0 (admin) | built | built |
| Admin: plans/subscriptions | billing, super | manual vs provider labelled | plans, subscriptions, subscription_events | P0 (admin) | built | built |
| Admin: tickets | support, super | internal notes | support_tickets, ticket_notes | P0 (admin) | built | built |
| Admin: flags/settings/jobs | super | reason + audit | feature_flags, platform_settings, job_runs | P0 (admin) | built | built |
| Admin: roles | super | no self-change | platform_admins | P0 (admin) | built | built |
