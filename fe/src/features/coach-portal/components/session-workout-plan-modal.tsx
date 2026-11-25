import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dumbbell,
  CheckCircle2,
  X,
  Loader2,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  BookOpen,
  Layers,
  ArrowRight,
  Search,
  Check,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import { coachPortalApi } from '../api/coach-portal-api';
import type {
  BookingWorkoutExercise,
  StudentBookingItem,
  WorkoutPlanItem,
  WorkoutTemplateItem,
  ExerciseKnowledgeItem,
} from '../types/coach-portal.types';
import {
  parseExerciseInstructions,
  translateCategory,
  parseExerciseTitle,
  getExerciseDiscipline,
  getTemplateTopic,
} from '../utils/exercise-metadata.utils';

interface SessionWorkoutPlanModalProps {
  booking: StudentBookingItem;
  sessionTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SessionWorkoutPlanModal: React.FC<SessionWorkoutPlanModalProps> = ({
  booking,
  sessionTitle,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [exercises, setExercises] = useState<BookingWorkoutExercise[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [planTitle, setPlanTitle] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selector mode state (when choosing a plan for student)
  const [isSelectingPlan, setIsSelectingPlan] = useState<boolean>(false);
  const [selectorTab, setSelectorTab] = useState<'MEMBER_PLANS' | 'TEMPLATES' | 'ADD_EXERCISE'>('MEMBER_PLANS');
  const [templateDiscipline, setTemplateDiscipline] = useState<'BOXING' | 'YOGA'>('BOXING');
  const [showOtherPlans, setShowOtherPlans] = useState<boolean>(false);

  // Advanced filters inside Tab 3 (Kho bài tập)
  const [exerciseSearch, setExerciseSearch] = useState<string>('');
  const [exerciseDisciplineFilter, setExerciseDisciplineFilter] = useState<'ALL' | 'BOXING' | 'YOGA' | 'GYM'>('ALL');
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<string>('ALL');

  // 1. Query current workout plan for this booking
  const {
    data: plan,
    isLoading: isPlanLoading,
  } = useQuery({
    queryKey: ['coach', 'booking-workout-plan', booking.id],
    queryFn: () => coachPortalApi.getWorkoutPlanByBooking(booking.id),
    enabled: isOpen,
  });

  // 2. Query all custom plans of this coach
  const { data: allPlans = [] } = useQuery({
    queryKey: ['coach', 'workout-plans'],
    queryFn: () => coachPortalApi.getWorkoutPlans(),
    enabled: isOpen,
  });

  // 3. Query 12-session workout templates
  const { data: templates = [] } = useQuery({
    queryKey: ['coach', 'workout-templates'],
    queryFn: () => coachPortalApi.getWorkoutTemplates(),
    enabled: isOpen,
  });

  // 4. Query exercise knowledge library
  const { data: exerciseLibrary = [] } = useQuery({
    queryKey: ['coach', 'exercise-knowledge'],
    queryFn: () => coachPortalApi.getExerciseKnowledge(),
    enabled: isOpen,
  });

  // 5. Query coach profile & rates to determine disciplines coach teaches
  const { data: coachProfile } = useQuery({
    queryKey: ['coach', 'my-profile'],
    queryFn: () => coachPortalApi.getMyProfile(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  const { data: coachRates = [] } = useQuery({
    queryKey: ['coach', 'my-rates', (coachProfile as any)?.id],
    queryFn: () => ((coachProfile as any)?.id ? coachPortalApi.getMyRates((coachProfile as any).id) : []),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen && Boolean((coachProfile as any)?.id),
  });

  // Determine which disciplines coach teaches
  const coachDisciplines = useMemo<string[]>(() => {
    const list = new Set<string>();

    const specialties = (coachProfile as any)?.coachProfile?.coachSpecialties || [];
    specialties.forEach((cs: any) => {
      const code = cs.specialty?.discipline?.code;
      if (code) list.add(code.toUpperCase());
    });

    (coachRates as any[]).forEach((r) => {
      const code = r.discipline?.code;
      if (code) list.add(code.toUpperCase());
    });

    const bDisc = ((booking as any).schedule?.discipline?.code || (booking as any)?.disciplineCode || '').toUpperCase();
    if (bDisc) list.add(bDisc);

    const sTitle = (sessionTitle || '').toUpperCase();
    if (sTitle.includes('BOXING')) list.add('BOXING');
    if (sTitle.includes('YOGA')) list.add('YOGA');
    if (sTitle.includes('GYM')) list.add('GYM');

    return Array.from(list);
  }, [coachProfile, coachRates, booking, sessionTitle]);

  // Synchronize active discipline filter with coach's specialties
  useEffect(() => {
    if (coachDisciplines.length === 1) {
      const single = coachDisciplines[0] as 'BOXING' | 'YOGA';
      setTemplateDiscipline(single);
      setExerciseDisciplineFilter(single as any);
    } else if (coachDisciplines.length > 1) {
      if (!coachDisciplines.includes(templateDiscipline)) {
        setTemplateDiscipline(coachDisciplines[0] as any);
      }
      if (exerciseDisciplineFilter !== 'ALL' && !coachDisciplines.includes(exerciseDisciplineFilter)) {
        setExerciseDisciplineFilter(coachDisciplines[0] as any);
      }
    }
  }, [coachDisciplines]);

  // Knowledge lookup map
  const exerciseKnowledgeMap = useMemo(() => {
    const map = new Map<string, ExerciseKnowledgeItem>();
    exerciseLibrary.forEach((e) => map.set(e.id, e));
    return map;
  }, [exerciseLibrary]);

  // Auto-switch to selector if no plan exists yet
  useEffect(() => {
    if (plan) {
      setExercises(plan.exercises || []);
      setNotes(plan.notes || '');
      setPlanTitle(plan.title || '');
      setIsSelectingPlan(false);
    } else {
      setExercises([]);
      setNotes('');
      setPlanTitle('');
      setIsSelectingPlan(true);
    }
  }, [plan]);

  const memberName =
    booking.member?.fullName || 'Học viên PT';

  // Filter plans created as reusable curriculums OR specifically for this student
  const coachBlueprints = useMemo(() => {
    return allPlans.filter((p) => !p.memberId);
  }, [allPlans]);

  const matchingMemberPlans = useMemo(() => {
    if (!allPlans.length || !booking.memberId) return [];
    return allPlans.filter(
      (p) =>
        Boolean(p.memberId) &&
        (p.memberId === booking.memberId ||
          ((p as any).member?.fullName &&
            booking.member?.fullName &&
            (p as any).member.fullName === booking.member.fullName))
    );
  }, [allPlans, booking.memberId, booking.member?.fullName]);

  const availablePrimaryPlans = useMemo(() => {
    return [...coachBlueprints, ...matchingMemberPlans];
  }, [coachBlueprints, matchingMemberPlans]);

  // Other plans created by coach (assigned to other members)
  const otherCoachPlans = useMemo(() => {
    if (!allPlans.length) return [];
    return allPlans.filter(
      (p) =>
        Boolean(p.memberId) &&
        p.memberId !== booking.memberId &&
        (!booking.member?.fullName || (p as any).member?.fullName !== booking.member.fullName)
    );
  }, [allPlans, booking.memberId, booking.member?.fullName]);

  // Filter templates by discipline (respecting coach specialties)
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const tDisc = t.disciplineCode?.toUpperCase();
      if (coachDisciplines.length === 1) {
        return tDisc === coachDisciplines[0];
      }
      return tDisc === templateDiscipline;
    });
  }, [templates, templateDiscipline, coachDisciplines]);

  // Discipline item counts for Tab 3
  const disciplineCounts = useMemo(() => {
    let boxing = 0;
    let yoga = 0;
    let gym = 0;
    exerciseLibrary.forEach((item) => {
      const disc = getExerciseDiscipline(item);
      if (disc === 'BOXING') boxing++;
      else if (disc === 'YOGA') yoga++;
      else gym++;
    });
    return { ALL: exerciseLibrary.length, BOXING: boxing, YOGA: yoga, GYM: gym };
  }, [exerciseLibrary]);

  // Unique categories for Tab 3 (Dynamically filtered by selected discipline)
  const exerciseCategories = useMemo(() => {
    const map = new Map<string, number>();
    exerciseLibrary.forEach((item) => {
      const disc = getExerciseDiscipline(item);
      if (exerciseDisciplineFilter === 'ALL' || disc === exerciseDisciplineFilter) {
        const cat = item.category?.toLowerCase().trim();
        if (cat) {
          map.set(cat, (map.get(cat) || 0) + 1);
        }
      }
    });
    return Array.from(map.entries())
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => a.cat.localeCompare(b.cat));
  }, [exerciseLibrary, exerciseDisciplineFilter]);

  const handleSelectExerciseDiscipline = (disc: 'ALL' | 'BOXING' | 'YOGA' | 'GYM') => {
    setExerciseDisciplineFilter(disc);
    if (exerciseCategoryFilter !== 'ALL') {
      const stillValid = exerciseLibrary.some((item) => {
        const d = getExerciseDiscipline(item);
        return (
          (disc === 'ALL' || d === disc) &&
          item.category?.toLowerCase().trim() === exerciseCategoryFilter.toLowerCase().trim()
        );
      });
      if (!stillValid) {
        setExerciseCategoryFilter('ALL');
      }
    }
  };

  // Filter exercise library for Tab 3 (respecting coach specialties)
  const filteredExerciseLibrary = useMemo(() => {
    return exerciseLibrary.filter((item) => {
      const disc = getExerciseDiscipline(item);
      let matchDiscipline = false;
      if (coachDisciplines.length === 1) {
        matchDiscipline = disc === coachDisciplines[0];
      } else if (coachDisciplines.length > 1) {
        matchDiscipline =
          exerciseDisciplineFilter === 'ALL'
            ? coachDisciplines.includes(disc)
            : disc === exerciseDisciplineFilter;
      } else {
        matchDiscipline =
          exerciseDisciplineFilter === 'ALL' || disc === exerciseDisciplineFilter;
      }

      const matchCategory =
        exerciseCategoryFilter === 'ALL' ||
        item.category.toLowerCase().trim() === exerciseCategoryFilter.toLowerCase().trim();

      const q = exerciseSearch.trim().toLowerCase();
      const meta = parseExerciseInstructions(item.instructions);
      const { primary, secondary } = parseExerciseTitle(item.title);
      const matchSearch =
        !q ||
        primary.toLowerCase().includes(q) ||
        (secondary && secondary.toLowerCase().includes(q)) ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        translateCategory(item.category).toLowerCase().includes(q) ||
        (meta.muscleVi && meta.muscleVi.toLowerCase().includes(q)) ||
        (meta.equipmentVi && meta.equipmentVi.toLowerCase().includes(q));

      return matchDiscipline && matchCategory && matchSearch;
    });
  }, [exerciseLibrary, exerciseDisciplineFilter, exerciseCategoryFilter, exerciseSearch, coachDisciplines]);

  const updateExerciseField = (
    index: number,
    field: keyof BookingWorkoutExercise,
    value: any
  ) => {
    setExercises((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveExercise = (index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExerciseById = (exerciseId: string) => {
    setExercises((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
  };

  const handleAddExerciseFromLibrary = (item: ExerciseKnowledgeItem) => {
    if (exercises.some((e) => e.exerciseId === item.id)) return;
    const meta = parseExerciseInstructions(item.instructions);
    const newEx: BookingWorkoutExercise = {
      id: `temp-${Date.now()}-${Math.random()}`,
      exerciseId: item.id,
      sets: 3,
      reps: meta.unit === 'seconds' ? 30 : 10,
      weightKg: meta.equipment?.includes('dumbbell') || meta.equipment?.includes('barbell') ? 20 : null,
      restSeconds: 60,
      coachFeedback: '',
      orderIndex: exercises.length,
      exercise: {
        id: item.id,
        title: item.title,
        category: item.category,
        instructions: item.instructions,
      },
    };
    setExercises((prev) => [...prev, newEx]);
    setSuccessMessage(`Đã thêm động tác "${item.title}" vào giáo án!`);
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  // Handler: Load existing member plan into editor mode (M14.1) for personalization
  const handleEditFromMemberPlan = (sourcePlan: WorkoutPlanItem) => {
    const mapped: BookingWorkoutExercise[] = (sourcePlan.exercises || []).map((ex, idx) => {
      const kItem = exerciseKnowledgeMap.get(ex.exerciseId);
      return {
        id: `temp-${Date.now()}-${idx}-${Math.random()}`,
        exerciseId: ex.exerciseId,
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        weightKg: ex.weightKg !== null && ex.weightKg !== undefined ? Number(ex.weightKg) : null,
        restSeconds: ex.restSeconds || 60,
        coachFeedback: ex.coachFeedback || '',
        orderIndex: idx,
        exercise: {
          id: ex.exerciseId,
          title: ex.exercise?.title || kItem?.title || 'Bài tập',
          category: ex.exercise?.category || kItem?.category || 'strength',
          instructions: (ex.exercise as any)?.instructions || kItem?.instructions,
        },
      };
    });
    setExercises(mapped);
    setNotes(sourcePlan.notes || '');
    setPlanTitle(sourcePlan.title);
    setIsSelectingPlan(false);
    setSuccessMessage(`Đã nạp giáo án "${sourcePlan.title}". Bạn có thể chỉnh sửa số hiệp, mức tạ trước khi lưu!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Handler: Load 12-session template into editor mode (M14.1) for personalization
  const handleEditFromTemplate = (tpl: WorkoutTemplateItem) => {
    const mapped: BookingWorkoutExercise[] = (tpl.exercises || []).map((ex, idx) => {
      const kItem = exerciseKnowledgeMap.get(ex.exerciseId);
      return {
        id: `temp-${Date.now()}-${idx}-${Math.random()}`,
        exerciseId: ex.exerciseId,
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        weightKg: ex.weightKg !== null && ex.weightKg !== undefined ? Number(ex.weightKg) : null,
        restSeconds: ex.restSeconds || 60,
        coachFeedback: '',
        orderIndex: idx,
        exercise: {
          id: ex.exerciseId,
          title: ex.exercise?.title || kItem?.title || 'Bài tập',
          category: ex.exercise?.category || kItem?.category || 'strength',
          instructions: ex.exercise?.instructions || kItem?.instructions,
        },
      };
    });
    setExercises(mapped);
    setNotes(tpl.description ? tpl.description.replace(/(Boxing|Yoga)\s*4\s*tuần:\s*/gi, '') : '');
    setPlanTitle(tpl.title);
    setIsSelectingPlan(false);
    setSuccessMessage(`Đã nạp giáo án "${tpl.title}". Bạn có thể tùy chỉnh động tác ngay!`);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Mutation: Assign 12-session template directly to this booking
  const assignTemplateMutation = useMutation({
    mutationFn: async (templateCode: string) => {
      return coachPortalApi.assignWorkoutTemplate({
        bookingId: booking.id,
        templateCode,
      });
    },
    onSuccess: async () => {
      setSuccessMessage('Đã gán giáo án mẫu cho buổi tập thành công!');
      setErrorMessage(null);
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'booking-workout-plan', booking.id],
      });
      setIsSelectingPlan(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi gán giáo án mẫu.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // Mutation: Apply existing curriculum / custom plan directly to this booking
  const applyMemberPlanMutation = useMutation({
    mutationFn: async (sourcePlan: WorkoutPlanItem) => {
      return coachPortalApi.saveBookingWorkoutPlan(booking.id, {
        workoutPlanId: sourcePlan.id,
      });
    },
    onSuccess: async () => {
      setSuccessMessage('Đã áp dụng giáo trình vào buổi tập thành công.');
      setErrorMessage(null);
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'booking-workout-plan', booking.id],
      });
      setIsSelectingPlan(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi áp dụng giáo án học viên.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  // Mutation: Save customized plan & coach feedback (M14.1)
  const saveMutation = useMutation({
    mutationFn: async () => {
      const currentTitle = planTitle.trim() || `Giáo án PT: ${sessionTitle}`;
      let targetPlanId = plan?.id;
      if (!targetPlanId) {
        // Create base plan for this booking via assign-template (which supports bookingId on both Render & local)
        const base = await coachPortalApi.assignWorkoutTemplate({
          bookingId: booking.id,
          templateCode: templates[0]?.templateCode || 'WORKOUT_PLAN_BOXING_01',
        });
        targetPlanId = base.id;
      }
      return coachPortalApi.updateSessionWorkoutPlan(targetPlanId, {
        title: currentTitle,
        notes: notes.trim() || undefined,
        exercises: exercises.map((ex) => ({
          exerciseId: ex.exerciseId,
          sets: ex.sets ? Number(ex.sets) : undefined,
          reps: ex.reps ? Number(ex.reps) : undefined,
          weightKg:
            ex.weightKg !== null && ex.weightKg !== undefined && Number(ex.weightKg) > 0
              ? Number(ex.weightKg)
              : undefined,
          restSeconds: ex.restSeconds ? Number(ex.restSeconds) : undefined,
          coachFeedback: ex.coachFeedback?.trim() || undefined,
        })),
      });
    },
    onSuccess: async () => {
      setSuccessMessage('Đã lưu cập nhật giáo án và nhận xét buổi tập thành công!');
      setErrorMessage(null);
      await queryClient.invalidateQueries({
        queryKey: ['coach', 'booking-workout-plan', booking.id],
      });
      setTimeout(() => setSuccessMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi lưu giáo án.';
      setErrorMessage(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  if (!isOpen) return null;

  const isPendingAny =
    saveMutation.isPending ||
    assignTemplateMutation.isPending ||
    applyMemberPlanMutation.isPending;

  return typeof document !== 'undefined'
    ? createPortal(
        <div
          className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-900/60 backdrop-blur-xs p-2 sm:p-4 flex flex-col items-center justify-start sm:justify-center animate-in fade-in duration-150"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isPendingAny) onClose();
          }}
        >
          <div className="w-full max-w-5xl my-auto max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 p-5 bg-gradient-to-r from-emerald-50/80 via-slate-50 to-white">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
                  <Dumbbell className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">
                      {planTitle || plan?.title || 'Giáo Án Buổi Tập PT 1-1'}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Ca dạy: {sessionTitle} • Học viên: <strong className="text-slate-800">{memberName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {plan && !isSelectingPlan && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectingPlan(true)}
                    className="text-xs font-bold text-teal-700 border-teal-200 hover:bg-teal-50"
                  >
                    <Layers className="w-3.5 h-3.5 mr-1 text-teal-600" />
                    Đổi / Chọn giáo án khác
                  </Button>
                )}
                <button
                  onClick={onClose}
                  type="button"
                  disabled={isPendingAny}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Feedback Banners */}
            {successMessage && (
              <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{successMessage}</span>
              </div>
            )}
            {errorMessage && (
              <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isPlanLoading ? (
                <div className="py-20 text-center space-y-3">
                  <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-slate-500">Đang tải giáo án buổi tập...</p>
                </div>
              ) : isSelectingPlan ? (
                /* ======================================================== */
                /* MODE: CHỌN GIÁO ÁN CHO HỌC VIÊN                          */
                /* ======================================================== */
                <div className="space-y-4">
                  {/* Selector Tabs */}
                  <div className="flex items-center gap-2 border-b border-slate-200 pb-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectorTab('MEMBER_PLANS')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        selectorTab === 'MEMBER_PLANS'
                          ? 'bg-[#17664e] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Giáo trình tạo sẵn ({availablePrimaryPlans.length})
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectorTab('TEMPLATES')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        selectorTab === 'TEMPLATES'
                          ? 'bg-[#17664e] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      Lộ trình mẫu
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectorTab('ADD_EXERCISE')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        selectorTab === 'ADD_EXERCISE'
                          ? 'bg-[#17664e] text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Kho bài tập
                    </button>

                    {exercises.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsSelectingPlan(false)}
                        className="ml-auto text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-all border border-emerald-200 flex items-center gap-1"
                      >
                        Tiếp tục ({exercises.length} bài)
                        <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                      </button>
                    )}
                  </div>

                  {/* ======================================================== */}
                  {/* TAB 1: MEMBER'S OWN WORKOUT PLANS (RICH CARDS)           */}
                  {/* ======================================================== */}
                  {selectorTab === 'MEMBER_PLANS' && (
                    <div className="space-y-4">
                      {availablePrimaryPlans.length === 0 ? (
                        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 space-y-2">
                          <BookOpen className="h-8 w-8 text-slate-300 mx-auto" />
                          <p className="text-xs font-semibold text-slate-600">
                            Chưa có giáo trình tạo sẵn hoặc giáo án riêng cho {memberName}.
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Bạn có thể tạo sẵn ở mục Giáo án, chọn Lộ trình mẫu hoặc thêm động tác từ Kho bài tập.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {availablePrimaryPlans.map((mPlan) => {
                            const isBlueprint = !mPlan.memberId;
                            const studentName = isBlueprint
                              ? 'Giáo trình tạo sẵn'
                              : (mPlan as any).member?.fullName || memberName;
                            const studentPhone = isBlueprint
                              ? 'Áp dụng nhanh cho mọi ca'
                              : (mPlan as any).member?.phone || booking.member?.phone || 'Học viên PT';
                            const initial = isBlueprint ? 'G' : studentName.charAt(0).toUpperCase() || 'H';

                            return (
                              <div
                                key={mPlan.id}
                                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 group hover:border-emerald-500/80"
                              >
                                {/* Header of Rich Card */}
                                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-sm">
                                      {initial}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-extrabold text-slate-900 text-sm truncate">
                                          {studentName}
                                        </h4>
                                      </div>
                                      <p className="text-[11px] text-slate-400 truncate">
                                        {studentPhone} · Ngày tạo: {new Date(mPlan.createdAt).toLocaleDateString('vi-VN')}
                                      </p>
                                    </div>
                                  </div>

                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditFromMemberPlan(mPlan)}
                                    className="text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 h-8 px-2.5 gap-1.5 cursor-pointer rounded-xl transition-colors font-bold text-xs shrink-0"
                                    title="Chỉnh sửa giáo án này trước khi áp dụng"
                                  >
                                    <Pencil className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Chỉnh sửa</span>
                                  </Button>
                                </div>

                                {/* Plan Title & Volume Summary */}
                                <div className="space-y-1">
                                  <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">
                                    {mPlan.title}
                                  </h3>
                                  <div className="flex items-center gap-2">
                                    <span className="rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70 px-2 py-0.5 text-[10px] font-bold">
                                      {mPlan.exercises?.length || 0} bài tập
                                    </span>
                                  </div>
                                </div>

                                {/* Coach Notes */}
                                {mPlan.notes && (
                                  <div className="border-l-2 border-emerald-500 bg-emerald-50/50 px-3 py-1.5 rounded-r-xl text-xs text-slate-600 leading-relaxed italic">
                                    "{mPlan.notes}"
                                  </div>
                                )}

                                {/* Exercises List inside plan */}
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                    {mPlan.exercises?.map((ex, idx) => {
                                      const kItem = exerciseKnowledgeMap.get(ex.exerciseId);
                                      const meta = parseExerciseInstructions(
                                        kItem?.instructions || (ex.exercise as any)?.instructions
                                      );
                                      const { primary, secondary } = parseExerciseTitle(
                                        ex.exercise?.title || kItem?.title
                                      );
                                      const unitStr = meta.unitVi || 'lần';

                                      return (
                                        <div
                                          key={ex.id || idx}
                                          className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs space-y-1.5"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                              <span className="w-5 h-5 rounded-md bg-white text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                                                {String(idx + 1).padStart(2, '0')}
                                              </span>
                                              <div className="min-w-0">
                                                <span className="font-bold text-slate-900 truncate block">
                                                  {primary}
                                                </span>
                                                {secondary && (
                                                  <span className="text-[10px] text-slate-400 font-medium truncate block -mt-0.5">
                                                    {secondary}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                            <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 shrink-0">
                                              {translateCategory(ex.exercise?.category || kItem?.category)}
                                            </span>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] pl-7">
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/70">
                                              {ex.sets || 3} hiệp
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200/70">
                                              {ex.reps || 10} {unitStr}
                                            </span>
                                            {ex.weightKg !== null && ex.weightKg !== undefined && Number(ex.weightKg) > 0 && (
                                              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200/70">
                                                Tạ: {ex.weightKg} kg
                                              </span>
                                            )}
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                              Nghỉ {ex.restSeconds || 60}s
                                            </span>
                                          </div>

                                          {ex.coachFeedback && (
                                            <p className="text-[11px] text-emerald-800 font-medium pl-7 italic bg-emerald-50/50 py-1 px-2 rounded-lg border border-emerald-100">
                                              Lời dặn HLV: {ex.coachFeedback}
                                            </p>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Footer Actions */}
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                                  <span className="text-[10px] font-mono text-slate-400">
                                  
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <Button
                                      size="sm"
                                      type="button"
                                      variant="outline"
                                      onClick={() => handleEditFromMemberPlan(mPlan)}
                                      className="h-8 px-2.5 text-xs font-bold text-slate-700 hover:text-emerald-700 gap-1 bg-white"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                                      Chỉnh sửa giáo án
                                    </Button>

                                    <Button
                                      size="sm"
                                      type="button"
                                      disabled={applyMemberPlanMutation.isPending}
                                      onClick={() => applyMemberPlanMutation.mutate(mPlan)}
                                      className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1 transition-all"
                                    >
                                      {applyMemberPlanMutation.isPending ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Check className="w-3.5 h-3.5" />
                                      )}
                                      Áp dụng ngay
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Optional Section: Reuse other plans created by coach */}
                      {otherCoachPlans.length > 0 && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => setShowOtherPlans((prev) => !prev)}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 py-1"
                          >
                            {showOtherPlans ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            Kho giáo án khác của bạn ({otherCoachPlans.length} giáo án)
                          </button>

                          {showOtherPlans && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                              {otherCoachPlans.map((oPlan) => {
                                const totalSets = (oPlan.exercises || []).reduce(
                                  (sum, ex) => sum + (ex.sets || 3),
                                  0
                                );
                                const studentName = (oPlan as any).member?.fullName || 'Học viên khác';
                                const initial = studentName.charAt(0).toUpperCase() || 'H';

                                return (
                                  <div
                                    key={oPlan.id}
                                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 group hover:border-indigo-400"
                                  >
                                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-black flex items-center justify-center text-sm shrink-0 shadow-sm">
                                          {initial}
                                        </div>
                                        <div className="min-w-0">
                                          <h4 className="font-extrabold text-slate-900 text-sm truncate">
                                            {oPlan.title}
                                          </h4>
                                          <p className="text-[11px] text-slate-400 truncate">
                                            Soạn cho: {studentName} · {oPlan.exercises?.length || 0} bài tập ({totalSets} hiệp)
                                          </p>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Exercises preview */}
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                      {oPlan.exercises?.slice(0, 5).map((ex, idx) => {
                                        const kItem = exerciseKnowledgeMap.get(ex.exerciseId);
                                        const { primary } = parseExerciseTitle(
                                          ex.exercise?.title || kItem?.title
                                        );
                                        return (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between text-xs text-slate-600 py-0.5"
                                          >
                                            <span className="truncate">
                                              {idx + 1}. {primary}
                                            </span>
                                            <span className="text-[11px] font-semibold text-slate-400 shrink-0">
                                              {ex.sets || 3}h × {ex.reps || 10}
                                            </span>
                                          </div>
                                        );
                                      })}
                                      {(oPlan.exercises?.length || 0) > 5 && (
                                        <p className="text-[10px] text-slate-400 italic">
                                          + {(oPlan.exercises?.length || 0) - 5} bài tập khác...
                                        </p>
                                      )}
                                    </div>

                                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        type="button"
                                        onClick={() => handleEditFromMemberPlan(oPlan)}
                                        className="h-8 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Tùy chỉnh & Áp dụng
                                      </Button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* TAB 2: 12-SESSION WORKOUT TEMPLATES                      */}
                  {/* ======================================================== */}
                  {selectorTab === 'TEMPLATES' && (
                    <div className="space-y-4">
                      {/* Discipline toggle */}
                      {coachDisciplines.length === 1 ? (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold pb-1">
                          <CheckCircle2 className="w-4 h-4 text-[#17664e] shrink-0" />
                          <span>
                            Chuyên môn HLV: {coachDisciplines[0] === 'BOXING' ? 'Boxing ' : coachDisciplines[0] === 'YOGA' ? 'Yoga ' : coachDisciplines[0]}
                          </span>
                        </div>
                      ) : coachDisciplines.length > 1 ? (
                        <div className="flex items-center gap-2 pb-1">
                          {coachDisciplines.map((disc) => (
                            <button
                              key={disc}
                              type="button"
                              onClick={() => setTemplateDiscipline(disc as any)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                                templateDiscipline === disc
                                  ? 'bg-[#17664e] text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {disc === 'BOXING' ? 'Boxing (12 buổi)' : disc === 'YOGA' ? 'Yoga (12 buổi)' : disc}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 pb-1">
                          <button
                            type="button"
                            onClick={() => setTemplateDiscipline('BOXING')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                              templateDiscipline === 'BOXING'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Boxing
                          </button>
                          <button
                            type="button"
                            onClick={() => setTemplateDiscipline('YOGA')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                              templateDiscipline === 'YOGA'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Yoga
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredTemplates.map((tpl) => {
                          const isBoxing = tpl.disciplineCode?.toUpperCase() === 'BOXING';
                          return (
                            <div
                              key={tpl.id}
                              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3 group hover:border-emerald-500/80"
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase text-white ${
                                      isBoxing ? 'bg-rose-600' : 'bg-indigo-600'
                                    }`}
                                  >
                                    {tpl.disciplineCode}
                                  </span>
                                  <span className="rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 px-2 py-0.5 text-[10px] font-bold">
                                    Chủ đề: {getTemplateTopic(tpl)}
                                  </span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-400">
                                  {tpl.exercises?.length || 0} bài tập
                                </span>
                              </div>

                              {/* Title & Description */}
                              <div className="space-y-1">
                                <h4 className="text-base font-black text-slate-900 group-hover:text-emerald-700 transition-colors">
                                  {tpl.title}
                                </h4>
                                {tpl.description && (
                                  <p className="text-xs text-slate-500 line-clamp-2">
                                    {tpl.description}
                                  </p>
                                )}
                              </div>

                              {/* Concrete Exercises List */}
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                  {tpl.exercises?.map((ex, idx) => {
                                    const { primary, secondary } = parseExerciseTitle(ex.exercise?.title);
                                    return (
                                      <div
                                        key={ex.id || idx}
                                        className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 text-xs space-y-1"
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className="flex items-center gap-2 min-w-0">
                                            <span className="w-5 h-5 rounded-md bg-white text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                                              {String(idx + 1).padStart(2, '0')}
                                            </span>
                                            <div className="min-w-0">
                                              <span className="font-bold text-slate-900 truncate block">
                                                {primary}
                                              </span>
                                              {secondary && (
                                                <span className="text-[10px] text-slate-400 font-medium truncate block -mt-0.5">
                                                  {secondary}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 shrink-0">
                                            {translateCategory(ex.exercise?.category)}
                                          </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] pl-7">
                                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/70">
                                            {ex.sets || 3} hiệp
                                          </span>
                                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200/70">
                                            {ex.reps || 10} {ex.unit === 'seconds' ? 'giây' : 'lần'}
                                          </span>
                                          {ex.weightKg !== null && ex.weightKg !== undefined && Number(ex.weightKg) > 0 && (
                                            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 font-semibold border border-amber-200/70">
                                              Tạ: {ex.weightKg} kg
                                            </span>
                                          )}
                                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                                            Nghỉ {ex.restSeconds || 60}s
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Footer Actions */}
                              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 mt-auto">
                                <span className="text-[10px] font-mono text-slate-400">
                                  Mã: #{tpl.templateCode}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                    onClick={() => handleEditFromTemplate(tpl)}
                                    className="h-8 px-2.5 text-xs font-bold text-slate-700 hover:text-emerald-700 gap-1 bg-white"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-emerald-600" />
                                    Chỉnh sửa giáo án
                                  </Button>

                                  <Button
                                    size="sm"
                                    type="button"
                                    disabled={assignTemplateMutation.isPending}
                                    onClick={() => assignTemplateMutation.mutate(tpl.templateCode)}
                                    className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1 transition-all"
                                  >
                                    {assignTemplateMutation.isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <ArrowRight className="w-3.5 h-3.5" />
                                    )}
                                    Gán vào ca này
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* TAB 3: ADD FROM EXERCISE KNOWLEDGE (84 EXERCISES)        */}
                  {/* ======================================================== */}
                  {selectorTab === 'ADD_EXERCISE' && (
                    <div className="space-y-4">
                      {/* Search & Discipline / Category filter controls */}
                      <div className="space-y-3 bg-slate-50/70 p-4 rounded-3xl border border-slate-200/80">
                        {/* Search Input */}
                        <div className="relative w-full">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="text"
                            value={exerciseSearch}
                            onChange={(e) => setExerciseSearch(e.target.value)}
                            placeholder="Tìm theo tên động tác, nhóm cơ chính (ví dụ: Squat, Burpee, Plank)..."
                            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 outline-none transition-all shadow-2xs"
                          />
                          {exerciseSearch && (
                            <button
                              type="button"
                              onClick={() => setExerciseSearch('')}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Disciplines Chips */}
                        {coachDisciplines.length === 1 ? (
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                            <Dumbbell className="w-4 h-4 text-[#17664e] shrink-0" />
                            <span>Môn chuyên môn: {coachDisciplines[0]} ({(disciplineCounts as any)[coachDisciplines[0]] || 0} động tác)</span>
                          </div>
                        ) : coachDisciplines.length > 1 ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSelectExerciseDiscipline('ALL')}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                exerciseDisciplineFilter === 'ALL'
                                  ? 'bg-[#17664e] text-white shadow-2xs'
                                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              Tất cả ({disciplineCounts.ALL})
                            </button>
                            {coachDisciplines.map((disc) => (
                              <button
                                key={disc}
                                type="button"
                                onClick={() => handleSelectExerciseDiscipline(disc as any)}
                                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                  exerciseDisciplineFilter === disc
                                    ? 'bg-[#17664e] text-white shadow-2xs'
                                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                }`}
                              >
                                {disc} ({(disciplineCounts as any)[disc] || 0})
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleSelectExerciseDiscipline('ALL')}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                exerciseDisciplineFilter === 'ALL'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              Tất cả ({disciplineCounts.ALL})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectExerciseDiscipline('BOXING')}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                exerciseDisciplineFilter === 'BOXING'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              Boxing ({disciplineCounts.BOXING})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectExerciseDiscipline('YOGA')}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                exerciseDisciplineFilter === 'YOGA'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              Yoga ({disciplineCounts.YOGA})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSelectExerciseDiscipline('GYM')}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                exerciseDisciplineFilter === 'GYM'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              Gym ({disciplineCounts.GYM})
                            </button>
                          </div>
                        )}

                        {/* Categories Chips (Dynamically matched to discipline) */}
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => setExerciseCategoryFilter('ALL')}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                              exerciseCategoryFilter === 'ALL'
                                ? 'bg-slate-800 text-white shadow-2xs'
                                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Tất cả nhóm ({disciplineCounts[exerciseDisciplineFilter]})
                          </button>
                          {exerciseCategories.map(({ cat, count }) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setExerciseCategoryFilter(cat)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer ${
                                exerciseCategoryFilter.toLowerCase() === cat.toLowerCase()
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                              }`}
                            >
                              {translateCategory(cat)} ({count})
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Exercise Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                        {filteredExerciseLibrary.length === 0 ? (
                          <div className="col-span-full py-12 text-center text-xs text-slate-400 space-y-2">
                            <Dumbbell className="h-7 w-7 text-slate-300 mx-auto" />
                            <p>Không có bài tập nào phù hợp với bộ lọc tìm kiếm.</p>
                          </div>
                        ) : (
                          filteredExerciseLibrary.map((item) => {
                            const isAdded = exercises.some((e) => e.exerciseId === item.id);
                            const meta = parseExerciseInstructions(item.instructions);
                            const { primary, secondary } = parseExerciseTitle(item.title);
                            const isBoxing = meta.discipline === 'BOXING';
                            const isYoga = meta.discipline === 'YOGA';

                            return (
                              <div
                                key={item.id}
                                className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 min-w-0 ${
                                  isAdded
                                    ? 'border-emerald-300 bg-emerald-50/60 shadow-2xs'
                                    : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/70 shadow-2xs'
                                }`}
                              >
                                <div className="space-y-1.5 min-w-0">
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                                      {meta.discipline && (
                                        <span
                                          className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase border shrink-0 ${
                                            isBoxing
                                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                                              : isYoga
                                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                              : 'bg-amber-50 text-amber-800 border-amber-200'
                                          }`}
                                        >
                                          {meta.discipline}
                                        </span>
                                      )}
                                      <span className="rounded-md bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 text-[9px] font-semibold truncate">
                                        {translateCategory(item.category)}
                                      </span>
                                    </div>

                                    {isAdded ? (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveExerciseById(item.id)}
                                        className="px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-rose-600 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer group"
                                        title="Bấm để bỏ chọn động tác"
                                      >
                                        <Check className="w-3 h-3 group-hover:hidden" />
                                        <X className="w-3 h-3 hidden group-hover:inline" />
                                        <span className="group-hover:hidden">Đã chọn</span>
                                        <span className="hidden group-hover:inline">Bỏ chọn</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleAddExerciseFromLibrary(item)}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Thêm</span>
                                      </button>
                                    )}
                                  </div>

                                  <div>
                                    <h5 className="font-bold text-slate-900 text-xs truncate">
                                      {primary}
                                    </h5>
                                    {secondary && (
                                      <p className="text-[10px] text-slate-400 font-medium truncate">
                                        {secondary}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[10px]">
                                    {meta.muscleVi && (
                                      <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                        {meta.muscleVi}
                                      </span>
                                    )}
                                    {meta.equipmentVi && (
                                      <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                        {meta.equipmentVi}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Bottom Sticky Action Bar in Tab 3 */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">
                          Giáo án gồm <strong>{exercises.length}</strong> bài tập
                        </span>

                        <Button
                          type="button"
                          onClick={() => setIsSelectingPlan(false)}
                          disabled={exercises.length === 0}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1"
                        >
                          Vào cấu hình bài tập ({exercises.length})
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* ======================================================== */
                /* MODE: CHỈNH SỬA CHI TIẾT GIÁO ÁN                          */
                /* ======================================================== */
                <div className="space-y-4">
                  {/* Title & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Tiêu đề:
                      </label>
                      <input
                        type="text"
                        value={planTitle}
                        onChange={(e) => setPlanTitle(e.target.value)}
                        placeholder={`Giáo án: ${sessionTitle}`}
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ghi chú:
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Lưu ý chung cho buổi tập..."
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Exercises List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">
                        Bài tập ({exercises.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsSelectingPlan(true);
                          setSelectorTab('ADD_EXERCISE');
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-3 py-1 rounded-xl transition-all border border-emerald-200 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        + Thêm bài
                      </button>
                    </div>

                    {exercises.length === 0 ? (
                      <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 space-y-2">
                        <Dumbbell className="h-8 w-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-500">
                          Chưa có bài tập nào.
                        </p>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => {
                            setIsSelectingPlan(true);
                            setSelectorTab('ADD_EXERCISE');
                          }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                        >
                          + Chọn bài tập
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {exercises.map((item, idx) => {
                          const { primary, secondary } = parseExerciseTitle(item.exercise?.title);

                          return (
                            <div
                              key={item.id || idx}
                              className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 hover:border-slate-300"
                            >
                              {/* Exercise Header */}
                              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 text-[11px] font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 truncate">
                                    {primary || `Bài tập #${idx + 1}`}
                                  </span>
                                  {secondary && (
                                    <span className="text-[10px] text-slate-400 font-medium truncate hidden sm:inline">
                                      ({secondary})
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {item.exercise?.category && (
                                    <span className="rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[10px]">
                                      {translateCategory(item.exercise.category)}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExercise(idx)}
                                    className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Reps, Sets, Weight, Rest Steppers */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                                <NumberStepper
                                  label="Hiệp"
                                  min={1}
                                  max={50}
                                  step={1}
                                  size="sm"
                                  value={item.sets ? Number(item.sets) : 3}
                                  onChange={(val) => updateExerciseField(idx, 'sets', val)}
                                />

                                <NumberStepper
                                  label="Reps"
                                  unit="lần"
                                  min={1}
                                  max={1000}
                                  step={1}
                                  size="sm"
                                  value={item.reps ? Number(item.reps) : 10}
                                  onChange={(val) => updateExerciseField(idx, 'reps', val)}
                                />

                                <NumberStepper
                                  label="Tạ"
                                  unit="kg"
                                  min={0}
                                  max={500}
                                  step={1}
                                  size="sm"
                                  value={item.weightKg ? Number(item.weightKg) : 0}
                                  onChange={(val) => updateExerciseField(idx, 'weightKg', val)}
                                />

                                <NumberStepper
                                  label="Nghỉ"
                                  unit="s"
                                  min={0}
                                  max={600}
                                  step={15}
                                  size="sm"
                                  value={item.restSeconds ? Number(item.restSeconds) : 60}
                                  onChange={(val) => updateExerciseField(idx, 'restSeconds', val)}
                                />
                              </div>

                              {/* Coach Feedback for this exercise */}
                              <input
                                type="text"
                                value={item.coachFeedback || ''}
                                maxLength={1000}
                                onChange={(e) =>
                                  updateExerciseField(idx, 'coachFeedback', e.target.value)
                                }
                                placeholder="Lưu ý kỹ thuật cho bài này..."
                                className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-emerald-500"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPendingAny}
                className="text-xs font-semibold cursor-pointer"
              >
                Đóng
              </Button>

              {!isSelectingPlan && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsSelectingPlan(true)}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Đổi giáo án
                  </Button>

                  <Button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || exercises.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-xs cursor-pointer"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {saveMutation.isPending ? 'Đang lưu...' : 'Lưu giáo án'}
                    </span>
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;
};
