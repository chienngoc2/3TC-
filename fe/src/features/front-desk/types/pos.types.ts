export type PackageTier = "TRIAL" | "DROP_IN" | "PLUS" | "VIP";
export type PosPaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "FREE";
export type Money = number | string;

export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: Money;
  durationDays: number;
  packageTier: PackageTier;
  ptSessionQuota: number | null;
  groupSessionQuota: number | null;
  disciplineId: string | null;
  discipline: { id: string; name: string } | null;
}

export interface PosCoach {
  id: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  avatarUrl: string | null;
  coachProfile: {
    coachSpecialties: Array<{ specialty: { disciplineId: string } }>;
  } | null;
}

export interface PosSubscription {
  id: string;
  userId: string;
  packageTier: PackageTier;
  status: string;
  startDate: string;
  endDate: string;
  assignedCoachId: string | null;
  remainingPtSessions: number | null;
  remainingGroupSessions: number | null;
  plan: { id: string; name: string; price: Money };
  assignedCoach: { id: string; fullName: string } | null;
}

export interface SoldSubscription {
  id: string;
  userId: string;
  planId: string;
  assignedCoachId: string | null;
  remainingPtSessions: number | null;
}

export interface PosInvoice {
  id: string;
  invoiceCode: string;
  amount: Money;
  baseAmount: Money | null;
  ptAmount: Money | null;
  paymentMethod: PosPaymentMethod;
  status: string;
  createdAt: string;
}

export interface PurchaseResponse {
  subscription: SoldSubscription;
  invoice: PosInvoice;
  subscriptionId?: string;
  invoiceId?: string;
  baseAmount?: Money;
  ptAmount?: Money;
  totalAmount?: Money;
  invoiceCode?: string;
}

export interface AddonResponse {
  subscription: SoldSubscription;
  invoice: PosInvoice;
  invoiceId: string;
  amount: Money;
  newRemainingPtSessions: number;
  invoiceCode: string;
}
