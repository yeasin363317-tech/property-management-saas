import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { money } from '../../lib/format'
import type { Plan } from '../../lib/types'
import DemoButtons from '../auth/DemoButtons'

const features = [
  ['Properties & units', 'Keep every building, unit, rent target and occupancy status in one place.'],
  ['Tenants & leases', 'Link tenants to units with dates, rent, deposit and due day. Overlapping leases are blocked.'],
  ['Rent & payments', 'Monthly invoices, partial payments, outstanding balances and overdue tracking with a full correction trail.'],
  ['Maintenance', 'Log requests, assign staff, track status from new to completed and record costs.'],
  ['Expenses & reports', 'Record property expenses and export rent and expense summaries to CSV.'],
  ['Teams & roles', 'Invite managers, accountants and maintenance staff. Each role sees only what it needs.'],
]

const faqs = [
  ['Is my data separated from other landlords?', 'Yes. Every workspace is isolated at the database level with row level security, not just hidden in the interface.'],
  ['Can tenants log in?', 'Landlords can invite a tenant by email to a restricted portal where they see only their own lease, invoices and maintenance requests.'],
  ['Does Rentora collect rent online?', 'Not yet. Payments are recorded manually by you. Online payments are not part of the current release.'],
  ['How do I get help?', 'Sign in and open Support to create a ticket, or use the contact email below when available.'],
]

export default function Landing() {
  const { session } = useAuth()
  const plans = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => (await supabase.from('plans').select('*').eq('is_active', true).order('price_monthly', { nullsFirst: false })).data as Plan[] | null,
  })
  const contact = useQuery({
    queryKey: ['support-email'],
    queryFn: async () => ((await supabase.from('platform_settings').select('value').eq('key', 'support_email').maybeSingle()).data?.value as string | undefined) ?? '',
  })

  return (
    <div className="min-h-full bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <span className="text-lg font-bold text-brand-700">Rentora</span>
        <nav aria-label="Main" className="flex items-center gap-4 text-sm">
          <a href="#features" className="hidden text-slate-600 hover:text-slate-900 sm:inline">Features</a>
          <a href="#pricing" className="hidden text-slate-600 hover:text-slate-900 sm:inline">Pricing</a>
          <a href="#faq" className="hidden text-slate-600 hover:text-slate-900 sm:inline">FAQ</a>
          {session ? (
            <Link to="/app" className="rounded-md bg-brand-600 px-3 py-2 font-medium text-white">Open app</Link>
          ) : (
            <>
              <Link to="/login" className="font-medium text-slate-700">Log in</Link>
              <Link to="/signup" className="rounded-md bg-brand-600 px-3 py-2 font-medium text-white">Sign up</Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Run your rentals from one secure workspace</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Manage properties, tenants, leases, rent payments and maintenance without spreadsheets and scattered notes.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/signup" className="rounded-md bg-brand-600 px-5 py-3 font-medium text-white hover:bg-brand-700">Create your workspace</Link>
          <a href="#features" className="rounded-md border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-slate-50">See features</a>
        </div>
        <div className="mt-6 flex justify-center"><DemoButtons /></div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold">What you can do</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(([t, d]) => (
            <div key={t} className="rounded-lg border border-slate-200 p-5">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-slate-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-semibold">Plans</h2>
        {plans.isLoading && <p className="mt-4 text-sm text-slate-500">Loading plans...</p>}
        {plans.data && plans.data.length === 0 && <p className="mt-4 text-sm text-slate-500">Plans are not published yet.</p>}
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {(plans.data ?? []).map((p) => (
            <div key={p.code} className="rounded-lg border border-slate-200 p-5">
              <h3 className="text-lg font-semibold">{p.name}</h3>
              <p className="mt-1 text-2xl font-bold">{p.price_monthly === null ? 'Contact us' : p.price_monthly === 0 ? 'Free' : `${money(p.price_monthly, 'USD')}/mo`}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                <li>{p.max_properties ?? 'Unlimited'} properties</li>
                <li>{p.max_units ?? 'Unlimited'} units</li>
                <li>{p.max_members ?? 'Unlimited'} team members</li>
              </ul>
              <Link to="/signup" className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white">Get started</Link>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">Paid plan billing is not yet automated. Plan changes are made by our team.</p>
      </section>

      <section id="faq" className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-2xl font-semibold">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {faqs.map(([q, a]) => (
            <details key={q} className="rounded-lg border border-slate-200 p-4">
              <summary className="cursor-pointer font-medium">{q}</summary>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <div className="space-x-4">
          <Link to="/terms" className="hover:underline">Terms of service</Link>
          <Link to="/privacy" className="hover:underline">Privacy policy</Link>
        </div>
        <p className="mt-2">{contact.data ? <>Contact: <a className="underline" href={`mailto:${contact.data}`}>{contact.data}</a></> : 'Support is available from inside the app.'}</p>
        <p className="mt-1">© {new Date().getFullYear()} Rentora</p>
      </footer>
    </div>
  )
}
