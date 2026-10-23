import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, ErrorBox, Input, PageHeader, Spinner, Stat } from '../../components/ui'
import { downloadCsv, toCsv } from '../../lib/csv'
import { label, money, monthStartStr, outstanding, todayStr } from '../../lib/format'

export default function Reports() {
  const { org } = useAuth()
  const [from, setFrom] = useState(monthStartStr())
  const [to, setTo] = useState(todayStr())
  const cur = org?.currency ?? 'BDT'

  const rent = useQuery({
    queryKey: ['report-rent', org?.id, from, to], enabled: !!org,
    queryFn: async () => unwrap(await supabase.from('rent_invoices').select('*, tenant:tenants(full_name), lease:leases(unit:units(unit_number, property:properties(name)))').eq('organization_id', org!.id).neq('status', 'void').gte('due_date', from).lte('due_date', to).order('due_date').limit(2000)) as any[],
  })
  const exp = useQuery({
    queryKey: ['report-exp', org?.id, from, to], enabled: !!org,
    queryFn: async () => unwrap(await supabase.from('expenses').select('*, property:properties(name)').eq('organization_id', org!.id).gte('expense_on', from).lte('expense_on', to).order('expense_on').limit(2000)) as any[],
  })
  const pays = useQuery({
    queryKey: ['report-pay', org?.id, from, to], enabled: !!org,
    queryFn: async () => unwrap(await supabase.from('payments').select('amount').eq('organization_id', org!.id).eq('status', 'valid').gte('paid_on', from).lte('paid_on', to).limit(5000)) as { amount: number }[],
  })

  const invoiced = (rent.data ?? []).reduce((s, i) => s + Number(i.amount_due), 0)
  const collected = (pays.data ?? []).reduce((s, p) => s + Number(p.amount), 0)
  const owed = (rent.data ?? []).reduce((s, i) => s + outstanding(i), 0)
  const spent = (exp.data ?? []).reduce((s, e) => s + Number(e.amount), 0)

  const exportRent = () => downloadCsv(`rent-${from}-to-${to}.csv`, toCsv(
    (rent.data ?? []).map((i) => ({ due: i.due_date, property: i.lease?.unit?.property?.name, unit: i.lease?.unit?.unit_number, tenant: i.tenant?.full_name, amount_due: i.amount_due, amount_paid: i.amount_paid, outstanding: outstanding(i), status: i.status })),
    [{ key: 'due', header: 'Due date' }, { key: 'property', header: 'Property' }, { key: 'unit', header: 'Unit' }, { key: 'tenant', header: 'Tenant' }, { key: 'amount_due', header: 'Amount due' }, { key: 'amount_paid', header: 'Amount paid' }, { key: 'outstanding', header: 'Outstanding' }, { key: 'status', header: 'Stored status' }]))
  const exportExp = () => downloadCsv(`expenses-${from}-to-${to}.csv`, toCsv(
    (exp.data ?? []).map((e) => ({ date: e.expense_on, property: e.property?.name, category: label(e.category), description: e.description, amount: e.amount })),
    [{ key: 'date', header: 'Date' }, { key: 'property', header: 'Property' }, { key: 'category', header: 'Category' }, { key: 'description', header: 'Description' }, { key: 'amount', header: 'Amount' }]))

  const loading = rent.isLoading || exp.isLoading || pays.isLoading
  const error = rent.error ?? exp.error ?? pays.error
  return (
    <div>
      <PageHeader title="Reports" subtitle="Summaries of recorded data. Not audited accounting." actions={
        <div className="flex items-end gap-2">
          <label className="text-xs text-slate-600">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-slate-600">To<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>} />
      {loading && <Spinner />}
      {error && <ErrorBox error={error} />}
      {!loading && !error && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Invoiced (due in range)" value={money(invoiced, cur)} />
            <Stat label="Collected (received in range)" value={money(collected, cur)} />
            <Stat label="Outstanding on those invoices" value={money(owed, cur)} />
            <Stat label="Expenses recorded" value={money(spent, cur)} hint={`Collected minus expenses: ${money(collected - spent, cur)}`} />
          </div>
          <Card>
            <h2 className="font-semibold">Rent collection report</h2>
            <p className="text-sm text-slate-600">{rent.data?.length ?? 0} invoice(s) with a due date in this range.</p>
            <Button className="mt-3" variant="secondary" disabled={!rent.data?.length} onClick={exportRent}>Download CSV</Button>
          </Card>
          <Card>
            <h2 className="font-semibold">Expense report</h2>
            <p className="text-sm text-slate-600">{exp.data?.length ?? 0} expense(s) in this range.</p>
            <Button className="mt-3" variant="secondary" disabled={!exp.data?.length} onClick={exportExp}>Download CSV</Button>
          </Card>
        </div>
      )}
    </div>
  )
}
