import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  Clock,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  formatDateToYMD,
  parseYMDToDate,
  getMondayOfWeek,
  shiftWeek,
  formatRangeLabel,
} from '../utils/calendar-date.utils'

interface MemberDatePickerModalProps {
  isOpen: boolean
  onClose: () => void
  currentWeek: string // YYYY-MM-DD (Monday of active week)
  onSelectWeek: (weekMonday: string) => void
}

export const MemberDatePickerModal: React.FC<MemberDatePickerModalProps> = ({
  isOpen,
  onClose,
  currentWeek,
  onSelectWeek,
}) => {
  // Current month view state
  const [viewDate, setViewDate] = useState<Date>(() => {
    return currentWeek ? parseYMDToDate(currentWeek) : new Date()
  })

  // Selected date inside modal (YYYY-MM-DD)
  const [modalSelectedDate, setModalSelectedDate] = useState<string>(() => {
    return currentWeek || formatDateToYMD(new Date())
  })

  // Sync state whenever modal opens or currentWeek changes
  useEffect(() => {
    if (isOpen) {
      const initial = currentWeek || formatDateToYMD(new Date())
      setModalSelectedDate(initial)
      if (initial) {
        setViewDate(parseYMDToDate(initial))
      }
    }
  }, [isOpen, currentWeek])

  const todayStr = useMemo(() => formatDateToYMD(new Date()), [])

  // Compute month calendar grid
  const monthData = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()

    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)

    // Monday as start of week: Day 0 = Sunday (distance = 6), Day 1 = Mon (0)...
    const firstDayWeekday = firstDayOfMonth.getDay()
    const leadingDaysCount = firstDayWeekday === 0 ? 6 : firstDayWeekday - 1

    const days = []

    // Leading days from previous month
    for (let i = leadingDaysCount; i > 0; i--) {
      const d = new Date(year, month, 1 - i)
      const iso = formatDateToYMD(d)
      days.push({
        date: d,
        iso,
        dayNum: d.getDate(),
        isCurrentMonth: false,
        isToday: iso === todayStr,
      })
    }

    // Days of current month
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i)
      const iso = formatDateToYMD(d)
      days.push({
        date: d,
        iso,
        dayNum: i,
        isCurrentMonth: true,
        isToday: iso === todayStr,
      })
    }

    // Trailing days from next month to complete the 7-column grid
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      const iso = formatDateToYMD(d)
      days.push({
        date: d,
        iso,
        dayNum: i,
        isCurrentMonth: false,
        isToday: iso === todayStr,
      })
    }

    return {
      year,
      month,
      monthLabel: `Tháng ${month + 1}, ${year}`,
      days,
    }
  }, [viewDate, todayStr])

  const handleApplyDate = (targetIso: string) => {
    const targetMonday = getMondayOfWeek(targetIso)
    onSelectWeek(targetMonday)
    onClose()
  }

  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
  }

  const handleJumpToToday = () => {
    const today = new Date()
    setViewDate(today)
    handleApplyDate(formatDateToYMD(today))
  }

  const handleJumpToThisWeek = () => {
    const monday = getMondayOfWeek()
    setViewDate(parseYMDToDate(monday))
    handleApplyDate(monday)
  }

  const handleJumpToOffsetWeeks = (offsetWeeks: number) => {
    const targetMonday = shiftWeek(getMondayOfWeek(), offsetWeeks)
    setViewDate(parseYMDToDate(targetMonday))
    handleApplyDate(targetMonday)
  }

  // Monday corresponding to modalSelectedDate
  const selectedDateMonday = useMemo(() => {
    return modalSelectedDate ? getMondayOfWeek(modalSelectedDate) : currentWeek
  }, [modalSelectedDate, currentWeek])

  const isCurrentActiveWeek = selectedDateMonday === currentWeek

  if (!isOpen) return null

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 md:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-none bg-white shadow-2xl border-2 border-slate-900 overflow-hidden max-h-[90vh] flex flex-col my-auto relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-none bg-[#17664e] text-white flex items-center justify-center">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Chọn Lịch & Thời Khóa Biểu
              </h3>
              <p className="text-xs text-slate-500">
                Chọn bất kỳ ngày nào để chuyển ngay đến tuần và lịch tập tương ứng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-none p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">
              Đi nhanh:
            </span>
            <button
              type="button"
              onClick={handleJumpToToday}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span>Hôm nay</span>
            </button>
            <button
              type="button"
              onClick={handleJumpToThisWeek}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
            >
              Tuần này
            </button>
            <button
              type="button"
              onClick={() => handleJumpToOffsetWeeks(1)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
            >
              Tuần sau (+1)
            </button>
            <button
              type="button"
              onClick={() => handleJumpToOffsetWeeks(2)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all shrink-0 cursor-pointer"
            >
              2 tuần tới (+2)
            </button>
          </div>

          {/* Month Navigation Header */}
          <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/80">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevMonth}
              className="h-8 w-8 p-0 border-slate-200 hover:bg-white text-slate-700 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center">
              <span className="text-sm font-black text-slate-900 tracking-tight">
                {monthData.monthLabel}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleNextMonth}
              className="h-8 w-8 p-0 border-slate-200 hover:bg-white text-slate-700 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((w, idx) => (
              <div
                key={w}
                className={`py-1 text-[11px] font-black uppercase tracking-wider ${
                  idx >= 5 ? 'text-amber-700' : 'text-slate-500'
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Month Grid */}
          <div className="grid grid-cols-7 gap-1">
            {monthData.days.map((item) => {
              const isSelected = item.iso === modalSelectedDate
              const isToday = item.isToday
              const itemMonday = getMondayOfWeek(item.iso)
              const isInCurrentViewWeek = itemMonday === currentWeek

              return (
                <button
                  key={item.iso}
                  type="button"
                  onClick={() => setModalSelectedDate(item.iso)}
                  onDoubleClick={() => handleApplyDate(item.iso)}
                  className={`group relative flex flex-col items-center justify-between min-h-[52px] p-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#17664e] bg-[#17664e] text-white shadow-md ring-2 ring-[#17664e]/30 z-10 scale-[1.03]'
                      : isToday
                      ? 'border-emerald-500 bg-emerald-50/80 text-emerald-950 font-bold hover:bg-emerald-100'
                      : isInCurrentViewWeek
                      ? 'border-emerald-200 bg-emerald-50/30 text-emerald-900 hover:bg-emerald-100/50'
                      : item.isCurrentMonth
                      ? 'border-slate-200/80 bg-white text-slate-800 hover:border-[#17664e]/50 hover:bg-slate-50'
                      : 'border-slate-100 bg-slate-50/50 text-slate-400 hover:bg-slate-100/50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full px-0.5">
                    <span
                      className={`text-[11px] font-bold ${
                        isSelected
                          ? 'text-white'
                          : isToday
                          ? 'text-emerald-700 font-extrabold'
                          : item.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.dayNum}
                    </span>

                    {isToday && !isSelected && (
                      <span className="text-[8px] uppercase tracking-wider font-extrabold bg-emerald-600 text-white px-1 rounded-xs">
                        Nay
                      </span>
                    )}
                  </div>

                  {isInCurrentViewWeek && !isSelected && (
                    <div className="w-full text-center">
                      <span className="text-[9px] text-[#17664e] font-semibold">
                        Đang xem
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Selected Date & Target Week Preview */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Ngày bạn chọn:
                </span>
                <span className="text-xs font-extrabold text-slate-900">
                  {parseYMDToDate(modalSelectedDate).toLocaleDateString('vi-VN', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </span>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Khoảng thời gian tuần:
                </span>
                <span className="text-xs font-bold text-[#17664e]">
                  {formatRangeLabel(selectedDateMonday)}
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-600 flex items-center justify-between">
              {isCurrentActiveWeek ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Đây chính là tuần bạn đang theo dõi trên màn hình.
                </span>
              ) : (
                <span className="text-slate-500">
                  Nhấp <strong>&ldquo;Xem Lịch Tuần Này&rdquo;</strong> (hoặc nhấn đúp chuột vào ngày) để chuyển đến tuần đã chọn.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-semibold cursor-pointer"
          >
            Đóng
          </Button>

          <Button
            type="button"
            onClick={() => handleApplyDate(modalSelectedDate)}
            className="bg-[#17664e] hover:bg-[#135641] text-white text-xs font-bold gap-1.5 shadow-sm shadow-[#17664e]/20 cursor-pointer"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Xem Lịch </span>
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
