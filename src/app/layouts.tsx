import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { NAV, ROLE_LABEL } from '../lib/permissions'
import { Select } from '../components/ui'
import { Icon } from '../components/icons'
import type { IconName } from '../components/icons'
import { Logo } from '../components/Logo'
import type { PlatformRole } from '../lib/types'
import { isDemoEmail } from '../lib/demo'

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`

const ICONS: Record<string, IconName> = {
  '/app': 'home', '/app/properties': 'building', '/app/tenants': 'users', '/app/leases': 'file', '/app/invoices': 'card', '/app/expenses': 'receipt',
  '/app/maintenance': 'wrench', '/app/documents': 'folder', '/app/reports': 'chart', '/app/team': 'users', '/app/notifications': 'bell', '/app/support': 'help', '/app/settings': 'cog',
  '/admin': 'home', '/admin/users': 'users', '/admin/organizations': 'building', '/admin/subscriptions': 'card', '/admin/tickets': 'help', '/admin/operations': 'flag', '/admin/admins': 'shield', '/admin/audit': 'list',
}

function Crumbs({ root, rootLabel, labels }: { root: string; rootLabel: string; labels: Record<string, string> }) {
  const { pathname } = useLocation()
  if (pathname === root) return null
  const seg = pathname.replace(root, '').split('/').filter(Boolean)
  const first = labels[`${root}/${seg[0]}`] ?? seg[0]?.replace(/-/g, ' ')
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-xs text-slate-500">
      <Link to={root} className="hover:text-slate-900">{rootLabel}</Link>
      <Icon name="chevron" size={12} />
      {seg.length > 1 ? <Link to={`${root}/${seg[0]}`} className="capitalize hover:text-slate-900">{first}</Link> : <span aria-current="page" className="font-medium capitalize text-slate-700">{first}</span>}
      {seg.length > 1 && <><Icon name="chevron" size={12} /><span aria-current="page" className="font-medium text-slate-700">Details</span></>}
    </nav>
  )
}

function Shell({ brand, nav, side, crumbs, topRight, children }: { brand: React.ReactNode; nav: React.ReactNode; side: React.ReactNode; crumbs: React.ReactNode; topRight: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])
  return (
    <div className="flex min-h-full">
      <a href="#main" className="skip-link">Skip to content</a>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <aside id="sidebar" className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white p-3 transition-transform md:static md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-4 flex items-center justify-between px-2 pt-1">
          <Link to="/" aria-label="Rentora home">{brand}</Link>
          <button aria-label="Close menu" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"><Icon name="x" /></button>
        </div>
        {side}
        <nav aria-label="Main" className="flex-1 space-y-1">{nav}</nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:px-6">
          <button aria-label="Open menu" aria-expanded={open} aria-controls="sidebar" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 md:hidden"><Icon name="menu" /></button>
          <div className="min-w-0 flex-1 md:hidden"><Logo size={26} /></div>
          <div className="ml-auto flex items-center gap-3">{topRight}</div>
        </header>
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{crumbs}{children}</div>
        </main>
      </div>
    </div>
  )
}

function SignOut({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="flex min-h-[40px] w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"><Icon name="out" />Sign out</button>
}

function Initials({ name }: { name?: string | null }) {
  const t = (name ?? '?').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800">{t || '?'}</span>
}

export function AppLayout() {
  const { memberships, org, role, setOrgId, signOut, profile, platformRole, session } = useAuth()
  const items = NAV.filter((n) => role && n.roles.includes(role))
  const labels = Object.fromEntries(NAV.map((n) => [n.to, n.label]))
  return (
    <Shell
      brand={<Logo />}
      crumbs={<Crumbs root="/app" rootLabel="Dashboard" labels={labels} />}
      topRight={
        <>
          {org && <span className="hidden max-w-[14rem] truncate text-sm font-medium text-slate-700 sm:inline">{org.name}</span>}
          <span className="flex items-center gap-2"><Initials name={profile?.full_name} /><span className="hidden text-xs leading-tight text-slate-500 lg:block"><span className="block font-medium text-slate-800">{profile?.full_name ?? ''}</span>{role && ROLE_LABEL[role]}</span></span>
        </>
      }
      side={
        <div className="mb-4 space-y-2 rounded-xl bg-slate-50 p-3">
          {memberships.length > 1 ? (
            <Select aria-label="Switch organization" value={org?.id} onChange={(e) => setOrgId(e.target.value)}>
              {memberships.map((m) => <option key={m.organization.id} value={m.organization.id}>{m.organization.name}</option>)}
            </Select>
          ) : (
            <p className="truncate text-sm font-semibold text-slate-900">{org?.name}</p>
          )}
          <p className="text-xs text-slate-500">{role && ROLE_LABEL[role]}</p>
          {org?.status === 'suspended' && <p role="status" className="rounded-lg bg-red-50 p-2 text-xs text-red-800">This organization is suspended. Access is limited.</p>}
        </div>
      }
      nav={
        <>
          {items.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/app'} className={linkCls}><Icon name={ICONS[n.to] ?? 'list'} />{n.label}</NavLink>)}
          <div className="my-2 border-t border-slate-100" />
          {platformRole && <Link to="/admin" className="flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-purple-800 hover:bg-purple-50"><Icon name="shield" />Admin panel</Link>}
          <SignOut onClick={() => signOut()} />
        </>
      }
    >
      {isDemoEmail(session?.user.email) && <p role="note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">You are using the demo account. Everything here is sample data and is reset from time to time.</p>}
      <Outlet />
    </Shell>
  )
}

const ADMIN_NAV: { to: string; label: string; roles?: PlatformRole[] }[] = [
  { to: '/admin', label: 'Overview' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/organizations', label: 'Organizations' },
  { to: '/admin/subscriptions', label: 'Plans & billing', roles: ['super_admin', 'billing_admin'] },
  { to: '/admin/tickets', label: 'Support tickets', roles: ['super_admin', 'support_admin'] },
  { to: '/admin/operations', label: 'Operations & flags', roles: ['super_admin'] },
  { to: '/admin/admins', label: 'Admin roles', roles: ['super_admin'] },
  { to: '/admin/audit', label: 'Audit log', roles: ['super_admin'] },
]

export function AdminLayout() {
  const { platformRole, signOut, profile } = useAuth()
  const labels = Object.fromEntries(ADMIN_NAV.map((n) => [n.to, n.label]))
  return (
    <Shell
      brand={<Logo suffix="Admin" />}
      crumbs={<Crumbs root="/admin" rootLabel="Overview" labels={labels} />}
      topRight={<span className="flex items-center gap-2"><Initials name={profile?.full_name} /><span className="rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium capitalize text-purple-800 ring-1 ring-inset ring-purple-200">{platformRole?.replace('_', ' ')}</span></span>}
      side={<p className="mb-4 rounded-xl bg-purple-50 px-3 py-2 text-xs font-medium capitalize text-purple-800">Signed in as {platformRole?.replace('_', ' ')}</p>}
      nav={
        <>
          {ADMIN_NAV.filter((n) => !n.roles || (platformRole && n.roles.includes(platformRole))).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/admin'} className={linkCls}><Icon name={ICONS[n.to] ?? 'list'} />{n.label}</NavLink>
          ))}
          <div className="my-2 border-t border-slate-100" />
          <Link to="/app" className="flex min-h-[40px] items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"><Icon name="home" />Back to workspace</Link>
          <SignOut onClick={() => signOut()} />
        </>
      }
    >
      <Outlet />
    </Shell>
  )
}
