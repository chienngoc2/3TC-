import React, { useMemo, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Loader2,
  Search,
  X,
  CalendarCheck2,
  UserCheck,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { coachPortalApi } from '../api/coach-portal-api';
import { CreateSlotModal } from '../components/create-slot-modal';
import { TablePagination } from '@/components/common/table-pagination';

const ITEMS_PER_PAGE = 10;

export const CoachAvailabilityPage: React.FC = () => {
  const location = useLocation();
  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [filter, setFilter] = useState<'ALL' | 'UNBOOKED' | 'BOOKED'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const {
    data: slots = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['coach', 'availability'],
    queryFn: () => coachPortalApi.getMyAvailability(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => coachPortalApi.deleteSlot(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach', 'availability'] });
      queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
    },
  });

  // Calculate statistics
  const unbookedCount = useMemo(
    () => slots.filter((s) => !s.isBooked && !s.isEmergencyCancelled).length,
    [slots]
  );
  const bookedCount = useMemo(() => slots.filter((s) => s.isBooked).length, [slots]);

  // Reset to page 1 on filter or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm]);

  // Format date helper
  const formatDateVi = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('vi-VN', {
        weekday: 'long',
      });
    } catch {
      return '';
    }
  };

  const formatDateFull = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const calculateDuration = (startTime: string, endTime: string) => {
    try {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      const diffMinutes = Math.round((end - start) / (1000 * 60));
      if (isNaN(diffMinutes) || diffMinutes <= 0) return '60 phút';
      const hours = Math.floor(diffMinutes / 60);
      const mins = diffMinutes % 60;
      if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
      if (hours > 0) return `${hours} giờ`;
      return `${mins} phút`;
    } catch {
      return '60 phút';
    }
  };

  // Filter and sort slots
  const filteredAndSortedSlots = useMemo(() => {
    return slots
      .filter((slot) => {
        // Tab filter
        if (filter === 'UNBOOKED' && (slot.isBooked || slot.isEmergencyCancelled)) return false;
        if (filter === 'BOOKED' && !slot.isBooked) return false;

        // Search filter
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const dayName = formatDateVi(slot.startTime).toLowerCase();
          const dateStr = formatDateFull(slot.startTime).toLowerCase();
          const timeStr = `${formatTime(slot.startTime)} ${formatTime(slot.endTime)}`.toLowerCase();
          return dayName.includes(q) || dateStr.includes(q) || timeStr.includes(q);
        }

        return true;
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [slots, filter, searchTerm]);

  // Paginated slots
  const paginatedSlots = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAndSortedSlots.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAndSortedSlots, currentPage]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to={`${coachBasePath}/schedule`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17664e] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Lịch HLV
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
            Khung Giờ Rảnh PT
          </h1>
          <p className="text-xs text-white mt-0.5">
            Mở ca trực và quản lý các khung giờ sẵn sàng đón học viên đăng ký tập kèm 1-1
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading || isRefetching}
            className="text-xs font-bold gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>
          <Button
            type="button"
            variant="mint"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs font-bold gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Mở khung giờ rảnh</span>
          </Button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#17664e] border border-emerald-200/70">
            Huấn luyện viên
          </span>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Tổng số ca mở
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
            {slots.length} <span className="text-xs font-semibold text-slate-400">ca</span>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-1">Toàn bộ ca trực rảnh đã tạo</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Ca đang mở
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CalendarCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
            {unbookedCount} <span className="text-xs font-semibold text-slate-400">ca</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">Sẵn sàng nhận học viên đặt lịch</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Đã có người đặt
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
            {bookedCount} <span className="text-xs font-semibold text-slate-400">ca</span>
          </div>
          <p className="text-[11px] text-blue-700 font-medium mt-1">Đã có học viên đăng ký tập kèm</p>
        </div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white border border-slate-200 shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`rounded-xl px-4 py-1.5 text-xs font-black transition-all cursor-pointer ${
              filter === 'ALL'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tất cả ({slots.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('UNBOOKED')}
            className={`rounded-xl px-4 py-1.5 text-xs font-black transition-all cursor-pointer ${
              filter === 'UNBOOKED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Còn trống ({unbookedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('BOOKED')}
            className={`rounded-xl px-4 py-1.5 text-xs font-black transition-all cursor-pointer ${
              filter === 'BOOKED'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Đã được đặt ({bookedCount})
          </button>
        </div>

        {/* Search by date or time */}
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo ngày (vd: Thứ sáu, 06/11)..."
            className="w-full rounded-2xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-hidden transition-all shadow-2xs"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Table of Availability Slots */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 rounded-3xl border border-slate-200 bg-white p-8">
          <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Đang tải danh sách khung giờ rảnh...</p>
        </div>
      ) : filteredAndSortedSlots.length === 0 ? (
        <div className="py-16 text-center space-y-3 rounded-3xl border border-dashed border-slate-200 bg-white p-8">
          <Clock className="h-12 w-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-black text-slate-800">Không có khung giờ rảnh nào</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm
              ? 'Không tìm thấy khung giờ nào khớp với từ khóa tìm kiếm của bạn.'
              : 'Bạn chưa mở khung giờ rảnh nào. Hãy bấm nút "Mở khung giờ rảnh" phía trên để tạo ca mới.'}
          </p>
          {searchTerm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchTerm('')}
              className="text-xs font-bold"
            >
              Xóa bộ lọc tìm kiếm
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500 tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 text-center w-12">#</th>
                  <th className="py-3.5 px-4">Ngày tập</th>
                  <th className="py-3.5 px-4">Khung giờ</th>
                  <th className="py-3.5 px-4">Thời lượng</th>
                  <th className="py-3.5 px-4">Trạng thái</th>
                  <th className="py-3.5 px-4">Mô tả</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedSlots.map((slot, index) => {
                  const globalIndex = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
                  const durationText = calculateDuration(slot.startTime, slot.endTime);
                  const isPast = new Date(slot.startTime).getTime() <= Date.now();
                  const canDelete = !slot.isBooked && !slot.isEmergencyCancelled && !isPast;

                  return (
                    <tr
                      key={slot.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        slot.isBooked
                          ? 'bg-blue-50/20'
                          : slot.isEmergencyCancelled
                          ? 'bg-rose-50/20'
                          : isPast
                          ? 'opacity-65 bg-slate-50/30'
                          : ''
                      }`}
                    >
                      {/* 1. Index */}
                      <td className="py-3.5 px-4 text-center text-slate-400 font-mono text-[11px] font-bold">
                        {String(globalIndex).padStart(2, '0')}
                      </td>

                      {/* 2. Date */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 capitalize leading-snug">
                          {formatDateVi(slot.startTime)}
                        </div>
                        <div className="text-[11px] text-slate-400 font-semibold mt-0.5 font-mono">
                          {formatDateFull(slot.startTime)}
                        </div>
                      </td>

                      {/* 3. Time slot */}
                      <td className="py-3.5 px-4">
                        <span className="font-black text-slate-900 font-mono text-sm tracking-tight">
                          {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                        </span>
                      </td>

                      {/* 4. Duration */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs border border-slate-200/80">
                          {durationText}
                        </span>
                      </td>

                      {/* 5. Status Badge */}
                      <td className="py-3.5 px-4">
                        {slot.isBooked ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 text-xs font-black shadow-2xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                            <span>Đã có người đặt</span>
                          </span>
                        ) : slot.isEmergencyCancelled ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1 text-xs font-black shadow-2xs">
                            <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                            <span>Đã hủy</span>
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1 text-xs font-bold">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>Đã qua giờ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1 text-xs font-black shadow-2xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Còn trống</span>
                          </span>
                        )}
                      </td>

                      {/* 6. Description / Slot Type */}
                      <td className="py-3.5 px-4">
                        {slot.isBooked ? (
                          <span className="text-xs font-bold text-blue-700">
                            Buổi kèm 1-1 với hội viên
                          </span>
                        ) : slot.isEmergencyCancelled ? (
                          <span className="text-xs font-bold text-rose-600">
                            Ca đột xuất đã hủy
                          </span>
                        ) : isPast ? (
                          <span className="text-xs font-medium text-slate-400">
                            Đã qua thời gian nhận học viên
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-600">
                            Khung giờ sẵn sàng đón học viên
                          </span>
                        )}
                      </td>

                      {/* 7. Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        {canDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('Bạn có chắc chắn muốn xóa khung giờ rảnh này không?')) {
                                deleteMutation.mutate(slot.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 h-8 text-xs font-black gap-1.5 px-3 rounded-xl border border-transparent hover:border-rose-200 transition-all cursor-pointer ml-auto"
                          >
                            {deleteMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            <span>Xóa ca</span>
                          </Button>
                        ) : (
                          <span className="text-slate-300 text-xs text-right block pr-4">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredAndSortedSlots.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemName="ca rảnh"
          />
        </div>
      )}

      {/* Modal Mở Khung Giờ Rảnh */}
      <CreateSlotModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
};

export default CoachAvailabilityPage;
