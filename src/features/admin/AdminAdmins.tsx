import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, Td, TableWrap, Th } from '../../components/ui'
import { errMsg, fmtDate, label } from '../../lib/format'
import { ReasonDialog } from './shared'

interface A { user_id: string; email: string; full_name: string | null; role: string; created_at: string }

export default function AdminAdmins() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('support_admin')
  const [err, setErr] = useState<string | null>(null)
  const [dlg, setDlg] = useState<{ userId: string; role: string | null; title: string } | null>(null)
  const admins = useQuery({ queryKey: ['admin-admins'], queryFn: async () => unwrap(await supabase.rpc('admin_list_admins')) as A[] })

  const grant = async () => {
    setErr(null)
    try {
      const id = unwrap(await supabase.rpc('admin_find_user_by_email', { p_email: email })) as string | null
      if (!id) return setErr('No registered user has that email.')
      setDlg({ userId: id, role, title: `Grant ${label(role)} to ${email}` })
    } catch (e) { setErr(errMsg(e)) }
  }
  return (
    <div>
      <PageHeader title="Admin roles" subtitle="Super Admin: everything. Support Admin: users, tickets, minimal data. Billing Admin: plans and subscriptions. You cannot change your own role." />
      {err && <div className="mb-3"><ErrorBox error={err} /></div>}
      <Card className="mb-5">
        <h2 className="font-semibold">Grant a platform role</h2>
        <p className="mt-1 text-xs text-slate-500">The person must already have a Rentora account. Consider turning on MFA for every privileged account in Supabase Auth.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="User email">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label="Role">{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value)}>{['support_admin', 'billing_admin', 'super_admin'].map((r) => <option key={r} value={r}>{label(r)}</option>)}</Select>}</Field>
          <div className="flex items-end"><Button disabled={!email} onClick={grant}>Continue</Button></div>
        </div>
      </Card>
      {admins.isLoading && <Spinner />}
      {admins.error && <ErrorBox error={admins.error} />}
      {admins.data && (
        <TableWrap><thead><tr><Th>Admin</Th><Th>Role</Th><Th>Since</Th><Th /></tr></thead>
          <tbody>{admins.data.map((a) => (
            <tr key={a.user_id}><Td><span className="font-medium">{a.full_name ?? 'Unnamed'}</span><br /><span className="text-xs text-slate-500">{a.email}</span></Td><Td>{label(a.role)}</Td><Td>{fmtDate(a.created_at)}</Td>
              <Td className="text-right">{a.user_id !== session?.user.id ? <button className="text-red-600 hover:underline" onClick={() => setDlg({ userId: a.user_id, role: null, title: `Remove admin role from ${a.email}` })}>Remove</button> : <span className="text-xs text-slate-400">You</span>}</Td></tr>))}</tbody></TableWrap>
      )}
      <ReasonDialog open={!!dlg} title={dlg?.title ?? ''} danger={dlg?.role === null} confirmLabel={dlg?.role === null ? 'Remove role' : 'Grant role'}
        onConfirm={async (reason) => { unwrap(await supabase.rpc('admin_set_platform_role', { p_user: dlg!.userId, p_role: dlg!.role, p_reason: reason })); setEmail(''); qc.invalidateQueries({ queryKey: ['admin-admins'] }) }} onClose={() => setDlg(null)} />
    </div>
  )
}
