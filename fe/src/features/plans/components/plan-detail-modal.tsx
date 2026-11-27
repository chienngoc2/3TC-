import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { money } from "@/lib/api";
import type { Plan } from "@/lib/types";
import type { Coach } from "@/features/coaches/types/coach.types";
import { getDisciplineGallery, type GalleryPhoto } from "./plan-images";
import { formatPlanName, formatPlanDescription, formatTierLabel } from "../lib/plan-formatter";
import { useNotification } from "@/context/notification-context";
import { isCoachQualifiedForPlan } from "@/lib/topic-matcher";
import {
  X,
  CheckCircle2,
  Sparkles,
  Clock,
  Users,
  UserCheck,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Flame,
  Dumbbell,
  Music,
  Activity,
  Award,
  Zap,
  Loader2,
  BookOpen,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlanDetailModalProps {
  plan: Plan | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectPlan: (plan: Plan, coachId?: string, coachStars?: number) => void;
  isOrdering?: boolean;
  coaches?: Coach[];
  onViewCoachDetail?: (coach: Coach) => void;
  coachStars?: number;
  initialCoachId?: string;
}

function ModalDisciplineIcon({ name, className }: { name?: string; className?: string }) {
  const lower = (name || "").toLowerCase();
  if (lower.includes("yoga")) return <Sparkles className={className} />;
  if (lower.includes("box") || lower.includes("combat")) return <Flame className={className} />;
  if (lower.includes("dance") || lower.includes("zumba")) return <Music className={className} />;
  if (lower.includes("gym")) return <Dumbbell className={className} />;
  return <Activity className={className} />;
}

export interface ConciseTopic {
  topicNumber: number;
  title: string;
  summary: string;
}

function getCurriculumTopics(plan?: Plan | null): ConciseTopic[] {
  const discStr = (plan?.discipline?.name || plan?.discipline?.code || plan?.disciplineId || plan?.name || "").toLowerCase();

  // If DB has curriculumTopics, parse strings or objects into concise items
  if (Array.isArray(plan?.curriculumTopics) && plan.curriculumTopics.length > 0) {
    const list = plan.curriculumTopics.map((item: any, idx: number): ConciseTopic => {
      if (typeof item === "string") {
        const parts = item.split(":");
        const content = parts.slice(1).join(":").trim() || item;
        const commaIdx = content.indexOf("&");
        const altComma = content.indexOf(",");
        const splitIdx = commaIdx > 0 ? commaIdx : altComma;
        const shortTitle = splitIdx > 0 ? content.slice(0, splitIdx).trim() : content.slice(0, 38).trim();
        const shortSummary = splitIdx > 0 ? content.slice(splitIdx + 1).trim() : content;
        return {
          topicNumber: idx + 1,
          title: `Chuyên đề ${idx + 1}: ${shortTitle}`,
          summary: shortSummary.slice(0, 80) + (shortSummary.length > 80 ? "..." : ""),
        };
      }
      if (item && typeof item === "object") {
        return {
          topicNumber: item.topicNumber || idx + 1,
          title: item.name || item.title || `Chuyên đề ${idx + 1}`,
          summary: item.description || item.benefits || item.summary || "Rèn luyện kỹ thuật chuyên sâu theo giáo án chuẩn.",
        };
      }
      return {
        topicNumber: idx + 1,
        title: `Chuyên đề ${idx + 1}`,
        summary: "Nội dung đào tạo thực hành chuyên sâu.",
      };
    });
    if (list.length >= 4) return list.slice(0, 4);
  }

  // Fallback 4 concise topics tailored to each discipline
  if (discStr.includes("yoga") || discStr.includes("thiền")) {
    return [
      {
        topicNumber: 1,
        title: "Chuyên đề 1: Thở Pranayama & Khởi động khớp",
        summary: "Kỹ thuật thở cơ hoành, làm ấm cơ thể và giải tỏa căng cứng cột sống.",
      },
      {
        topicNumber: 2,
        title: "Chuyên đề 2: Asana thăng bằng & Dẻo dai cột sống",
        summary: "Chuỗi tư thế chiến binh, kéo giãn gân kheo và nắn chỉnh trục cơ thể.",
      },
      {
        topicNumber: 3,
        title: "Chuyên đề 3: Vinyasa Flow kích hoạt cơ lõi (Core)",
        summary: "Chuyển động liên hoàn theo nhịp thở, siết cơ bụng và đốt calo tự nhiên.",
      },
      {
        topicNumber: 4,
        title: "Chuyên đề 4: Yin Yoga phục hồi & Thiền tĩnh tâm",
        summary: "Kéo giãn mạc cơ thụ động, giải tỏa 100% căng thẳng thần kinh và an thần.",
      },
    ];
  }

  if (discStr.includes("box") || discStr.includes("võ") || discStr.includes("kick")) {
    return [
      {
        topicNumber: 1,
        title: "Chuyên đề 1: Bộ pháp Footwork & 4 đòn tay cơ bản",
        summary: "Thế đứng thăng bằng, kỹ thuật đòn đấm Jab, Cross, Hook và Uppercut.",
      },
      {
        topicNumber: 2,
        title: "Chuyên đề 2: Kỹ năng phòng thủ, né đòn Slip / Weave",
        summary: "Phản xạ né đòn, đỡ gạt và bảo vệ vùng đầu an toàn trong giao chiến.",
      },
      {
        topicNumber: 3,
        title: "Chuyên đề 3: Tổ hợp Combo đòn & Đánh pad cùng HLV",
        summary: "Ghép chuỗi đòn liên hoàn, phát lực xoay hông và tối ưu tốc độ ra đòn.",
      },
      {
        topicNumber: 4,
        title: "Chuyên đề 4: Thể lực sàn đấu & Tự vệ thực chiến",
        summary: "Bài tập Circuit tim phổi, đối kháng mô phỏng an toàn và tự vệ phản xạ.",
      },
    ];
  }

  if (discStr.includes("zumba") || discStr.includes("dance") || discStr.includes("nhảy")) {
    return [
      {
        topicNumber: 1,
        title: "Chuyên đề 1: Cảm thụ nhịp điệu & Bước chân Merengue",
        summary: "Làm quen tiết tấu âm nhạc Latin, giải phóng chuyển động khớp hông.",
      },
      {
        topicNumber: 2,
        title: "Chuyên đề 2: Vũ điệu Cumbia & Reggaeton đốt mỡ",
        summary: "Cardio toàn thân bùng nổ, tăng sức bền và giải phóng calo hiệu quả.",
      },
      {
        topicNumber: 3,
        title: "Chuyên đề 3: Biên đạo vũ đạo nhóm hiện đại",
        summary: "Tổ hợp chuyển động sôi động, biểu cảm cơ thể tự tin và hòa nhịp nhóm.",
      },
      {
        topicNumber: 4,
        title: "Chuyên đề 4: Kéo giãn hạ nhiệt & Thư giãn cơ bắp",
        summary: "Hạ nhịp tim an toàn theo điệu nhạc nhẹ, ngăn nhức mỏi và giữ dáng thon.",
      },
    ];
  }

  // Default Gym & Fitness
  return [
    {
      topicNumber: 1,
      title: "Chuyên đề 1: Đánh giá thể trạng & Chuẩn hóa Squat, Deadlift",
      summary: "Kiểm tra sai lệch chuyển động, học chuẩn phom bài tập đa khớp phòng chấn thương.",
    },
    {
      topicNumber: 2,
      title: "Chuyên đề 2: Nhóm cơ ngực, vai và lưng xô",
      summary: "Tập luyện với dàn máy Technogym và tạ tự do định hình thân trên vạm vỡ.",
    },
    {
      topicNumber: 3,
      title: "Chuyên đề 3: Sức mạnh chi dưới & Cơ trọng tâm (Core)",
      summary: "Phát triển đùi mông săn chắc, tăng trao đổi chất nền và đốt mỡ thụ động.",
    },
    {
      topicNumber: 4,
      title: "Chuyên đề 4: Progressive Overload & Dinh dưỡng",
      summary: "Phương pháp tăng tiến tải trọng, kỹ thuật kích thích phì đại cơ bắp bền vững.",
    },
  ];
}

export const PlanDetailModal: React.FC<PlanDetailModalProps> = ({
  plan,
  isOpen,
  onClose,
  onSelectPlan,
  isOrdering = false,
  coaches = [],
  onViewCoachDetail,
  coachStars,
  initialCoachId,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [prevPlanId, setPrevPlanId] = useState(plan?.id);
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(initialCoachId || null);
  const [showCurriculumModal, setShowCurriculumModal] = useState(false);

  useEffect(() => {
    if (initialCoachId) {
      setSelectedCoachId(initialCoachId);
    }
  }, [initialCoachId]);

  if (plan?.id !== prevPlanId) {
    setPrevPlanId(plan?.id);
    setActivePhotoIndex(0);
    setSelectedCoachId(initialCoachId || null);
    setShowCurriculumModal(false);
  }

  // Filter gallery to strictly include only photos of this specific discipline
  const photos = useMemo(() => {
    if (!plan) return [];
    return getDisciplineGallery(
      plan.discipline?.name || plan.discipline?.code || plan.disciplineId,
      plan.name
    );
  }, [plan]);

  // Match eligible coaches strictly for this plan's discipline and specialty
  const candidateCoaches = useMemo(() => {
    if (!plan || !coaches || coaches.length === 0) return [];
    const qualified = coaches.filter((c) => isCoachQualifiedForPlan(c, plan));
    if (coachStars) {
      const byStars = qualified.filter((c) => (c.coachProfile?.ratingStars || 3) === coachStars);
      if (byStars.length > 0) return byStars;
    }
    return qualified;
  }, [plan, coaches, coachStars]);

  const activeCoach = candidateCoaches.find((c) => c.id === selectedCoachId) || candidateCoaches[0];

  // Dynamic sample schedule derived from the active coach's DB profile
  const activeCoachSchedule = useMemo(() => {
    if (!activeCoach) return null;
    const workingDays = activeCoach.coachProfile?.workingDays || [];
    const workingHours = activeCoach.coachProfile?.workingHours || [];
    if (workingDays.length === 0 && workingHours.length === 0) return null;

    const dayMap: Record<string, string> = {
      MONDAY: "Thứ 2",
      TUESDAY: "Thứ 3",
      WEDNESDAY: "Thứ 4",
      THURSDAY: "Thứ 5",
      FRIDAY: "Thứ 6",
      SATURDAY: "Thứ 7",
      SUNDAY: "Chủ Nhật",
      T2: "Thứ 2",
      T3: "Thứ 3",
      T4: "Thứ 4",
      T5: "Thứ 5",
      T6: "Thứ 6",
      T7: "Thứ 7",
      CN: "Chủ Nhật",
    };

    const dayOrderMap: Record<string, number> = {
      MONDAY: 1, T2: 1, "Thứ 2": 1,
      TUESDAY: 2, T3: 2, "Thứ 3": 2,
      WEDNESDAY: 3, T4: 3, "Thứ 4": 3,
      THURSDAY: 4, T5: 4, "Thứ 5": 4,
      FRIDAY: 5, T6: 5, "Thứ 6": 5,
      SATURDAY: 6, T7: 6, "Thứ 7": 6,
      SUNDAY: 7, CN: 7, "Chủ Nhật": 7,
    };

    const formattedDays = (Array.isArray(workingDays) ? workingDays : [])
      .map((d: string) => dayMap[d] || d)
      .sort((a, b) => (dayOrderMap[a] || 9) - (dayOrderMap[b] || 9));

    const rawShifts = Array.isArray(workingHours) ? workingHours : [];
    const anyHasDay = rawShifts.some((w: any) => Boolean(w && typeof w === "object" && w.day));
    const timeGroupMap = new Map<string, {
      shift: string;
      start: string;
      end: string;
      days: Set<string>;
    }>();

    for (const whItem of rawShifts) {
      if (!whItem) continue;
      const wh = whItem as any;
      let start = "08:00";
      let end = "12:00";
      let shiftName: string | undefined;
      let dayName: string | undefined;

      if (typeof wh === "string") {
        const match = wh.match(/start=([0-9:]+).*end=([0-9:]+)/i) || wh.match(/([0-9:]+)\s*-\s*([0-9:]+)/);
        if (match) {
          start = match[1];
          end = match[2];
        }
      } else if (typeof wh === "object") {
        start = wh.start || wh.from || start;
        end = wh.end || wh.to || end;
        shiftName = wh.shift;
        if (wh.day) {
          const upperDay = String(wh.day).toUpperCase().trim();
          dayName = dayMap[upperDay] || (wh.day.startsWith("Thứ") || wh.day === "Chủ Nhật" ? wh.day : `Thứ ${wh.day}`);
        }
      }

      const inferredShift = shiftName || (start < "12:00" ? "Ca Sáng" : start < "18:00" ? "Ca Chiều" : "Ca Tối");
      const timeKey = `${start}-${end}`;

      if (!timeGroupMap.has(timeKey)) {
        timeGroupMap.set(timeKey, {
          shift: inferredShift,
          start,
          end,
          days: new Set<string>(),
        });
      }

      const entry = timeGroupMap.get(timeKey)!;
      if (dayName) {
        entry.days.add(dayName);
      } else if (!anyHasDay) {
        formattedDays.forEach((d) => entry.days.add(d));
      }
    }

    // Convert map to list of shifts and sort days within each shift
    const parsedShifts = Array.from(timeGroupMap.values())
      .map((group) => {
        const sortedDays = Array.from(group.days).sort(
          (a, b) => (dayOrderMap[a] || 9) - (dayOrderMap[b] || 9)
        );
        return {
          shift: group.shift,
          time: `${group.start} - ${group.end}`,
          focus: `Khung giờ nhận kèm trực tiếp của HLV ${activeCoach.fullName}`,
          days: sortedDays.length > 0 ? sortedDays : (anyHasDay ? [] : formattedDays),
        };
      })
      .sort((a, b) => a.time.localeCompare(b.time));

    const shifts =
      parsedShifts.length > 0
        ? parsedShifts
        : [
            {
              shift: "Lịch rảnh đăng ký",
              time: "08:00 - 12:00",
              focus: `Khung giờ nhận kèm trực tiếp của HLV ${activeCoach.fullName}`,
              days: formattedDays.length > 0 ? formattedDays : ["Thứ 2", "Thứ 4", "Thứ 6"],
            },
          ];

    const byDay = new Map<string, Array<{ shift: string; time: string; start: string }>>();
    for (const d of formattedDays) {
      if (!byDay.has(d)) byDay.set(d, []);
    }
    for (const s of shifts) {
      const targetDays = s.days.length > 0 ? s.days : formattedDays;
      for (const d of targetDays) {
        if (formattedDays.length > 0 && !byDay.has(d)) continue;
        if (!byDay.has(d)) byDay.set(d, []);
        const list = byDay.get(d)!;
        const start = s.time.split("-")[0]?.trim() || "00:00";
        if (!list.some((x) => x.time === s.time)) {
          list.push({ shift: s.shift, time: s.time, start });
        }
      }
    }

    const scheduleByDay = Array.from(byDay.entries())
      .map(([dayLabel, slots]) => ({
        dayLabel,
        slots: [...slots].sort((a, b) => a.start.localeCompare(b.start)),
      }))
      .sort((a, b) => (dayOrderMap[a.dayLabel] || 99) - (dayOrderMap[b.dayLabel] || 99));

    return {
      coachName: activeCoach.fullName,
      daysCount: scheduleByDay.length || formattedDays.length || 3,
      shifts,
      scheduleByDay,
    };
  }, [activeCoach]);

  const displayCurriculumTopics = useMemo(() => getCurriculumTopics(plan), [plan]);

  const isGym = Boolean(
    plan &&
      ((plan.discipline?.code || plan.discipline?.name || plan.disciplineId || "").toLowerCase().includes("gym") ||
        plan.name.toLowerCase().includes("gym"))
  );
  const isDaily = Boolean(
    plan &&
      (plan.durationDays <= 1 ||
        plan.packageTier === "DROP_IN" ||
        plan.name.toLowerCase().includes("drop-in") ||
        plan.name.toLowerCase().includes("vé buổi") ||
        plan.name.toLowerCase().includes("vé ngày"))
  );
  const isVip = Boolean(plan && (plan.packageTier === "VIP" || (plan.ptSessionQuota ?? 0) > 0));
  const isGroupPlan = Boolean(plan && ((plan.groupSessionQuota ?? 0) > 0 || plan.trainingMode === "GROUP_CLASS") && !isGym && !isVip);
  const isGymPlus = Boolean(isGym && plan?.packageTier === "PLUS" && !isGroupPlan && !isVip);

  const { showToast } = useNotification();
  const [selectedGroupStars, setSelectedGroupStars] = useState<number>(coachStars || plan?.coachRatingStars || 0);
  useEffect(() => {
    setSelectedGroupStars(coachStars || plan?.coachRatingStars || 0);
  }, [coachStars, plan?.id, plan?.coachRatingStars]);

  const effectiveCoachStars = (!isDaily && !isGymPlus)
    ? (isGroupPlan
        ? selectedGroupStars
        : isVip
          ? (activeCoach?.coachProfile?.ratingStars || coachStars || plan?.coachRatingStars || 0)
          : (coachStars || plan?.coachRatingStars || 0))
    : 0;
  const sessionCount = isVip ? (plan?.ptSessionQuota || 12) : (plan?.groupSessionQuota || 12);
  const resolveVipRate = () => {
    const profileRate = Number(activeCoach?.coachProfile?.ratePerSession);
    if (Number.isFinite(profileRate) && profileRate > 0) return profileRate;
    const profileStars = activeCoach?.coachProfile?.ratingStars;
    if (profileStars && profileStars > 0) return profileStars * 1000;
    const activeRateRow =
      activeCoach?.coachRates?.find((r) => !r.effectiveTo) || activeCoach?.coachRates?.[0];
    const tableRate = Number(activeRateRow?.ratePerSession);
    if (Number.isFinite(tableRate) && tableRate > 0) return tableRate;
    return effectiveCoachStars ? effectiveCoachStars * 1000 : 3000;
  };
  const coachRate = isGroupPlan
    ? (effectiveCoachStars * 1000)
    : resolveVipRate();
  const coachMonthlyFee = sessionCount * coachRate;
  const planPriceNum = Number(plan?.price) || 0;
  const totalMonthlyFee = isGroupPlan
    ? (selectedGroupStars > 0 ? (planPriceNum + coachMonthlyFee) : planPriceNum)
    : isVip
    ? (planPriceNum + coachMonthlyFee)
    : planPriceNum;

  // Handle ESC key and arrow keys to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      if (photos.length > 1) {
        if (e.key === "ArrowLeft") {
          setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
        }
        if (e.key === "ArrowRight") {
          setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
        }
      }
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, photos.length]);

  if (!isOpen || !plan || photos.length === 0) return null;

  const activePhoto: GalleryPhoto = photos[activePhotoIndex] || photos[0];
  const isPlus = plan.packageTier === "PLUS";

  const nextPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const prevPhoto = () => {
    if (photos.length <= 1) return;
    setActivePhotoIndex((prev) => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  // Render via portal directly to body so it covers 100% of the viewport cleanly
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm select-none overflow-hidden"
    >
      {/* CENTERED MODERN SPLIT MODAL */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl border border-slate-200/80 shadow-2xl flex flex-col lg:flex-row overflow-hidden"
      >
        {/* LEFT: PHOTO STAGE */}
        <div className="relative lg:w-[46%] bg-slate-900 overflow-hidden flex flex-col justify-between min-h-[240px] sm:min-h-[300px] lg:min-h-full shrink-0">
          <div className="absolute inset-0 overflow-hidden">
            <img
              key={activePhoto.id}
              src={activePhoto.url}
              alt={activePhoto.title}
              className="w-full h-full object-cover object-center transition-opacity duration-300 brightness-95"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-slate-950/30 pointer-events-none" />
          </div>

          {/* Top Bar on Photo */}
          <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/60 backdrop-blur-md border border-white/15 text-xs font-medium text-white">
              <ModalDisciplineIcon name={plan.discipline?.name} className="w-3.5 h-3.5 text-emerald-400" />
              <span>{plan.discipline?.name || "Bộ môn"}</span>
            </span>

            <button
              type="button"
              onClick={onClose}
              className="lg:hidden p-2 rounded-lg bg-slate-950/60 hover:bg-slate-950/85 text-white border border-white/15 transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <div className="relative z-10 px-4 flex items-center justify-between pointer-events-none">
              <button
                type="button"
                onClick={prevPhoto}
                className="pointer-events-auto w-9 h-9 rounded-full bg-slate-950/60 hover:bg-slate-950/85 text-white border border-white/15 backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer"
                title="Ảnh trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextPhoto}
                className="pointer-events-auto w-9 h-9 rounded-full bg-slate-950/60 hover:bg-slate-950/85 text-white border border-white/15 backdrop-blur-md flex items-center justify-center transition-colors cursor-pointer"
                title="Ảnh tiếp theo"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Bottom Caption & Thumbnails */}
          <div className="relative z-10 p-4 sm:p-5 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-medium">
                  {activePhoto.tag}
                </span>
                <span className="text-[11px] text-slate-300 tabular-nums">
                  {activePhotoIndex + 1} / {photos.length}
                </span>
              </div>
              <h3 className="text-base font-semibold text-white leading-snug">
                {activePhoto.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
              {photos.map((photo, idx) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setActivePhotoIndex(idx)}
                  className={cn(
                    "relative shrink-0 w-16 h-11 rounded-lg overflow-hidden border transition-opacity cursor-pointer",
                    activePhotoIndex === idx
                      ? "border-emerald-400 ring-2 ring-emerald-400/40 opacity-100"
                      : "border-white/25 opacity-60 hover:opacity-100"
                  )}
                  title={photo.title}
                >
                  <img
                    src={photo.url}
                    alt={photo.title}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: CLEAN STUDIO PLAN DOSSIER */}
        <div className="relative flex-1 bg-white text-slate-900 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5">
            {/* Top Row: Badges & Close */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border",
                    isVip
                      ? "bg-slate-900 text-amber-200 border-slate-900"
                      : isPlus
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  {isGroupPlan ? "Gói nhóm" : isGymPlus ? "Gym Plus" : formatTierLabel(plan.packageTier)}
                </span>

                {!isDaily && !isGymPlus && effectiveCoachStars > 0 && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-900 border border-amber-200 tabular-nums">
                    <Award className="w-3.5 h-3.5 text-amber-600" />
                    <span>HLV {effectiveCoachStars} sao</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Đóng (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Title & Short Summary */}
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight leading-snug">
                {formatPlanName(plan.name)}{!isDaily && !isGymPlus && effectiveCoachStars > 0 ? ` · HLV ${effectiveCoachStars} sao` : ""}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-2">
                {formatPlanDescription(plan.description)}
              </p>
            </div>

            {/* Price & Smart 2-Column Quotas */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl sm:text-3xl font-semibold text-slate-900 tabular-nums tracking-tight">
                    {money(totalMonthlyFee)}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    / {plan.durationDays} ngày
                  </span>
                </div>
                {isGroupPlan && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800">
                    <Clock className="w-3.5 h-3.5 text-[#17664e]" />
                    Giờ linh hoạt
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-slate-500 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Thời hạn</div>
                    <div className="text-xs font-semibold text-slate-900 tabular-nums">{plan.durationDays} ngày</div>
                  </div>
                </div>

                {isDaily ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-[#17664e] shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Số buổi</div>
                      <div className="text-xs font-semibold text-slate-900 tabular-nums">
                        {plan.groupSessionQuota || plan.ptSessionQuota || 1} buổi
                      </div>
                    </div>
                  </div>
                ) : isVip ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-[#17664e] shrink-0">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Kèm riêng 1:1</div>
                      <div className="text-xs font-semibold text-slate-900 tabular-nums">
                        {plan.ptSessionQuota ?? 0} buổi
                      </div>
                    </div>
                  </div>
                ) : isGroupPlan ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-[#17664e] shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Lớp nhóm</div>
                      <div className="text-xs font-semibold text-slate-900 tabular-nums">
                        {plan.groupSessionQuota ?? 0} buổi
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center text-[#17664e] shrink-0">
                      <Dumbbell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Khu tập Gym</div>
                      <div className="text-xs font-semibold text-slate-900">Không giới hạn</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chọn số sao HLV cho gói nhóm */}
            {isGroupPlan && (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Chọn hạng HLV hướng dẫn</span>
                  </label>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {effectiveCoachStars > 0 ? `${effectiveCoachStars} sao` : "Bắt buộc"}
                  </span>
                </div>
                <select
                  value={selectedGroupStars}
                  onChange={(e) => setSelectedGroupStars(Number(e.target.value))}
                  className="w-full h-9 px-3 text-xs font-medium bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-[#17664e] cursor-pointer"
                >
                  <option value={0}>Chọn số sao HLV</option>
                  {[1, 2, 3, 4, 5]
                    .filter((s) => coaches.length === 0 || coaches.some((c) => isCoachQualifiedForPlan(c, plan) && (c.coachProfile?.ratingStars || 3) === s))
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
                {effectiveCoachStars > 0 && candidateCoaches.length > 0 && (
                  <p className="text-xs text-slate-500 truncate">
                    HLV phụ trách:{" "}
                    <span className="font-medium text-slate-800">
                      {candidateCoaches
                        .filter((c) => (c.coachProfile?.ratingStars || 3) === effectiveCoachStars)
                        .map((c) => c.fullName)
                        .join(", ") || "Đang cập nhật"}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Coach Section (CHỈ HIỆN Ở GÓI GYM VIP) */}
            {isVip && activeCoach ? (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-[#17664e]" />
                    <span>HLV kèm riêng ({activeCoach.coachProfile?.ratingStars || 3} sao)</span>
                  </span>
                  {onViewCoachDetail && (
                    <button
                      type="button"
                      onClick={() => onViewCoachDetail(activeCoach)}
                      className="text-xs font-medium text-[#17664e] hover:underline cursor-pointer shrink-0"
                    >
                      Hồ sơ HLV →
                    </button>
                  )}
                </div>

                {candidateCoaches.length > 1 ? (
                  <select
                    value={selectedCoachId || activeCoach.id}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full h-9 px-3 text-xs font-medium bg-white text-slate-900 border border-slate-200 rounded-lg focus:outline-none focus:border-[#17664e] cursor-pointer"
                  >
                    {candidateCoaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.coachProfile?.ratingStars || 3}★{c.coachProfile?.yearsExperience ? ` · ${c.coachProfile.yearsExperience} năm KN` : ''})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span className="font-medium text-slate-900">{activeCoach.fullName}</span>
                    <span>
                      {activeCoach.coachProfile?.yearsExperience ? `${activeCoach.coachProfile.yearsExperience} năm kinh nghiệm` : 'HLV tiêu chuẩn'}
                    </span>
                  </div>
                )}
              </div>
            ) : null}

            {/* Lịch mẫu theo từng thứ */}
            {!isGroupPlan && activeCoachSchedule ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-medium text-slate-600">Khung giờ làm việc ({activeCoachSchedule.coachName})</h4>
                  <span className="text-xs text-slate-400 tabular-nums">{activeCoachSchedule.daysCount} ngày/tuần</span>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden">
                  {activeCoachSchedule.scheduleByDay.map((row) => (
                    <div
                      key={row.dayLabel}
                      className="px-3.5 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
                    >
                      <div className="flex items-center gap-2 w-24 shrink-0">
                        <Calendar className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                        <span className="font-semibold text-slate-900">{row.dayLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap flex-1 sm:justify-end">
                        {row.slots.length > 0 ? (
                          row.slots.map((slot, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200/90 text-slate-800 font-medium tabular-nums"
                            >
                              <span className="text-slate-500">{slot.shift}</span>
                              <span className="text-slate-900 font-semibold">{slot.time}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400">Linh hoạt</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Chuyên đề khóa học (gọn 2x2) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-medium text-slate-600">
                  Chuyên đề khóa học ({displayCurriculumTopics.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setShowCurriculumModal(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#17664e] hover:underline cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Xem chi tiết</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {displayCurriculumTopics.map((topic, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-md bg-emerald-50 text-[#17664e] text-xs font-semibold flex items-center justify-center shrink-0 tabular-nums border border-emerald-200/80">
                      {topic.topicNumber || idx + 1}
                    </span>
                    <span className="text-xs font-medium text-slate-800 truncate">
                      {topic.title.replace(/^Chuyên đề \d+:\s*/i, "")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quyền lợi chính (ngắn gọn) */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-slate-600">Quyền lợi đi kèm</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                  <span>{plan.unlimitedGymEntry ? "Ra vào tự do không giới hạn" : "Tập luyện theo lịch đăng ký"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                  <span>Smart Locker &amp; Sauna miễn phí</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                  <span>Đo chỉ số InBody định kỳ</span>
                </div>
                {isVip && (
                  <div className="flex items-center gap-2 text-slate-800 font-medium">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Đặt lịch riêng 1:1 cùng HLV</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="p-5 sm:px-7 sm:py-4 border-t border-slate-200/80 bg-slate-50/60 space-y-2 shrink-0">
            <button
              type="button"
              disabled={isOrdering}
              onClick={() => {
                if (isGroupPlan && (!selectedGroupStars || selectedGroupStars === 0)) {
                  showToast('warning', 'Yêu cầu chọn sao HLV', 'Vui lòng chọn số sao HLV cho gói tập trước khi tiếp tục!');
                  return;
                }
                onSelectPlan(plan, isGroupPlan || isDaily ? undefined : activeCoach?.id, effectiveCoachStars);
              }}
              className={cn(
                "w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer",
                isVip
                  ? "bg-slate-900 hover:bg-slate-800 text-white"
                  : "bg-[#17664e] hover:bg-[#135641] text-white",
                isOrdering && "opacity-80 cursor-wait"
              )}
            >
              {isOrdering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang tạo hóa đơn…</span>
                </>
              ) : (
                <>
                  <span>{isVip ? "Tiếp tục thanh toán" : "Tiếp tục mua gói"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="w-3.5 h-3.5 text-[#17664e]" />
              <span>Hỗ trợ bảo lưu và chuyển nhượng theo quy chế</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. MODAL CHI TIẾT CHUYÊN ĐỀ ĐÀO TẠO */}
      {showCurriculumModal && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowCurriculumModal(false);
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl max-h-[82vh] bg-white border border-slate-200 shadow-2xl flex flex-col rounded-2xl overflow-hidden text-slate-900"
          >
            <div className="px-5 py-4 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#17664e] flex items-center justify-center border border-emerald-200/80">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Chi tiết chuyên đề đào tạo
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatPlanName(plan.name)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCurriculumModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {displayCurriculumTopics.map((topic, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1.5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-emerald-50 text-[#17664e] text-xs font-semibold flex items-center justify-center shrink-0 tabular-nums border border-emerald-200">
                      {topic.topicNumber || idx + 1}
                    </span>
                    <h4 className="text-sm font-semibold text-slate-900">
                      {topic.title}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pl-8">
                    {topic.summary}
                  </p>
                </div>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-slate-200/80 bg-slate-50/60 flex justify-end">
              <button
                type="button"
                onClick={() => setShowCurriculumModal(false)}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
