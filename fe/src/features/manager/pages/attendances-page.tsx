import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { managerApi, managerKeys } from '../api/manager-api'
import type { GateCheckinResult, LockerZone, UserRow } from '../types/manager.types'
import { errorMessage, formatDateTime, formatTime, zoneLabel } from '../lib/format'
import { useUserNames } from '../lib/use-user-names'
import { MemberPicker } from '../components/member-picker'
import {
  Btn,
  EmptyRow,
  Field,
  FormError,
  PageHeader,
  Panel,
  Pill,
  SelectInput,
  Stat,
  StateMessage,
  Table,
  Td,
  TextInput,
  Th,
  Pagination,
} from '../components/manager-ui'
import { usePagination } from '../lib/use-pagination'

const zones: LockerZone[] = ['MALE_LOCKER', 'FEMALE_LOCKER', 'VIP_AREA']
const FEED_LIMIT = 30

interface GateEvent {
  attendanceId: string
  memberId: string
  lockerNumber?: string | null
  at: string
}

export function ManagerAttendancesPage() {
  const queryClient = useQueryClient()
  const summary = useQuery({ queryKey: managerKeys.summary, queryFn: managerApi.summary })
  const [feed, setFeed] = useState<GateEvent[]>([])
  const feedName = useUserNames(feed.map((e) => e.memberId))

  useEffect(() => {
    const handleRealtimeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: string; data: Record<string, unknown> }>
      if (customEvent.detail?.type === 'gate.checked-in') {
        const data = customEvent.detail.data as unknown as Omit<GateEvent, 'at'>
        if (data?.attendanceId) {
          setFeed((current) =>
            current.some((e) => e.attendanceId === data.attendanceId)
              ? current
              : [{ ...data, at: new Date().toISOString() }, ...current].slice(0, FEED_LIMIT),
          )
          void queryClient.invalidateQueries({ queryKey: managerKeys.summary })
        }
      }
    }

    window.addEventListener('app:realtime-event', handleRealtimeEvent)
    return () => {
      window.removeEventListener('app:realtime-event', handleRealtimeEvent)
    }
  }, [queryClient])

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Cổng vào & điểm danh"
        description="Check-in cổng cho hội viên và tra lịch sử điểm danh."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Lượt vào cổng hôm nay" value={summary.data?.gateEntries ?? '…'} />
        <Stat label="Lượt vào từ lúc mở trang" value={feed.length} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CheckinPanel
          onCheckedIn={(member, result) =>
            setFeed((current) =>
              current.some((e) => e.attendanceId === result.attendanceId)
                ? current
                : [
                    {
                      attendanceId: result.attendanceId,
                      memberId: member.id,
                      lockerNumber: result.assignedLocker,
                      at: result.checkinTime,
                    },
                    ...current,
                  ].slice(0, FEED_LIMIT),
            )
          }
        />
        <Panel title="Lượt vào cổng trực tiếp">
          {feed.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              Chưa có lượt nào từ lúc mở trang. Lượt quẹt thẻ ở quầy sẽ hiện ở đây ngay.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {feed.map((e) => (
                <li
                  key={e.attendanceId}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                >
                  <span className="text-slate-900">{feedName(e.memberId)}</span>
                  <span className="text-xs text-slate-500">
                    {e.lockerNumber ? `Tủ ${e.lockerNumber}, ` : ''}
                    {formatTime(e.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <HistoryPanel />
    </div>
  )
}

function CheckinPanel({
  onCheckedIn,
}: {
  onCheckedIn: (member: UserRow, result: GateCheckinResult) => void
}) {
  const queryClient = useQueryClient()
  const [member, setMember] = useState<UserRow | null>(null)
  const [zone, setZone] = useState('')
  const [towel, setTowel] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    member: UserRow
    data: GateCheckinResult
    returned?: boolean
  } | null>(null)

  const checkin = useMutation({
    mutationFn: () =>
      managerApi.gateCheckin({
        userId: member!.id,
        ...(zone ? { preferredZone: zone } : {}),
        towelIssued: towel,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      }),
    onSuccess: (data) => {
      setResult({ member: member!, data })
      onCheckedIn(member!, data)
      setMember(null)
      setNotes('')
      setTowel(false)
      void queryClient.invalidateQueries({ queryKey: managerKeys.lockers })
      void queryClient.invalidateQueries({ queryKey: managerKeys.summary })
    },
    onError: (err) => setError(errorMessage(err)),
  })
  const returnLocker = useMutation({
    mutationFn: (assignmentId: string) => managerApi.returnLocker(assignmentId),
    onSuccess: () => {
      setResult((current) => (current ? { ...current, returned: true } : current))
      void queryClient.invalidateQueries({ queryKey: managerKeys.lockers })
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!member) return setError('Chọn hội viên trước.')
    setError(null)
    setResult(null)
    checkin.mutate()
  }

  return (
    <Panel title="Check-in cổng">
      <form onSubmit={submit} className="space-y-3 p-4">
        <Field label="Hội viên">
          <div>
            <MemberPicker value={member} onChange={setMember} />
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Khu tủ" hint="Để trống nếu không cần tủ.">
            <SelectInput value={zone} onChange={(e) => setZone(e.target.value)}>
              <option value="">Không cấp tủ</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {zoneLabel[z]}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Ghi chú">
            <TextInput maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#17664e]"
            checked={towel}
            onChange={(e) => setTowel(e.target.checked)}
          />
          Phát khăn
        </label>
        <FormError>{error}</FormError>
        <Btn tone="primary" type="submit" disabled={checkin.isPending}>
          {checkin.isPending ? 'Đang check-in…' : 'Check-in'}
        </Btn>
      </form>
      {result ? (
        <div className="mx-4 mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p>
            {result.member.fullName} {result.data.repeated ? 'đã vào cổng trước đó' : 'đã vào cổng'}{' '}
            lúc {formatTime(result.data.checkinTime)}.
            {result.data.assignedLocker ? ` Tủ ${result.data.assignedLocker}.` : ' Không cấp tủ.'}
            {result.data.towelIssued ? ' Đã phát khăn.' : ''}
          </p>
          {result.data.lockerAssignment && !result.returned ? (
            <Btn
              size="sm"
              className="mt-2"
              disabled={returnLocker.isPending}
              onClick={() => returnLocker.mutate(result.data.lockerAssignment!.id)}
            >
              Hội viên trả tủ
            </Btn>
          ) : null}
          {result.returned ? <p className="mt-1 text-xs">Đã nhận lại tủ.</p> : null}
        </div>
      ) : null}
    </Panel>
  )
}

function HistoryPanel() {
  const [member, setMember] = useState<UserRow | null>(null)
  const history = useQuery({
    queryKey: managerKeys.attendances(member?.id ?? ''),
    queryFn: () => managerApi.attendances(member!.id),
    enabled: !!member,
  })
  const rows = history.data ?? []
  const { items: pageRows, pager } = usePagination(rows, 15, member?.id ?? '')
  return (
    <Panel title="Lịch sử điểm danh của hội viên" className="mt-6">
      <div className="max-w-xl p-4">
        <MemberPicker value={member} onChange={setMember} />
      </div>
      {member ? (
        history.isLoading || history.isError ? (
          <StateMessage
            loading={history.isLoading}
            error={history.isError ? errorMessage(history.error) : null}
            onRetry={() => void history.refetch()}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Thời gian</Th>
                  <Th>Loại</Th>
                  <Th>Trạng thái</Th>
                  <Th>Khăn</Th>
                  <Th>Ghi chú</Th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <EmptyRow colSpan={5}>Hội viên chưa có lượt điểm danh.</EmptyRow>
                ) : (
                  pageRows.map((a) => (
                    <tr key={a.id}>
                      <Td className="whitespace-nowrap">{formatDateTime(a.checkInTime)}</Td>
                      <Td>{a.checkinType === 'GATE_ENTRY' ? 'Vào cổng' : 'Điểm danh buổi tập'}</Td>
                      <Td>
                        <Pill
                          tone={
                            a.status === 'PRESENT' ? 'green' : a.status === 'LATE' ? 'amber' : 'red'
                          }
                        >
                          {a.status === 'PRESENT'
                            ? 'Có mặt'
                            : a.status === 'LATE'
                              ? 'Đi muộn'
                              : 'Vắng'}
                        </Pill>
                      </Td>
                      <Td>{a.towelIssued ? 'Có' : '—'}</Td>
                      <Td className="text-slate-500">{a.notes}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
            <Pagination pager={pager} />
          </>
        )
      ) : null}
      <p className="px-4 py-2 text-xs text-slate-400">
        Hệ thống chỉ cho tra lịch sử theo từng hội viên (200 lượt gần nhất), chưa có danh sách chung
        của cả trung tâm.
      </p>
    </Panel>
  )
}
