# Rentora remediation matrix

This matrix is based on the implementation brief, repository audit documents, and direct inspection of the uploaded archive. The referenced prior PDF was not included in the upload, so PDF-specific finding IDs cannot be independently rechecked.

| ID | Category | Evidence in archive | Action in this pass | Status |
|---|---|---|---|---|
| FUN-001 | Team invitations | `src/features/team/Team.tsx` enabled tenant lookup only when `role === 'tenant'`, even though the page is owner-only and the owner selects that role. | Changed query enablement to `!!org`. | Fixed and typechecked. |
| FUN-002 | Query freshness | Shared `src/lib/queryClient.ts` invalidates dashboard queries after successful mutations; property and tenant mutations also invalidate their own list queries. | Inspected and preserved existing cache strategy. | Existing implementation confirmed by source and unit test. |
| FUN-003 | Auth error handling | `AuthProvider` previously ignored platform-role and feature-flag errors and did not catch rejected session initialization. | All account-context query errors now produce a recoverable load error; session bootstrap has catch/finally handling. | Fixed and typechecked. |
| FUN-004 | Auth state isolation | Auth provider already clears the query cache on user changes/sign-out; tenant portal keys include the user id. | Inspected and preserved. | Existing implementation confirmed by source. |
| FUN-005 | Route/setup behavior | Missing Supabase environment variables caused `App` to return a setup screen before the router, preventing public/legal routes and unauthenticated redirect tests from exercising real route behavior. | Removed the router-wide early return; auth failures now follow normal recoverable error/redirect paths. | Fixed; smoke and legal E2E tests pass. |
| FUN-006 | Lint/maintainability | Unused `Button` and `can` imports failed the initial lint run. | Removed both imports. | Fixed; lint passes. |
| V96-001 | Prior audit / lockfile | Archive contains `package-lock.json`; `npm ci` succeeded. | No source change required. | Verified locally. |
| V96-002 | Prior audit / secrets | `.env.example` contains placeholders only; demo password is environment-supplied. | No secrets added or exposed. | Verified by inspection; live secret scan not performed. |
| V96-003 | Prior audit / database path | Both `database/` and `supabase/migrations/` are present; repository docs identify migrations as source of truth. | No destructive schema change made. | Fresh-database execution remains unverified. |
| V96-004 | Prior audit / RLS | RLS policies, SECURITY DEFINER functions, and isolation tests are present. | No RLS weakening or authorization bypass introduced. | SQL execution against an isolated project remains unverified in this pass. |
| V96-005 | Prior audit / CI and docs | One CI workflow, setup docs, security docs, testing strategy, and license note are present. | Added this verification report and matrix. | Repository evidence present; CI remote execution not performed. |
| V96-006 | Prior audit / browser regression | Smoke/legal tests are runnable; authenticated tests require disposable Supabase credentials and were skipped. | Installed Chromium and ran the suite. | Public/legal smoke passed; authenticated flows remain unverified. |

## Confidence legend

- **Confirmed:** directly observed and/or fixed with a passing local quality gate.
- **Likely:** supported by repository evidence but dependent on a live service or external configuration.
- **Needs verification:** requires the missing PDF, a Supabase test project, production configuration, or marketplace access.
