export interface Discipline {
  id: string;
  code: string;
  name: string;
  description?: string | null;
}

export interface CoachSpecialtyItem {
  id: string;
  name: string;
  code?: string;
  disciplineId?: string;
  description?: string | null;
}

export interface CoachRateItem {
  id: string;
  coachId: string;
  disciplineId?: string;
  ratePerSession: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  rateRange?: string;
  discipline?: {
    id: string;
    name: string;
    code?: string;
  };
}

export interface CoachAvailabilitySlot {
  id: string;
  coachId: string;
  startTime: string;
  endTime: string;
  isBooked: boolean;
  isEmergencyCancelled?: boolean;
  timeRange?: string;
}

export interface Coach {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  disciplineIds: string[];
  disciplineCodes: string[];
  primaryDiscipline: string;
  experienceYears: number;
  title: string;
  bio?: string | null;
  coachProfile?: {
    id?: string;
    specialties?: string | null;
    bio?: string | null;
    certificateUrls?: string[];
    yearsExperience?: number;
    bankName?: string | null;
    bankAccountNumber?: string | null;
    bankAccountName?: string | null;
    workingDays?: string[];
    workingHours?: Array<{ shift?: string; from: string; to: string }>;
    ratingStars?: number;
    ratePerSession?: number | string;
    coachSpecialties?: {
      id?: string;
      specialtyId?: string;
      coachProfileId?: string;
      specialty: CoachSpecialtyItem;
    }[];
  } | null;
  coachRates?: CoachRateItem[];
  coachAvailabilities?: CoachAvailabilitySlot[];
  availabilitySlots?: CoachAvailabilitySlot[];
}

export interface DisciplineSectionData {
  discipline: Discipline;
  tagline: string;
  coaches: Coach[];
}
