import { Card } from '@/components/ui/card'
import { formatMeasurementDate, formatMetric, inbodyMetrics, type Measurement } from './inbody-data'

export function InbodyHistory({
  measurements,
  latestKey,
}: {
  measurements: Measurement[]
  latestKey?: string
}) {
  return (
    <Card role="region" aria-label="Lịch sử InBody" className="min-w-0 rounded-3xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight text-slate-900">Lịch sử InBody</h2>
        <span className="text-xs text-slate-500">{measurements.length} lần đo</span>
      </div>
      {measurements.length === 0 ? (
        <p className="mb-0 text-sm text-slate-500">Chưa có dữ liệu lịch sử.</p>
      ) : (
        <div
          role="region"
          aria-label="Bảng lịch sử InBody"
          tabIndex={0}
          className="min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17664e]"
        >
          <table className="inbody-history-table text-sm tabular-nums">
            <caption className="sr-only">
              Các lần đo InBody, mới nhất trước. Chỉ số chưa được cung cấp hiển thị dấu —.
            </caption>
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="whitespace-nowrap">
                  Ngày đo
                </th>
                {inbodyMetrics.map((metric) => (
                  <th scope="col" key={metric.key} className="whitespace-nowrap">
                    {metric.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {measurements.map((item) => (
                <tr
                  key={item.key}
                  className={item.key === latestKey ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'}
                >
                  <th scope="row" className="font-medium text-slate-700">
                    <span className="whitespace-nowrap">
                      {formatMeasurementDate(item.timestamp)}
                    </span>
                    {item.key === latestKey && (
                      <span className="ml-2 inline-block whitespace-nowrap rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-800">
                        Mới nhất
                      </span>
                    )}
                  </th>
                  {inbodyMetrics.map((metric) => (
                    <td
                      key={metric.key}
                      data-label={metric.label}
                      className="whitespace-nowrap text-slate-600"
                    >
                      {formatMetric(item[metric.key], metric.unit)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
