export type GenderType = "MALE" | "FEMALE" | "OTHER";

export interface MemberSubscriptionItem {
  id: string;
  status: "ACTIVE" | "EXPIRED" | "FROZEN";
  packageTier: string;
  startDate: string;
  endDate: string;
  remainingSessions: number;
  remainingPtSessions: number;
  remainingGroupSessions: number;
  hasUnlimitedGymAccess: boolean;
  plan?: {
    id: string;
    name: string;
    description?: string;
    price: number | string;
    packageTier: string;
    trainingMode: string;
  };
  assignedCoach?: {
    id: string;
    fullName: string;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  checkinCode?: string;
  role: string;
  avatarUrl?: string | null;
  gender?: GenderType;
  fitnessGoals?: string;
  medicalHistory?: string;
  heightCm?: number;
  weightKg?: number;
  bmi?: number;
  bodyFatPct?: number;
  isActive?: boolean;
  createdAt?: string;
  memberProfile?: {
    id?: string;
    userId?: string;
    fitnessGoals?: string | null;
    medicalHistory?: string | null;
    heightCm?: number | string | null;
    weightKg?: number | string | null;
    bmi?: number | string | null;
    bodyFatPct?: number | string | null;
  } | null;
  coachProfile?: {
    id?: string;
    userId?: string;
    specialties?: string | null;
    bio?: string | null;
    yearsExperience?: number | null;
    certificateUrls?: string[];
  } | null;
  subscriptions?: MemberSubscriptionItem[];
}

export interface UpdateProfileDto {
  fullName: string;
  phone?: string;
  checkinCode?: string;
  currentPassword?: string;
  avatarUrl?: string;
  gender?: GenderType;
  heightCm?: number;
  fitnessGoals?: string;
  medicalHistory?: string;
  bio?: string;
  yearsExperience?: number;
}
