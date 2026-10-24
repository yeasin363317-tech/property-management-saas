import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase, unwrap } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { can } from '../../lib/permissions'
import { Button, Card, ErrorBox, Field, Input, PageHeader, Spinner } from '../../components/ui'
import { errMsg, label } from '../../lib/format'
import { passwordSchema } from '../../lib/formSchemas'
import type { Plan } from '../../lib/types'

function ProfileCard() {
  const { profile, refresh, session } = useAuth()
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<{ full_name: string; phone: string; notify_in_app: boolean }>({
    resolver: zodResolver(z.object({ full_name: z.string().min(2, 'Enter your name').max(120), phone: z.string().max(30), notify_in_app: z.boolean() })),
    values: { full_name: profile?.full_name ?? '', phone: profile?.phone ?? '', notify_in_app: profile?.notify_in_app ?? true },
  })
  const submit = f.handleSubmit(async (v) => {
    setErr(null); setMsg(null)
    const { error } = await supabase.from('profiles').update({ full_name: v.full_name, phone: v.phone || null, notify_in_app: v.notify_in_app }).eq('id', session!.user.id)
    if (error) return setErr(error.message)
    await refresh(); setMsg('Saved.')
  })
  return (
    <Card>
      <h2 className="font-semibold">Your profile</h2>
      <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
        {err && <ErrorBox error={err} />}{msg && <p role="status" className="text-sm text-green-700">{msg}</p>}
        <p className="text-sm text-slate-600">Email: {session?.user.email}</p>
        <Field label="Full name" error={f.formState.errors.full_name?.message}>{(id) => <Input id={id} {...f.register('full_name')} />}</Field>
        <Field label="Phone">{(id) => <Input id={id} {...f.register('phone')} />}</Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...f.register('notify_in_app')} /> Receive in-app notifications</label>
        <Button type="submit" loading={f.formState.isSubmitting}>Save profile</Button>
      </form>
    </Card>
  )
}

function PasswordCard() {
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<{ password: string }>({ resolver: zodResolver(z.object({ password: passwordSchema })) })
  const submit = f.handleSubmit(async (v) => {
    setErr(null); setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) return setErr(error.message)
    f.reset(); setMsg('Password updated.')
  })
  return (
    <Card>
      <h2 className="font-semibold">Change password</h2>
      <form onSubmit={submit} className="mt-3 space-y-3" noValidate>
        {err && <ErrorBox error={err} />}{msg && <p role="status" className="text-sm text-green-700">{msg}</p>}
        <Field label="New password" error={f.formState.errors.password?.message}>{(id) => <Input id={id} type="password" autoComplete="new-password" {...f.register('password')} />}</Field>
        <Button type="submit" loading={f.formState.isSubmitting}>Update password</Button>
      </form>
    </Card>
  )
}

function OrgCard() {
  const { org, role, refresh } = useAuth()
  const qc = useQueryClient()
  const editable = can.editOrg(role)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const f = useForm<{ name: string; currency: string; timezone: string }>({
    resolver: zodResolver(z.object({ name: z.string().min(2).max(120), currency: z.string().regex(/^[A-Za-z]{3}$/, '3-letter code'), timezone: z.string().min(1) })),
    values: { name: org?.name ?? '', currency: org?.currency ?? 'BDT', timezone: org?.timezone ?? 'Asia/Dhaka' },
  })
  const m = useMutation({
    mutationFn: async (v: { name: string; currency: string; timezone: string }) => unwrap(await supabase.from('organizations').update({ name: v.name, currency: v.currency.toUpperCase(), timezone: v.timezone }).eq('id', org!.id)),
    onSuccess: async () => { await refresh(); qc.invalidateQueries(); setMsg('Saved.') },
    onError: (e) => setErr(errMsg(e)),
  })
  const plan = useQuery({
    queryKey: ['my-plan', org?.id], enabled: !!org,
    queryFn: async () => {
      const s = unwrap(await supabase.from('subscriptions').select('plan_code, status').eq('organization_id', org!.id).maybeSingle()) as { plan_code: string; status: string } | null
      if (!s) return null
      const p = unwrap(await supabase.from('plans').select('*').eq('code', s.plan_code).maybeSingle()) as Plan | null
      return { s, p }
    },
  })
  return (
    <Card>
      <h2 className="font-semibold">Workspace</h2>
      <form onSubmit={f.handleSubmit((v) => { setErr(null); setMsg(null); m.mutate(v) })} className="mt-3 space-y-3" noValidate>
        {err && <ErrorBox error={err} />}{msg && <p role="status" className="text-sm text-green-700">{msg}</p>}
        <Field label="Name" error={f.formState.errors.name?.message}>{(id) => <Input id={id} disabled={!editable} {...f.register('name')} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Currency" error={f.formState.errors.currency?.message}>{(id) => <Input id={id} maxLength={3} disabled={!editable} {...f.register('currency')} />}</Field>
          <Field label="Timezone">{(id) => <Input id={id} disabled={!editable} {...f.register('timezone')} />}</Field>
        </div>
        {editable ? <Button type="submit" loading={m.isPending}>Save workspace</Button> : <p className="text-xs text-slate-500">Only the owner can edit workspace settings.</p>}
      </form>
      <div className="mt-5 border-t border-slate-200 pt-4 text-sm">
        <h3 className="font-medium">Plan</h3>
        {plan.isLoading && <Spinner />}
        {plan.data && <p className="mt-1 text-slate-600">{plan.data.p?.name ?? plan.data.s.plan_code} ({label(plan.data.s.status)}) · {plan.data.p?.max_properties ?? 'unlimited'} properties · {plan.data.p?.max_units ?? 'unlimited'} units · {plan.data.p?.max_members ?? 'unlimited'} team members</p>}
        <p className="mt-1 text-xs text-slate-500">To change plan, create a support ticket.</p>
      </div>
    </Card>
  )
}

export default function Settings() {
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2"><ProfileCard /><OrgCard /><PasswordCard /></div>
    </div>
  )
}
