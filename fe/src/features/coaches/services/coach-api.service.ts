import { get } from "@/lib/api";
import type {
  Coach,
  CoachAvailabilitySlot,
  CoachRateItem,
  Discipline,
} from "../types/coach.types";

interface RawCoachSpecialty {
  id?: string;
  specialtyId?: string;
  coachProfileId?: string;
  specialty?: {
    id?: string;
    code?: string;
    name?: string;
    disciplineId?: string;
    description?: string | null;
    discipline?: {
      code?: string;
      name?: string;
    };
  };
}

interface RawCoachRate {
  id: string;
  coachId: string;
  disciplineId?: string;
  ratePerSession?: number | string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  rateRange?: string;
  discipline?: {
    id: string;
    name: string;
    code?: string;
  };
}

interface RawCoachResponse {
  id: string;
  fullName?: string;
  avatarUrl?: string | null;
  phone?: string | null;
  email?: string | null;
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
    workingHours?: any[];
    ratingStars?: number;
    ratePerSession?: number | string;
    coachSpecialties?: RawCoachSpecialty[];
  };
  coachRates?: RawCoachRate[];
  coachAvailabilities?: CoachAvailabilitySlot[];
}

function mapRawCoach(item: RawCoachResponse): Coach {
  const disciplineIdsSet = new Set<string>();
  const disciplineCodesSet = new Set<string>();

  if (Array.isArray(item.coachRates)) {
    item.coachRates.forEach((r) => {
      if (r.disciplineId) disciplineIdsSet.add(r.disciplineId);
      if (r.discipline?.code) disciplineCodesSet.add(r.discipline.code.toUpperCase());
    });
  }

  const specialties = item.coachProfile?.coachSpecialties || [];
  specialties.forEach((cs) => {
    if (cs.specialty?.disciplineId) {
      disciplineIdsSet.add(cs.specialty.disciplineId);
    }
    if (cs.specialty?.discipline?.code) {
      disciplineCodesSet.add(cs.specialty.discipline.code.toUpperCase());
    }
    if (cs.specialty?.code) {
      const code = cs.specialty.code.toUpperCase();
      if (code.includes("GYM")) disciplineCodesSet.add("GYM");
      if (code.includes("BOX")) disciplineCodesSet.add("BOXING");
      if (code.includes("YOG")) disciplineCodesSet.add("YOGA");
    }
  });

  const specString = (item.coachProfile?.specialties || "").toUpperCase();
  if (specString.includes("GYM")) disciplineCodesSet.add("GYM");
  if (specString.includes("BOX")) disciplineCodesSet.add("BOXING");
  if (specString.includes("YOG")) disciplineCodesSet.add("YOGA");

  const disciplineCodes = Array.from(disciplineCodesSet);
  const disciplineIds = Array.from(disciplineIdsSet);
  const primaryDiscipline = disciplineCodes[0] || "";

  const rates: CoachRateItem[] = Array.isArray(item.coachRates)
    ? item.coachRates.map((r) => ({
      id: r.id,
      coachId: r.coachId,
      disciplineId: r.disciplineId,
      ratePerSession: Number(r.ratePerSession) || 0,
      effectiveFrom: r.effectiveFrom || "",
      effectiveTo: r.effectiveTo || null,
      rateRange: r.rateRange,
      discipline: r.discipline,
    }))
    : [];

  const mappedProfile = item.coachProfile
    ? {
      id: item.coachProfile.id,
      specialties: item.coachProfile.specialties,
      bio: item.coachProfile.bio,
      certificateUrls: item.coachProfile.certificateUrls,
      yearsExperience: item.coachProfile.yearsExperience,
      bankName: item.coachProfile.bankName,
      bankAccountNumber: item.coachProfile.bankAccountNumber,
      bankAccountName: item.coachProfile.bankAccountName,
      workingDays: item.coachProfile.workingDays,
      workingHours: item.coachProfile.workingHours,
      ratingStars: item.coachProfile.ratingStars,
      ratePerSession: item.coachProfile.ratePerSession,
      coachSpecialties: (item.coachProfile.coachSpecialties || []).map((cs) => ({
        id: cs.id,
        specialtyId: cs.specialtyId || cs.specialty?.id,
        coachProfileId: cs.coachProfileId,
        specialty: {
          id: cs.specialty?.id || "",
          name: cs.specialty?.name || "",
          code: cs.specialty?.code,
          disciplineId: cs.specialty?.disciplineId,
          description: cs.specialty?.description || null,
        },
      })),
    }
    : null;

  return {
    id: item.id,
    fullName: item.fullName || "Huấn Luyện Viên",
    avatarUrl: item.avatarUrl ? item.avatarUrl.trim() : null,
    phone: item.phone || null,
    email: item.email || null,
    disciplineIds,
    disciplineCodes,
    primaryDiscipline,
    experienceYears: item.coachProfile?.yearsExperience ?? 0,
    title: disciplineCodes.length > 0 ? `HLV Chuyên Sâu ${disciplineCodes.join(" & ")}` : "Huấn luyện viên",
    bio: item.coachProfile?.bio || null,
    coachProfile: mappedProfile,
    coachRates: rates,
    coachAvailabilities: item.coachAvailabilities || [],
  };
}

export const coachApiService = {
  /**
   * GET /api/v1/disciplines
   */
  async getDisciplines(): Promise<Discipline[]> {
    try {
      const res = await get<Discipline[]>("/disciplines");
      if (Array.isArray(res)) {
        return res;
      }
    } catch {
      return [];
    }
    return [];
  },

  /**
   * GET /api/v1/coaches
   * Fetches real coaches directly from Backend API.
   */
  async getCoaches(): Promise<Coach[]> {
    try {
      const rawCoaches = await get<RawCoachResponse[]>("/coaches");
      if (Array.isArray(rawCoaches)) {
        return rawCoaches.map((item) => mapRawCoach(item));
      }
    } catch {
      return [];
    }
    return [];
  },

  /**
   * Loads a single coach detail by fetching the full /coaches list and filtering.
   * The BE does not expose GET /coaches/:id, so we use the list endpoint.
   * Then enriches with /rates and /availability if those endpoints exist.
   */
  async getCoachDetail(coachId: string): Promise<Coach> {
    const allCoaches = await this.getCoaches();
    const found = allCoaches.find((c) => c.id === coachId);
    if (!found) {
      throw new Error("COACH_NOT_FOUND");
    }

    try {
      const rates = await this.getRates(coachId);
      if (rates && rates.length > 0) {
        found.coachRates = rates;
      }
    } catch {
      // Silent catch
    }

    try {
      const slots = await this.getAvailability(coachId);
      if (slots && slots.length > 0) {
        found.coachAvailabilities = slots;
      }
    } catch {
      // Silent catch
    }

    return found;
  },

  /**
   * GET /api/v1/coaches/availability?coachId=...
   */
  async getAvailability(coachId?: string): Promise<CoachAvailabilitySlot[]> {
    try {
      const data = await get<CoachAvailabilitySlot[]>(
        coachId ? `/coaches/availability?coachId=${coachId}` : "/coaches/availability"
      );
      if (Array.isArray(data)) return data;
    } catch {
      return [];
    }
    return [];
  },

  /**
   * GET /api/v1/coaches/:id/rates
   */
  async getRates(coachId: string): Promise<CoachRateItem[]> {
    try {
      const data = await get<RawCoachRate[]>(`/coaches/${coachId}/rates`);
      if (Array.isArray(data)) {
        return data.map((r) => ({
          ...r,
          ratePerSession: Number(r.ratePerSession) || 0,
          effectiveFrom: r.effectiveFrom || "",
        }));
      }
    } catch {
      return [];
    }
    return [];
  },
};
