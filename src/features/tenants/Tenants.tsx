import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Td, TableWrap, Textarea, Th, statusTone } from '../../components/ui'
import { errMsg, fmtDate, label, money } from '../../lib/format'
import type { Lease, Tenant } from '../../lib/types'

const schema = z.object({
  full_name: z.string().min(1, 'Required').max(120),
  email: z.string().email('Invalid email').or(z.literal('')).optional(),
  phone: z.string().max(30).optional(),
  emergency_contact_name: z.string().max(120).optional(),
  emergency_contact_phone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
  status: z.string(),
})
type V = z.infer<typeof schema>
const PAGE = 10

function TenantForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Tenant }) {
  const { org } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<V>({
    resolver: zodResolver(schema),
    values: {
      full_name: initial?.full_name ?? '', email: initial?.email ?? '', phone: initial?.phone ?? '', emergency_contact_name: initial?.emergency_contact_name ?? '',
      emergency_contact_phone: initial?.emergency_contact_phone ?? '', notes: initial?.notes ?? '', status: initial?.status ?? 'active',
    },
  })
  const m = useMutation({
    mutationFn: async (v: V) => {
      const row = { ...v, email: v.email ? v.email.toLowerCase() : null, phone: v.phone || null, emergency_contact_name: v.emergency_contact_name || null, emergency_contact_phone: v.emergency_contact_phone || null, notes: v.notes || null }
      if (initial) unwrap(await supabase.from('tenants').update(row).eq('id', initial.id))
      else unwrap(await supabase.from('tenants').insert({ ...row, organization_id: org!.id }))
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tenants'] }); f.reset(); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit tenant' : 'Add tenant'}>
      <form onSubmit={f.handleSubmit((v) => { setErr(null); m.mutate(v) })} className="space-y-3" noValidate>
        {err && <ErrorBox error={err} />}
        <Field label="Full name" error={f.formState.errors.full_name?.message}>{(id) => <Input id={id} {...f.register('full_name')} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email" error={f.formState.errors.email?.message}>{(id) => <Input id={id} type="email" {...f.register('email')} />}</Field>
          <Field label="Phone">{(id) => <Input id={id} {...f.register('phone')} />}</Field>
          <Field label="Emergency contact">{(id) => <Input id={id} {...f.register('emergency_contact_name')} />}</Field>
          <Field label="Emergency phone">{(id) => <Input id={id} {...f.register('emergency_contact_phone')} />}</Field>
        </div>
        <Field label="Status">{(id) => <Select id={id} {...f.register('status')}><option value="active">Active</option><option value="former">Former</option><option value="archived">Archived</option></Select>}</Field>
        <Field label="Notes" hint="Keep only information you need.">{(id) => <Textarea id={id} {...f.register('notes')} />}</Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={m.isPending}>Save</Button></div>
      </form>
    </Modal>
  )
}

function TenantHistory({ tenant, onClose }: { tenant: Tenant | null; onClose: () => void }) {
  const { org } = useAuth()
  const q = useQuery({
    queryKey: ['tenant-history', tenant?.id], enabled: !!tenant,
    queryFn: async () => unwrap(await supabase.from('leases').select('*, unit:units(unit_number, property:properties(name))').eq('tenant_id', tenant!.id).order('start_date', { ascending: false })) as (Lease & { unit: { unit_number: string; property: { name: string } } })[],
  })
  return (
    <Modal open={!!tenant} onClose={onClose} title={`Lease history: ${tenant?.full_name ?? ''}`}>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} />}
      {q.data && q.data.length === 0 && <p className="text-sm text-slate-500">No leases yet.</p>}
      <ul className="space-y-2 text-sm">
        {q.data?.map((l) => (
          <li key={l.id} className="rounded border border-slate-200 p-2">
            <p className="font-medium">{l.unit?.property?.name} · Unit {l.unit?.unit_number} <Badge tone={statusTone(l.status)}>{label(l.status)}</Badge></p>
            <p className="text-slate-600">{fmtDate(l.start_date)} to {l.end_date ? fmtDate(l.end_date) : 'open-ended'} · {money(l.monthly_rent, org?.currency)}/mo</p>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

export default function Tenants() {
  const { org, role } = useAuth()
  const manage = can.manageTenants(role)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Tenant | undefined>()
  const [hist, setHist] = useState<Tenant | null>(null)
  const q = useQuery({
    queryKey: ['tenants', org?.id, page, search, status], enabled: !!org,
    queryFn: async () => {
      let b = supabase.from('tenants').select('*', { count: 'exact' }).eq('organization_id', org!.id).eq('status', status).order('full_name').range(page * PAGE, page * PAGE + PAGE - 1)
      if (search.trim()) b = b.ilike('full_name', `%${search.trim().replace(/[%,]/g, '')}%`)
      const r = await b
      if (r.error) throw new Error(r.error.message)
      return { rows: (r.data ?? []) as Tenant[], total: r.count ?? 0 }
    },
  })
  return (
    <div>
      <PageHeader title="Tenants" actions={manage && <Button onClick={() => { setEdit(undefined); setOpen(true) }}>Add tenant</Button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input aria-label="Search tenants" placeholder="Search by name" className="max-w-xs" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        <Select aria-label="Status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
          <option value="active">Active</option><option value="former">Former</option><option value="archived">Archived</option>
        </Select>
      </div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.rows.length === 0 && <Empty title="No tenants found" hint={manage ? 'Add a tenant, then create a lease for them.' : undefined} />}
      {q.data && q.data.rows.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>Name</Th><Th>Contact</Th><Th>Status</Th><Th>Portal</Th><Th /></tr></thead>
            <tbody>
              {q.data.rows.map((t) => (
                <tr key={t.id}>
                  <Td className="font-medium">{t.full_name}</Td>
                  <Td>{t.email ?? '-'}<br /><span className="text-slate-500">{t.phone ?? ''}</span></Td>
                  <Td><Badge tone={statusTone(t.status)}>{label(t.status)}</Badge></Td>
                  <Td>{t.user_id ? <Badge tone="green">Linked</Badge> : <span className="text-slate-400">Not invited</span>}</Td>
                  <Td className="text-right"><span className="space-x-2">
                    <button className="text-slate-600 hover:underline" onClick={() => setHist(t)}>Leases</button>
                    {manage && <button className="text-brand-600 hover:underline" onClick={() => { setEdit(t); setOpen(true) }}>Edit</button>}
                  </span></Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}
      <TenantForm open={open} onClose={() => setOpen(false)} initial={edit} />
      <TenantHistory tenant={hist} onClose={() => setHist(null)} />
    </div>
  )
}
