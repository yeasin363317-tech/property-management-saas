import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { ROLE_LABEL } from '../../lib/permissions'
import { Badge, Button, Card, ConfirmDialog, ErrorBox, Field, Input, PageHeader, Select, Spinner, Td, TableWrap, Th } from '../../components/ui'
import { errMsg, fmtDate } from '../../lib/format'
import type { OrgRole } from '../../lib/types'
import { inviteLink, inviteMessage } from '../../lib/invite'

const ROLE_HINT: Record<string, string> = {
  tenant: 'Tenant: sees only their own lease, rent and requests in the tenant portal.',
  property_manager: 'Staff: sees the full landlord workspace.',
  accountant: 'Staff: sees the landlord workspace finance screens.',
  maintenance: 'Staff: sees maintenance work.',
}

interface Member { id: string; user_id: string; role: OrgRole; created_at: string; name: string }
interface Invite { id: string; email: string; role: string; token: string; status: string; expires_at: string }

export default function Team() {
  const { org, session } = useAuth()
  const qc = useQueryClient()
  const [err, setErr] = useState<string | null>(null)
  const [sp] = useSearchParams()
  const [email, setEmail] = useState(sp.get('email') ?? '')
  const [role, setRole] = useState(sp.get('tenant') ? 'tenant' : 'property_manager')
  const [tenantId, setTenantId] = useState(sp.get('tenant') ?? '')
  const [created, setCreated] = useState<{ token: string; email: string; role: string } | null>(null)
  const [remove, setRemove] = useState<Member | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const members = useQuery({
    queryKey: ['members', org?.id], enabled: !!org,
    queryFn: async () => {
      const m = unwrap(await supabase.from('organization_members').select('id, user_id, role, created_at').eq('organization_id', org!.id).eq('status', 'active').order('created_at')) as Omit<Member, 'name'>[]
      const p = unwrap(await supabase.from('profiles').select('id, full_name').in('id', m.map((x) => x.user_id))) as { id: string; full_name: string | null }[]
      return m.map((x) => ({ ...x, name: p.find((y) => y.id === x.user_id)?.full_name ?? 'Unnamed user' })) as Member[]
    },
  })
  const invites = useQuery({
    queryKey: ['invites', org?.id], enabled: !!org,
    queryFn: async () => unwrap(await supabase.from('invitations').select('id, email, role, token, status, expires_at').eq('organization_id', org!.id).eq('status', 'pending').order('created_at', { ascending: false })) as Invite[],
  })
  const tenants = useQuery({
    queryKey: ['invite-tenants', org?.id], enabled: !!org && role === 'tenant',
    queryFn: async () => unwrap(await supabase.from('tenants').select('id, full_name, email').eq('organization_id', org!.id).is('user_id', null).neq('status', 'archived').order('full_name')) as { id: string; full_name: string; email: string | null }[],
  })

  const invite = useMutation({
    mutationFn: async () => {
      if (role === 'tenant' && !tenantId) throw new Error('Choose which tenant record this invitation is for.')
      return unwrap(await supabase.from('invitations').insert({ organization_id: org!.id, email: email.trim().toLowerCase(), role, tenant_id: role === 'tenant' ? tenantId : null, invited_by: session!.user.id }).select('token, email, role').single()) as { token: string; email: string; role: string }
    },
    onSuccess: (row) => { setCreated(row); setEmail(''); setTenantId(''); qc.invalidateQueries({ queryKey: ['invites'] }) },
    onError: (e) => setErr(errMsg(e)),
  })
  const revoke = useMutation({
    mutationFn: async (id: string) => unwrap(await supabase.from('invitations').update({ status: 'revoked' }).eq('id', id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })
  const changeRole = useMutation({
    mutationFn: async (v: { id: string; role: string }) => unwrap(await supabase.from('organization_members').update({ role: v.role }).eq('id', v.id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members'] }),
    onError: (e) => setErr(errMsg(e)),
  })
  const drop = useMutation({
    mutationFn: async (m: Member) => unwrap(await supabase.from('organization_members').update({ status: 'removed' }).eq('id', m.id)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members'] }); setRemove(null) },
    onError: (e) => { setErr(errMsg(e)); setRemove(null) },
  })
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); setCopied(t) } catch { setCopied(null) } }

  return (
    <div>
      <PageHeader title="Team" subtitle="Invite people and control what they can do." />
      {err && <div className="mb-3"><ErrorBox error={err} /></div>}
      <Card className="mb-5">
        <h2 className="font-semibold">Invite someone</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Role" hint={ROLE_HINT[role]}>{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value)}>{(['tenant', 'property_manager', 'accountant', 'maintenance'] as OrgRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select>}</Field>
          {role === 'tenant' && <Field label="Tenant record">{(id) => <Select id={id} value={tenantId} onChange={(e) => { setTenantId(e.target.value); const t = tenants.data?.find((x) => x.id === e.target.value); if (t?.email && !email) setEmail(t.email) }}><option value="">Select tenant</option>{tenants.data?.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</Select>}</Field>}
        </div>
        <Button className="mt-3" loading={invite.isPending} disabled={!email} onClick={() => { setErr(null); invite.mutate() }}>Create invitation</Button>
        <p className="mt-2 text-xs text-slate-500">Rentora does not send emails. After creating an invitation, share the link below with the person yourself. They sign up with this same email and the invitation is accepted automatically. Codes expire after 7 days.</p>
      </Card>
      {created && (
        <Card className="mb-5 border-brand-200 bg-brand-50">
          <h2 className="font-semibold text-brand-900">Invitation created for {created.email}</h2>
          <p className="mt-1 text-sm text-slate-700">Send this to them now. They must sign up with <b>{created.email}</b>.</p>
          <code className="mt-2 block break-all rounded-lg bg-white p-2 text-xs">{inviteLink(created.token, created.email)}</code>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => copy(inviteLink(created.token, created.email))}>{copied === inviteLink(created.token, created.email) ? 'Link copied' : 'Copy link'}</Button>
            <Button variant="secondary" onClick={() => copy(inviteMessage(created.token, created.email))}>{copied === inviteMessage(created.token, created.email) ? 'Message copied' : 'Copy message'}</Button>
            <a className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(inviteMessage(created.token, created.email))}`}>WhatsApp</a>
            <a className="inline-flex min-h-[40px] items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium" href={`mailto:${created.email}?subject=${encodeURIComponent('Your Rentora invitation')}&body=${encodeURIComponent(inviteMessage(created.token, created.email))}`}>Open email app</a>
          </div>
        </Card>
      )}

      <h2 className="mb-2 font-semibold">Pending invitations</h2>
      {invites.isLoading && <Spinner />}
      {invites.data?.length === 0 && <p className="mb-5 text-sm text-slate-500">None.</p>}
      {invites.data && invites.data.length > 0 && (
        <div className="mb-5"><TableWrap>
          <thead><tr><Th>Email</Th><Th>Role</Th><Th>Expires</Th><Th>Code</Th><Th /></tr></thead>
          <tbody>{invites.data.map((i) => (
            <tr key={i.id}><Td>{i.email}</Td><Td>{ROLE_LABEL[i.role as OrgRole]}</Td><Td>{fmtDate(i.expires_at)}</Td>
              <Td><code className="text-xs">{i.token}</code> <button className="ml-1 text-brand-700 underline" onClick={() => copy(i.token)}>{copied === i.token ? 'Copied' : 'Copy code'}</button> <button className="ml-1 text-brand-700 underline" onClick={() => copy(inviteLink(i.token, i.email))}>{copied === inviteLink(i.token, i.email) ? 'Copied' : 'Copy link'}</button></Td>
              <Td className="text-right"><button className="text-red-600 hover:underline" onClick={() => revoke.mutate(i.id)}>Revoke</button></Td></tr>))}</tbody>
        </TableWrap></div>
      )}

      <h2 className="mb-2 font-semibold">Members</h2>
      {members.isLoading && <Spinner />}
      {members.error && <ErrorBox error={members.error} />}
      {members.data && (
        <TableWrap>
          <thead><tr><Th>Name</Th><Th>Role</Th><Th>Joined</Th><Th /></tr></thead>
          <tbody>{members.data.map((m) => {
            const me = m.user_id === session?.user.id
            return (
              <tr key={m.id}>
                <Td className="font-medium">{m.name} {me && <Badge>You</Badge>}</Td>
                <Td>{me ? ROLE_LABEL[m.role] : (
                  <Select aria-label={`Role for ${m.name}`} value={m.role} onChange={(e) => { setErr(null); changeRole.mutate({ id: m.id, role: e.target.value }) }}>
                    {(Object.keys(ROLE_LABEL) as OrgRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </Select>)}</Td>
                <Td>{fmtDate(m.created_at)}</Td>
                <Td className="text-right">{!me && <button className="text-red-600 hover:underline" onClick={() => setRemove(m)}>Remove</button>}</Td>
              </tr>)
          })}</tbody>
        </TableWrap>
      )}
      <ConfirmDialog open={!!remove} danger title="Remove member?" message={`${remove?.name} will lose access to this workspace. Their past activity stays in the records.`} confirmLabel="Remove" loading={drop.isPending} onConfirm={() => remove && drop.mutate(remove)} onClose={() => setRemove(null)} />
    </div>
  )
}
