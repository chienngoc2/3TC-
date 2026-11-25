import { lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'
import { useSession } from '@/auth/session-context'
import { StateMessage } from '@/components/feedback/state-message'
import { Card } from '@/components/ui/card'
import { get } from '@/lib/api'
import type { InbodyLog } from '@/lib/types'
import { InbodyBodyMap } from '../components/inbody/inbody-body-map'
import { InbodyMetricCard } from '../components/inbody/inbody-metric-card'
import { InbodyShapeCard } from '../components/inbody/inbody-shape-card'
import { useBodyGender } from '../components/inbody/body-map/use-body-gender'
import { InbodyComparison } from '../components/inbody/inbody-comparison'
import { InbodyHistory } from '../components/inbody/inbody-history'
import { InbodyVisualBoundary } from '../components/inbody/inbody-visual-boundary'
import {
  formatMeasurementDate,
  inbodyMetrics,
  prepareMeasurements,
} from '../components/inbody/inbody-data'
import '../components/inbody/inbody.css'

const InbodyProgressChart = lazy(() => import('../components/inbody/inbody-progress-chart'))

export const ProgressPage = () => {
  const { user } = useSession()
  const progress = useQuery({
    queryKey: ['member', user?.id, 'progress'],
    queryFn: () => get<{ logs: InbodyLog[] }>('/inbody/my-progress'),
    enabled: !!user,
  })
  const { history, chronological, undatedCount } = prepareMeasurements(progress.data?.logs)
  const latest = chronological.at(-1)
  const previous = chronological.at(-2)
  const first = chronological[0]
  const bodyGender = useBodyGender(user?.id, user?.gender)

  return (
    <div className="inbody-dashboard relative isolate mx-auto min-w-0 max-w-6xl overflow-hidden rounded-3xl bg-slate-50 p-4 sm:p-6">
      {/* <div
        className="inbody-backdrop"
        style={{ backgroundImage: `url("${gymFacility}")` }}
      /> */}
      <div className="relative">
        <div aria-live="polite" aria-busy={progress.isPending}>
          <StateMessage
            loading={progress.isPending}
            error={progress.error}
            empty={progress.isSuccess && history.length === 0}
            emptyText="Bạn chưa có lần đo InBody nào. Các chỉ số sẽ xuất hiện sau lần đo đầu tiên."
            onRetry={() => void progress.refetch()}
          />
        </div>
        {progress.isSuccess && (
          <div className="space-y-5 sm:space-y-6">
            {undatedCount > 0 && (
              <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                {undatedCount} bản ghi chưa có ngày đo hợp lệ, vẫn được giữ trong lịch sử. Tổng quan
                và xu hướng chỉ sử dụng các lần đo có ngày hợp lệ.
              </p>
            )}
            <section aria-label="Tổng quan và quá trình cải thiện" className="inbody-overview">
              <InbodyBodyMap measurements={chronological} bodyGender={bodyGender} />
              {/* Right column: the four trend charts, then the C/I/D shape of the latest visit. */}
              <div className="inbody-overview-side">
                <InbodyVisualBoundary
                  fallback={
                    <Card
                      role="status"
                      className="inbody-visual-card flex items-center justify-center text-center text-sm text-slate-500"
                    >
                      Không thể hiển thị biểu đồ. Xem các chỉ số trong bảng lịch sử bên dưới.
                    </Card>
                  }
                >
                  <Suspense
                    fallback={
                      <Card
                        role="status"
                        className="inbody-visual-card animate-pulse text-sm text-slate-500"
                      >
                        Đang tải biểu đồ...
                      </Card>
                    }
                  >
                    <InbodyProgressChart measurements={chronological} />
                  </Suspense>
                </InbodyVisualBoundary>
                {latest && <InbodyShapeCard measurement={latest} gender={bodyGender.gender} />}
              </div>
            </section>
            <Card
              role="region"
              aria-label="Lần đo mới nhất"
              className="min-w-0 rounded-3xl p-4 sm:p-6"
            >
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">
                    Lần đo mới nhất
                  </h2>
                  <p className="mt-2 text-xs text-slate-500">Các chỉ số được ghi nhận từ InBody.</p>
                </div>
                {latest && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatMeasurementDate(latest.timestamp)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                {inbodyMetrics.map((metric) => (
                  <InbodyMetricCard
                    key={metric.key}
                    metric={metric}
                    current={latest?.[metric.key] ?? null}
                    previous={previous?.[metric.key] ?? null}
                  />
                ))}
              </div>
              <p className="mt-5 text-xs leading-relaxed text-slate-500">
                {latest
                  ? 'Thay đổi được so với lần đo liền trước. Dấu — biểu thị chỉ số chưa được cung cấp.'
                  : 'Chưa có lần đo hợp lệ để hiển thị chỉ số mới nhất.'}
              </p>
            </Card>
            {first && latest && chronological.length >= 2 && (
              <InbodyComparison first={first} current={latest} />
            )}
            <InbodyHistory measurements={history} latestKey={latest?.key} />
          </div>
        )}
      </div>
    </div>
  )
}

export default ProgressPage
