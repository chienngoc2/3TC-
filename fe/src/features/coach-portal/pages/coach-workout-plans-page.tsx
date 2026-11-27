import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router';
import { createPortal } from 'react-dom';
import { parseCoachNotes } from '@/lib/workout-notes';
import { isCoachQualifiedForPlan } from '@/lib/topic-matcher';
import {
  extractTopicsFromPlan,
  getRecommendedExercisesForTopic,
  type NormalizedCurriculumTopic,
} from '../utils/curriculum-topics.utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dumbbell,
  Plus,
  Trash2,
  BookOpen,
  Search,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Calendar,
  Users,
  ChevronDown,
  ChevronUp,
  Target,
  Timer,
  Check,
  Pencil,
  Filter,
  ArrowUpDown,
  ArrowLeft,
  Copy,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import { coachPortalApi } from '../api/coach-portal-api';
import type {
  WorkoutExerciseDto,
  WorkoutTemplateItem,
  WorkoutPlanItem,
  WorkoutRecommendation,
} from '../types/coach-portal.types';
import {
  parseExerciseInstructions,
  translateCategory,
  parseExerciseTitle,
  UNIT_TRANSLATIONS,
  getExerciseDiscipline,
  getTemplateTopic,
} from '../utils/exercise-metadata.utils';
import { WorkoutPlanDetailModal } from '@/components/common/workout-plan-detail-modal';
import { InbodyRecommendationCard } from '../components/inbody-recommendation-card';
import { MemberGoalModal, type MemberGoalModalData } from '../components/member-goal-modal';
import { useAuth } from '@/context/auth-context';

type PlanTab = 'TEMPLATES' | 'CUSTOM_PLANS' | 'EXERCISE_LIBRARY';

const CATEGORY_ORDER: Record<string, number> = {
  warmup: 1,
  warm_up: 1,
  technique: 2,
  strength: 3,
  power: 4,
  core: 5,
  cardio: 6,
  sparring: 7,
  yoga_pose: 8,
  recovery: 9,
  cooldown: 10,
  cool_down: 10,
};

export const CoachWorkoutPlansPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<PlanTab>('CUSTOM_PLANS');
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  // Modal Detail State (Unified Workout Plan Modal)
  const [viewingPlan, setViewingPlan] = useState<WorkoutPlanItem | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<WorkoutTemplateItem | null>(null);

  // Query Coach Rates & Specialization
  const { data: rates = [] } = useQuery({
    queryKey: ['coach', 'rates', user?.id],
    queryFn: () => {
      if (!user?.id) return [];
      return coachPortalApi.getMyRates(user.id);
    },
    enabled: Boolean(user?.id),
  });

  const coachDiscipline = useMemo<'YOGA' | 'BOXING' | 'GYM' | null>(() => {
    if (user?.email) {
      const e = user.email.toLowerCase();
      if (e.includes('yog')) return 'YOGA';
      if (e.includes('box')) return 'BOXING';
      if (e.includes('gym')) return 'GYM';
    }
    if (rates && rates.length > 0) {
      const code = rates[0].discipline?.code?.toUpperCase();
      if (code === 'YOGA' || code === 'BOXING' || code === 'GYM') return code as any;
    }
    return null;
  }, [user?.email, rates]);

  // --- Tab 2: Package Reference Curriculums ---
  const [selectedRefPlanId, setSelectedRefPlanId] = useState<string>('ALL');
  const [templateSearch, setTemplateSearch] = useState<string>('');
  const [templateDiscipline, setTemplateDiscipline] = useState<'BOXING' | 'YOGA'>('BOXING');
  const [templateTopicFilter, setTemplateTopicFilter] = useState<string>('ALL');
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);

  // --- Tab 2: Custom Plans & Reusable Curriculums ---
  const [planScopeFilter, setPlanScopeFilter] = useState<'ALL' | 'BLUEPRINTS' | 'STUDENTS'>('ALL');
  const [customPlanSearch, setCustomPlanSearch] = useState<string>('');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('ALL');
  const [dateSort, setDateSort] = useState<'DESC' | 'ASC'>('DESC');
  const [selectedGoalMember, setSelectedGoalMember] = useState<MemberGoalModalData | null>(null);

  // --- Tab 3: Exercise Library ---
  const [exerciseSearch, setExerciseSearch] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedExerciseDiscipline, setSelectedExerciseDiscipline] = useState<'ALL' | 'BOXING' | 'YOGA' | 'GYM'>('ALL');

  // Sync coach specialization
  React.useEffect(() => {
    if (coachDiscipline) {
      if (coachDiscipline === 'YOGA' || coachDiscipline === 'BOXING') {
        setTemplateDiscipline(coachDiscipline);
      }
      setSelectedExerciseDiscipline(coachDiscipline);
      setFormDisciplineFilter(coachDiscipline);
    }
  }, [coachDiscipline]);

  // --- Modal Form States for Creating/Editing Custom Plan ---
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [targetMemberId, setTargetMemberId] = useState<string>('');
  const [planTitle, setPlanTitle] = useState<string>('');
  const [planNotes, setPlanNotes] = useState<string>('');
  const [exercisesList, setExercisesList] = useState<
    Array<WorkoutExerciseDto & { title?: string; category?: string }>
  >([]);

  // Advanced filters inside the modal exercise picker
  const [formExerciseSearch, setFormExerciseSearch] = useState<string>('');
  const [formDisciplineFilter, setFormDisciplineFilter] = useState<'ALL' | 'BOXING' | 'YOGA' | 'GYM'>('ALL');
  const [formCategoryFilter, setFormCategoryFilter] = useState<string>('ALL');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<NormalizedCurriculumTopic | null>(null);
  const [onlyTopicMatched, setOnlyTopicMatched] = useState<boolean>(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [recommendationHidden, setRecommendationHidden] = useState<boolean>(false);

  const { data: coachProfile } = useQuery({
    queryKey: ['coach', 'my-profile'],
    queryFn: () => coachPortalApi.getMyProfile(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: rawMembershipPlans = [] } = useQuery({
    queryKey: ['coach', 'membership-plans'],
    queryFn: () => coachPortalApi.getMembershipPlans(),
    staleTime: 5 * 60 * 1000,
  });

  const qualifiedPlans = useMemo(() => {
    if (!rawMembershipPlans.length) return [];
    if (coachProfile) {
      const coachSpecs = (coachProfile as any)?.coachProfile?.coachSpecialties || [];
      if (coachSpecs.length > 0) {
        const filtered = rawMembershipPlans.filter((p: any) =>
          isCoachQualifiedForPlan(coachProfile as any, p),
        );
        if (filtered.length > 0) return filtered;
      }
    }
    if (coachDiscipline) {
      return rawMembershipPlans.filter(
        (p: any) => String(p.discipline?.code || '').toUpperCase() === coachDiscipline,
      );
    }
    return rawMembershipPlans;
  }, [rawMembershipPlans, coachProfile, coachDiscipline]);

  const activeCurriculumPlan = useMemo(() => {
    if (!qualifiedPlans.length) return null;
    if (selectedPackageId) {
      const found = qualifiedPlans.find((p: any) => p.id === selectedPackageId);
      if (found) return found;
    }
    return qualifiedPlans[0];
  }, [qualifiedPlans, selectedPackageId]);

  const packageTopics = useMemo(
    () => extractTopicsFromPlan(activeCurriculumPlan),
    [activeCurriculumPlan],
  );

  const activeTopicDiscipline = useMemo(() => {
    const pkgDisc = String(
      (activeCurriculumPlan as any)?.discipline?.code ||
        (activeCurriculumPlan as any)?.disciplineCode ||
        '',
    ).toUpperCase();
    if (pkgDisc === 'YOGA' || pkgDisc === 'BOXING' || pkgDisc === 'GYM') return pkgDisc;
    if (formDisciplineFilter !== 'ALL') return formDisciplineFilter;
    return coachDiscipline || 'GYM';
  }, [activeCurriculumPlan, formDisciplineFilter, coachDiscipline]);

  // Queries
  const {
    data: templates = [],
    isLoading: isLoadingTemplates,
    isRefetching: isRefetchingTemplates,
    refetch: refetchTemplates,
  } = useQuery({
    queryKey: ['coach', 'workout-templates', templateDiscipline],
    queryFn: () => coachPortalApi.getWorkoutTemplates(templateDiscipline),
  });

  const {
    data: plans = [],
    isLoading: isLoadingPlans,
    isRefetching: isRefetchingPlans,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ['coach', 'workout-plans'],
    queryFn: () => coachPortalApi.getWorkoutPlans(),
  });

  const {
    data: exercisesKnowledge = [],
    isLoading: isLoadingExercises,
    isRefetching: isRefetchingExercises,
    refetch: refetchExercises,
  } = useQuery({
    queryKey: ['coach', 'exercise-knowledge'],
    queryFn: () => coachPortalApi.getExerciseKnowledge(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ['coach', 'members'],
    queryFn: () => coachPortalApi.getAssignedMembers(),
  });

  // Student lookup map
  const memberMap = useMemo(() => {
    const map = new Map<string, any>();
    members.forEach((m) => {
      map.set(m.id, m);
      if (m.user?.id) map.set(m.user.id, m);
    });
    return map;
  }, [members]);

  // Exercise knowledge lookup map
  const exerciseKnowledgeMap = useMemo(() => {
    const map = new Map<string, any>();
    exercisesKnowledge.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [exercisesKnowledge]);

  // Discipline counts across exercise library
  const disciplineCounts = useMemo(() => {
    const counts = { ALL: exercisesKnowledge.length, BOXING: 0, YOGA: 0, GYM: 0 };
    exercisesKnowledge.forEach((item) => {
      const disc = getExerciseDiscipline(item);
      counts[disc]++;
    });
    return counts;
  }, [exercisesKnowledge]);

  const buildFormattedNotes = () => {
    const cleanExtra = (parseCoachNotes(planNotes).coachNote || planNotes).trim();
    const parts: string[] = [];
    if (selectedTopic) {
      parts.push(`[CHUYÊN ĐỀ]: ${selectedTopic.name}`);
      if (selectedTopic.description) {
        parts.push(`• Nội dung: ${selectedTopic.description}`);
      }
    }
    if (cleanExtra) {
      parts.push(cleanExtra);
    }
    return parts.join('\n').trim() || undefined;
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!planTitle.trim()) throw new Error('Vui lòng nhập tiêu đề giáo trình.');
      if (exercisesList.length === 0) throw new Error('Vui lòng thêm ít nhất một bài tập.');

      return coachPortalApi.createWorkoutPlan({
        ...(targetMemberId ? { memberId: targetMemberId } : {}),
        title: planTitle.trim(),
        notes: buildFormattedNotes(),
        exercises: exercisesList.map(({ exerciseId, sets, reps, weightKg, restSeconds, coachFeedback }) => ({
          exerciseId,
          sets: sets || 3,
          reps: reps || 10,
          weightKg: weightKg || 0,
          restSeconds: restSeconds || 60,
          coachFeedback: coachFeedback || undefined,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach', 'workout-plans'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi tạo giáo án';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingPlanId) throw new Error('Không tìm thấy giáo án cần cập nhật.');
      if (!planTitle.trim()) throw new Error('Vui lòng nhập tiêu đề giáo án.');
      if (exercisesList.length === 0) throw new Error('Vui lòng thêm ít nhất một bài tập vào giáo án.');

      return coachPortalApi.updateWorkoutPlan(editingPlanId, {
        title: planTitle.trim(),
        notes: buildFormattedNotes(),
        exercises: exercisesList.map(({ exerciseId, sets, reps, weightKg, restSeconds, coachFeedback }) => ({
          exerciseId,
          sets: sets || 3,
          reps: reps || 10,
          weightKg: weightKg || 0,
          restSeconds: restSeconds || 60,
          coachFeedback: coachFeedback || undefined,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach', 'workout-plans'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi cập nhật giáo án';
      setFormError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coachPortalApi.deleteWorkoutPlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach', 'workout-plans'] });
    },
  });

  const resetForm = () => {
    setEditingPlanId(null);
    setTargetMemberId('');
    setPlanTitle('');
    setPlanNotes('');
    setExercisesList([]);
    setFormExerciseSearch('');
    setFormDisciplineFilter(coachDiscipline || 'ALL');
    setFormCategoryFilter('ALL');
    setSelectedTopic(null);
    setOnlyTopicMatched(true);
    setFormError(null);
    setRecommendationHidden(false);
  };

  // One click from the InBody assistant: add its exercises (skipping ones already in the
  // plan) and its cardio/nutrition advice; the coach can still adjust everything before saving.
  const handleApplyRecommendation = (rec: WorkoutRecommendation) => {
    setExercisesList((prev) => [
      ...prev,
      ...rec.recommendedExercises
        .filter((ex) => !prev.some((item) => item.exerciseId === ex.exerciseId))
        .map((ex) => ({
          exerciseId: ex.exerciseId,
          title: ex.exerciseName,
          category: ex.category || 'Chung',
          sets: ex.sets,
          reps: ex.reps,
          weightKg: 0,
          restSeconds: 60,
          coachFeedback: ex.notes || '',
        })),
    ]);
    if (!planTitle.trim() && rec.primaryGoalTitle) setPlanTitle(`Giáo án ${rec.primaryGoalTitle}`);
    const advice = [
      rec.cardioPrescription
        ? `Cardio ${rec.cardioPrescription.targetZone.replace('_', ' ')} ${rec.cardioPrescription.durationMinutes} phút cuối buổi: ${rec.cardioPrescription.reason}`
        : null,
      rec.nutritionAdvice
        ? `Dinh dưỡng: khoảng ${rec.nutritionAdvice.targetDailyCalories} kcal/ngày, ${rec.nutritionAdvice.proteinTargetGrams} g protein. ${rec.nutritionAdvice.guideline}`
        : null,
    ].filter((line): line is string => Boolean(line) && !planNotes.includes(line as string));
    if (advice.length > 0)
      setPlanNotes((current) => [current.trim(), ...advice].filter(Boolean).join('\n'));
    setFormError(null);
  };

  const handleOpenEditPlan = (plan: WorkoutPlanItem) => {
    setEditingPlanId(plan.id);
    setTargetMemberId(plan.memberId || '');
    setPlanTitle(plan.title);
    const parsedNotes = parseCoachNotes(plan.notes);
    setPlanNotes(parsedNotes.coachNote || '');
    const matchedTopic = parsedNotes.topicTitle
      ? packageTopics.find(
          (t) =>
            t.name.toLowerCase().includes(parsedNotes.topicTitle!.toLowerCase()) ||
            parsedNotes.topicTitle!.toLowerCase().includes(t.name.toLowerCase()),
        ) || {
          topicNumber: 1,
          name: parsedNotes.topicTitle,
          description: parsedNotes.topicDescription || '',
        }
      : null;
    setSelectedTopic(matchedTopic);

    const mapped = (plan.exercises || []).map((ex) => {
      const kItem = exerciseKnowledgeMap.get(ex.exerciseId);
      return {
        exerciseId: ex.exerciseId,
        title: ex.exercise?.title || kItem?.title || 'Bài tập',
        category: ex.exercise?.category || kItem?.category || 'Chung',
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        weightKg: ex.weightKg !== null && ex.weightKg !== undefined ? Number(ex.weightKg) : 0,
        restSeconds: ex.restSeconds || 60,
        coachFeedback: ex.coachFeedback || '',
      };
    });

    setExercisesList(mapped);
    setFormExerciseSearch('');
    setFormDisciplineFilter('ALL');
    setFormCategoryFilter('ALL');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleDuplicatePlan = (plan: WorkoutPlanItem) => {
    setEditingPlanId(null);
    setTargetMemberId('');
    setPlanTitle(`${plan.title} (Bản sao)`);
    const parsedNotes = parseCoachNotes(plan.notes);
    setPlanNotes(parsedNotes.coachNote || '');
    const matchedTopic = parsedNotes.topicTitle
      ? packageTopics.find(
          (t) =>
            t.name.toLowerCase().includes(parsedNotes.topicTitle!.toLowerCase()) ||
            parsedNotes.topicTitle!.toLowerCase().includes(t.name.toLowerCase()),
        ) || {
          topicNumber: 1,
          name: parsedNotes.topicTitle,
          description: parsedNotes.topicDescription || '',
        }
      : null;
    setSelectedTopic(matchedTopic);

    const mapped = (plan.exercises || []).map((ex) => {
      const kItem = exerciseKnowledgeMap.get(ex.exerciseId);
      return {
        exerciseId: ex.exerciseId,
        title: ex.exercise?.title || kItem?.title || 'Bài tập',
        category: ex.exercise?.category || kItem?.category || 'Chung',
        sets: ex.sets || 3,
        reps: ex.reps || 10,
        weightKg: ex.weightKg !== null && ex.weightKg !== undefined ? Number(ex.weightKg) : 0,
        restSeconds: ex.restSeconds || 60,
        coachFeedback: ex.coachFeedback || '',
      };
    });

    setExercisesList(mapped);
    setFormExerciseSearch('');
    setFormDisciplineFilter('ALL');
    setFormCategoryFilter('ALL');
    setFormError(null);
    setIsCreateOpen(true);
  };

  const handleAddExerciseToForm = (item: {
    id: string;
    title: string;
    category: string;
    instructions?: string;
  }) => {
    if (exercisesList.some((e) => e.exerciseId === item.id)) return;
    const meta = parseExerciseInstructions(item.instructions);
    const defaultReps = meta.unit === 'seconds' ? 30 : meta.unit === 'minutes' ? 5 : 10;
    const isWeighted =
      meta.equipment?.includes('dumbbell') ||
      meta.equipment?.includes('barbell') ||
      meta.equipment?.includes('kettlebell');

    setExercisesList((prev) => [
      ...prev,
      {
        exerciseId: item.id,
        title: item.title,
        category: item.category,
        sets: 3,
        reps: defaultReps,
        weightKg: isWeighted ? 20 : 0,
        restSeconds: meta.unit === 'seconds' ? 30 : 60,
        coachFeedback: '',
      },
    ]);
  };

  const handleRemoveExerciseFromForm = (exerciseId: string) => {
    setExercisesList((prev) => prev.filter((e) => e.exerciseId !== exerciseId));
  };

  const handleUpdateExerciseParam = (
    index: number,
    field: keyof WorkoutExerciseDto,
    value: any
  ) => {
    const updated = [...exercisesList];
    updated[index] = { ...updated[index], [field]: value };
    setExercisesList(updated);
  };

  const handleUseTopicAsDraft = (
    plan: any,
    topic: NormalizedCurriculumTopic,
    recExercises: any[],
  ) => {
    setEditingPlanId(null);
    setSelectedPackageId(plan.id);
    setSelectedTopic(topic);
    setPlanTitle(`${topic.sessionRange ? `${topic.sessionRange}: ` : ''}${topic.name}`);
    setPlanNotes(topic.description || topic.benefits || '');
    const mapped = recExercises.slice(0, 6).map((ex) => {
      const meta = parseExerciseInstructions(ex.instructions);
      const isWeighted = meta.unit === 'reps' && !meta.isBodyweight;
      return {
        exerciseId: ex.id,
        title: ex.title,
        category: ex.category,
        sets: 3,
        reps: meta.unit === 'seconds' ? 30 : 12,
        weightKg: isWeighted ? 20 : 0,
        restSeconds: meta.unit === 'seconds' ? 30 : 60,
        coachFeedback: '',
      };
    });
    setExercisesList(mapped);
    setIsCreateOpen(true);
  };

  // Helper to clone a template into the custom plan modal
  const handleCloneTemplateToPlan = (tpl: WorkoutTemplateItem) => {
    setEditingPlanId(null);
    setPlanTitle(`Giáo án: ${tpl.title}`);
    setPlanNotes(tpl.description || `Lộ trình ${tpl.disciplineCode} - Chủ đề: ${getTemplateTopic(tpl)}`);
    const mappedExercises = (tpl.exercises || []).map((ex) => ({
      exerciseId: ex.exerciseId,
      title: ex.exercise?.title || 'Bài tập',
      category: ex.exercise?.category || 'Chung',
      sets: ex.sets || 3,
      reps: ex.reps || 10,
      weightKg: Number(ex.weightKg) || 0,
      restSeconds: ex.restSeconds || 60,
      coachFeedback: '',
    }));
    setExercisesList(mappedExercises);
    setIsCreateOpen(true);
  };

  // Filtered lists
  const templateTopics = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((tpl) => {
      set.add(getTemplateTopic(tpl));
    });
    return Array.from(set);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchTopic =
        templateTopicFilter === 'ALL' || getTemplateTopic(tpl) === templateTopicFilter;
      const q = templateSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        tpl.title.toLowerCase().includes(q) ||
        (tpl.templateCode && tpl.templateCode.toLowerCase().includes(q)) ||
        (tpl.description && tpl.description.toLowerCase().includes(q)) ||
        tpl.exercises?.some((e) => e.exercise?.title?.toLowerCase().includes(q));

      return matchTopic && matchSearch;
    });
  }, [templates, templateTopicFilter, templateSearch]);

  const blueprintsCount = useMemo(() => plans.filter((p) => !p.memberId).length, [plans]);
  const studentPlansCount = useMemo(() => plans.filter((p) => Boolean(p.memberId)).length, [plans]);

  const filteredPlans = useMemo(() => {
    const list = plans.filter((p) => {
      if (planScopeFilter === 'BLUEPRINTS' && p.memberId) return false;
      if (planScopeFilter === 'STUDENTS' && !p.memberId) return false;

      const matchStudent =
        selectedStudentFilter === 'ALL' || p.memberId === selectedStudentFilter;
      const q = customPlanSearch.trim().toLowerCase();
      const student = p.memberId ? memberMap.get(p.memberId) : null;
      const studentName = (p.member?.fullName || student?.user?.fullName || '').toLowerCase();

      const matchSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        studentName.includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q));

      return matchStudent && matchSearch;
    });

    return list.sort((a, b) => {
      // Prioritize coach's pre-created blueprints first when viewing ALL, then sort by date
      if (planScopeFilter === 'ALL') {
        const aBlue = !a.memberId ? 0 : 1;
        const bBlue = !b.memberId ? 0 : 1;
        if (aBlue !== bBlue) return aBlue - bBlue;
      }
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return dateSort === 'DESC' ? timeB - timeA : timeA - timeB;
    });
  }, [plans, planScopeFilter, selectedStudentFilter, customPlanSearch, memberMap, dateSort]);

  // Dynamic categories for Tab 3 (filtered by selected discipline)
  const exerciseCategories = useMemo(() => {
    const map = new Map<string, number>();
    exercisesKnowledge.forEach((item) => {
      const disc = getExerciseDiscipline(item);
      if (selectedExerciseDiscipline === 'ALL' || disc === selectedExerciseDiscipline) {
        const cat = item.category?.toLowerCase().trim();
        if (cat) {
          map.set(cat, (map.get(cat) || 0) + 1);
        }
      }
    });
    return Array.from(map.entries())
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => {
        const orderA = CATEGORY_ORDER[a.cat] || 99;
        const orderB = CATEGORY_ORDER[b.cat] || 99;
        return orderA - orderB;
      });
  }, [exercisesKnowledge, selectedExerciseDiscipline]);

  const handleSelectDiscipline = (disc: 'ALL' | 'BOXING' | 'YOGA' | 'GYM') => {
    setSelectedExerciseDiscipline(disc);
    if (selectedCategory !== 'ALL') {
      const stillValid = exercisesKnowledge.some((item) => {
        const d = getExerciseDiscipline(item);
        return (
          (disc === 'ALL' || d === disc) &&
          item.category?.toLowerCase().trim() === selectedCategory.toLowerCase().trim()
        );
      });
      if (!stillValid) {
        setSelectedCategory('ALL');
      }
    }
  };

  const filteredExercises = useMemo(() => {
    return exercisesKnowledge.filter((ex) => {
      const disc = getExerciseDiscipline(ex);
      const matchDiscipline =
        selectedExerciseDiscipline === 'ALL' || disc === selectedExerciseDiscipline;
      const matchCategory =
        selectedCategory === 'ALL' || ex.category.toLowerCase().trim() === selectedCategory.toLowerCase().trim();

      const q = exerciseSearch.trim().toLowerCase();
      const meta = parseExerciseInstructions(ex.instructions);
      const { primary, secondary } = parseExerciseTitle(ex.title);
      const matchSearch =
        !q ||
        primary.toLowerCase().includes(q) ||
        (secondary && secondary.toLowerCase().includes(q)) ||
        ex.title.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        translateCategory(ex.category).toLowerCase().includes(q) ||
        (meta.muscleVi && meta.muscleVi.toLowerCase().includes(q)) ||
        (meta.equipmentVi && meta.equipmentVi.toLowerCase().includes(q)) ||
        (meta.instructionsText && meta.instructionsText.toLowerCase().includes(q));

      return matchDiscipline && matchCategory && matchSearch;
    });
  }, [exercisesKnowledge, selectedCategory, selectedExerciseDiscipline, exerciseSearch]);

  // Dynamic categories for Modal Picker (filtered by form discipline filter)
  const modalExerciseCategories = useMemo(() => {
    const map = new Map<string, number>();
    exercisesKnowledge.forEach((item) => {
      const disc = getExerciseDiscipline(item);
      if (formDisciplineFilter === 'ALL' || disc === formDisciplineFilter) {
        const cat = item.category?.toLowerCase().trim();
        if (cat) {
          map.set(cat, (map.get(cat) || 0) + 1);
        }
      }
    });
    return Array.from(map.entries())
      .map(([cat, count]) => ({ cat, count }))
      .sort((a, b) => {
        const orderA = CATEGORY_ORDER[a.cat] || 99;
        const orderB = CATEGORY_ORDER[b.cat] || 99;
        return orderA - orderB;
      });
  }, [exercisesKnowledge, formDisciplineFilter]);

  const handleSelectFormDiscipline = (disc: 'ALL' | 'BOXING' | 'YOGA' | 'GYM') => {
    setFormDisciplineFilter(disc);
    if (formCategoryFilter !== 'ALL') {
      const stillValid = exercisesKnowledge.some((item) => {
        const d = getExerciseDiscipline(item);
        return (
          (disc === 'ALL' || d === disc) &&
          item.category?.toLowerCase().trim() === formCategoryFilter.toLowerCase().trim()
        );
      });
      if (!stillValid) {
        setFormCategoryFilter('ALL');
      }
    }
  };

  // Modal filtered exercises for the interactive picker
  const modalFilteredExercises = useMemo(() => {
    const topicPool =
      selectedTopic && onlyTopicMatched
        ? getRecommendedExercisesForTopic(
            selectedTopic.name,
            exercisesKnowledge,
            activeTopicDiscipline,
          )
        : exercisesKnowledge;

    return topicPool.filter((ex) => {
      const disc = getExerciseDiscipline(ex);
      const matchDiscipline =
        selectedTopic && onlyTopicMatched
          ? disc === activeTopicDiscipline
          : formDisciplineFilter === 'ALL' || disc === formDisciplineFilter;
      const matchCategory =
        formCategoryFilter === 'ALL' || ex.category.toLowerCase().trim() === formCategoryFilter.toLowerCase().trim();

      const q = formExerciseSearch.trim().toLowerCase();
      const meta = parseExerciseInstructions(ex.instructions);
      const { primary, secondary } = parseExerciseTitle(ex.title);
      const matchSearch =
        !q ||
        primary.toLowerCase().includes(q) ||
        (secondary && secondary.toLowerCase().includes(q)) ||
        ex.title.toLowerCase().includes(q) ||
        ex.category.toLowerCase().includes(q) ||
        translateCategory(ex.category).toLowerCase().includes(q) ||
        (meta.muscleVi && meta.muscleVi.toLowerCase().includes(q)) ||
        (meta.equipmentVi && meta.equipmentVi.toLowerCase().includes(q));

      return matchDiscipline && matchCategory && matchSearch;
    });
  }, [
    exercisesKnowledge,
    selectedTopic,
    onlyTopicMatched,
    activeTopicDiscipline,
    formDisciplineFilter,
    formCategoryFilter,
    formExerciseSearch,
  ]);

  const isCurrentLoading =
    activeTab === 'TEMPLATES'
      ? isLoadingTemplates
      : activeTab === 'CUSTOM_PLANS'
      ? isLoadingPlans
      : isLoadingExercises;

  const isCurrentRefetching =
    activeTab === 'TEMPLATES'
      ? isRefetchingTemplates
      : activeTab === 'CUSTOM_PLANS'
      ? isRefetchingPlans
      : isRefetchingExercises;

  const handleRefetch = () => {
    if (activeTab === 'TEMPLATES') void refetchTemplates();
    else if (activeTab === 'CUSTOM_PLANS') void refetchPlans();
    else void refetchExercises();
  };

  const location = useLocation();
  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24">
      {/* 1. HEADER: Clean /unslop contrast */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to={`${coachBasePath}/schedule`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#17664e] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Lịch HLV
            </Link>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-1">
            Giáo án &amp; Giáo trình
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tạo sẵn giáo trình dùng chung để gắn nhanh khi mở ca trên lịch, hoặc soạn riêng cho từng học viên
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={handleRefetch}
            disabled={isCurrentLoading || isCurrentRefetching}
            className="text-xs font-medium border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer h-9 px-3 rounded-xl"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCurrentRefetching ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>

          <Button
            onClick={() => {
              resetForm();
              setIsCreateOpen(true);
            }}
            className="bg-[#17664e] hover:bg-[#135641] text-white text-xs font-semibold gap-1.5 cursor-pointer h-9 px-4 rounded-xl"
          >
            <Plus className="h-4 w-4" />
            <span>Tạo giáo trình</span>
          </Button>
        </div>
      </div>

      {/* 2. SEGMENTED NAVIGATION BAR */}
      <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 w-full sm:w-fit overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('CUSTOM_PLANS')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === 'CUSTOM_PLANS'
              ? 'bg-[#17664e] text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className={`h-4 w-4 ${activeTab === 'CUSTOM_PLANS' ? 'text-white' : 'text-slate-500'}`} />
          <span>Giáo trình của tôi</span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium tabular-nums ${
              activeTab === 'CUSTOM_PLANS'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {plans.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TEMPLATES')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === 'TEMPLATES'
              ? 'bg-[#17664e] text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className={`h-4 w-4 ${activeTab === 'TEMPLATES' ? 'text-white' : 'text-slate-500'}`} />
          <span>Giáo trình tham khảo</span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium tabular-nums ${
              activeTab === 'TEMPLATES'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {qualifiedPlans.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('EXERCISE_LIBRARY')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            activeTab === 'EXERCISE_LIBRARY'
              ? 'bg-[#17664e] text-white'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Dumbbell className={`h-4 w-4 ${activeTab === 'EXERCISE_LIBRARY' ? 'text-white' : 'text-slate-500'}`} />
          <span>Kho động tác</span>
          <span
            className={`text-[11px] px-1.5 py-0.5 rounded-md font-medium tabular-nums ${
              activeTab === 'EXERCISE_LIBRARY'
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {exercisesKnowledge.length}
          </span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: GIÁO TRÌNH TẠO SẴN & GIÁO ÁN HỌC VIÊN              */}
      {/* ========================================================= */}
      {activeTab === 'CUSTOM_PLANS' && (
        <div className="space-y-5">
          {/* Controls Filter Bar */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            {/* Scope Filter Pills */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setPlanScopeFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    planScopeFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả ({plans.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPlanScopeFilter('BLUEPRINTS');
                    setSelectedStudentFilter('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    planScopeFilter === 'BLUEPRINTS'
                      ? 'bg-[#17664e] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Giáo trình tạo sẵn ({blueprintsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPlanScopeFilter('STUDENTS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    planScopeFilter === 'STUDENTS'
                      ? 'bg-[#17664e] text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Theo học viên ({studentPlansCount})
                </button>
              </div>

              <span className="text-[11px] text-slate-500">
                Giáo trình tạo sẵn có thể gắn ngay khi mở ca trong Lịch giảng dạy
              </span>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Member selector */}
                {planScopeFilter !== 'BLUEPRINTS' && (
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-[#17664e] shrink-0" />
                    <span className="text-xs font-medium text-slate-600">Học viên:</span>
                    <select
                      value={selectedStudentFilter}
                      onChange={(e) => setSelectedStudentFilter(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-[#17664e] focus:outline-hidden"
                    >
                      <option value="ALL">Tất cả học viên</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.user?.id || m.id}>
                          {m.user?.fullName || m.user?.email || 'Học viên PT'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Date sort */}
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-medium text-slate-600">Sắp xếp:</span>
                  <select
                    value={dateSort}
                    onChange={(e) => setDateSort(e.target.value as 'DESC' | 'ASC')}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-[#17664e] focus:outline-hidden"
                  >
                    <option value="DESC">Mới nhất trước</option>
                    <option value="ASC">Cũ nhất trước</option>
                  </select>
                </div>
              </div>

              {/* Search bar */}
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={customPlanSearch}
                  onChange={(e) => setCustomPlanSearch(e.target.value)}
                  placeholder="Tìm theo tên giáo trình hoặc học viên..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-9 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#17664e] focus:outline-hidden transition-all"
                />
                {customPlanSearch && (
                  <button
                    type="button"
                    onClick={() => setCustomPlanSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading */}
          {isLoadingPlans && (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Đang tải danh sách giáo án học viên...</p>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingPlans && filteredPlans.length === 0 && (
            <div className="py-16 text-center space-y-4 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
              <div className="h-16 w-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800">
                <Users className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  Chưa có giáo án tùy chỉnh nào
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Soạn giáo án mới cho học viên hoặc bấm "Dùng mẫu này" tại tab Lộ Trình Mẫu để sao chép nhanh bài tập.
                </p>
              </div>
              <Button
                onClick={() => {
                  resetForm();
                  setIsCreateOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 px-5 py-2.5 rounded-xl cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Soạn giáo án đầu tiên</span>
              </Button>
            </div>
          )}

          {/* Grid of Custom Plans & Reusable Curriculums */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredPlans.map((plan) => {
              const isBlueprint = !plan.memberId;
              const student = plan.memberId ? memberMap.get(plan.memberId) : null;
              const studentName = isBlueprint
                ? 'Giáo trình tạo sẵn'
                : plan.member?.fullName || student?.user?.fullName || student?.user?.email || 'Học viên PT';
              const studentInitial = isBlueprint ? 'GT' : studentName.charAt(0).toUpperCase();
              const totalSets = (plan.exercises || []).reduce((sum, e) => sum + (e.sets || 3), 0);

              return (
                <div
                  key={plan.id}
                  className="rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Row: Scope / Student info & Quick actions */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 rounded-xl font-semibold text-xs flex items-center justify-center shrink-0 ${
                            isBlueprint
                              ? 'bg-[#17664e] text-white'
                              : 'bg-slate-100 text-slate-800 border border-slate-200'
                          }`}
                        >
                          {studentInitial}
                        </div>
                        <div className="min-w-0">
                          {isBlueprint ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-[#17664e]">
                                Giáo trình tạo sẵn
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedGoalMember({
                                  fullName: studentName,
                                  email: plan.member?.email || student?.user?.email,
                                  phone: plan.member?.phone || student?.user?.phone,
                                  avatarUrl: student?.user?.avatarUrl,
                                  memberProfile: student?.user?.memberProfile,
                                });
                              }}
                              className="text-sm font-semibold text-slate-900 hover:text-[#17664e] hover:underline truncate flex items-center gap-1.5 text-left group cursor-pointer"
                              title="Bấm để xem mục tiêu & hồ sơ học viên"
                            >
                              <span className="truncate">{studentName}</span>
                              <Target className="w-3.5 h-3.5 text-[#17664e] opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                            </button>
                          )}
                          <p className="text-xs text-slate-500 truncate tabular-nums">
                            {isBlueprint
                              ? `Áp dụng khi mở ca · ${new Date(plan.createdAt).toLocaleDateString('vi-VN')}`
                              : `${plan.member?.phone || student?.user?.phone || 'Kèm riêng 1:1'} · ${new Date(plan.createdAt).toLocaleDateString('vi-VN')}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDuplicatePlan(plan)}
                          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 h-8 px-2 gap-1 cursor-pointer rounded-lg font-medium text-xs"
                          title="Nhân bản thành giáo trình mới"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditPlan(plan)}
                          className="text-slate-700 hover:text-slate-950 hover:bg-slate-100 h-8 px-2.5 gap-1.5 cursor-pointer rounded-lg font-medium text-xs"
                          title="Chỉnh sửa giáo trình này"
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-600" />
                          <span>Sửa</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm('Bạn có chắc chắn muốn xóa giáo trình này không?')) {
                              deleteMutation.mutate(plan.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 p-0 cursor-pointer rounded-lg transition-colors"
                          title="Xóa giáo trình này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Plan Title & Metadata Badges */}
                    <div className="space-y-1.5">
                      <h3 className="text-base font-semibold text-slate-900 tracking-tight leading-snug">
                        {plan.title}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap tabular-nums">
                        <span className="rounded-md bg-emerald-50 text-[#17664e] border border-emerald-200/80 px-2 py-0.5 text-[11px] font-medium">
                          {plan.exercises?.length || 0} bài tập
                        </span>
                        <span className="text-xs text-slate-500">
                          Tổng khối lượng: <strong className="text-slate-800 font-semibold">{totalSets}</strong> hiệp
                        </span>
                      </div>
                    </div>

                    {/* General Coach Note */}
                    {plan.notes && (() => {
                      const parsedNote = parseCoachNotes(plan.notes);
                      if (!parsedNote.topicTitle && !parsedNote.coachNote) return null;
                      return (
                        <div className="space-y-1.5">
                          {parsedNote.topicTitle && (
                            <div className="border-l-2 border-slate-400 bg-slate-50 px-3 py-2 rounded-r-xl text-xs text-slate-700 leading-relaxed">
                              <strong className="text-slate-900 font-semibold">Chuyên đề:</strong> {parsedNote.topicTitle}
                              {parsedNote.topicDescription ? (
                                <p className="text-[11px] text-slate-600 mt-0.5">{parsedNote.topicDescription}</p>
                              ) : null}
                            </div>
                          )}
                          {parsedNote.coachNote && (
                            <div className="border-l-2 border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2.5 rounded-r-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                              <strong className="text-emerald-800 dark:text-emerald-400 not-italic font-bold">Lời dặn của HLV:</strong> "{parsedNote.coachNote}"
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Exercise List preview (Style aligned with unified modal) */}
                    <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        DANH SÁCH BÀI TẬP ({plan.exercises?.length || 0})
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {plan.exercises?.map((ex, idx) => {
                          const kItem = exerciseKnowledgeMap.get(ex.exerciseId);
                          const meta = parseExerciseInstructions(
                            kItem?.instructions || (ex.exercise as any)?.instructions
                          );
                          const { primary, secondary } = parseExerciseTitle(
                            ex.exercise?.title || kItem?.title
                          );
                          const unitStr = meta.unitVi || 'reps';

                          return (
                            <div
                              key={ex.id || idx}
                              className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-3 text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate block">
                                      {primary}
                                    </span>
                                    {secondary && (
                                      <span className="text-[10px] text-slate-400 truncate block">
                                        ({secondary})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs block">
                                    {ex.sets || 3} hiệp × {ex.reps || 10} {unitStr}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block">
                                    {ex.weightKg && Number(ex.weightKg) > 0 ? `${ex.weightKg} kg · ` : 'Bodyweight · '}
                                    Nghỉ {ex.restSeconds || 60}s
                                  </span>
                                </div>
                              </div>

                              {ex.coachFeedback && (
                                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic pl-8">
                                  ↳ {ex.coachFeedback}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Bar */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-500">
                      {isBlueprint ? 'Có thể gắn khi mở ca' : 'Giáo án cá nhân'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setViewingPlan(plan)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#17664e] hover:bg-[#135641] text-white text-xs font-semibold transition-all cursor-pointer"
                    >
                      <span>Xem chi tiết</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: GIÁO TRÌNH THAM KHẢO THEO TỪNG LOẠI GÓI TẬP        */}
      {/* ========================================================= */}
      {activeTab === 'TEMPLATES' && (
        <div className="space-y-6">
          {/* Filter & Search Bar */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
                <button
                  type="button"
                  onClick={() => setSelectedRefPlanId('ALL')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    selectedRefPlanId === 'ALL'
                      ? 'bg-[#17664e] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Tất cả gói ({qualifiedPlans.length})
                </button>
                {qualifiedPlans.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedRefPlanId(p.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                      selectedRefPlanId === p.id
                        ? 'bg-[#17664e] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.name.replace(/\s*\(12 Buổi \/ Tháng\)/gi, '')}
                  </button>
                ))}
              </div>

              <div className="relative max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Tìm chuyên đề, bài tập tham khảo..."
                  className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden transition-all"
                />
                {templateSearch && (
                  <button
                    type="button"
                    onClick={() => setTemplateSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {qualifiedPlans.length === 0 ? (
            <div className="py-16 text-center space-y-3 rounded-3xl border border-dashed border-slate-300 bg-white p-8">
              <BookOpen className="h-10 w-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-black text-slate-900">Chưa có gói tập phù hợp chuyên môn</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Vui lòng kiểm tra chuyên môn được gán trong hồ sơ Huấn luyện viên.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {qualifiedPlans
                .filter((p: any) => selectedRefPlanId === 'ALL' || p.id === selectedRefPlanId)
                .map((plan: any) => {
                  const discCode = String(plan.discipline?.code || coachDiscipline || 'GYM').toUpperCase();
                  const topics = extractTopicsFromPlan(plan).filter((topic) => {
                    const q = templateSearch.trim().toLowerCase();
                    if (!q) return true;
                    const rec = getRecommendedExercisesForTopic(topic.name, exercisesKnowledge, discCode);
                    return (
                      topic.name.toLowerCase().includes(q) ||
                      topic.description.toLowerCase().includes(q) ||
                      rec.some((e) => e.title.toLowerCase().includes(q))
                    );
                  });

                  if (topics.length === 0) return null;

                  return (
                    <section
                      key={plan.id}
                      className="rounded-3xl bg-white border border-slate-200 shadow-xs overflow-hidden"
                    >
                      <div className="px-6 py-4 bg-slate-50/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#17664e] text-white text-[10px] font-black uppercase">
                              {plan.discipline?.name || discCode}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                              {topics.length} chuyên đề tham khảo
                            </span>
                          </div>
                          <h3 className="text-base font-black text-slate-900 mt-1.5">
                            {plan.name}
                          </h3>
                        </div>
                      </div>

                      <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {topics.map((topic) => {
                          const recExercises = getRecommendedExercisesForTopic(
                            topic.name,
                            exercisesKnowledge,
                            discCode,
                          );
                          return (
                            <div
                              key={`${plan.id}-topic-${topic.topicNumber}`}
                              className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 flex flex-col justify-between gap-4 hover:border-emerald-300 transition-all"
                            >
                              <div className="space-y-2.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                                    Chuyên đề {topic.topicNumber}
                                    {topic.sessionRange ? ` · ${topic.sessionRange}` : ''}
                                  </span>
                                  {topic.intensity && (
                                    <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 text-[10px] font-bold">
                                      {topic.intensity}
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-black text-slate-900 leading-snug">
                                  {topic.name}
                                </h4>

                                {topic.description && (
                                  <p className="text-xs text-slate-600 leading-relaxed">
                                    {topic.description}
                                  </p>
                                )}

                                {topic.benefits && (
                                  <p className="text-[11px] text-emerald-800 bg-emerald-50/70 border border-emerald-200/70 rounded-xl px-3 py-1.5 font-medium">
                                    Mục tiêu: {topic.benefits}
                                  </p>
                                )}

                                <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                    Động tác gợi ý ({recExercises.length} bài phù hợp)
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {recExercises.slice(0, 5).map((ex) => {
                                      const { primary } = parseExerciseTitle(ex.title);
                                      return (
                                        <span
                                          key={ex.id}
                                          className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700"
                                        >
                                          {primary}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className="pt-3 border-t border-slate-200/70 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleUseTopicAsDraft(plan, topic, recExercises)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#17664e] hover:bg-[#135641] text-white text-xs font-bold transition-all cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Soạn giáo án từ chuyên đề này</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: THƯ VIỆN ĐỘNG TÁC                                 */}
      {/* ========================================================= */}
      {activeTab === 'EXERCISE_LIBRARY' && (
        <div className="space-y-6">
          {/* Integrated Control Bar */}
          <div className="p-5 rounded-3xl bg-white border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              {/* Discipline Segmented Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {coachDiscipline ? (
                  <span className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-xs shrink-0">
                    Môn chuyên môn: {coachDiscipline === 'YOGA' ? 'Yoga' : coachDiscipline === 'BOXING' ? 'Boxing' : 'Gym'} ({disciplineCounts[coachDiscipline] || 0})
                  </span>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectDiscipline('ALL')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                        selectedExerciseDiscipline === 'ALL'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Tất cả môn ({disciplineCounts.ALL})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectDiscipline('BOXING')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                        selectedExerciseDiscipline === 'BOXING'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Boxing ({disciplineCounts.BOXING})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectDiscipline('YOGA')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                        selectedExerciseDiscipline === 'YOGA'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Yoga ({disciplineCounts.YOGA})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectDiscipline('GYM')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 ${
                        selectedExerciseDiscipline === 'GYM'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Gym ({disciplineCounts.GYM})
                    </button>
                  </>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative max-w-md w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={exerciseSearch}
                  onChange={(e) => setExerciseSearch(e.target.value)}
                  placeholder="Tra cứu bài tập, nhóm cơ chính, thiết bị..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-9 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden transition-all"
                />
                {exerciseSearch && (
                  <button
                    type="button"
                    onClick={() => setExerciseSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Topic Filter Pills (Dynamically matched to selected discipline) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                Chủ đề:
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === 'ALL'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả chủ đề ({selectedExerciseDiscipline !== 'ALL' ? disciplineCounts[selectedExerciseDiscipline] : disciplineCounts.ALL})
              </button>
              {exerciseCategories.map(({ cat, count }) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedCategory.toLowerCase() === cat.toLowerCase()
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                  }`}
                >
                  {translateCategory(cat)} ({count})
                </button>
              ))}
            </div>

            {/* Filter Stats */}
            <div className="flex items-center justify-between text-xs pt-1 text-slate-500">
              <span>
                Hiển thị <strong>{filteredExercises.length}</strong> / {exercisesKnowledge.length} bài tập chuẩn
                {selectedExerciseDiscipline !== 'ALL' && ` (${selectedExerciseDiscipline})`}
                {selectedCategory !== 'ALL' && ` · ${translateCategory(selectedCategory)}`}
              </span>

              {(selectedCategory !== 'ALL' || selectedExerciseDiscipline !== 'ALL' || exerciseSearch) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory('ALL');
                    if (!coachDiscipline) setSelectedExerciseDiscipline('ALL');
                    setExerciseSearch('');
                  }}
                  className="text-slate-900 dark:text-slate-100 font-bold hover:underline cursor-pointer"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>
          </div>

          {/* Loading */}
          {isLoadingExercises && (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Đang tải thư viện bài tập...</p>
            </div>
          )}

          {/* Empty */}
          {!isLoadingExercises && filteredExercises.length === 0 && (
            <div className="py-16 text-center space-y-3 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-8">
              <Dumbbell className="h-10 w-10 text-slate-400 mx-auto" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Không tìm thấy bài tập phù hợp</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Thử chọn chủ đề khác hoặc tìm kiếm với từ khóa rộng hơn.
              </p>
            </div>
          )}

          {/* Exercise Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredExercises.map((ex) => {
              const meta = parseExerciseInstructions(ex.instructions);
              const { primary, secondary } = parseExerciseTitle(ex.title);

              return (
                <div
                  key={ex.id}
                  className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      {/* Title & Badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-base font-black text-slate-900 dark:text-slate-100 leading-snug tracking-tight">
                            {primary}
                          </h4>
                          {secondary && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 truncate block mt-0.5 font-medium">
                              {secondary}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {meta.discipline && (
                            <span className="rounded-lg bg-emerald-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                              {meta.discipline}
                            </span>
                          )}
                          <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-bold">
                            {translateCategory(ex.category)}
                          </span>
                        </div>
                      </div>

                      {/* 3-Column Specification Tiles */}
                      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800 text-xs">
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-slate-400 text-[10px] flex items-center gap-1 font-bold uppercase">
                            <Target className="w-3 h-3 text-emerald-600 shrink-0" />
                            Cơ chính
                          </span>
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {meta.muscleVi}
                          </p>
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <span className="text-slate-400 text-[10px] flex items-center gap-1 font-bold uppercase">
                            <Dumbbell className="w-3 h-3 text-emerald-600 shrink-0" />
                            Thiết bị
                          </span>
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {meta.equipmentVi}
                          </p>
                        </div>

                        <div className="space-y-0.5 min-w-0">
                          <span className="text-slate-400 text-[10px] flex items-center gap-1 font-bold uppercase">
                            <Timer className="w-3 h-3 text-emerald-600 shrink-0" />
                            Đơn vị
                          </span>
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {meta.unitVi}
                          </p>
                        </div>
                      </div>

                      {/* Technical Guidance */}
                      {meta.instructionsText ? (
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 leading-relaxed italic line-clamp-3">
                          "{meta.instructionsText}"
                        </div>
                      ) : null}
                    </div>

                    {/* Action Button */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          handleAddExerciseToForm(ex);
                          setIsCreateOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer group"
                      >
                        <Plus className="w-4 h-4 text-white" />
                        <span>Thêm vào giáo án</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* UNIFIED WORKOUT PLAN DETAIL MODAL (Matching User Image)   */}
      {/* ========================================================= */}
      <WorkoutPlanDetailModal
        isOpen={!!viewingPlan}
        onClose={() => setViewingPlan(null)}
        title={viewingPlan?.title}
        coachName={user?.fullName || 'Huấn luyện viên phụ trách'}
        notes={viewingPlan?.notes}
        exercises={viewingPlan?.exercises as any}
      />

      <WorkoutPlanDetailModal
        isOpen={!!viewingTemplate}
        onClose={() => setViewingTemplate(null)}
        title={viewingTemplate?.title}
        coachName={`Lộ trình mẫu chuẩn · ${viewingTemplate?.disciplineCode}`}
        notes={viewingTemplate?.description}
        exercises={viewingTemplate?.exercises as any}
      />

      {/* ========================================================= */}
      {/* MODAL: SOẠN & HIỆU CHỈNH GIÁO ÁN HỌC VIÊN                 */}
      {/* ========================================================= */}
      {isCreateOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 flex flex-col items-center justify-center">
          <div className="w-full max-w-6xl my-auto rounded-3xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header: Clean light header with emerald accent */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 bg-slate-50 text-slate-900 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs font-black">
                  {editingPlanId ? <Pencil className="h-5 w-5" /> : <Dumbbell className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900 leading-tight truncate">
                      {editingPlanId ? 'Chỉnh Sửa Giáo Án Học Viên' : 'Soạn Giáo Án Huấn Luyện Mới'}
                    </h3>
                    {editingPlanId && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                        Đang chỉnh sửa
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                    {editingPlanId
                      ? 'Cập nhật lại danh sách bài tập, số hiệp, khối lượng tạ và dặn dò HLV cho học viên'
                      : 'Chọn động tác từ kho bài tập chuẩn và cá nhân hóa khối lượng tập luyện cho học viên'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body: Split 2-Column Studio */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0 space-y-5 bg-white dark:bg-slate-900">
              {formError && (
                <div className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ========================================================= */}
                {/* LEFT COLUMN: KHO BÀI TẬP (7 COLS)                        */}
                {/* ========================================================= */}
                <div className="lg:col-span-7 flex flex-col space-y-3.5 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-800">
                  {/* Header of Picker */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
                        Kho Động Tác Chuẩn
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Tìm và thêm bài tập vào giáo án bên phải
                      </p>
                    </div>

                    <span className="text-xs font-bold px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shrink-0">
                      Đã chọn: <strong>{exercisesList.length}</strong> bài
                    </span>
                  </div>

                  {/* Filter controls */}
                  <div className="space-y-2.5">
                    {/* Chuyên đề & Chủ đề khóa học */}
                    {qualifiedPlans.length > 0 && (
                      <div className="rounded-2xl border border-emerald-200/80 bg-white p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
                            Phân theo chuyên đề / chủ đề
                          </span>
                          {selectedTopic && (
                            <button
                              type="button"
                              onClick={() => setOnlyTopicMatched((prev) => !prev)}
                              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                onlyTopicMatched
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {onlyTopicMatched ? 'Đang lọc đúng chủ đề' : 'Hiện tất cả bài môn'}
                            </button>
                          )}
                        </div>

                        {qualifiedPlans.length > 1 && (
                          <select
                            value={activeCurriculumPlan?.id || ''}
                            onChange={(e) => {
                              const nextId = e.target.value;
                              setSelectedPackageId(nextId);
                              setSelectedTopic(null);
                              const pkg = qualifiedPlans.find((p: any) => p.id === nextId);
                              const disc = String(pkg?.discipline?.code || '').toUpperCase();
                              if (disc === 'YOGA' || disc === 'BOXING' || disc === 'GYM') {
                                setFormDisciplineFilter(disc);
                                setFormCategoryFilter('ALL');
                              }
                            }}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-emerald-600 focus:outline-hidden"
                          >
                            {qualifiedPlans.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTopic(null);
                              setFormCategoryFilter('ALL');
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                              !selectedTopic
                                ? 'bg-slate-900 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Tất cả chủ đề
                          </button>
                          {packageTopics.map((topic) => {
                            const isSelected = selectedTopic?.name === topic.name;
                            return (
                              <button
                                key={`${topic.topicNumber}-${topic.name}`}
                                type="button"
                                onClick={() => {
                                  setSelectedTopic(topic);
                                  setOnlyTopicMatched(true);
                                  setFormCategoryFilter('ALL');
                                  const disc = String(
                                    (activeCurriculumPlan as any)?.discipline?.code || '',
                                  ).toUpperCase();
                                  if (disc === 'YOGA' || disc === 'BOXING' || disc === 'GYM') {
                                    setFormDisciplineFilter(disc);
                                  }
                                  if (!planTitle.trim()) {
                                    setPlanTitle(topic.name);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer text-left ${
                                  isSelected
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-emerald-50/70 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-100'
                                }`}
                              >
                                Chủ đề {topic.topicNumber}: {topic.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Search */}
                    <div className="relative w-full">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={formExerciseSearch}
                        onChange={(e) => setFormExerciseSearch(e.target.value)}
                        placeholder="Tìm theo tên động tác, nhóm cơ chính..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-10 pr-9 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden transition-all shadow-sm"
                      />
                      {formExerciseSearch && (
                        <button
                          type="button"
                          onClick={() => setFormExerciseSearch('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    {/* Disciplines Filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {coachDiscipline ? (
                        <span className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-xs shrink-0">
                          Bộ môn: {coachDiscipline === 'YOGA' ? 'Yoga' : coachDiscipline === 'BOXING' ? 'Boxing' : 'Gym'} ({disciplineCounts[coachDiscipline] || 0})
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSelectFormDiscipline('ALL')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              formDisciplineFilter === 'ALL'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Tất cả ({disciplineCounts.ALL})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectFormDiscipline('BOXING')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              formDisciplineFilter === 'BOXING'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Boxing ({disciplineCounts.BOXING})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectFormDiscipline('YOGA')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              formDisciplineFilter === 'YOGA'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Yoga ({disciplineCounts.YOGA})
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectFormDiscipline('GYM')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                              formDisciplineFilter === 'GYM'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                          >
                            Gym ({disciplineCounts.GYM})
                          </button>
                        </>
                      )}
                    </div>

                    {/* Categories Filter (Dynamically matched to form discipline) */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 pt-1.5 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setFormCategoryFilter('ALL')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                          formCategoryFilter === 'ALL'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        Tất cả chủ đề ({disciplineCounts[formDisciplineFilter]})
                      </button>
                      {modalExerciseCategories.map(({ cat, count }) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            formCategoryFilter.toLowerCase() === cat.toLowerCase()
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                        >
                          {translateCategory(cat)} ({count})
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Exercise Picker Cards Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 max-h-[380px] sm:max-h-[440px] overflow-y-auto pr-1">
                    {modalFilteredExercises.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-xs text-slate-400 space-y-2">
                        <Dumbbell className="h-8 w-8 text-slate-300 mx-auto" />
                        <p>Không có bài tập nào phù hợp với bộ lọc tìm kiếm.</p>
                      </div>
                    ) : (
                      modalFilteredExercises.map((item) => {
                        const isAdded = exercisesList.some((e) => e.exerciseId === item.id);
                        const meta = parseExerciseInstructions(item.instructions);
                        const { primary, secondary } = parseExerciseTitle(item.title);

                        return (
                          <div
                            key={item.id}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              isAdded
                                ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                                : 'border-slate-200 bg-white hover:border-slate-400 shadow-xs'
                            }`}
                          >
                            <div className="space-y-1.5 min-w-0">
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {meta.discipline && (
                                    <span className="rounded-md bg-emerald-600 text-white px-1.5 py-0.5 text-[9px] font-black uppercase shrink-0">
                                      {meta.discipline}
                                    </span>
                                  )}
                                  <span className="rounded-md bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-0.5 text-[9px] font-bold truncate">
                                    {translateCategory(item.category)}
                                  </span>
                                </div>

                                {isAdded ? (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveExerciseFromForm(item.id)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-rose-600 text-white text-[10px] font-black flex items-center gap-1 shrink-0 transition-colors cursor-pointer group"
                                  >
                                    <Check className="w-3 h-3 group-hover:hidden" />
                                    <X className="w-3 h-3 hidden group-hover:inline" />
                                    <span className="group-hover:hidden">Đã chọn</span>
                                    <span className="hidden group-hover:inline">Bỏ chọn</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleAddExerciseToForm(item)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                                  >
                                    <Plus className="w-3 h-3 text-white" />
                                    <span>Thêm</span>
                                  </button>
                                )}
                              </div>

                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-slate-900 dark:text-slate-100 truncate leading-snug">
                                  {primary}
                                </h5>
                                {secondary && (
                                  <p className="text-[10px] font-medium text-slate-400 truncate">
                                    {secondary}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 pt-1.5 border-t border-slate-100 dark:border-slate-700/60 min-w-0 font-medium">
                              <span className="truncate flex-1 min-w-0"> {meta.muscleVi}</span>
                              <span className="truncate flex-1 min-w-0 text-right"> {meta.equipmentVi}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ========================================================= */}
                {/* RIGHT COLUMN: GIÁO ÁN ĐANG SOẠN (5 COLS)                   */}
                {/* ========================================================= */}
                <div className="lg:col-span-5 flex flex-col space-y-4">
                  {/* Target Member & Title */}
                  <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3.5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-900">
                          Đối tượng áp dụng
                        </label>
                        {editingPlanId && (
                          <span className="text-[11px] text-slate-400">
                            Cố định khi chỉnh sửa
                          </span>
                        )}
                      </div>
                      <select
                        value={targetMemberId}
                        onChange={(e) => {
                          setTargetMemberId(e.target.value);
                          setRecommendationHidden(false);
                        }}
                        disabled={!!editingPlanId}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-900 focus:border-[#17664e] focus:outline-hidden disabled:opacity-75 disabled:cursor-not-allowed"
                      >
                        <option value="">Giáo trình tạo sẵn (Áp dụng chung khi mở ca)</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.user?.id || m.id}>
                            Học viên: {m.user?.fullName || m.user?.email || 'Học viên PT'}
                          </option>
                        ))}
                      </select>
                    </div>

                    {targetMemberId && !editingPlanId && !recommendationHidden && (
                      <InbodyRecommendationCard
                        memberId={targetMemberId}
                        onApply={handleApplyRecommendation}
                        onDismiss={() => setRecommendationHidden(true)}
                      />
                    )}

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-900 dark:text-slate-100">
                        Tiêu đề giáo án <span className="text-emerald-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Giáo án tăng cơ ngực - lưng cho tuần 2"
                        value={planTitle}
                        onChange={(e) => setPlanTitle(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Lời dặn của HLV (Tùy chọn)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Dặn dò về khởi động, nhịp thở, nghỉ ngơi, dinh dưỡng..."
                        value={planNotes}
                        onChange={(e) => setPlanNotes(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden resize-none"
                      />
                    </div>
                  </div>

                  {/* Configured Exercises in Plan */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        Cấu Hình Bài Tập ({exercisesList.length})
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {exercisesList.length > 0 ? 'Hiệp, lần, tạ và thời gian nghỉ' : ''}
                      </span>
                    </div>

                    {exercisesList.length === 0 ? (
                      <div className="p-8 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 text-center space-y-2">
                        <Dumbbell className="h-8 w-8 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Chưa có bài tập nào trong giáo án
                        </p>
                        <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                          Bấm nút "+ Thêm" ở kho bài tập bên trái để đưa bài tập vào giáo án này.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                        {exercisesList.map((item, idx) => {
                          const { primary, secondary } = parseExerciseTitle(item.title);
                          return (
                            <div
                              key={item.exerciseId}
                              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 space-y-3 shadow-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black text-xs flex items-center justify-center shrink-0">
                                    {idx + 1}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-xs font-black text-slate-900 dark:text-slate-100 truncate block">
                                      {primary}
                                    </span>
                                    {secondary && (
                                      <span className="text-[10px] text-slate-400 truncate block">
                                        ({secondary})
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveExerciseFromForm(item.exerciseId)}
                                  className="text-slate-400 hover:text-rose-600 text-xs font-bold cursor-pointer shrink-0 p-1 rounded-lg hover:bg-rose-50"
                                  title="Xóa động tác này"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <NumberStepper
                                  label="Hiệp"
                                  min={1}
                                  max={50}
                                  step={1}
                                  size="sm"
                                  value={item.sets ? Number(item.sets) : 3}
                                  onChange={(val) => handleUpdateExerciseParam(idx, 'sets', val)}
                                />

                                <NumberStepper
                                  label="Lần / Giây"
                                  unit="lần"
                                  min={1}
                                  max={600}
                                  step={1}
                                  size="sm"
                                  value={item.reps ? Number(item.reps) : 10}
                                  onChange={(val) => handleUpdateExerciseParam(idx, 'reps', val)}
                                />

                                <NumberStepper
                                  label="Tạ (kg)"
                                  unit="kg"
                                  min={0}
                                  max={500}
                                  step={1}
                                  size="sm"
                                  value={item.weightKg ? Number(item.weightKg) : 0}
                                  onChange={(val) => handleUpdateExerciseParam(idx, 'weightKg', val)}
                                />

                                <NumberStepper
                                  label="Nghỉ (s)"
                                  unit="s"
                                  min={0}
                                  max={600}
                                  step={15}
                                  size="sm"
                                  value={item.restSeconds ? Number(item.restSeconds) : 60}
                                  onChange={(val) => handleUpdateExerciseParam(idx, 'restSeconds', val)}
                                />
                              </div>

                              <div>
                                <input
                                  type="text"
                                  placeholder="Lời dặn HLV cho bài tập này..."
                                  value={item.coachFeedback || ''}
                                  onChange={(e) =>
                                    handleUpdateExerciseParam(idx, 'coachFeedback', e.target.value)
                                  }
                                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 shrink-0">
              <div className="text-xs text-slate-600 font-medium">
                {exercisesList.length > 0 ? (
                  <span>
                    Giáo án gồm <strong className="text-slate-900 font-black">{exercisesList.length}</strong> bài tập
                  </span>
                ) : (
                  <span>Chưa chọn bài tập</span>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    resetForm();
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="text-xs font-bold cursor-pointer rounded-xl h-10 px-4 border-slate-300 dark:border-slate-700"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  onClick={() => (editingPlanId ? updateMutation.mutate() : createMutation.mutate())}
                  disabled={createMutation.isPending || updateMutation.isPending || exercisesList.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-2 disabled:opacity-50 cursor-pointer shadow-md rounded-xl h-10 px-5 active:scale-[0.98]"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  <span>
                    {editingPlanId
                      ? `Lưu cập nhật (${exercisesList.length} bài)`
                      : targetMemberId
                        ? `Lưu giáo án học viên (${exercisesList.length} bài)`
                        : `Lưu giáo trình tạo sẵn (${exercisesList.length} bài)`}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Member Goal & Profile Modal */}
      <MemberGoalModal
        member={selectedGoalMember}
        isOpen={Boolean(selectedGoalMember)}
        onClose={() => setSelectedGoalMember(null)}
      />
    </div>
  );
};
