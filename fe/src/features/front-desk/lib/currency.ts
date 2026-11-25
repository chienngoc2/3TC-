import type { Money } from "../types/pos.types";

const formatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

export const formatVnd = (amount: Money | null | undefined): string => {
  if (amount === null || amount === undefined) return "—";
  const numeric = Number(amount);
  return Number.isFinite(numeric) ? formatter.format(numeric) : "—";
};
