import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Td, TableWrap, Textarea, Th, numField, statusTone } from '../../components/ui'
import { errMsg, fmtDate, label, money, todayStr } from '../../lib/format'
import type { Lease, Tenant } from '../../lib/types'

type LeaseRow = Lease & { tenant: { full_name: string } | null; unit: { unit_number: string; property: { name: string } | null } | null }
type UnitOpt = { id: string; unit_number: string; expected_rent: number; property: { name: string } | null }
const PAGE = 10

const schema = z.object({
  unit_id: z.string().min(1, 'Choose a unit'),
  tenant_id: z.string().min(1, 'Choose a tenant'),
  start_date: z.string().min(1, 'Required'),
  end_date: z.string().optional(),
  monthly_rent: z.number({ invalid_type_error: 'Required' }).min(0),
  security_deposit: z.number().min(0).optional(),
  due_day: z.number().int().min(1).max(28),
}).refine((d) => !d.end_date || d.end_date > d.start_date, { message: 'End date must be after the start date', path: ['end_date'] })
type V = z.infer<typeof schema>

function LeaseForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { org } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const units = useQuery({
    queryKey: ['lease-units', org?.id], enabled: open && !!org,
    queryFn: async () => unwrap(await supabase.from('units').select('id, unit_number, expected_rent, property:properties(name)').eq('organization_id', org!.id).in('status', ['vacant', 'reserved']).order('unit_number')) as unknown as UnitOpt[],
  })
  const tenants = useQuery({
    queryKey: ['lease-tenants', org?.id], enabled: open && !!org,
    queryFn: async () => unwrap(await supabase.from('tenants').select('id, full_name').eq('organization_id', org!.id).neq('status', 'archived').order('full_name')) as Pick<Tenant, 'id' | 'full_name'>[],
  })
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { due_day: 1, start_date: todayStr(), security_deposit: 0 } })
  const m = useMutation({
    mutationFn: async (v: V) => {
      const status = v.start_date <= todayStr() ? 'active' : 'upcoming'
      unwrap(await supabase.from('leases').insert({ organization_id: org!.id, unit_id: v.unit_id, tenant_id: v.tenant_id, start_date: v.start_date, end_date: v.end_date || null, monthly_rent: v.monthly_rent, security_deposit: v.security_deposit ?? 0, due_day: v.due_day, status }))
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leases'] }); qc.invalidateQueries({ queryKey: ['units'] }); f.reset(); onClose() },
    onError: (e) => {
      const msg = errMsg(e)
      setErr(msg.includes('leases_no_overlap') ? 'This unit already has a lease that overlaps these dates.' : msg)
    },
  })
  return (
    <Modal open={open} onClose={onClose} title="Create lease">
      <form onSubmit={f.handleSubmit((v) => { setErr(null); m.mutate(v) })} className="grid grid-cols-2 gap-3" noValidate>
        {err && <div className="col-span-2"><ErrorBox error={err} /></div>}
        <div className="col-span-2"><Field label="Unit" error={f.formState.errors.unit_id?.message} hint={units.data?.length === 0 ? 'No vacant units. Add a unit in a property first.' : undefined}>
          {(id) => (
            <Select id={id} {...f.register('unit_id', { onChange: (e) => { const u = units.data?.find((x) => x.id === e.target.value); if (u) f.setValue('monthly_rent', Number(u.expected_rent)) } })}>
              <option value="">Select unit</option>
              {units.data?.map((u) => <option key={u.id} value={u.id}>{u.property?.name} · {u.unit_number}</option>)}
            </Select>
          )}
        </Field></div>
        <div className="col-span-2"><Field label="Tenant" error={f.formState.errors.tenant_id?.message} hint={tenants.data?.length === 0 ? 'Add a tenant first.' : undefined}>
          {(id) => <Select id={id} {...f.register('tenant_id')}><option value="">Select tenant</option>{tenants.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</Select>}
        </Field></div>
        <Field label="Start date" error={f.formState.errors.start_date?.message}>{(id) => <Input id={id} type="date" {...f.register('start_date')} />}</Field>
        <Field label="End date (optional)" error={f.formState.errors.end_date?.message}>{(id) => <Input id={id} type="date" {...f.register('end_date')} />}</Field>
        <Field label="Monthly rent" error={f.formState.errors.monthly_rent?.message}>{(id) => <Input id={id} type="number" step="0.01" {...f.register('monthly_rent', numField)} />}</Field>
        <Field label="Security deposit">{(id) => <Input id={id} type="number" step="0.01" {...f.register('security_deposit', numField)} />}</Field>
        <Field label="Rent due day" hint="1 to 28" error={f.formState.errors.due_day?.message}>{(id) => <Input id={id} type="number" {...f.register('due_day', numField)} />}</Field>
        <div className="col-span-2 flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={m.isPending}>Create lease</Button></div>
      </form>
    </Modal>
  )
}

function EndLease({ lease, onClose }: { lease: LeaseRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [kind, setKind] = useState('ended')
  const [date, setDate] = useState(todayStr())
  const [reason, setReason] = useState('')
  const m = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('end_lease', { p_lease: lease!.id, p_status: kind, p_end: date, p_reason: reason || null })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leases'] }); qc.invalidateQueries({ queryKey: ['units'] }); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!lease} onClose={onClose} title="End lease (move-out)">
      <div className="space-y-3">
        {err && <ErrorBox error={err} />}
        <Field label="Type">{(id) => <Select id={id} value={kind} onChange={(e) => setKind(e.target.value)}><option value="ended">Ended normally</option><option value="terminated">Terminated early</option></Select>}</Field>
        <Field label="Move-out / end date">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Reason (optional)">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <p className="text-xs text-slate-500">Existing invoices and payments are kept. The unit becomes vacant.</p>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" loading={m.isPending} onClick={() => { setErr(null); m.mutate() }}>End lease</Button></div>
      </div>
    </Modal>
  )
}

function RenewLease({ lease, onClose }: { lease: LeaseRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [end, setEnd] = useState('')
  const [rent, setRent] = useState('')
  const m = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('renew_lease', { p_lease: lease!.id, p_new_end: end, p_new_rent: rent === '' ? null : Number(rent) })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leases'] }); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!lease} onClose={onClose} title="Renew lease">
      <div className="space-y-3">
        {err && <ErrorBox error={err} />}
        <p className="text-sm text-slate-600">A new lease starts the day after the current one ends ({lease?.end_date ? fmtDate(lease.end_date) : '-'}).</p>
        <Field label="New end date">{(id) => <Input id={id} type="date" value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
        <Field label="New monthly rent (blank = keep current)">{(id) => <Input id={id} type="number" step="0.01" value={rent} onChange={(e) => setRent(e.target.value)} />}</Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} disabled={!end} onClick={() => { setErr(null); m.mutate() }}>Renew</Button></div>
      </div>
    </Modal>
  )
}

export default function Leases() {
  const { org, role } = useAuth()
  const manage = can.manageLeases(role)
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('active')
  const [open, setOpen] = useState(false)
  const [ending, setEnding] = useState<LeaseRow | null>(null)
  const [renewing, setRenewing] = useState<LeaseRow | null>(null)
  const q = useQuery({
    queryKey: ['leases', org?.id, page, status], enabled: !!org,
    queryFn: async () => {
      const r = await supabase.from('leases').select('*, tenant:tenants(full_name), unit:units(unit_number, property:properties(name))', { count: 'exact' })
        .eq('organization_id', org!.id).eq('status', status).order('start_date', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (r.error) throw new Error(r.error.message)
      return { rows: (r.data ?? []) as unknown as LeaseRow[], total: r.count ?? 0 }
    },
  })
  return (
    <div>
      <PageHeader title="Leases" actions={manage && <Button onClick={() => setOpen(true)}>Create lease</Button>} />
      <div className="mb-3"><Select aria-label="Status" className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
        {['active', 'upcoming', 'ended', 'terminated'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </Select></div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.rows.length === 0 && <Empty title={`No ${status} leases`} hint={manage && status === 'active' ? 'Create a lease to link a tenant to a unit.' : undefined} />}
      {q.data && q.data.rows.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>Unit</Th><Th>Tenant</Th><Th>Period</Th><Th>Rent</Th><Th>Due day</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {q.data.rows.map((l) => (
                <tr key={l.id}>
                  <Td className="font-medium">{l.unit?.property?.name} · {l.unit?.unit_number}</Td>
                  <Td>{l.tenant?.full_name}</Td>
                  <Td>{fmtDate(l.start_date)} to {l.end_date ? fmtDate(l.end_date) : 'open'}</Td>
                  <Td>{money(l.monthly_rent, org?.currency)}<br /><span className="text-xs text-slate-500">Deposit {money(l.security_deposit, org?.currency)}</span></Td>
                  <Td>{l.due_day}</Td>
                  <Td><Badge tone={statusTone(l.status)}>{label(l.status)}</Badge></Td>
                  <Td className="text-right">
                    {manage && (l.status === 'active' || l.status === 'upcoming') && (
                      <span className="space-x-2">
                        {l.status === 'active' && l.end_date && <button className="text-brand-600 hover:underline" onClick={() => setRenewing(l)}>Renew</button>}
                        <button className="text-red-600 hover:underline" onClick={() => setEnding(l)}>End</button>
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}
      <LeaseForm open={open} onClose={() => setOpen(false)} />
      <EndLease lease={ending} onClose={() => setEnding(null)} />
      <RenewLease lease={renewing} onClose={() => setRenewing(null)} />
    </div>
  )
}
