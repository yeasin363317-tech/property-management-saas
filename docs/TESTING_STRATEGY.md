# Testing strategy and honest results
| Layer | Tool | Status |
|---|---|---|
| Database + RLS + RPC rules | SQL scripts in `supabase/tests` | **Executed**: core_and_admin_test (21/21 true), tenant_isolation_test (12/12 true), run against the live `rentora` project inside rolled-back transactions |
| Unit | Vitest `src/test/format.test.ts` | written, **not executed** |
| Type check / lint / build | `npm run typecheck`, `lint`, `build` | **not executed** (dependencies could not be installed). Only a syntax-level parse of every TS/TSX file was run, with no syntax errors. Type errors are possible. |
| Component | React Testing Library | dependency present, **no component tests written** |
| E2E | Playwright `e2e/smoke.spec.ts` | written, **not executed** |
## Scenarios covered by the executed SQL tests
Cross-org read/write blocked; tenant sees only own invoices/leases and cannot read properties/expenses; wrong-email invitation rejected; tenant maintenance request limited to own unit; partial payment balance 5,000; overpayment rejected; idempotent retry; duplicate invoice prevented; overlapping lease rejected; direct invoice UPDATE blocked; payment reversal re-opens invoice; landlord blocked from admin API; self-grant of admin blocked; support admin blocked from flags and billing; admin cannot suspend self; sole-owner suspension needs force; suspended user loses access.
## Not yet tested
Maintenance transition rejection, file upload policies, plan-limit triggers, daily job, UI states, accessibility, performance. Add before launch.

## Added after audit run #896
The demo reset function was run twice against the live project (create path and reset path); the reset path exposed and fixed a bug (direct deletes on storage tables are forbidden). `database/schema.sql` was compared object-by-object (functions, tables, policies) with the live database and matches; it has **not** been executed on a fresh empty project.
