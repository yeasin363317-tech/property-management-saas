# Rentora redesign report (v1.1.0)

Status legend: PASS = actually tested, FAIL, NOT TESTED, NEEDS REVIEW.

## Environment limits
The sandbox had no working network, so `npm ci` could not finish. Therefore nothing below was built or run.

| Check | Result |
|---|---|
| `npm run build` / `typecheck` / `lint` / `test` | NOT TESTED |
| Syntax-only parse of edited files (tsc, no type resolution) | PASS (no TS1xxx syntax errors) |
| Browser, responsive, accessibility, console/network checks | NOT TESTED |
| Auth flows, role access, RLS isolation | NOT TESTED |
| Real screenshots | NOT TESTED (landing uses code-drawn illustrations, clearly labelled, no figures) |

Run `npm ci && npm run typecheck && npm run lint && npm test && npm run build` first and fix anything reported.

## Route inventory (from `src/App.tsx`)
Public: `/`, `/terms`, `/privacy`. Auth: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`.
Landlord `/app`: index, properties, properties/:id, tenants, leases, invoices, expenses, maintenance, documents, reports, team, notifications, support, settings.
Tenant: `/portal`. Super Admin `/admin`: index, users, organizations, subscriptions, tickets, operations, admins, audit.

## Done (code written, unverified)
- Design tokens, logo, icons, shared component restyle: every page using `ui.tsx` inherits it.
- App shell (sidebar drawer, top bar, breadcrumbs, skip link) for landlord and admin.
- Landing page, auth page layout, portal header, demo buttons.
- Admin guard waits for loading and shows 403 (previously redirected to `/app`). `RequireRole` also shows the 403 view.

## Not done
- Individual page-level layout rewrites for the 13 landlord pages, tenant portal body and 8 admin pages. They get the new look only through shared components.
- Toast system and a dedicated search/filter bar component.
- Added: 404 page (unknown URLs now show it instead of redirecting home).
- Real screenshots; replace the code-drawn illustrations after deploying.

## Vibe96 findings checked against source
- HowToSetup.md exists; README and HowToSetup both say run `database/schema.sql` once. Migrations folder is the same schema in steps (README already warns not to run both). No change made.
- Demo password is not in source; buttons need `VITE_DEMO_PASSWORD` of 12+ characters. PASS by code reading.
- Indexes: 007 already covers `maintenance_requests.assigned_to` and `audit_logs.actor_id`. Column `ticket_notes.admin_id` does not exist; the column is `author_id` and has no index. Optional: `create index on public.ticket_notes (author_id);`. Not applied.
- Admin guard: backend RLS/RPC checks untouched. Frontend guard improved as above.
