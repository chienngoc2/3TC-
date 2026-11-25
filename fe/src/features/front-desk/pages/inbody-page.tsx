import React, { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams, useLocation } from "react-router";
import { ArrowLeft, UserRound } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { coachPortalApi } from "@/features/coach-portal/api/coach-portal-api";
import { InbodyPanel } from "../components/inbody-panel";
import { PosMemberSearch } from "../components/pos-member-search";
import { getMemberDetail } from "../services/member-management.service";
import type { SearchMember } from "../types/gate-checkin.types";

export const InbodyPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const paramMemberId = searchParams.get("memberId");

  const isCoach = user?.role === "COACH";
  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';
  const [selected, setSelected] = useState<SearchMember | null>(null);

  useEffect(() => {
    if (!paramMemberId) return;
    const cleanId = paramMemberId.trim();
    if (!cleanId) return;
    let active = true;
    getMemberDetail(cleanId)
      .then((member) => {
        if (active && member && (member.role === "MEMBER" || !member.role)) {
          setSelected(member);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [paramMemberId]);

  const handleCoachSearch = useCallback(async (query: string): Promise<SearchMember[]> => {
    const q = query.trim();
    const qLower = q.toLowerCase();

    // 1. Nếu query có định dạng UUID thì thử tra cứu chi tiết thành viên trước
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q)) {
      try {
        const direct = await getMemberDetail(q);
        if (direct && (direct.role === "MEMBER" || !direct.role)) {
          return [
            {
              id: direct.id,
              fullName: direct.fullName || "Hội viên",
              phone: direct.phone || null,
              email: direct.email || "",
              avatarUrl: direct.avatarUrl || null,
              isActive: direct.isActive ?? true,
            },
          ];
        }
      } catch {
        // Tiếp tục tìm theo danh sách học viên
      }
    }

    // 2. Tra cứu học viên được phân công / đặt lịch của HLV
    try {
      const assigned = await coachPortalApi.getAssignedMembers(q);
      const seenIds = new Set<string>();
      const results: SearchMember[] = [];

      assigned.forEach((item) => {
        const u = item.user;
        const memberId = u?.id || item.id;
        if (!memberId || seenIds.has(memberId)) return;

        const fullName = u?.fullName || "Hội viên";
        const phone = u?.phone || "";
        const email = u?.email || "";

        if (
          !q ||
          fullName.toLowerCase().includes(qLower) ||
          phone.toLowerCase().includes(qLower) ||
          email.toLowerCase().includes(qLower) ||
          memberId.toLowerCase().includes(qLower)
        ) {
          seenIds.add(memberId);
          results.push({
            id: memberId,
            fullName,
            phone: phone || null,
            email,
            avatarUrl: u?.avatarUrl || null,
            isActive: true,
          });
        }
      });

      return results;
    } catch {
      return [];
    }
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to={isCoach ? `${coachBasePath}/schedule` : "/portal/desk"}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17664e] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> {isCoach ? "Lịch HLV" : "Bàn lễ tân"}
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
            Chỉ số InBody hội viên
          </h1>
          <p className="text-xs text-white mt-0.5">
            Theo dõi tiến trình cơ - mỡ, khối lượng cơ xương và lịch sử đo định kỳ
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#17664e] border border-emerald-200/70 self-start sm:self-auto">
          {isCoach ? "Huấn luyện viên" : "Bàn lễ tân"}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs lg:sticky lg:top-5">
          <PosMemberSearch
            selected={selected}
            onSelect={setSelected}
            disabled={false}
            placeholder="SĐT, họ tên"
            inputMode="text"
            minimumLength={isCoach ? 0 : 2}
            resultsClassName="max-h-[60vh]"
            showEmail
            searchFn={isCoach ? handleCoachSearch : undefined}
          />
        </aside>

        <div className="min-w-0 rounded-2xl md:rounded-3xl border border-slate-200/90 bg-white p-5 shadow-xs sm:p-7">
          {selected ? (
            <>
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">{selected.fullName}</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.phone || selected.email}</p>
              </div>
              <InbodyPanel key={selected.id} memberId={selected.id} memberName={selected.fullName} />
            </>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center text-sm text-slate-400">
              <UserRound className="h-10 w-10 text-slate-300" />
              <p className="font-medium">Chọn hội viên để xem và nhập chỉ số InBody.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
