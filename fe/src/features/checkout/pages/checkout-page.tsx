import React, { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import logo3tc from "@/assets/images/logo-3tc.png";
import { useSession } from "@/auth/session-context";
import { useNotification } from "@/context/notification-context";
import { StateMessage } from "@/components/feedback/state-message";
import { Button } from "@/components/ui/button";
import { errorText, get, money, post } from "@/lib/api";
import { clearRetryKey, retryKey } from "@/lib/checkout";
import { vietnamDate } from "@/lib/date";
import { memberKeys } from "@/lib/keys";
import { notifyDataChanged } from "@/lib/sync-channel";
import type { Checkout, CheckoutStatus, Coach } from "@/lib/types";
import {
  formatCheckoutKind,
  formatCheckoutStatus,
  formatPlanName,
  formatTierLabel,
} from "@/features/plans/lib/plan-formatter";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Loader2,
  CreditCard,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

function isPending(status: CheckoutStatus) {
  return status === "PENDING_PAYMENT";
}

function needsPolling(status?: CheckoutStatus) {
  return status === "PENDING_PAYMENT" || status === "PAYMENT_REVIEW" || status === "REFUND_PENDING";
}

interface SnapshotData {
  planName?: string;
  planId?: string;
  disciplineId?: string;
  packageTier?: string;
  ptQuota?: number;
  groupQuota?: number;
  durationDays?: number;
  unlimitedGymEntry?: boolean;
  coachId?: string;
  ratePerSession?: string;
  addonSessions?: number;
  subscriptionId?: string;
}

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkoutId = "" } = useParams();
  const { user } = useSession();
  const { showToast } = useNotification();
  const cache = useQueryClient();
  const lastStatus = useRef<CheckoutStatus | null>(null);
  const hasAutoReconciledRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const payosCode = searchParams.get("code");
  const payosStatus = searchParams.get("status");

  const order = useQuery({
    queryKey: memberKeys.checkout(user!.id, checkoutId),
    queryFn: () => get<Checkout>(`/billing/checkouts/${checkoutId}`),
    refetchInterval: (queryState) => (needsPolling(queryState.state.data?.status) ? 4000 : false),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const snapshot = order.data?.priceSnapshot as SnapshotData | undefined;

  const coaches = useQuery({
    queryKey: ["coaches"],
    queryFn: () => get<Coach[]>("/coaches"),
    enabled: Boolean(snapshot?.coachId),
  });

  const assignedCoach = coaches.data?.find((c) => c.id === snapshot?.coachId);

  useEffect(() => {
    const handleRealtimeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: string; data: Record<string, unknown> }>;
      if (
        customEvent.detail?.type === "checkout.updated" ||
        customEvent.detail?.type === "checkout.paid"
      ) {
        const data = customEvent.detail.data as { checkoutId?: string };
        if (!data?.checkoutId || data.checkoutId === checkoutId) {
          void cache.invalidateQueries({ queryKey: memberKeys.checkout(user!.id, checkoutId) });
        }
      }
    };

    window.addEventListener("app:realtime-event", handleRealtimeEvent);
    return () => {
      window.removeEventListener("app:realtime-event", handleRealtimeEvent);
    };
  }, [checkoutId, user, cache]);

  useEffect(() => {
    if (!order.data || lastStatus.current === order.data.status) return;
    lastStatus.current = order.data.status;
    if (order.data.status === "FULFILLED") {
      notifyDataChanged("PACKAGE_PURCHASED", { checkoutId }, cache);
      void Promise.all([
        cache.invalidateQueries({ queryKey: memberKeys.subscriptions(user!.id) }),
        cache.invalidateQueries({ queryKey: memberKeys.invoices(user!.id) }),
        cache.invalidateQueries({ queryKey: memberKeys.transactions(user!.id) }),
        cache.invalidateQueries({ queryKey: ["member", user!.id, "calendar"] }),
        cache.invalidateQueries({ queryKey: ["member-calendar"] }),
        cache.invalidateQueries({ queryKey: ["coach", "multi-day-schedule"] }),
      ]);
    }
  }, [order.data, cache, user]);

  const retry = useMutation({
    mutationFn: () =>
      post<Checkout>(
        `/billing/checkouts/${checkoutId}/retry`,
        {},
        { "Idempotency-Key": retryKey(checkoutId) }
      ),
    onSuccess: () => {
      clearRetryKey(checkoutId);
      void order.refetch();
    },
  });

  const reconcile = useMutation({
    mutationFn: () => post<Checkout>(`/billing/checkouts/${checkoutId}/reconcile`, {}),
    onSuccess: () => void order.refetch(),
  });

  useEffect(() => {
    // Tự động kiểm tra & cập nhật khi người dùng được PayOS chuyển hướng quay về trang
    if (
      (payosCode === "00" || payosStatus === "PAID") &&
      !hasAutoReconciledRef.current &&
      isPending(order.data?.status ?? "PENDING_PAYMENT")
    ) {
      hasAutoReconciledRef.current = true;
      reconcile.mutate();
    }
  }, [payosCode, payosStatus, order.data?.status]);

  // Tự động đối soát PayOS mỗi 10 giây khi đơn đang chờ thanh toán (phòng trường hợp quét QR trực tiếp trên localhost không có webhook)
  useEffect(() => {
    if (!order.data || !isPending(order.data.status)) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && !reconcile.isPending) {
        reconcile.mutate();
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [order.data?.status, reconcile.isPending]);

  const mockPay = useMutation({
    mutationFn: () => post<Checkout>(`/billing/checkouts/${checkoutId}/mock-pay`, {}),
    onSuccess: (updated) => {
      showToast("success", "Thanh toán thành công", "Gói tập của bạn đã được thanh toán và kích hoạt thành công!");
      if (updated) {
        cache.setQueryData(memberKeys.checkout(user!.id, checkoutId), updated);
      }
      void order.refetch();
    },
    onError: (err: any) => {
      showToast("error", "Thanh toán thất bại", errorText(err) || "Không thể thực hiện thanh toán giả lập.");
    },
  });

  const handleCopy = (text: string) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const preview = sessionStorage.getItem(`sportscenter.quote:${checkoutId}`);
  const changed = Boolean(preview && order.data && Number(preview) !== Number(order.data.amount));
  const qrValue = order.data?.qrCode || order.data?.paymentUrl || "";

  const rawPlanName = String(snapshot?.planName ?? order.data?.kind ?? "Gói tập");
  const planName = formatPlanName(rawPlanName);
  const statusMeta = formatCheckoutStatus(order.data?.status);
  const kindLabel = formatCheckoutKind(order.data?.kind);
  const shortCheckoutId = (order.data?.checkoutId || checkoutId).slice(0, 8).toUpperCase();

  // Compute breakdown descriptions in concise Vietnamese
  const planPerks: string[] = [];
  if (snapshot?.durationDays) {
    planPerks.push(`${snapshot.durationDays} ngày hiệu lực`);
  }
  if (snapshot?.unlimitedGymEntry) {
    planPerks.push("Ra vào phòng tập tự do 24/7");
  }
  if (snapshot?.groupQuota) {
    planPerks.push(`${snapshot.groupQuota} buổi lớp nhóm`);
  }
  const perksText = planPerks.length > 0 ? planPerks.join(" · ") : "Quyền lợi hội viên tiêu chuẩn";

  const isGroupCoachFee =
    Number(snapshot?.groupQuota || 0) > 0 && Number(snapshot?.ptQuota || 0) === 0;
  const ptCount = isGroupCoachFee
    ? Number(snapshot?.groupQuota || 0)
    : Number(snapshot?.ptQuota ?? snapshot?.addonSessions ?? 0);
  const hasPt = Number(order.data?.ptAmount || 0) > 0 || ptCount > 0;
  const ptPerks: string[] = [];
  if (ptCount > 0) {
    ptPerks.push(isGroupCoachFee ? `${ptCount} buổi lớp nhóm` : `${ptCount} buổi kèm 1:1`);
  }
  if (assignedCoach?.fullName) {
    ptPerks.push(`HLV: ${assignedCoach.fullName}`);
  } else if (snapshot?.coachId) {
    ptPerks.push("Huấn luyện viên kèm riêng");
  }
  if (snapshot?.ratePerSession) {
    ptPerks.push(`(${money(String(snapshot.ratePerSession))}/buổi)`);
  }
  const ptText = ptPerks.length > 0 ? ptPerks.join(" · ") : "Huấn luyện viên cá nhân kèm riêng";

  return (
    <div className="w-full max-w-5xl mx-auto py-4 sm:py-6 space-y-6 pb-20">
      {/* Top Bar: Back Button */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-9 px-3.5 rounded-md bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 inline-flex items-center gap-2 text-xs font-bold transition-all shadow-xs cursor-pointer"
          title="Quay lại trang trước"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại</span>
        </button>
      </div>

      <StateMessage
        loading={order.isPending}
        error={order.error}
        onRetry={() => void order.refetch()}
      />

      {order.data && (
        <article className="bg-white rounded-none border-2 border-slate-900 shadow-none overflow-hidden text-slate-900">
          {/* 1. Invoice Header Banner */}
          <div className="p-6 sm:p-8 border-b-2 border-slate-900 bg-slate-50/70">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <img
                    src={logo3tc}
                    alt="3TC Fitness Center"
                    className="h-9 sm:h-10 w-auto object-contain"
                  />
                  <div className="border-l border-slate-300 pl-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                      3TC Fitness Center
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">Trung tâm Huấn luyện Thể thao & Thể hình</p>
                  </div>
                </div>

                <div className="pt-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 block">
                    HÓA ĐƠN XÁC NHẬN DỊCH VỤ
                  </span>
                  <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-0.5 uppercase">
                    {planName}
                  </h1>
                </div>
              </div>

              {/* Status Badge & Tier Chips */}
              <div className="flex flex-col sm:items-end gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Status Badge */}
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-none text-xs font-black uppercase tracking-wider border",
                      statusMeta.variant === "success" && "bg-emerald-50 text-emerald-900 border-emerald-500",
                      statusMeta.variant === "pending" && "bg-amber-50 text-amber-950 border-amber-500",
                      statusMeta.variant === "failed" && "bg-rose-50 text-rose-950 border-rose-500",
                      statusMeta.variant === "neutral" && "bg-slate-100 text-slate-900 border-slate-400"
                    )}
                  >
                    {statusMeta.variant === "pending" && <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />}
                    {statusMeta.variant === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                    {statusMeta.variant === "failed" && <AlertCircle className="w-3.5 h-3.5 text-rose-700" />}
                    <span>{statusMeta.label}</span>
                  </span>

                  {/* Tier Badge translated */}
                  {snapshot?.packageTier && (
                    <span className="px-3 py-1.5 rounded-none text-xs font-black uppercase tracking-wider bg-slate-900 text-white border border-slate-900">
                      {formatTierLabel(snapshot.packageTier)}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 font-medium">
                  Loại giao dịch: <strong className="text-slate-900">{kindLabel}</strong>
                </p>
              </div>
            </div>

            {/* Structured 4-Col Meta Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 mt-6 border-t border-slate-300 text-xs">
              <div>
                <span className="text-slate-500 block font-bold uppercase tracking-wider text-[11px]">Hội viên đăng ký</span>
                <strong className="text-slate-900 text-sm font-bold truncate block mt-0.5">
                  {user?.fullName || user?.email || "Hội viên"}
                </strong>
                <span className="text-slate-500 text-[11px] truncate block">{user?.email}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-bold uppercase tracking-wider text-[11px]">Mã đơn hàng</span>
                <strong className="text-slate-900 font-mono text-sm font-black block select-all mt-0.5">
                  #{shortCheckoutId}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block font-bold uppercase tracking-wider text-[11px]">Thời gian lập</span>
                <strong className="text-slate-900 font-semibold block mt-0.5">
                  {vietnamDate(order.data.createdAt || new Date().toISOString())}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block font-bold uppercase tracking-wider text-[11px]">Hạn thanh toán</span>
                <strong className="text-slate-900 font-semibold block mt-0.5">
                  {vietnamDate(order.data.expiresAt)}
                </strong>
              </div>
            </div>
          </div>

          {/* 2. Detailed Line Items Table - Big, Spacious, Sharp Boxy Style */}
          <div className="p-6 sm:p-8">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 mb-3">
              Chi tiết các hạng mục thanh toán
            </h4>

            <div className="overflow-x-auto rounded-none border-2 border-slate-900">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 text-xs font-black uppercase tracking-wider border-b-2 border-slate-900">
                    <th className="py-4 px-4 text-center w-16 border-r border-slate-300">STT</th>
                    <th className="py-4 px-6 border-r border-slate-300">Hạng mục dịch vụ & Quyền lợi chi tiết</th>
                    <th className="py-4 px-6 text-center w-52 border-r border-slate-300">Số lượng / Thời hạn</th>
                    <th className="py-4 px-6 text-right w-52">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-200 text-sm">
                  <tr className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-6 px-4 text-center text-slate-500 font-mono font-bold text-sm border-r border-slate-300">01</td>
                    <td className="py-6 px-6 border-r border-slate-300">
                      <p className="font-black text-slate-900 text-lg sm:text-xl tracking-tight uppercase">{planName}</p>
                      <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed font-medium">{perksText}</p>
                    </td>
                    <td className="py-6 px-6 text-center text-slate-800 font-bold text-sm sm:text-base border-r border-slate-300 whitespace-nowrap">
                      1 gói ({snapshot?.durationDays ? `${snapshot.durationDays} ngày` : "Tiêu chuẩn"})
                    </td>
                    <td className="py-6 px-6 text-right font-black text-slate-950 font-mono text-lg sm:text-xl whitespace-nowrap">
                      {money(order.data.baseAmount)}
                    </td>
                  </tr>

                  {hasPt && (
                    <tr className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-6 px-4 text-center text-slate-500 font-mono font-bold text-sm border-r border-slate-300">02</td>
                      <td className="py-6 px-6 border-r border-slate-300">
                        <p className="font-black text-slate-900 text-lg sm:text-xl tracking-tight uppercase">
                          {isGroupCoachFee
                            ? "Huấn luyện viên hướng dẫn (Lớp nhóm)"
                            : "Huấn luyện viên cá nhân (PT 1:1) kèm riêng"}
                        </p>
                        <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed font-medium">{ptText}</p>
                      </td>
                      <td className="py-6 px-6 text-center text-slate-800 font-bold text-sm sm:text-base border-r border-slate-300 whitespace-nowrap">
                        {isGroupCoachFee ? `${ptCount} buổi lớp nhóm` : `${ptCount} buổi kèm riêng`}
                      </td>
                      <td className="py-6 px-6 text-right font-black text-slate-950 font-mono text-lg sm:text-xl whitespace-nowrap">
                        {money(order.data.ptAmount)}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  
                  
                  {changed && (
                    <tr className="bg-amber-50/80 border-t border-amber-200 text-xs text-amber-900">
                      <td colSpan={4} className="py-2.5 px-6 font-medium">
                        Lưu ý: Giá tại bước thanh toán có cập nhật so với báo giá xem trước. Vui lòng kiểm tra kỹ số tiền.
                      </td>
                    </tr>
                  )}
                  <tr className="bg-slate-100 border-t-2 border-slate-900">
                    <td colSpan={2} className="py-5 px-6 text-left font-black text-slate-900 text-sm sm:text-base uppercase tracking-wider border-r border-slate-300">
                      TỔNG TIỀN THANH TOÁN
                    </td>
                    <td colSpan={2} className="py-5 px-6 text-right font-black text-slate-950 font-mono text-2xl sm:text-3xl tracking-tight text-[#17664e]">
                      {money(order.data.amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 3. Settlement & Actions Section */}
            <div className="mt-8 pt-6 border-t-2 border-slate-900 grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Left Column: Action Buttons */}
              <div className="md:col-span-6 space-y-3">
                <div className="p-4 bg-slate-50 border border-slate-300 rounded-none space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Trạng thái & Thao tác đơn hàng
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Sau khi chuyển khoản hoặc thanh toán thử nghiệm, hệ thống sẽ tự động cập nhật và kích hoạt gói tập cho bạn.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  {order.data.status === "PAYMENT_FAILED" && (
                    <Button
                      type="button"
                      variant="default"
                      disabled={retry.isPending}
                      onClick={() => retry.mutate()}
                      className="w-full h-11 rounded-none bg-slate-900 hover:bg-black text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-none cursor-pointer"
                    >
                      {retry.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Thử thanh toán lại</span>
                    </Button>
                  )}

                  {isPending(order.data.status) && (
                    <Button
                      type="button"
                      variant="default"
                      disabled={reconcile.isPending}
                      onClick={() => reconcile.mutate()}
                      className="w-full h-11 rounded-none bg-[#17664e] hover:bg-[#135641] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-none cursor-pointer disabled:opacity-50"
                    >
                      {reconcile.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      <span>Kiểm tra & Cập nhật thanh toán</span>
                    </Button>
                  )}

                  {order.data.status === "FULFILLED" && (
                    <div className="space-y-3">
                      <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-950 flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">
                            Thanh toán thành công! Gói tập đã được kích hoạt.
                          </p>
                          <p className="text-[11px] text-emerald-700">
                            Bạn có thể vào Gói của tôi để xem số buổi và đặt lịch ngay.
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <Link
                          className="flex-1 h-11 rounded-none bg-[#17664e] hover:bg-[#135641] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-none transition-all"
                          to="/portal/member/subscriptions"
                        >
                          <span>Vào gói tập của tôi</span>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                        <Link
                          className="flex-1 h-11 rounded-none bg-white border border-slate-900 hover:bg-slate-100 text-slate-900 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-none transition-all"
                          to="/portal/member/invoices"
                        >
                          <FileText className="w-4 h-4 text-slate-600" />
                          <span>Xem lịch sử hóa đơn</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {(retry.error || reconcile.error || mockPay.error) && (
                    <p role="alert" className="text-xs text-rose-700 font-semibold mt-1">
                      {errorText(retry.error ?? reconcile.error ?? mockPay.error)}
                    </p>
                  )}
                </div>
              </div>

              {/* Right Side: QR Code / Payment Instructions */}
              <div className="md:col-span-6">
                {isPending(order.data.status) && (
                  <div className="bg-slate-50 border-2 border-slate-900 p-5 rounded-none space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-[#17664e]" />
                        <span>KÊNH THANH TOÁN</span>
                      </span>
                      <div className="flex items-center gap-2">
                       
                        <button
                          type="button"
                          onClick={() => mockPay.mutate()}
                          disabled={mockPay.isPending}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-white bg-emerald-100 hover:bg-emerald-600 px-2.5 py-1 border border-emerald-300 rounded cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                          title="Thanh toán(mock) "
                        >
                          {mockPay.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-700 hover:text-white" />
                          )}
                          <span>Thanh toán(mock)</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-5 pt-1">
                      {/* Large Crisp QR Code with sharp border */}
                      {qrValue ? (
                        <div className="p-3 bg-white rounded-none border border-slate-900 shrink-0 flex items-center justify-center shadow-none">
                          <QRCodeSVG value={qrValue} size={140} />
                        </div>
                      ) : null}

                      {/* Payment details & instructions */}
                      <div className="flex-1 min-w-0 space-y-2 text-left w-full">
                        <p className="text-xs text-slate-700 leading-relaxed">
                          Mở ứng dụng ngân hàng quét mã <strong>VietQR</strong> hoặc chuyển khoản theo thông tin:
                        </p>

                        {order.data.accountNumber && (
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">
                              SỐ TÀI KHOẢN ({order.data.accountName || "NGÂN HÀNG"}):
                            </span>
                            <div className="flex items-center justify-between bg-white border border-slate-900 rounded-none px-3 py-1.5 text-xs font-mono font-bold">
                              <span>{order.data.accountNumber}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(order.data.accountNumber!)}
                                className="text-[11px] text-slate-600 hover:text-black font-sans font-semibold cursor-pointer"
                              >
                                Sao chép
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider">
                            NỘI DUNG CHUYỂN KHOẢN:
                          </span>
                          <div className="flex items-center justify-between bg-white border border-slate-900 rounded-none px-3 py-1.5">
                            <span className="font-mono font-black text-xs tracking-wider text-slate-950 select-all">
                              {order.data.orderCode
                                ? `3TC ${String(order.data.orderCode).slice(-8)}`
                                : order.data.paymentId || shortCheckoutId}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  order.data.orderCode
                                    ? `3TC ${String(order.data.orderCode).slice(-8)}`
                                    : order.data.paymentId || shortCheckoutId,
                                )
                              }
                              className="px-2 py-0.5 hover:bg-slate-100 text-slate-800 hover:text-black rounded-none transition-colors cursor-pointer border border-slate-300 flex items-center gap-1 text-[11px] font-bold"
                              title="Sao chép nội dung"
                            >
                              {copied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700" />
                                  <span className="text-emerald-800">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Sao chép</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {order.data.paymentUrl && (
                      <a
                        href={order.data.paymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-10 rounded-none bg-[#17664e] hover:bg-[#135641] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-none transition-all cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Thanh toán ngay qua cổng PayOS</span>
                      </a>
                    )}

                    <p className="text-[11px] text-slate-600 leading-snug border-t border-slate-200 pt-3 font-medium">
                      Hệ thống tự động kích hoạt gói tập ngay khi nhận được tín hiệu xác nhận thanh toán thành công qua PayOS (VietQR).
                    </p>
                  </div>
                )}

                {order.data.status === "FULFILLED" && (
                  <div className="bg-emerald-50/80 rounded-none border-2 border-emerald-700 p-6 flex items-start gap-4 h-full">
                    <div className="p-2.5 bg-emerald-700 text-white rounded-none shrink-0">
                      <CheckCircle2 className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="inline-block px-2.5 py-0.5 rounded-none bg-emerald-100 text-emerald-950 font-black text-xs uppercase tracking-wider border border-emerald-300">
                        ĐÃ HOÀN TẤT THANH TOÁN
                      </div>
                      <h4 className="text-base font-bold text-emerald-950">
                        Gói tập của bạn đã được kích hoạt thành công!
                      </h4>
                      <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                        Cảm ơn bạn đã lựa chọn 3TC Fitness Center. Bạn có thể sử dụng mã vạch hoặc thẻ hội viên để bắt đầu tập luyện ngay hôm nay.
                      </p>
                    </div>
                  </div>
                )}

                {order.data.status === "PAYMENT_FAILED" && (
                  <div className="bg-rose-50/80 rounded-none border-2 border-rose-700 p-6 flex items-start gap-4 h-full">
                    <div className="p-2.5 bg-rose-700 text-white rounded-none shrink-0">
                      <AlertCircle className="w-7 h-7" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="inline-block px-2.5 py-0.5 rounded-none bg-rose-100 text-rose-950 font-black text-xs uppercase tracking-wider border border-rose-300">
                        GIAO DỊCH CHƯA THÀNH CÔNG
                      </div>
                      <h4 className="text-base font-bold text-rose-950">
                        Không thể hoàn tất giao dịch
                      </h4>
                      <p className="text-xs text-rose-900 leading-relaxed font-medium">
                        {order.data.failureReason || "Giao dịch không thành công hoặc phiên thanh toán đã hết thời gian hiệu lực. Vui lòng bấm thử lại để tạo phiên thanh toán mới."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>
      )}
    </div>
  );
};

export default CheckoutPage;
