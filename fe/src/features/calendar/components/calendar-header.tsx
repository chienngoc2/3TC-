import React, { useEffect, useRef, useState } from 'react'
import type { Discipline, CalendarSubscription } from '../types/calendar.types'
import { formatRangeLabel } from '../utils/calendar-date.utils'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MemberDatePickerModal } from './member-date-picker-modal'

interface CalendarHeaderProps {
  currentWeek: string
  onWeekChange: (direction: 'prev' | 'next') => void
  onGoToCurrentWeek: () => void
  onSelectWeek?: (weekMonday: string) => void
  selectedDisciplineId: string
  onDisciplineChange: (disciplineId: string) => void
  disciplines: Discipline[]
  subscriptions: CalendarSubscription[]
  isLoading?: boolean
  filterMyPackagesOnly?: boolean
  onToggleFilterMyPackagesOnly?: () => void
  hasActiveGroupSubs?: boolean
  activeSpecialtyNames?: string[]
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentWeek,
  onWeekChange,
  onGoToCurrentWeek,
  onSelectWeek,
  selectedDisciplineId,
  onDisciplineChange,
  disciplines,
  subscriptions,
  isLoading,
  filterMyPackagesOnly = true,
  onToggleFilterMyPackagesOnly,
  hasActiveGroupSubs = false,
  activeSpecialtyNames = [],
}) => {
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [isQuotaDropdownOpen, setIsQuotaDropdownOpen] = useState(false)
  const quotaDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        quotaDropdownRef.current &&
        !quotaDropdownRef.current.contains(event.target as Node)
      ) {
        setIsQuotaDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="bg-white border-b border-slate-200 top-0 z-40 shadow-xs rounded-t-md relative">
      {/* Top Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Navigation Controls: Today, Prev, Next, Range, Select Date Modal */}
          <div className="flex relative items-center gap-2 sm:gap-3 flex-wrap">
            <button
              type="button"
              onClick={onGoToCurrentWeek}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shadow-xs cursor-pointer"
            >
              <CalendarIcon className="h-3.5 w-3.5 text-[#17664e]" />
              Tuần này
            </button>

            <div className="flex items-center bg-white p-0.5 rounded-md border border-slate-300 shadow-xs">
              <button
                type="button"
                onClick={() => onWeekChange('prev')}
                className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Tuần trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 text-xs font-semibold text-slate-800 min-w-[130px] text-center select-none font-mono">
                {formatRangeLabel(currentWeek)}
              </span>
              <button
                type="button"
                onClick={() => onWeekChange('next')}
                className="p-1.5 rounded-sm hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
                title="Tuần sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Chọn lịch modal button */}
            <button
              type="button"
              onClick={() => setIsDatePickerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md border border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-800 hover:bg-emerald-100 active:bg-emerald-200 transition shadow-xs cursor-pointer"
              title="Chọn ngày / tuần để xem lịch tập"
            >
              <CalendarDays className="h-3.5 w-3.5 text-[#17664e]" />
              <span>Chọn lịch</span>
            </button>
          </div>
        </div>

        {/* Modal Chọn Lịch */}
        <MemberDatePickerModal
          isOpen={isDatePickerOpen}
          onClose={() => setIsDatePickerOpen(false)}
          currentWeek={currentWeek}
          onSelectWeek={(weekMonday) => {
            onSelectWeek?.(weekMonday)
          }}
        />

        {/* Filter bar & Subscriptions Summary */}
        <div className="mt-3 pt-3 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Left: Dropdown Bộ môn */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Bộ môn:
              </span>
              <div className="relative">
                <select
                  value={selectedDisciplineId}
                  onChange={(e) => onDisciplineChange(e.target.value)}
                  className="h-9 pl-3 pr-8 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-800 cursor-pointer appearance-none hover:bg-slate-50 hover:border-slate-400 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-400 uppercase shadow-xs"
                >
                  <option value="all">TẤT CẢ BỘ MÔN</option>
                  {disciplines.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name.toUpperCase()}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {hasActiveGroupSubs && onToggleFilterMyPackagesOnly && (
              <button
                type="button"
                onClick={onToggleFilterMyPackagesOnly}
                className={cn(
                  'h-9 px-3 rounded-md text-xs font-bold transition-all shadow-xs cursor-pointer border inline-flex items-center gap-2',
                  filterMyPackagesOnly
                    ? 'bg-[#17664e]/10 border-[#17664e] text-[#17664e]'
                    : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50',
                )}
                title="Bật/tắt chế độ chỉ hiển thị các lớp học thuộc đúng chuyên đề và hạng sao gói tập của bạn"
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    filterMyPackagesOnly ? 'bg-[#17664e]' : 'bg-slate-400',
                  )}
                />
                <span>
                  {filterMyPackagesOnly ? 'Lọc theo gói của tôi' : 'Xem toàn bộ lịch'}
                </span>
                {filterMyPackagesOnly && activeSpecialtyNames && activeSpecialtyNames.length > 0 && (
                  <span className="text-[10px] font-semibold bg-white px-1.5 py-0.5 rounded text-emerald-800 border border-emerald-200 shadow-2xs max-w-[150px] truncate">
                    {activeSpecialtyNames.join(', ')}
                  </span>
                )}
              </button>
            )}

            {isLoading && (
              <span className="text-xs text-slate-400 font-medium animate-pulse flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                Đang đồng bộ lịch...
              </span>
            )}
          </div>

          {/* Right: Dropdown Gói & Quota */}
          <div className="relative z-50" ref={quotaDropdownRef}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
               
                <span>Gói & Quota:</span>
              </span>

              <button
                type="button"
                onClick={() => setIsQuotaDropdownOpen((prev) => !prev)}
                className="h-9 px-3 rounded-md border border-slate-300 bg-white text-xs font-semibold text-slate-800 flex items-center gap-2 hover:bg-slate-50 hover:border-slate-400 transition-colors cursor-pointer shadow-xs"
                title="Bấm để xem chi tiết danh sách gói tập & quota"
              >
                {subscriptions && subscriptions.length > 0 ? (
                  <span className="inline-flex items-center gap-2 text-slate-800">
                    <span className="font-bold">{subscriptions.length} gói khả dụng</span>
                    <span className="text-slate-300 font-normal">|</span>
                    <span className="font-semibold text-slate-600">
                      Nhóm: <strong className="font-black text-slate-900">{subscriptions.reduce((sum, s) => sum + (s.remainingGroupSessions || 0), 0)}</strong>
                    </span>
                    <span className="font-semibold text-slate-600">
                      PT: <strong className="font-black text-slate-900">{subscriptions.reduce((sum, s) => sum + (s.remainingPtSessions || 0), 0)}</strong>
                    </span>
                  </span>
                ) : (
                  <span className="text-slate-400 italic font-medium">Chưa có gói khả dụng</span>
                )}
                <ChevronDown
                  className={cn(
                    'w-3.5 h-3.5 text-slate-500 transition-transform duration-200',
                    isQuotaDropdownOpen && 'rotate-180',
                  )}
                />
              </button>
            </div>

            {/* Quota Popover Dropdown Card (z-[100] to never be clipped by calendar) */}
            {isQuotaDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-slate-300 shadow-2xl z-[100] p-4 space-y-3 rounded-md">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Danh mục Gói & Quota hiện có
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {subscriptions?.length || 0} gói hoạt động
                  </span>
                </div>

                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5">
                  {subscriptions && subscriptions.length > 0 ? (
                    subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-3 bg-slate-50/80 border border-slate-200 text-xs space-y-2 rounded-md"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {sub.planName}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium font-mono">
                            HSD: {new Date(sub.endDate).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 pt-0.5 text-xs text-slate-700">
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-medium">
                            Lớp nhóm: <strong className="font-bold text-slate-900">{sub.remainingGroupSessions}</strong> buổi
                          </span>
                          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-medium">
                            Kèm riêng PT: <strong className="font-bold text-slate-900">{sub.remainingPtSessions}</strong> buổi
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 py-4 text-center italic font-medium">
                      Bạn chưa có gói tập hợp lệ nào.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
