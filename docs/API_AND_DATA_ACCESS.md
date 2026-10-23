# API and data access
Client uses supabase-js with the user's JWT. Direct table access is limited by RLS and column grants; everything multi-step is an RPC.
## Tenant/landlord RPCs
`create_organization`, `accept_invitation`, `generate_invoices`, `record_payment`, `reverse_payment`, `add_invoice_adjustment`, `void_invoice`, `end_lease`, `renew_lease`, `org_dashboard`, `portal_overview`, `platform_role`.
## Admin RPCs (all check platform role + audit)
`admin_stats`, `admin_list_users`, `admin_list_orgs`, `admin_list_admins`, `admin_find_user_by_email`, `admin_set_user_status`, `admin_set_org_status`, `admin_set_subscription`, `admin_upsert_plan`, `admin_set_flag`, `admin_set_setting`, `admin_set_platform_role`, `admin_update_ticket`, `admin_add_ticket_note`, `admin_run_daily_job`.
## Conventions
Server-side pagination with `range()` and `count: 'exact'`, page size 10 (admin 25). Query keys start with the table/feature and include the organization id. Mutations invalidate by key prefix. Errors from Postgres exceptions are shown to the user as messages.
