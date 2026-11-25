import { apiClient } from '@/services/api-client';
import type {
  TodayScheduleData,
  CoachAvailabilitySlot,
  CreateSlotPayload,
  ClassAttendancePayload,
  UpdateAttendancePayload,
  CancellationRequestPayload,
  CancellationRequestItem,
  CoachPenaltyItem,
  AssignedMemberItem,
  InbodyLogPayload,
  InbodyLogItem,
  WorkoutRecommendation,
  ExerciseKnowledgeItem,
  WorkoutPlanItem,
  CreateWorkoutPlanPayload,
  WorkoutTemplateItem,
  BookingWorkoutPlan,
  UpdateSessionWorkoutPlanPayload,
  CoachRateItem,
  EquipmentItem,
  StudentBookingItem,
  UnifiedCoachSession,
  PickupScheduleItem,
  SubstitutionRequestItem,
} from '../types/coach-portal.types';

export const coachPortalApi = {
  // Lịch dạy & điểm danh hôm nay
  getTodaySchedule: async (): Promise<TodayScheduleData> => {
    const res = await apiClient.get<TodayScheduleData>('/coaches/today-schedule');
    const data = res.data;

    // Collect all bookings that need member info
    const bookingsToHydrate: StudentBookingItem[] = [];
    (data.classes || []).forEach((c) => {
      c.bookings = (c.bookings || []).filter((b) => b.status !== 'CANCELLED');
      (c.bookings || []).forEach((b) => {
        if (!b.member?.fullName && b.memberId) bookingsToHydrate.push(b);
      });
    });
    (data.pt || []).forEach((p) => {
      p.bookings = (p.bookings || []).filter((b) => b.status !== 'CANCELLED');
      (p.bookings || []).forEach((b) => {
        if (!b.member?.fullName && b.memberId) bookingsToHydrate.push(b);
      });
    });

    if (bookingsToHydrate.length > 0) {
      const uniqueMemberIds = [...new Set(bookingsToHydrate.map((b) => b.memberId!))];
      const userMap = new Map<string, any>();
      await Promise.all(
        uniqueMemberIds.map(async (mId) => {
          try {
            const uRes = await apiClient.get(`/users/${mId}`);
            userMap.set(mId, uRes.data);
          } catch {
            // Ignore if user cannot be fetched
          }
        })
      );

      bookingsToHydrate.forEach((b) => {
        if (b.memberId && userMap.has(b.memberId)) {
          const u = userMap.get(b.memberId);
          b.member = {
            id: u.id,
            fullName: u.fullName,
            phone: u.phone,
            avatarUrl: u.avatarUrl,
            memberProfile: u.memberProfile,
          };
        }
      });
    }

    return data;
  },

  // Lịch giảng dạy đa ngày / toàn diện (Multi-Day & Week Schedule)
  getMultiDaySchedule: async (coachUserId?: string): Promise<UnifiedCoachSession[]> => {
    const [todayRes, bookingsRes, mySlotsRes, schedulesRes] = await Promise.all([
      apiClient.get<TodayScheduleData>('/coaches/today-schedule').catch(() => ({ data: { classes: [], pt: [] } })),
      apiClient.get<any[]>('/bookings').catch(() => ({ data: [] })),
      apiClient.get<CoachAvailabilitySlot[]>('/coaches/availability/mine').catch(() => ({ data: [] })),
      apiClient.get<any[]>('/schedules').catch(() => ({ data: [] })),
    ]);

    const todayData = todayRes.data || { classes: [], pt: [] };
    const rawBookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
    const mySlots = Array.isArray(mySlotsRes.data) ? mySlotsRes.data : [];
    const allSchedules = Array.isArray(schedulesRes.data) ? schedulesRes.data : [];

    // Populate user map from today's schedule bookings without firing N+1 requests
    const userMap = new Map<string, any>();
    (todayData.classes || []).forEach((c) => {
      (c.bookings || []).forEach((b) => {
        if (b.memberId && b.member?.fullName) userMap.set(b.memberId, b.member);
      });
    });
    (todayData.pt || []).forEach((p) => {
      (p.bookings || []).forEach((b) => {
        if (b.memberId && b.member?.fullName) userMap.set(b.memberId, b.member);
      });
    });

    const formatMember = (mId?: string, fallbackMember?: any) => {
      if (fallbackMember?.fullName) return fallbackMember;
      if (mId && userMap.has(mId)) {
        return userMap.get(mId);
      }
      if (mId) {
        return {
          id: mId,
          fullName: fallbackMember?.fullName || 'Học viên',
          phone: fallbackMember?.phone,
          avatarUrl: fallbackMember?.avatarUrl,
          memberProfile: fallbackMember?.memberProfile,
        };
      }
      return fallbackMember || null;
    };

    const sessionsMap = new Map<string, UnifiedCoachSession>();

    // 1. Process today's classes
    (todayData.classes || []).forEach((c) => {
      const bookings: StudentBookingItem[] = (c.bookings || []).map((b) => ({
        ...b,
        member: formatMember(b.memberId, b.member),
      }));
      sessionsMap.set(`class-${c.id}`, {
        id: c.id,
        type: 'GROUP_CLASS',
        scheduleId: c.id,
        title: c.class?.name || 'Lớp tập nhóm',
        disciplineId: c.disciplineId,
        disciplineName: c.class?.name,
        roomName: c.room?.name || (c.room?.roomNumber ? `Phòng ${c.room.roomNumber}` : undefined),
        startTime: c.startTime,
        endTime: c.endTime,
        status: c.status || 'OPEN',
        currentEnrolled: c.currentEnrolled ?? bookings.length,
        capacity: Math.min(c.room?.capacity || 5, c.class?.capacity || 5, 5),
        bookings,
        isEmergencyCancelled: c.status === 'CANCELLED_BY_COACH' || c.status === 'CANCELLED',
      });
    });

    const resolvedCoachId = coachUserId || (() => {
      try {
        const stored = sessionStorage.getItem('auth_user') || localStorage.getItem('auth_user');
        if (stored) return JSON.parse(stored)?.id;
      } catch {
        return undefined;
      }
      return undefined;
    })();

    // Detect logged-in coach discipline from coachSpecialties stored in session/local storage
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
    const isCurrentCoachYoga = loggedInCoachSpecs.some((s: any) =>
      s.specName.toLowerCase().includes('yoga') || s.discName.toLowerCase().includes('yoga') || s.discCode.toLowerCase().includes('yoga')
    );
    const isCurrentCoachBoxing = loggedInCoachSpecs.some((s: any) =>
      s.specName.toLowerCase().includes('box') || s.discName.toLowerCase().includes('box') || s.discCode.toLowerCase().includes('box')
    );

    // 2. Process all future center schedules STRICTLY assigned to this coach
    if (resolvedCoachId) {
      allSchedules.forEach((s: any) => {
        const isAssignedToMe =
          s.coachId === resolvedCoachId ||
          s.coach?.id === resolvedCoachId ||
          s.coach?.userId === resolvedCoachId ||
          s.coach?.user?.id === resolvedCoachId;

        if (!isAssignedToMe) return;

        if (!sessionsMap.has(`class-${s.id}`)) {
          sessionsMap.set(`class-${s.id}`, {
            id: s.id,
            type: 'GROUP_CLASS',
            scheduleId: s.id,
            title: s.class?.name || 'Lớp tập nhóm',
            disciplineId: s.class?.disciplineId,
            disciplineName: s.class?.discipline?.name || s.class?.name,
            roomName: s.room?.name || (s.room?.roomNumber ? `Phòng ${s.room.roomNumber}` : undefined),
            startTime: s.startTime,
            endTime: s.endTime,
            status: s.status || 'OPEN',
            currentEnrolled: s.currentEnrolled || 0,
            capacity: Math.min(s.room?.capacity || 5, s.capacity || 5, 5),
            bookings: [],
            isEmergencyCancelled: s.status === 'CANCELLED_BY_COACH' || s.status === 'CANCELLED',
          });
        }
      });
    }

    // 3. Process PT slots from mySlots
    const mySlotIds = new Set(mySlots.map((slot) => slot.id));
    mySlots.forEach((slot: any) => {
      const key = `pt-${slot.id}`;
      const slotBookings: StudentBookingItem[] = (slot.bookings || []).map((b: any) => ({
        ...b,
        member: formatMember(b.memberId, b.member),
      }));
      const isBooked = Boolean(slot.isBooked || slotBookings.length > 0);
      const firstBooking = slotBookings[0] as any;
      const disciplineName = slot.disciplineName || firstBooking?.subscription?.discipline?.name || '';
      const isYoga = Boolean(
        isCurrentCoachYoga ||
        disciplineName.toLowerCase().includes('yoga') ||
        slot.specialtyName?.toLowerCase().includes('yoga') ||
        slot.disciplineCode?.toLowerCase().includes('yoga') ||
        (slot.coach_name && slot.coach_name.toLowerCase().includes('chien')) ||
        slot.packageCategory === 'GROUP'
      );
      const isBoxing = Boolean(
        isCurrentCoachBoxing ||
        disciplineName.toLowerCase().includes('box') ||
        slot.specialtyName?.toLowerCase().includes('box') ||
        slot.disciplineCode?.toLowerCase().includes('box')
      );
      const isGroupCategory = isYoga || isBoxing || slot.packageCategory === 'GROUP';

      const defaultSlotTitle = isYoga
        ? (slot.specialtyName ? `Lớp tập ${slot.specialtyName}` : 'Lớp tập Yoga')
        : isBoxing
        ? (slot.specialtyName ? `Lớp tập ${slot.specialtyName}` : 'Lớp tập Boxing')
        : isGroupCategory
        ? 'Lớp tập nhóm'
        : 'Huấn Luyện Cá Nhân 1-1 (PT)';

      const slotTitle = firstBooking?.subscription?.plan?.name || firstBooking?.planName || defaultSlotTitle;

      sessionsMap.set(key, {
        id: slot.id,
        type: isGroupCategory ? 'GROUP_CLASS' : 'PERSONAL_TRAINING',
        packageCategory: isGroupCategory ? 'GROUP' : 'ONE_ON_ONE',
        disciplineName: disciplineName || (isYoga ? 'Yoga & Meditation' : isBoxing ? 'Boxing & Kickboxing' : undefined),
        coachAvailabilityId: slot.id,
        title: slotTitle,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.isEmergencyCancelled ? 'CANCELLED' : isBooked ? 'CONFIRMED' : 'OPEN',
        currentEnrolled: slotBookings.length > 0 ? slotBookings.length : (isBooked ? 1 : 0),
        capacity: isGroupCategory ? (slot.room?.capacity || 5) : 1,
        bookings: slotBookings,
        isEmergencyCancelled: slot.isEmergencyCancelled,
        isBooked,
        notes: slot.notes || null,
        specialtyName: slot.specialtyName || (isYoga ? 'Yoga Trị Liệu & Phục Hồi Cột Sống' : undefined),
      } as any);
    });

    // 4. Merge today's PT items
    (todayData.pt || []).forEach((p: any) => {
      const key = `pt-${p.id}`;
      const bookings: StudentBookingItem[] = (p.bookings || []).map((b: any) => ({
        ...b,
        member: formatMember(b.memberId, b.member),
      }));
      const firstBooking = bookings[0] as any;
      const disciplineName = p.disciplineName || firstBooking?.subscription?.discipline?.name || '';
      const isYoga = Boolean(
        isCurrentCoachYoga ||
        disciplineName.toLowerCase().includes('yoga') ||
        p.specialtyName?.toLowerCase().includes('yoga') ||
        p.disciplineCode?.toLowerCase().includes('yoga') ||
        (p.coach_name && p.coach_name.toLowerCase().includes('chien')) ||
        p.packageCategory === 'GROUP'
      );
      const isBoxing = Boolean(
        isCurrentCoachBoxing ||
        disciplineName.toLowerCase().includes('box') ||
        p.specialtyName?.toLowerCase().includes('box') ||
        p.disciplineCode?.toLowerCase().includes('box')
      );
      const isGroupCategory = isYoga || isBoxing || p.packageCategory === 'GROUP';

      const defaultSlotTitle = isYoga
        ? (p.specialtyName ? `Lớp tập ${p.specialtyName}` : 'Lớp tập Yoga')
        : isBoxing
        ? (p.specialtyName ? `Lớp tập ${p.specialtyName}` : 'Lớp tập Boxing')
        : isGroupCategory
        ? 'Lớp tập nhóm'
        : 'Huấn Luyện Cá Nhân 1-1 (PT)';

      const slotTitle = firstBooking?.subscription?.plan?.name || firstBooking?.planName || defaultSlotTitle;

      sessionsMap.set(key, {
        id: p.id,
        type: isGroupCategory ? 'GROUP_CLASS' : 'PERSONAL_TRAINING',
        packageCategory: isGroupCategory ? 'GROUP' : 'ONE_ON_ONE',
        disciplineName: disciplineName || (isYoga ? 'Yoga & Meditation' : isBoxing ? 'Boxing & Kickboxing' : undefined),
        coachAvailabilityId: p.id,
        title: slotTitle,
        startTime: p.startTime,
        endTime: p.endTime,
        status: p.isEmergencyCancelled ? 'CANCELLED' : p.isBooked ? 'CONFIRMED' : 'OPEN',
        currentEnrolled: bookings.length > 0 ? bookings.length : (p.isBooked ? 1 : 0),
        capacity: isGroupCategory ? (p.room?.capacity || 5) : 1,
        bookings,
        isEmergencyCancelled: p.isEmergencyCancelled,
        isBooked: p.isBooked,
        notes: p.notes || null,
        specialtyName: p.specialtyName || (isYoga ? 'Yoga Trị Liệu & Phục Hồi Cột Sống' : undefined),
      } as any);
    });

    // 5. Merge bookings across all dates STRICTLY for this coach's sessions
    rawBookings.forEach((b: any) => {
      // Skip cancelled bookings as they are released from schedule and cannot be attended
      if (b.status === 'CANCELLED') return;
      const studentBooking: StudentBookingItem = {
        id: b.id,
        bookingType: b.bookingType,
        status: b.status,
        bookedAt: b.bookedAt,
        memberId: b.memberId,
        member: formatMember(b.memberId, b.member),
        attendance: b.attendance,
      };

      if (b.coachAvailabilityId) {
        // Only attach if this availability slot belongs to this coach
        if (!mySlotIds.has(b.coachAvailabilityId) && !sessionsMap.has(`pt-${b.coachAvailabilityId}`)) {
          return;
        }

        const key = `pt-${b.coachAvailabilityId}`;
        const existing = sessionsMap.get(key);
        const startTime = b.coachAvailability?.startTime || existing?.startTime;
        const endTime = b.coachAvailability?.endTime || existing?.endTime;
        if (startTime && endTime) {
          if (existing) {
            if (!existing.bookings.some((x) => x.id === b.id)) {
              existing.bookings.push(studentBooking);
            }
            if (b.status === 'ATTENDED') existing.status = 'ATTENDED';
            else if (b.status === 'CANCELLED' && existing.bookings.every((x) => x.status === 'CANCELLED')) {
              existing.status = 'CANCELLED';
            }
            existing.currentEnrolled = existing.bookings.length;
            existing.isBooked = true;
            if (b.subscription?.plan?.name) {
              existing.title = b.subscription.plan.name;
            }
          } else {
            sessionsMap.set(key, {
              id: b.coachAvailabilityId,
              type: 'PERSONAL_TRAINING',
              coachAvailabilityId: b.coachAvailabilityId,
              title: 'Huấn Luyện Cá Nhân 1-1 (PT)',
              startTime,
              endTime,
              status: b.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED',
              currentEnrolled: 1,
              capacity: 1,
              bookings: [studentBooking],
              isBooked: true,
              isEmergencyCancelled: b.isEmergencyCancellation,
            });
          }
        }
      } else if (b.bookingType === 'GROUP_CLASS' && b.scheduleId) {
        const key = `class-${b.scheduleId}`;
        const existing = sessionsMap.get(key);
        // STRICT: Only append bookings to classes that already belong to this coach!
        // Never inject other coaches' group classes!
        if (existing) {
          if (!existing.bookings.some((x) => x.id === b.id)) {
            existing.bookings.push(studentBooking);
          }
          existing.currentEnrolled = existing.bookings.length;
        }
      }
    });

    const result = Array.from(sessionsMap.values());
    result.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    return result;
  },

  // Điểm danh ca học/PT
  classCheckin: async (payload: ClassAttendancePayload) => {
    const res = await apiClient.post('/attendances/class-checkin', payload);
    return res.data;
  },

  updateCheckin: async (attendanceId: string, payload: UpdateAttendancePayload) => {
    const res = await apiClient.put(`/attendances/class-checkin/${attendanceId}`, payload);
    return res.data;
  },

  // Khung giờ rảnh PT (Coach Availability)
  getMyAvailability: async (): Promise<CoachAvailabilitySlot[]> => {
    const res = await apiClient.get<CoachAvailabilitySlot[]>('/coaches/availability/mine');
    return res.data;
  },

  createSlot: async (payload: CreateSlotPayload): Promise<CoachAvailabilitySlot> => {
    const res = await apiClient.post<CoachAvailabilitySlot>('/coaches/availability', payload);
    return res.data;
  },

  createSlotsBulk: async (
    slots: CreateSlotPayload[]
  ): Promise<{ count: number; slots: CoachAvailabilitySlot[] }> => {
    const res = await apiClient.post<{ count: number; slots: CoachAvailabilitySlot[] }>(
      '/coaches/availability/bulk',
      { slots }
    );
    return res.data;
  },

  deleteSlot: async (slotId: string): Promise<{ id: string }> => {
    const res = await apiClient.delete<{ id: string }>(`/coaches/availability/${slotId}`);
    return res.data;
  },

  applyWorkoutPlanToSlot: async (
    slotId: string,
    payload: {
      workoutPlanId?: string;
      title?: string;
      notes?: string;
      exercises?: Array<{
        exerciseId?: string;
        title?: string;
        category?: string;
        sets?: number;
        reps?: number;
        restSeconds?: number;
        weightKg?: number | null;
      }>;
    }
  ): Promise<CoachAvailabilitySlot> => {
    const res = await apiClient.put<CoachAvailabilitySlot>(
      `/coaches/availability/${slotId}/workout-plan`,
      payload
    );
    return res.data;
  },

  // Quản lý học viên được gán
  getAssignedMembers: async (query?: string): Promise<AssignedMemberItem[]> => {
    try {
      const res = await apiClient.get<AssignedMemberItem[]>('/coaches/members', {
        params: query ? { q: query } : undefined,
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        return res.data;
      }
    } catch {
      // Endpoint 404 on current Render deployment; fallback to hydrating from bookings
    }

    try {
      // Fetch all bookings for this coach to locate all students
      const [bookingsRes, scheduleRes] = await Promise.all([
        apiClient.get('/bookings').catch(() => ({ data: [] })),
        apiClient.get('/coaches/today-schedule').catch(() => ({ data: { classes: [], pt: [] } })),
      ]);

      const bookings = Array.isArray(bookingsRes.data) ? bookingsRes.data : [];
      const todayClasses = scheduleRes.data?.classes || [];
      const todayPt = scheduleRes.data?.pt || [];

      const memberIdSet = new Set<string>();
      bookings.forEach((b: any) => {
        if (b.memberId) memberIdSet.add(b.memberId);
      });
      todayClasses.forEach((c: any) => {
        (c.bookings || []).forEach((b: any) => {
          if (b.memberId) memberIdSet.add(b.memberId);
        });
      });
      todayPt.forEach((p: any) => {
        (p.bookings || []).forEach((b: any) => {
          if (b.memberId) memberIdSet.add(b.memberId);
        });
      });

      const memberIds = [...memberIdSet];
      if (memberIds.length === 0) return [];

      const membersList = await Promise.all(
        memberIds.map(async (mId) => {
          try {
            const [uRes, subsRes, inbodyRes] = await Promise.all([
              apiClient.get(`/users/${mId}`),
              apiClient.get('/memberships/subscriptions', { params: { memberId: mId } }).catch(() => ({ data: [] })),
              apiClient.get('/inbody/my-progress', { params: { memberId: mId } }).catch(() => ({ data: [] })),
            ]);

            const u = uRes.data;
            const subs = Array.isArray(subsRes.data) ? subsRes.data : [];
            const rawInbody = inbodyRes.data;
            const inbodyLogs = Array.isArray(rawInbody)
              ? rawInbody
              : Array.isArray(rawInbody?.logs)
              ? rawInbody.logs
              : [];

            const activeSub = subs.find((s: any) => s.status === 'ACTIVE') || subs[0] || {};

            return {
              id: activeSub.id || mId,
              disciplineId: activeSub.disciplineId || '',
              endDate: activeSub.endDate || new Date().toISOString(),
              remainingGroupSessions: activeSub.remainingGroupSessions ?? 0,
              remainingPtSessions: activeSub.remainingPtSessions ?? 0,
              user: {
                id: u.id,
                fullName: u.fullName,
                phone: u.phone,
                email: u.email,
                avatarUrl: u.avatarUrl,
                memberProfile: u.memberProfile,
                memberInbodyLogs: inbodyLogs,
              },
            } as AssignedMemberItem;
          } catch {
            return null;
          }
        })
      );

      let filtered = membersList.filter((m): m is AssignedMemberItem => m !== null);
      if (query && query.trim()) {
        const q = query.trim().toLowerCase();
        filtered = filtered.filter(
          (item) =>
            item.user.fullName?.toLowerCase().includes(q) ||
            item.user.phone?.includes(q) ||
            item.user.email?.toLowerCase().includes(q)
        );
      }
      return filtered;
    } catch {
      return [];
    }
  },

  getMemberDetail: async (memberId: string) => {
    const res = await apiClient.get(`/users/${memberId}`);
    return res.data;
  },

  // Thể trạng InBody
  getMemberInbodyProgress: async (memberId: string): Promise<InbodyLogItem[]> => {
    const res = await apiClient.get<InbodyLogItem[]>('/inbody/my-progress', {
      params: { memberId },
    });
    return res.data;
  },

  createInbodyLog: async (payload: InbodyLogPayload): Promise<InbodyLogItem> => {
    const res = await apiClient.post<InbodyLogItem>('/inbody/logs', payload);
    return res.data;
  },

  // Trợ lý đề xuất giáo án theo InBody
  getWorkoutRecommendation: async (memberId: string): Promise<WorkoutRecommendation> => {
    const res = await apiClient.get<WorkoutRecommendation>(
      `/workout-plans/recommendations/${encodeURIComponent(memberId)}`,
    );
    return res.data;
  },

  // Giáo án tập luyện & Thư viện bài tập
  getExerciseKnowledge: async (discipline?: string): Promise<ExerciseKnowledgeItem[]> => {
    const res = await apiClient.get<ExerciseKnowledgeItem[]>('/exercise-knowledge', {
      params: { limit: 200, ...(discipline ? { discipline } : {}) },
    });
    return res.data;
  },

  getWorkoutPlans: async (): Promise<WorkoutPlanItem[]> => {
    const res = await apiClient.get<WorkoutPlanItem[]>('/workout-plans');
    return res.data;
  },

  createWorkoutPlan: async (payload: CreateWorkoutPlanPayload): Promise<WorkoutPlanItem> => {
    const res = await apiClient.post<WorkoutPlanItem>('/workout-plans', payload);
    return res.data;
  },

  updateWorkoutPlan: async (
    id: string,
    payload: Partial<CreateWorkoutPlanPayload>
  ): Promise<WorkoutPlanItem> => {
    const res = await apiClient.put<WorkoutPlanItem>(`/workout-plans/${id}`, payload);
    return res.data;
  },

  deleteWorkoutPlan: async (id: string): Promise<{ id: string }> => {
    const res = await apiClient.delete<{ id: string }>(`/workout-plans/${id}`);
    return res.data;
  },

  // Lộ trình khung 12 buổi mẫu & Giáo án theo ca PT (M14 & M14.1)
  getWorkoutTemplates: async (discipline?: string): Promise<WorkoutTemplateItem[]> => {
    const res = await apiClient.get<WorkoutTemplateItem[]>('/workout-templates', {
      params: discipline ? { discipline } : undefined,
    });
    return res.data;
  },

  assignWorkoutTemplate: async (payload: {
    bookingId: string;
    templateCode?: string;
    sessionOrder?: number;
  }): Promise<BookingWorkoutPlan> => {
    const res = await apiClient.post<BookingWorkoutPlan>('/workout-plans/assign-template', payload);
    return res.data;
  },

  getWorkoutPlanByBooking: async (bookingId: string): Promise<BookingWorkoutPlan | null> => {
    try {
      const res = await apiClient.get<BookingWorkoutPlan>(`/bookings/${bookingId}/workout-plan`);
      return res.data;
    } catch {
      return null;
    }
  },

  saveBookingWorkoutPlan: async (
    bookingId: string,
    payload: {
      workoutPlanId?: string;
      title?: string;
      notes?: string;
      exercises?: Array<{
        exerciseId?: string;
        title?: string;
        category?: string;
        sets?: number;
        reps?: number;
        restSeconds?: number;
        weightKg?: number | null;
      }>;
    }
  ): Promise<BookingWorkoutPlan> => {
    const res = await apiClient.put<BookingWorkoutPlan>(`/bookings/${bookingId}/workout-plan`, payload);
    return res.data;
  },

  saveScheduleWorkoutPlan: async (
    scheduleId: string,
    payload: {
      title?: string;
      notes?: string;
      exercises?: Array<{
        title: string;
        category?: string;
        sets?: number;
        reps?: number;
        restSeconds?: number;
        weightKg?: number | null;
      }>;
    }
  ): Promise<any> => {
    const res = await apiClient.put(`/schedules/${scheduleId}/workout-plan`, payload);
    return res.data;
  },

  updateSessionWorkoutPlan: async (
    planId: string,
    payload: UpdateSessionWorkoutPlanPayload
  ): Promise<BookingWorkoutPlan> => {
    const res = await apiClient.put<BookingWorkoutPlan>(`/workout-plans/${planId}`, payload);
    return res.data;
  },

  // Hủy lịch khẩn cấp & Chế tài kỷ luật DSS
  requestEmergencyCancel: async (
    payload: CancellationRequestPayload
  ): Promise<CancellationRequestItem> => {
    const res = await apiClient.post<CancellationRequestItem>(
      '/coaches/cancellation-requests',
      payload
    );
    return res.data;
  },

  getMyCancellationRequests: async (): Promise<CancellationRequestItem[]> => {
    const res = await apiClient.get<CancellationRequestItem[]>('/cancellation-requests');
    return res.data;
  },

  withdrawCancellationRequest: async (
    id: string
  ): Promise<CancellationRequestItem> => {
    const res = await apiClient.put<CancellationRequestItem>(
      `/cancellation-requests/${id}/cancel`,
      {}
    );
    return res.data;
  },

  getMyPenalties: async (): Promise<CoachPenaltyItem[]> => {
    const res = await apiClient.get<CoachPenaltyItem[]>('/coach-penalties');
    return res.data;
  },

  // Hồ sơ & Biểu phí
  getMyProfile: async () => {
    const res = await apiClient.get('/users/profile/me');
    return res.data;
  },

  updateMyProfile: async (data: {
    fullName?: string;
    phone?: string;
    checkinCode?: string;
    bio?: string;
    yearsExperience?: number;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
    workingDays?: string[];
    workingHours?: any[];
  }) => {
    const res = await apiClient.put('/users/profile/me', data);
    return res.data;
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    const res = await apiClient.put('/users/change-password', data);
    return res.data;
  },

  uploadAvatar: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post('/users/profile/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  getMyRates: async (coachId: string): Promise<CoachRateItem[]> => {
    const res = await apiClient.get<CoachRateItem[]>(`/coaches/${coachId}/rates`);
    return res.data;
  },

  // Danh mục thiết bị trung tâm (Mục 3.4 & 5)
  getEquipment: async (): Promise<EquipmentItem[]> => {
    const res = await apiClient.get<EquipmentItem[]>('/classes/equipment');
    return res.data;
  },

  // Cập nhật chỉ số InBody
  updateInbodyLog: async (
    id: string,
    payload: Partial<InbodyLogPayload>
  ): Promise<InbodyLogItem> => {
    const res = await apiClient.put<InbodyLogItem>(`/inbody/logs/${id}`, payload);
    return res.data;
  },

  // Lịch sử toàn bộ booking các ca do HLV phụ trách
  getMyBookings: async () => {
    const res = await apiClient.get('/bookings');
    return res.data;
  },

  // Tra cứu gói dịch vụ của học viên
  getMemberSubscriptions: async (memberId: string) => {
    const res = await apiClient.get('/memberships/subscriptions', {
      params: { memberId },
    });
    return res.data;
  },

  // Tra cứu lịch sử điểm danh của học viên
  getMemberAttendanceHistory: async (memberId: string) => {
    const res = await apiClient.get('/attendances', {
      params: { memberId },
    });
    return res.data;
  },

  // Ca trống / ca bị hủy cần người dạy thay (Cùng bộ môn)
  getPickupSchedules: async (): Promise<PickupScheduleItem[]> => {
    const res = await apiClient.get<PickupScheduleItem[]>('/coaches/pickup-schedules');
    return res.data;
  },

  applyPickupSchedule: async (scheduleId: string): Promise<{ success: boolean; message: string }> => {
    const res = await apiClient.post(`/coaches/pickup-schedules/${scheduleId}/apply`);
    return res.data;
  },

  // Lời mời dạy thay từ Quản lý gửi đến HLV
  getSubstitutionRequests: async (): Promise<SubstitutionRequestItem[]> => {
    const res = await apiClient.get<SubstitutionRequestItem[]>('/coaches/substitution-requests');
    return res.data;
  },

  respondSubstitutionRequest: async (
    requestId: string,
    body: { action: 'ACCEPT' | 'DECLINE'; reason?: string },
  ): Promise<{ success: boolean; status: string; message: string }> => {
    const res = await apiClient.put(`/coaches/substitution-requests/${requestId}/respond`, body);
    return res.data;
  },

  // Chuyên đề khóa học & Xin dạy thêm chuyên đề
  getMyTopicRequests: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/coaches/topic-requests');
    return res.data;
  },

  createTopicRequest: async (body: {
    specialtyId: string;
    reason: string;
    certificateUrl?: string;
  }): Promise<any> => {
    const res = await apiClient.post<any>('/coaches/topic-requests', body);
    return res.data;
  },

  getAllSpecialties: async (): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/specialties');
    return res.data;
  },

  // Danh sách các gói tập (Membership Plans) kèm chuyên đề giảng dạy
  getMembershipPlans: async (disciplineId?: string): Promise<any[]> => {
    const res = await apiClient.get<any[]>('/memberships/plans', {
      params: disciplineId ? { disciplineId } : undefined,
    });
    return res.data;
  },
};
