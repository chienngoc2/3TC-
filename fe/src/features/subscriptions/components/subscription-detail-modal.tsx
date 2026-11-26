import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/auth/session-context'
import {
  X,
  CheckCircle2,
  Clock,
  Users,
  UserCheck,
  CalendarDays,
  DoorOpen,
  Dumbbell,
  XCircle,
  CircleHelp,
  RefreshCw,
  CalendarRange,
  Activity,
  Award,
} from 'lucide-react'
import { get } from '@/lib/api'
import { vietnamDate, vietnamDateTime } from '@/lib/date'
import { memberKeys } from '@/lib/keys'
import type { Booking, Discipline, Subscription } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  formatSubscriptionPlanName,
  formatSubscriptionTier,
  getSubscriptionBenefits,
  getSubscriptionExpiration,
  isActiveDropIn,
} from '../utils/subscription.utils'
import { Button } from '@/components/ui/button'

export interface SubscriptionDetailModalProps {
  item: Subscription | null
  discipline?: Discipline
  isOpen: boolean
  onClose: () => void
  onNavigateToBooking: () => void
  onRenew: () => void
  isRenewing?: boolean
  ptSessions?: number
  onPtSessionsChange?: (val: number) => void
  onBuyPtAddon?: () => void
  isBuyingPtAddon?: boolean
  previewData?: { ratePerSession: string; amount: string } | null
  previewError?: unknown
}

const bookingStatusStyles: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  CONFIRMED: {
    label: 'Đã xác nhận',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  CANCELLED: {
    label: 'Đã hủy',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
    icon: XCircle,
  },
  EXPIRED: {
    label: 'Đã hết hạn',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    icon: Clock,
  },
  PENDING: {
    label: 'Chờ xác nhận',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Clock,
  },
  ATTENDED: {
    label: 'Đã tham gia',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
    icon: CheckCircle2,
  },
  ABSENT: {
    label: 'Vắng mặt',
    className: 'border-slate-200 bg-slate-100 text-slate-600',
    icon: XCircle,
  },
}

function displayDate(value: string | null, includeTime = false): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Chưa có thông tin'
  return includeTime ? vietnamDateTime(value) : vietnamDate(value)
}

function calculateDaysRemaining(endDateStr: string | null): { text: string; isExpired: boolean } {
  if (!endDateStr) return { text: '—', isExpired: false }
  const end = new Date(endDateStr).getTime()
  const now = new Date().getTime()
  if (!Number.isFinite(end)) return { text: '—', isExpired: false }
  const diffDays = Math.ceil((end - now) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return { text: 'Đã hết hạn', isExpired: true }
  return { text: `Còn ${diffDays} ngày`, isExpired: false }
}

export const SubscriptionDetailModal: React.FC<SubscriptionDetailModalProps> = ({
  item,
  discipline,
  isOpen,
  onClose,
  onNavigateToBooking,
  onRenew,
  isRenewing = false,
}) => {
  const { user } = useSession()

  // Fetch all bookings of the user to see what they have used with this subscription
  const bookingsQuery = useQuery({
    queryKey: memberKeys.history(user?.id || ''),
    queryFn: () => get<Booking[]>('/bookings'),
    enabled: isOpen && Boolean(user?.id),
  })

  // Lock body scroll and listen for ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !item) return null

  const isVip = item.packageTier === 'VIP'
  const isPlus = item.packageTier === 'PLUS'
  const isActive = item.status === 'ACTIVE'
  const isFrozen = item.status === 'FROZEN'
  const isExpired = item.status === 'EXPIRED'

  const disciplineName = discipline?.name || item.plan?.discipline?.name || 'Bộ môn'
  const expiration = getSubscriptionExpiration(item)
  const benefits = getSubscriptionBenefits(item)
  const daysRemaining = calculateDaysRemaining(expiration)

  // Filter sessions that this member booked/used under this subscription
  const usedSessionsList = (bookingsQuery.data || []).filter(
    (b) => b.subscriptionId === item.id,
  )

  // Calculate used counts (prefer server booking count when stacked)
  const remainingGroup = item.remainingGroupSessions ?? 0
  const usedGroup =
    item.usedGroupSessions ??
    (item.plan?.groupSessionQuota != null
      ? Math.max(0, item.plan.groupSessionQuota - remainingGroup)
      : usedSessionsList.filter((b) => b.bookingType === 'GROUP_CLASS').length)
  const totalGroup = Math.max(item.plan?.groupSessionQuota ?? 0, remainingGroup + usedGroup)

  const remainingPt = item.remainingPtSessions ?? 0
  const usedPt =
    item.usedPtSessions ??
    (item.plan?.ptSessionQuota != null
      ? Math.max(0, item.plan.ptSessionQuota - remainingPt)
      : usedSessionsList.filter((b) => b.bookingType === 'PERSONAL_TRAINING').length)
  const totalPt = Math.max(item.plan?.ptSessionQuota ?? 0, remainingPt + usedPt)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 select-none font-sans"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-md border border-slate-200 shadow-xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-start justify-between gap-4 bg-white shrink-0">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Dumbbell className="w-3.5 h-3.5 text-[#17664e]" />
                <span>{disciplineName}</span>
              </span>

              <span
                className={cn(
                  'px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wider uppercase border',
                  isVip
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : isPlus
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-slate-100 text-slate-800 border-slate-200',
                )}
              >
                {formatSubscriptionTier(item.packageTier)}
              </span>

              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold border',
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isFrozen
                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200',
                )}
              >
                {isActive ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Đang sử dụng
                  </>
                ) : isFrozen ? (
                  <>
                    <Clock className="w-3.5 h-3.5 text-sky-600" />
                    Đang đóng băng
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Đã hết hạn
                  </>
                )}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
              {formatSubscriptionPlanName(item.plan?.name)}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Thời hạn kích hoạt: <span className="font-semibold text-slate-700">{displayDate(item.startDate)}</span> - <span className="font-semibold text-slate-700">{displayDate(expiration, isActiveDropIn(item))}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-white">
          {/* 1. THỐNG KÊ CHI TIẾT SỐ BUỔI ĐÃ DÙNG VÀ CÒN LẠI */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#17664e]" />
              <span>Tiến độ sử dụng quyền lợi gói</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Lớp nhóm */}
              {benefits.showGroup && (
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#17664e]" />
                      Lớp học nhóm
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">
                      Còn {remainingGroup} buổi
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-[11px] text-slate-500 block">
                        Đã sử dụng
                      </span>
                      <strong className="text-2xl font-black font-mono text-slate-900">
                        {usedGroup}
                        {totalGroup > 0 && (
                          <span className="text-sm font-medium text-slate-500"> / {totalGroup}</span>
                        )}
                        <span className="text-xs font-normal text-slate-500 ml-1">buổi</span>
                      </strong>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">
                        Còn lại
                      </span>
                      <strong className="text-xl font-black font-mono text-emerald-700">
                        {remainingGroup} buổi
                      </strong>
                    </div>
                  </div>

                  {totalGroup > 0 && (
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#17664e] transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, (usedGroup / totalGroup) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* PT 1:1 */}
              {benefits.showPt && (
                <div className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                    <span className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-[#17664e]" />
                      Kèm HLV PT 1:1
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700">
                      Còn {remainingPt} buổi
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between pt-1">
                    <div>
                      <span className="text-[11px] text-slate-500 block">
                        Đã sử dụng
                      </span>
                      <strong className="text-2xl font-black font-mono text-slate-900">
                        {usedPt}
                        {totalPt > 0 && (
                          <span className="text-sm font-medium text-slate-500"> / {totalPt}</span>
                        )}
                        <span className="text-xs font-normal text-slate-500 ml-1">buổi</span>
                      </strong>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] text-slate-500 block">
                        Còn lại
                      </span>
                      <strong className="text-xl font-black font-mono text-emerald-700">
                        {remainingPt} buổi
                      </strong>
                    </div>
                  </div>

                  {totalPt > 0 && (
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#17664e] transition-all duration-300"
                        style={{
                          width: `${Math.min(100, Math.max(0, (usedPt / totalPt) * 100))}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Vào cửa tự do */}
            {benefits.unlimitedGym && (
              <div className="flex items-center gap-3 p-3.5 rounded-md bg-slate-50 border border-slate-200">
                <DoorOpen className="w-5 h-5 text-[#17664e] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Vào cửa phòng tập không giới hạn
                  </p>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Hội viên được check-in tự do tất cả các khung giờ mở cửa trong suốt thời hạn gói.
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* 2. LỊCH SỬ CÁC BUỔI TẬP ĐÃ DÙNG TỪ GÓI NÀY */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#17664e]" />
                <span>Các buổi tập đã dùng từ gói này ({usedSessionsList.length})</span>
              </h3>
            </div>

            {bookingsQuery.isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
                Đang tải danh sách các buổi tập đã dùng...
              </div>
            ) : usedSessionsList.length > 0 ? (
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden bg-white shadow-2xs">
                {usedSessionsList.map((booking) => {
                  const status = bookingStatusStyles[booking.status] ?? {
                    label: booking.status,
                    className: 'border-slate-200 bg-slate-50 text-slate-700',
                    icon: CircleHelp,
                  }
                  const StatusIcon = status.icon
                  const sessionTime =
                    booking.schedule?.startTime || booking.coachAvailability?.startTime
                      ? booking.schedule?.startTime ?? booking.coachAvailability!.startTime
                      : booking.bookedAt

                  const title =
                    booking.schedule?.class?.name ||
                    (booking.bookingType === 'PERSONAL_TRAINING'
                      ? 'Buổi tập kèm PT 1:1'
                      : 'Lớp học nhóm')

                  const coachName = booking.coachAvailability?.coach?.fullName

                  return (
                    <div
                      key={booking.id}
                      className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 border border-slate-200">
                          {booking.bookingType === 'PERSONAL_TRAINING' ? (
                            <UserCheck className="w-4 h-4 text-[#17664e]" />
                          ) : (
                            <Users className="w-4 h-4 text-[#17664e]" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">
                            {title}
                          </p>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-mono">
                            <span className="tabular-nums">{vietnamDateTime(sessionTime)}</span>
                            {coachName && (
                              <>
                                <span>•</span>
                                <span className="truncate font-sans">HLV: {coachName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border shrink-0',
                          status.className,
                        )}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{status.label}</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-center rounded-md bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-500">
                Chưa có buổi tập nào được dùng từ gói này. Số buổi của bạn vẫn còn nguyên vẹn.
              </div>
            )}
          </section>

          {/* 3. THÔNG TIN THỜI HẠN & HLV PHỤ TRÁCH */}
          <section className="p-4 rounded-md bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 mb-1">
              <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
              <span>Thời hạn sử dụng gói thẻ</span>
            </h4>

            <div className="flex items-center justify-between text-slate-600">
              <span>Ngày bắt đầu kích hoạt:</span>
              <span className="font-semibold text-slate-900 tabular-nums font-mono">
                {displayDate(item.startDate)}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Ngày hết hạn gói:</span>
              <span className="font-semibold text-slate-900 tabular-nums font-mono">
                {displayDate(expiration, isActiveDropIn(item))}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>Tình trạng thời gian:</span>
              <span className="font-bold text-emerald-700 font-mono">
                {daysRemaining.text}
              </span>
            </div>

            {item.assignedCoach && (
              <div className="flex items-center justify-between text-slate-600 pt-2 border-t border-slate-200">
                <span>Huấn luyện viên phụ trách:</span>
                <span className="font-bold text-slate-900">
                  {item.assignedCoach.fullName}
                </span>
              </div>
            )}
          </section>
        </div>

        {/* MODAL FOOTER ACTIONS */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Booking shortcut */}
            {isActive && (
              <Button
                type="button"
                variant="mint"
                onClick={onNavigateToBooking}
                className="h-9 px-4 rounded-md font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 bg-[#17664e] hover:bg-[#135641] text-white shadow-2xs cursor-pointer flex-1 sm:flex-initial"
              >
                <CalendarRange className="w-3.5 h-3.5" />
                <span>Đặt lịch học ngay</span>
              </Button>
            )}

            {/* Renewal */}
            {!['TRIAL', 'DROP_IN'].includes(item.packageTier) && (
              <Button
                type="button"
                variant="secondary"
                disabled={isRenewing}
                onClick={onRenew}
                className={cn(
                  'h-9 px-4 rounded-md font-bold text-xs tracking-wide flex items-center justify-center gap-1.5 border transition-all cursor-pointer flex-1 sm:flex-initial',
                  isActive
                    ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs',
                )}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', isRenewing && 'animate-spin')} />
                <span>{isExpired ? 'Gia hạn gói tập ngay' : 'Gia hạn trước hạn'}</span>
              </Button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
