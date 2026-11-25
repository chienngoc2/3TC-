import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/auth/session-context";
import { PageTitle } from "@/components/common/page-title";
import { StateMessage } from "@/components/feedback/state-message";
import { get } from "@/lib/api";
import { vietnamTime } from "@/lib/date";
import type { Attendance } from "@/lib/types";

export const AttendancesPage: React.FC = () => {
  const { user } = useSession();
  const rows = useQuery({
    queryKey: ["member", user!.id, "attendances"],
    queryFn: () => get<Attendance[]>("/attendances"),
  });

  return (
    <>
      <PageTitle eyebrow="MEM-13 · ĐIỂM DANH" title="Lịch sử điểm danh" />
      <p className="muted intro text-xs text-slate-500 mb-6">API trả tối đa 200 bản ghi gần nhất.</p>
      <StateMessage loading={rows.isPending} error={rows.error} empty={rows.data?.length === 0} />
      <div className="list">
        {rows.data?.map((item) => (
          <article className="list-row" key={item.id}>
            <strong>{item.checkInTime ? vietnamTime(item.checkInTime) : "—"}</strong>
            <span>{item.status ?? "Check-in"}</span>
          </article>
        ))}
      </div>
    </>
  );
};

export default AttendancesPage;
