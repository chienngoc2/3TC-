import { ApiError } from '@/lib/api'

const TZ = 'Asia/Ho_Chi_Minh'

const dateFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const timeFmt = new Intl.DateTimeFormat('vi-VN', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
const isoDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export const formatDate = (value?: string | null) => (value ? dateFmt.format(new Date(value)) : '—')
export const formatTime = (value?: string | null) => (value ? timeFmt.format(new Date(value)) : '—')
export const formatDateTime = (value?: string | null) =>
  value ? `${formatTime(value)} ${formatDate(value)}` : '—'

/** YYYY-MM-DD of an instant, in Vietnam time. */
export const vnDay = (value: string | Date = new Date()) => isoDayFmt.format(new Date(value))

/** Date-only columns (shift_date, effective_from…) come back as UTC midnight; keep the calendar day. */
export const dayOnly = (value?: string | null) => (value ? value.slice(0, 10) : '')
export const formatDay = (value?: string | null) =>
  value ? dayOnly(value).split('-').reverse().join('/') : '—'

export const formatCurrency = (val: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(val) || 0)

/** "2026-10-12" + "06:00" in Vietnam time → ISO instant for the API. */
export const vnInstant = (day: string, time: string) =>
  new Date(`${day}T${time}:00+07:00`).toISOString()
/** HH:mm of an instant in Vietnam time, for <input type="time">. */
export const vnClock = (value: string) => formatTime(value)

export const addDaysToDay = (day: string, days: number) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
export const mondayOf = (day: string) => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return addDaysToDay(day, weekday === 0 ? -6 : 1 - weekday)
}

export const percent = (ratio: number) => `${Math.round(ratio * 100)}%`

const messages: Record<string, string> = {
  NETWORK_UNAVAILABLE: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  DATA_CONFLICT: 'Dữ liệu bị trùng (email, mã hoặc số tủ đã tồn tại).',
  SCHEDULE_OR_DATA_CONFLICT: 'Bị trùng giờ với một lịch hoặc ca đã có.',
  ROLE_HIERARCHY_VIOLATION: 'Bạn không có quyền thao tác với tài khoản này.',
  FORBIDDEN_RESOURCE: 'Bạn không có quyền thao tác với dữ liệu này.',
  INVALID_TIME_RANGE: 'Giờ kết thúc phải sau giờ bắt đầu.',
  SCHEDULE_MUST_BE_FUTURE: 'Chỉ xếp được lịch trong tương lai.',
  INVALID_ROOM_CAPACITY: 'Sĩ số vượt quá sức chứa của phòng.',
  ROOM_INACTIVE: 'Phòng này đã ngừng hoạt động.',
  GYM_GROUP_CLASS_FORBIDDEN: 'Môn Gym không có lớp nhóm.',
  GYM_HAS_NO_GROUP_CLASSES: 'Môn Gym không có lớp nhóm.',
  COACH_DISCIPLINE_MISMATCH: 'HLV chưa có chuyên môn thuộc môn này.',
  SCHEDULE_NOT_EDITABLE: 'Lịch đã diễn ra hoặc đã hủy, không sửa được.',
  SCHEDULE_HAS_BOOKINGS: 'Lịch đã có hội viên đặt chỗ, không sửa được.',
  SCHEDULE_HAS_HISTORY: 'Lịch đã có đặt chỗ hoặc yêu cầu hủy, không xóa được.',
  CLASS_HAS_SCHEDULE_HISTORY: 'Lớp đã từng được xếp lịch, không xóa được.',
  ROOM_HAS_ACTIVE_SCHEDULES: 'Phòng còn lịch sắp diễn ra, chưa ngừng được.',
  GYM_GROUP_PLAN_FORBIDDEN: 'Gói Gym không được là lớp nhóm và phải có 0 buổi nhóm.',
  UNLIMITED_ACCESS_GYM_ONLY: 'Chỉ gói Gym mới được vào cửa không giới hạn.',
  VIP_REQUIRES_12_PT_SESSIONS: 'Gói VIP phải có đúng 12 buổi PT.',
  INVALID_TRIAL_PLAN: 'Gói Trial phải có giá 0 và 0 buổi PT.',
  PLAN_DISCIPLINE_IMMUTABLE: 'Không đổi được môn của gói đã tạo.',
  PLAN_TIER_IMMUTABLE: 'Không đổi được hạng của gói đã tạo.',
  INVALID_RATE_RANGE: 'Ngày kết thúc phải sau ngày bắt đầu áp dụng.',
  ONLY_FUTURE_RATE_CAN_BE_DELETED: 'Chỉ xóa được biểu phí chưa tới ngày áp dụng.',
  REJECTION_REASON_REQUIRED: 'Cần nhập lý do từ chối.',
  REQUEST_ALREADY_REVIEWED: 'Yêu cầu này đã được xử lý.',
  LOCKER_ASSIGNMENT_STATUS_MISMATCH: 'Tủ đang có người dùng, không đổi trạng thái được.',
  SUBSCRIPTION_NOT_FREEZABLE: 'Chỉ đóng băng được gói đang hiệu lực.',
  SUBSCRIPTION_NOT_FROZEN: 'Gói này không ở trạng thái đóng băng.',
  USER_NOT_FOUND: 'Không tìm thấy người dùng.',
  COACH_REQUIRED: 'Gói có buổi PT, cần chọn HLV.',
  COACH_NOT_APPLICABLE: 'Gói không có buổi PT, không chọn HLV.',
  COACH_RATE_NOT_CONFIGURED: 'HLV chưa có biểu phí hiệu lực cho môn này.',
  PLAN_DISABLED: 'Gói đã ngừng bán.',
  PLAN_DISCIPLINE_REQUIRED: 'Gói chưa gắn môn.',
  TRIAL_ALREADY_USED: 'Hội viên đã dùng gói Trial của môn này.',
  VIP_PLAN_REQUIRED: 'Chỉ bán được gói VIP ở mục này.',
  SUBSCRIPTION_NOT_RENEWABLE: 'Gói Trial và Drop-in không gia hạn được.',
  UNFREEZE_BEFORE_RENEWAL: 'Cần mở lại gói trước khi gia hạn.',
  INVALID_PT_SUBSCRIPTION: 'Chỉ bán thêm PT cho gói đang hiệu lực và đã có HLV.',
  CLASS_FULL_OR_CLOSED: 'Lớp đã đầy hoặc đã đóng.',
  MEMBER_SCHEDULE_OVERLAP: 'Hội viên đã có lịch khác trùng giờ.',
  NO_VALID_SUBSCRIPTION_OR_QUOTA: 'Hội viên không có gói hợp lệ hoặc đã hết buổi.',
  QUOTA_EXHAUSTED: 'Hội viên đã hết buổi trong gói.',
  PT_SLOT_UNAVAILABLE: 'Khung giờ PT này không còn trống.',
  SESSION_ALREADY_STARTED: 'Buổi tập đã bắt đầu, không hủy được.',
  SESSION_UNAVAILABLE: 'Buổi tập không còn khả dụng.',
  BOOKING_ALREADY_PROCESSED: 'Lượt đặt này đã được xử lý.',
  GATE_ACCESS_DENIED: 'Hội viên không có gói hiệu lực hôm nay.',
  ALREADY_CHECKED_IN: 'Hội viên đã vào cổng hôm nay.',
  NO_AVAILABLE_LOCKER: 'Khu này đã hết tủ trống.',
  RETURN_OVERNIGHT_LOCKER_FIRST: 'Hội viên cần trả tủ của hôm trước trước.',
  LOCKER_ALREADY_RETURNED: 'Tủ đã được trả.',
  INBODY_EDIT_WINDOW_EXPIRED: 'Chỉ sửa được kết quả InBody trong 24 giờ sau khi đo.',
  INVALID_FILE_TYPE: 'Ảnh phải là JPG, PNG, WEBP hoặc GIF.',
  FILE_TOO_LARGE: 'Ảnh tối đa 3 MB.',
  REQUEST_NOT_PENDING: 'Đơn không còn ở trạng thái chờ duyệt.',
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (messages[error.code]) return messages[error.code]
    if (error.status === 409) return messages.SCHEDULE_OR_DATA_CONFLICT
    if (error.status === 403) return messages.FORBIDDEN_RESOURCE
    return error.message
  }
  return error instanceof Error ? error.message : 'Có lỗi xảy ra, thử lại sau.'
}

export const tierLabel: Record<string, string> = {
  TRIAL: 'Dùng thử',
  DROP_IN: 'Vé buổi lẻ',
  PLUS: 'Gói Plus',
  VIP: 'Gói VIP',
}
export const trainingModeLabel: Record<string, string> = {
  GROUP_CLASS: 'Lớp nhóm',
  PERSONAL_TRAINING: 'PT 1-1',
  HYBRID: 'Kết hợp',
  CUSTOM: 'Tự do',
}
export const zoneLabel: Record<string, string> = {
  MALE_LOCKER: 'Khu nam',
  FEMALE_LOCKER: 'Khu nữ',
  VIP_AREA: 'Khu VIP',
}
export const lockerStatusLabel: Record<string, string> = {
  AVAILABLE: 'Trống',
  OCCUPIED: 'Đang dùng',
  MAINTENANCE: 'Bảo trì',
}
export const subscriptionStatusLabel: Record<string, string> = {
  ACTIVE: 'Hiệu lực',
  EXPIRED: 'Hết hạn',
  FROZEN: 'Đóng băng',
}
export const cancellationStatusLabel: Record<string, string> = {
  PENDING: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  CANCELLED: 'Đã hủy đơn',
}
export const roleLabel: Record<string, string> = {
  COACH: 'Huấn luyện viên',
  RECEPTIONIST: 'Lễ tân',
  MEMBER: 'Hội viên',
}
export const paymentMethodLabel: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản',
  CARD: 'Thẻ',
  MOCK: 'Thanh toán online',
  FREE: 'Miễn phí',
}
export const invoiceTypeLabel: Record<string, string> = {
  SUBSCRIPTION_NEW: 'Gói mới',
  PT_ADDON: 'Thêm buổi PT',
  DROP_IN: 'Vé lẻ',
}
export const bookingStatusLabel: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã đặt',
  CANCELLED: 'Đã hủy',
  ATTENDED: 'Đã tham gia',
}
