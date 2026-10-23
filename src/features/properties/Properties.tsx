import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Badge, Button, ConfirmDialog, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Td, TableWrap, Textarea, Th, statusTone } from '../../components/ui'
import { errMsg, label } from '../../lib/format'
import type { Property } from '../../lib/types'

const TYPES = ['apartment_building', 'house', 'condo', 'townhouse', 'commercial_mixed', 'other']
const schema = z.object({
  name: z.string().min(1, 'Required').max(120),
  address_line: z.string().min(1, 'Required').max(250),
  city: z.string().max(100).optional(),
  property_type: z.string(),
  description: z.string().max(2000).optional(),
})
type V = z.infer<typeof schema>
const PAGE = 10

export function PropertyForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Property }) {
  const { org, session } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<V>({
    resolver: zodResolver(schema),
    values: { name: initial?.name ?? '', address_line: initial?.address_line ?? '', city: initial?.city ?? '', property_type: initial?.property_type ?? 'apartment_building', description: initial?.description ?? '' },
  })
  const m = useMutation({
    mutationFn: async (v: V) => {
      const row = { ...v, city: v.city || null, description: v.description || null }
      if (initial) unwrap(await supabase.from('properties').update(row).eq('id', initial.id))
      else unwrap(await supabase.from('properties').insert({ ...row, organization_id: org!.id, created_by: session!.user.id }))
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); qc.invalidateQueries({ queryKey: ['property'] }); f.reset(); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit property' : 'Add property'}>
      <form onSubmit={f.handleSubmit((v) => { setErr(null); m.mutate(v) })} className="space-y-3" noValidate>
        {err && <ErrorBox error={err} />}
        <Field label="Name" error={f.formState.errors.name?.message}>{(id) => <Input id={id} {...f.register('name')} />}</Field>
        <Field label="Address" error={f.formState.errors.address_line?.message}>{(id) => <Input id={id} {...f.register('address_line')} />}</Field>
        <Field label="City">{(id) => <Input id={id} {...f.register('city')} />}</Field>
        <Field label="Type">{(id) => <Select id={id} {...f.register('property_type')}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>}</Field>
        <Field label="Description">{(id) => <Textarea id={id} {...f.register('description')} />}</Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={m.isPending}>Save</Button></div>
      </form>
    </Modal>
  )
}

export default function Properties() {
  const { org, role } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [edit, setEdit] = useState<Property | undefined>()
  const [open, setOpen] = useState(false)
  const [archive, setArchive] = useState<Property | null>(null)
  const manage = can.manageProperties(role)

  const q = useQuery({
    queryKey: ['properties', org?.id, page, search, status],
    enabled: !!org,
    queryFn: async () => {
      let b = supabase.from('properties').select('*', { count: 'exact' }).eq('organization_id', org!.id).eq('status', status).order('name').range(page * PAGE, page * PAGE + PAGE - 1)
      if (search.trim()) b = b.ilike('name', `%${search.trim().replace(/[%,]/g, '')}%`)
      const r = await b
      if (r.error) throw new Error(r.error.message)
      return { rows: (r.data ?? []) as Property[], total: r.count ?? 0 }
    },
  })
  const toggle = useMutation({
    mutationFn: async (p: Property) => unwrap(await supabase.from('properties').update({ status: p.status === 'active' ? 'archived' : 'active' }).eq('id', p.id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setArchive(null) },
  })

  return (
    <div>
      <PageHeader title="Properties" actions={manage && <Button onClick={() => { setEdit(undefined); setOpen(true) }}>Add property</Button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input aria-label="Search properties" placeholder="Search by name" className="max-w-xs" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
        <Select aria-label="Status" className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
          <option value="active">Active</option><option value="archived">Archived</option>
        </Select>
      </div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.rows.length === 0 && <Empty title="No properties found" hint={manage ? 'Add your first property to get started.' : undefined} action={manage && status === 'active' ? <Button onClick={() => setOpen(true)}>Add property</Button> : undefined} />}
      {q.data && q.data.rows.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>Name</Th><Th>Address</Th><Th>Type</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {q.data.rows.map((p) => (
                <tr key={p.id}>
                  <Td><Link className="font-medium text-brand-600 hover:underline" to={`/app/properties/${p.id}`}>{p.name}</Link></Td>
                  <Td>{p.address_line}{p.city ? `, ${p.city}` : ''}</Td>
                  <Td>{label(p.property_type)}</Td>
                  <Td><Badge tone={statusTone(p.status)}>{label(p.status)}</Badge></Td>
                  <Td className="text-right">
                    {manage && (
                      <span className="space-x-2">
                        <button className="text-brand-600 hover:underline" onClick={() => { setEdit(p); setOpen(true) }}>Edit</button>
                        <button className="text-slate-600 hover:underline" onClick={() => setArchive(p)}>{p.status === 'active' ? 'Archive' : 'Restore'}</button>
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
      <PropertyForm open={open} onClose={() => setOpen(false)} initial={edit} />
      <ConfirmDialog open={!!archive} title={archive?.status === 'active' ? 'Archive property?' : 'Restore property?'} message="Archived properties are hidden from active lists. No data is deleted." confirmLabel="Confirm" loading={toggle.isPending} onConfirm={() => archive && toggle.mutate(archive)} onClose={() => setArchive(null)} />
    </div>
  )
}
