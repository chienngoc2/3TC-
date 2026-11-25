import { useRef, useState, type FocusEvent, type PointerEvent } from 'react'
import {
  SEGMENT_NAME,
  SEGMENT_STATUS_COLOR,
  SEGMENT_STATUS_LABEL,
  type SegmentReading,
  type SegmentStatus,
} from '@/lib/inbody'
import type { InbodySegment } from '@/lib/types'
import type { Measurement } from '../inbody-data'
import { formatDelta, formatMetric } from '../inbody-data'
import {
  BODY_PARTS,
  BODY_VIEWBOX,
  type BodyGender,
  type BodyPartAsset,
  type BodySide,
  type BodySlug,
} from './body-map-assets'
import {
  LEVEL_LABEL,
  NO_DATA_COLOR,
  WHOLE_BODY_STATUS,
  type BodyAssessment,
} from './body-assessment'
import {
  REGIONS,
  SHAPE_ORDER,
  bodyHalf,
  segmentOf,
  segmentsOf,
  type BodyHalf,
  type PathSide,
} from './muscle-regions'

const SKIN = '#d5dce4'
const HAIR = '#475569'
const ACTIVE = '#0f4f44'
/** Matches the tooltip's w-60 plus a small margin. */
const TOOLTIP_WIDTH = 248
const POINTER_GAP = 14
const STATUS_RANK: SegmentStatus[] = ['ideal', 'normal', 'under', 'alert']

export type SegmentReadings = Partial<Record<InbodySegment, SegmentReading>>

interface Active {
  slug: BodySlug
  half: BodyHalf
  /** Tooltip position in px, relative to the stage and kept inside it. */
  x: number
  y: number
}

interface FigureProps {
  gender: BodyGender
  view: BodySide
  assessment: BodyAssessment
  readings: SegmentReadings
  current: Measurement | null
  previous: Measurement | null
}

function worst(statuses: SegmentStatus[]): SegmentStatus | null {
  return statuses.reduce<SegmentStatus | null>(
    (acc, status) =>
      acc && STATUS_RANK.indexOf(acc) >= STATUS_RANK.indexOf(status) ? acc : status,
    null,
  )
}

function SegmentRow({
  segment,
  reading,
  previous,
}: {
  segment: InbodySegment
  reading: SegmentReading
  previous: Measurement | null
}) {
  const before = previous?.segmentalLean[segment]
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-slate-500">Cơ {SEGMENT_NAME[segment].toLowerCase()}</dt>
        <dd className="font-semibold tabular-nums text-slate-900">
          {formatMetric(reading.valueKg, 'kg')}
          {before !== undefined ? (
            <span className="ml-1 font-normal text-slate-400">
              {formatDelta(reading.valueKg, before, 'kg')}
            </span>
          ) : null}
        </dd>
      </div>
      <dd className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: SEGMENT_STATUS_COLOR[reading.status] }}
          aria-hidden="true"
        />
        {SEGMENT_STATUS_LABEL[reading.status]}
        {reading.pctOfStandard !== null ? ` · ${reading.pctOfStandard}% chuẩn` : ''}
        {reading.imbalancePct !== null && reading.imbalancePct > 5
          ? ` · lệch ${formatMetric(reading.imbalancePct)}%`
          : ''}
      </dd>
    </div>
  )
}

function Tooltip({
  active,
  assessment,
  readings,
  current,
  previous,
}: {
  active: Active
  assessment: BodyAssessment
  readings: SegmentReadings
  current: Measurement | null
  previous: Measurement | null
}) {
  const region = REGIONS[active.slug]
  const one = segmentOf(region, active.half)
  const segments = (one ? [one] : segmentsOf(region)).filter((key) => readings[key])
  const sideLabel =
    region.segment !== 'trunk' && active.half ? ` ${active.half === 'right' ? 'phải' : 'trái'}` : ''
  return (
    <div className="pointer-events-none w-60 rounded-xl border border-slate-200 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 text-sm font-semibold text-slate-900">
        {region.label}
        {sideLabel}
      </p>
      {!current ? (
        <p className="text-slate-500">Chưa có lần đo để hiển thị chỉ số.</p>
      ) : (
        <dl className="space-y-1.5">
          {segments.map((segment) => (
            <SegmentRow
              key={segment}
              segment={segment}
              reading={readings[segment]!}
              previous={previous}
            />
          ))}
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Cơ xương toàn thân</dt>
            <dd className="text-right tabular-nums text-slate-900">
              {formatMetric(current.muscleMassKg, 'kg')}
              {previous ? (
                <span className="block text-slate-400">
                  {formatDelta(current.muscleMassKg, previous.muscleMassKg, 'kg')}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Tỷ lệ cơ trên cân nặng</dt>
            <dd className="tabular-nums text-slate-900">
              {assessment.muscleRatio === null
                ? '—'
                : `${Math.round(assessment.muscleRatio * 100)}%`}
              {assessment.muscleLevel ? (
                <span className="ml-1 text-slate-400">
                  {LEVEL_LABEL.muscle[assessment.muscleLevel]}
                </span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Mỡ cơ thể</dt>
            <dd className="text-right tabular-nums text-slate-900">
              {formatMetric(current.bodyFatPct, '%')}
              {assessment.fatLevel ? (
                <span className="ml-1 text-slate-400">{LEVEL_LABEL.fat[assessment.fatLevel]}</span>
              ) : null}
            </dd>
          </div>
          {region.core && current.visceralFatLevel !== null ? (
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Mỡ nội tạng</dt>
              <dd className="tabular-nums text-slate-900">mức {current.visceralFatLevel}</dd>
            </div>
          ) : null}
        </dl>
      )}
      {current && segments.length === 0 ? (
        <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-snug text-slate-400">
          Số liệu toàn thân. Lần đo này chưa có số đo riêng cho từng vùng cơ.
        </p>
      ) : null}
    </div>
  )
}

export default function BodyMapFigure({
  gender,
  view,
  assessment,
  readings,
  current,
  previous,
}: FigureProps) {
  const stage = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Active | null>(null)
  const parts = BODY_PARTS[gender][view]
  const wholeBody = assessment.muscleLevel
    ? SEGMENT_STATUS_COLOR[WHOLE_BODY_STATUS[assessment.muscleLevel]]
    : NO_DATA_COLOR

  const fillFor = (slug: BodySlug, side: PathSide, isActive: boolean) => {
    const region = REGIONS[slug]
    if (slug === 'hair') return HAIR
    if (!region.muscle) return SKIN
    if (isActive) return ACTIVE
    const segment = segmentOf(region, bodyHalf(side, view))
    // A limb path drawn without a side covers both limbs; show the weaker of the two.
    const status = segment
      ? readings[segment]?.status
      : worst(segmentsOf(region).flatMap((key) => readings[key]?.status ?? []))
    return status ? SEGMENT_STATUS_COLOR[status] : wholeBody
  }

  // Sit beside the pointer, flipping to its left when the right side has no room, so the
  // tooltip never covers the muscle being read.
  const anchor = (clientX: number, clientY: number) => {
    const box = stage.current?.getBoundingClientRect()
    if (!box) return { x: 0, y: 0 }
    const pointerX = clientX - box.left
    const right = pointerX + POINTER_GAP
    const x =
      right + TOOLTIP_WIDTH <= box.width
        ? right
        : Math.max(pointerX - POINTER_GAP - TOOLTIP_WIDTH, 0)
    return { x, y: Math.max(clientY - box.top - 20, 0) }
  }
  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as Element
    const slug = target.getAttribute('data-slug') as BodySlug | null
    if (!slug || !REGIONS[slug].muscle) return setActive(null)
    const side = (target.getAttribute('data-side') ?? 'common') as PathSide
    setActive({ slug, half: bodyHalf(side, view), ...anchor(event.clientX, event.clientY) })
  }
  const onFocus = (slug: BodySlug) => (event: FocusEvent<SVGGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setActive({
      slug,
      half: null,
      ...anchor(rect.left + rect.width / 2, rect.top + rect.height / 2),
    })
  }

  const groups = SHAPE_ORDER.map((shape) => ({
    shape,
    parts: parts.filter((part) => REGIONS[part.slug].shape === shape),
  }))

  const renderPart = (part: BodyPartAsset) => {
    const region = REGIONS[part.slug]
    const isActive = active?.slug === part.slug
    const paths = (['common', 'left', 'right'] as const).flatMap((side) =>
      (part[side] ?? []).map((d, index) => (
        <path
          key={`${side}-${index}`}
          d={d}
          fill={fillFor(part.slug, side, isActive)}
          data-slug={part.slug}
          data-side={side}
          className="inbody-body-path"
        />
      )),
    )
    if (!region.muscle) return <g key={part.slug}>{paths}</g>
    return (
      <g
        key={part.slug}
        tabIndex={0}
        role="button"
        aria-label={region.label}
        className="inbody-body-region"
        onFocus={onFocus(part.slug)}
        onBlur={() => setActive(null)}
      >
        {paths}
      </g>
    )
  }

  return (
    <div ref={stage} className="relative h-full w-full">
      <svg
        viewBox={BODY_VIEWBOX[gender][view]}
        className="mx-auto block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`Sơ đồ cơ ${gender === 'male' ? 'nam' : 'nữ'}, mặt ${view === 'front' ? 'trước' : 'sau'}`}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
      >
        {groups.map(({ shape, parts: groupParts }) => (
          <g
            key={shape}
            data-shape={shape}
            className="inbody-body-shape"
            style={{ transform: `scaleX(${assessment.shape[shape].toFixed(3)})` }}
          >
            {groupParts.map(renderPart)}
          </g>
        ))}
      </svg>
      {active ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10"
          style={{ left: active.x, top: active.y }}
        >
          <Tooltip
            active={active}
            assessment={assessment}
            readings={readings}
            current={current}
            previous={previous}
          />
        </div>
      ) : null}
    </div>
  )
}
