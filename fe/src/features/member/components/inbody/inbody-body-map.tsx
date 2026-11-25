import { lazy, Suspense, useState } from 'react'
import { AlertTriangle, PersonStanding } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  SEGMENTS,
  SEGMENT_STATUS_COLOR,
  SEGMENT_STATUS_LABEL,
  limbImbalances,
  readSegment,
  standardsFor,
  type SegmentStatus,
} from '@/lib/inbody'
import type { Measurement } from './inbody-data'
import { formatMeasurementDate, formatMetric } from './inbody-data'
import { InbodyVisualBoundary } from './inbody-visual-boundary'
import type { BodySide } from './body-map/body-map-assets'
import { LEVEL_LABEL, assessBody } from './body-map/body-assessment'
import type { SegmentReadings } from './body-map/body-map-figure'
import type { BodyGenderState } from './body-map/use-body-gender'

// The SVG outlines are ~100 KB; keep them out of the page's first chunk.
const BodyMapFigure = lazy(() => import('./body-map/body-map-figure'))

const LEGEND: SegmentStatus[] = ['ideal', 'normal', 'under', 'alert']
const GENDER_HINT: Record<BodyGenderState['source'], string> = {
  profile: 'Dáng người theo giới tính trong hồ sơ của bạn.',
  override: 'Đang xem dáng khác với hồ sơ. Tải lại trang để về giới tính trong hồ sơ.',
  member: 'Hồ sơ chưa có giới tính. Lựa chọn Nam/Nữ được nhớ trên máy này.',
}

function Toggle<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          variant="outline"
          data-variant="outline"
          size="sm"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}

function Placeholder({ message }: { message: string }) {
  return (
    <div role="status" className="flex h-full flex-col items-center justify-center text-center">
      <PersonStanding className="h-24 w-16 text-slate-300" strokeWidth={1} aria-hidden="true" />
      <p className="mt-3 text-sm text-slate-500">{message}</p>
    </div>
  )
}

const LIMB_NAME = { ARMS: 'Tay', LEGS: 'Chân' } as const

export function InbodyBodyMap({
  measurements,
  bodyGender,
}: {
  /** Dated measurements, oldest first. */
  measurements: Measurement[]
  bodyGender: BodyGenderState
}) {
  const { gender } = bodyGender
  const [view, setView] = useState<BodySide>('front')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const index = Math.max(
    0,
    selectedKey === null
      ? measurements.length - 1
      : measurements.findIndex((m) => m.key === selectedKey),
  )
  const current = measurements[index] ?? null
  const previous = index > 0 ? measurements[index - 1] : null
  const assessment = assessBody(
    current ?? { weightKg: null, heightCm: null, bmi: null, bodyFatPct: null, muscleMassKg: null },
    gender,
  )
  const standards = standardsFor(current?.heightCm ?? null, gender)
  const readings: SegmentReadings = {}
  for (const segment of SEGMENTS) {
    const reading = current ? readSegment(current.segmentalLean, segment, standards) : null
    if (reading) readings[segment] = reading
  }
  const hasSegments = Object.keys(readings).length > 0
  const imbalances = current
    ? limbImbalances(current.segmentalLean).filter((item) => item.severity === 'SIGNIFICANT')
    : []

  return (
    <Card
      role="region"
      aria-label="Bản đồ cơ thể"
      className="inbody-visual-card flex flex-col overflow-hidden"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Bản đồ cơ thể</h2>
          <p className="mt-1 text-xs text-slate-500">
            {current
              ? `Lần đo ${formatMeasurementDate(current.timestamp)}`
              : 'Chưa có lần đo hợp lệ'}
          </p>
        </div>
        {measurements.length > 1 ? (
          <label className="flex items-center gap-2 text-xs text-slate-500">
            Lần đo
            <select
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
              value={current?.key ?? ''}
              onChange={(event) => setSelectedKey(event.target.value)}
            >
              {[...measurements].reverse().map((m) => (
                <option key={m.key} value={m.key}>
                  {formatMeasurementDate(m.timestamp)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <div className="mb-2 flex flex-wrap gap-3">
        <Toggle
          label="Mặt hiển thị"
          value={view}
          onChange={setView}
          options={[
            { value: 'front', label: 'Mặt trước' },
            { value: 'back', label: 'Mặt sau' },
          ]}
        />
        <Toggle
          label="Dáng người"
          value={gender}
          onChange={bodyGender.choose}
          options={[
            { value: 'male', label: 'Nam' },
            { value: 'female', label: 'Nữ' },
          ]}
        />
      </div>
      <p className="mb-3 mt-0 text-xs text-slate-500">{GENDER_HINT[bodyGender.source]}</p>

      {imbalances.length > 0 ? (
        <p
          role="note"
          className="mb-3 mt-0 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {imbalances
              .map(
                (item) =>
                  `${LIMB_NAME[item.zone]} ${item.weakerSide === 'LEFT' ? 'trái' : 'phải'} yếu hơn bên còn lại ${formatMetric(item.imbalancePct)}%`,
              )
              .join('. ')}
            . Nên ưu tiên bài tập từng bên.
          </span>
        </p>
      ) : null}

      <div className="inbody-body-stage relative rounded-2xl border border-slate-100 bg-slate-50 p-3">
        <InbodyVisualBoundary fallback={<Placeholder message="Không thể hiển thị sơ đồ cơ thể." />}>
          <Suspense fallback={<Placeholder message="Đang tải sơ đồ cơ thể..." />}>
            <BodyMapFigure
              gender={gender}
              view={view}
              assessment={assessment}
              readings={readings}
              current={current}
              previous={previous}
            />
          </Suspense>
        </InbodyVisualBoundary>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-slate-500">BMI</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {assessment.bmi === null ? '—' : formatMetric(Math.round(assessment.bmi * 10) / 10)}
          </dd>
          <dd className="text-slate-500">
            {assessment.bmiLevel ? LEVEL_LABEL.bmi[assessment.bmiLevel] : 'Chưa đủ dữ liệu'}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-slate-500">Mỡ cơ thể</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {formatMetric(current?.bodyFatPct ?? null, '%')}
          </dd>
          <dd className="text-slate-500">
            {assessment.fatLevel ? LEVEL_LABEL.fat[assessment.fatLevel] : 'Chưa đủ dữ liệu'}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <dt className="text-slate-500">Tỷ lệ cơ</dt>
          <dd className="mt-0.5 font-semibold text-slate-900">
            {assessment.muscleRatio === null ? '—' : `${Math.round(assessment.muscleRatio * 100)}%`}
          </dd>
          <dd className="text-slate-500">
            {assessment.muscleLevel
              ? LEVEL_LABEL.muscle[assessment.muscleLevel]
              : 'Chưa đủ dữ liệu'}
          </dd>
        </div>
      </dl>

      <div
        className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500"
        aria-hidden="true"
      >
        {LEGEND.map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: SEGMENT_STATUS_COLOR[status] }}
            />
            {SEGMENT_STATUS_LABEL[status]}
          </span>
        ))}
      </div>
      <p className="mb-0 mt-3 text-xs leading-relaxed text-slate-500">
        {hasSegments
          ? 'Màu từng vùng theo khối cơ so với mức chuẩn của chiều cao; đỏ là dưới 80% chuẩn hoặc yếu hơn bên đối diện trên 8%.'
          : 'Lần đo này chưa có số đo từng vùng, nên toàn bộ cơ được tô theo tỷ lệ cơ trên cân nặng.'}{' '}
        Độ rộng dáng người theo BMI và % mỡ. Rê chuột hoặc dùng phím Tab vào một nhóm cơ để xem chỉ
        số. Hình minh họa theo ngưỡng tham khảo chung, không thay cho tư vấn chuyên môn.
      </p>
    </Card>
  )
}
