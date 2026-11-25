import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  Users,
  ShieldCheck,
  Activity,
  LogOut,
  Menu,
  X,
  Terminal,
} from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { cn } from '@/lib/utils';

const consoleNavLinks = [
  {
    label: 'Quản Lý Trung Tâm',
    path: '/console/managers',
    icon: Users,
    desc: 'Tài khoản & phân quyền Center Manager',
  },
  {
    label: 'Nhật Ký Kiểm Toán',
    path: '/console/audit-logs',
    icon: ShieldCheck,
    desc: 'Toàn bộ Audit Trail của hệ thống',
  },
  {
    label: 'Giám Sát Hạ Tầng',
    path: '/console/metrics',
    icon: Activity,
    desc: 'Uptime, RAM, CPU & Database health',
  },
];

export const ConsoleLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    navigate('/auth/login', { replace: true });
    await logout();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 text-white px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-indigo-400" />
          <span className="font-bold text-sm tracking-wide">SYSTEM CONSOLE</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'w-full md:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between shrink-0 transition-all duration-200 z-40',
          mobileMenuOpen ? 'block' : 'hidden md:flex'
        )}
      >
        <div>
          {/* Logo / Brand */}
          <div className="p-5 border-b border-slate-800 hidden md:flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/30">
              <Terminal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wider">ADMIN CONSOLE</h2>
              <span className="text-[10px] text-indigo-400 font-bold uppercase block tracking-widest">
                Root System
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Điều Hành Hệ Thống
            </p>
            {consoleNavLinks.map(({ label, path, icon: Icon, desc }) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group',
                    isActive
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <span className="block">{label}</span>
                  <span className="text-[10px] opacity-70 font-normal line-clamp-1 block">
                    {desc}
                  </span>
                </div>
              </NavLink>
            ))}
          </div>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-indigo-700 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.fullName || 'Administrator'}</p>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">ROLE: ADMIN</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-rose-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl">
        <Outlet />
      </main>
    </div>
  );
};
