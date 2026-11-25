import React, { useRef, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type {
  CalendarSchedule,
  CalendarPtSlot,
  CalendarBooking,
  CalendarSubscription,
} from '../types/calendar.types'
import {
  getWeekDays,
  CALENDAR_START_HOUR,
  CALENDAR_END_HOUR,
  HOUR_HEIGHT_PX,
  calculateEventPosition,
  getCurrentTimeTop,
  formatTimeHHmm,
  formatDateToYMD,
} from '../utils/calendar-date.utils'
import { Users, UserCheck, CheckCircle2, Clock, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'
import { get } from '@/lib/api'
import { isRangeInPeakHours, type PeakHourConfig } from '@/lib/peak-hours'
import { getClassSpecialtyCode, SPECIALTY_NAME_MAP } from '@/lib/topic-matcher'

export type CalendarEventItem =
  | { type: 'SCHEDULE'; data: CalendarSchedule; booking?: CalendarBooking }
  | { type: 'PT_SLOT'; data: CalendarPtSlot; booking?: CalendarBooking }
  | { type: 'BOOKING_STANDALONE'; data: CalendarBooking }

const ACTIVE_BOOKING_STATUSES = new Set(['CONFIRMED', 'PENDING'])

// Modern curated discipline color styling (clean borders, no thick stripes)
const getDisciplineCardClasses = (code?: string, name?: string) => {
  const value = `${code ?? ''} ${name ?? ''}`.toLowerCase()
  if (value.includes('gym') || value.includes('fitness')) {
    return 'bg-sky-50/95 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 border border-sky-200/90 dark:border-sky-800/60 hover:bg-sky-100/95 dark:hover:bg-sky-950/60 focus:ring-sky-400'
  }
  if (value.includes('box') || value.includes('combat')) {
    return 'bg-rose-50/95 dark:bg-rose-950/40 text-rose-950 dark:text-rose-100 border border-rose-200/90 dark:border-rose-800/60 hover:bg-rose-100/95 dark:hover:bg-rose-950/60 focus:ring-rose-400'
  }
  if (value.includes('yoga')) {
    return 'bg-violet-50/95 dark:bg-violet-950/40 text-violet-950 dark:text-violet-100 border border-violet-200/90 dark:border-violet-800/60 hover:bg-violet-100/95 dark:hover:bg-violet-950/60 focus:ring-violet-400'
  }
  if (value.includes('dance') || value.includes('zumba')) {
    return 'bg-amber-50/95 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 border border-amber-200/90 dark:border-amber-800/60 hover:bg-amber-100/95 dark:hover:bg-amber-950/60 focus:ring-amber-400'
  }
  return 'bg-teal-50/95 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 border border-teal-200/90 dark:border-teal-800/60 hover:bg-teal-100/95 dark:hover:bg-teal-950/60 focus:ring-teal-400'
}

interface CalendarGridProps {
  currentWeek: string // YYYY-MM-DD (Monday)
  schedules: CalendarSchedule[]
  ptSlots: CalendarPtSlot[]
  bookings: CalendarBooking[]
  subscriptions?: CalendarSubscription[]
  onSelectEvent: (event: CalendarEventItem) => void
  onOpenCluster?: (items: any[], dateString: string) => void
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentWeek,
  schedules,
  ptSlots,
  bookings,
  subscriptions = [],
  onSelectEvent,
  onOpenCluster,
}) => {
  const weekDays = getWeekDays(currentWeek)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { data: peakHours = [] } = useQuery({
    queryKey: ['peak-hours'],
    queryFn: () => get<PeakHourConfig[]>('/peak-hours'),
    staleTime: 60_000,
  })
  const isHourPeak = (hour: number) => {
    const mins = hour * 60
    return peakHours.some(
      (cfg) =>
        cfg.isActive &&
        mins >= cfg.startHour * 60 + (cfg.startMinute || 0) &&
        mins < cfg.endHour * 60 + (cfg.endMinute || 0),
    )
  }

  // Scroll to top on week switch (never stuck or jumping)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0
    }
  }, [currentWeek])

  const totalHours = CALENDAR_END_HOUR - CALENDAR_START_HOUR
  const hours = Array.from({ length: totalHours }, (_, i) => CALENDAR_START_HOUR + i)
  const totalGridHeight = totalHours * HOUR_HEIGHT_PX
  const currentTimeTop = getCurrentTimeTop()

  // Pre-index bookings, subscriptions, and date buckets once per data update (O(N) instead of 7 * O(N * M))
  const calendarIndexes = useMemo(() => {
    const bookingByScheduleId = new Map<string, CalendarBooking>()
    const bookingBySlotId = new Map<string, CalendarBooking>()
    const standaloneBookingsByDate = new Map<string, CalendarBooking[]>()
    const schedulesByDate = new Map<string, CalendarSchedule[]>()
    const ptSlotsByDate = new Map<string, CalendarPtSlot[]>()
    const subscriptionById = new Map<string, CalendarSubscription>()

    const scheduleIdSet = new Set<string>()
    for (const s of schedules) {
      scheduleIdSet.add(s.id)
      const dateKey = formatDateToYMD(new Date(s.startAt))
      const bucket = schedulesByDate.get(dateKey)
      if (bucket) bucket.push(s)
      else schedulesByDate.set(dateKey, [s])
    }

    const activeDisciplineIds = new Set<string>()
    let hasGroupActiveSub = false
    let hasPtActiveSub = false
    for (const sub of subscriptions) {
      subscriptionById.set(sub.id, sub)
      if (sub.status === 'ACTIVE') {
        if (sub.disciplineId) activeDisciplineIds.add(sub.disciplineId)
        if ((sub.remainingGroupSessions ?? 0) > 0) hasGroupActiveSub = true
        if ((sub.remainingPtSessions ?? 0) > 0) hasPtActiveSub = true
      }
    }

    const ptSlotIdSet = new Set<string>()
    for (const pt of ptSlots) {
      ptSlotIdSet.add(pt.id)
      if (activeDisciplineIds.size > 0 && pt.eligibleDisciplines) {
        if (pt.eligibleDisciplines.length === 0) continue
        if (!pt.eligibleDisciplines.some((dId) => activeDisciplineIds.has(dId))) continue
      }
      const dateKey = formatDateToYMD(new Date(pt.startAt))
      const bucket = ptSlotsByDate.get(dateKey)
      if (bucket) bucket.push(pt)
      else ptSlotsByDate.set(dateKey, [pt])
    }

    for (const b of bookings) {
      if (!ACTIVE_BOOKING_STATUSES.has(b.status)) continue
      if (b.scheduleId && !bookingByScheduleId.has(b.scheduleId)) {
        bookingByScheduleId.set(b.scheduleId, b)
      }
      if (b.coachAvailabilityId && !bookingBySlotId.has(b.coachAvailabilityId)) {
        bookingBySlotId.set(b.coachAvailabilityId, b)
      }
      const inSchedule = Boolean(b.scheduleId && scheduleIdSet.has(b.scheduleId))
      const inPtSlot = Boolean(b.coachAvailabilityId && ptSlotIdSet.has(b.coachAvailabilityId))
      if (!inSchedule && !inPtSlot) {
        const dateKey = formatDateToYMD(new Date(b.startAt))
        const bucket = standaloneBookingsByDate.get(dateKey)
        if (bucket) bucket.push(b)
        else standaloneBookingsByDate.set(dateKey, [b])
      }
    }

    return {
      bookingByScheduleId,
      bookingBySlotId,
      subscriptionById,
      hasGroupActiveSub,
      hasPtActiveSub,
      schedulesByDate,
      ptSlotsByDate,
      standaloneBookingsByDate,
    }
  }, [schedules, ptSlots, bookings, subscriptions])

  // Helper to check if a booking matches a schedule (O(1))
  const getBookingForSchedule = (scheduleId: string) => {
    return calendarIndexes.bookingByScheduleId.get(scheduleId)
  }

  // Helper to check if a booking matches a PT slot (O(1))
  const getBookingForPtSlot = (slotId: string) => {
    return calendarIndexes.bookingBySlotId.get(slotId)
  }

  // Helper to format time range
  const formatTimeRange = (startIso: string, endIso: string) => {
    return `${formatTimeHHmm(startIso)} - ${formatTimeHHmm(endIso)}`
  }

  // Render events for a specific day column with non-colliding cluster lanes and ultra-compact mode for 3+ overlapping events
  const renderEventsForDay = (dateString: string) => {
    const nowMs = Date.now()

    // 1. Collect group classes
    const dayScheduleItems = (calendarIndexes.schedulesByDate.get(dateString) ?? [])
      .map((schedule) => {
        const { top, height } = calculateEventPosition(schedule.startAt, schedule.endAt)
        const booking = getBookingForSchedule(schedule.id)
        const isBooked = !!booking
        const isFull = schedule.currentEnrolled >= schedule.capacity && !isBooked
        const startMs = new Date(schedule.startAt).getTime()
        const isPast = startMs <= nowMs
        const endMs = schedule.endAt ? new Date(schedule.endAt).getTime() : startMs + 3600000
        const durationMin = Math.round((endMs - startMs) / 60000)
        const isShort = durationMin <= 45 || height <= 52

        const primaryTitle = schedule.class?.name || schedule.discipline?.name || 'Lớp tập nhóm'
        const compactTitle = schedule.discipline?.name || schedule.class?.name || 'Lớp tập'
        const classSpec = getClassSpecialtyCode(schedule.class?.name || '', schedule.discipline?.code)
        const specialtyBadge = classSpec ? SPECIALTY_NAME_MAP[classSpec] || null : null
        const coachName = schedule.coach?.fullName ? `HLV: ${schedule.coach.fullName}` : 'HLV Trung tâm'
        const roomName = schedule.room?.name ? schedule.room.name.split('·')[0].trim() : ''
        const badgeText = isBooked
          ? 'Đã đặt'
          : isPast
          ? 'Đã qua'
          : isFull
          ? 'Hết chỗ'
          : `${schedule.currentEnrolled}/${schedule.capacity}`
        const dotColorClass = isBooked
          ? 'bg-emerald-500'
          : isPast
          ? 'bg-slate-400'
          : isFull
          ? 'bg-rose-500'
          : 'bg-sky-500'

        const isPeak = Boolean(isRangeInPeakHours(schedule.startAt, schedule.endAt ?? new Date(endMs), peakHours))
        const cardClass = isBooked
          ? 'bg-emerald-50/95 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 border border-emerald-300/90 dark:border-emerald-800 hover:bg-emerald-100/95 dark:hover:bg-emerald-950/60 focus:ring-emerald-400'
          : isFull
          ? 'bg-slate-50/80 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border border-slate-200/90 dark:border-slate-800 hover:bg-slate-100/90 focus:ring-slate-400'
          : isPeak
          ? 'bg-amber-50/95 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100 border border-amber-300/90 dark:border-amber-800 hover:bg-amber-100/95 focus:ring-amber-400'
          : getDisciplineCardClasses(
              schedule.discipline?.code,
              schedule.discipline?.name || schedule.class?.name,
            )

        return {
          id: schedule.id,
          keyId: `sched-${schedule.id}`,
          kind: 'SCHEDULE' as const,
          startAt: schedule.startAt,
          endAt: schedule.endAt,
          startMs,
          endMs,
          top,
          height,
          isShort,
          isPast,
          isBooked,
          isFull,
          timeRangeStr: formatTimeRange(schedule.startAt, schedule.endAt),
          primaryTitle,
          compactTitle,
          coachName,
          roomName,
          badgeText,
          specialtyBadge,
          dotColorClass,
          cardClass,
          data: schedule,
          booking,
        }
      })

    // 2. Collect visible PT slots strictly matching member's active disciplines (pre-indexed O(1))
    const { hasGroupActiveSub, hasPtActiveSub, subscriptionById } = calendarIndexes
    const visiblePtSlots = calendarIndexes.ptSlotsByDate.get(dateString) ?? []

    const dayPtSlotItems = visiblePtSlots.map((ptSlot) => {
      const { top, height } = calculateEventPosition(ptSlot.startAt, ptSlot.endAt)
      const booking = getBookingForPtSlot(ptSlot.id)
      const isBookedByMe = !!booking
      const isBookedByOther = ptSlot.isBooked && !isBookedByMe
      const startMs = new Date(ptSlot.startAt).getTime()
      const isPast = startMs <= nowMs
      const endMs = ptSlot.endAt ? new Date(ptSlot.endAt).getTime() : startMs + 3600000
      const durationMin = Math.round((endMs - startMs) / 60000)
      const isShort = durationMin <= 45 || height <= 52

      const matchingSlotSub =
        ((booking as any)?.subscriptionId ? subscriptionById.get((booking as any).subscriptionId) : undefined) ||
        (booking as any)?.subscription
      const slotPlanName =
        matchingSlotSub?.plan?.name ||
        (booking as any)?.subscription?.planName ||
        matchingSlotSub?.planName ||
        ''

      const slotDisciplineName =
        (ptSlot as any).disciplineName ||
        (booking as any)?.discipline?.name ||
        (booking as any)?.coachAvailability?.disciplineName ||
        '';

      const isYogaOrBoxingSlot = Boolean(
        slotDisciplineName.toLowerCase().includes('yoga') ||
        slotDisciplineName.toLowerCase().includes('box') ||
        slotPlanName.toLowerCase().includes('yoga') ||
        slotPlanName.toLowerCase().includes('box') ||
        (ptSlot as any).packageCategory === 'GROUP' ||
        (booking as any)?.packageCategory === 'GROUP' ||
        matchingSlotSub?.packageCategory === 'GROUP' ||
        matchingSlotSub?.plan?.packageCategory === 'GROUP'
      );

      const isMyGroupBooking = isBookedByMe && (
        isYogaOrBoxingSlot ||
        booking.bookingType === 'GROUP_CLASS' ||
        booking.type === 'GROUP_CLASS' ||
        matchingSlotSub?.plan?.packageCategory === 'GROUP' ||
        matchingSlotSub?.packageCategory === 'GROUP' ||
        matchingSlotSub?.plan?.trainingMode === 'GROUP_CLASS' ||
        matchingSlotSub?.plan?.planType === 'GROUP' ||
        (matchingSlotSub?.plan?.groupSessionQuota ?? 0) > 0 ||
        (matchingSlotSub?.remainingGroupSessions ?? 0) > 0 ||
        slotPlanName.toLowerCase().includes('nhóm') ||
        slotPlanName.toLowerCase().includes('trị liệu') ||
        slotPlanName.toLowerCase().includes('khóa học') ||
        (hasGroupActiveSub && !hasPtActiveSub)
      )

      const isGroupSlot = isYogaOrBoxingSlot || isMyGroupBooking || (hasGroupActiveSub && !hasPtActiveSub)
      const defaultSlotBadge = isGroupSlot ? 'Gói nhóm' : 'PT 1-1'

      const slotDiscipline = ptSlot.disciplineName || ptSlot.discipline?.name || (isYogaOrBoxingSlot ? 'Yoga / Boxing' : 'Gym & Fitness')
      const coachFullName = ptSlot.coach?.fullName || 'HLV'
      const coachLastName = coachFullName.split(' ').pop() || ''
      const primaryTitle = isBookedByMe
        ? (isMyGroupBooking ? (slotPlanName || `Lớp nhóm (${slotDiscipline})`) : `Buổi tập PT 1-1 (${slotDiscipline})`)
        : isGroupSlot
        ? `Lớp nhóm (${slotDiscipline})`
        : `Buổi tập PT 1-1 (${slotDiscipline})`
      const compactTitle = isGroupSlot ? `Nhóm ${slotDiscipline} · ${coachLastName}` : `PT 1-1`
      const coachName = `HLV: ${coachFullName}`
      const roomName = isGroupSlot ? 'Phòng chuyên đề' : 'Khu vực PT 1-1'
      const badgeText = isBookedByMe
        ? (isMyGroupBooking ? 'Đã đặt (Nhóm)' : 'Đã đặt')
        : isPast
        ? 'Đã qua'
        : isBookedByOther
        ? 'Đã kín'
        : defaultSlotBadge
      const dotColorClass = isBookedByMe
        ? 'bg-emerald-500'
        : isPast || isBookedByOther
        ? 'bg-slate-400'
        : isGroupSlot
        ? 'bg-sky-500'
        : 'bg-purple-500'

      const cardClass = isBookedByMe
        ? 'bg-emerald-50/95 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 border border-emerald-300/90 dark:border-emerald-800 hover:bg-emerald-100/95 dark:hover:bg-emerald-950/60 focus:ring-emerald-400'
        : isBookedByOther
        ? 'bg-slate-100/80 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 border border-slate-300/80 dark:border-slate-800 opacity-60 hover:bg-slate-200/80'
        : isGroupSlot
        ? getDisciplineCardClasses((ptSlot as any).disciplineCode, slotDiscipline)
        : 'bg-purple-50/95 dark:bg-purple-950/40 text-purple-950 dark:text-purple-100 border border-purple-200/90 dark:border-purple-800/60 hover:bg-purple-100/95 dark:hover:bg-purple-950/60 focus:ring-purple-400'

      return {
        id: ptSlot.id,
        keyId: `pt-${ptSlot.id}`,
        kind: 'PT_SLOT' as const,
        startAt: ptSlot.startAt,
        endAt: ptSlot.endAt,
        startMs,
        endMs,
        top,
        height,
        isShort,
        isPast,
        isBooked: isBookedByMe,
        isFull: false,
        timeRangeStr: formatTimeRange(ptSlot.startAt, ptSlot.endAt),
        primaryTitle,
        compactTitle,
        coachName,
        roomName,
        badgeText,
        specialtyBadge: null,
        dotColorClass,
        cardClass,
        data: ptSlot,
        booking,
      }
    })

    // 3. Collect standalone bookings (pre-indexed O(1))
    const standaloneBookings = calendarIndexes.standaloneBookingsByDate.get(dateString) ?? []

    const dayStandaloneItems = standaloneBookings.map((b) => {
      const { top, height } = calculateEventPosition(b.startAt, b.endAt)
      const startMs = new Date(b.startAt).getTime()
      const isPast = startMs <= nowMs
      const endMs = b.endAt ? new Date(b.endAt).getTime() : startMs + 3600000
      const durationMin = Math.round((endMs - startMs) / 60000)
      const isShort = durationMin <= 45 || height <= 52

      const matchingBSub =
        ((b as any)?.subscriptionId ? subscriptionById.get((b as any).subscriptionId) : undefined) ||
        (b as any)?.subscription
      const planName =
        matchingBSub?.plan?.name ||
        (b as any)?.subscription?.planName ||
        matchingBSub?.planName ||
        ''

      const coachFullName = (b as any).coachAvailability?.coach?.fullName || (b as any).coach?.fullName || (b as any).coachAvailability?.coach_name || '';
      const coachSpecName = (b as any).coachAvailability?.coach?.coachProfile?.coachSpecialties?.[0]?.specialty?.name || (b as any).coachAvailability?.specialtyName || '';
      const bDiscName = b.discipline?.name || (b as any).coachAvailability?.disciplineName || '';

      const isYogaOrBoxing = Boolean(
        bDiscName.toLowerCase().includes('yoga') ||
        bDiscName.toLowerCase().includes('box') ||
        planName.toLowerCase().includes('yoga') ||
        planName.toLowerCase().includes('box') ||
        coachSpecName.toLowerCase().includes('yoga') ||
        coachSpecName.toLowerCase().includes('box') ||
        coachFullName.toLowerCase().includes('chien') ||
        (b as any).packageCategory === 'GROUP' ||
        (b as any).coachAvailability?.packageCategory === 'GROUP' ||
        matchingBSub?.packageCategory === 'GROUP' ||
        matchingBSub?.plan?.packageCategory === 'GROUP'
      );

      const isGroupBooking =
        isYogaOrBoxing ||
        b.bookingType === 'GROUP_CLASS' ||
        b.type === 'GROUP_CLASS' ||
        (b as any).packageCategory === 'GROUP' ||
        matchingBSub?.plan?.packageCategory === 'GROUP' ||
        matchingBSub?.packageCategory === 'GROUP' ||
        matchingBSub?.plan?.trainingMode === 'GROUP_CLASS' ||
        matchingBSub?.plan?.planType === 'GROUP' ||
        (matchingBSub?.plan?.groupSessionQuota ?? 0) > 0 ||
        (matchingBSub?.remainingGroupSessions ?? 0) > 0 ||
        planName.toLowerCase().includes('nhóm') ||
        planName.toLowerCase().includes('trị liệu') ||
        planName.toLowerCase().includes('khóa học') ||
        (b.scheduleId && !b.coachAvailabilityId) ||
        (hasGroupActiveSub && !hasPtActiveSub)

      const isPtBooking = !isGroupBooking && (
        matchingBSub?.plan?.packageCategory === 'ONE_ON_ONE' ||
        matchingBSub?.packageCategory === 'ONE_ON_ONE' ||
        b.bookingType === 'PERSONAL_TRAINING' ||
        b.type === 'PERSONAL_TRAINING' ||
        Boolean(b.coachAvailabilityId)
      )

      const bDisciplineName =
        b.discipline?.name ||
        (b as any).coachAvailability?.disciplineName ||
        (b as any).coach?.coachRates?.[0]?.discipline?.name ||
        'Gym & Fitness'

      const primaryTitle = isGroupBooking
        ? (planName || b.schedule?.class?.name || (coachFullName ? `Lớp nhóm HLV ${coachFullName}` : `Lớp tập nhóm (${bDisciplineName})`))
        : isPtBooking
        ? `Buổi tập PT 1-1 (${bDisciplineName})`
        : b.schedule?.class?.name || bDisciplineName || 'Lớp tập nhóm'
      const compactTitle = isGroupBooking
        ? (planName || (coachFullName ? `Nhóm · ${coachFullName.split(' ').pop()}` : 'Lớp nhóm'))
        : isPtBooking ? 'PT 1-1' : bDisciplineName || 'Buổi tập'
      const coachName = (b as any).coachAvailability?.coach?.fullName
        ? `HLV: ${(b as any).coachAvailability.coach.fullName}`
        : b.schedule?.coach?.fullName
        ? `HLV: ${b.schedule.coach.fullName}`
        : (b as any).coach?.fullName
        ? `HLV: ${(b as any).coach.fullName}`
        : isGroupBooking
        ? 'HLV Trung tâm'
        : isPtBooking
        ? 'HLV Cá nhân'
        : 'Đã xác nhận'

      return {
        id: b.id,
        keyId: `mine-${b.id}`,
        kind: 'BOOKING_STANDALONE' as const,
        startAt: b.startAt,
        endAt: b.endAt,
        startMs,
        endMs,
        top,
        height,
        isShort,
        isPast,
        isBooked: true,
        isFull: false,
        timeRangeStr: formatTimeRange(b.startAt, b.endAt),
        primaryTitle,
        compactTitle,
        coachName,
        roomName: '',
        badgeText: 'Đã đặt',
        specialtyBadge: null,
        dotColorClass: 'bg-emerald-500',
        cardClass:
          'bg-emerald-50/95 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 border border-emerald-300/90 dark:border-emerald-800 hover:bg-emerald-100/95 dark:hover:bg-emerald-950/60 focus:ring-emerald-400',
        data: b,
        booking: b,
      }
    })

    // Combine all day items
    const allDayItems = [
      ...dayScheduleItems,
      ...dayPtSlotItems,
      ...dayStandaloneItems,
    ]

    // Sort by startMs asc, then endMs desc
    allDayItems.sort((a, b) => a.startMs - b.startMs || b.endMs - a.endMs)

    // Partition into overlapping time clusters
    type ItemType = (typeof allDayItems)[number]
    const clusters: ItemType[][] = []
    let currentCluster: ItemType[] = []
    let clusterEndMs = 0

    for (const item of allDayItems) {
      if (currentCluster.length === 0) {
        currentCluster.push(item)
        clusterEndMs = item.endMs
      } else if (item.startMs < clusterEndMs) {
        // Overlaps with current cluster
        currentCluster.push(item)
        clusterEndMs = Math.max(clusterEndMs, item.endMs)
      } else {
        clusters.push(currentCluster)
        currentCluster = [item]
        clusterEndMs = item.endMs
      }
    }
    if (currentCluster.length > 0) {
      clusters.push(currentCluster)
    }

    const events: React.ReactNode[] = []

    // Process clusters: If >= 2 concurrent sessions, render unified Cluster Card opening the big modal
    clusters.forEach((cluster) => {
      if (cluster.length >= 2) {
        const clusterTop = Math.min(...cluster.map((c) => c.top))
        const clusterBottom = Math.max(...cluster.map((c) => c.top + c.height))
        const clusterHeight = Math.max(clusterBottom - clusterTop, 50)
        const timeRangeStr = cluster[0].timeRangeStr

        const hasBooked = cluster.some((c) => c.isBooked)
        const allFull = cluster.every((c) => c.isFull)
        const allPast = cluster.every((c) => c.isPast)

        const coachNames = Array.from(
          new Set(cluster.map((c) => c.coachName.replace(/^HLV:\s*/i, ''))),
        ).filter(Boolean)

        const classTitles = Array.from(
          new Set(cluster.map((c) => c.compactTitle || c.primaryTitle)),
        ).filter(Boolean)

        const titleDisplay =
          classTitles.length === 1
            ? classTitles[0]
            : `${classTitles[0]} (+${classTitles.length - 1} môn khác)`

        const handleClusterClick = () => {
          if (onOpenCluster) {
            onOpenCluster(cluster, dateString)
          } else {
            const first = cluster[0]
            if (first.kind === 'SCHEDULE') {
              onSelectEvent({
                type: 'SCHEDULE',
                data: first.data as CalendarSchedule,
                booking: first.booking,
              })
            } else if (first.kind === 'PT_SLOT') {
              onSelectEvent({
                type: 'PT_SLOT',
                data: first.data as CalendarPtSlot,
                booking: first.booking,
              })
            } else {
              onSelectEvent({
                type: 'BOOKING_STANDALONE',
                data: first.data as CalendarBooking,
              })
            }
          }
        }

        events.push(
          <div
            key={`cluster-${cluster[0].id}-${cluster.length}`}
            title={`Khung giờ ${timeRangeStr}: có ${cluster.length} ca tập song song. Bấm để xem danh sách & chọn ca.`}
            onClick={handleClusterClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleClusterClick()
              }
            }}
            style={{
              top: `${clusterTop}px`,
              height: `${clusterHeight}px`,
              left: '4px',
              width: 'calc(100% - 8px)',
            }}
            className={cn(
              'absolute rounded-md transition-all duration-150 cursor-pointer overflow-hidden shadow-xs select-none border z-20 group hover:shadow-md hover:scale-[1.01] hover:z-30 focus:outline-none focus:ring-2 p-2 flex flex-col justify-between',
              hasBooked
                ? 'bg-emerald-50/95 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100 border-emerald-300 hover:bg-emerald-100/95 focus:ring-emerald-400'
                : allPast
                ? 'bg-slate-100/90 dark:bg-slate-900/40 text-slate-500 border-slate-200 opacity-60'
                : allFull
                ? 'bg-rose-50/90 dark:bg-rose-950/40 text-rose-950 border-rose-200'
                : 'bg-teal-50/95 dark:bg-teal-950/40 text-teal-950 dark:text-teal-100 border-teal-300 hover:bg-teal-100/95 focus:ring-teal-400',
            )}
          >
            <div>
              {/* Top row: Time + Badge count */}
              <div className="flex items-center justify-between gap-1 leading-none mb-1">
                <span className="font-extrabold tabular-nums text-[11px] tracking-tight truncate">
                  {timeRangeStr}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 shadow-2xs',
                    hasBooked ? 'bg-emerald-600 text-white' : 'bg-[#17664e] text-white',
                  )}
                >
                  <Users className="w-2.5 h-2.5" />
                  <span>{cluster.length} lớp</span>
                </span>
              </div>

              {/* Class Name */}
              <div className="font-bold text-xs leading-tight tracking-tight truncate text-slate-900 dark:text-white">
                {titleDisplay}
              </div>

              {/* Coaches preview */}
              <div className="text-[10px] font-medium opacity-85 truncate mt-0.5">
                HLV: {coachNames.join(', ')}
              </div>
            </div>

            {/* Bottom: CTA */}
            <div className="pt-1 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-[10px] font-semibold text-[#17664e] dark:text-emerald-400">
              <span className="truncate">
                {hasBooked ? '✓ Đã đặt 1 ca' : allFull ? 'Đã hết chỗ' : 'Xem & Chọn ca'}
              </span>
              <span className="text-[9.5px] opacity-80 group-hover:translate-x-0.5 transition-transform">
                ➔
              </span>
            </div>
          </div>,
        )
      } else {
        // cluster.length === 1: render normal single card
        const item = cluster[0]
        const tooltipText = [
          item.timeRangeStr,
          item.primaryTitle,
          item.coachName,
          item.roomName,
          item.badgeText ? `[${item.badgeText}]` : '',
        ]
          .filter(Boolean)
          .join(' • ')

        const handleSelect = () => {
          if (item.kind === 'SCHEDULE') {
            onSelectEvent({ type: 'SCHEDULE', data: item.data, booking: item.booking })
          } else if (item.kind === 'PT_SLOT') {
            onSelectEvent({ type: 'PT_SLOT', data: item.data, booking: item.booking })
          } else {
            onSelectEvent({ type: 'BOOKING_STANDALONE', data: item.data })
          }
        }

        events.push(
          <div
            key={item.keyId}
            title={tooltipText}
            onClick={handleSelect}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleSelect()
              }
            }}
            style={{
              top: `${item.top}px`,
              height: `${item.height}px`,
              left: '6px',
              width: 'calc(100% - 12px)',
            }}
            className={cn(
              'absolute rounded-sm transition-all duration-150 cursor-pointer overflow-hidden shadow-xs select-none group hover:shadow-md hover:scale-[1.01] hover:z-30 focus:outline-hidden focus:ring-2 z-10 border p-2',
              !item.isBooked && item.isPast && 'opacity-60 saturate-50',
              item.cardClass,
            )}
          >
            {item.isShort ? (
              <div className="flex items-center justify-between h-full gap-1">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="font-bold tabular-nums text-[11px] shrink-0">
                    {item.timeRangeStr}
                  </span>
                  <span className="font-semibold truncate text-[11.5px]">{item.primaryTitle}</span>
                </div>
                {item.isBooked ? (
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 dark:text-emerald-300 shrink-0">
                    <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600" />
                    Đã đặt
                  </span>
                ) : item.isPast ? (
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shrink-0">
                    Đã qua
                  </span>
                ) : item.isFull ? (
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    Hết chỗ
                  </span>
                ) : item.kind === 'PT_SLOT' ? (
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300 shrink-0">
                    {item.badgeText}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium shrink-0 opacity-80">
                    {item.badgeText}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-col justify-between h-full space-y-1">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold tabular-nums text-[11.5px] tracking-tight">
                      {item.timeRangeStr}
                    </span>
                    {item.isBooked ? (
                      <span className="inline-flex items-center text-[10.5px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-0.5 text-emerald-600 dark:text-emerald-400" />
                        Đã đặt
                      </span>
                    ) : item.isPast ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200/90 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                        Đã qua giờ
                      </span>
                    ) : item.isFull ? (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200/90 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        Hết chỗ
                      </span>
                    ) : item.kind === 'PT_SLOT' ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
                        {item.badgeText === 'Gói nhóm' ? (
                          <Users className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        ) : (
                          <UserCheck className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        )}
                        {item.badgeText}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-white/70 dark:bg-black/20 shadow-2xs text-slate-700 dark:text-slate-200">
                        <Users className="w-3 h-3 text-slate-500" />
                        {item.badgeText}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-[13px] leading-snug tracking-tight truncate mt-0.5">
                    {item.primaryTitle}
                  </div>
                  {item.specialtyBadge && (
                    <div className="mt-0.5">
                      <span className="inline-block px-1.5 py-0.2 rounded text-[9.5px] font-medium bg-white/70 dark:bg-black/30 text-emerald-800 dark:text-emerald-200 border border-emerald-300/60 truncate max-w-full">
                        {item.specialtyBadge}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-black/5 dark:border-white/5">
                  <span className="truncate opacity-85 font-medium">{item.coachName}</span>
                  {item.roomName && (
                    <span className="text-[10px] opacity-75 truncate max-w-[85px] ml-1">
                      {item.roomName}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>,
        )
      }
    })

    return events
  }

  return (
    <div className="flex flex-col flex-1 h-full min-h-[580px] bg-white dark:bg-[#131b26] rounded-md border border-slate-200 shadow-xs overflow-hidden font-sans">
      {/* Scrollable Container with Sticky Day Headers */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-auto relative"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="min-w-[760px] relative">
          {/* Sticky Header: GMT+7 Corner & 7 Day Columns */}
          <div className="sticky top-0 z-30 flex border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#131b26]/95 backdrop-blur-md">
            {/* GMT+7 corner */}
            <div className="w-16 shrink-0 p-2.5 flex flex-col items-center justify-center border-r border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80">
              <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                GMT+7
              </span>
              <Clock className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            </div>

            {/* 7 Days Columns Headers */}
            <div className="grid grid-cols-7 flex-1 divide-x divide-slate-200 dark:divide-slate-800">
              {weekDays.map((day) => {
                // Count available classes + PT slots for this day
                const daySchedules = schedules.filter(
                  (s) => formatDateToYMD(new Date(s.startAt)) === day.dateString,
                ).length
                const dayPtSlots = ptSlots.filter((pt) => {
                  if (formatDateToYMD(new Date(pt.startAt)) !== day.dateString) return false
                  const booking = getBookingForPtSlot(pt.id)
                  return !pt.isBooked || !!booking
                }).length
                const dayEventsCount = daySchedules + dayPtSlots

                return (
                  <div
                    key={day.dateString}
                    className={cn(
                      'py-2.5 px-2 text-center transition-colors flex flex-col items-center justify-center',
                      day.isToday
                        ? 'bg-teal-500/[0.06] dark:bg-teal-400/[0.08]'
                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30',
                    )}
                  >
                    {/* Day label: Thứ 2, Thứ 3, etc. */}
                    <span
                      className={cn(
                        'text-[11.5px] font-semibold tracking-tight',
                        day.isToday
                          ? 'text-teal-700 dark:text-teal-300 font-bold'
                          : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      {day.dayLabel}
                    </span>

                    {/* Date Number Badge */}
                    <div
                      className={cn(
                        'mt-1 w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all tabular-nums',
                        day.isToday
                          ? 'bg-teal-600 dark:bg-teal-500 text-white font-bold shadow-xs'
                          : 'text-slate-900 dark:text-slate-100 font-semibold',
                      )}
                    >
                      {day.dayNumber}
                    </div>

                    {/* Daily Session Count Text ("X buổi", "Trống") */}
                    <span
                      className={cn(
                        'mt-1 text-[11px] font-sans font-medium tracking-tight not-italic select-none',
                        dayEventsCount > 0
                          ? 'text-slate-600 dark:text-slate-300'
                          : 'text-slate-400 dark:text-slate-500',
                      )}
                    >
                      {dayEventsCount > 0 ? `${dayEventsCount} buổi` : 'Trống'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Grid Body */}
          <div className="flex relative" style={{ height: `${totalGridHeight}px` }}>
            {/* Time labels column (05:00 -> 23:00) */}
            <div className="w-16 shrink-0 relative border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 select-none">
              {hours.map((hour, idx) => {
                const hourFormatted = `${String(hour).padStart(2, '0')}:00`
                const peak = isHourPeak(hour)
                return (
                  <div
                    key={`time-${hour}`}
                    style={{
                      top: `${idx * HOUR_HEIGHT_PX}px`,
                    }}
                    className={cn(
                      'absolute w-full flex items-center justify-center gap-0.5 pr-1 pointer-events-none',
                      idx === 0 ? 'translate-y-1' : '-translate-y-1/2',
                    )}
                  >
                    {peak ? <Sun className="h-3 w-3 text-amber-600 shrink-0" /> : null}
                    <span
                      className={cn(
                        'text-[11px] font-medium tabular-nums',
                        peak
                          ? 'text-amber-800 dark:text-amber-300 font-semibold'
                          : 'text-slate-500 dark:text-slate-400',
                      )}
                    >
                      {hourFormatted}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* 7 Columns for Days */}
            <div className="grid grid-cols-7 flex-1 divide-x divide-slate-200 dark:divide-slate-800 relative">
              {weekDays.map((day) => {
                return (
                  <div
                    key={`col-${day.dateString}`}
                    className={cn(
                      'relative h-full transition-colors',
                      day.isToday && 'bg-teal-500/[0.03] dark:bg-teal-400/[0.04]',
                    )}
                  >
                    {/* Hourly Horizontal Grid Lines & 30-min auxiliary lines */}
                    {hours.map((hour, idx) => (
                      <React.Fragment key={`gridlines-${idx}`}>
                        {isHourPeak(hour) ? (
                          <div
                            style={{
                              top: `${idx * HOUR_HEIGHT_PX}px`,
                              height: `${HOUR_HEIGHT_PX}px`,
                            }}
                            className="absolute inset-x-0 bg-amber-50/55 dark:bg-amber-950/20 pointer-events-none"
                          />
                        ) : null}
                        {/* Main hourly line */}
                        <div
                          style={{ top: `${idx * HOUR_HEIGHT_PX}px` }}
                          className="absolute inset-x-0 border-t border-slate-200/70 dark:border-slate-800/80 pointer-events-none"
                        />
                        {/* 30-minute faint dashed line */}
                        <div
                          style={{ top: `${idx * HOUR_HEIGHT_PX + HOUR_HEIGHT_PX / 2}px` }}
                          className="absolute inset-x-0 border-t border-dashed border-slate-200/40 dark:border-slate-800/40 pointer-events-none"
                        />
                      </React.Fragment>
                    ))}

                    {/* Red line for current time (only on today's column) */}
                    {day.isToday && currentTimeTop !== null && (
                      <div
                        style={{ top: `${currentTimeTop}px` }}
                        className="absolute inset-x-0 border-t-2 border-rose-500 z-20 pointer-events-none flex items-center shadow-xs"
                      >
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shadow-sm shadow-rose-500/50" />
                      </div>
                    )}

                    {/* Events for this day */}
                    {renderEventsForDay(day.dateString)}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
