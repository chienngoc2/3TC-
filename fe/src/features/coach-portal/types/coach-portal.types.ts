import type { InbodyPayload } from '@/lib/inbody-entry';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'ATTENDED';

export interface StudentBookingItem {
  id: string;
  bookingType: 'GROUP_CLASS' | 'PERSONAL_TRAINING';
  status: 'CONFIRMED' | 'PENDING' | 'ATTENDED' | 'CANCELLED';
  bookedAt: string;
  memberId?: string;
  member?: {
    id: string;
    fullName: string;
    phone?: string;
    avatarUrl?: string | null;
    memberProfile?: {
      fitnessGoals?: string | null;
      medicalHistory?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
      bmi?: number | null;
      bodyFatPct?: number | null;
    } | null;
  } | null;
  attendance?: {
    id: string;
    status: AttendanceStatus;
    checkInTime?: string;
    notes?: string | null;
  } | null;
}

export interface ScheduleClassItem {
  id: string;
  disciplineId?: string;
  class?: {
    id: string;
    name: string;
    description?: string;
    durationMinutes: number;
    capacity: number;
  };
  room?: {
    id: string;
    name: string;
    roomNumber: string;
    capacity: number;
  };
  startTime: string;
  endTime: string;
  status?: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED';
  currentEnrolled?: number;
  bookings?: StudentBookingItem[];
}

export interface PtSessionItem {
  id: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isEmergencyCancelled?: boolean;
  bookings?: StudentBookingItem[];
}

export interface UnifiedCoachSession {
  id: string;
  type: 'GROUP_CLASS' | 'PERSONAL_TRAINING';
  scheduleId?: string | null;
  coachAvailabilityId?: string | null;
  title: string;
  disciplineId?: string | null;
  disciplineName?: string | null;
  roomName?: string | null;
  startTime: string;
  endTime: string;
  status: 'OPEN' | 'FULL' | 'CONFIRMED' | 'PENDING' | 'ATTENDED' | 'CANCELLED' | 'COMPLETED';
  currentEnrolled?: number;
  capacity?: number;
  bookings: StudentBookingItem[];
  isEmergencyCancelled?: boolean;
  isBooked?: boolean;
}

export interface TodayScheduleData {
  classes: ScheduleClassItem[];
  pt: PtSessionItem[];
}

export interface CoachAvailabilitySlot {
  id: string;
  coachId: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isEmergencyCancelled: boolean;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  isException?: boolean;
  exceptionReason?: string | null;
  notes?: string | null;
}

export interface CreateSlotPayload {
  startTime: string;
  endTime: string;
  exceptionReason?: string;
  notes?: string;
  workoutPlanId?: string;
}

export interface PickupScheduleItem {
  id: string;
  startTime: string;
  endTime: string;
  capacity: number;
  currentEnrolled: number;
  status: string;
  class: {
    id: string;
    name: string;
    discipline?: { id: string; name: string };
  };
  room?: { id: string; name: string };
  coach?: { id: string; fullName: string; phone?: string };
  cancellationRequests?: Array<{
    id: string;
    reasonMessage: string;
    substituteCoachId?: string | null;
  }>;
}

export interface SubstitutionRequestItem {
  id: string;
  coachId: string;
  scheduleId?: string | null;
  bookingId?: string | null;
  targetType: string;
  reasonMessage: string;
  internalNote?: string | null;
  status: string;
  substitutionStatus: 'PENDING_ACCEPTANCE' | 'ACCEPTED' | 'DECLINED' | string;
  substituteCoachId?: string | null;
  substituteCoachName?: string | null;
  createdAt: string;
  coach?: {
    id: string;
    fullName: string;
    phone?: string;
  };
  reviewedBy?: {
    id: string;
    fullName: string;
  };
  schedule?: {
    id: string;
    startTime: string;
    endTime: string;
    capacity: number;
    currentEnrolled: number;
    status: string;
    class?: {
      id: string;
      name: string;
      discipline?: { id: string; name: string };
    };
    room?: { id: string; name: string };
  };
  booking?: {
    id: string;
    bookingType: string;
    status: string;
    discipline?: { id: string; code?: string; name: string } | null;
    member?: { id: string; fullName: string } | null;
    coachAvailability?: {
      id: string;
      startTime: string;
      endTime: string;
    } | null;
  } | null;
}

export interface ClassAttendancePayload {
  bookingId: string;
  status: AttendanceStatus;
  notes?: string;
}

export interface UpdateAttendancePayload {
  status: AttendanceStatus;
  notes?: string;
}

export interface CancellationRequestPayload {
  scheduleId?: string;
  bookingId?: string;
  reasonMessage: string;
  internalNote?: string;
}

export interface CancellationRequestItem {
  id: string;
  coachId: string;
  scheduleId?: string | null;
  bookingId?: string | null;
  targetType: 'PERSONAL_TRAINING' | 'GROUP_CLASS';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reasonMessage: string;
  internalNote?: string | null;
  isFrontdeskOverride?: boolean;
  reviewedByUserId?: string | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CoachPenaltyItem {
  id: string;
  coachId: string;
  month: string;
  cancellationCount: number;
  suggestedAction: 'NONE' | 'WARNING' | 'SUGGEST_RATE_REDUCTION_15PCT' | 'TEMP_SUSPEND';
  appliedAction?: string | null;
  isReviewed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InbodyLogItem {
  id: string;
  userId: string;
  measuredAt: string;
  heightCm?: number | string | null;
  weightKg: number | string;
  muscleMassKg?: number | string | null;
  skeletalMuscleMassKg?: number | string | null;
  bodyFatPct?: number | string | null;
  bodyFatMassKg?: number | string | null;
  visceralFatLevel?: number | null;
  inbodyScore?: number | null;
  segmentalLean?: Record<string, number | string | null> | null;
  notes?: string | null;
}

export interface AssignedMemberItem {
  id: string;
  disciplineId: string;
  endDate: string;
  remainingGroupSessions: number;
  remainingPtSessions: number;
  user: {
    id: string;
    fullName: string;
    phone?: string;
    email: string;
    avatarUrl?: string | null;
    memberProfile?: {
      fitnessGoals?: string | null;
      medicalHistory?: string | null;
      heightCm?: number | null;
      weightKg?: number | null;
      bmi?: number | null;
      bodyFatPct?: number | null;
    } | null;
    memberInbodyLogs: InbodyLogItem[];
  };
}

export type InbodyLogPayload = InbodyPayload & { userId: string };

/** `GET /workout-plans/recommendations/:memberId` (InBody-based workout assistant). */
export interface WorkoutRecommendation {
  memberId: string;
  memberName?: string;
  hasInbodyData: boolean;
  lastMeasuredAt?: string;
  bodyShape: 'TYPE_C' | 'TYPE_I' | 'TYPE_D' | 'UNKNOWN';
  bodyShapeDescription?: string;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  skeletalMuscleMassKg?: number | null;
  visceralFatLevel?: number | null;
  primaryGoal: string;
  primaryGoalTitle?: string;
  hasSignificantImbalance: boolean;
  imbalances: Array<{
    zone: 'ARMS' | 'LEGS';
    leftValue: number;
    rightValue: number;
    imbalancePct: number;
    weakerSide: 'LEFT' | 'RIGHT' | 'BALANCED';
    severity: 'BALANCED' | 'MILD' | 'SIGNIFICANT';
  }>;
  suggestedTemplate?: {
    id: string;
    title: string;
    disciplineCode?: string;
    description?: string | null;
    exerciseCount: number;
  } | null;
  recommendedExercises: Array<{
    exerciseId: string;
    exerciseName: string;
    category?: string;
    sets: number;
    reps: number;
    unilateral: boolean;
    targetZone?: 'ARMS' | 'LEGS';
    targetSide?: string;
    notes?: string;
  }>;
  cardioPrescription?: {
    targetZone: string;
    durationMinutes: number;
    frequencyPerWeek?: number;
    reason: string;
  } | null;
  nutritionAdvice?: {
    estimatedTdeeKcal: number;
    targetDailyCalories: number;
    proteinTargetGrams: number;
    guideline: string;
  } | null;
}

export interface ExerciseKnowledgeItem {
  id: string;
  title: string;
  category: string;
  instructions: string;
}

export interface WorkoutExerciseDto {
  exerciseId: string;
  sets?: number;
  reps?: number;
  weightKg?: number;
  restSeconds?: number;
  coachFeedback?: string;
}

export interface WorkoutTemplateExercise {
  id: string;
  exerciseId: string;
  sets?: number;
  reps?: number;
  unit?: string;
  weightKg?: number | null;
  restSeconds?: number;
  orderIndex: number;
  exercise: {
    title: string;
    category: string;
    instructions?: string;
  };
}

export interface WorkoutTemplateItem {
  id: string;
  templateCode: string;
  disciplineCode: string;
  title: string;
  weekNumber: number;
  sessionOrder: number;
  description?: string;
  exercises: WorkoutTemplateExercise[];
}

export interface BookingWorkoutExercise {
  id: string;
  exerciseId: string;
  sets?: number;
  reps?: number;
  weightKg?: number | null;
  restSeconds?: number;
  coachFeedback?: string | null;
  orderIndex: number;
  exercise?: {
    id?: string;
    title: string;
    category: string;
    instructions?: string;
  };
}

export interface BookingWorkoutPlan {
  id: string;
  bookingId: string;
  sessionOrder?: number;
  title: string;
  notes?: string | null;
  exercises: BookingWorkoutExercise[];
}

export interface UpdateSessionWorkoutPlanPayload {
  title?: string;
  notes?: string;
  exercises: Array<{
    exerciseId: string;
    sets?: number;
    reps?: number;
    weightKg?: number | null;
    restSeconds?: number;
    coachFeedback?: string;
  }>;
}

export interface WorkoutExerciseItem extends WorkoutExerciseDto {
  id: string;
  orderIndex: number;
  exercise?: {
    id: string;
    title: string;
    category: string;
  };
}

export interface WorkoutPlanItem {
  id: string;
  memberId?: string | null;
  coachId: string;
  bookingId?: string | null;
  templateId?: string | null;
  sessionOrder?: number | null;
  title: string;
  notes?: string | null;
  createdAt: string;
  exercises: WorkoutExerciseItem[];
  coach?: {
    id: string;
    fullName: string;
    avatarUrl?: string | null;
  };
  member?: {
    id: string;
    fullName: string;
    phone?: string;
    email?: string;
    avatarUrl?: string | null;
  } | null;
  template?: {
    id: string;
    templateCode: string;
    disciplineCode: string;
    title: string;
    weekNumber: number;
    sessionOrder: number;
    description?: string | null;
  };
}

export interface CreateWorkoutPlanPayload {
  memberId?: string | null;
  title: string;
  bookingId?: string;
  notes?: string;
  exercises: WorkoutExerciseDto[];
}

export interface EquipmentItem {
  id: string;
  name: string;
  equipmentType: string;
  isActive: boolean;
  createdAt: string;
}

export interface CoachRateItem {
  id: string;
  disciplineId: string;
  ratePerSession: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  discipline?: {
    id: string;
    name: string;
    code: string;
  };
}
