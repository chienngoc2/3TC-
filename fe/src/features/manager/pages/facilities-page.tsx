import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import { useNotification } from '@/context/notification-context'
import type { Equipment, Locker, LockerZone, Room } from '../types/manager.types'
import { errorMessage, lockerStatusLabel, zoneLabel } from '../lib/format'
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
  TextInput,
  Th,
  Pagination,
} from '../components/manager-ui'
import { usePagination } from '../lib/use-pagination'

type Tab = 'rooms' | 'equipment' | 'lockers'
const zones: LockerZone[] = ['MALE_LOCKER', 'FEMALE_LOCKER', 'VIP_AREA']
const lockerTone = { AVAILABLE: 'green', OCCUPIED: 'blue', MAINTENANCE: 'amber' } as const

export function ManagerFacilitiesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useNotification()
  const [tab, setTab] = useState<Tab>('rooms')
  const rooms = useQuery({ queryKey: managerKeys.rooms, queryFn: managerApi.rooms })
  const equipment = useQuery({ queryKey: managerKeys.equipment, queryFn: managerApi.equipment })
  const lockers = useQuery({ queryKey: managerKeys.lockers, queryFn: managerApi.lockers })
  const [roomForm, setRoomForm] = useState<Room | 'new' | null>(null)
  const [equipmentForm, setEquipmentForm] = useState<Equipment | 'new' | null>(null)
  const [lockerForm, setLockerForm] = useState(false)
  const [zoneFilter, setZoneFilter] = useState('')
  const [error, setError] = useState<string | null>(null)

  const invalidate = (key: readonly string[], successMsg?: string) => () => {
    setError(null)
    if (successMsg) showToast('success', 'Thành công', successMsg)
    void queryClient.invalidateQueries({ queryKey: key })
  }
  const onError = (actionName: string) => (err: unknown) => {
    const msg = errorMessage(err)
    setError(msg)
    showToast('error', `Lỗi ${actionName}`, msg)
  }
  const disableRoom = useMutation({
    mutationFn: managerApi.disableRoom,
    onSuccess: invalidate(managerKeys.rooms, 'Đã cập nhật trạng thái phòng.'),
    onError: onError('phòng'),
  })
  const disableEquipment = useMutation({
    mutationFn: managerApi.disableEquipment,
    onSuccess: invalidate(managerKeys.equipment, 'Đã cập nhật trạng thái thiết bị.'),
    onError: onError('thiết bị'),
  })
  const lockerStatus = useMutation({
    mutationFn: (locker: Locker) =>
      managerApi.setLockerStatus(
        locker.id,
        locker.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE',
      ),
    onSuccess: invalidate(managerKeys.lockers, 'Đã chuyển trạng thái tủ đồ.'),
    onError: onError('tủ đồ'),
  })
  const lockerRelease = useMutation({
    mutationFn: (lockerId: string) => managerApi.releaseLocker(lockerId),
    onSuccess: invalidate(managerKeys.lockers, 'Đã giải phóng tủ đồ.'),
    onError: onError('giải phóng tủ đồ'),
  })

  const roomRows = rooms.data ?? []
  const roomName = new Map(roomRows.map((r) => [r.id, r.name]))
  const equipmentRows = [...(equipment.data ?? [])].sort(
    (a, b) =>
      (roomName.get(a.roomId) ?? '').localeCompare(roomName.get(b.roomId) ?? '') ||
      a.name.localeCompare(b.name),
  )
  const lockerRows = (lockers.data ?? []).filter((l) => !zoneFilter || l.zone === zoneFilter)
  const roomPage = usePagination(roomRows, 10)
  const equipmentPage = usePagination(equipmentRows, 10)
  const lockerPage = usePagination(lockerRows, 15, zoneFilter)
  const lockerCount = (status: string) =>
    (lockers.data ?? []).filter((l) => l.status === status).length

  const state = (query: {
    isLoading: boolean
    isError: boolean
    error: unknown
    refetch: () => unknown
  }) =>
    query.isLoading || query.isError ? (
      <StateMessage
        loading={query.isLoading}
        error={query.isError ? errorMessage(query.error) : null}
        onRetry={() => void query.refetch()}
      />
    ) : null

  const addButton =
    tab === 'rooms' ? (
      <Btn tone="primary" onClick={() => setRoomForm('new')}>
        <Plus className="h-4 w-4" />
        Thêm phòng
      </Btn>
    ) : tab === 'equipment' ? (
      <Btn tone="primary" disabled={roomRows.length === 0} onClick={() => setEquipmentForm('new')}>
        <Plus className="h-4 w-4" />
        Thêm thiết bị
      </Btn>
    ) : (
      <Btn tone="primary" onClick={() => setLockerForm(true)}>
        <Plus className="h-4 w-4" />
        Thêm tủ
      </Btn>
    )

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Cơ sở vật chất"
        description="Phòng tập, thiết bị và tủ đồ đang sử dụng."
        actions={addButton}
      />
      <Tabs
        value={tab}
        onChange={(value) => {
          setError(null)
          setTab(value)
        }}
        items={[
          { value: 'rooms', label: 'Phòng tập', count: roomRows.length },
          { value: 'equipment', label: 'Thiết bị', count: equipment.data?.length },
          { value: 'lockers', label: 'Tủ đồ', count: lockers.data?.length },
        ]}
      />
      <div className="mb-3 empty:hidden">
        <FormError>{error}</FormError>
      </div>

      {tab === 'rooms' ? (
        <Panel>
          {state(rooms) ?? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Phòng</Th>
                    <Th>Bộ môn</Th>
                    <Th>Gói tập đang gán (1-1)</Th>
                    <Th>Sức chứa</Th>
                    <Th>Vị trí</Th>
                    <Th>Thiết bị</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {roomRows.length === 0 ? (
                    <EmptyRow colSpan={7}>Chưa có phòng nào.</EmptyRow>
                  ) : (
                    roomPage.items.map((room) => {
                      const assignedPlan = room.plans?.[0]
                      return (
                        <tr key={room.id}>
                          <Td className="font-medium text-slate-900">{room.name}</Td>
                          <Td>
                            {room.discipline ? (
                              <Pill tone={room.discipline.code === 'YOGA' ? 'green' : room.discipline.code === 'BOXING' ? 'amber' : 'gray'}>
                                {room.discipline.name}
                              </Pill>
                            ) : (
                              <span className="text-slate-400 text-xs">Chung</span>
                            )}
                          </Td>
                          <Td>
                            {assignedPlan ? (
                              <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                {assignedPlan.name}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Chưa gán gói (Trống)</span>
                            )}
                          </Td>
                          <Td className="tabular-nums">{room.capacity} người</Td>
                          <Td>{room.locationNote ?? '—'}</Td>
                          <Td className="tabular-nums">
                            {(equipment.data ?? []).filter((e) => e.roomId === room.id).length}
                          </Td>
                          <Td className="whitespace-nowrap text-right">
                            <Btn size="sm" tone="ghost" onClick={() => setRoomForm(room)}>
                              Sửa
                            </Btn>
                            <Btn
                              size="sm"
                              tone="danger"
                              disabled={disableRoom.isPending}
                              onClick={() =>
                                window.confirm(`Ngừng sử dụng ${room.name}?`) &&
                                disableRoom.mutate(room.id)
                              }
                            >
                              Ngừng dùng
                            </Btn>
                          </Td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </Table>
              <Pagination pager={roomPage.pager} />
            </>
          )}
        </Panel>
      ) : null}

      {tab === 'equipment' ? (
        <Panel>
          {state(equipment) ?? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Thiết bị</Th>
                    <Th>Loại</Th>
                    <Th>Phòng</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentRows.length === 0 ? (
                    <EmptyRow colSpan={4}>Chưa có thiết bị nào.</EmptyRow>
                  ) : (
                    equipmentPage.items.map((item) => (
                      <tr key={item.id}>
                        <Td className="font-medium text-slate-900">{item.name}</Td>
                        <Td className="font-mono text-xs">{item.equipmentType}</Td>
                        <Td>{roomName.get(item.roomId) ?? 'Phòng đã ngừng dùng'}</Td>
                        <Td className="whitespace-nowrap text-right">
                          <Btn size="sm" tone="ghost" onClick={() => setEquipmentForm(item)}>
                            Sửa
                          </Btn>
                          <Btn
                            size="sm"
                            tone="danger"
                            disabled={disableEquipment.isPending}
                            onClick={() =>
                              window.confirm(`Ngừng sử dụng ${item.name}?`) &&
                              disableEquipment.mutate(item.id)
                            }
                          >
                            Ngừng dùng
                          </Btn>
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
              <Pagination pager={equipmentPage.pager} />
            </>
          )}
        </Panel>
      ) : null}

      {tab === 'lockers' ? (
        <Panel
          title={`Trống ${lockerCount('AVAILABLE')}, đang dùng ${lockerCount('OCCUPIED')}, bảo trì ${lockerCount('MAINTENANCE')}`}
          actions={
            <SelectInput
              aria-label="Lọc theo khu"
              className="h-8 w-40 py-1"
              value={zoneFilter}
              onChange={(event) => setZoneFilter(event.target.value)}
            >
              <option value="">Tất cả khu</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {zoneLabel[z]}
                </option>
              ))}
            </SelectInput>
          }
        >
          {state(lockers) ?? (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Số tủ</Th>
                    <Th>Khu</Th>
                    <Th>Trạng thái</Th>
                    <Th className="text-right">Thao tác</Th>
                  </tr>
                </thead>
                <tbody>
                  {lockerRows.length === 0 ? (
                    <EmptyRow colSpan={4}>Chưa có tủ nào.</EmptyRow>
                  ) : (
                    lockerPage.items.map((locker) => (
                      <tr key={locker.id}>
                        <Td className="font-medium tabular-nums text-slate-900">
                          {locker.lockerNumber}
                        </Td>
                        <Td>{zoneLabel[locker.zone] ?? locker.zone}</Td>
                        <Td>
                          <Pill tone={lockerTone[locker.status]}>
                            {lockerStatusLabel[locker.status]}
                          </Pill>
                        </Td>
                        <Td className="text-right">
                          {locker.status === 'OCCUPIED' ? (
                            <div className="flex items-center justify-end gap-3">
                              <div className="text-right">
                                <span className="block text-xs font-semibold text-slate-800">
                                  {locker.currentAssignment?.user.fullName || 'Hội viên'}
                                </span>
                                {locker.currentAssignment?.user.phone && (
                                  <span className="block text-[11px] text-slate-500 tabular-nums">
                                    {locker.currentAssignment.user.phone}
                                  </span>
                                )}
                              </div>
                              <Btn
                                size="sm"
                                disabled={lockerRelease.isPending}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Xác nhận trả tủ ${locker.lockerNumber} hộ hội viên ${locker.currentAssignment?.user.fullName || ''}?`,
                                    )
                                  ) {
                                    lockerRelease.mutate(locker.id)
                                  }
                                }}
                              >
                                Trả tủ hộ
                              </Btn>
                            </div>
                          ) : (
                            <Btn
                              size="sm"
                              disabled={lockerStatus.isPending}
                              onClick={() => lockerStatus.mutate(locker)}
                            >
                              {locker.status === 'MAINTENANCE' ? 'Bảo trì xong' : 'Chuyển bảo trì'}
                            </Btn>
                          )}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
              <Pagination pager={lockerPage.pager} />
            </>
          )}
        </Panel>
      ) : null}

      {roomForm ? (
        <RoomForm
          room={roomForm === 'new' ? null : roomForm}
          onClose={() => setRoomForm(null)}
          onSaved={() => {
            setRoomForm(null)
            invalidate(managerKeys.rooms)()
          }}
        />
      ) : null}
      {equipmentForm ? (
        <EquipmentForm
          item={equipmentForm === 'new' ? null : equipmentForm}
          rooms={roomRows}
          onClose={() => setEquipmentForm(null)}
          onSaved={() => {
            setEquipmentForm(null)
            invalidate(managerKeys.equipment)()
          }}
        />
      ) : null}
      {lockerForm ? (
        <LockerForm
          onClose={() => setLockerForm(false)}
          onSaved={() => {
            setLockerForm(false)
            invalidate(managerKeys.lockers)()
          }}
        />
      ) : null}
    </div>
  )
}

function FormModal({
  title,
  formId,
  pending,
  error,
  onClose,
  onSubmit,
  children,
}: {
  title: string
  formId: string
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: () => void
  children: ReactNode
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form={formId} disabled={pending}>
            {pending ? 'Đang lưu…' : 'Lưu'}
          </Btn>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(event: FormEvent) => {
          event.preventDefault()
          onSubmit()
        }}
        className="space-y-3"
      >
        {children}
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function RoomForm({
  room,
  onClose,
  onSaved,
}: {
  room: Room | null
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const [form, setForm] = useState({
    name: room?.name ?? '',
    capacity: String(room?.capacity ?? 15),
    locationNote: room?.locationNote ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        capacity: Number(form.capacity),
        ...(form.locationNote.trim() ? { locationNote: form.locationNote.trim() } : {}),
      }
      return room ? managerApi.updateRoom(room.id, body) : managerApi.createRoom(body)
    },
    onSuccess: () => {
      showToast('success', 'Thành công', room ? 'Đã lưu thay đổi phòng tập.' : 'Đã thêm phòng tập mới.')
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu phòng tập', msg)
    },
  })
  return (
    <FormModal
      title={room ? `Sửa ${room.name}` : 'Thêm phòng tập'}
      formId="room-form"
      pending={save.isPending}
      error={error}
      onClose={onClose}
      onSubmit={() => save.mutate()}
    >
      <Field label="Tên phòng">
        <TextInput
          required
          maxLength={100}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Sức chứa (người)">
        <TextInput
          type="number"
          required
          min={1}
          max={1000}
          value={form.capacity}
          onChange={(e) => setForm({ ...form, capacity: e.target.value })}
        />
      </Field>
      <Field label="Vị trí">
        <TextInput
          placeholder="Tầng 2, khu B"
          value={form.locationNote}
          onChange={(e) => setForm({ ...form, locationNote: e.target.value })}
        />
      </Field>
    </FormModal>
  )
}

function EquipmentForm({
  item,
  rooms,
  onClose,
  onSaved,
}: {
  item: Equipment | null
  rooms: Room[]
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const [form, setForm] = useState({
    roomId: item?.roomId ?? rooms[0]?.id ?? '',
    name: item?.name ?? '',
    equipmentType: item?.equipmentType ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () => {
      const body = {
        roomId: form.roomId,
        name: form.name.trim(),
        equipmentType: form.equipmentType.trim().toUpperCase(),
      }
      return item ? managerApi.updateEquipment(item.id, body) : managerApi.createEquipment(body)
    },
    onSuccess: () => {
      showToast('success', 'Thành công', item ? 'Đã lưu thay đổi thiết bị.' : 'Đã thêm thiết bị mới.')
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu thiết bị', msg)
    },
  })
  return (
    <FormModal
      title={item ? `Sửa ${item.name}` : 'Thêm thiết bị'}
      formId="equipment-form"
      pending={save.isPending}
      error={error}
      onClose={onClose}
      onSubmit={() => save.mutate()}
    >
      <Field label="Tên thiết bị">
        <TextInput
          required
          maxLength={150}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Loại" hint="Ví dụ GLOVES, TREADMILL, YOGA_MAT.">
        <TextInput
          required
          maxLength={50}
          value={form.equipmentType}
          onChange={(e) => setForm({ ...form, equipmentType: e.target.value })}
        />
      </Field>
      <Field label="Đặt tại phòng">
        <SelectInput
          required
          value={form.roomId}
          onChange={(e) => setForm({ ...form, roomId: e.target.value })}
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </SelectInput>
      </Field>
    </FormModal>
  )
}

function LockerForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useNotification()
  const [form, setForm] = useState({ lockerNumber: '', zone: 'MALE_LOCKER' as LockerZone })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      managerApi.createLocker({ lockerNumber: form.lockerNumber.trim(), zone: form.zone }),
    onSuccess: () => {
      showToast('success', 'Thành công', `Đã thêm tủ đồ số ${form.lockerNumber}.`)
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi thêm tủ đồ', msg)
    },
  })
  return (
    <FormModal
      title="Thêm tủ đồ"
      formId="locker-form"
      pending={save.isPending}
      error={error}
      onClose={onClose}
      onSubmit={() => save.mutate()}
    >
      <Field label="Số tủ" hint="Không trùng với tủ đã có. Ví dụ L-101.">
        <TextInput
          required
          maxLength={20}
          value={form.lockerNumber}
          onChange={(e) => setForm({ ...form, lockerNumber: e.target.value })}
        />
      </Field>
      <Field label="Khu">
        <SelectInput
          value={form.zone}
          onChange={(e) => setForm({ ...form, zone: e.target.value as LockerZone })}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {zoneLabel[z]}
            </option>
          ))}
        </SelectInput>
      </Field>
    </FormModal>
  )
}
