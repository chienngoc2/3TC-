import React from 'react';
import { createPortal } from 'react-dom';
import { Dumbbell, X } from 'lucide-react';
import { parseCoachNotes } from '@/lib/workout-notes';

export interface WorkoutPlanExerciseData {
  id?: string;
  title?: string;
  exercise?: {
    id?: string;
    title?: string;
    category?: string;
    instructions?: string;
  };
  sets?: number | null;
  reps?: number | null;
  weightKg?: number | string | null;
  restSeconds?: number | null;
  coachFeedback?: string | null;
}

export interface WorkoutPlanDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  coachName?: string;
  notes?: string | null;
  exercises?: WorkoutPlanExerciseData[];
}

export const WorkoutPlanDetailModal: React.FC<WorkoutPlanDetailModalProps> = ({
  isOpen,
  onClose,
  title,
  coachName,
  notes,
  exercises = [],
}) => {
  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg sm:max-w-xl max-h-[90vh] rounded-md bg-white shadow-xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 bg-white shrink-0 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center shrink-0 border border-emerald-100">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                {title || 'Giáo án buổi tập'}
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {coachName || 'Huấn luyện viên phụ trách'} · {exercises.length} bài tập
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ml-3"
            title="Đóng modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: Scrollable exercise list */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 bg-white">
          {/* Coach Notes & Topic */}
          {notes && (() => {
            const parsed = parseCoachNotes(notes);
            if (!parsed.topicTitle && !parsed.coachNote) return null;
            return (
              <div className="space-y-2">
                {parsed.topicTitle && (
                  <div className="p-3.5 sm:p-4 rounded-md border border-emerald-200 bg-emerald-50/60 space-y-1">
                    <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                      Chuyên đề buổi tập
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                      {parsed.topicTitle}
                    </p>
                    {parsed.topicDescription && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {parsed.topicDescription}
                      </p>
                    )}
                  </div>
                )}
                {parsed.coachNote && (
                  <div className="p-3.5 sm:p-4 rounded-md border border-slate-200 bg-slate-50 space-y-1">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      Lời dặn của HLV:
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-line">
                      {parsed.coachNote}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Exercise Section */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Danh sách bài tập ({exercises.length})
            </h4>

            {exercises.length === 0 ? (
              <div className="p-8 text-center text-xs font-medium text-slate-400 border border-dashed border-slate-200 rounded-md">
                Chưa có bài tập nào trong giáo án này
              </div>
            ) : (
              <div className="space-y-2.5">
                {exercises.map((ex, idx) => {
                  const rawTitle = ex.exercise?.title || ex.title || 'Bài tập';
                  const sets = ex.sets || 3;
                  const reps = ex.reps || 10;
                  const weightKg = ex.weightKg;
                  const restSeconds = ex.restSeconds || 60;
                  const weightDisplay =
                    weightKg !== null && weightKg !== undefined && Number(weightKg) > 0
                      ? `${weightKg} kg`
                      : 'Bodyweight';

                  return (
                    <div
                      key={ex.id || idx}
                      className="p-3.5 rounded-md border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-3 shadow-2xs"
                    >
                      {/* Left: Number badge + Exercise Name */}
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-md bg-slate-100 text-slate-700 font-mono text-xs font-bold flex items-center justify-center shrink-0 border border-slate-200">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug truncate">
                            {rawTitle}
                          </h5>
                          {ex.coachFeedback && (
                            <p className="text-[11px] font-medium text-slate-500 italic truncate mt-0.5">
                              {ex.coachFeedback}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Specs (Sets x Reps, Weight & Rest) */}
                      <div className="text-right shrink-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-900 font-mono">
                          {sets} hiệp × {reps} reps
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                          {weightDisplay} · Nghỉ {restSeconds}s
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition active:scale-[0.98] cursor-pointer"
          >
            Đóng giáo án
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};

