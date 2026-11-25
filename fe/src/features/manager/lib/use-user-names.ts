import { useQueries } from '@tanstack/react-query'
import { managerApi, managerKeys } from '../api/manager-api'

/**
 * Bookings, invoices and attendances only carry user ids. Resolve the names of the
 * ids on screen through GET /users/:id; React Query caches and dedupes the lookups.
 */
export function useUserNames(ids: Array<string | null | undefined>) {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: managerKeys.member(id),
      queryFn: () => managerApi.member(id),
      staleTime: 5 * 60_000,
    })),
  })
  const names = new Map<string, string>()
  unique.forEach((id, index) => {
    const name = results[index]?.data?.fullName
    if (name) names.set(id, name)
  })
  return (id: string | null | undefined) => (id ? (names.get(id) ?? '…') : '—')
}
