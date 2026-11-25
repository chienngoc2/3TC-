import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatDelta, formatMetric, type InbodyMetric } from './inbody-data'

export function InbodyMetricCard({
  metric,
  current,
  previous,
}: {
  metric: InbodyMetric
  current: number | null
  previous: number | null
}) {
  const Icon = metric.icon
  const Trend =
    current !== null && previous !== null
      ? current > previous
        ? ArrowUpRight
        : current < previous
          ? ArrowDownRight
          : Minus
      : null
  return (
    <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-5">
      <div className="mb-4 flex min-h-10 items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4 shrink-0 text-[#17664e]" aria-hidden="true" />
        <h3 className="m-0 text-xs font-semibold leading-relaxed">{metric.label}</h3>
      </div>
      <p className="mb-3 break-words text-2xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-3xl">
        {formatMetric(current)}{' '}
        {current !== null && (
          <span className="text-sm font-medium text-slate-500">{metric.unit}</span>
        )}
      </p>
      <p className="mb-0 flex items-start gap-1 text-xs leading-relaxed text-slate-500">
        {Trend && <Trend className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <span>{formatDelta(current, previous, metric.deltaUnit)}</span>
      </p>
    </div>
  )
}
