export type CalendarViewMode = 'all' | 'group' | 'pt' | 'mine'

export interface Discipline {
  id: string
  code: string
  name: string
  description?: string
}

export interface CalendarRoom {
  id: string
  name: string
  capacity?: number
  locationNote?: string
}

export interface CalendarCoach {
  id: string
  fullName: string
  avatarUrl?: string | null
  phone?: string
  ratingStars?: number
  coachProfile?: {
    ratingStars?: number
    yearsExperience?: number
    specialties?: string
  }
}

export interface CalendarSchedule {
  id: string
  startAt: string
  endAt: string
  type: 'GROUP_CLASS'
  disciplineId: string
  capacity: number
  currentEnrolled: number
  class?: {
    id: string
    name: string
    description?: string
    disciplineId?: string
    discipline?: Discipline
  }
  room?: CalendarRoom
  coach?: CalendarCoach
  discipline?: Discipline
}

export interface CalendarPtSlot {
  id: string
  startAt: string
  endAt: string
  type: 'PERSONAL_TRAINING' | 'GROUP_CLASS'
  packageCategory?: 'GROUP' | 'ONE_ON_ONE' | string
  eligibleDisciplines: string[]
  coach?: CalendarCoach
  discipline?: Discipline
  disciplineName?: string | null
  disciplineCode?: string | null
  specialtyName?: string | null
  coachRatingStars?: number
  isBooked?: boolean
}

export type BookingStatus = 'CONFIRMED' | 'CANCELLED' | 'ATTENDED' | 'PENDING' | 'ABSENT'

export interface CalendarBooking {
  id: string
  status: BookingStatus
  startAt: string
  endAt: string
  scheduleId?: string | null
  coachAvailabilityId?: string | null
  type?: 'GROUP_CLASS' | 'PERSONAL_TRAINING'
  bookingType?: 'GROUP_CLASS' | 'PERSONAL_TRAINING'
  disciplineId?: string
  isLateCancellation?: boolean
  createdAt?: string
  discipline?: Discipline
  coach?: CalendarCoach
  schedule?: CalendarSchedule
  room?: CalendarRoom
}

export interface CalendarSubscription {
  id: string
  disciplineId: string
  planName: string
  packageTier?: string
  coachRatingStars?: number
  assignedCoach?: CalendarCoach | null
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'FROZEN' | 'EXPIRED'
  remainingGroupSessions: number
  remainingPtSessions: number
  discipline?: Discipline
}

export interface DayEligibilityItem {
  subscriptionId: string
  disciplineId: string
  group: {
    allowed: boolean
    reason: string | null
  }
  pt: {
    allowed: boolean
    reason: string | null
  }
}

export interface CalendarDay {
  date: string // YYYY-MM-DD
  eligibility: DayEligibilityItem[]
}

export interface CalendarResponseData {
  weekStart: string // YYYY-MM-DD (Monday)
  weekEndExclusive: string // YYYY-MM-DD
  timezone: string // "Asia/Ho_Chi_Minh"
  schedules: CalendarSchedule[]
  ptSlots: CalendarPtSlot[]
  bookings: CalendarBooking[]
  subscriptions: CalendarSubscription[]
  days: CalendarDay[]
}

export interface GroupBookingPayload {
  scheduleId: string
}

export interface PtBookingPayload {
  coachAvailabilityId: string
  disciplineId: string
  equipmentId?: string
}

export interface CancelBookingPayload {
  reason?: string
}

export interface CancelBookingResponse {
  id: string
  bookingId: string
  status: string
  refunded: boolean
}
