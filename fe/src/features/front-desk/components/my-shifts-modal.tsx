import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Calendar, ChevronLeft, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import { getMyShifts } from '../services/front-desk-api.service';

interface MyShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const weekdays = [
  { key: 1, label: 'Thứ 2' },
  { key: 2, label: 'Thứ 3' },
  { key: 3, label: 'Thứ 4' },
  { key: 4, label: 'Thứ 5' },
  { key: 5, label: 'Thứ 6' },
  { key: 6, label: 'Thứ 7' },
  { key: 0, label: 'Chủ nhật' },
];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, days: number): Date {
  const res = new Date(d);
  res.setDate(res.getDate() + days);
  return res;
}

function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export const MyShiftsModal: React.FC<MyShiftsModalProps> = ({ isOpen, onClose }) => {
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));

  const { data: shifts = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['receptionist', 'my-shifts'],
    queryFn: getMyShifts,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const now = new Date();
  const weekDays = [0, 1, 2, 3, 4, 5, 6].map((offset) => {
    const d = addDays(currentMonday, offset);
    return {
      date: d,
      dateStr: d.toISOString().slice(0, 10),
      label: weekdays[offset].label,
      displayDate: formatDate(d),
      isToday: d.toDateString() === now.toDateString(),
    };
  });

  const sunday = addDays(currentMonday, 6);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex w-full max-w-5xl flex-col rounded-none bg-white shadow-2xl overflow-hidden border-2 border-slate-900 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-none bg-primary/10 text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Lịch Trực Quầy Của Tôi</h2>
              <p className="text-xs text-slate-500">
                Tuần từ {formatDate(currentMonday)} đến {formatDate(sunday)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-none p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentMonday((m) => addDays(m, -7))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Tuần trước
            </button>
            <button
              onClick={() => setCurrentMonday(getMonday(new Date()))}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Tuần này
            </button>
            <button
              onClick={() => setCurrentMonday((m) => addDays(m, 7))}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Tuần sau
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-xs font-semibold text-slate-500">
            Tổng số ca: {shifts.filter((s) => {
              const d = new Date(s.startTime);
              return d >= currentMonday && d <= addDays(sunday, 1);
            }).length} ca trực
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-slate-500">
              Đang tải lịch trực...
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 text-rose-500 mb-2" />
              <p className="text-sm font-medium text-slate-700">Không thể tải lịch trực</p>
              <button
                onClick={() => void refetch()}
                className="mt-3 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {weekDays.map((col) => {
                const dayShifts = shifts.filter((s) => {
                  const shiftD = new Date(s.startTime).toISOString().slice(0, 10);
                  return shiftD === col.dateStr;
                });

                return (
                  <div
                    key={col.dateStr}
                    className={`flex flex-col rounded-xl border p-3 min-h-[160px] transition-all ${
                      col.isToday
                        ? 'border-primary/50 bg-primary/5 shadow-sm'
                        : 'border-slate-200/80 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 mb-2">
                      <span className={`text-xs font-bold ${col.isToday ? 'text-primary' : 'text-slate-700'}`}>
                        {col.label}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        {col.displayDate}
                      </span>
                    </div>

                    <div className="flex-1 space-y-2">
                      {dayShifts.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-[11px] font-medium text-slate-400 py-6">
                          Nghỉ
                        </div>
                      ) : (
                        dayShifts.map((shift) => {
                          const sStart = new Date(shift.startTime);
                          const sEnd = new Date(shift.endTime);
                          const isNow = now >= sStart && now <= sEnd;
                          const isFuture = now < sStart;

                          return (
                            <div
                              key={shift.id}
                              className={`rounded-lg p-2.5 text-left border shadow-xs ${
                                isNow
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                  : isFuture
                                  ? 'bg-sky-50 border-sky-200 text-sky-900'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-1 text-xs font-bold">
                                <Clock className="h-3 w-3 shrink-0" />
                                {formatTime(shift.startTime)} – {formatTime(shift.endTime)}
                              </div>
                              {shift.notes && (
                                <p className="text-[11px] mt-1 line-clamp-2 text-slate-500 font-medium">
                                  {shift.notes}
                                </p>
                              )}
                              <div className="mt-2">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    isNow
                                      ? 'bg-emerald-600 text-white animate-pulse'
                                      : isFuture
                                      ? 'bg-sky-100 text-sky-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {isNow ? 'Đang trực' : isFuture ? 'Sắp tới' : 'Đã xong'}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
