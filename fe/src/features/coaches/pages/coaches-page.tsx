import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Search,
  ArrowUpDown,
  RotateCcw,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { StateMessage } from "@/components/feedback/state-message";
import { coachApiService } from "../services/coach-api.service";
import { CoachCard } from "../components/coach-card";
import { CoachDetailModal } from "../components/coach-detail-modal";
import { DisciplineIcon } from "../components/discipline-icon";
import type { Coach, Discipline } from "../types/coach.types";
import { cn } from "@/lib/utils";
import { get } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { getPlansForCoach } from "@/lib/topic-matcher";

interface CoachesPageProps {
  isMemberView?: boolean;
}

const DISCIPLINE_TAGLINES: Record<string, string> = {
  GYM: "Tăng cơ, giảm mỡ, rèn luyện sức bền và thể lực toàn diện cùng các chuyên gia thể hình hàng đầu.",
  BOXING: "Tập luyện phản xạ, cardio cường độ cao, kỹ thuật tự vệ thực chiến và giải tỏa căng thẳng đỉnh cao.",
  YOGA: "Cân bằng thân - tâm - trí, cải thiện độ dẻo dai, thư giãn hơi thở và phục hồi xương khớp tự nhiên.",
  PILATES: "Định hình vóc dáng, siết cơ lõi chuyên sâu, tăng độ linh hoạt và cải thiện tư thế chuẩn xác.",
};

/**
 * Single Discipline Section with Horizontal Scroll Carousel & Navigation Arrows
 */
interface DisciplineCoachSectionProps {
  discipline: Discipline;
  tagline: string;
  coaches: Coach[];
  onOpenDetail: (coach: Coach) => void;
  onBookSession: (coach: Coach) => void;
}

const DisciplineCoachSection: React.FC<DisciplineCoachSectionProps> = ({
  discipline,
  tagline,
  coaches,
  onOpenDetail,
  onBookSession,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 8;
    setCanScroll(hasOverflow);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, coaches]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollStep = 380;
    if (direction === "left") {
      if (el.scrollLeft <= 15) {
        el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
      } else {
        el.scrollBy({ left: -scrollStep, behavior: "smooth" });
      }
    } else {
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 15) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: scrollStep, behavior: "smooth" });
      }
    }
  };

  return (
    <section className="space-y-4 pt-4">
      {/* Section Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
        <div className="w-10 h-10 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[#17664e] flex items-center justify-center shrink-0 shadow-xs">
          <DisciplineIcon code={discipline.code} className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              {discipline.name}
            </h2>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {coaches.length} HLV
            </span>
          </div>
          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{tagline}</p>
        </div>
      </div>

      {/* Row with Coach Cards and Horizontal Navigation Arrows */}
      <div className="relative group/row">
        {/* Horizontal Navigation Left Arrow */}
        <button
          type="button"
          onClick={() => handleScroll("left")}
          disabled={!canScroll}
          aria-label={`Cuộn trái danh sách HLV ${discipline.name}`}
          title="Cuộn sang trái"
          className={cn(
            "flex absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-white shadow-md border border-slate-300 text-slate-800 transition-all duration-200 items-center justify-center cursor-pointer",
            canScroll
              ? "hover:bg-slate-900 hover:text-white active:scale-95 opacity-100"
              : "opacity-0 sm:opacity-30 cursor-not-allowed pointer-events-none"
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Horizontally Scrollable Coach Cards Track */}
        <div
          ref={scrollRef}
          className="flex gap-5 sm:gap-6 overflow-x-auto scroll-smooth py-2 px-1 snap-x snap-mandatory items-stretch"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        >
          {coaches.map((coach) => (
            <CoachCard
              key={`${discipline.id}-${coach.id}`}
              coach={coach}
              disciplineCode={discipline.code}
              className="w-[310px] sm:w-[350px] md:w-[370px] shrink-0 snap-start"
              onOpenDetail={onOpenDetail}
              onBookSession={onBookSession}
            />
          ))}
        </div>

        {/* Horizontal Navigation Right Arrow */}
        <button
          type="button"
          onClick={() => handleScroll("right")}
          disabled={!canScroll}
          aria-label={`Cuộn phải danh sách HLV ${discipline.name}`}
          title="Cuộn sang phải"
          className={cn(
            "flex absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-white shadow-md border border-slate-300 text-slate-800 transition-all duration-200 items-center justify-center cursor-pointer",
            canScroll
              ? "hover:bg-slate-900 hover:text-white active:scale-95 opacity-100"
              : "opacity-0 sm:opacity-30 cursor-not-allowed pointer-events-none"
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  );
};

export const CoachesPage: React.FC<CoachesPageProps> = () => {
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc" | "experience">("default");
  const [activeCoachDetail, setActiveCoachDetail] = useState<Coach | null>(null);

  // 1. Fetch disciplines
  const disciplinesQuery = useQuery({
    queryKey: ["disciplines"],
    queryFn: () => coachApiService.getDisciplines(),
  });

  // 2. Fetch coaches
  const coachesQuery = useQuery({
    queryKey: ["coaches"],
    queryFn: () => coachApiService.getCoaches(),
  });

  // 3. Fetch active plans to verify coach packages
  const plansQuery = useQuery({
    queryKey: ["plans-all"],
    queryFn: () => get<Plan[]>("/memberships/plans", true),
  });

  // Dynamic discipline tabs from real Backend API
  const disciplineTabs = useMemo(() => {
    const list = [
      { id: "ALL", label: "Tất cả bộ môn", code: "ALL" },
    ];
    if (Array.isArray(disciplinesQuery.data)) {
      disciplinesQuery.data.forEach((d) => {
        list.push({
          id: d.code.toUpperCase(),
          label: d.name,
          code: d.code,
        });
      });
    }
    return list;
  }, [disciplinesQuery.data]);

  // Filtered & grouped coaches by discipline
  const disciplineSections = useMemo(() => {
    const rawDisciplines: Discipline[] = disciplinesQuery.data || [];
    const allCoaches: Coach[] = coachesQuery.data || [];

    // Filter coaches by search query
    let filteredCoaches = allCoaches;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filteredCoaches = filteredCoaches.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.coachProfile?.coachSpecialties?.some((s) =>
            s.specialty?.name?.toLowerCase().includes(q)
          ) ||
          c.coachProfile?.specialties?.toLowerCase().includes(q)
      );
    }

    // Sort function
    const sortList = (list: Coach[]) => {
      return [...list].sort((a, b) => {
        const rateA = a.coachRates?.[0]?.ratePerSession ?? 0;
        const rateB = b.coachRates?.[0]?.ratePerSession ?? 0;
        if (sortBy === "price-asc") return rateA - rateB;
        if (sortBy === "price-desc") return rateB - rateA;
        if (sortBy === "experience") return (b.experienceYears || 0) - (a.experienceYears || 0);
        return 0;
      });
    };

    // Filter disciplines by active tab
    const activeDisciplines =
      selectedDiscipline === "ALL"
        ? rawDisciplines
        : rawDisciplines.filter((d) => d.code.toUpperCase() === selectedDiscipline.toUpperCase());

    // Map each discipline to its matching coaches
    const sections = activeDisciplines
      .map((disc) => {
        const discCode = disc.code.toUpperCase();
        const discId = disc.id;

        const matchingCoaches = filteredCoaches.filter((coach) => {
          // 1. Check discipline match
          let matchesDisc = false;
          if (coach.disciplineCodes?.some((c) => c.toUpperCase() === discCode)) matchesDisc = true;
          else if (coach.disciplineIds?.includes(discId)) matchesDisc = true;
          else if (coach.primaryDiscipline?.toUpperCase() === discCode) matchesDisc = true;
          else if (
            coach.coachProfile?.coachSpecialties?.some((s) => {
              const code = s.specialty?.code?.toUpperCase() || "";
              const name = s.specialty?.name?.toLowerCase() || "";
              const sDiscId = s.specialty?.disciplineId;
              if (sDiscId && sDiscId === discId) return true;
              if (discCode === "GYM" && (code.includes("GYM") || name.includes("gym") || name.includes("cơ"))) return true;
              if (discCode === "BOXING" && (code.includes("BOX") || name.includes("box") || name.includes("võ"))) return true;
              if (discCode === "YOGA" && (code.includes("YOG") || name.includes("yoga") || name.includes("thiền"))) return true;
              return false;
            })
          ) {
            matchesDisc = true;
          }
          if (!matchesDisc) return false;

          // 2. Ràng buộc gói tập: HLV thuộc bộ môn nhưng không phụ trách bất kỳ gói tập nào thì không hiện
          const activePlans = plansQuery.data || [];
          if (activePlans.length > 0) {
            const coachPlans = getPlansForCoach(coach, activePlans);
            const discPlans = coachPlans.filter((p) => {
              const pDiscCode = (p.discipline?.code || "").toUpperCase();
              const pDiscId = p.disciplineId || p.discipline?.id;
              return pDiscCode === discCode || pDiscId === discId;
            });
            if (discPlans.length === 0) {
              return false;
            }
          }

          return true;
        });

        return {
          discipline: disc,
          tagline:
            DISCIPLINE_TAGLINES[disc.code.toUpperCase()] ||
            "Đội ngũ Huấn luyện viên chuyên môn cao đồng hành 1:1 theo sát mục tiêu cá nhân.",
          coaches: sortList(matchingCoaches),
        };
      })
      .filter((s) => s.coaches.length > 0);

    return sections;
  }, [disciplinesQuery.data, coachesQuery.data, plansQuery.data, searchQuery, sortBy, selectedDiscipline]);

  const isLoading = disciplinesQuery.isPending || coachesQuery.isPending;
  const error = disciplinesQuery.error || coachesQuery.error;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      {/* White container wrapping all components in coaches tab with 5% radius */}
      <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-7 space-y-8 shadow-xs">
        {/* FILTER & SEARCH BAR */}
        <div className="bg-slate-50/70 rounded-md p-4 sm:p-5 border border-slate-200 space-y-4">
          {/* Discipline Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {disciplineTabs.map((tab) => {
              const active = selectedDiscipline === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedDiscipline(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all duration-200 shrink-0 cursor-pointer border",
                    active
                      ? "!bg-[#17664e] !text-white !border-[#17664e] shadow-xs"
                      : "!bg-white !text-slate-600 !border-slate-300 hover:!bg-slate-100 hover:!text-slate-900"
                  )}
                >
                  {tab.code === "ALL" ? (
                    <Layers className={cn("w-3.5 h-3.5", active ? "text-white" : "text-slate-500")} />
                  ) : (
                    <DisciplineIcon
                      code={tab.code}
                      className={cn("w-3.5 h-3.5", active ? "text-white" : "text-slate-500")}
                    />
                  )}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1 border-t border-slate-200">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên HLV, kỹ thuật chuyên môn (Hypertrophy, Boxing, Yoga trị liệu...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 rounded-md text-xs font-medium bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-[#17664e] focus:border-[#17664e] transition-all shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  Xóa
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sắp xếp:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) =>
                  setSortBy(e.target.value as "default" | "price-asc" | "price-desc" | "experience")
                }
                className="h-10 px-3 rounded-md text-xs font-bold bg-white border border-slate-300 text-slate-700 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-[#17664e] shadow-xs"
              >
                <option value="default">Mặc định (Nổi bật)</option>
                <option value="experience">Kinh nghiệm nhiều nhất (Năm)</option>
                <option value="price-asc">Biểu phí: Thấp đến cao</option>
                <option value="price-desc">Biểu phí: Cao đến thấp</option>
              </select>
            </div>
          </div>
        </div>

        {/* Loading & Error States */}
        <StateMessage
          loading={isLoading}
          error={error}
          onRetry={() => {
            disciplinesQuery.refetch();
            coachesQuery.refetch();
          }}
        />

        {/* VERTICAL DISCIPLINE SECTIONS WITH HORIZONTAL CAROUSEL */}
        {!isLoading && disciplineSections.length > 0 ? (
          <div className="space-y-10">
            {disciplineSections.map((section) => (
              <DisciplineCoachSection
                key={section.discipline.id}
                discipline={section.discipline}
                tagline={section.tagline}
                coaches={section.coaches}
                onOpenDetail={(coach) => setActiveCoachDetail(coach)}
                onBookSession={(coach) => setActiveCoachDetail(coach)}
              />
            ))}
          </div>
        ) : (
          !isLoading && (
            <div className="p-10 text-center bg-slate-50 rounded-md border border-slate-200 shadow-xs space-y-4 max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-md bg-slate-200 text-slate-500 mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Không tìm thấy Huấn luyện viên phù hợp
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Vui lòng thử từ khóa khác hoặc chuyển sang danh mục bộ môn khác.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDiscipline("ALL");
                  setSearchQuery("");
                  setSortBy("default");
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-bold bg-[#17664e] text-white hover:bg-[#007360] transition-colors cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại bộ lọc</span>
              </button>
            </div>
          )
        )}
      </div>

      {/* FULLSCREEN DETAIL MODAL */}
      <CoachDetailModal
        coach={activeCoachDetail}
        isOpen={Boolean(activeCoachDetail)}
        onClose={() => setActiveCoachDetail(null)}
      />
    </div>
  );
};

export default CoachesPage;
