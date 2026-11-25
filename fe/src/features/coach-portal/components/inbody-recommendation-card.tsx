import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BODY_SHAPE_INFO } from '@/lib/inbody'
import { validationText } from '@/lib/validation-message'
import { coachPortalApi } from '../api/coach-portal-api'
import type { WorkoutRecommendation } from '../types/coach-portal.types'

const LIMB = { ARMS: 'Tay', LEGS: 'Chân' } as const
const SIDE = { LEFT: 'trái', RIGHT: 'phải', BALANCED: '' } as const
const OTHER_SIDE = { LEFT: 'phải', RIGHT: 'trái', BALANCED: '' } as const

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

/** Says why the suggestion could not load, so the cause is visible without dev tools. */
function recommendationError(error: unknown): string {
  const response = (
    error as {
      response?: { status?: number; data?: { errorCode?: unknown; message?: unknown } }
    }
  )?.response
  if (!response) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
  const code = response.data?.errorCode ?? response.data?.message
  if (response.status === 404 && code !== 'RESOURCE_NOT_FOUND' && code !== 'USER_NOT_FOUND')
    return 'Máy chủ chưa có tính năng gợi ý theo InBody (backend cần cập nhật bản mới).'
  if (code === 'MEMBER_NOT_ASSIGNED_TO_COACH' || response.status === 403)
    return 'Học viên này chưa được phân công cho bạn nên chưa xem được InBody.'
  if (response.status === 404) return 'Không tìm thấy học viên.'
  if ((response.status ?? 0) >= 500)
    return `Máy chủ gặp lỗi khi phân tích InBody (mã ${response.status}). Thường do database chưa chạy migration InBody, báo backend kiểm tra.`
  const detail = validationText(response.data?.message)
  return `Không tải được gợi ý theo InBody (mã ${response.status}${detail ? `: ${detail}` : ''}).`
}

/**
 * InBody diagnosis for the member a plan is being written for, with the backend's
 * suggested exercises that the coach can drop into the plan in one click.
 */
export const InbodyRecommendationCard: React.FC<{
  memberId: string
  onApply: (recommendation: WorkoutRecommendation) => void
  onDismiss: () => void
}> = ({ memberId, onApply, onDismiss }) => {
  const query = useQuery({
    queryKey: ['coach', 'workout-recommendation', memberId],
    queryFn: () => coachPortalApi.getWorkoutRecommendation(memberId),
    staleTime: 60_000,
  })

  if (query.isPending)
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Đang phân tích InBody của học viên...
      </div>
    )
  if (query.isError)
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500">
        <span>{recommendationError(query.error)}</span>
        <button
          type="button"
          onClick={() => void query.refetch()}
          className="font-bold text-emerald-700 hover:underline"
        >
          Thử lại
        </button>
      </div>
    )

  const rec = query.data
  const shape = rec.bodyShape !== 'UNKNOWN' ? BODY_SHAPE_INFO[rec.bodyShape] : null
  const warnings = rec.imbalances.filter((item) => item.severity === 'SIGNIFICANT')
  const muscle = rec.skeletalMuscleMassKg
  const fat = rec.bodyFatPct

  return (
    <section
      aria-label="Chẩn đoán thể trạng InBody"
      className="rounded-2xl border border-emerald-200 bg-white p-4 text-xs"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wide text-slate-900">
            Chẩn đoán InBody
          </h4>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {rec.hasInbodyData && rec.lastMeasuredAt
              ? `Đo ngày ${new Date(rec.lastMeasuredAt).toLocaleDateString('vi-VN')}`
              : 'Học viên chưa có lần đo InBody'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Ẩn gợi ý"
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="space-y-1.5 text-slate-700">
        <li>
          <span className="text-slate-500">Dáng người: </span>
          <strong className="text-slate-900">{shape ? shape.title : 'Chưa xác định'}</strong>
          {muscle != null || fat != null ? (
            <span className="text-slate-500">
              {' '}
              ({muscle != null ? `cơ ${numberFormat.format(muscle)} kg` : ''}
              {muscle != null && fat != null ? ' · ' : ''}
              {fat != null ? `mỡ ${numberFormat.format(fat)}%` : ''})
            </span>
          ) : null}
        </li>
        <li>
          <span className="text-slate-500">Mục tiêu đề xuất: </span>
          <strong className="text-slate-900">{rec.primaryGoalTitle ?? rec.primaryGoal}</strong>
        </li>
        {warnings.map((item) => (
          <li
            key={item.zone}
            className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-red-800"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Lệch cơ: {LIMB[item.zone].toLowerCase()} {SIDE[item.weakerSide]} yếu hơn{' '}
              {LIMB[item.zone].toLowerCase()} {OTHER_SIDE[item.weakerSide]}{' '}
              {numberFormat.format(item.imbalancePct)}%
            </span>
          </li>
        ))}
        {rec.cardioPrescription ? (
          <li className="rounded-lg bg-amber-50 px-2 py-1.5 text-amber-900">
            Mỡ nội tạng mức {rec.visceralFatLevel}: thêm {rec.cardioPrescription.durationMinutes}{' '}
            phút cardio {rec.cardioPrescription.targetZone.replace('_', ' ').toLowerCase()} cuối
            buổi.
          </li>
        ) : null}
      </ul>

      {rec.recommendedExercises.length > 0 ? (
        <ol className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {rec.recommendedExercises.map((exercise) => (
            <li key={exercise.exerciseId} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-semibold text-slate-800">
                {exercise.exerciseName}
                {exercise.unilateral ? (
                  <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    Từng bên
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 tabular-nums text-slate-500">
                {exercise.sets} × {exercise.reps}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={rec.recommendedExercises.length === 0}
          onClick={() => onApply(rec)}
          className="h-8 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500"
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
          Áp dụng giáo án đề xuất
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDismiss}
          className="h-8 rounded-xl px-3 text-xs font-bold"
        >
          Tự soạn thủ công
        </Button>
      </div>
    </section>
  )
}
