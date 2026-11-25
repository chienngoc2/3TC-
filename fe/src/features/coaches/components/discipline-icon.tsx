import React from "react";
import { Dumbbell, Flame, Sparkles, Activity } from "lucide-react";

interface DisciplineIconProps {
  code?: string;
  className?: string;
}

export const DisciplineIcon: React.FC<DisciplineIconProps> = ({ code, className }) => {
  const c = (code || "").toUpperCase();
  if (c.includes("BOX")) return <Flame className={className} />;
  if (c.includes("YOG")) return <Sparkles className={className} />;
  if (c.includes("PIL")) return <Activity className={className} />;
  return <Dumbbell className={className} />;
};
