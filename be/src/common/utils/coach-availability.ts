/**
 * Kiểm tra khung giờ [startTime, endTime] có nằm trong lịch làm việc cố định
 * (workingDays & workingHours) đã cấu hình trong CoachProfile hay không (theo múi giờ VN UTC+7).
 */
export function isWithinCoachProfileSchedule(
  profile: { workingDays?: unknown; workingHours?: unknown } | null | undefined,
  startTime: Date,
  endTime: Date,
): boolean {
  if (!profile) return false;
  const workingDays = Array.isArray(profile.workingDays)
    ? (profile.workingDays as string[])
    : [];
  const workingHours = Array.isArray(profile.workingHours)
    ? (profile.workingHours as any[])
    : [];

  if (workingDays.length === 0 && workingHours.length === 0) return false;

  const vnStart = new Date(startTime.getTime() + 7 * 60 * 60 * 1000);
  const vnEnd = new Date(endTime.getTime() + 7 * 60 * 60 * 1000);
  const dayNames = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];
  const dayCode = dayNames[vnStart.getUTCDay()];

  if (workingDays.length > 0 && !workingDays.includes(dayCode)) {
    return false;
  }

  if (workingHours.length === 0) {
    return workingDays.includes(dayCode);
  }

  const sHour = `${String(vnStart.getUTCHours()).padStart(2, '0')}:${String(vnStart.getUTCMinutes()).padStart(2, '0')}`;
  const eHour = `${String(vnEnd.getUTCHours()).padStart(2, '0')}:${String(vnEnd.getUTCMinutes()).padStart(2, '0')}`;

  return workingHours.some((wh: any) => {
    if (typeof wh === 'string') {
      const [regStart, regEnd] = wh.split('-').map((x) => x.trim());
      return Boolean(regStart && regEnd && regStart <= sHour && regEnd >= eHour);
    }
    if (wh?.day && wh.day !== dayCode) return false;
    const regStart = wh?.start || wh?.from || '08:00';
    const regEnd = wh?.end || wh?.to || '12:00';
    return regStart <= sHour && regEnd >= eHour;
  });
}
