import React, { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  CalendarRange,
  ArrowLeft,
  AlertTriangle,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/context/notification-context';
import { coachPortalApi } from '../api/coach-portal-api';
import { AttendanceModal } from '../components/attendance-modal';
import { SessionWorkoutPlanModal } from '../components/session-workout-plan-modal';
import { EmergencyCancelModal } from '../components/emergency-cancel-modal';
import { ScheduleDatePickerModal } from '../components/schedule-date-picker-modal';
import { CreateSlotModal } from '../components/create-slot-modal';
import { CoachCalendarGrid } from '../components/coach-calendar-grid';
import { CoachAgendaView } from '../components/coach-agenda-view';
import { CoachSessionDrawer } from '../components/coach-session-drawer';
import {
  getMondayOfWeek,
  shiftWeek,
  formatRangeLabel,
  parseYMDToDate,
} from '@/features/calendar/utils/calendar-date.utils';
import { useAuth } from '@/context/auth-context';
import { useSyncListener } from '@/lib/sync-channel';
import { useQueryClient } from '@tanstack/react-query';
import type { StudentBookingItem } from '../types/coach-portal.types';
import type {
  CoachScheduleSession,
  ScheduleFilterType,
} from '../types/coach-schedule.types';

type ViewMode = 'WEEK_GRID' | 'AGENDA';

export const CoachSchedulePage: React.FC = () => {
  const { user } = useAuth();
  const { notifications, markAsRead } = useNotification();
  const location = useLocation();
  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';

  // Dynamic current week (Monday)
  const [currentWeek, setCurrentWeek] = useState<string>(() => getMondayOfWeek());
  const [viewMode, setViewMode] = useState<ViewMode>('WEEK_GRID');
  const [filterType, setFilterType] = useState<ScheduleFilterType>('ALL');

  // Selected session for slide-out drawer
  const [selectedSession, setSelectedSession] = useState<CoachScheduleSession | null>(null);

  // Modals state
  const [isCreateSlotOpen, setIsCreateSlotOpen] = useState<boolean>(false);
  const [createSlotDate, setCreateSlotDate] = useState<string | undefined>(undefined);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

  // Attendance check-in modal
  const [selectedBookingData, setSelectedBookingData] = useState<{
    booking: StudentBookingItem;
    sessionStartTime: string;
    sessionEndTime: string;
  } | null>(null);

  // Selected booking for workout plan modal (M14.1)
  const [selectedWorkoutBookingData, setSelectedWorkoutBookingData] = useState<{
    booking: StudentBookingItem;
    sessionTitle: string;
  } | null>(null);

  // Emergency cancellation modal
  const [cancelModalData, setCancelModalData] = useState<{
    scheduleId?: string;
    bookingId?: string;
    sessionTitle: string;
    sessionTime: string;
  } | null>(null);

  const queryClient = useQueryClient();

  // Instant cross-tab and SSE synchronization
  useSyncListener(() => {
    void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
    void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
    void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
  }, queryClient);

  // Check available pickup schedules (ca trống / ca dạy thay cùng bộ môn & hạng sao)
  const { data: pickupList = [] } = useQuery({
    queryKey: ['coach', 'pickup-schedules'],
    queryFn: () => coachPortalApi.getPickupSchedules(),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const { data: directInvitations = [] } = useQuery({
    queryKey: ['coach', 'substitution-requests'],
    queryFn: () => coachPortalApi.getSubstitutionRequests(),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const { data: myProfile } = useQuery({
    queryKey: ['coach', 'profile-detail'],
    queryFn: () => coachPortalApi.getMyProfile(),
    staleTime: 60_000,
  });

  const baselineScheduleText = useMemo(() => {
    const cp = myProfile?.coachProfile;
    if (!cp) return null;
    const dayMap: Record<string, string> = {
      MONDAY: 'T2',
      TUESDAY: 'T3',
      WEDNESDAY: 'T4',
      THURSDAY: 'T5',
      FRIDAY: 'T6',
      SATURDAY: 'T7',
      SUNDAY: 'CN',
    };
    const workingDaysArr = Array.isArray(cp.workingDays) ? cp.workingDays : [];
    const days = workingDaysArr.map((d: string) => dayMap[d] || d).join(', ');
    const filteredWh = Array.isArray(cp.workingHours)
      ? cp.workingHours.filter((wh: any) =>
          typeof wh === 'string' || !wh?.day || workingDaysArr.length === 0
            ? true
            : workingDaysArr.includes(wh.day),
        )
      : [];
    const hours = filteredWh
      .map((wh: any) =>
        typeof wh === 'string'
          ? wh
          : `${wh?.day ? `${dayMap[wh.day] || wh.day}: ` : ''}${wh?.start || wh?.from || '08:00'}–${wh?.end || wh?.to || '12:00'}`
      )
      .join(' • ');
    if (!days && !hours) return null;
    return [days, hours].filter(Boolean).join(' | ');
  }, [myProfile]);

  // Real backend queries
  const { data: apiSessions = [] } = useQuery({
    queryKey: ['coach', 'multi-day-schedule', user?.id],
    queryFn: () => coachPortalApi.getMultiDaySchedule(user?.id),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  // Local notes map for user note additions with persistent storage
  const [notesMap, setNotesMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('coach_session_notes_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Map real API sessions to CoachScheduleSession
  const sessionList: CoachScheduleSession[] = useMemo(() => {
    return apiSessions
      .filter((apiS) => {
        const isAvailabilitySlot = Boolean(apiS.coachAvailabilityId) && !apiS.scheduleId;
        const hasBookings = Boolean(apiS.bookings && apiS.bookings.length > 0);
        const isSlotEmpty = isAvailabilitySlot && !apiS.isBooked && !hasBookings && !apiS.isEmergencyCancelled;
        const isTimeArrived = new Date() >= new Date(apiS.startTime);
        // Khi slot trống không có học viên mà đã đến giờ diễn ra (hoặc quá giờ) thì ẩn đi
        if (isSlotEmpty && isTimeArrived) {
          return false;
        }
        return true;
      })
      .map((apiS) => {
        const isPt = apiS.type === 'PERSONAL_TRAINING';
        const isAvailabilitySlot = Boolean(apiS.coachAvailabilityId) && !apiS.scheduleId;
        const firstStudent = apiS.bookings?.[0]?.member;
        const studentFullName = firstStudent?.fullName || (apiS.bookings?.[0] as any)?.member_name;
        const isEnded = new Date() > new Date(apiS.endTime);
        const hasBookings = Boolean(apiS.bookings && apiS.bookings.length > 0);
        const isSlotEmpty = isAvailabilitySlot && !apiS.isBooked && !hasBookings && !apiS.isEmergencyCancelled;
        // Tuyệt đối không đánh dấu slot trống là LIVE ("Đang dạy")
        const isLive = !apiS.isEmergencyCancelled && !isSlotEmpty && new Date() >= new Date(apiS.startTime) && new Date() <= new Date(apiS.endTime);

        return {
          id: apiS.id,
          type: isSlotEmpty ? 'EMPTY_SLOT' : isPt ? 'PT' : 'GROUP_CLASS',
          status: apiS.isEmergencyCancelled
            ? 'CANCELLED'
            : isLive
              ? 'LIVE'
              : isEnded
                ? 'COMPLETED'
                : 'UPCOMING',
          title: apiS.title,
          studentName: studentFullName || (isPt && (apiS.isBooked || hasBookings) ? 'Học viên PT' : undefined),
          studentPhone: firstStudent?.phone,
          studentAvatar: firstStudent?.avatarUrl,
          roomName: apiS.roomName || undefined,
          startTime: apiS.startTime,
          endTime: apiS.endTime,
          capacity: apiS.capacity,
          enrolledCount: apiS.currentEnrolled,
          checkedInCount:
            apiS.bookings?.filter(
              (b) =>
                b.status === 'ATTENDED' ||
                b.attendance?.status === 'PRESENT' ||
                b.attendance?.status === 'ATTENDED' ||
                b.attendance?.status === 'LATE'
            ).length || 0,
          isSlotEmpty,
          packageCategory: (apiS as any).packageCategory,
          disciplineName: apiS.disciplineName,
          specialtyName: (apiS as any).specialtyName,
          bookings: apiS.bookings,
          scheduleId: apiS.scheduleId || undefined,
          coachAvailabilityId: apiS.coachAvailabilityId || undefined,
          isEmergencyCancelled: apiS.isEmergencyCancelled,
          notes: notesMap[apiS.id] || (apiS as any).notes || '',
        };
      });
  }, [apiSessions, notesMap]);

  // Handle saving notes on session
  const handleSaveNotes = (sessionId: string, newNotes: string) => {
    setNotesMap((prev) => {
      const next = { ...prev, [sessionId]: newNotes };
      try {
        localStorage.setItem('coach_session_notes_map', JSON.stringify(next));
      } catch {}
      return next;
    });
    if (selectedSession && selectedSession.id === sessionId) {
      setSelectedSession((prev) => (prev ? { ...prev, notes: newNotes } : null));
    }
    window.dispatchEvent(
      new CustomEvent('workout-plan-updated', {
        detail: { sessionId, newNotes },
      })
    );
  };

  // Week navigation
  const handleWeekChange = (direction: 'prev' | 'next') => {
    const offset = direction === 'next' ? 1 : -1;
    setCurrentWeek((prev) => shiftWeek(prev, offset));
  };

  const handleGoToCurrentWeek = () => {
    setCurrentWeek(getMondayOfWeek());
  };

  const weekRangeLabel = useMemo(() => {
    return formatRangeLabel(currentWeek);
  }, [currentWeek]);

  // Filter sessions that belong to the selected week (Monday to Sunday)
  const currentWeekSessions = useMemo(() => {
    const startOfWeek = parseYMDToDate(currentWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    return sessionList.filter((s) => {
      const sDate = new Date(s.startTime);
      return sDate >= startOfWeek && sDate < endOfWeek;
    });
  }, [sessionList, currentWeek]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalSessions = currentWeekSessions.length;
    const ptSessions = currentWeekSessions.filter((s) => s.type === 'PT');
    const groupSessions = currentWeekSessions.filter((s) => s.type === 'GROUP_CLASS');

    // Total actual teaching hours
    const totalMinutes = currentWeekSessions.reduce((acc, s) => {
      const start = new Date(s.startTime).getTime();
      const end = new Date(s.endTime).getTime();
      return acc + (end - start) / (1000 * 60);
    }, 0);
    const totalHours = Math.round(totalMinutes / 60);

    // Count distinct PT students
    const ptStudentNames = new Set<string>();
    ptSessions.forEach((s) => {
      if (s.studentName) ptStudentNames.add(s.studentName);
    });

    // Next upcoming session
    const now = new Date();
    const upcomingSessions = currentWeekSessions
      .filter((s) => new Date(s.startTime) > now && s.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    const nextSession = upcomingSessions[0] || null;

    return {
      totalSessions,
      totalPt: ptSessions.length,
      totalGroup: groupSessions.length,
      totalHours,
      ptStudentsCount: ptStudentNames.size,
      nextSession,
    };
  }, [currentWeekSessions]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    sessionList.forEach((s) => {
      const dateKey = s.startTime.split('T')[0];
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(s);
    });
    return map;
  }, [sessionList]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to={`${coachBasePath}/schedule`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17664e] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Lịch HLV
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
            Lịch giảng dạy & Huấn luyện
          </h1>
          <p className="text-xs text-white mt-0.5">
            Quản lý ca trực rảnh, lịch dạy kèm PT 1-1 và các lớp học nhóm trong tuần
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="mint"
            onClick={() => {
              setCreateSlotDate(undefined);
              setIsCreateSlotOpen(true);
            }}
            className="text-xs font-bold gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Thêm slot rảnh</span>
          </Button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#17664e] border border-emerald-200/70">
            Huấn luyện viên
          </span>
        </div>
      </div>

      

      {/* Direct Substitution Invitations Banner */}
      {directInvitations.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-indigo-500/5 border border-indigo-300 rounded-3xl text-xs font-bold text-indigo-950 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span>
              Quản lý vừa chỉ định bạn nhận <strong>{directInvitations.length} lời mời dạy thay</strong>. Vui lòng xác nhận sớm!
            </span>
          </div>
          <Link
            to={`${coachBasePath}/requests?tab=INVITATIONS`}
            className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <span>Phản hồi lời mời</span>
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      )}

      
      {/* Navigation Controls, Filter Chips & View Mode Switcher */}
      <div className="p-3.5 sm:p-4 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Jump to This Week */}
          <button
            type="button"
            onClick={handleGoToCurrentWeek}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
          >
            Tuần này
          </button>

          {/* Week Range Nav: ‹ 19/10 – 25/10/2026 › */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => handleWeekChange('prev')}
              aria-label="Tuần trước"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-black text-slate-900 tabular-nums tracking-tight">
              {weekRangeLabel}
            </span>
            <button
              type="button"
              onClick={() => handleWeekChange('next')}
              aria-label="Tuần kế tiếp"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Open Date Picker Modal */}
          <button
            type="button"
            onClick={() => setIsDatePickerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
            <span>Chọn ngày</span>
          </button>
        </div>

        {/* Category Filter Chips & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Category Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Tất cả ({stats.totalSessions})
            </button>
            <button
              onClick={() => setFilterType('PT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterType === 'PT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-emerald-900 border border-emerald-200 hover:bg-emerald-50/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              PT 1:1 ({stats.totalPt})
            </button>
            <button
              onClick={() => setFilterType('CLASS')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                filterType === 'CLASS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-blue-900 border border-blue-200 hover:bg-blue-50/60'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Lớp nhóm ({stats.totalGroup})
            </button>
          </div>

          {/* View Switcher */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
            <button
              onClick={() => setViewMode('WEEK_GRID')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'WEEK_GRID'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Lưới tuần</span>
            </button>
            <button
              onClick={() => setViewMode('AGENDA')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'AGENDA'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Lịch trình</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. MAIN SCHEDULE VIEW: Grid or Agenda */}
      {viewMode === 'WEEK_GRID' ? (
        <CoachCalendarGrid
          currentWeek={currentWeek}
          sessions={sessionList}
          filterType={filterType}
          onSelectSession={(session) => setSelectedSession(session)}
          onOpenCreateSlot={(dateStr) => {
            setCreateSlotDate(dateStr);
            setIsCreateSlotOpen(true);
          }}
        />
      ) : (
        <CoachAgendaView
          currentWeek={currentWeek}
          sessions={sessionList}
          filterType={filterType}
          onSelectSession={(session) => setSelectedSession(session)}
          onOpenCreateSlot={(dateStr) => {
            setCreateSlotDate(dateStr);
            setIsCreateSlotOpen(true);
          }}
        />
      )}

      {/* 5. SLIDE-OUT SESSION DETAIL DRAWER */}
      <CoachSessionDrawer
        session={selectedSession}
        isOpen={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        onCheckInStudent={(booking, sessionStartTime, sessionEndTime) => {
          setSelectedBookingData({
            booking,
            sessionStartTime,
            sessionEndTime: sessionEndTime || selectedSession?.endTime || '',
          });
        }}
        onOpenWorkoutPlan={(booking, sessionTitle) => {
          setSelectedWorkoutBookingData({
            booking,
            sessionTitle,
          });
        }}
        onEmergencyCancel={(data) => {
          setCancelModalData(data);
        }}
        onSaveNotes={handleSaveNotes}
      />

      {/* 6. CREATE AVAILABILITY SLOT MODAL */}
      <CreateSlotModal
        isOpen={isCreateSlotOpen}
        initialDate={createSlotDate}
        onClose={() => {
          setIsCreateSlotOpen(false);
          setCreateSlotDate(undefined);
        }}
      />

      {/* 7. ATTENDANCE CHECK-IN MODAL */}
      {selectedBookingData && (
        <AttendanceModal
          booking={selectedBookingData.booking}
          sessionStartTime={selectedBookingData.sessionStartTime}
          sessionEndTime={selectedBookingData.sessionEndTime}
          isOpen={Boolean(selectedBookingData)}
          onClose={() => setSelectedBookingData(null)}
        />
      )}

      {/* 8. SESSION WORKOUT PLAN MODAL (M14.1) */}
      {selectedWorkoutBookingData && (
        <SessionWorkoutPlanModal
          booking={selectedWorkoutBookingData.booking}
          sessionTitle={selectedWorkoutBookingData.sessionTitle}
          isOpen={Boolean(selectedWorkoutBookingData)}
          onClose={() => setSelectedWorkoutBookingData(null)}
        />
      )}

      {/* 9. EMERGENCY CANCELLATION MODAL */}
      {cancelModalData && (
        <EmergencyCancelModal
          scheduleId={cancelModalData.scheduleId}
          bookingId={cancelModalData.bookingId}
          sessionTitle={cancelModalData.sessionTitle}
          sessionTime={cancelModalData.sessionTime}
          isOpen={Boolean(cancelModalData)}
          onClose={() => setCancelModalData(null)}
        />
      )}

      {/* 10. DATE PICKER MODAL */}
      <ScheduleDatePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        selectedDate={currentWeek}
        weekOffset={0}
        onSelectDateAndWeek={(dateStr) => {
          setCurrentWeek(getMondayOfWeek(dateStr));
          setIsDatePickerOpen(false);
        }}
        sessionsByDate={sessionsByDate}
      />
    </div>
  );
};
