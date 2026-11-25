import React, { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@/context/auth-context'
import {
  Calendar,
  CreditCard,
  History,
  Activity,
  BookOpen,
  CheckCircle2,
  Package,
  Dumbbell,
  FileText,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/common/notification-bell'
import logo3tc from '@/assets/images/logo-3tc.png'
import gymFacility from '@/assets/images/plan-gym-facility.jpg'

const memberNavLinks = [
  { label: 'Gói tập', path: '/portal/member/plans', icon: Package },
  { label: 'Huấn luyện viên', path: '/portal/member/coaches', icon: Dumbbell },
  { label: 'Lịch tuần', path: '/portal/member/bookings', icon: Calendar },
  { label: 'Gói của tôi', path: '/portal/member/subscriptions', icon: CreditCard },
  { label: 'Giao dịch', path: '/portal/member/transactions', icon: History },
  { label: 'Hóa đơn', path: '/portal/member/invoices', icon: FileText },
  { label: 'Lịch sử', path: '/portal/member/history', icon: CheckCircle2 },
  { label: 'InBody', path: '/portal/member/progress', icon: Activity },
  { label: 'Giáo án', path: '/portal/member/workout-plans', icon: BookOpen },
]

export const MemberLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)

  const handleLogout = async () => {
    navigate('/auth/login', { replace: true })
    await logout()
  }

  return (
    <div
      className={cn(
        'h-screen h-[100dvh] w-full overflow-hidden grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-rows-1 bg-[#f8fafc] text-slate-800 transition-[grid-template-columns] duration-200 ease-in-out',
        isCollapsed ? 'md:grid-cols-[76px_minmax(0,1fr)]' : 'md:grid-cols-[260px_minmax(0,1fr)]',
      )}
    >
      {/* Mobile Top Header */}
      <details className="relative z-40 border-b border-slate-200 bg-white md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <img src={logo3tc} alt="3TC FITNESS" className="h-6 w-auto object-contain" />
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              MEMBER
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 pl-1">
              <Menu aria-hidden="true" className="h-5 w-5" />
              Menu
            </span>
          </div>
        </summary>
        <div className="absolute inset-x-0 top-full max-h-[75vh] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-xl">
          <nav aria-label="Điều hướng hội viên" className="grid gap-1.5">
            {memberNavLinks.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                      : 'text-slate-600 hover:bg-slate-100',
                  )
                }
              >
                <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-4 pt-3 border-t border-slate-200">
            <Link
              to="/portal/member/profile"
              onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
              className="flex items-center gap-3 px-2 py-2 mb-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
                ) : (
                  user?.fullName?.charAt(0) || 'H'
                )}
              </div>
              <div className="truncate min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate hover:text-emerald-700">
                  {user?.fullName || 'Hội viên'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </Link>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleLogout()}
              className="w-full justify-center gap-2 border-slate-200 bg-white text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" />
              <span>Đăng xuất</span>
            </Button>
          </div>
        </div>
      </details>

      {/* Desktop Sidebar Navigation synchronized with Coach layout */}
      <aside
        className={cn(
          'hidden h-screen max-h-screen sticky top-0 overflow-hidden bg-white border-r border-slate-200/90 md:flex flex-col justify-between shadow-xs transition-[width,padding] duration-200 ease-in-out shrink-0 select-none z-30',
          isCollapsed
            ? 'p-2.5 pb-2 w-[76px] min-w-[76px] max-w-[76px]'
            : 'p-3 pb-2 w-[260px] min-w-[260px] max-w-[260px]',
        )}
      >
        <div className="flex flex-col min-h-0 space-y-1.5 flex-1">
          {/* Header Row: Logo 3TC Fitness and Collapse Toggle Arrow */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-1 pb-2.5 border-b border-slate-100">
              <Link
                to="/portal/member/plans"
                className="flex items-center gap-2 hover:opacity-85 transition-opacity min-w-0"
                title="3TC Fitness - Hội Viên"
              >
                <img src={logo3tc} alt="3TC FITNESS" className="h-7 w-auto object-contain" />
                <span className="rounded-md bg-emerald-100/80 px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-800 uppercase">
                  MEMBER
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                title="Thu gọn menu"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 pb-2.5 border-b border-slate-100">
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                title="Mở rộng menu"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <Link
                to="/portal/member/plans"
                title="3TC Fitness - Hội Viên"
                className="hover:opacity-85 transition-opacity"
              >
                <img src={logo3tc} alt="3TC" className="h-5 w-auto object-contain max-w-[50px]" />
              </Link>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-0.5 overflow-y-auto min-h-0 pr-0.5 flex-1">
            {memberNavLinks.map(({ label, path, icon: Icon }) => (
              <NavLink
                key={path}
                to={path}
                title={isCollapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex items-center rounded-xl text-xs font-bold transition-all',
                    isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2',
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 transition-colors',
                        'h-4 w-4',
                        isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700',
                      )}
                    />
                    {!isCollapsed && <span className="truncate">{label}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Card with Logout inside character border */}
        <div className="pt-2 border-t border-slate-200/90 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2.5 p-2 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
              <Link
                to="/portal/member/profile"
                title="Xem hồ sơ cá nhân"
                className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-85 transition-opacity"
              >
                <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0 ring-2 ring-emerald-500/20">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user?.fullName?.charAt(0) || 'H'
                  )}
                </div>
                <div className="truncate min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate leading-tight hover:text-emerald-700 transition-colors">
                    {user?.fullName || 'Hội viên'}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded mt-0.5">
                    Hội Viên
                  </span>
                </div>
              </Link>

              {/* Logout Button directly inside character border */}
              <button
                type="button"
                onClick={() => void handleLogout()}
                title="Đăng xuất khỏi hệ thống"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer shrink-0"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 p-1">
              <Link
                to="/portal/member/profile"
                title={`${user?.fullName || 'Hội viên'} (Xem hồ sơ)`}
                className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0 ring-2 ring-emerald-500/20 hover:opacity-85 transition-opacity"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user?.fullName?.charAt(0) || 'H'
                )}
              </Link>
              <button
                type="button"
                onClick={() => void handleLogout()}
                title="Đăng xuất"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Workspace Area with Header */}
      <div className="h-full min-h-0 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden md:flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200/90 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Hội viên · 3TC Fitness
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 w-full min-w-0 relative isolate">
          <div
            className="inbody-backdrop"
            style={{ backgroundImage: `url("${gymFacility}")` }}
          />
          <div className="relative">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

