import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { money } from '../../lib/format'
import type { Plan } from '../../lib/types'
import DemoButtons from '../auth/DemoButtons'
import { Logo } from '../../components/Logo'
import { Icon } from '../../components/icons'
import type { IconName } from '../../components/icons'

const benefits: [IconName, string, string][] = [
  ['shield', 'Isolated by design', 'Every workspace is separated at the database level with row level security, not just hidden in the interface.'],
  ['users', 'Roles that fit your team', 'Owners, property managers, accountants and maintenance staff each see only what their role needs.'],
  ['receipt', 'A clear financial trail', 'Payments, reversals and adjustments are recorded so balances can always be explained.'],
  ['chart', 'Export when you need it', 'Download rent and expense summaries to CSV for your own records.'],
]

const steps = [
  ['Create your workspace', 'Sign up, confirm your email and name your workspace.'],
  ['Add properties and tenants', 'Set up buildings and units, then link tenants with leases.'],
  ['Track rent and requests', 'Generate monthly invoices, record payments and follow maintenance to completion.'],
]

const faqs = [
  ['Is my data separated from other landlords?', 'Yes. Every workspace is isolated at the database level with row level security, not just hidden in the interface.'],
  ['Can tenants log in?', 'Landlords can invite a tenant by email to a restricted portal where they see only their own lease, invoices and maintenance requests.'],
  ['Does Rentora collect rent online?', 'Not yet. Payments are recorded manually by you. Online payments are not part of the current release.'],
  ['How do I get help?', 'Sign in and open Support to create a ticket, or use the contact email below when available.'],
]

/* Schematic product visuals. They are drawn in code, carry no figures and make no claims about real data. */
const Bar = ({ w, tone = 'bg-slate-200' }: { w: string; tone?: string }) => <div className={`h-2 rounded-full ${tone}`} style={{ width: w }} />
const Chip = ({ children, tone }: { children: string; tone: string }) => <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${tone}`}>{children}</span>
const GREEN = 'bg-green-50 text-green-800 ring-green-200', AMBER = 'bg-amber-50 text-amber-800 ring-amber-200', RED = 'bg-red-50 text-red-800 ring-red-200', BLUE = 'bg-blue-50 text-blue-800 ring-blue-200'

function Frame({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="img" aria-label={`Illustration: ${title}`} className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-hero ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5" aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
        <span className="ml-3 text-[11px] font-medium text-slate-500">{title}</span>
      </div>
      <div aria-hidden className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

function DashboardVisual() {
  return (
    <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
      <div className="hidden space-y-2 sm:block">
        {['Dashboard', 'Properties', 'Tenants', 'Leases', 'Rent & payments', 'Maintenance'].map((t, i) => (
          <div key={t} className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${i === 0 ? 'bg-brand-50 text-brand-700' : 'text-slate-500'}`}>{t}</div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {['Occupancy', 'Rent due', 'Overdue', 'Open requests'].map((t) => (
            <div key={t} className="rounded-xl border border-slate-200 p-3"><p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{t}</p><div className="mt-2"><Bar w="55%" tone="bg-slate-300" /></div><div className="mt-1.5"><Bar w="35%" /></div></div>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-3 lg:col-span-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Rent collected by month</p>
            <div className="mt-3 flex h-24 items-end gap-2">{[40, 55, 48, 70, 62, 85].map((h, i) => <div key={i} className="flex-1 rounded-t-md bg-brand-500/80" style={{ height: `${h}%` }} />)}</div>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Recent activity</p>
            {[GREEN, AMBER, BLUE].map((t, i) => <div key={i} className="flex items-center justify-between gap-2"><Bar w="60%" /><Chip tone={t}>{['Paid', 'Partial', 'New'][i]}</Chip></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
function PropertiesVisual() {
  return (
    <div className="space-y-2">
      {[['Building A', '4 units'], ['Building B', '2 units'], ['Building C', '6 units']].map(([n, u], i) => (
        <div key={n} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon name="building" /></span>
          <div className="flex-1 space-y-1.5"><p className="text-xs font-semibold text-slate-800">{n}</p><Bar w="45%" /></div>
          <Chip tone={i === 1 ? AMBER : GREEN}>{i === 1 ? 'Reserved' : 'Occupied'}</Chip><span className="text-[11px] text-slate-500">{u}</span>
        </div>
      ))}
    </div>
  )
}
function LeaseVisual() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><div className="space-y-1.5"><p className="text-xs font-semibold text-slate-800">Tenant ↔ Unit</p><Bar w="120px" /></div><Chip tone={GREEN}>Active</Chip></div>
      <div className="grid grid-cols-3 gap-2 text-[10px] font-medium uppercase tracking-wide text-slate-500">{['Start', 'End', 'Due day'].map((t) => <div key={t} className="rounded-lg bg-slate-50 p-2.5">{t}<div className="mt-1.5"><Bar w="70%" tone="bg-slate-300" /></div></div>)}</div>
      <p className="rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600">Overlapping leases on the same unit are blocked.</p>
    </div>
  )
}
function RentVisual() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 text-[11px]">
      {[['Invoice', 'Status'], ['Unit 1', 'Paid'], ['Unit 2', 'Partial'], ['Unit 3', 'Overdue']].map(([a, b], i) => (
        <div key={a} className={`flex items-center justify-between px-3 py-2.5 ${i === 0 ? 'bg-slate-50 font-semibold uppercase tracking-wide text-slate-500' : 'border-t border-slate-100'}`}>
          <span>{a}</span>{i === 0 ? <span>{b}</span> : <Chip tone={[GREEN, AMBER, RED][i - 1]}>{b}</Chip>}
        </div>
      ))}
    </div>
  )
}
function MaintVisual() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[['New', BLUE], ['In progress', AMBER], ['Completed', GREEN]].map(([t, tone]) => (
        <div key={t} className="space-y-2 rounded-xl bg-slate-50 p-2.5"><Chip tone={tone}>{t}</Chip>{[0, 1].map((k) => <div key={k} className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2"><Bar w="80%" tone="bg-slate-300" /><Bar w="50%" /></div>)}</div>
      ))}
    </div>
  )
}

const showcases: { id: string; icon: IconName; title: string; text: string; points: string[]; visual: React.ReactNode; frame: string }[] = [
  { id: 'properties', icon: 'building', title: 'Properties and units in one place', text: 'Keep every building, unit, rent target and occupancy status organised and searchable.', points: ['Units with rent targets and status', 'Documents stored privately per workspace'], visual: <PropertiesVisual />, frame: 'Properties' },
  { id: 'leases', icon: 'file', title: 'Tenants and leases that stay consistent', text: 'Link tenants to units with dates, rent, deposit and due day, then renew or end leases when needed.', points: ['Overlap protection on every unit', 'Invite tenants to a restricted portal'], visual: <LeaseVisual />, frame: 'Leases' },
  { id: 'rent', icon: 'card', title: 'Rent and payments you can explain', text: 'Generate monthly invoices, record partial payments and see what is outstanding or overdue.', points: ['One invoice per lease per month', 'Reversals and adjustments keep a trail'], visual: <RentVisual />, frame: 'Rent & payments' },
  { id: 'maintenance', icon: 'wrench', title: 'Maintenance from request to completion', text: 'Log requests, assign staff, follow status from new to completed and record costs.', points: ['Tenants can submit requests from the portal', 'Priority and status at a glance'], visual: <MaintVisual />, frame: 'Maintenance' },
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
  const btnP = 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-card transition-colors hover:bg-brand-700'
  const btnS = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 shadow-card hover:bg-slate-50'

  return (
    <div className="min-h-full bg-white">
      <a href="#content" className="skip-link">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="Rentora home"><Logo /></Link>
          <nav aria-label="Main" className="flex items-center gap-1 text-sm sm:gap-4">
            <a href="#features" className="hidden px-2 text-slate-600 hover:text-slate-900 md:inline">Features</a>
            <a href="#how" className="hidden px-2 text-slate-600 hover:text-slate-900 md:inline">How it works</a>
            <a href="#pricing" className="hidden px-2 text-slate-600 hover:text-slate-900 md:inline">Plans</a>
            <a href="#faq" className="hidden px-2 text-slate-600 hover:text-slate-900 md:inline">FAQ</a>
            {session ? <Link to="/app" className={btnP}>Open app</Link> : (
              <>
                <Link to="/login" className="px-3 py-2 font-medium text-slate-700 hover:text-slate-900">Log in</Link>
                <Link to="/signup" className={btnP}>Sign up</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="content">
        <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 to-white">
          <div className="mx-auto max-w-4xl px-4 pb-10 pt-14 text-center md:pt-20">
            <p className="mx-auto inline-flex rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700">Property and tenant management</p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-900 md:text-6xl">Run your rentals from one secure workspace</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 md:text-lg">Manage properties, tenants, leases, rent payments and maintenance without spreadsheets and scattered notes.</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className={btnP}>Create your workspace</Link>
              <a href="#features" className={btnS}>See features</a>
            </div>
            <div className="mt-5 flex justify-center"><DemoButtons /></div>
          </div>
          <div className="mx-auto max-w-5xl px-4 pb-16"><Frame title="Rentora dashboard (illustration)"><DashboardVisual /></Frame></div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Everything you track, in one place</h2>
            <p className="mt-3 text-slate-600">Built around the day-to-day work of managing rental property. Illustrations are simplified drawings, not live data.</p>
          </div>
          <div className="mt-14 space-y-20">
            {showcases.map((s, i) => (
              <div key={s.id} id={s.id} className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
                <div className={i % 2 ? 'md:order-2' : ''}>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon name={s.icon} size={20} /></span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-slate-600">{s.text}</p>
                  <ul className="mt-4 space-y-2 text-sm text-slate-700">{s.points.map((p) => <li key={p} className="flex gap-2"><span className="mt-0.5 text-green-700"><Icon name="check" size={16} /></span>{p}</li>)}</ul>
                </div>
                <Frame title={s.frame}>{s.visual}</Frame>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 py-16">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(([ic, t, d]) => (
              <div key={t} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon name={ic} /></span>
                <h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map(([t, d], i) => (
              <li key={t} className="rounded-xl border border-slate-200 p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{i + 1}</span>
                <h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl scroll-mt-16 px-4 pb-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Plans</h2>
          {plans.isLoading && <p role="status" className="mt-4 text-center text-sm text-slate-500">Loading plans...</p>}
          {plans.data && plans.data.length === 0 && <p className="mt-4 text-center text-sm text-slate-500">Plans are not published yet.</p>}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {(plans.data ?? []).map((p) => (
              <div key={p.code} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-lg font-semibold">{p.name}</h3>
                <p className="mt-1 text-3xl font-bold tracking-tight">{p.price_monthly === null ? 'Contact us' : p.price_monthly === 0 ? 'Free' : `${money(p.price_monthly, 'USD')}/mo`}</p>
                <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <li>{p.max_properties ?? 'Unlimited'} properties</li><li>{p.max_units ?? 'Unlimited'} units</li><li>{p.max_members ?? 'Unlimited'} team members</li>
                </ul>
                <Link to="/signup" className={`${btnP} mt-5`}>Get started</Link>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">Paid plan billing is not yet automated. Plan changes are made by our team.</p>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 pb-16">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Frequently asked questions</h2>
          <div className="mt-8 space-y-3">
            {faqs.map(([q, a]) => (
              <details key={q} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-card">
                <summary className="flex min-h-[32px] cursor-pointer items-center justify-between gap-3 font-medium">{q}<span className="text-slate-400 transition-transform group-open:rotate-90"><Icon name="chevron" /></span></summary>
                <p className="mt-2 text-sm text-slate-600">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto max-w-4xl rounded-2xl bg-brand-700 px-6 py-12 text-center text-white">
            <h2 className="text-3xl font-semibold tracking-tight">Ready to move off spreadsheets?</h2>
            <p className="mx-auto mt-3 max-w-xl text-brand-100">Create a workspace, or look around first with the sample data.</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/signup" className="inline-flex min-h-[44px] items-center rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-brand-800 hover:bg-brand-50">Create your workspace</Link>
              <Link to="/login" className="inline-flex min-h-[44px] items-center rounded-lg border border-white/40 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10">Log in</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:justify-between">
          <Logo size={24} />
          <div className="flex gap-5"><Link to="/terms" className="hover:text-slate-900">Terms of service</Link><Link to="/privacy" className="hover:text-slate-900">Privacy policy</Link></div>
          <div className="text-center sm:text-right">
            <p>{contact.data ? <>Contact: <a className="underline" href={`mailto:${contact.data}`}>{contact.data}</a></> : 'Support is available from inside the app.'}</p>
            <p className="mt-1">© {new Date().getFullYear()} Rentora</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
