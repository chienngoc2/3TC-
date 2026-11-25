import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, ArrowRight, Copy, CheckCircle2 } from 'lucide-react';
import { managerApi, managerKeys } from '../api/manager-api';
import { addDaysToDay, formatDay } from '../lib/format';

interface FridayCloneShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeek: string; // YYYY-MM-DD Monday
  shiftCountThisWeek: number;
}

export const FridayCloneShiftModal: React.FC<FridayCloneShiftModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  shiftCountThisWeek,
}) => {
  const queryClient = useQueryClient();
  const nextWeek = addDaysToDay(currentWeek, 7);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      return await managerApi.cloneWeeklyShifts({
        sourceWeekStart: currentWeek,
        targetWeekStart: nextWeek,
      });
    },
    onSuccess: (res) => {
      setSuccessResult(res.clonedCount);
      void queryClient.invalidateQueries({ queryKey: managerKeys.shifts });
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi sao chép lịch làm việc tuần tới.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Lên Lịch Tuần Tới (Thứ 6)</h2>
              <p className="text-xs text-slate-500">Cơ chế xếp lịch định kỳ theo chu kỳ tuần</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {successResult !== null ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-900">
                Đã sao chép thành công {successResult} ca trực!
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Toàn bộ ca trực của tuần {formatDay(nextWeek)} đã được thiết lập sẵn sàng.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
              >
                Đóng
              </button>
            </div>
          ) : (
            <>
              {errorMessage && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
                  {errorMessage}
                </div>
              )}

              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống sẽ <strong>nhân bản toàn bộ các ca làm việc của toàn bộ nhân sự</strong> từ tuần nguồn sang tuần đích kế tiếp, tự động giữ nguyên nhân viên, khung giờ trực và ghi chú.
              </p>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-left">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Tuần Nguồn</span>
                  <p className="text-xs font-bold text-slate-800">{formatDay(currentWeek)}</p>
                  <p className="text-[11px] text-slate-500">{shiftCountThisWeek} ca trực</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <ArrowRight className="h-4 w-4" />
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Tuần Đích</span>
                  <p className="text-xs font-bold text-emerald-800">{formatDay(nextWeek)}</p>
                  <p className="text-[11px] text-emerald-600 font-medium">+ Tuần tiếp theo</p>
                </div>
              </div>

              <div className="rounded-xl bg-amber-50/70 border border-amber-200/80 p-3 text-[11px] text-amber-800">
                💡 <strong>Lưu ý:</strong> Các ca làm việc đã tồn tại ở tuần tới sẽ được bỏ qua để tránh trùng lặp.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={mutation.isPending}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => mutation.mutate()}
                  disabled={mutation.isPending || shiftCountThisWeek === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {mutation.isPending ? 'Đang sao chép...' : 'Sao Chép Sang Tuần Tới'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
