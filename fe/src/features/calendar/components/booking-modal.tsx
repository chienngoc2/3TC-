import React, { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import type {
  CalendarSchedule,
  CalendarPtSlot,
  CalendarBooking,
  CalendarSubscription,
  CalendarDay,
  Discipline,
} from '../types/calendar.types'
import { formatBookingSlotRange, formatDateToYMD } from '../utils/calendar-date.utils'
import type { CalendarEventItem } from './calendar-grid'
import { getWorkoutPlanByBookingApi } from '../services/calendar-api.service'
import { WorkoutPlanDetailModal } from '@/components/common/workout-plan-detail-modal'
import { CoachDetailModal } from '@/features/coaches/components/coach-detail-modal'
import { getPlanSpecialtyCode, getClassSpecialtyCode, SPECIALTY_NAME_MAP } from '@/lib/topic-matcher'
import {
  X,
  Clock,
  MapPin,
  User,
  AlertTriangle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Sparkles,
  Dumbbell,
  ArrowLeft,
  Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const BACKEND_ERROR_MESSAGES: Record<string, string> = {
  PT_REBOOK_SAME_CANCELLED_DAY:
    'Hôm nay bạn đã hủy muộn 1 ca PT cho bộ môn này. Theo quy định của trung tâm, bạn không thể đặt lại ca tập khác trong cùng ngày.',
  PT_ALREADY_BOOKED_FOR_DISCIPLINE_DAY:
    'Bạn đã có 1 ca tập PT trong ngày cho bộ môn này. Mỗi ngày chỉ được đặt tối đa 1 buổi PT cho cùng một môn.',
  NO_VALID_SUBSCRIPTION_OR_QUOTA:
    'Bạn không có gói tập hợp lệ hoặc đã hết lượt tập cho bộ môn/HLV này. Vui lòng kiểm tra lại thời hạn và số buổi còn lại.',
  QUOTA_EXHAUSTED: 'Gói tập của bạn đã hết số lượt tập. Vui lòng gia hạn hoặc đăng ký gói mới.',
  COACH_DISCIPLINE_MISMATCH:
    'Huấn luyện viên không đảm nhiệm bộ môn này. Vui lòng chọn bộ môn khác phù hợp với chuyên môn của HLV.',
  CLASS_FULL_OR_CLOSED: 'Lớp học đã đủ số lượng học viên hoặc đã đóng đăng ký.',
  SESSION_UNAVAILABLE: 'Lớp học hoặc ca tập hiện không khả dụng. Vui lòng liên hệ trung tâm.',
  SESSION_ALREADY_STARTED: 'Buổi tập hoặc ca dạy đã bắt đầu hoặc đã qua thời gian đăng ký.',
  PT_SLOT_UNAVAILABLE: 'Ca rảnh của HLV đã được người khác đặt trước hoặc không còn khả dụng.',
  MEMBER_SCHEDULE_OVERLAP: 'Bạn đã có một lịch tập khác trùng vào khung giờ này.',
  OVERLAPPING_BOOKING: 'Khung giờ này bị trùng với lịch tập khác của bạn.',
  SAME_DAY_ACTIVE_PT_BOOKING_EXISTS:
    'Mỗi ngày bạn chỉ được đặt tối đa 1 ca tập PT còn hiệu lực cho bộ môn này.',
  SAME_DAY_PT_LATE_CANCELLATION_LIMIT:
    'Hôm nay bạn đã hủy muộn 1 ca PT cho bộ môn này, hệ thống không cho phép đặt thêm ca mới trong cùng ngày.',
  SAME_DAY_PT_LIMIT: 'Hạn mức đặt lịch PT trong ngày của bạn đã đạt tối đa.',
  SUBSCRIPTION_NOT_ACTIVE_ON_DAY: 'Gói tập chưa có hiệu lực hoặc đã hết hạn vào ngày diễn ra buổi tập.',
  GROUP_QUOTA_EXHAUSTED: 'Gói tập của bạn đã hết số lượt tham gia lớp học nhóm.',
  PT_QUOTA_EXHAUSTED: 'Gói tập của bạn đã hết số lượt tập kèm HLV 1-1.',
  INVALID_EQUIPMENT: 'Thiết bị tập không khả dụng hoặc phòng tập tạm ngưng phục vụ.',
  CANCELLATION_WINDOW_EXPIRED: 'Đã quá thời hạn cho phép hủy lịch tập.',
  SCHEDULE_OR_DATA_CONFLICT:
    'Khung giờ này bị xung đột hoặc trùng lặp với lịch tập/ca dạy khác. Hệ thống không cho phép xếp trùng giờ.',
  COACH_AVAILABILITY_ALREADY_BOOKED: 'Ca 1-1 này đã có học viên đăng ký (Lớp đầy). Vui lòng chọn ca khác.',
  PT_SLOT_ALREADY_BOOKED: 'Ca 1-1 này đã có học viên đăng ký (Lớp đầy). Vui lòng chọn ca khác.',
}

const getErrorMessage = (error: unknown, fallback: string): string => {
  let rawMsg = ''
  let errorCode = ''

  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as any).response
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data
      if (typeof data === 'object' && data !== null) {
        if ('errorCode' in data && data.errorCode) {
          errorCode = String(data.errorCode)
        } else if ('code' in data && data.code) {
          errorCode = String(data.code)
        }
        if ('message' in data && data.message) {
          const message = data.message
          rawMsg = Array.isArray(message) ? message.join(', ') : String(message)
        } else if ('error' in data && data.error) {
          rawMsg = String(data.error)
        }
      }
    }
  } else if (error instanceof Error) {
    rawMsg = error.message
  }

  if (rawMsg && /[à-ỹÀ-Ỹ]/.test(rawMsg)) {
    return rawMsg
  }

  const code = errorCode || rawMsg
  if (code) {
    for (const [key, translated] of Object.entries(BACKEND_ERROR_MESSAGES)) {
      if (code.includes(key)) {
        return translated
      }
    }
    return fallback
  }

  return fallback
}

interface BookingModalProps {
  event: CalendarEventItem | null
  onClose: () => void
  onBookGroup: (scheduleId: string) => Promise<void>
  onBookPt: (coachAvailabilityId: string, disciplineId: string) => Promise<void>
  onCancelBooking: (bookingId: string, reason?: string) => Promise<void>
  subscriptions: CalendarSubscription[]
  disciplines: Discipline[]
  days?: CalendarDay[]
  bookings?: CalendarBooking[]
  onSelectEvent?: (event: CalendarEventItem) => void
  onBackToCluster?: () => void
  clusterCount?: number
}

export const BookingModal: React.FC<BookingModalProps> = ({
  event,
  onClose,
  onBookGroup,
  onBookPt,
  onCancelBooking,
  subscriptions,
  disciplines,
  days,
  bookings,
  onSelectEvent,
  onBackToCluster,
  clusterCount,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showBookConfirm, setShowBookConfirm] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [selectedPtDisciplineId, setSelectedPtDisciplineId] = useState('')
  const [assignedPlan, setAssignedPlan] = useState<any>(null)
  const [isViewingAssignedPlan, setIsViewingAssignedPlan] = useState(false)
  const [isCoachDetailOpen, setIsCoachDetailOpen] = useState(false)

  // Extract common details based on event type
  let startAt = ''
  let coachName = ''
  let roomName = ''
  let disciplineName = ''
  let existingBooking: CalendarBooking | undefined

  let scheduleData: CalendarSchedule | undefined
  let ptData: CalendarPtSlot | undefined

  if (event?.type === 'SCHEDULE') {
    scheduleData = event.data
    existingBooking = event.booking
    startAt = scheduleData.startAt
    coachName = scheduleData.coach?.fullName || 'Chưa phân công'
    roomName = scheduleData.room?.name || 'Phòng tập'
    disciplineName = scheduleData.discipline?.name || ''
  } else if (event?.type === 'PT_SLOT') {
    ptData = event.data
    existingBooking = event.booking
    startAt = ptData.startAt
    coachName = ptData.coach?.fullName || 'Huấn luyện viên'
    disciplineName = ptData.discipline?.name || (ptData as any).disciplineName || ''
    const isGroupSlot =
      (ptData as any).packageCategory === 'GROUP' ||
      (ptData as any).type === 'GROUP_CLASS' ||
      disciplineName.toLowerCase().includes('yoga') ||
      disciplineName.toLowerCase().includes('box')
    roomName = isGroupSlot ? 'Phòng chuyên đề' : 'Khu vực PT 1-1'
  } else if (event?.type === 'BOOKING_STANDALONE') {
    existingBooking = event.data
    const isPt =
      existingBooking.bookingType === 'PERSONAL_TRAINING' ||
      existingBooking.type === 'PERSONAL_TRAINING' ||
      !!existingBooking.coachAvailabilityId
    startAt = existingBooking.startAt
    coachName =
      (existingBooking as any).coachAvailability?.coach?.fullName ||
      existingBooking.schedule?.coach?.fullName ||
      (existingBooking as any).coach?.fullName ||
      (isPt ? 'Huấn luyện viên cá nhân' : 'Chưa phân công')
    roomName = existingBooking.room?.name || (isPt ? 'Khu vực PT kèm riêng' : 'Phòng tập')
    disciplineName =
      existingBooking.discipline?.name ||
      disciplines.find((d) => d.id === existingBooking?.disciplineId)?.name ||
      ''
  }

  // Calculate cancellation window (>= 2 hours before start)
  const now = new Date()
  const startTime = new Date(startAt)
  const diffHours = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60)
  const isStarted = diffHours <= 0
  const isRefundable = diffHours >= 2

  // Date strings for quota and subscription validity check
  const todayStr = formatDateToYMD(new Date())
  const sessionDateStr = startAt ? formatDateToYMD(new Date(startAt)) : todayStr

  // Check if coach has assigned a workout plan for this booking
  React.useEffect(() => {
    const fetchPlan = () => {
      if (existingBooking?.id) {
        getWorkoutPlanByBookingApi(existingBooking.id).then((res: any) => {
          if (res && res.id) {
            setAssignedPlan(res)
          } else {
            setAssignedPlan(null)
          }
        })
      } else {
        setAssignedPlan(null)
      }
    }

    fetchPlan()

    const handlePlanUpdate = () => {
      fetchPlan()
    }
    window.addEventListener('workout-plan-updated', handlePlanUpdate)
    window.addEventListener('storage', handlePlanUpdate)
    return () => {
      window.removeEventListener('workout-plan-updated', handlePlanUpdate)
      window.removeEventListener('storage', handlePlanUpdate)
    }
  }, [existingBooking?.id])

  // Coach star level for both Schedule (Group) and PT Slot
  const currentCoach =
    scheduleData?.coach ||
    ptData?.coach ||
    (existingBooking as any)?.coach ||
    (existingBooking as any)?.coachAvailability?.coach ||
    existingBooking?.schedule?.coach
  const scheduleCoachStars =
    currentCoach?.coachProfile?.ratingStars ??
    currentCoach?.ratingStars ??
    (currentCoach as any)?.starLevel ??
    2

  // Check if user has a subscription of same discipline but for a different specialty
  const incompatibleSpecialtyInfo = useMemo(() => {
    if (event?.type !== 'SCHEDULE' || !scheduleData) return null;
    const sameDiscSub = subscriptions.find((sub) => {
      if (sub.status !== 'ACTIVE') return false;
      if ((sub.remainingGroupSessions ?? 0) <= 0) return false;
      if (scheduleData.disciplineId && sub.disciplineId !== scheduleData.disciplineId) return false;
      return true;
    });
    if (!sameDiscSub) return null;

    const className = scheduleData.class?.name || '';
    const planName = sameDiscSub.planName || '';
    const discCode = scheduleData.discipline?.code || '';
    const planSpec = getPlanSpecialtyCode(planName, discCode);
    const classSpec = getClassSpecialtyCode(className, discCode);

    if (planSpec && classSpec && planSpec !== classSpec) {
      return {
        planName,
        className,
        planSpecName: SPECIALTY_NAME_MAP[planSpec] || planSpec,
        classSpecName: SPECIALTY_NAME_MAP[classSpec] || classSpec,
      };
    }
    return null;
  }, [event?.type, scheduleData, subscriptions]);

  const matchingGroupSub = useMemo(() => {
    if (event?.type !== 'SCHEDULE' || !scheduleData || incompatibleSpecialtyInfo) return null
    return (
      subscriptions.find((sub) => {
        if (sub.status !== 'ACTIVE') return false
        if ((sub.remainingGroupSessions ?? 0) <= 0) return false
        if (scheduleData.disciplineId && sub.disciplineId !== scheduleData.disciplineId) {
          return false
        }
        if (sub.coachRatingStars && scheduleCoachStars && sub.coachRatingStars !== scheduleCoachStars) {
          return false
        }
        const subStart = sub.startDate ? sub.startDate.slice(0, 10) : ''
        const subEnd = sub.endDate ? sub.endDate.slice(0, 10) : ''
        if (subStart && subStart > todayStr) return false
        const compareDate = sessionDateStr > todayStr ? sessionDateStr : todayStr
        if (subEnd && subEnd < compareDate) return false
        return true
      }) || null
    )
  }, [event?.type, scheduleData, subscriptions, todayStr, sessionDateStr, scheduleCoachStars, incompatibleSpecialtyInfo])

  const hasDifferentStarSub = useMemo(() => {
    if (event?.type !== 'SCHEDULE' || !scheduleData || matchingGroupSub || incompatibleSpecialtyInfo) return null
    return (
      subscriptions.find((sub) => {
        if (sub.status !== 'ACTIVE') return false
        if ((sub.remainingGroupSessions ?? 0) <= 0) return false
        if (scheduleData.disciplineId && sub.disciplineId !== scheduleData.disciplineId) {
          return false
        }
        return true
      }) || null
    )
  }, [event?.type, scheduleData, subscriptions, matchingGroupSub, incompatibleSpecialtyInfo])

  // Pre-flight check for PT Slot / Coach Slot
  const eligiblePtSubscriptions = useMemo(() => {
    if (event?.type !== 'PT_SLOT' || !ptData) return []
    return subscriptions.filter((sub) => {
      if (sub.status !== 'ACTIVE') return false
      const hasPtQuota = (sub.remainingPtSessions ?? 0) > 0
      const hasGroupQuota = (sub.remainingGroupSessions ?? 0) > 0
      if (!hasPtQuota && !hasGroupQuota) return false

      const subStart = sub.startDate ? sub.startDate.slice(0, 10) : ''
      const subEnd = sub.endDate ? sub.endDate.slice(0, 10) : ''
      if (subStart && subStart > todayStr) return false

      // For PT quota: allowed even if 30-day gym entry expired, as long as PT tokens remain!
      // Only require subEnd >= compareDate if relying purely on group quota
      if (!hasPtQuota && hasGroupQuota) {
        const compareDate = sessionDateStr > todayStr ? sessionDateStr : todayStr
        if (subEnd && subEnd < compareDate) return false
      }

      // Check star level match if sub has coachRatingStars
      if (sub.coachRatingStars && scheduleCoachStars && sub.coachRatingStars !== scheduleCoachStars) {
        return false
      }

      // Check assigned coach match if coach is explicitly assigned
      if (sub.assignedCoach?.id && ptData.coach?.id && sub.assignedCoach.id !== ptData.coach.id) {
        return false
      }

      // Check slot eligible disciplines if provided
      if (
        ptData.eligibleDisciplines &&
        ptData.eligibleDisciplines.length > 0 &&
        !ptData.eligibleDisciplines.includes(sub.disciplineId)
      ) {
        return false
      }

      return true
    })
  }, [event?.type, ptData, subscriptions, todayStr, sessionDateStr, scheduleCoachStars])

  const hasDifferentStarPtSub = useMemo(() => {
    if (event?.type !== 'PT_SLOT' || !ptData || eligiblePtSubscriptions.length > 0) return null
    return (
      subscriptions.find((sub) => {
        if (sub.status !== 'ACTIVE') return false
        const hasQuota = (sub.remainingPtSessions ?? 0) > 0 || (sub.remainingGroupSessions ?? 0) > 0
        if (!hasQuota) return false
        if (sub.coachRatingStars && scheduleCoachStars && sub.coachRatingStars !== scheduleCoachStars) {
          return true
        }
        return false
      }) || null
    )
  }, [event.type, ptData, subscriptions, eligiblePtSubscriptions, scheduleCoachStars])

  // Available PT disciplines mapped from eligible subscriptions
  const availablePtDisciplines = useMemo(() => {
    if (eligiblePtSubscriptions.length === 0) return []
    const discMap = new Map<string, { discipline: Discipline; sub: CalendarSubscription }>()
    for (const sub of eligiblePtSubscriptions) {
      const disc =
        disciplines.find((d) => d.id === sub.disciplineId) ||
        sub.discipline ||
        ({ id: sub.disciplineId, name: sub.planName, code: 'PT' } as Discipline)
      if (!discMap.has(disc.id)) {
        discMap.set(disc.id, { discipline: disc, sub })
      }
    }
    return Array.from(discMap.values())
  }, [eligiblePtSubscriptions, disciplines])

  const activePtDisciplineId =
    selectedPtDisciplineId && availablePtDisciplines.some((item) => item.discipline.id === selectedPtDisciplineId)
      ? selectedPtDisciplineId
      : availablePtDisciplines[0]?.discipline.id || ''

  const currentSelectedPtSub = eligiblePtSubscriptions.find(
    (s) => s.disciplineId === activePtDisciplineId,
  )

  const isUsingGroupSub = Boolean(
    currentSelectedPtSub &&
      (currentSelectedPtSub.remainingPtSessions ?? 0) <= 0 &&
      (currentSelectedPtSub.remainingGroupSessions ?? 0) > 0
  )

  // Check day eligibility for the selected slot day and discipline
  // Use Vietnam timezone / local date so UTC timestamps don't shift by -1 day for morning slots
  const slotDateStr = useMemo(() => {
    if (!startAt) return ''
    try {
      return formatDateToYMD(new Date(startAt))
    } catch {
      return ''
    }
  }, [startAt])

  const currentDayInfo = useMemo(() => {
    if (!days || !slotDateStr) return null
    return days.find((d) => d.date === slotDateStr) || null
  }, [days, slotDateStr])

  const ptDayEligibility = useMemo(() => {
    if (!currentDayInfo || !activePtDisciplineId) return null

    // 1. If we have an active matching subscription, match strictly by subscriptionId
    // to prevent falling back to an older expired subscription of the same discipline
    if (currentSelectedPtSub) {
      const matchBySub = currentDayInfo.eligibility?.find(
        (e) => e.subscriptionId === currentSelectedPtSub.id,
      )
      if (matchBySub) return matchBySub
    }

    // 2. Otherwise find all entries for this discipline and prefer an allowed one
    const matchingEntries =
      currentDayInfo.eligibility?.filter(
        (e) => e.disciplineId === activePtDisciplineId,
      ) || []

    const allowedEntry = matchingEntries.find((e) =>
      isUsingGroupSub ? e.group?.allowed : e.pt?.allowed
    )
    if (allowedEntry) return allowedEntry

    return matchingEntries[0] || null
  }, [currentDayInfo, activePtDisciplineId, currentSelectedPtSub, isUsingGroupSub])

  const isDayNotAllowed = isUsingGroupSub
    ? Boolean(ptDayEligibility && !ptDayEligibility.group?.allowed)
    : Boolean(ptDayEligibility && !ptDayEligibility.pt?.allowed)

  // Check if member already has an active PT booking for this day and discipline
  const existingDayBooking = useMemo(() => {
    if (!bookings || !slotDateStr || !activePtDisciplineId) return null
    return (
      bookings.find((b) => {
        if (b.status === 'CANCELLED') return false
        const bDate = formatDateToYMD(new Date(b.startAt))
        return (
          bDate === slotDateStr &&
          (b.type === 'PERSONAL_TRAINING' || b.bookingType === 'PERSONAL_TRAINING') &&
          (b.disciplineId === activePtDisciplineId || b.discipline?.id === activePtDisciplineId)
        )
      }) || null
    )
  }, [bookings, slotDateStr, activePtDisciplineId])

  // Resolve current active package name for top tab
  const packageName = useMemo(() => {
    return (
      currentSelectedPtSub?.planName ||
      matchingGroupSub?.planName ||
      (event?.type === 'SCHEDULE' ? scheduleData?.class?.name : '') ||
      (existingBooking as any)?.subscription?.planName ||
      subscriptions.find((s) => s.status === 'ACTIVE')?.planName ||
      'Khóa Học Yoga Trị Liệu & Phục Hồi Cột Sống (12 Buổi / Tháng)'
    )
  }, [currentSelectedPtSub, matchingGroupSub, event?.type, scheduleData, existingBooking, subscriptions])

  // Parse workout plan and exercise details for topic & exercise breakdown
  const parsedSlotPlan = useMemo(() => {
    // 1. If assignedPlan exists from DB or attached to booking
    const effectivePlan =
      assignedPlan || (existingBooking as any)?.workoutPlans?.[0] || null;
    if (effectivePlan) {
      const exs = (effectivePlan.exercises || []).map((item: any) => ({
        title: item.exercise?.title || item.title || 'Bài tập',
        sets: item.sets || 3,
        reps: item.reps || 10,
        restSeconds: item.restSeconds || 30,
        weightKg: item.weightKg || null,
      }));
      const fullNotes = effectivePlan.notes || '';
      const topicMatch = fullNotes.match(/\[CHUYÊN ĐỀ\]:\s*(.+)/);
      const descMatch = fullNotes.match(/• Nội dung:\s*(.+)/);
      const cleanTitle = (effectivePlan.title || 'Giáo án buổi tập').replace(/^\[GIÁO ÁN\]:\s*/, '');
      return {
        title: cleanTitle,
        topic: topicMatch ? topicMatch[1].trim() : cleanTitle,
        topicDesc: descMatch ? descMatch[1].trim() : (fullNotes.startsWith('---') ? '' : fullNotes),
        exercises: exs,
        fullNotes,
      };
    }

    // 2. Check localStorage or slot notes saved by coach (strictly for this specific slot/timestamp)
    const slotId = ptData?.id || scheduleData?.id || (event.data as any)?.id
    const coachAvailId = (ptData as any)?.coachAvailabilityId || (event.data as any)?.coachAvailabilityId
    let rawNote = ''
    try {
      const rawMap = localStorage.getItem('coach_session_notes_map')
      if (rawMap) {
        const parsed = JSON.parse(rawMap)
        // 2.1 Exact ID match
        if (slotId && parsed[slotId]) rawNote = parsed[slotId]
        if (!rawNote && coachAvailId && parsed[coachAvailId]) rawNote = parsed[coachAvailId]
        
        // 2.2 Exact Timestamp match
        if (!rawNote && startAt) {
          if (parsed[startAt]) rawNote = parsed[startAt]
          const prefix16 = startAt.slice(0, 16)
          if (!rawNote && parsed[prefix16]) rawNote = parsed[prefix16]
        }
      }
    } catch {}

    if (!rawNote) {
      rawNote = (ptData as any)?.notes || (scheduleData as any)?.notes || ''
    }

    if (rawNote) {
      const normalizedNote = rawNote.replace(/\r\n/g, '\n')
      const titleMatch = normalizedNote.match(/\[GIÁO ÁN\]:\s*(.+)/)
      const topicMatch = normalizedNote.match(/\[CHUYÊN ĐỀ\]:\s*(.+)/)
      const descMatch = normalizedNote.match(/• Nội dung:\s*(.+)/)
      const exerciseLines = normalizedNote.match(
        /\d+\.\s*([^:\n\r]+):\s*(\d+)\s*hiệp\s*x\s*(\d+)\s*lần(?:\s*\(Nghỉ\s*(\d+)s\))?/g,
      )
      const exercises: Array<{ title: string; sets?: number; reps?: number; restSeconds?: number }> = []

      if (exerciseLines) {
        exerciseLines.forEach((line) => {
          const match = line.match(
            /\d+\.\s*([^:\n\r]+):\s*(\d+)\s*hiệp\s*x\s*(\d+)\s*lần(?:\s*\(Nghỉ\s*(\d+)s\))?/,
          )
          if (match) {
            exercises.push({
              title: match[1].trim(),
              sets: Number(match[2]),
              reps: Number(match[3]),
              restSeconds: match[4] ? Number(match[4]) : 30,
            })
          }
        })
      }

      const notesMatch = normalizedNote.match(/--- GHI CHÚ ---\n([\s\S]+)$/)

      return {
        title: titleMatch ? titleMatch[1].trim() : 'Giáo án buổi tập',
        topic: topicMatch ? topicMatch[1].trim() : (titleMatch ? titleMatch[1].trim() : 'Chuyên đề buổi tập'),
        topicDesc: descMatch ? descMatch[1].trim() : '',
        exercises,
        fullNotes: notesMatch ? notesMatch[1].trim() : '',
      }
    }

    // 3. No workout plan authored yet: return empty (do NOT mock data)
    return {
      title: '',
      topic: 'Chưa có giáo án',
      topicDesc: 'Huấn luyện viên chưa soạn giáo án cho ca tập này.',
      exercises: [],
      fullNotes: '',
    }
  }, [assignedPlan, ptData?.id, scheduleData?.id, event?.data, startAt])

  if (!event) return null

  // Handlers
  const handleConfirmBookGroup = async () => {
    if (!scheduleData) return
    if (isStarted) {
      setErrorMsg('Buổi tập này đã bắt đầu hoặc diễn ra trong quá khứ, không thể đặt chỗ.')
      return
    }
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await onBookGroup(scheduleData.id)
      setShowBookConfirm(false)
      onClose()
    } catch (err: unknown) {
      setErrorMsg(
        getErrorMessage(
          err,
          'Không thể đặt lớp. Vui lòng kiểm tra lại hạn mức và thời hạn gói tập.',
        ),
      )
      setShowBookConfirm(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmBookPt = async () => {
    if (!ptData) return
    if (isStarted) {
      setErrorMsg('Khung giờ tập này đã qua thời gian bắt đầu, không thể đăng ký ca tập trong quá khứ.')
      return
    }
    const disciplineId = activePtDisciplineId
    if (!disciplineId) {
      setErrorMsg('Vui lòng chọn bộ môn cho buổi tập PT')
      return
    }
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await onBookPt(ptData.id, disciplineId)
      onClose()
    } catch (err: unknown) {
      const msg = getErrorMessage(
        err,
        'Không thể đặt ca tập. Vui lòng thử lại hoặc kiểm tra gói tập.',
      )
      setErrorMsg(msg)
      const rawErrStr = JSON.stringify(err ?? '')
      if (
        rawErrStr.includes('COACH_AVAILABILITY_ALREADY_BOOKED') ||
        rawErrStr.includes('PT_SLOT_ALREADY_BOOKED') ||
        msg.includes('đã có học viên đăng ký') ||
        rawErrStr.includes('PT_SLOT_UNAVAILABLE')
      ) {
        ptData.isBooked = true
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmCancel = async () => {
    if (!existingBooking) return
    setIsSubmitting(true)
    setErrorMsg(null)
    try {
      await onCancelBooking(existingBooking.id, cancelReason)
      onClose()
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'Lỗi khi hủy lịch đặt. Buổi tập có thể đã diễn ra.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format date display
  const startDateObj = new Date(startAt)
  const formattedDate = startDateObj.toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return typeof document !== 'undefined'
    ? createPortal(
        <>
          <aside
          aria-label="Chi tiết buổi tập"
          className="fixed right-5 top-24 z-[9999] flex w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden rounded-none border-2 border-slate-900 bg-white shadow-2xl animate-in slide-in-from-right duration-200"
        >
      <div className="flex max-h-[calc(100vh-7rem)] min-h-0 flex-1 flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                existingBooking
                  ? 'bg-emerald-500'
                  : event.type === 'PT_SLOT'
                    ? 'bg-purple-500'
                    : 'bg-sky-500',
              )}
            />
            <h2 className="text-base font-bold text-slate-900">Chi tiết buổi tập</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            aria-label="Đóng chi tiết buổi tập"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Back to Cluster List Button if opened from multiple concurrent classes */}
        {onBackToCluster && (
          <div className="px-5 py-2.5 bg-emerald-50/90 border-b border-emerald-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToCluster}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17664e] hover:text-[#00705d] transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại danh sách {clusterCount ? `${clusterCount} ` : ''}ca cùng giờ</span>
            </button>
            <span className="text-[11px] text-emerald-800 font-medium">Đổi ca khác</span>
          </div>
        )}

        {/* Body content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <span className="font-bold">Lỗi đặt/hủy lịch:</span> {errorMsg}
              </div>
            </div>
          )}

          {/* 1. TÊN GÓI TẬP & THỜI GIAN (Tab trên cùng) */}
          <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/60 p-4 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-emerald-700" />
                Gói tập áp dụng
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-white text-emerald-800 border border-emerald-300/80 shadow-2xs">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                {formatBookingSlotRange(startAt)}
              </span>
            </div>

            <div className="text-sm font-bold text-slate-900 leading-snug">
              {packageName}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 pt-0.5">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
              <span className="capitalize">{formattedDate}</span>
              {roomName && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {roomName}
                  </span>
                </>
              )}
              {existingBooking && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    ĐÃ ĐẶT CHỖ
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 2. CHỦ ĐỀ BUỔI TẬP */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-1 shadow-2xs">
            <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              Chủ đề buổi tập
            </div>
            <div className="text-xs font-bold text-slate-900 leading-snug">
              {parsedSlotPlan.topic}
            </div>
            {parsedSlotPlan.topicDesc && (
              <p className="text-[11.5px] text-slate-600 leading-relaxed pt-0.5">
                {parsedSlotPlan.topicDesc}
              </p>
            )}
          </div>

          {/* 3. HUẤN LUYỆN VIÊN & CHI TIẾT */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 flex items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-1 min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                Huấn luyện viên
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 truncate">
                  {coachName}
                </span>
                <span className="text-amber-500 font-bold text-xs tracking-tight">
                  {'★'.repeat(scheduleCoachStars)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCoachDetailOpen(true)}
              className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
            >
              Chi tiết HLV
            </button>
          </div>

          {/* 4. NỘI DUNG BÀI TẬP & CHI TIẾT GIÁO ÁN */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Dumbbell className="w-3.5 h-3.5 text-emerald-600" />
                Nội dung bài tập ({parsedSlotPlan.exercises.length} động tác)
              </span>
              {parsedSlotPlan.exercises.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsViewingAssignedPlan(true)}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                >
                   Chi tiết →
                </button>
              )}
            </div>

            {parsedSlotPlan.exercises.length === 0 ? (
              <div className="py-3 px-3 rounded-lg bg-slate-50 border border-slate-100 text-center">
                <p className="text-xs text-slate-500 font-medium">
                  Huấn luyện viên chưa soạn giáo án cho ca tập này.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {parsedSlotPlan.exercises.slice(0, 3).map((ex: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 truncate">{ex.title}</span>
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium shrink-0 ml-2">
                      {ex.sets} hiệp × {ex.reps} lần
                    </span>
                  </div>
                ))}
                {parsedSlotPlan.exercises.length > 3 && (
                  <div className="text-[11px] text-slate-400 text-center pt-0.5 font-medium">
                    + {parsedSlotPlan.exercises.length - 3} bài tập khác trong giáo án
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Past Event Warning if trying to book an event in the past */}
          {!existingBooking && isStarted && (
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-700 text-xs flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800">Buổi tập đã qua giờ diễn ra</span>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Khung giờ này đã kết thúc hoặc đang diễn ra trong quá khứ. Hệ thống không cho phép đăng ký mới.
                </p>
              </div>
            </div>
          )}

          {/* Group Class Quota Status or Alert (for SCHEDULE event) */}
          {event.type === 'SCHEDULE' && !existingBooking && !isStarted && (
            <div>
              {matchingGroupSub ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Hạn mức lớp nhóm:</span>
                    <span className="font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                      Còn {matchingGroupSub.remainingGroupSessions} buổi
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {matchingGroupSub.planName} • Hạn đến {new Date(matchingGroupSub.endDate).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              ) : incompatibleSpecialtyInfo ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Lớp học khác chuyên đề khóa học của bạn</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Gói tập của bạn là <strong>{incompatibleSpecialtyInfo.planName}</strong> (chuyên đề: <em>{incompatibleSpecialtyInfo.planSpecName}</em>). Lớp này thuộc chuyên đề <strong>{incompatibleSpecialtyInfo.classSpecName}</strong>. Vui lòng chọn lớp đúng chuyên đề hoặc đăng ký thêm gói phù hợp.
                  </p>
                </div>
              ) : hasDifferentStarSub ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Lớp học khác hạng sao gói tập</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Gói tập của bạn là gói <strong>{hasDifferentStarSub.coachRatingStars || 2} sao</strong> (chỉ áp dụng cho HLV {hasDifferentStarSub.coachRatingStars || 2} sao). Lớp này do HLV <strong>{coachName} ({scheduleCoachStars} sao)</strong> phụ trách. Vui lòng chọn lớp có HLV cùng hạng hoặc đăng ký/nâng cấp gói.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Chưa có gói tập lớp nhóm</span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    Bạn chưa có gói tập đang hoạt động hoặc đã hết lượt tham gia lớp nhóm cho bộ môn <strong>{disciplineName || 'này'}</strong>. Vui lòng đăng ký hoặc gia hạn gói tập tại quầy tiếp tân.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* PT / Coach Slot Discipline Selector & Quota Status */}
          {event.type === 'PT_SLOT' && !existingBooking && !isStarted && (
            <div className="space-y-3">
              {ptData?.isBooked ? (
                <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Ca tập này đã có học viên đăng ký</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Khung giờ này đã được học viên khác đặt chỗ trước với HLV <strong>{coachName}</strong>. Vui lòng chọn ca tập khác.
                  </p>
                </div>
              ) : availablePtDisciplines.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      {hasDifferentStarPtSub
                        ? 'HLV khác hạng sao gói tập'
                        : 'Không có gói tập khả dụng'}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    {hasDifferentStarPtSub ? (
                      <>
                        HLV <strong>{coachName}</strong> ({scheduleCoachStars} sao) không cùng hạng sao với gói tập của bạn (<strong>{hasDifferentStarPtSub.planName}</strong> — {hasDifferentStarPtSub.coachRatingStars} sao). Vui lòng chọn ca của HLV phù hợp hoặc nâng hạng gói tập.
                      </>
                    ) : (
                      <>
                        Bạn cần có gói tập kèm HLV hoặc gói nhóm còn lượt (và phù hợp với HLV <strong>{coachName}</strong>) để đặt ca tập này. Vui lòng kiểm tra lại thời hạn gói tập hoặc liên hệ quầy tiếp tân để đăng ký.
                      </>
                    )}
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-3">
                  {availablePtDisciplines.length > 1 && (
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-800">
                        {isUsingGroupSub
                          ? 'Bộ môn đăng ký buổi tập nhóm:'
                          : 'Chọn bộ môn đăng ký tập kèm PT:'}
                      </label>
                      <select
                        value={activePtDisciplineId}
                        onChange={(e) => setSelectedPtDisciplineId(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-hidden focus:ring-1 focus:ring-emerald-600 text-xs"
                      >
                        {availablePtDisciplines.map(({ discipline: d, sub }) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code}) — {sub.planName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {currentSelectedPtSub && (
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Hạn mức gói tập</span>
                        <span className="font-bold text-slate-800 truncate block max-w-[200px]">
                          {currentSelectedPtSub.planName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block text-[10px]">Số buổi còn lại</span>
                        <span className="font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md inline-block">
                          {isUsingGroupSub
                            ? `${currentSelectedPtSub.remainingGroupSessions} buổi nhóm`
                            : `${currentSelectedPtSub.remainingPtSessions} buổi PT`}
                        </span>
                        {!isUsingGroupSub && currentSelectedPtSub.endDate && currentSelectedPtSub.endDate.slice(0, 10) < todayStr && (
                          <span className="block text-[10px] text-emerald-700 font-semibold mt-0.5">
                            Còn token PT • Được phép đặt lịch HLV
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {ptDayEligibility && isDayNotAllowed && !existingBooking && !isStarted && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-800">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                        <span>Không thể đặt ca tập trong ngày này</span>
                      </div>
                      {existingDayBooking ? (
                        <div className="space-y-2">
                          <p className="text-[11.5px] text-amber-800 leading-relaxed">
                            Bạn hiện đã có 1 ca tập bộ môn này vào lúc{' '}
                            <span className="font-bold text-amber-950">
                              {formatBookingSlotRange(existingDayBooking.startAt)}
                            </span>
                            {existingDayBooking.coach?.fullName ? (
                              <>
                                {' '}với HLV{' '}
                                <span className="font-bold text-amber-950">
                                  {existingDayBooking.coach.fullName}
                                </span>
                              </>
                            ) : null}
                            . Theo quy định của trung tâm, mỗi ngày chỉ được đặt tối đa 1 buổi cho cùng một môn.
                          </p>
                          {onSelectEvent && (
                            <button
                              type="button"
                              onClick={() => {
                                onSelectEvent({ type: 'BOOKING_STANDALONE', data: existingDayBooking })
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                            >
                              <span>Xem / Hủy ca tập này để đổi sang giờ khác</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-700 leading-relaxed">
                          {BACKEND_ERROR_MESSAGES[
                            (isUsingGroupSub
                              ? ptDayEligibility.group?.reason
                              : ptDayEligibility.pt?.reason) || ''
                          ] || 'Bạn không đủ điều kiện đặt thêm ca tập cho bộ môn này trong ngày.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          

          {/* Cancellation section if already booked */}
          {existingBooking && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-900">Chính sách hủy chỗ</h4>
              </div>

              {isStarted ? (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  Buổi tập đã bắt đầu. Hệ thống không cho phép hủy lịch.
                </div>
              ) : isRefundable ? (
                <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
                  <span className="font-bold">Hủy đúng hạn:</span> Bạn sẽ được hoàn
                  lại 01 lượt tập vào gói đăng ký.
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                  <div>
                    <span className="font-bold">Hủy muộn:</span> Buổi tập vẫn được giải
                    phóng cho hội viên khác, nhưng{' '}
                    <span className="font-bold underline">không được hoàn lại lượt tập</span>.
                  </div>
                  {(event.type === 'PT_SLOT' ||
                    existingBooking?.type === 'PERSONAL_TRAINING' ||
                    existingBooking?.bookingType === 'PERSONAL_TRAINING') && (
                    <div className="text-[11px] text-amber-900 font-semibold pt-1 border-t border-amber-200/60">
                      ⚠️ Lưu ý: Theo quy định trung tâm, nếu hủy muộn, bạn sẽ không thể đặt lại ca PT khác của bộ môn này trong cùng ngày.
                    </div>
                  )}
                </div>
              )}

              {showCancelConfirm ? (
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Lý do hủy lịch (tùy chọn):
                  </label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Nhập lý do bận, ốm,..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isSubmitting || isStarted}
                      onClick={handleConfirmCancel}
                      className="flex-1 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? 'Đang xử lý...' : 'Xác nhận hủy lịch'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCancelConfirm(false)}
                      className="py-2 px-3 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
                    >
                      Quay lại
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isStarted}
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-2 px-4 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
                >
                  Yêu cầu hủy đặt chỗ
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions if NOT booked yet */}
        {!existingBooking && (
          <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Đóng
            </button>

            {event.type === 'SCHEDULE' && scheduleData && (
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  isStarted ||
                  scheduleData.currentEnrolled >= scheduleData.capacity ||
                  !matchingGroupSub
                }
                onClick={() => setShowBookConfirm(true)}
                className={cn(
                  'py-2 px-5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer',
                  isStarted || scheduleData.currentEnrolled >= scheduleData.capacity || !matchingGroupSub
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-[#17664e] hover:bg-[#00735f] active:bg-[#005f4f]',
                )}
              >
                {isSubmitting
                  ? 'Đang đặt...'
                  : isStarted
                    ? 'Buổi tập đã qua giờ'
                    : scheduleData.currentEnrolled >= scheduleData.capacity
                    ? 'Lớp đã đủ người'
                    : hasDifferentStarSub
                    ? 'HLV khác hạng sao gói tập'
                    : !matchingGroupSub
                    ? 'Chưa có gói tập phù hợp'
                    : 'Đăng ký tham gia (1 token)'}
              </button>
            )}

            {event.type === 'PT_SLOT' && ptData && (
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  isStarted ||
                  Boolean(ptData.isBooked && !existingBooking) ||
                  availablePtDisciplines.length === 0 ||
                  isDayNotAllowed
                }
                onClick={handleConfirmBookPt}
                className={cn(
                  'py-2 px-5 rounded-xl text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer',
                  isStarted ||
                    Boolean(ptData.isBooked && !existingBooking) ||
                    availablePtDisciplines.length === 0 ||
                    isDayNotAllowed
                    ? 'bg-slate-400 cursor-not-allowed opacity-90'
                    : 'bg-purple-600 hover:bg-purple-700 active:bg-purple-800',
                )}
              >
                {isSubmitting
                  ? 'Đang đặt...'
                  : isStarted
                    ? 'Khung giờ đã qua'
                    : ptData.isBooked && !existingBooking
                    ? 'Ca tập đã có người đặt'
                    : hasDifferentStarPtSub
                    ? 'HLV khác hạng sao gói tập'
                    : availablePtDisciplines.length === 0
                    ? 'Chưa có gói tập phù hợp'
                    : isDayNotAllowed
                    ? 'Không đủ điều kiện đặt trong ngày'
                    : isUsingGroupSub
                    ? 'Đăng ký ca tập (1 buổi nhóm)'
                    : 'Xác nhận đặt lịch PT'}
              </button>
            )}
          </div>
        )}
      </div>
    </aside>

    {/* Assigned / Slot Workout Plan Viewer Modal (M14.1) */}
    <WorkoutPlanDetailModal
      isOpen={isViewingAssignedPlan}
      onClose={() => setIsViewingAssignedPlan(false)}
      title={parsedSlotPlan.title}
      coachName={coachName}
      notes={parsedSlotPlan.fullNotes || parsedSlotPlan.topicDesc}
      exercises={parsedSlotPlan.exercises.map((e: any, idx: number) => ({
        id: String(idx),
        title: e.title,
        sets: e.sets,
        reps: e.reps,
        restSeconds: e.restSeconds,
        exercise: { title: e.title },
      }))}
    />

    {/* Coach Detail Modal */}
    {currentCoach && (
      <CoachDetailModal
        coach={currentCoach as any}
        isOpen={isCoachDetailOpen}
        onClose={() => setIsCoachDetailOpen(false)}
      />
    )}

    {/* Token Deduction Confirmation Dialog */}
    {showBookConfirm && matchingGroupSub && scheduleData && (
      <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-200">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-900">
                Xác nhận đăng ký tham gia lớp
              </h3>
              <p className="text-xs text-slate-500">
                Bạn sẽ sử dụng 1 token để đăng ký ca học này
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/90 text-xs space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Gói tập trừ token:</span>
              <span className="font-bold text-slate-900 text-right truncate max-w-[180px]">
                {matchingGroupSub.planName}
              </span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Loại token áp dụng:</span>
              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Gói {matchingGroupSub.coachRatingStars || scheduleCoachStars} sao (1 token)
              </span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">Số token còn lại:</span>
              <span className="font-mono font-bold text-slate-900">
                {matchingGroupSub.remainingGroupSessions} token →{' '}
                <span className="text-emerald-600 font-extrabold">
                  {matchingGroupSub.remainingGroupSessions - 1} token
                </span>
              </span>
            </div>

            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500">HLV đứng lớp:</span>
              <span className="font-bold text-slate-900">
                {coachName} ({scheduleCoachStars}★)
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-500">Thời gian ca tập:</span>
              <span className="font-medium text-slate-900">
                {formatBookingSlotRange(startAt)}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1">
            <span className="font-bold block">Chính sách xin nghỉ & hoàn token:</span>
            <p className="text-amber-800 leading-relaxed">
              Nếu bạn có việc bận cần xin nghỉ, bạn được <strong>hoàn lại 100% token</strong> vào gói tập nếu hủy lịch trước giờ bắt đầu tối thiểu <strong>2 tiếng</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setShowBookConfirm(false)}
              className="flex-1 py-2 px-3 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmBookGroup}
              className="flex-1 py-2 px-3 rounded-lg bg-[#17664e] hover:bg-[#00735f] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              {isSubmitting ? 'Đang trừ token...' : 'Xác nhận trừ token'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>,
    document.body
  ) : null
}
