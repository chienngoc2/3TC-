import type { InbodySegment } from './types'

/**
 * InBody maths shared by the member dashboard, the desk/coach entry forms and the coach
 * recommendation card. The formulas mirror the backend (`inbody-calc.util.ts`) so the
 * previews match what the API stores.
 */

export const SEGMENTS: InbodySegment[] = ['rightArm', 'leftArm', 'trunk', 'rightLeg', 'leftLeg']

export const SEGMENT_NAME: Record<InbodySegment, string> = {
  rightArm: 'Tay phải',
  leftArm: 'Tay trái',
  trunk: 'Thân',
  rightLeg: 'Chân phải',
  leftLeg: 'Chân trái',
}

export type Sex = 'male' | 'female'

const round = (value: number, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

export interface DerivedInbody {
  bmi: number | null
  bodyFatMassKg: number | null
  leanBodyMassKg: number | null
  bmrKcal: number | null
}

/** BFM, LBM, BMI and BMR (Katch-McArdle) from the four quick-mode inputs. */
export function deriveInbody(input: {
  heightCm: number | null
  weightKg: number | null
  bodyFatPct: number | null
}): DerivedInbody {
  const { heightCm, weightKg, bodyFatPct } = input
  const bmi = heightCm && weightKg ? round(weightKg / (heightCm / 100) ** 2) : null
  const bodyFatMassKg =
    weightKg && bodyFatPct !== null && bodyFatPct > 0 ? round(weightKg * (bodyFatPct / 100)) : null
  const leanBodyMassKg = weightKg && bodyFatMassKg !== null ? round(weightKg - bodyFatMassKg) : null
  const bmrKcal = leanBodyMassKg ? Math.round(370 + 21.6 * leanBodyMassKg) : null
  return { bmi, bodyFatMassKg, leanBodyMassKg, bmrKcal }
}

// --- Reference values -------------------------------------------------------------------
// "Standard" here follows how InBody reports: weight at BMI 22, a reference body-fat share,
// and the usual share of lean mass held by each segment. They are reference points for the
// illustration and the entry previews, not a diagnosis.

const STANDARD_BMI = 22
const STANDARD_FAT_PCT: Record<Sex, number> = { male: 15, female: 23 }
/** Skeletal muscle as a share of lean body mass (same estimate the backend uses). */
const SMM_SHARE_OF_LEAN = 0.58
const SEGMENT_SHARE_OF_LEAN: Record<Sex, Record<'arm' | 'trunk' | 'leg', number>> = {
  male: { arm: 0.058, trunk: 0.45, leg: 0.155 },
  female: { arm: 0.05, trunk: 0.46, leg: 0.16 },
}

export interface Standards {
  weightKg: number
  skeletalMuscleMassKg: number
  bodyFatMassKg: number
  segment: Record<InbodySegment, number>
}

export function standardsFor(heightCm: number | null, sex: Sex): Standards | null {
  if (!heightCm || heightCm <= 0) return null
  const weightKg = STANDARD_BMI * (heightCm / 100) ** 2
  const fatPct = STANDARD_FAT_PCT[sex]
  const lean = weightKg * (1 - fatPct / 100)
  const share = SEGMENT_SHARE_OF_LEAN[sex]
  return {
    weightKg,
    skeletalMuscleMassKg: lean * SMM_SHARE_OF_LEAN,
    bodyFatMassKg: weightKg * (fatPct / 100),
    segment: {
      rightArm: lean * share.arm,
      leftArm: lean * share.arm,
      trunk: lean * share.trunk,
      rightLeg: lean * share.leg,
      leftLeg: lean * share.leg,
    },
  }
}

// --- Segment status ---------------------------------------------------------------------

export type SegmentStatus = 'ideal' | 'normal' | 'under' | 'alert'

export const SEGMENT_STATUS_COLOR: Record<SegmentStatus, string> = {
  ideal: '#10b981',
  normal: '#60a5fa',
  under: '#f59e0b',
  alert: '#ef4444',
}

export const SEGMENT_STATUS_LABEL: Record<SegmentStatus, string> = {
  ideal: 'Lý tưởng',
  normal: 'Bình thường',
  under: 'Dưới chuẩn',
  alert: 'Cần chú ý',
}

/** Left/right difference, in percent of their average, above which a limb is flagged. */
export const IMBALANCE_SIGNIFICANT_PCT = 8
const IMBALANCE_MILD_PCT = 5

export type LimbZone = 'ARMS' | 'LEGS'
export interface LimbImbalance {
  zone: LimbZone
  leftValue: number
  rightValue: number
  imbalancePct: number
  weakerSide: 'LEFT' | 'RIGHT' | 'BALANCED'
  severity: 'BALANCED' | 'MILD' | 'SIGNIFICANT'
}

const LIMB_PAIRS: Array<[LimbZone, InbodySegment, InbodySegment]> = [
  ['ARMS', 'rightArm', 'leftArm'],
  ['LEGS', 'rightLeg', 'leftLeg'],
]

/** Same rule as the backend's `analyzeInbody`. */
export function limbImbalances(segment: Partial<Record<InbodySegment, number>>): LimbImbalance[] {
  return LIMB_PAIRS.flatMap(([zone, rightKey, leftKey]) => {
    const right = segment[rightKey]
    const left = segment[leftKey]
    if (!right || !left || right <= 0 || left <= 0) return []
    const imbalancePct = round((Math.abs(right - left) / ((right + left) / 2)) * 100, 1)
    return [
      {
        zone,
        leftValue: left,
        rightValue: right,
        imbalancePct,
        weakerSide: right < left ? 'RIGHT' : left < right ? 'LEFT' : 'BALANCED',
        severity:
          imbalancePct > IMBALANCE_SIGNIFICANT_PCT
            ? 'SIGNIFICANT'
            : imbalancePct > IMBALANCE_MILD_PCT
              ? 'MILD'
              : 'BALANCED',
      } satisfies LimbImbalance,
    ]
  })
}

export const OPPOSITE_SEGMENT: Partial<Record<InbodySegment, InbodySegment>> = {
  rightArm: 'leftArm',
  leftArm: 'rightArm',
  rightLeg: 'leftLeg',
  leftLeg: 'rightLeg',
}

export interface SegmentReading {
  valueKg: number
  /** Share of the reference value, in percent; null without a height. */
  pctOfStandard: number | null
  /** Difference with the opposite limb, in percent of their average. */
  imbalancePct: number | null
  status: SegmentStatus
}

export function readSegment(
  segment: Partial<Record<InbodySegment, number>>,
  key: InbodySegment,
  standards: Standards | null,
): SegmentReading | null {
  const valueKg = segment[key]
  if (valueKg === undefined) return null
  const pctOfStandard = standards ? round((valueKg / standards.segment[key]) * 100, 0) : null
  const opposite = OPPOSITE_SEGMENT[key]
  const other = opposite ? segment[opposite] : undefined
  const imbalancePct =
    other && other > 0 && valueKg > 0
      ? round((Math.abs(valueKg - other) / ((valueKg + other) / 2)) * 100, 1)
      : null
  // Only the weaker limb of an unbalanced pair is flagged; the stronger one keeps its level.
  const weakerOfPair = other !== undefined && valueKg < other
  const status: SegmentStatus =
    (imbalancePct !== null && imbalancePct > IMBALANCE_SIGNIFICANT_PCT && weakerOfPair) ||
    (pctOfStandard !== null && pctOfStandard < 80)
      ? 'alert'
      : pctOfStandard === null
        ? 'normal'
        : pctOfStandard < 90
          ? 'under'
          : pctOfStandard < 100
            ? 'normal'
            : 'ideal'
  return { valueKg, pctOfStandard, imbalancePct, status }
}

// --- Body shape (C / I / D) -------------------------------------------------------------

export type BodyShape = 'TYPE_C' | 'TYPE_I' | 'TYPE_D'

export const BODY_SHAPE_INFO: Record<BodyShape, { letter: string; title: string; advice: string }> =
  {
    TYPE_C: {
      letter: 'C',
      title: 'Dáng chữ C',
      advice: 'Mỡ nhiều hơn cơ. Ưu tiên giảm mỡ và tập tăng cơ.',
    },
    TYPE_I: {
      letter: 'I',
      title: 'Dáng chữ I',
      advice: 'Cân nặng, cơ và mỡ cân đối với nhau.',
    },
    TYPE_D: {
      letter: 'D',
      title: 'Dáng chữ D',
      advice: 'Cơ phát triển, mỡ thấp. Thể hình thể thao săn chắc.',
    },
  }

/** Fallback for logs without the backend's `analysis`; same thresholds as the backend. */
export function bodyShapeOf(
  weightKg: number | null,
  skeletalMuscleMassKg: number | null,
  bodyFatMassKg: number | null,
): BodyShape | null {
  if (!weightKg || skeletalMuscleMassKg === null || bodyFatMassKg === null) return null
  const muscle = (skeletalMuscleMassKg / weightKg) * 100
  const fat = (bodyFatMassKg / weightKg) * 100
  if (muscle < 40 && fat > 23) return 'TYPE_C'
  if (muscle >= 45 && fat <= 18) return 'TYPE_D'
  return 'TYPE_I'
}

export function isBodyShape(value: unknown): value is BodyShape {
  return value === 'TYPE_C' || value === 'TYPE_I' || value === 'TYPE_D'
}

// --- Entry validation -------------------------------------------------------------------

export const INBODY_LIMITS = {
  heightCm: { min: 100, max: 230 },
  weightKg: { min: 30, max: 250 },
  bodyFatPct: { min: 3, max: 60 },
  skeletalMuscleMassKg: { min: 5, max: 80 },
  tbwLiters: { min: 15, max: 90 },
  proteinKg: { min: 3, max: 25 },
  mineralKg: { min: 1, max: 7 },
  visceralFatLevel: { min: 1, max: 20 },
  waistHipRatio: { min: 0.6, max: 1.6 },
  inbodyScore: { min: 20, max: 100 },
  segment: { min: 0.5, max: 55 },
  segmentArm: { min: 0.5, max: 9.0 },
  segmentLeg: { min: 1.5, max: 20.0 },
  segmentTrunk: { min: 8.0, max: 55.0 },
} as const
