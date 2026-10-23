# Business rules
**Units**: occupied only while an active lease exists (trigger-enforced); reserved when an upcoming lease exists; unavailable/vacant set manually when no active lease.
**Leases**: end_date after start_date; no overlap of upcoming/active leases on a unit (DB exclusion constraint); due day 1-28 so every month works; ending a lease keeps all history; renewal creates a new lease from end_date + 1.
**Invoices**: one non-void invoice per lease per month; due date = first of month + (due_day − 1); generated only for active leases overlapping the month; cannot generate more than one month ahead. Original amount is never edited: adjustments (signed, with reason) change `amount_due`; void requires a reason and no valid payments.
**Payments**: amount > 0, rounded to 2 decimals, not in the future, cannot exceed outstanding balance, invoice row locked during recording (concurrent safe), idempotency key makes retries safe. Invoice becomes `paid` only when valid payments ≥ amount due. Payments are reversed (reason, owner/accountant), never deleted; reversal re-opens the invoice.
Example: invoice 15,000, payments 10,000 → outstanding 5,000, status open/partial; a further 6,000 is rejected; 5,000 makes it paid.
**Maintenance transitions**: new→acknowledged|in_progress|cancelled; acknowledged→in_progress|waiting|cancelled; in_progress→waiting|completed|cancelled; waiting→in_progress|cancelled; completed and cancelled are final. Maintenance staff may only change status, costs and notes on requests assigned to them.
**Plans**: limits on active properties, units and non-tenant members enforced by triggers using the organization's active plan (free if none).
**External payments**: nothing is marked paid by a provider; all payments are manual records.
**Late fees**: not implemented (use an invoice adjustment).
