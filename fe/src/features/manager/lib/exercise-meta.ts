// Seeded exercise_knowledge rows keep their metadata as tags inside `instructions`:
// "[Code: EXERCISE_SQUAT] [Môn: GYM] [Nhóm cơ: legs] [Thiết bị: barbell] [Đơn vị: reps]".
// Manually added rows are plain text. Parse the tags so the library can show them as columns.

export interface ExerciseMeta {
  code?: string
  discipline?: string
  muscle?: string
  equipment?: string
  unit?: string
  /** Instructions text left after removing the tags. */
  note: string
}

const TAG = /\[(Code|Môn|Nhóm cơ|Thiết bị|Đơn vị):\s*([^\]]+)\]/g

export function parseExercise(instructions: string): ExerciseMeta {
  const meta: ExerciseMeta = { note: '' }
  for (const [, key, raw] of instructions.matchAll(TAG)) {
    const value = raw.trim()
    if (key === 'Code') meta.code = value
    else if (key === 'Môn') meta.discipline = value.toUpperCase()
    else if (key === 'Nhóm cơ') meta.muscle = value
    else if (key === 'Thiết bị') meta.equipment = value
    else if (key === 'Đơn vị') meta.unit = value
  }
  meta.note = instructions.replace(TAG, '').trim()
  return meta
}

const humanize = (value: string) => value.replace(/_/g, ' ')
const lookup = (table: Record<string, string>) => (value?: string | null) =>
  value ? (table[value] ?? humanize(value)) : '—'

const categories: Record<string, string> = {
  strength: 'Sức mạnh',
  cardio: 'Tim mạch',
  core: 'Cơ lõi',
  power: 'Sức bật',
  technique: 'Kỹ thuật',
  sparring: 'Đối luyện',
  warmup: 'Khởi động',
  cooldown: 'Thả lỏng',
  recovery: 'Phục hồi',
  yoga_pose: 'Tư thế yoga',
}
export const categoryLabel = lookup(categories)
/** Category codes used by the seeded catalog, for the create form. */
export const CATEGORY_CODES = Object.keys(categories)

export const muscleLabel = lookup({
  full_body: 'Toàn thân',
  legs: 'Chân',
  quads: 'Đùi trước',
  hamstrings: 'Đùi sau',
  glutes: 'Mông',
  calves: 'Bắp chân',
  hips: 'Hông',
  core: 'Cơ lõi',
  back: 'Lưng',
  spine: 'Cột sống',
  chest: 'Ngực',
  upper_chest: 'Ngực trên',
  shoulders: 'Vai',
  arms: 'Tay',
  biceps: 'Tay trước',
  triceps: 'Tay sau',
  balance: 'Thăng bằng',
  breath: 'Hơi thở',
  relax: 'Thư giãn',
})

export const equipmentLabel = lookup({
  bodyweight: 'Không dụng cụ',
  barbell: 'Thanh đòn',
  dumbbell: 'Tạ đơn',
  machine: 'Máy tập',
  cable_machine: 'Máy cáp',
  assist_machine: 'Máy hỗ trợ',
  pull_up_bar: 'Xà đơn',
  treadmill: 'Máy chạy bộ',
  medicine_ball: 'Bóng tạ',
  jump_rope: 'Dây nhảy',
  yoga_mat: 'Thảm yoga',
  heavy_bag: 'Bao cát',
  focus_mitts: 'Đích đấm',
  gloves_headgear: 'Găng và mũ bảo hộ',
})

export const unitLabel = lookup({
  reps: 'Lần',
  seconds: 'Giây',
  minutes: 'Phút',
  rounds: 'Hiệp',
})

/** "12 lần", "30 giây"… for one set of a template or plan exercise. */
export function perSet(reps: number | null, unit: string | null) {
  if (!reps) return '—'
  const label = unitLabel(unit ?? 'reps').toLowerCase()
  return `${reps} ${label}`
}
