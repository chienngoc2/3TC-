export function getDisciplineColor(code?: string): string {
  const c = (code || "").toUpperCase();
  if (c.includes("BOX")) return "text-amber-400 bg-amber-500/20 border-amber-500/30";
  if (c.includes("YOG")) return "text-teal-300 bg-teal-500/20 border-teal-500/30";
  if (c.includes("PIL")) return "text-purple-300 bg-purple-500/20 border-purple-500/30";
  return "text-emerald-400 bg-emerald-500/20 border-emerald-500/30";
}

export function getInitials(fullName: string): string {
  if (!fullName) return "HLV";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
