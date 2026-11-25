import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Dumbbell,
  Search,
  X,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Filter,
  Quote,
  Swords,
  Activity,
} from 'lucide-react';
import { WorkoutPlanDetailModal } from '@/components/common/workout-plan-detail-modal';
import { apiClient } from '@/services/api-client';
import { vietnamDate } from '@/lib/date';
import {
  parseExerciseInstructions,
  parseExerciseTitle,
} from '@/features/coach-portal/utils/exercise-metadata.utils';
import { parseCoachNotes } from '@/lib/workout-notes';

/* =========================================================
   TYPES
========================================================= */

export interface WorkoutExerciseItem {
  id?: string;
  exerciseId: string;
  sets?: number | null;
  reps?: number | null;
  weightKg?: number | string | null;
  restSeconds?: number | null;
  coachFeedback?: string | null;
  orderIndex?: number;
  exercise?: {
    id: string;
    title: string;
    category: string;
    instructions?: string;
  };
}

export interface MemberWorkoutPlanItem {
  id: string;
  memberId: string;
  coachId: string;
  bookingId?: string | null;
  templateId?: string | null;
  sessionOrder?: number | null;
  title: string;
  notes?: string | null;
  createdAt: string;
  coach?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  template?: {
    id: string;
    templateCode: string;
    disciplineCode: string;
    title: string;
    weekNumber: number;
    sessionOrder: number;
    description?: string | null;
  };
  exercises: WorkoutExerciseItem[];
}

export interface WorkoutTemplateSession {
  id: string;
  templateCode: string;
  disciplineCode: string;
  title: string;
  weekNumber: number;
  sessionOrder: number;
  description?: string;
  exercises: Array<{
    id: string;
    exerciseId: string;
    sets?: number;
    reps?: number;
    weightKg?: number | null;
    restSeconds?: number;
    orderIndex: number;
    exercise: {
      id: string;
      title: string;
      category: string;
      instructions?: string;
    };
  }>;
}

type TabType = 'MY_PLANS' | 'TEMPLATES';

/* =========================================================
   PAGE COMPONENT
========================================================= */

export const WorkoutPlansPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('MY_PLANS');
  const [selectedPlan, setSelectedPlan] = useState<MemberWorkoutPlanItem | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplateSession | null>(null);

  // My Plans Filters & Pagination
  const [planSearch, setPlanSearch] = useState<string>('');
  const [planDateFilter, setPlanDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH'>('ALL');
  const [dateSort, setDateSort] = useState<'DESC' | 'ASC'>('DESC');
  const [plansPage, setPlansPage] = useState<number>(1);
  const plansPageSize = 6;

  // Template Tab state & Pagination
  const [templateDiscipline, setTemplateDiscipline] = useState<'BOXING' | 'YOGA'>('BOXING');
  const [templateWeekFilter, setTemplateWeekFilter] = useState<'ALL' | '1' | '2' | '3' | '4'>('ALL');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [templatePage, setTemplatePage] = useState<number>(1);
  const templatePageSize = 6;

  // 1. Fetch member's real assigned workout plans
  const {
    data: rawPlans = [],
    isLoading: isLoadingPlans,
  } = useQuery({
    queryKey: ['member', 'workout-plans'],
    queryFn: async (): Promise<MemberWorkoutPlanItem[]> => {
      const res = await apiClient.get<any>('/workout-plans');
      const data = res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  // 2. Fetch coaches list to resolve coachId to Coach's actual Name
  const { data: coachesList = [] } = useQuery({
    queryKey: ['coaches', 'all-list'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/coaches');
        const data = res.data;
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  // 3. Fetch member profile to get assigned coach fallback from subscription
  const { data: memberProfile } = useQuery({
    queryKey: ['member', 'profile-subscription-coach'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any>('/users/me');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  // 4. Fetch member's subscriptions to strictly identify active purchased packages
  const { data: memberSubscriptions = [] } = useQuery({
    queryKey: ['member', 'subscriptions', 'for-curriculum'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<any[]>('/memberships/subscriptions');
        const data = res.data;
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const activeSubs = useMemo(() => {
    return memberSubscriptions.filter((s: any) => s.status === 'ACTIVE');
  }, [memberSubscriptions]);

  const activeDisciplines = useMemo(() => {
    const list: Array<{ code: 'BOXING' | 'YOGA'; name: string; planName: string }> = [];
    const seen = new Set<string>();
    activeSubs.forEach((sub: any) => {
      const discStr = (sub.plan?.discipline?.code || sub.discipline?.code || sub.plan?.name || '').toUpperCase();
      let code: 'BOXING' | 'YOGA' | null = null;
      if (discStr.includes('BOX')) code = 'BOXING';
      else if (discStr.includes('YOG')) code = 'YOGA';

      if (code && !seen.has(code)) {
        seen.add(code);
        list.push({
          code,
          name: sub.plan?.discipline?.name || sub.discipline?.name || (code === 'BOXING' ? 'Boxing' : 'Yoga'),
          planName: sub.plan?.name || 'Gói tập',
        });
      }
    });
    return list;
  }, [activeSubs]);

  // Synchronize active discipline filter with member's actual purchased packages
  useEffect(() => {
    if (activeDisciplines.length > 0) {
      if (!activeDisciplines.some((d) => d.code === templateDiscipline)) {
        setTemplateDiscipline(activeDisciplines[0].code);
      }
    }
  }, [activeDisciplines, templateDiscipline]);

  // 5. Fetch official syllabus roadmaps matching purchased package
  const {
    data: rawTemplates = [],
    isLoading: isLoadingTemplates,
  } = useQuery({
    queryKey: ['member', 'workout-templates', templateDiscipline],
    enabled: activeDisciplines.length > 0,
    queryFn: async (): Promise<WorkoutTemplateSession[]> => {
      const res = await apiClient.get<any>('/workout-templates', {
        params: { discipline: templateDiscipline },
      });
      const data = res.data;
      return Array.isArray(data) ? data : [];
    },
  });

  // Cache of dynamically fetched coach names from /users/:id
  const [coachUserMap, setCoachUserMap] = useState<Record<string, string>>({});

  // Build high-performance lookup map of coaches
  const coachMap = useMemo(() => {
    const map = new Map<string, string>();
    coachesList.forEach((c: any) => {
      if (c.id && c.fullName) map.set(c.id, c.fullName);
      if (c.userId && c.fullName) map.set(c.userId, c.fullName);
      if (c.coachProfile?.id && c.fullName) map.set(c.coachProfile.id, c.fullName);
      if (c.coachProfile?.userId && c.fullName) map.set(c.coachProfile.userId, c.fullName);
    });
    return map;
  }, [coachesList]);

  // For any plan that has a coachId not yet found, fetch /users/:id
  useEffect(() => {
    rawPlans.forEach((plan) => {
      const cId = plan.coachId;
      if (!cId) return;
      const existingName = plan.coach?.fullName?.trim();
      if (
        existingName &&
        existingName !== 'Huấn luyện viên phụ trách' &&
        existingName !== 'HLV phụ trách' &&
        existingName !== 'HLV chỉ định'
      ) {
        return;
      }
      if (coachMap.has(cId) || coachUserMap[cId]) return;

      void apiClient
        .get<any>(`/users/${cId}`)
        .then((res) => {
          if (res.data?.fullName) {
            setCoachUserMap((prev) => ({ ...prev, [cId]: res.data.fullName }));
          }
        })
        .catch(() => {});
    });
  }, [rawPlans, coachMap, coachUserMap]);

  // Helper to reliably resolve the real Coach Name
  const resolveCoachName = (plan: MemberWorkoutPlanItem): string => {
    const directName = plan.coach?.fullName?.trim();
    if (
      directName &&
      directName !== 'Huấn luyện viên phụ trách' &&
      directName !== 'HLV phụ trách' &&
      directName !== 'HLV chỉ định'
    ) {
      return directName;
    }
    if (plan.coachId) {
      if (coachMap.has(plan.coachId)) return coachMap.get(plan.coachId)!;
      if (coachUserMap[plan.coachId]) return coachUserMap[plan.coachId];
    }
    const assignedCoach =
      memberProfile?.subscriptions?.find((s: any) => s.assignedCoach?.fullName)?.assignedCoach?.fullName ||
      memberProfile?.subscriptions?.[0]?.assignedCoach?.fullName;
    if (assignedCoach) {
      return assignedCoach;
    }
    return 'Huấn luyện viên PT';
  };

  // Filtered and Sorted assigned plans
  const filteredAndSortedPlans = useMemo(() => {
    let list = [...rawPlans];

    // 1. Search Query
    if (planSearch.trim()) {
      const q = planSearch.toLowerCase().trim();
      list = list.filter((p) => {
        const cName = resolveCoachName(p).toLowerCase();
        const titleMatch = p.title?.toLowerCase().includes(q);
        const notesMatch = p.notes?.toLowerCase().includes(q);
        const coachMatch = cName.includes(q);
        const exerciseMatch = p.exercises?.some(
          (ex) =>
            ex.exercise?.title?.toLowerCase().includes(q) ||
            ex.exercise?.category?.toLowerCase().includes(q)
        );
        return titleMatch || notesMatch || coachMatch || exerciseMatch;
      });
    }

    // 2. Date Filter
    const now = new Date();
    if (planDateFilter === 'THIS_MONTH') {
      const curMonth = now.getMonth();
      const curYear = now.getFullYear();
      list = list.filter((p) => {
        const d = new Date(p.createdAt);
        return d.getMonth() === curMonth && d.getFullYear() === curYear;
      });
    } else if (planDateFilter === 'LAST_MONTH') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lm = lastMonthDate.getMonth();
      const ly = lastMonthDate.getFullYear();
      list = list.filter((p) => {
        const d = new Date(p.createdAt);
        return d.getMonth() === lm && d.getFullYear() === ly;
      });
    }

    // 3. Sort by Date
    list.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return dateSort === 'DESC' ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [rawPlans, planSearch, planDateFilter, dateSort, coachMap, coachUserMap, memberProfile]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return rawTemplates.filter((item) => {
      if (templateWeekFilter !== 'ALL' && String(item.weekNumber) !== templateWeekFilter) {
        return false;
      }
      if (templateSearch.trim()) {
        const q = templateSearch.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesDesc = item.description?.toLowerCase().includes(q);
        const matchesExercise = item.exercises?.some((ex) =>
          ex.exercise?.title?.toLowerCase().includes(q)
        );
        return matchesTitle || matchesDesc || matchesExercise;
      }
      return true;
    });
  }, [rawTemplates, templateWeekFilter, templateSearch]);

  // Paginated plans
  const totalPlansPages = Math.max(1, Math.ceil(filteredAndSortedPlans.length / plansPageSize));
  const paginatedPlans = useMemo(() => {
    const start = (plansPage - 1) * plansPageSize;
    return filteredAndSortedPlans.slice(start, start + plansPageSize);
  }, [filteredAndSortedPlans, plansPage, plansPageSize]);

  // Paginated templates
  const totalTemplatePages = Math.max(1, Math.ceil(filteredTemplates.length / templatePageSize));
  const paginatedTemplates = useMemo(() => {
    const start = (templatePage - 1) * templatePageSize;
    return filteredTemplates.slice(start, start + templatePageSize);
  }, [filteredTemplates, templatePage, templatePageSize]);

  // Lock background scroll when any modal opens
  useEffect(() => {
    const isModalOpen = Boolean(selectedPlan || selectedTemplate);
    if (!isModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [selectedPlan, selectedTemplate]);

  // Close modal with ESC
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPlan(null);
        setSelectedTemplate(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 pb-20">
      {/* Khung trắng bo góc 5% bao bọc tất cả component */}
      <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-7 space-y-6 shadow-xs">
        {/* Header (đã bỏ nút quay lại) */}
        <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Giáo án &amp; Lộ trình tập luyện
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Theo dõi khối lượng tập luyện, số hiệp, mức tạ và lời dặn cá nhân hóa từ Huấn luyện viên
            </p>
          </div>
          <div className="h-10 w-10 rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center shrink-0 border border-emerald-100">
            <Dumbbell className="w-5 h-5" />
          </div>
        </div>

        

          
        

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('MY_PLANS');
              setPlansPage(1);
            }}
            className={`pb-3 px-2 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'MY_PLANS'
                ? 'border-[#17664e] text-[#17664e]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Dumbbell className="w-4 h-4" />
            <span>Giáo án của tôi</span>
            <span
              className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                activeTab === 'MY_PLANS'
                  ? 'bg-emerald-100 text-[#17664e]'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {rawPlans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('TEMPLATES');
              setTemplatePage(1);
            }}
            className={`pb-3 px-2 text-xs font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'TEMPLATES'
                ? 'border-[#17664e] text-[#17664e]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Giáo trình gói tập</span>
            {activeDisciplines.length > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                  activeTab === 'TEMPLATES'
                    ? 'bg-emerald-100 text-[#17664e]'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {activeDisciplines.map((d) => d.name).join(', ')}
              </span>
            )}
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: GIÁO ÁN CỦA TÔI                                   */}
        {/* ========================================================= */}
        {activeTab === 'MY_PLANS' && (
          <div className="space-y-5">
            {/* Search & Filter Dock */}
            <div className="p-3.5 sm:p-4 rounded-md bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={planSearch}
                    onChange={(e) => {
                      setPlanSearch(e.target.value);
                      setPlansPage(1);
                    }}
                    placeholder="Tìm theo tên HLV, tiêu đề, bài tập, ghi chú..."
                    className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#17664e]"
                  />
                  {planSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPlanSearch('');
                        setPlansPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort selector */}
                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <span className="text-xs text-slate-500 font-medium">Sắp xếp:</span>
                  <select
                    value={dateSort}
                    onChange={(e) => {
                      setDateSort(e.target.value as 'DESC' | 'ASC');
                      setPlansPage(1);
                    }}
                    className="h-8 px-2.5 text-xs font-bold rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#17664e] cursor-pointer"
                  >
                    <option value="DESC">Mới nhất (Ngày tạo)</option>
                    <option value="ASC">Cũ nhất (Ngày tạo)</option>
                  </select>
                </div>
              </div>

              {/* Quick Date Chips */}
              <div className="flex items-center justify-between pt-2.5 border-t border-slate-200/80 flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> Lọc ngày:
                  </span>
                  {(
                    [
                      { key: 'ALL', label: 'Tất cả' },
                      { key: 'THIS_MONTH', label: 'Tháng này' },
                      { key: 'LAST_MONTH', label: 'Tháng trước' },
                    ] as const
                  ).map((chip) => {
                    const active = planDateFilter === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => {
                          setPlanDateFilter(chip.key);
                          setPlansPage(1);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer border ${
                          active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  Hiển thị <strong className="text-slate-900 font-mono font-bold">{filteredAndSortedPlans.length}</strong> giáo án
                </span>
              </div>
            </div>

            {/* Content or Empty State */}
            {isLoadingPlans ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-5 rounded-md bg-white border border-slate-200 animate-pulse space-y-4 shadow-2xs"
                  >
                    <div className="flex justify-between items-center">
                      <div className="h-4 w-24 bg-slate-200 rounded-md" />
                      <div className="h-4 w-16 bg-slate-200 rounded-md" />
                    </div>
                    <div className="h-5 w-3/4 bg-slate-200 rounded-md" />
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-slate-100 rounded-md" />
                      <div className="h-4 w-5/6 bg-slate-100 rounded-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredAndSortedPlans.length === 0 ? (
              /* Empty State */
              <div className="p-8 sm:p-12 text-center rounded-md bg-slate-50/70 border border-dashed border-slate-200 space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center mx-auto border border-emerald-100">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {rawPlans.length === 0
                      ? 'Chưa có giáo án riêng từ Huấn luyện viên'
                      : 'Không tìm thấy giáo án phù hợp với bộ lọc'}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                    {rawPlans.length === 0
                      ? 'Khi bạn hoàn thành ca tập PT 1:1 hoặc được huấn luyện viên chỉ định bài tập, giáo án chi tiết sẽ hiển thị tại đây.'
                      : 'Thử tìm kiếm với từ khóa khác hoặc chuyển sang mốc thời gian "Tất cả".'}
                  </p>
                </div>

                {rawPlans.length === 0 && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('TEMPLATES')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#17664e] hover:bg-[#007360] text-white text-xs font-bold transition shadow-2xs active:scale-[0.98] cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Xem giáo trình gói tập của bạn</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Plans Grid */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedPlans.map((plan) => {
                    const totalExercises = plan.exercises?.length || 0;
                    const coachName = resolveCoachName(plan);
                    const tagLabel = plan.template?.disciplineCode || 'Giáo án cá nhân 1:1';

                    return (
                      <article
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className="group relative p-4 sm:p-5 rounded-md bg-white border border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col justify-between gap-4 cursor-pointer"
                      >
                        <div className="space-y-3">
                          {/* Top Badges & Date */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[10px] font-bold uppercase tracking-wider">
                              {tagLabel}
                            </span>

                            <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 font-mono">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              {vietnamDate(plan.createdAt)}
                            </span>
                          </div>

                          {/* Coach info bar */}
                          <div className="flex items-center gap-2.5 p-2 rounded-md bg-slate-50 border border-slate-200">
                            <div className="w-7 h-7 rounded-md bg-[#17664e] text-white text-xs font-bold flex items-center justify-center shrink-0">
                              {coachName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">
                                Huấn luyện viên phụ trách
                              </span>
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {coachName}
                              </p>
                            </div>
                          </div>

                          {/* Title & Notes */}
                          <div>
                            <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#17664e] transition-colors leading-snug">
                              {plan.title}
                            </h3>
                            {plan.notes && (() => {
                              const parsed = parseCoachNotes(plan.notes);
                              const previewText = parsed.coachNote
                                ? parsed.coachNote
                                : parsed.topicTitle
                                  ? `${parsed.topicTitle}${parsed.topicDescription ? ` — ${parsed.topicDescription}` : ''}`
                                  : null;
                              if (!previewText) return null;
                              return (
                                <div className="mt-2 p-2.5 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
                                  <Quote className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                  <p className="line-clamp-2 italic font-medium leading-relaxed">
                                    {previewText}
                                  </p>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Exercise Previews */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-100">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pb-0.5 uppercase tracking-wider">
                              <span>Nội dung bài tập</span>
                              <span className="text-[#17664e] font-mono">{totalExercises} bài</span>
                            </div>

                            {plan.exercises?.slice(0, 3).map((ex, idx) => {
                              const meta = parseExerciseInstructions(ex.exercise?.instructions);
                              const { primary } = parseExerciseTitle(ex.exercise?.title);
                              const unitStr = meta.unitVi || 'lần';

                              return (
                                <div
                                  key={ex.id || idx}
                                  className="p-2 rounded-md bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                                >
                                  <div className="min-w-0 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-md bg-white text-slate-600 text-[10px] font-bold font-mono flex items-center justify-center shrink-0 border border-slate-200">
                                      {idx + 1}
                                    </span>
                                    <span className="font-medium text-slate-800 truncate">
                                      {primary}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 text-[11px] font-bold font-mono">
                                    <span className="text-[#17664e]">
                                      {ex.sets || 3}h
                                    </span>
                                    <span className="text-slate-400">×</span>
                                    <span className="text-slate-700">
                                      {ex.reps || 10} {unitStr}
                                    </span>
                                    {ex.weightKg !== null && ex.weightKg !== undefined && Number(ex.weightKg) > 0 && (
                                      <span className="text-amber-700 bg-amber-50 px-1 py-0.2 rounded-md border border-amber-200 text-[10px] ml-1">
                                        {ex.weightKg}kg
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {totalExercises > 3 && (
                              <p className="text-[11px] font-medium text-slate-400 pt-0.5 text-center">
                                + {totalExercises - 3} bài tập chi tiết khác
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Card Footer */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-[#17664e] flex items-center gap-1 group-hover:underline">
                             Chi tiết 
                            <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {filteredAndSortedPlans.length > plansPageSize && (
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 font-medium">
                      Hiển thị <strong className="text-slate-900 font-mono font-bold">{(plansPage - 1) * plansPageSize + 1}</strong> - <strong className="text-slate-900 font-mono font-bold">{Math.min(plansPage * plansPageSize, filteredAndSortedPlans.length)}</strong> trên tổng số <strong className="text-slate-900 font-mono font-bold">{filteredAndSortedPlans.length}</strong> giáo án
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={plansPage === 1}
                        onClick={() => setPlansPage((prev) => Math.max(1, prev - 1))}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Trước</span>
                      </button>

                      {Array.from({ length: totalPlansPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setPlansPage(pageNum)}
                          className={`w-8 h-8 rounded-md text-xs font-bold font-mono transition-colors cursor-pointer ${
                            plansPage === pageNum
                              ? "bg-[#17664e] text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={plansPage === totalPlansPages}
                        onClick={() => setPlansPage((prev) => Math.min(totalPlansPages, prev + 1))}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Sau</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: GIÁO TRÌNH GÓI TẬP ĐANG HỌC                        */}
        {/* ========================================================= */}
        {activeTab === 'TEMPLATES' && (
          <div className="space-y-5">
            {activeDisciplines.length === 0 ? (
              <div className="p-8 sm:p-12 text-center rounded-md bg-slate-50 border border-slate-200 space-y-4 max-w-lg mx-auto">
                <div className="w-12 h-12 mx-auto rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center border border-emerald-100">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Bạn chưa có gói tập đang hoạt động
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Giáo trình bài bản được xây dựng riêng cho từng bộ môn và chỉ mở khóa khi bạn sở hữu gói tập hoặc được Huấn luyện viên phân bổ bài tập.
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    to="/portal/member/plans"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#17664e] hover:bg-[#135641] text-white text-xs font-bold rounded-md transition-colors shadow-2xs"
                  >
                    <span>Khám phá các gói tập</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Controls Bar */}
                <div className="p-3.5 sm:p-4 rounded-md bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Discipline Switcher - Strictly matching purchased active packages */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                      {activeDisciplines.map((d) => (
                        <button
                          key={d.code}
                          type="button"
                          onClick={() => {
                            setTemplateDiscipline(d.code);
                            setTemplatePage(1);
                          }}
                          className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer shrink-0 flex items-center gap-1.5 border ${
                            templateDiscipline === d.code
                              ? 'bg-[#17664e] text-white border-[#17664e] shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {d.code === 'BOXING' ? (
                            <Swords className="w-3.5 h-3.5" />
                          ) : (
                            <Activity className="w-3.5 h-3.5" />
                          )}
                          <span>Giáo trình {d.name} ({d.planName})</span>
                        </button>
                      ))}
                    </div>

                {/* Search Bar */}
                <div className="relative max-w-sm w-full">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => {
                      setTemplateSearch(e.target.value);
                      setTemplatePage(1);
                    }}
                    placeholder="Tìm kiếm bài tập trong giáo trình..."
                    className="w-full rounded-md border border-slate-300 bg-white pl-9 pr-8 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#17664e]"
                  />
                  {templateSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setTemplateSearch('');
                        setTemplatePage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Week Filter */}
              <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 border-t border-slate-200/80 pb-0.5">
                <span className="text-[11px] font-bold text-slate-500 mr-1 shrink-0 uppercase tracking-wider">
                  Tuần học:
                </span>
                {(['ALL', '1', '2', '3', '4'] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setTemplateWeekFilter(w);
                      setTemplatePage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                      templateWeekFilter === w
                        ? 'bg-[#17664e] text-white border-[#17664e] shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    {w === 'ALL' ? 'Tất cả 4 tuần' : `Tuần ${w}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Templates Grid */}
            {isLoadingTemplates ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="p-5 rounded-md bg-white border border-slate-200 animate-pulse space-y-4 shadow-2xs"
                  >
                    <div className="h-4 w-24 bg-slate-200 rounded-md" />
                    <div className="h-5 w-3/4 bg-slate-200 rounded-md" />
                    <div className="h-14 bg-slate-100 rounded-md" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedTemplates.map((tpl) => (
                    <article
                      key={tpl.id}
                      onClick={() => setSelectedTemplate(tpl)}
                      className="group relative p-4 sm:p-5 rounded-md bg-white border border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col justify-between gap-4 cursor-pointer"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                            {tpl.disciplineCode}
                          </span>
                          <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-mono">
                            Tuần {tpl.weekNumber}
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-[#17664e] transition-colors leading-snug">
                            {tpl.title}
                          </h4>
                          {tpl.description && (
                            <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                              {tpl.description}
                            </p>
                          )}
                        </div>

                        {/* Exercises Preview */}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <div className="text-[11px] font-bold text-slate-400 pb-0.5 uppercase tracking-wider font-mono">
                            {tpl.exercises?.length || 0} bài tập chuẩn hóa
                          </div>

                          {tpl.exercises?.slice(0, 3).map((ex, idx) => (
                            <div
                              key={ex.id || idx}
                              className="p-2 rounded-md bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="font-medium text-slate-700 truncate">
                                {ex.exercise?.title}
                              </span>
                              <span className="text-[11px] font-bold text-emerald-700 font-mono shrink-0">
                                {ex.sets || 3}h × {ex.reps || 10}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-[#17664e] group-hover:underline flex items-center gap-1">
                          Xem chi tiết đề cương
                          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </article>
                  ))}
                </div>

                {/* Templates Pagination */}
                {filteredTemplates.length > templatePageSize && (
                  <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <span className="text-slate-500 font-medium">
                      Hiển thị <strong className="text-slate-900 font-mono font-bold">{(templatePage - 1) * templatePageSize + 1}</strong> - <strong className="text-slate-900 font-mono font-bold">{Math.min(templatePage * templatePageSize, filteredTemplates.length)}</strong> trên tổng số <strong className="text-slate-900 font-mono font-bold">{filteredTemplates.length}</strong> buổi học
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={templatePage === 1}
                        onClick={() => setTemplatePage((prev) => Math.max(1, prev - 1))}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Trước</span>
                      </button>

                      {Array.from({ length: totalTemplatePages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setTemplatePage(pageNum)}
                          className={`w-8 h-8 rounded-md text-xs font-bold font-mono transition-colors cursor-pointer ${
                            templatePage === pageNum
                              ? "bg-[#17664e] text-white"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        disabled={templatePage === totalTemplatePages}
                        onClick={() => setTemplatePage((prev) => Math.min(totalTemplatePages, prev + 1))}
                        className="px-2.5 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-slate-700 flex items-center gap-1 cursor-pointer"
                      >
                        <span>Sau</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CHI TIẾT GIÁO ÁN HỌC VIÊN                        */}
      {/* ========================================================= */}
      <WorkoutPlanDetailModal
        isOpen={Boolean(selectedPlan)}
        onClose={() => setSelectedPlan(null)}
        title={selectedPlan?.title}
        coachName={selectedPlan ? resolveCoachName(selectedPlan) : ''}
        notes={selectedPlan?.notes}
        exercises={selectedPlan?.exercises || []}
      />

      {/* ========================================================= */}
      {/* MODAL 2: CHI TIẾT BUỔI HỌC MẪU (TEMPLATE SESSION)          */}
      {/* ========================================================= */}
      <WorkoutPlanDetailModal
        isOpen={Boolean(selectedTemplate)}
        onClose={() => setSelectedTemplate(null)}
        title={selectedTemplate ? `Tuần ${selectedTemplate.weekNumber}: ${selectedTemplate.title}` : ''}
        coachName={`Giáo án chuẩn ${selectedTemplate?.disciplineCode || 'GYM'}`}
        notes={selectedTemplate?.description}
        exercises={selectedTemplate?.exercises || []}
      />
    </div>
  );
};

export default WorkoutPlansPage;
