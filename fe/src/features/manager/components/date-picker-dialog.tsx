import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, Check, Clock } from 'lucide-react';
import { formatDay, vnDay, addDaysToDay } from '../lib/format';

interface DatePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  title: string;
  minDate?: string;
  maxDate?: string;
}

const MONTH_NAMES = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const DatePickerDialog: React.FC<DatePickerDialogProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  title,
  minDate,
  maxDate,
}) => {
  const today = useMemo(() => vnDay(), []);

  // Parse initial year & month from value or today
  const [selectedDay, setSelectedDay] = useState(value || today);
  const [viewYear, setViewYear] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth();
  });

  // Keep local state in sync when dialog opens
  useEffect(() => {
    if (isOpen) {
      const initial = value || today;
      setSelectedDay(initial);
      const [y, m] = initial.split('-').map(Number);
      if (y && m) {
        setViewYear(y);
        setViewMonth(m - 1);
      }
    }
  }, [isOpen, value, today]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Build grid of days
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
    // getUTCDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
    // We want Monday = 0, Sunday = 6
    const startWeekday = (firstDayOfMonth.getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
    const daysInPrevMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();

    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 0 ? 12 : viewMonth;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: true });
    }

    // Next month padding to fill complete grid of 35 or 42
    const totalSoFar = cells.length;
    const targetTotal = totalSoFar <= 35 ? 35 : 42;
    const nextDaysNeeded = targetTotal - totalSoFar;
    for (let d = 1; d <= nextDaysNeeded; d++) {
      const nextM = viewMonth === 11 ? 1 : viewMonth + 2;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ dateStr, dayNum: d, isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const handleSelect = (dateStr: string) => {
    setSelectedDay(dateStr);
  };

  const handleApply = () => {
    onChange(selectedDay);
    onClose();
  };

  // Quick preset shortcuts
  const applyPreset = (presetDate: string) => {
    setSelectedDay(presetDate);
    const [y, m] = presetDate.split('-').map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  };

  const startOfMonth = `${today.slice(0, 7)}-01`;
  const sevenDaysAgo = addDaysToDay(today, -6);
  const fourteenDaysAgo = addDaysToDay(today, -13);
  const thirtyDaysAgo = addDaysToDay(today, -29);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-[#17664e] dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</h3>
              <p className="text-xs text-[#17664e] dark:text-emerald-400 font-bold mt-0.5">
                Đang chọn: {formatDay(selectedDay)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Chọn nhanh
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => applyPreset(today)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                selectedDay === today
                  ? 'bg-[#17664e] text-white border-[#17664e]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => applyPreset(startOfMonth)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                selectedDay === startOfMonth
                  ? 'bg-[#17664e] text-white border-[#17664e]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              Đầu tháng này
            </button>
            <button
              type="button"
              onClick={() => applyPreset(sevenDaysAgo)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                selectedDay === sevenDaysAgo
                  ? 'bg-[#17664e] text-white border-[#17664e]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              7 ngày trước
            </button>
            <button
              type="button"
              onClick={() => applyPreset(fourteenDaysAgo)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                selectedDay === fourteenDaysAgo
                  ? 'bg-[#17664e] text-white border-[#17664e]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              14 ngày trước
            </button>
            <button
              type="button"
              onClick={() => applyPreset(thirtyDaysAgo)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer border ${
                selectedDay === thirtyDaysAgo
                  ? 'bg-[#17664e] text-white border-[#17664e]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
              }`}
            >
              30 ngày trước
            </button>
          </div>
        </div>

        {/* Month & Year Navigation */}
        <div className="flex items-center justify-between border-y border-slate-100 dark:border-slate-800 py-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-black text-slate-900 dark:text-slate-100">
            {MONTH_NAMES[viewMonth]}, {viewYear}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="space-y-1">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 mb-1">
            {WEEK_DAYS.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((cell) => {
              const isSelected = cell.dateStr === selectedDay;
              const isToday = cell.dateStr === today;
              const isOutOfRange =
                (minDate && cell.dateStr < minDate) || (maxDate && cell.dateStr > maxDate);

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  disabled={Boolean(isOutOfRange)}
                  onClick={() => handleSelect(cell.dateStr)}
                  className={`h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer relative ${
                    isOutOfRange
                      ? 'opacity-30 cursor-not-allowed text-slate-300 dark:text-slate-600'
                      : isSelected
                      ? 'bg-[#17664e] text-white shadow-xs font-black z-10 scale-105'
                      : !cell.isCurrentMonth
                      ? 'text-slate-300 dark:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700'
                  } ${isToday && !isSelected ? 'border border-emerald-500/80 text-emerald-700 font-black' : ''}`}
                >
                  <span>{cell.dayNum}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-600" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Native Input Fallback for manual typing */}
        <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
          <label className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Hoặc nhập ngày:</span>
          </label>
          <input
            type="date"
            value={selectedDay}
            onChange={(e) => {
              if (e.target.value) {
                applyPreset(e.target.value);
              }
            }}
            className="text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 bg-white dark:bg-slate-800 focus:outline-none focus:border-emerald-600"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17664e] text-white hover:bg-[#135641] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Áp dụng ngày này</span>
          </button>
        </div>
      </div>
    </div>
  );
};
