import type { InbodySegment } from '@/lib/types'
import type { BodySide, BodySlug } from './body-map-assets'

/** Which part of the figure reshapes together when the measurements change. */
export type ShapeGroup = 'head' | 'upper' | 'core' | 'legs'
/** InBody reports lean mass for five segments; arms and legs are split by body side. */
export type SegmentKind = 'arm' | 'trunk' | 'leg'

export interface RegionInfo {
  label: string
  /** Muscle groups are coloured by muscle level and can be hovered. */
  muscle: boolean
  shape: ShapeGroup
  segment: SegmentKind
  /** Belly and lower-back regions also show visceral fat. */
  core?: boolean
}

export const REGIONS: Record<BodySlug, RegionInfo> = {
  hair: { label: 'Tóc', muscle: false, shape: 'head', segment: 'trunk' },
  head: { label: 'Đầu', muscle: false, shape: 'head', segment: 'trunk' },
  neck: { label: 'Cơ cổ', muscle: true, shape: 'head', segment: 'trunk' },
  trapezius: { label: 'Cơ thang', muscle: true, shape: 'upper', segment: 'trunk' },
  deltoids: { label: 'Cơ vai', muscle: true, shape: 'upper', segment: 'arm' },
  chest: { label: 'Cơ ngực', muscle: true, shape: 'upper', segment: 'trunk' },
  'upper-back': { label: 'Cơ lưng trên', muscle: true, shape: 'upper', segment: 'trunk' },
  biceps: { label: 'Cơ tay trước', muscle: true, shape: 'upper', segment: 'arm' },
  triceps: { label: 'Cơ tay sau', muscle: true, shape: 'upper', segment: 'arm' },
  forearm: { label: 'Cẳng tay', muscle: true, shape: 'upper', segment: 'arm' },
  hands: { label: 'Bàn tay', muscle: false, shape: 'upper', segment: 'arm' },
  abs: { label: 'Cơ bụng', muscle: true, shape: 'core', segment: 'trunk', core: true },
  obliques: { label: 'Cơ liên sườn', muscle: true, shape: 'core', segment: 'trunk', core: true },
  'lower-back': {
    label: 'Cơ lưng dưới',
    muscle: true,
    shape: 'core',
    segment: 'trunk',
    core: true,
  },
  // InBody counts the glutes in the leg segments.
  gluteal: { label: 'Cơ mông', muscle: true, shape: 'core', segment: 'leg' },
  adductors: { label: 'Cơ đùi trong', muscle: true, shape: 'legs', segment: 'leg' },
  quadriceps: { label: 'Cơ đùi trước', muscle: true, shape: 'legs', segment: 'leg' },
  hamstring: { label: 'Cơ đùi sau', muscle: true, shape: 'legs', segment: 'leg' },
  knees: { label: 'Đầu gối', muscle: false, shape: 'legs', segment: 'leg' },
  calves: { label: 'Cơ bắp chân', muscle: true, shape: 'legs', segment: 'leg' },
  tibialis: { label: 'Cơ cẳng chân trước', muscle: true, shape: 'legs', segment: 'leg' },
  ankles: { label: 'Cổ chân', muscle: false, shape: 'legs', segment: 'leg' },
  feet: { label: 'Bàn chân', muscle: false, shape: 'legs', segment: 'leg' },
}

/** Draw order: core first so arms overlap the waist when the body widens. */
export const SHAPE_ORDER: ShapeGroup[] = ['legs', 'core', 'upper', 'head']

export type PathSide = 'left' | 'right' | 'common'
export type BodyHalf = 'right' | 'left' | null

/**
 * The asset's left/right are the viewer's. Facing the viewer (front), the viewer's left is
 * the member's right; from behind (back), the two agree.
 */
export function bodyHalf(pathSide: PathSide, view: BodySide): BodyHalf {
  if (pathSide === 'common') return null
  if (view === 'back') return pathSide
  return pathSide === 'left' ? 'right' : 'left'
}

/** The segment a path belongs to; a limb path without a side has none. */
export function segmentOf(region: RegionInfo, half: BodyHalf): InbodySegment | null {
  if (region.segment === 'trunk') return 'trunk'
  if (half === null) return null
  if (region.segment === 'arm') return half === 'right' ? 'rightArm' : 'leftArm'
  return half === 'right' ? 'rightLeg' : 'leftLeg'
}

/** Segments a whole region covers: both sides for a limb, the trunk otherwise. */
export function segmentsOf(region: RegionInfo): InbodySegment[] {
  if (region.segment === 'arm') return ['rightArm', 'leftArm']
  if (region.segment === 'leg') return ['rightLeg', 'leftLeg']
  return ['trunk']
}
