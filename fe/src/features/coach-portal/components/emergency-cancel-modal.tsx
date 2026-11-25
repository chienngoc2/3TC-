import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  X,
  Loader2,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/context/notification-context';
import { coachPortalApi } from '../api/coach-portal-api';

const CANCEL_ERROR_MAP: Record<string, string> = {
  EXACTLY_ONE_CANCELLATION_TARGET:
    'Ca dạy này chưa có học viên đặt chỗ hoặc thiếu thông tin ca học, không thể gửi yêu cầu hủy đột xuất.',
  CANCELLATION_TARGET_MISMATCH:
    'Loại ca dạy không khớp với thông tin hủy lịch.',
  CANCELLATION_REASON_TOO_SHORT:
    'Lời nhắn xin lỗi học viên phải có tối thiểu 20 ký tự.',
  COACH_TARGET_MISMATCH:
    'Bạn không phải là huấn luyện viên phụ trách ca dạy này.',
  COACH_REQUIRED:
    'Thiếu thông tin huấn luyện viên.',
  COACH_NOT_FOUND:
    'Không tìm thấy hồ sơ huấn luyện viên.',
  SESSION_ALREADY_STARTED:
    'Ca dạy đã bắt đầu hoặc đã qua giờ, không thể gửi yêu cầu hủy.',
  BOOKING_NOT_CANCELLABLE:
    'Lịch đặt này không ở trạng thái có thể hủy (đã hủy hoặc đã hoàn thành).',
  SCHEDULE_CLOSED:
    'Lịch lớp học đã đóng hoặc không còn mở.',
  CANCELLATION_REQUEST_EXISTS:
    'Đã tồn tại yêu cầu xin nghỉ đang chờ duyệt cho ca dạy này.',
  REQUEST_NOT_PENDING:
    'Yêu cầu này đã được xử lý hoặc không thể rút lại.',
  REQUEST_ALREADY_REVIEWED:
    'Đơn đã được Lễ tân/Quản lý duyệt ngay trước đó.',
};

function translateCancelError(raw: unknown): string {
  const msg = Array.isArray(raw) ? raw.join(', ') : String(raw || '');
  for (const [code, vi] of Object.entries(CANCEL_ERROR_MAP)) {
    if (msg.includes(code)) return vi;
  }
  return msg || 'Đã xảy ra lỗi khi xử lý yêu cầu hủy lịch.';
}

interface EmergencyCancelModalProps {
  scheduleId?: string;
  bookingId?: string;
  sessionTitle: string;
  sessionTime: string;
  isOpen: boolean;
  onClose: () => void;
}

export const EmergencyCancelModal: React.FC<EmergencyCancelModalProps> = ({
  scheduleId,
  bookingId,
  sessionTitle,
  sessionTime,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useNotification();
  const [reasonMessage, setReasonMessage] = useState<string>('');
  const [internalNote, setInternalNote] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [successText, setSuccessText] = useState<string>('');
  const [hasConflict, setHasConflict] = useState<boolean>(false);

  // Fetch coach's cancellation requests to see if one already exists for this session
  const {
    data: cancellationRequests = [],
    isLoading: isLoadingRequests,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['coach', 'cancellation-requests'],
    queryFn: () => coachPortalApi.getMyCancellationRequests(),
    enabled: isOpen,
  });

  const pendingRequest = cancellationRequests.find((r) => {
    if (r.status !== 'PENDING') return false;
    if (scheduleId && r.scheduleId === scheduleId) return true;
    if (bookingId && r.bookingId === bookingId) return true;
    return false;
  });

  const isPendingExists = Boolean(pendingRequest) || hasConflict;
  const isReasonValid = reasonMessage.trim().length >= 20;

  // Mutation to submit new cancellation request
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!scheduleId && !bookingId) {
        throw new Error(CANCEL_ERROR_MAP.EXACTLY_ONE_CANCELLATION_TARGET);
      }
      if (!isReasonValid) {
        throw new Error(CANCEL_ERROR_MAP.CANCELLATION_REASON_TOO_SHORT);
      }
      return coachPortalApi.requestEmergencyCancel({
        scheduleId: scheduleId && bookingId ? undefined : scheduleId,
        bookingId: scheduleId && bookingId ? undefined : bookingId,
        reasonMessage: reasonMessage.trim(),
        internalNote: internalNote.trim() || undefined,
      });
    },
    onSuccess: async () => {
      setIsSuccess(true);
      const msg = 'Đã gửi yêu cầu thành công! Yêu cầu đang ở trạng thái Chờ duyệt bởi Ban Quản Lý / Lễ tân.';
      setSuccessText(msg);
      showToast('success', 'Đã gửi yêu cầu hủy lịch', msg);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['coach', 'cancellation-requests'] }),
      ]);
      setTimeout(() => {
        setIsSuccess(false);
        setReasonMessage('');
        setInternalNote('');
        onClose();
      }, 1800);
    },
    onError: (err: any) => {
      const raw = err.response?.data?.message || err.message || 'Lỗi khi gửi yêu cầu hủy lịch';
      const rawStr = Array.isArray(raw) ? raw.join(', ') : String(raw);
      if (rawStr.includes('CANCELLATION_REQUEST_EXISTS')) {
        setHasConflict(true);
        void refetchRequests();
        setErrorMessage(null);
        showToast('warning', 'Đã có yêu cầu trước đó', CANCEL_ERROR_MAP.CANCELLATION_REQUEST_EXISTS);
      } else {
        const translated = translateCancelError(raw);
        setErrorMessage(translated);
        showToast('error', 'Không thể hủy lịch', translated);
      }
    },
  });

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-6 py-4 ${
            isPendingExists ? 'border-amber-100 bg-amber-50/70' : 'border-rose-100 bg-rose-50/70'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`h-8 w-8 rounded-lg text-white flex items-center justify-center ${
                isPendingExists ? 'bg-amber-500' : 'bg-rose-600'
              }`}
            >
              {isPendingExists ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            </div>
            <div>
              <h3 className={`text-base font-bold ${isPendingExists ? 'text-amber-950' : 'text-rose-950'}`}>
                {isPendingExists ? 'Yêu Cầu Xin Nghỉ Đang Chờ Duyệt' : 'Báo Hủy Lịch Dạy Khẩn Cấp'}
              </h3>
              <p className={`text-xs ${isPendingExists ? 'text-amber-700' : 'text-rose-700'}`}>
                {isPendingExists
                  ? 'Hiện bạn đang xin nghỉ ca này'
                  : 'Quy trình phê duyệt 2 tầng & Bảo vệ quyền lợi hội viên'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {isSuccess ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="text-base font-bold text-slate-900">Thao tác thành công!</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                {successText || 'Dữ liệu đã được cập nhật thành công.'}
              </p>
            </div>
          ) : isPendingExists ? (
            /* TRƯỜNG HỢP: ĐÃ CÓ REQUEST HỦY / CANCELLATION_REQUEST_EXISTS */
            <div className="space-y-4">
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Target Session Info */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Ca dạy:
                </span>
                <p className="text-sm font-bold text-slate-900">{sessionTitle}</p>
                <p className="text-xs text-emerald-700 font-semibold">{sessionTime}</p>
              </div>

              {/* Ô BÁO: Hiện bạn đang xin nghỉ ca này */}
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-4 space-y-3 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-amber-950">
                        Hiện bạn đang xin nghỉ ca này
                      </h4>
                      <span className="inline-block mt-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-black uppercase">
                        Trạng thái: Đang chờ duyệt
                      </span>
                    </div>
                  </div>
                  {pendingRequest?.createdAt && (
                    <span className="text-[11px] text-amber-800 font-medium">
                      {new Date(pendingRequest.createdAt).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      ({new Date(pendingRequest.createdAt).toLocaleDateString('vi-VN')})
                    </span>
                  )}
                </div>

                {pendingRequest?.reasonMessage && (
                  <div className="rounded-xl bg-white/90 border border-amber-200 p-3 space-y-1 text-xs">
                    <span className="text-slate-500 text-[10px] font-bold block uppercase tracking-wider">
                      Lời nhắn gửi học viên:
                    </span>
                    <p className="italic text-slate-800 font-medium leading-relaxed">
                      "{pendingRequest.reasonMessage}"
                    </p>
                    {pendingRequest.internalNote && (
                      <p className="text-[11px] text-slate-600 pt-1.5 border-t border-slate-100">
                        <strong>Ghi chú nội bộ:</strong> {pendingRequest.internalNote}
                      </p>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-amber-900 leading-relaxed bg-amber-100/70 p-2.5 rounded-xl border border-amber-200/80 flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <span>
                    Yêu cầu hủy ca đã được ghi nhận và mở cho HLV khác nhận dạy thay. Sau khi gửi, HLV <strong>không thể rút lại</strong> yêu cầu này.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* TRƯỜNG HỢP: FORM NỘP ĐƠN HỦY KHẨN CẤP MỚI */
            <>
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Target Session Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  Ca dạy yêu cầu hủy:
                </span>
                <p className="text-sm font-bold text-slate-900">{sessionTitle}</p>
                <p className="text-xs text-emerald-700 font-semibold">{sessionTime}</p>
              </div>

              {/* Policy Note Alert */}
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Lưu ý khi gửi yêu cầu:</p>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    HLV không thể tự hủy trực tiếp. Yêu cầu sẽ tạo bản ghi chờ duyệt. 100% học viên bị ảnh hưởng sẽ được hệ thống hoàn đủ 01 lượt tập.
                  </p>
                </div>
              </div>

              {/* Reason Message Field (Apology for Member - Required >= 20 chars) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Lời nhắn gửi học viên (Bắt buộc tối thiểu 20 ký tự) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={reasonMessage}
                  onChange={(e) => setReasonMessage(e.target.value)}
                  placeholder="Ví dụ: Rất xin lỗi quý học viên, HLV có sự cố sức khỏe đột xuất không thể đứng lớp ca này..."
                  rows={3}
                  className={`w-full rounded-xl border p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 resize-none transition-all ${
                    reasonMessage.length > 0 && !isReasonValid
                      ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-500/20'
                  }`}
                />
                <div className="flex items-center justify-between text-[11px] mt-1">
                  <span
                    className={
                      isReasonValid
                        ? 'text-emerald-600 font-semibold flex items-center gap-1'
                        : 'text-amber-600'
                    }
                  >
                    {isReasonValid
                      ? '✓ Đạt độ dài tối thiểu'
                      : `Cần thêm ít nhất ${Math.max(0, 20 - reasonMessage.trim().length)} ký tự nữa`}
                  </span>
                  <span className="text-slate-400">{reasonMessage.trim().length}/20 ký tự</span>
                </div>
              </div>

              {/* Internal Note for Center Manager */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Ghi chú nội bộ cho Quản lý / Lễ tân (Tùy chọn)
                </label>
                <input
                  type="text"
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Ví dụ: Đã báo lễ tân trực quầy hỗ trợ đổi lớp khác cho khách..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!isSuccess && (
          <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitMutation.isPending}
              className="text-xs font-semibold cursor-pointer"
            >
              Đóng
            </Button>

            {!isPendingExists && (
              <Button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={!isReasonValid || submitMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold gap-1.5 disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {submitMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Gửi đơn xin hủy khẩn cấp</span>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
