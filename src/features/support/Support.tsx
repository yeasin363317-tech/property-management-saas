import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Td, TableWrap, Textarea, Th, statusTone } from '../../components/ui'
import { errMsg, fmtDate, fmtDateTime, label } from '../../lib/format'

interface Ticket { id: string; subject: string; description: string; status: string; priority: string; created_at: string }
interface Note { id: string; body: string; created_at: string; author_id: string }

function TicketModal({ ticket, onClose }: { ticket: Ticket | null; onClose: () => void }) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [body, setBody] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const notes = useQuery({ queryKey: ['ticket-notes', ticket?.id], enabled: !!ticket, queryFn: async () => unwrap(await supabase.from('ticket_notes').select('*').eq('ticket_id', ticket!.id).order('created_at')) as Note[] })
  const add = useMutation({
    mutationFn: async () => unwrap(await supabase.from('ticket_notes').insert({ ticket_id: ticket!.id, author_id: session!.user.id, body, is_internal: false })),
    onSuccess: () => { setBody(''); qc.invalidateQueries({ queryKey: ['ticket-notes'] }) },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!ticket} onClose={onClose} title={ticket?.subject ?? ''}>
      {ticket && (
        <div className="space-y-3 text-sm">
          {err && <ErrorBox error={err} />}
          <p><Badge tone={statusTone(ticket.status)}>{label(ticket.status)}</Badge></p>
          <p className="whitespace-pre-wrap">{ticket.description}</p>
          <div className="space-y-1">{notes.data?.map((n) => <div key={n.id} className="rounded bg-slate-50 p-2"><p className="whitespace-pre-wrap">{n.body}</p><p className="text-xs text-slate-500">{n.author_id === session?.user.id ? 'You' : 'Support'} · {fmtDateTime(n.created_at)}</p></div>)}</div>
          {ticket.status !== 'closed' && <div className="flex gap-2"><Input aria-label="Reply" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a reply" /><Button disabled={!body.trim()} loading={add.isPending} onClick={() => add.mutate()}>Send</Button></div>}
        </div>
      )}
    </Modal>
  )
}

export default function Support() {
  const { org, session } = useAuth()
  const qc = useQueryClient()
  const [subject, setSubject] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [sel, setSel] = useState<Ticket | null>(null)
  const q = useQuery({ queryKey: ['my-tickets'], queryFn: async () => unwrap(await supabase.from('support_tickets').select('*').eq('created_by', session!.user.id).order('created_at', { ascending: false })) as Ticket[] })
  const create = useMutation({
    mutationFn: async () => unwrap(await supabase.from('support_tickets').insert({ organization_id: org?.id ?? null, created_by: session!.user.id, subject, description: desc })),
    onSuccess: () => { setSubject(''); setDesc(''); qc.invalidateQueries({ queryKey: ['my-tickets'] }) },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <div>
      <PageHeader title="Support" subtitle="Describe your problem or request. Our team will reply here." />
      <Card className="mb-5">
        <div className="space-y-3">
          {err && <ErrorBox error={err} />}
          <Field label="Subject">{(id) => <Input id={id} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
          <Field label="Details">{(id) => <Textarea id={id} rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
          <Button loading={create.isPending} disabled={subject.trim().length < 3 || desc.trim().length < 3} onClick={() => { setErr(null); create.mutate() }}>Create ticket</Button>
        </div>
      </Card>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} />}
      {q.data?.length === 0 && <Empty title="No tickets yet" />}
      {q.data && q.data.length > 0 && (
        <TableWrap><thead><tr><Th>Subject</Th><Th>Status</Th><Th>Created</Th></tr></thead>
          <tbody>{q.data.map((t) => <tr key={t.id}><Td><button className="font-medium text-brand-600 hover:underline" onClick={() => setSel(t)}>{t.subject}</button></Td><Td><Badge tone={statusTone(t.status)}>{label(t.status)}</Badge></Td><Td>{fmtDate(t.created_at)}</Td></tr>)}</tbody></TableWrap>
      )}
      <TicketModal ticket={sel} onClose={() => setSel(null)} />
    </div>
  )
}
