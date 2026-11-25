export interface GateCheckinEvent {
  attendanceId: string;
  memberId: string;
  lockerNumber?: string | null;
}

export interface Attendance {
  id: string;
  memberId: string;
  checkInTime: string;
  checkinType: string;
  status: string;
  towelIssued?: boolean | null;
}

export interface UserSummary {
  id: string;
  fullName: string;
  phone?: string | null;
}

export interface CheckinRow {
  id: string;
  memberName: string | null;
  checkInTime: string | null;
  lockerNumber: string | null;
}

export interface Schedule {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  capacity: number;
  currentEnrolled: number;
  class: { name: string; discipline?: { name?: string; code: string } };
  room: { name: string };
  coach: { fullName: string };
}

export interface LockerUserSummary {
  id: string;
  fullName: string;
  phone: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface CurrentLockerAssignment {
  id: string;
  userId: string;
  assignedAt: string;
  notes?: string | null;
  user: LockerUserSummary;
}

export interface Locker {
  id: string;
  lockerNumber: string;
  zone: string;
  status: "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
  isActive: boolean;
  currentAssignment?: CurrentLockerAssignment | null;
}

export interface CancellationRequest {
  id: string;
  coachId: string;
  targetType: "PERSONAL_TRAINING" | "GROUP_CLASS";
  bookingId: string | null;
  scheduleId: string | null;
  substituteCoachId?: string | null;
  reasonMessage: string;
  internalNote: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  createdAt: string;
}

export interface CreateCancellationOnBehalfPayload {
  coachId: string;
  bookingId?: string;
  scheduleId?: string;
  targetType?: "PERSONAL_TRAINING" | "GROUP_CLASS";
  reasonMessage: string;
  internalNote?: string;
}

export interface Booking {
  id: string;
  memberId: string;
  coachAvailability: { startTime: string } | null;
}

export interface CancellationDetails {
  coachName: string | null;
  memberName: string | null;
  sessionTime: string | null;
}

export interface CancellationReviewResponse extends CancellationRequest {
  requestId: string;
  reviewedBy: string;
  refundedCount: number;
}
