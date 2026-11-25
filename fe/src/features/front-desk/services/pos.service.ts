import apiClient from "@/services/api-client";
import type {
  AddonResponse,
  MembershipPlan,
  PosCoach,
  PosPaymentMethod,
  PosSubscription,
  PurchaseResponse,
} from "../types/pos.types";

export const getPosPlans = async (): Promise<MembershipPlan[]> =>
  (await apiClient.get<MembershipPlan[]>("/memberships/plans")).data;

export const getPosCoaches = async (): Promise<PosCoach[]> =>
  (await apiClient.get<PosCoach[]>("/coaches")).data;

export const getMemberSubscriptions = async (memberId: string): Promise<PosSubscription[]> =>
  (await apiClient.get<PosSubscription[]>("/memberships/subscriptions", { params: { memberId } })).data;

export const purchasePlan = async (
  memberId: string,
  planId: string,
  coachId: string | undefined,
  paymentMethod: PosPaymentMethod,
  vip: boolean,
): Promise<PurchaseResponse> => {
  const payload = vip
    ? { userId: memberId, planId, coachId, paymentMethod }
    : { memberId, planId, ...(coachId ? { coachId } : {}), paymentMethod };
  const path = vip ? "/billing/subscriptions/vip" : "/billing/purchase";
  return (await apiClient.post<PurchaseResponse>(path, payload)).data;
};

export const purchasePtAddon = async (
  subscriptionId: string,
  addonSessions: number,
  paymentMethod: PosPaymentMethod,
): Promise<AddonResponse> =>
  (await apiClient.post<AddonResponse>(
    `/billing/subscriptions/${encodeURIComponent(subscriptionId)}/pt-addon`,
    { addonSessions, paymentMethod },
  )).data;

export const renewSubscription = async (
  subscriptionId: string,
  paymentMethod: PosPaymentMethod,
): Promise<PurchaseResponse> =>
  (await apiClient.post<PurchaseResponse>(
    `/billing/subscriptions/${encodeURIComponent(subscriptionId)}/renew`,
    { paymentMethod },
  )).data;
