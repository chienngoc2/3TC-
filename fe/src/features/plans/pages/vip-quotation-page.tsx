import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useSession } from "@/auth/session-context";
import { StateMessage } from "@/components/feedback/state-message";
import { Button } from "@/components/ui/button";
import { errorText, get, money, query } from "@/lib/api";
import { createCheckout } from "@/lib/checkout";
import type { Plan, Quote } from "@/lib/types";
import type { Coach } from "@/features/coaches/types/coach.types";
import { isCoachQualifiedForPlan } from "@/lib/topic-matcher";
import {
  ArrowRight,
  ArrowLeft,
  Info,
  AlertCircle,
  Loader2,
  CreditCard,
  ShieldCheck,
  Award,
  CheckCircle2,
  UserCheck,
} from "lucide-react";
import logo3tc from "@/assets/images/logo-3tc.png";

export const VipQuotationPage: React.FC = () => {
  const [params] = useSearchParams();
  const rawPlanId = params.get("planId") ?? "";
  const paramCoachId = params.get("coachId") ?? "";
  const paramCoachStars = params.get("coachStars") ?? "";
  const { user } = useSession();
  const navigate = useNavigate();
  const [coachId, setCoachId] = useState(paramCoachId);
  const [planId, setPlanId] = useState(rawPlanId);

  const isUUID = (val?: string | null) =>
    Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

  const plans = useQuery({
    queryKey: ["catalog", "all"],
    queryFn: () => get<Plan[]>("/memberships/plans", true),
  });

  const coaches = useQuery({ queryKey: ["coaches"], queryFn: () => get<Coach[]>("/coaches") });

  // Auto-detect matching VIP plan if coachId is passed without planId or if planId is missing/invalid
  useEffect(() => {
    if (plans.data && plans.data.length > 0) {
      const isCurrentPlanValid = isUUID(planId) && plans.data.some((p) => p.id === planId && p.packageTier === "VIP");
      if (!isCurrentPlanValid) {
        if (coachId && coaches.data) {
          const targetCoach = coaches.data.find((c) => c.id === coachId);
          const discIds =
            targetCoach?.coachProfile?.coachSpecialties?.map((s) => s.specialty.disciplineId) ||
            targetCoach?.disciplineIds ||
            [];
          const match = plans.data.find(
            (p) =>
              p.packageTier === "VIP" &&
              p.isActive &&
              discIds.includes(p.disciplineId)
          );
          if (match) {
            setPlanId(match.id);
            return;
          }
        }
        const anyVip = plans.data.find((p) => p.packageTier === "VIP" && p.isActive);
        if (anyVip) setPlanId(anyVip.id);
      }
    }
  }, [coachId, coaches.data, plans.data, planId]);

  const plan = plans.data?.find((item) => item.id === planId);

  // Compatible coaches based on plan's discipline & qualifications
  const compatible = useMemo(() => {
    if (!coaches.data || !plan) return [];
    const qualified = coaches.data.filter((c) => isCoachQualifiedForPlan(c, plan));
    if (paramCoachStars) {
      const byStars = qualified.filter((c) => (c.coachProfile?.ratingStars || 3) === Number(paramCoachStars));
      if (byStars.length > 0) return byStars;
    }
    return qualified;
  }, [coaches.data, plan, paramCoachStars]);

  // If coachId is not yet selected, auto-select first compatible coach so quote displays immediately
  useEffect(() => {
    if (!coachId && compatible.length > 0) {
      setCoachId(compatible[0].id);
    }
  }, [coachId, compatible]);

  const selectedCoach =
    coaches.data?.find((c) => c.id === coachId) || compatible.find((c) => c.id === coachId);

  const quote = useQuery({
    queryKey: ["quote", planId, coachId],
    queryFn: () => get<Quote>(`/billing/quotations/vip${query({ planId, coachId })}`),
    enabled: Boolean(isUUID(planId) && isUUID(coachId) && plan?.packageTier === "VIP"),
  });

  const checkout = useMutation({
    mutationFn: () => {
      const effectivePlanId = isUUID(planId)
        ? planId
        : plans.data?.find((p) => p.packageTier === "VIP" && p.isActive)?.id;
      const effectiveCoachId = isUUID(coachId) ? coachId : compatible[0]?.id;

      if (!effectivePlanId || !isUUID(effectivePlanId)) {
        throw new Error("Không tìm thấy mã gói tập VIP hợp lệ.");
      }
      if (!effectiveCoachId || !isUUID(effectiveCoachId)) {
        throw new Error("Vui lòng chọn một Huấn luyện viên để tiếp tục.");
      }

      const effectiveCoachStars =
        selectedCoach?.coachProfile?.ratingStars || (paramCoachStars ? Number(paramCoachStars) : undefined);

      return createCheckout(user!.id, {
        kind: "NEW_SUBSCRIPTION",
        planId: effectivePlanId,
        coachId: effectiveCoachId,
        coachRatingStars: effectiveCoachStars,
      });
    },
    onSuccess: (order) => {
      sessionStorage.setItem(
        `sportscenter.quote:${order.checkoutId}`,
        String(quote.data?.totalAmount ?? "")
      );
      navigate(`/portal/member/checkouts/${order.checkoutId}`);
    },
  });

  const currentDate = new Date().toLocaleDateString("vi-VN");
  const ratePerSession = quote.data?.ratePerSession
    ? Number(quote.data.ratePerSession)
    : Number(selectedCoach?.coachProfile?.ratePerSession) ||
      (selectedCoach?.coachProfile?.ratingStars ? selectedCoach.coachProfile.ratingStars * 1000 : 0) ||
      Number(selectedCoach?.coachRates?.[0]?.ratePerSession) ||
      0;
  const weeklyEstimate = ratePerSession > 0 ? ratePerSession * 3 : 0;

  const coachSpecialties =
    selectedCoach?.coachProfile?.coachSpecialties?.map((s) => s.specialty.name).join(", ") ||
    selectedCoach?.coachProfile?.specialties ||
    "HLV cá nhân chuyên nghiệp";

  return (
    <div className="w-full max-w-4xl mx-auto py-4 px-2 sm:px-0">
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-9 px-3.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 inline-flex items-center gap-1.5 text-xs font-bold transition-colors shrink-0 shadow-xs cursor-pointer"
          title="Quay lại trang trước"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại</span>
        </button>
      </div>

      <StateMessage
        loading={plans.isPending || coaches.isPending}
        error={plans.error ?? coaches.error}
      />

      {/* Notice State if VIP plan not found */}
      {plans.data && !plan && (
        <div
          role="alert"
          className="p-4 rounded-md bg-white border border-slate-200 text-slate-800 text-xs sm:text-sm font-medium my-4 flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Đang tải thông tin gói tập VIP kèm riêng phù hợp với HLV...</span>
          </div>
          <Link
            to="/portal/member/plans"
            className="font-bold underline text-[#17664e] hover:text-[#135641]"
          >
            Xem danh mục gói
          </Link>
        </div>
      )}

      {/* Main Solid White Invoice Sheet */}
      {plan?.packageTier === "VIP" && (
        <article className="bg-white rounded-md border border-slate-200 p-6 sm:p-8 text-slate-900 shadow-sm space-y-6">
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-5 border-b border-slate-200 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <img src={logo3tc} alt="3TC FITNESS" className="h-7 w-auto object-contain" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  HỆ THỐNG TRUNG TÂM THỂ THAO 3TC
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase pt-1">
                BÁO GIÁ DỊCH VỤ HUẤN LUYỆN KÈM RIÊNG (PT 1:1)
              </h1>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{plan.name}</span>
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Bộ môn: <strong className="text-slate-700">{plan.discipline?.name || "Fitness"}</strong>
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right text-xs text-slate-600 space-y-1 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-md border sm:border-0 border-slate-200">
              <p>
                Ngày lập: <strong className="text-slate-800 font-mono">{currentDate}</strong>
              </p>
              <p>
                Hội viên: <strong className="text-slate-900">{user?.fullName ?? user?.email}</strong>
              </p>
              <p>
                Thời hạn gói: <strong className="text-slate-900 font-mono">{plan.durationDays} ngày</strong>
              </p>
            </div>
          </div>

          {/* Coach Selection & Spotlight */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#17664e]" />
                <span>Huấn luyện viên phụ trách (PT 1:1):</span>
              </span>

              {/* Coach Selector Dropdown */}
              <div className="flex items-center gap-2">
                <label htmlFor="coach-select" className="text-xs text-slate-500 font-medium whitespace-nowrap">
                  Chọn HLV khác:
                </label>
                <select
                  id="coach-select"
                  aria-label="Chọn Huấn luyện viên"
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                  className="h-9 px-3 text-xs font-bold rounded-md border border-slate-300 bg-white text-slate-800 focus:outline-none focus:border-[#17664e] cursor-pointer shadow-xs"
                >
                  <option value="">-- Chọn Huấn luyện viên --</option>
                  {compatible.map((c) => {
                    const r =
                      Number(c.coachProfile?.ratePerSession) ||
                      (c.coachProfile?.ratingStars ? c.coachProfile.ratingStars * 1000 : 0) ||
                      Number(c.coachRates?.[0]?.ratePerSession) ||
                      0;
                    return (
                      <option key={c.id} value={c.id}>
                        {c.fullName} - {c.title || "HLV"} {r > 0 ? `(${money(r)}/buổi)` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {selectedCoach ? (
              <div className="p-4 rounded-md bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {selectedCoach.avatarUrl ? (
                    <img
                      src={selectedCoach.avatarUrl}
                      alt={selectedCoach.fullName}
                      className="w-12 h-12 rounded-md object-cover object-top border border-slate-300 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-md bg-slate-900 text-emerald-400 font-black text-base flex items-center justify-center border border-slate-800 shrink-0">
                      {selectedCoach.fullName.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        HLV {selectedCoach.fullName}
                      </h3>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded-md">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        HLV Đạt Chuẩn
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {selectedCoach.title || "Huấn luyện viên cá nhân"} · {coachSpecialties}
                    </p>
                    {selectedCoach.experienceYears > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 mt-0.5">
                        <Award className="w-3 h-3 text-amber-600" /> {selectedCoach.experienceYears} năm kinh nghiệm
                      </span>
                    )}
                  </div>
                </div>

                {/* Rate pill */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-1 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200 shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Biểu phí kèm 1:1
                  </span>
                  <div className="text-right">
                    <span className="text-sm font-black text-[#17664e] font-mono whitespace-nowrap">
                      {ratePerSession > 0 ? `${money(ratePerSession)} / buổi` : "Theo gói VIP"}
                    </span>
                    {weeklyEstimate > 0 && (
                      <p className="text-[11px] text-slate-600 font-medium">
                        Ước tính theo tuần: <strong className="text-emerald-700 font-mono">{money(weeklyEstimate)}/tuần</strong>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Vui lòng chọn 1 Huấn luyện viên ở danh sách trên để tiếp tục báo giá.</span>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Line Items Table */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              Chi tiết hạng mục thanh toán
            </span>
            <div className="border border-slate-200 rounded-md overflow-hidden">
              <table className="w-full text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 text-[11px] uppercase font-bold tracking-wider text-left border-b border-slate-200">
                    <th className="p-3 text-center w-12">STT</th>
                    <th className="p-3">Hạng mục dịch vụ</th>
                    <th className="p-3 text-center w-32">Số lượng</th>
                    <th className="p-3 text-right w-40">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Row 1: Base VIP Plan */}
                  <tr>
                    <td className="p-3.5 text-center text-slate-400 font-mono text-xs">01</td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900">
                        Quyền hội viên &amp; Cơ sở vật chất ({plan.name})
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ra vào phòng tập không giới hạn + {plan.groupSessionQuota ?? 0} buổi lớp nhóm trong {plan.durationDays} ngày
                      </p>
                    </td>
                    <td className="p-3.5 text-center text-slate-700 font-medium whitespace-nowrap font-mono text-xs">
                      1 gói ({plan.durationDays} ngày)
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                      {money(plan.price)}
                    </td>
                  </tr>

                  {/* Row 2: Coach PT Sessions */}
                  <tr>
                    <td className="p-3.5 text-center text-slate-400 font-mono text-xs">02</td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900">
                          Huấn luyện viên cá nhân (PT 1:1) kèm riêng
                        </span>
                        {selectedCoach && (
                          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            HLV: {selectedCoach.fullName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Giáo án tập luyện cá nhân hóa, theo dõi InBody, hướng dẫn dinh dưỡng và kỹ thuật chuẩn xác
                      </p>
                    </td>
                    <td className="p-3.5 text-center text-slate-700 font-medium whitespace-nowrap font-mono text-xs">
                      {plan.ptSessionQuota ?? 12} buổi PT
                    </td>
                    <td className="p-3.5 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                      {quote.data ? (
                        money(quote.data.ptAmount)
                      ) : (
                        <span className="text-slate-400 font-normal italic">Đang tính...</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Invoice Summary & Checkout Action */}
          <div className="pt-4 border-t border-slate-200">
            {!coachId ? (
              <div className="p-4 rounded-md bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <p className="font-bold m-0 text-amber-900">
                    Vui lòng chọn Huấn luyện viên ở danh sách phía trên để hoàn tất báo giá gói tập VIP.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <StateMessage
                  loading={quote.isPending}
                  error={quote.error}
                  onRetry={() => void quote.refetch()}
                />

                {quote.data && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start pt-2">
                    {/* Left Column: Notes & Weekly Transparency */}
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 rounded-md border border-slate-200 space-y-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
                          Biểu phí kèm riêng &amp; Chu kỳ tập luyện
                        </span>
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div className="p-2.5 bg-white rounded-md border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Đơn giá 1 buổi
                            </span>
                            <span className="text-sm font-black text-slate-900 font-mono whitespace-nowrap mt-0.5 block">
                              {money(quote.data.ratePerSession)}
                            </span>
                          </div>

                          <div className="p-2.5 bg-white rounded-md border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block">
                              Giá tuần 
                            </span>
                            <span className="text-sm font-black text-emerald-700 font-mono whitespace-nowrap mt-0.5 block">
                              {money(weeklyEstimate)}/tuần
                            </span>
                          </div>
                        </div>

                        <div className="text-[11.5px] text-slate-600 space-y-1 pt-1">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Bao gồm <strong>12 buổi kèm riêng</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Quyền ra vào phòng tập và tham gia lớp nhóm không giới hạn trong {plan.durationDays} ngày.</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 italic leading-relaxed">
                        Giá thanh toán hiển thị đã bao gồm toàn bộ phí hội viên và phí kèm riêng với HLV, không phát sinh phụ phí tại quầy.
                      </p>
                    </div>

                    {/* Right Column: Calculations & Big Checkout Button */}
                    <div className="p-4 sm:p-5 bg-slate-50/70 rounded-md border border-slate-200 space-y-3">
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-medium">Phí thẻ hội viên trọn gói:</span>
                          <span className="font-bold text-slate-900 font-mono whitespace-nowrap">
                            {money(quote.data.baseAmount)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-slate-600">
                          <span className="font-medium">
                            Phí HLV ({quote.data.ptSessions} buổi kèm riêng):
                          </span>
                          <span className="font-bold text-slate-900 font-mono whitespace-nowrap">
                            {money(quote.data.ptAmount)}
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-300 flex items-baseline justify-between">
                          <div>
                            <span className="font-black text-slate-900 text-sm uppercase tracking-wide block">
                              TỔNG THANH TOÁN:
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium block">
                              (Đã bao gồm VAT &amp; mọi quyền lợi)
                            </span>
                          </div>
                          <p className="price text-2xl font-black text-[#17664e] m-0 whitespace-nowrap font-mono tracking-tight">
                            {money(quote.data.totalAmount)}
                          </p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="default"
                        size="default"
                        disabled={checkout.isPending || !quote.data.eligible}
                        onClick={() => checkout.mutate()}
                        className="w-full mt-2 h-12 rounded-md bg-[#17664e] hover:bg-[#007360] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        {checkout.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>ĐANG KHỞI TẠO HÓA ĐƠN...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>TIẾN HÀNH THANH TOÁN</span>
                            <ArrowRight className="w-4 h-4 ml-0.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {checkout.error && (
              <div
                role="alert"
                className="mt-4 p-3.5 rounded-md bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorText(checkout.error)}</span>
              </div>
            )}
          </div>
        </article>
      )}
    </div>
  );
};

export default VipQuotationPage;
