import React, { useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getBookings,
  getSchedules,
  getUser,
  reviewCancellation,
} from "../services/front-desk-api.service";
import type {
  CancellationDetails,
  CancellationRequest,
  CancellationReviewResponse,
} from "../types/front-desk.types";
import { formatDateTime } from "../lib/date-time";

interface CancellationModalProps {
  request: CancellationRequest;
  onClose: () => void;
  onReviewed: (result: CancellationReviewResponse) => void;
  onStale: () => void;
}

const errorText = (error: unknown): { message: string; stale: boolean } => {
  const response = (error as { response?: { data?: { message?: string | string[]; errorCode?: string } } })?.response;
  const message = response?.data?.message;
  if (message === "REQUEST_ALREADY_REVIEWED" || response?.data?.errorCode === "REQUEST_ALREADY_REVIEWED")
    return { message: "Yêu cầu đã được người khác xử lý. Danh sách đang được cập nhật.", stale: true };
  return {
    message: Array.isArray(message) ? message.join(", ") : message || "Không thể xử lý yêu cầu. Vui lòng thử lại.",
    stale: false,
  };
};

export const CancellationModal: React.FC<CancellationModalProps> = ({
  request,
  onClose,
  onReviewed,
  onStale,
}) => {
  const [details, setDetails] = useState<CancellationDetails>({
    coachName: null,
    memberName: null,
    sessionTime: null,
  });
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [action, setAction] = useState<"APPROVE" | "REJECT" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submittingRef.current) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setDetails({ coachName: null, memberName: null, sessionTime: null });
    setDetailsLoading(true);
    setAction(null);
    setReason("");
    setError(null);
    setStale(false);

    const load = async () => {
      const [coachResult, targetResult] = await Promise.allSettled([
        getUser(request.coachId),
        request.scheduleId ? getSchedules() : getBookings(),
      ]);
      let memberId: string | null = null;
      let sessionTime: string | null = null;
      if (targetResult.status === "fulfilled") {
        if (request.scheduleId) {
          const schedule = (targetResult.value as Awaited<ReturnType<typeof getSchedules>>)
            .find((item) => item.id === request.scheduleId);
          sessionTime = schedule?.startTime ?? null;
        } else {
          const booking = (targetResult.value as Awaited<ReturnType<typeof getBookings>>)
            .find((item) => item.id === request.bookingId);
          memberId = booking?.memberId ?? null;
          sessionTime = booking?.coachAvailability?.startTime ?? null;
        }
      }
      const memberResult = memberId ? await Promise.allSettled([getUser(memberId)]) : null;
      if (!cancelled) {
        setDetails({
          coachName: coachResult.status === "fulfilled" ? coachResult.value.fullName : null,
          memberName: memberResult?.[0].status === "fulfilled" ? memberResult[0].value.fullName : null,
          sessionTime,
        });
        setDetailsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [request.id, request.coachId, request.bookingId, request.scheduleId]);

  const submit = async () => {
    if (!action || submittingRef.current || stale) return;
    const trimmedReason = reason.trim();
    if (action === "REJECT" && !trimmedReason) {
      setError("Vui lòng nhập lý do từ chối.");
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const result = await reviewCancellation(request.id, action, trimmedReason);
      onReviewed(result);
    } catch (err) {
      const result = errorText(err);
      const message = result.message;
      setError(message);
      if (result.stale) {
        setStale(true);
        onStale();
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#10221f]/60 p-4"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancellation-title"
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-none bg-white p-5 shadow-2xl sm:p-6 border-2 border-slate-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#fff0e6] text-[#c9551b]">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="cancellation-title" className="text-lg font-bold text-[#10221f]">Yêu cầu hủy ca khẩn cấp</h2>
              <p className="mt-1 text-xs text-[#6a7d78]">Tiếp nhận {formatDateTime(request.createdAt)}</p>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} disabled={submitting} aria-label="Đóng"
            className="rounded-md p-2 text-[#6a7d78] hover:bg-[#f1faf6] disabled:opacity-50">
            <X className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-5 gap-y-4 border-y border-[#e4f0ec] py-5 text-sm sm:grid-cols-2">
          <div><dt className="text-[#6a7d78]">Huấn luyện viên</dt><dd className="mt-1 font-semibold text-[#10221f]">{detailsLoading ? "Đang tải..." : details.coachName ?? "Chưa có thông tin"}</dd></div>
          <div><dt className="text-[#6a7d78]">Loại ca</dt><dd className="mt-1 font-semibold text-[#10221f]">{request.targetType === "GROUP_CLASS" ? "Lớp nhóm" : "PT cá nhân"}</dd></div>
          <div><dt className="text-[#6a7d78]">Hội viên</dt><dd className="mt-1 font-semibold text-[#10221f]">{request.targetType === "GROUP_CLASS" ? "Nhiều hội viên" : detailsLoading ? "Đang tải..." : details.memberName ?? "Chưa có thông tin"}</dd></div>
          <div><dt className="text-[#6a7d78]">Thời gian ca</dt><dd className="mt-1 font-semibold text-[#10221f]">{detailsLoading ? "Đang tải..." : details.sessionTime ? formatDateTime(details.sessionTime) : "Chưa có thông tin"}</dd></div>
          <div className="sm:col-span-2"><dt className="text-[#6a7d78]">Lý do</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-[#10221f]">{request.reasonMessage}</dd></div>
          {request.internalNote && <div className="sm:col-span-2"><dt className="text-[#6a7d78]">Ghi chú nội bộ</dt><dd className="mt-1 whitespace-pre-wrap text-[#10221f]">{request.internalNote}</dd></div>}
          <div className="sm:col-span-2"><dt className="text-[#6a7d78]">Mã yêu cầu</dt><dd className="mt-1 break-all font-mono text-xs text-[#10221f]">{request.id}</dd></div>
        </dl>

        <div className="mt-4 flex items-center gap-2 text-sm text-[#6a7d78]">
          <Phone className="h-4 w-4" />
          Số quản lý: Chưa có thông tin liên hệ
        </div>

        {action === "APPROVE" && <p className="mt-5 rounded-md bg-[#fff7ed] p-3 text-sm text-[#81410f]">Xác nhận phê duyệt thay quản lý? Hệ thống sẽ hủy ca và hoàn trả lượt tập theo quy định.</p>}
        {action === "REJECT" && <label className="mt-5 block text-sm font-medium text-[#10221f]">Lý do từ chối
          <textarea value={reason} maxLength={2000} onChange={(event) => setReason(event.target.value)} rows={3}
            className="mt-2 w-full rounded-md border border-[#cde4dc] p-3 text-sm outline-none focus:border-[#17664e]" />
        </label>}
        {error && <p role="alert" className="mt-4 text-sm text-[#b93427]">{error}</p>}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {action ? (
            <>
              <Button type="button" variant="outline" onClick={() => { setAction(null); setError(null); }} disabled={submitting}>Quay lại</Button>
              <Button type="button" variant={action === "APPROVE" ? "mint" : "destructive"} onClick={() => void submit()} disabled={submitting || stale}>
                <Check className="h-4 w-4" />
                {submitting ? "Đang xử lý..." : action === "APPROVE" ? "Xác nhận phê duyệt" : "Xác nhận từ chối"}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setAction("REJECT")} disabled={stale}>Từ chối</Button>
              <Button type="button" variant="mint" onClick={() => setAction("APPROVE")} disabled={stale}>Phê duyệt thay quản lý</Button>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
