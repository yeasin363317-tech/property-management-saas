import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Card, ErrorBox, PageHeader, Spinner, Stat } from '../../components/ui'
import { label } from '../../lib/format'

interface Stats {
  users_total: number; users_active: number; users_suspended: number; orgs_total: number; orgs_active: number
  properties: number; units: number; tenants: number; active_leases: number
  subscriptions: { plan: string; status: string; count: number }[]; tickets: Record<string, number>; failed_jobs_7d: number; revenue: null
}

export default function AdminDashboard() {
  const { platformRole } = useAuth()
  const q = useQuery({ queryKey: ['admin-stats'], queryFn: async () => unwrap(await supabase.rpc('admin_stats')) as Stats })
  const d = q.data
  return (
    <div>
      <PageHeader title="Platform overview" subtitle={`Signed in as ${platformRole?.replace('_', ' ')}. Counts come live from the database.`} />
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {d && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Registered users" value={d.users_total} hint={`${d.users_active} active · ${d.users_suspended} suspended`} />
            <Stat label="Organizations" value={d.orgs_total} hint={`${d.orgs_active} active`} />
            <Stat label="Properties" value={d.properties} />
            <Stat label="Units" value={d.units} />
            <Stat label="Tenants" value={d.tenants} />
            <Stat label="Active leases" value={d.active_leases} />
            <Stat label="Open tickets" value={(d.tickets.open ?? 0) + (d.tickets.pending ?? 0)} hint={Object.entries(d.tickets).map(([k, v]) => `${v} ${k}`).join(' · ') || 'No tickets'} />
            <Stat label="Failed jobs (7 days)" value={d.failed_jobs_7d} />
          </div>
          <Card>
            <h2 className="font-semibold">Subscriptions by plan and status</h2>
            {d.subscriptions.length === 0 ? <p className="mt-1 text-sm text-slate-500">No subscriptions yet.</p> : (
              <ul className="mt-2 text-sm text-slate-700">{d.subscriptions.map((s) => <li key={s.plan + s.status}>{s.plan} · {label(s.status)}: <b>{s.count}</b></li>)}</ul>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Not available</h2>
            <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
              <li>Revenue: no payment provider is connected, so there is no verified billing data to report.</li>
              <li>Application error monitoring: no monitoring service is configured. Failed scheduled jobs are shown in Operations.</li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}
