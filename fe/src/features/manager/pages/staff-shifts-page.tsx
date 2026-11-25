import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Copy,
  Sparkles,
  CalendarDays,
  LayoutGrid,
  Columns,
  ArrowLeftRight,
  Clock,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit,
} from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import type { StaffShift, UserRow } from '../types/manager.types'
import { BulkShiftModal } from '../components/bulk-shift-modal'
import { FridayCloneShiftModal } from '../components/friday-clone-shift-modal'
import { MemberDatePickerModal } from '@/features/calendar/components/member-date-picker-modal'
import { useNotification } from '@/context/notification-context'
import {
  addDaysToDay,
  dayOnly,
  errorMessage,
  formatDay,
  formatTime,
  mondayOf,
  vnClock,
  vnDay,
  vnInstant,
} from '../lib/format'
import {
  Btn,
  Field,
  FormError,
  Modal,
  PageHeader,
  Panel,
  SelectInput,
  StateMessage,
  TextInput,
} from '../components/manager-ui'

const weekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']

function getShiftBadgeStyle(startTime: string) {
  const clock = vnClock(startTime)
  const hour = parseInt(clock.split(':')[0], 10)
  if (hour < 12) {
    return 'border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300'
  }
  if (hour < 17) {
    return 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300'
  }
  return 'border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300'
}

export function ManagerStaffShiftsPage() {
  const queryClient = useQueryClient()
  const [week, setWeek] = useState(() => mondayOf(vnDay()))
  const [selectedRole, setSelectedRole] = useState<'ALL' | 'RECEPTIONIST' | 'COACH'>('ALL')
  const [viewMode, setViewMode] = useState<'matrix' | 'columns'>('matrix')

  const [editing, setEditing] = useState<
    StaffShift | { day: string; staffId?: string } | null
  >(null)
  const [swappingShift, setSwappingShift] = useState<StaffShift | null>(null)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [showDatePickerModal, setShowDatePickerModal] = useState(false)

  const staffQuery = useQuery({ queryKey: managerKeys.staff, queryFn: managerApi.staff })

  const shiftParams = {
    from: week,
    to: addDaysToDay(week, 6),
    ...(selectedRole !== 'ALL' ? { role: selectedRole } : {}),
  }

  const shiftsQuery = useQuery({
    queryKey: ['manager', 'shifts', shiftParams],
    queryFn: () => managerApi.shifts(shiftParams),
  })

  const allStaff = staffQuery.data ?? []
  const eligibleStaff = allStaff.filter(
    (u) => (u.role === 'RECEPTIONIST' || u.role === 'COACH') && u.isActive,
  )

  const filteredStaff = eligibleStaff.filter((u) => {
    if (selectedRole === 'RECEPTIONIST') return u.role === 'RECEPTIONIST'
    if (selectedRole === 'COACH') return u.role === 'COACH'
    return true
  })

  const names = new Map(allStaff.map((u) => [u.id, u.fullName]))
  const roles = new Map(allStaff.map((u) => [u.id, u.role]))

  const days = weekdays.map((label, index) => ({
    label,
    day: addDaysToDay(week, index),
  }))

  const shifts = shiftsQuery.data ?? []

  // Group by day
  const byDay = new Map<string, StaffShift[]>()
  for (const shift of shifts) {
    const key = dayOnly(shift.shiftDate)
    byDay.set(key, [...(byDay.get(key) ?? []), shift])
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }

  // Group by staff
  const byStaff = new Map<string, StaffShift[]>()
  for (const shift of shifts) {
    byStaff.set(shift.staffId, [...(byStaff.get(shift.staffId) ?? []), shift])
  }

  // Workload metrics
  const staffHoursMap = new Map<string, number>()
  const staffShiftCountMap = new Map<string, number>()
  let totalHours = 0

  for (const shift of shifts) {
    const start = new Date(shift.startTime).getTime()
    const end = new Date(shift.endTime).getTime()
    const hours = Math.max(0, (end - start) / (1000 * 60 * 60))
    totalHours += hours
    staffHoursMap.set(shift.staffId, (staffHoursMap.get(shift.staffId) ?? 0) + hours)
    staffShiftCountMap.set(shift.staffId, (staffShiftCountMap.get(shift.staffId) ?? 0) + 1)
  }

  const today = vnDay()

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Xếp ca làm việc Nhân sự"
        description="Điều phối và quản lý ca trực cho Lễ tân & Huấn luyện viên theo tuần. Tự động kiểm tra chống trùng lặp ca."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Btn tone="secondary" onClick={() => setShowCloneModal(true)}>
              <Copy className="h-4 w-4" />
              Lên lịch tuần tới (Thứ 6)
            </Btn>
            <Btn tone="secondary" onClick={() => setShowBulkModal(true)}>
              <Sparkles className="h-4 w-4" />
              Xếp ca hàng loạt
            </Btn>
            <Btn
              tone="primary"
              onClick={() => setEditing({ day: today < week ? week : today })}
            >
              <Plus className="h-4 w-4" />
              Tạo ca lẻ
            </Btn>
          </div>
        }
      />

      {/* Workload Mini Dashboard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tổng số ca tuần này
            </span>
            <span className="text-lg font-bold text-slate-900">{shifts.length} ca</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tổng thời lượng trực
            </span>
            <span className="text-lg font-bold text-slate-900">{totalHours.toFixed(1)} giờ</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Nhân sự tham gia
            </span>
            <span className="text-lg font-bold text-slate-900">
              {byStaff.size} / {filteredStaff.length} người
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Tỷ lệ phân bổ
            </span>
            <span className="text-lg font-bold text-slate-900">
              {filteredStaff.length > 0
                ? (totalHours / filteredStaff.length).toFixed(1)
                : '0'}{' '}
              h/người
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Role Filters & View Mode */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
        {/* Role Filters */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 w-fit text-xs font-semibold">
          <button
            type="button"
            onClick={() => setSelectedRole('ALL')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              selectedRole === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({eligibleStaff.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('RECEPTIONIST')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              selectedRole === 'RECEPTIONIST'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lễ tân ({allStaff.filter((u) => u.role === 'RECEPTIONIST' && u.isActive).length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('COACH')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              selectedRole === 'COACH'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Huấn luyện viên ({allStaff.filter((u) => u.role === 'COACH' && u.isActive).length})
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 w-fit text-xs font-semibold">
          <button
            type="button"
            onClick={() => setViewMode('matrix')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              viewMode === 'matrix'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Ma trận Nhân sự
          </button>
          <button
            type="button"
            onClick={() => setViewMode('columns')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
              viewMode === 'columns'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns className="h-3.5 w-3.5" />
            Lịch 7 Cột
          </button>
        </div>
      </div>

      {/* Main Panel */}
      <Panel
        title={`Tuần ${formatDay(week)} – ${formatDay(addDaysToDay(week, 6))}`}
        actions={
          <div className="flex items-center gap-1.5">
            <Btn
              size="sm"
              onClick={() => setShowDatePickerModal(true)}
              className="inline-flex items-center gap-1.5"
            >
              <CalendarDays className="h-4 w-4 text-[#17664e]" />
              <span>Chọn ngày / tuần</span>
            </Btn>
            <Btn
              size="sm"
              tone="ghost"
              aria-label="Tuần trước"
              onClick={() => setWeek(addDaysToDay(week, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Btn>
            <Btn size="sm" onClick={() => setWeek(mondayOf(vnDay()))}>
              Tuần này
            </Btn>
            <Btn
              size="sm"
              tone="ghost"
              aria-label="Tuần sau"
              onClick={() => setWeek(addDaysToDay(week, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Btn>
          </div>
        }
      >
        {shiftsQuery.isLoading || shiftsQuery.isError ? (
          <StateMessage
            loading={shiftsQuery.isLoading}
            error={shiftsQuery.isError ? errorMessage(shiftsQuery.error) : null}
            onRetry={() => void shiftsQuery.refetch()}
          />
        ) : viewMode === 'matrix' ? (
          /* VIEW 1: STAFF MATRIX GRID */
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="sticky left-0 z-20 w-52 bg-slate-50/90 px-4 py-3 font-bold text-slate-700 shadow-xs backdrop-blur-xs">
                    Nhân viên & Khối lượng
                  </th>
                  {days.map(({ label, day }) => (
                    <th
                      key={day}
                      className={`px-3 py-3 text-center font-bold border-l border-slate-200 ${
                        day === today ? 'bg-emerald-50/80 text-[#135641]' : 'text-slate-700'
                      }`}
                    >
                      <div>{label}</div>
                      <div className="text-[11px] font-normal text-slate-400">
                        {formatDay(day).slice(0, 5)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      Không có nhân sự nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((staffMember) => {
                    const hours = staffHoursMap.get(staffMember.id) ?? 0
                    const count = staffShiftCountMap.get(staffMember.id) ?? 0
                    const staffShifts = byStaff.get(staffMember.id) ?? []

                    return (
                      <tr key={staffMember.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Staff Column */}
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 border-r border-slate-200 shadow-xs">
                          <div className="font-semibold text-slate-900 truncate">
                            {staffMember.fullName}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                staffMember.role === 'RECEPTIONIST'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {staffMember.role === 'RECEPTIONIST' ? 'Lễ tân' : 'HLV'}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                              {hours.toFixed(0)}h ({count} ca)
                            </span>
                          </div>
                        </td>

                        {/* 7 Days Columns */}
                        {days.map(({ day }) => {
                          const dayShifts = staffShifts.filter((s) => dayOnly(s.shiftDate) === day)
                          const isToday = day === today

                          return (
                            <td
                              key={day}
                              className={`p-1.5 border-l border-slate-100 align-top group/cell ${
                                isToday ? 'bg-emerald-50/20' : ''
                              }`}
                            >
                              <div className="min-h-[64px] flex flex-col gap-1.5">
                                {dayShifts.map((shift) => (
                                  <div
                                    key={shift.id}
                                    className={`relative rounded-md border p-1.5 text-left transition-all shadow-2xs group/shift cursor-pointer ${getShiftBadgeStyle(
                                      shift.startTime,
                                    )}`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span
                                        onClick={() => setEditing(shift)}
                                        className="font-bold tabular-nums text-[11px] block hover:underline"
                                      >
                                        {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                                      </span>
                                      <button
                                        type="button"
                                        title="Hoán đổi ca"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setSwappingShift(shift)
                                        }}
                                        className="opacity-0 group-hover/shift:opacity-100 p-0.5 hover:bg-black/10 rounded transition-opacity"
                                      >
                                        <ArrowLeftRight className="h-3 w-3" />
                                      </button>
                                    </div>
                                    {shift.notes ? (
                                      <span className="block truncate text-[10px] text-slate-500 mt-0.5">
                                        {shift.notes}
                                      </span>
                                    ) : null}
                                  </div>
                                ))}

                                {/* Quick Add Button in cell */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditing({ day, staffId: staffMember.id })
                                  }
                                  className="w-full rounded py-1 text-[11px] font-medium text-slate-400 opacity-0 group-hover/cell:opacity-100 hover:bg-slate-100 hover:text-[#135641] transition-all"
                                >
                                  + Thêm
                                </button>
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* VIEW 2: WEEKLY COLUMN VIEW */
          <div className="grid divide-y divide-slate-100 md:grid-cols-7 md:divide-x md:divide-y-0">
            {days.map(({ label, day }) => {
              const list = byDay.get(day) ?? []
              const isToday = day === today
              return (
                <div
                  key={day}
                  className={`flex min-h-[220px] flex-col p-2.5 ${
                    isToday ? 'bg-emerald-50/20' : ''
                  }`}
                >
                  <div
                    className={
                      isToday ? 'mb-2 font-bold text-[#135641]' : 'mb-2 text-slate-700 font-medium'
                    }
                  >
                    <span className="text-sm">{label}</span>
                    <span className="ml-1 text-xs text-slate-400">
                      {formatDay(day).slice(0, 5)}
                    </span>
                  </div>

                  <div className="flex-1 space-y-2">
                    {list.map((shift) => (
                      <div
                        key={shift.id}
                        className={`rounded-lg border p-2 text-left text-xs transition-all shadow-2xs group/card relative ${getShiftBadgeStyle(
                          shift.startTime,
                        )}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold tabular-nums">
                            {formatTime(shift.startTime)}–{formatTime(shift.endTime)}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                            <button
                              type="button"
                              title="Hoán đổi ca"
                              onClick={() => setSwappingShift(shift)}
                              className="p-1 hover:bg-black/10 rounded"
                            >
                              <ArrowLeftRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              title="Sửa ca"
                              onClick={() => setEditing(shift)}
                              className="p-1 hover:bg-black/10 rounded"
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-1 flex items-center justify-between">
                          <span className="font-medium truncate text-slate-800">
                            {names.get(shift.staffId) ?? 'Nhân viên'}
                          </span>
                          <span
                            className={`rounded px-1 text-[9px] font-bold ${
                              roles.get(shift.staffId) === 'RECEPTIONIST'
                                ? 'bg-sky-100 text-sky-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {roles.get(shift.staffId) === 'RECEPTIONIST' ? 'LT' : 'HLV'}
                          </span>
                        </div>

                        {shift.notes ? (
                          <span className="block truncate text-[11px] text-slate-500 mt-0.5">
                            {shift.notes}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditing({ day })}
                    className="mt-3 rounded py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-100 hover:text-[#135641] transition-colors"
                  >
                    + Thêm ca
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      {/* Shift Form Modal */}
      {editing ? (
        <ShiftForm
          shift={'id' in editing ? editing : null}
          day={'id' in editing ? dayOnly(editing.shiftDate) : editing.day}
          defaultStaffId={'staffId' in editing ? editing.staffId : undefined}
          eligibleStaff={eligibleStaff}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void queryClient.invalidateQueries({ queryKey: ['manager', 'shifts'] })
          }}
        />
      ) : null}

      {/* Swap Shifts Modal */}
      {swappingShift ? (
        <SwapShiftsModal
          currentShift={swappingShift}
          allShifts={shifts}
          staffMap={names}
          onClose={() => setSwappingShift(null)}
          onSaved={() => {
            setSwappingShift(null)
            void queryClient.invalidateQueries({ queryKey: ['manager', 'shifts'] })
          }}
        />
      ) : null}

      {/* Bulk Shift Modal */}
      <BulkShiftModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        staffList={eligibleStaff}
        currentWeek={week}
      />

      {/* Friday Clone Shift Modal */}
      <FridayCloneShiftModal
        isOpen={showCloneModal}
        onClose={() => setShowCloneModal(false)}
        currentWeek={week}
        shiftCountThisWeek={shifts.length}
      />

      {/* Member Date Picker Modal */}
      <MemberDatePickerModal
        isOpen={showDatePickerModal}
        onClose={() => setShowDatePickerModal(false)}
        currentWeek={week}
        onSelectWeek={(selectedMonday) => {
          setWeek(selectedMonday)
          setShowDatePickerModal(false)
        }}
      />
    </div>
  )
}

function ShiftForm({
  shift,
  day,
  defaultStaffId,
  eligibleStaff,
  onClose,
  onSaved,
}: {
  shift: StaffShift | null
  day: string
  defaultStaffId?: string
  eligibleStaff: Array<UserRow>
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    staffId: shift?.staffId ?? defaultStaffId ?? eligibleStaff[0]?.id ?? '',
    day,
    start: shift ? vnClock(shift.startTime) : '06:00',
    end: shift ? vnClock(shift.endTime) : '14:00',
    notes: shift?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const { showToast } = useNotification()
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const save = useMutation({
    mutationFn: () => {
      const body = {
        staffId: form.staffId,
        shiftDate: form.day,
        startTime: vnInstant(form.day, form.start),
        endTime: vnInstant(form.day, form.end),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }
      return shift ? managerApi.updateShift(shift.id, body) : managerApi.createShift(body)
    },
    onSuccess: () => {
      showToast('success', 'Thành công', shift ? 'Đã cập nhật ca trực.' : 'Đã xếp ca trực thành công.')
      onSaved()
    },
    onError: (err: unknown) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu ca', msg)
    },
  })

  const remove = useMutation({
    mutationFn: () => managerApi.deleteShift(shift!.id),
    onSuccess: () => {
      showToast('success', 'Xóa ca thành công', 'Đã xóa ca trực.')
      onSaved()
    },
    onError: (err: unknown) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi xóa ca', msg)
    },
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.staffId) return setError('Chưa có nhân viên nào được chọn để xếp ca.')
    if (form.end <= form.start) return setError('Giờ kết thúc phải sau giờ bắt đầu.')
    setError(null)
    save.mutate()
  }

  return (
    <Modal
      title={shift ? 'Sửa ca làm việc' : 'Xếp ca làm việc'}
      onClose={onClose}
      footer={
        <>
          {shift ? (
            <Btn
              tone="danger"
              className="mr-auto inline-flex items-center gap-1.5"
              disabled={remove.isPending}
              onClick={() => window.confirm('Xóa ca trực này?') && remove.mutate()}
            >
              <Trash2 className="h-4 w-4" />
              Xóa ca
            </Btn>
          ) : null}
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="shift-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu ca'}
          </Btn>
        </>
      }
    >
      <form id="shift-form" onSubmit={submit} className="space-y-4">
        <Field label="Nhân viên xếp ca">
          <SelectInput required value={form.staffId} onChange={set('staffId')}>
            {eligibleStaff.length === 0 ? <option value="">Chưa có nhân sự</option> : null}
            {eligibleStaff.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} ({user.role === 'RECEPTIONIST' ? 'Lễ tân' : 'HLV'})
              </option>
            ))}
          </SelectInput>
        </Field>

        <Field label="Ngày trực">
          <TextInput type="date" required value={form.day} onChange={set('day')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bắt đầu">
            <TextInput type="time" required value={form.start} onChange={set('start')} />
          </Field>
          <Field label="Kết thúc">
            <TextInput type="time" required value={form.end} onChange={set('end')} />
          </Field>
        </div>

        <Field label="Ghi chú">
          <TextInput
            placeholder="Ví dụ: Ca trực quầy chính, Trực sàn gym..."
            value={form.notes}
            onChange={set('notes')}
          />
        </Field>

        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function SwapShiftsModal({
  currentShift,
  allShifts,
  staffMap,
  onClose,
  onSaved,
}: {
  currentShift: StaffShift
  allShifts: StaffShift[]
  staffMap: Map<string, string>
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const targetShifts = allShifts.filter((s) => s.id !== currentShift.id)
  const [selectedTargetId, setSelectedTargetId] = useState<string>(targetShifts[0]?.id ?? '')
  const [error, setError] = useState<string | null>(null)

  const swapMutation = useMutation({
    mutationFn: () =>
      managerApi.swapShifts({
        shiftIdA: currentShift.id,
        shiftIdB: selectedTargetId,
      }),
    onSuccess: () => {
      showToast('success', 'Hoán đổi thành công', 'Đã hoán đổi nhân sự giữa 2 ca trực.')
      onSaved()
    },
    onError: (err: unknown) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi hoán đổi ca', msg)
    },
  })

  const targetShift = targetShifts.find((s) => s.id === selectedTargetId)

  return (
    <Modal
      title="Hoán đổi ca làm việc"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn
            tone="primary"
            disabled={swapMutation.isPending || !selectedTargetId}
            onClick={() => swapMutation.mutate()}
          >
            {swapMutation.isPending ? 'Đang hoán đổi…' : 'Xác nhận hoán đổi'}
          </Btn>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-600">
          Chọn một ca làm việc khác trong tuần để hoán đổi nhân sự trực với ca hiện tại:
        </p>

        {/* Shift A Info */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
          <span className="font-bold text-slate-500 uppercase text-[10px]">Ca hiện tại</span>
          <div className="font-semibold text-slate-900">
            {staffMap.get(currentShift.staffId) ?? 'Nhân viên'}
          </div>
          <div className="text-slate-600 tabular-nums">
            {formatDay(dayOnly(currentShift.shiftDate))}: {formatTime(currentShift.startTime)} –{' '}
            {formatTime(currentShift.endTime)}
          </div>
        </div>

        {/* Shift B Selector */}
        <Field label="Ca muốn hoán đổi">
          {targetShifts.length === 0 ? (
            <p className="text-xs text-slate-400">Không có ca nào khác trong tuần để hoán đổi.</p>
          ) : (
            <SelectInput
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
            >
              {targetShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {staffMap.get(s.staffId) ?? 'NV'} | {formatDay(dayOnly(s.shiftDate))} (
                  {formatTime(s.startTime)}–{formatTime(s.endTime)})
                </option>
              ))}
            </SelectInput>
          )}
        </Field>

        {targetShift && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs space-y-1">
            <span className="font-bold text-emerald-800 uppercase text-[10px]">
              Kết quả sau khi hoán đổi
            </span>
            <div className="text-slate-700">
              • <strong>{staffMap.get(currentShift.staffId)}</strong> sẽ trực ca:{' '}
              {formatDay(dayOnly(targetShift.shiftDate))} ({formatTime(targetShift.startTime)}–
              {formatTime(targetShift.endTime)})
            </div>
            <div className="text-slate-700">
              • <strong>{staffMap.get(targetShift.staffId)}</strong> sẽ trực ca:{' '}
              {formatDay(dayOnly(currentShift.shiftDate))} ({formatTime(currentShift.startTime)}–
              {formatTime(currentShift.endTime)})
            </div>
          </div>
        )}

        <FormError>{error}</FormError>
      </div>
    </Modal>
  )
}
