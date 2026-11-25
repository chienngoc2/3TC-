import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Dumbbell,
  X,
  Trash2,
  Search,
  Layers,
  Save,
  ArrowRight,
  Zap,
  Loader2,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import { useNotification } from '@/context/notification-context';
import { coachPortalApi } from '../api/coach-portal-api';
import type { CoachScheduleSession } from '../types/coach-schedule.types';
import type {
  ExerciseKnowledgeItem,
} from '../types/coach-portal.types';
import {
  parseExerciseInstructions,
  translateCategory,
  getExerciseDiscipline,
} from '../utils/exercise-metadata.utils';
import { isCoachQualifiedForPlan } from '@/lib/topic-matcher';
import { parseCoachNotes } from '@/lib/workout-notes';
import {
  extractTopicsFromPlan,
  getRecommendedExercisesForTopic,
  type NormalizedCurriculumTopic,
} from '../utils/curriculum-topics.utils';

interface SlotWorkoutPlanModalProps {
  session: CoachScheduleSession;
  isOpen: boolean;
  onClose: () => void;
  onSavePlan: (formattedPlan: string) => void;
}

interface SelectedExercise {
  id: string;
  title: string;
  category?: string;
  sets: number;
  reps: number;
  restSeconds: number;
  weightKg?: number;
  note?: string;
}

export const SlotWorkoutPlanModal: React.FC<SlotWorkoutPlanModalProps> = ({
  session,
  isOpen,
  onClose,
  onSavePlan,
}) => {
  const { showToast } = useNotification();

  // Synchronously parse session.notes once on mount without causing layout shifts
  const initialData = useMemo(() => {
    const raw = (session?.notes || '').trim().replace(/\r\n/g, '\n');
    let title =
      session?.title && session?.title !== 'Slot trống'
        ? `Giáo án: ${session.title}`
        : 'Giáo án buổi tập';
    let topicName: string | null = null;
    let topicDesc: string | null = null;
    const exercises: SelectedExercise[] = [];

    if (raw) {
      const titleMatch = raw.match(/^\[GIÁO ÁN\]:\s*([^\n]+)/);
      if (titleMatch) title = titleMatch[1].trim();

      const topicMatch = raw.match(/\[CHUYÊN ĐỀ\]:\s*([^\n]+)/);
      if (topicMatch) topicName = topicMatch[1].trim();

      const descMatch = raw.match(/• Nội dung:\s*([^\n]+)/);
      if (descMatch) topicDesc = descMatch[1].trim();

      const exerciseLines = raw.match(
        /\d+\.\s*([^:\n\r]+):\s*(\d+)\s*hiệp\s*x\s*(\d+)\s*lần(?:\s*\(Nghỉ\s*(\d+)s\))?/g
      );
      if (exerciseLines) {
        exerciseLines.forEach((line, idx) => {
          const m = line.match(
            /\d+\.\s*([^:\n\r]+):\s*(\d+)\s*hiệp\s*x\s*(\d+)\s*lần(?:\s*\(Nghỉ\s*(\d+)s\))?/
          );
          if (m) {
            exercises.push({
              id: `parsed-${idx}-${Date.now()}`,
              title: m[1].trim(),
              sets: Number(m[2]),
              reps: Number(m[3]),
              restSeconds: m[4] ? Number(m[4]) : 30,
              category: 'CUSTOM',
            });
          }
        });
      }
    }

    return { title, rawNotes: raw, topicName, topicDesc, exercises };
  }, [session?.notes, session?.title]);

  const [activeStep, setActiveStep] = useState<'TOPICS' | 'EXERCISES' | 'EDITOR'>(() => {
    return initialData.exercises.length > 0 ? 'EDITOR' : 'TOPICS';
  });

  // Plan editor states
  const [planTitle, setPlanTitle] = useState<string>(() => initialData.title);
  const [selectedExercises, setSelectedExercises] = useState<SelectedExercise[]>(
    () => initialData.exercises
  );
  const [generalNotes, setGeneralNotes] = useState<string>(
    () => parseCoachNotes(initialData.rawNotes).coachNote || '',
  );

  // Selected package and topic states
  const [chosenPackageId, setChosenPackageId] = useState<string>('');
  const [chosenTopic, setChosenTopic] = useState<NormalizedCurriculumTopic | null>(null);

  // Exercise filtering in Step 2
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [onlyShowTopicMatched, setOnlyShowTopicMatched] = useState<boolean>(true);
  const [exerciseCategoryFilter, setExerciseCategoryFilter] = useState<string>('ALL');

  // Custom new exercise input
  const [customExerciseName, setCustomExerciseName] = useState('');

  // 1. Fetch coach profile
  const { data: coachProfile } = useQuery({
    queryKey: ['coach', 'my-profile'],
    queryFn: () => coachPortalApi.getMyProfile(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  // 2. Fetch coach rates
  const { data: coachRates = [] } = useQuery({
    queryKey: ['coach', 'my-rates', (coachProfile as any)?.id],
    queryFn: () =>
      (coachProfile as any)?.id ? coachPortalApi.getMyRates((coachProfile as any).id) : [],
    staleTime: 5 * 60 * 1000,
    enabled: isOpen && Boolean((coachProfile as any)?.id),
  });

  // 3. Disciplines coach teaches
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

    const sTitle = (session.title || '').toUpperCase();
    const sRoom = (session.roomName || '').toUpperCase();
    if (sTitle.includes('BOXING') || sRoom.includes('BOXING')) list.add('BOXING');
    if (sTitle.includes('YOGA') || sRoom.includes('YOGA')) list.add('YOGA');
    if (sTitle.includes('GYM') || sRoom.includes('GYM')) list.add('GYM');

    return Array.from(list);
  }, [coachProfile, coachRates, session.title, session.roomName]);

  // 4. Query membership plans (Packages)
  const { data: rawMembershipPlans = [], isLoading: isPlansLoading } = useQuery({
    queryKey: ['coach', 'membership-plans'],
    queryFn: () => coachPortalApi.getMembershipPlans(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  // Filter plans strictly by coach qualifications/specialties
  const qualifiedPlans = useMemo(() => {
    if (!rawMembershipPlans.length) return [];

    // If coach profile and specialties exist, strictly filter packages coach is qualified to teach
    if (coachProfile) {
      const coachSpecs = (coachProfile as any)?.coachProfile?.coachSpecialties || [];
      if (coachSpecs.length > 0) {
        const filtered = rawMembershipPlans.filter((p: any) =>
          isCoachQualifiedForPlan(coachProfile as any, p)
        );
        if (filtered.length > 0) return filtered;
      }
    }

    // Fallback: match by discipline
    return rawMembershipPlans.filter((p: any) => {
      const pDisc = (p.discipline?.code || '').toUpperCase();
      if (coachDisciplines.length === 1) return pDisc === coachDisciplines[0];
      if (coachDisciplines.length > 1) return coachDisciplines.includes(pDisc);
      return true;
    });
  }, [coachProfile, rawMembershipPlans, coachDisciplines]);

  // Derived selected package: computes synchronously without extra cascading effects
  const selectedPackage = useMemo(() => {
    if (chosenPackageId && qualifiedPlans.some((p: any) => p.id === chosenPackageId)) {
      return qualifiedPlans.find((p: any) => p.id === chosenPackageId)!;
    }
    if (qualifiedPlans.length > 0) {
      const sTitle = (session.title || '').toLowerCase();
      const match = qualifiedPlans.find(
        (p: any) =>
          p.name.toLowerCase().includes(sTitle) || sTitle.includes(p.name.toLowerCase())
      );
      return match || qualifiedPlans[0];
    }
    return null;
  }, [chosenPackageId, qualifiedPlans, session.title]);

  const selectedPackageId = selectedPackage?.id || '';

  const activeDiscipline = useMemo(() => {
    const pkgDisc = (selectedPackage as any)?.discipline?.code || (selectedPackage as any)?.disciplineCode;
    if (pkgDisc) return String(pkgDisc).toUpperCase();

    const sTitle = (session.title || '').toUpperCase();
    const sRoom = (session.roomName || '').toUpperCase();
    const sDisc = (session.disciplineName || '').toUpperCase();
    if (sTitle.includes('BOXING') || sRoom.includes('BOXING') || sDisc.includes('BOXING')) return 'BOXING';
    if (sTitle.includes('YOGA') || sRoom.includes('YOGA') || sDisc.includes('YOGA')) return 'YOGA';
    if (sTitle.includes('GYM') || sRoom.includes('GYM') || sDisc.includes('GYM')) return 'GYM';

    return coachDisciplines[0] || 'GYM';
  }, [selectedPackage, session.title, session.roomName, session.disciplineName, coachDisciplines]);

  const packageTopics = useMemo<NormalizedCurriculumTopic[]>(() => {
    return extractTopicsFromPlan(selectedPackage);
  }, [selectedPackage]);

  // Derived selected topic: aligns with user choice or matched note topic
  const selectedTopic = useMemo(() => {
    if (chosenTopic) return chosenTopic;
    if (initialData.topicName && packageTopics.length > 0) {
      const match = packageTopics.find(
        (t) =>
          t.name.toLowerCase().includes(initialData.topicName!.toLowerCase()) ||
          initialData.topicName!.toLowerCase().includes(t.name.toLowerCase())
      );
      if (match) return match;
    }
    return null;
  }, [chosenTopic, initialData.topicName, packageTopics]);

  // 5. Query exercise knowledge library
  const { data: exerciseLibrary = [], isLoading: _isLibraryLoading } = useQuery({
    queryKey: ['coach', 'exercise-knowledge'],
    queryFn: () => coachPortalApi.getExerciseKnowledge(),
    staleTime: 5 * 60 * 1000,
    enabled: isOpen,
  });

  // 6. Query coach pre-created curriculums for quick apply
  const { data: coachPlans = [] } = useQuery({
    queryKey: ['coach', 'workout-plans'],
    queryFn: () => coachPortalApi.getWorkoutPlans(),
    staleTime: 30 * 1000,
    enabled: isOpen,
  });

  const prebuiltCurriculums = useMemo(() => {
    const blueprints = coachPlans.filter((p) => !p.memberId);
    return blueprints.length > 0 ? blueprints : coachPlans;
  }, [coachPlans]);

  const handleApplyPrebuiltCurriculum = (sourcePlan: any, loadOnlyToEditor = false) => {
    const mapped: SelectedExercise[] = (sourcePlan.exercises || []).map((ex: any, idx: number) => ({
      id: `prebuilt-${Date.now()}-${idx}`,
      title: ex.exercise?.title || ex.title || `Bài tập #${idx + 1}`,
      category: ex.exercise?.category || 'CUSTOM',
      sets: ex.sets || 3,
      reps: ex.reps || 10,
      restSeconds: ex.restSeconds || 60,
      weightKg: ex.weightKg !== null && ex.weightKg !== undefined ? Number(ex.weightKg) : undefined,
      note: ex.coachFeedback || undefined,
    }));
    setPlanTitle(sourcePlan.title);
    setSelectedExercises(mapped);
    setGeneralNotes(sourcePlan.notes || '');
    setChosenTopic(null);

    if (loadOnlyToEditor) {
      setActiveStep('EDITOR');
      showToast('success', 'Đã nạp giáo trình', `Đã đưa "${sourcePlan.title}" vào trình chỉnh sửa.`);
      return;
    }

    const lines: string[] = [`[GIÁO ÁN]: ${sourcePlan.title}`, ''];
    if (mapped.length > 0) {
      lines.push(`--- DANH SÁCH BÀI TẬP (${mapped.length} động tác) ---`);
      mapped.forEach((ex, idx) => {
        lines.push(`${idx + 1}. ${ex.title}: ${ex.sets} hiệp x ${ex.reps} lần (Nghỉ ${ex.restSeconds}s)`);
      });
      lines.push('');
    }
    if (sourcePlan.notes) {
      lines.push(`--- GHI CHÚ ---\n${sourcePlan.notes}`);
    }
    const planText = lines.join('\n').trim();

    if (session.coachAvailabilityId) {
      coachPortalApi
        .applyWorkoutPlanToSlot(session.coachAvailabilityId, { workoutPlanId: sourcePlan.id })
        .catch(() => {});
    }
    if (session.bookings && session.bookings.length > 0) {
      Promise.all(
        session.bookings.map((b) =>
          coachPortalApi
            .saveBookingWorkoutPlan(b.id, { workoutPlanId: sourcePlan.id })
            .catch(() => {})
        )
      );
    }
    onSavePlan(planText);
    showToast('success', 'Đã áp dụng giáo trình', `Đã gắn "${sourcePlan.title}" vào ca dạy.`);
    onClose();
  };

  // Filtered exercises for coach's discipline
  const disciplineExercises = useMemo(() => {
    const discExercises = exerciseLibrary.filter((item: ExerciseKnowledgeItem) => {
      const disc = getExerciseDiscipline(item);
      return disc === activeDiscipline;
    });
    return discExercises.length > 0 ? discExercises : exerciseLibrary;
  }, [exerciseLibrary, activeDiscipline]);

  // Matched exercises for the selected topic
  const matchedExercisesForTopic = useMemo(() => {
    if (!selectedTopic) return disciplineExercises;
    return getRecommendedExercisesForTopic(
      selectedTopic.name,
      disciplineExercises,
      activeDiscipline
    );
  }, [selectedTopic, disciplineExercises, activeDiscipline]);

  // Available categories for Step 2
  const availableCategories = useMemo(() => {
    const list = onlyShowTopicMatched && selectedTopic ? matchedExercisesForTopic : disciplineExercises;
    const map = new Map<string, number>();
    list.forEach((item) => {
      const cat = item.category?.toLowerCase().trim();
      if (cat) map.set(cat, (map.get(cat) || 0) + 1);
    });
    return Array.from(map.entries()).map(([cat, count]) => ({ cat, count }));
  }, [onlyShowTopicMatched, selectedTopic, matchedExercisesForTopic, disciplineExercises]);

  // Displayed exercises in Step 2
  const displayedExercises = useMemo(() => {
    const source =
      onlyShowTopicMatched && selectedTopic
        ? matchedExercisesForTopic
        : disciplineExercises;

    return source.filter((item) => {
      const matchCat =
        exerciseCategoryFilter === 'ALL' ||
        item.category.toLowerCase().trim() === exerciseCategoryFilter.toLowerCase().trim();

      const q = exerciseSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        translateCategory(item.category).toLowerCase().includes(q);

      return matchCat && matchSearch;
    });
  }, [
    onlyShowTopicMatched,
    selectedTopic,
    matchedExercisesForTopic,
    disciplineExercises,
    exerciseCategoryFilter,
    exerciseSearch,
  ]);

  // Handler: Select a topic
  const handleSelectTopic = (topic: NormalizedCurriculumTopic) => {
    setChosenTopic(topic);
    const pName = selectedPackage?.name || 'Lớp nhóm';
    setPlanTitle(`${pName} • ${topic.name}`);

    let notes = `[CHUYÊN ĐỀ]: ${topic.name}\n`;
    if (topic.description) notes += `• Nội dung: ${topic.description}\n`;
    setGeneralNotes(notes.trim());

    setActiveStep('EXERCISES');
    setOnlyShowTopicMatched(true);
    setExerciseCategoryFilter('ALL');
  };

  // Handler: Auto populate recommended exercises
  const handleAutoPopulateTopicExercises = () => {
    if (!selectedTopic) return;
    const recommended = getRecommendedExercisesForTopic(
      selectedTopic.name,
      disciplineExercises,
      activeDiscipline
    );
    const newItems: SelectedExercise[] = recommended.slice(0, 5).map((ex, idx) => {
      const meta = parseExerciseInstructions(ex.instructions);
      return {
        id: `auto-ex-${Date.now()}-${idx}`,
        title: ex.title,
        category: ex.category,
        sets: 3,
        reps: meta.unit === 'seconds' ? 30 : 10,
        restSeconds: 60,
      };
    });
    setSelectedExercises(newItems);
    showToast('success', 'Đã thêm bài tập', `Đã chọn ${newItems.length} bài mẫu.`);
  };

  const handleAddFromLibrary = (item: ExerciseKnowledgeItem) => {
    const meta = parseExerciseInstructions(item.instructions);
    const newEx: SelectedExercise = {
      id: `lib-ex-${Date.now()}-${Math.random()}`,
      title: item.title,
      category: item.category,
      sets: 3,
      reps: meta.unit === 'seconds' ? 30 : 10,
      restSeconds: 60,
    };
    setSelectedExercises((prev) => [...prev, newEx]);
  };

  const handleAddCustomExercise = () => {
    if (!customExerciseName.trim()) return;
    const newEx: SelectedExercise = {
      id: `custom-ex-${Date.now()}`,
      title: customExerciseName.trim(),
      sets: 3,
      reps: 10,
      restSeconds: 60,
    };
    setSelectedExercises((prev) => [...prev, newEx]);
    setCustomExerciseName('');
  };

  const handleRemoveExercise = (id: string) => {
    setSelectedExercises((prev) => prev.filter((e) => e.id !== id));
  };

  const handleUpdateExerciseField = (
    id: string,
    field: keyof SelectedExercise,
    value: any
  ) => {
    setSelectedExercises((prev) =>
      prev.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const handleSave = async () => {
    let formatted = `[GIÁO ÁN]: ${planTitle.trim()}\n\n`;

    if (selectedTopic) {
      formatted += `[CHUYÊN ĐỀ]: ${selectedTopic.name}\n`;
      if (selectedTopic.description) formatted += `• Nội dung: ${selectedTopic.description}\n`;
      formatted += `\n`;
    }

    if (selectedExercises.length > 0) {
      formatted += `--- DANH SÁCH BÀI TẬP (${selectedExercises.length} động tác) ---\n`;
      selectedExercises.forEach((ex, idx) => {
        formatted += `${idx + 1}. ${ex.title}: ${ex.sets} hiệp x ${ex.reps} lần (Nghỉ ${ex.restSeconds}s)\n`;
      });
      formatted += `\n`;
    }

    const cleanExtraNote =
      parseCoachNotes(generalNotes).coachNote ||
      generalNotes
        .replace(/\[CHUYÊN ĐỀ\]:[^\n]*\n?/g, '')
        .replace(/•\s*Nội dung:[^\n]*\n?/g, '')
        .replace(/--- GHI CHÚ ---\n?/g, '')
        .trim();

    if (cleanExtraNote) {
      formatted += `--- GHI CHÚ ---\n${cleanExtraNote}`;
    }

    const planText = formatted.trim();

    // 1. Prepare structured API payload
    const structuredNotesParts: string[] = [];
    if (selectedTopic) {
      structuredNotesParts.push(`[CHUYÊN ĐỀ]: ${selectedTopic.name}`);
      if (selectedTopic.description) {
        structuredNotesParts.push(`• Nội dung: ${selectedTopic.description}`);
      }
    }
    if (cleanExtraNote) {
      structuredNotesParts.push(cleanExtraNote);
    }

    const structuredPayload = {
      title: planTitle.trim() || 'Giáo án buổi tập',
      notes: structuredNotesParts.join('\n').trim(),
      exercises: selectedExercises.map((e) => ({
        title: e.title,
        category: e.category,
        sets: Number(e.sets) || 3,
        reps: Number(e.reps) || 10,
        restSeconds: Number(e.restSeconds) || 30,
        weightKg: e.weightKg !== undefined && e.weightKg !== null ? Number(e.weightKg) : null,
      })),
    };

    // 1. Cache to localStorage and broadcast event immediately
    try {
      const saved = localStorage.getItem('coach_session_notes_map');
      const map = saved ? JSON.parse(saved) : {};
      if (session.id) map[session.id] = planText;
      if (session.coachAvailabilityId) map[session.coachAvailabilityId] = planText;
      if (session.scheduleId) map[session.scheduleId] = planText;
      if (session.startTime) {
        map[session.startTime] = planText;
        map[session.startTime.slice(0, 16)] = planText;
        try {
          const sDate = new Date(session.startTime);
          const ymd = sDate.toISOString().slice(0, 10);
          map[`${ymd}_${sDate.getHours()}`] = planText;
        } catch {}
      }
      // Clean up legacy global fallback keys to avoid bleeding plans across unrelated slots
      delete map['latest_saved_plan'];
      delete map['latest_yoga_plan'];
      localStorage.setItem('coach_session_notes_map', JSON.stringify(map));
    } catch {}

    // Dispatch custom event for cross-component live sync
    window.dispatchEvent(
      new CustomEvent('workout-plan-updated', {
        detail: {
          sessionId: session.id,
          scheduleId: session.scheduleId,
          coachAvailabilityId: session.coachAvailabilityId,
          planText,
          structuredPlan: structuredPayload,
        },
      })
    );

    // Close modal and show feedback instantly
    onSavePlan(planText);
    showToast('success', 'Thành công', 'Đã lưu và cập nhật giáo án buổi tập!');
    onClose();

    // 2. Persist to Postgres backend via API asynchronously
    try {
      if (session.coachAvailabilityId) {
        coachPortalApi
          .applyWorkoutPlanToSlot(session.coachAvailabilityId, structuredPayload)
          .catch((err) => {
            console.warn('Could not persist workout plan on slot', session.coachAvailabilityId, err);
          });
      }
      if (session.bookings && session.bookings.length > 0) {
        Promise.all(
          session.bookings.map((b) =>
            coachPortalApi.saveBookingWorkoutPlan(b.id, structuredPayload).catch((err) => {
              console.warn('Could not save workout plan for booking', b.id, err);
            })
          )
        );
      }
      if (session.scheduleId) {
        coachPortalApi.saveScheduleWorkoutPlan(session.scheduleId, structuredPayload).catch((err) => {
          console.warn('Could not save workout plan for schedule', session.scheduleId, err);
        });
      }
    } catch (err) {
      console.error('Error persisting workout plan to backend:', err);
    }
  };

  if (!isOpen) return null;

  const sessionTimeLabel = (() => {
    try {
      const s = new Date(session.startTime);
      const e = new Date(session.endTime);
      return `${s.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString(
        'vi-VN',
        { hour: '2-digit', minute: '2-digit' }
      )}`;
    } catch {
      return '';
    }
  })();

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl max-h-[90vh] bg-white text-slate-900 rounded-2xl shadow-xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header - Clean & Concise */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#17664e] text-white flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Soạn giáo án
                </h3>
                
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {sessionTimeLabel} {session.roomName ? `• ${session.roomName}` : ''}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3-Step Navigation Bar - Short Labels */}
        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold divide-x divide-slate-200">
          <button
            type="button"
            onClick={() => setActiveStep('TOPICS')}
            className={`py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeStep === 'TOPICS'
                ? 'bg-white text-[#17664e] border-b-2 border-[#17664e] font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span>1. Giáo trình & Chuyên đề</span>
            {selectedTopic && <Check className="w-3.5 h-3.5 text-[#17664e]" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('EXERCISES')}
            className={`py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeStep === 'EXERCISES'
                ? 'bg-white text-[#17664e] border-b-2 border-[#17664e] font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5 shrink-0" />
            <span>2. Bài tập</span>
            {selectedExercises.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#17664e] text-white">
                {selectedExercises.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveStep('EDITOR')}
            className={`py-2.5 px-3 flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              activeStep === 'EDITOR'
                ? 'bg-white text-[#17664e] border-b-2 border-[#17664e] font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Save className="w-3.5 h-3.5 shrink-0" />
            <span>3. Chi tiết</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isPlansLoading && qualifiedPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#17664e]" />
              <p className="text-xs font-semibold">Đang chuẩn bị giáo án...</p>
            </div>
          ) : (
            <>
              {/* ================================================================= */}
              {/* STEP 1: CHỌN CHỦ ĐỀ BÀI TẬP THEO CHUYÊN ĐỀ PHỤ TRÁCH              */}
              {/* ================================================================= */}
              {activeStep === 'TOPICS' && (
            <div className="space-y-4">
              {/* Giáo trình tạo sẵn (Áp dụng nhanh 1 chạm) */}
              {prebuiltCurriculums.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-[#17664e]" />
                      <span>Giáo trình tạo sẵn ({prebuiltCurriculums.length})</span>
                    </span>
                    <span className="text-[11px] text-slate-500">Áp dụng nhanh cho ca này</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                    {prebuiltCurriculums.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {p.title}
                            </span>
                            <span className="text-[11px] font-medium text-[#17664e] tabular-nums shrink-0">
                              {p.exercises?.length || 0} bài
                            </span>
                          </div>
                          {p.notes ? (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{p.notes}</p>
                          ) : null}
                        </div>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleApplyPrebuiltCurriculum(p, true)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                          >
                            Tùy chỉnh
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplyPrebuiltCurriculum(p, false)}
                            className="px-2.5 py-1 rounded-lg bg-[#17664e] hover:bg-[#135641] text-white text-[11px] font-semibold cursor-pointer"
                          >
                            Áp dụng ngay
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nếu HLV phụ trách 1 chuyên đề duy nhất: cố định luôn, không bắt chọn gói */}
              {qualifiedPlans.length <= 1 ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                    <div>
                      <span className="text-[11px] text-slate-500 font-medium block">
                        Chuyên đề HLV đang phụ trách:
                      </span>
                      <span className="text-xs font-bold text-slate-900">
                        {selectedPackage?.name || 'Khóa Học Yoga Trị Liệu & Phục Hồi Cột Sống (12 Buổi / Tháng)'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-800 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                    Chuyên môn chính
                  </span>
                </div>
              ) : (
                /* Nếu HLV phụ trách từ 2 chuyên đề trở lên: cho phép chuyển đổi chuyên đề */
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-700" />
                      <span>Chuyên đề bạn đang phụ trách ({qualifiedPlans.length}):</span>
                    </span>
                    <span className="text-[11px] text-slate-500">Bấm để đổi chuyên đề</span>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {qualifiedPlans.map((plan: any) => {
                      const isSelected = plan.id === selectedPackageId;
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => {
                            setChosenPackageId(plan.id);
                            setChosenTopic(null);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                            isSelected
                              ? 'bg-[#17664e] text-white shadow-2xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {plan.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Header hướng dẫn chọn chủ đề bài tập */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Chủ đề bài tập trong chuyên đề ({packageTopics.length})</span>
                </span>
                <span className="text-[11px] text-slate-500">
                  Chọn chủ đề buổi học để chuẩn bị bài tập
                </span>
              </div>

              {/* Topics Grid - Clean cards */}
              {packageTopics.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                  Chưa có chủ đề bài tập cho chuyên đề này.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {packageTopics.map((topic) => {
                    const isSelected = selectedTopic?.name === topic.name;
                    return (
                      <div
                        key={topic.topicNumber}
                        onClick={() => handleSelectTopic(topic)}
                        className={`rounded-xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-emerald-50/70 border-[#17664e] ring-1 ring-[#17664e]'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1">
                            <span className="text-[10px] font-bold text-slate-400">
                              #{topic.topicNumber}
                            </span>
                            {topic.intensity && (
                              <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                {topic.intensity}
                              </span>
                            )}
                          </div>
                          <h5 className="text-xs font-bold text-slate-900">
                            {topic.name}
                          </h5>
                          {topic.description && (
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                              {topic.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-semibold text-[#17664e] pt-1">
                          <span className="inline-flex items-center gap-1">
                            {isSelected ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Đã chọn</span>
                              </>
                            ) : (
                              'Chọn chủ đề'
                            )}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 2: CHỌN BÀI TẬP                                              */}
          {/* ================================================================= */}
          {activeStep === 'EXERCISES' && (
            <div className="space-y-3.5">
              {/* Selected Topic Bar */}
              <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#17664e] text-white shrink-0">
                    Chuyên đề
                  </span>
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {selectedTopic ? selectedTopic.name : 'Chưa chọn'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {selectedTopic && (
                    <Button
                      size="sm"
                      onClick={handleAutoPopulateTopicExercises}
                      className="bg-[#17664e] hover:bg-[#135641] text-white font-semibold text-xs h-7 px-2.5 gap-1 cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-300" />
                      <span>Nạp bài mẫu</span>
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveStep('TOPICS')}
                    className="text-xs text-slate-500 hover:text-slate-800 underline px-1 cursor-pointer"
                  >
                    Đổi
                  </button>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setOnlyShowTopicMatched(!onlyShowTopicMatched)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border ${
                      onlyShowTopicMatched
                        ? 'bg-[#17664e] text-white border-[#17664e]'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    Phù hợp ({matchedExercisesForTopic.length})
                  </button>

                  <div className="flex items-center gap-1 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setExerciseCategoryFilter('ALL')}
                      className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer ${
                        exerciseCategoryFilter === 'ALL'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Tất cả
                    </button>
                    {availableCategories.map(({ cat, count }) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setExerciseCategoryFilter(cat)}
                        className={`px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer shrink-0 ${
                          exerciseCategoryFilter === cat
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {translateCategory(cat)} ({count})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative w-44">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                  <input
                    type="text"
                    placeholder="Tìm bài..."
                    value={exerciseSearch}
                    onChange={(e) => setExerciseSearch(e.target.value)}
                    className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:border-[#17664e] focus:outline-none"
                  />
                </div>
              </div>

              {/* Exercises List */}
              {displayedExercises.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                  Không có bài tập phù hợp.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {displayedExercises.map((item: ExerciseKnowledgeItem) => {
                    const isAdded = selectedExercises.some((e) => e.title === item.title);

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-white p-2.5 flex items-center justify-between gap-2 hover:border-slate-300"
                      >
                        <div className="min-w-0">
                          <h5 className="text-xs font-semibold text-slate-900 truncate">
                            {item.title}
                          </h5>
                          <span className="text-[10px] text-slate-400">
                            {translateCategory(item.category)}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleAddFromLibrary(item)}
                          disabled={isAdded}
                          className={`px-2 py-1 rounded text-[11px] font-semibold shrink-0 cursor-pointer ${
                            isAdded
                              ? 'bg-slate-100 text-slate-400 cursor-default'
                              : 'bg-emerald-50 text-[#17664e] hover:bg-emerald-100'
                          }`}
                        >
                          {isAdded ? 'Đã thêm' : '+ Thêm'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Advance CTA */}
              {selectedExercises.length > 0 && (
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-600 font-medium">
                    Đã chọn: <strong className="text-slate-900">{selectedExercises.length}</strong> bài
                  </span>
                  <Button
                    size="sm"
                    onClick={() => setActiveStep('EDITOR')}
                    className="bg-[#17664e] hover:bg-[#135641] text-white text-xs h-7 px-3 gap-1 cursor-pointer"
                  >
                    <span>Tiếp tục</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* STEP 3: SOẠN CHI TIẾT                                             */}
          {/* ================================================================= */}
          {activeStep === 'EDITOR' && (
            <div className="space-y-4">
              {/* Title input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Tên giáo án:
                </label>
                <input
                  type="text"
                  value={planTitle}
                  onChange={(e) => setPlanTitle(e.target.value)}
                  placeholder="VD: Yoga Hatha - Mở hông"
                  className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 focus:border-[#17664e] focus:outline-none"
                />
              </div>

              {/* Exercise Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Bài tập ({selectedExercises.length})</span>
                  <button
                    type="button"
                    onClick={() => setActiveStep('EXERCISES')}
                    className="text-[#17664e] hover:underline cursor-pointer"
                  >
                    + Thêm bài
                  </button>
                </div>

                {selectedExercises.length === 0 ? (
                  <div className="py-6 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    Chưa có bài tập nào. Bấm "+ Thêm bài" để chọn bài tập.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedExercises.map((ex, idx) => (
                      <div
                        key={ex.id}
                        className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {ex.title}
                          </span>
                        </div>

                        <div className="flex items-end gap-2 shrink-0">
                          <NumberStepper
                            label="Hiệp"
                            min={1}
                            max={20}
                            step={1}
                            size="sm"
                            value={ex.sets}
                            onChange={(val) => handleUpdateExerciseField(ex.id, 'sets', val)}
                          />

                          <NumberStepper
                            label="Reps"
                            unit="lần"
                            min={1}
                            max={500}
                            step={1}
                            size="sm"
                            value={ex.reps}
                            onChange={(val) => handleUpdateExerciseField(ex.id, 'reps', val)}
                          />

                          <NumberStepper
                            label="Nghỉ"
                            unit="s"
                            min={0}
                            max={300}
                            step={15}
                            size="sm"
                            value={ex.restSeconds}
                            onChange={(val) => handleUpdateExerciseField(ex.id, 'restSeconds', val)}
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveExercise(ex.id)}
                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer flex items-center justify-center transition-colors shrink-0"
                            title="Xóa bài tập"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline custom exercise add */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="Thêm bài tập ngoài..."
                    value={customExerciseName}
                    onChange={(e) => setCustomExerciseName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomExercise();
                      }
                    }}
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:border-[#17664e] focus:outline-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddCustomExercise}
                    disabled={!customExerciseName.trim()}
                    className="text-xs h-7 px-2.5 cursor-pointer shrink-0"
                  >
                    + Thêm
                  </Button>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Ghi chú:
                </label>
                <textarea
                  rows={2}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Dặn dò học viên, bài khởi động..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:border-[#17664e] focus:outline-none"
                />
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {selectedTopic ? (
              <span>{selectedTopic.name} • {selectedExercises.length} bài</span>
            ) : (
              <span>Chưa chọn chuyên đề</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs h-8 cursor-pointer"
            >
              Hủy
            </Button>

            <Button
              size="sm"
              onClick={handleSave}
              className="bg-[#17664e] hover:bg-[#135641] text-white font-semibold text-xs h-8 px-3.5 gap-1.5 shadow-2xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lưu giáo án</span>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
