import { useId } from 'react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '@/components/ui/card'
import {
  formatDelta,
  formatMeasurementDate,
  formatMetric,
  inbodyMetrics,
  type InbodyMetric,
  type Measurement,
} from './inbody-data'
import { InbodyVisualBoundary } from './inbody-visual-boundary'

/** One shade of green per metric, dark to light, so the four charts read as one family. */
const SHADE: Record<InbodyMetric['key'], string> = {
  weightKg: '#2f5014',
  bodyFatPct: '#4b800e',
  muscleMassKg: '#55910e',
  bmi: '#70ac0f',
}
const shortDate = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})
const timeFormat = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Ho_Chi_Minh',
})

interface Point {
  /** Position on the x axis: measurements are spaced evenly, so several on one day stay apart. */
  index: number
  timestamp: number
  value: number | null
}

function MetricChart({
  metric,
  measurements,
}: {
  metric: InbodyMetric
  measurements: Measurement[]
}) {
  const descriptionId = useId()
  // useId contains characters that break url(#id), so keep only safe ones for the gradient.
  const gradientId = `inbody-fill-${descriptionId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const color = SHADE[metric.key]
  const data: Point[] = measurements.map((item, index) => ({
    index,
    timestamp: item.timestamp!,
    value: item[metric.key],
  }))
  const available = data.filter((item) => item.value !== null)
  const first = available[0]
  const latest = available.at(-1)
  // When two measurements share a date, the time tells them apart in the tooltip.
  const dates = data.map((item) => formatMeasurementDate(item.timestamp))
  const sameDay = new Set(dates.filter((date, i) => dates.indexOf(date) !== i))
  const pointLabel = (point: Point | undefined) => {
    if (!point) return ''
    const date = formatMeasurementDate(point.timestamp)
    return sameDay.has(date) ? `${date} ${timeFormat.format(point.timestamp)}` : date
  }
  const summary =
    available.length === 0
      ? `Chưa có dữ liệu ${metric.label.toLowerCase()} để hiển thị biểu đồ.`
      : `${metric.label}: ${available.length} lần đo có dữ liệu, từ ${formatMetric(first!.value, metric.unit)} đến ${formatMetric(latest!.value, metric.unit)}.`

  return (
    <section
      aria-label={`Biểu đồ ${metric.label.toLowerCase()}`}
      className="inbody-metric-row rounded-2xl border border-slate-100 bg-white p-3"
    >
      <div className="min-w-0">
        <h3 className="m-0 flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-500">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="truncate">{metric.label}</span>
        </h3>
        <p className="m-0 mt-1 text-lg font-semibold leading-tight tabular-nums text-slate-900">
          {formatMetric(latest?.value ?? null, metric.unit)}
        </p>
        <p className="m-0 min-h-4 text-[11px] tabular-nums text-slate-500">
          {latest && first && available.length > 1
            ? formatDelta(latest.value, first.value, metric.deltaUnit)
            : null}
        </p>
      </div>
      <p id={descriptionId} className="sr-only">
        {summary}
      </p>
      {available.length > 0 ? (
        <InbodyVisualBoundary
          fallback={<p className="m-0 text-xs text-slate-500">Không thể hiển thị biểu đồ.</p>}
        >
          <div className="inbody-chart-plot" aria-describedby={descriptionId}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={color} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="index"
                  type="number"
                  domain={[0, Math.max(data.length - 1, 1)]}
                  ticks={data.length > 1 ? [0, data.length - 1] : [0]}
                  tickFormatter={(index: number) => {
                    const timestamp = data[index]?.timestamp
                    return timestamp == null ? '' : shortDate.format(timestamp)
                  }}
                  tick={{ fontSize: 10, fill: '#94a3b8', dy: 2 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  padding={{ left: 14, right: 14 }}
                />
                {/* Hidden axis: keeps the curve fitted to the data; values are in the header and tooltip. */}
                <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                <Tooltip
                  cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                  labelFormatter={(index) => pointLabel(data[Number(index)])}
                  formatter={(value) => [
                    formatMetric(typeof value === 'number' ? value : null, metric.unit),
                    metric.label,
                  ]}
                  contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0', fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={metric.label}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: color }}
                  connectNulls
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </InbodyVisualBoundary>
      ) : (
        <p className="inbody-chart-plot m-0 flex items-center justify-center rounded-xl bg-slate-50 px-3 text-center text-xs text-slate-500">
          {summary}
        </p>
      )}
    </section>
  )
}

export default function InbodyProgressChart({ measurements }: { measurements: Measurement[] }) {
  return (
    <Card
      role="region"
      aria-label="Sơ đồ quá trình cải thiện"
      className="inbody-visual-card flex flex-col"
    >
      <div className="mb-4">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">
          Sơ đồ quá trình cải thiện
        </h2>
        <p className="mb-0 mt-1 text-xs text-slate-500">
          Mỗi điểm là một lần đo · thay đổi tính từ lần đo đầu tiên
        </p>
      </div>
      <div className="inbody-chart-grid">
        {inbodyMetrics.map((metric) => (
          <MetricChart key={metric.key} metric={metric} measurements={measurements} />
        ))}
      </div>
      {measurements.length === 1 && (
        <p className="mb-0 mt-3 text-xs text-slate-500">Cần thêm lần đo để xem xu hướng.</p>
      )}
    </Card>
  )
}
