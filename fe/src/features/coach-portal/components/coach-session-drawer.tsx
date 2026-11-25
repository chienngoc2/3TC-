import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  X,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Phone,
  FileText,
  UserCheck,
  CalendarClock,
  Dumbbell,
  RotateCcw,
  Target,
  BookOpen,
  Plus,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/context/notification-context';
import { coachPortalApi } from '../api/coach-portal-api';
import type { CoachScheduleSession } from '../types/coach-schedule.types';
import type { StudentBookingItem } from '../types/coach-portal.types';
import { MemberGoalModal, type MemberGoalModalData } from './member-goal-modal';
import { SlotWorkoutPlanModal } from './slot-workout-plan-modal';
import { WorkoutPlanDetailModal } from '@/components/common/workout-plan-detail-modal';

interface CoachSessionDrawerProps {
  session: CoachScheduleSession | null;
  isOpen: boolean;
  onClose: () => void;
  onCheckInStudent: (booking: StudentBookingItem, sessionStartTime: string, sessionEndTime?: string) => void;
  onOpenWorkoutPlan?: (booking: StudentBookingItem, sessionTitle: string) => void;
  onEmergencyCancel: (data: {
    scheduleId?: string;
    bookingId?: string;
    sessionTitle: string;
    sessionTime: string;
  }) => void;
  onSaveNotes?: (sessionId: string, notes: string) => void;
}

export const CoachSessionDrawer: React.FC<CoachSessionDrawerProps> = ({
  session,
  isOpen,
  onClose,
  onCheckInStudent,
  onOpenWorkoutPlan,
  onEmergencyCancel,
  onSaveNotes,
}) => {
  const { showToast } = useNotification();
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesContent, setNotesContent] = useState('');
  const [selectedMemberForGoal, setSelectedMemberForGoal] = useState<MemberGoalModalData | null>(null);
  const [isSlotWorkoutModalOpen, setIsSlotWorkoutModalOpen] = useState(false);
  const [isViewingDetailModal, setIsViewingDetailModal] = useState(false);

  // Check if there is an active pending cancellation request for this session
  const { data: cancellationRequests = [] } = useQuery({
    queryKey: ['coach', 'cancellation-requests'],
    queryFn: () => coachPortalApi.getMyCancellationRequests(),
    enabled: isOpen && Boolean(session),
  });

  // Query coach's own profile to reliably detect specialty & discipline
  const { data: myProfileData } = useQuery({
    queryKey: ['coach', 'profile'],
    queryFn: coachPortalApi.getMyProfile,
    staleTime: 60000,
  });

  // Synchronize notes when session opens
  React.useEffect(() => {
    if (session) {
      setNotesContent(session.notes || '');
      setIsEditingNotes(false);
    }
  }, [session]);

  // Parse structured workout plan from session notes (placed before conditional return)
  const parsedPlan = useMemo(() => {
    const rawNote = notesContent || session?.notes || '';
    if (!rawNote) return null;
    const normalized = rawNote.replace(/\r\n/g, '\n');
    const titleMatch = normalized.match(/\[GIÁO ÁN\]:\s*(.+)/);
    const topicMatch = normalized.match(/\[CHUYÊN ĐỀ\]:\s*(.+)/);
    const descMatch = normalized.match(/• Nội dung:\s*(.+)/);
    const exerciseLines = normalized.match(
      /\d+\.\s*([^:\n\r]+):\s*(\d+)\s*hiệp\s*x\s*(\d+)\s*lần(?:\s*\(Nghỉ\s*(\d+)s\))?/g,
    );
    const exercises: Array<{ title: string; sets: number; reps: number; restSeconds: number }> = [];
    if (exerciseLines) {
      exerciseLines.forEach((line) => {
        const m = line.match(/\d+\.\s*([^:\n\r]+):\s*(\d+)\s*hiệp\s*x\s*(\d+)\s*lần(?:\s*\(Nghỉ\s*(\d+)s\))?/);
        if (m) {
          exercises.push({
            title: m[1].trim(),
            sets: Number(m[2]),
            reps: Number(m[3]),
            restSeconds: m[4] ? Number(m[4]) : 30,
          });
        }
      });
    }

    const notesMatch = normalized.match(/--- GHI CHÚ ---\n([\s\S]+)$/);
    let extraNotes = notesMatch ? notesMatch[1].trim() : '';
    if (topicMatch && extraNotes.includes(`[CHUYÊN ĐỀ]: ${topicMatch[1].trim()}`)) {
      extraNotes = extraNotes.replace(/\[CHUYÊN ĐỀ\]:[\s\S]*?(?=\n\n|$)/, '').trim();
    }

    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      topic: topicMatch ? topicMatch[1].trim() : '',
      topicDesc: descMatch ? descMatch[1].trim() : '',
      exercises,
      extraNotes,
    };
  }, [notesContent, session?.notes]);

  const loggedInCoachSpecs = (() => {
    try {
      const stored = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        return (parsed?.coachProfile?.coachSpecialties || []).map((cs: any) => ({
          specName: cs.specialty?.name || '',
          discName: cs.specialty?.discipline?.name || '',
          discCode: cs.specialty?.discipline?.code || '',
        }));
      }
    } catch {}
    return [];
  })();

  const coachSpecs = useMemo(() => {
    const cp = myProfileData?.coachProfile;
    if (cp?.coachSpecialties && Array.isArray(cp.coachSpecialties)) {
      return cp.coachSpecialties.map((cs: any) => ({
        specName: cs.specialty?.name || '',
        discName: cs.specialty?.discipline?.name || '',
        discCode: cs.specialty?.discipline?.code || '',
      }));
    }
    return loggedInCoachSpecs;
  }, [myProfileData, loggedInCoachSpecs]);

  if (!isOpen || !session) return null;

  const isCompleted = session.status === 'COMPLETED';
  const isPt = session.type === 'PT';
  const isEmptySlot = session.type === 'EMPTY_SLOT' || session.isSlotEmpty;

  const hasBookedStudents = Boolean(
    !isEmptySlot &&
    ((session as any).isBooked || (session.bookings && session.bookings.length > 0) || (session.enrolledCount && session.enrolledCount > 0))
  );

  const isCurrentCoachYoga = coachSpecs.some((s: any) =>
    s.specName.toLowerCase().includes('yoga') || s.discName.toLowerCase().includes('yoga') || s.discCode.toLowerCase().includes('yoga')
  );
  const isCurrentCoachBoxing = coachSpecs.some((s: any) =>
    s.specName.toLowerCase().includes('box') || s.discName.toLowerCase().includes('box') || s.discCode.toLowerCase().includes('box')
  );

  const isYogaOrBoxing = Boolean(
    isCurrentCoachYoga ||
    isCurrentCoachBoxing ||
    (session as any).packageCategory === 'GROUP' ||
    session.type === 'GROUP_CLASS' ||
    session.disciplineName?.toLowerCase().includes('yoga') ||
    session.disciplineName?.toLowerCase().includes('boxing') ||
    session.disciplineName?.toLowerCase().includes('combat') ||
    session.title?.toLowerCase().includes('yoga') ||
    session.title?.toLowerCase().includes('boxing') ||
    (session as any).specialtyName?.toLowerCase().includes('yoga') ||
    (session as any).specialtyName?.toLowerCase().includes('box')
  );

  const isGymOneOnOne = !isYogaOrBoxing && Boolean(
    (session as any).packageCategory === 'ONE_ON_ONE' ||
    session.disciplineName?.toLowerCase().includes('gym') ||
    session.title?.toLowerCase().includes('gym') ||
    (session.title?.toLowerCase().includes('1-1') && !isYogaOrBoxing) ||
    (isPt && !isYogaOrBoxing)
  );

  const formatTimeRange = (startIso: string, endIso: string) => {
    try {
      const s = new Date(startIso);
      const e = new Date(endIso);
      const sStr = s.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const eStr = e.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const durationMin = Math.round((e.getTime() - s.getTime()) / 60000);
      return {
        label: `${sStr} – ${eStr}`,
        duration: `${durationMin} phút`,
        dateStr: s.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
      };
    } catch {
      return { label: '', duration: '', dateStr: '' };
    }
  };

  const timeInfo = formatTimeRange(session.startTime, session.endTime);

  const primaryTitle = isEmptySlot
    ? (parsedPlan?.title
        ? parsedPlan.title.split('•')[0].trim()
        : (session.title && session.title !== 'Slot trống' && !session.title.includes('1-1 (PT)') && !session.title.includes('Huấn Luyện')
            ? session.title
            : isYogaOrBoxing
            ? (session.disciplineName ? `Lớp tập ${session.disciplineName}` : isCurrentCoachYoga ? 'Lớp tập Yoga' : isCurrentCoachBoxing ? 'Lớp tập Boxing' : 'Lớp tập nhóm')
            : (session.title || 'Slot trống (Chưa có lịch đặt)')))
    : isPt && isGymOneOnOne
      ? (session.studentName ? `${session.studentName}${session.title && !session.title.includes('Huấn Luyện') ? ` • ${session.title}` : ''}` : (session.title || 'Huấn luyện PT'))
      : session.title || 'Lớp tập nhóm';

  // Find primary booking for PT (prefer active CONFIRMED/PENDING booking)
  const primaryBooking =
    session.bookings?.find((b) => b.status === 'CONFIRMED' || b.status === 'PENDING') ||
    session.bookings?.[0];

  const sessionPendingRequest = cancellationRequests.find((r) => {
    if (r.status !== 'PENDING') return false;
    if (session.scheduleId && r.scheduleId === session.scheduleId) return true;
    if (primaryBooking?.id && r.bookingId === primaryBooking.id) return true;
    return false;
  });

  const handleSaveNotes = () => {
    if (onSaveNotes) {
      onSaveNotes(session.id, notesContent);
    }
    setIsEditingNotes(false);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div className="relative z-10 w-full sm:max-w-md h-full bg-white text-slate-900 shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-250 border-l border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2">
            {isPt && isGymOneOnOne ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-200">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                Huấn luyện PT 1:1
              </span>
            ) : isEmptySlot ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-dashed border-slate-300">
                Slot trống {isYogaOrBoxing ? `(${session.disciplineName || 'Gói nhóm'})` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                {isYogaOrBoxing ? (session.disciplineName || 'Lớp tập nhóm') : 'Lớp tập nhóm'}
              </span>
            )}

            {sessionPendingRequest ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-700" />
                Đang xin nghỉ (Chờ duyệt)
              </span>
            ) : isCompleted ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Đã hoàn thành
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                Sắp diễn ra
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Đóng bảng chi tiết"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Main Title & Student / Class Hero */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {primaryTitle}
            </h2>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 capitalize">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {timeInfo.dateStr}
            </p>
          </div>

          {/* Ô BÁO: Hiện bạn đang xin nghỉ ca này (Nếu có pending request) */}
          {sessionPendingRequest && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-3.5 text-xs text-amber-900 space-y-1.5 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-amber-950">
                  <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Hiện bạn đang xin nghỉ ca này</span>
                </div>
                <span className="text-[10px] font-bold bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md">
                  Chờ duyệt
                </span>
              </div>
              <p className="text-[11px] text-amber-800 italic leading-relaxed">
                "{sessionPendingRequest.reasonMessage}"
              </p>
            </div>
          )}

          {/* Time & Room Details Card */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-100/80 text-teal-700 flex items-center justify-center font-bold">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 tabular-nums">
                    {timeInfo.label}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Thời lượng {timeInfo.duration}
                  </div>
                </div>
              </div>
            </div>

            {session.roomName && (
              <div className="flex items-center gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{session.roomName}</span>
              </div>
            )}
          </div>

          {/* Student Info (for PT) or Roster (for Group Class) - CHỈ HIỂN THỊ KHI CÓ HỌC VIÊN */}
          {!hasBookedStudents ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5 text-xs text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium text-slate-600">
                <Users className="w-4 h-4 text-slate-400" />
                Slot trống (Chưa có học viên đăng ký)
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Mở nhận học viên
              </span>
            </div>
          ) : isPt ? (
            <div className="rounded-xl border border-slate-200/90 p-4 space-y-3 bg-white">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>Thông tin học viên</span>
                <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                  Học viên 1-1
                </span>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base">
                  {session.studentName ? session.studentName.charAt(0).toUpperCase() : 'HV'}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      const student = primaryBooking?.member || {
                        fullName: session.studentName || 'Học viên PT',
                        phone: session.studentPhone,
                        memberProfile: primaryBooking?.member?.memberProfile,
                      };
                      setSelectedMemberForGoal(student as MemberGoalModalData);
                    }}
                    className="text-sm font-bold text-slate-900 hover:text-teal-600 hover:underline flex items-center gap-1.5 text-left group cursor-pointer"
                    title="Bấm để xem mục tiêu & hồ sơ học viên"
                  >
                    <span>{session.studentName}</span>
                    <Target className="w-3.5 h-3.5 text-teal-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </button>
                  {session.studentPhone && (
                    <a
                      href={`tel:${session.studentPhone}`}
                      className="text-xs text-teal-600 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Phone className="w-3 h-3" />
                      {session.studentPhone}
                    </a>
                  )}
                </div>
              </div>

              {primaryBooking?.member?.memberProfile?.fitnessGoals && (
                <button
                  type="button"
                  onClick={() => {
                    const student = primaryBooking?.member || {
                      fullName: session.studentName || 'Học viên PT',
                      phone: session.studentPhone,
                      memberProfile: primaryBooking?.member?.memberProfile,
                    };
                    setSelectedMemberForGoal(student as MemberGoalModalData);
                  }}
                  className="w-full text-left pt-2 text-xs text-slate-600 bg-slate-50 hover:bg-teal-50/60 transition-colors rounded-lg p-2.5 cursor-pointer block border border-transparent hover:border-teal-200"
                >
                  <span className="font-semibold text-slate-700">
                    Mục tiêu tập luyện:{' '}
                  </span>
                  {primaryBooking.member.memberProfile.fitnessGoals}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/90 p-4 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  Danh sách học viên ({session.enrolledCount || 0}/{session.capacity || 5})
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((session.enrolledCount || 0) / (session.capacity || 5)) * 100)
                    )}%`,
                  }}
                />
              </div>

              {/* Student list */}
              <div className="space-y-2 pt-1 max-h-48 overflow-y-auto pr-1">
                {(session.bookings || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có danh sách chi tiết.</p>
                ) : (
                  (session.bookings || []).map((b, idx) => (
                    <div
                      key={b.id || idx}
                      className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              if (b.member) {
                                setSelectedMemberForGoal(b.member as MemberGoalModalData);
                              } else {
                                setSelectedMemberForGoal({
                                  fullName: `Học viên ${idx + 1}`,
                                });
                              }
                            }}
                            className="font-semibold text-slate-800 hover:text-teal-600 hover:underline flex items-center gap-1 text-left cursor-pointer group"
                            title="Bấm để xem mục tiêu & hồ sơ học viên"
                          >
                            <span>{b.member?.fullName || `Học viên ${idx + 1}`}</span>
                            <Target className="w-3 h-3 text-teal-600 opacity-60 group-hover:opacity-100 transition-opacity" />
                          </button>
                          {b.member?.phone && (
                            <div className="text-[11px] text-slate-400">{b.member.phone}</div>
                          )}
                        </div>
                      </div>

                      {!isCompleted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onCheckInStudent(b, session.startTime, session.endTime)}
                          className="h-7 px-2.5 text-[11px] font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          <UserCheck className="w-3.5 h-3.5 mr-1" />
                          Điểm danh
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* CHỦ ĐỀ BUỔI TẬP (M14.1 / UNSLOP) */}
          {parsedPlan?.topic && (
            <div className="rounded-xl border border-purple-200/80 bg-purple-50/40 p-4 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded border border-purple-200/60">
                  Chuyên đề buổi tập
                </span>
                {(session as any).disciplineName && (
                  <span className="text-[11px] font-semibold text-purple-900">
                    {(session as any).disciplineName}
                  </span>
                )}
              </div>
              <div className="text-sm font-bold text-slate-900 pt-1 leading-snug">
                {parsedPlan.topic}
              </div>
              {parsedPlan.topicDesc && (
                <p className="text-xs text-slate-600 leading-relaxed pt-0.5">
                  {parsedPlan.topicDesc}
                </p>
              )}
            </div>
          )}

          {/* NỘI DUNG BÀI TẬP & CHI TIẾT GIÁO ÁN */}
          {isEmptySlot ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#17664e]" />
                  <span>
                    {isGymOneOnOne
                      ? 'Giáo trình ca PT 1-1 (Có thể gắn trước)'
                      : 'Giáo trình lớp nhóm (Có thể gắn trước)'}
                  </span>
                </span>
                <Button
                  size="sm"
                  onClick={() => setIsSlotWorkoutModalOpen(true)}
                  className="text-xs font-semibold bg-[#17664e] hover:bg-[#135641] text-white h-7 px-2.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1" />
                  <span>{session.notes ? 'Đổi giáo trình' : 'Áp dụng giáo trình'}</span>
                </Button>
              </div>
              {parsedPlan && (parsedPlan.title || parsedPlan.exercises.length > 0) ? (
                <div className="space-y-1.5">
                  <div className="text-xs text-emerald-950 font-medium">
                    <span className="font-semibold">{parsedPlan.title || 'Giáo trình đã gắn'}</span> ({parsedPlan.exercises.length} động tác)
                  </div>
                  {parsedPlan.exercises.length > 0 && (
                    <p className="text-[11px] text-emerald-800 line-clamp-2">
                      {parsedPlan.exercises.map((e) => e.title).join(', ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-700 leading-relaxed">
                  Bạn có thể áp dụng ngay giáo trình tạo sẵn cho ca này. Khi học viên đăng ký, giáo trình sẽ tự động đồng bộ vào buổi tập.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-emerald-600" />
                  <span>Nội dung bài tập ({parsedPlan?.exercises.length || 0} động tác)</span>
                </span>
                <div className="flex items-center gap-2">
                  {parsedPlan && parsedPlan.exercises.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsViewingDetailModal(true)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                    >
                      Xem chi tiết →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsSlotWorkoutModalOpen(true)}
                    className="text-xs font-bold text-[#17664e] hover:text-[#135641] hover:underline flex items-center gap-1 cursor-pointer ml-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{parsedPlan && parsedPlan.exercises.length > 0 ? 'Sửa' : 'Soạn'}</span>
                  </button>
                </div>
              </div>

              {parsedPlan && parsedPlan.exercises.length > 0 ? (
                <div className="space-y-2">
                  {parsedPlan.exercises.map((ex, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">{ex.title}</span>
                      </div>
                      <span className="text-[11px] text-slate-600 font-medium shrink-0 ml-2 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {ex.sets} hiệp × {ex.reps} lần {ex.restSeconds ? `• Nghỉ ${ex.restSeconds}s` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3 text-center space-y-2">
                  <p className="text-xs text-slate-400 italic">
                    Chưa có giáo án bài tập cho ca này.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSlotWorkoutModalOpen(true)}
                    className="text-xs font-bold border-emerald-300 text-emerald-800 bg-white hover:bg-emerald-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    <span>+ Soạn giáo án ngay</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* GHI CHÚ BUỔI TẬP (Chỉ hiện khi có ghi chú thêm hoặc đang soạn) */}
          {(parsedPlan?.extraNotes || isEditingNotes || !parsedPlan) && (
            <div className="rounded-xl border border-slate-200/90 p-4 space-y-2 bg-white">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Ghi chú dặn dò
                </div>

                {!isCompleted && !isEditingNotes && (
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="text-xs font-semibold text-teal-600 hover:underline cursor-pointer"
                  >
                    {parsedPlan?.extraNotes ? 'Chỉnh sửa' : '+ Thêm ghi chú'}
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-2 pt-1">
                  <textarea
                    value={notesContent}
                    onChange={(e) => setNotesContent(e.target.value)}
                    placeholder="Nhập ghi chú thể lực, dặn dò học viên..."
                    className="w-full text-xs p-3 rounded-lg border border-slate-200 bg-white focus:outline-hidden focus:ring-2 focus:ring-teal-500 min-h-[90px]"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingNotes(false)}
                      className="text-xs h-7 px-3 cursor-pointer"
                    >
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveNotes}
                      className="text-xs h-7 px-3 bg-[#17664e] hover:bg-[#135641] text-white cursor-pointer"
                    >
                      Lưu ghi chú
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-600 leading-relaxed italic bg-slate-50 p-2.5 rounded-lg">
                  {parsedPlan?.extraNotes || 'Chưa có ghi chú bổ sung nào cho buổi tập này.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/80 flex flex-col gap-2">
          {isCompleted ? (
            /* Ca đã hoàn thành chỉ xem ghi chú */
            <div className="flex items-center justify-between text-xs text-slate-500 py-1">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Ca dạy đã kết thúc & lưu hồ sơ
              </span>
              <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                Đóng
              </Button>
            </div>
          ) : isEmptySlot ? (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                className="w-full text-xs font-semibold px-4 h-9 cursor-pointer"
              >
                Đóng
              </Button>
            </div>
          ) : (
            /* Ca sắp diễn ra / chưa hoàn thành: Điểm danh / Đổi lịch / Ghi chú / Hủy */
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* Điểm danh */}
                {isPt && primaryBooking && (
                  <Button
                    onClick={() => {
                      onCheckInStudent(primaryBooking, session.startTime, session.endTime);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                    Điểm danh
                  </Button>
                )}

                {/* Giáo án PT (M14.1) */}
                {isPt && primaryBooking && onOpenWorkoutPlan && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      onOpenWorkoutPlan(primaryBooking, primaryTitle);
                    }}
                    className="text-xs font-bold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 shadow-2xs"
                  >
                    <Dumbbell className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                    Giáo án PT
                  </Button>
                )}

                {/* Giáo án ca học cho Lớp nhóm (được phép soạn ngay cả khi slot trống) hoặc ca 1-1 đã có học viên */}
                {(!isGymOneOnOne || hasBookedStudents) && (!isPt || !primaryBooking || !onOpenWorkoutPlan) && (
                  <Button
                    variant="outline"
                    onClick={() => setIsSlotWorkoutModalOpen(true)}
                    className="text-xs font-bold border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 shadow-2xs cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                    <span>{session.notes ? 'Sửa giáo án' : 'Thêm giáo án'}</span>
                  </Button>
                )}

                {/* Đổi lịch (hoặc hiển thị nếu không có primaryBooking) */}
                {(!isPt || !primaryBooking || !onOpenWorkoutPlan) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      alert('Chức năng đổi lịch sẽ gửi yêu cầu xác nhận tới học viên.');
                    }}
                    className="text-xs font-semibold border-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                    Đổi lịch
                  </Button>
                )}
              </div>

              {/* Hủy ca khẩn cấp hoặc Xem/Hủy yêu cầu xin nghỉ */}
              {sessionPendingRequest ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const hasScheduleId = Boolean(session.scheduleId);
                    onEmergencyCancel({
                      scheduleId: hasScheduleId ? session.scheduleId : undefined,
                      bookingId: !hasScheduleId ? primaryBooking?.id : undefined,
                      sessionTitle: primaryTitle,
                      sessionTime: timeInfo.label,
                    });
                  }}
                  className="w-full text-xs border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold gap-1.5 shadow-xs cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                  <span>Đang xin nghỉ • Xem trạng thái đơn</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const hasScheduleId = Boolean(session.scheduleId);
                    if (!hasScheduleId && !primaryBooking?.id) {
                      showToast(
                        'warning',
                        'Chưa có học viên đặt lịch',
                        'Ca dạy này chưa có học viên đặt chỗ nên bạn có thể xóa trực tiếp khung giờ rảnh thay vì gửi đơn báo bận đột xuất.',
                      );
                      return;
                    }
                    onEmergencyCancel({
                      scheduleId: hasScheduleId ? session.scheduleId : undefined,
                      bookingId: !hasScheduleId ? primaryBooking?.id : undefined,
                      sessionTitle: primaryTitle,
                      sessionTime: timeInfo.label,
                    });
                  }}
                  className="w-full text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                  Hủy ca dạy (Báo bận đột xuất)
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal xem mục tiêu và hồ sơ học viên */}
      <MemberGoalModal
        member={selectedMemberForGoal}
        isOpen={Boolean(selectedMemberForGoal)}
        onClose={() => setSelectedMemberForGoal(null)}
      />

      {/* Modal soạn giáo án cho ca học */}
      {isSlotWorkoutModalOpen && session && (
        <SlotWorkoutPlanModal
          session={session}
          isOpen={isSlotWorkoutModalOpen}
          onClose={() => setIsSlotWorkoutModalOpen(false)}
          onSavePlan={(formattedPlan) => {
            setNotesContent(formattedPlan);
            if (session) {
              session.notes = formattedPlan;
            }
            if (onSaveNotes) {
              onSaveNotes(session.id, formattedPlan);
            }
          }}
        />
      )}

      {/* Modal xem chi tiết giáo án (Đồng bộ với bên Member) */}
      {parsedPlan && (
        <WorkoutPlanDetailModal
          isOpen={isViewingDetailModal}
          onClose={() => setIsViewingDetailModal(false)}
          title={parsedPlan.title || 'Giáo án buổi tập'}
          coachName="Huấn luyện viên"
          notes={parsedPlan.extraNotes || parsedPlan.topicDesc}
          exercises={parsedPlan.exercises.map((e, idx) => ({
            id: String(idx),
            title: e.title,
            sets: e.sets,
            reps: e.reps,
            restSeconds: e.restSeconds,
            exercise: { title: e.title },
          }))}
        />
      )}
    </div>,
    document.body
  );
};
