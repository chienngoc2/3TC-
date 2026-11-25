import React, { useState } from "react";
import { Mail, Lock, Eye, EyeOff, User, Phone, UserPlus, AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import type { AuthUser } from "../types/auth.types";
import { AxiosError } from "axios";

export interface RegisterFormProps {
  onSuccess?: (user: AuthUser) => void;
  onSwitchToLogin?: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  onSwitchToLogin,
}) => {
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !phone.trim() || !email.trim() || !password) {
      setErrorMessage("Vui lòng điền đầy đủ các trường thông tin bắt buộc.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Mật khẩu phải có độ dài tối thiểu 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp. Vui lòng kiểm tra lại.");
      return;
    }

    // Basic phone validation (at least 9-12 digits)
    const cleanPhone = phone.trim().replace(/\s+/g, "");
    if (!/^[0-9]{9,12}$/.test(cleanPhone)) {
      setErrorMessage("Số điện thoại không hợp lệ (yêu cầu từ 9 đến 12 chữ số).");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const user = await register({
        fullName: fullName.trim(),
        phone: cleanPhone,
        email: email.trim().toLowerCase(),
        password,
      });

      onSuccess?.(user);
    } catch (err: unknown) {
      let status: number | undefined;
      let beMsg: unknown = "Đăng ký tài khoản không thành công. Vui lòng thử lại sau.";

      if (err instanceof AxiosError) {
        status = err.response?.status;
        const beData = err.response?.data as { message?: string | string[] } | undefined;
        beMsg = beData?.message || err.message;
      } else if (err instanceof Error) {
        beMsg = err.message;
      }

      if (status === 409 || (typeof beMsg === "string" && (beMsg.includes("already exists") || beMsg.includes("CONFLICT")))) {
        setErrorMessage("Địa chỉ email hoặc số điện thoại đã được đăng ký. Vui lòng sử dụng tài khoản khác hoặc đăng nhập.");
      } else if (Array.isArray(beMsg)) {
        setErrorMessage(beMsg.join(", "));
      } else if (typeof beMsg === "string") {
        setErrorMessage(beMsg);
      } else {
        setErrorMessage("Đăng ký tài khoản không thành công. Vui lòng thử lại sau.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      {/* Error alert banner */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 animate-in fade-in-50">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <p className="flex-1 leading-relaxed font-medium">{errorMessage}</p>
        </div>
      )}

      {/* Full Name */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
          Họ và tên <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
            className="pl-10 rounded-none bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
          Số điện thoại <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="tel"
            required
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0912345678"
            className="pl-10 rounded-none bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
          Địa chỉ Email <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="hoivien@example.com"
            className="pl-10 rounded-none bg-slate-50 border-slate-200 focus:bg-white"
          />
        </div>
      </div>

      {/* Password Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Password */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
            Mật khẩu <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 6 ký tự"
              className="pl-10 pr-9 rounded-none bg-slate-50 border-slate-200 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-tight mb-1">
            Xác nhận mật khẩu <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu"
              className="pl-10 pr-4 rounded-none bg-slate-50 border-slate-200 focus:bg-white"
            />
          </div>
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
          <span>Đang tạo tài khoản...</span>
        ) : (
          <>
            <UserPlus className="h-4 w-4" />
            <span>Đăng ký tài khoản hội viên</span>
          </>
        )}
      </Button>

      {/* Switch to Login link */}
      <div className="pt-2 text-center text-xs text-slate-500">
        Đã có tài khoản?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-bold text-[#17664e] hover:underline inline-flex items-center gap-1 ml-1 cursor-pointer"
        >
          <ArrowLeft className="h-3 w-3" />
          Đăng nhập ngay
        </button>
      </div>
    </form>
  );
};
