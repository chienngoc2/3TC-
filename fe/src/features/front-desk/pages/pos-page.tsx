import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router";
import {
  ArrowLeft, Banknote, Check, CheckCircle2, CreditCard,
  Landmark, Minus, Plus, ReceiptText, RefreshCw, UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PosMemberSearch } from "../components/pos-member-search";
import { formatVnd } from "../lib/currency";
import { formatDateTime } from "../lib/date-time";
import { getMemberSubscriptions, getPosCoaches, getPosPlans, purchasePlan, purchasePtAddon, renewSubscription } from "../services/pos.service";
import type { SearchMember } from "../types/gate-checkin.types";
import type {
  AddonResponse, MembershipPlan, PackageTier, PosCoach,
  PosPaymentMethod, PosSubscription, PurchaseResponse,
} from "../types/pos.types";

type Mode = "PLAN" | "RENEW" | "ADDON";
type SaleResult = { mode: "PLAN" | "RENEW"; data: PurchaseResponse } | { mode: "ADDON"; data: AddonResponse; sessions: number };

const tierLabels: Record<PackageTier, string> = {
  TRIAL: "Dùng thử", DROP_IN: "Vé lẻ", PLUS: "Plus", VIP: "VIP",
};
const paymentOptions: { value: PosPaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: "CASH", label: "Tiền mặt", icon: Banknote },
  { value: "BANK_TRANSFER", label: "Chuyển khoản", icon: Landmark },
  { value: "CARD", label: "Thẻ", icon: CreditCard },
];
const todayKey = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const transactionError = (error: unknown): { message: string; uncertain: boolean } => {
  if (!axios.isAxiosError(error) || !error.response || error.response.status >= 500) {
    return {
      message: "Chưa xác định được trạng thái giao dịch. Không gửi lại; hãy kiểm tra hóa đơn với quản lý trước.",
      uncertain: true,
    };
  }
  const { status, data } = error.response as {
    status: number; data?: { errorCode?: string; message?: string | string[] };
  };
  const messages: Record<string, string> = {
    COACH_RATE_NOT_CONFIGURED: "HLV chưa có biểu phí hiệu lực trong thời gian này.",
    COACH_RATE_NOT_DEFINED: "HLV chưa có biểu phí hiệu lực trong thời gian này.",
    INVALID_PT_SUBSCRIPTION: "Hợp đồng đã hết hạn hoặc không có HLV đồng hành.",
    SUBSCRIPTION_NOT_ACTIVE: "Hợp đồng đã hết hạn hoặc không có HLV đồng hành.",
    PLAN_NOT_FOUND: "Không tìm thấy gói cước. Vui lòng tải lại danh sách.",
    PLAN_DISABLED: "Gói cước không còn được bán. Vui lòng chọn gói khác.",
    COACH_DISCIPLINE_MISMATCH: "HLV không phù hợp với bộ môn của gói cước.",
    COACH_REQUIRED: "Gói cước này cần chọn HLV đồng hành.",
    TRIAL_ALREADY_USED: "Hội viên đã sử dụng gói dùng thử cho bộ môn này.",
    SUBSCRIPTION_NOT_FOUND: "Không tìm thấy hợp đồng. Vui lòng tải lại danh sách.",
    SUBSCRIPTION_NOT_RENEWABLE: "Gói này không thể gia hạn tại quầy.",
    UNFREEZE_BEFORE_RENEWAL: "Cần kích hoạt lại gói trước khi gia hạn.",
  };
  if (data?.errorCode && messages[data.errorCode]) return { message: messages[data.errorCode], uncertain: false };
  if (status === 401) return { message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", uncertain: false };
  if (status === 403) return { message: "Tài khoản không có quyền thực hiện giao dịch này.", uncertain: false };
  if (status === 409) return { message: "Giao dịch bị xung đột. Vui lòng kiểm tra hóa đơn trước khi tiếp tục.", uncertain: true };
  if (Array.isArray(data?.message)) return { message: data.message.join(" "), uncertain: false };
  if (data?.message && !/^[A-Z][A-Z0-9_]+$/.test(data.message)) return { message: data.message, uncertain: false };
  return { message: "Không thể hoàn tất giao dịch. Vui lòng kiểm tra thông tin và thử lại.", uncertain: false };
};

export const PosPage: React.FC<{ initialMode?: Mode }> = ({ initialMode = "PLAN" }) => {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [member, setMember] = useState<SearchMember | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [coaches, setCoaches] = useState<PosCoach[]>([]);
  const [subscriptions, setSubscriptions] = useState<PosSubscription[]>([]);
  const [planId, setPlanId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [sessions, setSessions] = useState("2");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("CASH");
  const [plansLoading, setPlansLoading] = useState(true);
  const [coachesLoading, setCoachesLoading] = useState(true);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [plansError, setPlansError] = useState(false);
  const [coachesError, setCoachesError] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [saleError, setSaleError] = useState<string | null>(null);
  const [result, setResult] = useState<SaleResult | null>(null);
  const processingRef = useRef(false);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError(false);
    try { setPlans(await getPosPlans()); }
    catch { setPlansError(true); }
    finally { setPlansLoading(false); }
  }, []);
  const loadCoaches = useCallback(async () => {
    setCoachesLoading(true);
    setCoachesError(false);
    try { setCoaches(await getPosCoaches()); }
    catch { setCoachesError(true); }
    finally { setCoachesLoading(false); }
  }, []);

  useEffect(() => { void loadPlans(); void loadCoaches(); }, [loadPlans, loadCoaches]);
  useEffect(() => {
    if (mode === "PLAN" || !member) {
      setSubscriptions([]);
      setSubscriptionsLoading(false);
      setSubscriptionsError(false);
      return;
    }
    let active = true;
    setSubscriptions([]);
    setSubscriptionsLoading(true);
    setSubscriptionsError(false);
    getMemberSubscriptions(member.id).then((rows) => {
      if (active) setSubscriptions(rows);
    }).catch(() => {
      if (active) setSubscriptionsError(true);
    }).finally(() => {
      if (active) setSubscriptionsLoading(false);
    });
    return () => { active = false; };
  }, [mode, member]);

  const plan = plans.find((item) => item.id === planId) ?? null;
  const needsCoach = Boolean(plan && (plan.packageTier === "VIP" || (plan.ptSessionQuota ?? 0) > 0));
  const eligibleCoaches = useMemo(() => coaches.filter((coach) =>
    !plan?.disciplineId ? Boolean(coach.coachProfile?.coachSpecialties.length) : coach.coachProfile?.coachSpecialties.some(
      ({ specialty }) => specialty.disciplineId === plan.disciplineId,
    )), [coaches, plan?.disciplineId]);
  const today = todayKey();
  const activeSubscriptions = subscriptions.filter((sub) => sub.status === "ACTIVE" &&
    sub.assignedCoachId && sub.startDate.slice(0, 10) <= today && sub.endDate.slice(0, 10) >= today);
  const renewableSubscriptions = subscriptions.filter((sub) => sub.status !== "FROZEN" &&
    sub.packageTier !== "TRIAL" && sub.packageTier !== "DROP_IN");
  const availableSubscriptions = mode === "RENEW" ? renewableSubscriptions : activeSubscriptions;
  const subscription = availableSubscriptions.find((item) => item.id === subscriptionId) ?? null;
  const sessionCount = Number(sessions);
  const validSessions = Number.isInteger(sessionCount) && sessionCount >= 1 && sessionCount <= 100;
  const freePlan = mode === "PLAN" && plan && Number(plan.price) === 0 && !needsCoach;
  const effectivePaymentMethod: PosPaymentMethod = freePlan ? "FREE" : paymentMethod;
  const canSubmit = Boolean(member && (mode === "PLAN"
    ? !plansLoading && !plansError && plan && (!needsCoach || (!coachesLoading && !coachesError && eligibleCoaches.some((coach) => coach.id === coachId)))
    : !subscriptionsLoading && !subscriptionsError && subscription && (mode === "RENEW" || validSessions)));

  const changeMode = (next: Mode) => {
    if (processing || uncertain) return;
    setMode(next);
    setPlanId("");
    setCoachId("");
    setSubscriptionId("");
    setConfirming(false);
    setSaleError(null);
  };
  const changeMember = (next: SearchMember | null) => {
    setMember(next);
    setPlanId("");
    setCoachId("");
    setSubscriptionId("");
    setConfirming(false);
    setSaleError(null);
  };
  const startNew = () => {
    setResult(null);
    setUncertain(false);
    setSaleError(null);
    setConfirming(false);
    setMember(null);
    setPlanId("");
    setCoachId("");
    setSubscriptionId("");
    setSessions("2");
    setPaymentMethod("CASH");
  };

  const submit = async () => {
    if (!confirming || !canSubmit || !member || processingRef.current || uncertain || result) return;
    processingRef.current = true;
    setProcessing(true);
    setSaleError(null);
    try {
      if (mode === "PLAN" && plan) {
        const sold = await purchasePlan(member.id, plan.id, needsCoach ? coachId : undefined, effectivePaymentMethod, plan.packageTier === "VIP");
        setResult({ mode: "PLAN", data: sold });
      } else if (mode === "RENEW" && subscription) {
        const sold = await renewSubscription(subscription.id, paymentMethod);
        setResult({ mode: "RENEW", data: sold });
      } else if (mode === "ADDON" && subscription) {
        const sold = await purchasePtAddon(subscription.id, sessionCount, effectivePaymentMethod);
        setResult({ mode: "ADDON", data: sold, sessions: sessionCount });
      }
      setConfirming(false);
    } catch (cause) {
      const error = transactionError(cause);
      setSaleError(error.message);
      setUncertain(error.uncertain);
      setConfirming(false);
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const invoice = result?.data.invoice;
  const total = result && result.mode !== "ADDON"
    ? result.data.totalAmount ?? result.data.invoice.amount
    : result?.data.amount;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/portal/desk" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17664e] hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Bàn lễ tân
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
            {initialMode === "RENEW" ? "Hợp đồng hội viên" : "Bán vé & PT"}
          </h1>
          <p className="text-xs text-white mt-0.5">Xuất hóa đơn, gia hạn hợp đồng và bán thêm buổi huấn luyện cá nhân</p>
        </div>
        <div role="tablist" aria-label="Loại giao dịch" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-xs self-start sm:self-auto">
          <button type="button" role="tab" aria-selected={mode === "PLAN"} disabled={processing || uncertain || Boolean(result)} onClick={() => changeMode("PLAN")} className={`min-w-20 rounded-lg px-3.5 py-1.5 font-bold transition-colors ${mode === "PLAN" ? "bg-[#17664e] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}>Bán gói</button>
          <button type="button" role="tab" aria-selected={mode === "RENEW"} disabled={processing || uncertain || Boolean(result)} onClick={() => changeMode("RENEW")} className={`min-w-20 rounded-lg px-3.5 py-1.5 font-bold transition-colors ${mode === "RENEW" ? "bg-[#17664e] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}>Gia hạn</button>
          <button type="button" role="tab" aria-selected={mode === "ADDON"} disabled={processing || uncertain || Boolean(result)} onClick={() => changeMode("ADDON")} className={`min-w-20 rounded-lg px-3.5 py-1.5 font-bold transition-colors ${mode === "ADDON" ? "bg-[#17664e] text-white shadow-xs" : "text-slate-600 hover:bg-slate-50"}`}>PT add-on</button>
        </div>
      </div>

      {result ? (
        <section role="status" aria-live="polite" className="grid overflow-hidden rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white shadow-xs lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="p-6 md:p-9">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-[#17664e]" />
              <h2 className="text-xl font-black text-slate-900">{result.mode === "PLAN" ? "Đã xuất hóa đơn bán gói" : result.mode === "RENEW" ? "Đã gia hạn hợp đồng" : "Đã mua thêm PT"}</h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">{member?.fullName}</p>
            <div className="mt-7 border-y border-slate-100 py-6">
              <p className="text-xs font-semibold uppercase text-slate-500">Tổng tiền theo hóa đơn</p>
              <p className="mt-1 text-4xl font-black text-[#17664e]">{formatVnd(total)}</p>
              <p className="mt-2 font-mono text-xs text-slate-400">{invoice?.invoiceCode}</p>
            </div>
            {result.mode === "ADDON" && <p className="mt-5 text-sm text-slate-700">Đã mua <strong>{result.sessions} buổi</strong>. Còn <strong>{result.data.newRemainingPtSessions} buổi PT</strong>.</p>}
            <Button type="button" variant="mint" onClick={startNew} className="mt-7 h-10 rounded-xl">Giao dịch mới</Button>
          </div>
          <dl className="grid content-start gap-5 border-t border-slate-100 bg-slate-50/70 p-6 text-sm sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-t-0 md:p-9">
            <div><dt className="text-slate-500">Mã hóa đơn</dt><dd className="mt-1 break-all font-mono font-bold text-slate-900">{invoice?.invoiceCode}</dd></div>
            {result.mode !== "ADDON" && <><div><dt className="text-slate-500">Giá gói</dt><dd className="mt-1 font-semibold text-slate-900">{formatVnd(result.data.baseAmount ?? invoice?.baseAmount)}</dd></div><div><dt className="text-slate-500">PT</dt><dd className="mt-1 font-semibold text-slate-900">{formatVnd(result.data.ptAmount ?? invoice?.ptAmount)}</dd></div></>}
            <div><dt className="text-slate-500">Thanh toán</dt><dd className="mt-1 font-semibold text-slate-900">{paymentOptions.find((item) => item.value === invoice?.paymentMethod)?.label ?? invoice?.paymentMethod}</dd></div>
            <div><dt className="text-slate-500">Thời gian</dt><dd className="mt-1 font-semibold text-slate-900">{invoice?.createdAt ? formatDateTime(invoice.createdAt) : "—"}</dd></div>
            <div><dt className="text-slate-500">Mã hợp đồng</dt><dd className="mt-1 break-all font-mono text-xs text-slate-500">{result.data.subscription.id}</dd></div>
            <div><dt className="text-slate-500">Mã hóa đơn nội bộ</dt><dd className="mt-1 break-all font-mono text-xs text-slate-500">{invoice?.id}</dd></div>
          </dl>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-w-0 rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-7">
            <PosMemberSearch selected={member} onSelect={changeMember} disabled={processing || uncertain} placeholder="SĐT, họ tên hoặc email" inputMode="text" minimumLength={2} showEmail />
            {mode === "PLAN" ? (
              <section className="pt-6" aria-labelledby="pos-plan-heading">
                <h2 id="pos-plan-heading" className="text-base font-bold text-slate-900">Gói cước</h2>
                {plansLoading ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="h-28 animate-pulse rounded-xl bg-slate-100" /><div className="h-28 animate-pulse rounded-xl bg-slate-100" /></div>
                  : plansError ? <p role="alert" className="mt-4 flex items-center gap-3 text-sm text-rose-600">Không tải được gói cước.<button type="button" onClick={() => void loadPlans()} aria-label="Tải lại gói cước" title="Tải lại gói cước"><RefreshCw className="h-4 w-4" /></button></p>
                  : !plans.length ? <p className="mt-4 text-sm text-slate-500">Không có gói cước đang bán.</p>
                  : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{plans.map((item) => (
                    <button key={item.id} type="button" disabled={processing || uncertain} onClick={() => { setPlanId(item.id); setCoachId(""); setConfirming(false); setSaleError(null); }}
                      className={`min-w-0 rounded-xl border p-4 text-left transition-colors ${planId === item.id ? "border-[#17664e] bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                      <span className="flex items-start justify-between gap-2"><span className="min-w-0"><strong className="block break-words text-sm text-slate-900">{item.name}</strong><span className="mt-1 block text-xs text-slate-500">{tierLabels[item.packageTier]}{item.discipline ? ` · ${item.discipline.name}` : ""}</span></span>{planId === item.id && <Check className="h-4 w-4 shrink-0 text-[#17664e]" />}</span>
                      <span className="mt-4 block text-base font-black text-[#17664e]">{formatVnd(item.price)}</span><span className="mt-1 block text-xs text-slate-500">{item.durationDays} ngày{(item.ptSessionQuota ?? 0) > 0 ? ` · ${item.ptSessionQuota} buổi PT` : ""}</span>{item.description && <span className="mt-2 block text-xs text-slate-500">{item.description}</span>}
                    </button>))}</div>}
                {plan && needsCoach && <div className="mt-6 border-t border-slate-100 pt-5"><h3 className="text-sm font-semibold text-slate-900">HLV đồng hành</h3>
                  {coachesLoading ? <div className="mt-3 h-12 animate-pulse rounded-xl bg-slate-100" />
                    : coachesError ? <p role="alert" className="mt-3 flex items-center gap-3 text-sm text-rose-600">Không tải được HLV.<button type="button" onClick={() => void loadCoaches()} aria-label="Tải lại HLV" title="Tải lại HLV"><RefreshCw className="h-4 w-4" /></button></p>
                    : eligibleCoaches.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{eligibleCoaches.map((coach) => <button key={coach.id} type="button" disabled={processing || uncertain} onClick={() => { setCoachId(coach.id); setConfirming(false); setSaleError(null); }} className={`flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm ${coachId === coach.id ? "border-[#17664e] bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                      {coach.avatarUrl ? <img src={coach.avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <UserRound className="h-8 w-8 shrink-0 rounded-full bg-slate-100 p-2 text-[#17664e]" />}<span className="min-w-0 flex-1 truncate font-medium text-slate-800">{coach.fullName}</span>{coachId === coach.id && <Check className="h-4 w-4 shrink-0 text-[#17664e]" />}
                    </button>)}</div> : <p className="mt-3 text-sm text-slate-500">Không có HLV phù hợp với gói này.</p>}
                </div>}
              </section>
            ) : (
              <section className="pt-6" aria-labelledby="pos-addon-heading">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="pos-addon-heading" className="text-base font-bold text-slate-900">{mode === "RENEW" ? "Hợp đồng có thể gia hạn" : "Hợp đồng PT đang hoạt động"}</h2>
                  {member && <Link to={`/portal/desk/members/${encodeURIComponent(member.id)}`} className="text-xs font-bold text-[#17664e] hover:underline">Xem hồ sơ & trạng thái</Link>}
                </div>
                {!member ? <p className="mt-4 text-sm text-slate-400">Chưa chọn hội viên.</p>
                  : subscriptionsLoading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-slate-100" />
                  : subscriptionsError ? <p role="alert" className="mt-4 text-sm text-rose-600">Không tải được hợp đồng của hội viên.</p>
                  : !availableSubscriptions.length ? <p className="mt-4 text-sm text-slate-500">{mode === "RENEW" ? "Không có hợp đồng có thể gia hạn." : "Không có hợp đồng PT đang hoạt động."}</p>
                  : <div className="mt-4 space-y-2">{availableSubscriptions.map((sub) => (
                    <button key={sub.id} type="button" disabled={processing || uncertain} onClick={() => { setSubscriptionId(sub.id); setConfirming(false); setSaleError(null); }} className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left ${subscriptionId === sub.id ? "border-[#17664e] bg-emerald-50/50" : "border-slate-200 hover:border-slate-300"}`}>
                      <span className="min-w-0"><strong className="block text-sm text-slate-900">{sub.plan.name}</strong><span className="mt-1 block text-xs text-slate-500">{sub.assignedCoach ? `HLV ${sub.assignedCoach.fullName} · ` : ""}Hạn {sub.endDate.slice(0, 10)}</span></span><span className="text-sm font-bold text-[#17664e]">{mode === "RENEW" ? sub.status === "ACTIVE" ? "Đang hoạt động" : "Đã hết hạn" : `${sub.remainingPtSessions ?? 0} buổi còn lại`}</span>
                    </button>))}</div>}
                {mode === "RENEW" && subscription && <p className="mt-5 text-xs text-slate-500">Gói gia hạn được tạo nối tiếp theo ngày hết hạn. Tổng tiền cuối do backend ghi trên hóa đơn.</p>}
                {mode === "ADDON" && subscription && <div className="mt-6 border-t border-slate-100 pt-5"><label htmlFor="addon-sessions" className="text-sm font-semibold text-slate-900">Số buổi mua thêm</label><div className="mt-3 inline-flex h-10 items-center overflow-hidden rounded-xl border border-slate-200">
                  <button type="button" disabled={processing || uncertain || sessionCount <= 1} onClick={() => { setSessions(String(Math.max(1, sessionCount - 1))); setConfirming(false); }} className="flex h-10 w-10 items-center justify-center bg-slate-50 disabled:opacity-40" aria-label="Giảm số buổi"><Minus className="h-4 w-4" /></button>
                  <input id="addon-sessions" type="number" min={1} max={100} step={1} value={sessions} disabled={processing || uncertain} onChange={(event) => { setSessions(event.target.value); setConfirming(false); }} className="h-10 w-16 border-x border-slate-200 text-center text-sm outline-none" />
                  <button type="button" disabled={processing || uncertain || !validSessions || sessionCount >= 100} onClick={() => { setSessions(String(Math.min(100, sessionCount + 1))); setConfirming(false); }} className="flex h-10 w-10 items-center justify-center bg-slate-50 disabled:opacity-40" aria-label="Tăng số buổi"><Plus className="h-4 w-4" /></button>
                </div>{!validSessions && <p role="alert" className="mt-2 text-xs text-rose-600">Chọn từ 1 đến 100 buổi.</p>}</div>}
              </section>
            )}
          </div>

          <aside className="min-w-0 self-start rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-6 lg:sticky lg:top-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4"><ReceiptText className="h-5 w-5 text-[#17664e]" /><h2 className="text-base font-bold text-slate-900">Tổng kết giao dịch</h2></div>
            <dl className="space-y-3 border-b border-slate-100 py-5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Hội viên</dt><dd className="min-w-0 break-words text-right font-bold text-slate-900">{member?.fullName ?? "Chưa chọn"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">{mode === "PLAN" ? "Gói cước" : "Hợp đồng"}</dt><dd className="min-w-0 break-words text-right font-medium text-slate-800">{mode === "PLAN" ? plan?.name ?? "Chưa chọn" : subscription?.plan.name ?? "Chưa chọn"}</dd></div>
              {mode === "PLAN" && needsCoach && <div className="flex justify-between gap-3"><dt className="text-slate-500">HLV</dt><dd className="min-w-0 break-words text-right font-medium text-slate-800">{coaches.find((item) => item.id === coachId)?.fullName ?? "Chưa chọn"}</dd></div>}
              {mode === "ADDON" && <div className="flex justify-between gap-3"><dt className="text-slate-500">Số buổi</dt><dd className="font-bold text-slate-900">{validSessions ? sessionCount : "—"}</dd></div>}
            </dl>
            <div className="py-5 text-sm"><p className="text-slate-500">{mode === "PLAN" ? "Giá gói niêm yết" : mode === "RENEW" ? "Giá gốc gói" : "Giá PT add-on"}</p><p className="mt-1 text-2xl font-black text-[#17664e]">{mode === "PLAN" && plan ? formatVnd(plan.price) : mode === "RENEW" && subscription ? formatVnd(subscription.plan.price) : "Xác nhận trên hóa đơn"}</p>{(mode === "RENEW" || mode === "PLAN" && needsCoach) && <p className="mt-2 text-xs text-slate-400">Chưa gồm chi phí PT nếu có. Tổng cuối theo hóa đơn backend.</p>}</div>
            {freePlan ? <p className="border-t border-slate-100 pt-5 text-sm font-bold text-[#17664e]">Gói miễn phí</p> : <fieldset disabled={processing || uncertain} className="border-t border-slate-100 pt-5"><legend className="sr-only">Phương thức thanh toán</legend><p className="mb-3 text-sm font-semibold text-slate-900">Thanh toán</p><div className="grid gap-2">{paymentOptions.map(({ value, label, icon: Icon }) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${paymentMethod === value ? "border-[#17664e] bg-emerald-50/50" : "border-slate-200"}`}><input type="radio" name="pos-payment" value={value} checked={paymentMethod === value} onChange={() => { setPaymentMethod(value); setConfirming(false); }} className="accent-[#17664e]" /><Icon className="h-4 w-4 text-[#17664e]" /><span className="font-medium text-slate-800">{label}</span></label>)}</div></fieldset>}
            {saleError && <p role="alert" className="mt-5 border-l-2 border-rose-500 bg-rose-50 p-3 text-sm text-rose-700 rounded-r-xl">{saleError}</p>}
            {confirming && !uncertain && <div className="mt-5 border-t border-slate-100 pt-4 text-sm"><p className="font-bold text-slate-900">Xác nhận {freePlan ? "xuất hóa đơn" : "thu tiền và xuất hóa đơn"}?</p><p className="mt-1 text-xs text-slate-500">{member?.fullName} · {freePlan ? "Miễn phí" : paymentOptions.find((item) => item.value === paymentMethod)?.label}</p></div>}
            <div className="mt-5 flex gap-2">{confirming && <Button type="button" variant="outline" disabled={processing} onClick={() => setConfirming(false)} className="rounded-xl">Quay lại</Button>}<Button type="button" variant="mint" disabled={!canSubmit || processing || uncertain} onClick={() => confirming ? void submit() : setConfirming(true)} className="min-w-0 flex-1 rounded-xl">{processing ? "Đang xử lý..." : confirming ? "Xác nhận thanh toán" : freePlan ? "Xuất hóa đơn miễn phí" : mode === "PLAN" ? "Thanh toán & xuất hóa đơn" : mode === "RENEW" ? "Gia hạn hợp đồng" : "Mua thêm buổi PT"}</Button></div>
          </aside>
        </div>
      )}
    </div>
  );
};