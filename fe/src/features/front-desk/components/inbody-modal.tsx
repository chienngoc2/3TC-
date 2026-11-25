import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { InbodyEntryForm } from "@/components/inbody/inbody-entry-form";
import { memberError } from "../lib/member-error";
import { createInbodyLog, updateInbodyLog } from "../services/inbody.service";
import type { InbodyLog } from "../types/inbody.types";

const EDIT_WINDOW_MS = 86400000;
const EXPIRED = new Error("Phiếu đo đã quá 24 giờ, không thể chỉnh sửa.");

export const InbodyModal: React.FC<{
  memberId: string;
  memberName: string;
  log?: InbodyLog;
  onClose: () => void;
  onSaved: () => void;
}> = ({ memberId, memberName, log, onClose, onSaved }) => {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const setBusyState = (value: boolean) => {
    busyRef.current = value;
    setBusy(value);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#142923]/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busyRef.current) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="inbody-dialog-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-none bg-white p-5 shadow-2xl sm:p-6 border-2 border-slate-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#e3eee7] pb-4">
          <div>
            <h2 id="inbody-dialog-title" className="text-lg font-semibold text-[#172b28]">
              {log ? "Chỉnh sửa phiếu InBody" : "Nhập chỉ số InBody"}
            </h2>
            <p className="mt-1 text-sm text-[#61756f]">{memberName}</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            disabled={busy}
            onClick={onClose}
            title="Đóng"
            aria-label="Đóng"
            className="rounded p-1 text-[#61756f] hover:bg-[#edf5f0] disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">
          <InbodyEntryForm
            source={log}
            defaultMode="quick"
            notesLabel="Lời dặn của chuyên viên"
            notesPlaceholder="Ghi chú kết quả đo và hướng dẫn tiếp theo"
            submitLabel={log ? "Lưu điều chỉnh" : "Lưu phiếu đo"}
            onBusyChange={setBusyState}
            onCancel={onClose}
            describeError={(cause) =>
              cause === EXPIRED
                ? EXPIRED.message
                : memberError(
                    cause,
                    log
                      ? "Không thể cập nhật phiếu đo. Vui lòng thử lại."
                      : "Không thể lưu phiếu đo. Vui lòng thử lại.",
                  )
            }
            onSubmit={async (payload) => {
              if (log && Date.now() - new Date(log.measuredAt).getTime() > EDIT_WINDOW_MS)
                throw EXPIRED;
              if (log) await updateInbodyLog(log.id, payload);
              else
                await createInbodyLog({
                  ...payload,
                  userId: memberId,
                  notes: payload.notes ?? undefined,
                });
              onSaved();
            }}
          />
        </div>
      </section>
    </div>
  );
};
