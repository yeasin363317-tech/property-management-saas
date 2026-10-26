import { Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Card, ErrorBox, Input, PageHeader, Spinner, Stat } from '../../components/ui'
import { money, monthStartStr, todayStr } from '../../lib/format'
import { FIN } from '../../lib/permissions'

interface Dash {
  properties: number; units: number; occupied_units: number; vacant_units: number; active_tenants: number; expected_monthly_rent: number
  invoiced: number; collected: number; outstanding: number; overdue_count: number; overdue_amount: number; expenses: number
  open_maintenance: number; expiring_leases: number; trend: { month: string; invoiced: number; collected: number; expenses: number }[]
}

export default function Dashboard() {
  const { org, role } = useAuth()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const q = useQuery({
    queryKey: ['dashboard', org?.id, from, to],
    enabled: !!org && !!role && FIN.includes(role),
    queryFn: async () => unwrap(await supabase.rpc('org_dashboard', { p_org: org!.id, p_from: from, p_to: to })) as Dash,
  })
  if (role && !FIN.includes(role)) return <Navigate to="/app/maintenance" replace />
  const cur = org?.currency ?? 'BDT'
  const d = q.data
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Invoiced = rent billed with a due date in range. Collected = valid payments received in range. Outstanding = unpaid balance on all open invoices."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="text-xs font-medium text-slate-600">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        }
      />
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {d && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Properties" value={d.properties} />
            <Stat label="Units" value={d.units} hint={`${d.occupied_units} occupied · ${d.vacant_units} vacant`} />
            <Stat label="Active tenants" value={d.active_tenants} />
            <Stat label="Expected monthly rent" value={money(d.expected_monthly_rent, cur)} hint="From active leases" />
            <Stat label="Invoiced" value={money(d.invoiced, cur)} />
            <Stat label="Collected" value={money(d.collected, cur)} />
            <Stat label="Outstanding" value={money(d.outstanding, cur)} />
            <Stat label="Overdue" value={money(d.overdue_amount, cur)} hint={`${d.overdue_count} invoice(s)`} />
            <Stat label="Expenses" value={money(d.expenses, cur)} hint="Recorded expenses in range" />
            <Stat label="Open maintenance" value={d.open_maintenance} />
            <Stat label="Leases expiring (60 days)" value={d.expiring_leases} />
          </div>
          <Card>
            <h2 className="mb-3 font-semibold">Last 6 months</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="invoiced" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Invoiced" />
                  <Bar dataKey="collected" fill="#2563eb" radius={[4, 4, 0, 0]} name="Collected" />
                  <Bar dataKey="expenses" fill="#b45309" radius={[4, 4, 0, 0]} name="Expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500">Income minus expenses here is a simple summary, not audited accounting.</p>
          </Card>
        </div>
      )}
    </div>
  )
}
