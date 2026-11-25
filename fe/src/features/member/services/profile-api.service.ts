import { get, put } from "@/lib/api";
import type {
  GenderType,
  UserProfile,
  UpdateProfileDto,
  MemberSubscriptionItem,
} from "../types/profile.types";

interface RawMemberProfileResponse {
  id?: string;
  userId?: string;
  fitnessGoals?: string | null;
  medicalHistory?: string | null;
  heightCm?: number | string | null;
  weightKg?: number | string | null;
  bmi?: number | string | null;
  bodyFatPct?: number | string | null;
}

interface RawCoachProfileResponse {
  id?: string;
  userId?: string;
  specialties?: string | null;
  bio?: string | null;
  yearsExperience?: number | null;
  certificateUrls?: string[];
}

interface RawUserResponse {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  checkinCode?: string;
  role: string;
  isActive?: boolean;
  avatarUrl?: string | null;
  createdAt?: string;
  gender?: GenderType;
  fitnessGoals?: string;
  medicalHistory?: string;
  heightCm?: number | string;
  memberProfile?: RawMemberProfileResponse | null;
  coachProfile?: RawCoachProfileResponse | null;
}

export const profileApiService = {
  /**
   * GET /api/v1/users/profile/me
   * Fetches real user profile directly from Backend API.
   */
  async getProfile(): Promise<UserProfile> {
    const beData = await get<RawUserResponse>("/users/profile/me");
    if (!beData || !beData.id) {
      throw new Error("Không thể tải thông tin hồ sơ người dùng.");
    }

    // Try to load active subscriptions if user is a member
    let subscriptions: MemberSubscriptionItem[] = [];
    try {
      const subsData = await get<MemberSubscriptionItem[]>("/memberships/subscriptions");
      if (Array.isArray(subsData)) {
        subscriptions = subsData;
      }
    } catch {
      // Subscriptions call may be empty or unassigned
    }

    const memberProf = beData.memberProfile || null;
    const coachProf = beData.coachProfile || null;

    const parsedHeight = memberProf?.heightCm
      ? Number(memberProf.heightCm)
      : beData.heightCm
      ? Number(beData.heightCm)
      : undefined;

    const parsedWeight = memberProf?.weightKg ? Number(memberProf.weightKg) : undefined;
    const parsedBmi = memberProf?.bmi ? Number(memberProf.bmi) : undefined;
    const parsedBodyFat = memberProf?.bodyFatPct ? Number(memberProf.bodyFatPct) : undefined;

    return {
      id: beData.id,
      email: beData.email,
      fullName: beData.fullName || "",
      phone: beData.phone || "",
      checkinCode: beData.checkinCode || "1234",
      role: beData.role,
      avatarUrl: beData.avatarUrl ? beData.avatarUrl.trim() : null,
      gender: beData.gender || "MALE",
      fitnessGoals: memberProf?.fitnessGoals || beData.fitnessGoals || "",
      medicalHistory: memberProf?.medicalHistory || beData.medicalHistory || "",
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      bmi: parsedBmi,
      bodyFatPct: parsedBodyFat,
      isActive: beData.isActive ?? true,
      createdAt: beData.createdAt,
      memberProfile: memberProf,
      coachProfile: coachProf,
      subscriptions,
    };
  },

  /**
   * PUT /api/v1/users/profile/me
   * Passes strictly whitelisted properties to Backend (forbidNonWhitelisted: true).
   */
  async updateProfile(dto: UpdateProfileDto): Promise<UserProfile> {
    const payload: Record<string, string | number | string[] | undefined> = {
      fullName: dto.fullName.trim(),
    };

    if (dto.phone !== undefined) {
      payload.phone = dto.phone.trim();
    }
    if (dto.checkinCode !== undefined) {
      payload.checkinCode = dto.checkinCode.trim();
    }
    if (dto.gender !== undefined) {
      payload.gender = dto.gender;
    }
    if (dto.avatarUrl !== undefined) {
      payload.avatarUrl = dto.avatarUrl.trim();
    }
    if (dto.fitnessGoals !== undefined) {
      payload.fitnessGoals = dto.fitnessGoals.trim();
    }
    if (dto.medicalHistory !== undefined) {
      payload.medicalHistory = dto.medicalHistory.trim();
    }
    if (dto.heightCm !== undefined && !isNaN(Number(dto.heightCm)) && Number(dto.heightCm) > 0) {
      payload.heightCm = Number(dto.heightCm);
    }
    if (dto.bio !== undefined) {
      payload.bio = dto.bio.trim();
    }
    if (dto.yearsExperience !== undefined && !isNaN(Number(dto.yearsExperience))) {
      payload.yearsExperience = Number(dto.yearsExperience);
    }

    const updatedBeData = await put<RawUserResponse>("/users/profile/me", payload);

    // Sync session user full name & avatar in auth storage
    try {
      const rawAuth = localStorage.getItem("auth_user");
      if (rawAuth) {
        const auth = JSON.parse(rawAuth);
        auth.fullName = updatedBeData?.fullName || dto.fullName;
        if (updatedBeData?.avatarUrl !== undefined) {
          auth.avatarUrl = updatedBeData.avatarUrl;
        }
        localStorage.setItem("auth_user", JSON.stringify(auth));
        window.dispatchEvent(new Event("session-changed"));
      }
    } catch {
      // Ignore localStorage sync error
    }

    return this.getProfile();
  },

  async changePassword(dto: { currentPassword: string; newPassword: string }): Promise<any> {
    return put("/users/change-password", dto);
  },
};
