import React, { useState, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  BookOpen,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/context/notification-context';
import { coachPortalApi } from '../api/coach-portal-api';
import { notifyDataChanged } from '@/lib/sync-channel';

interface CreateSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
}

// 24h even hour options from 06:00 to 22:00 (no odd minutes permitted)
const HOUR_OPTIONS = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

const DAYS_OF_WEEK = [
  { id: 1, label: 'Thứ 2', short: 'T2' },
  { id: 2, label: 'Thứ 3', short: 'T3' },
  { id: 3, label: 'Thứ 4', short: 'T4' },
  { id: 4, label: 'Thứ 5', short: 'T5' },
  { id: 5, label: 'Thứ 6', short: 'T6' },
  { id: 6, label: 'Thứ 7', short: 'T7' },
  { id: 7, label: 'Chủ Nhật', short: 'CN' },
];

const EXCEPTION_OPTIONS = [
  'Khách hẹn gấp',
  'Dạy bù cho học viên',
  'Đổi lịch theo thỏa thuận',
  'Tập bổ trợ thể lực phát sinh',
  'Khác',
];

const getMondayOfWeek = (d: Date): Date => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.getFullYear(), date.getMonth(), diff, 0, 0, 0, 0);
};

const formatDateYMD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Interactive Calendar Picker Modal
interface CalendarPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonday: Date;
  onSelectDate: (date: Date) => void;
  todayStr: string;
}

const CalendarPickerModal: React.FC<CalendarPickerModalProps> = ({
  isOpen,
  onClose,
  selectedMonday,
  onSelectDate,
  todayStr,
}) => {
  const [viewYear, setViewYear] = useState(() => selectedMonday.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selectedMonday.getMonth());

  useEffect(() => {
    if (isOpen) {
      setViewYear(selectedMonday.getFullYear());
      setViewMonth(selectedMonday.getMonth());
    }
  }, [isOpen, selectedMonday]);

  if (!isOpen) return null;

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const startDayOfWeek = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1; // 0=Mon, 6=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(viewYear, viewMonth, 0).getDate();

  const totalGridCells = 42; // 6 rows x 7 cols
  const cells = [];

  for (let i = 0; i < totalGridCells; i++) {
    if (i < startDayOfWeek) {
      // Prev month trailing day
      const dayNum = prevMonthTotalDays - startDayOfWeek + i + 1;
      cells.push({
        type: 'prev',
        dayNum,
        date: new Date(viewYear, viewMonth - 1, dayNum),
      });
    } else if (i < startDayOfWeek + daysInMonth) {
      // Current month day
      const dayNum = i - startDayOfWeek + 1;
      cells.push({
        type: 'current',
        dayNum,
        date: new Date(viewYear, viewMonth, dayNum),
      });
    } else {
      // Next month leading day
      const dayNum = i - (startDayOfWeek + daysInMonth) + 1;
      cells.push({
        type: 'next',
        dayNum,
        date: new Date(viewYear, viewMonth + 1, dayNum),
      });
    }
  }

  const selectedMondayYMD = formatDateYMD(selectedMonday);
  const selectedSunday = new Date(selectedMonday);
  selectedSunday.setDate(selectedSunday.getDate() + 6);
  const selectedSundayYMD = formatDateYMD(selectedSunday);

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 bg-gradient-to-r from-emerald-50 via-slate-50 to-white">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-extrabold text-slate-900">Chọn Lịch Làm Việc</h4>
              <p className="text-[11px] text-slate-500">Bấm ngày để chọn tuần tương ứng</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Calendar Nav */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-black text-slate-800">
              Tháng {viewMonth + 1}, {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day of Week Titles */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 uppercase">
            <span>T2</span>
            <span>T3</span>
            <span>T4</span>
            <span>T5</span>
            <span>T6</span>
            <span>T7</span>
            <span>CN</span>
          </div>

          {/* Grid Days */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              const cellYMD = formatDateYMD(cell.date);
              const isPast = cellYMD < todayStr;
              const isToday = cellYMD === todayStr;
              const isCurrentViewMonth = cell.type === 'current';
              const isInSelectedWeek =
                cellYMD >= selectedMondayYMD && cellYMD <= selectedSundayYMD;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isPast || !isCurrentViewMonth}
                  onClick={() => {
                    onSelectDate(cell.date);
                    onClose();
                  }}
                  className={`h-8 w-full rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                    !isCurrentViewMonth
                      ? 'text-slate-300 opacity-40 cursor-not-allowed'
                      : isPast
                      ? 'text-slate-300 cursor-not-allowed bg-slate-50'
                      : isInSelectedWeek
                      ? 'bg-emerald-600 text-white shadow-2xs font-black'
                      : isToday
                      ? 'border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50'
                      : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                  }`}
                >
                  {cell.dayNum}
                </button>
              );
            })}
          </div>

          {/* Direct Date Input Alternative */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-500">Hoặc chọn ngày:</span>
            <input
              type="date"
              min={todayStr}
              defaultValue={selectedMondayYMD}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number);
                  onSelectDate(new Date(y, m - 1, d));
                  onClose();
                }
              }}
              className="text-xs font-semibold px-2 py-1 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-emerald-600"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold py-1 px-3 cursor-pointer"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export const CreateSlotModal: React.FC<CreateSlotModalProps> = ({
  isOpen,
  onClose,
  initialDate,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useNotification();

  const now = new Date();
  const todayStr = formatDateYMD(now);
  const todayDayIndex = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon ... 7=Sun

  // Monday of the currently selected week
  const [selectedMonday, setSelectedMonday] = useState<Date>(() => {
    if (initialDate && initialDate >= todayStr) {
      return getMondayOfWeek(new Date(initialDate));
    }
    return getMondayOfWeek(new Date());
  });

  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([todayDayIndex]);
  const [startTime, setStartTime] = useState<string>('08:00');
  const [endTime, setEndTime] = useState<string>('12:00');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isException, setIsException] = useState<boolean>(false);
  const [exceptionReasonType, setExceptionReasonType] = useState<string>('Khách hẹn gấp');
  const [customExceptionReason, setCustomExceptionReason] = useState<string>('');
  const [selectedWorkoutPlanId, setSelectedWorkoutPlanId] = useState<string>('');

  // Fetch coach's profile to retrieve registered working hours for suggestions
  const { data: coachProfileData } = useQuery({
    queryKey: ['coach', 'profile'],
    queryFn: coachPortalApi.getMyProfile,
    staleTime: 60000,
  });

  // Fetch coach's pre-created curriculums & plans for 1-click apply when opening slots
  const { data: coachWorkoutPlans = [] } = useQuery({
    queryKey: ['coach', 'workout-plans'],
    queryFn: () => coachPortalApi.getWorkoutPlans(),
    enabled: isOpen,
    staleTime: 30000,
  });

  const reusableCurriculums = useMemo(() => {
    const blueprints = coachWorkoutPlans.filter((p) => !p.memberId);
    const assigned = coachWorkoutPlans.filter((p) => Boolean(p.memberId));
    return [...blueprints, ...assigned];
  }, [coachWorkoutPlans]);

  const selectedCurriculum = useMemo(
    () => reusableCurriculums.find((p) => p.id === selectedWorkoutPlanId) || null,
    [reusableCurriculums, selectedWorkoutPlanId]
  );

  const DAY_ID_TO_CODE: Record<number, string> = {
    1: 'MONDAY',
    2: 'TUESDAY',
    3: 'WEDNESDAY',
    4: 'THURSDAY',
    5: 'FRIDAY',
    6: 'SATURDAY',
    7: 'SUNDAY',
  };

  const DAY_ID_TO_LABEL: Record<number, string> = {
    1: 'Thứ 2',
    2: 'Thứ 3',
    3: 'Thứ 4',
    4: 'Thứ 5',
    5: 'Thứ 6',
    6: 'Thứ 7',
    7: 'Chủ Nhật',
  };

  // Check if a specific day & time is covered by coach's registered hours
  const isTimeframeWithinRegisteredHours = (dayId: number, sTime: string, eTime: string): boolean => {
    const cp = coachProfileData?.coachProfile;
    if (!cp) return true; // not loaded yet — assume within hours
    const dayCode = DAY_ID_TO_CODE[dayId];
    if (!dayCode) return false;

    const workingDays = Array.isArray(cp.workingDays) ? cp.workingDays : [];
    // Day not registered at all → definitely outside
    if (!workingDays.includes(dayCode)) return false;

    const rawHours = Array.isArray(cp.workingHours) ? cp.workingHours : [];
    // Filter hours relevant to this specific day (entries with day=code or entries without a day field)
    const matching = rawHours.filter((wh: any) => !wh.day || wh.day === dayCode);

    // If no specific working hours are configured but the day IS registered,
    // treat it as within hours (the day itself is enough clearance).
    if (matching.length === 0) return true;

    // Parse times as total minutes to handle edge cases cleanly
    const toMins = (t: string) => {
      const parts = t.split(':').map(Number);
      return parts[0] * 60 + (parts[1] || 0);
    };
    const slotStart = toMins(sTime);
    const slotEnd = toMins(eTime);

    // Check if the chosen slot fully fits within any registered window
    return matching.some((wh: any) => {
      const windowStart = toMins(wh.start || wh.from || '08:00');
      const windowEnd = toMins(wh.end || wh.to || '17:00');
      return windowStart <= slotStart && windowEnd >= slotEnd;
    });
  };

  // Determine if the currently chosen hours on the selected days fall outside registered hours
  const isOutsideRegisteredHours = useMemo(() => {
    if (!coachProfileData?.coachProfile || selectedDays.length === 0) return false;
    return selectedDays.some(
      (dayId) => !isTimeframeWithinRegisteredHours(dayId, startTime, endTime),
    );
  }, [coachProfileData, selectedDays, startTime, endTime]);

  // When isOutsideRegisteredHours is true, isException is FORCED to true!
  const effectiveIsException = isOutsideRegisteredHours || isException;

  // Unregistered days selected (not in workingDays)
  const unregisteredDays = useMemo(() => {
    const cp = coachProfileData?.coachProfile;
    if (!cp) return [];
    const workingDays = Array.isArray(cp.workingDays) ? cp.workingDays : [];
    return selectedDays
      .filter((dayId) => !workingDays.includes(DAY_ID_TO_CODE[dayId]))
      .map((dayId) => DAY_ID_TO_LABEL[dayId]);
  }, [coachProfileData, selectedDays]);

  // Find all registered working hours for the selected days from DB profile
  const suggestedTimeframes = useMemo(() => {
    const cp = coachProfileData?.coachProfile;
    if (!cp) return [];
    const rawHours = cp.workingHours;
    if (!rawHours || !Array.isArray(rawHours) || rawHours.length === 0) return [];

    const workingDays = Array.isArray(cp.workingDays) ? cp.workingDays : [];

    const list: {
      key: string;
      dayLabel: string;
      start: string;
      end: string;
      duration: number;
    }[] = [];

    for (const dayId of selectedDays) {
      const code = DAY_ID_TO_CODE[dayId];
      const label = DAY_ID_TO_LABEL[dayId];
      if (!code) continue;

      // CRITICAL FIX: Only suggest timeframes if this day is actually in the coach's registered workingDays!
      if (!workingDays.includes(code)) continue;

      const matching = rawHours.filter(
        (wh: any) => wh.day ? wh.day === code : true,
      );

      for (const item of matching) {
        const s = item.start || item.from || '08:00';
        const e = item.end || item.to || '12:00';
        const [sh] = s.split(':').map(Number);
        const [eh] = e.split(':').map(Number);
        const dur = eh - sh;
        if (dur > 0) {
          list.push({
            key: `${code}-${s}-${e}`,
            dayLabel: label,
            start: s,
            end: e,
            duration: dur,
          });
        }
      }
    }

    return list;
  }, [coachProfileData, selectedDays]);

  // Sync initialDate when prop updates
  useEffect(() => {
    if (initialDate && initialDate >= todayStr) {
      const dt = new Date(initialDate);
      setSelectedMonday(getMondayOfWeek(dt));
      const targetDay = dt.getDay() === 0 ? 7 : dt.getDay();
      setSelectedDays([targetDay]);
    } else {
      setSelectedMonday(getMondayOfWeek(new Date()));
      setSelectedDays([todayDayIndex]);
    }
  }, [initialDate, todayStr, todayDayIndex]);

  // Compute week dates for the current selectedMonday
  const weekDays = useMemo(() => {
    return DAYS_OF_WEEK.map((item, idx) => {
      const dt = new Date(selectedMonday);
      dt.setDate(selectedMonday.getDate() + idx);
      const dateStr = formatDateYMD(dt);
      const displayDate = `${dt.getDate()}/${dt.getMonth() + 1}`;
      const isPast = dateStr < todayStr;
      const isToday = dateStr === todayStr;
      return {
        ...item,
        dateStr,
        displayDate,
        isPast,
        isToday,
      };
    });
  }, [selectedMonday, todayStr]);

  const thisWeekMonday = useMemo(() => getMondayOfWeek(new Date()), []);
  const isCurrentWeek = selectedMonday.getTime() === thisWeekMonday.getTime();

  const sundayOfSelectedWeek = useMemo(() => {
    const s = new Date(selectedMonday);
    s.setDate(s.getDate() + 6);
    return s;
  }, [selectedMonday]);

  const displayWeekRange = `${selectedMonday.getDate()}/${selectedMonday.getMonth() + 1} - ${sundayOfSelectedWeek.getDate()}/${sundayOfSelectedWeek.getMonth() + 1}`;

  const [startHourNum] = (startTime || '08:00').split(':').map(Number);
  const [endHourNum] = (endTime || '12:00').split(':').map(Number);
  const durationHours = endHourNum - startHourNum;

  const isInvalidRange = durationHours <= 0;
  const isOver8Hours = durationHours > 8;

  const effectiveExceptionReason = effectiveIsException
    ? exceptionReasonType === 'Khác'
      ? customExceptionReason.trim() || 'Lý do khác'
      : exceptionReasonType
    : undefined;

  // Build the list of 1-hour slots across all selected days
  const validSlotsToCreate = useMemo(() => {
    if (isInvalidRange || isOver8Hours || selectedDays.length === 0) return [];

    const slots: {
      startTime: string;
      endTime: string;
      exceptionReason?: string;
      workoutPlanId?: string;
    }[] = [];
    const curTimeMs = new Date().getTime();

    selectedDays.forEach((dayId) => {
      const dayInfo = weekDays.find((wd) => wd.id === dayId);
      if (!dayInfo || dayInfo.isPast) return;

      const dateStr = dayInfo.dateStr;

      for (let h = startHourNum; h < endHourNum; h++) {
        const sTime = `${String(h).padStart(2, '0')}:00`;
        const eTime = `${String(h + 1).padStart(2, '0')}:00`;
        const startDt = new Date(`${dateStr}T${sTime}:00`);
        const endDt = new Date(`${dateStr}T${eTime}:00`);

        if (startDt.getTime() > curTimeMs && endDt > startDt) {
          slots.push({
            startTime: startDt.toISOString(),
            endTime: endDt.toISOString(),
            exceptionReason: effectiveExceptionReason,
            ...(selectedWorkoutPlanId ? { workoutPlanId: selectedWorkoutPlanId } : {}),
          });
        }
      }
    });

    return slots;
  }, [
    isInvalidRange,
    isOver8Hours,
    selectedDays,
    weekDays,
    startHourNum,
    endHourNum,
    effectiveExceptionReason,
    selectedWorkoutPlanId,
  ]);

  // Check if any exception slots violate the 2-hour lead time requirement
  const slotsTooCloseForException = useMemo(() => {
    if (!effectiveIsException) return [];
    const curTimeMs = Date.now();
    return validSlotsToCreate.filter(
      (s) => new Date(s.startTime).getTime() - curTimeMs < 2 * 60 * 60 * 1000,
    );
  }, [effectiveIsException, validSlotsToCreate]);

  const hasTooCloseException = slotsTooCloseForException.length > 0;
  const allExceptionSlotsTooClose =
    effectiveIsException &&
    validSlotsToCreate.length > 0 &&
    slotsTooCloseForException.length === validSlotsToCreate.length;

  // Mutation: Tạo ca rảnh
  const createSlotsMutation = useMutation({
    mutationFn: async () => {
      setErrorMessage(null);
      if (selectedDays.length === 0) {
        throw new Error('Vui lòng chọn ít nhất 1 thứ trong tuần để áp dụng.');
      }
      if (isInvalidRange) {
        throw new Error('Giờ kết thúc phải lớn hơn giờ bắt đầu.');
      }
      if (isOver8Hours) {
        throw new Error('Khung giờ  mở mới không được vượt quá 8h/ngày theo quy định.');
      }
      if (effectiveIsException && exceptionReasonType === 'Khác' && !customExceptionReason.trim()) {
        throw new Error('Vui lòng nhập lý do cụ thể khi chọn mục "Khác".');
      }
      if (effectiveIsException && allExceptionSlotsTooClose) {
        throw new Error('Ca dạy ngoài giờ (ngoại lệ) cần đăng ký trước giờ bắt đầu tối thiểu 2 tiếng để Quản lý kịp thời phê duyệt.');
      }
      if (validSlotsToCreate.length === 0) {
        throw new Error('Không có ca hợp lệ nào trong tương lai để mở (các khung giờ đã qua thời điểm hiện tại).');
      }

      return coachPortalApi.createSlotsBulk(validSlotsToCreate);
    },
    onSuccess: (res) => {
      const count = res?.count ?? validSlotsToCreate.length;
      if (count > 0) {
        showToast(
          'success',
          'Thành công',
          effectiveIsException
            ? `Đã gửi yêu cầu ${count} ca ngoại lệ lên Quản lý duyệt thành công!`
            : `Đã mở thành công ${count} ca cho các ngày đã chọn!`
        );
      } else {
        showToast(
          'warning',
          'Thông báo',
          'Các ca trong khung giờ này đã tồn tại sẵn trong lịch (hệ thống tự động bỏ qua).'
        );
      }
      onClose();
      notifyDataChanged('SLOT_CREATED', { count }, queryClient);
      void queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'profile'] });
      void queryClient.invalidateQueries({ queryKey: ['member-calendar'] });
    },
    onError: (err: any) => {
      let msg = err.response?.data?.message || err.message || 'Lỗi khi mở khung giờ ';
      if (typeof msg !== 'string') msg = JSON.stringify(msg);

      if (msg.includes('SCHEDULE_OR_DATA_CONFLICT') || msg.includes('23P01')) {
        msg = 'Một số ca bị trùng lặp với lịch hiện có hoặc ca trực khác. Vui lòng kiểm tra lại khung giờ.';
      } else if (msg.includes('SLOT_MUST_BE_FUTURE')) {
        msg = 'Khung giờ mở slot  bắt buộc phải ở thời điểm tương lai.';
      }
      setErrorMessage(msg);
      showToast('error', 'Lỗi mở ca', msg);
    },
  });

  if (!isOpen) return null;

  return (
    <>
      <CalendarPickerModal
        isOpen={showCalendarModal}
        onClose={() => setShowCalendarModal(false)}
        selectedMonday={selectedMonday}
        todayStr={todayStr}
        onSelectDate={(pickedDate) => {
          setSelectedMonday(getMondayOfWeek(pickedDate));
          const dayId = pickedDate.getDay() === 0 ? 7 : pickedDate.getDay();
          setSelectedDays([dayId]);
        }}
      />

      {createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-gradient-to-r from-emerald-50/80 via-slate-50 to-white">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-600/30">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">Mở Khung Giờ  PT</h3>
                    <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase px-2 py-0.5">
                      TỐI ĐA 8H / NGÀY
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Chọn thứ trong tuần và khung giờ làm việc, hệ thống tự động mở ca cho học viên đặt lịch
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                type="button"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {errorMessage && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {isOver8Hours && (
                <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Vượt quá giới hạn: </span>
                    Khung giờ bạn chọn đã vượt quá mức tối đa <strong>8h / ngày</strong> theo quy định trung tâm.
                  </div>
                </div>
              )}

              {/* 1. Chọn Tuần & Thứ trong tuần (Thứ 2 - Chủ Nhật) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                {/* Week Switcher with Calendar Button */}
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-emerald-600" />
                    <span>1. Chọn tuần áp dụng:</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMonday(getMondayOfWeek(new Date()));
                        setSelectedDays([todayDayIndex]);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrentWeek
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`}
                    >
                      Tuần này
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCalendarModal(true)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        !isCurrentWeek
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-700 hover:bg-slate-100'
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      <span>{!isCurrentWeek ? `Tuần: ${displayWeekRange}` : 'Lịch chọn ngày'}</span>
                    </button>
                  </div>
                </div>

                {/* Day of Week Selector: Thứ 2 - Chủ Nhật */}
                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-700">
                      2. Chọn thứ trong tuần:
                    </span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => {
                          const todayArr = isCurrentWeek ? [todayDayIndex] : [1];
                          setSelectedDays(todayArr);
                        }}
                        className="text-emerald-700 font-bold hover:underline px-1 py-0.5 cursor-pointer"
                      >
                        {isCurrentWeek ? 'Hôm nay' : 'Đầu tuần (T2)'}
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                        className="text-emerald-700 font-bold hover:underline px-1 py-0.5 cursor-pointer"
                      >
                        T2 - T6
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedDays([1, 2, 3, 4, 5, 6, 7])}
                        className="text-emerald-700 font-bold hover:underline px-1 py-0.5 cursor-pointer"
                      >
                        Cả tuần
                      </button>
                    </div>
                  </div>

                  {/* Grid 7 ngày: Thứ 2 -> Chủ Nhật */}
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                    {weekDays.map((d) => {
                      const isChecked = selectedDays.includes(d.id);
                      const disabled = d.isPast;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setSelectedDays((prev) =>
                              prev.includes(d.id)
                                ? prev.filter((x) => x !== d.id)
                                : [...prev, d.id].sort((a, b) => a - b)
                            );
                          }}
                          className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            disabled
                              ? 'border-slate-200 bg-slate-100 text-slate-400 opacity-50 cursor-not-allowed'
                              : isChecked
                              ? 'border-emerald-600 bg-emerald-600 text-white font-bold shadow-2xs'
                              : 'border-slate-200 bg-white hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span className="text-xs font-bold">{d.short}</span>
                          <span
                            className={`text-[10px] ${
                              isChecked ? 'text-emerald-100 font-semibold' : 'text-slate-400 font-medium'
                            }`}
                          >
                            {d.displayDate}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. Khung Giờ Làm Việc (Từ mấy giờ đến mấy giờ - Giờ chẵn :00) */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    <span>3. Khung giờ làm việc </span>
                  </label>
                  {(durationHours <= 0 || durationHours > 8) && (
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full border bg-rose-100 text-rose-800 border-rose-300">
                      {durationHours <= 0 ? 'Giờ không hợp lệ' : 'Tối đa 8h/ngày'}
                    </span>
                  )}
                </div>

                {/* Suggestions from coach profile registered working hours in DB */}
                {suggestedTimeframes.length > 0 ? (
                  <div className="pt-1 pb-1 space-y-1.5 border-b border-slate-200">
                    <span className="text-[11px] font-bold text-slate-700 block">
                      Khung giờ đã đăng ký trong hồ sơ :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestedTimeframes.map((sug) => {
                        const isMatch = startTime === sug.start && endTime === sug.end;
                        return (
                          <button
                            key={sug.key}
                            type="button"
                            onClick={() => {
                              setStartTime(sug.start);
                              setEndTime(sug.end);
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              isMatch
                                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            <span>{sug.dayLabel}: {sug.start} - {sug.end}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : unregisteredDays.length > 0 ? (
                  <div className="p-2.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-[11px] text-amber-950">
                        {unregisteredDays.join(', ')} không thuộc lịch trực cố định đã đăng ký
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Bạn chưa đăng ký lịch làm việc vào ngày này trong hồ sơ. Ca mở sẽ được gửi dưới dạng đăng ký dạy thêm ngoài lịch.
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block text-[11px] font-bold text-slate-600 mb-1">
                      Bắt đầu:
                    </span>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    >
                      {HOUR_OPTIONS.slice(0, -1).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span className="block text-[11px] font-bold text-slate-600 mb-1">
                      Kết thúc:
                    </span>
                    <select
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-hidden"
                    >
                      {HOUR_OPTIONS.slice(1).map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 4. Áp dụng giáo trình tạo sẵn (Tùy chọn) */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-[#17664e]" />
                    <span>4. Áp dụng giáo trình tạo sẵn (Tùy chọn)</span>
                  </label>
                  {selectedWorkoutPlanId && (
                    <button
                      type="button"
                      onClick={() => setSelectedWorkoutPlanId('')}
                      className="text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  )}
                </div>

                {reusableCurriculums.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Chưa có giáo trình tạo sẵn. Bạn có thể tạo trước tại mục Giáo án để gắn nhanh khi mở ca.
                  </p>
                ) : (
                  <>
                    <select
                      value={selectedWorkoutPlanId}
                      onChange={(e) => setSelectedWorkoutPlanId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-[#17664e] focus:outline-hidden"
                    >
                      <option value="">Không gắn giáo trình trước</option>
                      {reusableCurriculums.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {!plan.memberId ? '[Giáo trình mẫu] ' : ''}
                          {plan.title} ({plan.exercises?.length || 0} bài tập)
                        </option>
                      ))}
                    </select>

                    {selectedCurriculum && (
                      <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900 truncate">
                            {selectedCurriculum.title}
                          </span>
                          <span className="text-[11px] font-medium text-[#17664e] tabular-nums shrink-0 ml-2">
                            {selectedCurriculum.exercises?.length || 0} động tác
                          </span>
                        </div>
                        {selectedCurriculum.exercises && selectedCurriculum.exercises.length > 0 && (
                          <p className="text-[11px] text-slate-500 line-clamp-2">
                            {selectedCurriculum.exercises
                              .map((ex) => ex.exercise?.title || 'Bài tập')
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* 3. Exception Slot Toggle & Reason */}
              <div className="pt-1 border-t border-slate-100 space-y-2">
                {isOutsideRegisteredHours ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs space-y-1">
                    <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                      <span>Ca dạy ngoài khung giờ đăng ký </span>
                    </div>
                    
                  </div>
                ) : (
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                    <input
                      type="checkbox"
                      checked={isException}
                      onChange={(e) => setIsException(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>Đăng kí dạy thêm</span>
                  </label>
                )}

                {effectiveIsException && (
                  <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-2.5 animate-in fade-in duration-100">
                    <div className="text-amber-900 font-bold">
                      Lý do xin dạy thêm:
                    </div>
                    <select
                      value={exceptionReasonType}
                      onChange={(e) => setExceptionReasonType(e.target.value)}
                      className="w-full rounded-lg border border-amber-300 bg-white p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {EXCEPTION_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {exceptionReasonType === 'Khác' && (
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-amber-900">
                          Nhập lý do cụ thể:
                        </label>
                        <input
                          type="text"
                          value={customExceptionReason}
                          onChange={(e) => setCustomExceptionReason(e.target.value)}
                          placeholder="Nhập lý do cụ thể..."
                          className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-hidden"
                          autoFocus
                        />
                      </div>
                    )}

                    {hasTooCloseException && (
                      <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-[11px] font-medium text-rose-800 space-y-1">
                        <div className="font-bold flex items-center gap-1 text-rose-900">
                          <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                          <span>Yêu cầu thời hạn gửi đơn (Lead time)</span>
                        </div>
                        <div>
                          Ca dạy ngoài giờ cần gửi trước giờ bắt đầu tối thiểu <strong>2 tiếng</strong> để Quản lý kịp thời xem xét và phê duyệt.
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-amber-800 font-normal">
                      Quản lý sẽ xem xét và phê duyệt (hạn chót duyệt là trước ca 1 tiếng) để ca chính thức mở cho học viên.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
              <div className="text-xs font-semibold text-slate-600">
               
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={createSlotsMutation.isPending}
                  className="text-xs font-semibold cursor-pointer"
                >
                  Hủy
                </Button>

                <Button
                  type="button"
                  onClick={() => createSlotsMutation.mutate()}
                  disabled={
                    createSlotsMutation.isPending ||
                    selectedDays.length === 0 ||
                    isInvalidRange ||
                    isOver8Hours ||
                    validSlotsToCreate.length === 0 ||
                    allExceptionSlotsTooClose
                  }
                  className={`text-xs font-bold gap-1.5 shadow-sm transition-all cursor-pointer ${
                    selectedDays.length === 0 || isInvalidRange || isOver8Hours || validSlotsToCreate.length === 0 || allExceptionSlotsTooClose
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed hover:bg-slate-300 shadow-none'
                      : effectiveIsException
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                  }`}
                >
                  {createSlotsMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  <span>
                    {selectedDays.length === 0
                      ? 'Chọn thứ trong tuần'
                      : isOver8Hours
                      ? 'Vượt quá 8h/ngày'
                      : isInvalidRange
                      ? 'Giờ không hợp lệ'
                      : validSlotsToCreate.length === 0
                      ? 'Giờ trong quá khứ'
                      : allExceptionSlotsTooClose
                      ? 'Quá sát giờ (< 2 tiếng)'
                      : effectiveIsException
                      ? `Gửi yêu cầu (${validSlotsToCreate.length} ca)`
                      : `Mở (${validSlotsToCreate.length} ca)`}
                  </span>
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};