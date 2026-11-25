import { NavLink, Outlet, useNavigate } from 'react-router'
import type { ReactNode } from 'react'
import { useSession } from '../auth/session-context'
const links = [
  ['Gói tập', '/portal/member/plans'],
  ['Lịch tuần', '/portal/member/bookings'],
  ['Gói của tôi', '/portal/member/subscriptions'],
  ['Giao dịch', '/portal/member/transactions'],
  ['Hóa đơn', '/portal/member/invoices'],
  ['Lịch sử', '/portal/member/history'],
  ['Hồ sơ', '/portal/member/profile'],
  ['InBody', '/portal/member/progress'],
  ['Giáo án', '/portal/member/workout-plans'],
  ['Điểm danh', '/portal/member/attendances'],
  ['Tủ đồ', '/portal/member/lockers'],
]
export function PublicLayout() {
  return (
    <>
      <header className="topbar">
        <NavLink className="brand" to="/plans">
          3TC<span>Fitness</span>
        </NavLink>
        <nav>
          <NavLink to="/plans">Khám phá gói tập</NavLink>
          <NavLink to="/auth/login">Đăng nhập</NavLink>
          <NavLink to="/auth/register">Đăng ký</NavLink>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
    </>
  )
}
export function MemberLayout() {
  const { user, logout } = useSession()
  const navigate = useNavigate()
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink className="brand" to="/portal/member">
          3TC<span>Fitness</span>
        </NavLink>
        <p className="sidebar-label">MEMBER PORTAL</p>
        <nav>
          {links.map(([label, path]) => (
            <NavLink key={path} to={path}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <strong>{user?.fullName}</strong>
          <span>{user?.email}</span>
          <button
            type="button"
            onClick={() => {
              navigate('/plans', { replace: true })
              void logout()
            }}
          >
            Đăng xuất
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="workspace-top">
          <span>Không gian hội viên</span>
          <span>{user?.fullName}</span>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}
export function StateMessage({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading?: boolean
  error?: unknown
  empty?: boolean
  onRetry?: () => void
}) {
  if (loading) return <div className="notice">Đang tải dữ liệu…</div>
  if (error)
    return (
      <div role="alert" className="notice error">
        Không tải được dữ liệu. {error instanceof Error ? error.message : ''}{' '}
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </div>
    )
  if (empty) return <div className="notice">Chưa có dữ liệu cho mục này.</div>
  return null
}
