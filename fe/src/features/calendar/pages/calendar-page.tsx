import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import type { CalendarResponseData, Discipline } from '../types/calendar.types'
import {
  getCalendarApi,
  bookGroupClassApi,
  bookPtSessionApi,
  cancelBookingApi,
  getDisciplinesApi,
} from '../services/calendar-api.service'
import { getMondayOfWeek, shiftWeek } from '../utils/calendar-date.utils'
import { CalendarHeader } from '../components/calendar-header'
import { CalendarGrid } from '../components/calendar-grid'
import type { CalendarEventItem } from '../components/calendar-grid'
import { BookingModal } from '../components/booking-modal'
import { ClusterSessionsModal, type ClusterSessionItem } from '../components/cluster-sessions-modal'
import { AlertCircle, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { getClassSpecialtyCode, getPlanSpecialtyCode, SPECIALTY_NAME_MAP } from '@/lib/topic-matcher'
import { useSyncListener, notifyDataChanged } from '@/lib/sync-channel'
import { useNotification } from '@/context/notification-context'

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = error.response
    if (typeof response === 'object' && response !== null && 'data' in response) {
      const data = response.data
      if (typeof data === 'object' && data !== null && 'message' in data) {
        const message = data.message
        return Array.isArray(message) ? message.join(', ') : String(message)
      }
    }
  }
  return error instanceof Error ? error.message : fallback
}

export const CalendarPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { notifications, markAsRead } = useNotification()

  // URL Query Parameters
  const weekParam = searchParams.get('week')
  const disciplineParam = searchParams.get('disciplineId') || 'all'
  const slotIdParam = searchParams.get('slotId')

  // State
  const [currentWeek, setCurrentWeek] = useState<string>(() => {
    return weekParam ? getMondayOfWeek(weekParam) : getMondayOfWeek()
  })
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>(disciplineParam)

  const [calendarData, setCalendarData] = useState<CalendarResponseData | null>(null)
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Selected event for booking/cancel modal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null)

  // Selected cluster for multiple overlapping sessions modal
  const [selectedCluster, setSelectedCluster] = useState<ClusterSessionItem[] | null>(null)
  const [clusterDateString, setClusterDateString] = useState<string>('')

  // Toast feedback
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
  } | null>(null)

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToast({ type, message })
    setTimeout(() => {
      setToast(null)
    }, 4500)
  }

  // Sync state with URL params
  const updateUrlParams = useCallback(
    (week: string, disciplineId: string) => {
      const params = new URLSearchParams()
      params.set('week', week)
      if (disciplineId !== 'all') {
        params.set('disciplineId', disciplineId)
      }
      setSearchParams(params)
    },
    [setSearchParams],
  )

  // Load disciplines once
  useEffect(() => {
    let isMounted = true
    getDisciplinesApi()
      .then((data) => {
        if (isMounted) setDisciplines(data || [])
      })
      .catch((err) => {
        console.warn('Could not load disciplines list', err)
      })
    return () => {
      isMounted = false
    }
  }, [])

  const weekCacheRef = useRef<Map<string, CalendarResponseData>>(new Map())
  const requestSeqRef = useRef<number>(0)

  // Fetch calendar whenever currentWeek or selectedDisciplineId changes
  // Uses instant in-memory cache + silent background revalidation + adjacent week prefetch
  const loadCalendar = useCallback(async (silent = false) => {
    const reqId = ++requestSeqRef.current
    const cacheKey = `${currentWeek}:${selectedDisciplineId}`
    const cached = weekCacheRef.current.get(cacheKey)

    if (cached && !silent) {
      setCalendarData(cached)
      setIsLoading(false)
    } else if (!silent && !cached) {
      setIsLoading(true)
    }
    setFetchError(null)

    try {
      const data = await getCalendarApi({
        week: currentWeek,
        view: 'all',
        disciplineId: selectedDisciplineId,
      })
      weekCacheRef.current.set(cacheKey, data)
      if (reqId === requestSeqRef.current) {
        setCalendarData(data)
      }

      // Prefetch next & previous weeks in background for instant week switching
      const nextWeek = shiftWeek(currentWeek, 1)
      const prevWeek = shiftWeek(currentWeek, -1)
      for (const adjWeek of [nextWeek, prevWeek]) {
        const adjKey = `${adjWeek}:${selectedDisciplineId}`
        if (!weekCacheRef.current.has(adjKey)) {
          void getCalendarApi({
            week: adjWeek,
            view: 'all',
            disciplineId: selectedDisciplineId,
          })
            .then((adjData) => {
              weekCacheRef.current.set(adjKey, adjData)
            })
            .catch(() => {})
        }
      }
    } catch (err: unknown) {
      console.error('Calendar fetch error:', err)
      if (reqId === requestSeqRef.current && !cached) {
        setFetchError(getErrorMessage(err, 'Không thể tải lịch tuần. Vui lòng thử lại sau.'))
      }
    } finally {
      if (reqId === requestSeqRef.current) {
        setIsLoading(false)
      }
    }
  }, [currentWeek, selectedDisciplineId])

  useEffect(() => {
    const requestId = window.setTimeout(() => {
      void loadCalendar(false)
    }, 0)
    return () => window.clearTimeout(requestId)
  }, [loadCalendar])

  // Instant sync when coach opens a slot, member books, or package is purchased
  useSyncListener(() => {
    weekCacheRef.current.clear()
    void loadCalendar(true)
  })

  // Visibility-based silent auto-refresh polling every 15 seconds (never flashes loading)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadCalendar(true)
      }
    }, 15000)
    return () => clearInterval(timer)
  }, [loadCalendar])

  // Auto-open modal if slotId is provided in URL params (e.g. redirected from Coaches screen)
  useEffect(() => {
    if (!slotIdParam || !calendarData?.ptSlots) return
    const foundSlot = calendarData.ptSlots.find((s) => s.id === slotIdParam)
    if (foundSlot) {
      const booking = calendarData.bookings?.find(
        (b) =>
          b.coachAvailabilityId === foundSlot.id &&
          ['CONFIRMED', 'PENDING'].includes(b.status),
      )
      setSelectedEvent({ type: 'PT_SLOT', data: foundSlot, booking })
    }
  }, [slotIdParam, calendarData])

  // Handlers for Header Navigation & Filters
  const handleWeekChange = (direction: 'prev' | 'next') => {
    const offset = direction === 'next' ? 1 : -1
    const newWeek = shiftWeek(currentWeek, offset)
    setCurrentWeek(newWeek)
    updateUrlParams(newWeek, selectedDisciplineId)
  }

  const handleGoToCurrentWeek = () => {
    const thisMonday = getMondayOfWeek()
    setCurrentWeek(thisMonday)
    updateUrlParams(thisMonday, selectedDisciplineId)
  }

  const handleSelectWeek = (newWeekMonday: string) => {
    setCurrentWeek(newWeekMonday)
    updateUrlParams(newWeekMonday, selectedDisciplineId)
  }

  const handleDisciplineChange = (discId: string) => {
    setSelectedDisciplineId(discId)
    updateUrlParams(currentWeek, discId)
  }

  // Booking actions
  const handleBookGroupClass = async (scheduleId: string) => {
    try {
      await bookGroupClassApi({ scheduleId })
      showToast('success', 'Đặt lịch lớp học nhóm thành công!')
      notifyDataChanged('BOOKING_UPDATED')
      weekCacheRef.current.clear()
      void loadCalendar(true)
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Không thể đặt lớp. Vui lòng thử lại sau.')
      showToast('error', msg)
      void loadCalendar(true)
      throw err
    }
  }

  const handleBookPtSession = async (coachAvailabilityId: string, disciplineId: string) => {
    try {
      await bookPtSessionApi({ coachAvailabilityId, disciplineId })
      showToast('success', 'Đặt lịch tập thành công!')
      notifyDataChanged('BOOKING_UPDATED')
      weekCacheRef.current.clear()
      void loadCalendar(true)
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Không thể đặt ca tập. Vui lòng thử lại sau.')
      showToast('error', msg)
      void loadCalendar(true)
      throw err
    }
  }

  const handleCancelBooking = async (bookingId: string, reason?: string) => {
    const res = await cancelBookingApi(bookingId, { reason })
    if (res.refunded) {
      showToast(
        'success',
        'Hủy lịch thành công! Buổi tập đã được hoàn lại 01 lượt vào gói tập của bạn.',
      )
    } else {
      showToast(
        'info',
        'Hủy lịch thành công! (Hủy muộn dưới 2 tiếng: lượt tập không được hoàn theo quy định trung tâm).',
      )
    }
    notifyDataChanged('BOOKING_CANCELLED')
    weekCacheRef.current.clear()
    await loadCalendar(true)
  }

  // Filter mode: When member has active group packages, filter classes matching package specialty & stars
  const [filterMyPackagesOnly, setFilterMyPackagesOnly] = useState<boolean>(true)

  // Active group subscriptions with remaining quota
  const activeGroupSubs = useMemo(() => {
    return (calendarData?.subscriptions || []).filter(
      (s) => s.status === 'ACTIVE' && (s.remainingGroupSessions ?? 0) > 0,
    )
  }, [calendarData?.subscriptions])

  // Extract unique active specialty names for UI badge
  const activeSpecialtyNames = useMemo(() => {
    const names = new Set<string>()
    for (const sub of activeGroupSubs) {
      const spec = getPlanSpecialtyCode(sub.planName, sub.discipline?.code)
      if (spec && SPECIALTY_NAME_MAP[spec]) {
        names.add(SPECIALTY_NAME_MAP[spec])
      }
    }
    return Array.from(names)
  }, [activeGroupSubs])

  // Filter group schedules according to the member's active star rating and specialty for each discipline
  // (e.g. Members with Yoga Trị Liệu only see Yoga Trị Liệu classes when filter is active)
  const filteredSchedules = useMemo(() => {
    if (!calendarData?.schedules) return []
    if (activeGroupSubs.length === 0 || !filterMyPackagesOnly) {
      return calendarData.schedules
    }

    const starMap = new Map<string, Set<number>>()
    const specMap = new Map<string, Set<string>>()

    for (const sub of activeGroupSubs) {
      if (sub.coachRatingStars) {
        if (!starMap.has(sub.disciplineId)) {
          starMap.set(sub.disciplineId, new Set<number>())
        }
        starMap.get(sub.disciplineId)!.add(sub.coachRatingStars)
      }
      const spec = getPlanSpecialtyCode(sub.planName, sub.discipline?.code)
      if (spec) {
        if (!specMap.has(sub.disciplineId)) {
          specMap.set(sub.disciplineId, new Set<string>())
        }
        specMap.get(sub.disciplineId)!.add(spec)
      }
    }

    return calendarData.schedules.filter((schedule) => {
      const discId = schedule.disciplineId || schedule.class?.disciplineId || ''
      const allowedStars = starMap.get(discId)
      if (allowedStars) {
        const coachStars =
          schedule.coach?.coachProfile?.ratingStars || schedule.coach?.ratingStars || 2
        if (!allowedStars.has(coachStars)) return false
      }

      const allowedSpecs = specMap.get(discId)
      if (allowedSpecs && allowedSpecs.size > 0) {
        const classSpec = getClassSpecialtyCode(
          schedule.class?.name || '',
          schedule.class?.discipline?.code || schedule.discipline?.code,
        )
        if (classSpec && !allowedSpecs.has(classSpec)) return false
      }

      return true
    })
  }, [calendarData?.schedules, activeGroupSubs, filterMyPackagesOnly])

  // Filter PT & Group coach slots: match ANY active subscription with remaining quota
  // (assigned coach for PT 1-1 OR discipline + star tier for unassigned Group/PT packages)
  const filteredPtSlots = useMemo(() => {
    if (!calendarData?.ptSlots) return []

    const activeSubsWithQuota = (calendarData?.subscriptions || []).filter(
      (s) =>
        s.status === 'ACTIVE' &&
        ((s.remainingGroupSessions ?? 0) > 0 || (s.remainingPtSessions ?? 0) > 0),
    )
    if (activeSubsWithQuota.length === 0) return []

    return calendarData.ptSlots.filter((slot) => {
      const slotCoachId = (slot as any).coachId || slot.coach?.id
      const eligible = slot.eligibleDisciplines || []
      const coachStars =
        slot.coach?.coachProfile?.ratingStars || slot.coach?.ratingStars || 2

      return activeSubsWithQuota.some((sub) => {
        if (sub.assignedCoach?.id) {
          if (sub.assignedCoach.id !== slotCoachId) return false
          return eligible.length === 0 || !sub.disciplineId || eligible.includes(sub.disciplineId)
        }
        if (sub.disciplineId && eligible.length > 0 && !eligible.includes(sub.disciplineId)) {
          return false
        }
        if (sub.coachRatingStars && sub.coachRatingStars !== coachStars) {
          return false
        }
        return true
      })
    })
  }, [calendarData?.ptSlots, calendarData?.subscriptions])

  return (
    <div className="min-h-screen rounded-none bg-slate-100 flex flex-col font-sans">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-none shadow-xl border-2 flex items-center gap-3 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-100 border-emerald-500'
                : toast.type === 'error'
                  ? 'bg-rose-950 text-rose-100 border-rose-500'
                  : 'bg-slate-950 text-slate-100 border-slate-900'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <CalendarHeader
        currentWeek={currentWeek}
        onWeekChange={handleWeekChange}
        onGoToCurrentWeek={handleGoToCurrentWeek}
        onSelectWeek={handleSelectWeek}
        selectedDisciplineId={selectedDisciplineId}
        onDisciplineChange={handleDisciplineChange}
        disciplines={disciplines}
        subscriptions={calendarData?.subscriptions || []}
        isLoading={isLoading}
        filterMyPackagesOnly={filterMyPackagesOnly}
        onToggleFilterMyPackagesOnly={() => setFilterMyPackagesOnly((p) => !p)}
        hasActiveGroupSubs={activeGroupSubs.length > 0}
        activeSpecialtyNames={activeSpecialtyNames}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col max-w-7xl w-full mx-auto p-2 sm:p-4">
        {fetchError ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white rounded-md border border-slate-200 shadow-xs">
            <AlertCircle className="h-10 w-10 text-rose-500 mb-3" />
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Không thể tải dữ liệu thời khóa biểu
            </h3>
            <p className="text-xs text-slate-500 max-w-md text-center mb-4">{fetchError}</p>
            <button
              type="button"
              onClick={() => loadCalendar()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-[#17664e] text-white text-xs font-bold hover:bg-[#135641] transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Thử lại
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-[600px]">
            <CalendarGrid
              currentWeek={currentWeek}
              schedules={filteredSchedules}
              ptSlots={filteredPtSlots}
              bookings={calendarData?.bookings || []}
              subscriptions={calendarData?.subscriptions || []}
              onSelectEvent={(event) => setSelectedEvent(event)}
              onOpenCluster={(items, dateStr) => {
                setSelectedCluster(items)
                setClusterDateString(dateStr)
              }}
            />
          </div>
        )}
      </main>

      {/* Multiple Concurrent Sessions Picker Modal */}
      {selectedCluster && (
        <ClusterSessionsModal
          isOpen={!!selectedCluster}
          onClose={() => setSelectedCluster(null)}
          items={selectedCluster}
          dateString={clusterDateString}
          onSelectSession={(event) => {
            setSelectedEvent(event)
          }}
        />
      )}

      {/* Booking & Cancellation Modal */}
      {selectedEvent && (
        <BookingModal
          event={selectedEvent}
          onClose={() => {
            setSelectedEvent(null)
            setSelectedCluster(null)
          }}
          onBookGroup={handleBookGroupClass}
          onBookPt={handleBookPtSession}
          onCancelBooking={handleCancelBooking}
          subscriptions={calendarData?.subscriptions || []}
          disciplines={disciplines}
          days={calendarData?.days || []}
          bookings={calendarData?.bookings || []}
          onSelectEvent={(event) => setSelectedEvent(event)}
          onBackToCluster={selectedCluster ? () => setSelectedEvent(null) : undefined}
          clusterCount={selectedCluster?.length}
        />
      )}
    </div>
  )
}
