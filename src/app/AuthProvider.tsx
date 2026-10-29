import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Membership, OrgRole, Organization, PlatformRole, Profile } from '../lib/types'

interface AuthCtx {
  session: Session | null
  loading: boolean
  loadError: string | null
  profile: Profile | null
  memberships: Membership[]
  org: Organization | null
  role: OrgRole | null
  setOrgId: (id: string) => void
  platformRole: PlatformRole | null
  tenantPortalEnabled: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)
const ORG_KEY = 'rentora.org'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const qc = useQueryClient()
  const lastUid = useRef<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [orgId, setOrgIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(ORG_KEY) } catch { return null }
  })
  const [platformRole, setPlatformRole] = useState<PlatformRole | null>(null)
  const [tenantPortalEnabled, setTenantPortalEnabled] = useState(true)

  const load = useCallback(async (s: Session | null) => {
    const nextUid = s?.user.id ?? null
    if (lastUid.current !== nextUid) {
      // Different person (or signed out): drop every cached query so nothing from the previous account can show.
      if (lastUid.current !== null || nextUid === null) qc.clear()
      lastUid.current = nextUid
    }
    if (!s) {
      setProfile(null); setMemberships([]); setPlatformRole(null); setLoadError(null)
      return
    }
    const uid = s.user.id
    const [p, m, pr, fl] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, status, notify_in_app').eq('id', uid).maybeSingle(),
      supabase.from('organization_members').select('role, organization:organizations(id, name, currency, timezone, status)').eq('user_id', uid).eq('status', 'active'),
      supabase.rpc('platform_role'),
      supabase.from('feature_flags').select('key, enabled').eq('key', 'tenant_portal').maybeSingle(),
    ])
    if (p.error || m.error || pr.error || fl.error) {
      // A failed request is not the same as "no workspaces": keep prior state and tell the guards.
      // In particular, never route a user to onboarding merely because membership lookup failed.
      const firstError = [p.error, m.error, pr.error, fl.error].find(Boolean)
      console.error('Auth context load failed', firstError?.message ?? 'unknown account-context error')
      setLoadError('We could not load your account. Check your connection and try again.')
      return
    }
    setLoadError(null)
    setProfile((p.data as Profile | null) ?? null)
    const rows = ((m.data ?? []) as any[])
      .map((r) => ({ role: r.role as OrgRole, organization: (Array.isArray(r.organization) ? r.organization[0] : r.organization) as Organization }))
      .filter((r) => r.organization)
    setMemberships(rows)
    if (!pr.error) setPlatformRole((pr.data as PlatformRole | null) ?? null)
    if (fl.data) setTenantPortalEnabled(Boolean((fl.data as any).enabled))
  }, [qc])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await load(data.session)
    }).catch((error: unknown) => {
      console.error('Session initialization failed', error)
      if (active) setLoadError('We could not restore your session. Check your connection and try again.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      // Defer: never call other supabase methods synchronously inside this callback.
      setTimeout(() => { void load(s).catch((error: unknown) => console.error('Auth state refresh failed', error)) }, 0)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [load])

  const org = useMemo(() => {
    if (!memberships.length) return null
    return (memberships.find((m) => m.organization.id === orgId) ?? memberships[0]).organization
  }, [memberships, orgId])
  const role = useMemo(() => memberships.find((m) => m.organization.id === org?.id)?.role ?? null, [memberships, org])

  const value: AuthCtx = {
    session, loading, loadError, profile, memberships, org, role, platformRole, tenantPortalEnabled,
    setOrgId: (id) => { setOrgIdState(id); try { localStorage.setItem(ORG_KEY, id) } catch { /* storage unavailable */ } },
    refresh: async () => { const { data } = await supabase.auth.getSession(); await load(data.session) },
    signOut: async () => { await supabase.auth.signOut(); qc.clear(); setMemberships([]); setProfile(null); setPlatformRole(null); setOrgIdState(null); try { localStorage.removeItem(ORG_KEY) } catch { /* storage unavailable */ } },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
