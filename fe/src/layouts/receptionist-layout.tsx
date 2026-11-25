import React, { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/auth-context'
import {
  BellRing,
  ScanLine,
  ReceiptText,
  CreditCard,
  UsersRound,
  Activity,
  LogOut,
  Menu,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getMyShifts } from '@/features/front-desk/services/front-desk-api.service'
import { MyShiftsModal } from '@/features/front-desk/components/my-shifts-modal'
import { NotificationBell } from '@/components/common/notification-bell'
import logo3tc from '@/assets/images/logo-3tc.png'
import gymFacility from '@/assets/images/plan-gym-facility.jpg'

const receptionistNavLinks = [
  { label: 'Bàn lễ tân', path: '/portal/desk', icon: BellRing, end: true },
  { label: 'Check-in cổng', path: '/portal/desk/gate-checkin', icon: ScanLine },
  { label: 'Bán vé & PT', path: '/portal/desk/pos', icon: ReceiptText },
  { label: 'Gia hạn & PT', path: '/portal/desk/subscriptions', icon: CreditCard },
  { label: 'Hội viên', path: '/portal/desk/members', icon: UsersRound },
  { label: 'InBody', path: '/portal/desk/inbody', icon: Activity },
]

export const ReceptionistLayout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false)
  const [showShiftsModal, setShowShiftsModal] = useState(false)

  const { data: myShifts = [] } = useQuery({
    queryKey: ['receptionist', 'my-shifts'],
    queryFn: getMyShifts,
    refetchInterval: 60000,
  })

  const now = new Date()
  const activeShift = myShifts.find((s) => {
    const start = new Date(s.startTime)
    const end = new Date(s.endTime)
    return now >= start && now <= end
  })

  const formatShortTime = (iso: string) => {
    const d = new Date(iso)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

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
              LỄ TÂN
            </span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <Menu aria-hidden="true" className="h-5 w-5" />
              Menu
            </span>
          </div>
        </summary>
        <div className="absolute inset-x-0 top-full max-h-[75vh] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-xl">
          {/* Mobile Shift Status & Action */}
          <div className="mb-3 pb-3 border-b border-slate-200 space-y-2">
            {activeShift ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/80 p-2 text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-tight">Đang trong ca trực</p>
                  <p className="text-[10px] text-emerald-600 font-medium truncate">
                    {formatShortTime(activeShift.startTime)} – {formatShortTime(activeShift.endTime)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-slate-100 p-2 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                <p className="text-[11px] font-medium leading-tight">Ngoài ca trực</p>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowShiftsModal(true)
                document.querySelector('details[open]')?.removeAttribute('open')
              }}
              className="w-full text-xs font-semibold gap-2 border-emerald-200/80 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/60"
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Lịch trực của tôi</span>
            </Button>
          </div>

          <nav aria-label="Điều hướng lễ tân" className="grid gap-1.5">
            {receptionistNavLinks.map(({ label, path, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
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
            <div className="flex items-center gap-3 px-2 py-2 mb-2">
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
                ) : (
                  user?.fullName?.charAt(0) || 'L'
                )}
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.fullName || 'Lễ tân'}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
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

      {/* Desktop Sidebar Navigation synchronized with Member/Coach layout */}
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
                to="/portal/desk"
                className="flex items-center gap-2 hover:opacity-85 transition-opacity min-w-0"
                title="3TC Fitness - Bàn Lễ Tân"
              >
               
                <span className=" px-20 py-0.5 text-[10px] font-extrabold tracking-wider text-emerald-800 uppercase">
                  LỄ TÂN
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
              
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-0.5 overflow-y-auto min-h-0 pr-0.5">
            {receptionistNavLinks.map(({ label, path, icon: Icon, end }) => (
              <NavLink
                key={path}
                to={path}
                end={end}
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
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0 ring-2 ring-emerald-500/20">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.fullName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    user?.fullName?.charAt(0) || 'L'
                  )}
                </div>
                <div className="truncate min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                    {user?.fullName || 'Lễ tân'}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded mt-0.5">
                    Lễ Tân
                  </span>
                </div>
              </div>

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
              <div
                title={`${user?.fullName || 'Lễ tân'} (Lễ Tân)`}
                className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0 ring-2 ring-emerald-500/20"
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user?.fullName?.charAt(0) || 'L'
                )}
              </div>
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

      {/* Main Workspace Area with Top Header containing Shift Status & My Shifts */}
      <div className="h-screen max-h-screen min-h-0 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar for Receptionist Workspace */}
        <header className="hidden md:flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200/90 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Bàn làm việc Lễ tân
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Shift Indicator Pill */}
            {activeShift ? (
              <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/80 px-3 py-1 text-emerald-800">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="text-xs font-bold">Đang trong ca trực:</span>
                <span className="text-xs font-semibold text-emerald-700">
                  {formatShortTime(activeShift.startTime)} – {formatShortTime(activeShift.endTime)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                <span className="text-xs font-semibold">Ngoài ca trực</span>
              </div>
            )}

            {/* My Shifts Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowShiftsModal(true)}
              className="text-xs font-bold gap-1.5 rounded-full border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70 hover:border-emerald-400 transition-colors shadow-2xs"
            >
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span>Lịch trực của tôi</span>
            </Button>

            {/* Real-time Notification Bell */}
            <NotificationBell />
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 w-full min-w-0 relative isolate">
          <div
            className="inbody-backdrop"
            style={{ backgroundImage: `url("${gymFacility}")` }}
          />
          <div className="relative">
            <Outlet />
          </div>
        </main>
      </div>

      <MyShiftsModal isOpen={showShiftsModal} onClose={() => setShowShiftsModal(false)} />
    </div>
  )
}
