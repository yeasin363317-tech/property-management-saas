import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Membership, OrgRole, Organization, PlatformRole, Profile } from '../lib/types'

interface AuthCtx {
  session: Session | null
  loading: boolean
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
  const [profile, setProfile] = useState<Profile | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [orgId, setOrgIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(ORG_KEY) } catch { return null }
  })
  const [platformRole, setPlatformRole] = useState<PlatformRole | null>(null)
  const [tenantPortalEnabled, setTenantPortalEnabled] = useState(true)

  const load = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null); setMemberships([]); setPlatformRole(null)
      return
    }
    const uid = s.user.id
    const [p, m, pr, fl] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, status, notify_in_app').eq('id', uid).maybeSingle(),
      supabase.from('organization_members').select('role, organization:organizations(id, name, currency, timezone, status)').eq('user_id', uid).eq('status', 'active'),
      supabase.rpc('platform_role'),
      supabase.from('feature_flags').select('key, enabled').eq('key', 'tenant_portal').maybeSingle(),
    ])
    setProfile((p.data as Profile | null) ?? null)
    const rows = ((m.data ?? []) as any[])
      .map((r) => ({ role: r.role as OrgRole, organization: (Array.isArray(r.organization) ? r.organization[0] : r.organization) as Organization }))
      .filter((r) => r.organization)
    setMemberships(rows)
    setPlatformRole((pr.data as PlatformRole | null) ?? null)
    if (fl.data) setTenantPortalEnabled(Boolean((fl.data as any).enabled))
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await load(data.session)
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      // Defer: never call other supabase methods synchronously inside this callback.
      setTimeout(() => { load(s) }, 0)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [load])

  const org = useMemo(() => {
    if (!memberships.length) return null
    return (memberships.find((m) => m.organization.id === orgId) ?? memberships[0]).organization
  }, [memberships, orgId])
  const role = useMemo(() => memberships.find((m) => m.organization.id === org?.id)?.role ?? null, [memberships, org])

  const value: AuthCtx = {
    session, loading, profile, memberships, org, role, platformRole, tenantPortalEnabled,
    setOrgId: (id) => { setOrgIdState(id); try { localStorage.setItem(ORG_KEY, id) } catch { /* storage unavailable */ } },
    refresh: async () => { const { data } = await supabase.auth.getSession(); await load(data.session) },
    signOut: async () => { await supabase.auth.signOut(); setMemberships([]); setProfile(null); setPlatformRole(null) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth must be used inside AuthProvider')
  return c
}
