import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { BODY_SHAPE_INFO, bodyShapeOf, standardsFor, type BodyShape } from '@/lib/inbody'
import type { BodyGender } from './body-map/body-map-assets'
import { formatMeasurementDate, formatMetric, type Measurement } from './inbody-data'

/** Bars are drawn on one axis of % of the reference value, as on an InBody sheet. */
const AXIS_MIN = 40
const AXIS_MAX = 200
const position = (pct: number) =>
  `${(Math.min(Math.max(pct, AXIS_MIN), AXIS_MAX) - AXIS_MIN) / ((AXIS_MAX - AXIS_MIN) / 100)}%`

interface Row {
  label: string
  value: number | null
  standard: number | null
  /** Range of % of the reference value treated as normal. */
  normal: [number, number]
}

const SHAPE_TONE: Record<BodyShape, string> = {
  TYPE_C: 'border-amber-200 bg-amber-50 text-amber-900',
  TYPE_I: 'border-sky-200 bg-sky-50 text-sky-900',
  TYPE_D: 'border-emerald-200 bg-emerald-50 text-emerald-900',
}

function Bar({ row }: { row: Row }) {
  const pct = row.value !== null && row.standard ? (row.value / row.standard) * 100 : null
  return (
    <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3 sm:grid-cols-[9rem_1fr_4.5rem]">
      <div className="text-xs">
        <p className="m-0 font-medium text-slate-700">{row.label}</p>
        <p className="m-0 tabular-nums text-slate-500 sm:hidden">
          {formatMetric(row.value === null ? null : Math.round(row.value * 10) / 10, 'kg')}
        </p>
      </div>
      <div className="relative h-3 rounded-full bg-slate-100">
        <span
          className="absolute inset-y-0 rounded-full bg-slate-200"
          style={{
            left: position(row.normal[0]),
            right: `calc(100% - ${position(row.normal[1])})`,
          }}
          aria-hidden="true"
        />
        <span
          className="absolute inset-y-0 w-px bg-slate-400"
          style={{ left: position(100) }}
          aria-hidden="true"
        />
        {pct !== null ? (
          <span
            className="absolute inset-y-0.5 left-0 rounded-full bg-slate-800"
            style={{ width: position(pct) }}
            role="img"
            aria-label={`${row.label} ${Math.round(pct)}% so với chuẩn`}
          />
        ) : null}
      </div>
      <p className="m-0 hidden text-right text-xs tabular-nums text-slate-700 sm:block">
        {formatMetric(row.value === null ? null : Math.round(row.value * 10) / 10, 'kg')}
      </p>
    </div>
  )
}

export function InbodyShapeCard({
  measurement,
  gender,
}: {
  measurement: Measurement
  gender: BodyGender
}) {
  const shape =
    measurement.bodyShape ??
    bodyShapeOf(measurement.weightKg, measurement.muscleMassKg, measurement.bodyFatMassKg)
  const standards = standardsFor(measurement.heightCm, gender)
  const rows: Row[] = [
    {
      label: 'Cân nặng',
      value: measurement.weightKg,
      standard: standards?.weightKg ?? null,
      normal: [85, 115],
    },
    {
      label: 'Cơ xương (SMM)',
      value: measurement.muscleMassKg,
      standard: standards?.skeletalMuscleMassKg ?? null,
      normal: [90, 110],
    },
    {
      label: 'Khối lượng mỡ (BFM)',
      value: measurement.bodyFatMassKg,
      standard: standards?.bodyFatMassKg ?? null,
      normal: [80, 160],
    },
  ]

  return (
    <Card
      role="region"
      aria-label="Hình thái cơ thể"
      className="inbody-visual-card min-w-0 rounded-3xl p-4 sm:p-6"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Hình thái cơ thể</h2>
          <p className="mt-1 text-xs text-slate-500">
            Lần đo {formatMeasurementDate(measurement.timestamp)} · so với mức chuẩn theo chiều cao
          </p>
        </div>
        {shape ? (
          <div
            className={cn(
              'flex max-w-xs items-center gap-3 rounded-2xl border px-3 py-2',
              SHAPE_TONE[shape],
            )}
          >
            <span className="font-sans text-3xl font-bold leading-none" aria-hidden="true">
              {BODY_SHAPE_INFO[shape].letter}
            </span>
            <span className="text-xs">
              <strong className="block text-sm">{BODY_SHAPE_INFO[shape].title}</strong>
              {BODY_SHAPE_INFO[shape].advice}
            </span>
          </div>
        ) : null}
      </div>

      {standards ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <Bar key={row.label} row={row} />
          ))}
          <div className="grid grid-cols-[7.5rem_1fr] gap-3 sm:grid-cols-[9rem_1fr_4.5rem]">
            <span />
            <div
              className="relative h-4 text-[10px] tabular-nums text-slate-400"
              aria-hidden="true"
            >
              {[55, 100, 145, 190].map((tick) => (
                <span
                  key={tick}
                  className="absolute -translate-x-1/2"
                  style={{ left: position(tick) }}
                >
                  {tick}%
                </span>
              ))}
            </div>
          </div>
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            Vạch đứng là mức chuẩn, vùng xám là khoảng bình thường. Thanh cơ dài hơn thanh mỡ là
            dáng chữ D, thanh mỡ vượt trội là dáng chữ C.
          </p>
        </div>
      ) : (
        <p className="m-0 text-sm text-slate-500">
          Lần đo này chưa có chiều cao nên chưa so được với mức chuẩn.
        </p>
      )}
    </Card>
  )
}
