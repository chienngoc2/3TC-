import { Navigate, Outlet, useSearchParams, useLocation, useRouteError } from 'react-router'
import type { ReactNode } from 'react'
import type { UserRole } from '@/types'
import { useSession } from '../auth/session-context'
import { ProtectedRoute } from './protected-route'
import { RoleGuard } from './role-guard'
import { isMonday, mondayInVietnam } from '../lib/date'
import { CalendarPage } from '../pages/CalendarPage'
export function MemberGuard({ children }: { children: ReactNode }) {
  const { state, user, verify } = useSession()
  const location = useLocation()
  if (state === 'loading') return <div className="notice">Đang kiểm tra phiên đăng nhập…</div>
  if (state === 'unavailable')
    return (
      <div className="notice error">
        Không thể kiểm tra phiên.{' '}
        <button type="button" onClick={() => void verify()}>
          Thử lại
        </button>
      </div>
    )
  if (state === 'anonymous')
    return (
      <Navigate to="/auth/login" replace state={{ from: location.pathname + location.search }} />
    )
  if (user?.role !== 'MEMBER') return <Navigate to="/forbidden" replace />
  return <>{children}</>
}
/** Layout route: login first (keeps the return path), then role check. */
export function StaffGuard({ roles }: { roles: UserRole[] }) {
  return (
    <ProtectedRoute>
      <RoleGuard allowedRoles={roles}>
        <Outlet />
      </RoleGuard>
    </ProtectedRoute>
  )
}
export function PortalErrorFallback() {
  const error = useRouteError()
  console.error('[PortalErrorFallback] Caught render error:', error)
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
      ? error
      : (error as any)?.data?.message || ''

  return (
    <div className="p-8 max-w-xl mx-auto text-center space-y-4 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm mt-8 text-rose-900">
      <h2 className="text-base font-bold">Đã xảy ra sự cố khi tải dữ liệu</h2>
      <p className="text-xs text-rose-700">
        Dữ liệu nhận từ server có thể thiếu một số trường thông tin liên kết hoặc xảy ra lỗi xử lý giao diện.
      </p>
      {errorMessage && (
        <pre className="text-[11px] p-2.5 bg-rose-100/80 rounded-xl text-rose-900 text-left font-mono overflow-x-auto max-h-36 border border-rose-200">
          {errorMessage}
        </pre>
      )}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
      >
        Tải lại trang
      </button>
    </div>
  )
}
export function CalendarRoute() {
  const [params] = useSearchParams()
  const week = params.get('week')
  if (!isMonday(week)) {
    const next = new URLSearchParams(params)
    next.set('week', mondayInVietnam())
    return <Navigate to={`/portal/member/bookings?${next}`} replace />
  }
  return <CalendarPage />
}
export function CalendarAlias({ view }: { view: 'group' | 'pt' }) {
  const [params] = useSearchParams()
  const next = new URLSearchParams(params)
  if (!isMonday(next.get('week'))) next.set('week', mondayInVietnam())
  next.set('view', view)
  return <Navigate to={`/portal/member/bookings?${next}`} replace />
}
