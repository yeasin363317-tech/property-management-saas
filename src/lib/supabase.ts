import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** True when both public env vars are present. The app shows a setup screen otherwise. */
export const envOk = Boolean(url && key && url.startsWith('https://'))

// Only the public (publishable/anon) key is ever used in the browser.
export const supabase = createClient(url ?? 'https://invalid.local', key ?? 'invalid-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})

/** Throw a readable error if a Supabase response failed, otherwise return its data. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}
