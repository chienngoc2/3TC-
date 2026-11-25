import { INBODY_LIMITS, SEGMENTS, SEGMENT_NAME, deriveInbody, type DerivedInbody } from './inbody'
import type { InbodySegment } from './types'

/**
 * Form model for the InBody entry forms (front desk and coach). Quick mode takes the four
 * readings a desk needs; pro mode adds the rest of the InBody sheet and the five segments.
 */

export type EntryMode = 'quick' | 'pro'

type QuickKey = 'heightCm' | 'weightKg' | 'skeletalMuscleMassKg' | 'bodyFatPct'
type ProKey =
  'tbwLiters' | 'proteinKg' | 'mineralKg' | 'visceralFatLevel' | 'waistHipRatio' | 'inbodyScore'
export type EntryField = QuickKey | ProKey | InbodySegment

export interface FieldSpec {
  key: EntryField
  label: string
  unit: string
  min: number
  max: number
  integer?: boolean
  placeholder?: string
}

export const QUICK_FIELDS: FieldSpec[] = [
  {
    key: 'heightCm',
    label: 'Chiều cao',
    unit: 'cm',
    ...INBODY_LIMITS.heightCm,
    placeholder: '170',
  },
  { key: 'weightKg', label: 'Cân nặng', unit: 'kg', ...INBODY_LIMITS.weightKg, placeholder: '65' },
  {
    key: 'skeletalMuscleMassKg',
    label: 'Cơ xương (SMM)',
    unit: 'kg',
    ...INBODY_LIMITS.skeletalMuscleMassKg,
    placeholder: '29.5',
  },
  {
    key: 'bodyFatPct',
    label: 'Tỷ lệ mỡ (PBF)',
    unit: '%',
    ...INBODY_LIMITS.bodyFatPct,
    placeholder: '20',
  },
]

export const PRO_FIELDS: FieldSpec[] = [
  { key: 'tbwLiters', label: 'Tổng nước', unit: 'lít', ...INBODY_LIMITS.tbwLiters, placeholder: '38.0' },
  { key: 'proteinKg', label: 'Protein', unit: 'kg', ...INBODY_LIMITS.proteinKg, placeholder: '10.5' },
  { key: 'mineralKg', label: 'Khoáng chất', unit: 'kg', ...INBODY_LIMITS.mineralKg, placeholder: '3.2' },
  {
    key: 'visceralFatLevel',
    label: 'Mỡ nội tạng',
    unit: 'mức',
    ...INBODY_LIMITS.visceralFatLevel,
    integer: true,
    placeholder: '5',
  },
  { key: 'waistHipRatio', label: 'Tỷ lệ eo/hông', unit: '', ...INBODY_LIMITS.waistHipRatio, placeholder: '0.82' },
  {
    key: 'inbodyScore',
    label: 'Điểm InBody',
    unit: 'điểm',
    ...INBODY_LIMITS.inbodyScore,
    integer: true,
    placeholder: '75',
  },
]

export const SEGMENT_FIELDS: FieldSpec[] = SEGMENTS.map((key) => {
  let limits: { min: number; max: number } = INBODY_LIMITS.segment
  let placeholder = '10.0'
  if (key === 'rightArm' || key === 'leftArm') {
    limits = INBODY_LIMITS.segmentArm
    placeholder = '3.0'
  } else if (key === 'rightLeg' || key === 'leftLeg') {
    limits = INBODY_LIMITS.segmentLeg
    placeholder = '8.5'
  } else if (key === 'trunk') {
    limits = INBODY_LIMITS.segmentTrunk
    placeholder = '24.0'
  }
  return {
    key,
    label: SEGMENT_NAME[key],
    unit: 'kg',
    ...limits,
    placeholder,
  }
})

export function getFieldHint(
  key: EntryField,
  _heightCm?: number | null,
  weightKg?: number | null,
): string | undefined {
  if (!weightKg) {
    if (key === 'rightArm' || key === 'leftArm') return 'Thường từ 2.0 – 4.5 kg'
    if (key === 'rightLeg' || key === 'leftLeg') return 'Thường từ 6.0 – 11.0 kg'
    if (key === 'trunk') return 'Thường từ 18.0 – 32.0 kg'
    if (key === 'mineralKg') return 'Thường từ 2.2 – 4.0 kg'
    if (key === 'proteinKg') return 'Thường từ 7.0 – 15.0 kg'
    if (key === 'tbwLiters') return 'Thường từ 28.0 – 50.0 lít'
    if (key === 'waistHipRatio') return 'Chuẩn: 0.75 – 0.90'
    if (key === 'bodyFatPct') return 'Chuẩn: 10% – 24%'
    if (key === 'visceralFatLevel') return 'Chuẩn: Mức 1 – 9'
    return undefined
  }

  const estLbm = weightKg * 0.8 // ước tính nạc trung bình
  if (key === 'rightArm' || key === 'leftArm') {
    const minArm = Math.max(1.5, Math.round(estLbm * 0.045 * 10) / 10)
    const maxArm = Math.min(6.5, Math.round(estLbm * 0.075 * 10) / 10)
    return `Chuẩn: ~${minArm} – ${maxArm} kg`
  }
  if (key === 'rightLeg' || key === 'leftLeg') {
    const minLeg = Math.max(4.5, Math.round(estLbm * 0.14 * 10) / 10)
    const maxLeg = Math.min(15.0, Math.round(estLbm * 0.20 * 10) / 10)
    return `Chuẩn: ~${minLeg} – ${maxLeg} kg`
  }
  if (key === 'trunk') {
    const minTrunk = Math.max(14.0, Math.round(estLbm * 0.42 * 10) / 10)
    const maxTrunk = Math.min(42.0, Math.round(estLbm * 0.52 * 10) / 10)
    return `Chuẩn: ~${minTrunk} – ${maxTrunk} kg`
  }
  if (key === 'mineralKg') {
    return `Chuẩn: ~${(estLbm * 0.055).toFixed(1)} – ${(estLbm * 0.07).toFixed(1)} kg`
  }
  if (key === 'proteinKg') {
    return `Chuẩn: ~${(estLbm * 0.16).toFixed(1)} – ${(estLbm * 0.21).toFixed(1)} kg`
  }
  if (key === 'tbwLiters') {
    return `Chuẩn: ~${(estLbm * 0.70).toFixed(1)} – ${(estLbm * 0.75).toFixed(1)} lít`
  }
  if (key === 'skeletalMuscleMassKg') {
    return `Chuẩn: ~${(estLbm * 0.50).toFixed(1)} – ${(estLbm * 0.62).toFixed(1)} kg`
  }
  return undefined
}

const ALL_FIELDS = [...QUICK_FIELDS, ...PRO_FIELDS, ...SEGMENT_FIELDS]

export type EntryValues = Record<EntryField, string> & { notes: string }

/** What an existing log may hold; numbers arrive as strings from Prisma decimals. */
export interface EntrySource {
  heightCm?: unknown
  weightKg?: unknown
  skeletalMuscleMassKg?: unknown
  muscleMassKg?: unknown
  bodyFatPct?: unknown
  tbwLiters?: unknown
  proteinKg?: unknown
  mineralKg?: unknown
  visceralFatLevel?: unknown
  waistHipRatio?: unknown
  inbodyScore?: unknown
  segmentalLean?: unknown
  notes?: string | null
}

const text = (value: unknown) =>
  typeof value === 'number' || (typeof value === 'string' && value.trim()) ? String(value) : ''

export function entryValues(source?: EntrySource | null): EntryValues {
  const segments =
    source?.segmentalLean && typeof source.segmentalLean === 'object'
      ? (source.segmentalLean as Record<string, unknown>)
      : {}
  return {
    heightCm: text(source?.heightCm),
    weightKg: text(source?.weightKg),
    // Older logs only have muscle mass, which the backend now treats as SMM.
    skeletalMuscleMassKg: text(source?.skeletalMuscleMassKg) || text(source?.muscleMassKg),
    bodyFatPct: text(source?.bodyFatPct),
    tbwLiters: text(source?.tbwLiters),
    proteinKg: text(source?.proteinKg),
    mineralKg: text(source?.mineralKg),
    visceralFatLevel: text(source?.visceralFatLevel),
    waistHipRatio: text(source?.waistHipRatio),
    inbodyScore: text(source?.inbodyScore),
    rightArm: text(segments.rightArm),
    leftArm: text(segments.leftArm),
    trunk: text(segments.trunk),
    rightLeg: text(segments.rightLeg),
    leftLeg: text(segments.leftLeg),
    notes: source?.notes ?? '',
  }
}

/** Pro mode opens by default when an existing log already has pro-only readings. */
export function hasProData(values: EntryValues) {
  return [...PRO_FIELDS, ...SEGMENT_FIELDS].some((field) => values[field.key].trim() !== '')
}

export interface InbodyPayload {
  heightCm: number
  weightKg: number
  skeletalMuscleMassKg: number
  bodyFatPct: number
  tbwLiters?: number | null
  proteinKg?: number | null
  mineralKg?: number | null
  visceralFatLevel?: number | null
  waistHipRatio?: number | null
  inbodyScore?: number | null
  segmentalLean?: Partial<Record<InbodySegment, number | null>>
  notes?: string | null
}

export interface EntryCheck {
  /** Per-field messages, shown under each input. */
  errors: Partial<Record<EntryField, string>>
  /** Cross-field problem, such as muscle plus fat exceeding body weight. */
  formError: string | null
  /** Real-time warnings (unusual physiology, high asymmetry), does not block submit. */
  warnings: string[]
  derived: DerivedInbody
  /** Ready to send when there are no errors. */
  payload: InbodyPayload | null
}

const kg = (value: number) =>
  `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)} kg`
const NUMBER = /^\d+(?:[.,]\d{1,2})?$/
const INTEGER = /^\d+$/

function parseField(spec: FieldSpec, raw: string): { value: number | null; error?: string } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: null }
  if (!(spec.integer ? INTEGER : NUMBER).test(trimmed))
    return { value: null, error: spec.integer ? 'Nhập số nguyên.' : 'Tối đa 2 chữ số thập phân.' }
  const value = Number(trimmed.replace(',', '.'))
  if (value < spec.min || value > spec.max)
    return {
      value: null,
      error: `Từ ${spec.min} đến ${spec.max}${spec.unit ? ` ${spec.unit}` : ''}.`,
    }
  return { value }
}

/**
 * Validates the form for the given mode. In quick mode the pro readings are left out of the
 * payload so editing a log never wipes data entered earlier in pro mode; in pro mode an
 * emptied field is sent as null when editing, so the coach can clear it.
 */
export function checkEntry(values: EntryValues, mode: EntryMode, editing: boolean): EntryCheck {
  const errors: EntryCheck['errors'] = {}
  const numbers: Partial<Record<EntryField, number | null>> = {}
  const fields = mode === 'pro' ? ALL_FIELDS : QUICK_FIELDS
  for (const spec of fields) {
    const { value, error } = parseField(spec, values[spec.key])
    if (error) errors[spec.key] = error
    numbers[spec.key] = value
  }
  for (const spec of QUICK_FIELDS)
    if (!errors[spec.key] && numbers[spec.key] === null) errors[spec.key] = 'Bắt buộc.'

  const derived = deriveInbody({
    heightCm: numbers.heightCm ?? null,
    weightKg: numbers.weightKg ?? null,
    bodyFatPct: numbers.bodyFatPct ?? null,
  })

  let formError: string | null = null
  const warnings: string[] = []
  const weight = numbers.weightKg
  const smm = numbers.skeletalMuscleMassKg

  if (weight && smm && derived.bodyFatMassKg !== null) {
    if (smm + derived.bodyFatMassKg >= weight) {
      formError = `Cơ xương (${kg(smm)}) cộng khối mỡ (${kg(derived.bodyFatMassKg)}) không thể bằng hoặc vượt cân nặng (${kg(weight)}). Kiểm tra lại số liệu.`
    } else if (derived.leanBodyMassKg !== null && smm >= derived.leanBodyMassKg) {
      formError = `Cơ xương (${kg(smm)}) không thể bằng hoặc vượt tổng khối lượng nạc LBM (${kg(derived.leanBodyMassKg)}).`
    }
  }

  // Cross-field checks for Pro Mode molecular composition (TBW + Protein + Mineral)
  const tbw = numbers.tbwLiters
  const protein = numbers.proteinKg
  const mineral = numbers.mineralKg
  if (tbw && protein && mineral && weight) {
    const molecularSum = tbw + protein + mineral
    if (molecularSum >= weight) {
      formError = `Tổng Nước (${tbw}L) + Protein (${kg(protein)}) + Khoáng (${kg(mineral)}) = ${kg(molecularSum)} không thể bằng hoặc vượt cân nặng (${kg(weight)}).`
    } else if (
      derived.leanBodyMassKg !== null &&
      Math.abs(molecularSum - derived.leanBodyMassKg) > derived.leanBodyMassKg * 0.15
    ) {
      warnings.push(
        `Tổng Nước + Protein + Khoáng chất (${kg(molecularSum)}) chênh lệch >15% so với khối lượng nạc (${kg(derived.leanBodyMassKg)}). Hãy đối chiếu lại phiếu in.`,
      )
    }
  }

  // Segmental checks
  const segmentTotal = SEGMENTS.reduce((sum, key) => sum + (numbers[key] ?? 0), 0)
  if (!formError && weight && segmentTotal >= weight) {
    formError = `Tổng cơ 5 vùng (${kg(segmentTotal)}) không thể vượt cân nặng (${kg(weight)}).`
  }

  // Limb asymmetry warnings
  const rightArm = numbers.rightArm
  const leftArm = numbers.leftArm
  if (rightArm && leftArm) {
    const armDiff = Math.abs(rightArm - leftArm)
    const armAvg = (rightArm + leftArm) / 2
    if (armAvg > 0 && armDiff / armAvg > 0.25) {
      warnings.push(
        `Chênh lệch cơ giữa tay phải (${kg(rightArm)}) và tay trái (${kg(leftArm)}) đạt ${Math.round(
          (armDiff / armAvg) * 100,
        )}% (bất thường lớn). Hãy đối chiếu lại phiếu đo.`,
      )
    }
  }

  const rightLeg = numbers.rightLeg
  const leftLeg = numbers.leftLeg
  if (rightLeg && leftLeg) {
    const legDiff = Math.abs(rightLeg - leftLeg)
    const legAvg = (rightLeg + leftLeg) / 2
    if (legAvg > 0 && legDiff / legAvg > 0.25) {
      warnings.push(
        `Chênh lệch cơ giữa chân phải (${kg(rightLeg)}) và chân trái (${kg(leftLeg)}) đạt ${Math.round(
          (legDiff / legAvg) * 100,
        )}%.`,
      )
    }
  }

  // Extreme condition warnings
  if (
    numbers.bodyFatPct !== null &&
    numbers.bodyFatPct !== undefined &&
    numbers.bodyFatPct < 6
  ) {
    warnings.push(
      `Tỷ lệ mỡ ${numbers.bodyFatPct}% ở mức cực thấp đối với người tập thông thường.`,
    )
  }

  if (weight && smm && smm / weight > 0.52) {
    warnings.push(
      `Tỷ lệ cơ xương chiếm tới ${Math.round((smm / weight) * 100)}% trọng lượng cơ thể (mức của vận động viên chuyên nghiệp).`,
    )
  }

  if (formError || Object.keys(errors).length > 0)
    return { errors, formError, warnings, derived, payload: null }

  const notes = values.notes.trim()
  const payload: InbodyPayload = {
    heightCm: numbers.heightCm!,
    weightKg: numbers.weightKg!,
    skeletalMuscleMassKg: numbers.skeletalMuscleMassKg!,
    bodyFatPct: numbers.bodyFatPct!,
  }
  if (mode === 'pro') {
    for (const spec of PRO_FIELDS) {
      const value = numbers[spec.key] ?? null
      if (value !== null || editing) payload[spec.key as ProKey] = value
    }
    const segments: Partial<Record<InbodySegment, number | null>> = {}
    for (const key of SEGMENTS) {
      const value = numbers[key] ?? null
      if (value !== null || editing) segments[key] = value
    }
    if (Object.values(segments).some((value) => value !== null) || editing)
      payload.segmentalLean = segments
  }
  if (notes) payload.notes = notes
  else if (editing) payload.notes = null
  return { errors, formError: null, warnings, derived, payload }
}
