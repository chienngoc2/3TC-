import type { ReactNode } from 'react'
import { AuthProvider } from '@/context/auth-context'

export function SessionProvider({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}
