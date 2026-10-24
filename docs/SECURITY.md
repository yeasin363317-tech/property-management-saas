# Security
- **Auth**: Supabase Auth, passwords never stored in app tables. Session restored by supabase-js.
- **Isolation**: RLS enabled on every public table; helper `has_org_role()` checks active membership, active profile and active organization on every policy. Composite FKs block cross-org references.
- **Writes to money**: clients have SELECT only on invoices/payments; all writes go through RPCs that lock the invoice row, validate role/amount/date and write audit entries.
- **Admin**: platform role from `platform_admins` (no client write). Every `admin_*` RPC re-checks role, requires a written reason and logs. Admins cannot change their own role or suspend themselves. Support/billing admins see masked emails and cannot search by email. Sole-owner suspension needs explicit confirmation.
- **Suspension**: suspended users/organizations lose access immediately because helpers check status on every query.
- **Storage**: private bucket, 10 MB limit, PDF/JPEG/PNG/WEBP only, org-scoped paths, 60-second signed URLs.
- **Secrets**: only the publishable/anon key is in the browser. Service-role key is never used. `.env` is git-ignored.
- **Input**: Zod on forms, CHECK constraints in the database, CSV export neutralizes formula injection.
- **Known gaps / recommendations**: no MFA enforcement (turn it on for admins in Supabase Auth); no rate limiting beyond Supabase defaults; Supabase default SMTP is rate-limited (configure custom SMTP for production); failed admin attempts are not logged (an exception rolls back its own log entry); `documents.entity_id` is polymorphic and not FK-checked; tenant-portal flag is enforced in invitations/portal RPC but invoices RLS does not re-check it; the security advisor lists intentional RPCs as "SECURITY DEFINER executable by authenticated" warnings (each checks roles internally). Back up before launch (see OPERATIONS_AND_BACKUP.md).
- Do not claim security is complete because RLS is on. Commission an independent review before real customer money/data.

## Demo accounts
Fake addresses, sample data only. The password is not in the repository: it is supplied at seed time and via `VITE_DEMO_PASSWORD`, so it is shipped to browsers that load the site (that is how one-click demo login works) and is therefore effectively public. Mitigations: credentials immutable (trigger), cannot create organizations, not platform admins, free-plan limits apply, data resettable with `seed_demo()`. Residual risk: demo users can create junk or uploads until the next reset. Never put real customer data in the demo organization, and never reuse a real password as the demo password.
