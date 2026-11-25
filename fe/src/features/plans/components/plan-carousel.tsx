import React, { useEffect, useState, useCallback, useRef } from "react";
import type { Plan } from "@/lib/types";
import { money } from "@/lib/api";
import { getPlanImage } from "./plan-images";
import { formatPlanName, formatPlanDescription, formatTierLabel } from "../lib/plan-formatter";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Sparkles,
  Dumbbell,
  Flame,
  Music,
  Activity,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanCarouselProps {
  plans: Plan[];
  onOpenDetail: (plan: Plan) => void;
  onSelectPlan: (plan: Plan, e?: React.MouseEvent) => void;
  isOrdering?: boolean;
}

function PlanDisciplineIcon({ name, className }: { name?: string; className?: string }) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("yoga")) return <Sparkles className={className} />;
  if (lower.includes("box") || lower.includes("combat")) return <Flame className={className} />;
  if (lower.includes("dance") || lower.includes("zumba")) return <Music className={className} />;
  if (lower.includes("gym")) return <Dumbbell className={className} />;
  return <Activity className={className} />;
}

const INTERVAL_TIME = 5000; // 5 seconds per slide

export const PlanCarousel: React.FC<PlanCarouselProps> = ({
  plans,
  onOpenDetail,
  onSelectPlan,
  isOrdering = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<number | null>(null);

  const total = plans.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
    setProgress(0);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
    setProgress(0);
  }, [total]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
    setProgress(0);
  };

  // Timer for auto-sliding with continuous progress bar
  useEffect(() => {
    if (total <= 1 || isPaused) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    progressIntervalRef.current = window.setInterval(() => {
      setProgress((old) => {
        if (old >= 100) {
          nextSlide();
          return 0;
        }
        return old + (stepMs / INTERVAL_TIME) * 100;
      });
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [total, isPaused, nextSlide]);

  if (total === 0) return null;

  const activePlan = plans[currentIndex];
  const isVip = activePlan.packageTier === "VIP";
  const isPlus = activePlan.packageTier === "PLUS";
  const isDaily =
    activePlan.durationDays <= 1 ||
    activePlan.packageTier === "DROP_IN" ||
    activePlan.name.toLowerCase().includes("drop-in") ||
    activePlan.name.toLowerCase().includes("buổi") ||
    activePlan.name.toLowerCase().includes("ngày");
  const planImg = getPlanImage(
    activePlan.discipline?.name || activePlan.disciplineId,
    activePlan.packageTier,
    activePlan.name,
    activePlan.id
  );


  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative overflow-hidden rounded-lg bg-slate-950 border border-slate-800 shadow-xl text-white select-none group"
    >
      {/* Background Image with Crisp Brightness and Subtle Vignette */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          key={activePlan.id}
          src={planImg}
          alt={activePlan.name}
          className="w-full h-full object-cover object-center filter brightness-[0.95] contrast-[1.05] transition-all duration-700 ease-out"
        />
        {/* Soft, lightweight gradient so the image shines through brightly */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-black/25 to-black/20 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none hidden md:block" />
      </div>

      {/* Main Slide Content Grid */}
      <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-12 min-h-[460px] md:min-h-[440px] flex flex-col justify-between">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            

            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold tracking-wide uppercase bg-black/50 text-slate-200 border border-white/20 backdrop-blur-md">
              <PlanDisciplineIcon name={activePlan.discipline?.name} className="w-3.5 h-3.5 text-emerald-400" />
              {activePlan.discipline?.name || "Bộ môn"}
            </span>

            <span
              className={cn(
                "px-2.5 py-1 rounded text-[10px] font-black tracking-wider uppercase border backdrop-blur-md",
                isVip
                  ? "bg-amber-500/40 text-amber-200 border-amber-400/60"
                  : isPlus
                    ? "bg-emerald-500/40 text-emerald-200 border-emerald-400/60"
                    : "bg-slate-500/40 text-slate-200 border-slate-400/60"
              )}
            >
              {formatTierLabel(activePlan.packageTier)}
            </span>
          </div>

          {/* Quick full-screen trigger */}
          <button
            type="button"
            onClick={() => onOpenDetail(activePlan)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/25 transition-all cursor-pointer shadow-md"
            title="Mở toàn màn hình xem ảnh và chi tiết"
          >
            <Maximize2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Xem full màn hình</span>
          </button>
        </div>

        {/* Middle Body Content: Asymmetric Info */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6 items-center">
          <div className="lg:col-span-7 space-y-3 bg-black/60 backdrop-blur-md p-5 sm:p-6 rounded-md border border-white/15 shadow-xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight drop-shadow-md">
              {formatPlanName(activePlan.name)}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed">
              {formatPlanDescription(activePlan.description)}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-200 pt-1 font-medium">
              <span>{activePlan.unlimitedGymEntry ? "Ra vào phòng tập tự do 24/7" : "Tập theo ca linh hoạt"}</span>
              <span className="text-slate-400">·</span>
              <span>Xông hơi Sauna & Tủ đồ</span>
              <span className="text-slate-400">·</span>
              <span>Đo chỉ số InBody</span>
            </div>
          </div>

          {/* Right Bento Box: Price & Metrics */}
          <div className="lg:col-span-5 flex flex-col justify-center bg-black/50 backdrop-blur-xl border border-white/15 p-5 rounded-md space-y-4 shadow-xl">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Mức đầu tư trọn gói:
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                  {money(activePlan.price)}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  / {activePlan.durationDays} ngày
                </span>
              </div>
              {isVip && (
                <p className="text-[11px] text-amber-300/90 font-medium mt-1">
                  Chưa bao gồm phí HLV kèm riêng theo từng buổi
                </p>
              )}
            </div>

            {/* Quick Metrics */}
            <div className={cn("grid gap-2 text-center text-xs", isDaily ? "grid-cols-2" : "grid-cols-3")}>
              <div className="p-2 rounded bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Thời hạn</span>
                <strong className="text-white font-mono text-sm">{activePlan.durationDays} ngày</strong>
              </div>

              <div className="p-2 rounded bg-white/5 border border-white/10">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">{isDaily ? "Số buổi" : "Lớp nhóm"}</span>
                <strong className="text-white font-mono text-sm">
                  {isDaily
                    ? `${activePlan.groupSessionQuota || activePlan.ptSessionQuota || 1} buổi`
                    : `${activePlan.groupSessionQuota ?? 0} buổi`}
                </strong>
              </div>

              {!isDaily && (
                <div className="p-2 rounded bg-white/5 border border-white/10">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Kèm 1:1</span>
                  <strong className="text-white font-mono text-sm">{activePlan.ptSessionQuota ?? 0} buổi</strong>
                </div>
              )}
            </div>

            {/* Carousel Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isOrdering}
                onClick={(e) => onSelectPlan(activePlan, e)}
                className={cn(
                  "flex-1 h-10 rounded-md font-bold text-xs tracking-wide flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md active:scale-[0.98]",
                  isVip
                    ? "bg-amber-400 hover:bg-amber-300 text-slate-950"
                    : "bg-[#17664e] hover:bg-emerald-600 text-white",
                  isOrdering && "opacity-80 cursor-wait"
                )}
              >
                {isOrdering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang khởi tạo đơn hàng...</span>
                  </>
                ) : (
                  <span>{isVip ? "Chọn HLV & báo giá" : "Mua gói ngay"}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onOpenDetail(activePlan)}
                className="px-3.5 h-10 rounded-md bg-white/10 hover:bg-white/20 text-white border border-white/20 flex items-center justify-center transition-all cursor-pointer"
                title="Khám phá chi tiết gói"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Control Bar: Progress Bar & Dots Switcher */}
        <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/10">
          {/* Slide Dots */}
          <div className="flex items-center gap-1.5">
            {plans.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => goToSlide(idx)}
                className={cn(
                  "h-1 rounded-xs transition-all duration-200 cursor-pointer",
                  currentIndex === idx
                    ? "w-7 bg-emerald-400"
                    : "w-2 bg-white/30 hover:bg-white/60"
                )}
                title={`Chuyển tới ${p.name}`}
              />
            ))}
            <span className="text-[11px] font-mono text-slate-400 ml-2">
              {currentIndex + 1} / {total}
            </span>
          </div>

          {/* Left / Right Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevSlide}
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/25 text-white border border-white/15 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              title="Gói trước đó"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              className="p-1.5 rounded-md bg-white/10 hover:bg-white/25 text-white border border-white/15 backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              title="Gói tiếp theo"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Slide Progress Bar at the very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
        <div
          className="h-full bg-emerald-400 transition-all duration-75 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
