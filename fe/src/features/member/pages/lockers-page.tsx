import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/auth/session-context";
import { PageTitle } from "@/components/common/page-title";
import { StateMessage } from "@/components/feedback/state-message";
import { Button } from "@/components/ui/button";
import { errorText, get, put } from "@/lib/api";
import { vietnamTime } from "@/lib/date";
import type { LockerAssignment } from "@/lib/types";

export const LockersPage: React.FC = () => {
  const { user } = useSession();
  const cache = useQueryClient();

  const rows = useQuery({
    queryKey: ["member", user!.id, "lockers"],
    queryFn: () => get<LockerAssignment[]>("/lockers/my-assignments"),
  });

  const giveBack = useMutation({
    mutationFn: (id: string) => put(`/lockers/assignments/${id}/return`, {}),
    onSuccess: () => void cache.invalidateQueries({ queryKey: ["member", user!.id, "lockers"] }),
  });

  return (
    <>
      <PageTitle eyebrow="MEM-14 · TỦ ĐỒ" title="Tủ đang sử dụng" />
      <StateMessage loading={rows.isPending} error={rows.error} empty={rows.data?.length === 0} />
      <div className="card-grid">
        {rows.data?.map((item) => (
          <article className="card" key={item.id}>
            <span className="pill">{item.locker.zone}</span>
            <h2>{item.locker.lockerNumber}</h2>
            <p className="text-xs text-slate-500 mb-3">Nhận tủ: {vietnamTime(item.assignedAt)}</p>
            <Button
              type="button"
              variant="secondary"
              disabled={giveBack.isPending}
              onClick={() => {
                if (window.confirm("Xác nhận trả tủ?")) giveBack.mutate(item.id);
              }}
            >
              Trả tủ
            </Button>
          </article>
        ))}
      </div>
      {giveBack.error && (
        <p role="alert" className="text-error text-xs mt-2">
          {errorText(giveBack.error)}
        </p>
      )}
    </>
  );
};

export default LockersPage;
