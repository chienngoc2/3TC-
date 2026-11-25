import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { CalendarBooking, CalendarSchedule, CalendarPtSlot } from '../types/calendar.types'
import type { CalendarEventItem } from './calendar-grid'
import {
  X,
  Clock,
  User,
  Users,
  CheckCircle2,
  Calendar as CalendarIcon,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ClusterSessionItem {
  id: string
  keyId: string
  kind: 'SCHEDULE' | 'PT_SLOT' | 'BOOKING_STANDALONE'
  startAt: string
  endAt: string
  timeRangeStr: string
  primaryTitle: string
  compactTitle: string
  coachName: string
  roomName: string
  badgeText: string
  specialtyBadge: string | null
  isBooked: boolean
  isFull: boolean
  isPast: boolean
  data: CalendarSchedule | CalendarPtSlot | CalendarBooking
  booking?: CalendarBooking
}

interface ClusterSessionsModalProps {
  isOpen: boolean
  onClose: () => void
  items: ClusterSessionItem[]
  dateString: string
  onSelectSession: (event: CalendarEventItem) => void
}

export const ClusterSessionsModal: React.FC<ClusterSessionsModalProps> = ({
  isOpen,
  onClose,
  items,
  dateString,
  onSelectSession,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !items || items.length === 0) return null

  // Format date display
  const dateObj = new Date(dateString || items[0]?.startAt || Date.now())
  const formattedDate = dateObj.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const timeRange = items[0]?.timeRangeStr || ''

  return typeof document !== 'undefined'
    ? createPortal(
        <div className="fixed inset-0 z-[9990] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div
            className="w-full max-w-3xl max-h-[88vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cluster-modal-title"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#17664e]/10 text-[#17664e] flex items-center justify-center shrink-0">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 id="cluster-modal-title" className="text-base font-bold text-slate-900">
                      Khung giờ {timeRange}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-[#17664e] text-white">
                      {items.length} ca tập song song
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 capitalize flex items-center gap-1.5 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formattedDate}</span>
                    <span>•</span>
                    <span>Chọn 1 ca học để xem chi tiết & đăng ký</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                aria-label="Đóng danh sách"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Hint Notice */}
            <div className="px-5 py-2.5 bg-emerald-50/60 border-b border-emerald-100/80 text-xs text-emerald-900 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                Khung giờ này có {items.length} lớp học diễn ra đồng thời ở các phòng khác nhau.
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                (Mỗi học viên được đặt tối đa 1 ca cùng giờ)
              </span>
            </div>

            {/* Body: Grid of all sessions */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {items.map((item, idx) => {
                  const scheduleData = item.kind === 'SCHEDULE' ? (item.data as CalendarSchedule) : null
                  const ptData = item.kind === 'PT_SLOT' ? (item.data as CalendarPtSlot) : null
                  const isGroupPtSlot = Boolean(
                    ptData &&
                      ((ptData as any).packageCategory === 'GROUP' ||
                        (ptData as any).type === 'GROUP_CLASS' ||
                        item.badgeText === 'Gói nhóm' ||
                        String((ptData as any).disciplineName || '').toLowerCase().includes('yoga') ||
                        String((ptData as any).disciplineName || '').toLowerCase().includes('box')),
                  )
                  const isPt = item.kind === 'PT_SLOT' && !isGroupPtSlot
                  const bookingData = item.booking || (item.kind === 'BOOKING_STANDALONE' ? (item.data as CalendarBooking) : null)
                  const coachStars =
                    scheduleData?.coach?.coachProfile?.ratingStars ||
                    scheduleData?.coach?.ratingStars ||
                    ptData?.coach?.coachProfile?.ratingStars ||
                    ptData?.coach?.ratingStars ||
                    (bookingData as any)?.coach?.coachProfile?.ratingStars ||
                    (bookingData as any)?.coach?.ratingStars ||
                    (bookingData as any)?.coachAvailability?.coach?.coachProfile?.ratingStars ||
                    (bookingData as any)?.coachAvailability?.coach?.ratingStars ||
                    (bookingData as any)?.coachRatingStars ||
                    2

                  const handleClick = () => {
                    if (item.kind === 'SCHEDULE') {
                      onSelectSession({
                        type: 'SCHEDULE',
                        data: item.data as CalendarSchedule,
                        booking: item.booking,
                      })
                    } else if (item.kind === 'PT_SLOT') {
                      onSelectSession({
                        type: 'PT_SLOT',
                        data: item.data as CalendarPtSlot,
                        booking: item.booking,
                      })
                    } else {
                      onSelectSession({
                        type: 'BOOKING_STANDALONE',
                        data: item.data as CalendarBooking,
                      })
                    }
                  }

                  return (
                    <div
                      key={item.keyId || `${item.id}-${idx}`}
                      onClick={handleClick}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleClick()
                        }
                      }}
                      className={cn(
                        'group rounded-xl border p-4 bg-white transition-all duration-150 cursor-pointer flex flex-col justify-between hover:shadow-md hover:border-[#17664e] focus:outline-none focus:ring-2 focus:ring-[#17664e]/30 relative',
                        item.isBooked
                          ? 'border-emerald-300 bg-emerald-50/30'
                          : item.isFull
                          ? 'border-slate-200 bg-slate-50/50 opacity-80'
                          : 'border-slate-200 hover:bg-slate-50/30',
                      )}
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 font-mono">
                            {item.timeRangeStr}
                          </span>
                          {item.specialtyBadge && (
                            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-200 truncate max-w-[170px]">
                              {item.specialtyBadge}
                            </span>
                          )}
                        </div>

                        {item.isBooked ? (
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ĐÃ ĐẶT
                          </span>
                        ) : item.isPast ? (
                          <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200 shrink-0">
                            Đã qua
                          </span>
                        ) : item.isFull ? (
                          <span className="text-[10.5px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 shrink-0">
                            Hết chỗ
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-bold text-[#17664e] bg-[#17664e]/10 px-2 py-0.5 rounded-full border border-[#17664e]/20 shrink-0">
                            Còn chỗ
                          </span>
                        )}
                      </div>

                      {/* Title & Details */}
                      <div className="space-y-2 mb-3">
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-[#17664e] transition-colors leading-snug">
                          {item.primaryTitle}
                        </h3>

                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                          {/* Coach */}
                          <div className="flex items-start gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#17664e] shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <span className="font-semibold text-slate-800 block truncate">
                                {item.coachName.replace(/^HLV:\s*/i, '')}
                              </span>
                              <span className="text-[10.5px] text-amber-500 font-bold block">
                                {'★'.repeat(coachStars)}
                              </span>
                            </div>
                          </div>

                          {/* Room & Capacity */}
                          <div className="space-y-1">
                            {item.roomName && (
                              <div className="flex items-center gap-1.5 text-slate-600">
                              
                                
                              </div>
                            )}
                            {scheduleData && (
                              <div className="flex items-center gap-1.5 text-slate-600">
                                <Users className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                                <span>
                                  Sĩ số: <strong>{scheduleData.currentEnrolled}</strong>/{scheduleData.capacity}
                                </span>
                              </div>
                            )}
                            {isPt && (
                              <div className="flex items-center gap-1.5 text-sky-700 font-semibold">
                                <User className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                <span>PT 1-1</span>
                              </div>
                            )}
                            {isGroupPtSlot && (
                              <div className="flex items-center gap-1.5 text-[#17664e] font-semibold">
                                <Users className="w-3.5 h-3.5 text-[#17664e] shrink-0" />
                                <span>Gói nhóm</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400 group-hover:text-slate-600 transition-colors">
               
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#17664e] group-hover:translate-x-0.5 transition-transform">
                          <span>{item.isBooked ? 'Xem chi tiết' : 'Chi tiết & Đặt ca'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Hiển thị đầy đủ {items.length} ca học trong khung giờ
              </span>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer shadow-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )
    : null
}
