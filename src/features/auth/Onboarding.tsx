import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, ErrorBox, Field, Input, Select } from '../../components/ui'
import { errMsg } from '../../lib/format'
import { clearPendingInvite, getPendingInvite } from '../../lib/invite'

const schema = z.object({
  name: z.string().min(2, 'Enter a workspace name').max(120),
  currency: z.string().regex(/^[A-Za-z]{3}$/, 'Use a 3-letter code, e.g. BDT'),
  timezone: z.string().min(1),
})
type V = z.infer<typeof schema>

export default function Onboarding() {
  const { memberships, refresh, setOrgId, signOut } = useAuth()
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)
  const pending = getPendingInvite()
  const [token, setToken] = useState(pending)
  const tried = useRef(false)
  const [invErr, setInvErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka'
  const f = useForm<V>({ resolver: zodResolver(schema), defaultValues: { name: '', currency: 'BDT', timezone: tz } })


  const submit = f.handleSubmit(async (v) => {
    setErr(null)
    const { data, error } = await supabase.rpc('create_organization', { p_name: v.name, p_currency: v.currency.toUpperCase(), p_timezone: v.timezone })
    if (error) return setErr(errMsg(error))
    await refresh()
    setOrgId(data as string)
    nav('/app', { replace: true })
  })

  const accept = async (code = token) => {
    setInvErr(null); setBusy(true)
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: code.trim() })
    setBusy(false)
    if (error) { clearPendingInvite(); return setInvErr(errMsg(error)) }
    clearPendingInvite()
    await refresh()
    setOrgId(data as string)
    nav('/app', { replace: true }) // RequireOrg sends tenant members on to /portal
  }

  // Accept a code that came in through an invitation link automatically, once.
  useEffect(() => {
    if (pending && !tried.current) { tried.current = true; accept(pending) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (memberships.length && !pending) return <Navigate to="/app" replace />

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pt-10">
      <h1 className="text-2xl font-bold">Welcome to Rentora</h1>
      {(busy || pending) && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">{busy ? 'Accepting your invitation...' : 'You have an invitation. Accept it below.'}</p>}
      <Card>
        <h2 className="font-semibold">Have an invitation?</h2>
        <p className="mt-1 text-sm text-slate-600">Tenants and team members: paste the invitation code you were given. Sign up with the same email the invitation was sent to.</p>
        {invErr && <div className="mt-2"><ErrorBox error={invErr} /></div>}
        <div className="mt-3 flex gap-2">
          <Input aria-label="Invitation code" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Invitation code" />
          <Button variant="secondary" loading={busy} disabled={!token.trim()} onClick={() => accept()}>Join</Button>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Create your workspace</h2>
        <p className="mt-1 text-sm text-slate-600">Only for landlords and property managers. Tenants should not create a workspace; use the invitation code above.</p>
        <form onSubmit={submit} className="mt-3 space-y-4" noValidate>
          {err && <ErrorBox error={err} />}
          <Field label="Workspace name" error={f.formState.errors.name?.message}>{(id) => <Input id={id} placeholder="e.g. Arafat Properties" {...f.register('name')} />}</Field>
          <Field label="Currency" error={f.formState.errors.currency?.message}>{(id) => <Input id={id} maxLength={3} {...f.register('currency')} />}</Field>
          <Field label="Timezone">{(id) => (
            <Select id={id} {...f.register('timezone')}>
              {Array.from(new Set([tz, 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC'])).map((z) => <option key={z}>{z}</option>)}
            </Select>
          )}</Field>
          <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Create workspace</Button>
        </form>
      </Card>
      <button className="text-sm text-slate-500 underline" onClick={() => signOut()}>Sign out</button>
    </div>
  )
}
