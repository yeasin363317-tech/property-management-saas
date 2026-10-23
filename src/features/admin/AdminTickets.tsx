import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Td, TableWrap, Th, statusTone } from '../../components/ui'
import { errMsg, fmtDateTime, label } from '../../lib/format'

interface T { id: string; subject: string; description: string; status: string; priority: string; assigned_to: string | null; created_at: string; organization: { name: string } | null }
interface N { id: string; body: string; is_internal: boolean; created_at: string; author_id: string }

function Detail({ t, onClose }: { t: T | null; onClose: () => void }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [assign, setAssign] = useState('')
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const notes = useQuery({ queryKey: ['admin-ticket-notes', t?.id], enabled: !!t, queryFn: async () => unwrap(await supabase.from('ticket_notes').select('*').eq('ticket_id', t!.id).order('created_at')) as N[] })
  const save = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('admin_update_ticket', { p_ticket: t!.id, p_status: status || t!.status, p_priority: priority || t!.priority, p_assigned_to: assign === '' ? t!.assigned_to : assign === 'none' ? null : session!.user.id })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-tickets'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  const note = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('admin_add_ticket_note', { p_ticket: t!.id, p_body: body, p_internal: internal })),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['admin-ticket-notes'] }) },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!t} onClose={onClose} title={t?.subject ?? ''}>
      {t && (
        <div className="space-y-3 text-sm">
          {err && <ErrorBox error={err} />}
          <p className="text-slate-600">{t.organization?.name ?? 'No organization'} · {fmtDateTime(t.created_at)}</p>
          <p className="whitespace-pre-wrap">{t.description}</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Status">{(id) => <Select id={id} defaultValue={t.status} onChange={(e) => setStatus(e.target.value)}>{['open', 'pending', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
            <Field label="Priority">{(id) => <Select id={id} defaultValue={t.priority} onChange={(e) => setPriority(e.target.value)}>{['low', 'normal', 'high', 'urgent'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}</Field>
            <Field label="Assignee">{(id) => <Select id={id} defaultValue="" onChange={(e) => setAssign(e.target.value)}><option value="">{t.assigned_to ? (t.assigned_to === session?.user.id ? 'Me (current)' : 'Someone (current)') : 'Unassigned (current)'}</option><option value="me">Assign to me</option><option value="none">Unassign</option></Select>}</Field>
          </div>
          <Button loading={save.isPending} onClick={() => { setErr(null); save.mutate() }}>Save changes</Button>
          <div className="space-y-1">{notes.data?.map((n) => <div key={n.id} className={`rounded p-2 ${n.is_internal ? 'bg-amber-50' : 'bg-slate-50'}`}><p className="whitespace-pre-wrap">{n.body}</p><p className="text-xs text-slate-500">{n.is_internal ? 'Internal note' : 'Visible to user'} · {fmtDateTime(n.created_at)}</p></div>)}</div>
          <div className="space-y-2"><Input aria-label="Add a note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note or reply" />
            <label className="flex items-center gap-2"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal only (hidden from the user)</label>
            <Button variant="secondary" disabled={!body.trim()} loading={note.isPending} onClick={() => note.mutate()}>Add note</Button></div>
        </div>
      )}
    </Modal>
  )
}

export default function AdminTickets() {
  const [status, setStatus] = useState('open')
  const [sel, setSel] = useState<T | null>(null)
  const q = useQuery({
    queryKey: ['admin-tickets', status],
    queryFn: async () => {
      let b = supabase.from('support_tickets').select('*, organization:organizations(name)').order('created_at', { ascending: false }).limit(100)
      if (status !== 'all') b = b.eq('status', status)
      const r = await b
      if (r.error) throw new Error(r.error.message)
      return (r.data ?? []) as unknown as T[]
    },
  })
  return (
    <div>
      <PageHeader title="Support tickets" />
      <div className="mb-3"><Select aria-label="Status" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option>{['open', 'pending', 'resolved', 'closed'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select></div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <Empty title="No tickets" />}
      {q.data && q.data.length > 0 && (
        <TableWrap><thead><tr><Th>Subject</Th><Th>Organization</Th><Th>Priority</Th><Th>Status</Th><Th>Created</Th></tr></thead>
          <tbody>{q.data.map((t) => <tr key={t.id}><Td><button className="font-medium text-brand-600 hover:underline" onClick={() => setSel(t)}>{t.subject}</button></Td><Td>{t.organization?.name ?? '-'}</Td><Td><Badge tone={statusTone(t.priority)}>{label(t.priority)}</Badge></Td><Td><Badge tone={statusTone(t.status)}>{label(t.status)}</Badge></Td><Td>{fmtDateTime(t.created_at)}</Td></tr>)}</tbody></TableWrap>
      )}
      <Detail t={sel} onClose={() => setSel(null)} />
    </div>
  )
}
