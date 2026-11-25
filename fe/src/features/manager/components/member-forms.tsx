import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import type { InbodyLog, MemberDetail, UserRow } from '../types/manager.types'
import { errorMessage, formatDateTime } from '../lib/format'
import {
  Btn,
  EmptyRow,
  Field,
  FormError,
  Modal,
  Panel,
  StateMessage,
  Table,
  Td,
  TextArea,
  TextInput,
  Th,
  Pagination,
} from './manager-ui'
import { usePagination } from '../lib/use-pagination'

export function CreateMemberForm({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: (member: UserRow) => void
}) {
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      managerApi.createMember({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      }),
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err)),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (form.password.length < 6) return setError('Mật khẩu cần ít nhất 6 ký tự.')
    setError(null)
    save.mutate()
  }
  return (
    <Modal
      title="Đăng ký hội viên tại quầy"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="member-create-form" disabled={save.isPending}>
            {save.isPending ? 'Đang tạo…' : 'Tạo tài khoản'}
          </Btn>
        </>
      }
    >
      <form id="member-create-form" onSubmit={submit} className="space-y-3">
        <Field label="Họ tên">
          <TextInput
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <Field label="Số điện thoại">
          <TextInput
            required
            maxLength={20}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field
          label="Mật khẩu ban đầu"
          hint="Ít nhất 6 ký tự. Hội viên có thể đổi sau khi đăng nhập."
        >
          <TextInput
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

export function EditMemberForm({
  member,
  onClose,
  onSaved,
}: {
  member: MemberDetail
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    fullName: member.fullName,
    phone: member.phone ?? '',
    fitnessGoals: member.memberProfile?.fitnessGoals ?? '',
    medicalHistory: member.memberProfile?.medicalHistory ?? '',
    heightCm: member.memberProfile?.heightCm ? String(Number(member.memberProfile.heightCm)) : '',
  })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      managerApi.updateMember(member.id, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        fitnessGoals: form.fitnessGoals.trim(),
        medicalHistory: form.medicalHistory.trim(),
        ...(form.heightCm ? { heightCm: Number(form.heightCm) } : {}),
      }),
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err)),
  })
  return (
    <Modal
      wide
      title={`Sửa hồ sơ ${member.fullName}`}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="member-edit-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu hồ sơ'}
          </Btn>
        </>
      }
    >
      <form
        id="member-edit-form"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <Field label="Họ tên">
          <TextInput
            required
            maxLength={150}
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
        </Field>
        <Field label="Số điện thoại">
          <TextInput
            maxLength={20}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </Field>
        <Field label="Chiều cao (cm)">
          <TextInput
            type="number"
            min={1}
            max={300}
            step="0.1"
            value={form.heightCm}
            onChange={(e) => setForm({ ...form, heightCm: e.target.value })}
          />
        </Field>
        <div className="hidden sm:block" />
        <Field label="Mục tiêu tập luyện" className="sm:col-span-2">
          <TextArea
            maxLength={4000}
            value={form.fitnessGoals}
            onChange={(e) => setForm({ ...form, fitnessGoals: e.target.value })}
          />
        </Field>
        <Field label="Tiền sử bệnh, chấn thương" className="sm:col-span-2">
          <TextArea
            maxLength={4000}
            value={form.medicalHistory}
            onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  )
}

const ALLOWED_AVATAR = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_AVATAR_BYTES = 3 * 1024 * 1024

export function AvatarButton({
  memberId,
  onUploaded,
}: {
  memberId: string
  onUploaded: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const upload = useMutation({
    mutationFn: (file: File) => managerApi.uploadMemberAvatar(memberId, file),
    onSuccess: () => {
      setError(null)
      onUploaded()
    },
    onError: (err) => setError(errorMessage(err)),
  })
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ALLOWED_AVATAR.join(',')}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          if (!ALLOWED_AVATAR.includes(file.type))
            return setError('Ảnh phải là JPG, PNG, WEBP hoặc GIF.')
          if (file.size > MAX_AVATAR_BYTES) return setError('Ảnh tối đa 3 MB.')
          upload.mutate(file)
        }}
      />
      <Btn size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
        {upload.isPending ? 'Đang tải ảnh…' : 'Đổi ảnh'}
      </Btn>
      {error ? <span className="text-xs text-rose-700">{error}</span> : null}
    </>
  )
}

const num = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === '' ? '—' : String(Number(value))
const editableFor = 24 * 3600_000

export function InbodyPanel({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient()
  const logs = useQuery({
    queryKey: managerKeys.inbody(memberId),
    queryFn: () => managerApi.inbody(memberId),
  })
  const [editing, setEditing] = useState<InbodyLog | 'new' | null>(null)
  const rows = [...(logs.data ?? [])].reverse()
  const { items: pageRows, pager } = usePagination(rows, 10)
  // eslint-disable-next-line react-hooks/purity -- edit window only needs to be correct when the list renders
  const now = Date.now()
  return (
    <Panel
      title="Chỉ số InBody"
      actions={
        <Btn size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" />
          Nhập kết quả đo
        </Btn>
      }
    >
      {logs.isLoading || logs.isError ? (
        <StateMessage
          loading={logs.isLoading}
          error={logs.isError ? errorMessage(logs.error) : null}
          onRetry={() => void logs.refetch()}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Ngày đo</Th>
              <Th className="text-right">Cân nặng</Th>
              <Th className="text-right">Cơ</Th>
              <Th className="text-right">Mỡ</Th>
              <Th className="text-right">BMI</Th>
              <Th className="text-right">Mỡ nội tạng</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={7}>Chưa có kết quả đo nào.</EmptyRow>
            ) : (
              pageRows.map((log) => (
                <tr key={log.id}>
                  <Td className="whitespace-nowrap">{formatDateTime(log.measuredAt)}</Td>
                  <Td className="text-right tabular-nums">{num(log.weightKg)} kg</Td>
                  <Td className="text-right tabular-nums">{num(log.muscleMassKg)} kg</Td>
                  <Td className="text-right tabular-nums">{num(log.bodyFatPct)}%</Td>
                  <Td className="text-right tabular-nums">{num(log.bmi)}</Td>
                  <Td className="text-right tabular-nums">{num(log.visceralFatLevel)}</Td>
                  <Td className="text-right">
                    {now - new Date(log.measuredAt).getTime() <= editableFor ? (
                      <Btn size="sm" tone="ghost" onClick={() => setEditing(log)}>
                        Sửa
                      </Btn>
                    ) : null}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </Table>
      )}
      <Pagination pager={pager} note="Kết quả chỉ sửa được trong 24 giờ sau khi đo." />
      {editing ? (
        <InbodyForm
          memberId={memberId}
          log={editing === 'new' ? null : editing}
          lastHeight={logs.data?.at(-1)?.heightCm}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.inbody(memberId) })
          }}
        />
      ) : null}
    </Panel>
  )
}

function InbodyForm({
  memberId,
  log,
  lastHeight,
  onClose,
  onSaved,
}: {
  memberId: string
  log: InbodyLog | null
  lastHeight?: string | number
  onClose: () => void
  onSaved: () => void
}) {
  const str = (value: string | number | null | undefined) =>
    value === null || value === undefined ? '' : String(Number(value))
  const [form, setForm] = useState({
    heightCm: str(log?.heightCm ?? lastHeight),
    weightKg: str(log?.weightKg),
    muscleMassKg: str(log?.muscleMassKg),
    bodyFatPct: str(log?.bodyFatPct),
    bmi: str(log?.bmi),
    visceralFatLevel: str(log?.visceralFatLevel),
    notes: log?.notes ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const optional = (value: string) => (value === '' ? undefined : Number(value))
  const save = useMutation({
    mutationFn: () => {
      const body = {
        userId: memberId,
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        muscleMassKg: optional(form.muscleMassKg),
        bodyFatPct: optional(form.bodyFatPct),
        bmi: optional(form.bmi),
        visceralFatLevel: optional(form.visceralFatLevel),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      }
      return log ? managerApi.updateInbody(log.id, body) : managerApi.createInbody(body)
    },
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err)),
  })
  const field = (
    key: keyof typeof form,
    label: string,
    props: { min?: number; max?: number; step?: string; required?: boolean },
  ) => (
    <Field label={label}>
      <TextInput
        type="number"
        {...props}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </Field>
  )
  return (
    <Modal
      wide
      title={log ? 'Sửa kết quả InBody' : 'Nhập kết quả InBody'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="inbody-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu kết quả'}
          </Btn>
        </>
      }
    >
      <form
        id="inbody-form"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
        className="grid gap-3 sm:grid-cols-3"
      >
        {field('heightCm', 'Chiều cao (cm)', { min: 1, max: 300, step: '0.1', required: true })}
        {field('weightKg', 'Cân nặng (kg)', { min: 1, max: 500, step: '0.1', required: true })}
        {field('muscleMassKg', 'Khối lượng cơ (kg)', { min: 0, max: 500, step: '0.1' })}
        {field('bodyFatPct', 'Tỷ lệ mỡ (%)', { min: 0, max: 100, step: '0.1' })}
        {field('bmi', 'BMI', { min: 0, max: 100, step: '0.1' })}
        {field('visceralFatLevel', 'Mỡ nội tạng (mức)', { min: 0, step: '1' })}
        <Field label="Ghi chú" className="sm:col-span-3">
          <TextArea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-3">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  )
}
