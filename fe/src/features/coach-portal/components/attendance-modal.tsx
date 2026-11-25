import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, X, FileText, Loader2, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { coachPortalApi } from '../api/coach-portal-api';
import type { StudentBookingItem, AttendanceStatus } from '../types/coach-portal.types';

interface AttendanceModalProps {
  booking: StudentBookingItem;
  sessionStartTime?: string;
  sessionEndTime?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  booking,
  sessionStartTime,
  sessionEndTime,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const currentAttendance = booking.attendance;

  const isNotStarted = Boolean(
    sessionStartTime && new Date(sessionStartTime).getTime() > Date.now()
  );

  // Backend rule: referenceTime = existing?.checkInTime ?? session.endTime, window = 86400000 ms (24h)
  const referenceTime = currentAttendance?.checkInTime ?? sessionEndTime;
  const isEditWindowClosed = Boolean(
    referenceTime && Date.now() - new Date(referenceTime).getTime() > 86400000
  );
  const isCancelled = booking.status === 'CANCELLED';

  const initialStatus: AttendanceStatus = (() => {
    const s = currentAttendance?.status;
    if (s === 'PRESENT' || s === 'ATTENDED') return 'PRESENT';
    if (s === 'LATE') return 'LATE';
    if (s === 'ABSENT') return 'ABSENT';
    return 'PRESENT';
  })();

  const [status, setStatus] = useState<AttendanceStatus>(initialStatus);
  const [notes, setNotes] = useState<string>(currentAttendance?.notes || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isNotStarted) {
        throw new Error(
          'Ca tập chưa đến giờ bắt đầu. Vui lòng quay lại điểm danh khi buổi học diễn ra.'
        );
      }
      if (isEditWindowClosed) {
        throw new Error(
          'Đã hết thời hạn chỉnh sửa điểm danh (quá 24 giờ sau khi kết thúc ca).'
        );
      }
      if (currentAttendance?.id) {
        return coachPortalApi.updateCheckin(currentAttendance.id, {
          status,
          notes: notes.trim() || undefined,
        });
      }
      return coachPortalApi.classCheckin({
        bookingId: booking.id,
        status,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] }),
        queryClient.invalidateQueries({ queryKey: ['coach', 'member-attendances'] }),
      ]);
      onClose();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi lưu điểm danh';
      const formatted =
        typeof msg === 'string'
          ? msg.includes('SESSION_NOT_STARTED')
            ? 'Ca tập chưa đến giờ bắt đầu. Vui lòng quay lại điểm danh khi buổi học diễn ra.'
            : msg.includes('ATTENDANCE_EDIT_WINDOW_CLOSED') || msg.includes('24')
            ? 'Đã hết thời hạn chỉnh sửa điểm danh (quá 24 giờ sau khi kết thúc ca theo quy định hệ thống).'
            : msg
          : JSON.stringify(msg);
      setErrorMessage(formatted);
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
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Điểm danh & Nhật ký buổi tập</h3>
            <p className="text-xs text-slate-500">
              Học viên: {booking.member?.fullName || 'Học viên'}
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isCancelled && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>Lịch đặt chỗ của học viên này đã bị hủy. Không thể thực hiện điểm danh.</span>
            </div>
          )}

          {isNotStarted && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">Ca tập chưa đến giờ bắt đầu</p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Theo quy định hệ thống, tính năng điểm danh chỉ được mở khi buổi tập chính thức bắt đầu (từ{' '}
                  {sessionStartTime
                    ? new Date(sessionStartTime).toLocaleTimeString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                  ). Bạn có thể xem trước thông tin học viên tại đây.
                </p>
              </div>
            </div>
          )}

          {isEditWindowClosed && (
            <div className="flex items-start gap-2.5 rounded-xl bg-slate-100 border border-slate-300 p-3 text-xs text-slate-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-slate-500 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-slate-800">Đã hết thời hạn chỉnh sửa điểm danh</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Ca dạy đã kết thúc quá 24 giờ. Hệ thống đã khóa chức năng điểm danh và chuyển sang chế độ chỉ xem.
                </p>
              </div>
            </div>
          )}

          {/* Member Summary */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
            <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm uppercase overflow-hidden shrink-0">
              {booking.member?.avatarUrl ? (
                <img
                  src={booking.member.avatarUrl}
                  alt={booking.member?.fullName || 'Học viên'}
                  className="h-full w-full object-cover"
                />
              ) : (
                booking.member?.fullName?.charAt(0) || 'H'
              )}
            </div>
            <div className="text-xs min-w-0">
              <p className="font-bold text-slate-900 truncate">
                {booking.member?.fullName || 'Học viên'}
              </p>
              <p className="text-slate-500">{booking.member?.phone || 'Chưa có SĐT'}</p>
              {booking.member?.memberProfile?.fitnessGoals &&
                !['null', 'undefined', '{}', '[]'].includes(
                  String(booking.member.memberProfile.fitnessGoals).trim().toLowerCase()
                ) && (
                  <p className="text-[11px] text-emerald-800 mt-0.5 line-clamp-1">
                    Mục tiêu: {booking.member.memberProfile.fitnessGoals}
                  </p>
                )}
            </div>
          </div>

          {/* Attendance Status Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              Trạng thái có mặt
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setStatus('PRESENT')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer ${
                  status === 'PRESENT' || status === 'ATTENDED'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Có mặt</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('LATE')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer ${
                  status === 'LATE'
                    ? 'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Clock className="h-4 w-4 text-amber-600" />
                <span>Đi muộn</span>
              </button>

              <button
                type="button"
                disabled={isEditWindowClosed}
                onClick={() => setStatus('ABSENT')}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition-all cursor-pointer ${
                  status === 'ABSENT'
                    ? 'border-rose-500 bg-rose-50 text-rose-800 ring-2 ring-rose-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <X className="h-4 w-4 text-rose-600" />
                <span>Vắng mặt</span>
              </button>
            </div>
          </div>

          {/* Tracking Log / Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-slate-500" />
              Nhật ký tập luyện & Nhận xét của HLV
            </label>
            <textarea
              value={notes}
              disabled={isEditWindowClosed}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chép thể lực, mức tạ, kỹ thuật động tác hoặc nhận xét sau buổi tập..."
              rows={4}
              maxLength={2000}
              className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 resize-none transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-400 text-right mt-1">
              {notes.length}/2000 ký tự
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={mutation.isPending}
            className="text-xs font-semibold"
          >
            Đóng
          </Button>
          <Button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={isNotStarted || isEditWindowClosed || mutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 disabled:opacity-50"
          >
            {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>
              {isNotStarted
                ? 'Chưa đến giờ tập'
                : isEditWindowClosed
                ? 'Đã khóa điểm danh (>24h)'
                : 'Lưu điểm danh'}
            </span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};