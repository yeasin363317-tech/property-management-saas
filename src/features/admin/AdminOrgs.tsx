import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Badge, Button, Empty, ErrorBox, Field, Input, PageHeader, Pager, Select, Spinner, Td, TableWrap, Th, statusTone } from '../../components/ui'
import { fmtDate, label } from '../../lib/format'
import type { Plan } from '../../lib/types'
import { ReasonDialog } from './shared'

interface O { id: string; name: string; status: string; owner_email: string | null; member_count: number; property_count: number; unit_count: number; plan_code: string | null; sub_status: string | null; created_at: string; total_count: number }
const PAGE = 25

export default function AdminOrgs() {
  const { platformRole } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusTarget, setStatusTarget] = useState<O | null>(null)
  const [planTarget, setPlanTarget] = useState<O | null>(null)
  const [plan, setPlan] = useState('free')
  const [subStatus, setSubStatus] = useState('active')
  const isSuper = platformRole === 'super_admin'
  const canBill = isSuper || platformRole === 'billing_admin'
  const q = useQuery({ queryKey: ['admin-orgs', page, search], queryFn: async () => unwrap(await supabase.rpc('admin_list_orgs', { p_search: search || null, p_limit: PAGE, p_offset: page * PAGE })) as O[] })
  const plans = useQuery({ queryKey: ['admin-plans-all'], enabled: canBill, queryFn: async () => unwrap(await supabase.from('plans').select('*').order('code')) as Plan[] })
  const total = q.data?.[0]?.total_count ?? 0
  const next = statusTarget?.status === 'active' ? 'suspended' : 'active'
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-orgs'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) }
  return (
    <div>
      <PageHeader title="Organizations" />
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(input.trim()); setPage(0) }}>
        <Input aria-label="Search organizations" className="max-w-xs" placeholder="Search by name" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <Empty title="No organizations found" />}
      {q.data && q.data.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>Organization</Th><Th>Status</Th><Th>Members</Th><Th>Properties / units</Th><Th>Plan</Th><Th>Created</Th><Th /></tr></thead>
            <tbody>{q.data.map((o) => (
              <tr key={o.id}>
                <Td><span className="font-medium">{o.name}</span><br /><span className="text-xs text-slate-500">{o.owner_email}</span></Td>
                <Td><Badge tone={statusTone(o.status)}>{label(o.status)}</Badge></Td>
                <Td>{o.member_count}</Td><Td>{o.property_count} / {o.unit_count}</Td>
                <Td>{o.plan_code ?? '-'} <span className="text-xs text-slate-500">{o.sub_status ? label(o.sub_status) : ''}</span></Td>
                <Td>{fmtDate(o.created_at)}</Td>
                <Td className="text-right"><span className="space-x-2 whitespace-nowrap">
                  {canBill && <button className="text-brand-600 hover:underline" onClick={() => { setPlan(o.plan_code ?? 'free'); setSubStatus(o.sub_status ?? 'active'); setPlanTarget(o) }}>Change plan</button>}
                  {isSuper && <button className={o.status === 'active' ? 'text-red-600 hover:underline' : 'text-brand-600 hover:underline'} onClick={() => setStatusTarget(o)}>{o.status === 'active' ? 'Suspend' : 'Reactivate'}</button>}
                </span></Td>
              </tr>))}</tbody>
          </TableWrap>
          <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
        </>
      )}
      <ReasonDialog open={!!statusTarget} danger={next === 'suspended'} title={next === 'suspended' ? 'Suspend organization' : 'Reactivate organization'}
        description="Members of a suspended organization lose access to its data. Nothing is deleted." confirmLabel={next === 'suspended' ? 'Suspend' : 'Reactivate'}
        onConfirm={async (reason) => { unwrap(await supabase.rpc('admin_set_org_status', { p_org: statusTarget!.id, p_status: next, p_reason: reason })); refresh() }} onClose={() => setStatusTarget(null)} />
      <ReasonDialog open={!!planTarget} title={`Change plan: ${planTarget?.name ?? ''}`} confirmLabel="Apply change"
        description="This is a manual administrative adjustment. It is recorded as such and is not a verified payment."
        extra={<div className="grid grid-cols-2 gap-3">
          <Field label="Plan">{(id) => <Select id={id} value={plan} onChange={(e) => setPlan(e.target.value)}>{plans.data?.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select>}</Field>
          <Field label="Status">{(id) => <Select id={id} value={subStatus} onChange={(e) => setSubStatus(e.target.value)}>{['active', 'trialing', 'past_due', 'canceled'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
        </div>}
        onConfirm={async (reason) => { unwrap(await supabase.rpc('admin_set_subscription', { p_org: planTarget!.id, p_plan: plan, p_status: subStatus, p_reason: reason })); refresh(); qc.invalidateQueries({ queryKey: ['admin-sub-events'] }) }} onClose={() => setPlanTarget(null)} />
    </div>
  )
}
