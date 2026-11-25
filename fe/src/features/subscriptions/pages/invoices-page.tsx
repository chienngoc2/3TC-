import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  CalendarDays,
  ArrowUpRight,
  CheckCircle2,
  CircleHelp,
  Clock,
  CreditCard,
  ReceiptText,
  RotateCcw,
  XCircle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useSession } from "@/auth/session-context";
import { StateMessage } from "@/components/feedback/state-message";
import { Badge } from "@/components/ui/badge";
import { get, money } from "@/lib/api";
import { vietnamDate } from "@/lib/date";
import { memberKeys } from "@/lib/keys";
import type { Invoice } from "@/lib/types";
import { cn } from "@/lib/utils";

const invoiceStatusStyles: Record<
  string,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  PAID: {
    label: "Đã thanh toán",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "Chờ thanh toán",
    className: "border-amber-200 bg-amber-50 text-amber-800",
    icon: Clock,
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    icon: RotateCcw,
  },
  CANCELLED: {
    label: "Đã hủy",
    className: "border-rose-200 bg-rose-50 text-rose-800",
    icon: XCircle,
  },
};

const invoiceTypeLabels: Record<string, string> = {
  SUBSCRIPTION_NEW: "Đăng ký gói tập mới",
  DROP_IN: "Gói tập theo buổi lẻ",
  PT_ADDON: "Mua thêm buổi kèm HLV 1:1",
};

const paymentMethodLabels: Record<string, string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản QR",
  CARD: "Thẻ ngân hàng",
  MOCK: "Thanh toán thử nghiệm",
  FREE: "Miễn phí",
};

export const InvoicesPage: React.FC = () => {
  const { user } = useSession();

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">("date-desc");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 8;

  const invoices = useQuery({
    queryKey: memberKeys.invoices(user!.id),
    queryFn: () => get<Invoice[]>("/billing/invoices"),
  });

  // Filter & sort invoices
  const filteredInvoices = useMemo(() => {
    let list = invoices.data || [];

    // Filter by status
    if (statusFilter !== "ALL") {
      list = list.filter((inv) => inv.status === statusFilter);
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
  }, [invoices.data, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / pageSize));
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedInvoices = useMemo(() => {
    const start = (validCurrentPage - 1) * pageSize;
    return filteredInvoices.slice(start, start + pageSize);
  }, [filteredInvoices, validCurrentPage, pageSize]);

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 pb-20">
      {/* Div trắng bao quanh tất cả component ở trang hóa đơn */}
      <div className="bg-white rounded-md border border-slate-200 p-5 sm:p-7 space-y-6 shadow-xs">
        {/* Header (đã bỏ nút quay lại) */}
        <div className="pb-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Lịch sử hóa đơn &amp; Thanh toán
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Theo dõi và quản lý toàn bộ các giao dịch gói tập tại 3TC Fitness Center
            </p>
          </div>
          <div className="h-10 w-10 rounded-md bg-emerald-50 text-[#17664e] flex items-center justify-center shrink-0 border border-emerald-100">
            <ReceiptText className="w-5 h-5" />
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
                { id: "PAID", label: "Đã thanh toán" },
                { id: "PENDING", label: "Chờ thanh toán" },
                { id: "REFUNDED", label: "Đã hoàn tiền" },
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
            loading={invoices.isPending}
            error={invoices.error}
            onRetry={() => void invoices.refetch()}
            empty={filteredInvoices.length === 0}
            emptyText="Không tìm thấy hóa đơn nào phù hợp với bộ lọc hiện tại."
          />

          {/* Structured Invoices Table */}
          {!invoices.isPending && filteredInvoices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3.5 px-4 text-center w-12">STT</th>
                    <th className="py-3.5 px-4">Dịch vụ &amp; Hạng mục</th>
                    <th className="py-3.5 px-4">Phương thức</th>
                    <th className="py-3.5 px-4">Thời gian tạo</th>
                    <th className="py-3.5 px-4 text-center">Trạng thái</th>
                    <th className="py-3.5 px-4 text-right">Số tiền</th>
                    <th className="py-3.5 px-4 text-center w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paginatedInvoices.map((item, index) => {
                    const status = invoiceStatusStyles[item.status] ?? {
                      label: item.status,
                      className: "border-slate-200 bg-slate-50 text-slate-700",
                      icon: CircleHelp,
                    };
                    const StatusIcon = status.icon;
                    const checkoutPath = item.checkoutId
                      ? `/portal/member/checkouts/${encodeURIComponent(item.checkoutId)}`
                      : null;
                    const displayIdx = (validCurrentPage - 1) * pageSize + index + 1;

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        {/* 1. STT */}
                        <td className="py-4 px-4 text-center text-slate-400 font-mono text-xs">
                          {String(displayIdx).padStart(2, "0")}
                        </td>

                        {/* 2. Dịch vụ */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 border border-slate-200">
                              <ReceiptText className="w-4 h-4 text-[#17664e]" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 leading-snug">
                                {invoiceTypeLabels[item.type] ?? item.type}
                              </p>
                              
                            </div>
                          </div>
                        </td>

                        {/* 3. Phương thức */}
                        <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            <span>{paymentMethodLabels[item.paymentMethod] ?? item.paymentMethod}</span>
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
                          {checkoutPath ? (
                            <Link
                              to={checkoutPath}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-white hover:bg-slate-100 text-[#17664e] border border-slate-300 hover:border-[#17664e] transition-all shadow-2xs"
                            >
                              <span>Xem đơn</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {!invoices.isPending && filteredInvoices.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-medium">
                Hiển thị{" "}
                <strong className="text-slate-900 font-mono">
                  {(validCurrentPage - 1) * pageSize + 1} -{" "}
                  {Math.min(validCurrentPage * pageSize, filteredInvoices.length)}
                </strong>{" "}
                trên tổng số{" "}
                <strong className="text-slate-900 font-mono">{filteredInvoices.length}</strong> hóa đơn
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

export default InvoicesPage;
