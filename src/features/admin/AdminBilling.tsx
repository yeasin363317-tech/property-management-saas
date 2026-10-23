import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Badge, Button, Card, ErrorBox, Field, Input, PageHeader, Spinner, Td, TableWrap, Th } from '../../components/ui'
import { fmtDateTime, label } from '../../lib/format'
import type { Plan } from '../../lib/types'
import { ReasonDialog } from './shared'

interface Ev { id: number; organization_id: string; event_type: string; from_plan: string | null; to_plan: string | null; from_status: string | null; to_status: string | null; source: string; reason: string | null; created_at: string; organization: { name: string } | null }
type Draft = { code: string; name: string; price: string; props: string; units: string; members: string; active: boolean }
const blank: Draft = { code: '', name: '', price: '', props: '', units: '', members: '', active: true }
const nz = (s: string) => (s.trim() === '' ? null : Number(s))

export default function AdminBilling() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Draft | null>(null)
  const plans = useQuery({ queryKey: ['admin-plans-all'], queryFn: async () => unwrap(await supabase.from('plans').select('*').order('code')) as Plan[] })
  const events = useQuery({
    queryKey: ['admin-sub-events'],
    queryFn: async () => unwrap(await supabase.from('subscription_events').select('*, organization:organizations(name)').order('created_at', { ascending: false }).limit(50)) as unknown as Ev[],
  })
  const edit = (p: Plan) => setDraft({ code: p.code, name: p.name, price: p.price_monthly === null ? '' : String(p.price_monthly), props: p.max_properties === null ? '' : String(p.max_properties), units: p.max_units === null ? '' : String(p.max_units), members: p.max_members === null ? '' : String(p.max_members), active: p.is_active })
  const set = (k: keyof Draft, v: string | boolean) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  return (
    <div>
      <PageHeader title="Plans & billing" subtitle="Plan limits are enforced by the database. Leave a limit blank for unlimited, a price blank for 'Contact us'." actions={<Button onClick={() => setDraft(blank)}>New plan</Button>} />
      {plans.isLoading && <Spinner />}
      {plans.error && <ErrorBox error={plans.error} />}
      {plans.data && (
        <TableWrap>
          <thead><tr><Th>Plan</Th><Th>Price / mo</Th><Th>Properties</Th><Th>Units</Th><Th>Members</Th><Th>Active</Th><Th /></tr></thead>
          <tbody>{plans.data.map((p) => (
            <tr key={p.code}><Td><span className="font-medium">{p.name}</span> <span className="text-xs text-slate-500">({p.code})</span></Td><Td>{p.price_monthly ?? '-'}</Td><Td>{p.max_properties ?? '∞'}</Td><Td>{p.max_units ?? '∞'}</Td><Td>{p.max_members ?? '∞'}</Td><Td>{p.is_active ? 'Yes' : 'No'}</Td>
              <Td className="text-right"><button className="text-brand-600 hover:underline" onClick={() => edit(p)}>Edit</button></Td></tr>))}</tbody>
        </TableWrap>
      )}
      <h2 className="mb-2 mt-8 font-semibold">Subscription history</h2>
      <p className="mb-2 text-sm text-slate-500">Manual adjustments are labelled separately from provider payments. No payment provider is connected, so none appear here.</p>
      {events.isLoading && <Spinner />}
      {events.error && <ErrorBox error={events.error} />}
      {events.data && (
        <TableWrap>
          <thead><tr><Th>When</Th><Th>Organization</Th><Th>Change</Th><Th>Source</Th><Th>Reason</Th></tr></thead>
          <tbody>{events.data.map((e) => (
            <tr key={e.id}><Td>{fmtDateTime(e.created_at)}</Td><Td>{e.organization?.name}</Td><Td>{label(e.event_type)}: {e.from_plan ?? '-'} → {e.to_plan ?? '-'} ({e.from_status ?? '-'} → {e.to_status ?? '-'})</Td><Td><Badge tone={e.source === 'manual_admin' ? 'amber' : 'gray'}>{label(e.source)}</Badge></Td><Td>{e.reason ?? '-'}</Td></tr>))}</tbody>
        </TableWrap>
      )}
      <ReasonDialog open={!!draft} title={draft?.code && plans.data?.some((p) => p.code === draft.code) ? 'Edit plan' : 'New plan'} confirmLabel="Save plan"
        extra={draft && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code" hint="lowercase letters, numbers, _">{(id) => <Input id={id} value={draft.code} onChange={(e) => set('code', e.target.value.toLowerCase())} />}</Field>
            <Field label="Name">{(id) => <Input id={id} value={draft.name} onChange={(e) => set('name', e.target.value)} />}</Field>
            <Field label="Price / month">{(id) => <Input id={id} type="number" step="0.01" value={draft.price} onChange={(e) => set('price', e.target.value)} />}</Field>
            <Field label="Max properties">{(id) => <Input id={id} type="number" value={draft.props} onChange={(e) => set('props', e.target.value)} />}</Field>
            <Field label="Max units">{(id) => <Input id={id} type="number" value={draft.units} onChange={(e) => set('units', e.target.value)} />}</Field>
            <Field label="Max members">{(id) => <Input id={id} type="number" value={draft.members} onChange={(e) => set('members', e.target.value)} />}</Field>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(e) => set('active', e.target.checked)} /> Visible and available</label>
          </div>)}
        onConfirm={async (reason) => {
          unwrap(await supabase.rpc('admin_upsert_plan', { p_code: draft!.code, p_name: draft!.name, p_price: nz(draft!.price), p_max_properties: nz(draft!.props), p_max_units: nz(draft!.units), p_max_members: nz(draft!.members), p_is_active: draft!.active, p_reason: reason }))
          qc.invalidateQueries({ queryKey: ['admin-plans-all'] }); qc.invalidateQueries({ queryKey: ['public-plans'] })
        }}
        onClose={() => setDraft(null)} />
      <Card className="mt-6 text-sm text-slate-600">To change one organization's plan, open Organizations and use "Change plan".</Card>
    </div>
  )
}
