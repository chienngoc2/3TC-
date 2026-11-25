import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/session-context";
import { StateMessage } from "@/components/feedback/state-message";
import { Button } from "@/components/ui/button";
import { errorText, get, money, query } from "@/lib/api";
import { createCheckout } from "@/lib/checkout";
import { memberKeys } from "@/lib/keys";
import type { Discipline, Plan } from "@/lib/types";
import { getPlanImage } from "./plan-images";
import { formatPlanName, formatTierLabel } from "../lib/plan-formatter";
import { PlanDetailModal } from "./plan-detail-modal";
import { PlanCarousel } from "./plan-carousel";
import { CoachDetailModal } from "@/features/coaches/components/coach-detail-modal";
import { coachApiService } from "@/features/coaches/services/coach-api.service";
import type { Coach } from "@/features/coaches/types/coach.types";
import { useNotification } from "@/context/notification-context";
import { isCoachQualifiedForPlan } from "@/lib/topic-matcher";

import {
  Dumbbell,
  Flame,
  Sparkles,
  Music,
  Activity,
  CheckCircle2,
  Clock,
  Users,
  UserCheck,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  LayoutGrid,
  Loader2,
  Award,
  RotateCcw,
  Search,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanCatalogProps {
  member: boolean;
}

const defaultDisciplines: Discipline[] = [
  { id: "gym", name: "Gym & Fitness", code: "GYM" },
  { id: "boxing", name: "Boxing & Kickboxing", code: "BOXING" },
  { id: "zumba", name: "Zumba & Modern Dance", code: "DANCING" },
  { id: "yoga", name: "Yoga & Meditation", code: "YOGA" },
];

function normalizeDiscipline(str?: string): "gym" | "boxing" | "zumba" | "yoga" | "other" {
  if (!str) return "other";
  const s = str.toLowerCase();
  if (s.includes("gym") || s.includes("fitness") || s.includes("thể hình")) return "gym";
  if (s.includes("box") || s.includes("combat") || s.includes("kick") || s.includes("võ")) return "boxing";
  if (s.includes("zumba") || s.includes("dance") || s.includes("nhảy") || s.includes("dancing")) return "zumba";
  if (s.includes("yoga") || s.includes("thiền") || s.includes("meditation")) return "yoga";
  return "other";
}

function DisciplineIconComponent({ nameOrCode, className }: { nameOrCode?: string; className?: string }) {
  const norm = normalizeDiscipline(nameOrCode);
  if (norm === "gym") return <Dumbbell className={className} />;
  if (norm === "boxing") return <Flame className={className} />;
  if (norm === "zumba") return <Music className={className} />;
  if (norm === "yoga") return <Sparkles className={className} />;
  return <Activity className={className} />;
}

const DISCIPLINE_PRESETS: Record<
  "gym" | "boxing" | "zumba" | "yoga",
  { name: string; tagline: string; code: string; defaultId: string }
> = {
  gym: {
    name: "Gym & Fitness",
    tagline: "Hệ thống máy Technogym thế hệ mới, tạ tự do & khu Functional chuyên sâu",
    code: "GYM",
    defaultId: "gym",
  },
  boxing: {
    name: "Boxing & Kickboxing",
    tagline: "Võ đài tiêu chuẩn, sàn đấu đối kháng và hệ thống bao cát Contenders cao cấp",
    code: "BOXING",
    defaultId: "boxing",
  },
  zumba: {
    name: "Zumba & Modern Dance",
    tagline: "Âm nhạc bùng nổ, vũ đạo hiện đại giải phóng năng lượng cùng HLV chuyên nghiệp",
    code: "DANCING",
    defaultId: "zumba",
  },
  yoga: {
    name: "Yoga & Meditation",
    tagline: "Không gian tĩnh lặng thiền định, cân bằng thân tâm trí và phục hồi năng lượng",
    code: "YOGA",
    defaultId: "yoga",
  },
};

interface DisciplineSectionData {
  id: string;
  name: string;
  code?: string;
  tagline: string;
  plans: Plan[];
}

interface PlanCardProps {
  plan: Plan;
  onOpenDetail: (plan: Plan, coachId?: string, coachStars?: number) => void;
  onSelectPlan: (plan: Plan, e?: React.MouseEvent, coachId?: string, coachStars?: number) => void;
  isOrdering: boolean;
  isCurrentOrdering?: boolean;
  coaches?: Coach[];
  coachPlansMap?: Record<string, Plan>;
  onViewCoachDetail?: (coach: Coach) => void;
  themeTitle?: string;
  coachStars?: number;
  preferredCoachId?: string;
}

function resolveCoachPtRate(coach?: Coach | null, stars?: number): number {
  const profileRate = Number(coach?.coachProfile?.ratePerSession);
  if (Number.isFinite(profileRate) && profileRate > 0) return profileRate;
  const profileStars = coach?.coachProfile?.ratingStars;
  if (profileStars && profileStars > 0) return profileStars * 1000;
  const activeRateRow =
    coach?.coachRates?.find((r) => !r.effectiveTo) || coach?.coachRates?.[0];
  const tableRate = Number(activeRateRow?.ratePerSession);
  if (Number.isFinite(tableRate) && tableRate > 0) return tableRate;
  return stars && stars > 0 ? stars * 1000 : 3000;
}

const PlanCard: React.FC<PlanCardProps> = ({
  plan,
  onOpenDetail,
  onSelectPlan,
  isOrdering,
  isCurrentOrdering = false,
  coaches = [],
  coachPlansMap,
  onViewCoachDetail,
  themeTitle,
  coachStars,
  preferredCoachId,
}) => {
  const planDisc = (plan.discipline?.code || plan.discipline?.name || plan.disciplineId || "").toLowerCase();
  const isGym = planDisc.includes("gym") || plan.name.toLowerCase().includes("gym");
  const isDaily =
    plan.durationDays <= 1 ||
    plan.packageTier === "DROP_IN" ||
    plan.name.toLowerCase().includes("drop-in") ||
    plan.name.toLowerCase().includes("vé buổi") ||
    plan.name.toLowerCase().includes("vé ngày");
  const isVip = plan.packageTier === "VIP" || (plan.ptSessionQuota ?? 0) > 0;
  const isGroupPlan = ((plan.groupSessionQuota ?? 0) > 0 || plan.trainingMode === "GROUP_CLASS") && !isGym && !isVip;
  const isGymPlus = isGym && plan.packageTier === "PLUS" && !isGroupPlan && !isVip;

  const { showToast } = useNotification();
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(
    preferredCoachId && coaches.some((c) => c.id === preferredCoachId)
      ? preferredCoachId
      : coaches[0]?.id || null
  );

  useEffect(() => {
    if (preferredCoachId && coaches.some((c) => c.id === preferredCoachId)) {
      setSelectedCoachId(preferredCoachId);
    }
  }, [preferredCoachId, coaches]);

  const activeCoach = coaches.find((c) => c.id === selectedCoachId) || coaches[0];
  const activePlan = (activeCoach && coachPlansMap?.[activeCoach.id]) || plan;

  const defaultGroupStars = coachStars || (preferredCoachId && activeCoach?.id === preferredCoachId ? (activeCoach.coachProfile?.ratingStars || 3) : 0);
  const [selectedGroupStars, setSelectedGroupStars] = useState<number>(defaultGroupStars);
  useEffect(() => {
    if (coachStars) {
      setSelectedGroupStars(coachStars);
    } else if (preferredCoachId && activeCoach?.id === preferredCoachId && activeCoach.coachProfile?.ratingStars) {
      setSelectedGroupStars(activeCoach.coachProfile.ratingStars);
    } else if (coachStars === 0) {
      setSelectedGroupStars(0);
    }
  }, [coachStars, preferredCoachId, activeCoach?.id, activeCoach?.coachProfile?.ratingStars]);

  const effectiveCoachStars = (!isDaily && !isGymPlus)
    ? (isGroupPlan
        ? selectedGroupStars
        : isVip
          ? (activeCoach?.coachProfile?.ratingStars || coachStars || plan.coachRatingStars || 3)
          : (coachStars || plan.coachRatingStars || 0))
    : 0;

  const planImg = getPlanImage(
    activePlan.discipline?.name || activePlan.disciplineId,
    activePlan.packageTier,
    activePlan.name,
    activePlan.id
  );

  const planPriceNum = Number(activePlan.price) || 0;
  const sessionCount = isVip ? (activePlan.ptSessionQuota || 12) : (activePlan.groupSessionQuota || 12);
  const coachRate = isGroupPlan
    ? (effectiveCoachStars * 1000)
    : resolveCoachPtRate(activeCoach, effectiveCoachStars);
  const coachMonthlyFee = sessionCount * coachRate;
  const totalMonthlyFee = isGroupPlan
    ? (effectiveCoachStars > 0 ? (planPriceNum + coachMonthlyFee) : planPriceNum)
    : isVip
    ? (planPriceNum + coachMonthlyFee)
    : planPriceNum;
  const displayTitle = themeTitle || formatPlanName(activePlan.name);

  return (
    <article
      onClick={() => {
        onOpenDetail(activePlan, isVip ? activeCoach?.id : undefined, effectiveCoachStars);
      }}
      className="group relative flex flex-col justify-between bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-700/40 transition-[border-color,box-shadow] duration-200 cursor-pointer w-[310px] sm:w-[348px] shrink-0 snap-start"
    >
      {/* Visual Image Header */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-900">
        <img
          src={planImg}
          alt={activePlan.name}
          className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-500 brightness-95"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950/65 text-white backdrop-blur-md border border-white/15">
            <DisciplineIconComponent nameOrCode={activePlan.discipline?.name || activePlan.disciplineId} className="w-3.5 h-3.5 text-emerald-400" />
            <span>{activePlan.discipline?.name || "Bộ môn"}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {!isDaily && !isGymPlus && effectiveCoachStars > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-amber-400/95 text-slate-950">
                <Star className="w-3 h-3 fill-slate-950 text-slate-950 shrink-0" />
                <span className="tabular-nums">{effectiveCoachStars} sao</span>
              </span>
            )}
            <span
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium border backdrop-blur-md",
                isVip
                  ? "bg-slate-900/85 text-amber-200 border-amber-400/40"
                  : isGroupPlan
                    ? "bg-[#17664e]/90 text-white border-emerald-400/40"
                    : isGymPlus
                      ? "bg-slate-800/85 text-white border-white/20"
                      : "bg-slate-800/85 text-slate-100 border-white/20"
              )}
            >
              {isGroupPlan ? "Gói nhóm" : isGymPlus ? "Gym Plus" : formatTierLabel(activePlan.packageTier)}
            </span>
          </div>
        </div>

        {/* Subtle detail trigger on photo */}
        <div className="absolute bottom-3 right-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-950/55 group-hover:bg-slate-950/75 text-white backdrop-blur-md border border-white/15 transition-colors">
            <Maximize2 className="w-3 h-3" />
            <span>Chi tiết</span>
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Title & Price */}
        <div className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900 leading-snug line-clamp-2 min-h-[2.75rem]" title={displayTitle}>
            {displayTitle}
          </h3>

          <div className="flex items-baseline justify-between gap-2 pt-0.5">
            <div className="flex items-baseline gap-1.5 flex-nowrap">
              <span className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight whitespace-nowrap">
                {money(totalMonthlyFee)}
              </span>
              <span className="text-xs text-slate-500 whitespace-nowrap tabular-nums">
                / {activePlan.durationDays} ngày
              </span>
            </div>
            {isGroupPlan && (
              <span className="text-xs text-emerald-800 font-medium whitespace-nowrap">
                Giờ linh hoạt
              </span>
            )}
          </div>
        </div>

        {/* Chọn số sao HLV cho gói nhóm */}
        {isGroupPlan && (
          <div className="space-y-2 p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-700 inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Chọn hạng HLV</span>
              </label>
              {effectiveCoachStars > 0 ? (
                <span className="text-xs font-medium text-amber-700 tabular-nums">
                  {effectiveCoachStars} sao
                </span>
              ) : (
                <span className="text-xs text-slate-400">Bắt buộc</span>
              )}
            </div>

            <select
              value={selectedGroupStars}
              onChange={(e) => {
                e.stopPropagation();
                setSelectedGroupStars(Number(e.target.value));
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-9 px-2.5 text-xs font-medium bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-[#17664e] cursor-pointer"
            >
              <option value={0}>Chọn số sao HLV hướng dẫn</option>
              {[1, 2, 3, 4, 5]
                .filter((s) => coaches.length === 0 || coaches.some((c) => (c.coachProfile?.ratingStars || 3) === s))
                .map((s) => {
                  const fee = sessionCount * (s * 1000);
                  const total = planPriceNum + fee;
                  return (
                    <option key={s} value={s}>
                      HLV {s} sao ({'★'.repeat(s)}) · {money(total)}
                    </option>
                  );
                })}
            </select>
            {effectiveCoachStars > 0 && coaches.length > 0 ? (
              <p className="text-xs text-slate-500 truncate">
                HLV:{' '}
                <span className="font-medium text-slate-700">
                  {coaches
                    .filter((c) => (c.coachProfile?.ratingStars || 3) === effectiveCoachStars)
                    .map((c) => c.fullName)
                    .join(", ") || "Đang cập nhật"}
                </span>
              </p>
            ) : null}
          </div>
        )}

        {/* Chọn HLV kèm riêng cho gói Gym PT 1-1 (VIP) */}
        {isVip && (
          <div className="space-y-2 p-3 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-700 inline-flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                <span>HLV kèm riêng ({effectiveCoachStars} sao)</span>
              </label>
              {activeCoach && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewCoachDetail?.(activeCoach);
                  }}
                  className="inline-flex items-center gap-0.5 text-[#17664e] hover:text-[#0f4d3a] font-medium shrink-0 cursor-pointer text-xs hover:underline"
                >
                  <span>Hồ sơ HLV</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={selectedCoachId || activeCoach?.id || ""}
              onChange={(e) => {
                e.stopPropagation();
                setSelectedCoachId(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-9 px-2.5 text-xs font-medium bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-[#17664e] cursor-pointer"
            >
              {coaches.length > 0 ? (
                coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.coachProfile?.ratingStars || effectiveCoachStars}★{c.coachProfile?.yearsExperience ? ` · ${c.coachProfile.yearsExperience} năm KN` : ''})
                  </option>
                ))
              ) : (
                <option value="">HLV {effectiveCoachStars} sao được chỉ định</option>
              )}
            </select>
          </div>
        )}

        {/* Smart 2-Column Quotas Strip (chỉ hiển thị quyền lợi đúng loại gói) */}
        <div className="grid grid-cols-2 divide-x divide-slate-200/80 bg-slate-50/80 py-2.5 px-3 rounded-xl border border-slate-200/80">
          <div className="flex items-center justify-center gap-2 pr-2">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <div className="text-left">
              <span className="text-[11px] text-slate-500 block leading-none">Thời hạn</span>
              <strong className="text-xs text-slate-900 font-semibold tabular-nums mt-1 block">
                {activePlan.durationDays} ngày
              </strong>
            </div>
          </div>

          {isDaily ? (
            <div className="flex items-center justify-center gap-2 pl-2">
              <Users className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
              <div className="text-left">
                <span className="text-[11px] text-slate-500 block leading-none">Số buổi</span>
                <strong className="text-xs text-slate-900 font-semibold tabular-nums mt-1 block">
                  {activePlan.groupSessionQuota || activePlan.ptSessionQuota || 1} buổi
                </strong>
              </div>
            </div>
          ) : isVip ? (
            <div className="flex items-center justify-center gap-2 pl-2">
              <UserCheck className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
              <div className="text-left">
                <span className="text-[11px] text-slate-500 block leading-none">Kèm 1:1</span>
                <strong className="text-xs text-slate-900 font-semibold tabular-nums mt-1 block">
                  {activePlan.ptSessionQuota ?? 0} buổi
                </strong>
              </div>
            </div>
          ) : isGroupPlan ? (
            <div className="flex items-center justify-center gap-2 pl-2">
              <Users className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
              <div className="text-left">
                <span className="text-[11px] text-slate-500 block leading-none">Lớp nhóm</span>
                <strong className="text-xs text-slate-900 font-semibold tabular-nums mt-1 block">
                  {activePlan.groupSessionQuota ?? 0} buổi
                </strong>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2 pl-2">
              <Dumbbell className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
              <div className="text-left">
                <span className="text-[11px] text-slate-500 block leading-none">Khu tập Gym</span>
                <strong className="text-xs text-slate-900 font-semibold mt-1 block">
                  Không giới hạn
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Perks Summary */}
        <div className="space-y-1.5 text-xs text-slate-600">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
            <span>{activePlan.unlimitedGymEntry ? "Ra vào phòng tập tự do" : "Tập luyện theo ca đăng ký"}</span>
          </p>
          <p className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
            <span>Tủ đồ thông minh Smart Locker &amp; Sauna</span>
          </p>
          {isVip && (
            <p className="flex items-center gap-2 text-slate-800 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Đặc quyền đặt lịch riêng cùng Huấn luyện viên</span>
            </p>
          )}
        </div>

        {/* Card Action Button */}
        <div className="pt-1">
          <Button
            type="button"
            variant="mint"
            disabled={isOrdering}
            onClick={(e) => {
              e.stopPropagation();
              if (isGroupPlan && (!selectedGroupStars || selectedGroupStars === 0)) {
                showToast('warning', 'Yêu cầu chọn sao HLV', 'Vui lòng chọn số sao HLV cho gói nhóm trước khi tiếp tục!');
                return;
              }
              onSelectPlan(activePlan, e, isVip ? activeCoach?.id : undefined, effectiveCoachStars);
            }}
            className={cn(
              "w-full h-10 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
              isVip
                ? "bg-slate-900 hover:bg-slate-800 text-white"
                : "bg-[#17664e] hover:bg-[#135641] text-white",
              isCurrentOrdering && "opacity-80 cursor-wait"
            )}
          >
            {isCurrentOrdering ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang tạo đơn hàng…</span>
              </>
            ) : (
              <>
                <span>{isVip ? "Chọn HLV & báo giá" : "Tiếp tục mua gói"}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </article>
  );
};

interface DisciplinePlanSectionProps {
  section: DisciplineSectionData;
  onOpenDetail: (plan: Plan, coachId?: string, coachStars?: number) => void;
  onSelectPlan: (plan: Plan, e?: React.MouseEvent, coachId?: string, coachStars?: number) => void;
  isOrdering: boolean;
  orderingPlanId?: string | null;
  coaches?: Coach[];
  onViewCoachDetail?: (coach: Coach) => void;
  starFilter?: string;
  preferredCoachId?: string;
}

const DisciplinePlanSection: React.FC<DisciplinePlanSectionProps> = ({
  section,
  onOpenDetail,
  onSelectPlan,
  isOrdering,
  orderingPlanId = null,
  coaches = [],
  onViewCoachDetail,
  starFilter,
  preferredCoachId,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollWidth > el.clientWidth + 8;
    setCanScroll(hasOverflow);
  }, []);

  const groupedPlans = useMemo(() => {
    const groups: Array<{
      key: string;
      primaryPlan: Plan;
      themeTitle: string;
      coachStars: number;
      coaches: Coach[];
      coachPlansMap: Record<string, Plan>;
    }> = [];

    for (const plan of section.plans) {
      const planDisc = (plan.discipline?.name || plan.discipline?.code || plan.disciplineId || "").toLowerCase();
      const isGym = planDisc.includes("gym") || plan.name.toLowerCase().includes("gym");
      const isDaily =
        plan.durationDays <= 1 ||
        plan.packageTier === "DROP_IN" ||
        plan.name.toLowerCase().includes("drop-in") ||
        plan.name.toLowerCase().includes("vé buổi") ||
        plan.name.toLowerCase().includes("vé ngày");
      const isVip = plan.packageTier === "VIP" || (plan.ptSessionQuota ?? 0) > 0;
      const isGroup = ((plan.groupSessionQuota ?? 0) > 0 || plan.trainingMode === "GROUP_CLASS") && !isGym && !isVip;
      const isGymPlus = isGym && plan.packageTier === "PLUS" && !isGroup && !isVip;

      // Filter coaches strictly qualified for this specific plan
      let planCoaches = coaches.filter((c) => isCoachQualifiedForPlan(c, plan));
      if (preferredCoachId && planCoaches.some((c) => c.id === preferredCoachId)) {
        planCoaches = [...planCoaches].sort((a, b) => {
          if (a.id === preferredCoachId) return -1;
          if (b.id === preferredCoachId) return 1;
          return 0;
        });
      }

      // 1. DAILY PASS (Vé buổi): No coaches
      if (isDaily) {
        if (!starFilter) {
          groups.push({
            key: plan.id,
            primaryPlan: plan,
            themeTitle: formatPlanName(plan.name),
            coachStars: 0,
            coaches: [],
            coachPlansMap: {},
          });
        }
        continue;
      }

      // 2. GYM PLUS: Không có coach! Tự tập, không nhân phí coach, không sao
      if (isGymPlus) {
        if (!starFilter) {
          groups.push({
            key: plan.id,
            primaryPlan: plan,
            themeTitle: formatPlanName(plan.name),
            coachStars: 0,
            coaches: [],
            coachPlansMap: {},
          });
        }
        continue;
      }

      // 3. GROUP PLANS (Yoga / Boxing / Zumba):
      // Mỗi loại gói nhóm có dropdown chọn sao trực tiếp trên thẻ (1..5 sao)
      if (isGroup) {
        if (starFilter) {
          const starCoaches = planCoaches.filter(
            (c) => (c.coachProfile?.ratingStars || 3) === Number(starFilter)
          );
          if (starCoaches.length === 0) continue;

          groups.push({
            key: `${plan.id}_group_${starFilter}star`,
            primaryPlan: { ...plan, coachRatingStars: Number(starFilter) },
            themeTitle: formatPlanName(plan.name),
            coachStars: Number(starFilter),
            coaches: starCoaches,
            coachPlansMap: {},
          });
        } else {
          groups.push({
            key: `${plan.id}_group`,
            primaryPlan: plan,
            themeTitle: formatPlanName(plan.name),
            coachStars: plan.coachRatingStars || 0,
            coaches: planCoaches,
            coachPlansMap: {},
          });
        }
        continue;
      }

      // 4. GYM PT / VIP 1:1 PLANS:
      if (isVip) {
        if (starFilter) {
          const starLevel = Number(starFilter);
          const starCoaches = planCoaches.filter(
            (c) => (c.coachProfile?.ratingStars || 3) === starLevel
          );

          if (starCoaches.length > 0) {
            groups.push({
              key: `${plan.id}_vip_${starLevel}star`,
              primaryPlan: { ...plan, coachRatingStars: starLevel },
              themeTitle: `${formatPlanName(plan.name)} - HLV ${starLevel} Sao`,
              coachStars: starLevel,
              coaches: starCoaches,
              coachPlansMap: {},
            });
          }
        } else {
          // Khi chọn "Tất cả sao", gom thành 1 thẻ VIP duy nhất có đầy đủ tất cả HLV các mức sao (1★ - 5★) trong dropdown
          groups.push({
            key: `${plan.id}_vip`,
            primaryPlan: plan,
            themeTitle: formatPlanName(plan.name),
            coachStars: plan.coachRatingStars || 0,
            coaches: planCoaches,
            coachPlansMap: {},
          });
        }
        continue;
      }

      // 5. Other plans
      if (!starFilter) {
        groups.push({
          key: plan.id,
          primaryPlan: plan,
          themeTitle: formatPlanName(plan.name),
          coachStars: 0,
          coaches: [],
          coachPlansMap: {},
        });
      }
    }

    if (preferredCoachId) {
      groups.sort((a, b) => {
        const aHas = a.coaches.some((c) => c.id === preferredCoachId);
        const bHas = b.coaches.some((c) => c.id === preferredCoachId);
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
      });
    }

    return groups;
  }, [section.plans, coaches, starFilter, preferredCoachId]);

  useEffect(() => {
    if (groupedPlans.length === 0) return;
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [checkScroll, groupedPlans]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollStep = 380; // Approximate card width + gap
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

  if (groupedPlans.length === 0) return null;

  return (
    <section className="space-y-4 pt-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[#17664e] flex items-center justify-center shrink-0 shadow-2xs">
            <DisciplineIconComponent nameOrCode={section.name || section.code || section.id} className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {section.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                {groupedPlans.length} gói
              </span>
            </div>
            <p className="text-xs text-slate-500 line-clamp-1">{section.tagline}</p>
          </div>
        </div>

        {/* Top Header Navigation Arrows */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleScroll("left")}
            disabled={!canScroll}
            aria-label={`Xem gói ${section.name} trước`}
            title="Xem gói trước"
            className={cn(
              "w-8 h-8 rounded-md border flex items-center justify-center transition-all duration-200 shadow-2xs",
              canScroll
                ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 cursor-pointer active:scale-95"
                : "bg-slate-50 border-slate-200/60 text-slate-300 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll("right")}
            disabled={!canScroll}
            aria-label={`Xem gói ${section.name} tiếp theo`}
            title="Xem gói tiếp theo"
            className={cn(
              "w-8 h-8 rounded-md border flex items-center justify-center transition-all duration-200 shadow-2xs",
              canScroll
                ? "bg-white border-slate-200 text-slate-700 hover:bg-slate-900 hover:text-white hover:border-slate-900 cursor-pointer active:scale-95"
                : "bg-slate-50 border-slate-200/60 text-slate-300 cursor-not-allowed"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row with Cards and Floating Arrows */}
      <div className="relative group/row">
        {/* Floating Left Arrow */}
        {canScroll && (
          <button
            type="button"
            onClick={() => handleScroll("left")}
            aria-label={`Cuộn trái ${section.name}`}
            className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-md bg-white/95 backdrop-blur-md shadow-md border border-slate-200/90 text-slate-800 hover:bg-slate-900 hover:text-white items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Horizontally scrollable card track */}
        <div
          ref={scrollRef}
          className="flex gap-4 sm:gap-5 overflow-x-auto scroll-smooth py-2 pb-4 px-0.5 snap-x snap-mandatory items-stretch scrollbar-thin scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400"
        >
          {groupedPlans.map((group) => (
            <PlanCard
              key={group.key}
              plan={group.primaryPlan}
              onOpenDetail={onOpenDetail}
              onSelectPlan={onSelectPlan}
              isOrdering={isOrdering}
              isCurrentOrdering={orderingPlanId === group.primaryPlan.id}
              coaches={group.coaches}
              coachPlansMap={group.coachPlansMap}
              onViewCoachDetail={onViewCoachDetail}
              themeTitle={group.themeTitle}
              coachStars={group.coachStars}
              preferredCoachId={preferredCoachId}
            />
          ))}
        </div>

        {/* Floating Right Arrow */}
        {canScroll && (
          <button
            type="button"
            onClick={() => handleScroll("right")}
            aria-label={`Cuộn phải ${section.name}`}
            className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-md bg-white/95 backdrop-blur-md shadow-md border border-slate-200/90 text-slate-800 hover:bg-slate-900 hover:text-white items-center justify-center transition-all duration-200 cursor-pointer active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </section>
  );
};

export const PlanCatalog: React.FC<PlanCatalogProps> = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const coachIdParam = searchParams.get("coachId") || undefined;
  const { showToast } = useNotification();
  const [disciplineId, setDisciplineId] = useState("");
  const [tier, setTier] = useState("");
  const [starFilter, setStarFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionError, setActionError] = useState("");
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<Plan | null>(null);
  const [viewingCoach, setViewingCoach] = useState<Coach | null>(null);

  const coachesQuery = useQuery({
    queryKey: ["coaches-all"],
    queryFn: () => coachApiService.getCoaches(),
  });
  const coachesList = coachesQuery.data || [];

  const preferredCoach = useMemo(() => {
    if (!coachIdParam || !coachesList.length) return null;
    return coachesList.find((c) => c.id === coachIdParam) || null;
  }, [coachIdParam, coachesList]);

  const disciplines = useQuery({
    queryKey: ["disciplines"],
    queryFn: () => get<Discipline[]>("/disciplines", true),
  });

  const rawPlans = useQuery({
    queryKey: memberKeys.catalog(disciplineId, tier === "GROUP" ? "" : tier),
    queryFn: () => {
      const apiTier = tier === "GROUP" ? "" : tier;
      return get<Plan[]>(`/memberships/plans${query({ disciplineId, packageTier: apiTier })}`, true);
    },
  });

  // Filter out FREE TRIAL and 0 VND plans completely as requested, and apply classification filter
  const filteredPlans = useMemo(() => {
    if (!rawPlans.data) return [];
    return rawPlans.data.filter((plan) => {
      const packageTier = (plan.packageTier || "").toUpperCase();
      const priceNum = Number(plan.price);
      const nameLower = (plan.name || "").toLowerCase();

      // Bỏ qua gói TRIAL, gói 0đ, hoặc gói dùng thử
      if (packageTier === "TRIAL") return false;
      if (isNaN(priceNum) || priceNum <= 0) return false;
      if (
        nameLower.includes("trial") ||
        nameLower.includes("thử") ||
        nameLower.includes("0đ") ||
        nameLower.includes("free")
      ) {
        return false;
      }

      const planDisc = (plan.discipline?.name || plan.discipline?.code || plan.disciplineId || "").toLowerCase();
      const isGym = planDisc.includes("gym") || plan.name.toLowerCase().includes("gym");
      const isVip = packageTier === "VIP" || (plan.ptSessionQuota ?? 0) > 0;
      const isGroup = ((plan.groupSessionQuota ?? 0) > 0 || plan.trainingMode === "GROUP_CLASS") && !isGym && !isVip;
      const isGymPlus = isGym && packageTier === "PLUS" && !isGroup && !isVip;
      const isDaily =
        plan.durationDays <= 1 ||
        packageTier === "DROP_IN" ||
        nameLower.includes("drop-in") ||
        nameLower.includes("vé buổi") ||
        nameLower.includes("vé ngày");

      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const hay = `${plan.name || ""} ${plan.discipline?.name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (tier === "GROUP") return isGroup;
      if (tier === "PLUS") return isGymPlus;
      if (tier === "VIP") return isVip;
      if (tier === "DROP_IN") return isDaily;

      return true;
    });
  }, [rawPlans.data, tier, searchQuery]);

  const cache = useQueryClient();
  const [orderingPlanId, setOrderingPlanId] = useState<string | null>(null);
  const [selectedPlanCoachId, setSelectedPlanCoachId] = useState<string | undefined>(undefined);
  const [selectedPlanStars, setSelectedPlanStars] = useState<number | undefined>(undefined);

  const order = useMutation({
    mutationFn: ({ plan, coachId, coachStars }: { plan: Plan; coachId?: string; coachStars?: number }) => {
      const cleanPlanId = plan?.id?.trim();
      if (!cleanPlanId) throw new Error("Mã gói tập không hợp lệ.");
      return createCheckout(user!.id, {
        kind: "NEW_SUBSCRIPTION",
        planId: cleanPlanId,
        coachId: coachId || undefined,
        coachRatingStars: coachStars || plan.coachRatingStars || undefined,
      });
    },
    onMutate: ({ plan }) => {
      setOrderingPlanId(plan.id);
    },
    onSuccess: (value) => {
      cache.setQueryData(memberKeys.checkout(user!.id, value.checkoutId), value);
      setSelectedPlanForModal(null);
      navigate(`/portal/member/checkouts/${value.checkoutId}`);
    },
    onError: (error) => {
      const msg = errorText(error);
      showToast('warning', 'Gói tập hiện có', msg);
      if (msg.includes('đổi coach') || msg.includes('Gói của tôi') || msg.includes('HLV khác')) {
        setActionError('');
      } else {
        setActionError(msg);
      }
    },
    onSettled: () => {
      setOrderingPlanId(null);
    },
  });

  function choose(plan: Plan, e?: React.MouseEvent, coachId?: string, coachStars?: number) {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (!user || user.role !== "MEMBER") {
      navigate("/auth/login", { state: { from: "/portal/member/plans" } });
      return;
    }
    if (!plan || !plan.id) {
      setActionError("Không tìm thấy thông tin gói tập hợp lệ.");
      return;
    }
    const planDisc = (plan.discipline?.name || plan.discipline?.code || plan.disciplineId || "").toLowerCase();
    const isGym = planDisc.includes("gym") || plan.name.toLowerCase().includes("gym");
    const isVipPlan = plan.packageTier === "VIP" || (plan.ptSessionQuota ?? 0) > 0;
    const isGroupPlan = ((plan.groupSessionQuota ?? 0) > 0 || plan.trainingMode === "GROUP_CLASS") && !isGym && !isVipPlan;
    const isGroupOrDaily =
      !isVipPlan &&
      (plan.packageTier === "PLUS" ||
        plan.packageTier === "DROP_IN" ||
        plan.durationDays <= 1 ||
        (plan.groupSessionQuota ?? 0) > 0 ||
        plan.trainingMode === "GROUP_CLASS");

    const effectiveStars = coachStars || plan.coachRatingStars;

    if (isGroupPlan && (!effectiveStars || effectiveStars === 0)) {
      setSelectedPlanForModal(plan);
      setSelectedPlanCoachId(undefined);
      setSelectedPlanStars(undefined);
      showToast('warning', 'Yêu cầu chọn sao HLV', 'Vui lòng chọn số sao HLV cho gói tập trước khi tiếp tục.');
      return;
    }

    if (isVipPlan && !coachId) {
      setSelectedPlanForModal(plan);
      setSelectedPlanCoachId(preferredCoach && isCoachQualifiedForPlan(preferredCoach, plan) ? coachIdParam : undefined);
      setSelectedPlanStars(effectiveStars || (starFilter ? Number(starFilter) : undefined));
      showToast('info', 'Chọn HLV kèm riêng', 'Vui lòng chọn Huấn luyện viên kèm riêng trong chi tiết gói để tiếp tục.');
      return;
    }
    setActionError("");
    order.mutate({ plan, coachId: isGroupOrDaily ? undefined : coachId, coachStars: effectiveStars });
  }

  // Disciplines list for interactive tabs
  const tabDisciplines: Discipline[] = useMemo(() => {
    if (disciplines.data && disciplines.data.length > 0) {
      return disciplines.data;
    }
    return defaultDisciplines;
  }, [disciplines.data]);

  // Group filtered plans by discipline from top to bottom
  const disciplineSections = useMemo(() => {
    // If a specific discipline is selected in tabs, only show that discipline
    const targetDisciplines = disciplineId
      ? tabDisciplines.filter((d) => d.id === disciplineId)
      : tabDisciplines;

    const sections: DisciplineSectionData[] = [];
    const assignedPlanIds = new Set<string>();

    for (const disc of targetDisciplines) {
      const normDisc = normalizeDiscipline(disc.name || disc.code || disc.id);
      const meta = normDisc !== "other" ? DISCIPLINE_PRESETS[normDisc] : null;

      const matchingPlans = filteredPlans.filter((plan) => {
        if (assignedPlanIds.has(plan.id)) return false;

        // 1. Direct ID match
        if (plan.disciplineId === disc.id || plan.discipline?.id === disc.id) return true;

        // 2. Code match
        if (
          disc.code &&
          plan.discipline?.code &&
          disc.code.toUpperCase() === plan.discipline.code.toUpperCase()
        ) {
          return true;
        }

        // 3. Normalized discipline match
        const planNorm = normalizeDiscipline(plan.discipline?.name || plan.name);
        if (normDisc !== "other" && planNorm === normDisc) {
          return true;
        }

        return false;
      });

      if (matchingPlans.length > 0) {
        matchingPlans.forEach((p) => assignedPlanIds.add(p.id));
        sections.push({
          id: disc.id,
          name: disc.name || meta?.name || "Bộ môn",
          code: disc.code || meta?.code,
          tagline:
            meta?.tagline || "Chương trình tập luyện tiêu chuẩn quốc tế cùng trang thiết bị hiện đại",
          plans: matchingPlans,
        });
      }
    }

    // Any remaining plans that were not matched to the target disciplines
    const remainingPlans = filteredPlans.filter((p) => !assignedPlanIds.has(p.id));
    if (remainingPlans.length > 0) {
      const fallbackGroups = new Map<string, Plan[]>();
      for (const p of remainingPlans) {
        const groupName = p.discipline?.name || "Khác";
        if (!fallbackGroups.has(groupName)) {
          fallbackGroups.set(groupName, []);
        }
        fallbackGroups.get(groupName)!.push(p);
      }
      for (const [groupName, pList] of fallbackGroups.entries()) {
        sections.push({
          id: `other-${groupName}`,
          name: groupName,
          tagline: "Các gói luyện tập đặc biệt được thiết kế riêng",
          plans: pList,
        });
      }
    }

    // Sort sections to prioritize the discipline of the preferred coach
    if (preferredCoach) {
      sections.sort((a, b) => {
        const aHas = a.plans.some((p) => isCoachQualifiedForPlan(preferredCoach, p));
        const bHas = b.plans.some((p) => isCoachQualifiedForPlan(preferredCoach, p));
        if (aHas && !bHas) return -1;
        if (!aHas && bHas) return 1;
        return 0;
      });
    }

    return sections;
  }, [disciplineId, tabDisciplines, filteredPlans, preferredCoach]);

  const totalCatalogCount = useMemo(() => {
    return disciplineSections.reduce((acc, s) => {
      let count = 0;
      for (const p of s.plans) {
        const planDisc = (p.discipline?.name || p.discipline?.code || p.disciplineId || "").toLowerCase();
        const isGym = planDisc.includes("gym") || p.name.toLowerCase().includes("gym");
        const isDaily = p.durationDays <= 1 || p.packageTier === "DROP_IN";
        const isVip = p.packageTier === "VIP" || (p.ptSessionQuota ?? 0) > 0;
        const isGroup = ((p.groupSessionQuota ?? 0) > 0 || p.trainingMode === "GROUP_CLASS") && !isGym && !isVip;
        if (isDaily || (isGym && p.packageTier === "PLUS" && !isVip)) {
          if (!starFilter) count++;
        } else if (isGroup) {
          if (!starFilter) {
            count++;
          } else {
            const hasCoach = coachesList.some(
              (c: Coach) => isCoachQualifiedForPlan(c, p) && (c.coachProfile?.ratingStars || 3) === Number(starFilter)
            );
            if (hasCoach) count++;
          }
        } else if (isVip) {
          if (!starFilter) {
            count++;
          } else {
            const hasCoach = coachesList.some(
              (c: Coach) => isCoachQualifiedForPlan(c, p) && (c.coachProfile?.ratingStars || 3) === Number(starFilter)
            );
            if (hasCoach) count++;
          }
        } else {
          if (!starFilter) count++;
        }
      }
      return acc + count;
    }, 0);
  }, [disciplineSections, starFilter, coachesList]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16">
      {/* FEATURED PLANS AUTO-SLIDING CAROUSEL (outside white box) */}
      {filteredPlans.length > 0 && (
        <section className="space-y-3">
          <PlanCarousel
            plans={filteredPlans}
            onOpenDetail={setSelectedPlanForModal}
            onSelectPlan={choose}
            isOrdering={order.isPending}
          />
        </section>
      )}

      {/* WHITE CARD WRAPPER FOR LOWER CATALOG CONTENT */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 md:p-8 space-y-8">
        {/* BANNER ƯU TIÊN HUẤN LUYỆN VIÊN ĐƯỢC CHỌN TỪ TAB HLV */}
        {preferredCoach && (
          <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#17664e] text-white flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden">
                {preferredCoach.avatarUrl ? (
                  <img src={preferredCoach.avatarUrl} alt={preferredCoach.fullName} className="w-full h-full object-cover" />
                ) : (
                  preferredCoach.fullName.slice(0, 2).toUpperCase()
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-[#17664e] shrink-0" />
                  <span className="text-xs font-medium text-emerald-900">
                    Đang ưu tiên hiển thị gói tập theo Huấn luyện viên
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-900 mt-0.5 tabular-nums">
                  {preferredCoach.fullName} · {preferredCoach.coachProfile?.ratingStars || 3} sao
                  {preferredCoach.coachProfile?.yearsExperience ? ` · ${preferredCoach.coachProfile.yearsExperience} năm kinh nghiệm` : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const nextParams = new URLSearchParams(searchParams);
                nextParams.delete("coachId");
                setSearchParams(nextParams);
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Xem tất cả gói</span>
            </button>
          </div>
        )}

        {/* FILTER & DISCIPLINE TABS CONTROLS */}
        <section className="space-y-4">
          {/* Discipline Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setDisciplineId("")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border",
                !disciplineId
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tất cả bộ môn</span>
            </button>

            {tabDisciplines.map((item) => {
              const isActive = disciplineId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDisciplineId(item.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap border",
                    isActive
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <DisciplineIconComponent
                    nameOrCode={item.name || item.code || item.id}
                    className={cn("w-3.5 h-3.5", isActive ? "text-emerald-400" : "text-slate-500")}
                  />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </div>

          {/* Search, Tier Filter Chips & Coach Stars Dropdown */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên gói tập"
                  className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#17664e] focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { value: "", label: "Tất cả loại" },
                    { value: "GROUP", label: "Lớp nhóm" },
                    { value: "VIP", label: "PT 1:1 (VIP)" },
                    { value: "PLUS", label: "Gym Plus" },
                    { value: "DROP_IN", label: "Vé buổi" },
                  ] as const
                ).map((item) => {
                  const active = tier === item.value;
                  return (
                    <button
                      key={item.value || "ALL"}
                      type="button"
                      onClick={() => setTier(item.value)}
                      className={cn(
                        "h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                        active
                          ? "bg-[#17664e] text-white"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <select
                value={starFilter}
                onChange={(e) => {
                  const newStar = e.target.value;
                  setStarFilter(newStar);
                  if (
                    newStar &&
                    preferredCoach &&
                    (preferredCoach.coachProfile?.ratingStars || 3) !== Number(newStar)
                  ) {
                    const nextParams = new URLSearchParams(searchParams);
                    nextParams.delete("coachId");
                    setSearchParams(nextParams);
                  }
                }}
                className="h-8 px-2.5 text-xs font-medium bg-white text-slate-800 border border-slate-200 rounded-lg focus:border-[#17664e] focus:outline-none cursor-pointer"
              >
                <option value="">Tất cả sao HLV</option>
                <option value="5">HLV 5 sao</option>
                <option value="4">HLV 4 sao</option>
                <option value="3">HLV 3 sao</option>
                <option value="2">HLV 2 sao</option>
                <option value="1">HLV 1 sao</option>
              </select>
            </div>

            <div className="flex items-center justify-between lg:justify-end gap-3">
              <span className="text-xs text-slate-500 tabular-nums">
                Hiển thị <strong className="text-slate-800 font-semibold">{totalCatalogCount}</strong> gói
              </span>
              {(disciplineId || tier || starFilter || searchQuery) ? (
                <button
                  type="button"
                  onClick={() => {
                    setDisciplineId("");
                    setTier("");
                    setStarFilter("");
                    setSearchQuery("");
                  }}
                  className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Xóa lọc</span>
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* STATE MESSAGES */}
        <StateMessage
          loading={rawPlans.isPending}
          error={rawPlans.error}
          onRetry={() => void rawPlans.refetch()}
          empty={!rawPlans.isPending && filteredPlans.length === 0}
        />

        {actionError && (
          <div className="p-3.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <span>{actionError}</span>
              {actionError.includes('Gói của tôi') && (
                <button
                  type="button"
                  onClick={() => navigate('/portal/member/subscriptions')}
                  className="px-2.5 py-1 rounded bg-[#17664e] text-white hover:bg-[#135641] font-bold text-xs shrink-0 cursor-pointer"
                >
                  Đến Gói của tôi
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActionError("")}
              className="text-rose-600 hover:text-rose-900 font-bold ml-2 shrink-0 cursor-pointer"
            >
              Đóng
            </button>
          </div>
        )}

        {/* DISCIPLINE SECTIONS (DIVIDED FROM TOP TO BOTTOM WITH HORIZONTAL SCROLL ROWS) */}
        {disciplineSections.length > 0 && (
          <div className="space-y-10">
            {disciplineSections.map((section) => (
              <DisciplinePlanSection
                key={section.id}
                section={section}
                onOpenDetail={(plan, coachId, coachStars) => {
                  setSelectedPlanForModal(plan);
                  setSelectedPlanCoachId(coachId || (preferredCoach && isCoachQualifiedForPlan(preferredCoach, plan) ? coachIdParam : undefined));
                  setSelectedPlanStars(coachStars || (starFilter ? Number(starFilter) : undefined) || plan.coachRatingStars);
                }}
                onSelectPlan={choose}
                isOrdering={order.isPending}
                orderingPlanId={orderingPlanId}
                coaches={coachesList}
                onViewCoachDetail={(c) => setViewingCoach(c)}
                starFilter={starFilter}
                preferredCoachId={coachIdParam}
              />
            ))}
          </div>
        )}
      </div>

      {/* FULL-SCREEN IMMERSIVE PLAN DETAIL MODAL */}
      <PlanDetailModal
        plan={selectedPlanForModal}
        isOpen={Boolean(selectedPlanForModal)}
        onClose={() => {
          if (!order.isPending) {
            setSelectedPlanForModal(null);
            setSelectedPlanCoachId(undefined);
            setSelectedPlanStars(undefined);
          }
        }}
        onSelectPlan={(plan, coachId, coachStars) => {
          choose(plan, undefined, coachId, coachStars ?? selectedPlanStars);
        }}
        isOrdering={order.isPending}
        coaches={coachesList}
        onViewCoachDetail={(c) => setViewingCoach(c)}
        coachStars={selectedPlanStars || (starFilter ? Number(starFilter) : undefined)}
        initialCoachId={selectedPlanCoachId}
      />

      {/* COACH DETAIL MODAL */}
      <CoachDetailModal
        coach={viewingCoach}
        isOpen={Boolean(viewingCoach)}
        onClose={() => setViewingCoach(null)}
      />
    </div>
  );
};

