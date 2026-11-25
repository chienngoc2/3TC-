import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { money } from '@/lib/api'
import { managerApi, managerKeys } from '../api/manager-api'
import type {
  CoachRow,
  MemberSubscription,
  MembershipPlan,
  PaymentMethod,
  UserRow,
} from '../types/manager.types'
import {
  dayOnly,
  errorMessage,
  formatDateTime,
  formatDay,
  invoiceTypeLabel,
  paymentMethodLabel,
  subscriptionStatusLabel,
  tierLabel,
  vnDay,
} from '../lib/format'
import { useUserNames } from '../lib/use-user-names'
import { MemberPicker } from '../components/member-picker'
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

type Tab = 'sell' | 'renew' | 'invoices'
// Counter sales only; MOCK and FREE are produced by the online checkout flow.
const counterMethods: PaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CARD']
const PAGE_SIZE = 20

const ptQuotaOf = (plan: MembershipPlan) =>
  plan.packageTier === 'VIP' ? 12 : (plan.ptSessionQuota ?? 0)

/** Same eligibility as BillingService.rate: specialty in the discipline and a rate valid today. */
function eligibleCoaches(coaches: CoachRow[], disciplineId: string | null) {
  const today = vnDay()
  return coaches.filter(
    (coach) =>
      (coach.coachProfile?.coachSpecialties ?? []).some(
        (s) => s.specialty.disciplineId === disciplineId,
      ) &&
      coach.coachRates.some(
        (rate) =>
          (rate.disciplineId === disciplineId || rate.disciplineId === null) &&
          dayOnly(rate.effectiveFrom) <= today &&
          (!rate.effectiveTo || dayOnly(rate.effectiveTo) >= today),
      ),
  )
}

function PaymentFields({
  method,
  reference,
  onMethod,
  onReference,
}: {
  method: PaymentMethod
  reference: string
  onMethod: (value: PaymentMethod) => void
  onReference: (value: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Thanh toán">
        <SelectInput value={method} onChange={(e) => onMethod(e.target.value as PaymentMethod)}>
          {counterMethods.map((m) => (
            <option key={m} value={m}>
              {paymentMethodLabel[m]}
            </option>
          ))}
        </SelectInput>
      </Field>
      <Field
        label="Mã giao dịch"
        hint={method === 'CASH' ? 'Không bắt buộc.' : 'Mã chuyển khoản hoặc mã máy POS.'}
      >
        <TextInput
          maxLength={100}
          value={reference}
          onChange={(e) => onReference(e.target.value)}
        />
      </Field>
    </div>
  )
}

export function ManagerPosPage() {
  const [tab, setTab] = useState<Tab>('sell')
  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Bán hàng tại quầy"
        description="Bán gói, gia hạn, bán thêm buổi PT và tra cứu hóa đơn. Hóa đơn tại quầy được ghi nhận đã thanh toán ngay."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'sell', label: 'Bán gói' },
          { value: 'renew', label: 'Gia hạn & thêm PT' },
          { value: 'invoices', label: 'Hóa đơn' },
        ]}
      />
      {tab === 'sell' ? <SellTab /> : null}
      {tab === 'renew' ? <RenewTab /> : null}
      {tab === 'invoices' ? <InvoicesTab /> : null}
    </div>
  )
}

function useAfterSale() {
  const queryClient = useQueryClient()
  return () => {
    for (const key of [managerKeys.invoices, managerKeys.summary, managerKeys.revenue])
      void queryClient.invalidateQueries({ queryKey: key })
    void queryClient.invalidateQueries({ queryKey: ['manager', 'member-subscriptions'] })
  }
}

function SellTab() {
  const plans = useQuery({ queryKey: managerKeys.plans, queryFn: managerApi.plans })
  const coaches = useQuery({ queryKey: managerKeys.coaches, queryFn: managerApi.coaches })
  const afterSale = useAfterSale()
  const [member, setMember] = useState<UserRow | null>(null)
  const [planId, setPlanId] = useState('')
  const [coachId, setCoachId] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const planRows = plans.data ?? []
  const plan = planRows.find((p) => p.id === planId) ?? null
  const needsCoach = plan ? ptQuotaOf(plan) > 0 : false
  const eligible = plan && needsCoach ? eligibleCoaches(coaches.data ?? [], plan.disciplineId) : []
  const chosenCoach = eligible.some((c) => c.id === coachId) ? coachId : (eligible[0]?.id ?? '')

  const sale = useMutation({
    mutationFn: () => {
      const body = {
        memberId: member!.id,
        planId,
        ...(needsCoach ? { coachId: chosenCoach } : {}),
        paymentMethod: method,
        ...(reference.trim() ? { transactionRef: reference.trim() } : {}),
      }
      return plan?.packageTier === 'VIP' ? managerApi.sellVip(body) : managerApi.sell(body)
    },
    onSuccess: (result) => {
      const code = result as { invoice?: { invoiceCode?: string }; invoiceCode?: string }
      setDone(
        `Đã bán ${plan?.name} cho ${member?.fullName}. Hóa đơn ${code.invoiceCode ?? code.invoice?.invoiceCode ?? ''}.`,
      )
      setPlanId('')
      setReference('')
      afterSale()
    },
    onError: (err) => setError(errorMessage(err)),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setDone(null)
    if (!member) return setError('Chọn hội viên trước.')
    if (!plan) return setError('Chọn gói cần bán.')
    if (needsCoach && !chosenCoach) return setError('Không có HLV nào đủ điều kiện dạy gói này.')
    setError(null)
    sale.mutate()
  }

  const groups = new Map<string, MembershipPlan[]>()
  for (const p of planRows) {
    const key = p.discipline?.name ?? 'Khác'
    groups.set(key, [...(groups.get(key) ?? []), p])
  }

  return (
    <Panel title="Bán gói mới">
      <form onSubmit={submit} className="max-w-xl space-y-4 p-4">
        <Field label="Hội viên">
          <div>
            <MemberPicker value={member} onChange={setMember} />
          </div>
        </Field>
        <Field label="Gói tập">
          <SelectInput required value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Chọn gói</option>
            {[...groups].map(([name, items]) => (
              <optgroup key={name} label={name}>
                {items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({tierLabel[p.packageTier]}), {money(p.price)}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectInput>
        </Field>
        {plan ? (
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {plan.durationDays} ngày, {plan.groupSessionQuota ?? 0} buổi nhóm, {ptQuotaOf(plan)}{' '}
            buổi PT. Giá gói {money(plan.price)}
            {needsCoach ? ', phí PT tính theo biểu phí của HLV được chọn.' : '.'}
          </p>
        ) : null}
        {needsCoach ? (
          <Field
            label="Huấn luyện viên"
            hint="Chỉ hiện HLV có chuyên môn đúng môn và đang có biểu phí."
          >
            <SelectInput value={chosenCoach} onChange={(e) => setCoachId(e.target.value)}>
              {eligible.length === 0 ? <option value="">Không có HLV phù hợp</option> : null}
              {eligible.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </SelectInput>
          </Field>
        ) : null}
        <PaymentFields
          method={method}
          reference={reference}
          onMethod={setMethod}
          onReference={setReference}
        />
        <FormError>{error}</FormError>
        {done ? (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{done}</p>
        ) : null}
        <Btn tone="primary" type="submit" disabled={sale.isPending}>
          {sale.isPending ? 'Đang ghi hóa đơn…' : 'Thu tiền và kích hoạt gói'}
        </Btn>
      </form>
    </Panel>
  )
}

function RenewTab() {
  const [member, setMember] = useState<UserRow | null>(null)
  const subs = useQuery({
    queryKey: managerKeys.memberSubscriptions(member?.id ?? ''),
    queryFn: () => managerApi.memberSubscriptions(member!.id),
    enabled: !!member,
  })
  const [action, setAction] = useState<{ kind: 'renew' | 'addon'; sub: MemberSubscription } | null>(
    null,
  )
  const today = vnDay()

  return (
    <div className="space-y-6">
      <Panel title="Chọn hội viên">
        <div className="max-w-xl p-4">
          <MemberPicker value={member} onChange={setMember} />
        </div>
      </Panel>
      {member ? (
        <Panel title={`Gói của ${member.fullName}`}>
          {subs.isLoading || subs.isError ? (
            <StateMessage
              loading={subs.isLoading}
              error={subs.isError ? errorMessage(subs.error) : null}
              onRetry={() => void subs.refetch()}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Gói</Th>
                  <Th>Thời hạn</Th>
                  <Th>PT còn lại</Th>
                  <Th>Trạng thái</Th>
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </thead>
              <tbody>
                {(subs.data ?? []).length === 0 ? (
                  <EmptyRow colSpan={5}>Hội viên chưa có gói nào.</EmptyRow>
                ) : (
                  (subs.data ?? []).map((sub) => {
                    const renewable =
                      sub.packageTier !== 'TRIAL' &&
                      sub.packageTier !== 'DROP_IN' &&
                      sub.status !== 'FROZEN'
                    const addonable =
                      sub.status === 'ACTIVE' &&
                      !!sub.assignedCoach &&
                      dayOnly(sub.startDate) <= today &&
                      dayOnly(sub.endDate) >= today
                    return (
                      <tr key={sub.id}>
                        <Td>
                          <div className="font-medium text-slate-900">
                            {sub.plan?.name ?? 'Gói tập'}
                          </div>
                          <div className="text-xs text-slate-400">
                            {tierLabel[sub.packageTier]}
                            {sub.assignedCoach ? `, HLV ${sub.assignedCoach.fullName}` : ''}
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {formatDay(sub.startDate)} – {formatDay(sub.endDate)}
                        </Td>
                        <Td className="tabular-nums">{sub.remainingPtSessions ?? 0}</Td>
                        <Td>
                          <Pill
                            tone={
                              sub.status === 'ACTIVE'
                                ? 'green'
                                : sub.status === 'FROZEN'
                                  ? 'blue'
                                  : 'gray'
                            }
                          >
                            {subscriptionStatusLabel[sub.status]}
                          </Pill>
                        </Td>
                        <Td className="whitespace-nowrap text-right">
                          <Btn
                            size="sm"
                            disabled={!renewable}
                            title={
                              sub.status === 'FROZEN'
                                ? 'Mở lại gói trước khi gia hạn'
                                : !renewable
                                  ? 'Trial và Drop-in không gia hạn được'
                                  : undefined
                            }
                            onClick={() => setAction({ kind: 'renew', sub })}
                          >
                            Gia hạn
                          </Btn>
                          {addonable ? (
                            <Btn
                              size="sm"
                              className="ml-1.5"
                              onClick={() => setAction({ kind: 'addon', sub })}
                            >
                              Thêm buổi PT
                            </Btn>
                          ) : null}
                        </Td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          )}
        </Panel>
      ) : null}
      {action ? <RenewForm action={action} onClose={() => setAction(null)} /> : null}
    </div>
  )
}

function RenewForm({
  action,
  onClose,
}: {
  action: { kind: 'renew' | 'addon'; sub: MemberSubscription }
  onClose: () => void
}) {
  const afterSale = useAfterSale()
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [sessions, setSessions] = useState('4')
  const [error, setError] = useState<string | null>(null)
  const isAddon = action.kind === 'addon'
  const save = useMutation({
    mutationFn: () => {
      const payment = {
        paymentMethod: method,
        ...(reference.trim() ? { transactionRef: reference.trim() } : {}),
      }
      return isAddon
        ? managerApi.sellPtAddon(action.sub.id, { ...payment, addonSessions: Number(sessions) })
        : managerApi.renew(action.sub.id, payment)
    },
    onSuccess: () => {
      afterSale()
      onClose()
    },
    onError: (err) => setError(errorMessage(err)),
  })
  return (
    <Modal
      title={isAddon ? 'Bán thêm buổi PT' : 'Gia hạn gói'}
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="renew-form" disabled={save.isPending}>
            {save.isPending ? 'Đang ghi hóa đơn…' : 'Thu tiền'}
          </Btn>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        {action.sub.plan?.name}
        {isAddon
          ? `, HLV ${action.sub.assignedCoach?.fullName}. Giá mỗi buổi theo biểu phí hiện hành của HLV.`
          : '. Gói mới nối tiếp ngay sau ngày hết hạn của gói cùng loại gần nhất.'}
      </p>
      <form
        id="renew-form"
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
        className="space-y-3"
      >
        {isAddon ? (
          <Field label="Số buổi PT thêm">
            <TextInput
              type="number"
              required
              min={1}
              max={100}
              value={sessions}
              onChange={(e) => setSessions(e.target.value)}
            />
          </Field>
        ) : null}
        <PaymentFields
          method={method}
          reference={reference}
          onMethod={setMethod}
          onReference={setReference}
        />
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function InvoicesTab() {
  const invoices = useQuery({ queryKey: managerKeys.invoices, queryFn: managerApi.invoices })
  const [type, setType] = useState('')
  const rows = (invoices.data ?? []).filter((i) => !type || i.type === type)
  const { items: visible, pager } = usePagination(rows, PAGE_SIZE, type)
  const memberName = useUserNames(visible.map((i) => i.subscription?.userId))
  const total = rows
    .filter((i) => i.status === 'PAID')
    .reduce((sum, i) => sum + Number(i.amount), 0)

  return (
    <Panel
      title={`${rows.length} hóa đơn, đã thu ${money(total)}`}
      actions={
        <SelectInput
          aria-label="Lọc loại hóa đơn"
          className="h-8 w-44 py-1"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Tất cả loại</option>
          {Object.entries(invoiceTypeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectInput>
      }
    >
      {invoices.isLoading || invoices.isError ? (
        <StateMessage
          loading={invoices.isLoading}
          error={invoices.isError ? errorMessage(invoices.error) : null}
          onRetry={() => void invoices.refetch()}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Mã hóa đơn</Th>
                <Th>Hội viên</Th>
                <Th>Loại</Th>
                <Th>Thanh toán</Th>
                <Th className="text-right">Số tiền</Th>
                <Th>Thời gian</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <EmptyRow colSpan={6}>Chưa có hóa đơn.</EmptyRow>
              ) : (
                visible.map((i) => (
                  <tr key={i.id}>
                    <Td className="font-mono text-xs">{i.invoiceCode}</Td>
                    <Td>{memberName(i.subscription?.userId)}</Td>
                    <Td>{invoiceTypeLabel[i.type] ?? i.type}</Td>
                    <Td>
                      {paymentMethodLabel[i.paymentMethod] ?? i.paymentMethod}
                      {i.status !== 'PAID' ? (
                        <span className="ml-1.5">
                          <Pill tone="amber">{i.status}</Pill>
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-right tabular-nums">{money(i.amount)}</Td>
                    <Td className="whitespace-nowrap">{formatDateTime(i.createdAt)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <Pagination pager={pager} note="Hệ thống trả 200 hóa đơn gần nhất." />
        </>
      )}
    </Panel>
  )
}
