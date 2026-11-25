import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Clock,
  RotateCw,
  UserCheck,
  ShieldCheck,
  Award,
  Phone,
  Search,
  CheckCircle2,
  AlertCircle,
  Radio,
  X,
  Eye,
  EyeOff,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiOrigin, readTokens } from "@/lib/api";
import { useNotification } from "@/context/notification-context";
import { getSessionQr, getLiveFeed, manualPinCheckin } from "../services/gate-checkin.service";
import type { LiveCheckinItem } from "../types/gate-checkin.types";

const QR_REFRESH_INTERVAL = 180; // 3 minutes (180 seconds)

export const GateCheckinPage: React.FC = () => {
  const { showToast } = useNotification();

  // QR Code State
  const [qrToken, setQrToken] = useState<string>("");
  const [secondsLeft, setSecondsLeft] = useState<number>(QR_REFRESH_INTERVAL);
  const [qrLoading, setQrLoading] = useState<boolean>(true);
  const [qrError, setQrError] = useState<string | null>(null);

  // Live Feed State
  const [liveFeed, setLiveFeed] = useState<LiveCheckinItem[]>([]);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  // Manual PIN checkin fallback state (for members who forgot their phone)
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualPhone, setManualPhone] = useState("");
  const [manualPin, setManualPin] = useState("");
  const [manualTowel, setManualTowel] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [manualSuccessMsg, setManualSuccessMsg] = useState<string | null>(null);
  const [manualErrorMsg, setManualErrorMsg] = useState<string | null>(null);
  const [checkinDetail, setCheckinDetail] = useState<any | null>(null);

  // Digital clock
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch new QR Code
  const fetchNewQr = useCallback(async () => {
    try {
      setQrLoading(true);
      setQrError(null);
      const res = await getSessionQr();
      setQrToken(res.qrToken);
      setSecondsLeft(res.expiresInSeconds || QR_REFRESH_INTERVAL);
    } catch (err: any) {
      setQrError(err.response?.data?.message || "Không thể tạo mã QR phiên. Vui lòng thử lại.");
    } finally {
      setQrLoading(false);
    }
  }, []);

  // Load initial Live Feed & QR Code, plus lightweight 3s fallback sync when tab is visible
  useEffect(() => {
    fetchNewQr();
  }, [fetchNewQr]);

  useEffect(() => {
    let active = true;
    let initialLoaded = false;

    const syncFeed = async () => {
      try {
        const items = await getLiveFeed();
        if (!active) return;

        setLiveFeed((prev) => {
          if (initialLoaded && items.length > 0) {
            const existingIds = new Set(prev.map((item) => item.attendanceId));
            const newest = items.find((item) => !existingIds.has(item.attendanceId));
            if (newest) {
              setLatestId(newest.attendanceId);
              setTimeout(() => setLatestId(null), 8000);
              showToast({
                type: newest.type,
                fullName: newest.fullName,
                detail:
                  newest.type === "MEMBER"
                    ? newest.planName || "Hội viên CLB"
                    : newest.disciplines?.join(", ") || "Huấn luyện viên",
              });
            }
          }
          initialLoaded = true;
          return items;
        });
      } catch {
        // ignore transient polling errors
      }
    };

    syncFeed();
    const pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncFeed();
      }
    }, 3000);

    return () => {
      active = false;
      clearInterval(pollTimer);
    };
  }, [showToast]);

  // Countdown timer for 60s auto-refresh
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          fetchNewQr();
          return QR_REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [fetchNewQr]);

  // SSE Stream for Real-time Check-in Notifications (reconnects automatically on token refresh)
  const [sseNonce, setSseNonce] = useState(0);
  useEffect(() => {
    const onSessionChanged = () => setSseNonce((n) => n + 1);
    window.addEventListener("session-changed", onSessionChanged);
    return () => window.removeEventListener("session-changed", onSessionChanged);
  }, []);

  useEffect(() => {
    const token = readTokens()?.accessToken || localStorage.getItem("access_token") || "";
    if (!token) {
      setSseConnected(false);
      return;
    }
    const sseUrl = `${apiOrigin()}/api/v1/realtime/sse?token=${encodeURIComponent(token)}`;

    const handleCheckinEvent = (checkinData: LiveCheckinItem) => {
      if (!checkinData?.attendanceId) return;
      setLatestId(checkinData.attendanceId);
      setLiveFeed((prev) => [
        checkinData,
        ...prev.filter((item) => item.attendanceId !== checkinData.attendanceId),
      ].slice(0, 30));

      const whoLabel =
        checkinData.type === "COACH"
          ? `HLV ${checkinData.fullName}`
          : `Hội viên ${checkinData.fullName}`;
      const detailLabel =
        checkinData.planName ||
        checkinData.disciplines?.join(", ") ||
        (checkinData.type === "COACH" ? "Huấn luyện viên" : "Gói tập");

      showToast("success", "Quét mã vào cổng", `${whoLabel} đã qua cổng (${detailLabel})`);

      setTimeout(() => {
        setLatestId((cur) => (cur === checkinData.attendanceId ? null : cur));
      }, 8000);
    };

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.addEventListener("frontdesk.qr-checkin", (e: MessageEvent) => {
        try {
          handleCheckinEvent(JSON.parse(e.data) as LiveCheckinItem);
        } catch {
          // parse error
        }
      });

      eventSource.onerror = () => {
        setSseConnected(false);
      };
    } catch {
      setSseConnected(false);
    }

    const onRelayEvent = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail;
      if (detail?.type === "frontdesk.qr-checkin" && detail?.data) {
        handleCheckinEvent(detail.data as LiveCheckinItem);
      }
    };
    window.addEventListener("app:realtime-event", onRelayEvent);

    return () => {
      window.removeEventListener("app:realtime-event", onRelayEvent);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [showToast, sseNonce]);

  // Manual Check-in Handler using Phone & Security PIN
  const handleManualPinCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = manualPhone.trim();
    const pin = manualPin.trim();

    if (!phone || !pin) {
      const msg = "Vui lòng nhập đầy đủ số điện thoại và mã PIN check-in.";
      setManualErrorMsg(msg);
      showToast("warning", "Thiếu thông tin", msg);
      return;
    }

    try {
      setManualSubmitting(true);
      setManualErrorMsg(null);
      setManualSuccessMsg(null);

      const res: any = await manualPinCheckin({
        phone,
        checkinCode: pin,
        towelIssued: manualTowel,
      });

      setCheckinDetail(res);
      const who = res.type === "COACH" ? `HLV ${res.user?.fullName}` : `Hội viên ${res.user?.fullName}`;
      const successText = `${who} điểm danh vào cổng thành công!`;
      setManualSuccessMsg(successText);
      showToast("success", "Điểm danh thành công", successText);

      // Optimistically prepend to live feed immediately
      const newFeedItem: LiveCheckinItem = {
        attendanceId: res.attendanceId || Date.now().toString(),
        userId: res.user?.id || "",
        type: res.type || "MEMBER",
        fullName: res.user?.fullName || "",
        phone: res.user?.phone || phone,
        avatarUrl: res.user?.avatarUrl || null,
        planName: res.plan?.name || (res.type === "COACH" ? "HLV Thể hình" : "Gói tập"),
        packageTier: res.plan?.packageTier,
        checkinTime: res.checkinTime || new Date().toISOString(),
        remainingSessions: res.plan?.remainingSessions,
        disciplines: res.user?.disciplines,
        ratingStars: res.user?.ratingStars,
      };
      setLiveFeed((prev) => [
        newFeedItem,
        ...prev.filter((item) => item.attendanceId !== newFeedItem.attendanceId),
      ].slice(0, 30));

      // Background non-blocking sync with database
      void getLiveFeed().then((updated) => {
        if (Array.isArray(updated)) setLiveFeed(updated);
      }).catch(() => {});

      setTimeout(() => {
        setShowManualModal(false);
        setManualSuccessMsg(null);
        setManualPhone("");
        setManualPin("");
        setManualTowel(false);
        setCheckinDetail(null);
      }, 2000);
    } catch (err: any) {
      let msg = "Mã PIN check-in bảo mật không chính xác. Vui lòng kiểm tra lại trong hồ sơ cá nhân.";
      const responseData = err.response?.data;
      if (responseData?.message) {
        msg = Array.isArray(responseData.message)
          ? responseData.message.join("; ")
          : String(responseData.message);
      } else if (err.message) {
        msg = String(err.message);
      }
      setManualErrorMsg(msg);
      showToast("error", "Lỗi check-in", msg);
    } finally {
      setManualSubmitting(false);
    }
  };

  const progressPercent = Math.max(0, Math.min(100, (secondsLeft / QR_REFRESH_INTERVAL) * 100));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="border-b border-slate-200/90 bg-white/95 backdrop-blur px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30 shadow-3xs">
        <div className="flex items-center gap-4">
          <Link
            to="/front-desk"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            <span>Quay lại Quầy</span>
          </Link>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#17664e] shrink-0" />
              <span>Cổng check-in lễ tân</span>
            </h1>
            <p className="text-xs text-slate-500 font-normal">
              Mã QR tự động đổi mỗi 3 phút • Học viên & Huấn luyện viên quét mã để qua cổng
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Realtime Status Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-medium text-slate-700">
            <Radio className={`w-3.5 h-3.5 ${sseConnected ? "text-emerald-600" : "text-amber-500"}`} />
            <span>
              {sseConnected ? "Trực tiếp" : "Đang kết nối lại..."}
            </span>
          </div>

          {/* Digital Clock */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-800 font-mono text-xs font-bold tabular-nums">
            {currentTime || "--:--:--"}
          </div>

          {/* Manual Checkin Fallback Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setManualErrorMsg(null);
              setManualSuccessMsg(null);
              setShowManualModal(true);
            }}
            className="border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-3xs cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 mr-1 text-slate-500" />
            <span>Check-in thủ công</span>
          </Button>
        </div>
      </header>

      {/* Main Content: 2 Columns */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        {/* LEFT COLUMN: Dynamic 60s QR Code (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col items-center justify-between relative">
            {/* Header of QR Card */}
            <div className="w-full text-center space-y-1">
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-[11px] font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Mã QR phiên bảo mật</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 pt-1">
                Quét mã bằng ứng dụng 3TC Fitness
              </h2>
              <p className="text-xs text-slate-500 font-normal">
                Hội viên có gói tập còn hạn hoặc HLV có ca dạy quét mã để vào cổng
              </p>
            </div>

            {/* QR Code Stage */}
            <div className="relative my-4 p-4 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-center">
              {qrLoading ? (
                <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-2.5 bg-slate-50 rounded-lg">
                  <RotateCw className="w-6 h-6 text-[#17664e] animate-spin" />
                  <span className="text-xs font-medium text-slate-500">Đang khởi tạo mã QR...</span>
                </div>
              ) : qrError ? (
                <div className="w-[240px] h-[240px] flex flex-col items-center justify-center gap-2.5 bg-rose-50 text-rose-800 p-4 text-center rounded-lg border border-rose-200">
                  <AlertCircle className="w-6 h-6 text-rose-600" />
                  <p className="text-xs font-semibold">{qrError}</p>
                  <Button size="sm" onClick={fetchNewQr} className="bg-rose-600 hover:bg-rose-700 text-white text-xs mt-1">
                    Thử lại
                  </Button>
                </div>
              ) : (
                <QRCodeSVG
                  value={qrToken}
                  size={240}
                  level="H"
                  includeMargin={true}
                  className="rounded-md"
                />
              )}
            </div>

            {/* 60s Progress Bar & Countdown */}
            <div className="w-full space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-normal flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Tự động làm mới sau:</span>
                </span>
                <span className="font-mono text-slate-900 font-bold tabular-nums">
                  {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, "0")} ({secondsLeft}s)
                </span>
              </div>

              {/* Linear Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden border border-slate-200/60">
                <div
                  className="h-full bg-[#17664e] transition-all duration-1000 ease-linear rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-slate-400">
                  Chu kỳ xoay vòng bảo mật: 3 phút (180s)
                </span>
                <button
                  type="button"
                  onClick={fetchNewQr}
                  disabled={qrLoading}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#17664e] hover:text-[#0f4b39] hover:underline cursor-pointer disabled:opacity-50"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${qrLoading ? "animate-spin" : ""}`} />
                  <span>Làm mới ngay</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="p-4 rounded-xl bg-white border border-slate-200/90 text-xs text-slate-600 space-y-2 shadow-xs">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#17664e]" />
              <span>Quy tắc vào cổng tự động:</span>
            </div>
            <ul className="space-y-1.5 text-slate-600 pl-5 list-disc marker:text-slate-400">
              <li>
                <strong className="text-slate-800">Hội viên:</strong> Gói tập trạng thái Hoạt động (Active) còn hạn → Cho phép qua cổng ngay.
              </li>
              <li>
                <strong className="text-slate-800">Huấn luyện viên:</strong> Tự động ghi nhận giờ vào ca dạy theo bộ môn phụ trách.
              </li>
              <li>
                <strong className="text-slate-800">Chống quét trùng:</strong> Hệ thống tự động chặn các lượt quét liên tiếp trong 5 phút.
              </li>
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Check-in Feed (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex-1 flex flex-col min-h-[580px]">
            {/* Header of Feed */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#17664e]" />
                  <span>Lịch sử quét mã hôm nay</span>
                </h3>
                <p className="text-xs text-slate-500 font-normal">
                  Cập nhật thời gian thực khi hội viên hoặc HLV vừa quét mã thành công
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200/70">
                {liveFeed.length} lượt quét
              </span>
            </div>

            {/* List of Live Check-in Cards */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-[580px]">
              {liveFeed.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                  <Clock className="w-8 h-8 stroke-1 text-slate-300" />
                  <div>
                    <p className="font-semibold text-sm text-slate-600">Chưa có lượt quét mã nào hôm nay</p>
                    <p className="text-xs text-slate-400 mt-0.5">Khi học viên hoặc HLV quét mã QR tại quầy, thông tin sẽ xuất hiện ngay tại đây.</p>
                  </div>
                </div>
              ) : (
                liveFeed.map((item) => {
                  const isNew = item.attendanceId === latestId;
                  const isCoach = item.type === "COACH";
                  const formattedTime = new Date(item.checkinTime).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={item.attendanceId}
                      className={`p-3.5 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        isNew
                          ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50 shadow-3xs"
                      }`}
                    >
                      {/* Left: Avatar & Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        {item.avatarUrl ? (
                          <img
                            src={item.avatarUrl}
                            alt={item.fullName}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                              isCoach ? "bg-amber-600" : "bg-[#17664e]"
                            }`}
                          >
                            {item.fullName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-slate-900 truncate max-w-[200px]">
                              {item.fullName}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase ${
                                isCoach
                                  ? "bg-amber-50 text-amber-900 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-900 border border-emerald-200"
                              }`}
                            >
                              {isCoach ? "HLV" : "Hội viên"}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                            {item.phone && (
                              <span className="flex items-center gap-1 font-mono text-slate-600">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {item.phone}
                              </span>
                            )}
                            {isCoach && item.ratingStars && (
                              <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                                ★ {item.ratingStars} sao
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Package or Discipline Details */}
                      <div className="sm:text-right w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 flex sm:flex-col justify-between items-center sm:items-end gap-1">
                        {isCoach ? (
                          <>
                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
                              <Award className="w-3 h-3 text-amber-700" />
                              <span>{item.disciplines?.join(", ") || "Thể hình & Gym"}</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono mt-0.5">
                              Điểm danh lúc: <strong className="text-slate-700 font-bold">{formattedTime}</strong>
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold">
                              <span>{item.planName}</span>
                            </div>

                            <div className="text-[11px] text-slate-500 font-normal space-x-2">
                              {item.endDate && (
                                <span>
                                  Hạn: <strong className="text-slate-700 font-mono">{new Date(item.endDate).toLocaleDateString("vi-VN")}</strong>
                                </span>
                              )}
                              {typeof item.remainingSessions === "number" && item.remainingSessions > 0 && (
                                <span className="text-[#17664e] font-semibold font-mono">
                                  ({item.remainingSessions} buổi)
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">
                              Quét lúc: <strong className="text-slate-700 font-semibold">{formattedTime}</strong>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Manual Check-in Modal Fallback using Phone & Security PIN */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#17664e]" />
                  <span>Check-in thủ công </span>
                </h3>
                <p className="text-xs text-slate-500">
                  Nhập số điện thoại và mã PIN bảo mật do người tập cung cấp
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowManualModal(false);
                  setManualErrorMsg(null);
                  setManualSuccessMsg(null);
                }}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualPinCheckin} className="space-y-3.5">
              {/* Phone Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Số điện thoại người tập
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="tel"
                    placeholder="Ví dụ: 0901234567"
                    value={manualPhone}
                    onChange={(e) => {
                      setManualPhone(e.target.value);
                      if (manualErrorMsg) setManualErrorMsg(null);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:border-[#17664e] focus:ring-1 focus:ring-[#17664e]"
                    required
                  />
                </div>
              </div>

              {/* PIN Code Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Mã PIN bảo mật (4 - 6 số)
                  </label>
                  <span className="text-[11px] text-slate-400">Xem trong Hồ sơ cá nhân</span>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••"
                    value={manualPin}
                    onChange={(e) => {
                      setManualPin(e.target.value.replace(/\D/g, ""));
                      if (manualErrorMsg) setManualErrorMsg(null);
                    }}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-10 py-2 text-xs sm:text-sm text-slate-900 font-mono tracking-wider placeholder:text-slate-400 focus:outline-none focus:border-[#17664e] focus:ring-1 focus:ring-[#17664e]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

          

              {manualSuccessMsg && (
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">{manualSuccessMsg}</p>
                    {checkinDetail?.plan?.name && (
                      <p className="text-[11px] font-normal text-emerald-700 mt-0.5">
                        Gói: {checkinDetail.plan.name} • Còn {checkinDetail.plan.remainingSessions ?? 0} buổi
                      </p>
                    )}
                  </div>
                </div>
              )}

              {manualErrorMsg && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{manualErrorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowManualModal(false)}
                  className="text-xs font-semibold px-4 h-9"
                >
                  Đóng
                </Button>
                <Button
                  type="submit"
                  disabled={manualSubmitting || !manualPhone || !manualPin}
                  className="bg-[#17664e] hover:bg-[#0f4b39] text-white font-semibold text-xs px-5 h-9 inline-flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {manualSubmitting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang xác thực...</span>
                    </>
                  ) : (
                    <span>Xác nhận vào cổng</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GateCheckinPage;
