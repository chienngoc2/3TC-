import apiClient from "@/services/api-client";
import type {
  GateCheckinRequest,
  ManualPinCheckinRequest,
  SearchMember,
  SessionQrResponse,
  LiveCheckinItem,
} from "../types/gate-checkin.types";

export const searchMembers = async (q: string): Promise<SearchMember[]> =>
  (await apiClient.get<SearchMember[]>("/users/members", { params: { q } })).data;

export const gateCheckin = async (payload: GateCheckinRequest): Promise<any> =>
  (await apiClient.post<any>("/attendances/gate-checkin", payload)).data;

export const manualPinCheckin = async (payload: ManualPinCheckinRequest): Promise<any> =>
  (await apiClient.post<any>("/attendances/manual-checkin", payload)).data;

export const getSessionQr = async (): Promise<SessionQrResponse> =>
  (await apiClient.get<SessionQrResponse>("/attendances/session-qr")).data;

export const getLiveFeed = async (): Promise<LiveCheckinItem[]> =>
  (await apiClient.get<LiveCheckinItem[]>("/attendances/live-feed")).data;
