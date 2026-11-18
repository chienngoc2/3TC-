/**
 * Utilities for handling Vietnam Timezone (Asia/Ho_Chi_Minh, UTC+7).
 * Standardizes conversions between Vietnam business calendar days and database UTC timestamps.
 */

export const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const VN_OFFSET_HOURS = 7;
export const VN_OFFSET_MS = VN_OFFSET_HOURS * 60 * 60 * 1000;

const isoDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: VIETNAM_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Returns YYYY-MM-DD of a date in Vietnam timezone.
 */
export function toVietnamDateString(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return isoDayFmt.format(d);
}

/**
 * Returns the UTC Date boundaries for a Vietnam calendar day.
 * Example: for "2026-11-18" in Vietnam (+07:00):
 * - startUtc: 2026-11-17T17:00:00.000Z (00:00:00 VN)
 * - endUtc:   2026-11-18T16:59:59.999Z (23:59:59.999 VN)
 */
export function getVietnamDayBounds(dayInput: string | Date = new Date()): {
  startUtc: Date;
  endUtc: Date;
  dateStr: string;
} {
  const dateStr =
    typeof dayInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dayInput)
      ? dayInput
      : toVietnamDateString(dayInput);

  const [yearStr, monthStr, dayNumStr] = dateStr.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayNumStr, 10);

  // 00:00:00 VN = 17:00:00 UTC previous day
  const startUtc = new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0, 0));
  // 23:59:59.999 VN = 16:59:59.999 UTC current day
  const endUtc = new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999));

  return { startUtc, endUtc, dateStr };
}

/**
 * Returns UTC boundaries for a date range in Vietnam timezone.
 */
export function getVietnamDateRange(
  from?: string | Date,
  to?: string | Date,
): {
  startUtc?: Date;
  endUtc?: Date;
} {
  let startUtc: Date | undefined;
  let endUtc: Date | undefined;

  if (from) {
    startUtc = getVietnamDayBounds(from).startUtc;
  }
  if (to) {
    endUtc = getVietnamDayBounds(to).endUtc;
  }

  return { startUtc, endUtc };
}

/**
 * Parse a Vietnam local date and time into UTC instant.
 * Example: "2026-11-18", "06:00" -> 2026-11-17T23:00:00.000Z
 */
export function toVietnamInstant(dayStr: string, timeStr: string): Date {
  return new Date(`${dayStr}T${timeStr}:00+07:00`);
}
