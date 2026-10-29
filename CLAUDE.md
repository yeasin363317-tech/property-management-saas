# CLAUDE.md — working agreement for this repo

- Stack: React 18, TypeScript strict, Vite, Tailwind, TanStack Query, React Hook Form + Zod, Supabase. No custom backend.
- The database is the authority. UI role checks (`src/lib/permissions.ts`, route guards) are convenience only; RLS + SECURITY DEFINER RPCs enforce access.
- Never put a service-role/secret key in the frontend. Only `VITE_SUPABASE_URL` and the publishable/anon key belong in browser configuration.
- Schema changes go in a new numbered file under `supabase/migrations/`. Do not hand-edit the live DB.
- Every new table, view, storage object policy, and SECURITY DEFINER function must have an explicit RLS/authorization review and corresponding test evidence.
- Money is `numeric(14,2)`. Invoices/payments are written only via RPCs (`generate_invoices`, `record_payment`, `reverse_payment`, `add_invoice_adjustment`, `void_invoice`). Never UPDATE them directly from the client; corrections are separate logged entries.
- Admin actions go through `admin_*` RPCs, which check the platform role, require a reason, and write `audit_logs`.
- Hooks belong in feature-local `hooks/` modules or `src/lib/` when shared. Hooks must not build SQL strings; use typed Supabase query builders or named RPCs.
- Shared data-access/query fragments belong in `src/lib/queries/` or feature-local query modules. Query keys must include every identity and filter that affects the result, and successful mutations must invalidate affected keys.
- TypeScript stays strict: prefer explicit row types and discriminated unions; do not add `any` casts to bypass a database shape mismatch.
- Tailwind styles use the existing design tokens and shared UI components. Avoid introducing one-off colors when a token exists.
- Every new business rule needs a focused Vitest test. Every authorization or tenant-isolation change needs a SQL test in `supabase/tests/` and, where practical, an authenticated Playwright test.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` before claiming a code change is verified. Use `npm ci` and retain the lockfile.
- Never claim a test passed unless it was run. Never claim “Vibe96 approved”. Do not invent audit requirements.
- Keep `docs/` consistent with code when decisions change.

## Folder layout

- `src/app/` auth provider, route guards, layouts
- `src/features/<name>/` one folder per feature
- `src/components/` shared UI
- `src/lib/` Supabase client, formatting, permissions, schemas, invitations, and shared queries
- `supabase/migrations/` ordered SQL source of truth
- `database/` SQL-editor schema distribution and optional seed
- `docs/` authorization, RLS matrix, operations, and audit evidence
- `e2e/` Playwright; `src/test/` Vitest; `supabase/tests/` SQL authorization tests

## Commands

`npm ci` · `npm run dev` · `npm run typecheck` · `npm run lint` · `npm test` · `npm run build` · `npm run e2e` · `npm audit --omit=dev`
