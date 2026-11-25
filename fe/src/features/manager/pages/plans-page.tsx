import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldAlert } from 'lucide-react'
import { money } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useNotification } from '@/context/notification-context'
import { managerApi, managerKeys } from '../api/manager-api'
import type {
  Discipline,
  MembershipPlan,
  PackageTier,
  PlanPayload,
  PlanType,
  Room,
  TrainingMode,
} from '../types/manager.types'
import { errorMessage, tierLabel, trainingModeLabel } from '../lib/format'
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

const tiers: PackageTier[] = ['TRIAL', 'DROP_IN', 'PLUS', 'VIP']
const modes: TrainingMode[] = ['GROUP_CLASS', 'PERSONAL_TRAINING', 'HYBRID', 'CUSTOM']

/** Mirrors MembershipsService.validate so mistakes show before the request. */
function planProblem(form: PlanPayload, discipline?: Discipline): string | null {
  const isGym = discipline?.code.toUpperCase() === 'GYM'
  if (isGym && (form.trainingMode === 'GROUP_CLASS' || form.groupSessionQuota !== 0))
    return 'Gói Gym không được là lớp nhóm và phải có 0 buổi nhóm.'
  if (form.unlimitedGymEntry && !isGym) return 'Chỉ gói Gym mới được vào cửa không giới hạn.'
  if (form.packageTier === 'VIP' && form.ptSessionQuota !== 12)
    return 'Gói VIP phải có đúng 12 buổi PT.'
  if (form.packageTier === 'TRIAL' && (form.price !== 0 || form.ptSessionQuota !== 0))
    return 'Gói dùng thử (Trial) phải có giá 0 và 0 buổi PT.'
  return null
}

const tierOrder: Record<string, number> = { TRIAL: 0, DROP_IN: 1, PLUS: 2, VIP: 3 }
const tierTone = { TRIAL: 'gray', DROP_IN: 'gray', PLUS: 'blue', VIP: 'amber' } as const
const UNASSIGNED = 'none'

/** What a member gets from the plan, as short plain-language items. */
// Seeded descriptions repeat the quotas ("4 group classes + 12 PT sessions + …").
const QUOTA_PREFIX = /^\s*\d+\s+group classes?\s*\+\s*\d+\s+PT sessions?\s*(\+\s*)?/i

/** Session and access benefits as short tags; duration and price have their own columns. */
function benefits(plan: MembershipPlan) {
  const items: string[] = []
  if (plan.groupSessionQuota) items.push(`${plan.groupSessionQuota} buổi lớp nhóm`)
  if (plan.ptSessionQuota) items.push(`${plan.ptSessionQuota} buổi PT`)
  if (plan.unlimitedGymEntry) items.push('Vào cửa không giới hạn')
  if (plan.room?.name) items.push(`Phòng: ${plan.room.name}`)
  const preview = plan.weeklySchedulePreview as any
  if (preview?.maxGroupCapacity) {
    items.push(`Phòng max ${preview.maxGroupCapacity} người (≥${preview.minAttendancePercent ?? 60}%)`)
  }
  const description = plan.description?.trim() ?? ''
  // Keep only what the description adds beyond the quotas, e.g. "free boxing bag access".
  const extra = QUOTA_PREFIX.test(description) ? description.replace(QUOTA_PREFIX, '').trim() : ''
  if (extra) items.push(extra)
  return { items, note: QUOTA_PREFIX.test(description) ? '' : description }
}

function DisciplineChips({
  value,
  onChange,
  items,
  onAdd,
}: {
  value: string
  onChange: (value: string) => void
  items: Array<{ value: string; label: string; count: number }>
  onAdd: () => void
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5" role="group" aria-label="Chọn môn">
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
          <span className="ml-1.5 text-xs tabular-nums text-slate-400">{item.count}</span>
        </button>
      ))}
      <Btn size="sm" tone="ghost" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" />
        Thêm môn
      </Btn>
    </div>
  )
}

export function ManagerPlansPage() {
  const queryClient = useQueryClient()
  const { showToast } = useNotification()
  const plans = useQuery({ queryKey: managerKeys.plans, queryFn: managerApi.plans })
  const disciplines = useQuery({
    queryKey: managerKeys.disciplines,
    queryFn: managerApi.disciplines,
  })
  const rooms = useQuery({ queryKey: managerKeys.rooms, queryFn: managerApi.rooms })
  const [filter, setFilter] = useState('')
  const [detailPlan, setDetailPlan] = useState<MembershipPlan | null>(null)
  const [editing, setEditing] = useState<{
    plan: MembershipPlan | null
    disciplineId?: string
  } | null>(null)
  const [addingDiscipline, setAddingDiscipline] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const disable = useMutation({
    mutationFn: (id: string) => managerApi.disablePlan(id),
    onSuccess: () => {
      setError(null)
      showToast('success', 'Thành công', 'Đã cập nhật trạng thái gói tập.')
      void queryClient.invalidateQueries({ queryKey: managerKeys.plans })
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi cập nhật gói', msg)
    },
  })

  const disciplineList = disciplines.data ?? []
  const allPlans = plans.data ?? []
  const keyOf = (plan: MembershipPlan) => plan.disciplineId ?? UNASSIGNED
  const countOf = (id: string) => allPlans.filter((p) => keyOf(p) === id).length
  const sorted = allPlans
    .filter((p) => !filter || keyOf(p) === filter)
    .sort(
      (a, b) =>
        (tierOrder[a.packageTier] ?? 9) - (tierOrder[b.packageTier] ?? 9) ||
        Number(a.price) - Number(b.price),
    )
  const { items: pagePlans, pager } = usePagination(sorted, 20, filter)

  // One section per discipline; when showing every discipline, empty ones still appear.
  const sections = [
    ...disciplineList.map((d) => ({ id: d.id, discipline: d as Discipline | null })),
    ...(countOf(UNASSIGNED) ? [{ id: UNASSIGNED, discipline: null }] : []),
  ]
    .filter((section) => !filter || section.id === filter)
    .map((section) => ({ ...section, plans: pagePlans.filter((p) => keyOf(p) === section.id) }))
    .filter(
      (section) => section.plans.length > 0 || (pager.page === 0 && countOf(section.id) === 0),
    )

  const loading = plans.isLoading || disciplines.isLoading
  const failed = plans.isError ? plans.error : disciplines.isError ? disciplines.error : null

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Môn học & gói tập"
        description="Gói đang bán theo từng môn. Ngừng bán gói không ảnh hưởng hợp đồng hội viên đã mua."
        actions={
          <Btn
            tone="primary"
            onClick={() => setEditing({ plan: null, disciplineId: filter || undefined })}
          >
            <Plus className="h-4 w-4" />
            Tạo gói
          </Btn>
        }
      />
      <DisciplineChips
        value={filter}
        onChange={setFilter}
        onAdd={() => setAddingDiscipline(true)}
        items={[
          { value: '', label: 'Tất cả', count: allPlans.length },
          ...disciplineList.map((d) => ({ value: d.id, label: d.name, count: countOf(d.id) })),
        ]}
      />
      <div className="mb-3 empty:hidden">
        <FormError>{error}</FormError>
      </div>

      {loading || failed ? (
        <Panel>
          <StateMessage
            loading={loading}
            error={failed ? errorMessage(failed) : null}
            onRetry={() => {
              void plans.refetch()
              void disciplines.refetch()
            }}
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          {sections.map(({ id, discipline, plans: items }) => (
            <Panel key={id}>
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900">
                    {discipline?.name ?? 'Chưa gắn môn'}
                    {discipline ? (
                      <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                        {discipline.code}
                      </span>
                    ) : null}
                  </h2>
                  {discipline?.description ? (
                    <p className="mt-0.5 text-sm text-slate-500">{discipline.description}</p>
                  ) : null}
                </div>
                {discipline ? (
                  <Btn
                    size="sm"
                    onClick={() => setEditing({ plan: null, disciplineId: discipline.id })}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tạo gói cho môn này
                  </Btn>
                ) : null}
              </div>
              {items.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-400">
                  Môn này chưa có gói nào đang bán.
                </p>
              ) : (
                <>
                  <div className="hidden grid-cols-[4.5rem_minmax(0,1fr)_5rem_8rem_12rem] gap-x-4 border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-xs text-slate-500 sm:grid">
                    <span>Hạng</span>
                    <span>Gói và quyền lợi</span>
                    <span className="text-right">Thời hạn</span>
                    <span className="text-right">Giá</span>
                    <span />
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {items.map((plan) => {
                      const { items: tags, note } = benefits(plan)
                      return (
                        <li
                          key={plan.id}
                          className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_5rem_8rem_12rem]"
                        >
                          <div>
                            <Pill tone={tierTone[plan.packageTier]}>
                              {tierLabel[plan.packageTier]}
                            </Pill>
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900" title={plan.name}>
                              {plan.name}
                            </p>
                            {tags.length || note ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                <span className="sm:hidden">{plan.durationDays} ngày</span>
                                {tags.map((tag, index) => (
                                  <span key={tag}>
                                    {index > 0 ? ', ' : <span className="sm:hidden">, </span>}
                                    {tag}
                                  </span>
                                ))}
                                {note ? (
                                  <span className="block truncate text-slate-400" title={note}>
                                    {note}
                                  </span>
                                ) : null}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-xs text-slate-500 sm:hidden">
                                {plan.durationDays} ngày
                              </p>
                            )}
                          </div>
                          <p className="hidden text-right text-sm tabular-nums text-slate-600 sm:block">
                            {plan.durationDays} ngày
                          </p>
                          <p className="text-right font-semibold tabular-nums text-slate-900">
                            {Number(plan.price) === 0 ? 'Miễn phí' : money(plan.price)}
                          </p>
                          <div className="col-span-3 flex justify-end gap-1.5 sm:col-span-1">
                            <Btn size="sm" tone="ghost" onClick={() => setDetailPlan(plan)}>
                              Chi tiết
                            </Btn>
                            <Btn size="sm" onClick={() => setEditing({ plan })}>
                              Sửa
                            </Btn>
                            <Btn
                              size="sm"
                              tone="danger"
                              disabled={disable.isPending}
                              onClick={() =>
                                window.confirm(`Ngừng bán gói ${plan.name}?`) &&
                                disable.mutate(plan.id)
                              }
                            >
                              Ngừng bán
                            </Btn>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </Panel>
          ))}
          {sections.length === 0 ? (
            <Panel>
              <p className="px-4 py-12 text-center text-sm text-slate-400">
                Chưa có môn nào. Thêm môn trước rồi tạo gói.
              </p>
            </Panel>
          ) : null}
          {pager.pages > 1 ? (
            <div className="rounded-lg border border-slate-200 bg-white">
              <Pagination pager={pager} />
            </div>
          ) : null}
        </div>
      )}

      {detailPlan ? (
        <PlanDetailModal
          plan={detailPlan}
          discipline={disciplineList.find((d) => d.id === detailPlan.disciplineId)}
          onClose={() => setDetailPlan(null)}
          onEdit={() => {
            const p = detailPlan
            setDetailPlan(null)
            setEditing({ plan: p })
          }}
          onDisable={() => {
            if (window.confirm(`Ngừng bán gói ${detailPlan.name}?`)) {
              disable.mutate(detailPlan.id)
              setDetailPlan(null)
            }
          }}
          isDisabling={disable.isPending}
        />
      ) : null}

      {editing ? (
        <PlanForm
          plan={editing.plan}
          defaultDisciplineId={editing.disciplineId}
          disciplines={disciplineList}
          rooms={rooms.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            void queryClient.invalidateQueries({ queryKey: managerKeys.plans })
          }}
        />
      ) : null}
      {addingDiscipline ? (
        <DisciplineForm
          onClose={() => setAddingDiscipline(false)}
          onSaved={() => {
            setAddingDiscipline(false)
            void queryClient.invalidateQueries({ queryKey: managerKeys.disciplines })
          }}
        />
      ) : null}
    </div>
  )
}

function PlanDetailModal({
  plan,
  discipline,
  onClose,
  onEdit,
  onDisable,
  isDisabling,
}: {
  plan: MembershipPlan
  discipline?: Discipline | null
  onClose: () => void
  onEdit: () => void
  onDisable: () => void
  isDisabling?: boolean
}) {
  return (
    <Modal
      wide
      title={`Chi tiết gói: ${plan.name}`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between w-full gap-2">
          <Btn
            size="sm"
            tone="danger"
            disabled={isDisabling}
            onClick={onDisable}
          >
            {isDisabling ? 'Đang ngừng bán…' : 'Ngừng bán gói này'}
          </Btn>
          <div className="flex items-center gap-2">
            <Btn size="sm" onClick={onClose}>
              Đóng
            </Btn>
            <Btn
              size="sm"
              tone="primary"
              onClick={() => {
                onClose()
                onEdit()
              }}
            >
              Sửa gói tập
            </Btn>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-md text-xs">
          <div>
            <span className="text-slate-500 font-medium block">Hạng gói:</span>
            <span className="mt-1 inline-block">
              <Pill tone={tierTone[plan.packageTier]}>
                {tierLabel[plan.packageTier]}
              </Pill>
            </span>
          </div>

          <div>
            <span className="text-slate-500 font-medium block">Bộ môn áp dụng:</span>
            <strong className="text-slate-900 text-sm font-semibold mt-0.5 block">
              {discipline?.name ?? 'Chưa gắn môn'}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 font-medium block">Giá niêm yết:</span>
            <strong className="text-slate-900 text-base font-bold font-mono mt-0.5 block text-emerald-800">
              {Number(plan.price) === 0 ? 'Miễn phí' : money(plan.price)}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 font-medium block">Thời hạn sử dụng:</span>
            <strong className="text-slate-900 text-sm font-semibold font-mono mt-0.5 block">
              {plan.durationDays} ngày
            </strong>
          </div>

          <div>
            <span className="text-slate-500 font-medium block">Hình thức tập:</span>
            <span className="text-slate-800 font-medium mt-0.5 block">
              {trainingModeLabel[plan.trainingMode]}
            </span>
          </div>

          <div>
            <span className="text-slate-500 font-medium block">Loại hình:</span>
            <span className="text-slate-800 font-medium mt-0.5 block">
              {plan.planType === 'PERSONAL_TRAINING' ? 'Kèm huấn luyện cá nhân (PT)' : 'Gói thông thường'}
            </span>
          </div>

          {plan.room && (
            <div className="sm:col-span-2 p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-md">
              <span className="text-slate-600 font-medium block text-xs">Phòng tập chuyên dụng cố định:</span>
              <strong className="text-emerald-900 text-sm font-bold block mt-0.5">
                {plan.room.name}
              </strong>
              {plan.room.locationNote ? (
                <span className="text-emerald-700 text-xs block mt-0.5">{plan.room.locationNote}</span>
              ) : null}
            </div>
          )}
        </div>

        {/* Quotas & Entitlements */}
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Quyền lợi & Số buổi quy định
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Lớp học nhóm</span>
              <strong className="text-base font-bold font-mono text-slate-900">
                {plan.groupSessionQuota} buổi
              </strong>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Kèm HLV PT 1:1</span>
              <strong className="text-base font-bold font-mono text-slate-900">
                {plan.ptSessionQuota} buổi
              </strong>
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-md text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Vào cửa</span>
              <span className="text-xs font-semibold text-slate-800 block mt-1">
                {plan.unlimitedGymEntry ? 'Không giới hạn' : 'Theo buổi'}
              </span>
            </div>
          </div>
        </div>

        {/* Group Class Thresholds if applicable */}
        {((plan.groupSessionQuota ?? 0) > 0 || (plan.weeklySchedulePreview as any)?.maxGroupCapacity) ? (
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs space-y-1.5 text-emerald-950">
            <div className="font-bold flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-700" />
                Quy chuẩn phòng tập &amp; Ngưỡng tự động mở/hủy lớp:
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold border border-emerald-200 text-[11px]">
                Cần tối thiểu {Math.ceil(((plan.weeklySchedulePreview as any)?.maxGroupCapacity ?? 5) * (((plan.weeklySchedulePreview as any)?.minAttendancePercent ?? 60) / 100))} người
              </span>
            </div>
            <p className="text-emerald-800 leading-relaxed text-[11.5px]">
              • Sức chứa phòng tối đa: <strong>{(plan.weeklySchedulePreview as any)?.maxGroupCapacity ?? 5} người/phòng</strong> (Chuẩn Yoga Studio / Boxing Ring).<br />
              • Tỷ lệ sĩ số tối thiểu trước 2 ngày: <strong>{(plan.weeklySchedulePreview as any)?.minAttendancePercent ?? 60}%</strong>. Nếu không đạt sĩ số trước 48 giờ, lớp sẽ tự động hủy &amp; hoàn trả lượt tập cho hội viên (HLV không bị phạt).
            </p>
          </div>
        ) : null}

        {/* Description */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Mô tả chi tiết gói tập
          </label>
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-700 whitespace-pre-line leading-relaxed">
            {plan.description?.trim() || 'Chưa có thông tin mô tả chi tiết cho gói tập này.'}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PlanForm({
  plan,
  defaultDisciplineId,
  disciplines,
  rooms = [],
  onClose,
  onSaved,
}: {
  plan: MembershipPlan | null
  defaultDisciplineId?: string
  disciplines: Discipline[]
  rooms?: Room[]
  onClose: () => void
  onSaved: () => void
}) {
  const { showToast } = useNotification()
  const preview = plan?.weeklySchedulePreview as any
  const [maxGroupCapacity, setMaxGroupCapacity] = useState<number>(() => {
    return Number(preview?.maxGroupCapacity) || 5
  })
  const [minAttendancePercent, setMinAttendancePercent] = useState<number>(() => {
    return Number(preview?.minAttendancePercent) || 60
  })

  const [form, setForm] = useState({
    disciplineId: plan?.disciplineId ?? defaultDisciplineId ?? disciplines[0]?.id ?? '',
    name: plan?.name ?? '',
    description: plan?.description ?? '',
    price: plan ? String(Number(plan.price)) : '',
    durationDays: String(plan?.durationDays ?? 30),
    packageTier: plan?.packageTier ?? ('PLUS' as PackageTier),
    trainingMode: plan?.trainingMode ?? ('GROUP_CLASS' as TrainingMode),
    planType: plan?.planType ?? ('GENERAL' as PlanType),
    groupSessionQuota: String(plan?.groupSessionQuota ?? 0),
    ptSessionQuota: String(plan?.ptSessionQuota ?? 0),
    unlimitedGymEntry: plan?.unlimitedGymEntry ?? false,
    roomId: plan?.roomId ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))
  const discipline = disciplines.find((d) => d.id === form.disciplineId)
  const isGym = discipline?.code.toUpperCase() === 'GYM'
  const isYoga = discipline?.code.toUpperCase() === 'YOGA'
  const isBoxing = discipline?.code.toUpperCase() === 'BOXING'
  const isGroupPlan = !isGym && (form.trainingMode === 'GROUP_CLASS' || Number(form.groupSessionQuota) > 0)
  
  // Lọc danh sách phòng theo nhãn bộ môn - CHỐNG CHỌN CHÉO MÔN
  const disciplineRooms = rooms.filter((r) => {
    if (!r.isActive) return false
    const rName = r.name.toLowerCase()
    if (rName.includes('gym')) return false
    if (r.disciplineId) return r.disciplineId === form.disciplineId
    if (isYoga) return rName.includes('yoga')
    if (isBoxing) return rName.includes('box')
    return true
  })

  const payload = (): PlanPayload => ({
    disciplineId: form.disciplineId,
    name: form.name.trim(),
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    price: Number(form.price),
    durationDays: Number(form.durationDays),
    packageTier: form.packageTier,
    trainingMode: form.trainingMode,
    planType: form.planType,
    groupSessionQuota: isGym ? 0 : Number(form.groupSessionQuota),
    ptSessionQuota: Number(form.ptSessionQuota),
    unlimitedGymEntry: isGym && form.unlimitedGymEntry,
    roomId: isGym ? null : (form.roomId || null),
    weeklySchedulePreview: isGroupPlan
      ? {
          maxGroupCapacity,
          minAttendancePercent,
        }
      : undefined,
  })
  const save = useMutation({
    mutationFn: () => {
      // Discipline and tier inputs are locked on edit; the API accepts them when unchanged.
      const body = payload()
      return plan ? managerApi.updatePlan(plan.id, body) : managerApi.createPlan(body)
    },
    onSuccess: () => {
      showToast('success', 'Thành công', plan ? 'Đã lưu thay đổi gói tập.' : 'Đã tạo mới gói tập thành công.')
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi lưu gói tập', msg)
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problem = planProblem(payload(), discipline)
    if (problem) return setError(problem)

    if (isGroupPlan && form.roomId) {
      const selectedRoom = rooms.find((r) => r.id === form.roomId)
      if (selectedRoom?.disciplineId && selectedRoom.disciplineId !== form.disciplineId) {
        return setError(
          `Phòng "${selectedRoom.name}" thuộc bộ môn khác, không thể gán chéo cho gói tập ${discipline?.name}! Vui lòng chọn đúng phòng của bộ môn.`,
        )
      }
      const conflictPlan = selectedRoom?.plans?.find((p) => p.id !== plan?.id)
      if (conflictPlan) {
        return setError(
          `Phòng "${selectedRoom?.name || ''}" đã được book bởi gói "${conflictPlan.name}". Mỗi phòng chỉ dành riêng cho 1 gói tập duy nhất!`,
        )
      }
    }

    setError(null)
    save.mutate()
  }

  return (
    <Modal
      wide
      title={plan ? `Sửa gói ${plan.name}` : 'Tạo gói tập'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="plan-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : plan ? 'Lưu thay đổi' : 'Tạo gói'}
          </Btn>
        </>
      }
    >
      <form id="plan-form" onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Tên gói" className="sm:col-span-2">
          <TextInput
            required
            minLength={2}
            maxLength={100}
            value={form.name}
            onChange={set('name')}
          />
        </Field>
        <Field label="Môn" hint={plan ? 'Không đổi được sau khi tạo.' : undefined}>
          <SelectInput
            disabled={!!plan}
            value={form.disciplineId}
            onChange={(e) => {
              const newDiscId = e.target.value
              setForm((curr) => {
                const currRoom = rooms.find((r) => r.id === curr.roomId)
                const roomStillValid = currRoom && (!currRoom.disciplineId || currRoom.disciplineId === newDiscId)
                return {
                  ...curr,
                  disciplineId: newDiscId,
                  roomId: roomStillValid ? curr.roomId : '',
                }
              })
            }}
          >
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Hạng" hint={plan ? 'Không đổi được sau khi tạo.' : undefined}>
          <SelectInput disabled={!!plan} value={form.packageTier} onChange={set('packageTier')}>
            {tiers.map((tier) => (
              <option key={tier} value={tier}>
                {tierLabel[tier]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Hình thức tập">
          <SelectInput value={form.trainingMode} onChange={set('trainingMode')}>
            {modes.map((mode) => (
              <option key={mode} value={mode} disabled={isGym && mode === 'GROUP_CLASS'}>
                {trainingModeLabel[mode]}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field label="Loại gói">
          <SelectInput value={form.planType} onChange={set('planType')}>
            <option value="GENERAL">Thông thường</option>
            <option value="PERSONAL_TRAINING">Huấn luyện cá nhân</option>
          </SelectInput>
        </Field>
        <Field label="Giá (VND)">
          <TextInput
            type="number"
            required
            min={0}
            step={1000}
            value={form.price}
            onChange={set('price')}
          />
        </Field>
        <Field label="Thời hạn (ngày)">
          <TextInput
            type="number"
            required
            min={1}
            max={3650}
            value={form.durationDays}
            onChange={set('durationDays')}
          />
        </Field>
        <Field label="Số buổi lớp nhóm" hint={isGym ? 'Gym luôn là 0.' : undefined}>
          <TextInput
            type="number"
            required
            min={0}
            disabled={isGym}
            value={isGym ? '0' : form.groupSessionQuota}
            onChange={set('groupSessionQuota')}
          />
        </Field>
        <Field label="Số buổi PT" hint={form.packageTier === 'VIP' ? 'VIP phải là 12.' : undefined}>
          <TextInput
            type="number"
            required
            min={0}
            value={form.ptSessionQuota}
            onChange={set('ptSessionQuota')}
          />
        </Field>

        {/* Dropdown Chọn phòng tập cố định - CHỈ HIỂN THỊ VỚI GÓI NHÓM */}
        {isGroupPlan && (
          <Field
            label={`Phòng tập chuyên dụng (${discipline?.name || 'Môn học'})`}
            hint="Mỗi phòng chỉ gán độc quyền cho 1 gói tập. Các phòng đã có gói khác chọn sẽ bị khóa."
            className="sm:col-span-2"
          >
            <SelectInput value={form.roomId} onChange={set('roomId')}>
              <option value="">-- Chưa gán phòng cố định --</option>
              {disciplineRooms.map((r) => {
                const conflictPlan = r.plans?.find((p) => p.id !== plan?.id)
                const isCurrentPlanRoom = plan?.roomId === r.id
                const isBooked = !!conflictPlan && !isCurrentPlanRoom

                return (
                  <option key={r.id} value={r.id} disabled={isBooked}>
                    {isBooked
                      ? `🔴 ${r.name} (Đã được book bởi: ${conflictPlan.name})`
                      : isCurrentPlanRoom
                      ? `🟢 ${r.name} (Đang gán cho gói này - Sức chứa: ${r.capacity} người)`
                      : `🟢 ${r.name} (Sức chứa: ${r.capacity} người - Đang trống)`}
                  </option>
                )
              })}
            </SelectInput>
          </Field>
        )}

        {/* Gói Gym & Gym PT 1-1: Không chọn phòng */}
        {isGym && (
          <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            ℹ️ <strong>Lưu ý:</strong> Gói Gym & Gym PT 1-1 tập luyện tự do hoặc kèm 1-1 theo ca rảnh HLV, không tạo và không gán phòng tập cố định.
          </div>
        )}

        {/* Cấu hình sức chứa phòng & ngưỡng % tối thiểu tự động mở lớp nhóm */}
        {isGroupPlan && (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg sm:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-emerald-700" />
               (Yoga / Boxing / Group Class)
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 font-bold text-emerald-800 border border-emerald-200">
                Cần tối thiểu {Math.ceil(maxGroupCapacity * (minAttendancePercent / 100))} người
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Field
                label="Sức chứa lớp nhóm tối đa (người / phòng)"
                hint="Mặc định: 5 người đối với các phòng Yoga Studio & Boxing Ring"
              >
                <TextInput
                  type="number"
                  required
                  min={1}
                  max={100}
                  value={String(maxGroupCapacity)}
                  onChange={(e) => setMaxGroupCapacity(Math.max(1, Number(e.target.value)))}
                />
              </Field>

              <Field
                label="Tỷ lệ sĩ số tối thiểu mở lớp (%)"
                hint="Mặc định: 60%. Nếu trước 2 ngày không đạt sẽ tự động hủy & hoàn token"
              >
                <div className="flex gap-2">
                  <TextInput
                    type="number"
                    required
                    min={10}
                    max={100}
                    step={5}
                    value={String(minAttendancePercent)}
                    onChange={(e) =>
                      setMinAttendancePercent(Math.max(10, Math.min(100, Number(e.target.value))))
                    }
                  />
                  <span className="inline-flex items-center px-3 rounded-md bg-white border border-slate-300 text-xs font-bold text-slate-700 shrink-0">
                    %
                  </span>
                </div>
              </Field>
            </div>

          </div>
        )}
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#17664e]"
            disabled={!isGym}
            checked={isGym && form.unlimitedGymEntry}
            onChange={(event) =>
              setForm((current) => ({ ...current, unlimitedGymEntry: event.target.checked }))
            }
          />
          Vào cửa không giới hạn {isGym ? '' : '(chỉ áp dụng cho Gym)'}
        </label>
        <Field label="Mô tả" className="sm:col-span-2">
          <TextArea maxLength={5000} value={form.description} onChange={set('description')} />
        </Field>
        <div className="sm:col-span-2">
          <FormError>{error}</FormError>
        </div>
      </form>
    </Modal>
  )
}

function DisciplineForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { showToast } = useNotification()
  const [form, setForm] = useState({ code: '', name: '', description: '' })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      managerApi.createDiscipline({
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
      }),
    onSuccess: () => {
      showToast('success', 'Thêm môn thành công', `Đã thêm môn học ${form.name}.`)
      onSaved()
    },
    onError: (err) => {
      const msg = errorMessage(err)
      setError(msg)
      showToast('error', 'Lỗi thêm môn học', msg)
    },
  })
  return (
    <Modal
      title="Thêm môn học"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="discipline-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Thêm môn'}
          </Btn>
        </>
      }
    >
      <form
        id="discipline-form"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
        className="space-y-3"
      >
        <Field label="Tên môn">
          <TextInput
            required
            maxLength={100}
            placeholder="Ví dụ: Bơi lội"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Mã môn" hint="Viết liền, không dấu, không trùng. Ví dụ SWIM.">
          <TextInput
            required
            maxLength={50}
            pattern="[A-Za-z0-9_]+"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </Field>
        <Field label="Mô tả">
          <TextArea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}
