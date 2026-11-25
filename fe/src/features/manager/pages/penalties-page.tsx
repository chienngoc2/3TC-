import { useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCircle2, Clock, RotateCcw, Search, UserCheck, X, XCircle } from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import type { CancellationRequest, CoachPenalty, CoachExceptionSlot, CoachPayoutItem } from '../types/manager.types'
import { cancellationStatusLabel, errorMessage, formatDateTime, formatCurrency } from '../lib/format'
import { useNotification } from '@/context/notification-context'
import {
  Btn,
  EmptyRow,
  Field,
  FormError,
  Modal,
  PageHeader,
  Panel,
  Pill,
  SelectInput,
  StateMessage,
  Table,
  Tabs,
  Td,
  TextArea,
  TextInput,
  Th,
  Pagination,
} from '../components/manager-ui'
import { usePagination } from '../lib/use-pagination'

type Tab = 'pending' | 'assign' | 'exceptions' | 'history' | 'penalties' | 'payouts'

const statusTone = {
  PENDING: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
} as const
const actionLabel: Record<string, string> = {
  NONE: 'Không xử lý',
  WARNING: 'Nhắc nhở',
  SUGGEST_RATE_REDUCTION_15PCT: 'Đề xuất giảm 15% biểu phí',
  TEMP_SUSPEND: 'Tạm đình chỉ',
}

export function ManagerPenaltiesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useNotification()
  const [tab, setTab] = useState<Tab>('pending')
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${m}`
  })

  const requests = useQuery({
    queryKey: managerKeys.cancellations,
    queryFn: managerApi.cancellations,
  })
  const penalties = useQuery({ queryKey: managerKeys.penalties, queryFn: managerApi.penalties })
  const staff = useQuery({ queryKey: managerKeys.staff, queryFn: managerApi.staff })
  const coachesQuery = useQuery({ queryKey: managerKeys.coaches, queryFn: managerApi.coaches })
  const schedules = useQuery({ queryKey: managerKeys.schedules, queryFn: managerApi.schedules })
  const exceptions = useQuery({
    queryKey: managerKeys.exceptions,
    queryFn: managerApi.pendingExceptions,
  })
  const payouts = useQuery({
    queryKey: managerKeys.payouts(selectedMonth),
    queryFn: () => managerApi.payoutSummary(selectedMonth),
  })

  const [approving, setApproving] = useState<CancellationRequest | null>(null)
  const [rejecting, setRejecting] = useState<CancellationRequest | null>(null)
  const [detailItem, setDetailItem] = useState<CancellationRequest | null>(null)
  const [reviewing, setReviewing] = useState<CoachPenalty | null>(null)
  const [approvingException, setApprovingException] = useState<CoachExceptionSlot | null>(null)
  const [rejectingException, setRejectingException] = useState<CoachExceptionSlot | null>(null)
  const [payingCoach, setPayingCoach] = useState<CoachPayoutItem | null>(null)
  const [reassigningRequest, setReassigningRequest] = useState<CancellationRequest | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Filters for Gán HLV dạy thay & Đã xử lý tabs
  const [assignSearch, setAssignSearch] = useState('')
  const [assignStatus, setAssignStatus] = useState<'ALL' | 'NEEDS_SUBSTITUTE' | 'PENDING_ACCEPTANCE' | 'DECLINED'>('ALL')
  const [historySearch, setHistorySearch] = useState('')
  const [historyStatus, setHistoryStatus] = useState<'ALL' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>('ALL')

  const coachName = (id: string) => staff.data?.find((user) => user.id === id)?.fullName ?? 'HLV'
  const scheduleById = new Map((schedules.data ?? []).map((s) => [s.id, s]))
  const all = requests.data ?? []
  const pending = all.filter(
    (item) => item.status === 'PENDING' && item.substitutionStatus !== 'ACCEPTED',
  )
  const awaitingSubstitute = all.filter(
    (item) =>
      item.status === 'APPROVED' &&
      (item.substitutionStatus === 'NEEDS_SUBSTITUTE' ||
        item.substitutionStatus === 'DECLINED' ||
        item.substitutionStatus === 'PENDING_ACCEPTANCE'),
  )
  const history = all.filter((item) => item.status !== 'PENDING')
  const penaltyRows = penalties.data ?? []
  const openPenalties = penaltyRows.filter((p) => !p.isReviewedByManager).length
  const pendingExceptions = exceptions.data ?? []

  const filteredAwaiting = useMemo(() => {
    const q = assignSearch.trim().toLowerCase()
    return awaitingSubstitute.filter((item) => {
      if (assignStatus !== 'ALL') {
        const subStatus = item.substitutionStatus || 'NEEDS_SUBSTITUTE'
        if (subStatus !== assignStatus) return false
      }
      if (q) {
        const haystack = [
          coachName(item.coachId),
          item.substituteCoachName || (item.substituteCoachId ? coachName(item.substituteCoachId) : ''),
          item.reasonMessage,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [awaitingSubstitute, assignSearch, assignStatus, staff.data])

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    return history.filter((item) => {
      if (historyStatus !== 'ALL' && item.status !== historyStatus) return false
      if (q) {
        const haystack = [
          coachName(item.coachId),
          item.substituteCoachName || (item.substituteCoachId ? coachName(item.substituteCoachId) : ''),
          item.reasonMessage,
          item.rejectionReason,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [history, historySearch, historyStatus, staff.data])

  const pendingPage = usePagination(pending, 10)
  const awaitingPage = usePagination(filteredAwaiting, 10, `${assignSearch}|${assignStatus}`)
  const historyPage = usePagination(filteredHistory, 10, `${historySearch}|${historyStatus}`)
  const penaltyPage = usePagination(penaltyRows, 10)
  const exceptionsPage = usePagination(pendingExceptions, 10)

  const refreshRequests = () => {
    void queryClient.invalidateQueries({ queryKey: managerKeys.cancellations })
    void queryClient.invalidateQueries({ queryKey: managerKeys.summary })
    void queryClient.invalidateQueries({ queryKey: managerKeys.penalties })
    void queryClient.invalidateQueries({ queryKey: managerKeys.exceptions })
  }
  const approve = useMutation({
    mutationFn: (id: string) => managerApi.reviewCancellation(id, { action: 'APPROVE' }),
    onSuccess: () => {
      setError(null)
      showToast('success', 'Thành công', 'Đã duyệt đơn xin nghỉ ca.')
      refreshRequests()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi xử lý', msg)
      refreshRequests()
    },
  })
  const withdraw = useMutation({
    mutationFn: (id: string) => managerApi.withdrawCancellation(id),
    onSuccess: () => {
      setError(null)
      showToast('success', 'Thành công', 'Đã thu hồi đơn xin nghỉ.')
      refreshRequests()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi thu hồi', msg)
      refreshRequests()
    },
  })

  const target = (item: CancellationRequest) => {
    const schedule = item.scheduleId ? scheduleById.get(item.scheduleId) : undefined
    const bookingData = (item as any).booking
    const plan = bookingData?.subscription?.plan
    const discCode = (
      bookingData?.discipline?.code ||
      plan?.discipline?.code ||
      schedule?.class?.discipline?.code ||
      ''
    ).toUpperCase()
    const planName = plan?.name || ''
    const isGroupPackage =
      item.targetType === 'GROUP_CLASS' ||
      bookingData?.bookingType === 'GROUP_CLASS' ||
      plan?.packageCategory === 'GROUP' ||
      discCode === 'YOGA' ||
      discCode === 'BOXING' ||
      planName.toLowerCase().includes('nhóm') ||
      planName.toLowerCase().includes('yoga') ||
      planName.toLowerCase().includes('boxing')

    const startTime =
      schedule?.startTime ||
      (item as any).schedule?.startTime ||
      bookingData?.coachAvailability?.startTime

    if (isGroupPackage) {
      const label = planName || schedule?.class?.name || (item as any).schedule?.class?.name || 'Lớp tập nhóm'
      return startTime ? `${label} (${formatDateTime(startTime)})` : label
    }
    const ptLabel = planName ? `Buổi PT 1-1 (${planName})` : 'Buổi PT 1-1'
    return startTime ? `${ptLabel} (${formatDateTime(startTime)})` : ptLabel
  }

  const listState = (query: typeof requests) =>
    query.isLoading || query.isError ? (
      <StateMessage
        loading={query.isLoading}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
      />
    ) : null

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Duyệt ca & Thù lao HLV"
        description="Duyệt đơn hủy ca khẩn cấp, duyệt ca ngoài giờ, xử lý kỷ luật và quyết toán thù lao HLV."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'pending', label: 'Chờ duyệt nghỉ', count: pending.length },
          { value: 'assign', label: 'Gán HLV dạy thay', count: awaitingSubstitute.length },
          { value: 'exceptions', label: 'Ca ngoài giờ chờ duyệt', count: pendingExceptions.length },
          { value: 'history', label: 'Đã xử lý', count: history.length },
          { value: 'penalties', label: 'Kỷ luật', count: openPenalties },
          { value: 'payouts', label: 'Thống kê & Thù lao HLV' },
        ]}
      />
      <div className="mb-3 empty:hidden">
        <FormError>{error}</FormError>
      </div>

      {tab === 'pending' ? (
        <Panel>
          {listState(requests) ?? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>HLV</Th>
                    <Th>Buổi bị hủy</Th>
                    <Th>Lý do</Th>
                    <Th>Gửi lúc</Th>
                    <Th className="text-right">Quyết định & Chi tiết</Th>
                  </tr>
                </thead>
                <tbody>
                  {pending.length === 0 ? (
                    <EmptyRow colSpan={5}>Không có đơn nào đang chờ duyệt.</EmptyRow>
                  ) : (
                    pendingPage.items.map((item) => (
                      <tr key={item.id}>
                        <Td className="font-medium text-slate-900">{coachName(item.coachId)}</Td>
                        <Td>
                          <div>{target(item)}</div>
                          {item.substituteCoachId && (
                            <div className="mt-1">
                              <Pill tone="green">
                                ✓ Đã có HLV {item.substituteCoachName || coachName(item.substituteCoachId)} nhận dạy thay
                              </Pill>
                            </div>
                          )}
                        </Td>
                        <Td className="max-w-[280px] whitespace-pre-line">{item.reasonMessage}</Td>
                        <Td className="whitespace-nowrap">{formatDateTime(item.createdAt)}</Td>
                        <Td className="whitespace-nowrap text-right">
                          <Btn
                            size="sm"
                            tone="primary"
                            onClick={() => setApproving(item)}
                          >
                            Duyệt
                          </Btn>
                          <Btn
                            size="sm"
                            tone="danger"
                            className="ml-1.5"
                            onClick={() => setRejecting(item)}
                          >
                            Từ chối
                          </Btn>
                          <Btn
                            size="sm"
                            tone="ghost"
                            className="ml-1.5"
                            onClick={() => setDetailItem(item)}
                          >
                            Xem chi tiết đơn
                          </Btn>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
              <Pagination pager={pendingPage.pager} />
            </>
          )}
        </Panel>
      ) : null}

      {tab === 'assign' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[260px]">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Tìm HLV xin nghỉ, HLV thay, lý do"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#17664e] focus:outline-none"
                />
                {assignSearch ? (
                  <button
                    type="button"
                    onClick={() => setAssignSearch('')}
                    aria-label="Xóa từ khóa"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <select
                value={assignStatus}
                onChange={(e) => setAssignStatus(e.target.value as typeof assignStatus)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#17664e] focus:outline-none"
              >
                <option value="ALL">Mọi trạng thái gán</option>
                <option value="NEEDS_SUBSTITUTE">Chưa gán HLV</option>
                <option value="PENDING_ACCEPTANCE">Chờ HLV nhận ca</option>
                <option value="DECLINED">HLV từ chối</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 tabular-nums">
                Hiển thị {filteredAwaiting.length} / {awaitingSubstitute.length} ca
              </span>
              {assignSearch || assignStatus !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => {
                    setAssignSearch('')
                    setAssignStatus('ALL')
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Xóa bộ lọc
                </button>
              ) : null}
            </div>
          </div>

          <Panel>
            {listState(requests) ?? (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>HLV xin nghỉ</Th>
                      <Th>Buổi tập</Th>
                      <Th>Trạng thái điều phối</Th>
                      <Th>Lý do nghỉ</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAwaiting.length === 0 ? (
                      <EmptyRow colSpan={5}>
                        {assignSearch || assignStatus !== 'ALL'
                          ? 'Không có ca nào khớp với bộ lọc hiện tại.'
                          : 'Không có ca nào đang chờ gán HLV dạy thay.'}
                      </EmptyRow>
                    ) : (
                      awaitingPage.items.map((item) => {
                        const subName =
                          item.substituteCoachName ||
                          (item.substituteCoachId ? coachName(item.substituteCoachId) : '')
                        const reqAny = item as any
                        const sessionStartIso =
                          scheduleById.get(item.scheduleId ?? '')?.startTime ||
                          reqAny.schedule?.startTime ||
                          reqAny.booking?.coachAvailability?.startTime
                        const minsToCutoff = sessionStartIso
                          ? Math.round((new Date(sessionStartIso).getTime() - 30 * 60 * 1000 - Date.now()) / 60000)
                          : null
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <Td className="font-medium text-slate-900">{coachName(item.coachId)}</Td>
                            <Td className="text-slate-700">
                              <div>{target(item)}</div>
                              {minsToCutoff !== null && minsToCutoff > 0 && minsToCutoff <= 90 && (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200">
                                  ⏳ Còn {minsToCutoff}p trước mốc tự hủy T-30m
                                </span>
                              )}
                            </Td>
                            <Td>
                              {item.substitutionStatus === 'PENDING_ACCEPTANCE' ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                                  <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" strokeWidth={1.5} />
                                  Chờ {subName || 'HLV'} xác nhận
                                </span>
                              ) : item.substitutionStatus === 'DECLINED' ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
                                    <X className="h-3.5 w-3.5 text-rose-600 shrink-0" strokeWidth={1.5} />
                                    {subName || 'HLV'} đã từ chối
                                  </span>
                                  {item.substitutionDeclinedReason ? (
                                    <p className="text-xs text-slate-500 pl-5">
                                      {item.substitutionDeclinedReason}
                                    </p>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  Tạm hủy, chưa gán HLV
                                </span>
                              )}
                            </Td>
                            <Td className="max-w-[260px] whitespace-pre-line text-xs text-slate-600">
                              {item.reasonMessage}
                            </Td>
                            <Td className="whitespace-nowrap text-right space-x-1.5">
                              <Btn
                                size="sm"
                                tone="primary"
                                onClick={() => setReassigningRequest(item)}
                              >
                                Gán HLV dạy thay
                              </Btn>
                              <Btn
                                size="sm"
                                tone="ghost"
                                onClick={() => setDetailItem(item)}
                              >
                                Chi tiết
                              </Btn>
                            </Td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </Table>
                <Pagination pager={awaitingPage.pager} />
              </>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'history' ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[260px]">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Tìm HLV, HLV dạy thay, lý do"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#17664e] focus:outline-none"
                />
                {historySearch ? (
                  <button
                    type="button"
                    onClick={() => setHistorySearch('')}
                    aria-label="Xóa từ khóa"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <select
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value as typeof historyStatus)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#17664e] focus:outline-none"
              >
                <option value="ALL">Mọi kết quả</option>
                <option value="APPROVED">Đã duyệt</option>
                <option value="REJECTED">Từ chối</option>
                <option value="CANCELLED">HLV tự rút</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 tabular-nums">
                Hiển thị {filteredHistory.length} / {history.length} đơn
              </span>
              {historySearch || historyStatus !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('')
                    setHistoryStatus('ALL')
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Xóa bộ lọc
                </button>
              ) : null}
            </div>
          </div>

          <Panel>
            {listState(requests) ?? (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>HLV xin nghỉ</Th>
                      <Th>Buổi tập</Th>
                      <Th>Lý do</Th>
                      <Th>Kết quả</Th>
                      <Th>Tình trạng</Th>
                      <Th>Xử lý lúc</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.length === 0 ? (
                      <EmptyRow colSpan={7}>
                        {historySearch || historyStatus !== 'ALL'
                          ? 'Không có đơn nào khớp với bộ lọc hiện tại.'
                          : 'Chưa có đơn đã xử lý.'}
                      </EmptyRow>
                    ) : (
                      historyPage.items.map((item) => {
                        const subName =
                          item.substituteCoachName ||
                          (item.substituteCoachId ? coachName(item.substituteCoachId) : '')
                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                            <Td className="font-medium text-slate-900">{coachName(item.coachId)}</Td>
                            <Td className="text-slate-700">{target(item)}</Td>
                            <Td className="max-w-[240px] text-xs text-slate-600">
                              <div className="line-clamp-2">{item.reasonMessage}</div>
                              {item.rejectionReason ? (
                                <div className="mt-1 text-rose-700">
                                  Từ chối: {item.rejectionReason}
                                </div>
                              ) : null}
                            </Td>
                            <Td className="whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Pill tone={statusTone[item.status]}>
                                  {cancellationStatusLabel[item.status]}
                                </Pill>
                                {item.isFrontdeskOverride ? (
                                  <span className="text-xs text-slate-400">Lễ tân</span>
                                ) : null}
                              </div>
                            </Td>
                            <Td>
                              {item.substituteCoachId ? (
                                item.substitutionStatus === 'PENDING_ACCEPTANCE' ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" strokeWidth={1.5} />
                                    Chờ {subName} nhận ca
                                  </span>
                                ) : item.substitutionStatus === 'ACCEPTED' ? (
                                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" strokeWidth={1.5} />
                                    {subName} nhận dạy thay
                                  </span>
                                ) : item.substitutionStatus === 'DECLINED' ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
                                      <X className="h-3.5 w-3.5 text-rose-600 shrink-0" strokeWidth={1.5} />
                                      {subName} từ chối ca
                                    </span>
                                    {item.substitutionDeclinedReason ? (
                                      <div className="text-xs text-slate-500 pl-5">
                                        {item.substitutionDeclinedReason}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-600">{subName}</span>
                                )
                              ) : item.status === 'APPROVED' && item.substitutionStatus === 'NEEDS_SUBSTITUTE' ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                  Chờ gán HLV dạy thay
                                </span>
                              ) : item.status === 'APPROVED' ? (
                                <span className="text-xs text-slate-600">Đã hủy ca &amp; hoàn lượt</span>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </Td>
                            <Td className="whitespace-nowrap tabular-nums text-xs text-slate-600">
                              {formatDateTime(item.reviewedAt ?? item.createdAt)}
                            </Td>
                            <Td className="whitespace-nowrap text-right space-x-1.5">
                              {item.substituteCoachId && item.substitutionStatus === 'DECLINED' ? (
                                <Btn
                                  size="sm"
                                  tone="secondary"
                                  onClick={() => setReassigningRequest(item)}
                                >
                                  Gán HLV khác
                                </Btn>
                              ) : null}
                              <Btn
                                size="sm"
                                tone="ghost"
                                onClick={() => setDetailItem(item)}
                              >
                                Chi tiết
                              </Btn>
                            </Td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </Table>
                <Pagination pager={historyPage.pager} />
              </>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'penalties' ? (
        <Panel>
          {penalties.isLoading || penalties.isError ? (
            <StateMessage
              loading={penalties.isLoading}
              error={penalties.isError ? errorMessage(penalties.error) : null}
              onRetry={() => void penalties.refetch()}
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>HLV</Th>
                    <Th>Tháng</Th>
                    <Th>Hệ thống đề xuất</Th>
                    <Th>Quyết định của quản lý</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {penaltyRows.length === 0 ? (
                    <EmptyRow colSpan={5}>Chưa có vi phạm nào.</EmptyRow>
                  ) : (
                    penaltyPage.items.map((p) => (
                      <tr key={p.id}>
                        <Td className="font-medium text-slate-900">{coachName(p.coachId)}</Td>
                        <Td className="tabular-nums">{p.appliedMonth}</Td>
                        <Td>
                          {actionLabel[p.suggestedAction] ?? p.suggestedAction}
                          {Number(p.suggestedRateReductionPct) > 0
                            ? `, giảm ${Number(p.suggestedRateReductionPct)}% biểu phí`
                            : ''}
                          {p.notes ? (
                            <div className="mt-1 text-xs text-slate-400">{p.notes}</div>
                          ) : null}
                        </Td>
                        <Td className="max-w-[300px]">
                          {p.isReviewedByManager ? (
                            <>
                              <div className="whitespace-pre-line">{p.managerFinalDecision}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {formatDateTime(p.reviewedAt)}
                              </div>
                            </>
                          ) : (
                            <Pill tone="amber">Chưa chốt</Pill>
                          )}
                        </Td>
                        <Td className="text-right">
                          <Btn size="sm" onClick={() => setReviewing(p)}>
                            {p.isReviewedByManager ? 'Sửa quyết định' : 'Chốt quyết định'}
                          </Btn>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
              <Pagination pager={penaltyPage.pager} />
            </>
          )}
        </Panel>
      ) : null}

      {tab === 'exceptions' ? (
        <Panel>
          {exceptions.isLoading || exceptions.isError ? (
            <StateMessage
              loading={exceptions.isLoading}
              error={exceptions.isError ? errorMessage(exceptions.error) : null}
              onRetry={() => void exceptions.refetch()}
            />
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>HLV</Th>
                    <Th>Khung giờ xin dạy</Th>
                    <Th>Lý do ngoại lệ</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {pendingExceptions.length === 0 ? (
                    <EmptyRow colSpan={5}>Không có ca ngoài giờ nào đang chờ duyệt.</EmptyRow>
                  ) : (
                    exceptionsPage.items.map((slot) => (
                      <tr key={slot.id}>
                        <Td className="font-medium text-slate-900">
                          <div>{slot.coach?.fullName ?? 'HLV'}</div>
                          {slot.coach?.phone && (
                            <div className="text-xs text-slate-400 font-mono">{slot.coach.phone}</div>
                          )}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <div className="font-semibold text-slate-800">
                            {formatDateTime(slot.startTime)}
                          </div>
                          <div className="text-xs text-slate-500">
                            đến {formatDateTime(slot.endTime)}
                          </div>
                          {(() => {
                            const deadlineTime = new Date(new Date(slot.startTime).getTime() - 60 * 60 * 1000);
                            const msLeft = deadlineTime.getTime() - Date.now();
                            const minsLeft = Math.round(msLeft / 60000);
                            if (minsLeft <= 0) {
                              return (
                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                  ⚠️ Đã quá hạn duyệt
                                </div>
                              );
                            }
                            if (minsLeft <= 60) {
                              return (
                                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  ⏰ Còn {minsLeft} phút duyệt
                                </div>
                              );
                            }
                            return (
                              <div className="mt-0.5 text-[11px] text-slate-400">
                                Hạn duyệt: trước {formatDateTime(deadlineTime.toISOString())}
                              </div>
                            );
                          })()}
                        </Td>
                        <Td className="max-w-[280px]">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[11px] bg-amber-50 text-amber-800 border border-amber-200 font-semibold mb-1">
                            Ca ngoại lệ
                          </span>
                          <div className="text-xs text-slate-700 whitespace-pre-line">
                            {slot.exceptionReason || 'HLV xin mở khung giờ ngoài ca trực'}
                          </div>
                        </Td>
                        <Td>
                          <Pill tone="amber">Chờ duyệt</Pill>
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          <Btn
                            size="sm"
                            tone="primary"
                            onClick={() => setApprovingException(slot)}
                          >
                            Duyệt
                          </Btn>
                          <Btn
                            size="sm"
                            tone="danger"
                            className="ml-1.5"
                            onClick={() => setRejectingException(slot)}
                          >
                            Từ chối
                          </Btn>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
              <Pagination pager={exceptionsPage.pager} />
            </>
          )}
        </Panel>
      ) : null}

      {tab === 'payouts' ? (
        <Panel>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Thống kê ca dạy & Quyết toán thù lao
                </h3>
                <p className="text-xs text-slate-500">
                  Xem số ca dạy lớp nhóm, ca dạy kèm PT 1-1 và thanh toán cho HLV theo tháng.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Tháng:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            {payouts.isLoading || payouts.isError ? (
              <StateMessage
                loading={payouts.isLoading}
                error={payouts.isError ? errorMessage(payouts.error) : null}
                onRetry={() => void payouts.refetch()}
              />
            ) : (
              <>
                {/* Metric Summary Cards */}
                {(() => {
                  const rows = payouts.data ?? []
                  const totalSessionsAll = rows.reduce((acc, p) => acc + p.totalSessions, 0)
                  const totalAmountAll = rows.reduce((acc, p) => acc + p.totalAmount, 0)
                  const paidRows = rows.filter((p) => p.status === 'PAID')
                  const unpaidRows = rows.filter((p) => p.status === 'UNPAID')
                  const totalPaidAmount = paidRows.reduce((acc, p) => acc + p.totalAmount, 0)
                  const totalUnpaidAmount = unpaidRows.reduce((acc, p) => acc + p.totalAmount, 0)

                  return (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">Tổng ca đã dạy</span>
                        <span className="text-xl font-black text-slate-900 mt-1 block">{totalSessionsAll}</span>
                        <span className="text-[10px] text-slate-400">Tất cả HLV trong tháng</span>
                      </div>
                      <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
                        <span className="text-[11px] font-bold text-emerald-700 uppercase block">Tổng thù lao</span>
                        <span className="text-xl font-black text-emerald-800 mt-1 block">{formatCurrency(totalAmountAll)}</span>
                        <span className="text-[10px] text-emerald-600">Ước tính cả tháng</span>
                      </div>
                      <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200">
                        <span className="text-[11px] font-bold text-blue-700 uppercase block">Đã thanh toán</span>
                        <span className="text-xl font-black text-blue-800 mt-1 block">{formatCurrency(totalPaidAmount)}</span>
                        <span className="text-[10px] text-blue-600">{paidRows.length} HLV đã nhận</span>
                      </div>
                      <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200">
                        <span className="text-[11px] font-bold text-amber-700 uppercase block">Chờ quyết toán</span>
                        <span className="text-xl font-black text-amber-800 mt-1 block">{formatCurrency(totalUnpaidAmount)}</span>
                        <span className="text-[10px] text-amber-600">{unpaidRows.length} HLV chưa quyết toán</span>
                      </div>
                    </div>
                  )
                })()}

                <Table>
                  <thead>
                    <tr>
                      <Th>HLV</Th>
                      <Th>Thông tin tài khoản NH</Th>
                      <Th className="text-center">Lớp nhóm</Th>
                      <Th className="text-center">Kèm PT</Th>
                      <Th className="text-center">Tổng ca</Th>
                      <Th className="text-right">Đơn giá</Th>
                      <Th className="text-right">Tổng tiền</Th>
                      <Th className="text-center">Trạng thái</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(payouts.data ?? []).length === 0 ? (
                      <EmptyRow colSpan={9}>Không có dữ liệu thù lao trong tháng này.</EmptyRow>
                    ) : (
                      (payouts.data ?? []).map((row) => (
                        <tr key={row.coachId}>
                          <Td className="font-medium text-slate-900 whitespace-nowrap">
                            <div>{row.coachName}</div>
                            {row.phone && (
                              <div className="text-xs text-slate-400 font-mono">{row.phone}</div>
                            )}
                          </Td>
                          <Td className="text-xs">
                            {row.bankAccountNumber ? (
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-800">{row.bankName ?? 'Ngân hàng'}</div>
                                <div className="font-mono text-emerald-800 font-bold">{row.bankAccountNumber}</div>
                                <div className="text-slate-500">{row.bankAccountName ?? row.coachName}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Chưa có thông tin NH</span>
                            )}
                          </Td>
                          <Td className="text-center font-semibold text-slate-800">{row.groupSessionCount}</Td>
                          <Td className="text-center font-semibold text-slate-800">{row.ptSessionCount}</Td>
                          <Td className="text-center font-bold text-slate-900">{row.totalSessions}</Td>
                          <Td className="text-right text-xs text-slate-600">{formatCurrency(row.ratePerSession)}</Td>
                          <Td className="text-right font-extrabold text-emerald-700 whitespace-nowrap">
                            {formatCurrency(row.totalAmount)}
                          </Td>
                          <Td className="text-center whitespace-nowrap">
                            {row.status === 'PAID' ? (
                              <div>
                                <Pill tone="green">Đã thanh toán</Pill>
                                {row.paidAt && (
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    {formatDateTime(row.paidAt)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <Pill tone="amber">Chưa thanh toán</Pill>
                            )}
                          </Td>
                          <Td className="text-right whitespace-nowrap">
                            {row.status === 'UNPAID' ? (
                              <Btn
                                size="sm"
                                tone="primary"
                                onClick={() => setPayingCoach(row)}
                              >
                                Thanh toán
                              </Btn>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Hoàn tất</span>
                            )}
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </>
            )}
          </div>
        </Panel>
      ) : null}

      {detailItem ? (
        <CancellationDetailModal
          request={detailItem}
          coachName={coachName(detailItem.coachId)}
          substituteCoachName={detailItem.substituteCoachId ? coachName(detailItem.substituteCoachId) : undefined}
          targetName={target(detailItem)}
          onClose={() => setDetailItem(null)}
          onApprove={() => {
            const req = detailItem
            setDetailItem(null)
            setApproving(req)
          }}
          onReject={() => {
            const req = detailItem
            setDetailItem(null)
            setRejecting(req)
          }}
          onWithdraw={() => {
            if (
              window.confirm(
                'Hủy đơn này? Buổi tập vẫn giữ nguyên như chưa có đơn.',
              )
            ) {
              withdraw.mutate(detailItem.id)
              setDetailItem(null)
            }
          }}
          onReassign={(req) => setReassigningRequest(req)}
          isApproving={approve.isPending}
          isWithdrawing={withdraw.isPending}
        />
      ) : null}

      {approving ? (
        <ApproveForm
          request={approving}
          coachName={coachName(approving.coachId)}
          coaches={staff.data ?? []}
          targetDesc={target(approving)}
          onClose={() => setApproving(null)}
          onDone={() => {
            setApproving(null)
            refreshRequests()
          }}
        />
      ) : null}

      {rejecting ? (
        <RejectForm
          request={rejecting}
          coachName={coachName(rejecting.coachId)}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null)
            refreshRequests()
          }}
        />
      ) : null}

      {reviewing ? (
        <PenaltyForm
          penalty={reviewing}
          coachName={coachName(reviewing.coachId)}
          onClose={() => setReviewing(null)}
          onDone={() => {
            setReviewing(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.penalties })
          }}
        />
      ) : null}

      {approvingException ? (
        <ApproveExceptionModal
          slot={approvingException}
          onClose={() => setApprovingException(null)}
          onDone={() => {
            setApprovingException(null)
            refreshRequests()
          }}
        />
      ) : null}

      {rejectingException ? (
        <RejectExceptionModal
          slot={rejectingException}
          onClose={() => setRejectingException(null)}
          onDone={() => {
            setRejectingException(null)
            refreshRequests()
          }}
        />
      ) : null}

      {payingCoach ? (
        <PayCoachModal
          payout={payingCoach}
          month={selectedMonth}
          onClose={() => setPayingCoach(null)}
          onDone={() => {
            setPayingCoach(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.payouts(selectedMonth) })
          }}
        />
      ) : null}

      {reassigningRequest ? (
        <ReassignSubstituteModal
          request={reassigningRequest}
          coaches={coachesQuery.data ?? staff.data ?? []}
          targetDesc={target(reassigningRequest)}
          onClose={() => setReassigningRequest(null)}
          onDone={() => {
            setReassigningRequest(null)
            refreshRequests()
          }}
        />
      ) : null}
    </div>
  )
}

function CancellationDetailModal({
  request,
  coachName,
  substituteCoachName,
  targetName,
  onClose,
  onApprove,
  onReject,
  onWithdraw,
  onReassign,
  isApproving,
  isWithdrawing,
}: {
  request: CancellationRequest
  coachName: string
  substituteCoachName?: string
  targetName: string
  onClose: () => void
  onApprove?: () => void
  onReject?: () => void
  onWithdraw?: () => void
  onReassign?: (request: CancellationRequest) => void
  isApproving?: boolean
  isWithdrawing?: boolean
}) {
  const isPending = request.status === 'PENDING'

  return (
    <Modal
      title="Chi tiết đơn hủy ca khẩn cấp"
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-2">
          <div>
            {isPending && onWithdraw && (
              <Btn
                size="sm"
                tone="ghost"
                disabled={isWithdrawing}
                onClick={onWithdraw}
                title="Hủy đơn mà không duyệt hay từ chối"
              >
                {isWithdrawing ? 'Đang hủy đơn…' : 'Hủy đơn này'}
              </Btn>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={onClose}>
              Đóng
            </Btn>
            {isPending && onReject && (
              <Btn size="sm" tone="danger" onClick={onReject}>
                Từ chối
              </Btn>
            )}
            {isPending && onApprove && (
              <Btn size="sm" tone="primary" disabled={isApproving} onClick={onApprove}>
                {isApproving ? 'Đang duyệt…' : 'Duyệt đơn'}
              </Btn>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 grid grid-cols-[136px_1fr] gap-y-3 gap-x-4 items-baseline text-sm">
          <dt className="text-xs font-medium text-slate-500">Huấn luyện viên</dt>
          <dd className="font-medium text-slate-900">{coachName}</dd>

          {request.substituteCoachId ? (
            <>
              <dt className="text-xs font-medium text-slate-500">HLV dạy thay</dt>
              <dd className="space-y-1">
                <div className="font-medium text-slate-900">
                  {substituteCoachName ?? request.substituteCoachName ?? 'HLV thay thế'}
                </div>
                {request.substitutionStatus === 'PENDING_ACCEPTANCE' ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
                    <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" strokeWidth={1.5} />
                    <span>Đang chờ HLV đồng ý nhận ca</span>
                  </div>
                ) : null}
                {request.substitutionStatus === 'ACCEPTED' ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" strokeWidth={1.5} />
                    <span>HLV đã đồng ý nhận ca</span>
                  </div>
                ) : null}
                {request.substitutionStatus === 'DECLINED' ? (
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
                      <X className="h-3.5 w-3.5 text-rose-600 shrink-0" strokeWidth={1.5} />
                      <span>
                        HLV đã từ chối: {request.substitutionDeclinedReason || 'Bận việc'}
                      </span>
                    </div>
                    {onReassign ? (
                      <div>
                        <Btn
                          size="sm"
                          tone="secondary"
                          onClick={() => {
                            onClose()
                            onReassign(request)
                          }}
                        >
                          Gán HLV thay thế khác
                        </Btn>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </dd>
            </>
          ) : null}

          <dt className="text-xs font-medium text-slate-500">Buổi tập bị hủy</dt>
          <dd className="text-sm text-slate-800 leading-snug">{targetName}</dd>

          <dt className="text-xs font-medium text-slate-500">Thời gian gửi đơn</dt>
          <dd className="text-xs text-slate-700 tabular-nums">{formatDateTime(request.createdAt)}</dd>

          <dt className="text-xs font-medium text-slate-500 pt-2 border-t border-slate-200/80">
            Trạng thái
          </dt>
          <dd className="pt-2 border-t border-slate-200/80">
            <Pill tone={statusTone[request.status]}>
              {cancellationStatusLabel[request.status]}
            </Pill>
          </dd>
        </dl>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-600">Mô tả lý do hủy ca của HLV</div>
          <div className="p-3.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 whitespace-pre-line leading-relaxed">
            {request.reasonMessage || 'Không có mô tả chi tiết'}
          </div>
        </div>

        {request.rejectionReason ? (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-rose-700">Lý do từ chối của Quản lý</div>
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 whitespace-pre-line leading-relaxed">
              {request.rejectionReason}
            </div>
          </div>
        ) : null}

        {request.reviewedAt ? (
          <p className="text-xs text-slate-500 tabular-nums">
            Đã xử lý lúc {formatDateTime(request.reviewedAt)}
            {request.isFrontdeskOverride ? ' (do Lễ tân xử lý)' : ''}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}

function ApproveForm({
  request,
  coachName,
  targetDesc,
  onClose,
  onDone,
}: {
  request: CancellationRequest
  coachName: string
  coaches?: any[]
  targetDesc: string
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useNotification()
  const [error, setError] = useState<string | null>(null)
  const hasVolunteer = Boolean(request.substituteCoachId && request.substitutionStatus === 'ACCEPTED')
  const volunteerName = request.substituteCoachName || 'HLV dạy thay'
  const [decisionMode, setDecisionMode] = useState<'HOLD_FOR_SUBSTITUTE' | 'CANCEL_SESSION'>('HOLD_FOR_SUBSTITUTE')

  const approve = useMutation({
    mutationFn: (holdForSubstitute: boolean) =>
      managerApi.reviewCancellation(request.id, {
        action: 'APPROVE',
        holdForSubstitute,
      }),
    onSuccess: (_data, holdForSubstitute) => {
      showToast(
        'success',
        holdForSubstitute ? 'Đã tạm hủy ca' : 'Duyệt đơn thành công',
        holdForSubstitute
          ? `Đã duyệt tạm hủy ca của HLV ${coachName}. Vui lòng sang tab "Gán HLV dạy thay" để chọn HLV phù hợp.`
          : `Đã duyệt đơn nghỉ và hủy ca cho HLV ${coachName}.`,
      )
      onDone()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi duyệt đơn', msg)
    },
  })

  const handleConfirm = () => {
    if (hasVolunteer) {
      approve.mutate(false)
      return
    }
    approve.mutate(decisionMode === 'HOLD_FOR_SUBSTITUTE')
  }

  return (
    <Modal
      title={`Duyệt đơn nghỉ ca: ${coachName}`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Btn tone="ghost" onClick={onClose} disabled={approve.isPending}>
            Đóng
          </Btn>
          <Btn
            tone={!hasVolunteer && decisionMode === 'CANCEL_SESSION' ? 'danger' : 'primary'}
            disabled={approve.isPending}
            onClick={handleConfirm}
          >
            {approve.isPending
              ? 'Đang xử lý…'
              : hasVolunteer
              ? 'Duyệt & Bàn giao ca'
              : decisionMode === 'HOLD_FOR_SUBSTITUTE'
              ? 'Xác nhận tạm hủy'
              : 'Xác nhận hủy ca'}
          </Btn>
        </div>
      }
    >
      <div className="space-y-4">
        <dl className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 grid grid-cols-[92px_1fr] gap-y-2 gap-x-3 text-xs">
          <dt className="font-medium text-slate-500">Ca tập</dt>
          <dd className="font-medium text-slate-900">{targetDesc}</dd>
          <dt className="font-medium text-slate-500">Lý do nghỉ</dt>
          <dd className="text-slate-700 break-words leading-relaxed">{request.reasonMessage}</dd>
        </dl>

        {hasVolunteer ? (
          <div className="rounded-xl bg-emerald-50/70 p-3.5 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-950">
            <CheckCircle2 className="h-4 w-4 text-[#17664e] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="space-y-0.5">
              <p className="font-semibold">
                HLV {volunteerName} đã nhận dạy thay ca này
              </p>
              <p className="text-emerald-800 leading-relaxed">
                Lịch học viên được giữ nguyên và chuyển giao cho HLV {volunteerName} sau khi duyệt.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700">
              Phương án xử lý
            </span>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setDecisionMode('HOLD_FOR_SUBSTITUTE')}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                  decisionMode === 'HOLD_FOR_SUBSTITUTE'
                    ? 'border-[#17664e] bg-emerald-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <UserCheck
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    decisionMode === 'HOLD_FOR_SUBSTITUTE' ? 'text-[#17664e]' : 'text-slate-400'
                  }`}
                  strokeWidth={1.5}
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-900">
                    Tạm hủy &amp; tìm HLV dạy thay
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Giữ nguyên lịch học viên, chuyển ca sang tab Gán HLV dạy thay.
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecisionMode('CANCEL_SESSION')}
                className={`w-full text-left p-3 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                  decisionMode === 'CANCEL_SESSION'
                    ? 'border-rose-500 bg-rose-50/60 text-slate-900'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <XCircle
                  className={`h-4 w-4 shrink-0 mt-0.5 ${
                    decisionMode === 'CANCEL_SESSION' ? 'text-rose-600' : 'text-slate-400'
                  }`}
                  strokeWidth={1.5}
                />
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-slate-900">
                    Hủy hoàn toàn ca dạy
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Đóng ca học, tự động hoàn 100% lượt tập và gửi email cho học viên.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        <FormError>{error}</FormError>
      </div>
    </Modal>
  )
}

function ReassignSubstituteModal({
  request,
  coaches,
  targetDesc,
  onClose,
  onDone,
}: {
  request: CancellationRequest
  coaches: Array<any>
  targetDesc: string
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useNotification()
  const [substituteCoachId, setSubstituteCoachId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const eligibleQuery = useQuery({
    queryKey: managerKeys.eligibleSubstitutes(request.id),
    queryFn: () => managerApi.eligibleSubstitutesForRequest(request.id),
  })

  const reassign = useMutation({
    mutationFn: () => managerApi.reassignSubstitute(request.id, substituteCoachId),
    onSuccess: () => {
      showToast('success', 'Phân công thành công', 'Đã phân công huấn luyện viên dạy thay mới.')
      onDone()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi phân công', msg)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!substituteCoachId) {
      setError('Vui lòng chọn huấn luyện viên thay thế.')
      return
    }
    reassign.mutate()
  }

  // Strictly match requesting coach's star rating AND specialty/discipline
  const requestingCoach = coaches.find((c) => c.id === request.coachId)
  const reqStars: number = requestingCoach?.coachProfile?.ratingStars ?? 2
  const reqSpecs = (requestingCoach?.coachProfile?.coachSpecialties ?? []) as any[]
  const reqSpecIds = new Set(reqSpecs.map((cs) => cs.specialtyId || cs.specialty?.id).filter(Boolean))
  const reqDiscIds = new Set([
    ...reqSpecs.map((cs) => cs.specialty?.disciplineId).filter(Boolean),
    ...((requestingCoach?.coachRates ?? []) as any[]).map((r) => r.disciplineId).filter(Boolean),
  ])

  const reqAny = request as any
  const sessionDiscId: string | undefined =
    reqAny.schedule?.class?.discipline?.id ||
    reqAny.booking?.discipline?.id ||
    reqAny.booking?.subscription?.plan?.discipline?.id

  const rawPool = eligibleQuery.data ?? []
  const candidateCoaches = rawPool.filter((c: any) => {
    if (c.id === request.coachId) return false
    if (c.id === request.substituteCoachId) return false
    if (c.role && c.role !== 'COACH') return false
    return true
  })

  const selectedCoachObj = candidateCoaches.find((c: any) => c.id === substituteCoachId)

  return (
    <Modal
      title="Gán huấn luyện viên dạy thay khác"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn
            tone="primary"
            type="submit"
            form="reassign-substitute-form"
            disabled={reassign.isPending || !substituteCoachId}
          >
            {reassign.isPending ? 'Đang gửi…' : 'Gửi lời mời nhận ca'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-700 space-y-1 border border-slate-200">
          <div>
            <span className="font-semibold text-slate-900">Ca tập: </span>
            <span>{targetDesc}</span>
          </div>
          {request.substitutionDeclinedReason && (
            <div>
              <span className="font-semibold text-rose-700">Lý do HLV trước từ chối: </span>
              <span className="text-slate-600 italic">{request.substitutionDeclinedReason}</span>
            </div>
          )}
        </div>

        <form id="reassign-substitute-form" onSubmit={submit} className="space-y-3">
          <Field
            label={`Chọn HLV dạy thay (Cùng chuyên môn, hạng ${reqStars}★ & đang rảnh)`}
            hint={`Chỉ hiển thị HLV cùng chuyên môn/giáo trình, cùng hạng ${reqStars} sao, nằm trong giờ làm cố định và không trùng lịch.`}
          >
            {eligibleQuery.isLoading ? (
              <div className="py-2 text-xs text-slate-500 italic">
                Đang kiểm tra HLV rảnh cùng chuyên môn...
              </div>
            ) : (
              <SelectInput
                value={substituteCoachId}
                onChange={(event) => setSubstituteCoachId(event.target.value)}
              >
                <option value="">-- Chọn HLV dạy thay --</option>
                {candidateCoaches.map((c: any) => {
                  const full = coaches.find((fc) => fc.id === c.id) || c
                  const stars = full?.coachProfile?.ratingStars ?? reqStars
                  return (
                    <option key={c.id} value={c.id}>
                      {c.fullName} ({stars}★ • Rảnh)
                    </option>
                  )
                })}
              </SelectInput>
            )}
          </Field>

          {!eligibleQuery.isLoading && candidateCoaches.length === 0 && (
            <div className="rounded-md bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200">
              ⚠ Hiện không có HLV nào cùng chuyên môn, hạng {reqStars}★ đang rảnh đúng khung giờ này. Lưu ý: Ca này vẫn xuất hiện trên Chợ nhận ca (Pickup) để các HLV khác tự nguyện xin dạy thay.
            </div>
          )}

          {substituteCoachId && (
            <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
              ✓ Lời mời mới sẽ được gửi đến HLV <strong>{selectedCoachObj?.fullName}</strong>. Khi HLV này bấm đồng ý trên hệ thống, ca học sẽ chính thức được bàn giao.
            </div>
          )}

          <FormError>{error}</FormError>
        </form>
      </div>
    </Modal>
  )
}

function ApproveExceptionModal({
  slot,
  onClose,
  onDone,
}: {
  slot: CoachExceptionSlot
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useNotification()
  const [error, setError] = useState<string | null>(null)
  const approve = useMutation({
    mutationFn: () => managerApi.reviewException(slot.id, { action: 'APPROVE' }),
    onSuccess: () => {
      showToast('success', 'Phê duyệt thành công', `Đã duyệt ca ngoài giờ cho HLV ${slot.coach.fullName}.`)
      onDone()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi phê duyệt', msg)
    },
  })

  return (
    <Modal
      title="Duyệt ca ngoài giờ (Ca ngoại lệ)"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" disabled={approve.isPending} onClick={() => approve.mutate()}>
            {approve.isPending ? 'Đang duyệt…' : 'Xác nhận duyệt'}
          </Btn>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          Bạn có chắc chắn muốn duyệt ca mở ngoài giờ của HLV{' '}
          <strong className="text-slate-900">{slot.coach.fullName}</strong>?
        </p>
        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600 border border-slate-200 space-y-1">
          <div>
            <strong>Thời gian:</strong> {formatDateTime(slot.startTime)} — {formatDateTime(slot.endTime)}
          </div>
          <div>
            <strong>Hạn chót duyệt:</strong> trước{' '}
            {formatDateTime(new Date(new Date(slot.startTime).getTime() - 60 * 60 * 1000).toISOString())} (trước giờ bắt đầu 1 tiếng)
          </div>
          <div>
            <strong>Lý do ngoại lệ:</strong> {slot.exceptionReason || 'Khách hẹn gấp / dạy bù'}
          </div>
        </div>
        <div className="rounded-md bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
          ✓ Sau khi duyệt, khung giờ này sẽ chuyển sang trạng thái <strong>Khả dụng</strong> và hội viên có thể đặt lịch PT ngay.
        </div>
        <FormError>{error}</FormError>
      </div>
    </Modal>
  )
}

function RejectExceptionModal({
  slot,
  onClose,
  onDone,
}: {
  slot: CoachExceptionSlot
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useNotification()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reject = useMutation({
    mutationFn: () =>
      managerApi.reviewException(slot.id, {
        action: 'REJECT',
        rejectionReason: reason.trim() || undefined,
      }),
    onSuccess: () => {
      showToast('success', 'Đã từ chối', `Đã từ chối ca ngoài giờ của HLV ${slot.coach.fullName}.`)
      onDone()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi từ chối', msg)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return setError('Cần nhập lý do từ chối.')
    reject.mutate()
  }

  return (
    <Modal
      title="Từ chối ca ngoài giờ"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="danger" type="submit" form="reject-exception-form" disabled={reject.isPending}>
            {reject.isPending ? 'Đang gửi…' : 'Từ chối'}
          </Btn>
        </>
      }
    >
      <form id="reject-exception-form" onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-700">
          Từ chối ca ngoại lệ của HLV <strong className="text-slate-900">{slot.coach.fullName}</strong>:
        </p>
        <Field label="Lý do từ chối" hint="HLV sẽ nhìn thấy lý do này.">
          <TextArea
            required
            rows={3}
            maxLength={1000}
            placeholder="Ví dụ: Trung tâm đã kín phòng tập vào khung giờ này..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function PayCoachModal({
  payout,
  month,
  onClose,
  onDone,
}: {
  payout: CoachPayoutItem
  month: string
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useNotification()
  const [note, setNote] = useState('Thanh toán  qua mã QR')
  const [error, setError] = useState<string | null>(null)
  const pay = useMutation({
    mutationFn: () => managerApi.payCoach(payout.coachId, month, note.trim() || 'Thanh toán  qua mã QR'),
    onSuccess: () => {
      showToast(
        'success',
        'Thanh toán thành công',
        `Đã thanh toán thù lao ${formatCurrency(payout.totalAmount)} cho HLV ${payout.coachName}!`
      )
      onDone()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Thanh toán thất bại', msg)
    },
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    pay.mutate()
  }

  // VietQR image URL with fallback
  const bankNameUpper = (payout.bankName || 'MB').toUpperCase()
  const bankCode = bankNameUpper.includes('VIETCOM')
    ? 'VCB'
    : bankNameUpper.includes('TECHCOM')
    ? 'TCB'
    : bankNameUpper.includes('VPB')
    ? 'VPB'
    : bankNameUpper.includes('ACB')
    ? 'ACB'
    : bankNameUpper.includes('BIDV')
    ? 'BIDV'
    : 'MB'

  const accNo = payout.bankAccountNumber || '0388999888'
  const accName = payout.bankAccountName || payout.coachName
  const amount = Math.round(payout.totalAmount)
  const transferContent = `Luong T${month} ${payout.coachName}`
  const qrUrl = `https://img.vietqr.io/image/${bankCode}-${accNo}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(transferContent)}&accountName=${encodeURIComponent(accName)}`

  return (
    <Modal
      title={`Xác nhận thanh toán thù lao — Tháng ${month}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="pay-coach-form" disabled={pay.isPending}>
            {pay.isPending ? 'Đang chuyển tiền…' : 'Chuyển tiền thanh toán ()'}
          </Btn>
        </>
      }
    >
      <form id="pay-coach-form" onSubmit={submit} className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Huấn luyện viên:</span>
            <strong className="text-slate-900 text-sm">{payout.coachName}</strong>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Số ca lớp nhóm đã dạy:</span>
            <span className="font-semibold text-slate-800">{payout.groupSessionCount} ca</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Số ca PT 1-1 đã dạy:</span>
            <span className="font-semibold text-slate-800">{payout.ptSessionCount} ca</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 font-medium">Tổng số ca tháng {month}:</span>
            <span className="font-bold text-slate-900">{payout.totalSessions} ca</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-500 font-medium">Tổng tiền thù lao:</span>
            <strong className="text-emerald-700 text-base font-extrabold">
              {formatCurrency(payout.totalAmount)}
            </strong>
          </div>
        </div>

        {/* Mock QR code container */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center space-y-2.5 shadow-2xs">
          <div className="text-center space-y-0.5">
            <span className="text-xs font-bold text-slate-800 block">
              Mã QR Chuyển Khoản Thù Lao (VietQR)
            </span>
            <span className="text-[11px] text-slate-500">
              Quét mã ngân hàng hoặc bấm nút chuyển tiền  bên dưới
            </span>
          </div>

          <div className="relative p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
            <img
              src={qrUrl}
              alt="Mã QR Chuyển Khoản"
              className="w-48 h-48 object-contain rounded-lg"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none'
              }}
            />
          </div>

          <div className="text-center text-xs text-slate-600 space-y-0.5">
            <div>
              <span className="text-slate-400">Ngân hàng: </span>
              <strong>{payout.bankName || 'MBBank'}</strong>
              {' · '}
              <span className="text-slate-400">STK: </span>
              <strong className="font-mono text-emerald-700">{payout.bankAccountNumber || '0388999888'}</strong>
            </div>
            <div>
              <span className="text-slate-400">Chủ TK: </span>
              <strong>{payout.bankAccountName || payout.coachName}</strong>
              {' · '}
              <span className="text-slate-400">Số tiền: </span>
              <strong className="text-emerald-700 font-bold">{formatCurrency(payout.totalAmount)}</strong>
            </div>
          </div>
        </div>

        <Field label="Ghi chú giao dịch / Mã tham chiếu" hint="Ví dụ: Mã GD VCB 893121 hoặc ghi chú nội bộ.">
          <TextInput
            placeholder="Nhập mã GD chuyển khoản..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function RejectForm({
  request,
  coachName,
  onClose,
  onDone,
}: {
  request: CancellationRequest
  coachName: string
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useNotification()
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const reject = useMutation({
    mutationFn: () =>
      managerApi.reviewCancellation(request.id, {
        action: 'REJECT',
        rejectionReason: reason.trim(),
      }),
    onSuccess: () => {
      showToast('success', 'Đã từ chối đơn', `Đã từ chối đơn hủy ca của HLV ${coachName}.`)
      onDone()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi từ chối đơn', msg)
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!reason.trim()) return setError('Cần nhập lý do từ chối.')
    reject.mutate()
  }
  return (
    <Modal
      title={`Từ chối đơn của ${coachName}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="danger" type="submit" form="reject-form" disabled={reject.isPending}>
            {reject.isPending ? 'Đang gửi…' : 'Từ chối đơn'}
          </Btn>
        </>
      }
    >
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {request.reasonMessage}
      </p>
      <form id="reject-form" onSubmit={submit} className="space-y-3">
        <Field label="Lý do từ chối" hint="HLV sẽ thấy lý do này.">
          <TextArea
            required
            maxLength={2000}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function PenaltyForm({
  penalty,
  coachName,
  onClose,
  onDone,
}: {
  penalty: CoachPenalty
  coachName: string
  onClose: () => void
  onDone: () => void
}) {
  const { showToast } = useNotification()
  const [decision, setDecision] = useState(penalty.managerFinalDecision ?? '')
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => managerApi.reviewPenalty(penalty.id, decision.trim()),
    onSuccess: () => {
      showToast('success', 'Xử lý kỷ luật', `Đã lưu quyết định xử lý kỷ luật đối với HLV ${coachName}.`)
      onDone()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu quyết định', msg)
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const length = decision.trim().length
    if (length < 5 || length > 2000) return setError('Quyết định cần từ 5 đến 2000 ký tự.')
    save.mutate()
  }
  return (
    <Modal
      title={`Kỷ luật ${coachName}, tháng ${penalty.appliedMonth}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="penalty-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu quyết định'}
          </Btn>
        </>
      }
    >
      <form id="penalty-form" onSubmit={submit} className="space-y-3">
        <Field
          label="Quyết định cuối cùng"
          hint={`${decision.trim().length}/2000 ký tự, tối thiểu 5.`}
        >
          <TextArea
            rows={5}
            maxLength={2000}
            placeholder="Ví dụ: Nhắc nhở lần 1, yêu cầu cam kết lịch dạy tháng tới."
            value={decision}
            onChange={(event) => setDecision(event.target.value)}
          />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}
