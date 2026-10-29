import { describe, it, expect, vi } from 'vitest'
import { createQueryClient } from '../lib/queryClient'

describe('query client', () => {
  it('refreshes dashboard queries after any successful mutation (RENT-F-001)', async () => {
    const qc = createQueryClient()
    const fn = vi.fn(async () => 1)
    await qc.fetchQuery({ queryKey: ['dashboard', 'org-1'], queryFn: fn })
    expect(fn).toHaveBeenCalledTimes(1)
    const m = qc.getMutationCache().build(qc, { mutationFn: async () => 'ok' })
    await m.execute(undefined)
    expect(qc.getQueryState(['dashboard', 'org-1'])?.isInvalidated).toBe(true)
  })

  it('clear() removes cached data of the previous identity (RENT-F-004)', async () => {
    const qc = createQueryClient()
    await qc.fetchQuery({ queryKey: ['portal', 'user-a'], queryFn: async () => ['A data'] })
    qc.clear()
    expect(qc.getQueryData(['portal', 'user-a'])).toBeUndefined()
  })
})
