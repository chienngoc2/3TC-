import React, { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  CheckCircle2,
  Clock,
  CircleHelp,
  XCircle,
  RotateCcw,
  CalendarDays,
  ArrowUpRight,
  ArrowUpDown,
  DollarSign,
  History,
} from "lucide-react";
import { useSession } from "@/auth/session-context";
import { StateMessage } from "@/components/feedback/state-message";
import { Badge } from "@/components/ui/badge";
import { get, money, query } from "@/lib/api";
import { vietnamDate } from "@/lib/date";
import { memberKeys } from "@/lib/keys";
import type { Checkout } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  FULFILLED: {
    label: "Đã hoàn tất",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  PENDING_PAYMENT: {
    label: "Chờ thanh toán",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock,
  },
  PAYMENT_REVIEW: {
    label: "Đang kiểm tra",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: RotateCcw,
  },
  PAYMENT_FAILED: {
    label: "Thất bại",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
  EXPIRED: {
    label: "Đã hết hạn",
    className: "border-slate-200 bg-slate-100 text-slate-600",
    icon: Clock,
  },
  REFUND_PENDING: {
    label: "Đang hoàn tiền",
    className: "border-purple-200 bg-purple-50 text-purple-800",
    icon: RotateCcw,
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    className: "border-purple-200 bg-purple-50 text-purple-800",
    icon: CheckCircle2,
  },
};

const kindLabels: Record<string, string> = {
  NEW_SUBSCRIPTION: "Đăng ký gói mới",
  RENEWAL: "Gia hạn gói tập",
};

export const TransactionsPage: React.FC = () => {
  const { user } = useSession();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  const transactions = useQuery({
    queryKey: [...memberKeys.transactions(user!.id), "all-recent"],
    queryFn: () =>
      get<{ items: Checkout[]; nextCursor: string | null }>(
        `/billing/checkouts${query({
          limit: 100,
        })}`
      ),
  });

  // Calculate summary metrics
  const stats = useMemo(() => {
    const list = transactions.data?.items || [];
    let totalFulfilled = 0;
    let fulfilledCount = 0;
    let pendingCount = 0;

    for (const item of list) {
      if (item.status === "FULFILLED") {
        totalFulfilled += Number(item.amount || 0);
        fulfilledCount++;
      } else if (item.status === "PENDING_PAYMENT" || item.status === "PAYMENT_REVIEW") {
        pendingCount++;
      }
    }

    return {
      totalFulfilled,
      fulfilledCount,
      pendingCount,
      totalCount: list.length,
    };
  }, [transactions.data?.items]);

  // Filter & sort transactions
  const filteredItems = useMemo(() => {
    let list = transactions.data?.items || [];

    // Filter by status
    if (statusFilter !== "ALL") {
      list = list.filter((item) => item.status === statusFilter);
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sortBy === "date-desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "date-asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "amount-desc") {
        return Number(b.amount || 0) - Number(a.amount || 0);
      }
      if (sortBy === "amount-asc") {
        return Number(a.amount || 0) - Number(b.amount || 0);
      }
      return 0;
    });
  }, [transactions.data?.items, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, validCurrentPage, pageSize]);

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 pb-20">
      {/* Div trắng bao quanh tất cả component ở trang giao dịch */}
      <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-7 space-y-6 shadow-xs">
        {/* Header (không có nút quay lại) */}
        <div className="pb-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Lịch sử giao dịch &amp; Đơn hàng
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Theo dõi chi tiết các giao dịch mua gói tập và dịch vụ thể thao tại 3TC Center
            </p>
          </div>
          <div className="h-10 w-10 rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center shrink-0 border border-emerald-100">
            <History className="w-5 h-5" />
          </div>
        </div>

        {/* 3 Summary Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Tổng giá trị hoàn tất
              </span>
              <p className="text-xl font-black text-slate-900 font-mono mt-1">
                {money(stats.totalFulfilled)}
              </p>
            </div>
            <div className="h-10 w-10 rounded-md bg-white text-[#17664e] flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Đơn hàng thành công
              </span>
              <p className="text-xl font-black text-emerald-700 font-mono mt-1">
                {stats.fulfilledCount} <span className="text-xs font-normal text-slate-500">đơn</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-md bg-white text-emerald-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-md border border-slate-200 p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Chờ xử lý / Đang thanh toán
              </span>
              <p className="text-xl font-black text-amber-700 font-mono mt-1">
                {stats.pendingCount} <span className="text-xs font-normal text-slate-500">đơn</span>
              </p>
            </div>
            <div className="h-10 w-10 rounded-md bg-white text-amber-600 flex items-center justify-center shrink-0 border border-slate-200 shadow-2xs">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Structured Table Section with Filter & Sorting Controls */}
        <div className="rounded-md border border-slate-200 overflow-hidden">
          {/* Controls: Filter & Sorting */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "FULFILLED", label: "Đã hoàn tất" },
                { id: "PENDING_PAYMENT", label: "Chờ thanh toán" },
                { id: "PAYMENT_REVIEW", label: "Đang kiểm tra" },
                { id: "PAYMENT_FAILED", label: "Thất bại / Hết hạn" },
              ].map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.id);
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

            {/* Sort Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sắp xếp:</span>
              </span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="h-9 px-3 rounded-md text-xs font-bold bg-white border border-slate-300 text-slate-700 cursor-pointer focus:outline-none focus:border-[#17664e] shadow-xs"
              >
                <option value="date-desc">Thời gian: Mới nhất</option>
                <option value="date-asc">Thời gian: Cũ nhất</option>
                <option value="amount-desc">Số tiền: Cao đến thấp</option>
                <option value="amount-asc">Số tiền: Thấp đến cao</option>
              </select>
            </div>
          </div>

          {/* State Messages */}
          <StateMessage
            loading={transactions.isPending}
            error={transactions.error}
            onRetry={() => void transactions.refetch()}
            empty={filteredItems.length === 0}
            emptyText="Không tìm thấy giao dịch nào phù hợp với bộ lọc hiện tại."
          />

          {/* Structured Transactions Table */}
          {!transactions.isPending && filteredItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 text-center w-12">STT</th>
                    <th className="py-3.5 px-4">Gói tập &amp; Dịch vụ</th>
                    <th className="py-3.5 px-4">Loại giao dịch</th>
                    <th className="py-3.5 px-4">Thời gian tạo</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right">Số tiền</th>
                    <th className="py-3.5 px-4 text-center w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedItems.map((item, index) => {
                    const status = statusStyles[item.status] ?? {
                      label: item.status,
                      className: "border-slate-200 bg-slate-50 text-slate-700",
                      icon: CircleHelp,
                    };
                    const StatusIcon = status.icon;
                    const planName = String(
                      (item.priceSnapshot as any)?.planName ?? kindLabels[item.kind] ?? item.kind
                    );
                    const durationDays = (item.priceSnapshot as any)?.durationDays;
                    const displayIdx = (validCurrentPage - 1) * pageSize + index + 1;

                    return (
                      <tr
                        key={item.checkoutId}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* 1. STT */}
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-xs">
                          {String(displayIdx).padStart(2, "0")}
                        </td>

                        {/* 2. Gói tập */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                              <CreditCard className="w-4 h-4 text-[#17664e]" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-snug">
                                {planName}
                              </p>
                              <span className="text-[11px] text-slate-500 font-medium">
                                {durationDays ? `Thời hạn ${durationDays} ngày` : "Dịch vụ thể thao 3TC"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 3. Loại giao dịch */}
                        <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                          <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                            {kindLabels[item.kind] ?? item.kind}
                          </span>
                        </td>

                        {/* 4. Thời gian */}
                        <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                            <time dateTime={item.createdAt}>{vietnamDate(item.createdAt)}</time>
                          </span>
                        </td>

                        {/* 5. Trạng thái */}
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

                        {/* 6. Số tiền */}
                        <td className="py-4 px-4 text-right font-black text-slate-900 font-mono whitespace-nowrap text-sm sm:text-base">
                          {money(item.amount)}
                        </td>

                        {/* 7. Thao tác */}
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <Link
                            to={`/portal/member/checkouts/${item.checkoutId}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-white hover:bg-slate-100 text-[#17664e] border border-slate-300 hover:border-[#17664e] transition-all shadow-2xs"
                          >
                            <span>Xem đơn</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!transactions.isPending && filteredItems.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Hiển thị{" "}
                <strong className="text-slate-900 font-mono">
                  {(validCurrentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(validCurrentPage * pageSize, filteredItems.length)}
                </strong>{" "}
                trên tổng số{" "}
                <strong className="text-slate-900 font-mono">{filteredItems.length}</strong> giao dịch
              </span>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={validCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1 font-semibold cursor-pointer shadow-2xs"
                  >
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

export default TransactionsPage;
