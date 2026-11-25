import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UnifiedCoachSession } from '../types/coach-portal.types';

interface ScheduleDatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string; // YYYY-MM-DD
  weekOffset: number;
  onSelectDateAndWeek: (dateStr: string, newWeekOffset: number) => void;
  sessionsByDate: Map<string, UnifiedCoachSession[]>;
}

export const ScheduleDatePickerModal: React.FC<ScheduleDatePickerModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onSelectDateAndWeek,
  sessionsByDate,
}) => {
  // Current month view state
  const [viewDate, setViewDate] = useState<Date>(() => {
    return selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date();
  });

  // Keep track of temporarily selected date inside modal
  const [modalSelectedDate, setModalSelectedDate] = useState<string>(selectedDate);

  // Sync when modal opens or selectedDate changes
  React.useEffect(() => {
    if (isOpen) {
      setModalSelectedDate(selectedDate);
      if (selectedDate) {
        setViewDate(new Date(`${selectedDate}T00:00:00`));
      }
    }
  }, [isOpen, selectedDate]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Compute month calendar grid
  const monthData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Vietnam Monday as start of week: Day 0 = Sunday (distance = 6), Day 1 = Mon (0)...
    const firstDayWeekday = firstDayOfMonth.getDay();
    const leadingDaysCount = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1;

    const days = [];

    // Leading days from previous month
    for (let i = leadingDaysCount; i > 0; i--) {
      const d = new Date(year, month, 1 - i);
      const iso = d.toISOString().split('T')[0];
      days.push({
        date: d,
        iso,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: iso === todayStr,
      });
    }

    // Days of current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const iso = d.toISOString().split('T')[0];
      days.push({
        date: d,
        iso,
        dayNum: i,
        isCurrentMonth: true,
        isToday: iso === todayStr,
      });
    }

    // Trailing days from next month to make grid complete 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = d.toISOString().split('T')[0];
      days.push({
        date: d,
        iso,
        dayNum: i,
        isCurrentMonth: false,
        isToday: iso === todayStr,
      });
    }

    return {
      year,
      month,
      monthLabel: `Tháng ${month + 1}, ${year}`,
      days,
    };
  }, [viewDate, todayStr]);

  // Calculate week offset relative to today's Monday
  const calculateWeekOffsetForDate = (targetIso: string): number => {
    const now = new Date();
    const currentDay = now.getDay();
    const distToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() + distToMonday);
    currentMonday.setHours(0, 0, 0, 0);

    const target = new Date(`${targetIso}T00:00:00`);
    const targetDay = target.getDay();
    const targetDistToMonday = targetDay === 0 ? -6 : 1 - targetDay;
    const targetMonday = new Date(target);
    targetMonday.setDate(target.getDate() + targetDistToMonday);
    targetMonday.setHours(0, 0, 0, 0);

    const diffMs = targetMonday.getTime() - currentMonday.getTime();
    return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  };

  const handleApplyDate = (targetIso: string) => {
    const newOffset = calculateWeekOffsetForDate(targetIso);
    onSelectDateAndWeek(targetIso, newOffset);
    onClose();
  };

  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleJumpToToday = () => {
    setViewDate(new Date());
    handleApplyDate(todayStr);
  };

  const handleJumpToOffset = (offsetWeeks: number) => {
    const now = new Date();
    const currentDay = now.getDay();
    const distToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + distToMonday + offsetWeeks * 7);
    const iso = targetDate.toISOString().split('T')[0];
    setViewDate(targetDate);
    handleApplyDate(iso);
  };

  // Compute sessions on currently selected date in modal
  const selectedDaySessions = useMemo(() => {
    return sessionsByDate.get(modalSelectedDate) || [];
  }, [sessionsByDate, modalSelectedDate]);

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col my-auto relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-emerald-50/80 via-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Chọn Lịch Giảng Dạy & Xem Ngày
              </h3>
              <p className="text-xs text-slate-500">
                Nhấp vào ngày để chuyển ngay đến tuần và ngày tương ứng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Đi nhanh:
            </span>
            <button
              type="button"
              onClick={handleJumpToToday}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition-all flex items-center gap-1"
            >
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Hôm nay</span>
            </button>
            <button
              type="button"
              onClick={() => handleJumpToOffset(0)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
            >
              Tuần này
            </button>
            <button
              type="button"
              onClick={() => handleJumpToOffset(1)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
            >
              Tuần tới (+1)
            </button>
            <button
              type="button"
              onClick={() => handleJumpToOffset(2)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
            >
              2 tuần tới (+2)
            </button>
          </div>

          {/* Month Navigation Bar */}
          <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevMonth}
              className="h-8 w-8 p-0 border-slate-200 hover:bg-white text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <span className="text-sm font-black text-slate-900 tracking-tight">
                {monthData.monthLabel}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              className="h-8 w-8 p-0 border-slate-200 hover:bg-white text-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w, idx) => (
              <div
                key={w}
                className={`py-1 text-[11px] font-black uppercase tracking-wider ${
                  idx >= 5 ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthData.days.map((item) => {
              const sessions = sessionsByDate.get(item.iso) || [];
              const sessionCount = sessions.length;
              const hasClasses = sessions.some((s) => s.type === 'GROUP_CLASS');
              const hasPt = sessions.some((s) => s.type === 'PERSONAL_TRAINING');

              const isSelected = item.iso === modalSelectedDate;
              const isToday = item.isToday;

              return (
                <button
                  key={item.iso}
                  type="button"
                  onClick={() => setModalSelectedDate(item.iso)}
                  onDoubleClick={() => handleApplyDate(item.iso)}
                  className={`group relative flex flex-col items-center justify-between min-h-[58px] p-1.5 rounded-xl border text-xs transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-md ring-2 ring-emerald-500/20 z-10 scale-[1.03]'
                      : isToday
                      ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold hover:bg-emerald-100/70'
                      : item.isCurrentMonth
                      ? 'border-slate-200/80 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                      : 'border-slate-100 bg-slate-50/50 text-slate-400 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full px-0.5">
                    <span
                      className={`text-[11px] font-bold ${
                        isSelected
                          ? 'text-white'
                          : isToday
                          ? 'text-emerald-700 font-extrabold'
                          : item.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.dayNum}
                    </span>

                    {isToday && !isSelected && (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold bg-emerald-600 text-white px-1 rounded-sm">
                        Nay
                      </span>
                    )}
                  </div>

                  {/* Session Dot Badges */}
                  <div className="flex items-center justify-center gap-1 w-full my-auto">
                    {sessionCount > 0 ? (
                      <div className="flex items-center gap-0.5">
                        {hasClasses && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isSelected ? 'bg-blue-300' : 'bg-blue-600'
                            }`}
                            title="Có lớp nhóm"
                          />
                        )}
                        {hasPt && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isSelected ? 'bg-amber-300' : 'bg-amber-600'
                            }`}
                            title="Có ca PT"
                          />
                        )}
                        <span
                          className={`text-[9px] font-mono font-bold leading-none ml-0.5 ${
                            isSelected ? 'text-emerald-300' : 'text-slate-600'
                          }`}
                        >
                          {sessionCount}
                        </span>
                      </div>
                    ) : (
                      <span className="h-1.5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend and Selected Date Preview Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Ngày đang chọn:
                </span>
                <span className="text-xs font-extrabold text-slate-900">
                  {new Date(`${modalSelectedDate}T00:00:00`).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                  Lớp nhóm
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-600 inline-block" />
                  PT 1-1
                </span>
              </div>
            </div>

            {/* Quick summary of sessions on selected day */}
            <div className="text-xs text-slate-600">
              {selectedDaySessions.length > 0 ? (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    Có <strong>{selectedDaySessions.length} ca dạy</strong> (
                    {selectedDaySessions.filter((s) => s.type === 'GROUP_CLASS').length} lớp nhóm,{' '}
                    {selectedDaySessions.filter((s) => s.type === 'PERSONAL_TRAINING').length} PT 1-1).
                  </span>
                </div>
              ) : (
                <p className="text-slate-400 italic">
                  Không có ca dạy hay slot rảnh nào được lên lịch cho ngày này.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold"
          >
            Đóng
          </Button>

          <Button
            type="button"
            onClick={() => handleApplyDate(modalSelectedDate)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 shadow-sm shadow-emerald-600/20"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Xem Lịch Ngày Này</span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
