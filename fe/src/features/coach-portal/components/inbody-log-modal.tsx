import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Activity, X } from 'lucide-react';
import { InbodyEntryForm } from '@/components/inbody/inbody-entry-form';
import { validationText } from '@/lib/validation-message';
import { coachPortalApi } from '../api/coach-portal-api';

const FALLBACK = 'Không thể lưu chỉ số InBody. Vui lòng thử lại.';

interface InbodyLogModalProps {
  memberId: string;
  memberName: string;
  isOpen: boolean;
  onClose: () => void;
}

function describeError(cause: unknown) {
  const data = (cause as { response?: { data?: { message?: unknown; errorCode?: unknown } } })
    ?.response?.data;
  const message = data?.message;
  if (data?.errorCode === 'MEMBER_NOT_ASSIGNED_TO_COACH' || message === 'MEMBER_NOT_ASSIGNED_TO_COACH')
    return 'Bạn chỉ được nhập InBody cho học viên đang được phân công.';
  if (Array.isArray(message)) return validationText(message) ?? FALLBACK;
  if (typeof message === 'string' && !/^[A-Z][A-Z0-9_]+$/.test(message))
    return validationText(message) ?? FALLBACK;
  if ((cause as { response?: unknown })?.response === undefined)
    return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
  return FALLBACK;
}

export const InbodyLogModal: React.FC<InbodyLogModalProps> = ({
  memberId,
  memberName,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coach-inbody-title"
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h3 id="coach-inbody-title" className="text-base font-bold text-slate-900">
                Nhập chỉ số InBody
              </h3>
              <p className="text-xs text-slate-500">Học viên: {memberName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            disabled={busy}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          <InbodyEntryForm
            defaultMode="pro"
            notesLabel="Ghi chú đánh giá thể trạng"
            notesPlaceholder="Phân bố mỡ, khuyến nghị dinh dưỡng hoặc mục tiêu đợt đo tiếp theo..."
            submitLabel="Lưu chỉ số InBody"
            onBusyChange={setBusy}
            onCancel={onClose}
            describeError={describeError}
            onSubmit={async (payload) => {
              await coachPortalApi.createInbodyLog({
                ...payload,
                userId: memberId,
                notes: payload.notes ?? undefined,
              });
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['coach', 'members'] }),
                queryClient.invalidateQueries({
                  queryKey: ['coach', 'workout-recommendation', memberId],
                }),
              ]);
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
};
