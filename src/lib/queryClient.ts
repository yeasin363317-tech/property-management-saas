import { MutationCache, QueryClient } from '@tanstack/react-query'

/** Shared client factory (also used by tests). Any successful write refreshes dashboard numbers. */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    mutationCache: new MutationCache({ onSuccess: () => { void client.invalidateQueries({ queryKey: ['dashboard'] }) } }),
    defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 15_000 } },
  })
  return client
}
