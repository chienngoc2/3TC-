import React, { type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import gymFacilityBg from "@/assets/images/gym-facility-bg.png";
import logo3tc from "@/assets/images/logo-3tc.png";

export interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title = "Chào mừng đến với Trung Tâm Thể Thao",
  subtitle = "",
}) => {
  return (
    <div className="h-screen w-full overflow-hidden flex bg-[#f8fafc] text-slate-800">
      {/* Left Brand Showcase Banner - Visible on LG screens */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 h-full relative flex-col justify-between p-8 xl:p-12 text-white overflow-hidden shadow-2xl bg-slate-900 shrink-0">
        {/* Background Gym Image */}
        <img
          src={gymFacilityBg}
          alt="Sports Center Facility"
          className="absolute inset-0 h-full w-full object-cover object-center brightness-105 contrast-[1.02] pointer-events-none"
        />

        {/* Soft, light gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/40 to-slate-950/25 pointer-events-none" />

        {/* Top Brand Logo - Links to Landing Page */}
        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 font-bold text-white group cursor-pointer hover:opacity-90 transition-opacity"
            title="Quay lại trang chủ"
          >
            <img
              src={logo3tc}
              alt="3TC FITNESS"
              className="h-8 xl:h-9 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <span className="font-black text-lg xl:text-xl tracking-tight text-white">
              3TC <span className="text-emerald-400">FITNESS</span>
            </span>
          </Link>
        </div>

        {/* Middle Feature Highlights */}
        <div className="relative z-10 my-auto py-6 space-y-6">
          <div>
            <h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              Trải nghiệm tập luyện thể thao chuẩn xác và tiện nghi
            </h2>
          </div>

          {/* 4 Disciplines Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-950/50 hover:bg-slate-950/65 border border-white/20 backdrop-blur-md transition-all shadow-md">
              <p className="text-xs font-bold text-white tracking-wide">Gym & Fitness</p>
              <p className="text-[11px] text-slate-200 mt-0.5">Tập tự do & PT 1:1</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/50 hover:bg-slate-950/65 border border-white/20 backdrop-blur-md transition-all shadow-md">
              <p className="text-xs font-bold text-white tracking-wide">Boxing & Combat</p>
              <p className="text-[11px] text-slate-200 mt-0.5">Lớp nhóm & Đối kháng</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/50 hover:bg-slate-950/65 border border-white/20 backdrop-blur-md transition-all shadow-md">
              <p className="text-xs font-bold text-white tracking-wide">Yoga & Mind</p>
              <p className="text-[11px] text-slate-200 mt-0.5">Dẻo dai & Phục hồi</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950/50 hover:bg-slate-950/65 border border-white/20 backdrop-blur-md transition-all shadow-md">
              <p className="text-xs font-bold text-white tracking-wide">Zumba & Dance</p>
              <p className="text-[11px] text-slate-200 mt-0.5">Sôi động & Đốt mỡ</p>
            </div>
          </div>
        </div>

        {/* Bottom Security Guarantee */}
        <div className="relative z-10 pt-3 border-t border-white/20 flex items-center justify-between text-[11px] text-slate-200 font-medium drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          <span>Hệ thống quản lý thể thao chuyên nghiệp</span>
        </div>
      </div>

      {/* Right Column: Interactive Content Form Container (Fixed viewport, no scroll) */}
      <div className="flex-1 h-full flex flex-col justify-center items-center px-4 py-4 sm:px-8 lg:px-12 overflow-hidden bg-[#f8fafc]">
        <div className="w-full max-w-md my-auto space-y-4">
          {/* Top Navigation Row: Back button to Landing Page & Mobile Logo */}
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#17664e] bg-white hover:bg-emerald-50 px-3 py-1.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all group cursor-pointer"
              title="Quay lại trang chủ"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1 text-slate-500 group-hover:text-[#17664e]" />
              <span>Về trang chủ</span>
            </Link>

            {/* Mobile Brand Logo */}
            <Link to="/" className="lg:hidden flex items-center gap-2 cursor-pointer">
              <img src={logo3tc} alt="3TC FITNESS" className="h-7 w-auto object-contain" />
              <span className="font-black text-sm tracking-tight text-slate-900">
                3TC <span className="text-[#17664e]">FIT</span>
              </span>
            </Link>
          </div>

          {/* Form Header */}
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {/* Child Form Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xl shadow-slate-200/40">
            {children}
          </div>

          {/* Footer note */}
          <p className="text-center text-[10.5px] text-slate-400">
            Bằng việc tiếp tục, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật của trung tâm thể thao.
          </p>
        </div>
      </div>
    </div>
  );
};
