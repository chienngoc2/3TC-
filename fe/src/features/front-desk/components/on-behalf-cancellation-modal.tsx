import React, { useEffect, useState } from "react";
import { AlertTriangle, Calendar, Clock, Loader2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createCancellationOnBehalf,
  getBookings,
  getSchedules,
} from "../services/front-desk-api.service";
import { getPosCoaches } from "../services/pos.service";
import type {
  CancellationRequest,
  CreateCancellationOnBehalfPayload,
} from "../types/front-desk.types";
import type { PosCoach } from "../types/pos.types";
import { formatDateTime } from "../lib/date-time";

interface OnBehalfCancellationModalProps {
  onClose: () => void;
  onCreated: (request: CancellationRequest) => void;
}

interface RawScheduleSession {
  id: string;
  coachId?: string;
  coach?: { id?: string; fullName?: string };
  startTime: string;
  endTime: string;
  status: string;
  class?: { name?: string };
  room?: { name?: string };
}

interface RawBookingSession {
  id: string;
  memberId?: string;
  status?: string;
  bookingType?: string;
  coachAvailability?: {
    id?: string;
    coachId?: string;
    startTime?: string;
    endTime?: string;
  } | null;
}

export const OnBehalfCancellationModal: React.FC<OnBehalfCancellationModalProps> = ({
  onClose,
  onCreated,
}) => {
  const [coaches, setCoaches] = useState<PosCoach[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [targetType, setTargetType] = useState<"GROUP_CLASS" | "PERSONAL_TRAINING">("GROUP_CLASS");

  const [schedules, setSchedules] = useState<RawScheduleSession[]>([]);
  const [bookings, setBookings] = useState<RawBookingSession[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [selectedBookingId, setSelectedBookingId] = useState<string>("");

  const [reasonMessage, setReasonMessage] = useState<string>("");
  const [internalNote, setInternalNote] = useState<string>("");

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load coaches, schedules, bookings
  useEffect(() => {
    let active = true;
    setLoadingData(true);
    Promise.all([
      getPosCoaches().catch(() => []),
      getSchedules().catch(() => []),
      getBookings().catch(() => []),
    ])
      .then(([coachesRes, schedulesRes, bookingsRes]) => {
        if (!active) return;
        setCoaches(coachesRes || []);
        setSchedules((schedulesRes as unknown as RawScheduleSession[]) || []);
        setBookings((bookingsRes as unknown as RawBookingSession[]) || []);
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Filter available future sessions for the selected coach
  const now = new Date();

  const coachSchedules = schedules.filter((s) => {
    const cId = s.coachId || s.coach?.id;
    if (!cId || cId !== selectedCoachId) return false;
    const start = new Date(s.startTime);
    return start > now && ["OPEN", "FULL"].includes(s.status);
  });

  const coachBookings = bookings.filter((b) => {
    const cId = b.coachAvailability?.coachId;
    if (!cId || cId !== selectedCoachId) return false;
    if (!b.coachAvailability?.startTime) return false;
    const start = new Date(b.coachAvailability.startTime);
    return start > now && b.status === "CONFIRMED";
  });

  const quickReasons = [
    "HLV bị sốt cao đột xuất, cần nhập viện kiểm tra y tế khẩn cấp.",
    "HLV gặp sự cố tai nạn giao thông trên đường di chuyển đến trung tâm.",
    "HLV có việc gia đình cấp bách đột xuất, không thể kịp thời bàn giao ca dạy.",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!selectedCoachId) {
      setErrorMessage("Vui lòng chọn Huấn luyện viên cần nộp đơn hủy thay.");
      return;
    }

    if (targetType === "GROUP_CLASS" && !selectedScheduleId) {
      setErrorMessage("Vui lòng chọn lớp học nhóm cần hủy.");
      return;
    }

    if (targetType === "PERSONAL_TRAINING" && !selectedBookingId) {
      setErrorMessage("Vui lòng chọn ca hẹn PT 1-1 cần hủy.");
      return;
    }

    if (reasonMessage.trim().length < 20) {
      setErrorMessage("Lời nhắn xin lỗi / lý do hủy phải có tối thiểu 20 ký tự.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const payload: CreateCancellationOnBehalfPayload = {
      coachId: selectedCoachId,
      targetType,
      scheduleId: targetType === "GROUP_CLASS" ? selectedScheduleId : undefined,
      bookingId: targetType === "PERSONAL_TRAINING" ? selectedBookingId : undefined,
      reasonMessage: reasonMessage.trim(),
      internalNote: internalNote.trim() || undefined,
    };

    try {
      const result = await createCancellationOnBehalf(payload);
      onCreated(result);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Lỗi khi nộp đơn hủy thay HLV.";
      const formatted =
        msg === "CANCELLATION_REASON_TOO_SHORT"
          ? "Lời nhắn lý do hủy quá ngắn (tối thiểu 20 ký tự)."
          : msg === "SESSION_ALREADY_STARTED"
          ? "Ca dạy đã bắt đầu hoặc đã kết thúc, không thể nộp đơn hủy."
          : msg === "COACH_TARGET_MISMATCH"
          ? "Ca dạy đã chọn không khớp với HLV được chỉ định."
          : typeof msg === "string"
          ? msg
          : JSON.stringify(msg);
      setErrorMessage(formatted);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-none bg-white p-6 shadow-2xl border-2 border-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Nộp Đơn Hủy Ca Thay HLV
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Dành cho Bàn Tiếp Tân tiếp nhận sự cố khẩn cấp từ Huấn luyện viên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-semibold text-rose-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {/* Step 1: Select Coach */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              1. Chọn Huấn Luyện Viên báo vắng <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedCoachId}
              disabled={loadingData || submitting}
              onChange={(e) => {
                setSelectedCoachId(e.target.value);
                setSelectedScheduleId("");
                setSelectedBookingId("");
                setErrorMessage(null);
              }}
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">-- Chọn Huấn luyện viên --</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Step 2: Target Type Switcher */}
          {selectedCoachId && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                2. Phân loại ca dạy <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("GROUP_CLASS");
                    setSelectedBookingId("");
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold text-xs transition-all ${
                    targetType === "GROUP_CLASS"
                      ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-500/20"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Lớp tập nhóm ({coachSchedules.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetType("PERSONAL_TRAINING");
                    setSelectedScheduleId("");
                  }}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border font-bold text-xs transition-all ${
                    targetType === "PERSONAL_TRAINING"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  <span>Ca kèm PT 1-1 ({coachBookings.length})</span>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Choose specific session */}
          {selectedCoachId && targetType === "GROUP_CLASS" && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                3. Chọn lớp học sắp tới của HLV <span className="text-rose-500">*</span>
              </label>
              {coachSchedules.length === 0 ? (
                <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-center text-slate-500 italic">
                  HLV này không có lớp nhóm nào sắp diễn ra.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {coachSchedules.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedScheduleId === item.id
                          ? "border-blue-500 bg-blue-50/70 text-blue-950 ring-1 ring-blue-500/30"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="scheduleTarget"
                        value={item.id}
                        checked={selectedScheduleId === item.id}
                        onChange={() => setSelectedScheduleId(item.id)}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 truncate">
                          {item.class?.name || "Lớp nhóm"}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {formatDateTime(item.startTime)} - {new Date(item.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                          {item.room?.name ? ` • Phòng ${item.room.name}` : ""}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedCoachId && targetType === "PERSONAL_TRAINING" && (
            <div>
              <label className="block font-bold text-slate-700 mb-1.5">
                3. Chọn ca PT 1-1 sắp tới của HLV <span className="text-rose-500">*</span>
              </label>
              {coachBookings.length === 0 ? (
                <p className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 text-center text-slate-500 italic">
                  HLV này không có ca hẹn PT 1-1 nào sắp diễn ra.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {coachBookings.map((b) => (
                    <label
                      key={b.id}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedBookingId === b.id
                          ? "border-emerald-500 bg-emerald-50/70 text-emerald-950 ring-1 ring-emerald-500/30"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="bookingTarget"
                        value={b.id}
                        checked={selectedBookingId === b.id}
                        onChange={() => setSelectedBookingId(b.id)}
                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900">
                          Hẹn PT kèm 1-1 ({b.memberId ? `#${b.memberId.slice(0, 8)}` : "Học viên"})
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {b.coachAvailability?.startTime
                            ? formatDateTime(b.coachAvailability.startTime)
                            : "Chưa rõ thời gian"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Reason Message */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-bold text-slate-700">
                4. Lời nhắn xin lỗi gửi học viên <span className="text-rose-500">*</span>
              </label>
              <span
                className={`text-[10px] font-bold ${
                  reasonMessage.trim().length >= 20 ? "text-emerald-600" : "text-amber-600"
                }`}
              >
                {reasonMessage.trim().length}/20 ký tự tối thiểu
              </span>
            </div>
            <textarea
              rows={3}
              required
              value={reasonMessage}
              maxLength={2000}
              onChange={(e) => setReasonMessage(e.target.value)}
              placeholder="Nhập lý do chi tiết và lời xin lỗi gửi học viên (tối thiểu 20 ký tự)..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
            {/* Quick chips */}
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {quickReasons.map((text, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setReasonMessage(text)}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 px-2 py-1 text-[10px] text-slate-600 font-medium text-left transition-colors"
                >
                  + {text.slice(0, 42)}...
                </button>
              ))}
            </div>
          </div>

          {/* Step 5: Internal Note */}
          <div>
            <label className="block font-bold text-slate-700 mb-1.5">
              5. Ghi chú nội bộ dành cho Ban quản lý (tùy chọn)
            </label>
            <textarea
              rows={2}
              value={internalNote}
              maxLength={5000}
              onChange={(e) => setInternalNote(e.target.value)}
              placeholder="VD: HLV gọi điện báo hotline lễ tân lúc 08:15 do sốt đột xuất. Lễ tân tiếp nhận và nộp đơn thay..."
              className="w-full rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={onClose}
              className="text-xs font-semibold"
            >
              Hủy bỏ
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold gap-1.5 shadow-sm"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{submitting ? "Đang gửi đơn..." : "Gửi đơn hủy thay HLV"}</span>
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
};
