import apiClient from "@/services/api-client";
import type { CoachTodaySchedule, CreateInbodyLog, InbodyLog, UpdateInbodyLog } from "../types/inbody.types";

export const getMemberInbodyLogs = async (memberId: string): Promise<InbodyLog[]> =>
  (await apiClient.get<{ logs: InbodyLog[] }>("/inbody/my-progress", { params: { memberId } })).data.logs;

export const createInbodyLog = async (payload: CreateInbodyLog): Promise<InbodyLog> =>
  (await apiClient.post<InbodyLog>("/inbody/logs", payload)).data;

export const updateInbodyLog = async (id: string, payload: UpdateInbodyLog): Promise<InbodyLog> =>
  (await apiClient.put<InbodyLog>(`/inbody/logs/${encodeURIComponent(id)}`, payload)).data;

export const getCoachTodaySchedule = async (): Promise<CoachTodaySchedule> =>
  (await apiClient.get<CoachTodaySchedule>("/coaches/today-schedule")).data;
