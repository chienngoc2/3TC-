export interface PeakHourConfig {
  id: string
  label: string
  startHour: number
  startMinute: number
  endHour: number
  endMinute: number
  dailyCap: number
  weeklyCap: number
  isActive: boolean
}

function toVnMinutes(dateInput: string | Date): number {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  if (!Number.isFinite(d.getTime())) return -1
  // Convert to Asia/Ho_Chi_Minh (UTC+7)
  const vnMs = d.getTime() + 7 * 60 * 60 * 1000
  const vnDate = new Date(vnMs)
  return vnDate.getUTCHours() * 60 + vnDate.getUTCMinutes()
}

export function isTimeInPeakHours(
  dateInput: string | Date,
  configs: PeakHourConfig[] = [],
): PeakHourConfig | null {
  const mins = toVnMinutes(dateInput)
  if (mins < 0) return null
  for (const cfg of configs) {
    if (!cfg.isActive) continue
    const start = cfg.startHour * 60 + (cfg.startMinute || 0)
    const end = cfg.endHour * 60 + (cfg.endMinute || 0)
    if (mins >= start && mins < end) return cfg
  }
  return null
}

export function isRangeInPeakHours(
  startInput: string | Date,
  endInput: string | Date,
  configs: PeakHourConfig[] = [],
): PeakHourConfig | null {
  const sMins = toVnMinutes(startInput)
  const eMins = toVnMinutes(endInput)
  if (sMins < 0 || eMins < 0) return null
  for (const cfg of configs) {
    if (!cfg.isActive) continue
    const start = cfg.startHour * 60 + (cfg.startMinute || 0)
    const end = cfg.endHour * 60 + (cfg.endMinute || 0)
    if (sMins < end && eMins > start) return cfg
  }
  return null
}

export function formatPeakRange(cfg: PeakHourConfig): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(cfg.startHour)}:${pad(cfg.startMinute || 0)}–${pad(cfg.endHour)}:${pad(cfg.endMinute || 0)}`
}
