import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, unwrap } from '../../lib/supabase'
import { Badge, Button, Card, ErrorBox, Input, PageHeader, Spinner, Td, TableWrap, Th, statusTone } from '../../components/ui'
import { errMsg, fmtDateTime, label } from '../../lib/format'
import { ReasonDialog } from './shared'

interface Flag { key: string; description: string | null; enabled: boolean }
interface Job { id: number; job_name: string; status: string; detail: string | null; started_at: string; finished_at: string | null }

export default function AdminOps() {
  const qc = useQueryClient()
  const [flag, setFlag] = useState<Flag | null>(null)
  const [editEmail, setEditEmail] = useState(false)
  const [email, setEmail] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const flags = useQuery({ queryKey: ['admin-flags'], queryFn: async () => unwrap(await supabase.from('feature_flags').select('*').order('key')) as Flag[] })
  const jobs = useQuery({ queryKey: ['admin-jobs'], queryFn: async () => unwrap(await supabase.from('job_runs').select('*').order('started_at', { ascending: false }).limit(20)) as Job[] })
  const setting = useQuery({ queryKey: ['support-email'], queryFn: async () => ((await supabase.from('platform_settings').select('value').eq('key', 'support_email').maybeSingle()).data?.value as string | undefined) ?? '' })
  const run = useMutation({
    mutationFn: async () => unwrap(await supabase.rpc('admin_run_daily_job')),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-jobs'] }); qc.invalidateQueries({ queryKey: ['admin-stats'] }) },
    onError: (e) => setErr(errMsg(e)),
  })
  return (
    <div className="space-y-6">
      <PageHeader title="Operations & flags" />
      {err && <ErrorBox error={err} />}
      <Card>
        <h2 className="font-semibold">Feature flags</h2>
        {flags.isLoading && <Spinner />}
        <ul className="mt-2 divide-y divide-slate-100">
          {flags.data?.map((f) => (
            <li key={f.key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div><p className="font-medium">{f.key} <Badge tone={f.enabled ? 'green' : 'gray'}>{f.enabled ? 'On' : 'Off'}</Badge></p><p className="text-slate-500">{f.description}</p></div>
              <Button variant="secondary" onClick={() => setFlag(f)}>{f.enabled ? 'Turn off' : 'Turn on'}</Button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">Turning off registration_open blocks new sign-ups. Turning off tenant_portal blocks new tenant invitations and hides the portal.</p>
      </Card>
      <Card>
        <h2 className="font-semibold">Public support email</h2>
        <p className="mt-1 text-sm text-slate-600">Shown in the landing page footer. Current: {setting.data || 'not set'}</p>
        <Button className="mt-2" variant="secondary" onClick={() => { setEmail(setting.data ?? ''); setEditEmail(true) }}>Change</Button>
      </Card>
      <Card>
        <div className="flex items-center justify-between"><h2 className="font-semibold">Scheduled job runs</h2><Button variant="secondary" loading={run.isPending} onClick={() => { setErr(null); run.mutate() }}>Run daily job now</Button></div>
        <p className="mt-1 text-sm text-slate-600">The daily job activates/ends leases and creates notifications without duplicates. Schedule it with pg_cron (see docs/OPERATIONS_AND_BACKUP.md); until scheduled it only runs when you press the button.</p>
        {jobs.isLoading && <Spinner />}
        {jobs.data?.length === 0 && <p className="mt-2 text-sm text-slate-500">No runs recorded yet.</p>}
        {jobs.data && jobs.data.length > 0 && (
          <div className="mt-3"><TableWrap><thead><tr><Th>Started</Th><Th>Status</Th><Th>Detail</Th></tr></thead>
            <tbody>{jobs.data.map((j) => <tr key={j.id}><Td>{fmtDateTime(j.started_at)}</Td><Td><Badge tone={statusTone(j.status === 'succeeded' ? 'completed' : j.status)}>{label(j.status)}</Badge></Td><Td>{j.detail ?? '-'}</Td></tr>)}</tbody></TableWrap></div>
        )}
      </Card>
      <Card><h2 className="font-semibold">Error monitoring</h2><p className="mt-1 text-sm text-slate-600">No error monitoring service is configured. Add one (for example Sentry) and link it here when ready.</p></Card>

      <ReasonDialog open={!!flag} title={`${flag?.enabled ? 'Turn off' : 'Turn on'} ${flag?.key ?? ''}`} confirmLabel="Apply" danger={!!flag?.enabled}
        onConfirm={async (reason) => { unwrap(await supabase.rpc('admin_set_flag', { p_key: flag!.key, p_enabled: !flag!.enabled, p_reason: reason })); qc.invalidateQueries({ queryKey: ['admin-flags'] }) }} onClose={() => setFlag(null)} />
      <ReasonDialog open={editEmail} title="Change public support email" confirmLabel="Save"
        extra={<Input aria-label="Support email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@yourdomain.com" />}
        onConfirm={async (reason) => { unwrap(await supabase.rpc('admin_set_setting', { p_key: 'support_email', p_value: email.trim(), p_reason: reason })); qc.invalidateQueries({ queryKey: ['support-email'] }) }} onClose={() => setEditEmail(false)} />
    </div>
  )
}
