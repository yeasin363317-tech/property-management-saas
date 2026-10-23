import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Badge, Button, Empty, ErrorBox, Input, PageHeader, Pager, Spinner, Td, TableWrap, Th, statusTone } from '../../components/ui'
import { fmtDate, label } from '../../lib/format'
import { ReasonDialog } from './shared'

interface U { id: string; email: string; full_name: string | null; status: string; created_at: string; last_sign_in_at: string | null; org_count: number; platform_role: string | null; total_count: number }
const PAGE = 25

export default function AdminUsers() {
  const { platformRole, session } = useAuth()
  const qc = useQueryClient()
  const [page, setPage] = useState(0)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<U | null>(null)
  const [force, setForce] = useState(false)
  const canAct = platformRole === 'super_admin' || platformRole === 'support_admin'
  const q = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: async () => unwrap(await supabase.rpc('admin_list_users', { p_search: search || null, p_limit: PAGE, p_offset: page * PAGE })) as U[],
  })
  const total = q.data?.[0]?.total_count ?? 0
  const next = target?.status === 'active' ? 'suspended' : 'active'
  return (
    <div>
      <PageHeader title="Users" subtitle={platformRole === 'super_admin' ? 'Search by name or email.' : 'Search by name. Emails are partly hidden for your role.'} />
      <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch(input.trim()); setPage(0) }}>
        <Input aria-label="Search users" className="max-w-xs" placeholder="Search" value={input} onChange={(e) => setInput(e.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <Empty title="No users found" />}
      {q.data && q.data.length > 0 && (
        <>
          <TableWrap>
            <thead><tr><Th>User</Th><Th>Status</Th><Th>Orgs</Th><Th>Platform role</Th><Th>Joined</Th><Th>Last sign-in</Th><Th /></tr></thead>
            <tbody>{q.data.map((u) => (
              <tr key={u.id}>
                <Td><span className="font-medium">{u.full_name ?? 'Unnamed'}</span><br /><span className="text-xs text-slate-500">{u.email}</span></Td>
                <Td><Badge tone={statusTone(u.status)}>{label(u.status)}</Badge></Td>
                <Td>{u.org_count}</Td>
                <Td>{u.platform_role ? label(u.platform_role) : '-'}</Td>
                <Td>{fmtDate(u.created_at)}</Td>
                <Td>{fmtDate(u.last_sign_in_at)}</Td>
                <Td className="text-right">{canAct && u.id !== session?.user.id && !u.platform_role && (
                  <button className={u.status === 'active' ? 'text-red-600 hover:underline' : 'text-brand-600 hover:underline'} onClick={() => { setForce(false); setTarget(u) }}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button>)}</Td>
              </tr>))}</tbody>
          </TableWrap>
          <Pager page={page} pageSize={PAGE} total={total} onPage={setPage} />
        </>
      )}
      <ReasonDialog
        open={!!target} danger={next === 'suspended'} title={next === 'suspended' ? 'Suspend account' : 'Reactivate account'}
        description={next === 'suspended' ? 'The user will lose access immediately. Their data is kept.' : 'The user will regain access.'}
        confirmLabel={next === 'suspended' ? 'Suspend' : 'Reactivate'}
        extra={next === 'suspended' ? <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={force} onChange={(e) => setForce(e.target.checked)} />I understand: proceed even if this user is the only owner of an organization.</label> : undefined}
        onConfirm={async (reason) => { unwrap(await supabase.rpc('admin_set_user_status', { p_user: target!.id, p_status: next, p_reason: reason, p_force: force })); qc.invalidateQueries({ queryKey: ['admin-users'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) }}
        onClose={() => setTarget(null)}
      />
    </div>
  )
}
