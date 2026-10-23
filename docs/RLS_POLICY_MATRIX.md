# RLS policy matrix
Roles: O owner, M property_manager, A accountant, S maintenance staff, T tenant. `-` = no access. Writes of invoices/payments only via RPC.
| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| organizations | members | RPC `create_organization` | O (name/currency/timezone) | - |
| organization_members | self; O,M all in org | RPC only | O (role,status) | O |
| invitations | O | O | O (revoke only) | - |
| properties, units | O,M,A,S | O,M | O,M | - |
| tenants | O,M,A; T own row | O,M | O,M | - |
| leases | O,M,A; T own | O,M | O,M (status via RPC) | - |
| rent_invoices, payments, adjustments | O,M,A; T own invoices | RPC | RPC | - |
| expenses | O,M,A | O,M,A | O,A | O |
| maintenance_requests | O,M,A all; S assigned; T own | O,M,S; T own unit only, status new | O,M; S assigned (status/costs only) | - |
| maintenance_updates | if request visible | author = self, request visible | - | - |
| documents | O,M,A,S | O,M,A,S | - | O,M |
| storage.objects (documents) | O,M,A,S of that org folder | same | - | O,M |
| notifications | own | trigger/job | own (read_at) | - |
| audit_logs | O (org scope); super admin (platform scope) | functions only | - | - |
| plans | everyone (active); admins all | admin RPC | admin RPC | - |
| subscriptions, subscription_events | O,M of org; platform admins | RPC | admin RPC | - |
| support_tickets | creator; super/support | creator | admin RPC | - |
| ticket_notes | creator (non-internal); super/support | creator (non-internal); admin RPC | - | - |
| feature_flags | authenticated | - | super RPC | - |
| platform_settings | public support_email; admins | - | super RPC | - |
| job_runs | super | functions | - | - |
| platform_admins | own row | super RPC | super RPC | super RPC |
