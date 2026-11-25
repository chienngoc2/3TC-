import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { AlertTriangle, ReceiptText, RefreshCw, ScanLine, UsersRound, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/context/notification-context";
import { CancellationModal } from "../components/cancellation-modal";
import { OnBehalfCancellationModal } from "../components/on-behalf-cancellation-modal";
import {
  getLockerZones,
  getUpcomingClasses,
  LockerAvailability,
  PendingCancellations,
  RecentCheckins,
  UpcomingClasses,
} from "../components/dashboard-sections";
import { formatDateTime, isTodayInVietnam } from "../lib/date-time";
import {
  getCancellationRequests,
  getLockers,
  getMemberAttendances,
  getSchedules,
  getUser,
  releaseLocker,
} from "../services/front-desk-api.service";
import type {
  CancellationRequest,
  CancellationReviewResponse,
  CheckinRow,
  GateCheckinEvent,
  Locker,
  Schedule,
} from "../types/front-desk.types";

const getLoadError = (section: string): string => `Không thể tải ${section}. Vui lòng thử lại.`;

export const FrontDeskPage: React.FC = () => {
  const { isConnected } = useNotification();
  const [now, setNow] = useState(() => new Date());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [checkins, setCheckins] = useState<CheckinRow[]>([]);
  const [selected, setSelected] = useState<CancellationRequest | null>(null);
  const [isOnBehalfOpen, setIsOnBehalfOpen] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [lockerLoading, setLockerLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [lockerError, setLockerError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const seenRequests = useRef(new Set<string>());
  const seenCheckins = useRef(new Set<string>());
  const audioContext = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);

  const loadSchedules = useCallback(async () => {
    try {
      setSchedules(await getSchedules());
      setScheduleError(null);
    } catch {
      setScheduleError(getLoadError("lịch lớp học"));
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const loadLockers = useCallback(async () => {
    try {
      setLockers(await getLockers());
      setLockerError(null);
    } catch {
      setLockerError(getLoadError("danh sách tủ đồ"));
    } finally {
      setLockerLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const pending = (await getCancellationRequests()).filter((item) => item.status === "PENDING");
      setRequests(pending);
      setRequestsError(null);
    } catch {
      setRequestsError(getLoadError("yêu cầu hủy ca"));
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    void loadSchedules();
    void loadLockers();
    void loadRequests();
  }, [loadSchedules, loadLockers, loadRequests]);

  const playAlert = useCallback(() => {
    const context = audioContext.current;
    if (!soundEnabledRef.current || !context || context.state !== "running") return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 740;
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.34);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.35);
    } catch {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
    }
  }, []);

  const toggleSound = async () => {
    if (soundEnabledRef.current) {
      soundEnabledRef.current = false;
      setSoundEnabled(false);
      return;
    }
    try {
      const context = audioContext.current ?? new AudioContext();
      audioContext.current = context;
      await context.resume();
      soundEnabledRef.current = context.state === "running";
      setSoundEnabled(soundEnabledRef.current);
      if (!soundEnabledRef.current) setNotice("Trình duyệt đang chặn âm báo. Hãy thử bật lại.");
    } catch {
      setNotice("Không thể bật âm báo trên trình duyệt này.");
    }
  };

  const handleGateCheckin = useCallback(async (event: GateCheckinEvent) => {
    if (!event.attendanceId || !event.memberId || seenCheckins.current.has(event.attendanceId)) return;
    seenCheckins.current.add(event.attendanceId);
    const [userResult, attendanceResult] = await Promise.allSettled([
      getUser(event.memberId),
      getMemberAttendances(event.memberId),
    ]);
    const attendance = attendanceResult.status === "fulfilled"
      ? attendanceResult.value.find((item) => item.id === event.attendanceId && item.checkinType === "GATE_ENTRY")
      : null;
    if (!attendance) {
      seenCheckins.current.delete(event.attendanceId);
      setCheckinError("Có lượt quẹt cổng mới nhưng chưa tải được chi tiết điểm danh.");
      return;
    }
    if (!isTodayInVietnam(attendance.checkInTime)) return;
    setCheckinError(null);
    setCheckins((current) => {
      if (current.some((row) => row.id === event.attendanceId)) return current;
      return [{
        id: event.attendanceId,
        memberName: userResult.status === "fulfilled" ? userResult.value.fullName : null,
        checkInTime: attendance.checkInTime,
        lockerNumber: event.lockerNumber ?? null,
      }, ...current];
    });
    void loadLockers();
  }, [loadLockers]);

  useEffect(() => {
    refresh();
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    const poll = window.setInterval(refresh, 60_000);
    return () => { window.clearInterval(clock); window.clearInterval(poll); };
  }, [refresh]);

  const handleReleaseLocker = async (lockerId: string) => {
    try {
      await releaseLocker(lockerId);
      setNotice("Đã hoàn tất trả tủ hộ hội viên thành công.");
      await loadLockers();
    } catch {
      setNotice("Không thể trả tủ hộ. Vui lòng thử lại.");
    }
  };

  useEffect(() => {
    const handleRealtimeEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ type: string; data: Record<string, unknown> }>;
      const { type, data } = customEvent.detail || {};

      if (type === "gate.checked-in") {
        void handleGateCheckin(data as unknown as GateCheckinEvent);
      } else if (type === "cancellation.requested") {
        const request = data as unknown as CancellationRequest;
        if (!request?.id || request.status !== "PENDING") return;
        setRequests((current) => [request, ...current.filter((item) => item.id !== request.id)]);
        if (!seenRequests.current.has(request.id)) {
          seenRequests.current.add(request.id);
          setSelected((current) => current ?? request);
          playAlert();
        }
        void loadRequests();
      } else if (type === "cancellation.reviewed") {
        const request = data as unknown as CancellationRequest;
        if (!request?.id) return;
        setRequests((current) => current.filter((item) => item.id !== request.id));
        setSelected((current) => (current?.id === request.id ? null : current));
        void loadRequests();
      } else if (type === "schedule.updated") {
        void loadSchedules();
      } else if (type === "locker.changed") {
        void loadLockers();
      }
    };

    window.addEventListener("app:realtime-event", handleRealtimeEvent);
    return () => {
      window.removeEventListener("app:realtime-event", handleRealtimeEvent);
    };
  }, [handleGateCheckin, loadRequests, loadSchedules, loadLockers, playAlert]);

  useEffect(() => () => { void audioContext.current?.close(); }, []);

  const handleReviewed = (result: CancellationReviewResponse) => {
    setRequests((current) => current.filter((item) => item.id !== result.requestId));
    setSelected(null);
    setNotice(result.status === "APPROVED" ? "Đã phê duyệt yêu cầu hủy ca." : "Đã từ chối yêu cầu hủy ca.");
    refresh();
  };

  const closeModal = useCallback(() => setSelected(null), []);

  const availableLockers = getLockerZones(lockers).reduce((sum, [, count]) => sum + count.available, 0);
  const checkinsToday = checkins.filter((row) => row.checkInTime && isTodayInVietnam(row.checkInTime, now));

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#17664e]">SPORTS CENTER / LỄ TÂN</p>
          <h1 className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-white">Bàn làm việc lễ tân</h1>
          <p className="mt-1 text-xs text-white">{formatDateTime(now.toISOString())}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/portal/desk/gate-checkin" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-[#17664e] px-3.5 text-xs font-bold text-white shadow-xs hover:bg-[#135641] transition-colors"><ScanLine className="h-4 w-4" />Check-in cổng</Link>
          <Link to="/portal/desk/pos" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"><ReceiptText className="h-4 w-4" />Bán vé & PT</Link>
          <Link to="/portal/desk/members" className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 transition-colors"><UsersRound className="h-4 w-4" />Hội viên</Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOnBehalfOpen(true)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 shadow-xs hover:bg-rose-100 hover:text-rose-900 transition-colors"
          >
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            <span>Nộp đơn hủy thay HLV</span>
          </Button>
          <span className={`rounded-xl px-2.5 py-1 text-xs font-semibold ${isConnected ? "bg-emerald-50 text-[#17664e] border border-emerald-200/70" : "bg-amber-50 text-amber-800 border border-amber-200/70"}`}>{isConnected ? "Realtime đang hoạt động" : "Mất kết nối realtime"}</span>
          <Button type="button" variant="outline" onClick={() => void toggleSound()} title={soundEnabled ? "Tắt âm báo" : "Bật âm báo"} aria-label={soundEnabled ? "Tắt âm báo" : "Bật âm báo"} className="h-9 w-9 p-0 rounded-xl border-slate-200">{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>
          <Button type="button" variant="outline" onClick={refresh} title="Tải lại dữ liệu" aria-label="Tải lại dữ liệu" className="h-9 w-9 p-0 rounded-xl border-slate-200"><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="space-y-6">
        {notice && <div role="status" className="flex items-center justify-between gap-3 rounded-2xl border-l-4 border-[#17664e] bg-white p-4 text-sm shadow-xs"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} className="text-xs font-bold text-[#17664e] hover:underline">Đóng</button></div>}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs"><p className="text-xs font-semibold text-slate-500">Quẹt cổng trong phiên</p><p className="mt-1.5 text-2xl font-black text-slate-900">{checkinsToday.length}</p></div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs"><p className="text-xs font-semibold text-slate-500">Lớp sắp bắt đầu</p><p className="mt-1.5 text-2xl font-black text-slate-900">{scheduleLoading || scheduleError ? "—" : getUpcomingClasses(schedules, now).length}</p></div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs"><p className="text-xs font-semibold text-slate-500">Tủ còn trống</p><p className="mt-1.5 text-2xl font-black text-slate-900">{lockerLoading || lockerError ? "—" : availableLockers}</p></div>
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs"><p className="text-xs font-semibold text-slate-500">Hủy ca chờ xử lý</p><p className="mt-1.5 text-2xl font-black text-rose-600">{requestsLoading || requestsError ? "—" : requests.length}</p></div>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <RecentCheckins rows={checkins} now={now} loading={!isConnected} error={checkinError ?? (!isConnected ? "Mất kết nối realtime. Các lượt mới sẽ hiển thị khi kết nối lại." : null)} />
          <UpcomingClasses schedules={schedules} now={now} loading={scheduleLoading} error={scheduleError} />
          <LockerAvailability lockers={lockers} loading={lockerLoading} error={lockerError} onRelease={handleReleaseLocker} />
          <PendingCancellations requests={requests} loading={requestsLoading} error={requestsError} onOpen={setSelected} />
        </div>
      </div>
      {selected && <CancellationModal request={selected} onClose={closeModal} onReviewed={handleReviewed} onStale={() => void loadRequests()} />}
      {isOnBehalfOpen && (
        <OnBehalfCancellationModal
          onClose={() => setIsOnBehalfOpen(false)}
          onCreated={(newReq) => {
            setIsOnBehalfOpen(false);
            setNotice(
              `Đã nộp đơn hủy ca khẩn cấp thay HLV thành công (Mã: #${newReq.id.slice(0, 8)}). Đơn đang chờ quản lý phê duyệt.`
            );
            void loadRequests();
          }}
        />
      )}
    </div>
  );
};
