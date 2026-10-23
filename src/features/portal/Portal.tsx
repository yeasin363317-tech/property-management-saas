import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Select, Spinner, Td, TableWrap, Textarea, Th, statusTone } from '../../components/ui'
import { errMsg, fmtDate, invoiceDisplayStatus, label, money, outstanding } from '../../lib/format'
import type { Invoice, MaintenanceRequest } from '../../lib/types'

interface Overview {
  tenant_id: string; organization_id: string; tenant_name: string; organization_name: string; currency: string
  leases: { id: string; status: string; start_date: string; end_date: string | null; monthly_rent: number; security_deposit: number; due_day: number; unit_id: string; unit_number: string; property_id: string; property_name: string; address: string }[]
}

export default function Portal() {
  const { session, memberships, signOut, tenantPortalEnabled } = useAuth()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [priority, setPriority] = useState('medium')
  const [err, setErr] = useState<string | null>(null)

  const ov = useQuery({ queryKey: ['portal'], queryFn: async () => unwrap(await supabase.rpc('portal_overview')) as Overview[] })
  const t = ov.data?.[0]
  const inv = useQuery({ queryKey: ['portal-invoices', t?.tenant_id], enabled: !!t, queryFn: async () => unwrap(await supabase.from('rent_invoices').select('*').eq('tenant_id', t!.tenant_id).order('due_date', { ascending: false })) as Invoice[] })
  const reqs = useQuery({ queryKey: ['portal-requests', t?.tenant_id], enabled: !!t, queryFn: async () => unwrap(await supabase.from('maintenance_requests').select('*').eq('tenant_id', t!.tenant_id).order('created_at', { ascending: false })) as MaintenanceRequest[] })
  const activeLease = t?.leases.find((l) => l.status === 'active')

  const create = useMutation({
    mutationFn: async () => unwrap(await supabase.from('maintenance_requests').insert({ organization_id: t!.organization_id, property_id: activeLease!.property_id, unit_id: activeLease!.unit_id, tenant_id: t!.tenant_id, title, description: desc || null, priority, status: 'new', created_by: session!.user.id })),
    onSuccess: () => { setTitle(''); setDesc(''); qc.invalidateQueries({ queryKey: ['portal-requests'] }) },
    onError: (e) => setErr(errMsg(e)),
  })

  const isTenantOnly = memberships.every((m) => m.role === 'tenant')
  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-brand-700">Rentora tenant portal</h1>
        <div className="space-x-3 text-sm">{!isTenantOnly && <Link className="text-brand-600 underline" to="/app">Workspace</Link>}<button className="text-slate-600 underline" onClick={() => signOut()}>Sign out</button></div>
      </div>
      {!tenantPortalEnabled && <ErrorBox error="The tenant portal is currently switched off by the platform." />}
      {ov.isLoading && <Spinner />}
      {ov.error && <ErrorBox error={ov.error} onRetry={() => ov.refetch()} />}
      {ov.data && !t && <Empty title="Nothing to show yet" hint="Your landlord needs to invite you to the portal from their Team page. Use the invitation code you receive on the sign-up screen." />}
      {t && (
        <>
          <p className="text-sm text-slate-600">Welcome, {t.tenant_name} · {t.organization_name}</p>
          <Card>
            <h2 className="font-semibold">My lease</h2>
            {t.leases.length === 0 && <p className="mt-1 text-sm text-slate-500">No lease on file.</p>}
            {t.leases.map((l) => (
              <div key={l.id} className="mt-2 rounded border border-slate-200 p-3 text-sm">
                <p className="font-medium">{l.property_name} · Unit {l.unit_number} <Badge tone={statusTone(l.status)}>{label(l.status)}</Badge></p>
                <p className="text-slate-600">{l.address}</p>
                <p className="text-slate-600">{fmtDate(l.start_date)} to {l.end_date ? fmtDate(l.end_date) : 'open-ended'} · Rent {money(l.monthly_rent, t.currency)} due on day {l.due_day} · Deposit {money(l.security_deposit, t.currency)}</p>
              </div>
            ))}
          </Card>
          <div>
            <h2 className="mb-2 font-semibold">My invoices</h2>
            {inv.isLoading && <Spinner />}
            {inv.data?.length === 0 && <Empty title="No invoices yet" />}
            {inv.data && inv.data.length > 0 && (
              <TableWrap><thead><tr><Th>Due</Th><Th>Amount</Th><Th>Paid</Th><Th>Outstanding</Th><Th>Status</Th></tr></thead>
                <tbody>{inv.data.map((i) => { const s = invoiceDisplayStatus(i); return <tr key={i.id}><Td>{fmtDate(i.due_date)}</Td><Td>{money(i.amount_due, t.currency)}</Td><Td>{money(i.amount_paid, t.currency)}</Td><Td>{money(outstanding(i), t.currency)}</Td><Td><Badge tone={statusTone(s)}>{label(s)}</Badge></Td></tr> })}</tbody></TableWrap>
            )}
          </div>
          <div>
            <h2 className="mb-2 font-semibold">Maintenance requests</h2>
            <Card className="mb-3">
              {!activeLease ? <p className="text-sm text-slate-500">You need an active lease to submit a request.</p> : (
                <div className="space-y-3">
                  {err && <ErrorBox error={err} />}
                  <Field label="What needs fixing?">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
                  <Field label="Details">{(id) => <Textarea id={id} value={desc} onChange={(e) => setDesc(e.target.value)} />}</Field>
                  <Field label="Priority">{(id) => <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value)}>{['low', 'medium', 'high', 'urgent'].map((p) => <option key={p} value={p}>{label(p)}</option>)}</Select>}</Field>
                  <Button loading={create.isPending} disabled={title.trim().length < 3} onClick={() => { setErr(null); create.mutate() }}>Submit request</Button>
                </div>
              )}
            </Card>
            {reqs.data?.length === 0 && <p className="text-sm text-slate-500">No requests yet.</p>}
            <ul className="space-y-2">{reqs.data?.map((r) => <li key={r.id} className="rounded border border-slate-200 bg-white p-3 text-sm"><span className="font-medium">{r.title}</span> <Badge tone={statusTone(r.status)}>{label(r.status)}</Badge><span className="block text-xs text-slate-500">{fmtDate(r.created_at)}</span></li>)}</ul>
          </div>
        </>
      )}
    </div>
  )
}
