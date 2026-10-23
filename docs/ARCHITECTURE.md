# Architecture
Browser SPA (React) → Supabase REST/RPC with the user's JWT → Postgres with RLS. Files in a private Storage bucket via signed URLs. No custom server, no service-role key in the client.

```
React (Vite, Router, TanStack Query)
   │  supabase-js (anon/publishable key + user JWT)
   ▼
Supabase Auth ─ JWT ─► PostgREST ─► RLS policies + SECURITY DEFINER RPCs ─► Postgres
                                         └─ Storage (private "documents" bucket, RLS on storage.objects)
```
## Frontend layout
`src/app` (providers, guards, layouts) · `src/components/ui.tsx` · `src/lib` (supabase, format, csv, permissions, types) · `src/features/<module>` (pages + forms + queries) · `src/features/admin`.
Server state is fetched with TanStack Query; forms use React Hook Form + Zod; keys include the organization id so switching org never shows stale data.
## Where logic lives
Sensitive/multi-row logic is in database functions (payments, invoices, leases, admin actions, dashboard, daily job). The client only calls them.
## Routing
Public: `/`, `/terms`, `/privacy`, `/login`, `/signup`, `/forgot-password`, `/reset-password`. Authenticated: `/onboarding`, `/portal` (tenant), `/app/*` (staff roles), `/admin/*` (platform admins). Guards are UX only.
