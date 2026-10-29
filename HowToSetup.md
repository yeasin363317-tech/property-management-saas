# How to set up Rentora

You need Node.js 20, npm 9+, a Supabase project, a GitHub account, and a Vercel account. The `.nvmrc` file is the expected Node major version.

## 1. Create an empty database

For a SQL-editor setup, create a new empty Supabase project and run `database/schema.sql` once. Then optionally run `database/seed.sql` and call:

```sql
select public.seed_demo('choose-a-unique-demo-password-12+chars');
```

For a Supabase CLI setup, run the ordered files in `supabase/migrations/` on a local development project. Do not run `database/schema.sql` and the migrations on the same database. Migrations are the maintained source of truth; `database/schema.sql` is the SQL-editor distribution generated from that design.

## 2. Configure local environment

Copy the example file to the local-only filename and fill in the public project URL and publishable/anon key:

```bash
cp .env.example .env.local
npm ci
npm run dev
```

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are public browser configuration values. They are expected to be visible in a built frontend. A `service_role` key or any secret key must never be copied into `.env.local` under a `VITE_` name, committed, or shipped to the browser.

## 3. Configure Supabase Auth

In Supabase → Authentication → URL Configuration, set the Site URL to the local or deployed site and add these Redirect URLs:

```text
http://localhost:5173/login
http://localhost:5173/reset-password
https://YOUR-SITE/login
https://YOUR-SITE/reset-password
```

## 4. Deploy to Vercel

Push the repository to GitHub. In Vercel choose **Add New → Project**, import the repository, select the Vite preset, use `npm run build` as the build command, and publish `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project environment variables. Add `VITE_DEMO_PASSWORD` only when using fake demo accounts on an isolated demo deployment; it is compiled into the public browser bundle and must be a unique throwaway password.

## 5. First login and first admin

Open the deployed site, sign up with the intended owner email, confirm the email, log in, and create the first workspace. To create the first platform administrator, run this once in the Supabase SQL editor after the account exists:

```sql
insert into public.platform_admins (user_id, role)
select id, 'super_admin' from auth.users where email = 'YOUR-EMAIL@example.com';
```

Reload the site. The Admin panel link is then available. Further admins are granted through Admin → Admin roles.

## 6. Branding changes

- Name and logo: `src/components/Logo.tsx`, the `<title>` in `index.html`, and `public/` icons.
- Colors: the `brand` palette in `tailwind.config.js`.
- Landing copy and public sections: `src/features/public/`.
- Browser icon: `public/favicon.svg`.

## 7. Verification commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --omit=dev
npm run e2e
```

Authenticated Playwright tests require disposable `E2E_*` Supabase credentials. SQL isolation and admin tests under `supabase/tests/` must run only against a development project. Never claim those tests passed without attaching their actual output.
