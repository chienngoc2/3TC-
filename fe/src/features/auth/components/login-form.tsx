import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { GoogleLoginModal } from "./google-login-modal";
import type { AuthUser } from "../types/auth.types";
import { AxiosError } from "axios";

export interface LoginFormProps {
  onSuccess?: (user: AuthUser) => void;
  onSwitchToRegister?: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onSwitchToRegister,
}) => {
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage("Vui lòng điền đầy đủ email và mật khẩu.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const user = await login({ email, password });
      onSuccess?.(user);
    } catch (err: unknown) {
      let beMessage: unknown = "Đăng nhập không thành công. Vui lòng kiểm tra lại tài khoản.";
      if (err instanceof AxiosError && err.response?.data) {
        const data = err.response.data as { message?: string | string[] };
        beMessage = data.message || err.message;
      } else if (err instanceof Error) {
        beMessage = err.message;
      }

      if (err instanceof AxiosError && (err.code === "ECONNABORTED" || err.message?.includes("timeout"))) {
        setErrorMessage("Máy chủ đang khởi động lại từ trạng thái nghỉ (Render free-tier cold start). Vui lòng đợi vài giây và bấm Đăng nhập lại.");
      } else if (
        beMessage === "INVALID_CREDENTIALS" ||
        (typeof beMessage === "string" && beMessage.includes("INVALID_CREDENTIALS"))
      ) {
        setErrorMessage("Email hoặc mật khẩu không chính xác. Vui lòng thử lại.");
      } else if (Array.isArray(beMessage)) {
        setErrorMessage(beMessage.join(", "));
      } else {
        setErrorMessage(String(beMessage));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Error alert banner */}
        {errorMessage && (
          <div className="flex items-start gap-2.5 border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 animate-in fade-in-50">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <p className="flex-1 leading-relaxed font-medium">{errorMessage}</p>
          </div>
        )}

        {/* Email Input */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1.5">
            Địa chỉ Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              className="pl-10 rounded-none bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
        </div>

        {/* Password Input */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight">
              Mật khẩu
            </label>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="pl-10 pr-10 rounded-none bg-slate-50 border-slate-200 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant="mint"
          disabled={isSubmitting}
          className="w-full rounded-none py-2.5 text-xs font-bold flex items-center justify-center gap-2 mt-2 shadow-xs"
        >
          {isSubmitting ? (
            <span>Đang xác thực...</span>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập hệ thống</span>
            </>
          )}
        </Button>

        {/* Social Divider */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-slate-400 font-semibold text-[11px]">
              Hoặc tiếp tục với
            </span>
          </div>
        </div>

        {/* Google Login with OTP Button */}
        <button
          type="button"
          onClick={() => setIsGoogleModalOpen(true)}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-none shadow-2xs transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
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
          <span>Đăng nhập với Google + OTP</span>
        </button>

        {/* Switch to Register link */}
        <div className="pt-2 text-center text-xs text-slate-500">
          Chưa có tài khoản hội viên?{" "}
          <button
            type="button"
            onClick={onSwitchToRegister}
            className="font-bold text-[#17664e] hover:underline inline-flex items-center gap-0.5 ml-1 cursor-pointer"
          >
            Đăng ký ngay
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </form>

      {/* Google Login + OTP Modal rendered outside form */}
      <GoogleLoginModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={(user) => {
          setIsGoogleModalOpen(false);
          onSuccess?.(user);
        }}
      />
    </>
  );
};
