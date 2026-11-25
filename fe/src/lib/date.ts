export function mondayInVietnam(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const day = new Date(`${value.year}-${value.month}-${value.day}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7))
  return day.toISOString().slice(0, 10)
}
export function shiftWeek(week: string, deltaWeeks: number): string {
  const day = new Date(`${week}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() + deltaWeeks * 7)
  return day.toISOString().slice(0, 10)
}
export function isMonday(week: string | null): week is string {
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) return false
  const day = new Date(`${week}T00:00:00Z`)
  return (
    !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === week && day.getUTCDay() === 1
  )
}
export function vietnamDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}
export function vietnamTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(value))
}

export function vietnamDateTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
