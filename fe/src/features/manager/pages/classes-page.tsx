import { useState, useMemo, useEffect, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Building2, Plus, RotateCcw, Search, Sun, X } from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import { formatPeakRange, isRangeInPeakHours, type PeakHourConfig } from '@/lib/peak-hours'
import { useNotification } from '@/context/notification-context'
import type { CoachRow, Discipline, GymClass, MembershipPlan, Room, Schedule } from '../types/manager.types'
import {
  getClassSpecialtyCode,
  SPECIALTY_NAME_MAP,
  getSpecialtyDedicatedRoomName,
  isClassCompatibleWithPlan,
} from '@/lib/topic-matcher'
import {
  errorMessage,
  formatDay,
  formatTime,
  vnClock,
  vnDay,
  vnInstant,
  addDaysToDay,
} from '../lib/format'
import {
  Btn,
  EmptyRow,
  Field,
  FormError,
  Modal,
  PageHeader,
  Panel,
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

const DEFAULT_CAPACITY = 10

type ScheduleStatusFilter = 'ALL' | 'OPEN' | 'FULL' | 'CANCELLED'
type ScheduleDatePreset = 'ALL' | 'TODAY' | 'NEXT_7_DAYS' | 'CUSTOM'

function ScheduleStatusLabel({ status }: { status?: string }) {
  if (status === 'FULL') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Đã đầy
      </span>
    )
  }
  if (status === 'CANCELLED_BY_COACH') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        HLV xin nghỉ
      </span>
    )
  }
  if (status === 'CANCELLED') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Đã hủy
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
      Đang mở
    </span>
  )
}

export function ManagerClassesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useNotification()
  const [tab, setTab] = useState<'schedules' | 'classes' | 'peak_hours'>('schedules')
  const [editingPeakHour, setEditingPeakHour] = useState<PeakHourConfig | 'new' | null>(null)
  const [deletingPeakHour, setDeletingPeakHour] = useState<PeakHourConfig | null>(null)

  // Schedule filters
  const [scheduleSearch, setScheduleSearch] = useState('')
  const [scheduleDiscipline, setScheduleDiscipline] = useState('ALL')
  const [scheduleCoach, setScheduleCoach] = useState('ALL')
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleStatusFilter>('ALL')
  const [datePreset, setDatePreset] = useState<ScheduleDatePreset>('ALL')
  const [customDate, setCustomDate] = useState('')
  const [schedulePageSize, setSchedulePageSize] = useState(10)

  // Class catalog filters
  const [classSearch, setClassSearch] = useState('')
  const [classDiscipline, setClassDiscipline] = useState('ALL')

  const schedules = useQuery({ queryKey: managerKeys.schedules, queryFn: managerApi.schedules })
  const classes = useQuery({ queryKey: managerKeys.classes, queryFn: managerApi.classes })
  const rooms = useQuery({ queryKey: managerKeys.rooms, queryFn: managerApi.rooms })
  const coaches = useQuery({ queryKey: managerKeys.coaches, queryFn: managerApi.coaches })
  const plans = useQuery({ queryKey: managerKeys.plans, queryFn: managerApi.plans })
  const peakHours = useQuery({ queryKey: managerKeys.peakHours, queryFn: managerApi.peakHours })
  const disciplines = useQuery({
    queryKey: managerKeys.disciplines,
    queryFn: managerApi.disciplines,
  })
  const [editingSchedule, setEditingSchedule] = useState<Schedule | 'new' | null>(null)
  const [editingClass, setEditingClass] = useState<GymClass | 'new' | null>(null)
  const [cancellingSchedule, setCancellingSchedule] = useState<Schedule | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [openingExceptionSchedule, setOpeningExceptionSchedule] = useState<Schedule | null>(null)
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null)
  const [deletingClass, setDeletingClass] = useState<GymClass | null>(null)
  const [error, setError] = useState<string | null>(null)

  const removeSchedule = useMutation({
    mutationFn: (id: string) => managerApi.deleteSchedule(id),
    onSuccess: () => {
      setError(null)
      showToast('success', 'Xóa thành công', 'Đã xóa lịch lớp học và hoàn trả lượt tập nếu có.')
      void queryClient.invalidateQueries({ queryKey: managerKeys.schedules })
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi xóa lịch lớp', msg)
    },
  })

  const overrideSchedule = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string
      action: 'FORCE_OPEN' | 'FORCE_CLOSE'
      reason: string
    }) => managerApi.overrideSchedule(id, { action, reason }),
    onSuccess: (_, variables) => {
      setError(null)
      showToast(
        'success',
        'Thành công',
        variables.action === 'FORCE_CLOSE'
          ? 'Đã hủy ca học, hoàn lại 100% lượt tập và gửi thông báo/email cho học viên & HLV.'
          : 'Đã mở lớp ngoại lệ thành công (hệ thống sẽ giữ lớp diễn ra dù ít học viên).'
      )
      void queryClient.invalidateQueries({ queryKey: managerKeys.schedules })
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi thao tác ngoại lệ', msg)
    },
  })

  const removeClass = useMutation({
    mutationFn: (id: string) => managerApi.deleteClass(id),
    onSuccess: () => {
      setError(null)
      showToast('success', 'Xóa thành công', 'Đã xóa loại lớp học.')
      void queryClient.invalidateQueries({ queryKey: managerKeys.classes })
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi xóa loại lớp', msg)
    },
  })

  const scheduleRows = schedules.data ?? []
  const classRows = classes.data ?? []
  const peakHourRows = peakHours.data ?? []

  const togglePeakHour = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      managerApi.updatePeakHour(id, { isActive }),
    onSuccess: (_, vars) => {
      showToast(
        'success',
        'Cập nhật thành công',
        vars.isActive ? 'Đã bật khung giờ vàng.' : 'Đã tạm tắt khung giờ vàng.'
      )
      void queryClient.invalidateQueries({ queryKey: managerKeys.peakHours })
    },
    onError: (err) => showToast('error', 'Lỗi cập nhật giờ vàng', errorMessage(err)),
  })

  const removePeakHour = useMutation({
    mutationFn: (id: string) => managerApi.deletePeakHour(id),
    onSuccess: () => {
      showToast('success', 'Xóa thành công', 'Đã xóa khung giờ vàng.')
      void queryClient.invalidateQueries({ queryKey: managerKeys.peakHours })
    },
    onError: (err) => showToast('error', 'Lỗi xóa giờ vàng', errorMessage(err)),
  })
  const groupDisciplines = useMemo(
    () => (disciplines.data ?? []).filter((d) => d.code.toUpperCase() !== 'GYM'),
    [disciplines.data]
  )

  const scheduleCoachOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of scheduleRows) {
      if (s.coachId && s.coach?.fullName) {
        map.set(s.coachId, s.coach.fullName)
      }
    }
    return [...map.entries()]
      .map(([id, fullName]) => ({ id, fullName }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
  }, [scheduleRows])

  const todayDay = vnDay()
  const next7Day = addDaysToDay(todayDay, 7)

  const filteredSchedules = useMemo(() => {
    const q = scheduleSearch.trim().toLowerCase()
    return scheduleRows.filter((s) => {
      if (scheduleDiscipline !== 'ALL' && s.class?.disciplineId !== scheduleDiscipline) {
        return false
      }
      if (scheduleCoach !== 'ALL' && s.coachId !== scheduleCoach) {
        return false
      }
      if (scheduleStatus === 'OPEN' && s.status !== 'OPEN') return false
      if (scheduleStatus === 'FULL' && s.status !== 'FULL') return false
      if (
        scheduleStatus === 'CANCELLED' &&
        s.status !== 'CANCELLED' &&
        s.status !== 'CANCELLED_BY_COACH'
      ) {
        return false
      }

      const day = vnDay(s.startTime)
      if (datePreset === 'TODAY' && day !== todayDay) return false
      if (datePreset === 'NEXT_7_DAYS' && (day < todayDay || day > next7Day)) return false
      if (datePreset === 'CUSTOM' && customDate && day !== customDate) return false

      if (q) {
        const haystack = [
          s.class?.name,
          s.class?.discipline?.name,
          s.coach?.fullName,
          s.room?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [
    scheduleRows,
    scheduleSearch,
    scheduleDiscipline,
    scheduleCoach,
    scheduleStatus,
    datePreset,
    customDate,
    todayDay,
    next7Day,
  ])

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase()
    return classRows.filter((c) => {
      if (classDiscipline !== 'ALL' && c.disciplineId !== classDiscipline) return false
      if (q) {
        const haystack = [c.name, c.discipline?.name, c.description]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [classRows, classSearch, classDiscipline])

  const hasScheduleFilters =
    scheduleSearch.trim() !== '' ||
    scheduleDiscipline !== 'ALL' ||
    scheduleCoach !== 'ALL' ||
    scheduleStatus !== 'ALL' ||
    datePreset !== 'ALL'

  const hasClassFilters = classSearch.trim() !== '' || classDiscipline !== 'ALL'

  const resetScheduleFilters = () => {
    setScheduleSearch('')
    setScheduleDiscipline('ALL')
    setScheduleCoach('ALL')
    setScheduleStatus('ALL')
    setDatePreset('ALL')
    setCustomDate('')
  }

  const resetClassFilters = () => {
    setClassSearch('')
    setClassDiscipline('ALL')
  }

  const scheduleResetKey = `${scheduleSearch}|${scheduleDiscipline}|${scheduleCoach}|${scheduleStatus}|${datePreset}|${customDate}|${schedulePageSize}`
  const classResetKey = `${classSearch}|${classDiscipline}`

  // Page the flat list first, then group the page by day so headers never split oddly.
  const schedulePage = usePagination(filteredSchedules, schedulePageSize, scheduleResetKey)
  const classPage = usePagination(filteredClasses, 10, classResetKey)

  const groups = new Map<string, Schedule[]>()
  for (const s of schedulePage.items) {
    const day = vnDay(s.startTime)
    groups.set(day, [...(groups.get(day) ?? []), s])
  }

  const scheduleSummary = useMemo(() => {
    let open = 0
    let full = 0
    let enrolled = 0
    for (const s of filteredSchedules) {
      if (s.status === 'OPEN') open += 1
      if (s.status === 'FULL') full += 1
      enrolled += s.currentEnrolled || 0
    }
    return { total: filteredSchedules.length, open, full, enrolled }
  }, [filteredSchedules])

  return (
    <div className="rounded-2xl bg-white border border-slate-200/90 p-6 shadow-xs space-y-5">
      <PageHeader
        title="Lớp & lịch"
        description="Quản lý danh mục lớp nhóm và điều phối thời khóa biểu theo bộ môn, phòng tập và HLV"
        actions={
          tab === 'schedules' ? (
            <Btn
              tone="primary"
              onClick={() => setEditingSchedule('new')}
              disabled={classRows.length === 0}
            >
              <Plus className="h-4 w-4" />
              Xếp lịch
            </Btn>
          ) : tab === 'classes' ? (
            <Btn tone="primary" onClick={() => setEditingClass('new')}>
              <Plus className="h-4 w-4" />
              Thêm lớp
            </Btn>
          ) : (
            <Btn tone="primary" onClick={() => setEditingPeakHour('new')}>
              <Plus className="h-4 w-4" />
              Thêm giờ vàng
            </Btn>
          )
        }
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'schedules', label: 'Thời khóa biểu', count: scheduleRows.length },
          { value: 'classes', label: 'Loại lớp', count: classRows.length },
          { value: 'peak_hours', label: 'Giờ vàng', count: peakHourRows.length },
        ]}
      />

      <div className="empty:hidden">
        <FormError>{error}</FormError>
      </div>

      {tab === 'schedules' ? (
        <div className="space-y-4">
          {/* Compact operational summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
              <div className="text-xs text-slate-500">Tổng ca hiển thị</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {scheduleSummary.total}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
              <div className="text-xs text-slate-500">Đang mở đăng ký</div>
              <div className="mt-1 text-lg font-semibold text-emerald-800 tabular-nums">
                {scheduleSummary.open}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
              <div className="text-xs text-slate-500">Đã đủ sĩ số</div>
              <div className="mt-1 text-lg font-semibold text-amber-800 tabular-nums">
                {scheduleSummary.full}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
              <div className="text-xs text-slate-500">Tổng lượt học viên</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {scheduleSummary.enrolled}
              </div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-4 relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={scheduleSearch}
                  onChange={(e) => setScheduleSearch(e.target.value)}
                  placeholder="Tìm lớp, HLV, phòng"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#17664e] focus:outline-none"
                />
                {scheduleSearch ? (
                  <button
                    type="button"
                    onClick={() => setScheduleSearch('')}
                    aria-label="Xóa từ khóa"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="md:col-span-3">
                <select
                  value={scheduleDiscipline}
                  onChange={(e) => setScheduleDiscipline(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#17664e] focus:outline-none"
                >
                  <option value="ALL">Tất cả bộ môn</option>
                  {groupDisciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <select
                  value={scheduleCoach}
                  onChange={(e) => setScheduleCoach(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#17664e] focus:outline-none"
                >
                  <option value="ALL">Tất cả HLV</option>
                  {scheduleCoachOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <select
                  value={scheduleStatus}
                  onChange={(e) => setScheduleStatus(e.target.value as ScheduleStatusFilter)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#17664e] focus:outline-none"
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="OPEN">Đang mở</option>
                  <option value="FULL">Đã đầy</option>
                  <option value="CANCELLED">Đã hủy / Xin nghỉ</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-200/70">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { key: 'ALL', label: 'Tất cả ngày' },
                    { key: 'TODAY', label: 'Hôm nay' },
                    { key: 'NEXT_7_DAYS', label: '7 ngày tới' },
                    { key: 'CUSTOM', label: 'Chọn ngày' },
                  ] as const
                ).map((preset) => {
                  const active = datePreset === preset.key
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => {
                        setDatePreset(preset.key)
                        if (preset.key === 'CUSTOM' && !customDate) {
                          setCustomDate(todayDay)
                        }
                      }}
                      className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#17664e] text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  )
                })}

                {datePreset === 'CUSTOM' ? (
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:border-[#17664e] focus:outline-none"
                  />
                ) : null}
              </div>

              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Hiển thị</span>
                  <select
                    value={schedulePageSize}
                    onChange={(e) => setSchedulePageSize(Number(e.target.value))}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:border-[#17664e] focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span>ca/trang</span>
                </label>
                <span className="text-xs text-slate-500 tabular-nums">
                  {filteredSchedules.length} / {scheduleRows.length} ca
                </span>
                {hasScheduleFilters ? (
                  <button
                    type="button"
                    onClick={resetScheduleFilters}
                    className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Xóa bộ lọc
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <Panel>
            {schedules.isLoading || schedules.isError ? (
              <StateMessage
                loading={schedules.isLoading}
                error={schedules.isError ? errorMessage(schedules.error) : null}
                onRetry={() => void schedules.refetch()}
              />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Giờ học</Th>
                      <Th>Lớp &amp; bộ môn</Th>
                      <Th>Phòng</Th>
                      <Th>HLV phụ trách</Th>
                      <Th>Sĩ số</Th>
                      <Th>Trạng thái</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchedules.length === 0 ? (
                      <EmptyRow colSpan={7}>
                        {hasScheduleFilters
                          ? 'Không có lịch nào khớp với bộ lọc hiện tại.'
                          : 'Chưa có lịch nào sắp diễn ra.'}
                      </EmptyRow>
                    ) : (
                      [...groups].flatMap(([day, items]) => [
                        <tr key={day}>
                          <td
                            colSpan={7}
                            className="bg-[#17664e] px-4 py-3 text-white"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold tracking-normal">
                                {formatDay(day)}
                              </span>
                              <span className="text-xs font-medium text-emerald-100 tabular-nums">
                                {items.length} ca
                              </span>
                            </div>
                          </td>
                        </tr>,
                        ...items.map((s) => {
                          const enrolled = s.currentEnrolled || 0
                          const cap = Math.max(1, s.capacity || 1)
                          const pct = Math.min(100, Math.round((enrolled / cap) * 100))
                          const peakMatch = isRangeInPeakHours(s.startTime, s.endTime, peakHourRows)
                          return (
                            <tr
                              key={s.id}
                              className={
                                peakMatch
                                  ? 'bg-amber-50/70 hover:bg-amber-50 transition-colors border-l-2 border-l-amber-500'
                                  : 'hover:bg-slate-50/60 transition-colors'
                              }
                            >
                              <Td className="whitespace-nowrap tabular-nums text-slate-700">
                                <div className="font-medium text-slate-900">
                                  {formatTime(s.startTime)}–{formatTime(s.endTime)}
                                </div>
                                {peakMatch ? (
                                  <span className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 border border-amber-300/80 px-1.5 py-0.5 text-[11px] font-medium text-amber-900">
                                    <Sun className="h-3 w-3 text-amber-600" strokeWidth={1.75} />
                                    Giờ vàng
                                  </span>
                                ) : null}
                              </Td>
                              <Td>
                                <div className="font-medium text-slate-900">{s.class?.name}</div>
                                <div className="text-xs text-slate-500">
                                  {s.class?.discipline?.name}
                                  {s.isSlotBooking ? (
                                    <span className="ml-1.5 text-slate-400">
                                      • Theo khung giờ HLV{s.memberNames ? ` (${s.memberNames})` : ''}
                                    </span>
                                  ) : null}
                                </div>
                              </Td>
                              <Td className="text-slate-700">{s.room?.name}</Td>
                              <Td className="text-slate-800">{s.coach?.fullName}</Td>
                              <Td className="tabular-nums">
                                <div className="w-24 space-y-1">
                                  <div className="text-xs font-medium text-slate-800">
                                    {enrolled}/{s.capacity}
                                  </div>
                                  <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        s.status === 'FULL' ? 'bg-amber-500' : 'bg-[#17664e]'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </Td>
                              <Td className="whitespace-nowrap">
                                <ScheduleStatusLabel status={s.status} />
                              </Td>
                              <Td className="whitespace-nowrap text-right space-x-1.5">
                                {!s.isSlotBooking ? (
                                  <Btn
                                    size="sm"
                                    tone="ghost"
                                    disabled={s.currentEnrolled > 0}
                                    title={s.currentEnrolled > 0 ? 'Đã có hội viên đặt chỗ' : undefined}
                                    onClick={() => setEditingSchedule(s)}
                                  >
                                    Sửa
                                  </Btn>
                                ) : null}
                                {s.status !== 'CANCELLED_BY_COACH' && s.status !== 'CANCELLED' ? (
                                  <Btn
                                    size="sm"
                                    tone="danger"
                                    disabled={overrideSchedule.isPending}
                                    title="Hủy ca học này và tự động hoàn trả 100% lượt tập cho hội viên"
                                    onClick={() => {
                                      setCancelReason('')
                                      setCancelError(null)
                                      setCancellingSchedule(s)
                                    }}
                                  >
                                    Hủy ca &amp; Hoàn token
                                  </Btn>
                                ) : null}
                                {!s.isSlotBooking &&
                                  s.currentEnrolled > 0 &&
                                  s.currentEnrolled < Math.ceil(s.capacity * 0.6) &&
                                  s.status === 'OPEN' && (
                                    <Btn
                                      size="sm"
                                      tone="secondary"
                                      disabled={overrideSchedule.isPending}
                                      title="Gắn cờ MANAGER_OVERRIDE_OPEN_SCHEDULE để lớp vẫn diễn ra dù ít học viên"
                                      onClick={() => setOpeningExceptionSchedule(s)}
                                    >
                                      Mở ngoại lệ
                                    </Btn>
                                  )}
                                {!s.isSlotBooking ? (
                                  <Btn
                                    size="sm"
                                    tone="danger"
                                    disabled={removeSchedule.isPending}
                                    onClick={() => setDeletingSchedule(s)}
                                  >
                                    Xóa
                                  </Btn>
                                ) : null}
                              </Td>
                            </tr>
                          )
                        }),
                      ])
                    )}
                  </tbody>
                </Table>
                <Pagination pager={schedulePage.pager} />
              </>
            )}
          </Panel>
        </div>
      ) : tab === 'classes' ? (
        <div className="space-y-4">
          {/* Filter bar for Class catalog */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[260px]">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  placeholder="Tìm tên lớp, mô tả"
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#17664e] focus:outline-none"
                />
                {classSearch ? (
                  <button
                    type="button"
                    onClick={() => setClassSearch('')}
                    aria-label="Xóa từ khóa"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <select
                value={classDiscipline}
                onChange={(e) => setClassDiscipline(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-[#17664e] focus:outline-none"
              >
                <option value="ALL">Tất cả bộ môn</option>
                {groupDisciplines.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 tabular-nums">
                Hiển thị {filteredClasses.length} / {classRows.length} lớp
              </span>
              {hasClassFilters ? (
                <button
                  type="button"
                  onClick={resetClassFilters}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Xóa bộ lọc
                </button>
              ) : null}
            </div>
          </div>

          <Panel>
            {classes.isLoading || classes.isError ? (
              <StateMessage
                loading={classes.isLoading}
                error={classes.isError ? errorMessage(classes.error) : null}
                onRetry={() => void classes.refetch()}
              />
            ) : (
              <>
                <Table>
                  <thead>
                    <tr>
                      <Th>Tên lớp</Th>
                      <Th>Bộ môn</Th>
                      <Th>Mô tả</Th>
                      <Th className="text-right">Thao tác</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClasses.length === 0 ? (
                      <EmptyRow colSpan={4}>
                        {hasClassFilters
                          ? 'Không có loại lớp nào khớp với bộ lọc hiện tại.'
                          : 'Chưa có loại lớp nào.'}
                      </EmptyRow>
                    ) : (
                      classPage.items.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                          <Td className="font-medium text-slate-900">{c.name}</Td>
                          <Td className="text-slate-700">{c.discipline?.name}</Td>
                          <Td className="max-w-[380px] text-slate-500">{c.description || '—'}</Td>
                          <Td className="whitespace-nowrap text-right space-x-1.5">
                            <Btn size="sm" tone="ghost" onClick={() => setEditingClass(c)}>
                              Sửa
                            </Btn>
                            <Btn
                              size="sm"
                              tone="danger"
                              disabled={removeClass.isPending}
                              onClick={() => setDeletingClass(c)}
                            >
                              Xóa
                            </Btn>
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
                <Pagination pager={classPage.pager} />
              </>
            )}
          </Panel>
        </div>
      ) : (
        <div className="space-y-4">
         

          <Panel>
            {peakHours.isLoading || peakHours.isError ? (
              <StateMessage
                loading={peakHours.isLoading}
                error={peakHours.isError ? errorMessage(peakHours.error) : null}
                onRetry={() => void peakHours.refetch()}
              />
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Tên khung giờ</Th>
                    <Th>Khung giờ</Th>
                    <Th>Trần ngày</Th>
                    <Th>Trần tuần</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {peakHourRows.length === 0 ? (
                    <EmptyRow colSpan={6}>Chưa có khung giờ vàng nào được cấu hình.</EmptyRow>
                  ) : (
                    peakHourRows.map((cfg) => (
                      <tr
                        key={cfg.id}
                        className={
                          cfg.isActive
                            ? 'bg-amber-50/50 hover:bg-amber-50/80 transition-colors'
                            : 'hover:bg-slate-50/60 transition-colors opacity-70'
                        }
                      >
                        <Td className="font-medium text-slate-900">
                          <div className="inline-flex items-center gap-2">
                            <Sun
                              className={`h-4 w-4 shrink-0 ${
                                cfg.isActive ? 'text-amber-600' : 'text-slate-400'
                              }`}
                              strokeWidth={1.75}
                            />
                            <span>{cfg.label}</span>
                          </div>
                        </Td>
                        <Td className="tabular-nums font-medium text-amber-900">
                          {formatPeakRange(cfg)}
                        </Td>
                        <Td className="tabular-nums text-slate-700">{cfg.dailyCap} ca / ngày</Td>
                        <Td className="tabular-nums text-slate-700">{cfg.weeklyCap} ca / tuần</Td>
                        <Td>
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                              cfg.isActive ? 'text-amber-900' : 'text-slate-500'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                cfg.isActive ? 'bg-amber-500' : 'bg-slate-400'
                              }`}
                            />
                            {cfg.isActive ? 'Đang áp dụng' : 'Tạm tắt'}
                          </span>
                        </Td>
                        <Td className="whitespace-nowrap text-right space-x-1.5">
                          <Btn
                            size="sm"
                            tone="secondary"
                            disabled={togglePeakHour.isPending}
                            onClick={() =>
                              togglePeakHour.mutate({ id: cfg.id, isActive: !cfg.isActive })
                            }
                          >
                            {cfg.isActive ? 'Tạm tắt' : 'Bật lại'}
                          </Btn>
                          <Btn size="sm" tone="ghost" onClick={() => setEditingPeakHour(cfg)}>
                            Sửa
                          </Btn>
                          <Btn
                            size="sm"
                            tone="danger"
                            disabled={removePeakHour.isPending}
                            onClick={() => setDeletingPeakHour(cfg)}
                          >
                            Xóa
                          </Btn>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}

      {editingSchedule ? (
        <ScheduleForm
          schedule={editingSchedule === 'new' ? null : editingSchedule}
          classes={classRows}
          rooms={rooms.data ?? []}
          coaches={coaches.data ?? []}
          plans={plans.data ?? []}
          existingSchedules={scheduleRows}
          onClose={() => setEditingSchedule(null)}
          onSaved={() => {
            setEditingSchedule(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.schedules })
          }}
        />
      ) : null}
      {editingClass ? (
        <ClassForm
          gymClass={editingClass === 'new' ? null : editingClass}
          disciplines={groupDisciplines}
          onClose={() => setEditingClass(null)}
          onSaved={() => {
            setEditingClass(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.classes })
          }}
        />
      ) : null}

      {cancellingSchedule ? (
        <Modal
          title="Hủy ca học & hoàn trả lượt tập"
          onClose={() => {
            if (!overrideSchedule.isPending) setCancellingSchedule(null)
          }}
          footer={
            <>
              <Btn
                onClick={() => setCancellingSchedule(null)}
                disabled={overrideSchedule.isPending}
              >
                Đóng
              </Btn>
              <Btn
                tone="danger"
                type="submit"
                form="cancel-schedule-form"
                disabled={overrideSchedule.isPending}
              >
                {overrideSchedule.isPending ? 'Đang xử lý…' : 'Xác nhận hủy ca & gửi email'}
              </Btn>
            </>
          }
        >
          <form
            id="cancel-schedule-form"
            onSubmit={(event) => {
              event.preventDefault()
              const trimmed = cancelReason.trim()
              if (!trimmed) {
                setCancelError('Vui lòng nhập lý do hủy ca để gửi thông báo qua email.')
                return
              }
              setCancelError(null)
              overrideSchedule.mutate(
                {
                  id: cancellingSchedule.id,
                  action: 'FORCE_CLOSE',
                  reason: trimmed,
                },
                {
                  onSuccess: () => {
                    setCancellingSchedule(null)
                    setCancelReason('')
                  },
                }
              )
            }}
            className="space-y-4"
          >
            <dl className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 grid grid-cols-[120px_1fr] gap-y-2 gap-x-3 text-sm">
              <dt className="text-xs font-medium text-slate-500">Buổi tập</dt>
              <dd className="font-medium text-slate-900">{cancellingSchedule.class?.name}</dd>
              <dt className="text-xs font-medium text-slate-500">Thời gian</dt>
              <dd className="text-xs text-slate-700 tabular-nums">
                {formatDay(vnDay(cancellingSchedule.startTime))} • {formatTime(cancellingSchedule.startTime)}–{formatTime(cancellingSchedule.endTime)}
              </dd>
              <dt className="text-xs font-medium text-slate-500">HLV phụ trách</dt>
              <dd className="text-xs text-slate-800">{cancellingSchedule.coach?.fullName}</dd>
              <dt className="text-xs font-medium text-slate-500">Học viên đã đặt</dt>
              <dd className="text-xs font-medium text-slate-900 tabular-nums">
                {cancellingSchedule.currentEnrolled}/{cancellingSchedule.capacity} học viên
              </dd>
            </dl>

            <Field
              label="Lý do hủy ca"
              hint="Lý do này sẽ được đính kèm trực tiếp trong email thông báo và hoàn 100% lượt tập gửi tới học viên"
            >
              <TextArea
                required
                rows={3}
                value={cancelReason}
                onChange={(e) => {
                  setCancelReason(e.target.value)
                  if (cancelError) setCancelError(null)
                }}
                placeholder="Ví dụ: Bảo trì phòng tập đột xuất hoặc điều phối lại lịch dạy"
              />
            </Field>
            <FormError>{cancelError}</FormError>
          </form>
        </Modal>
      ) : null}

      {openingExceptionSchedule ? (
        <Modal
          title="Mở lớp ngoại lệ"
          onClose={() => {
            if (!overrideSchedule.isPending) setOpeningExceptionSchedule(null)
          }}
          footer={
            <>
              <Btn
                onClick={() => setOpeningExceptionSchedule(null)}
                disabled={overrideSchedule.isPending}
              >
                Hủy
              </Btn>
              <Btn
                tone="primary"
                disabled={overrideSchedule.isPending}
                onClick={() => {
                  overrideSchedule.mutate(
                    {
                      id: openingExceptionSchedule.id,
                      action: 'FORCE_OPEN',
                      reason: 'Quản lý mở lớp ngoại lệ giữ ca học',
                    },
                    {
                      onSuccess: () => setOpeningExceptionSchedule(null),
                    }
                  )
                }}
              >
                {overrideSchedule.isPending ? 'Đang xử lý…' : 'Xác nhận mở lớp'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-slate-700 leading-relaxed">
            Xác nhận mở lớp ngoại lệ cho{' '}
            <strong className="text-slate-900">{openingExceptionSchedule.class?.name}</strong>? Hệ
            thống sẽ giữ lớp diễn ra bình thường dù sĩ số hiện tại dưới 60% và gửi thông báo tới
            học viên, HLV.
          </p>
        </Modal>
      ) : null}

      {deletingSchedule ? (
        <Modal
          title="Xóa lịch lớp học"
          onClose={() => {
            if (!removeSchedule.isPending) setDeletingSchedule(null)
          }}
          footer={
            <>
              <Btn
                onClick={() => setDeletingSchedule(null)}
                disabled={removeSchedule.isPending}
              >
                Hủy
              </Btn>
              <Btn
                tone="danger"
                disabled={removeSchedule.isPending}
                onClick={() => {
                  removeSchedule.mutate(deletingSchedule.id, {
                    onSuccess: () => setDeletingSchedule(null),
                  })
                }}
              >
                {removeSchedule.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-slate-700 leading-relaxed">
            {deletingSchedule.currentEnrolled > 0
              ? `Lớp "${deletingSchedule.class?.name}" đã có ${deletingSchedule.currentEnrolled} học viên đăng ký. Xóa lịch sẽ tự động hoàn lại 100% lượt tập cho học viên.`
              : `Bạn có chắc chắn muốn xóa lịch lớp "${deletingSchedule.class?.name}"?`}
          </p>
        </Modal>
      ) : null}

      {deletingClass ? (
        <Modal
          title="Xóa loại lớp học"
          onClose={() => {
            if (!removeClass.isPending) setDeletingClass(null)
          }}
          footer={
            <>
              <Btn
                onClick={() => setDeletingClass(null)}
                disabled={removeClass.isPending}
              >
                Hủy
              </Btn>
              <Btn
                tone="danger"
                disabled={removeClass.isPending}
                onClick={() => {
                  removeClass.mutate(deletingClass.id, {
                    onSuccess: () => setDeletingClass(null),
                  })
                }}
              >
                {removeClass.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-slate-700 leading-relaxed">
            Bạn có chắc chắn muốn xóa loại lớp{' '}
            <strong className="text-slate-900">{deletingClass.name}</strong>?
          </p>
        </Modal>
      ) : null}

      {editingPeakHour ? (
        <PeakHourForm
          config={editingPeakHour === 'new' ? null : editingPeakHour}
          onClose={() => setEditingPeakHour(null)}
          onSaved={() => {
            setEditingPeakHour(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.peakHours })
          }}
        />
      ) : null}

      {deletingPeakHour ? (
        <Modal
          title="Xóa khung giờ vàng"
          onClose={() => {
            if (!removePeakHour.isPending) setDeletingPeakHour(null)
          }}
          footer={
            <>
              <Btn onClick={() => setDeletingPeakHour(null)} disabled={removePeakHour.isPending}>
                Hủy
              </Btn>
              <Btn
                tone="danger"
                disabled={removePeakHour.isPending}
                onClick={() => {
                  removePeakHour.mutate(deletingPeakHour.id, {
                    onSuccess: () => setDeletingPeakHour(null),
                  })
                }}
              >
                {removePeakHour.isPending ? 'Đang xóa…' : 'Xác nhận xóa'}
              </Btn>
            </>
          }
        >
          <p className="text-sm text-slate-700 leading-relaxed">
            Bạn có chắc chắn muốn xóa khung giờ vàng{' '}
            <strong className="text-slate-900">{deletingPeakHour.label}</strong> (
            {formatPeakRange(deletingPeakHour)})?
          </p>
        </Modal>
      ) : null}
    </div>
  )
}

function PeakHourForm({
  config,
  onClose,
  onSaved,
}: {
  config: PeakHourConfig | null
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const pad = (n: number) => String(n).padStart(2, '0')
  const [label, setLabel] = useState(config?.label ?? '')
  const [startTime, setStartTime] = useState(
    config ? `${pad(config.startHour)}:${pad(config.startMinute || 0)}` : '06:00'
  )
  const [endTime, setEndTime] = useState(
    config ? `${pad(config.endHour)}:${pad(config.endMinute || 0)}` : '08:00'
  )
  const [dailyCap, setDailyCap] = useState(String(config?.dailyCap ?? 2))
  const [weeklyCap, setWeeklyCap] = useState(String(config?.weeklyCap ?? 10))
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => {
      const [sh, sm] = startTime.split(':').map(Number)
      const [eh, em] = endTime.split(':').map(Number)
      const body = {
        label: label.trim(),
        startHour: sh,
        startMinute: sm || 0,
        endHour: eh,
        endMinute: em || 0,
        dailyCap: Number(dailyCap) || 2,
        weeklyCap: Number(weeklyCap) || 10,
        isActive: config?.isActive ?? true,
      }
      return config
        ? managerApi.updatePeakHour(config.id, body)
        : managerApi.createPeakHour(body)
    },
    onSuccess: () => {
      showToast(
        'success',
        'Thành công',
        config ? 'Đã cập nhật khung giờ vàng.' : 'Đã thêm khung giờ vàng mới.'
      )
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu giờ vàng', msg)
    },
  })

  return (
    <Modal
      title={config ? 'Sửa khung giờ vàng' : 'Thêm khung giờ vàng'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="peak-hour-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu khung giờ'}
          </Btn>
        </>
      }
    >
      <form
        id="peak-hour-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!label.trim()) return setError('Vui lòng nhập tên khung giờ.')
          if (endTime <= startTime) return setError('Giờ kết thúc phải sau giờ bắt đầu.')
          setError(null)
          save.mutate()
        }}
        className="space-y-3"
      >
        <Field label="Tên khung giờ">
          <TextInput
            required
            maxLength={120}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ví dụ: Giờ vàng buổi sáng"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bắt đầu">
            <TextInput
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </Field>
          <Field label="Kết thúc">
            <TextInput
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Trần ca/ngày">
            <TextInput
              type="number"
              min={1}
              max={10}
              required
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
            />
          </Field>
          <Field label="Trần ca/tuần">
            <TextInput
              type="number"
              min={1}
              max={50}
              required
              value={weeklyCap}
              onChange={(e) => setWeeklyCap(e.target.value)}
            />
          </Field>
        </div>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function ScheduleForm({
  schedule,
  classes,
  rooms,
  coaches,
  plans = [],
  existingSchedules = [],
  onClose,
  onSaved,
}: {
  schedule: Schedule | null
  classes: GymClass[]
  rooms: Room[]
  coaches: CoachRow[]
  plans?: MembershipPlan[]
  existingSchedules?: Schedule[]
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const [form, setForm] = useState(() => {
    const roomId = schedule?.roomId ?? rooms[0]?.id ?? ''
    const roomCapacity = rooms.find((r) => r.id === roomId)?.capacity ?? DEFAULT_CAPACITY
    return {
      classId: schedule?.classId ?? classes[0]?.id ?? '',
      roomId,
      coachId: schedule?.coachId ?? '',
      day: schedule ? vnDay(schedule.startTime) : addDaysToDay(vnDay(), 1),
      start: schedule ? vnClock(schedule.startTime) : '18:00',
      end: schedule ? vnClock(schedule.endTime) : '19:00',
      capacity: String(schedule?.capacity ?? Math.min(DEFAULT_CAPACITY, roomCapacity)),
    }
  })
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const gymClass = classes.find((c) => c.id === form.classId)
  const classSpec = getClassSpecialtyCode(gymClass?.name || '', gymClass?.discipline?.code)

  // Prioritize dedicated room configured on the matching membership plan
  const matchingPlan = plans.find((p) => {
    if (p.disciplineId !== gymClass?.disciplineId) return false
    if (!p.roomId) return false
    const comp = isClassCompatibleWithPlan(gymClass?.name || '', p.name, gymClass?.discipline?.code)
    return comp.isCompatible
  })
  const planRoom = matchingPlan?.roomId ? rooms.find((r) => r.id === matchingPlan.roomId) : null

  const dedicatedRoomName = getSpecialtyDedicatedRoomName(classSpec || gymClass?.name || '')
  const dedicatedRoom = planRoom || rooms.find((r) => r.name === dedicatedRoomName)
  const room = rooms.find((r) => r.id === form.roomId) || dedicatedRoom

  // Auto assign dedicated room and capacity for the chosen class
  useEffect(() => {
    if (dedicatedRoom && form.roomId !== dedicatedRoom.id) {
      setForm((current) => ({
        ...current,
        roomId: dedicatedRoom.id,
        capacity: String(dedicatedRoom.capacity || 5),
      }))
    }
  }, [form.classId, dedicatedRoom?.id])

  const [onlyAvailable, setOnlyAvailable] = useState(!schedule)

  const eligibleBase = coaches.filter((coach) => {
    const specs = coach.coachProfile?.coachSpecialties ?? []
    if (classSpec) {
      return specs.some((s) => s.specialty?.code === classSpec)
    }
    return specs.some((s) => s.specialty?.disciplineId === gymClass?.disciplineId)
  })

  const checkCoachProfileAvailable = (coach: CoachRow) => {
    if (!form.day || !form.start || !form.end) return true
    const [y, m, d] = form.day.split('-').map(Number)
    if (!y || !m || !d) return true
    const dt = new Date(y, m - 1, d)
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY']
    const dayCode = dayNames[dt.getDay()]
    const cp = coach.coachProfile as { workingDays?: string[]; workingHours?: any[] } | undefined
    const workingDays = Array.isArray(cp?.workingDays) ? cp.workingDays : []
    const workingHours = Array.isArray(cp?.workingHours) ? cp.workingHours : []
    if (workingDays.length === 0 && workingHours.length === 0) return false
    if (workingDays.length > 0 && !workingDays.includes(dayCode)) return false
    if (workingHours.length === 0) return true
    return workingHours.some((wh: any) => {
      if (typeof wh === 'string') {
        const [rs, re] = wh.split('-').map((x) => x.trim())
        return Boolean(rs && re && rs <= form.start && re >= form.end)
      }
      if (wh?.day && wh.day !== dayCode) return false
      const rs = wh?.start || wh?.from || '08:00'
      const re = wh?.end || wh?.to || '12:00'
      return rs <= form.start && re >= form.end
    })
  }

  const checkCoachFreeSchedule = (cId: string) => {
    if (!form.day || !form.start || !form.end) return true
    const startMs = new Date(vnInstant(form.day, form.start)).getTime()
    const endMs = new Date(vnInstant(form.day, form.end)).getTime()
    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) return true
    return !existingSchedules.some((s) => {
      if (schedule && s.id === schedule.id) return false
      if (s.coachId !== cId) return false
      if (s.status === 'CANCELLED' || s.status === 'CANCELLED_BY_COACH') return false
      const sStart = new Date(s.startTime).getTime()
      const sEnd = new Date(s.endTime).getTime()
      return sStart < endMs && sEnd > startMs
    })
  }

  const eligible = onlyAvailable
    ? eligibleBase.filter((c) => checkCoachProfileAvailable(c) && checkCoachFreeSchedule(c.id))
    : eligibleBase

  const coachId = eligible.some((c) => c.id === form.coachId)
    ? form.coachId
    : (eligible[0]?.id ?? '')

  // Pre-flight collision checks for Room 5-Star Zone and Coach
  const currentCoach = coaches.find((c) => c.id === coachId)
  const currentCoachStars = currentCoach?.coachProfile?.ratingStars ?? 3

  const roomCollision = useMemo(() => {
    if (!form.roomId || !form.day || !form.start || !form.end) return null
    const startMs = new Date(vnInstant(form.day, form.start)).getTime()
    const endMs = new Date(vnInstant(form.day, form.end)).getTime()
    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) return null

    return existingSchedules.find((s) => {
      if (schedule && s.id === schedule.id) return false
      if (s.roomId !== form.roomId) return false
      const sStart = new Date(s.startTime).getTime()
      const sEnd = new Date(s.endTime).getTime()
      const isOverlap = sStart < endMs && sEnd > startMs
      if (!isOverlap) return false

      // Mỗi phòng tập có 5 khu vực tương ứng từ 1 đến 5 sao: nếu cùng cấp sao mới xung đột khu vực
      const otherCoach = coaches.find((c) => c.id === s.coachId)
      const otherCoachStars =
        otherCoach?.coachProfile?.ratingStars ??
        (s.coach as { coachProfile?: { ratingStars?: number } })?.coachProfile?.ratingStars ??
        3
      return otherCoachStars === currentCoachStars
    })
  }, [existingSchedules, form.roomId, form.day, form.start, form.end, schedule, currentCoachStars, coaches])

  const coachCollision = useMemo(() => {
    if (!coachId || !form.day || !form.start || !form.end) return null
    const startMs = new Date(vnInstant(form.day, form.start)).getTime()
    const endMs = new Date(vnInstant(form.day, form.end)).getTime()
    if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) return null

    return existingSchedules.find((s) => {
      if (schedule && s.id === schedule.id) return false
      if (s.coachId !== coachId) return false
      const sStart = new Date(s.startTime).getTime()
      const sEnd = new Date(s.endTime).getTime()
      return sStart < endMs && sEnd > startMs
    })
  }, [existingSchedules, coachId, form.day, form.start, form.end, schedule])

  const save = useMutation({
    mutationFn: () => {
      const body = {
        classId: form.classId,
        roomId: form.roomId,
        coachId,
        startTime: vnInstant(form.day, form.start),
        endTime: vnInstant(form.day, form.end),
        capacity: Number(form.capacity),
      }
      return schedule
        ? managerApi.updateSchedule(schedule.id, body)
        : managerApi.createSchedule(body)
    },
    onSuccess: () => {
      showToast('success', 'Thành công', schedule ? 'Đã cập nhật lịch lớp học.' : 'Đã xếp lịch lớp học mới.')
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu lịch lớp', msg)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!coachId) return setError('Chưa có HLV nào có chuyên môn cho môn của lớp này.')
    if (form.end <= form.start) return setError('Giờ kết thúc phải sau giờ bắt đầu.')
    if (new Date(vnInstant(form.day, form.start)) <= new Date())
      return setError('Chỉ xếp được lịch trong tương lai.')
    if (room && Number(form.capacity) > room.capacity)
      return setError(`Phòng ${room.name} chỉ chứa tối đa ${room.capacity} người.`)
    if (roomCollision)
      return setError(
        `Khu vực ${currentCoachStars} sao của phòng "${room?.name || 'này'}" đã có HLV ${roomCollision.coach?.fullName || ''} (${currentCoachStars} sao) đảm nhiệm trong khung giờ này.`
      )
    if (coachCollision)
      return setError(
        `HLV đã có lịch dạy lớp "${coachCollision.class?.name || 'khác'}" trong cùng khung giờ này.`
      )
    setError(null)
    save.mutate()
  }

  return (
    <Modal
      title={schedule ? 'Sửa lịch lớp' : 'Xếp lịch lớp nhóm'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn
            tone="primary"
            type="submit"
            form="schedule-form"
            disabled={save.isPending || !!roomCollision || !!coachCollision || !coachId}
          >
            {save.isPending ? 'Đang lưu…' : 'Lưu lịch'}
          </Btn>
        </>
      }
    >
      <form id="schedule-form" onSubmit={submit} className="space-y-3">
        <Field label="Lớp">
          <SelectInput required value={form.classId} onChange={set('classId')}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.discipline?.name})
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field
          label="HLV phụ trách"
          hint={
            classSpec
              ? `Chỉ hiển thị HLV đạt chuẩn chuyên môn: ${SPECIALTY_NAME_MAP[classSpec] || classSpec}`
              : 'Chỉ hiện HLV có chuyên môn thuộc bộ môn của lớp'
          }
        >
          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Chỉ lọc HLV đang rảnh (đúng giờ làm cố định trong hồ sơ & không trùng lịch)</span>
            </label>
            <SelectInput
              required
              value={coachId}
              onChange={(event) =>
                setForm((current) => ({ ...current, coachId: event.target.value }))
              }
            >
              {eligible.length === 0 ? (
                <option value="">
                  {onlyAvailable
                    ? 'Không có HLV nào đang rảnh đúng giờ làm & chuyên môn này'
                    : 'Không có HLV đạt chuẩn chuyên đề này'}
                </option>
              ) : null}
              {eligible.map((coach) => {
                const inHours = checkCoachProfileAvailable(coach)
                const isFree = checkCoachFreeSchedule(coach.id)
                const statusTag = !isFree
                  ? ' • Trùng lịch'
                  : inHours
                  ? ' • Rảnh đúng giờ'
                  : ' • Ngoài giờ cố định'
                return (
                  <option key={coach.id} value={coach.id}>
                    {coach.fullName} ({coach.coachProfile?.ratingStars || 3} sao{statusTag})
                  </option>
                )
              })}
            </SelectInput>
          </div>
        </Field>

        {/* Dedicated Room Card */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-700">Phòng tập chuyên đề</label>
            <span className="text-xs text-emerald-800 font-medium">
              {matchingPlan ? 'Mặc định theo gói' : 'Tự động gán phòng'}
            </span>
          </div>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <Building2 className="h-4 w-4" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-medium text-xs text-slate-900">
                  {dedicatedRoom ? dedicatedRoom.name : room?.name || 'Phòng tập'}
                </p>
                <p className="text-xs text-slate-500">
                  {matchingPlan
                    ? `Theo gói "${matchingPlan.name}"`
                    : dedicatedRoom?.locationNote || room?.locationNote || 'Phòng chuyên đề cố định'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-xs tabular-nums shrink-0">
              {form.capacity} học viên
            </span>
          </div>
        </div>

        {roomCollision && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
            <div className="font-medium flex items-center gap-1.5 text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" strokeWidth={1.5} />
              <span>Trùng phòng và chuyên đề trong khung giờ này</span>
            </div>
            <p className="leading-relaxed">
              Phòng "{dedicatedRoom?.name || room?.name}" đã có lớp "{roomCollision.class?.name}" (HLV {roomCollision.coach?.fullName}) từ {vnClock(roomCollision.startTime)} đến {vnClock(roomCollision.endTime)}. Vui lòng chọn khung giờ khác.
            </p>
          </div>
        )}

        {coachCollision && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
            <div className="font-medium flex items-center gap-1.5 text-rose-950">
              <AlertTriangle className="h-4 w-4 text-rose-700 shrink-0" strokeWidth={1.5} />
              <span>HLV đã có lịch dạy ca khác trong khung giờ này</span>
            </div>
            <p className="leading-relaxed">
              HLV đã được xếp dạy lớp "{coachCollision.class?.name}" từ {vnClock(coachCollision.startTime)} đến {vnClock(coachCollision.endTime)}. Vui lòng chọn HLV khác hoặc đổi giờ.
            </p>
          </div>
        )}

        <Field label="Ngày">
          <TextInput type="date" required min={vnDay()} value={form.day} onChange={set('day')} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bắt đầu">
            <TextInput type="time" required value={form.start} onChange={set('start')} />
          </Field>
          <Field label="Kết thúc">
            <TextInput type="time" required value={form.end} onChange={set('end')} />
          </Field>
        </div>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function ClassForm({
  gymClass,
  disciplines,
  onClose,
  onSaved,
}: {
  gymClass: GymClass | null
  disciplines: Discipline[]
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const [form, setForm] = useState({
    disciplineId: gymClass?.disciplineId ?? disciplines[0]?.id ?? '',
    name: gymClass?.name ?? '',
    description: gymClass?.description ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))
  const save = useMutation({
    mutationFn: () => {
      const body = {
        disciplineId: form.disciplineId,
        name: form.name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      }
      return gymClass ? managerApi.updateClass(gymClass.id, body) : managerApi.createClass(body)
    },
    onSuccess: () => {
      showToast('success', 'Thành công', gymClass ? 'Đã lưu thay đổi loại lớp.' : 'Đã thêm loại lớp mới.')
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu lớp học', msg)
    },
  })
  return (
    <Modal
      title={gymClass ? `Sửa lớp ${gymClass.name}` : 'Thêm loại lớp'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="class-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu lớp'}
          </Btn>
        </>
      }
    >
      <form
        id="class-form"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
        className="space-y-3"
      >
        <Field label="Bộ môn" hint="Gym không có lớp nhóm nên không có trong danh sách">
          <SelectInput required value={form.disciplineId} onChange={set('disciplineId')}>
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Tên lớp">
          <TextInput required maxLength={150} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Mô tả">
          <TextArea value={form.description} onChange={set('description')} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}
