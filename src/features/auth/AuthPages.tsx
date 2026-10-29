import { useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Button, ErrorBox, Field, Input } from '../../components/ui'
import { Logo } from '../../components/Logo'
import { getPendingInvite, isInviteToken, setPendingInvite } from '../../lib/invite'
import { errMsg } from '../../lib/format'
import DemoButtons from './DemoButtons'
import { emailSchema, passwordSchema } from '../../lib/formSchemas'

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full">
      <aside className="hidden w-[44%] max-w-xl flex-col justify-between bg-brand-700 p-10 text-white lg:flex">
        <Link to="/" aria-label="Rentora home"><Logo light /></Link>
        <div>
          <p className="text-3xl font-semibold leading-tight tracking-tight">Properties, tenants, leases and rent in one secure workspace.</p>
          <p className="mt-3 text-brand-100">Each workspace is isolated at the database level.</p>
        </div>
        <p className="text-xs text-brand-200">© {new Date().getFullYear()} Rentora</p>
      </aside>
      <main className="flex flex-1 flex-col justify-center px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" aria-label="Rentora home" className="mb-6 flex justify-center lg:hidden"><Logo /></Link>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
            <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

const pw = passwordSchema

/** Reads ?invite=<code>&email=<address> from an invitation link and remembers the code. */
function useInviteParams() {
  const [sp] = useSearchParams()
  const code = sp.get('invite') ?? ''
  const email = sp.get('email') ?? ''
  if (code && isInviteToken(code)) setPendingInvite(code.trim())
  return { invited: !!code && isInviteToken(code), email }
}

export function Login({ kind = 'landlord' }: { kind?: 'landlord' | 'tenant' }) {
  const isTenant = kind === 'tenant'
  const nav = useNavigate()
  const loc = useLocation()
  const { refresh } = useAuth()
  const { invited, email: invEmail } = useInviteParams()
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<{ email: string; password: string }>({ defaultValues: { email: invEmail }, resolver: zodResolver(z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') })) })
  const submit = f.handleSubmit(async (v) => {
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (error) return setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    // Keep landlord and tenant logins separate: check the account type before letting the user in.
    const uid = (await supabase.auth.getUser()).data.user?.id
    const { data: mem } = uid ? await supabase.from('organization_members').select('role').eq('user_id', uid).eq('status', 'active') : { data: [] as { role: string }[] | null }
    const roles = (mem ?? []).map((m) => m.role)
    const { data: pr } = await supabase.rpc('platform_role')
    if (roles.length > 0 && !pr) {
      const hasTenant = roles.includes('tenant')
      const hasStaff = roles.some((r) => r !== 'tenant')
      if (isTenant && hasStaff) { await supabase.auth.signOut(); return setErr('This is a landlord account. Please use the landlord login.') }
      if (!isTenant && hasTenant && !hasStaff) { await supabase.auth.signOut(); return setErr('This is a tenant account. Please use the tenant login.') }
    }
    await refresh()
    const from = (loc.state as { from?: string } | null)?.from
    const home = isTenant ? '/portal' : '/app'
    const own = '/' + (isTenant ? 'tenant-login' : 'login')
    nav(getPendingInvite() ? '/onboarding' : from && from !== own && from !== '/login' && from !== '/tenant-login' ? from : home, { replace: true })
  })
  return (
    <Shell title={isTenant ? 'Tenant login' : 'Landlord login'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {invited && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">You have an invitation. Log in with the invited email to accept it.</p>}
        {err && <ErrorBox error={err} />}
        <Field label="Email" error={f.formState.errors.email?.message}>{(id) => <Input id={id} type="email" autoComplete="email" {...f.register('email')} />}</Field>
        <Field label="Password" error={f.formState.errors.password?.message}>{(id) => <Input id={id} type="password" autoComplete="current-password" {...f.register('password')} />}</Field>
        <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Log in</Button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="font-medium text-brand-700 underline">Forgot password?</Link>
          {isTenant ? <span className="text-slate-500">Ask your landlord for an invite</span> : <Link to="/signup" className="font-medium text-brand-700 underline">Create account</Link>}
        </div>
        <p className="text-center text-sm text-slate-600">
          {isTenant ? <>Are you a landlord? <Link to="/login" className="font-medium text-brand-700 underline">Landlord login</Link></> : <>Are you a tenant? <Link to="/tenant-login" className="font-medium text-brand-700 underline">Tenant login</Link></>}
        </p>
        <div className="border-t border-slate-200 pt-4"><p className="mb-2 text-sm font-medium text-slate-700">Just looking around?</p><DemoButtons only={kind} /></div>
      </form>
    </Shell>
  )
}

export function Signup() {
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const nav = useNavigate()
  const { refresh } = useAuth()
  const { invited, email: invEmail } = useInviteParams()
  const schema = z.object({ full_name: z.string().min(2, 'Enter your name'), email: emailSchema, password: pw, agree: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }) })
  const f = useForm<{ full_name: string; email: string; password: string; agree: boolean }>({ defaultValues: { email: invEmail }, resolver: zodResolver(schema) })
  const submit = f.handleSubmit(async (v) => {
    setErr(null)
    const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.full_name }, emailRedirectTo: window.location.origin + '/login' } })
    if (error) return setErr(error.message)
    if (data.session) { await refresh(); nav('/onboarding', { replace: true }) } else setSent(true)
  })
  if (sent) return <Shell title="Check your email"><p className="text-sm text-slate-700" role="status">We sent a confirmation link to your email. Open it, then come back and <Link className="font-medium text-brand-700 underline" to="/login">log in</Link>.</p></Shell>
  return (
    <Shell title="Create your account">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {invited && <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-800">You have been invited. Sign up with the invited email address and your invitation will be accepted automatically.</p>}
        {err && <ErrorBox error={err} />}
        <Field label="Full name" error={f.formState.errors.full_name?.message}>{(id) => <Input id={id} autoComplete="name" {...f.register('full_name')} />}</Field>
        <Field label="Email" error={f.formState.errors.email?.message}>{(id) => <Input id={id} type="email" autoComplete="email" {...f.register('email')} />}</Field>
        <Field label="Password" hint="At least 8 characters" error={f.formState.errors.password?.message}>{(id) => <Input id={id} type="password" autoComplete="new-password" {...f.register('password')} />}</Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-300" {...f.register('agree')} />
          <span>I agree to the <Link to="/terms" target="_blank" className="font-medium text-brand-700 underline">Terms</Link> and <Link to="/privacy" target="_blank" className="font-medium text-brand-700 underline">Privacy Policy</Link></span>
        </label>
        {f.formState.errors.agree && <p role="alert" className="text-xs font-medium text-red-700">{f.formState.errors.agree.message}</p>}
        <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Sign up</Button>
        <p className="text-center text-sm">Already have an account? <Link to="/login" className="font-medium text-brand-700 underline">Log in</Link></p>
      </form>
    </Shell>
  )
}

export function Forgot() {
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<{ email: string }>({ resolver: zodResolver(z.object({ email: emailSchema })) })
  const submit = f.handleSubmit(async (v) => {
    setErr(null)
    const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: window.location.origin + '/reset-password' })
    if (error) setErr(error.message); else setDone(true)
  })
  return (
    <Shell title="Reset your password">
      {done ? <p className="text-sm text-slate-700">If an account exists for that email, a reset link is on its way.</p> : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          {err && <ErrorBox error={err} />}
          <Field label="Email" error={f.formState.errors.email?.message}>{(id) => <Input id={id} type="email" {...f.register('email')} />}</Field>
          <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Send reset link</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link to="/login" className="font-medium text-brand-700 underline">Back to log in</Link></p>
    </Shell>
  )
}

export function ResetPassword() {
  const nav = useNavigate()
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<{ password: string; confirm: string }>({
    resolver: zodResolver(z.object({ password: pw, confirm: z.string() }).refine((d) => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })),
  })
  const submit = f.handleSubmit(async (v) => {
    setErr(null)
    const { error } = await supabase.auth.updateUser({ password: v.password })
    if (error) setErr(error.message); else nav('/app', { replace: true })
  })
  return (
    <Shell title="Choose a new password">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <ErrorBox error={err} />}
        <Field label="New password" error={f.formState.errors.password?.message}>{(id) => <Input id={id} type="password" autoComplete="new-password" {...f.register('password')} />}</Field>
        <Field label="Confirm password" error={f.formState.errors.confirm?.message}>{(id) => <Input id={id} type="password" autoComplete="new-password" {...f.register('confirm')} />}</Field>
        <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Update password</Button>
        <p className="text-xs text-slate-500">Open this page from the reset link in your email.</p>
      </form>
    </Shell>
  )
}

export { errMsg }
