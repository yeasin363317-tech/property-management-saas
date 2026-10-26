import { Link, Route, Routes } from 'react-router-dom'
import { envOk } from './lib/supabase'
import { RequireAdmin, RequireAuth, RequireOrg, RequireRole } from './app/guards'
import { AdminLayout, AppLayout } from './app/layouts'
import { FIN } from './lib/permissions'
import { Logo } from './components/Logo'
import Landing from './features/public/Landing'
import { Terms, Privacy } from './features/public/Legal'
import { Login, Signup, Forgot, ResetPassword } from './features/auth/AuthPages'
import Onboarding from './features/auth/Onboarding'
import Dashboard from './features/dashboard/Dashboard'
import Properties from './features/properties/Properties'
import PropertyDetail from './features/properties/PropertyDetail'
import Tenants from './features/tenants/Tenants'
import Leases from './features/leases/Leases'
import Invoices from './features/rent/Invoices'
import Expenses from './features/expenses/Expenses'
import Maintenance from './features/maintenance/Maintenance'
import Documents from './features/documents/Documents'
import Reports from './features/reports/Reports'
import Team from './features/team/Team'
import Notifications from './features/notifications/Notifications'
import Support from './features/support/Support'
import Settings from './features/settings/Settings'
import Portal from './features/portal/Portal'
import AdminDashboard from './features/admin/AdminDashboard'
import AdminUsers from './features/admin/AdminUsers'
import AdminOrgs from './features/admin/AdminOrgs'
import AdminBilling from './features/admin/AdminBilling'
import AdminTickets from './features/admin/AdminTickets'
import AdminOps from './features/admin/AdminOps'
import AdminAdmins from './features/admin/AdminAdmins'
import AdminAudit from './features/admin/AdminAudit'

function NotFound() {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
      <Logo />
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-700">Error 404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-slate-600">The page you are looking for does not exist or has moved.</p>
      <Link to="/" className="mt-2 inline-flex min-h-[40px] items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Go to home page</Link>
    </div>
  )
}

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">Setup needed</h1>
      <p className="mt-2 text-sm text-slate-700">
        This app is missing its Supabase settings. In your hosting dashboard (for example Vercel → Settings → Environment Variables) add{' '}
        <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-slate-100 px-1">VITE_SUPABASE_ANON_KEY</code>, then redeploy.
      </p>
    </div>
  )
}

export default function App() {
  if (!envOk) return <SetupNeeded />
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/forgot-password" element={<Forgot />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/portal" element={<Portal />} />

        <Route element={<RequireOrg />}>
          <Route path="/app" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="properties" element={<Properties />} />
            <Route path="properties/:id" element={<PropertyDetail />} />
            <Route path="tenants" element={<RequireRole roles={FIN}><Tenants /></RequireRole>} />
            <Route path="leases" element={<RequireRole roles={FIN}><Leases /></RequireRole>} />
            <Route path="invoices" element={<RequireRole roles={FIN}><Invoices /></RequireRole>} />
            <Route path="expenses" element={<RequireRole roles={FIN}><Expenses /></RequireRole>} />
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="documents" element={<Documents />} />
            <Route path="reports" element={<RequireRole roles={FIN}><Reports /></RequireRole>} />
            <Route path="team" element={<RequireRole roles={['owner']}><Team /></RequireRole>} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="support" element={<Support />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        <Route element={<RequireAdmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="organizations" element={<AdminOrgs />} />
            <Route element={<RequireAdmin roles={['super_admin', 'billing_admin']} />}><Route path="subscriptions" element={<AdminBilling />} /></Route>
            <Route element={<RequireAdmin roles={['super_admin', 'support_admin']} />}><Route path="tickets" element={<AdminTickets />} /></Route>
            <Route element={<RequireAdmin roles={['super_admin']} />}>
              <Route path="operations" element={<AdminOps />} />
              <Route path="admins" element={<AdminAdmins />} />
              <Route path="audit" element={<AdminAudit />} />
            </Route>
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
