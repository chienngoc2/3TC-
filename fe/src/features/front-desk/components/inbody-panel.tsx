import React, { useEffect, useState } from "react";
import { Activity, Pencil, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { formatDateTime } from "../lib/date-time";
import { memberError } from "../lib/member-error";
import { getMemberInbodyLogs } from "../services/inbody.service";
import type { InbodyLog } from "../types/inbody.types";
import { InbodyModal } from "./inbody-modal";

const numberText = (value: number | string | null | undefined, unit = ""): string =>
  value === null || value === undefined ? "—" : `${Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 2 })}${unit}`;

export const InbodyPanel: React.FC<{ memberId: string; memberName: string }> = ({ memberId, memberName }) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<InbodyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState<"create" | InbodyLog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getMemberInbodyLogs(memberId).then((items) => {
      if (active) setLogs([...items].sort((a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()));
    }).catch((cause) => {
      if (active) { setLogs([]); setError(memberError(cause, "Không tải được lịch sử InBody.")); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [memberId, refreshKey]);

  const saved = () => {
    setModal(null);
    setNotice("Đã lưu phiếu InBody.");
    setRefreshKey((value) => value + 1);
  };
  const latest = logs[0];
  const canEdit = (log: InbodyLog) => (log.measuredById === user?.id || user?.role === "CENTER_MANAGER") &&
    Date.now() - new Date(log.measuredAt).getTime() <= 86400000;

  return <section aria-labelledby="inbody-title" className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h3 id="inbody-title" className="flex items-center gap-2 text-base font-semibold"><Activity className="h-5 w-5 text-[#17664e]" />Chỉ số InBody</h3><p className="mt-1 text-xs text-[#61756f]">Lịch sử tối đa 100 phiếu do hệ thống trả về.</p></div>
      <div className="flex items-center gap-2"><Button type="button" size="icon" variant="outline" title="Tải lại lịch sử" aria-label="Tải lại lịch sử" onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw className="h-4 w-4" /></Button><Button type="button" variant="mint" onClick={() => setModal("create")}><Plus className="h-4 w-4" />Nhập InBody</Button></div>
    </div>
    {notice && <p role="status" className="border-l-2 border-[#17664e] bg-[#eef8f3] px-3 py-2 text-sm text-[#176a59]">{notice}</p>}
    {loading ? <div className="h-32 animate-pulse rounded-md bg-[#edf5f0]" aria-label="Đang tải lịch sử InBody" /> : error ? <p role="alert" className="rounded-md border border-[#f1d4cf] bg-[#fff6f4] p-4 text-sm text-[#ae3b2d]">{error}</p> : !logs.length ? <div className="flex min-h-40 flex-col items-center justify-center gap-3 border-y border-[#e3eee7] text-center text-sm text-[#71867b]"><Activity className="h-7 w-7" /><p>Hội viên chưa có phiếu đo InBody.</p></div> : <>
      <div className="grid grid-cols-2 gap-3 border-y border-[#e3eee7] py-4 sm:grid-cols-4">
        {[{ label: "Cân nặng", value: numberText(latest.weightKg, " kg") }, { label: "Khối lượng cơ", value: numberText(latest.muscleMassKg, " kg") }, { label: "Mỡ cơ thể", value: numberText(latest.bodyFatPct, "%") }, { label: "BMI", value: numberText(latest.bmi) }].map((item) => <div key={item.label} className="min-w-0"><p className="text-xs text-[#61756f]">{item.label}</p><p className="mt-1 text-lg font-semibold text-[#172b28]">{item.value}</p></div>)}
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm">
        <thead><tr className="border-b border-[#dce8e2] text-xs text-[#61756f]"><th className="pb-3 font-semibold">Ngày đo</th><th className="pb-3 font-semibold">Chiều cao</th><th className="pb-3 font-semibold">Cân nặng</th><th className="pb-3 font-semibold">Cơ</th><th className="pb-3 font-semibold">Mỡ</th><th className="pb-3 font-semibold">BMI</th><th className="pb-3 font-semibold">Mỡ nội tạng</th><th className="pb-3 text-right font-semibold">Thao tác</th></tr></thead>
        <tbody>{logs.map((log) => <React.Fragment key={log.id}><tr className="border-b border-[#edf3ef]"><td className="py-3 font-medium">{formatDateTime(log.measuredAt)}</td><td className="py-3">{numberText(log.heightCm, " cm")}</td><td className="py-3">{numberText(log.weightKg, " kg")}</td><td className="py-3">{numberText(log.muscleMassKg, " kg")}</td><td className="py-3">{numberText(log.bodyFatPct, "%")}</td><td className="py-3">{numberText(log.bmi)}</td><td className="py-3">{numberText(log.visceralFatLevel)}</td><td className="py-3 text-right">{canEdit(log) && <Button type="button" variant="ghost" size="sm" onClick={() => setModal(log)} title="Chỉnh sửa phiếu đo"><Pencil className="h-4 w-4" />Sửa</Button>}</td></tr>{log.notes && <tr className="border-b border-[#edf3ef] bg-[#f8faf9]"><td colSpan={8} className="pb-3 pt-2 text-xs text-[#526c61]"><span className="font-semibold">Lời dặn: </span><span className="whitespace-pre-wrap">{log.notes}</span></td></tr>}</React.Fragment>)}</tbody>
      </table></div>
    </>}
    {modal && <InbodyModal memberId={memberId} memberName={memberName} log={modal === "create" ? undefined : modal} onClose={() => setModal(null)} onSaved={saved} />}
  </section>;
};
