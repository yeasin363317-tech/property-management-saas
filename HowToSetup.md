# How to set up Rentora (step by step)

You need: a free Supabase account, a free GitHub account, and a free Vercel account. For local development also Node.js 20 (exact version in `.nvmrc`) (see `.nvmrc`) and npm. Always run the database steps in the order shown.

## 1. Create the database
1. In Supabase create a new project (any region). Wait until it is ready.
2. Open **SQL Editor → New query**, paste the whole content of `database/schema.sql`, press **Run**. It must finish without errors.
3. (Optional demo) Run `database/seed.sql`, then run: `select public.seed_demo('choose-a-demo-password-12+chars');`

## 2. Get your two public settings
Supabase → **Project Settings → API**: copy the **Project URL** and the **publishable / anon key**. Never use the `service_role` or secret key.

## 3. Deploy the website
1. Put this project in a GitHub repository.
2. In Vercel: **Add New → Project →** pick the repository. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and, if you ran the demo seed, `VITE_DEMO_PASSWORD` (the same password you chose).
4. Deploy.

## 4. Tell Supabase your website address
Supabase → **Authentication → URL Configuration**: set **Site URL** to your Vercel address and add these **Redirect URLs**: `https://YOUR-SITE/login` and `https://YOUR-SITE/reset-password`.

## 5. Create the first admin
Sign up on your site with your own email and confirm it. Then in the SQL editor run:
```sql
insert into public.platform_admins (user_id, role)
select id, 'super_admin' from auth.users where email = 'YOUR-EMAIL';
```
Reload the site: an **Admin panel** link appears.

## 6. Environment variables
| Variable | Required | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Your Supabase Project URL. The app shows a setup screen without it. |
| `VITE_SUPABASE_ANON_KEY` | yes | Public publishable/anon key. Never the service_role key. |
| `VITE_DEMO_PASSWORD` | optional | Password you passed to `seed_demo()`. It is public in the browser bundle, so use a throwaway password used nowhere else. |

## 7. Run locally with the Supabase CLI
1. Install Node 20 (`.nvmrc`) and the Supabase CLI.
2. `supabase start` (needs Docker). It applies `supabase/migrations/001-009` automatically. Do not also run `database/schema.sql` on the same database.
3. Copy `.env.example` to `.env` and put the local URL and anon key printed by `supabase start`.
4. `npm ci` then `npm run dev`.

## 8. Change the branding
- Name and logo: `src/components/Logo.tsx`, the `<title>` in `index.html`, and `public/` icons.
- Colors: the `brand` palette in `tailwind.config.js`.
- Texts on the landing page: `src/features/public/`.

## 9. Check it works
Sign up → create workspace → add property → add unit → add tenant → create lease → Rent & payments → Generate invoices → record a payment.
More detail: `docs/DEPLOYMENT.md`, `docs/OPERATIONS_AND_BACKUP.md`.
