import type { SegmentStatus } from '@/lib/inbody'
import type { BodyGender } from './body-map-assets'
import type { ShapeGroup } from './muscle-regions'

export type Level = 'low' | 'normal' | 'high' | 'veryHigh'

export interface BodyInput {
  weightKg: number | null
  heightCm: number | null
  bmi: number | null
  bodyFatPct: number | null
  muscleMassKg: number | null
}

export interface BodyAssessment {
  bmi: number | null
  bmiLevel: Level | null
  fatLevel: Level | null
  /** Muscle mass as a share of body weight, 0–1. */
  muscleRatio: number | null
  muscleLevel: Exclude<Level, 'veryHigh'> | null
  /** Horizontal scale for each part of the figure, 1 = reference build. */
  shape: Record<ShapeGroup, number>
}

// General reference ranges for adults, used to colour and shape the illustration only.
// They are not a diagnosis; the page says so next to the figure.
const FAT_RANGES: Record<BodyGender, [number, number, number]> = {
  // low below, normal up to, slightly high up to, high above
  male: [8, 20, 25],
  female: [15, 28, 33],
}
const MUSCLE_RATIO_RANGES: Record<BodyGender, [number, number]> = {
  male: [0.38, 0.45],
  female: [0.3, 0.37],
}
/** Body fat % at which the waist is drawn at its reference width. */
const FAT_REFERENCE: Record<BodyGender, number> = { male: 15, female: 23 }

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function computeBmi({ bmi, weightKg, heightCm }: BodyInput): number | null {
  if (bmi !== null && bmi > 0) return bmi
  if (weightKg && heightCm) return weightKg / (heightCm / 100) ** 2
  return null
}

export function assessBody(input: BodyInput, gender: BodyGender): BodyAssessment {
  const bmi = computeBmi(input)
  const fat = input.bodyFatPct
  const muscleRatio =
    input.muscleMassKg && input.weightKg ? input.muscleMassKg / input.weightKg : null

  const bmiLevel: Level | null =
    bmi === null ? null : bmi < 18.5 ? 'low' : bmi < 23 ? 'normal' : bmi < 25 ? 'high' : 'veryHigh'
  const [fatLow, fatNormal, fatHigh] = FAT_RANGES[gender]
  const fatLevel: Level | null =
    fat === null
      ? null
      : fat < fatLow
        ? 'low'
        : fat <= fatNormal
          ? 'normal'
          : fat <= fatHigh
            ? 'high'
            : 'veryHigh'
  const [muscleLow, muscleHigh] = MUSCLE_RATIO_RANGES[gender]
  const muscleLevel =
    muscleRatio === null
      ? null
      : muscleRatio < muscleLow
        ? 'low'
        : muscleRatio > muscleHigh
          ? 'high'
          : 'normal'

  // Frame follows BMI; the waist widens further with body fat; legs take half of that.
  const frame = bmi === null ? 1 : clamp(1 + (bmi - 22) * 0.022, 0.9, 1.2)
  const waist = fat === null ? 1 : clamp(1 + (fat - FAT_REFERENCE[gender]) * 0.012, 0.94, 1.22)
  return {
    bmi,
    bmiLevel,
    fatLevel,
    muscleRatio,
    muscleLevel,
    shape: {
      head: 1,
      upper: frame * (1 + (waist - 1) * 0.35),
      core: frame * waist,
      legs: frame * (1 + (waist - 1) * 0.6),
    },
  }
}

export const LEVEL_LABEL: Record<'bmi' | 'fat' | 'muscle', Record<Level, string>> = {
  bmi: { low: 'Gầy', normal: 'Cân đối', high: 'Thừa cân', veryHigh: 'Béo phì' },
  fat: { low: 'Thấp', normal: 'Chuẩn', high: 'Hơi cao', veryHigh: 'Cao' },
  muscle: { low: 'Thấp', normal: 'Chuẩn', high: 'Tốt', veryHigh: 'Tốt' },
}

/**
 * Without segmental data every muscle takes the whole-body level, drawn with the same
 * scale as the segments so one legend covers both.
 */
export const WHOLE_BODY_STATUS: Record<Exclude<Level, 'veryHigh'>, SegmentStatus> = {
  high: 'ideal',
  normal: 'normal',
  low: 'under',
}

/** Muscles with no reading at all. */
export const NO_DATA_COLOR = '#94a3b8'
