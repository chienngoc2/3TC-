import React, { useState, useMemo } from 'react'
import {
  ArrowRight,
  Dumbbell,
  Users,
  UserCheck,
  Plus,
} from 'lucide-react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useSession } from '@/auth/session-context'
import { StateMessage } from '@/components/feedback/state-message'
import { get } from '@/lib/api'
import { memberKeys } from '@/lib/keys'
import type { Discipline, Subscription } from '@/lib/types'
import { SubscriptionCard } from '../components/subscription-card'
import { cn } from '@/lib/utils'

type FilterStatus = 'ALL' | 'ACTIVE' | 'EXPIRED'

function getSubTierWeight(sub: Subscription): number {
  const tier = (sub.packageTier || (sub as any).plan?.packageTier || '').toUpperCase()
  const name = ((sub as any).plan?.name || (sub as any).planName || '').toUpperCase()
  if (tier === 'VIP' || name.includes('VIP')) return 40
  if (tier === 'PLUS' || name.includes('PLUS')) return 30
  if (
    tier === 'DROP_IN' ||
    name.includes('BUỔI') ||
    name.includes('SESSION') ||
    name.includes('DROP')
  ) {
    return 20
  }
  if (tier === 'TRIAL' || name.includes('THỬ')) return 10
  return 25
}

function sortSubs(list: Subscription[]): Subscription[] {
  return [...list].sort((a, b) => {
    const tierDiff = getSubTierWeight(b) - getSubTierWeight(a)
    if (tierDiff !== 0) return tierDiff
    const endA = a.endDate ? new Date(a.endDate).getTime() : 0
    const endB = b.endDate ? new Date(b.endDate).getTime() : 0
    return endB - endA
  })
}

export const SubscriptionsPage: React.FC = () => {
  const { user } = useSession()
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')

  const subscriptions = useQuery({
    queryKey: memberKeys.subscriptions(user!.id),
    queryFn: () => get<Subscription[]>('/memberships/subscriptions'),
  })

  const disciplines = useQuery({
    queryKey: ['disciplines'],
    queryFn: () => get<Discipline[]>('/disciplines', true),
  })

  const subsList = subscriptions.data || []

  // Metrics
  const activeSubs = useMemo(() => {
    return subsList.filter((s) => s.status === 'ACTIVE')
  }, [subsList])

  const expiredSubs = useMemo(() => {
    return subsList.filter((s) => s.status !== 'ACTIVE')
  }, [subsList])

  const totalRemainingGroup = useMemo(() => {
    return activeSubs.reduce((acc, s) => acc + (s.remainingGroupSessions || 0), 0)
  }, [activeSubs])

  const totalRemainingPt = useMemo(() => {
    return activeSubs.reduce((acc, s) => acc + (s.remainingPtSessions || 0), 0)
  }, [activeSubs])

  // Filtered subscriptions with VIP > PLUS > DROP_IN priority
  const filteredSubs = useMemo(() => {
    let list = subsList
    if (filterStatus === 'ACTIVE') list = activeSubs
    else if (filterStatus === 'EXPIRED') list = expiredSubs
    return sortSubs(list)
  }, [filterStatus, subsList, activeSubs, expiredSubs])

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 pb-20">
      {/* Khung trắng bo góc 5% bao quanh tất cả component */}
      <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-7 space-y-6 shadow-xs">
        {/* Header */}
        <div className="pb-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Gói tập của tôi
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Theo dõi quyền lợi, số buổi tập khả dụng và thời hạn sử dụng các gói thẻ đã đăng ký tại trung tâm
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/portal/member/plans"
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md bg-[#17664e] hover:bg-[#135641] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Khám phá gói mới</span>
            </Link>
            <div className="h-10 w-10 rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center shrink-0 border border-emerald-100">
              <Dumbbell className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3 Summary Stats Cards */}
        {subsList.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Active Packages */}
            <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Gói đang sử dụng
                </span>
                <p className="text-xl font-black text-slate-900 font-mono mt-1">
                  {activeSubs.length}{' '}
                  <span className="text-xs font-normal text-slate-500">gói thẻ</span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-md bg-white text-[#17664e] flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                <Dumbbell className="w-5 h-5" />
              </div>
            </div>

            {/* Remaining Group Sessions */}
            <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Số buổi lớp nhóm còn
                </span>
                <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                  {totalRemainingGroup}{' '}
                  <span className="text-xs font-normal text-slate-500">buổi tập</span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-md bg-white text-emerald-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
            </div>

            {/* Remaining PT Sessions */}
            <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Số buổi kèm PT 1:1 còn
                </span>
                <p className="text-xl font-black text-slate-900 font-mono mt-1">
                  {totalRemainingPt}{' '}
                  <span className="text-xs font-normal text-slate-500">buổi PT</span>
                </p>
              </div>
              <div className="h-10 w-10 rounded-md bg-white text-slate-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        {subsList.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer border',
                filterStatus === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}
            >
              Tất cả ({subsList.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('ACTIVE')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer border',
                filterStatus === 'ACTIVE'
                  ? 'bg-[#17664e] text-white border-[#17664e] shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}
            >
              Đang sử dụng ({activeSubs.length})
            </button>

            <button
              type="button"
              onClick={() => setFilterStatus('EXPIRED')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer border',
                filterStatus === 'EXPIRED'
                  ? 'bg-slate-700 text-white border-slate-700 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50',
              )}
            >
              Đã hết hạn ({expiredSubs.length})
            </button>
          </div>
        )}

        {/* Loading & Error States */}
        <StateMessage
          loading={subscriptions.isPending}
          error={subscriptions.error}
          onRetry={() => void subscriptions.refetch()}
        />

        {/* Empty State: No Subscriptions */}
        {subscriptions.isSuccess && subsList.length === 0 && (
          <div className="flex flex-col items-center rounded-md p-8 sm:p-12 text-center bg-slate-50/70 border border-dashed border-slate-200">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-md bg-emerald-50 text-[#17664e] border border-emerald-100">
              <Dumbbell aria-hidden="true" className="h-7 w-7" />
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Bạn chưa đăng ký gói tập nào
            </h2>
            <p className="mb-5 mt-1.5 max-w-md text-xs text-slate-500 leading-relaxed">
              Khám phá ngay danh mục các gói tập Gym, Yoga, Boxing & Zumba tiêu chuẩn cao cấp để bắt đầu hành trình thể chất.
            </p>
            <Link
              to="/portal/member/plans"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#17664e] hover:bg-[#135641] text-white text-xs font-bold shadow-2xs transition-all"
            >
              <span>Khám phá các gói tập</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Empty Filter State */}
        {subscriptions.isSuccess && subsList.length > 0 && filteredSubs.length === 0 && (
          <div className="p-8 text-center bg-slate-50/70 rounded-md border border-slate-200">
            <p className="text-xs text-slate-500 font-medium">
              Không có gói tập nào trong mục này.
            </p>
          </div>
        )}

        {/* Subscriptions Grid */}
        {filteredSubs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredSubs.map((item) => (
              <SubscriptionCard
                key={item.id}
                item={item}
                discipline={disciplines.data?.find((d) => d.id === item.disciplineId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SubscriptionsPage
