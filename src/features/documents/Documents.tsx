import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Button, Card, ConfirmDialog, Empty, ErrorBox, Field, PageHeader, Select, Spinner, Td, TableWrap, Th } from '../../components/ui'
import { errMsg, fmtDate, label } from '../../lib/format'
import type { DocumentRow } from '../../lib/types'

const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const MAX = 10 * 1024 * 1024
const TYPES = ['property', 'tenant', 'lease', 'maintenance']

export default function Documents() {
  const { org, role, session } = useAuth()
  const qc = useQueryClient()
  const [type, setType] = useState('property')
  const [entity, setEntity] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [del, setDel] = useState<DocumentRow | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const opts = useQuery({
    queryKey: ['doc-entities', org?.id, type], enabled: !!org,
    queryFn: async (): Promise<{ id: string; label: string }[]> => {
      if (type === 'property') return (unwrap(await supabase.from('properties').select('id, name').eq('organization_id', org!.id).order('name')) as any[]).map((r) => ({ id: r.id, label: r.name }))
      if (type === 'tenant') return (unwrap(await supabase.from('tenants').select('id, full_name').eq('organization_id', org!.id).order('full_name')) as any[]).map((r) => ({ id: r.id, label: r.full_name }))
      if (type === 'lease') return (unwrap(await supabase.from('leases').select('id, start_date, tenant:tenants(full_name), unit:units(unit_number)').eq('organization_id', org!.id).order('start_date', { ascending: false })) as any[]).map((r) => ({ id: r.id, label: `${r.tenant?.full_name ?? ''} · ${r.unit?.unit_number ?? ''} (${r.start_date})` }))
      return (unwrap(await supabase.from('maintenance_requests').select('id, title').eq('organization_id', org!.id).order('created_at', { ascending: false })) as any[]).map((r) => ({ id: r.id, label: r.title }))
    },
  })
  const docs = useQuery({
    queryKey: ['documents', org?.id, type], enabled: !!org,
    queryFn: async () => unwrap(await supabase.from('documents').select('*').eq('organization_id', org!.id).eq('entity_type', type).order('created_at', { ascending: false }).limit(100)) as DocumentRow[],
  })
  const name = (id: string) => opts.data?.find((o) => o.id === id)?.label ?? id.slice(0, 8)

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!entity) throw new Error('Choose what this document belongs to first.')
      if (!ALLOWED.includes(file.type)) throw new Error('Only PDF, JPG, PNG or WEBP files are allowed.')
      if (file.size > MAX) throw new Error('File is too large. The limit is 10 MB.')
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
      const path = `${org!.id}/${type}/${entity}/${crypto.randomUUID()}-${safe}`
      const up = await supabase.storage.from('documents').upload(path, file, { contentType: file.type, upsert: false })
      if (up.error) throw new Error(up.error.message)
      const ins = await supabase.from('documents').insert({ organization_id: org!.id, storage_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size, entity_type: type, entity_id: entity, uploaded_by: session!.user.id })
      if (ins.error) { await supabase.storage.from('documents').remove([path]); throw new Error(ins.error.message) }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); if (fileRef.current) fileRef.current.value = '' },
    onError: (e) => setErr(errMsg(e)),
  })
  const download = async (d: DocumentRow) => {
    setErr(null)
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60)
    if (error || !data) return setErr(error?.message ?? 'Could not create a download link.')
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  const remove = useMutation({
    mutationFn: async (d: DocumentRow) => {
      unwrap(await supabase.from('documents').delete().eq('id', d.id))
      await supabase.storage.from('documents').remove([d.storage_path])
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); setDel(null) },
    onError: (e) => { setErr(errMsg(e)); setDel(null) },
  })

  return (
    <div>
      <PageHeader title="Documents" subtitle="Private files. Links to open a file expire after 60 seconds." />
      {err && <div className="mb-3"><ErrorBox error={err} /></div>}
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Belongs to">{(id) => <Select id={id} value={type} onChange={(e) => { setType(e.target.value); setEntity('') }}>{TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</Select>}</Field>
          <Field label="Record">{(id) => <Select id={id} value={entity} onChange={(e) => setEntity(e.target.value)}><option value="">Select...</option>{opts.data?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>}</Field>
          <Field label="File (PDF or image, max 10 MB)">{(id) => <input id={id} ref={fileRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setErr(null); upload.mutate(f) } }} />}</Field>
        </div>
        {upload.isPending && <p className="mt-2 text-sm text-slate-500">Uploading...</p>}
      </Card>
      {docs.isLoading && <Spinner />}
      {docs.error && <ErrorBox error={docs.error} onRetry={() => docs.refetch()} />}
      {docs.data && docs.data.length === 0 && <Empty title={`No ${type} documents yet`} />}
      {docs.data && docs.data.length > 0 && (
        <TableWrap>
          <thead><tr><Th>File</Th><Th>Belongs to</Th><Th>Size</Th><Th>Uploaded</Th><Th /></tr></thead>
          <tbody>
            {docs.data.map((d) => (
              <tr key={d.id}>
                <Td className="font-medium">{d.file_name}</Td><Td>{name(d.entity_id)}</Td><Td>{(d.size_bytes / 1024).toFixed(0)} KB</Td><Td>{fmtDate(d.created_at)}</Td>
                <Td className="text-right"><span className="space-x-2">
                  <button className="text-brand-600 hover:underline" onClick={() => download(d)}>Open</button>
                  {role && can.manageProperties(role) && <button className="text-red-600 hover:underline" onClick={() => setDel(d)}>Delete</button>}
                </span></Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
      <ConfirmDialog open={!!del} danger title="Delete document?" message="The file is permanently removed." confirmLabel="Delete" loading={remove.isPending} onConfirm={() => del && remove.mutate(del)} onClose={() => setDel(null)} />
    </div>
  )
}
