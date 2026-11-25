import React from 'react';
import type { CoachScheduleSession } from '../types/coach-schedule.types';
import { X, Clock, AlertTriangle, Users, UserCheck, CheckCircle2, ChevronRight, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OverlappingSessionsModalProps {
  data: { sessions: CoachScheduleSession[]; dateLabel: string } | null;
  onClose: () => void;
  onSelectSession: (session: CoachScheduleSession) => void;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  } catch {
    return isoString;
  }
}

function formatDateVN(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export const OverlappingSessionsModal: React.FC<OverlappingSessionsModalProps> = ({
  data,
  onClose,
  onSelectSession,
}) => {
  if (!data || !data.sessions || data.sessions.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Ca tập trùng giờ ({data.sessions.length} ca)
              </h3>
              <p className="text-xs text-slate-500 font-medium capitalize">
                {formatDateVN(data.dateLabel)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: List of overlapping sessions */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <p className="text-xs text-slate-600">
            Khung giờ này có <strong>{data.sessions.length} ca tập</strong> diễn ra đồng thời. Vui lòng bấm vào ca bạn muốn xem chi tiết nghiệp vụ hoặc điểm danh:
          </p>

          <div className="space-y-2.5">
            {data.sessions.map((session, index) => {
              const isPt = session.type === 'PT';
              const isGroup = session.type === 'GROUP_CLASS';
              const isEmpty = session.type === 'EMPTY_SLOT' || session.isSlotEmpty;
              const isCompleted = session.status === 'COMPLETED';

              const title = isEmpty
                ? 'Slot trống (Chờ nhận HV)'
                : isPt
                ? session.studentName || 'Học viên PT'
                : session.title || 'Lớp tập nhóm';

              const timeRange = `${formatTime(session.startTime)} – ${formatTime(session.endTime)}`;

              return (
                <div
                  key={session.id || index}
                  onClick={() => {
                    onClose();
                    onSelectSession(session);
                  }}
                  className={cn(
                    'p-4 rounded-xl border transition-all cursor-pointer select-none group',
                    isCompleted
                      ? 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/80 hover:border-emerald-300'
                      : isPt
                      ? 'bg-purple-50/60 border-purple-200 hover:bg-purple-100/70 hover:border-purple-300'
                      : isGroup
                      ? 'bg-teal-50/60 border-teal-200 hover:bg-teal-100/70 hover:border-teal-300'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      {/* Top Badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {timeRange}
                        </span>

                        <span
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide',
                            isPt
                              ? 'bg-purple-100 text-purple-800'
                              : isGroup
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-slate-200 text-slate-700'
                          )}
                        >
                          {isPt ? 'Dạy kèm PT 1:1' : isGroup ? 'Lớp tập nhóm' : 'Ca rảnh'}
                        </span>

                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Đã hoàn thành
                          </span>
                        )}
                      </div>

                      {/* Primary Title */}
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {title}
                      </h4>

                      {/* Meta information */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                        {isGroup && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            {session.enrolledCount || 0}/{session.capacity || 12} học viên
                          </span>
                        )}
                        {isPt && !isEmpty && (
                          <span className="flex items-center gap-1">
                            <UserCheck className="w-3.5 h-3.5 text-purple-500" />
                            Học viên cá nhân 1-1
                          </span>
                        )}
                        {session.roomName && (
                          <span className="flex items-center gap-1">
                            <Dumbbell className="w-3.5 h-3.5 text-slate-400" />
                            Phòng: {session.roomName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow Action */}
                    <div className="flex items-center self-center gap-1 text-xs font-bold text-[#17664e] group-hover:translate-x-0.5 transition-transform shrink-0">
                      <span>Chi tiết</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer"
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
};
