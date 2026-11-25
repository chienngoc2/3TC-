import type { GenderType } from "../types/profile.types";

export function getGenderLabel(gender?: GenderType): {
  label: string;
  icon: string;
  className: string;
} {
  if (gender === "FEMALE") {
    return {
      label: "Nữ",
      icon: "♀",
      className: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    };
  }
  if (gender === "OTHER") {
    return {
      label: "Khác",
      icon: "⚧",
      className: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    };
  }
  return {
    label: "Nam",
    icon: "♂",
    className: "bg-sky-500/10 text-sky-300 border-sky-500/20",
  };
}

export function getInitials(fullName?: string): string {
  if (!fullName) return "HV";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
