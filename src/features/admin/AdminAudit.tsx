import { useQuery } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Empty, ErrorBox, PageHeader, Spinner, Td, TableWrap, Th } from '../../components/ui'
import { fmtDateTime, label } from '../../lib/format'

interface L { id: number; actor_id: string | null; action: string; target_type: string | null; target_id: string | null; outcome: string; reason: string | null; metadata: Record<string, unknown> | null; created_at: string }

export default function AdminAudit() {
  const q = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => unwrap(await supabase.from('audit_logs').select('*').eq('scope', 'platform').order('created_at', { ascending: false }).limit(200)) as L[],
  })
  return (
    <div>
      <PageHeader title="Audit log" subtitle="Platform administrator actions: who, what, target, when, outcome and reason. Entries cannot be edited from the app." />
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data?.length === 0 && <Empty title="No admin actions recorded yet" />}
      {q.data && q.data.length > 0 && (
        <TableWrap><thead><tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Outcome</Th><Th>Reason</Th></tr></thead>
          <tbody>{q.data.map((l) => (
            <tr key={l.id}><Td>{fmtDateTime(l.created_at)}</Td><Td className="font-mono text-xs">{l.actor_id?.slice(0, 8)}</Td><Td>{label(l.action)}</Td><Td className="text-xs">{l.target_type} {l.target_id?.slice(0, 12)}</Td><Td>{l.outcome}</Td><Td>{l.reason ?? '-'}</Td></tr>))}</tbody></TableWrap>
      )}
      <p className="mt-3 text-xs text-slate-500">Only successful actions are recorded: a refused or failed action is rolled back with its log entry.</p>
    </div>
  )
}
