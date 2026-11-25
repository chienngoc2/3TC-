import { describe, expect, it } from 'vitest'
import {
  bodyShapeOf,
  deriveInbody,
  limbImbalances,
  readSegment,
  standardsFor,
} from '../src/lib/inbody'
import { checkEntry, entryValues } from '../src/lib/inbody-entry'

describe('InBody calculations', () => {
  it('derives BFM, LBM, BMI and BMR like the backend', () => {
    expect(deriveInbody({ heightCm: 175, weightKg: 72, bodyFatPct: 18.5 })).toEqual({
      bmi: 23.51,
      bodyFatMassKg: 13.32,
      leanBodyMassKg: 58.68,
      bmrKcal: 1637,
    })
    expect(deriveInbody({ heightCm: null, weightKg: 72, bodyFatPct: null })).toEqual({
      bmi: null,
      bodyFatMassKg: null,
      leanBodyMassKg: null,
      bmrKcal: null,
    })
  })

  it('flags limb imbalance above 8% on the weaker side only', () => {
    const segments = { rightArm: 3.4, leftArm: 3.05, trunk: 26.5, rightLeg: 8.8, leftLeg: 8.7 }
    const [arms, legs] = limbImbalances(segments)
    expect(arms).toMatchObject({ zone: 'ARMS', weakerSide: 'LEFT', severity: 'SIGNIFICANT' })
    expect(legs.severity).toBe('BALANCED')

    const standards = standardsFor(175, 'male')
    expect(readSegment(segments, 'leftArm', standards)?.status).toBe('alert')
    expect(readSegment(segments, 'rightArm', standards)?.status).toBe('ideal')
    expect(readSegment(segments, 'rightLeg', standards)?.pctOfStandard).toBe(99)
    expect(readSegment(segments, 'trunk', null)?.status).toBe('normal')
    expect(readSegment({}, 'trunk', standards)).toBeNull()
  })

  it('grades segments against the height-based reference', () => {
    const standards = standardsFor(175, 'male')!
    const at = (pct: number) =>
      readSegment({ trunk: (standards.segment.trunk * pct) / 100 }, 'trunk', standards)?.status
    expect([at(105), at(95), at(85), at(75)]).toEqual(['ideal', 'normal', 'under', 'alert'])
  })

  it('classifies C / I / D shapes with the backend thresholds', () => {
    expect(bodyShapeOf(80, 28, 22)).toBe('TYPE_C')
    expect(bodyShapeOf(70, 33, 10)).toBe('TYPE_D')
    expect(bodyShapeOf(70, 30, 14)).toBe('TYPE_I')
    expect(bodyShapeOf(70, null, 14)).toBeNull()
  })
})

describe('InBody entry form', () => {
  const quick = {
    ...entryValues(),
    heightCm: '175',
    weightKg: '72',
    skeletalMuscleMassKg: '34.2',
    bodyFatPct: '18.5',
  }

  it('builds the quick-mode payload and leaves pro readings out', () => {
    const check = checkEntry({ ...quick, tbwLiters: '42' }, 'quick', false)
    expect(check.payload).toEqual({
      heightCm: 175,
      weightKg: 72,
      skeletalMuscleMassKg: 34.2,
      bodyFatPct: 18.5,
    })
  })

  it('blocks out-of-range values and muscle plus fat above body weight', () => {
    expect(checkEntry({ ...quick, heightCm: '40' }, 'quick', false).errors.heightCm).toBeTruthy()
    expect(checkEntry({ ...quick, weightKg: '301' }, 'quick', false).payload).toBeNull()
    expect(checkEntry({ ...quick, bodyFatPct: '2' }, 'quick', false).errors.bodyFatPct).toBeTruthy()
    const heavy = checkEntry({ ...quick, skeletalMuscleMassKg: '60' }, 'quick', false)
    expect(heavy.formError).toMatch(/không thể bằng hoặc vượt cân nặng/)
    expect(heavy.payload).toBeNull()
    expect(checkEntry({ ...quick, skeletalMuscleMassKg: '' }, 'quick', false).errors).toEqual({
      skeletalMuscleMassKg: 'Bắt buộc.',
    })
  })

  it('sends pro readings and segments, clearing emptied ones when editing', () => {
    const values = { ...quick, visceralFatLevel: '11', rightArm: '3.4', leftArm: '3.1' }
    expect(checkEntry(values, 'pro', false).payload).toMatchObject({
      visceralFatLevel: 11,
      segmentalLean: { rightArm: 3.4, leftArm: 3.1 },
    })
    const edited = checkEntry(values, 'pro', true).payload!
    expect(edited.tbwLiters).toBeNull()
    expect(edited.segmentalLean).toEqual({
      rightArm: 3.4,
      leftArm: 3.1,
      trunk: null,
      rightLeg: null,
      leftLeg: null,
    })
    expect(checkEntry({ ...values, visceralFatLevel: '25' }, 'pro', false).payload).toBeNull()
  })

  it('prefills from an older log that only has muscle mass', () => {
    expect(entryValues({ muscleMassKg: '30.1', weightKg: 70 }).skeletalMuscleMassKg).toBe('30.1')
  })
})
