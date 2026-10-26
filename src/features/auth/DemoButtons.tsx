import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../app/AuthProvider'
import { DEMO_LANDLORD, DEMO_PASSWORD, DEMO_TENANT, demoConfigured } from '../../lib/demo'

export default function DemoButtons({ className = '' }: { className?: string }) {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (!demoConfigured) return null

  const go = async (email: string, to: string) => {
    setErr(null); setBusy(email)
    await supabase.auth.signOut()
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD })
    if (error) { setBusy(null); return setErr('The demo is not available right now. Please try again later.') }
    await refresh()
    nav(to, { replace: true })
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        <button disabled={!!busy} onClick={() => go(DEMO_LANDLORD, '/app')} className="min-h-[44px] rounded-lg border border-brand-600 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
          {busy === DEMO_LANDLORD ? 'Opening demo...' : 'Try demo as landlord'}
        </button>
        <button disabled={!!busy} onClick={() => go(DEMO_TENANT, '/portal')} className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {busy === DEMO_TENANT ? 'Opening demo...' : 'Try demo as tenant'}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">No signup needed. Sample data only; it is reset from time to time.</p>
      {err && <p role="alert" className="mt-1 text-xs font-medium text-red-700">{err}</p>}
    </div>
  )
}
