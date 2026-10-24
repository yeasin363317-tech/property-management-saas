import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can, MGR } from '../../lib/permissions'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Td, TableWrap, Textarea, Th, numField, statusTone } from '../../components/ui'
import { errMsg, fmtDate, fmtDateTime, label, money } from '../../lib/format'
import type { MaintenanceRequest } from '../../lib/types'

type Row = MaintenanceRequest & { property: { name: string } | null; unit: { unit_number: string } | null }
const PAGE = 10
const STATUSES = ['new', 'acknowledged', 'in_progress', 'waiting', 'completed', 'cancelled']
const NEXT: Record<string, string[]> = {
  new: ['acknowledged', 'in_progress', 'cancelled'], acknowledged: ['in_progress', 'waiting', 'cancelled'],
  in_progress: ['waiting', 'completed', 'cancelled'], waiting: ['in_progress', 'cancelled'], completed: [], cancelled: [],
}

const schema = z.object({
  property_id: z.string().min(1, 'Choose a property'),
  unit_id: z.string().optional(),
  title: z.string().min(3, 'At least 3 characters').max(150),
  description: z.string().max(3000).optional(),
  priority: z.string(),
  assigned_to: z.string().optional(),
  estimated_cost: z.number().min(0).optional(),
})
type V = z.infer<typeof schema>

function NewRequest({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { org, session, role } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { priority: 'medium' } })
  const propId = f.watch('property_id')
  const props = useQuery({ queryKey: ['prop-options', org?.id], enabled: open && !!org, queryFn: async () => unwrap(await supabase.from('properties').select('id, name').eq('organization_id', org!.id).eq('status', 'active').order('name')) as { id: string; name: string }[] })
  const units = useQuery({ queryKey: ['unit-options', propId], enabled: open && !!propId, queryFn: async () => unwrap(await supabase.from('units').select('id, unit_number').eq('property_id', propId).order('unit_number')) as { id: string; unit_number: string }[] })
  const staff = useQuery({
    queryKey: ['maint-staff', org?.id], enabled: open && !!org && !!role && MGR.includes(role),
    queryFn: async () => {
      const m = unwrap(await supabase.from('organization_members').select('user_id').eq('organization_id', org!.id).eq('role', 'maintenance').eq('status', 'active')) as { user_id: string }[]
      if (!m.length) return []
      const p = unwrap(await supabase.from('profiles').select('id, full_name').in('id', m.map((x) => x.user_id))) as { id: string; full_name: string | null }[]
      return p
    },
  })
  const mut = useMutation({
    mutationFn: async (v: V) => unwrap(await supabase.from('maintenance_requests').insert({
      organization_id: org!.id, property_id: v.property_id, unit_id: v.unit_id || null, title: v.title, description: v.description || null,
      priority: v.priority, assigned_to: v.assigned_to || null, estimated_cost: v.estimated_cost ?? null, created_by: session!.user.id,
    })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); f.reset({ priority: 'medium' }); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title="New maintenance request">
      <form onSubmit={f.handleSubmit((v) => { setErr(null); mut.mutate(v) })} className="space-y-3" noValidate>
        {err && <ErrorBox error={err} />}
        <Field label="Property" error={f.formState.errors.property_id?.message}>{(id) => <Select id={id} {...f.register('property_id')}><option value="">Select property</option>{props.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
        <Field label="Unit (optional)">{(id) => <Select id={id} {...f.register('unit_id')}><option value="">Whole property</option>{units.data?.map((u) => <option key={u.id} value={u.id}>{u.unit_number}</option>)}</Select>}</Field>
        <Field label="Issue title" error={f.formState.errors.title?.message}>{(id) => <Input id={id} {...f.register('title')} />}</Field>
        <Field label="Description">{(id) => <Textarea id={id} {...f.register('description')} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">{(id) => <Select id={id} {...f.register('priority')}>{['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{label(p)}</option>)}</Select>}</Field>
          <Field label="Estimated cost">{(id) => <Input id={id} type="number" step="0.01" {...f.register('estimated_cost', numField)} />}</Field>
        </div>
        {role && MGR.includes(role) && (
          <Field label="Assign to" hint={staff.data?.length === 0 ? 'No maintenance staff yet. Invite one from Team.' : undefined}>{(id) => <Select id={id} {...f.register('assigned_to')}><option value="">Unassigned</option>{staff.data?.map((s) => <option key={s.id} value={s.id}>{s.full_name ?? s.id.slice(0, 8)}</option>)}</Select>}</Field>
        )}
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={mut.isPending}>Create request</Button></div>
      </form>
    </Modal>
  )
}

function Detail({ req, onClose }: { req: Row | null; onClose: () => void }) {
  const { org, role } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [actual, setActual] = useState('')
  const { session } = useAuth()
  const ups = useQuery({
    queryKey: ['maintenance-updates', req?.id], enabled: !!req,
    queryFn: async () => unwrap(await supabase.from('maintenance_updates').select('*').eq('request_id', req!.id).order('created_at')) as { id: string; comment: string | null; status_from: string | null; status_to: string | null; created_at: string }[],
  })
  // Managers can always update; maintenance staff only on requests assigned to them (the database enforces this too).
  const canUpdate = !!role && (MGR.includes(role) || (role === 'maintenance' && req?.assigned_to === session?.user.id))
  const move = useMutation({
    mutationFn: async (to: string) => unwrap(await supabase.from('maintenance_requests').update({ status: to }).eq('id', req!.id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); qc.invalidateQueries({ queryKey: ['maintenance-updates'] }); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  const addComment = useMutation({
    mutationFn: async () => unwrap(await supabase.from('maintenance_updates').insert({ organization_id: req!.organization_id, request_id: req!.id, author_id: session!.user.id, comment })),
    onSuccess: () => { setComment(''); qc.invalidateQueries({ queryKey: ['maintenance-updates'] }) },
    onError: (e) => setErr(errMsg(e)),
  })
  const saveCost = useMutation({
    mutationFn: async () => unwrap(await supabase.from('maintenance_requests').update({ actual_cost: Number(actual) }).eq('id', req!.id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['maintenance'] }); setActual('') },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!req} onClose={onClose} title={req?.title ?? ''}>
      {req && (
        <div className="space-y-4 text-sm">
          {err && <ErrorBox error={err} />}
          <p className="text-slate-600">{req.property?.name}{req.unit ? ` · Unit ${req.unit.unit_number}` : ''} · <Badge tone={statusTone(req.priority)}>{label(req.priority)}</Badge> <Badge tone={statusTone(req.status)}>{label(req.status)}</Badge></p>
          {req.description && <p>{req.description}</p>}
          <p className="text-slate-600">Estimated {req.estimated_cost !== null ? money(req.estimated_cost, org?.currency) : '-'} · Actual {req.actual_cost !== null ? money(req.actual_cost, org?.currency) : '-'}{req.completed_on ? ` · Completed ${fmtDate(req.completed_on)}` : ''}</p>
          {canUpdate && NEXT[req.status].length > 0 && (
            <div><p className="mb-1 font-medium">Move to</p><div className="flex flex-wrap gap-2">
              {NEXT[req.status].map((s) => <Button key={s} variant={s === 'cancelled' ? 'danger' : 'secondary'} loading={move.isPending && move.variables === s} onClick={() => { setErr(null); move.mutate(s) }}>{label(s)}</Button>)}
            </div></div>
          )}
          {canUpdate && (
            <div className="flex items-end gap-2"><Field label="Actual cost">{(id) => <Input id={id} type="number" step="0.01" value={actual} onChange={(e) => setActual(e.target.value)} />}</Field><Button variant="secondary" disabled={actual === ''} loading={saveCost.isPending} onClick={() => saveCost.mutate()}>Save cost</Button></div>
          )}
          <div>
            <p className="mb-1 font-medium">Progress</p>
            {ups.isLoading && <Spinner />}
            <ul className="space-y-1">
              {ups.data?.map((u) => <li key={u.id} className="rounded bg-slate-50 p-2">{u.status_to ? <span>Status: {label(u.status_from)} → <b>{label(u.status_to)}</b></span> : u.comment}<span className="block text-xs text-slate-500">{fmtDateTime(u.created_at)}</span></li>)}
              {ups.data?.length === 0 && <li className="text-slate-500">No updates yet.</li>}
            </ul>
            <div className="mt-2 flex gap-2"><Input aria-label="Add a comment" placeholder="Add a progress note" value={comment} onChange={(e) => setComment(e.target.value)} /><Button variant="secondary" disabled={!comment.trim()} loading={addComment.isPending} onClick={() => addComment.mutate()}>Add</Button></div>
          </div>
        </div>
      )}
    </Modal>
  )
}

export default function Maintenance() {
  const { org, role } = useAuth()
  const [page, setPage] = useState(0)
  const [status, setStatus] = useState('open')
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Row | null>(null)
  const canCreate = !!role && (MGR.includes(role) || role === 'maintenance')
  const q = useQuery({
    queryKey: ['maintenance', org?.id, page, status], enabled: !!org,
    queryFn: async () => {
      let b = supabase.from('maintenance_requests').select('*, property:properties(name), unit:units(unit_number)', { count: 'exact' }).eq('organization_id', org!.id)
      if (status === 'open') b = b.not('status', 'in', '("completed","cancelled")')
      else if (status !== 'all') b = b.eq('status', status)
      const r = await b.order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (r.error) throw new Error(r.error.message)
      return { rows: (r.data ?? []) as unknown as Row[], total: r.count ?? 0 }
    },
  })
  return (
    <div>
      <PageHeader title="Maintenance" subtitle={role === 'maintenance' ? 'Requests assigned to you' : undefined} actions={canCreate && <Button onClick={() => setOpen(true)}>New request</Button>} />
      <div className="mb-3"><Select aria-label="Status" className="w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0) }}>
        <option value="open">Open</option><option value="all">All</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
      </Select></div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.rows.length === 0 && <Empty title="No requests" hint="Nothing matches this filter." />}
      {q.data && q.data.rows.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>Issue</Th><Th>Location</Th><Th>Priority</Th><Th>Status</Th><Th>Created</Th></tr></thead>
            <tbody>
              {q.data.rows.map((r) => (
                <tr key={r.id}>
                  <Td><button className="font-medium text-brand-600 hover:underline" onClick={() => setSel(r)}>{r.title}</button></Td>
                  <Td>{r.property?.name}{r.unit ? ` · ${r.unit.unit_number}` : ''}</Td>
                  <Td><Badge tone={statusTone(r.priority)}>{label(r.priority)}</Badge></Td>
                  <Td><Badge tone={statusTone(r.status)}>{label(r.status)}</Badge></Td>
                  <Td>{fmtDate(r.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}
      <NewRequest open={open} onClose={() => setOpen(false)} />
      <Detail req={sel} onClose={() => setSel(null)} />
    </div>
  )
}
