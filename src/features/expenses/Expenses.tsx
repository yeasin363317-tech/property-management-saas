import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Button, ConfirmDialog, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Select, Spinner, Td, TableWrap, Th, numField } from '../../components/ui'
import { errMsg, fmtDate, label, money, monthStartStr, todayStr } from '../../lib/format'
import type { Expense } from '../../lib/types'

const CATS = ['repairs', 'utilities', 'taxes', 'insurance', 'cleaning', 'salaries', 'supplies', 'other']
const schema = z.object({
  property_id: z.string().min(1, 'Choose a property'),
  category: z.string(),
  amount: z.number({ invalid_type_error: 'Required' }).positive('Must be greater than zero'),
  expense_on: z.string().min(1, 'Required'),
  description: z.string().max(500).optional(),
})
type V = z.infer<typeof schema>
type Row = Expense & { property: { name: string } | null }
const PAGE = 10

function ExpenseForm({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Row }) {
  const { org, session, role } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const props = useQuery({ queryKey: ['prop-options', org?.id], enabled: open && !!org, queryFn: async () => unwrap(await supabase.from('properties').select('id, name').eq('organization_id', org!.id).eq('status', 'active').order('name')) as { id: string; name: string }[] })
  const f = useForm<V>({
    resolver: zodResolver(schema),
    values: { property_id: initial?.property_id ?? '', category: initial?.category ?? 'repairs', amount: initial ? Number(initial.amount) : (undefined as unknown as number), expense_on: initial?.expense_on ?? todayStr(), description: initial?.description ?? '' },
  })
  const m = useMutation({
    mutationFn: async (v: V) => {
      const row = { ...v, description: v.description || null }
      if (initial) unwrap(await supabase.from('expenses').update(row).eq('id', initial.id))
      else unwrap(await supabase.from('expenses').insert({ ...row, organization_id: org!.id, created_by: session!.user.id }))
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); f.reset(); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit expense' : 'Add expense'}>
      <form onSubmit={f.handleSubmit((v) => { setErr(null); m.mutate(v) })} className="space-y-3" noValidate>
        {err && <ErrorBox error={err} />}
        {initial && !can.correctFinance(role) && <ErrorBox error="Only owners and accountants can edit expenses." />}
        <Field label="Property" error={f.formState.errors.property_id?.message}>{(id) => <Select id={id} {...f.register('property_id')}><option value="">Select property</option>{props.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">{(id) => <Select id={id} {...f.register('category')}>{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</Select>}</Field>
          <Field label="Date" error={f.formState.errors.expense_on?.message}>{(id) => <Input id={id} type="date" {...f.register('expense_on')} />}</Field>
        </div>
        <Field label="Amount" error={f.formState.errors.amount?.message}>{(id) => <Input id={id} type="number" step="0.01" {...f.register('amount', numField)} />}</Field>
        <Field label="Description">{(id) => <Input id={id} {...f.register('description')} />}</Field>
        <div className="flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={m.isPending}>Save</Button></div>
      </form>
    </Modal>
  )
}

export default function Expenses() {
  const { org, role } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [month, setMonth] = useState(monthStartStr().slice(0, 7))
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState<Row | undefined>()
  const [del, setDel] = useState<Row | null>(null)
  const q = useQuery({
    queryKey: ['expenses', org?.id, page, month], enabled: !!org,
    queryFn: async () => {
      let b = supabase.from('expenses').select('*, property:properties(name)', { count: 'exact' }).eq('organization_id', org!.id)
      if (month) {
        const [y, m] = month.split('-').map(Number)
        const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
        b = b.gte('expense_on', month + '-01').lt('expense_on', next)
      }
      const r = await b.order('expense_on', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
      if (r.error) throw new Error(r.error.message)
      return { rows: (r.data ?? []) as unknown as Row[], total: r.count ?? 0 }
    },
  })
  const rm = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('expenses').delete().eq('id', id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setDel(null) },
  })
  return (
    <div>
      <PageHeader title="Expenses" actions={<Button onClick={() => { setEdit(undefined); setOpen(true) }}>Add expense</Button>} />
      <div className="mb-3"><Input aria-label="Month" type="month" className="w-44" value={month} onChange={(e) => { setMonth(e.target.value); setPage(0) }} /></div>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.rows.length === 0 && <Empty title="No expenses in this month" />}
      {q.data && q.data.rows.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>Date</Th><Th>Property</Th><Th>Category</Th><Th>Description</Th><Th>Amount</Th><Th /></tr></thead>
            <tbody>
              {q.data.rows.map((e) => (
                <tr key={e.id}>
                  <Td>{fmtDate(e.expense_on)}</Td><Td>{e.property?.name}</Td><Td>{label(e.category)}</Td><Td>{e.description ?? '-'}</Td><Td>{money(e.amount, org?.currency)}</Td>
                  <Td className="text-right"><span className="space-x-2">
                    {can.correctFinance(role) && <button className="text-brand-600 hover:underline" onClick={() => { setEdit(e); setOpen(true) }}>Edit</button>}
                    {role === 'owner' && <button className="text-red-600 hover:underline" onClick={() => setDel(e)}>Delete</button>}
                  </span></Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <Pager page={page} pageSize={PAGE} total={q.data.total} onPage={setPage} />
        </>
      )}
      <ExpenseForm open={open} onClose={() => setOpen(false)} initial={edit} />
      <ConfirmDialog open={!!del} danger title="Delete expense?" message="This permanently removes the expense record. This is logged." confirmLabel="Delete" loading={rm.isPending} onConfirm={() => del && rm.mutate(del.id)} onClose={() => setDel(null)} />
    </div>
  )
}
