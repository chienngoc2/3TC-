import React, { useState, useEffect } from "react";
import { Mail, ShieldCheck, CheckCircle2, ArrowLeft, RefreshCw, Copy, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { sendGoogleOtpApi, verifyGoogleOtpApi } from "../services/auth-api.service";
import type { AuthUser, AuthResponseData } from "../types/auth.types";
import { AxiosError } from "axios";

export interface GoogleLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}

export const GoogleLoginModal: React.FC<GoogleLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { accept } = useAuth();

  const [step, setStep] = useState<"input-email" | "input-otp" | "success">("input-email");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [authData, setAuthData] = useState<AuthResponseData | null>(null);
  const [copied, setCopied] = useState(false);

  // Countdown timer for resend
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    try {
      setIsSending(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      const res = await sendGoogleOtpApi({
        email,
        fullName: fullName.trim() || undefined,
      });
      setSuccessMsg(res.message);
      if (res.debugOtp) {
        setDebugOtp(res.debugOtp);
      }
      setCountdown(60);
      setStep("input-otp");
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        setErrorMsg(String(err.response.data.message));
      } else {
        setErrorMsg("Không thể gửi mã OTP. Vui lòng kiểm tra lại địa chỉ email.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent, customCode?: string) => {
    if (e) e.preventDefault();
    const code = (customCode || otp).trim();
    if (!code || code.length !== 6) {
      setErrorMsg("Mã OTP phải có đúng 6 chữ số.");
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMsg(null);
      const res = await verifyGoogleOtpApi({
        email,
        otp: code,
        fullName: fullName.trim() || undefined,
      });

      setAuthData(res);
      // Save tokens and session into AuthContext
      accept({
        user: res.user,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });

      // Tự động chuyển thẳng vào Dashboard hội viên
      onSuccess(res.user);
      onClose();
    } catch (err: unknown) {
      if (err instanceof AxiosError && err.response?.data?.message) {
        setErrorMsg(String(err.response.data.message));
      } else {
        setErrorMsg("Xác thực OTP thất bại. Vui lòng kiểm tra lại mã.");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyPassword = () => {
    const pw = authData?.defaultAccount?.defaultPassword || "Password123!";
    navigator.clipboard.writeText(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    if (authData?.user) {
      onSuccess(authData.user);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-100 overflow-hidden relative">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">Đăng nhập Google + OTP</h3>
              <p className="text-[11px] text-slate-300">Xác thực an toàn qua mã OTP gửi về Email</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {errorMsg && (
            <div className="mb-4 flex items-start gap-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-3 rounded-xl animate-in fade-in-50">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="flex-1 font-medium">{errorMsg}</p>
            </div>
          )}

          {/* STEP 1: Enter Email */}
          {step === "input-email" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Nhập địa chỉ tài khoản Google của bạn. Hệ thống sẽ gửi mã xác thực OTP 6 số để bạn đăng nhập nhanh chóng.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1.5">
                  Địa chỉ Email Google <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tenban@gmail.com"
                    className="pl-10 text-sm bg-slate-50 border-slate-200 focus:bg-white rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1.5">
                  Họ và tên <span className="text-slate-400 font-normal">(tùy chọn)</span>
                </label>
                <Input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                  className="text-sm bg-slate-50 border-slate-200 focus:bg-white rounded-xl"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={isSending || !email.trim()}
                  className="w-full bg-[#17664e] hover:bg-[#007360] text-white py-2.5 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm"
                >
                  {isSending ? (
                    <span>Đang gửi mã xác thực...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Gửi mã xác thực OTP qua Email</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* STEP 2: Enter OTP */}
          {step === "input-otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setStep("input-email");
                    setErrorMsg(null);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Đổi email khác
                </button>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {email}
                </span>
              </div>

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="flex-1 font-medium">{successMsg}</p>
                </div>
              )}

              {debugOtp && (
                <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-3.5 rounded-xl shadow-xs space-y-2 animate-in fade-in-50">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Mã OTP xác thực (Môi trường Test):
                    </span>
                    <span className="text-[12px] font-mono font-black text-amber-950 bg-amber-200/90 px-2.5 py-0.5 rounded-md tracking-wider">
                      {debugOtp}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-amber-200/60">
                    <span className="text-[11px] text-amber-700 leading-tight">
                      Bấm để điền nhanh mã OTP này vào ô bên dưới:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setOtp(debugOtp);
                        void handleVerifyOtp(undefined, debugOtp);
                      }}
                      className="text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded-md transition-colors cursor-pointer shadow-xs shrink-0"
                    >
                      Tự động điền & Đăng nhập
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1.5 text-center">
                  Nhập mã OTP 6 chữ số
                </label>
                <Input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setOtp(val);
                    if (val.length === 6) {
                      void handleVerifyOtp(undefined, val);
                    }
                  }}
                  placeholder="• • • • • •"
                  className="text-center font-mono text-2xl tracking-[0.5em] font-bold py-3 bg-slate-50 border-slate-200 focus:bg-white rounded-xl"
                />
                <p className="text-[11px] text-slate-500 text-center mt-1.5">
                  Mã OTP có hiệu lực trong 5 phút. Vui lòng kiểm tra hộp thư (cả thư mục Spam).
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-slate-500">Chưa nhận được mã?</span>
                <button
                  type="button"
                  disabled={countdown > 0 || isSending}
                  onClick={() => handleSendOtp()}
                  className={`text-xs font-bold inline-flex items-center gap-1 ${
                    countdown > 0
                      ? "text-slate-400 cursor-not-allowed"
                      : "text-[#17664e] hover:underline cursor-pointer"
                  }`}
                >
                  <RefreshCw className={`w-3 h-3 ${isSending ? "animate-spin" : ""}`} />
                  {countdown > 0 ? `Gửi lại sau (${countdown}s)` : "Gửi lại mã"}
                </button>
              </div>

              <Button
                type="submit"
                disabled={isVerifying || otp.trim().length !== 6}
                className="w-full bg-[#17664e] hover:bg-[#007360] text-white py-2.5 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                {isVerifying ? (
                  <span>Đang xác thực...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Xác thực & Đăng nhập</span>
                  </>
                )}
              </Button>
            </form>
          )}

          {/* STEP 3: Login Success & Default Account Info */}
          {step === "success" && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-2.5 shadow-xs">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">Đăng nhập thành công!</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Xin chào <strong className="text-slate-800">{authData?.user.fullName}</strong>, chào mừng bạn đến với 3TC Fitness.
                </p>
              </div>

              {/* Default Account Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Tài khoản mặc định (Đã gửi vào Email)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Đã cấp
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Tên đăng nhập / Email:</span>
                    <span className="font-semibold text-slate-800 font-mono">{email}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Mật khẩu mặc định:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md font-mono">
                        {authData?.defaultAccount?.defaultPassword || "Password123!"}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className="text-slate-400 hover:text-[#17664e] p-1 rounded transition-colors"
                        title="Sao chép mật khẩu"
                      >
                        {copied ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-700 bg-emerald-50/80 p-2 rounded-lg leading-relaxed">
                  💡 Bạn có thể dùng mật khẩu này để đăng nhập trực tiếp mà không cần Google, hoặc tiếp tục đăng nhập nhanh qua Google OTP bất kỳ lúc nào.
                </p>
              </div>

              <Button
                type="button"
                onClick={handleFinish}
                className="w-full bg-[#17664e] hover:bg-[#007360] text-white py-2.5 font-bold text-xs rounded-xl shadow-sm"
              >
                Vào trung tâm thể thao ngay
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
