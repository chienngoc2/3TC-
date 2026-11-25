import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Mail,
  Tag,
  DollarSign,
  ChevronRight,
  FileText,
  AlertTriangle,
  CreditCard,
  Calendar,
  Clock,
} from "lucide-react";
import { money, get } from "@/lib/api";
import type { Plan } from "@/lib/types";
import { useAuth } from "@/context/auth-context";
import { getPlansForCoach } from "@/lib/topic-matcher";
import type { Coach, CoachAvailabilitySlot } from "../types/coach.types";
import { coachApiService } from "../services/coach-api.service";
import { DisciplineIcon } from "./discipline-icon";
import { getInitials } from "../utils/coach.utils";

export interface CoachDetailModalProps {
  coach: Coach | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectSlot?: (coach: Coach, slot: CoachAvailabilitySlot) => void;
}

export const CoachDetailModal: React.FC<CoachDetailModalProps> = ({
  coach,
  isOpen,
  onClose,
  onSelectSlot: _onSelectSlot,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  // 1. Fetch full coach detail
  const coachDetailQuery = useQuery({
    queryKey: ["coach-detail", coach?.id],
    queryFn: () => (coach?.id ? coachApiService.getCoachDetail(coach.id) : Promise.reject()),
    enabled: Boolean(isOpen && coach?.id),
    staleTime: 30000,
  });

  const activeCoach = coachDetailQuery.data || coach;

  // Registered recurring schedule from coach profile API
  const registeredWorkingHours = useMemo(() => {
    const list = activeCoach?.coachProfile?.workingHours || [];
    if (!Array.isArray(list)) return [];

    const dayMap: Record<string, string> = {
      MONDAY: "Thứ 2", T2: "Thứ 2",
      TUESDAY: "Thứ 3", T3: "Thứ 3",
      WEDNESDAY: "Thứ 4", T4: "Thứ 4",
      THURSDAY: "Thứ 5", T5: "Thứ 5",
      FRIDAY: "Thứ 6", T6: "Thứ 6",
      SATURDAY: "Thứ 7", T7: "Thứ 7",
      SUNDAY: "Chủ Nhật", CN: "Chủ Nhật",
    };

    const dayOrderMap: Record<string, number> = {
      "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6, "Chủ Nhật": 7,
    };

    const timeGroupMap = new Map<string, {
      shift: string;
      start: string;
      end: string;
      days: Set<string>;
    }>();

    for (const whItem of list) {
      if (!whItem) continue;
      const wh = whItem as any;
      let start = "08:00";
      let end = "12:00";
      let shiftName: string | undefined;
      let dayName: string | undefined;

      if (typeof wh === "string") {
        const s = wh.trim();
        if (s === "—" || s === "-" || s.match(/^[—–\-\s]+$/)) continue;
        const match = s.match(/start=([0-9:]+).*end=([0-9:]+)/i) || s.match(/([0-9:]+)\s*[-–]\s*([0-9:]+)/);
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

      if (start === "—" || end === "—" || start === "-" || end === "-") continue;

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
      }
    }

    return Array.from(timeGroupMap.values()).map((group) => {
      const sortedDays = Array.from(group.days).sort(
        (a, b) => (dayOrderMap[a] || 9) - (dayOrderMap[b] || 9)
      );
      return {
        shift: group.shift,
        start: group.start,
        end: group.end,
        label: `${group.start} - ${group.end}`,
        days: sortedDays,
      };
    }).sort((a, b) => a.start.localeCompare(b.start));
  }, [activeCoach?.coachProfile?.workingHours]);

  const registeredWorkingDays = useMemo(() => {
    const days = activeCoach?.coachProfile?.workingDays || [];
    if (!Array.isArray(days)) return [];
    const dayOrderMap: Record<string, { rank: number; label: string }> = {
      MONDAY: { rank: 1, label: 'Thứ 2' },
      T2: { rank: 1, label: 'Thứ 2' },
      TUESDAY: { rank: 2, label: 'Thứ 3' },
      T3: { rank: 2, label: 'Thứ 3' },
      WEDNESDAY: { rank: 3, label: 'Thứ 4' },
      T4: { rank: 3, label: 'Thứ 4' },
      THURSDAY: { rank: 4, label: 'Thứ 5' },
      T5: { rank: 4, label: 'Thứ 5' },
      FRIDAY: { rank: 5, label: 'Thứ 6' },
      T6: { rank: 5, label: 'Thứ 6' },
      SATURDAY: { rank: 6, label: 'Thứ 7' },
      T7: { rank: 6, label: 'Thứ 7' },
      SUNDAY: { rank: 7, label: 'Chủ Nhật' },
      CN: { rank: 7, label: 'Chủ Nhật' },
    };

    const formatDay = (raw: string): { rank: number; label: string } => {
      const upper = String(raw).toUpperCase().trim();
      if (dayOrderMap[upper]) return dayOrderMap[upper];
      if (upper.includes('MON') || upper.includes('2')) return { rank: 1, label: 'Thứ 2' };
      if (upper.includes('TUE') || upper.includes('3')) return { rank: 2, label: 'Thứ 3' };
      if (upper.includes('WED') || upper.includes('4')) return { rank: 3, label: 'Thứ 4' };
      if (upper.includes('THU') || upper.includes('5')) return { rank: 4, label: 'Thứ 5' };
      if (upper.includes('FRI') || upper.includes('6')) return { rank: 5, label: 'Thứ 6' };
      if (upper.includes('SAT') || upper.includes('7')) return { rank: 6, label: 'Thứ 7' };
      if (upper.includes('SUN') || upper.includes('CN')) return { rank: 7, label: 'Chủ Nhật' };
      return { rank: 99, label: raw.startsWith('Thứ') || raw === 'Chủ Nhật' ? raw : `Thứ ${raw}` };
    };

    return days
      .map((d: string) => {
        const info = formatDay(d);
        return {
          code: d,
          rank: info.rank,
          label: info.label,
        };
      })
      .sort((a, b) => a.rank - b.rank);
  }, [activeCoach?.coachProfile?.workingDays]);

  const scheduleByDay = useMemo(() => {
    const dayOrderMap: Record<string, number> = {
      "Thứ 2": 1, "Thứ 3": 2, "Thứ 4": 3, "Thứ 5": 4, "Thứ 6": 5, "Thứ 7": 6, "Chủ Nhật": 7,
    };
    const byDay = new Map<string, Array<{ label: string; shift: string; start: string }>>();

    // Seed with registered working days in order
    for (const d of registeredWorkingDays) {
      if (!byDay.has(d.label)) byDay.set(d.label, []);
    }

    const legacySlots: Array<{ label: string; shift: string; start: string }> = [];
    for (const wh of registeredWorkingHours) {
      if (wh.days.length > 0) {
        for (const dayLabel of wh.days) {
          // If workingDays is set, only show active workingDays (or show if workingDays is empty)
          if (registeredWorkingDays.length > 0 && !byDay.has(dayLabel)) continue;
          if (!byDay.has(dayLabel)) byDay.set(dayLabel, []);
          const list = byDay.get(dayLabel)!;
          if (!list.some((x) => x.label === wh.label)) {
            list.push({ label: wh.label, shift: wh.shift, start: wh.start });
          }
        }
      } else {
        legacySlots.push({ label: wh.label, shift: wh.shift, start: wh.start });
      }
    }

    if (legacySlots.length > 0) {
      if (byDay.size > 0) {
        for (const [, list] of byDay.entries()) {
          if (list.length === 0) {
            for (const s of legacySlots) {
              if (!list.some((x) => x.label === s.label)) list.push(s);
            }
          }
        }
      } else {
        byDay.set("Lịch cố định", legacySlots);
      }
    }

    return Array.from(byDay.entries())
      .map(([dayLabel, slots]) => ({
        dayLabel,
        slots: [...slots].sort((a, b) => a.start.localeCompare(b.start)),
      }))
      .sort((a, b) => (dayOrderMap[a.dayLabel] || 99) - (dayOrderMap[b.dayLabel] || 99));
  }, [registeredWorkingDays, registeredWorkingHours]);

  // Fetch member's subscriptions to match the best active PT package
  const memberSubscriptionsQuery = useQuery({
    queryKey: ['member-subscriptions', user?.id],
    queryFn: () => get<any[]>('/memberships/subscriptions'),
    enabled: Boolean(isOpen && isAuthenticated),
    staleTime: 30000,
  });

  // Find member's active PT subscriptions matching this coach
  const matchingSubscriptions = useMemo(() => {
    const list = memberSubscriptionsQuery.data || [];
    return list.filter((s: any) => {
      if (s.status !== 'ACTIVE') return false;
      if ((s.remainingPtSessions ?? 0) <= 0) return false;
      if (s.assignedCoachId && s.assignedCoachId !== activeCoach?.id) return false;
      if (
        activeCoach?.disciplineIds?.length &&
        !activeCoach.disciplineIds.includes(s.disciplineId)
      ) {
        return false;
      }
      return true;
    });
  }, [memberSubscriptionsQuery.data, activeCoach]);

  const activeSubscription = useMemo(() => {
    if (matchingSubscriptions.length === 0) return null;
    if (selectedDisciplineId) {
      return (
        matchingSubscriptions.find((s: any) => s.disciplineId === selectedDisciplineId) ||
        matchingSubscriptions[0]
      );
    }
    return matchingSubscriptions[0];
  }, [matchingSubscriptions, selectedDisciplineId]);

  // Fetch VIP plans to directly bind checkout
  const plansQuery = useQuery({
    queryKey: ["catalog", "all"],
    queryFn: () => get<Plan[]>("/memberships/plans", true),
    enabled: Boolean(isOpen),
  });

  const targetVipPlan = useMemo(() => {
    if (!activeCoach || !plansQuery.data) return null;
    const isGym =
      activeCoach.primaryDiscipline === 'GYM' ||
      activeCoach.disciplineCodes?.includes('GYM') ||
      activeCoach.coachRates?.some((r) => r.discipline?.code === 'GYM') ||
      activeCoach.coachProfile?.coachSpecialties?.some(
        (s: any) =>
          s.specialty?.code?.toUpperCase().includes('GYM') ||
          s.specialty?.discipline?.code?.toUpperCase() === 'GYM',
      );
    if (!isGym) return null; // Only GYM coaches offer 1:1 VIP packages
    return plansQuery.data.find(
      (p) => p.packageTier === "VIP" && p.isActive
    ) || null;
  }, [activeCoach, plansQuery.data]);

  const coachGroupPlans = useMemo(() => {
    if (!activeCoach || !plansQuery.data) return [];
    return getPlansForCoach(activeCoach, plansQuery.data).filter((p) => p.packageTier !== 'VIP');
  }, [activeCoach, plansQuery.data]);

  // Reset modal state on open/coach change
  useEffect(() => {
    if (isOpen) {
      setBookingError(null);
    }
  }, [isOpen, coach?.id]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
  }, [isOpen, onClose]);

  if (!isOpen || !activeCoach) return null;

  const targetCode = activeCoach.primaryDiscipline || "GYM";

  const activeRate =
    activeCoach.coachRates && activeCoach.coachRates.length > 0
      ? activeCoach.coachRates[0]
      : null;

  const specialties = useMemo(() => {
    const all = activeCoach.coachProfile?.coachSpecialties || [];
    const filtered = all.filter(
      (s: any) =>
        s.specialty?.code !== "SPEC_YOG_AS" &&
        s.specialty?.code !== "SPEC_BOX_KB" &&
        s.specialty?.code !== "SPEC_GYM_BB"
    );
    return filtered.length > 0 ? filtered : all;
  }, [activeCoach.coachProfile?.coachSpecialties]);
  const hasAvatar = Boolean(activeCoach.avatarUrl && activeCoach.avatarUrl.trim());
  const bio = activeCoach.bio || activeCoach.coachProfile?.bio;

  const stars = activeCoach.coachProfile?.ratingStars || 3;
  const profileRateNum = Number(activeCoach.coachProfile?.ratePerSession);
  const perSession =
    Number.isFinite(profileRateNum) && profileRateNum > 0
      ? profileRateNum
      : stars > 0
      ? stars * 1000
      : activeRate?.ratePerSession
      ? Number(activeRate.ratePerSession)
      : 3000;

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100001] flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs"
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Section */}
        <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-200/80 relative shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Đóng (ESC)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4 sm:gap-5 pr-8">
            {/* Avatar or Initial Badge */}
            {hasAvatar ? (
              <img
                src={activeCoach.avatarUrl!}
                alt={activeCoach.fullName}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-slate-200/80 border border-slate-300/80 flex items-center justify-center text-slate-700 font-semibold text-xl sm:text-2xl shrink-0 select-none">
                {getInitials(activeCoach.fullName)}
              </div>
            )}

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-white border border-slate-200 text-slate-700">
                  <DisciplineIcon code={targetCode} className="w-3.5 h-3.5" />
                  <span>{targetCode}</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-50 border border-amber-200 text-amber-800 tabular-nums">
                  {stars} sao
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Đạt chuẩn</span>
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight">
                {activeCoach.fullName}
              </h2>

              <p className="text-xs text-slate-500 tabular-nums">
                {activeCoach.experienceYears}+ năm kinh nghiệm
                {specialties.length > 0 ? ` · ${specialties.length} chuyên môn` : ''}
              </p>

              <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600 pt-0.5">
                {activeCoach.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeCoach.email}</span>
                  </span>
                )}
                {activeCoach.phone && (
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activeCoach.phone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1">
          {/* 1. Bio */}
          {bio && (
            <div className="space-y-1.5">
              <h4 className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>Giới thiệu</span>
              </h4>
              <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80">
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  {bio}
                </p>
              </div>
            </div>
          )}

          {/* 2. Specialties */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[#17664e]" />
              <span>Chuyên môn phụ trách ({specialties.length})</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {specialties.length > 0 ? (
                specialties.map((item: any, idx: number) => {
                  const specName = item.specialty?.name || item.name;
                  const discName = item.specialty?.discipline?.name;
                  return (
                    <div
                      key={idx}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                        <span className="text-xs font-medium text-slate-900 truncate">
                          {specName}
                        </span>
                      </div>
                      {discName && (
                        <span className="text-[11px] text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                          {discName}
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-2 text-xs text-slate-500 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  Phụ trách các lớp nền tảng bộ môn {targetCode}.
                </div>
              )}
            </div>
          </div>

          {/* 3. Rates & Fees */}
          {targetVipPlan ? (
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#17664e]" />
                  <span>Biểu phí kèm 1:1 ({stars} sao)</span>
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {money(perSession)} / buổi
                </span>
              </div>

              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {money(perSession * 12)}
                  </span>
                  <span className="text-xs text-slate-500">/ 12 buổi</span>
                </div>
                <span className="text-xs text-emerald-800 font-medium">60 phút / buổi</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-[#17664e]" />
                  <span>Gói lớp nhóm giảng dạy ({coachGroupPlans.length})</span>
                </span>
              </div>

              {coachGroupPlans.length > 0 ? (
                <div className="space-y-2">
                  {coachGroupPlans.map((gp) => (
                    <div key={gp.id} className="p-3 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-medium text-slate-900 block">{gp.name}</span>
                        <span className="text-xs text-slate-500 tabular-nums">{gp.durationDays} ngày · {gp.groupSessionQuota || 12} buổi</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          navigate(`/portal/member/plans?coachId=${activeCoach.id}`);
                        }}
                        className="px-3 py-1.5 text-xs font-medium bg-[#17664e] hover:bg-[#135641] text-white rounded-lg cursor-pointer transition-colors shrink-0"
                      >
                        Xem gói tập
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  Phụ trách các chuyên đề lớp nhóm theo điều phối trung tâm.
                </p>
              )}
            </div>
          )}

          {/* 4. Availability & Working Hours */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Khung giờ làm việc</span>
            </h4>

            {scheduleByDay.length > 0 ? (
              <div className="rounded-xl border border-slate-200/80 bg-white divide-y divide-slate-100 overflow-hidden">
                {scheduleByDay.map((row) => (
                  <div
                    key={row.dayLabel}
                    className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 w-28 shrink-0">
                      <Calendar className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                      <span className="font-semibold text-slate-900">{row.dayLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap flex-1 sm:justify-end">
                      {row.slots.length > 0 ? (
                        row.slots.map((slot, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/90 text-slate-800 font-medium tabular-nums"
                          >
                            <span className="text-slate-500">{slot.shift}</span>
                            <span className="text-slate-900 font-semibold">{slot.label}</span>
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400">Linh hoạt trong ngày</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                Chưa đăng ký khung giờ rảnh cố định.
              </div>
            )}
          </div>

          {/* 5. Subscriptions */}
          {isAuthenticated && (
            <div className="space-y-2">
              {matchingSubscriptions.length > 1 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <label className="text-xs font-medium text-slate-800 block">
                    Gói tập áp dụng:
                  </label>
                  <select
                    value={activeSubscription?.disciplineId || ''}
                    onChange={(e) => setSelectedDisciplineId(e.target.value)}
                    className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none text-xs"
                  >
                    {matchingSubscriptions.map((sub: any) => (
                      <option key={sub.id} value={sub.disciplineId}>
                        {sub.plan?.name || sub.planName || 'Gói PT'} ({sub.discipline?.code || 'PT'}) — Còn {sub.remainingPtSessions} buổi PT
                      </option>
                    ))}
                  </select>
                </div>
              ) : matchingSubscriptions.length === 1 && activeSubscription ? (
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#17664e] shrink-0" />
                    <span className="font-medium text-emerald-950">
                      {activeSubscription.plan?.name || 'Gói PT'}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-emerald-800 tabular-nums">
                    Còn {activeSubscription.remainingPtSessions} buổi
                  </span>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer Actions Bar */}
        <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-200/80 shrink-0 space-y-3">
          {bookingError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{bookingError}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/portal/member/plans?coachId=${activeCoach.id}`);
              }}
              className="flex-1 sm:flex-initial sm:min-w-[220px] flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl text-xs font-semibold bg-[#17664e] hover:bg-[#135641] text-white transition-colors cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>Đăng ký gói với HLV này</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
