import { describe, expect, it } from 'vitest'
import {
  assessBody,
  computeBmi,
} from '../src/features/member/components/inbody/body-map/body-assessment'
import {
  bodyHalf,
  segmentOf,
  REGIONS,
} from '../src/features/member/components/inbody/body-map/muscle-regions'
import { BODY_PARTS } from '../src/features/member/components/inbody/body-map/body-map-assets'
import { prepareMeasurements } from '../src/features/member/components/inbody/inbody-data'

const base = { weightKg: 70, heightCm: 175, bmi: null, bodyFatPct: 18, muscleMassKg: 31 }

describe('body assessment', () => {
  it('derives BMI from weight and height when the log has none', () => {
    expect(computeBmi(base)).toBeCloseTo(22.86, 2)
    expect(computeBmi({ ...base, bmi: 24.1 })).toBe(24.1)
    expect(computeBmi({ ...base, heightCm: null })).toBeNull()
  })

  it('grades body fat and muscle against the gender-specific ranges', () => {
    const male = assessBody(base, 'male')
    expect(male.fatLevel).toBe('normal')
    expect(male.muscleLevel).toBe('normal') // 31 / 70 = 44%
    const female = assessBody(base, 'female')
    expect(female.fatLevel).toBe('normal')
    expect(female.muscleLevel).toBe('high') // above the 37% female upper bound
    expect(assessBody({ ...base, bodyFatPct: 30 }, 'male').fatLevel).toBe('veryHigh')
    expect(assessBody({ ...base, bodyFatPct: 30 }, 'female').fatLevel).toBe('high')
  })

  it('widens the waist more than the rest as body fat and BMI rise', () => {
    const lean = assessBody({ ...base, weightKg: 62, bodyFatPct: 12, muscleMassKg: 29 }, 'male')
    const heavy = assessBody({ ...base, weightKg: 95, bodyFatPct: 30, muscleMassKg: 33 }, 'male')
    expect(heavy.shape.core).toBeGreaterThan(lean.shape.core)
    expect(heavy.shape.core).toBeGreaterThan(heavy.shape.upper)
    expect(heavy.shape.head).toBe(1)
    // Clamped so extreme inputs never distort the drawing.
    const extreme = assessBody({ ...base, weightKg: 200, bodyFatPct: 60 }, 'male')
    expect(extreme.shape.core).toBeLessThanOrEqual(1.2 * 1.22 + 1e-9)
  })

  it('keeps a neutral shape and no levels without measurements', () => {
    const empty = assessBody(
      { weightKg: null, heightCm: null, bmi: null, bodyFatPct: null, muscleMassKg: null },
      'female',
    )
    expect(empty.shape).toEqual({ head: 1, upper: 1, core: 1, legs: 1 })
    expect([empty.bmiLevel, empty.fatLevel, empty.muscleLevel]).toEqual([null, null, null])
  })
})

describe('regions and segments', () => {
  it('maps the viewer-side asset paths to the member’s own left and right', () => {
    // Facing the member, their right arm is on the viewer's left.
    expect(bodyHalf('left', 'front')).toBe('right')
    expect(bodyHalf('left', 'back')).toBe('left')
    expect(bodyHalf('common', 'front')).toBeNull()
    expect(segmentOf(REGIONS.biceps, 'right')).toBe('rightArm')
    expect(segmentOf(REGIONS.calves, 'left')).toBe('leftLeg')
    expect(segmentOf(REGIONS.abs, null)).toBe('trunk')
    // A limb path without a side cannot be tied to one segment.
    expect(segmentOf(REGIONS.biceps, null)).toBeNull()
    expect(segmentOf(REGIONS.gluteal, 'right')).toBe('rightLeg')
  })

  it('has region metadata for every slug in every body asset', () => {
    for (const gender of ['male', 'female'] as const)
      for (const side of ['front', 'back'] as const)
        for (const part of BODY_PARTS[gender][side]) expect(REGIONS[part.slug]).toBeDefined()
  })

  it('reads segmental lean mass when the API provides it and ignores bad values', () => {
    const { chronological } = prepareMeasurements([
      {
        id: 'a',
        measuredAt: '2026-10-06T03:00:00Z',
        weightKg: '70',
        segmentalLean: { rightArm: '3.4', leftArm: 'n/a', trunk: 24.1, rightLeg: null },
        skeletalMuscleMassKg: '30.5',
        muscleMassKg: '29',
        bodyFatPct: '20',
        analysis: { bodyShape: 'TYPE_D' },
      },
    ])
    expect(chronological[0].segmentalLean).toEqual({ rightArm: 3.4, trunk: 24.1 })
    // Skeletal muscle mass wins over the older muscle mass field.
    expect(chronological[0].muscleMassKg).toBe(30.5)
    expect(chronological[0].bodyFatMassKg).toBe(14)
    expect(chronological[0].bodyShape).toBe('TYPE_D')
  })
})
