const timezone = "Asia/Ho_Chi_Minh";

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: timezone,
  hour: "2-digit",
  minute: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: timezone,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const formatTime = (iso: string): string => timeFormatter.format(new Date(iso));
export const formatDateTime = (iso: string): string => dateTimeFormatter.format(new Date(iso));
export const isTodayInVietnam = (iso: string, now = new Date()): boolean =>
  dayFormatter.format(new Date(iso)) === dayFormatter.format(now);
