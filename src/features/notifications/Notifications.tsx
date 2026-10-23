import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Button, Empty, ErrorBox, PageHeader, Spinner } from '../../components/ui'
import { fmtDateTime } from '../../lib/format'
import type { Notification } from '../../lib/types'

export default function Notifications() {
  const qc = useQueryClient()
  const q = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => unwrap(await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100)) as Notification[],
  })
  const mark = useMutation({
    mutationFn: async (ids: string[]) => unwrap(await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const unread = (q.data ?? []).filter((n) => !n.read_at)
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Rent due, overdue rent and lease expiry alerts are created by a daily job." actions={unread.length > 0 && <Button variant="secondary" loading={mark.isPending} onClick={() => mark.mutate(unread.map((n) => n.id))}>Mark all read</Button>} />
      {q.isLoading && <Spinner />}
      {q.error && <ErrorBox error={q.error} onRetry={() => q.refetch()} />}
      {q.data && q.data.length === 0 && <Empty title="No notifications" hint="You're all caught up." />}
      <ul className="space-y-2">
        {q.data?.map((n) => (
          <li key={n.id} className={`rounded-lg border p-3 ${n.read_at ? 'border-slate-200 bg-white' : 'border-brand-100 bg-brand-50'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{n.title}</p>
                {n.body && <p className="text-sm text-slate-600">{n.body}</p>}
                <p className="mt-1 text-xs text-slate-500">{fmtDateTime(n.created_at)}</p>
              </div>
              <div className="flex shrink-0 gap-3 text-sm">
                {n.link && <Link className="text-brand-600 underline" to={n.link}>View</Link>}
                {!n.read_at && <button className="text-slate-600 underline" onClick={() => mark.mutate([n.id])}>Mark read</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
