import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  CircleHelp,
  UserRound,
  Users,
  XCircle,
  RotateCcw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Activity,
  Dumbbell,
} from "lucide-react";
import { useSession } from "@/auth/session-context";
import { StateMessage } from "@/components/feedback/state-message";
import { Badge } from "@/components/ui/badge";
import { get } from "@/lib/api";
import { vietnamDateTime } from "@/lib/date";
import { memberKeys } from "@/lib/keys";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

const bookingStatusStyles: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  CONFIRMED: {
    label: "Đã xác nhận",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  ATTENDED: {
    label: "Đã tham gia",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "Chờ xác nhận",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
  ABSENT: {
    label: "Vắng mặt",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: XCircle,
  },
  EXPIRED: {
    label: "Đã hết hạn",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: RotateCcw,
  },
};

export const HistoryPage: React.FC = () => {
  const { user } = useSession();

  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc">("date-desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  const bookings = useQuery({
    queryKey: memberKeys.history(user!.id),
    queryFn: () => get<Booking[]>("/bookings"),
  });

  // Calculate summary metrics
  const stats = useMemo(() => {
    const list = bookings.data || [];
    let attendedOrConfirmed = 0;
    let cancelledOrAbsent = 0;

    for (const item of list) {
      if (item.status === "ATTENDED" || item.status === "CONFIRMED") {
        attendedOrConfirmed++;
      } else if (item.status === "CANCELLED" || item.status === "ABSENT") {
        cancelledOrAbsent++;
      }
    }

    return {
      total: list.length,
      attendedOrConfirmed,
      cancelledOrAbsent,
    };
  }, [bookings.data]);

  // Filter & sort bookings
  const filteredBookings = useMemo(() => {
    let list = bookings.data || [];

    // Filter by type
    if (typeFilter !== "ALL") {
      list = list.filter((b) => b.bookingType === typeFilter);
    }

    // Filter by status
    if (statusFilter !== "ALL") {
      list = list.filter((b) => b.status === statusFilter);
    }

    // Sort by session start time or bookedAt
    return [...list].sort((a, b) => {
      const timeA = new Date(
        a.schedule?.startTime || a.coachAvailability?.startTime || a.bookedAt
      ).getTime();
      const timeB = new Date(
        b.schedule?.startTime || b.coachAvailability?.startTime || b.bookedAt
      ).getTime();

      if (sortBy === "date-desc") return timeB - timeA;
      return timeA - timeB;
    });
  }, [bookings.data, typeFilter, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedBookings = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, validCurrentPage, pageSize]);

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 pb-20">
      {/* Div trắng bao quanh tất cả component ở trang lịch sử */}
      <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-7 space-y-6 shadow-xs">
        {/* Header (không có nút quay lại) */}
        <div className="pb-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Lịch sử đặt lịch &amp; Hoạt động tập luyện
            </h1>
            
          </div>
          <div className="h-10 w-10 rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center shrink-0 border border-emerald-100">
            <CalendarDays className="w-5 h-5" />
          </div>
        </div>

        {/* 3 Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tổng số buổi đã đặt
              </span>
              <p className="text-xl font-black text-slate-900 font-mono mt-1">
                {stats.total} <span className="text-xs font-normal text-slate-500">buổi tập</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-md bg-white text-[#17664e] flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
              <Activity className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Đã tham gia / Xác nhận
              </span>
              <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                {stats.attendedOrConfirmed} <span className="text-xs font-normal text-slate-500">buổi</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-md bg-white text-emerald-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Đã hủy / Vắng mặt
              </span>
              <p className="text-xl font-black text-rose-700 font-mono mt-1">
                {stats.cancelledOrAbsent} <span className="text-xs font-normal text-slate-500">buổi</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-md bg-white text-rose-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Structured Table Section with Filter & Sorting Controls */}
        <div className="rounded-md border border-slate-200 overflow-hidden">
          {/* Controls: Type Tabs, Status & Sorting */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Booking Type Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              {[
                { id: "ALL", label: "Tất cả buổi tập" },
                { id: "GROUP_CLASS", label: "Lớp nhóm" },
                { id: "PERSONAL_TRAINING", label: "Kèm riêng 1:1 PT" },
              ].map((tab) => {
                const active = typeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setTypeFilter(tab.id);
                      setCurrentPage(1);
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-bold transition-all shrink-0 cursor-pointer border",
                      active
                        ? "bg-[#17664e] text-white border-[#17664e] shadow-xs"
                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Filter by Status & Sort */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Lọc theo trạng thái"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 px-3 rounded-md text-xs font-bold bg-white border border-slate-300 text-slate-700 cursor-pointer focus:outline-none focus:border-[#17664e] shadow-xs"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="CONFIRMED">Đã xác nhận</option>
                <option value="ATTENDED">Đã tham gia</option>
                <option value="PENDING">Chờ xác nhận</option>
                <option value="CANCELLED">Đã hủy</option>
                <option value="ABSENT">Vắng mặt</option>
                <option value="EXPIRED">Đã hết hạn</option>
              </select>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 hidden sm:flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </span>
                <select
                  aria-label="Sắp xếp thời gian"
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as any);
                    setCurrentPage(1);
                  }}
                  className="h-9 px-3 rounded-md text-xs font-bold bg-white border border-slate-300 text-slate-700 cursor-pointer focus:outline-none focus:border-[#17664e] shadow-xs"
                >
                  <option value="date-desc">Thời gian: Mới nhất</option>
                  <option value="date-asc">Thời gian: Cũ nhất</option>
                </select>
              </div>
            </div>
          </div>

          {/* State Messages */}
          <StateMessage
            loading={bookings.isPending}
            error={bookings.error}
            onRetry={() => void bookings.refetch()}
            empty={filteredBookings.length === 0}
            emptyText="Chưa có lịch sử tập luyện nào phù hợp với bộ lọc hiện tại."
          />

          {/* Structured Bookings Table */}
          {!bookings.isPending && filteredBookings.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 text-center w-12">STT</th>
                    <th className="py-3.5 px-4">Buổi tập &amp; Lớp học</th>
                    <th className="py-3.5 px-4">Loại hình</th>
                    <th className="py-3.5 px-4">Thời gian tập</th>
                    <th className="py-3.5 px-4">HLV / Phòng tập</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedBookings.map((item, index) => {
                    const isGroupClass = item.bookingType === "GROUP_CLASS";
                    const status = bookingStatusStyles[item.status] ?? {
                      label: item.status,
                      className: "border-slate-200 bg-slate-50 text-slate-700",
                      icon: CircleHelp,
                    };
                    const StatusIcon = status.icon;

                    const startTime =
                      item.schedule?.startTime || item.coachAvailability?.startTime
                        ? (item.schedule?.startTime ?? item.coachAvailability!.startTime)
                        : item.bookedAt;

                    const displayIdx = (validCurrentPage - 1) * pageSize + index + 1;
                    const coachName =
                      item.coachAvailability?.coach?.fullName ||
                      (item.schedule as any)?.coach?.fullName ||
                      null;
                    const roomName = (item.schedule as any)?.room?.name || null;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* 1. STT */}
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-xs">
                          {String(displayIdx).padStart(2, "0")}
                        </td>

                        {/* 2. Buổi tập & Lớp học */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                              {isGroupClass ? (
                                <Users className="w-4 h-4 text-[#17664e]" />
                              ) : (
                                <Dumbbell className="w-4 h-4 text-amber-600" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-snug">
                                {isGroupClass
                                  ? item.schedule?.class?.name ?? "Lớp tập nhóm"
                                  : "Buổi tập kèm riêng (PT 1:1)"}
                              </p>
                            
                            </div>
                          </div>
                        </td>

                        {/* 3. Loại hình */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border",
                              isGroupClass
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-purple-50 text-purple-800 border-purple-200"
                            )}
                          >
                            {isGroupClass ? (
                              <>
                                <Users className="w-3 h-3" />
                                <span>Lớp Nhóm</span>
                              </>
                            ) : (
                              <>
                                <UserRound className="w-3 h-3" />
                                <span>Kèm 1:1 PT</span>
                              </>
                            )}
                          </span>
                        </td>

                        {/* 4. Thời gian */}
                        <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <time dateTime={startTime}>
                              {vietnamDateTime(startTime).replace(" ", " · ")}
                            </time>
                          </span>
                        </td>

                        {/* 5. HLV / Phòng tập */}
                        <td className="py-4 px-4 text-slate-700 whitespace-nowrap">
                          {coachName ? (
                            <span className="font-semibold text-slate-800 block">
                              HLV: {coachName}
                            </span>
                          ) : (
                            <span className="text-slate-500 block">HLV theo ca</span>
                          )}
                          {roomName && (
                            <span className="text-[11px] text-slate-500 block">
                              Phòng: {roomName}
                            </span>
                          )}
                        </td>

                        {/* 6. Trạng thái */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold border",
                              status.className
                            )}
                          >
                            <StatusIcon className="w-3 h-3 shrink-0" />
                            <span>{status.label}</span>
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!bookings.isPending && filteredBookings.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Hiển thị{" "}
                <strong className="text-slate-900 font-mono">
                  {(validCurrentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(validCurrentPage * pageSize, filteredBookings.length)}
                </strong>{" "}
                trên tổng số{" "}
                <strong className="text-slate-900 font-mono">{filteredBookings.length}</strong> buổi tập
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={validCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1 font-semibold cursor-pointer shadow-2xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Trước</span>
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      const isActive = pageNum === validCurrentPage;
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={cn(
                            "h-8 min-w-[32px] px-2 rounded-md text-xs font-bold font-mono transition-all cursor-pointer border",
                            isActive
                              ? "bg-[#17664e] text-white border-[#17664e] shadow-xs"
                              : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={validCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1 font-semibold cursor-pointer shadow-2xs"
                  >
                    <span>Sau</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
