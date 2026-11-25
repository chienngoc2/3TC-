import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  UserCheck,
  X,
  AlertCircle,
  Star,
} from 'lucide-react'
import { get, put } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface ChangeCoachModalProps {
  subscription: any
  isOpen: boolean
  onClose: () => void
}

interface EligibleCoach {
  id: string
  fullName: string
  avatarUrl: string | null
  phone: string | null
  coachProfile: {
    ratingStars: number
    ratePerSession: number | string
    workingDays: string[] | null
    workingHours: Array<{ shift?: string; from: string; to: string }> | null
    bio: string | null
    specialties: string | null
  } | null
  coachAvailabilities: Array<{
    id: string
    startTime: string
    endTime: string
    isBooked: boolean
  }>
}

const DAY_ORDER_MAP: Record<string, { rank: number; label: string }> = {
  MONDAY: { rank: 1, label: 'Thứ 2' },
  T2: { rank: 1, label: 'Thứ 2' },
  '2': { rank: 1, label: 'Thứ 2' },
  TUESDAY: { rank: 2, label: 'Thứ 3' },
  T3: { rank: 2, label: 'Thứ 3' },
  '3': { rank: 2, label: 'Thứ 3' },
  WEDNESDAY: { rank: 3, label: 'Thứ 4' },
  T4: { rank: 3, label: 'Thứ 4' },
  '4': { rank: 3, label: 'Thứ 4' },
  THURSDAY: { rank: 4, label: 'Thứ 5' },
  T5: { rank: 4, label: 'Thứ 5' },
  '5': { rank: 4, label: 'Thứ 5' },
  FRIDAY: { rank: 5, label: 'Thứ 6' },
  T6: { rank: 5, label: 'Thứ 6' },
  '6': { rank: 5, label: 'Thứ 6' },
  SATURDAY: { rank: 6, label: 'Thứ 7' },
  T7: { rank: 6, label: 'Thứ 7' },
  '7': { rank: 6, label: 'Thứ 7' },
  SUNDAY: { rank: 7, label: 'Chủ Nhật' },
  CN: { rank: 7, label: 'Chủ Nhật' },
  '8': { rank: 7, label: 'Chủ Nhật' },
}

function formatWorkingDay(raw: string): string {
  if (!raw) return ''
  const upper = String(raw).toUpperCase().trim()
  if (DAY_ORDER_MAP[upper]) return DAY_ORDER_MAP[upper].label

  // English day names (with or without 'Thứ')
  if (upper.includes('MON')) return 'Thứ 2'
  if (upper.includes('TUE')) return 'Thứ 3'
  if (upper.includes('WED')) return 'Thứ 4'
  if (upper.includes('THU') && !upper.includes('THỨ 2') && !upper.includes('THỨ 3') && !upper.includes('THỨ 4') && !upper.includes('THỨ 6') && !upper.includes('THỨ 7')) return 'Thứ 5'
  if (upper.includes('FRI')) return 'Thứ 6'
  if (upper.includes('SAT')) return 'Thứ 7'
  if (upper.includes('SUN')) return 'Chủ Nhật'

  // Vietnamese numbers / text
  if (upper.includes('2') || upper.includes('HAI')) return 'Thứ 2'
  if (upper.includes('3') || upper.includes('BA')) return 'Thứ 3'
  if (upper.includes('4') || upper.includes('TƯ') || upper.includes('TU')) return 'Thứ 4'
  if (upper.includes('5') || upper.includes('NĂM') || upper.includes('NAM')) return 'Thứ 5'
  if (upper.includes('6') || upper.includes('SÁU') || upper.includes('SAU')) return 'Thứ 6'
  if (upper.includes('7') || upper.includes('BẢY') || upper.includes('BAY')) return 'Thứ 7'
  if (upper.includes('CN') || upper.includes('CHỦ NHẬT') || upper.includes('CHU NHAT')) return 'Chủ Nhật'

  return raw.startsWith('Thứ') || raw === 'Chủ Nhật' ? raw : `Thứ ${raw}`
}

function getDayRank(raw: string): number {
  if (!raw) return 99
  const upper = String(raw).toUpperCase().trim()
  if (DAY_ORDER_MAP[upper]) return DAY_ORDER_MAP[upper].rank
  if (upper.includes('MON') || upper.includes('2') || upper.includes('HAI')) return 1
  if (upper.includes('TUE') || upper.includes('3') || upper.includes('BA')) return 2
  if (upper.includes('WED') || upper.includes('4') || upper.includes('TƯ') || upper.includes('TU')) return 3
  if (upper.includes('THU') || upper.includes('5') || upper.includes('NĂM')) return 4
  if (upper.includes('FRI') || upper.includes('6') || upper.includes('SÁU')) return 5
  if (upper.includes('SAT') || upper.includes('7') || upper.includes('BẢY')) return 6
  if (upper.includes('SUN') || upper.includes('CN') || upper.includes('CHỦ NHẬT')) return 7
  return 99
}

function parseWorkingHours(
  workingHours: any[] | null | undefined,
  upcomingSlots: Array<{ startTime: string; endTime: string }> = [],
): string[] {
  const result: string[] = []

  if (Array.isArray(workingHours) && workingHours.length > 0) {
    for (const wh of workingHours) {
      if (typeof wh === 'string' && wh.trim()) {
        const cleaned = wh.trim()
        if (cleaned !== '—' && cleaned !== '-' && cleaned !== '–' && !cleaned.match(/^[—–\-\s]+$/)) {
          result.push(cleaned)
        }
        continue
      }
      if (wh && typeof wh === 'object') {
        const from = wh.from || wh.start || wh.startTime || ''
        const to = wh.to || wh.end || wh.endTime || ''
        if (from || to) {
          if (from === '—' || to === '—' || from === '-' || to === '-') continue
          const shift = wh.shift ? `${wh.shift}: ` : ''
          const day = wh.day ? ` (${formatWorkingDay(wh.day)})` : ''
          const timeText = from && to ? `${from} – ${to}` : from || to
          if (timeText && timeText !== '—' && !timeText.match(/^[—–\-\s]+$/)) {
            result.push(`${shift}${timeText}${day}`)
          }
        }
      }
    }
  }

  // Deduplicate and filter out empty / dash strings
  const uniqueHours = Array.from(new Set(result.filter(Boolean))).filter(
    (h) => h !== '—' && h !== '-' && h !== '–' && !h.trim().match(/^[—–\-\s]+$/)
  )

  // If no hours parsed from workingHours, fallback to upcomingSlots unique times
  if (uniqueHours.length === 0 && upcomingSlots && upcomingSlots.length > 0) {
    const slotHours = upcomingSlots
      .filter((slot) => slot.startTime && slot.endTime)
      .map((slot) => {
        const s = new Date(slot.startTime)
        const e = new Date(slot.endTime)
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return ''
        const sStr = String(s.getHours()).padStart(2, '0') + ':' + String(s.getMinutes()).padStart(2, '0')
        const eStr = String(e.getHours()).padStart(2, '0') + ':' + String(e.getMinutes()).padStart(2, '0')
        return `${sStr} – ${eStr}`
      })
      .filter((h) => h && h !== '—' && !h.trim().match(/^[—–\-\s]+$/))
    return Array.from(new Set(slotHours)).slice(0, 4)
  }

  return uniqueHours
}

export const ChangeCoachModal: React.FC<ChangeCoachModalProps> = ({
  subscription,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient()
  const [selectedCoachId, setSelectedCoachId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['subscription-eligible-coaches', subscription?.id],
    queryFn: () =>
      get<{
        subscriptionId: string
        currentCoach: {
          id: string
          fullName: string
          ratingStars: number
          ratePerSession: number
        }
        targetStars: number
        eligibleCoaches: EligibleCoach[]
      }>(`/memberships/subscriptions/${subscription.id}/eligible-coaches`),
    enabled: Boolean(isOpen && subscription?.id),
    staleTime: 10000,
  })

  const changeCoachMutation = useMutation({
    mutationFn: (newCoachId: string) =>
      put(`/memberships/subscriptions/${subscription.id}/change-coach`, {
        newCoachId,
      }),
    onSuccess: () => {
      setSuccessMessage('Đổi Huấn luyện viên thành công! Đang tải lại dữ liệu...')
      void queryClient.invalidateQueries({ queryKey: ['subscription-eligible-coaches'] })
      void queryClient.invalidateQueries({ queryKey: ['member-subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] })
      setTimeout(() => {
        window.location.reload()
      }, 700)
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.message ||
          err?.message ||
          'Không thể đổi Huấn luyện viên. Vui lòng thử lại.',
      )
    },
  })

  if (!isOpen || !subscription) return null

  const targetStars = data?.targetStars ?? subscription.coachRatingStars ?? 3
  const coaches = data?.eligibleCoaches ?? []
  const currentCoachName =
    data?.currentCoach?.fullName ?? subscription.assignedCoach?.fullName ?? 'Chưa phân công'

  const handleConfirm = () => {
    if (!selectedCoachId) return
    setErrorMessage(null)
    setSuccessMessage(null)
    changeCoachMutation.mutate(selectedCoachId)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-md shadow-2xl border border-slate-200 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Thay đổi Huấn luyện viên Gym
              </h3>
              <p className="text-xs text-slate-300">
                Gói tập:{' '}
                <span className="font-semibold text-white">
                  {subscription.plan?.name || 'Gói tập cá nhân'}
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Rule Alert Banner */}
          <div className="p-3.5 rounded-md bg-amber-50/90 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-950">
              <Star className="w-4 h-4 fill-amber-500 text-amber-500 shrink-0" />
              <span>Quy tắc đổi HLV ngang giá tiền:</span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              Bạn đang tập với HLV{' '}
              <strong className="text-slate-900">{currentCoachName}</strong> (hạng{' '}
              <strong className="text-amber-700">{targetStars} sao</strong>). Hệ thống chỉ
              cho phép đổi sang các HLV có{' '}
              <strong className="text-slate-900">cùng {targetStars} sao</strong> (thù lao{' '}
              <strong className="text-emerald-700">
                {(targetStars * 1000).toLocaleString('vi-VN')} đ/buổi
              </strong>
              ).
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span className="font-bold">{successMessage}</span>
            </div>
          )}

          {/* List of Eligible Coaches */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Danh sách HLV cùng hạng {targetStars} sao khả dụng
              </h4>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {coaches.length} HLV phù hợp
              </span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-2">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-emerald-600" />
                <p>Đang tìm kiếm huấn luyện viên cùng hạng sao...</p>
              </div>
            ) : isError ? (
              <div className="p-6 text-center text-xs text-rose-600 space-y-2">
                <p>Lỗi tải danh sách huấn luyện viên.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refetch()}
                  className="text-xs"
                >
                  Thử lại
                </Button>
              </div>
            ) : coaches.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 rounded-md border border-slate-200 text-xs text-slate-500">
                Hiện tại không có huấn luyện viên nào khác cùng hạng {targetStars} sao đang hoạt động trong bộ môn này.
              </div>
            ) : (
              <div className="space-y-3">
                {coaches.map((coach) => {
                  const isSelected = selectedCoachId === coach.id
                  const stars = coach.coachProfile?.ratingStars || targetStars
                  const rawWorkingDays = coach.coachProfile?.workingDays || []
                  const sortedWorkingDays = [...rawWorkingDays].sort(
                    (a, b) => getDayRank(a) - getDayRank(b),
                  )
                  const workingHoursList = parseWorkingHours(
                    coach.coachProfile?.workingHours,
                    coach.coachAvailabilities || [],
                  )
                  const upcomingSlots = coach.coachAvailabilities || []

                  return (
                    <div
                      key={coach.id}
                      onClick={() => setSelectedCoachId(coach.id)}
                      className={`p-4 rounded-md border transition-all cursor-pointer space-y-3 ${
                        isSelected
                          ? 'border-[#17664e] bg-emerald-50/40 ring-2 ring-[#17664e]/30'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm text-slate-700 shrink-0 overflow-hidden">
                            {coach.avatarUrl ? (
                              <img
                                src={coach.avatarUrl}
                                alt={coach.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              coach.fullName.charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-bold text-slate-900">
                                {coach.fullName}
                              </h5>
                              <span className="text-[11px] font-bold text-amber-600 flex items-center">
                                {'★'.repeat(stars)}
                                <span className="text-slate-600 ml-1">({stars} sao)</span>
                              </span>
                            </div>
                            <p className="text-xs text-slate-500">
                              Thù lao:{' '}
                              <strong className="text-slate-800">
                                {(stars * 1000).toLocaleString('vi-VN')} đ / buổi
                              </strong>
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <input
                            type="radio"
                            name="coachSelection"
                            checked={isSelected}
                            onChange={() => setSelectedCoachId(coach.id)}
                            className="w-4 h-4 text-[#17664e] focus:ring-[#17664e]"
                          />
                        </div>
                      </div>

                      {coach.coachProfile?.bio && (
                        <p className="text-xs text-slate-600 italic line-clamp-2">
                          &ldquo;{coach.coachProfile.bio}&rdquo;
                        </p>
                      )}

                      {/* Working Days & Schedule */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col gap-2 text-xs">
                        {sortedWorkingDays.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-500 font-medium flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Thứ trực:</span>
                            </span>
                            {sortedWorkingDays.map((d: string) => (
                              <span
                                key={d}
                                className="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-emerald-900 border border-emerald-300 shadow-2xs"
                              >
                                {formatWorkingDay(d)}
                              </span>
                            ))}
                          </div>
                        )}

                        {workingHoursList.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-500 font-medium flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Khung giờ:</span>
                            </span>
                            {workingHoursList.map((hourStr: string, i: number) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                              >
                                {hourStr}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span className="font-semibold text-emerald-700">
                            {upcomingSlots.length} ca tập rảnh sắp tới
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={changeCoachMutation.isPending}
            className="text-xs"
          >
            Đóng
          </Button>
          <Button
            type="button"
            variant="mint"
            disabled={!selectedCoachId || changeCoachMutation.isPending}
            onClick={handleConfirm}
            className="bg-[#17664e] hover:bg-[#135641] text-white text-xs font-bold px-4"
          >
            {changeCoachMutation.isPending ? 'Đang cập nhật...' : 'Xác nhận đổi HLV'}
          </Button>
        </div>
      </div>
    </div>
  )
}
