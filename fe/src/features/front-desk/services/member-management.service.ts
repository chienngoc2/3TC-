import apiClient from "@/services/api-client";
import type { Attendance } from "../types/front-desk.types";
import { getMemberSubscriptions } from "./pos.service";
import type {
  CreateMemberPayload,
  MemberDetail,
  MemberInvoice,
  MemberProfileUpdate,
} from "../types/member-management.types";

export const getMemberDetail = async (id: string): Promise<MemberDetail> =>
  (await apiClient.get<MemberDetail>(`/users/${encodeURIComponent(id)}`)).data;

export const createMember = async (payload: CreateMemberPayload): Promise<MemberDetail> =>
  (await apiClient.post<MemberDetail>("/users/members", payload)).data;

export const updateMemberDetail = async (id: string, payload: MemberProfileUpdate): Promise<MemberDetail> =>
  (await apiClient.put<MemberDetail>(`/users/members/${encodeURIComponent(id)}`, payload)).data;

export { getMemberSubscriptions };

export const getMemberHistory = async (id: string): Promise<Attendance[]> =>
  (await apiClient.get<Attendance[]>("/attendances", { params: { memberId: id } })).data;

export const getRecentMemberInvoices = async (id: string): Promise<MemberInvoice[]> => {
  const invoices = (await apiClient.get<MemberInvoice[]>("/billing/invoices")).data;
  return invoices.filter((invoice) => invoice.subscription.userId === id);
};

export const changeSubscriptionStatus = async (
  id: string,
  status: "ACTIVE" | "FROZEN",
): Promise<{ id: string; status: string }> =>
  (await apiClient.put<{ id: string; status: string }>(`/memberships/subscriptions/${encodeURIComponent(id)}/status`, { status })).data;
