import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { money } from '@/lib/api'
import { formatDay } from '../lib/format'
import { Award, Layers, BarChart3, DollarSign } from 'lucide-react'

export interface DayRevenue {
  /** YYYY-MM-DD in Vietnam time. */
  day: string
  base: number
  pt: number
  invoices: number
  /** False for days older than the oldest invoice the API returned. */
  complete: boolean
}

/** Format currency ticks into Vietnamese compact form: 500k, 1,2 tr, 10 tr */
function compactVnd(value: number): string {
  if (value >= 1e6) {
    const tr = value / 1e6
    return `${Number(tr.toFixed(1)).toLocaleString('vi-VN')} tr`
  }
  if (value >= 1e3) {
    return `${Math.round(value / 1e3)}k`
  }
  return String(value)
}

/** Get Vietnamese Day of Week name from YYYY-MM-DD */
function getWeekdayName(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00Z`)
    const day = d.getUTCDay()
    const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
    return names[day] || ''
  } catch {
    return ''
  }
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null

  const item: DayRevenue = payload[0]?.payload
  if (!item) return null

  const total = item.base + item.pt
  const weekday = getWeekdayName(item.day)
  const basePercent = total > 0 ? Math.round((item.base / total) * 100) : 0
  const ptPercent = total > 0 ? Math.round((item.pt / total) * 100) : 0

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md min-w-[240px] space-y-3 animate-in fade-in zoom-in-95 duration-100">
      {/* Date Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
        <div>
          <span className="text-[11px] font-bold text-slate-400 block">{weekday}</span>
          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
            {formatDay(item.day)}
          </span>
        </div>
        <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300">
          {item.invoices} hóa đơn
        </span>
      </div>

      {/* Breakdown Rows */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-[#17664e] shrink-0" />
            <span>Gói tập hội viên:</span>
          </span>
          <div className="text-right">
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {money(item.base)}
            </span>
            {total > 0 && (
              <span className="text-[10px] text-slate-400 ml-1.5 font-semibold">({basePercent}%)</span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-[#f97316] shrink-0" />
            <span>Kèm riêng PT 1:1:</span>
          </span>
          <div className="text-right">
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {money(item.pt)}
            </span>
            {total > 0 && (
              <span className="text-[10px] text-slate-400 ml-1.5 font-semibold">({ptPercent}%)</span>
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-2 flex items-center justify-between">
          <span className="font-extrabold text-slate-800 dark:text-slate-200">Tổng doanh thu:</span>
          <span className="font-black text-sm text-[#17664e] dark:text-emerald-400 tabular-nums font-mono">
            {money(total)}
          </span>
        </div>

        {!item.complete && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 pt-0.5 italic font-medium">
            * Dữ liệu có thể thiếu do chạm giới hạn lưu trữ
          </p>
        )}
      </div>
    </div>
  )
}

export function RevenueChart({ data }: { data: DayRevenue[] }) {
  const [chartMode, setChartMode] = useState<'stacked' | 'grouped'>('stacked')

  const chartData = useMemo(() => {
    return data.map((d) => {
      // In Vietnam, DD/MM is the standard readable format
      const parts = d.day.split('-')
      const shortDay = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.day.slice(5)
      return {
        ...d,
        shortDay,
        total: d.base + d.pt,
      }
    })
  }, [data])

  const totals = useMemo(() => {
    const totalBase = data.reduce((acc, d) => acc + d.base, 0)
    const totalPt = data.reduce((acc, d) => acc + d.pt, 0)
    const totalRevenue = totalBase + totalPt
    const totalInvoices = data.reduce((acc, d) => acc + d.invoices, 0)
    const avgPerDay = data.length > 0 ? Math.round(totalRevenue / data.length) : 0

    let peak = { day: '—', total: 0 }
    for (const d of data) {
      const sum = d.base + d.pt
      if (sum > peak.total) {
        peak = { day: formatDay(d.day), total: sum }
      }
    }

    return {
      totalBase,
      totalPt,
      totalRevenue,
      totalInvoices,
      avgPerDay,
      peak,
      basePercent: totalRevenue > 0 ? Math.round((totalBase / totalRevenue) * 100) : 0,
      ptPercent: totalRevenue > 0 ? Math.round((totalPt / totalRevenue) * 100) : 0,
    }
  }, [data])

  const maxVal = useMemo(() => {
    if (chartMode === 'grouped') {
      return Math.max(...data.map((d) => Math.max(d.base, d.pt)), 1000000)
    }
    return Math.max(...data.map((d) => d.base + d.pt), 1000000)
  }, [data, chartMode])

  // Bar width adapts depending on number of days
  const maxBarWidth = data.length <= 10 ? 36 : data.length <= 20 ? 26 : 18

  return (
    <div className="w-full space-y-4">
      {/* Mini KPI Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tổng thu kỳ này</span>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-900 dark:text-emerald-300 font-mono tabular-nums">
            {money(totals.totalRevenue)}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#17664e]" />
              Gói Hội Viên
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">{totals.basePercent}%</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {money(totals.totalBase)}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-3 space-y-1">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#f97316]" />
              Kèm PT 1:1
            </span>
            <span className="text-orange-600 font-extrabold">{totals.ptPercent}%</span>
          </div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums">
            {money(totals.totalPt)}
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Ngày đạt đỉnh</span>
          </div>
          <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 font-mono tabular-nums truncate">
            {totals.peak.total > 0 ? `${totals.peak.day} (${money(totals.peak.total)})` : 'Chưa có'}
          </div>
        </div>
      </div>

      {/* Chart Control & Legend Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Legends */}
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
            <span className="h-3 w-3 rounded-md bg-linear-to-b from-[#17664e] to-[#059669] shadow-2xs" />
            Gói tập hội viên
          </span>
          <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold">
            <span className="h-3 w-3 rounded-md bg-linear-to-b from-[#f97316] to-[#fb923c] shadow-2xs" />
            Buổi tập kèm PT 1:1
          </span>
        </div>

        {/* View Mode Toggle: Stacked vs Grouped */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setChartMode('stacked')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              chartMode === 'stacked'
                ? 'bg-white dark:bg-slate-900 text-[#17664e] dark:text-emerald-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Cột xếp chồng</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('grouped')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              chartMode === 'grouped'
                ? 'bg-white dark:bg-slate-900 text-[#17664e] dark:text-emerald-400 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <BarChart3 className="w-3 h-3" />
            <span>Cột so sánh</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[320px] sm:h-[350px] w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 16, right: 12, bottom: 8, left: 8 }}
            barGap={chartMode === 'grouped' ? 2 : 0}
          >
            <defs>
              {/* Emerald Gradient for Base */}
              <linearGradient id="colorBase" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#17664e" stopOpacity={1} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.75} />
              </linearGradient>

              {/* Orange Gradient for PT */}
              <linearGradient id="colorPt" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                <stop offset="100%" stopColor="#fb923c" stopOpacity={0.75} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="4 4"
              vertical={false}
              stroke="#e2e8f0"
              strokeOpacity={0.6}
            />

            <XAxis
              dataKey="shortDay"
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
              interval="preserveStartEnd"
              dy={6}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
              tickFormatter={compactVnd}
              domain={[0, Math.ceil(maxVal * 1.15)]}
              width={58}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(0, 139, 116, 0.05)', radius: 8 }}
            />

            {chartMode === 'stacked' ? (
              <>
                <Bar
                  dataKey="base"
                  stackId="revenue"
                  fill="url(#colorBase)"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={maxBarWidth}
                />
                <Bar
                  dataKey="pt"
                  stackId="revenue"
                  fill="url(#colorPt)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={maxBarWidth}
                />
              </>
            ) : (
              <>
                <Bar
                  dataKey="base"
                  fill="url(#colorBase)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={maxBarWidth}
                />
                <Bar
                  dataKey="pt"
                  fill="url(#colorPt)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={maxBarWidth}
                />
              </>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default RevenueChart
