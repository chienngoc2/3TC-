// Shapes follow the NestJS responses on BE origin/main (Prisma rows, Decimal serialised as string).

export type StaffRole = 'COACH' | 'RECEPTIONIST'
export type PackageTier = 'TRIAL' | 'DROP_IN' | 'PLUS' | 'VIP'
export type TrainingMode = 'GROUP_CLASS' | 'PERSONAL_TRAINING' | 'HYBRID' | 'CUSTOM'
export type PlanType = 'GENERAL' | 'PERSONAL_TRAINING'
export type LockerZone = 'MALE_LOCKER' | 'FEMALE_LOCKER' | 'VIP_AREA'
export type LockerStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'FROZEN'
export type CancellationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface Discipline {
  id: string
  code: string
  name: string
  description?: string | null
}

export interface ManagerSummary {
  date: string
  dailyRevenue: number
  newMembers: number
  gateEntries: number
  pendingCancellations: number
  occupancyRate: number
}

export interface RevenueReport {
  totalRevenue: number
  baseRevenue: number
  ptRevenue: number
  byDiscipline: Record<string, number>
}

export interface KpiReport {
  coaches: Array<{
    id: string
    fullName: string
    _count: { coachedSchedules: number; coachAvailabilities: number }
    coachProfile: {
      monthlyEmergencyCancellations: number
      emergencyCancellationCount: number
    } | null
  }>
  rooms: Array<{ id: string; name: string; totalScheduledHours: number }>
}

export interface UserRow {
  id: string
  email: string
  fullName: string
  phone?: string | null
  role: 'MEMBER' | 'COACH' | 'RECEPTIONIST' | 'CENTER_MANAGER' | 'ADMIN'
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  isActive: boolean
  avatarUrl: string | null
  createdAt: string
  coachProfile?: {
    ratingStars?: number
    ratePerSession?: number | string
    workingDays?: string[]
    workingHours?: any[]
    bankName?: string | null
    bankAccountNumber?: string | null
    bankAccountName?: string | null
  } | null
}

export interface CreateStaffPayload {
  email: string
  password: string
  fullName: string
  phone?: string
  role: StaffRole
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  ratingStars?: number
  ratePerSession?: number
  specialtyIds?: string[]
  personalEmail?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  workingDays?: string[]
  workingHours?: Array<{ shift?: string; from: string; to: string }>
}

export interface CoachPayoutItem {
  coachId: string
  coachName: string
  email: string
  phone?: string
  month: string
  bankName: string | null
  bankAccountNumber: string | null
  bankAccountName: string | null
  groupSessionCount: number
  ptSessionCount: number
  totalSessions: number
  ratePerSession: number
  totalAmount: number
  status: 'UNPAID' | 'PAID'
  paidAt: string | null
  paidByName: string | null
  paymentNote: string | null
  receiptUrl?: string | null
}

export interface CoachExceptionSlot {
  id: string
  coachId: string
  startTime: string
  endTime: string
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  isException: boolean
  exceptionReason: string | null
  coach: {
    id: string
    fullName: string
    phone?: string | null
    avatarUrl: string | null
  }
}

export interface UpdateStaffPayload {
  fullName?: string
  phone?: string
  isActive?: boolean
  password?: string
  ratingStars?: number
  ratePerSession?: number
  specialtyIds?: string[]
  personalEmail?: string
  bankName?: string
  bankAccountNumber?: string
  bankAccountName?: string
  workingDays?: string[]
  workingHours?: any[]
}

export interface StaffShift {
  id: string
  staffId: string
  shiftDate: string
  startTime: string
  endTime: string
  notes: string | null
}

export interface ShiftPayload {
  staffId: string
  shiftDate: string
  startTime: string
  endTime: string
  notes?: string
}

export interface Specialty {
  id: string
  disciplineId: string
  code: string
  name: string
  description: string | null
  discipline?: Discipline
}

export interface SpecialtyPayload {
  disciplineId: string
  code: string
  name: string
  description?: string
}

export interface CoachRate {
  id: string
  coachId: string
  disciplineId: string | null
  ratePerSession: string | number
  effectiveFrom: string
  effectiveTo: string | null
  discipline?: Discipline | null
}

export interface RatePayload {
  disciplineId: string
  ratePerSession: number
  effectiveFrom: string
  effectiveTo?: string
}

export interface CoachRow {
  id: string
  fullName: string
  email?: string
  phone?: string
  avatarUrl: string | null
  coachProfile: {
    id: string
    yearsExperience: number | null
    bio?: string | null
    bankName?: string | null
    bankAccountNumber?: string | null
    bankAccountName?: string | null
    ratingStars?: number | null
    workingDays?: string[] | null
    workingHours?: any[] | null
    coachSpecialties: Array<{ specialtyId: string; specialty: Specialty }>
  } | null
  coachRates: CoachRate[]
}

export interface CancellationRequest {
  id: string
  coachId: string
  targetType: 'PERSONAL_TRAINING' | 'GROUP_CLASS'
  bookingId: string | null
  scheduleId: string | null
  substituteCoachId?: string | null
  substituteCoachName?: string | null
  substitutionStatus?: 'NONE' | 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'DECLINED' | string
  substitutionNote?: string | null
  substitutionRespondedAt?: string | null
  substitutionDeclinedReason?: string | null
  reasonMessage: string
  status: CancellationStatus
  rejectionReason: string | null
  reviewedAt: string | null
  isFrontdeskOverride: boolean
  createdAt: string
}

export interface CoachPenalty {
  id: string
  coachId: string
  cancellationRequestId: string | null
  penaltyType: string
  appliedMonth: string
  suggestedAction: string
  suggestedRateReductionPct: string | number | null
  isReviewedByManager: boolean
  managerFinalDecision: string | null
  reviewedAt: string | null
  notes: string | null
  createdAt: string
}

export interface MembershipPlan {
  id: string
  disciplineId: string | null
  name: string
  description: string | null
  price: string | number
  durationDays: number
  packageTier: PackageTier
  trainingMode: TrainingMode
  planType: PlanType
  groupSessionQuota: number | null
  ptSessionQuota: number | null
  unlimitedGymEntry: boolean | null
  weeklySchedulePreview?: {
    maxGroupCapacity?: number
    minAttendancePercent?: number
    [key: string]: any
  } | null
  roomId?: string | null
  room?: Room | null
  discipline?: Discipline | null
}

export interface PlanPayload {
  disciplineId: string
  name: string
  description?: string
  price: number
  durationDays: number
  packageTier: PackageTier
  trainingMode: TrainingMode
  planType: PlanType
  groupSessionQuota: number
  ptSessionQuota: number
  unlimitedGymEntry: boolean
  roomId?: string | null
  weeklySchedulePreview?: {
    maxGroupCapacity?: number
    minAttendancePercent?: number
    [key: string]: any
  } | null
}

export interface GymClass {
  id: string
  disciplineId: string
  name: string
  description: string | null
  discipline?: Discipline
}

export interface ClassPayload {
  disciplineId: string
  name: string
  description?: string
}

export interface Schedule {
  id: string
  isSlotBooking?: boolean
  bookingType?: string
  memberNames?: string
  classId: string
  roomId: string
  coachId: string
  startTime: string
  endTime: string
  capacity: number
  currentEnrolled: number
  status: string
  class?: GymClass
  room?: Room
  coach?: { id: string; fullName: string; coachProfile?: { ratingStars?: number } | null }
  minRequired?: number
  isManagerOverride?: boolean
  isAutoCancelled?: boolean
  overrideNote?: string
}

export interface SchedulePayload {
  classId: string
  roomId: string
  coachId: string
  startTime: string
  endTime: string
  capacity: number
}

export interface Room {
  id: string
  name: string
  capacity: number
  locationNote: string | null
  isActive: boolean
  disciplineId?: string | null
  discipline?: Discipline | null
  plans?: { id: string; name: string; packageTier?: PackageTier }[]
}

export interface RoomPayload {
  name: string
  capacity: number
  locationNote?: string
  disciplineId?: string
}

export interface Equipment {
  id: string
  roomId: string
  name: string
  equipmentType: string
  isActive: boolean
}

export interface EquipmentPayload {
  roomId: string
  name: string
  equipmentType: string
}

export interface CurrentLockerAssignment {
  id: string
  userId: string
  assignedAt: string
  notes?: string | null
  user: {
    id: string
    fullName: string
    phone?: string | null
    email: string
    avatarUrl: string | null
  }
}

export interface Locker {
  id: string
  lockerNumber: string
  zone: string
  status: LockerStatus
  isActive: boolean
  currentAssignment?: CurrentLockerAssignment | null
}

export interface MemberDetail extends UserRow {
  memberProfile?: {
    fitnessGoals?: string | null
    medicalHistory?: string | null
    heightCm?: string | number | null
  } | null
}

export interface MemberSubscription {
  id: string
  packageTier: PackageTier
  startDate: string
  endDate: string
  status: SubscriptionStatus
  remainingGroupSessions: number | null
  remainingPtSessions: number | null
  frozenAt: string | null
  plan?: { id: string; name: string } | null
  assignedCoach?: { id: string; fullName: string } | null
}

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD'
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'ATTENDED'

export interface DisciplinePayload {
  code: string
  name: string
  description?: string
}

export interface CoachSlot {
  id: string
  coachId: string
  startTime: string
  endTime: string
  isBooked: boolean
}

export interface CreateMemberPayload {
  email: string
  password: string
  fullName: string
  phone?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
}

export interface MemberProfilePayload {
  fullName?: string
  phone?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  fitnessGoals?: string
  medicalHistory?: string
  heightCm?: number
}

export interface InbodyLog {
  id: string
  userId: string
  measuredById: string | null
  heightCm: string | number
  weightKg: string | number
  muscleMassKg: string | number | null
  bodyFatPct: string | number | null
  bmi: string | number | null
  visceralFatLevel: number | null
  notes: string | null
  measuredAt: string
}

export interface InbodyPayload {
  userId: string
  heightCm: number
  weightKg: number
  muscleMassKg?: number
  bodyFatPct?: number
  bmi?: number
  visceralFatLevel?: number
  notes?: string
}

export interface ExerciseKnowledge {
  id: string
  title: string
  category: string
  instructions: string
}

export interface TemplateExercise {
  id: string
  sets: number | null
  reps: number | null
  unit: string | null
  weightKg: string | number | null
  restSeconds: number | null
  orderIndex: number
  exercise?: ExerciseKnowledge
}

export interface WorkoutTemplate {
  id: string
  templateCode: string
  disciplineCode: string
  title: string
  weekNumber: number
  sessionOrder: number
  description: string | null
  exercises: TemplateExercise[]
}

export interface WorkoutPlan {
  id: string
  memberId: string
  coachId: string
  bookingId: string | null
  templateId: string | null
  sessionOrder: number | null
  title: string
  notes: string | null
  createdAt: string
  exercises: TemplateExercise[]
}

export interface Booking {
  id: string
  subscriptionId: string
  bookingType: 'GROUP_CLASS' | 'PERSONAL_TRAINING'
  disciplineId: string | null
  scheduleId: string | null
  coachAvailabilityId: string | null
  memberId: string
  status: BookingStatus
  bookedAt: string
  cancelledAt: string | null
  isLateCancellation: boolean | null
  cancellationReason: string | null
  schedule?: (Schedule & { class?: GymClass }) | null
  coachAvailability?: CoachSlot | null
  attendance?: { id: string; status: string; checkInTime: string } | null
}

export interface Invoice {
  id: string
  invoiceCode: string
  subscriptionId: string
  amount: string | number
  baseAmount: string | number | null
  ptAmount: string | number | null
  paymentMethod: string
  status: string
  type: 'SUBSCRIPTION_NEW' | 'PT_ADDON' | 'DROP_IN' | string
  transactionRef: string | null
  createdAt: string
  subscription?: { userId: string; planId: string } | null
}

export interface SalePayload {
  memberId: string
  planId: string
  coachId?: string
  paymentMethod: PaymentMethod
  transactionRef?: string
}

export interface Attendance {
  id: string
  bookingId: string | null
  memberId: string
  checkInTime: string
  status: string
  checkinType: string
  towelIssued: boolean | null
  notes: string | null
}

export interface GateCheckinResult {
  attendanceId: string
  assignedLocker: string | null
  towelIssued: boolean | null
  checkinTime: string
  repeated?: boolean
  lockerAssignment?: { id: string; locker: { lockerNumber: string } } | null
}
