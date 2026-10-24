# Deployment checklist
- [ ] Push repo to GitHub; import in Vercel (Vite preset). `vercel.json` already rewrites all routes to index.html.
- [ ] Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and optionally `VITE_DEMO_PASSWORD`) in the host. See `HowToSetup.md` for the full guide.
- [ ] Supabase → Auth → URL configuration: Site URL + Redirect URLs (including `/reset-password`).
- [ ] Supabase → Auth: configure custom SMTP for production (default is heavily rate limited); consider enabling MFA for admins; review password strength settings.
- [ ] Run `npm install && npm run build` once (locally or on the host) and fix any type errors it reports.
- [ ] Create first Super Admin (README SQL).
- [ ] Smoke test: signup, onboarding, property→unit→tenant→lease→invoice→payment, tenant portal invite, admin panel.
- [ ] Enable backups (Supabase paid plans have scheduled backups/PITR; free plan: export manually).
- [ ] Separate staging and production Supabase projects. Never test with production data.
