import type { StudentBookingItem } from './coach-portal.types';

export type CoachSessionType = 'PT' | 'GROUP_CLASS' | 'EMPTY_SLOT';
export type CoachSessionStatus = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';

export interface CoachAvailabilityWindow {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // ISO
  endTime: string; // ISO
  label: string; // "Giờ mở 08:00 – 21:00"
}

export interface CoachScheduleSession {
  id: string;
  type: CoachSessionType;
  status: CoachSessionStatus;
  title?: string; // For group class: "Yoga Vinyasa", "Boxing"
  studentName?: string; // For PT: "Tester123", "Nguyen Van John"
  studentPhone?: string;
  studentAvatar?: string | null;
  roomName?: string;
  startTime: string; // ISO
  endTime: string; // ISO
  capacity?: number;
  enrolledCount?: number;
  checkedInCount?: number;
  notes?: string;
  isSlotEmpty?: boolean;
  packageCategory?: 'GROUP' | 'ONE_ON_ONE' | string | null;
  disciplineName?: string | null;
  specialtyName?: string | null;
  bookings?: StudentBookingItem[];
  scheduleId?: string;
  coachAvailabilityId?: string;
  isEmergencyCancelled?: boolean;
}

export type ScheduleFilterType = 'ALL' | 'PT' | 'CLASS';
