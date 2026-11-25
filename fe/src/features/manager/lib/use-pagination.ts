import { useState } from 'react'

export interface Pager {
  page: number
  pages: number
  total: number
  pageSize: number
  onPage: (page: number) => void
}

/**
 * Client-side paging for the capped lists the API returns (take 100/200).
 * Pass the active filters as `resetKey` so a new filter starts again from page 1.
 */
export function usePagination<T>(rows: T[], pageSize: number, resetKey = '') {
  const [state, setState] = useState({ page: 0, key: resetKey })
  const requested = state.key === resetKey ? state.page : 0
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = Math.min(requested, pages - 1)
  const pager: Pager = {
    page,
    pages,
    total: rows.length,
    pageSize,
    onPage: (next) => setState({ page: next, key: resetKey }),
  }
  return { items: rows.slice(page * pageSize, (page + 1) * pageSize), pager }
}
