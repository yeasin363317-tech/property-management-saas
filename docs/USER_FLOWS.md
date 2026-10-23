# User flows
1. **Landlord start**: Sign up → confirm email → log in → Onboarding (create workspace) → add property → add units → add tenant → create lease → Rent & payments → Generate invoices → Pay.
2. **Monthly rent**: Generate invoices for month (idempotent) → record payment (partial allowed) → balance and status update → mistakes fixed by Reverse (reason) or Correct (adjustment/void).
3. **Move-out**: Leases → End (ended/terminated, date, reason) → unit becomes vacant; invoices and payments kept.
4. **Renewal**: Leases → Renew → new upcoming lease starts the day after the current end date.
5. **Team**: Team → Create invitation (email + role) → copy code to the person → they sign up with that email → paste code at Onboarding.
6. **Tenant portal**: owner adds tenant (with email) → Team → invite as Tenant for that tenant record → tenant signs up with that email, pastes code → /portal shows lease, invoices, maintenance requests.
7. **Maintenance**: create/assign → staff moves status (valid transitions only) → comments, actual cost → completed.
8. **Admin**: first Super Admin created via SQL (README) → /admin → users/orgs actions each ask for a reason → audit log shows them.
