import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import type { Booking, UserRow } from '../types/manager.types'
import { cn } from '@/lib/utils'
import {
  addDaysToDay,
  bookingStatusLabel,
  errorMessage,
  formatDate,
  formatDateTime,
  formatDay,
  formatTime,
  vnDay,
} from '../lib/format'
import { useUserNames } from '../lib/use-user-names'
import { MemberPicker } from '../components/member-picker'
import {
  Btn,
  Field,
  FormError,
  Modal,
  PageHeader,
  Panel,
  Pill,
  SelectInput,
  StateMessage,
  TextArea,
  TextInput,
  Pagination,
} from '../components/manager-ui'
import { usePagination } from '../lib/use-pagination'

const PAGE_SIZE = 20
const statusTone = {
  PENDING: 'amber',
  CONFIRMED: 'blue',
  CANCELLED: 'gray',
  ATTENDED: 'green',
} as const

type View = 'upcoming' | 'past' | 'cancelled' | 'all'
type Kind = 'ALL' | 'GROUP_CLASS' | 'PERSONAL_TRAINING'

function sessionOf(b: Booking) {
  if (b.bookingType === 'GROUP_CLASS' && b.schedule)
    return {
      title: b.schedule.class?.name ?? 'Lớp nhóm',
      start: b.schedule.startTime,
      end: b.schedule.endTime,
      coachId: b.schedule.coachId,
    }
  if (b.coachAvailability)
    return {
      title: 'Buổi PT 1-1',
      start: b.coachAvailability.startTime,
      end: b.coachAvailability.endTime,
      coachId: b.coachAvailability.coachId,
    }
  return {
    title: b.bookingType === 'GROUP_CLASS' ? 'Lớp nhóm' : 'Buổi PT 1-1',
    start: null,
    end: null,
    coachId: null,
  }
}

const weekdayFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  weekday: 'long',
})

/** "Hôm nay, 06/11/2026", "Ngày mai, …" or "Thứ Hai, 10/11/2026" for a session day. */
function dayHeading(day: string, today: string) {
  if (day === today) return `Hôm nay, ${formatDay(day)}`
  if (day === addDaysToDay(today, 1)) return `Ngày mai, ${formatDay(day)}`
  if (day === addDaysToDay(today, -1)) return `Hôm qua, ${formatDay(day)}`
  const weekday = weekdayFmt.format(new Date(`${day}T12:00:00+07:00`))
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formatDay(day)}`
}

function FilterChips<T extends string>({
  label,
  value,
  onChange,
  items,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  items: Array<{ value: T; label: string; count?: number }>
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-sm',
            value === item.value
              ? 'border-[#17664e] bg-emerald-50 font-medium text-[#135641]'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
          )}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="ml-1.5 text-xs tabular-nums text-slate-400">{item.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

const emptyText: Record<View, string> = {
  upcoming: 'Không có buổi nào sắp diễn ra.',
  past: 'Chưa có buổi nào đã diễn ra.',
  cancelled: 'Không có lượt đặt bị hủy.',
  all: 'Chưa có lượt đặt nào.',
}

export function ManagerBookingsPage() {
  const queryClient = useQueryClient()
  const bookings = useQuery({ queryKey: managerKeys.bookings, queryFn: managerApi.bookings })
  const staff = useQuery({ queryKey: managerKeys.staff, queryFn: managerApi.staff })
  const [view, setView] = useState<View>('upcoming')
  const [kind, setKind] = useState<Kind>('ALL')
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<Booking | null>(null)
  const [planFor, setPlanFor] = useState<Booking | null>(null)

  // eslint-disable-next-line react-hooks/purity -- splitting upcoming/past only needs the time at render
  const now = Date.now()
  const today = vnDay()
  const all = (bookings.data ?? []).map((b) => ({ ...b, session: sessionOf(b) }))
  const viewOf = (b: (typeof all)[number]): Exclude<View, 'all'> =>
    b.status === 'CANCELLED'
      ? 'cancelled'
      : b.session.end && new Date(b.session.end).getTime() >= now
        ? 'upcoming'
        : 'past'
  const ofKind = all.filter((b) => kind === 'ALL' || b.bookingType === kind)
  const count = (v: View) =>
    v === 'all' ? ofKind.length : ofKind.filter((b) => viewOf(b) === v).length
  const rows = ofKind
    .filter((b) => view === 'all' || viewOf(b) === view)
    .sort((a, b) => {
      const ta = a.session.start ? new Date(a.session.start).getTime() : 0
      const tb = b.session.start ? new Date(b.session.start).getTime() : 0
      // Upcoming: soonest first. Everything else: most recent first.
      return view === 'upcoming' ? ta - tb : tb - ta
    })
  const { items: visible, pager } = usePagination(rows, PAGE_SIZE, `${view}|${kind}`)
  const memberName = useUserNames(visible.map((b) => b.memberId))
  const coachName = (id: string | null) =>
    id ? (staff.data?.find((u) => u.id === id)?.fullName ?? 'HLV') : null

  const groups = new Map<string, typeof visible>()
  for (const b of visible) {
    const key = b.session.start ? vnDay(b.session.start) : 'unknown'
    groups.set(key, [...(groups.get(key) ?? []), b])
  }
  const heading = (day: string) => (day === 'unknown' ? 'Chưa rõ ngày' : dayHeading(day, today))

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: managerKeys.bookings })
    void queryClient.invalidateQueries({ queryKey: managerKeys.schedules })
  }

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Lịch đặt chỗ"
        description="Lượt đặt lớp nhóm và PT 1-1 của hội viên. Đặt hoặc hủy hộ khi hội viên nhờ quầy."
        actions={
          <Btn tone="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Đặt chỗ hộ
          </Btn>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Lọc theo thời điểm"
          value={view}
          onChange={setView}
          items={[
            { value: 'upcoming', label: 'Sắp diễn ra', count: count('upcoming') },
            { value: 'past', label: 'Đã diễn ra', count: count('past') },
            { value: 'cancelled', label: 'Đã hủy', count: count('cancelled') },
            { value: 'all', label: 'Tất cả', count: count('all') },
          ]}
        />
        <FilterChips
          label="Lọc theo loại buổi"
          value={kind}
          onChange={setKind}
          items={[
            { value: 'ALL', label: 'Mọi loại' },
            { value: 'GROUP_CLASS', label: 'Lớp nhóm' },
            { value: 'PERSONAL_TRAINING', label: 'PT 1-1' },
          ]}
        />
      </div>

      <Panel>
        {bookings.isLoading || bookings.isError ? (
          <StateMessage
            loading={bookings.isLoading}
            error={bookings.isError ? errorMessage(bookings.error) : null}
            onRetry={() => void bookings.refetch()}
          />
        ) : visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">{emptyText[view]}</p>
        ) : (
          <>
            {[...groups].map(([day, items]) => (
              <section key={day} aria-label={heading(day)}>
                <h2
                  className={cn(
                    'border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium',
                    day === today ? 'text-[#135641]' : 'text-slate-500',
                  )}
                >
                  {heading(day)}
                  <span className="ml-2 font-normal text-slate-400">{items.length} lượt</span>
                </h2>
                <ul className="divide-y divide-slate-100">
                  {items.map((b) => {
                    const open = b.status === 'CONFIRMED' || b.status === 'PENDING'
                    const coach = coachName(b.session.coachId)
                    return (
                      <li
                        key={b.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                      >
                        <div className="w-20 shrink-0 tabular-nums">
                          <p className="text-sm font-semibold text-slate-900">
                            {b.session.start ? formatTime(b.session.start) : '—'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {b.session.end ? `đến ${formatTime(b.session.end)}` : ''}
                          </p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-medium text-slate-900">{b.session.title}</span>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs',
                                b.bookingType === 'GROUP_CLASS'
                                  ? 'bg-sky-50 text-sky-700'
                                  : 'bg-violet-50 text-violet-700',
                              )}
                            >
                              {b.bookingType === 'GROUP_CLASS' ? 'Lớp nhóm' : 'PT 1-1'}
                            </span>
                          </p>
                          <p className="mt-0.5 text-sm text-slate-600">
                            {memberName(b.memberId)}
                            {coach ? <span className="text-slate-400">, HLV {coach}</span> : null}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            Đặt lúc {formatDateTime(b.bookedAt)}
                            {b.status === 'CANCELLED' && b.cancellationReason
                              ? `. Lý do hủy: ${b.cancellationReason}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Pill tone={statusTone[b.status]}>{bookingStatusLabel[b.status]}</Pill>
                          {b.isLateCancellation ? (
                            <span className="text-xs text-rose-700">Hủy muộn, mất buổi</span>
                          ) : null}
                        </div>
                        <div className="flex w-full shrink-0 justify-end gap-1.5 sm:w-auto">
                          {b.status !== 'CANCELLED' ? (
                            <Btn size="sm" onClick={() => setPlanFor(b)}>
                              Giáo án
                            </Btn>
                          ) : null}
                          {open ? (
                            <Btn size="sm" tone="danger" onClick={() => setCancelling(b)}>
                              Hủy hộ
                            </Btn>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
            <Pagination pager={pager} note="Hệ thống trả 200 lượt đặt gần nhất." />
          </>
        )}
      </Panel>
      {creating ? (
        <BookOnBehalfForm
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            refresh()
          }}
        />
      ) : null}
      {cancelling ? (
        <CancelForm
          booking={cancelling}
          memberName={memberName(cancelling.memberId)}
          onClose={() => setCancelling(null)}
          onSaved={() => {
            setCancelling(null)
            refresh()
          }}
        />
      ) : null}
      {planFor ? <PlanModal booking={planFor} onClose={() => setPlanFor(null)} /> : null}
    </div>
  )
}

function CancelForm({
  booking,
  memberName,
  onClose,
  onSaved,
}: {
  booking: Booking
  memberName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const s = sessionOf(booking)
  const save = useMutation({
    mutationFn: () => managerApi.cancelBooking(booking.id, reason.trim() || undefined),
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err)),
  })
  return (
    <Modal
      title={`Hủy lượt đặt của ${memberName}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Đóng</Btn>
          <Btn tone="danger" type="submit" form="cancel-booking-form" disabled={save.isPending}>
            {save.isPending ? 'Đang hủy…' : 'Hủy lượt đặt'}
          </Btn>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        {s.title}
        {s.start ? `, ${formatDateTime(s.start)}` : ''}. Hủy trước giờ tập theo quy định được
        hoàn buổi, muộn hơn sẽ mất buổi.
      </p>
      <form
        id="cancel-booking-form"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
        className="space-y-3"
      >
        <Field label="Lý do (không bắt buộc)">
          <TextArea maxLength={2000} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function BookOnBehalfForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const schedules = useQuery({ queryKey: managerKeys.schedules, queryFn: managerApi.schedules })
  const coaches = useQuery({ queryKey: managerKeys.coaches, queryFn: managerApi.coaches })
  const disciplines = useQuery({
    queryKey: managerKeys.disciplines,
    queryFn: managerApi.disciplines,
  })
  const [kind, setKind] = useState<'GROUP_CLASS' | 'PERSONAL_TRAINING'>('GROUP_CLASS')
  const [member, setMember] = useState<UserRow | null>(null)
  const [scheduleId, setScheduleId] = useState('')
  const [coachId, setCoachId] = useState('')
  const [slotId, setSlotId] = useState('')
  const [disciplineId, setDisciplineId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const slots = useQuery({
    queryKey: managerKeys.coachSlots(coachId),
    queryFn: () => managerApi.coachSlots(coachId),
    enabled: kind === 'PERSONAL_TRAINING' && !!coachId,
  })
  const coach = coaches.data?.find((c) => c.id === coachId)
  const coachDisciplines = [
    ...new Map(
      (coach?.coachProfile?.coachSpecialties ?? []).map((s) => [
        s.specialty.disciplineId,
        disciplines.data?.find((d) => d.id === s.specialty.disciplineId)?.name ?? 'Môn',
      ]),
    ),
  ]
  const chosenDiscipline = coachDisciplines.some(([id]) => id === disciplineId)
    ? disciplineId
    : (coachDisciplines[0]?.[0] ?? '')
  const openSchedules = (schedules.data ?? []).filter(
    (s) => s.status === 'OPEN' && s.currentEnrolled < s.capacity,
  )

  const save = useMutation({
    mutationFn: () =>
      kind === 'GROUP_CLASS'
        ? managerApi.bookGroup({ scheduleId, memberId: member!.id })
        : managerApi.bookPt({
            coachAvailabilityId: slotId,
            disciplineId: chosenDiscipline,
            memberId: member!.id,
          }),
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err)),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!member) return setError('Chọn hội viên trước.')
    if (kind === 'GROUP_CLASS' && !scheduleId) return setError('Chọn buổi lớp.')
    if (kind === 'PERSONAL_TRAINING' && (!slotId || !chosenDiscipline))
      return setError('Chọn HLV, môn và khung giờ.')
    setError(null)
    save.mutate()
  }

  return (
    <Modal
      wide
      title="Đặt chỗ hộ hội viên"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="book-form" disabled={save.isPending}>
            {save.isPending ? 'Đang đặt…' : 'Đặt chỗ'}
          </Btn>
        </>
      }
    >
      <form id="book-form" onSubmit={submit} className="space-y-3">
        <Field label="Hội viên">
          <div>
            <MemberPicker value={member} onChange={setMember} />
          </div>
        </Field>
        <Field label="Loại buổi">
          <SelectInput value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="GROUP_CLASS">Lớp nhóm</option>
            <option value="PERSONAL_TRAINING">PT 1-1</option>
          </SelectInput>
        </Field>
        {kind === 'GROUP_CLASS' ? (
          <Field label="Buổi lớp" hint="Chỉ hiện buổi còn chỗ. Buổi được trừ vào gói của hội viên.">
            <SelectInput
              required
              value={scheduleId}
              onChange={(e) => setScheduleId(e.target.value)}
            >
              <option value="">Chọn buổi</option>
              {openSchedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.class?.name}, {formatDateTime(s.startTime)}, {s.coach?.fullName} (
                  {s.currentEnrolled}/{s.capacity})
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Huấn luyện viên">
                <SelectInput
                  required
                  value={coachId}
                  onChange={(e) => {
                    setCoachId(e.target.value)
                    setSlotId('')
                  }}
                >
                  <option value="">Chọn HLV</option>
                  {(coaches.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Môn">
                <SelectInput
                  required
                  value={chosenDiscipline}
                  onChange={(e) => setDisciplineId(e.target.value)}
                >
                  {coachDisciplines.length === 0 ? (
                    <option value="">HLV chưa có chuyên môn</option>
                  ) : null}
                  {coachDisciplines.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
            <Field label="Khung giờ trống">
              <SelectInput
                required
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                disabled={!coachId}
              >
                <option value="">{slots.isLoading ? 'Đang tải…' : 'Chọn khung giờ'}</option>
                {(slots.data ?? []).map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {formatTime(slot.startTime)}–{formatTime(slot.endTime)}{' '}
                    {formatDate(slot.startTime)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </>
        )}
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function PlanModal({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const queryClient = useQueryClient()
  const plan = useQuery({
    queryKey: managerKeys.bookingPlan(booking.id),
    queryFn: () => managerApi.bookingPlan(booking.id),
  })
  const [templateCode, setTemplateCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const assign = useMutation({
    mutationFn: () =>
      managerApi.assignTemplate({
        bookingId: booking.id,
        ...(templateCode.trim() ? { templateCode: templateCode.trim() } : {}),
      }),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: managerKeys.bookingPlan(booking.id) })
      void queryClient.invalidateQueries({ queryKey: managerKeys.workoutPlans })
    },
    onError: (err) => setError(errorMessage(err)),
  })
  const p = plan.data
  return (
    <Modal
      wide
      title="Giáo án của buổi tập"
      onClose={onClose}
      footer={<Btn onClick={onClose}>Đóng</Btn>}
    >
      {plan.isLoading || plan.isError ? (
        <StateMessage
          loading={plan.isLoading}
          error={plan.isError ? errorMessage(plan.error) : null}
        />
      ) : p ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-900">
            {p.title}
            {p.sessionOrder ? (
              <span className="ml-2 text-xs text-slate-400">buổi {p.sessionOrder}</span>
            ) : null}
          </p>
          {p.notes ? <p className="text-sm text-slate-500">{p.notes}</p> : null}
          <ol className="list-decimal space-y-0.5 pl-5 text-sm text-slate-700">
            {p.exercises.map((e) => (
              <li key={e.id}>
                {e.exercise?.title}
                <span className="text-slate-400">
                  {e.sets ? ` ${e.sets} hiệp` : ''}
                  {e.reps ? ` x ${e.reps} ${e.unit ?? 'reps'}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            assign.mutate()
          }}
          className="space-y-3"
        >
          <p className="text-sm text-slate-600">
            Buổi này chưa có giáo án. Gán giáo án mẫu theo mã, hoặc để trống để hệ thống chọn mẫu
            theo thứ tự buổi trong khóa (buổi 1 đến 12).
          </p>
          <Field
            label="Mã giáo án mẫu (không bắt buộc)"
            hint="Xem mã ở màn Bài tập & giáo án, tab Giáo án mẫu."
          >
            <TextInput value={templateCode} onChange={(e) => setTemplateCode(e.target.value)} />
          </Field>
          <FormError>{error}</FormError>
          <Btn tone="primary" type="submit" disabled={assign.isPending}>
            {assign.isPending ? 'Đang gán…' : 'Gán giáo án mẫu'}
          </Btn>
        </form>
      )}
    </Modal>
  )
}
