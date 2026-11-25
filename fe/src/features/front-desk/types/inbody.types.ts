import type { InbodyPayload } from "@/lib/inbody-entry";

export interface InbodyLog {
  id: string;
  userId: string;
  measuredById: string | null;
  measuredAt: string;
  heightCm: number | string;
  weightKg: number | string;
  muscleMassKg: number | string | null;
  skeletalMuscleMassKg?: number | string | null;
  bodyFatPct: number | string | null;
  bodyFatMassKg?: number | string | null;
  bmi: number | string | null;
  visceralFatLevel: number | null;
  tbwLiters?: number | string | null;
  proteinKg?: number | string | null;
  mineralKg?: number | string | null;
  waistHipRatio?: number | string | null;
  inbodyScore?: number | null;
  segmentalLean?: Record<string, number | string | null> | null;
  notes: string | null;
}

export type CreateInbodyLog = InbodyPayload & { userId: string };
export type UpdateInbodyLog = Partial<InbodyPayload>;

export interface CoachTodaySchedule {
  pt: Array<{
    id: string;
    startTime: string;
    bookings: Array<{ memberId: string }>;
  }>;
}
