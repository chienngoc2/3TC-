import { ArrowRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  formatDelta,
  formatMeasurementDate,
  formatMetric,
  inbodyMetrics,
  type Measurement,
} from './inbody-data'

export function InbodyComparison({ first, current }: { first: Measurement; current: Measurement }) {
  return (
    <Card role="region" aria-label="So sánh các lần đo" className="min-w-0 rounded-3xl p-4 sm:p-6">
      <h2 className="text-lg font-bold tracking-tight text-slate-900">So sánh</h2>
      <p className="mb-0 mt-2 text-sm font-medium text-slate-600">
        Lần đo đầu tiên <span className="font-normal text-slate-400">vs</span> Hiện tại
      </p>
      <p className="mb-6 mt-2 text-xs text-slate-500">
        {formatMeasurementDate(first.timestamp)} → {formatMeasurementDate(current.timestamp)}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {inbodyMetrics.map((metric) => (
          <div
            key={metric.key}
            className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50 p-4"
          >
            <h3 className="mb-3 text-xs font-semibold text-slate-500">{metric.label}</h3>
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span>{formatMetric(first[metric.key], metric.unit)}</span>
              <ArrowRight className="h-3 w-3 text-slate-400" aria-label="đến" />
              <span className="font-semibold text-slate-900">
                {formatMetric(current[metric.key], metric.unit)}
              </span>
            </p>
            <p className="mb-0 text-lg font-semibold tabular-nums text-slate-800">
              {formatDelta(current[metric.key], first[metric.key], metric.deltaUnit)}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
