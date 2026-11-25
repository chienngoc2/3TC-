import React from "react";
import {
  Maximize2,
  Award,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { money } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Coach } from "../types/coach.types";
import { DisciplineIcon } from "./discipline-icon";
import { getDisciplineColor, getInitials } from "../utils/coach.utils";

interface CoachCardProps {
  coach: Coach;
  disciplineCode?: string;
  className?: string;
  onOpenDetail: (coach: Coach) => void;
  onBookSession?: (coach: Coach, e?: React.MouseEvent) => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({
  coach,
  disciplineCode,
  className,
  onOpenDetail,
  onBookSession,
}) => {
  const targetCode = disciplineCode || coach.primaryDiscipline || "GYM";
  const discColor = getDisciplineColor(targetCode);

  // Active rate for this coach from DB
  const rateItem = coach.coachRates && coach.coachRates.length > 0
    ? coach.coachRates[0]
    : null;
  const rateAmount = rateItem && rateItem.ratePerSession > 0 ? rateItem.ratePerSession : null;

  // Specialties
  const specialties =
    coach.coachProfile?.coachSpecialties?.map((s) => s.specialty.name) ||
    (coach.coachProfile?.specialties ? [coach.coachProfile.specialties] : ["Huấn luyện viên"]);

  const hasAvatar = Boolean(coach.avatarUrl && coach.avatarUrl.trim());

  return (
    <article
      onClick={() => onOpenDetail(coach)}
      className={cn(
        "group relative flex flex-col justify-between bg-white rounded-md overflow-hidden border border-slate-200 shadow-xs hover:shadow-md hover:border-[#17664e]/40 transition-all duration-200 cursor-pointer",
        className || "h-full w-full"
      )}
    >
      {/* Visual Image Header */}
      <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-950 flex items-center justify-center">
        {hasAvatar ? (
          <img
            src={coach.avatarUrl!}
            alt={coach.fullName}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500 filter brightness-95"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 text-center select-none">
            <div className="w-20 h-20 rounded-md bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-emerald-400 font-black text-2xl shadow-xl mb-2 group-hover:scale-105 group-hover:border-emerald-500/40 transition-all">
              {getInitials(coach.fullName)}
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Chưa có ảnh đại diện
            </span>
          </div>
        )}

        {/* Ambient Gradient Veil */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />

        {/* Top Badges */}
        <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between pointer-events-none">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase backdrop-blur-md border",
              discColor
            )}
          >
            <DisciplineIcon code={targetCode} className="w-3.5 h-3.5" />
            <span>{targetCode}</span>
          </span>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-black/60 text-white backdrop-blur-md border border-white/20">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>HLV Đạt Chuẩn</span>
          </span>
        </div>

        {/* Floating Action: Quick Fullscreen Trigger */}
        <div className="absolute bottom-3 right-3 opacity-90 group-hover:opacity-100 transition-opacity">
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/20 transition-all shadow-md">
            <Maximize2 className="w-3.5 h-3.5 text-emerald-300" />
            <span>Xem chi tiết</span>
          </span>
        </div>

        {/* Experience Pill on Bottom Left */}
        {coach.experienceYears > 0 && (
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5 text-xs text-white/90">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600/80 backdrop-blur-md text-[10px] font-black uppercase tracking-wider">
              <Award className="w-3 h-3" /> {coach.experienceYears}+ Năm KN
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-[#17664e] transition-colors tracking-tight line-clamp-1">
                {coach.fullName}
              </h3>
              <p className="text-xs font-medium text-slate-500 line-clamp-1">
                {coach.title}
              </p>
            </div>
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          </div>

          {/* Technical Specialty Chips */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {specialties.slice(0, 2).map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
              >
                {tag}
              </span>
            ))}
            {specialties.length > 2 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">
                +{specialties.length - 2} môn
              </span>
            )}
          </div>
        </div>

        {/* Rate per Session & Availability */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {targetCode === "GYM" ? (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Biểu phí dạy kèm 1:1
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  {rateAmount !== null ? (
                    <>
                      <span className="text-lg font-extrabold text-[#17664e] font-mono">
                        {money(rateAmount)}
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">/ buổi</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">
                      Chưa thiết lập biểu phí
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Nhận dạy kèm 1:1</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Phân loại giảng dạy
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xs font-bold text-[#17664e]">
                    Lớp nhóm chuyên đề
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/60">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Mở lớp theo tuần</span>
                </span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onBookSession) onBookSession(coach, e);
              else onOpenDetail(coach);
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-xs font-bold bg-slate-900 hover:bg-[#17664e] text-white shadow-xs transition-all duration-200 active:scale-[0.98] cursor-pointer"
          >
            <span>{targetCode === "GYM" ? "Xem chi tiết & Đăng ký" : "Xem chuyên đề & Lớp học"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
