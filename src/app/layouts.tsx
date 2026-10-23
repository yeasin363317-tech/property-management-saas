import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { NAV, ROLE_LABEL } from '../lib/permissions'
import { Select } from '../components/ui'
import type { PlatformRole } from '../lib/types'
import { isDemoEmail } from '../lib/demo'

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100'}`

function Shell({ brand, nav, side, children }: { brand: string; nav: React.ReactNode; side: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="font-semibold text-brand-700">{brand}</span>
        <button aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded border border-slate-300 px-2.5 py-1 text-sm">Menu</button>
      </header>
      <aside className={`${open ? 'block' : 'hidden'} w-full shrink-0 border-r border-slate-200 bg-white p-3 md:block md:w-60`}>
        <div className="mb-4 hidden px-2 text-lg font-bold text-brand-700 md:block">{brand}</div>
        {side}
        <nav aria-label="Main" className="space-y-1" onClick={() => setOpen(false)}>{nav}</nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  )
}

export function AppLayout() {
  const { memberships, org, role, setOrgId, signOut, profile, platformRole, session } = useAuth()
  const items = NAV.filter((n) => role && n.roles.includes(role))
  return (
    <Shell
      brand="Rentora"
      side={
        <div className="mb-4 space-y-2 px-1">
          {memberships.length > 1 ? (
            <Select aria-label="Switch organization" value={org?.id} onChange={(e) => setOrgId(e.target.value)}>
              {memberships.map((m) => <option key={m.organization.id} value={m.organization.id}>{m.organization.name}</option>)}
            </Select>
          ) : (
            <p className="truncate text-sm font-medium">{org?.name}</p>
          )}
          <p className="text-xs text-slate-500">{role && ROLE_LABEL[role]} · {profile?.full_name ?? ''}</p>
          {org?.status === 'suspended' && <p className="rounded bg-red-50 p-2 text-xs text-red-700">This organization is suspended. Access is limited.</p>}
        </div>
      }
      nav={
        <>
          {items.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/app'} className={linkCls}>{n.label}</NavLink>)}
          {platformRole && <Link to="/admin" className="block rounded-md px-3 py-2 text-sm font-medium text-purple-700 hover:bg-purple-50">Admin panel</Link>}
          <button onClick={() => signOut()} className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100">Sign out</button>
        </>
      }
    >
      {isDemoEmail(session?.user.email) && <p role="note" className="mb-4 rounded-md bg-amber-50 p-2 text-sm text-amber-900">You are using the demo account. Everything here is sample data and is reset from time to time.</p>}
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
  const { platformRole, signOut } = useAuth()
  return (
    <Shell
      brand="Rentora Admin"
      side={<p className="mb-4 rounded bg-purple-50 px-3 py-2 text-xs font-medium text-purple-800">{platformRole?.replace('_', ' ')}</p>}
      nav={
        <>
          {ADMIN_NAV.filter((n) => !n.roles || (platformRole && n.roles.includes(platformRole))).map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/admin'} className={linkCls}>{n.label}</NavLink>
          ))}
          <Link to="/app" className="block rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">Back to workspace</Link>
          <button onClick={() => signOut()} className="block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100">Sign out</button>
        </>
      }
    >
      <Outlet />
    </Shell>
  )
}
