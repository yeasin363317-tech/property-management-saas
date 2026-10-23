import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Td, TableWrap, Th, numField, statusTone } from '../../components/ui'
import { errMsg, label, money } from '../../lib/format'
import type { Property, Unit } from '../../lib/types'
import { PropertyForm } from './Properties'

const schema = z.object({
  unit_number: z.string().min(1, 'Required').max(40),
  floor: z.string().max(20).optional(),
  unit_type: z.string().max(40).optional(),
  size_sqft: z.number().positive().optional(),
  bedrooms: z.number().int().min(0).max(50).optional(),
  bathrooms: z.number().min(0).max(50).optional(),
  expected_rent: z.number().min(0, 'Cannot be negative'),
  status: z.string(),
})
type V = z.infer<typeof schema>

function UnitForm({ open, onClose, property, initial }: { open: boolean; onClose: () => void; property: Property; initial?: Unit }) {
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<V>({
    resolver: zodResolver(schema),
    values: {
      unit_number: initial?.unit_number ?? '', floor: initial?.floor ?? '', unit_type: initial?.unit_type ?? '',
      size_sqft: initial?.size_sqft ?? undefined, bedrooms: initial?.bedrooms ?? undefined, bathrooms: initial?.bathrooms ?? undefined,
      expected_rent: initial?.expected_rent ?? 0, status: initial?.status ?? 'vacant',
    },
  })
  const occupied = initial?.status === 'occupied'
  const m = useMutation({
    mutationFn: async (v: V) => {
      const row: Record<string, unknown> = {
        unit_number: v.unit_number, floor: v.floor || null, unit_type: v.unit_type || null, size_sqft: v.size_sqft ?? null,
        bedrooms: v.bedrooms ?? null, bathrooms: v.bathrooms ?? null, expected_rent: v.expected_rent,
      }
      if (!occupied) row.status = v.status
      if (initial) unwrap(await supabase.from('units').update(row).eq('id', initial.id))
      else unwrap(await supabase.from('units').insert({ ...row, organization_id: property.organization_id, property_id: property.id }))
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['units', property.id] }); onClose() },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Edit unit' : 'Add unit'}>
      <form onSubmit={f.handleSubmit((v) => { setErr(null); m.mutate(v) })} className="grid grid-cols-2 gap-3" noValidate>
        {err && <div className="col-span-2"><ErrorBox error={err} /></div>}
        <Field label="Unit number" error={f.formState.errors.unit_number?.message}>{(id) => <Input id={id} {...f.register('unit_number')} />}</Field>
        <Field label="Floor">{(id) => <Input id={id} {...f.register('floor')} />}</Field>
        <Field label="Unit type">{(id) => <Input id={id} placeholder="e.g. 2BR flat" {...f.register('unit_type')} />}</Field>
        <Field label="Size (sq ft)">{(id) => <Input id={id} type="number" step="any" {...f.register('size_sqft', numField)} />}</Field>
        <Field label="Bedrooms">{(id) => <Input id={id} type="number" {...f.register('bedrooms', numField)} />}</Field>
        <Field label="Bathrooms">{(id) => <Input id={id} type="number" step="0.5" {...f.register('bathrooms', numField)} />}</Field>
        <Field label="Expected rent" error={f.formState.errors.expected_rent?.message}>{(id) => <Input id={id} type="number" step="0.01" {...f.register('expected_rent', numField)} />}</Field>
        <Field label="Status" hint={occupied ? 'Set automatically by the active lease' : 'Occupied is set by an active lease'}>
          {(id) => <Select id={id} disabled={occupied} {...f.register('status')}>{occupied ? <option value="occupied">Occupied</option> : ['vacant', 'reserved', 'unavailable'].map((s) => <option key={s} value={s}>{label(s)}</option>)}</Select>}
        </Field>
        <div className="col-span-2 flex justify-end gap-2"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" loading={m.isPending}>Save</Button></div>
      </form>
    </Modal>
  )
}

export default function PropertyDetail() {
  const { id } = useParams()
  const { role, org } = useAuth()
  const manage = can.manageProperties(role)
  const [editProp, setEditProp] = useState(false)
  const [unitOpen, setUnitOpen] = useState(false)
  const [unitEdit, setUnitEdit] = useState<Unit | undefined>()
  const p = useQuery({ queryKey: ['property', id], queryFn: async () => unwrap(await supabase.from('properties').select('*').eq('id', id!).maybeSingle()) as Property | null })
  const u = useQuery({ queryKey: ['units', id], queryFn: async () => unwrap(await supabase.from('units').select('*').eq('property_id', id!).order('unit_number')) as Unit[] })

  if (p.isLoading) return <Spinner />
  if (p.error) return <ErrorBox error={p.error} />
  if (!p.data) return <Empty title="Property not found" action={<Link className="text-brand-600 underline" to="/app/properties">Back to properties</Link>} />
  const prop = p.data
  return (
    <div>
      <Link to="/app/properties" className="text-sm text-brand-600 underline">← Properties</Link>
      <PageHeader title={prop.name} subtitle={`${prop.address_line}${prop.city ? ', ' + prop.city : ''}`} actions={manage && <Button variant="secondary" onClick={() => setEditProp(true)}>Edit property</Button>} />
      <Card className="mb-5">
        <p className="text-sm text-slate-600"><Badge tone={statusTone(prop.status)}>{label(prop.status)}</Badge> <span className="ml-2">{label(prop.property_type)}</span></p>
        {prop.description && <p className="mt-2 text-sm text-slate-700">{prop.description}</p>}
      </Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Units</h2>
        {manage && prop.status === 'active' && <Button onClick={() => { setUnitEdit(undefined); setUnitOpen(true) }}>Add unit</Button>}
      </div>
      {u.isLoading && <Spinner />}
      {u.error && <ErrorBox error={u.error} />}
      {u.data && u.data.length === 0 && <Empty title="No units yet" hint="Add the units or flats in this property." />}
      {u.data && u.data.length > 0 && (
        <TableWrap>
          <thead><tr><Th>Unit</Th><Th>Type</Th><Th>Beds/Baths</Th><Th>Expected rent</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>
            {u.data.map((x) => (
              <tr key={x.id}>
                <Td className="font-medium">{x.unit_number}{x.floor ? ` (floor ${x.floor})` : ''}</Td>
                <Td>{x.unit_type ?? '-'}</Td>
                <Td>{x.bedrooms ?? '-'} / {x.bathrooms ?? '-'}</Td>
                <Td>{money(x.expected_rent, org?.currency)}</Td>
                <Td><Badge tone={statusTone(x.status)}>{label(x.status)}</Badge></Td>
                <Td className="text-right">{manage && <button className="text-brand-600 hover:underline" onClick={() => { setUnitEdit(x); setUnitOpen(true) }}>Edit</button>}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <PropertyForm open={editProp} onClose={() => setEditProp(false)} initial={prop} />
      <UnitForm open={unitOpen} onClose={() => setUnitOpen(false)} property={prop} initial={unitEdit} />
    </div>
  )
}
