export type UserRole =
  | "MEMBER"
  | "COACH"
  | "RECEPTIONIST"
  | "CENTER_MANAGER"
  | "ADMIN";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  gender?: "MALE" | "FEMALE" | "OTHER";
  phone?: string;
  avatarUrl?: string | null;
  memberProfile?: {
    fitnessGoals?: string | null;
    medicalHistory?: string | null;
    heightCm?: number | null;
  };
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  avatarUrl?: string;
}

export interface AuthResponseData {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: string;
  defaultAccount?: {
    email: string;
    defaultPassword: string;
    message: string;
  };
}

export interface RefreshTokenResponseData {
  accessToken: string;
  refreshToken: string;
  tokenType?: string;
  expiresIn?: string;
}

export interface ApiAuthError {
  message: string | string[];
  errorCode?: string;
  statusCode?: number;
}
