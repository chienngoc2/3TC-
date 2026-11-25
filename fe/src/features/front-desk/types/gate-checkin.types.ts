export type LockerZone = "MALE_LOCKER" | "FEMALE_LOCKER" | "VIP_AREA";

export interface SearchMember {
  id: string;
  fullName: string;
  phone: string | null;
  email: string;
  avatarUrl: string | null;
  isActive: boolean;
}

export interface GateCheckinRequest {
  userId: string;
  preferredZone?: LockerZone;
  towelIssued: boolean;
}

export interface ManualPinCheckinRequest {
  phone: string;
  checkinCode: string;
  lockerZone?: LockerZone;
  towelIssued?: boolean;
  notes?: string;
}

export interface SessionQrResponse {
  qrToken: string;
  expiresInSeconds: number;
  expiresAt: string;
  generatedAt: string;
}

export interface LiveCheckinItem {
  attendanceId: string;
  type: "MEMBER" | "COACH";
  userId?: string;
  fullName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  planName?: string;
  packageTier?: string;
  startDate?: string;
  endDate?: string;
  remainingSessions?: number | null;
  disciplines?: string[];
  ratingStars?: number;
  checkinTime: string;
}
