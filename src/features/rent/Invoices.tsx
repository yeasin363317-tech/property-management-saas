import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Td, TableWrap, Textarea, Th, statusTone } from '../../components/ui'
import { errMsg, fmtDate, invoiceDisplayStatus, label, money, monthStartStr, outstanding, todayStr } from '../../lib/format'
import type { Invoice, Payment } from '../../lib/types'

type InvRow = Invoice & { tenant: { full_name: string } | null; lease: { unit: { unit_number: string; property: { name: string } | null } | null } | null }
const PAGE = 10
const METHODS = ['cash', 'bank_transfer', 'mobile_banking', 'cheque', 'other']

function PayModal({ inv, onClose }: { inv: InvRow | null; onClose: () => void }) {
  const { org } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayStr())
  const [method, setMethod] = useState('cash')
  const [ref, setRef] = useState('')
  // One idempotency key per open modal: a retry after a network failure cannot double-record.
  const key = useMemo(() => (inv ? crypto.randomUUID() : ''), [inv])
  const bal = inv ? outstanding(inv) : 0
  const m = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('record_payment', { p_invoice: inv!.id, p_amount: Number(amount || bal), p_paid_on: date, p_method: method, p_reference: ref || null, p_idempotency_key: key })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['payments'] }); setAmount(''); setRef(''); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!inv} onClose={onClose} title="Record payment">
      <div className="space-y-3">
        {err && <ErrorBox error={err} />}
        <p className="text-sm text-slate-600">{inv?.tenant?.full_name} · outstanding <b>{money(bal, org?.currency)}</b></p>
        <Field label="Amount" hint="Partial payments are allowed. You cannot pay more than the balance.">{(id) => <Input id={id} type="number" step="0.01" placeholder={String(bal)} value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
        <Field label="Date received">{(id) => <Input id={id} type="date" max={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Method">{(id) => <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map((x) => <option key={x} value={x}>{label(x)}</option>)}</Select>}</Field>
        <Field label="Reference (optional)">{(id) => <Input id={id} value={ref} onChange={(e) => setRef(e.target.value)} />}</Field>
        <p className="text-xs text-slate-500">This records a payment you received yourself. It is not verified with a bank or payment provider.</p>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={m.isPending} onClick={() => { setErr(null); m.mutate() }}>Record payment</Button></div>
      </div>
    </Modal>
  )
}

function Payments({ inv, onClose }: { inv: InvRow | null; onClose: () => void }) {
  const { org, role } = useAuth()
  const qc = useQueryClient()
  const [rev, setRev] = useState<Payment | null>(null)
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['payments', inv?.id], enabled: !!inv,
    queryFn: async () => unwrap(await supabase.from('payments').select('*').eq('invoice_id', inv!.id).order('created_at')) as Payment[],
  })
  const m = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('reverse_payment', { p_payment: rev!.id, p_reason: reason })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payments'] }); qc.invalidateQueries({ queryKey: ['invoices'] }); setRev(null); setReason('') },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!inv} onClose={onClose} title="Payment history">
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} />}
      {q.data?.length === 0 && <p className="text-sm text-slate-500">No payments recorded.</p>}
      <ul className="space-y-2 text-sm">
        {q.data?.map((p) => (
          <li key={p.id} className="rounded border border-slate-200 p-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">{money(p.amount, org?.currency)} <Badge tone={statusTone(p.status)}>{label(p.status)}</Badge></span>
              {p.status === 'valid' && can.correctFinance(role) && <button className="text-red-600 hover:underline" onClick={() => { setRev(p); setErr(null) }}>Reverse</button>}
            </div>
            <p className="text-slate-600">{fmtDate(p.paid_on)} · {label(p.method)}{p.reference ? ` · ${p.reference}` : ''}</p>
            {p.reversal_reason && <p className="text-xs text-red-700">Reversed: {p.reversal_reason}</p>}
          </li>
        ))}
      </ul>
      {rev && (
        <div className="mt-4 space-y-2 rounded border border-red-200 bg-red-50 p-3">
          {err && <ErrorBox error={err} />}
          <Field label="Reason for reversal (required)">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setRev(null)}>Cancel</Button><Button variant="danger" loading={m.isPending} disabled={reason.trim().length < 5} onClick={() => m.mutate()}>Reverse payment</Button></div>
        </div>
      )}
    </Modal>
  )
}

function Correct({ inv, onClose }: { inv: InvRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'adjust' | 'void'>('adjust')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const m = useMutation({
    mutationFn: async () => mode === 'void'
      ? unwrap(await supabase.rpc('void_invoice', { p_invoice: inv!.id, p_reason: reason }))
      : unwrap(await supabase.rpc('add_invoice_adjustment', { p_invoice: inv!.id, p_amount: Number(amount), p_reason: reason })),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); setAmount(''); setReason(''); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={!!inv} onClose={onClose} title="Correct invoice">
      <div className="space-y-3">
        {err && <ErrorBox error={err} />}
        <Select aria-label="Correction type" value={mode} onChange={(e) => setMode(e.target.value as 'adjust' | 'void')}>
          <option value="adjust">Add an adjustment (+ increase / - decrease)</option><option value="void">Void this invoice</option>
        </Select>
        {mode === 'adjust' && <Field label="Adjustment amount" hint="Use a negative number for a discount or credit.">{(id) => <Input id={id} type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>}
        <Field label="Reason (required)">{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
        <p className="text-xs text-slate-500">The original amount is never edited. Corrections are stored as separate, logged entries.</p>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={mode === 'void' ? 'danger' : 'primary'} loading={m.isPending} disabled={reason.trim().length < 5 || (mode === 'adjust' && (!amount || Number(amount) === 0))} onClick={() => { setErr(null); m.mutate() }}>{mode === 'void' ? 'Void invoice' : 'Save adjustment'}</Button></div>
      </div>
    </Modal>
  )
}

export default function Invoices() {
  const { org, role } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [month, setMonth] = useState(monthStartStr().slice(0, 7))
  const [filter, setFilter] = useState('all')
  const [pay, setPay] = useState<InvRow | null>(null)
  const [hist, setHist] = useState<InvRow | null>(null)
  const [fix, setFix] = useState<InvRow | null>(null)
  const [genMsg, setGenMsg] = useState<string | null>(null)
  const [genErr, setGenErr] = useState<string | null>(null)
  const today = todayStr()

  const q = useQuery({
    queryKey: ['invoices', org?.id, page, month, filter], enabled: !!org,
    queryFn: async () => {
      let b = supabase.from('rent_invoices').select('*, tenant:tenants(full_name), lease:leases(unit:units(unit_number, property:properties(name)))', { count: 'exact' }).eq('organization_id', org!.id)
      if (month) b = b.eq('period_start', month + '-01')
      if (filter === 'paid') b = b.eq('status', 'paid')
      else if (filter === 'void') b = b.eq('status', 'void')
      else if (filter === 'overdue') b = b.eq('status', 'open').lt('due_date', today)
      else if (filter === 'partial') b = b.eq('status', 'open').gt('amount_paid', 0).gte('due_date', today)
      else if (filter === 'open') b = b.eq('status', 'open').eq('amount_paid', 0).gte('due_date', today)
      const r = await b.order('due_date').range(page * PAGE, page * PAGE + PAGE - 1)
      if (r.error) throw new Error(r.error.message)
      return { rows: (r.data ?? []) as unknown as InvRow[], total: r.count ?? 0 }
    },
  })
  const gen = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('generate_invoices', { p_org: org!.id, p_month: month + '-01' })) as number,
    onSuccess: (n) => { setGenErr(null); setGenMsg(n === 0 ? 'No new invoices. Everything for this month already exists.' : `${n} invoice(s) created.`); qc.invalidateQueries({ queryKey: ['invoices'] }) },
    onError: (e) => { setGenMsg(null); setGenErr(errMsg(e)) },
  })
  const cur = org?.currency
  return (
    <div>
      <PageHeader title="Rent & payments" subtitle="Invoices are generated from active leases, one per lease per month." actions={can.recordPayments(role) && <Button loading={gen.isPending} onClick={() => gen.mutate()}>Generate invoices for {month}</Button>} />
      {genMsg && <p role="status" className="mb-3 rounded bg-green-50 p-2 text-sm text-green-800">{genMsg}</p>}
      {genErr && <div className="mb-3"><ErrorBox error={genErr} /></div>}
      <div className="mb-3 flex flex-wrap gap-2">
        <Input aria-label="Billing month" type="month" className="w-44" value={month} onChange={(e) => { setMonth(e.target.value); setPage(0) }} />
        <Select aria-label="Filter" className="w-44" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0) }}>
          <option value="all">All</option><option value="open">Open (not due)</option><option value="partial">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="void">Void</option>
        </Select>
      </div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.rows.length === 0 && <Empty title="No invoices for this selection" hint="Generate invoices for the month, or change the filter." />}
      {q.data && q.data.rows.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>Tenant / unit</Th><Th>Due</Th><Th>Amount</Th><Th>Paid</Th><Th>Outstanding</Th><Th>Status</Th><Th /></tr></thead>
            <tbody>
              {q.data.rows.map((i) => {
                const st = invoiceDisplayStatus(i)
                return (
                  <tr key={i.id}>
                    <Td><span className="font-medium">{i.tenant?.full_name}</span><br /><span className="text-xs text-slate-500">{i.lease?.unit?.property?.name} · {i.lease?.unit?.unit_number}</span></Td>
                    <Td>{fmtDate(i.due_date)}</Td>
                    <Td>{money(i.amount_due, cur)}{Number(i.adjustment_total) !== 0 && <span className="block text-xs text-slate-500">adj. {money(i.adjustment_total, cur)}</span>}</Td>
                    <Td>{money(i.amount_paid, cur)}</Td>
                    <Td>{money(outstanding(i), cur)}</Td>
                    <Td><Badge tone={statusTone(st)}>{label(st)}</Badge></Td>
                    <Td className="text-right"><span className="space-x-2 whitespace-nowrap">
                      {can.recordPayments(role) && i.status === 'open' && <button className="text-brand-600 hover:underline" onClick={() => setPay(i)}>Pay</button>}
                      <button className="text-slate-600 hover:underline" onClick={() => setHist(i)}>Payments</button>
                      {can.correctFinance(role) && i.status !== 'void' && <button className="text-slate-600 hover:underline" onClick={() => setFix(i)}>Correct</button>}
                    </span></Td>
                  </tr>
                )
              })}
            </tbody>
          </TableWrap>
          <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}
      <PayModal inv={pay} onClose={() => setPay(null)} />
      <Payments inv={hist} onClose={() => setHist(null)} />
      <Correct inv={fix} onClose={() => setFix(null)} />
    </div>
  )
}
