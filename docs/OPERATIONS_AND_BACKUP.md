# Operations and backup
- **Daily job**: `public.run_daily_job()`. Manual from Admin → Operations; schedule with pg_cron (README). Failures are stored in `job_runs` and counted on the admin overview.
- **Monitoring**: none configured. Recommend Sentry for the frontend and Supabase logs/advisors for the database.
- **Backups**: Supabase managed backups depend on plan. For the free plan export with `pg_dump` periodically. Test a restore into a scratch project.
- **Recovery of mistakes**: payments are reversed, invoices voided/adjusted, properties archived, never deleted. Suspensions are reversible.
- **Rotate keys** if a secret key is ever exposed. Only the publishable key is public by design.
- **Support**: tickets in-app (Admin → Support tickets). Set a public email under Admin → Operations.
