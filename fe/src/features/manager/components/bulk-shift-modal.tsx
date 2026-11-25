import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Sparkles } from 'lucide-react';
import { managerApi, managerKeys } from '../api/manager-api';
import type { ShiftPayload, UserRow } from '../types/manager.types';
import { addDaysToDay, vnInstant } from '../lib/format';

interface BulkShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: UserRow[];
  currentWeek: string; // YYYY-MM-DD Monday
}

const PRESET_SHIFTS = [
  { label: 'Ca Sáng (06:00 - 14:00)', start: '06:00', end: '14:00', note: 'Ca trực quầy sáng' },
  { label: 'Ca Chiều (14:00 - 22:00)', start: '14:00', end: '22:00', note: 'Ca trực quầy tối' },
  { label: 'Ca Hành Chính (08:00 - 17:00)', start: '08:00', end: '17:00', note: 'Ca hành chính' },
];

const WEEKDAY_NAMES = [
  { offset: 0, label: 'Thứ 2' },
  { offset: 1, label: 'Thứ 3' },
  { offset: 2, label: 'Thứ 4' },
  { offset: 3, label: 'Thứ 5' },
  { offset: 4, label: 'Thứ 6' },
  { offset: 5, label: 'Thứ 7' },
  { offset: 6, label: 'Chủ nhật' },
];

export const BulkShiftModal: React.FC<BulkShiftModalProps> = ({
  isOpen,
  onClose,
  staffList,
  currentWeek,
}) => {
  const queryClient = useQueryClient();
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4]); // default T2-T6
  const [startTime, setStartTime] = useState<string>('06:00');
  const [endTime, setEndTime] = useState<string>('14:00');
  const [notes, setNotes] = useState<string>('Ca trực quầy sáng');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set default staff when opening
  React.useEffect(() => {
    if (staffList.length > 0 && !selectedStaffId) {
      const activeReceptionist = staffList.find((s) => s.role === 'RECEPTIONIST' && s.isActive);
      setSelectedStaffId(activeReceptionist ? activeReceptionist.id : staffList[0].id);
    }
  }, [staffList, selectedStaffId]);

  const toggleDay = (offset: number) => {
    setSelectedDays((prev) =>
      prev.includes(offset) ? prev.filter((d) => d !== offset) : [...prev, offset].sort((a, b) => a - b)
    );
  };

  const applyPreset = (preset: typeof PRESET_SHIFTS[0]) => {
    setStartTime(preset.start);
    setEndTime(preset.end);
    setNotes(preset.note);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedStaffId) throw new Error('Vui lòng chọn nhân viên xếp ca.');
      if (selectedDays.length === 0) throw new Error('Vui lòng chọn ít nhất 1 ngày trong tuần.');
      if (startTime >= endTime) throw new Error('Giờ bắt đầu phải trước giờ kết thúc.');

      const shifts: ShiftPayload[] = selectedDays.map((offset) => {
        const dayStr = addDaysToDay(currentWeek, offset);
        return {
          staffId: selectedStaffId,
          shiftDate: dayStr,
          startTime: vnInstant(dayStr, startTime),
          endTime: vnInstant(dayStr, endTime),
          notes: notes.trim() || undefined,
        };
      });

      return await managerApi.createShiftsBulk({ shifts });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: managerKeys.shifts });
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err?.message || 'Có lỗi xảy ra khi tạo ca trực hàng loạt.');
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Xếp Ca Làm Việc Hàng Loạt</h2>
              <p className="text-xs text-slate-500">Áp dụng cho tuần bắt đầu từ {currentWeek}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {errorMessage && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-medium text-rose-700">
              {errorMessage}
            </div>
          )}

          {/* 1. Chọn Nhân viên */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Chọn Nhân Viên
            </label>
            <div className="relative">
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              >
                {staffList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.fullName} ({st.role === 'RECEPTIONIST' ? 'Lễ tân' : 'HLV'}) - {st.phone || st.email}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Chọn Các Ngày Trong Tuần */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Chọn Các Ngày Áp Dụng
              </label>
              <div className="flex items-center gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedDays([0, 1, 2, 3, 4])}
                  className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-200"
                >
                  T2 - T6
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([5, 6])}
                  className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-200"
                >
                  T7 - CN
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                  className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600 hover:bg-slate-200"
                >
                  Cả tuần
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_NAMES.map(({ offset, label }) => {
                const isSelected = selectedDays.includes(offset);
                return (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => toggleDay(offset)}
                    className={`flex flex-col items-center justify-center rounded-xl border py-2.5 px-1 text-center transition-all ${
                      isSelected
                        ? 'border-primary bg-primary text-white font-bold shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <span className="text-xs">{label}</span>
                    <span className="text-[10px] opacity-80 mt-0.5">
                      {addDaysToDay(currentWeek, offset).slice(5)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Ca Mẫu Nhanh */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              3. Chọn Khung Ca Mẫu
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PRESET_SHIFTS.map((ps) => {
                const isActive = startTime === ps.start && endTime === ps.end;
                return (
                  <button
                    key={ps.label}
                    type="button"
                    onClick={() => applyPreset(ps)}
                    className={`rounded-xl border p-2.5 text-left text-xs transition-all ${
                      isActive
                        ? 'border-primary/80 bg-primary/5 text-primary font-bold shadow-xs ring-1 ring-primary/20'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <p className="font-semibold">{ps.start} - {ps.end}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{ps.note}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Giờ Bắt Đầu - Kết Thúc & Ghi Chú */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Giờ bắt đầu</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Giờ kết thúc</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú ca trực</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Trực quầy A, bàn giao quỹ lúc 14h..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-primary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <p className="text-xs text-slate-500">
            Sẽ tạo <strong>{selectedDays.length} ca trực</strong> trong tuần.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || selectedDays.length === 0}
              className="rounded-xl bg-primary px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Đang tạo...' : `Xác Nhận Tạo (${selectedDays.length} Ca)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
