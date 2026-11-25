import { createContext, useContext } from 'react'
import type { Tokens, User } from '../lib/types'
export type SessionState = 'loading' | 'anonymous' | 'authenticated' | 'unavailable'
export interface SessionValue {
  state: SessionState
  user: User | null
  accept: (value: { user: User } & Tokens) => void
  verify: () => Promise<void>
  logout: () => Promise<void>
}
export const SessionContext = createContext<SessionValue | null>(null)
export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider is missing')
  return value
}
