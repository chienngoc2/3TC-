import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  ArrowLeft, CalendarDays, CreditCard, Pencil, ScanLine,
  RefreshCw, UserRound, UsersRound, X, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateMemberModal, EditMemberModal, SubscriptionStatusModal } from "../components/member-modals";
import { InbodyPanel } from "../components/inbody-panel";
import { PosMemberSearch } from "../components/pos-member-search";
import { formatVnd } from "../lib/currency";
import { formatDateTime } from "../lib/date-time";
import { memberError } from "../lib/member-error";
import {
  getMemberDetail, getMemberHistory, getMemberSubscriptions,
  getRecentMemberInvoices,
} from "../services/member-management.service";
import type { Attendance } from "../types/front-desk.types";
import type { SearchMember } from "../types/gate-checkin.types";
import type { MemberDetail, MemberInvoice } from "../types/member-management.types";
import type { PosSubscription } from "../types/pos.types";

type DetailTab = "OVERVIEW" | "ATTENDANCE" | "INVOICES" | "INBODY";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric",
});
const formatDate = (value: string): string => dateFormatter.format(new Date(value));

const statusText: Record<string, string> = {
  ACTIVE: "Đang hoạt động", FROZEN: "Đang đóng băng", EXPIRED: "Hết hạn",
  PRESENT: "Có mặt", ABSENT: "Vắng", LATE: "Đi muộn",
};
const paymentText: Record<string, string> = {
  CASH: "Tiền mặt", BANK_TRANSFER: "Chuyển khoản", CARD: "Thẻ", FREE: "Miễn phí", MOCK: "Thanh toán thử",
};
const invoiceStatusText: Record<string, string> = {
  PAID: "Đã thanh toán", PENDING: "Chờ thanh toán", REFUNDED: "Đã hoàn tiền", CANCELLED: "Đã hủy",
};

export const MembersPage: React.FC = () => {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<SearchMember | null>(null);
  const [routeLoading, setRouteLoading] = useState(Boolean(memberId));
  const [routeError, setRouteError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("OVERVIEW");
  const [profile, setProfile] = useState<MemberDetail | null>(null);
  const [subscriptions, setSubscriptions] = useState<PosSubscription[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [invoices, setInvoices] = useState<MemberInvoice[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [attendancesLoading, setAttendancesLoading] = useState(false);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);
  const [attendancesError, setAttendancesError] = useState<string | null>(null);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);
  const [statusTarget, setStatusTarget] = useState<PosSubscription | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const requestVersionRef = useRef(0);
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!memberId) {
      setRouteLoading(false);
      setRouteError(null);
      return;
    }
    let active = true;
    setRouteLoading(true);
    setRouteError(null);
    getMemberDetail(memberId).then((member) => {
      if (!active) return;
      selectedIdRef.current = member.id;
      setSelected(member);
    }).catch((cause) => {
      if (!active) return;
      setRouteError(memberError(cause, "Không mở được hồ sơ hội viên theo đường dẫn."));
    }).finally(() => {
      if (active) setRouteLoading(false);
    });
    return () => { active = false; };
  }, [memberId]);

  useEffect(() => {
    const id = selected?.id;
    if (!id) {
      setProfile(null);
      setSubscriptions([]);
      setAttendances([]);
      setInvoices([]);
      setProfileLoading(false);
      setSubscriptionsLoading(false);
      setAttendancesLoading(false);
      setInvoicesLoading(false);
      setProfileError(null);
      setSubscriptionsError(null);
      setAttendancesError(null);
      setInvoicesError(null);
      return;
    }
    const version = requestVersionRef.current;
    let active = true;
    setProfileLoading(true);
    setSubscriptionsLoading(true);
    setAttendancesLoading(true);
    setInvoicesLoading(true);
    setProfileError(null);
    setSubscriptionsError(null);
    setAttendancesError(null);
    setInvoicesError(null);

    getMemberDetail(id).then((result) => {
      if (active && version === requestVersionRef.current) setProfile(result);
    }).catch((cause) => {
      if (active && version === requestVersionRef.current) setProfileError(memberError(cause, "Không tải được thông tin cá nhân."));
    }).finally(() => {
      if (active && version === requestVersionRef.current) setProfileLoading(false);
    });

    getMemberSubscriptions(id).then((result) => {
      if (active && version === requestVersionRef.current) setSubscriptions(result);
    }).catch((cause) => {
      if (active && version === requestVersionRef.current) setSubscriptionsError(memberError(cause, "Không tải được danh sách gói cước."));
    }).finally(() => {
      if (active && version === requestVersionRef.current) setSubscriptionsLoading(false);
    });

    getMemberHistory(id).then((result) => {
      if (active && version === requestVersionRef.current) setAttendances(result);
    }).catch((cause) => {
      if (active && version === requestVersionRef.current) setAttendancesError(memberError(cause, "Không tải được lịch sử điểm danh."));
    }).finally(() => {
      if (active && version === requestVersionRef.current) setAttendancesLoading(false);
    });

    getRecentMemberInvoices(id).then((result) => {
      if (active && version === requestVersionRef.current) setInvoices(result);
    }).catch((cause) => {
      if (active && version === requestVersionRef.current) setInvoicesError(memberError(cause, "Không tải được lịch sử hóa đơn."));
    }).finally(() => {
      if (active && version === requestVersionRef.current) setInvoicesLoading(false);
    });

    return () => { active = false; };
  }, [selected?.id, refreshKey]);

  const chooseMember = (member: SearchMember | null) => {
    requestVersionRef.current += 1;
    selectedIdRef.current = member?.id ?? null;
    setProfile(null);
    setSubscriptions([]);
    setAttendances([]);
    setInvoices([]);
    setProfileError(null);
    setSubscriptionsError(null);
    setAttendancesError(null);
    setInvoicesError(null);
    setProfileLoading(Boolean(member));
    setSubscriptionsLoading(Boolean(member));
    setAttendancesLoading(Boolean(member));
    setInvoicesLoading(Boolean(member));
    setSelected(member);
    setRefreshKey((current) => current + 1);
    setTab("OVERVIEW");
    setNotice(null);
    setEditing(false);
    setStatusTarget(null);
    setRouteError(null);
    setRouteLoading(false);
    navigate(member ? `/portal/desk/members/${encodeURIComponent(member.id)}` : "/portal/desk/members");
  };
  const refresh = () => {
    requestVersionRef.current += 1;
    setRefreshKey((current) => current + 1);
  };
  const onProfileSaved = (updated: MemberDetail) => {
    setEditing(false);
    setSelected(updated);
    setProfile(updated);
    setNotice("Đã cập nhật hồ sơ hội viên.");
    refresh();
  };
  const onStatusSaved = () => {
    setStatusTarget(null);
    setNotice("Đã cập nhật trạng thái gói tập.");
    refresh();
  };
  const currentSubscriptions = subscriptions.filter((item) => item.status === "ACTIVE" || item.status === "FROZEN");

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
            Tra cứu hội viên
          </h1>
          <p className="text-xs text-white mt-0.5">Hồ sơ cá nhân, lịch sử tập luyện, gói cước và chỉ số InBody</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="mint"
            onClick={() => setCreatingMember(true)}
            className="text-xs font-bold gap-1.5 shadow-sm"
          >
            <UserPlus className="h-4 w-4" />
            <span>Đăng ký hội viên mới</span>
          </Button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#17664e] border border-emerald-200/70">
            Hồ sơ & Lịch sử
          </span>
        </div>
      </div>

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border-l-4 border-[#17664e] bg-white p-4 shadow-xs text-sm">
          <span className="font-medium text-slate-800">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} title="Đóng thông báo" aria-label="Đóng thông báo" className="text-xs font-bold text-[#17664e] hover:underline">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs lg:sticky lg:top-5">
          <div className="mb-4 flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Hội viên</span>
            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => setCreatingMember(true)}
              className="h-8 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1 shadow-none"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Đăng ký mới</span>
            </Button>
          </div>
          <PosMemberSearch selected={selected} onSelect={chooseMember} disabled={editing || Boolean(statusTarget)} placeholder="SĐT, họ tên hoặc email" inputMode="text" minimumLength={2} resultsClassName="max-h-[60vh]" showEmail />
        </aside>

        <div className="min-w-0 rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          {!selected ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 px-5 text-center text-sm text-slate-400">
              <UsersRound className="h-10 w-10 text-slate-300" />
              <p role={routeError ? "alert" : "status"} className="font-medium">
                {routeError ?? (routeLoading ? "Đang mở hồ sơ hội viên..." : "Chưa chọn hội viên.")}
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-7">
                <div className="flex min-w-0 items-center gap-4">
                  {profile?.avatarUrl || selected.avatarUrl ? (
                    <img src={profile?.avatarUrl || selected.avatarUrl || ""} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[#17664e]">
                      <UserRound className="h-6 w-6" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="break-words text-lg font-bold text-slate-900">{profile?.fullName || selected.fullName}</h2>
                    <p className="mt-1 text-sm text-slate-500">{profile?.phone || selected.phone || "Chưa có SĐT"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="icon" title="Tải lại hồ sơ" aria-label="Tải lại hồ sơ" onClick={refresh} className="rounded-xl">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="mint" disabled={!profile || profileLoading} onClick={() => setEditing(true)} className="rounded-xl">
                    <Pencil className="h-4 w-4" />
                    <span>Cập nhật</span>
                  </Button>
                </div>
              </div>
              <div role="tablist" aria-label="Thông tin hội viên" className="flex overflow-x-auto border-b border-slate-100 px-5 text-sm sm:px-7">
                {([["OVERVIEW", "Tổng quan", UserRound], ["ATTENDANCE", "Điểm danh", CalendarDays], ["INVOICES", "Hóa đơn", CreditCard], ["INBODY", "InBody", ScanLine]] as const).map(([value, label, Icon]) => (
                  <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-bold transition-colors ${tab === value ? "border-[#17664e] text-[#17664e]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="p-5 sm:p-7">
                {tab === "INBODY" && <InbodyPanel key={selected.id} memberId={selected.id} memberName={profile?.fullName || selected.fullName} />}
                {tab === "OVERVIEW" && (
                  <div className="space-y-7">
                    <section aria-labelledby="member-profile-title">
                      <h3 id="member-profile-title" className="text-sm font-bold text-slate-900">Thông tin hội viên</h3>
                      {profileLoading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" /> : profileError ? <p role="alert" className="mt-4 text-sm text-rose-600">{profileError}</p> : profile ? (
                        <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                          <div><dt className="text-slate-500">Email</dt><dd className="mt-1 break-all font-semibold text-slate-900">{profile.email}</dd></div>
                          <div><dt className="text-slate-500">Mã hội viên</dt><dd className="mt-1 break-all font-mono text-xs text-slate-600">{profile.id}</dd></div>
                          <div><dt className="text-slate-500">Mục tiêu tập luyện</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{profile.memberProfile?.fitnessGoals || "Chưa có"}</dd></div>
                          <div><dt className="text-slate-500">Tiền sử sức khỏe</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-800">{profile.memberProfile?.medicalHistory || "Chưa có"}</dd></div>
                        </dl>
                      ) : null}
                    </section>
                    <section aria-labelledby="member-subscriptions-title" className="border-t border-slate-100 pt-6">
                      <div className="flex items-center justify-between gap-3">
                        <h3 id="member-subscriptions-title" className="text-sm font-bold text-slate-900">Gói tập</h3>
                        <span className="text-xs text-slate-500">{currentSubscriptions.length} gói đang hoạt động / đóng băng</span>
                      </div>
                      {subscriptionsLoading ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" /> : subscriptionsError ? <p role="alert" className="mt-4 text-sm text-rose-600">{subscriptionsError}</p> : !subscriptions.length ? <p className="mt-4 text-sm text-slate-500">Chưa có gói tập.</p> : (
                        <div className="mt-4 divide-y divide-slate-100 border-y border-slate-100">
                          {subscriptions.map((sub) => (
                            <div key={sub.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong className="text-sm text-slate-900">{sub.plan.name}</strong>
                                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${sub.status === "ACTIVE" ? "bg-emerald-50 text-[#17664e] border border-emerald-200/70" : sub.status === "FROZEN" ? "bg-amber-50 text-amber-800 border border-amber-200/70" : "bg-slate-100 text-slate-500"}`}>{statusText[sub.status] ?? sub.status}</span>
                                </div>
                                <p className="mt-2 text-xs text-slate-500">{formatDate(sub.startDate)} – {formatDate(sub.endDate)}{sub.assignedCoach ? ` · HLV ${sub.assignedCoach.fullName}` : ""}</p>
                                <div className="mt-3 flex flex-wrap gap-5 text-sm font-medium"><span>Nhóm: <strong>{sub.remainingGroupSessions ?? 0}</strong></span><span>PT: <strong>{sub.remainingPtSessions ?? 0}</strong></span></div>
                              </div>
                              {(sub.status === "ACTIVE" || sub.status === "FROZEN") && <Button type="button" size="sm" variant="outline" onClick={() => setStatusTarget(sub)} className="rounded-xl">{sub.status === "ACTIVE" ? "Đóng băng" : "Kích hoạt"}</Button>}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  </div>
                )}
                {tab === "ATTENDANCE" && (
                  <section aria-labelledby="attendance-title">
                    <h3 id="attendance-title" className="text-sm font-bold text-slate-900">Lịch sử điểm danh</h3>
                    <p className="mt-1 text-xs text-slate-500">Tối đa 200 lượt gần nhất.</p>
                    {attendancesLoading ? <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100" /> : attendancesError ? <p role="alert" className="mt-5 text-sm text-rose-600">{attendancesError}</p> : !attendances.length ? <p className="mt-5 py-8 text-center text-sm text-slate-500">Chưa có lượt điểm danh.</p> : (
                      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[530px] text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs font-bold text-slate-500"><th className="pb-3">Thời gian</th><th className="pb-3">Loại</th><th className="pb-3">Trạng thái</th><th className="pb-3">Khăn</th></tr></thead><tbody className="divide-y divide-slate-100">{attendances.map((row) => <tr key={row.id} className="text-slate-800"><td className="py-3 font-medium">{formatDateTime(row.checkInTime)}</td><td className="py-3">{row.checkinType === "GATE_ENTRY" ? "Quẹt cổng" : "Buổi học"}</td><td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.status === "PRESENT" ? "bg-emerald-50 text-[#17664e]" : "bg-slate-100 text-slate-600"}`}>{statusText[row.status] ?? row.status}</span></td><td className="py-3">{row.towelIssued ? "Có" : "Không"}</td></tr>)}</tbody></table></div>
                    )}
                  </section>
                )}
                {tab === "INVOICES" && (
                  <section aria-labelledby="invoices-title">
                    <h3 id="invoices-title" className="text-sm font-bold text-slate-900">Hóa đơn gần đây</h3>
                    <p className="mt-1 text-xs text-slate-500">Trong 200 hóa đơn mới nhất của trung tâm.</p>
                    {invoicesLoading ? <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100" /> : invoicesError ? <p role="alert" className="mt-5 text-sm text-rose-600">{invoicesError}</p> : !invoices.length ? <p className="mt-5 py-8 text-center text-sm text-slate-500">Không có hóa đơn trong dữ liệu gần đây.</p> : (
                      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs font-bold text-slate-500"><th className="pb-3">Mã hóa đơn</th><th className="pb-3">Ngày</th><th className="pb-3">Số tiền</th><th className="pb-3">Thanh toán</th><th className="pb-3">Trạng thái</th></tr></thead><tbody className="divide-y divide-slate-100">{invoices.map((invoice) => <tr key={invoice.id} className="text-slate-800"><td className="py-3 font-mono text-xs text-slate-600">{invoice.invoiceCode}</td><td className="py-3">{formatDateTime(invoice.createdAt)}</td><td className="py-3 font-bold text-slate-900">{formatVnd(invoice.amount)}</td><td className="py-3">{paymentText[invoice.paymentMethod] ?? invoice.paymentMethod}</td><td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${invoice.status === "PAID" ? "bg-emerald-50 text-[#17664e]" : "bg-slate-100 text-slate-600"}`}>{invoiceStatusText[invoice.status] ?? invoice.status}</span></td></tr>)}</tbody></table></div>
                    )}
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {editing && profile && <EditMemberModal member={profile} onClose={() => setEditing(false)} onSaved={onProfileSaved} />}
      {statusTarget && <SubscriptionStatusModal subscription={statusTarget} onClose={() => setStatusTarget(null)} onSaved={onStatusSaved} />}
      {creatingMember && (
        <CreateMemberModal
          onClose={() => setCreatingMember(false)}
          onCreated={(newMember) => {
            setCreatingMember(false);
            chooseMember(newMember);
            setNotice(`Đăng ký thành công hội viên mới: ${newMember.fullName} (${newMember.email})`);
          }}
        />
      )}
    </div>
  );
};
