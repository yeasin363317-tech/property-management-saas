import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { Spinner, Card, PermissionDenied } from '../components/ui'
import type { OrgRole, PlatformRole } from '../lib/types'

function Full({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex min-h-full max-w-md items-center p-4"><div className="w-full">{children}</div></div>
}

export function RequireAuth() {
  const { session, loading, profile, signOut } = useAuth()
  const loc = useLocation()
  if (loading) return <Spinner label="Loading your session" />
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (profile?.status === 'suspended') {
    return (
      <Full>
        <Card>
          <h1 className="text-lg font-semibold">Account suspended</h1>
          <p className="mt-2 text-sm text-slate-600">Your account has been suspended. Please contact support if you believe this is a mistake.</p>
          <button className="mt-4 text-sm font-medium text-brand-600 underline" onClick={() => signOut()}>Sign out</button>
        </Card>
      </Full>
    )
  }
  return <Outlet />
}

/** Landlord workspace: needs at least one membership; tenants are sent to the portal. */
export function RequireOrg() {
  const { memberships, role } = useAuth()
  if (!memberships.length) return <Navigate to="/onboarding" replace />
  if (role === 'tenant') return <Navigate to="/portal" replace />
  return <Outlet />
}

export function RequireRole({ roles, children }: { roles: OrgRole[]; children: ReactNode }) {
  const { role } = useAuth()
  if (!role || !roles.includes(role)) {
    return <PermissionDenied message="Your role in this workspace does not include this page." action={<Link to="/app" className="text-sm font-medium text-brand-700 underline">Back to dashboard</Link>} />
  }
  return <>{children}</>
}

/** UI guard only. Every admin RPC/table re-checks the platform role in the database. */
export function RequireAdmin({ roles }: { roles?: PlatformRole[] }) {
  const { platformRole, loading, session } = useAuth()
  const loc = useLocation()
  // Wait for the session and platform role to resolve so privileged screens never flash.
  if (loading) return <Spinner label="Checking access" />
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (!platformRole || (roles && !roles.includes(platformRole))) {
    return <div className="p-4 pt-16"><PermissionDenied title="Admin access required" message="This area is only for Rentora platform administrators." action={<Link to="/app" className="text-sm font-medium text-brand-700 underline">Back to workspace</Link>} /></div>
  }
  return <Outlet />
}
