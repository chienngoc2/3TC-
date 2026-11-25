import React from "react";
import { NavLink, Outlet } from "react-router";
import { useAuth } from "@/context/auth-context";
import logo3tc from "@/assets/images/logo-3tc.png";

export const PublicLayout: React.FC = () => {
  const { isAuthenticated, user } = useAuth();

  const getRolePortalInfo = (role?: string) => {
    switch (role) {
      case "COACH":
        return { path: "/coach/schedule", label: "Vào Cổng HLV", badge: "HLV" };
      case "CENTER_MANAGER":
        return { path: "/portal/desk", label: "Vào Cổng Quản Lý", badge: "Quản Lý" };
      case "RECEPTIONIST":
        return { path: "/portal/desk", label: "Vào Quầy Lễ Tân", badge: "Lễ Tân" };
      case "ADMIN":
        return { path: "/console/metrics", label: "Vào Console", badge: "Admin" };
      case "MEMBER":
      default:
        return { path: "/portal/member/bookings", label: "Vào Cổng Hội Viên", badge: "Hội Viên" };
    }
  };

  const portalInfo = getRolePortalInfo(user?.role);

  return (
    <div className="h-screen w-full overflow-hidden flex flex-col bg-[#f8fafc] text-slate-800">
      <header className="sticky top-0 z-30 shrink-0 flex justify-between items-center px-4 sm:px-10 py-3 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        {/* Brand Logo */}
        <NavLink
          className="flex items-center gap-2.5 font-bold text-slate-900 group transition-transform"
          to={isAuthenticated && user ? portalInfo.path : "/plans"}
        >
          <img
            src={logo3tc}
            alt="3TC FITNESS"
            className="h-8 md:h-9 w-auto object-contain transition-transform group-hover:scale-105"
          />
          <span className="font-black text-lg tracking-tight text-slate-900">
            3TC <span className="text-[#17664e]">FITNESS</span>
          </span>
        </NavLink>

        {/* Header Actions */}
        <div className="flex items-center gap-3 sm:gap-6 text-xs font-bold">
          {/* Authenticated user actions or Guest login buttons */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5">
              {/* User Identity Chip */}
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div className="h-6 w-6 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-[10px] uppercase overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.fullName} className="h-full w-full object-cover" />
                  ) : (
                    user.fullName?.charAt(0) || "U"
                  )}
                </div>
                <span className="font-semibold text-slate-800 max-w-[120px] truncate">
                  {user.fullName || user.email}
                </span>
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 uppercase">
                  {portalInfo.badge}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NavLink
                to="/auth/login"
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-colors shadow-2xs"
              >
                Đăng nhập
              </NavLink>
              <NavLink
                to="/auth/register"
                className="px-3.5 py-1.5 rounded-xl bg-[#17664e] text-white hover:bg-[#135641] font-bold transition-colors shadow-xs shadow-emerald-700/20"
              >
                Đăng ký
              </NavLink>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 w-full min-h-0 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};
