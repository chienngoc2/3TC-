import React from "react";
import { PlanCatalog } from "@/features/plans/components/plan-catalog";

export const PublicPlansPage: React.FC = () => {
  return <PlanCatalog member={false} />;
};

export default PublicPlansPage;
