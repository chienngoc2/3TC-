/**
 * The backend validates request bodies with class-validator, whose messages are English
 * ("weightKg must not be greater than 500"). These helpers turn them into Vietnamese.
 */

const FIELD_LABEL: Record<string, string> = {
  userId: 'Hội viên',
  heightCm: 'Chiều cao',
  weightKg: 'Cân nặng',
  muscleMassKg: 'Khối lượng cơ',
  skeletalMuscleMassKg: 'Cơ xương (SMM)',
  bodyFatPct: 'Tỷ lệ mỡ',
  bodyFatMassKg: 'Khối mỡ',
  leanBodyMassKg: 'Khối nạc',
  bmi: 'BMI',
  bmrKcal: 'Trao đổi chất (BMR)',
  tbwLiters: 'Tổng nước',
  proteinKg: 'Protein',
  mineralKg: 'Khoáng chất',
  visceralFatLevel: 'Mỡ nội tạng',
  waistHipRatio: 'Tỷ lệ eo/hông',
  inbodyScore: 'Điểm InBody',
  segmentalLean: 'Cơ nạc 5 vùng',
  notes: 'Ghi chú',
  startTime: 'Giờ bắt đầu',
  endTime: 'Giờ kết thúc',
  memberId: 'Hội viên',
  title: 'Tiêu đề',
  exercises: 'Danh sách bài tập',
  sets: 'Số hiệp',
  reps: 'Số lần',
  phone: 'Số điện thoại',
  email: 'Email',
  fullName: 'Họ tên',
}

const label = (field: string) => {
  const key = field.split('.').pop() ?? field
  return FIELD_LABEL[key] ? `«${FIELD_LABEL[key]}»` : `«${key}»`
}

const UNKNOWN_FIELD = /^property (\S+) should not exist$/

const RULES: Array<[RegExp, (field: string, value: string) => string]> = [
  [
    UNKNOWN_FIELD,
    (f) =>
      `Máy chủ chưa hỗ trợ trường ${label(f)}. Backend đang chạy bản cũ, cần cập nhật bản InBody mới.`,
  ],
  [/^(\S+) must not be greater than (\S+)$/, (f, v) => `${label(f)} không được lớn hơn ${v}.`],
  [/^(\S+) must not be less than (\S+)$/, (f, v) => `${label(f)} không được nhỏ hơn ${v}.`],
  [/^(\S+) must be an integer number$/, (f) => `${label(f)} phải là số nguyên.`],
  [
    /^(\S+) must be a number conforming to the specified constraints$/,
    (f) => `${label(f)} phải là số.`,
  ],
  [/^(\S+) must be a positive number$/, (f) => `${label(f)} phải là số dương.`],
  [/^(\S+) should not be empty$/, (f) => `${label(f)} không được để trống.`],
  [/^(\S+) must be a string$/, (f) => `${label(f)} phải là chữ.`],
  [/^(\S+) must be a UUID$/, (f) => `${label(f)} không hợp lệ.`],
  [/^(\S+) must be a boolean value$/, (f) => `${label(f)} phải là đúng/sai.`],
  [/^(\S+) must be an array$/, (f) => `${label(f)} phải là danh sách.`],
  [/^(\S+) must be an email$/, (f) => `${label(f)} không đúng định dạng email.`],
  [
    /^(\S+) must be a valid ISO 8601 date string$/,
    (f) => `${label(f)} không đúng định dạng ngày giờ.`,
  ],
  [
    /^(\S+) must be shorter than or equal to (\d+) characters$/,
    (f, v) => `${label(f)} tối đa ${v} ký tự.`,
  ],
  [/^(\S+) must be one of the following values: (.+)$/, (f, v) => `${label(f)} chỉ nhận: ${v}.`],
]

/** Translates one class-validator message; unknown messages are returned unchanged. */
export function translateValidationMessage(message: string): string {
  const text = message.trim()
  for (const [pattern, render] of RULES) {
    const match = pattern.exec(text)
    if (match) return render(match[1], match[2] ?? '')
  }
  return text
}

/** Vietnamese text for the `message` field of a backend error (string or list). */
export function validationText(message: unknown): string | null {
  if (Array.isArray(message)) {
    // Several unknown fields mean one thing: the backend is older than this screen.
    const unknown = message.flatMap((item) => UNKNOWN_FIELD.exec(String(item))?.[1] ?? [])
    const lines = message
      .filter((item) => !UNKNOWN_FIELD.test(String(item)))
      .map((item) => translateValidationMessage(String(item)))
    if (unknown.length > 0)
      lines.unshift(
        `Máy chủ chưa hỗ trợ ${unknown.map(label).join(', ')}. Backend đang chạy bản cũ, cần cập nhật bản InBody mới.`,
      )
    const unique = [...new Set(lines)]
    return unique.length ? unique.join(' ') : null
  }
  if (typeof message === 'string' && message.trim()) return translateValidationMessage(message)
  return null
}
