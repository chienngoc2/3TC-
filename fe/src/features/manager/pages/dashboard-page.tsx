import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import {
  DollarSign,
  UserPlus,
  DoorOpen,
  ClipboardList,
  TrendingUp,
  Award,
  Calendar,
  ChevronRight,
} from 'lucide-react'
import { money } from '@/lib/api'
import { managerApi, managerKeys } from '../api/manager-api'
import type { Invoice } from '../types/manager.types'
import {
  addDaysToDay,
  errorMessage,
  formatDateTime,
  formatDay,
  percent,
  vnDay,
} from '../lib/format'
import { RevenueChart, type DayRevenue } from '../components/revenue-chart'
import { DatePickerDialog } from '../components/date-picker-dialog'
import {
  EmptyRow,
  PageHeader,
  Panel,
  StateMessage,
  Table,
  Td,
  Th,
} from '../components/manager-ui'

/** GET /billing/invoices returns at most this many, newest first. */
const INVOICE_CAP = 200

/** PT part of an invoice; the rest is the base plan. PT add-ons may not carry ptAmount. */
function split(invoice: Invoice) {
  const amount = Number(invoice.amount)
  const pt = Number(invoice.ptAmount ?? 0) || (invoice.type === 'PT_ADDON' ? amount : 0)
  return { base: amount - pt, pt }
}

/** Daily paid revenue between `startDate` and `endDate` (Vietnam time), oldest first. */
function dailyRevenueByRange(invoices: Invoice[], startDate: string, endDate: string): DayRevenue[] {
  const start = startDate <= endDate ? startDate : endDate
  const end = startDate <= endDate ? endDate : startDate
  const paid = invoices.filter((i) => i.status === 'PAID')
  const oldest =
    invoices.length >= INVOICE_CAP ? vnDay(invoices[invoices.length - 1].createdAt) : null
  const rows = new Map<string, DayRevenue>()

  let curr = start
  let safety = 0
  while (curr <= end && safety <= 366) {
    rows.set(curr, { day: curr, base: 0, pt: 0, invoices: 0, complete: !oldest || curr > oldest })
    curr = addDaysToDay(curr, 1)
    safety++
  }

  for (const invoice of paid) {
    const day = vnDay(invoice.createdAt)
    const row = rows.get(day)
    if (!row) continue
    const { base, pt } = split(invoice)
    row.base += base
    row.pt += pt
    row.invoices += 1
  }
  return [...rows.values()]
}

function RevenueTrend() {
  const invoices = useQuery({ queryKey: managerKeys.invoices, queryFn: managerApi.invoices })
  const today = vnDay()
  // Default range: 14 days up to today
  const [startDate, setStartDate] = useState(() => addDaysToDay(today, -13))
  const [endDate, setEndDate] = useState(() => today)
  const [isStartPickerOpen, setIsStartPickerOpen] = useState(false)
  const [isEndPickerOpen, setIsEndPickerOpen] = useState(false)
  const [asTable, setAsTable] = useState(false)

  const data = dailyRevenueByRange(invoices.data ?? [], startDate, endDate)
  const base = data.reduce((sum, d) => sum + d.base, 0)
  const pt = data.reduce((sum, d) => sum + d.pt, 0)
  const count = data.reduce((sum, d) => sum + d.invoices, 0)
  const firstComplete = data.find((d) => d.complete)?.day
  const partial = data.some((d) => !d.complete)

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#17664e] border border-emerald-100">
              <TrendingUp className="h-4.5 w-4.5" />
            </span>
            <h2 className="text-base font-black text-slate-900">Doanh thu theo ngày</h2>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-extrabold tabular-nums text-slate-900 font-mono">
            {money(base + pt)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Từ <span className="font-bold text-slate-700">{formatDay(startDate)}</span> đến{' '}
            <span className="font-bold text-slate-700">{formatDay(endDate)}</span> ({data.length} ngày), tổng cộng {count} hóa đơn (Hội viên: {money(base)} · PT: {money(pt)}).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Range Selector with 2 Calendar Dialog Triggers */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl">
            {/* Start Date Button */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase px-1">Từ:</span>
              <button
                type="button"
                onClick={() => setIsStartPickerOpen(true)}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 transition-all cursor-pointer group"
                title="Bấm để mở lịch chọn ngày bắt đầu"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>{formatDay(startDate)}</span>
              </button>
            </div>

            <span className="text-slate-300 font-bold">➔</span>

            {/* End Date Button */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase px-1">Đến:</span>
              <button
                type="button"
                onClick={() => setIsEndPickerOpen(true)}
                className="flex items-center gap-2 bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-xs rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 transition-all cursor-pointer group"
                title="Bấm để mở lịch chọn ngày kết thúc"
              >
                <Calendar className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>{formatDay(endDate)}</span>
              </button>
            </div>

            {/* Quick reset to today button if desired */}
            {(startDate !== addDaysToDay(today, -13) || endDate !== today) && (
              <button
                type="button"
                onClick={() => {
                  setStartDate(addDaysToDay(today, -13))
                  setEndDate(today)
                }}
                className="text-[11px] text-slate-500 hover:text-emerald-700 underline px-1.5 font-medium cursor-pointer"
                title="Đặt lại 14 ngày gần nhất"
              >
                14 ngày gần nhất
              </button>
            )}
          </div>

          {/* Toggle View */}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
          >
            {asTable ? '📊 Xem biểu đồ cột' : '📋 Xem dạng bảng'}
          </button>
        </div>
      </div>

      {/* Date Picker Dialog for Start Date */}
      <DatePickerDialog
        isOpen={isStartPickerOpen}
        onClose={() => setIsStartPickerOpen(false)}
        value={startDate}
        onChange={(newDate) => {
          setStartDate(newDate)
          if (newDate > endDate) {
            setEndDate(newDate)
          }
        }}
        title="Chọn ngày bắt đầu (Từ ngày)"
        maxDate={endDate}
      />

      {/* Date Picker Dialog for End Date */}
      <DatePickerDialog
        isOpen={isEndPickerOpen}
        onClose={() => setIsEndPickerOpen(false)}
        value={endDate}
        onChange={(newDate) => {
          setEndDate(newDate)
          if (newDate < startDate) {
            setStartDate(newDate)
          }
        }}
        title="Chọn ngày kết thúc (Đến ngày)"
        minDate={startDate}
      />

      {invoices.isLoading || invoices.isError ? (
        <StateMessage
          loading={invoices.isLoading}
          error={invoices.isError ? errorMessage(invoices.error) : null}
          onRetry={() => void invoices.refetch()}
        />
      ) : asTable ? (
        <div className="max-h-80 overflow-y-auto">
          <Table>
            <thead>
              <tr>
                <Th>Ngày</Th>
                <Th className="text-right">Gói cơ bản</Th>
                <Th className="text-right">PT</Th>
                <Th className="text-right">Tổng</Th>
                <Th className="text-right">Hóa đơn</Th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day}>
                  <Td className="whitespace-nowrap font-medium">
                    {formatDay(d.day)}
                    {d.complete ? null : (
                      <span className="ml-1 text-xs text-amber-700">(có thể thiếu)</span>
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{money(d.base)}</Td>
                  <Td className="text-right tabular-nums">{money(d.pt)}</Td>
                  <Td className="text-right font-bold tabular-nums text-emerald-700">
                    {money(d.base + d.pt)}
                  </Td>
                  <Td className="text-right tabular-nums">{d.invoices}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="pt-2">
          <RevenueChart data={data} />
        </div>
      )}

      <p className="border-t border-slate-100 pt-3 mt-3 text-xs text-slate-400">
        Tính từ hóa đơn đã thanh toán thành công theo giờ Việt Nam.
        {partial && firstComplete
          ? ` Hệ thống hiển thị tối đa ${INVOICE_CAP} hóa đơn gần nhất.`
          : ''}
      </p>
    </div>
  )
}

export function ManagerDashboardPage() {
  const summary = useQuery({ queryKey: managerKeys.summary, queryFn: managerApi.summary })
  const revenue = useQuery({ queryKey: managerKeys.revenue, queryFn: managerApi.revenue })
  const requests = useQuery({
    queryKey: managerKeys.cancellations,
    queryFn: managerApi.cancellations,
  })
  const staff = useQuery({ queryKey: managerKeys.staff, queryFn: managerApi.staff })
  const disciplines = useQuery({
    queryKey: managerKeys.disciplines,
    queryFn: managerApi.disciplines,
  })

  const coachName = new Map((staff.data ?? []).map((user) => [user.id, user.fullName]))
  const pending = (requests.data ?? []).filter(
    (item) => item.status === 'PENDING' && item.substitutionStatus !== 'ACCEPTED',
  )
  const s = summary.data
  const r = revenue.data
  const byDiscipline = Object.entries(r?.byDiscipline ?? {}).sort((a, b) => b[1] - a[1])
  const topDiscipline = byDiscipline[0]?.[1] ?? 0
  const disciplineName = (code: string) =>
    code === 'UNSPECIFIED'
      ? 'Chưa phân môn'
      : (disciplines.data?.find((d) => d.code.toUpperCase() === code.toUpperCase())?.name ?? code)

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Tổng quan Trung tâm"
        description={s ? `Số liệu vận hành ngày ${formatDay(s.date)}` : 'Số liệu hoạt động trong ngày'}
      />

      {summary.isError ? (
        <Panel className="mb-4">
          <StateMessage
            error={errorMessage(summary.error)}
            onRetry={() => void summary.refetch()}
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {/* Card 1: Doanh thu */}
          <div className="rounded-md border border-slate-200/90 bg-slate-50/70 p-4 transition-all hover:border-slate-300 hover:shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Doanh thu hôm nay</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-100/70 text-[#17664e]">
                <DollarSign className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 font-mono">
              {s ? money(s.dailyRevenue) : '…'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Đã chốt thanh toán</p>
          </div>

          {/* Card 2: Hội viên mới */}
          <div className="rounded-md border border-slate-200/90 bg-slate-50/70 p-4 transition-all hover:border-slate-300 hover:shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Hội viên mới</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-sky-100/70 text-sky-700">
                <UserPlus className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 font-mono">
              {s?.newMembers ?? '…'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Đăng ký trong ngày</p>
          </div>

          {/* Card 3: Lượt vào cổng */}
          <div className="rounded-md border border-slate-200/90 bg-slate-50/70 p-4 transition-all hover:border-slate-300 hover:shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Lượt vào cổng</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-violet-100/70 text-violet-700">
                <DoorOpen className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 font-mono">
              {s?.gateEntries ?? '…'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Check-in tự động & quầy</p>
          </div>

          {/* Card 4: Đơn hủy ca */}
          <div className="rounded-md border border-slate-200/90 bg-slate-50/70 p-4 transition-all hover:border-slate-300 hover:shadow-2xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Hủy ca chờ duyệt</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-100/70 text-amber-700">
                <ClipboardList className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-slate-900 font-mono">
              {s?.pendingCancellations ?? '…'}
            </p>
            <p className="text-[11px] text-amber-700 font-semibold mt-1">
              {(s?.pendingCancellations ?? 0) > 0 ? 'Cần xử lý phê duyệt' : 'Đã duyệt hết'}
            </p>
          </div>
        </div>
      )}

      {/* Revenue Trend Chart */}
      <RevenueTrend />

      {/* Bottom 2 Columns: Pending Requests & Discipline Revenue */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* Pending Requests Table */}
        <div className="rounded-md border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#17664e]" />
              <h2 className="text-sm font-bold text-slate-900">Đơn hủy ca chờ duyệt gần đây</h2>
            </div>
            <Link
              to="/portal/manager/penalties"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#17664e] hover:text-[#135641]"
            >
              Xem tất cả ({pending.length})
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {requests.isLoading || requests.isError ? (
            <StateMessage
              loading={requests.isLoading}
              error={requests.isError ? errorMessage(requests.error) : null}
              onRetry={() => void requests.refetch()}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>HLV</Th>
                  <Th>Loại</Th>
                  <Th>Lý do</Th>
                  <Th>Gửi lúc</Th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <EmptyRow colSpan={4}>Không có đơn hủy ca nào đang chờ duyệt.</EmptyRow>
                ) : (
                  pending.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <Td className="font-semibold text-slate-900">
                        {coachName.get(item.coachId) ?? 'HLV'}
                      </Td>
                      <Td>{item.targetType === 'GROUP_CLASS' ? 'Lớp nhóm' : 'PT 1-1'}</Td>
                      <Td className="max-w-[240px] truncate">{item.reasonMessage}</Td>
                      <Td className="whitespace-nowrap text-slate-500">
                        {formatDateTime(item.createdAt)}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </div>

        {/* Revenue by Discipline */}
        <div className="rounded-md border border-slate-200/90 bg-white p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#17664e]" />
              <h2 className="text-sm font-bold text-slate-900">Doanh thu theo bộ môn</h2>
            </div>
            <Link
              to="/portal/manager/reports"
              className="inline-flex items-center gap-1 text-xs font-bold text-[#17664e] hover:text-[#135641]"
            >
              Báo cáo chi tiết
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {revenue.isLoading || revenue.isError ? (
            <StateMessage
              loading={revenue.isLoading}
              error={revenue.isError ? errorMessage(revenue.error) : null}
              onRetry={() => void revenue.refetch()}
            />
          ) : r ? (
            <div>
              <div className="mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Tổng doanh thu lũy kế:
                </span>
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {money(r.totalRevenue)}
                </span>
              </div>

              {byDiscipline.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Chưa có giao dịch theo môn.</p>
              ) : (
                <ul className="space-y-3.5">
                  {byDiscipline.map(([code, amount]) => (
                    <li key={code} className="space-y-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-slate-800">{disciplineName(code)}</span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono font-bold text-slate-900">{money(amount)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {r.totalRevenue ? percent(amount / r.totalRevenue) : '0%'}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#17664e] transition-all duration-300"
                          style={{
                            width: `${topDiscipline ? Math.max(3, (amount / topDiscipline) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ManagerDashboardPage
