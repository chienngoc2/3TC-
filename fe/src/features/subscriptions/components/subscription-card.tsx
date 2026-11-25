import React, { useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSession } from '@/auth/session-context'
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  DoorOpen,
  Dumbbell,
  Flame,
  Music,
  Sparkles,
  Activity,
  Snowflake,
  UserCheck,
  Users,
  RefreshCw,
  CalendarRange,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { errorText } from '@/lib/api'
import { createCheckout } from '@/lib/checkout'
import { vietnamDate, vietnamDateTime } from '@/lib/date'
import { memberKeys } from '@/lib/keys'
import type { Discipline, Subscription } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getPlanImage } from '@/features/plans/components/plan-images'
import { SubscriptionDetailModal } from './subscription-detail-modal'
import { ChangeCoachModal } from './change-coach-modal'
import {
  formatSubscriptionPlanName,
  formatSubscriptionTier,
  getSubscriptionBenefits,
  getSubscriptionExpiration,
  isActiveDropIn,
} from '../utils/subscription.utils'

export interface SubscriptionCardProps {
  item: Subscription
  discipline?: Discipline
}

function normalizeDiscipline(str?: string): 'gym' | 'boxing' | 'zumba' | 'yoga' | 'other' {
  if (!str) return 'other'
  const s = str.toLowerCase()
  if (s.includes('gym') || s.includes('fitness') || s.includes('thể hình')) return 'gym'
  if (s.includes('box') || s.includes('combat') || s.includes('kick') || s.includes('võ')) return 'boxing'
  if (s.includes('zumba') || s.includes('dance') || s.includes('nhảy') || s.includes('dancing')) return 'zumba'
  if (s.includes('yoga') || s.includes('thiền') || s.includes('meditation')) return 'yoga'
  return 'other'
}

function DisciplineIcon({ nameOrCode, className }: { nameOrCode?: string; className?: string }) {
  const norm = normalizeDiscipline(nameOrCode)
  if (norm === 'gym') return <Dumbbell className={className} />
  if (norm === 'boxing') return <Flame className={className} />
  if (norm === 'zumba') return <Music className={className} />
  if (norm === 'yoga') return <Sparkles className={className} />
  return <Activity className={className} />
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

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({ item, discipline }) => {
  const { user } = useSession()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isChangeCoachOpen, setIsChangeCoachOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const benefits = getSubscriptionBenefits(item)
  const expiration = getSubscriptionExpiration(item)

  const isVip = item.packageTier === 'VIP'
  const isPlus = item.packageTier === 'PLUS'
  const isActive = item.status === 'ACTIVE'
  const isExpired = item.status === 'EXPIRED'
  const isFrozen = item.status === 'FROZEN'

  const disciplineName = discipline?.name || item.plan?.discipline?.name || 'Bộ môn'
  const normDisc = normalizeDiscipline(disciplineName || item.plan?.name)
  const isGym = normDisc === 'gym'
  const showGroupQuota = !isGym || (item.plan?.groupSessionQuota ?? 0) > 0
  const showPtQuota = isGym
  const quotaCols = showGroupQuota && showPtQuota ? 'grid-cols-3' : 'grid-cols-2'
  const planImg = getPlanImage(
    disciplineName,
    item.packageTier,
    item.plan?.name,
    item.planId,
  )

  const daysRemaining = calculateDaysRemaining(expiration)

  const checkout = useMutation({
    mutationFn: (kind: 'RENEWAL') =>
      createCheckout(user!.id, { kind, subscriptionId: item.id }),
    onSuccess: (order) => {
      void cache.invalidateQueries({ queryKey: memberKeys.transactions(user!.id) })
      navigate(`/portal/member/checkouts/${order.checkoutId}`)
    },
    onError: (error) => setActionError(errorText(error)),
  })

  return (
    <article
      className="group relative flex flex-col justify-between bg-white rounded-md overflow-hidden border border-slate-200 shadow-2xs hover:border-slate-300 transition-all select-none"
      aria-label={item.plan?.name ?? 'Gói tập'}
    >
      {/* 1. VISUAL COVER IMAGE HEADER */}
      <div
        onClick={() => setIsDetailOpen(true)}
        className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-950 cursor-pointer group/img"
      >
        <img
          src={planImg}
          alt={item.plan?.name ?? 'Gói tập'}
          className="w-full h-full object-cover object-center group-hover/img:scale-105 transition-transform duration-500 filter brightness-95"
        />
        {/* Subtle Dark Gradient Veil */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/45 to-transparent" />

        {/* Top Badges (Discipline + Tier on left, Status on right) */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          {/* Left: Discipline & Tier Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-bold tracking-wide uppercase bg-black/60 text-white backdrop-blur-md border border-white/20">
              <DisciplineIcon nameOrCode={disciplineName} className="w-3 h-3 text-emerald-400" />
              <span>{disciplineName}</span>
            </span>

            <span
              className={cn(
                'px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border backdrop-blur-md',
                isVip
                  ? 'bg-amber-500/80 text-white border-amber-400'
                  : isPlus
                  ? 'bg-emerald-600/80 text-white border-emerald-400'
                  : 'bg-slate-700/80 text-white border-slate-500',
              )}
            >
              {formatSubscriptionTier(item.packageTier)}
            </span>
          </div>

          {/* Right: Status Badge */}
          <span
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border backdrop-blur-md shrink-0',
              isActive
                ? 'bg-emerald-500/90 text-white border-emerald-400'
                : isFrozen
                ? 'bg-sky-500/90 text-white border-sky-400'
                : 'bg-slate-600/90 text-white border-slate-500',
            )}
          >
            {isActive ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                Đang dùng
              </>
            ) : isFrozen ? (
              <>
                <Snowflake className="w-3 h-3" />
                Đóng băng
              </>
            ) : (
              <>
                <Clock className="w-3 h-3" />
                Hết hạn
              </>
            )}
          </span>
        </div>

        {/* Plan Name & Expiry Overlay */}
        <div className="absolute bottom-3 left-3 right-3">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug drop-shadow-md truncate">
            {formatSubscriptionPlanName(item.plan?.name)}
          </h2>
          <div className="flex items-center gap-2 text-xs text-white/80 font-medium mt-0.5">
            <span className="font-semibold">{daysRemaining.text}</span>
            <span>•</span>
            <span>Hết hạn: {displayDate(expiration, isActiveDropIn(item))}</span>
          </div>
        </div>
      </div>

      {/* 2. CARD BODY */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Bento Chips: Quota Grid with Used vs Remaining stats */}
        <div className={cn('grid gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-200', quotaCols)}>
          {/* Lớp nhóm (chỉ hiện cho gói nhóm: Yoga, Boxing, ...) */}
          {showGroupQuota && (
            <div className="text-center px-1">
              <Users className="w-3.5 h-3.5 mx-auto text-slate-500 mb-0.5" />
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                Lớp nhóm
              </span>
              <strong className="text-sm sm:text-base text-slate-900 font-mono font-bold block">
                {item.remainingGroupSessions ?? '—'}
                <span className="text-[10px] font-normal text-slate-400 ml-0.5">còn</span>
              </strong>
              <span className="text-[10px] text-slate-500 block truncate">
                {item.plan?.groupSessionQuota != null && item.remainingGroupSessions != null
                  ? `Đã dùng: ${Math.max(0, item.plan.groupSessionQuota - item.remainingGroupSessions)}`
                  : item.plan?.groupSessionQuota
                  ? `/ ${item.plan.groupSessionQuota} buổi`
                  : 'buổi'}
              </span>
              {item.plan?.groupSessionQuota != null &&
                item.plan.groupSessionQuota > 0 &&
                item.remainingGroupSessions != null && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#17664e] transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, (item.remainingGroupSessions / item.plan.groupSessionQuota) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                )}
            </div>
          )}

          {/* Kèm 1:1 (chỉ hiện cho gói Gym) */}
          {showPtQuota && (
            <div className={cn('text-center px-1', showGroupQuota && 'border-l border-slate-200')}>
              <UserCheck className="w-3.5 h-3.5 mx-auto text-slate-500 mb-0.5" />
              <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
                Kèm 1:1
              </span>
              <strong className="text-sm sm:text-base text-slate-900 font-mono font-bold block">
                {item.remainingPtSessions ?? '—'}
                <span className="text-[10px] font-normal text-slate-400 ml-0.5">còn</span>
              </strong>
              <span className="text-[10px] text-slate-500 block truncate">
                {item.plan?.ptSessionQuota != null && item.remainingPtSessions != null
                  ? `Đã dùng: ${Math.max(0, item.plan.ptSessionQuota - item.remainingPtSessions)}`
                  : item.plan?.ptSessionQuota
                  ? `/ ${item.plan.ptSessionQuota} buổi`
                  : 'buổi PT'}
              </span>
              {item.plan?.ptSessionQuota != null &&
                item.plan.ptSessionQuota > 0 &&
                item.remainingPtSessions != null && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#17664e] transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, (item.remainingPtSessions / item.plan.ptSessionQuota) * 100),
                        )}%`,
                      }}
                    />
                  </div>
                )}
            </div>
          )}

          {/* Hạn dùng */}
          <div className="text-center border-l border-slate-200 px-1">
            <Clock className="w-3.5 h-3.5 mx-auto text-slate-500 mb-0.5" />
            <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">
              Hạn dùng
            </span>
            <strong className="text-xs sm:text-sm text-slate-900 font-mono font-bold block mt-0.5 whitespace-nowrap">
              {daysRemaining.isExpired ? 'Hết hạn' : daysRemaining.text}
            </strong>
            <span className="text-[10px] text-slate-400 block">
              {displayDate(expiration, isActiveDropIn(item))}
            </span>
          </div>
        </div>

        {/* Perks & Entitlements */}
        <div className="space-y-1.5 text-xs text-slate-600 pt-1">
          {benefits.unlimitedGym ? (
            <p className="flex items-center gap-2 text-emerald-800 font-medium">
              <DoorOpen className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
              <span>Ra vào phòng tập tự do không giới hạn</span>
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
              <span>Tập luyện theo ca lớp học đã đặt</span>
            </p>
          )}

          <p className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
            <span>Tủ đồ thông minh Smart Locker & Phòng Sauna</span>
          </p>

          {isVip && (
            <p className="flex items-center gap-2 text-slate-800 font-medium">
              <UserCheck className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
              <span>Đặc quyền đặt lịch riêng cùng Huấn luyện viên</span>
            </p>
          )}
        </div>

        {/* HLV Phụ trách */}
        {item.assignedCoach && (
          <div className="flex items-center justify-between p-2.5 rounded-md bg-slate-50 border border-slate-200 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-200 text-slate-700 font-bold text-xs">
                {item.assignedCoach.fullName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  HLV phụ trách chính
                </p>
                <p className="text-xs font-bold text-slate-900 truncate">
                  {item.assignedCoach.fullName}
                </p>
                <p className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                  {'★'.repeat(item.assignedCoach.coachProfile?.ratingStars || item.coachRatingStars || 3)}
                  <span className="text-slate-600 font-medium">
                    ({item.assignedCoach.coachProfile?.ratingStars || item.coachRatingStars || 3} sao — {((item.assignedCoach.coachProfile?.ratingStars || item.coachRatingStars || 3) * 1000).toLocaleString('vi-VN')} đ/buổi)
                  </span>
                </p>
              </div>
            </div>
            {isActive && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsChangeCoachOpen(true)}
                className="text-[11px] h-7 px-2 border-emerald-300 text-[#17664e] hover:bg-emerald-50 shrink-0 font-bold"
              >
                Đổi HLV
              </Button>
            )}
          </div>
        )}

        {/* Date Details Bar */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
            <span>Bắt đầu:</span>
            <span className="font-semibold text-slate-700 tabular-nums font-mono">
              {displayDate(item.startDate)}
            </span>
          </div>

          
        </div>

        {/* 3. CARD ACTION BUTTONS */}
        <div className="pt-2 space-y-2 mt-auto">
          {/* Quick Schedule Booking Shortcut (for Active members) */}
          {isActive && (
            <Button
              type="button"
              variant="mint"
              onClick={() => navigate('/portal/member/bookings')}
              className="w-full h-9 rounded-md font-bold text-xs tracking-wide flex items-center justify-center gap-2 bg-[#17664e] hover:bg-[#135641] text-white shadow-2xs transition-all cursor-pointer"
            >
              <CalendarRange className="w-3.5 h-3.5" />
              <span>Đặt lịch học ngay</span>
            </Button>
          )}

          {/* View Details Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDetailOpen(true)}
            className="w-full h-9 rounded-md font-bold text-xs tracking-wide flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Xem chi tiết các buổi đã dùng</span>
          </Button>

          {/* Renewal Button */}
          {!['TRIAL', 'DROP_IN'].includes(item.packageTier) && (
            <Button
              type="button"
              variant="secondary"
              disabled={checkout.isPending}
              onClick={() => checkout.mutate('RENEWAL')}
              className={cn(
                'w-full h-9 rounded-md font-bold text-xs tracking-wide flex items-center justify-center gap-2 border transition-all cursor-pointer',
                isActive
                  ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent shadow-xs',
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', checkout.isPending && 'animate-spin')} />
              <span>{isExpired ? 'Gia hạn gói tập ngay' : 'Gia hạn trước hạn'}</span>
            </Button>
          )}

          {actionError && (
            <p role="alert" className="text-xs font-medium text-rose-600 pt-1">
              {actionError}
            </p>
          )}
        </div>
      </div>

      {/* 4. DETAIL MODAL */}
      <SubscriptionDetailModal
        item={item}
        discipline={discipline}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onNavigateToBooking={() => {
          setIsDetailOpen(false)
          navigate('/portal/member/bookings')
        }}
        onRenew={() => checkout.mutate('RENEWAL')}
        isRenewing={checkout.isPending}
      />

      {/* 5. CHANGE COACH MODAL */}
      <ChangeCoachModal
        subscription={item}
        isOpen={isChangeCoachOpen}
        onClose={() => setIsChangeCoachOpen(false)}
      />
    </article>
  )
}
