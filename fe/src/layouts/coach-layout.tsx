import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/auth-context';
import { NotificationBell } from '@/components/common/notification-bell';
import {
  CalendarCheck,
  Clock,
  Users,
  Activity,
  Dumbbell,
  UserCheck,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import logo3tc from '@/assets/images/logo-3tc.png';
import gymFacility from '@/assets/images/plan-gym-facility.jpg';

import { coachPortalApi } from '@/features/coach-portal/api/coach-portal-api';
import { useQuery } from '@tanstack/react-query';

const logoutButtonClassName =
  'w-full border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-none hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus-visible:ring-rose-500';

interface CoachNavItem {
  label: string;
  subpath: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  badgeKey?: string;
}

const coachNavItems: CoachNavItem[] = [
  { label: 'Lịch giảng dạy & Huấn luyện', subpath: 'schedule', icon: CalendarCheck },
  { label: 'Khung giờ rảnh PT', subpath: 'availability', icon: Clock },
  { label: 'Nhận ca dạy thay', subpath: 'pickup', icon: UserCheck, badgeKey: 'pickup' },
  { label: 'Học viên của tôi', subpath: 'members', icon: Users },
  { label: 'InBody', subpath: 'inbody', icon: Activity },
  { label: 'Giáo án bài tập', subpath: 'workout-plans', icon: Dumbbell },
  
  { label: 'Hồ sơ cá nhân', subpath: 'profile', icon: UserCheck },
];

export const CoachLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';

  const { data: pickupSchedules = [] } = useQuery({
    queryKey: ['coach', 'pickup-schedules'],
    queryFn: () => coachPortalApi.getPickupSchedules(),
    staleTime: 30000,
  });

  const isItemActive = (subpath: string) => {
    const current = location.pathname.replace(/\/$/, '');
    if (subpath === 'schedule') {
      return (
        current === '/coach/schedule' ||
        current === '/portal/coach/schedule' ||
        current === '/coach' ||
        current === '/portal/coach'
      );
    }
    return current.endsWith(`/${subpath}`) || current.includes(`/${subpath}/`);
  };

  useEffect(() => {
    const invalidateSchedule = () => {
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
    };

    const invalidateRequests = () => {
      void queryClient.invalidateQueries({ queryKey: ['coach', 'cancellation-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'penalties'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
    };

    const handleRealtime = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: string }>;
      const type = customEvent.detail?.type;
      if (
        type === 'cancellation.reviewed' ||
        type === 'cancellation.cancelled' ||
        type === 'cancellation.requested'
      ) {
        invalidateRequests();
      } else if (
        type === 'schedule.updated' ||
        type === 'attendance.updated' ||
        type === 'booking.updated' ||
        type === 'booking.created' ||
        type === 'booking.cancelled'
      ) {
        invalidateSchedule();
      }
    };

    window.addEventListener('app:realtime-event', handleRealtime);
    return () => {
      window.removeEventListener('app:realtime-event', handleRealtime);
    };
  }, [queryClient]);

  const handleLogout = async () => {
    navigate('/auth/login', { replace: true })
    await logout()
  }

  return (
    <div
      className={cn(
        'h-screen w-full overflow-hidden grid grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-rows-1 bg-[#f8fafc] text-slate-800 transition-all duration-300 ease-in-out',
        isCollapsed ? 'md:grid-cols-[76px_minmax(0,1fr)]' : 'md:grid-cols-[260px_minmax(0,1fr)]'
      )}
    >
      {/* Mobile Top Header */}
      <details className="relative z-40 border-b border-slate-200 bg-white md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-slate-900 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <img src={logo3tc} alt="3TC FITNESS" className="h-6 w-auto object-contain" />
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
              COACH
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
        <div className="absolute inset-x-0 top-full max-h-[70vh] overflow-y-auto border-b border-slate-200 bg-white p-4 shadow-lg">
          <nav aria-label="Điều hướng huấn luyện viên" className="grid gap-1">
            {coachNavItems.map(({ label, subpath, icon: Icon, badgeKey }) => {
              const targetPath = `${coachBasePath}/${subpath}`;
              const isCurrentActive = isItemActive(subpath);
              return (
                <NavLink
                  key={subpath}
                  to={targetPath}
                  onClick={(event) => event.currentTarget.closest('details')?.removeAttribute('open')}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold transition-all',
                      (isCurrentActive || isActive)
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="truncate">{label}</span>
                  {badgeKey === 'pickup' && pickupSchedules.length > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 shadow-2xs">
                      {pickupSchedules.length}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleLogout()}
            className={cn(logoutButtonClassName, 'mt-3')}
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span>Đăng xuất</span>
          </Button>
        </div>
      </details>

      {/* Desktop Sidebar Navigation with Smooth Collapse & Expand */}
      <aside
        className={cn(
          'hidden h-full max-h-full overflow-hidden bg-white border-r border-slate-200/90 md:flex flex-col justify-between shadow-xs transition-all duration-300 ease-in-out shrink-0 select-none',
          isCollapsed ? 'p-2.5 pb-2 w-[70px]' : 'p-3 pb-2 w-[240px]'
        )}
      >
        <div className="flex flex-col min-h-0 space-y-1.5">
          {/* Header Row: 'Quản lý Huấn Luyện' and Collapse Toggle Arrow */}
          {!isCollapsed ? (
            <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-100">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Quản lý Huấn Luyện
              </span>
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                title="Thu gọn menu"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center pb-2 border-b border-slate-100">
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

          {/* Nav List */}
          <nav className="space-y-0.5">
            {coachNavItems.map(({ label, subpath, icon: Icon, badgeKey }) => {
              const targetPath = `${coachBasePath}/${subpath}`;
              const isCurrentActive = isItemActive(subpath);
              return (
                <NavLink
                  key={subpath}
                  to={targetPath}
                  title={isCollapsed ? label : undefined}
                  className={({ isActive }) => {
                    const isSelected = isCurrentActive || isActive;
                    return cn(
                      'group relative flex items-center rounded-xl text-xs font-bold transition-all',
                      isCollapsed ? 'justify-center p-2.5' : 'gap-2.5 px-3 py-2',
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                    );
                  }}
                >
                  {({ isActive }) => {
                    const isSelected = isCurrentActive || isActive;
                    return (
                      <>
                        <Icon
                          aria-hidden="true"
                          className={cn(
                            'shrink-0 transition-colors h-4 w-4',
                            isSelected ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'
                          )}
                        />
                        {!isCollapsed && <span className="truncate">{label}</span>}
                        {badgeKey === 'pickup' && pickupSchedules.length > 0 && (
                          <span
                            className={cn(
                              'rounded-full text-[10px] font-black px-1.5 py-0.2 shadow-2xs',
                              isCollapsed
                                ? 'absolute -top-1 -right-1 bg-amber-500 text-white'
                                : 'ml-auto bg-amber-500 text-white'
                            )}
                          >
                            {pickupSchedules.length}
                          </span>
                        )}
                      </>
                    );
                  }}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Card with Logout INSIDE the character border */}
        <div className="pt-2 border-t border-slate-200/90 shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center justify-between gap-2.5 p-2 rounded-2xl bg-slate-50 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0 ring-2 ring-emerald-500/20">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
                  ) : (
                    user?.fullName?.charAt(0) || 'C'
                  )}
                </div>
                <div className="truncate min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate leading-tight">
                    {user?.fullName || 'HLV'}
                  </p>
                  <span className="inline-block text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded mt-0.5">
                    Huấn Luyện Viên
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
                title={`${user?.fullName || 'HLV'} (Huấn Luyện Viên)`}
                className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-xs uppercase overflow-hidden shrink-0 ring-2 ring-emerald-500/20"
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
                ) : (
                  user?.fullName?.charAt(0) || 'C'
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

      {/* Main Workspace Area with Header */}
      <div className="h-full min-h-0 flex flex-col min-w-0 overflow-hidden">
        <header className="hidden md:flex items-center justify-between px-6 py-2.5 bg-white border-b border-slate-200/90 shrink-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Huấn luyện viên · 3TC Fitness
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 w-full min-w-0 bg-[#f8fafc] relative isolate">
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
