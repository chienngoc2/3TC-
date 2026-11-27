import { useState, useEffect, useMemo, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Copy, Check, CheckCircle2, Tag, Trash2, AlertCircle } from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import { useNotification } from '@/context/notification-context'
import type { StaffRole, UserRow } from '../types/manager.types'
import { errorMessage, formatDate, roleLabel } from '../lib/format'
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
import { cn } from '@/lib/utils'

type Filter = 'ALL' | StaffRole

export function ManagerStaffPage() {
  const queryClient = useQueryClient()
  const { showToast } = useNotification()
  const staff = useQuery({ queryKey: managerKeys.staff, queryFn: managerApi.staff })
  const [filter, setFilter] = useState<Filter>('ALL')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null)
  const [starEditingCoach, setStarEditingCoach] = useState<UserRow | null>(null)
  const [starValue, setStarValue] = useState(3)
  const [actionError, setActionError] = useState<string | null>(null)
  const [isTopicRequestsModalOpen, setIsTopicRequestsModalOpen] = useState(false)

  const topicRequestsQuery = useQuery({
    queryKey: managerKeys.topicRequests(),
    queryFn: () => managerApi.topicRequests(),
  })
  const pendingTopicRequestsCount = useMemo(() => {
    return (topicRequestsQuery.data || []).filter((r: any) => r.status === 'PENDING').length
  }, [topicRequestsQuery.data])

  const reviewTopicRequestMutation = useMutation({
    mutationFn: ({ id, action, rejectionReason }: { id: string; action: 'APPROVE' | 'REJECT'; rejectionReason?: string }) =>
      managerApi.reviewTopicRequest(id, { action, rejectionReason }),
    onSuccess: (_, vars) => {
      showToast(
        'success',
        vars.action === 'APPROVE' ? 'Đã phê duyệt' : 'Đã từ chối',
        vars.action === 'APPROVE'
          ? 'Đã cấp phép chuyên đề mới cho Huấn luyện viên thành công.'
          : 'Đã từ chối yêu cầu chuyên đề của HLV.',
      )
      void queryClient.invalidateQueries({ queryKey: managerKeys.topicRequests() })
      void queryClient.invalidateQueries({ queryKey: managerKeys.staff })
      void queryClient.invalidateQueries({ queryKey: managerKeys.specialties })
    },
    onError: (err) => {
      showToast('error', 'Lỗi xử lý yêu cầu', errorMessage(err))
    },
  })

  const updateStarMutation = useMutation({
    mutationFn: ({ coachId, stars }: { coachId: string; stars: number }) =>
      managerApi.updateCoachRating(coachId, stars),
    onSuccess: () => {
      setStarEditingCoach(null)
      showToast('success', 'Thành công', 'Đã cập nhật số sao đánh giá cho HLV.')
      void queryClient.invalidateQueries({ queryKey: managerKeys.staff })
    },
    onError: (error) => {
      const msg = errorMessage(error)
      setActionError(msg)
      showToast('error', 'Lỗi cập nhật sao', msg)
    },
  })

  const toggle = useMutation({
    mutationFn: (user: UserRow) =>
      user.isActive
        ? managerApi.disableStaff(user.id)
        : managerApi.updateStaff(user.id, { isActive: true }),
    onSuccess: (_, user) => {
      setActionError(null)
      showToast('success', 'Thành công', `Đã ${user.isActive ? 'vô hiệu hóa' : 'kích hoạt'} tài khoản ${user.fullName}.`)
      void queryClient.invalidateQueries({ queryKey: managerKeys.staff })
    },
    onError: (error) => {
      const msg = errorMessage(error)
      setActionError(msg)
      showToast('error', 'Lỗi thao tác tài khoản', msg)
    },
  })

  const rows = staff.data ?? []
  const term = search.trim().toLowerCase()
  const visible = rows.filter(
    (user) =>
      (filter === 'ALL' || user.role === filter) &&
      (!term ||
        user.fullName.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        (user.phone ?? '').includes(term)),
  )

  const { items: pageRows, pager } = usePagination(visible, 10, `${filter}|${term}`)

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Nhân sự"
        description="Tài khoản lễ tân và huấn luyện viên của trung tâm."
        actions={
          <div className="flex items-center gap-2">
            <Btn tone="secondary" onClick={() => setIsTopicRequestsModalOpen(true)}>
              <Tag className="h-4 w-4 text-emerald-600" />
              <span>Duyệt chuyên đề HLV</span>
              {pendingTopicRequestsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                  {pendingTopicRequestsCount}
                </span>
              )}
            </Btn>
            <Btn tone="primary" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              <span>Thêm nhân viên</span>
            </Btn>
          </div>
        }
      />
      <Tabs
        value={filter}
        onChange={setFilter}
        items={[
          { value: 'ALL', label: 'Tất cả', count: rows.length },
          {
            value: 'RECEPTIONIST',
            label: 'Lễ tân',
            count: rows.filter((u) => u.role === 'RECEPTIONIST').length,
          },
          {
            value: 'COACH',
            label: 'Huấn luyện viên',
            count: rows.filter((u) => u.role === 'COACH').length,
          },
        ]}
      />
      <Panel
        title={`${visible.length} nhân viên`}
        actions={
          <TextInput
            type="search"
            aria-label="Tìm nhân viên"
            placeholder="Tìm theo tên, email, SĐT"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 w-64 py-1"
          />
        }
      >
        <FormError inset>{actionError}</FormError>
        {staff.isLoading || staff.isError ? (
          <StateMessage
            loading={staff.isLoading}
            error={staff.isError ? errorMessage(staff.error) : null}
            onRetry={() => void staff.refetch()}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Họ tên</Th>
                  <Th>Vai trò</Th>
                  <Th>Hạng sao &amp; Thù lao</Th>
                  <Th>Liên hệ</Th>
                  <Th>Ngày tạo</Th>
                  <Th>Trạng thái</Th>
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <EmptyRow colSpan={7}>Không có nhân viên phù hợp.</EmptyRow>
                ) : (
                  pageRows.map((user) => (
                    <tr key={user.id}>
                      <Td className="font-medium text-slate-900">{user.fullName}</Td>
                      <Td>{roleLabel[user.role]}</Td>
                      <Td>
                        {user.role === 'COACH' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setStarValue(user.coachProfile?.ratingStars || 3)
                              setStarEditingCoach(user)
                            }}
                            className="group flex flex-col gap-0.5 text-left p-1 rounded hover:bg-slate-50 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                            title="Bấm để chỉnh sửa số sao & thù lao"
                          >
                            <span className="font-extrabold text-amber-500 flex items-center gap-1 text-xs">
                              {'★'.repeat(user.coachProfile?.ratingStars || 3)}
                              <span className="text-slate-800 font-bold ml-1 group-hover:text-amber-600 underline decoration-dashed">
                                {user.coachProfile?.ratingStars || 3} sao
                              </span>
                            </span>
                            <span className="text-[11px] text-slate-600 font-semibold">
                              {((user.coachProfile?.ratingStars || 3) * 1000).toLocaleString('vi-VN')} đ/buổi
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </Td>
                      <Td>
                        <div>{user.email}</div>
                        <div className="text-xs text-slate-400">{user.phone}</div>
                      </Td>
                      <Td>{formatDate(user.createdAt)}</Td>
                      <Td>
                        {user.isActive ? <Pill tone="green">Đang làm</Pill> : <Pill>Đã khóa</Pill>}
                      </Td>
                      <Td className="whitespace-nowrap text-right">
                        {user.role === 'COACH' && (
                          <Btn
                            size="sm"
                            tone="ghost"
                            onClick={() => {
                              setStarValue(user.coachProfile?.ratingStars || 3)
                              setStarEditingCoach(user)
                            }}
                            className="mr-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          >
                            Cập nhật sao
                          </Btn>
                        )}
                        <Btn size="sm" tone="ghost" onClick={() => setEditing(user)}>
                          Sửa
                        </Btn>
                        <Btn
                          size="sm"
                          tone={user.isActive ? 'danger' : 'secondary'}
                          disabled={toggle.isPending}
                          onClick={() => {
                            if (
                              !user.isActive ||
                              window.confirm(
                                `Khóa tài khoản ${user.fullName}? Người này sẽ bị đăng xuất ngay.`,
                              )
                            )
                              toggle.mutate(user)
                          }}
                        >
                          {user.isActive ? 'Khóa' : 'Mở khóa'}
                        </Btn>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
            <Pagination pager={pager} />
          </>
        )}
      </Panel>
      {editing ? (
        <StaffForm
          user={editing === 'new' ? null : editing}
          existingUsers={rows}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.staff })
          }}
        />
      ) : null}
      {starEditingCoach ? (
        <Modal
          title={`Cập nhật số sao HLV: ${starEditingCoach.fullName}`}
          onClose={() => setStarEditingCoach(null)}
        >
          <div className="space-y-4 p-1">
            <p className="text-xs text-slate-600">
              Cập nhật xếp hạng số sao cho HLV. 
              <strong>1 sao = 1.000 đ / buổi</strong>.
            </p>
            <Field label="Bậc HLV & Thù lao tương ứng">
              <SelectInput
                value={String(starValue)}
                onChange={(e) => setStarValue(Number(e.target.value))}
              >
                <option value="1">1 sao — 1.000 đ / ca</option>
                <option value="2">2 sao — 2.000 đ / ca</option>
                <option value="3">3 sao — 3.000 đ / ca</option>
                <option value="4">4 sao — 4.000 đ / ca</option>
                <option value="5">5 sao — 5.000 đ / ca</option>
              </SelectInput>
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Btn tone="secondary" onClick={() => setStarEditingCoach(null)}>
                Hủy
              </Btn>
              <Btn
                tone="primary"
                disabled={updateStarMutation.isPending}
                onClick={() => {
                  updateStarMutation.mutate({
                    coachId: starEditingCoach.id,
                    stars: starValue,
                  })
                }}
              >
                {updateStarMutation.isPending ? 'Đang lưu...' : 'Lưu xếp hạng'}
              </Btn>
            </div>
          </div>
        </Modal>
      ) : null}

      {isTopicRequestsModalOpen && (
        <Modal
          title="Duyệt yêu cầu dạy chuyên đề của HLV"
          onClose={() => setIsTopicRequestsModalOpen(false)}
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto p-1">
            <p className="text-xs text-slate-600">
              Danh sách Huấn luyện viên gửi yêu cầu xin phụ trách / giảng dạy thêm các chuyên đề khóa học lớp nhóm mới.
            </p>

            {topicRequestsQuery.isLoading ? (
              <div className="p-8 text-center text-xs text-slate-500">Đang tải danh sách yêu cầu...</div>
            ) : (topicRequestsQuery.data || []).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                Chưa có yêu cầu xin dạy chuyên đề nào từ Huấn luyện viên.
              </div>
            ) : (
              <div className="space-y-3">
                {(topicRequestsQuery.data || []).map((req: any) => {
                  const isPending = req.status === 'PENDING'
                  const isApproved = req.status === 'APPROVED'
                  return (
                    <div
                      key={req.id}
                      className={cn(
                        'p-4 rounded-lg border text-xs space-y-2.5 transition-all',
                        isPending
                          ? 'bg-amber-50/40 border-amber-300/80 shadow-2xs'
                          : isApproved
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : 'bg-slate-50 border-slate-200 opacity-70',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900">{req.coach?.fullName}</span>
                            <span className="text-[11px] text-slate-500 font-medium">({req.coach?.phone || req.coach?.email})</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#17664e] text-white">
                              {req.specialty?.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                              {req.specialty?.discipline?.name}
                            </span>
                          </div>
                        </div>

                        <div>
                          {isPending ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Đang chờ duyệt
                            </span>
                          ) : isApproved ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Đã phê duyệt
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                              ✕ Từ chối
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-slate-200/80 space-y-1">
                        <div className="text-[11px] font-semibold text-slate-700">Lý do &amp; Kinh nghiệm chuyên môn:</div>
                        <p className="text-[11.5px] text-slate-600 leading-relaxed font-normal">{req.reason}</p>
                        {req.certificateUrl && (
                          <div className="pt-1">
                            <a
                              href={req.certificateUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[#17664e] hover:underline font-semibold text-[11px] inline-flex items-center gap-1"
                            >
                              Xem chứng chỉ đính kèm ↗
                            </a>
                          </div>
                        )}
                        {!isPending && req.rejectionReason && (
                          <p className="text-[11px] text-rose-600 italic pt-1">
                            Lý do từ chối: {req.rejectionReason}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400">
                          Gửi lúc: {new Date(req.createdAt).toLocaleString('vi-VN')}
                          {req.reviewedBy && ` · Người duyệt: ${req.reviewedBy.fullName}`}
                        </span>

                        {isPending && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={reviewTopicRequestMutation.isPending}
                              onClick={() => {
                                const reason = window.prompt('Nhập lý do từ chối (tùy chọn):')
                                if (reason !== null) {
                                  reviewTopicRequestMutation.mutate({
                                    id: req.id,
                                    action: 'REJECT',
                                    rejectionReason: reason || undefined,
                                  })
                                }
                              }}
                              className="px-2.5 py-1 rounded text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              disabled={reviewTopicRequestMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Xác nhận cấp phép cho HLV ${req.coach?.fullName} giảng dạy chuyên đề "${req.specialty?.name}"?`)) {
                                  reviewTopicRequestMutation.mutate({
                                    id: req.id,
                                    action: 'APPROVE',
                                  })
                                }
                              }}
                              className="px-3 py-1 rounded text-xs font-bold text-white bg-[#17664e] hover:bg-[#007360] shadow-2xs transition-colors cursor-pointer"
                            >
                              Phê duyệt cấp phép
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <Btn tone="secondary" onClick={() => setIsTopicRequestsModalOpen(false)}>
                Đóng
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function generateCoachSystemEmail(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const random4 = Math.floor(1000 + Math.random() * 9000)
  return `${slug || 'hlv'}${random4}@gmail.com`
}

function generateRandom8DigitPassword(): string {
  return Math.floor(10000000 + Math.random() * 90000000).toString()
}

const ALL_SCHEDULE_DAYS = [
  { code: 'MONDAY', label: 'Thứ 2' },
  { code: 'TUESDAY', label: 'Thứ 3' },
  { code: 'WEDNESDAY', label: 'Thứ 4' },
  { code: 'THURSDAY', label: 'Thứ 5' },
  { code: 'FRIDAY', label: 'Thứ 6' },
  { code: 'SATURDAY', label: 'Thứ 7' },
  { code: 'SUNDAY', label: 'Chủ Nhật' },
]

const SCHEDULE_HOUR_LIST = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00'
]

function StaffForm({
  user,
  existingUsers = [],
  onClose,
  onSaved,
}: {
  user: UserRow | null
  existingUsers?: UserRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const specialties = useQuery({
    queryKey: managerKeys.specialties,
    queryFn: managerApi.specialties,
  })
  const activeSpecialties = useMemo(() => {
    return (specialties.data ?? []).filter(
      (s) => s.code !== 'SPEC_YOG_AS' && s.code !== 'SPEC_BOX_KB',
    )
  }, [specialties.data])
  const [selectedSpecialtyIds, setSelectedSpecialtyIds] = useState<string[]>(() => {
    if (!user) return []
    const rawSpecs = (user as any).coachProfile?.coachSpecialties || []
    return rawSpecs.map((s: any) => s.specialtyId || s.specialty?.id).filter(Boolean)
  })

  const selectedDiscCodes = useMemo(() => {
    const set = new Set<string>()
    for (const sid of selectedSpecialtyIds) {
      const spec = activeSpecialties.find((s) => s.id === sid)
      const code = spec?.discipline?.code?.toUpperCase()
      if (code) set.add(code)
    }
    return set
  }, [selectedSpecialtyIds, activeSpecialties])

  const isSpecialtyIncompatible = (discCode?: string) => {
    const code = (discCode || '').toUpperCase()
    if (!code) return false
    if (selectedDiscCodes.size === 0) return false
    // Quy định: HLV chỉ thuộc 1 bộ môn duy nhất. Chọn bộ môn nào sẽ khóa tất cả các bộ môn khác.
    return !selectedDiscCodes.has(code)
  }

  const toggleSpecialty = (id: string) => {
    const target = activeSpecialties.find((s) => s.id === id)
    if (!selectedSpecialtyIds.includes(id) && isSpecialtyIncompatible(target?.discipline?.code)) {
      return
    }
    setSelectedSpecialtyIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    )
  }
  const [form, setForm] = useState({
    fullName: user?.fullName ?? '',
    role: (user?.role === 'COACH' ? 'COACH' : 'RECEPTIONIST') as StaffRole,
  })

  // Personal email (to receive credentials) & auto-generated system credentials
  const [personalEmail, setPersonalEmail] = useState('')
  const [systemEmail, setSystemEmail] = useState(() => (user ? user.email : ''))
  const [password, setPassword] = useState(() => (user ? '' : generateRandom8DigitPassword()))

  // Check duplicate personal email against existing users
  const normalizedPersonalEmail = personalEmail.trim().toLowerCase()
  const duplicateUser = useMemo(() => {
    if (user || !normalizedPersonalEmail) return null
    return (
      existingUsers.find(
        (u) =>
          u.email?.toLowerCase() === normalizedPersonalEmail ||
          (u as any).coachProfile?.bio?.toLowerCase().includes(normalizedPersonalEmail),
      ) || null
    )
  }, [user, existingUsers, normalizedPersonalEmail])

  // Rate per session (default 1.000 VNĐ = 1 star)
  const [ratePerSession, setRatePerSession] = useState<number>(() => Number(user?.coachProfile?.ratePerSession) || 1000)

  // Copy status in success modal
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)

  // Created credentials modal
  const [createdInfo, setCreatedInfo] = useState<{
    fullName: string
    systemEmail: string
    password: string
    personalEmail: string
    ratePerSession?: number
  } | null>(null)

  // Auto-generate system email as fullName changes
  useEffect(() => {
    if (!user && form.fullName.trim()) {
      setSystemEmail(generateCoachSystemEmail(form.fullName))
    }
  }, [user, form.fullName])

  // Star calculation: 1.000 VNĐ = 1 sao, 2.000 VNĐ = 2 sao... up to 5 sao
  const calcStars = (rate: number): number => {
    if (!rate || rate <= 0) return 1
    if (rate <= 10000) return Math.min(5, Math.max(1, Math.round(rate / 1000)))
    return Math.min(5, Math.max(1, Math.round(rate / 100000)))
  }

  // Working days and per-day schedule matching coach availability
  const [workingDays, setWorkingDays] = useState<string[]>([
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ])
  const [activeDayCode, setActiveDayCode] = useState<string>('MONDAY')

  const [daySchedules, setDaySchedules] = useState<Record<string, Array<{ start: string; end: string }>>>({
    MONDAY: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
    TUESDAY: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
    WEDNESDAY: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
    THURSDAY: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
    FRIDAY: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
    SATURDAY: [{ start: '08:00', end: '12:00' }, { start: '14:00', end: '18:00' }],
    SUNDAY: [{ start: '08:00', end: '12:00' }],
  })

  const [error, setError] = useState<string | null>(null)

  const getMinutesForDay = (dayCode: string) => {
    const list = daySchedules[dayCode] || []
    let mins = 0
    for (const wh of list) {
      const [sh, sm] = (wh.start || '08:00').split(':').map(Number)
      const [eh, em] = (wh.end || '12:00').split(':').map(Number)
      const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))
      if (diff > 0) mins += diff
    }
    return mins
  }

  const copyDayScheduleToAll = () => {
    const currentIntervals = daySchedules[activeDayCode] || []
    const activeLabel = ALL_SCHEDULE_DAYS.find((d) => d.code === activeDayCode)?.label || activeDayCode
    setDaySchedules((prev) => {
      const next = { ...prev }
      for (const d of workingDays) {
        next[d] = JSON.parse(JSON.stringify(currentIntervals))
      }
      return next
    })
    showToast('info', 'Đã sao chép', `Đã sao chép khung giờ ${activeLabel} sang các thứ khác đã chọn.`)
  }

  const addShiftForActiveDay = () => {
    const curList = daySchedules[activeDayCode] || []
    const curMins = getMinutesForDay(activeDayCode)
    if (curMins >= 8 * 60) {
      const activeLabel = ALL_SCHEDULE_DAYS.find((d) => d.code === activeDayCode)?.label || activeDayCode
      showToast('error', 'Giới hạn ca', `Tổng thời gian của ${activeLabel} đã đạt mức tối đa 8h/ngày.`)
      return
    }
    const remainingHours = Math.max(1, Math.min(4, 8 - Math.floor(curMins / 60)))
    let nextStartH = 14
    if (curList.length > 0) {
      const lastEnd = curList[curList.length - 1].end || '12:00'
      const [eh] = lastEnd.split(':').map(Number)
      nextStartH = Math.min(21, Math.max(6, eh))
    }
    const nextEndH = Math.min(22, nextStartH + remainingHours)
    const nextStart = `${String(nextStartH).padStart(2, '0')}:00`
    const nextEnd = `${String(nextEndH).padStart(2, '0')}:00`

    setDaySchedules((prev) => ({
      ...prev,
      [activeDayCode]: [...(prev[activeDayCode] || []), { start: nextStart, end: nextEnd }],
    }))
  }

  const removeShift = (idx: number) => {
    setDaySchedules((prev) => ({
      ...prev,
      [activeDayCode]: (prev[activeDayCode] || []).filter((_, i) => i !== idx),
    }))
  }

  const updateShiftStart = (idx: number, newStart: string) => {
    setDaySchedules((prev) => ({
      ...prev,
      [activeDayCode]: (prev[activeDayCode] || []).map((item, i) =>
        i === idx ? { ...item, start: newStart } : item
      ),
    }))
  }

  const updateShiftEnd = (idx: number, newEnd: string) => {
    setDaySchedules((prev) => ({
      ...prev,
      [activeDayCode]: (prev[activeDayCode] || []).map((item, i) =>
        i === idx ? { ...item, end: newEnd } : item
      ),
    }))
  }

  const save = useMutation({
    mutationFn: async () => {
      const derivedStars = calcStars(ratePerSession)
      const randomPhone = user?.phone || `09${Math.floor(10000000 + Math.random() * 90000000)}`

      if (user) {
        if (form.role === 'COACH' || user.role === 'COACH') {
          if (selectedSpecialtyIds.length > 0) {
            await managerApi.assignSpecialties(user.id, selectedSpecialtyIds)
          }
        }
        return managerApi.updateStaff(user.id, {
          fullName: form.fullName.trim(),
          phone: randomPhone,
          ...(password ? { password } : {}),
          ...(form.role === 'COACH' || user.role === 'COACH'
            ? {
              ratingStars: derivedStars,
            }
            : {}),
        })
      }

      const flatWorkingHours: Array<{ day: string; shift: string; from: string; to: string }> = []
      for (const dayCode of workingDays) {
        const intervals = daySchedules[dayCode] || [{ start: '08:00', end: '12:00' }]
        intervals.forEach((interval, idx) => {
          flatWorkingHours.push({
            day: dayCode,
            shift: `Ca ${idx + 1}`,
            from: interval.start,
            to: interval.end,
          })
        })
      }

      return managerApi.createStaff({
        fullName: form.fullName.trim(),
        email: systemEmail.trim().toLowerCase(),
        personalEmail: personalEmail.trim().toLowerCase(),
        phone: randomPhone,
        role: form.role,
        password,
        ratePerSession: form.role === 'COACH' ? ratePerSession : undefined,
        ratingStars: form.role === 'COACH' ? derivedStars : undefined,
        specialtyIds: form.role === 'COACH' && selectedSpecialtyIds.length > 0 ? selectedSpecialtyIds : undefined,
        workingDays: workingDays.length > 0 ? workingDays : undefined,
        workingHours: flatWorkingHours.length > 0 ? flatWorkingHours : undefined,
      })
    },
    onSuccess: (data: any) => {
      showToast('success', 'Thành công', user ? 'Đã cập nhật thông tin nhân sự.' : 'Đã thêm mới nhân sự thành công.')
      if (!user) {
        setCreatedInfo({
          fullName: form.fullName.trim(),
          systemEmail: (data?.email || systemEmail).toLowerCase(),
          password,
          personalEmail: personalEmail.trim().toLowerCase(),
          ratePerSession: form.role === 'COACH' ? ratePerSession : undefined,
        })
        onSaved()
      } else {
        onSaved()
        onClose()
      }
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu thông tin', msg)
    },
  })

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!form.fullName.trim()) return setError('Vui lòng nhập họ tên nhân viên / HLV.')
    if (!user && !personalEmail.trim())
      return setError('Vui lòng nhập Gmail cá nhân của nhân viên để nhận thông tin tài khoản.')
    if (!user && duplicateUser) {
      const roleText = duplicateUser.role === 'COACH' ? 'Huấn luyện viên' : 'Nhân sự'
      return setError(
        `Gmail cá nhân "${personalEmail}" đã từng được sử dụng để tạo tài khoản cho ${roleText} "${duplicateUser.fullName}". Vui lòng nhập Gmail khác.`,
      )
    }
    if (!user && !systemEmail.trim()) return setError('Vui lòng tạo tài khoản hệ thống cho HLV.')
    if ((!user || password) && password.length < 8)
      return setError('Mật khẩu cần ít nhất 8 ký tự.')

    if (form.role === 'COACH' || user?.role === 'COACH') {
      if (selectedSpecialtyIds.length === 0) {
        return setError('Vui lòng chọn ít nhất 1 bộ môn / chuyên môn đảm nhiệm cho Huấn luyện viên.')
      }
    }

    if (!user && form.role === 'COACH') {
      if (ratePerSession < 1000 || ratePerSession > 5000) {
        return setError('Lương theo buổi dạy chỉ được nhập từ 1.000 đến 5.000 VNĐ.')
      }
      if (workingDays.length === 0) {
        return setError('Vui lòng chọn ít nhất 1 thứ làm việc trong tuần cho HLV.')
      }

      for (const dayCode of workingDays) {
        if (getMinutesForDay(dayCode) > 8 * 60) {
          const label = ALL_SCHEDULE_DAYS.find((d) => d.code === dayCode)?.label || dayCode
          return setError(`Khung giờ làm việc của ${label} vượt quá 8 giờ/ngày theo quy định trung tâm.`)
        }
        const intervals = daySchedules[dayCode] || []
        if (intervals.length === 0) {
          const label = ALL_SCHEDULE_DAYS.find((d) => d.code === dayCode)?.label || dayCode
          return setError(`Vui lòng thêm ít nhất 1 ca làm việc cho ${label}.`)
        }
        for (const interval of intervals) {
          const [sh] = interval.start.split(':').map(Number)
          const [eh] = interval.end.split(':').map(Number)
          if (eh <= sh) {
            const label = ALL_SCHEDULE_DAYS.find((d) => d.code === dayCode)?.label || dayCode
            return setError(`Khung giờ làm việc của ${label} có giờ kết thúc phải sau giờ bắt đầu.`)
          }
        }
      }
    }

    setError(null)
    save.mutate()
  }

  const COACH_TIERS = [
    { level: 1, rate: 1000, label: '1 sao — 1.000 đ / ca' },
    { level: 2, rate: 2000, label: '2 sao — 2.000 đ / ca' },
    { level: 3, rate: 3000, label: '3 sao — 3.000 đ / ca' },
    { level: 4, rate: 4000, label: '4 sao — 4.000 đ / ca' },
    { level: 5, rate: 5000, label: '5 sao — 5.000 đ / ca' },
  ]

  const copyToClipboard = (text: string, type: 'email' | 'pass' | 'all') => {
    navigator.clipboard.writeText(text)
    if (type === 'email') {
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    } else if (type === 'pass') {
      setCopiedPass(true)
      setTimeout(() => setCopiedPass(false), 2000)
    }
    showToast('info', 'Đã sao chép', 'Đã lưu thông tin vào bộ nhớ tạm.')
  }

  // If newly created, show credentials modal
  if (createdInfo) {
    const fullSummary = `THÔNG TIN TÀI KHOẢN NHÂN SỰ:\n- Họ tên: ${createdInfo.fullName}\n- Tài khoản hệ thống: ${createdInfo.systemEmail}\n- Mật khẩu đăng nhập: ${createdInfo.password}\n- Gmail cá nhân: ${createdInfo.personalEmail}${createdInfo.ratePerSession ? `\n- Lương theo buổi: ${createdInfo.ratePerSession.toLocaleString('vi-VN')} đ/buổi` : ''}`
    return (
      <Modal
        title="Tài khoản nhân sự đã sẵn sàng"
        wide
        className="max-w-xl w-full"
        onClose={onClose}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Btn
              tone="secondary"
              onClick={() => copyToClipboard(fullSummary, 'all')}
              className="rounded-lg px-4 py-2 text-xs font-medium"
            >
              <Copy className="w-4 h-4" strokeWidth={1.5} />
              <span>Sao chép toàn bộ</span>
            </Btn>
            <Btn
              tone="primary"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-xs font-semibold bg-[#17664e] hover:bg-[#135641] text-white"
            >
              Hoàn tất
            </Btn>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#17664e] shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="space-y-0.5">
              <h4 className="font-semibold text-slate-900 text-sm">
                Đã cấp tài khoản cho {createdInfo.fullName}
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Thông tin đăng nhập đã được gửi tới email cá nhân{' '}
                <span className="font-medium text-slate-900">{createdInfo.personalEmail}</span>.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-200/80 bg-slate-50/70 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
              <span className="font-medium text-slate-500">Tài khoản đăng nhập</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs">
                  {createdInfo.systemEmail}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdInfo.systemEmail, 'email')}
                  className="p-1.5 rounded-md hover:bg-slate-200/70 text-slate-600 transition-colors cursor-pointer"
                  title="Sao chép email"
                >
                  {copiedEmail ? (
                    <Check className="w-4 h-4 text-[#17664e]" strokeWidth={1.5} />
                  ) : (
                    <Copy className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
              <span className="font-medium text-slate-500">Mật khẩu tạm (8 số)</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 text-xs tabular-nums">
                  {createdInfo.password}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdInfo.password, 'pass')}
                  className="p-1.5 rounded-md hover:bg-slate-200/70 text-slate-600 transition-colors cursor-pointer"
                  title="Sao chép mật khẩu"
                >
                  {copiedPass ? (
                    <Check className="w-4 h-4 text-[#17664e]" strokeWidth={1.5} />
                  ) : (
                    <Copy className="w-4 h-4" strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>

            {createdInfo.ratePerSession ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3 text-xs">
                <span className="font-medium text-slate-500">Thù lao theo buổi</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {createdInfo.ratePerSession.toLocaleString('vi-VN')} đ / buổi
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </Modal>
    )
  }

  const isCoachForm = form.role === 'COACH' || user?.role === 'COACH'

  return (
    <Modal
      title={user ? `Sửa nhân sự: ${user.fullName}` : 'Thêm nhân viên mới'}
      wide={isCoachForm}
      className={cn('w-full', isCoachForm ? 'max-w-5xl' : 'max-w-lg')}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Btn
            onClick={onClose}
            tone="ghost"
            className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer"
          >
            Hủy
          </Btn>
          <Btn
            tone="primary"
            type="submit"
            form="staff-form"
            disabled={save.isPending}
            className="px-5 py-2 rounded-lg text-xs font-semibold bg-[#17664e] hover:bg-[#135641] text-white cursor-pointer"
          >
            {save.isPending ? 'Đang lưu…' : user ? 'Lưu thay đổi' : 'Tạo tài khoản'}
          </Btn>
        </div>
      }
    >
      <form id="staff-form" onSubmit={submit} className="space-y-5">
        <div
          className={cn(
            'grid grid-cols-1 gap-6 items-start',
            isCoachForm && 'lg:grid-cols-[1fr_1.15fr] lg:gap-8',
          )}
        >
          {/* CỘT 1: THÔNG TIN CÁ NHÂN & TÀI KHOẢN */}
          <div className="space-y-4">
            <div className="pb-2 border-b border-slate-200/80">
              <h3 className="text-sm font-semibold text-slate-900">Thông tin nhân sự</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Hồ sơ cơ bản và phân quyền chuyên môn
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Họ và tên">
                <TextInput
                  required
                  maxLength={150}
                  placeholder="Nguyễn Văn Nam"
                  value={form.fullName}
                  onChange={set('fullName')}
                  className="rounded-lg px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Vai trò">
                <SelectInput
                  disabled={!!user}
                  value={form.role}
                  onChange={set('role')}
                  className="rounded-lg px-3 py-2 text-sm font-medium cursor-pointer"
                >
                  <option value="COACH">Huấn luyện viên</option>
                  <option value="RECEPTIONIST">Lễ tân</option>
                </SelectInput>
              </Field>
            </div>

            {/* Email cá nhân để nhận tài khoản */}
            <Field
              label="Gmail cá nhân"
              hint={user ? 'Email liên hệ của nhân sự' : 'Hệ thống tự tạo tài khoản đăng nhập và gửi mật khẩu về email này'}
            >
              <div>
                <TextInput
                  type="email"
                  required={!user}
                  placeholder="nam.coach@gmail.com"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm',
                    duplicateUser ? 'border-rose-400 bg-rose-50/40' : '',
                  )}
                />
                {duplicateUser && (
                  <p className="text-xs text-rose-600 font-medium mt-1.5 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    <span>
                      Gmail này đã thuộc về {duplicateUser.role === 'COACH' ? 'HLV' : 'nhân sự'}{' '}
                      {duplicateUser.fullName}
                    </span>
                  </p>
                )}
              </div>
            </Field>

            {/* Chuyên đề khóa học lớp nhóm & Chuyên môn được phép dạy */}
            {isCoachForm && (
              <Field
                label="Chuyên môn đảm nhiệm"
                hint="Mỗi HLV chỉ thuộc 1 bộ môn (Yoga chỉ Yoga, Boxing chỉ Boxing, Gym chỉ Gym). Chọn chuyên môn nào sẽ tự động khóa các bộ môn khác."
              >
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {activeSpecialties.map((s) => {
                    const isChecked = selectedSpecialtyIds.includes(s.id)
                    const isLockedOut = !isChecked && isSpecialtyIncompatible(s.discipline?.code)
                    const discCode = s.discipline?.code || ''
                    const dotClass =
                      discCode === 'YOGA'
                        ? 'bg-emerald-500'
                        : discCode === 'BOXING'
                          ? 'bg-amber-500'
                          : 'bg-sky-500'

                    return (
                      <label
                        key={s.id}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-lg border text-xs transition-colors',
                          isLockedOut
                            ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                            : isChecked
                              ? 'bg-emerald-50/60 border-[#17664e] text-slate-900 cursor-pointer'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 cursor-pointer',
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isLockedOut}
                          onChange={() => toggleSpecialty(s.id)}
                          className="h-4 w-4 mt-0.5 accent-[#17664e] shrink-0 rounded cursor-pointer disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900 text-xs sm:text-sm leading-snug">
                              {s.name}
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                              <span className={cn('w-1.5 h-1.5 rounded-full', dotClass)} />
                              {s.discipline?.name || 'Môn'}
                            </span>
                          </div>
                          {s.description && (
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">
                              {s.description}
                            </p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </Field>
            )}

            {user && (
              <Field
                label="Mật khẩu mới"
                hint="Để trống nếu giữ nguyên mật khẩu (tối thiểu 8 ký tự)"
              >
                <TextInput
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            )}
          </div>

          {/* CỘT 2: ĐÃI NGỘ & LỊCH LÀM VIỆC ĐỊNH KỲ (CHỈ HIỆN VỚI COACH) */}
          {isCoachForm && (
            <div className="space-y-4">
              <div className="pb-2 border-b border-slate-200/80">
                <h3 className="text-sm font-semibold text-slate-900">Đãi ngộ &amp; Ca nền cố định</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hạng sao thù lao và khung giờ làm việc cố định hàng tuần
                </p>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60">
                <Field label="Bậc Huấn luyện viên">
                  <SelectInput
                    value={String(ratePerSession)}
                    onChange={(e) => setRatePerSession(Number(e.target.value))}
                    className="rounded-lg text-sm tabular-nums"
                  >
                    {COACH_TIERS.map((tier) => (
                      <option key={tier.level} value={tier.rate}>
                        {tier.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>

              {!user && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Ngày làm việc cố định trong tuần
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                      {ALL_SCHEDULE_DAYS.map((day) => {
                        const isSelected = workingDays.includes(day.code)
                        const shortLabel = day.code === 'SUNDAY' ? 'CN' : day.label.replace('Thứ ', 'T')
                        return (
                          <button
                            key={day.code}
                            type="button"
                            onClick={() => {
                              setWorkingDays((prev) => {
                                const next = prev.includes(day.code)
                                  ? prev.filter((d) => d !== day.code)
                                  : [...prev, day.code]
                                if (!next.includes(activeDayCode) && next.length > 0) {
                                  setActiveDayCode(next[0])
                                }
                                return next
                              })
                            }}
                            className={cn(
                              'py-2 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-center',
                              isSelected
                                ? 'bg-[#17664e] text-white border-[#17664e]'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300',
                            )}
                          >
                            {shortLabel}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {workingDays.length === 0 ? (
                    <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                      Chọn ít nhất một ngày làm việc ở trên để thiết lập khung giờ.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-medium text-slate-700">
                          Khung giờ theo ngày (tối đa 8h/ngày)
                        </label>
                        <button
                          type="button"
                          onClick={copyDayScheduleToAll}
                          className="text-xs font-medium text-[#17664e] hover:underline underline-offset-2 cursor-pointer"
                        >
                          Áp dụng giờ {ALL_SCHEDULE_DAYS.find((d) => d.code === activeDayCode)?.label} cho các ngày khác
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pb-1">
                        {ALL_SCHEDULE_DAYS.filter((d) => workingDays.includes(d.code)).map((d) => {
                          const isActive = activeDayCode === d.code
                          const dMins = getMinutesForDay(d.code)
                          const dHours = (dMins / 60).toFixed(1)
                          const isOver = dMins > 8 * 60
                          const shortLabel = d.code === 'SUNDAY' ? 'CN' : d.label.replace('Thứ ', 'T')

                          return (
                            <button
                              key={d.code}
                              type="button"
                              onClick={() => setActiveDayCode(d.code)}
                              className={cn(
                                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 border',
                                isActive
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200',
                              )}
                            >
                              <span>{shortLabel}</span>
                              <span
                                className={cn(
                                  'text-[11px] font-mono tabular-nums',
                                  isOver
                                    ? 'text-rose-400 font-semibold'
                                    : isActive
                                      ? 'text-slate-300'
                                      : 'text-slate-500',
                                )}
                              >
                                {dHours}h
                              </span>
                            </button>
                          )
                        })}
                      </div>

                      <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {ALL_SCHEDULE_DAYS.find((d) => d.code === activeDayCode)?.label}
                          </span>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'text-xs font-mono tabular-nums',
                                getMinutesForDay(activeDayCode) > 8 * 60
                                  ? 'text-rose-600 font-semibold'
                                  : 'text-slate-500',
                              )}
                            >
                              {(getMinutesForDay(activeDayCode) / 60).toFixed(1)} / 8.0h
                            </span>
                            <button
                              type="button"
                              onClick={addShiftForActiveDay}
                              className="inline-flex items-center gap-1 text-xs font-medium text-[#17664e] hover:underline cursor-pointer"
                            >
                              <Plus className="w-4 h-4" strokeWidth={1.5} />
                              <span>Thêm ca</span>
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {(daySchedules[activeDayCode] || []).map((wh, idx) => {
                            const [sH] = wh.start.split(':').map(Number)
                            const [eH] = wh.end.split(':').map(Number)
                            const duration = eH - sH

                            return (
                              <div
                                key={idx}
                                className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white border border-slate-200 text-xs"
                              >
                                <span className="text-slate-600 font-medium w-10 shrink-0 tabular-nums">
                                  Ca {idx + 1}
                                </span>

                                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                  <select
                                    value={wh.start}
                                    onChange={(e) => updateShiftStart(idx, e.target.value)}
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-[#17664e] focus:outline-none cursor-pointer tabular-nums"
                                  >
                                    {SCHEDULE_HOUR_LIST.slice(0, -1).map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>

                                  <span className="text-slate-400">–</span>

                                  <select
                                    value={wh.end}
                                    onChange={(e) => updateShiftEnd(idx, e.target.value)}
                                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-[#17664e] focus:outline-none cursor-pointer tabular-nums"
                                  >
                                    {SCHEDULE_HOUR_LIST.slice(1).map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>

                                  <span className="text-slate-500 font-mono text-xs tabular-nums ml-1">
                                    {duration > 0 ? `${duration}h` : ''}
                                  </span>

                                  {duration <= 0 && (
                                    <span className="text-xs font-medium text-rose-600">
                                      Giờ không hợp lệ
                                    </span>
                                  )}
                                </div>

                                {(daySchedules[activeDayCode] || []).length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeShift(idx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
                                    title="Xóa ca"
                                  >
                                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                  </button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}
