import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  Phone,
  FileEdit,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UnifiedCoachSession, StudentBookingItem } from '../types/coach-portal.types';

interface CoachSessionModalProps {
  session: UnifiedCoachSession | null;
  isOpen: boolean;
  onClose: () => void;
  onCheckInStudent: (booking: StudentBookingItem, sessionStartTime: string) => void;
  onEmergencyCancel: (data: {
    scheduleId?: string;
    bookingId?: string;
    sessionTitle: string;
    sessionTime: string;
  }) => void;
}

export const CoachSessionModal: React.FC<CoachSessionModalProps> = ({
  session,
  isOpen,
  onClose,
  onCheckInStudent,
  onEmergencyCancel,
}) => {
  if (!isOpen || !session) return null;
  if (typeof document === 'undefined') return null;

  const isPt = session.type === 'PERSONAL_TRAINING';
  const started = new Date() >= new Date(session.startTime);

  const getSessionTimeStatus = (startTime: string, endTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (now >= start && now <= end) {
      return {
        status: 'LIVE',
        label: 'Đang diễn ra (LIVE)',
        badgeClass: 'bg-emerald-500 text-white font-extrabold animate-pulse shadow-sm shadow-emerald-500/30',
      };
    }
    if (now < start) {
      return {
        status: 'UPCOMING',
        label: 'Sắp diễn ra',
        badgeClass: 'bg-blue-100 text-blue-800 font-bold border border-blue-200',
      };
    }
    return {
      status: 'ENDED',
      label: 'Đã hoàn thành',
      badgeClass: 'bg-slate-100 text-slate-600 font-semibold border border-slate-200',
    };
  };

  const timeStatus = getSessionTimeStatus(session.startTime, session.endTime);

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const validBookings = session.bookings.filter((b) => b.status !== 'CANCELLED');
  const checkedInStudents = validBookings.filter(
    (b) =>
      b.attendance?.status === 'PRESENT' ||
      b.attendance?.status === 'ATTENDED' ||
      b.attendance?.status === 'LATE' ||
      b.status === 'ATTENDED'
  ).length;

  const checkInPercent =
    validBookings.length > 0
      ? Math.round((checkedInStudents / validBookings.length) * 100)
      : 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col my-auto relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-emerald-50/80 via-slate-50 to-white">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  isPt
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : 'bg-blue-100 text-blue-900 border border-blue-200'
                }`}
              >
                {isPt ? 'Huấn Luyện 1-1 (PT)' : 'Lớp Tập Nhóm'}
              </span>
              <span className={`rounded-md px-2 py-0.5 text-[10px] font-black ${timeStatus.badgeClass}`}>
                {timeStatus.label}
              </span>
              {session.isEmergencyCancelled && (
                <span className="rounded-md bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-black">
                  ĐÃ HỦY KHẨN CẤP
                </span>
              )}
            </div>

            <h3 className="text-lg font-black text-slate-900">{session.title}</h3>
            <p className="text-xs font-semibold text-slate-500">{formatDate(session.startTime)}</p>
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Quick Meta Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Thời gian:
              </span>
              <span className="font-mono font-bold text-slate-900 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-500" />
                {formatTime(session.startTime)} - {formatTime(session.endTime)}
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Địa điểm:
              </span>
              <span className="font-bold text-slate-900 flex items-center gap-1 truncate">
                <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                {session.roomName || 'Khu vực PT'}
              </span>
            </div>

            <div className="space-y-0.5 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Sĩ số học viên:
              </span>
              <span className="font-bold text-slate-900 flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-slate-500" />
                {isPt
                  ? session.bookings.length > 0
                    ? '1 Học viên'
                    : 'Chờ đăng ký'
                  : `${session.bookings.length} / ${session.capacity || 5} HV`}
              </span>
            </div>
          </div>

          {/* Attendance Progress Bar */}
          {validBookings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Tiến độ điểm danh học viên
                </span>
                <span className="font-mono text-emerald-700">
                  {checkedInStudents} / {validBookings.length} ({checkInPercent}%)
                </span>
              </div>
              <div className="w-full bg-emerald-200/80 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${checkInPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Not started warning */}
          {!started && !session.isEmergencyCancelled && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
              <Clock className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                Buổi học chưa diễn ra. Tính năng điểm danh sẽ chính thức mở từ{' '}
                <strong>{formatTime(session.startTime)}</strong>.
              </span>
            </div>
          )}

          {/* Student Roster Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-600">
                Danh Sách Học Viên ({session.bookings.length})
              </h4>

              {/* Emergency Cancel Action */}
              {!session.isEmergencyCancelled &&
                timeStatus.status === 'UPCOMING' &&
                (!isPt || session.bookings.length > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onEmergencyCancel({
                        scheduleId: session.scheduleId || undefined,
                        bookingId: isPt ? session.bookings[0]?.id : undefined,
                        sessionTitle: session.title,
                        sessionTime: `${formatTime(session.startTime)} - ${formatTime(session.endTime)}`,
                      })
                    }
                    className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                    Hủy khẩn cấp ca
                  </Button>
                )}
            </div>

            {session.bookings.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                {isPt
                  ? 'Chưa có học viên nào đăng ký ca tập này.'
                  : 'Chưa có học viên nào đặt lịch cho lớp này.'}
              </div>
            ) : (
              <div className="space-y-2">
                {session.bookings.map((booking) => {
                  const memberName =
                    booking.member?.fullName || 'Học viên';
                  const isCancelled = booking.status === 'CANCELLED';
                  const attStatus = booking.attendance?.status;
                  const isAttended =
                    attStatus === 'PRESENT' || attStatus === 'ATTENDED' || booking.status === 'ATTENDED';
                  const isLate = attStatus === 'LATE';
                  const isAbsent = attStatus === 'ABSENT';
                  const isDone = isAttended || isLate || isAbsent;

                  return (
                    <div
                      key={booking.id}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                        isCancelled
                          ? 'bg-slate-50/80 border-slate-200 opacity-70'
                          : isAttended
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : isLate
                          ? 'bg-amber-50/60 border-amber-200'
                          : isAbsent
                          ? 'bg-rose-50/60 border-rose-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center shrink-0 uppercase overflow-hidden shadow-2xs">
                          {booking.member?.avatarUrl ? (
                            <img
                              src={booking.member.avatarUrl}
                              alt={memberName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            memberName.charAt(0)
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{memberName}</p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            {booking.member?.phone && (
                              <span className="flex items-center gap-0.5 font-mono text-slate-600">
                                <Phone className="h-3 w-3 text-slate-400" />
                                {booking.member.phone}
                              </span>
                            )}
                            <span
                              className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                isCancelled
                                  ? 'text-rose-700 bg-rose-100'
                                  : isAttended
                                  ? 'text-emerald-700 bg-emerald-100'
                                  : isLate
                                  ? 'text-amber-800 bg-amber-100'
                                  : isAbsent
                                  ? 'text-rose-700 bg-rose-100'
                                  : 'text-amber-800 bg-amber-100'
                              }`}
                            >
                              {isCancelled
                                ? 'Đã hủy lịch'
                                : isAttended
                                ? 'Có mặt'
                                : isLate
                                ? 'Đi muộn'
                                : isAbsent
                                ? 'Vắng mặt'
                                : 'Chưa điểm danh'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Check-in Trigger */}
                      <div>
                        <Button
                          size="sm"
                          disabled={isCancelled || !started || session.isEmergencyCancelled}
                          onClick={() => onCheckInStudent(booking, session.startTime)}
                          className={`text-xs font-bold gap-1 shadow-2xs transition-all cursor-pointer ${
                            isCancelled
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                              : isDone
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : !started
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isCancelled ? (
                            <span>Đã hủy</span>
                          ) : isDone ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Sửa</span>
                            </>
                          ) : (
                            <>
                              <FileEdit className="h-3.5 w-3.5" />
                              <span>Điểm danh</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50 px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold cursor-pointer"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
