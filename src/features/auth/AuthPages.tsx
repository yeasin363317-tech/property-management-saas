import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { Button, Card, ErrorBox, Field, Input } from '../../components/ui'
import { errMsg } from '../../lib/format'
import DemoButtons from './DemoButtons'
import { emailSchema, passwordSchema } from '../../lib/formSchemas'

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center p-4">
      <Link to="/" className="mb-4 text-center text-xl font-bold text-brand-700">Rentora</Link>
      <Card className="p-6">
        <h1 className="mb-4 text-lg font-semibold">{title}</h1>
        {children}
      </Card>
    </div>
  )
}

const pw = passwordSchema

export function Login() {
  const nav = useNavigate()
  const loc = useLocation()
  const { refresh } = useAuth()
  const [err, setErr] = useState<string | null>(null)
  const f = useForm<{ email: string; password: string }>({ resolver: zodResolver(z.object({ email: emailSchema, password: z.string().min(1, 'Enter your password') })) })
  const submit = f.handleSubmit(async (v) => {
    setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.password })
    if (error) return setErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message)
    await refresh()
    const from = (loc.state as { from?: string } | null)?.from
    nav(from && from !== '/login' ? from : '/app', { replace: true })
  })
  return (
    <Shell title="Log in">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <ErrorBox error={err} />}
        <Field label="Email" error={f.formState.errors.email?.message}>{(id) => <Input id={id} type="email" autoComplete="email" {...f.register('email')} />}</Field>
        <Field label="Password" error={f.formState.errors.password?.message}>{(id) => <Input id={id} type="password" autoComplete="current-password" {...f.register('password')} />}</Field>
        <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Log in</Button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-brand-600 underline">Forgot password?</Link>
          <Link to="/signup" className="text-brand-600 underline">Create account</Link>
        </div>
        <div className="border-t border-slate-200 pt-4"><p className="mb-2 text-sm font-medium text-slate-700">Just looking around?</p><DemoButtons /></div>
      </form>
    </Shell>
  )
}

export function Signup() {
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const nav = useNavigate()
  const { refresh } = useAuth()
  const schema = z.object({ full_name: z.string().min(2, 'Enter your name'), email: emailSchema, password: pw, agree: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }) })
  const f = useForm<{ full_name: string; email: string; password: string; agree: boolean }>({ resolver: zodResolver(schema) })
  const submit = f.handleSubmit(async (v) => {
    setErr(null)
    const { data, error } = await supabase.auth.signUp({ email: v.email, password: v.password, options: { data: { full_name: v.full_name }, emailRedirectTo: window.location.origin + '/login' } })
    if (error) return setErr(error.message)
    if (data.session) { await refresh(); nav('/onboarding', { replace: true }) } else setSent(true)
  })
  if (sent) return <Shell title="Check your email"><p className="text-sm text-slate-700">We sent a confirmation link to your email. Open it, then come back and <Link className="text-brand-600 underline" to="/login">log in</Link>.</p></Shell>
  return (
    <Shell title="Create your account">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {err && <ErrorBox error={err} />}
        <Field label="Full name" error={f.formState.errors.full_name?.message}>{(id) => <Input id={id} autoComplete="name" {...f.register('full_name')} />}</Field>
        <Field label="Email" error={f.formState.errors.email?.message}>{(id) => <Input id={id} type="email" autoComplete="email" {...f.register('email')} />}</Field>
        <Field label="Password" hint="At least 8 characters" error={f.formState.errors.password?.message}>{(id) => <Input id={id} type="password" autoComplete="new-password" {...f.register('password')} />}</Field>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-1" {...f.register('agree')} />
          <span>I agree to the <Link to="/terms" target="_blank" className="text-brand-600 underline">Terms</Link> and <Link to="/privacy" target="_blank" className="text-brand-600 underline">Privacy Policy</Link></span>
        </label>
        {f.formState.errors.agree && <p role="alert" className="text-xs text-red-600">{f.formState.errors.agree.message}</p>}
        <Button type="submit" className="w-full" loading={f.formState.isSubmitting}>Sign up</Button>
        <p className="text-center text-sm">Already have an account? <Link to="/login" className="text-brand-600 underline">Log in</Link></p>
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
      <p className="mt-4 text-center text-sm"><Link to="/login" className="text-brand-600 underline">Back to log in</Link></p>
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
