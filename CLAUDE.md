# CLAUDE.md — working agreement for this repo
- Stack: React 18, TS strict, Vite, Tailwind, TanStack Query, React Hook Form + Zod, Supabase. No custom backend.
- The database is the authority. UI role checks (`src/lib/permissions.ts`, route guards) are convenience only; RLS + SECURITY DEFINER RPCs enforce.
- Never put a service-role/secret key in the frontend. Only `VITE_SUPABASE_URL` and the publishable/anon key.
- Schema changes go in a new numbered file under `supabase/migrations/`. Do not hand-edit the live DB.
- Money is `numeric(14,2)`. Invoices/payments are written only via RPCs (`generate_invoices`, `record_payment`, `reverse_payment`, `add_invoice_adjustment`, `void_invoice`). Never UPDATE them directly; corrections are separate logged entries.
- Admin actions go through `admin_*` RPCs, which check the platform role, require a reason and write `audit_logs`.
- Never claim a test passed unless it was run. Never claim "Vibe 96 approved". Do not invent audit requirements.
- Keep `docs/` consistent with code when decisions change.


## Folder layout
- `src/app/` auth provider, route guards, layouts
- `src/features/<name>/` one folder per feature (properties, tenants, leases, rent, maintenance, portal, admin, auth ...)
- `src/components/` shared UI
- `src/lib/` supabase client, formatting, permissions, schemas, invitations
- `supabase/migrations/` ordered SQL (001-009); `database/` single-file schema and seed for the SQL-editor setup path
- `docs/` authorization, RLS matrix, operations; `e2e/` Playwright; `src/test/` Vitest

## Commands
`npm ci` · `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run e2e`
