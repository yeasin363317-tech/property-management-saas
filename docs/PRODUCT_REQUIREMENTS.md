# Product requirements
**Rentora** manages properties, tenants, leases, rent, expenses and maintenance in one secure multi-organization workspace.
Target users: individual landlords, multi-property owners, property managers, small agencies, accountants and maintenance staff, and tenants through a restricted portal.
The market-gap claim is a **hypothesis to validate**, not an established fact (see ASSUMPTIONS_AND_OPEN_QUESTIONS.md).

## Problems addressed
Scattered property/unit data; tracking leases and expiries; monitoring rent, partial payments and overdue balances; forgotten maintenance; hard-to-organize records; no consolidated view.

## Scope
MVP (built): auth, orgs & roles, properties, units, tenants, leases, invoices, manual payments, partial payments, outstanding/overdue, maintenance, dashboard, RLS, tests, deployment docs, Super Admin panel.
Also built (originally P1): expenses, documents, in-app notifications, reports + CSV, team invitations, lease renewal, tenant portal, support tickets.
Later: online payments, automated subscription billing, email notifications, multi-currency, advanced analytics.

## Metric definitions
- **Invoiced** = sum of `amount_due` of non-void invoices whose due date is in range.
- **Collected** = sum of valid (non-reversed) payments received in range.
- **Outstanding** = `amount_due - amount_paid` over all open invoices. **Overdue** = open and `due_date < today`.
- **Expenses** = recorded expenses in range. Income minus expenses is a simple summary, not audited accounting.
