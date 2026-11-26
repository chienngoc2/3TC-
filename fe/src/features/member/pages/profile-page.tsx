import React, { useState, useEffect, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  User,
  ShieldCheck,
  Mail,
  Phone,
  Ruler,
  Target,
  HeartPulse,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  Camera,
  X,
  Link as LinkIcon,
  Trash2,
  CreditCard,
  Activity,
  Calendar,
  Check,
  Flame,
  Eye,
  EyeOff,
} from "lucide-react";
import { useSession } from "@/auth/session-context";
import { useNotification } from "@/context/notification-context";
import { StateMessage } from "@/components/feedback/state-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  UserProfile,
  UpdateProfileDto,
  GenderType,
} from "../types/profile.types";
import { getGenderLabel, getInitials } from "../utils/profile.utils";
import { profileApiService } from "../services/profile-api.service";

// ==========================================
// 1. CONSTANTS & SUGGESTIONS
// ==========================================
const FITNESS_GOAL_CATEGORIES = [
  { label: "Tăng 2kg cơ bắp", category: "Tăng cơ", icon: "" },
  { label: "Giảm 3kg mỡ thừa", category: "Giảm mỡ", icon: "" },
  { label: "Cải thiện sức bền tim mạch", category: "Cardio", icon: "" },
  { label: "Uốn dẻo Yoga & giải tỏa stress", category: "Yoga", icon: "" },
  { label: "Luyện Boxing tăng phản xạ", category: "Boxing", icon: "" },
  { label: "Duy trì vóc dáng săn chắc", category: "Duy trì", icon: "" },
];

const MEDICAL_SUGGESTIONS = [
  "Không có bệnh lý nền, sức khỏe tốt",
  "Đau mỏi vai gáy do ngồi văn phòng",
  "Khớp gối cần tránh bài tập quá nặng",
  "Huyết áp ổn định, tập cardio nhẹ nhàng",
];

// Calculate BMI interpretation
function getBmiInterpretation(bmi?: number | string | null): { text: string; color: string } {
  if (!bmi) return { text: "Chưa đo", color: "text-slate-400" };
  const val = Number(bmi);
  if (Number.isNaN(val)) return { text: "Chưa đo", color: "text-slate-400" };
  if (val < 18.5) return { text: "Thiếu cân", color: "text-sky-500" };
  if (val < 23) return { text: "Chuẩn thể hình", color: "text-emerald-500" };
  if (val < 25) return { text: "Tiền thừa cân", color: "text-amber-500" };
  return { text: "Cần giảm mỡ", color: "text-rose-500" };
}

// ==========================================
// 2. SUBCOMPONENT: PROFILE HEADER (HERO & AVATAR)
// ==========================================
interface ProfileHeaderProps {
  profile: UserProfile;
  avatarUrl?: string;
  onAvatarChange?: (url: string) => void;
  liveFullName?: string;
  livePhone?: string;
  liveCheckinCode?: string;
  liveGender?: GenderType;
  liveHeightCm?: string | number;
  liveFitnessGoals?: string;
  onChangePasswordClick?: () => void;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profile,
  avatarUrl,
  onAvatarChange,
  liveFullName,
  livePhone,
  liveCheckinCode,
  liveGender,
  liveHeightCm,
  liveFitnessGoals,
  onChangePasswordClick,
}) => {
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [tempUrl, setTempUrl] = useState(avatarUrl ?? profile.avatarUrl ?? "");
  const [imgError, setImgError] = useState(false);
  const pinValue = liveCheckinCode || profile.checkinCode || "1234";

  const displayAvatar = avatarUrl !== undefined ? avatarUrl : profile.avatarUrl;
  const displayName = liveFullName || profile.fullName || "Hội viên Sports Center";
  const displayPhone = livePhone !== undefined ? livePhone : profile.phone;
  const displayGender = liveGender || profile.gender || "MALE";
  const displayHeight = liveHeightCm !== undefined && liveHeightCm !== ""
    ? liveHeightCm
    : (profile.heightCm ?? profile.memberProfile?.heightCm);
  const displayGoals = liveFitnessGoals !== undefined && liveFitnessGoals !== ""
    ? liveFitnessGoals
    : (profile.fitnessGoals ?? profile.memberProfile?.fitnessGoals);

  const heightNum = displayHeight ? Number(displayHeight) : null;
  const weightNum = profile.weightKg ?? profile.memberProfile?.weightKg ?? null;
  const bmiVal = profile.bmi ?? profile.memberProfile?.bmi ?? (
    heightNum && weightNum && heightNum > 0
      ? Number((Number(weightNum) / Math.pow(heightNum / 100, 2)).toFixed(1))
      : null
  );
  const bmiInfo = getBmiInterpretation(bmiVal);

  const genderInfo = getGenderLabel(displayGender);
  const hasAvatar = Boolean(displayAvatar && displayAvatar.trim() && !imgError);

  const activeSub = profile.subscriptions && profile.subscriptions.length > 0
    ? profile.subscriptions[0]
    : null;

  const handleApplyAvatar = () => {
    if (onAvatarChange) onAvatarChange(tempUrl.trim());
    setImgError(false);
    setShowAvatarModal(false);
  };

  const handleClearAvatar = () => {
    if (onAvatarChange) onAvatarChange("");
    setTempUrl("");
    setImgError(false);
    setShowAvatarModal(false);
  };

  return (
    <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-950 via-[#071618] to-[#041d1a] text-white p-6 sm:p-9 shadow-2xl border border-emerald-950/60 mb-6">
      {/* Background athletic atmospheric glows */}
      <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-emerald-500/12 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-16 -left-10 w-96 h-96 bg-teal-600/10 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#059669_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.04] pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-7">
        {/* Avatar Trigger with camera & ring */}
        <div className="relative shrink-0 group">
          <div
            className={cn(
              "w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden flex items-center justify-center transition-all duration-300 shadow-2xl",
              hasAvatar
                ? "border-2 border-emerald-500/40 ring-4 ring-emerald-500/10 bg-slate-900"
                : "border-2 border-dashed border-emerald-800/60 bg-slate-900/90 text-slate-400"
            )}
          >
            {hasAvatar ? (
              <img
                src={displayAvatar!}
                alt={displayName}
                onError={() => setImgError(true)}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-2 select-none">
                <span className="text-3xl font-black text-emerald-400 tracking-wider">
                  {getInitials(displayName)}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Sports ID
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setTempUrl(displayAvatar || "");
              setShowAvatarModal(true);
            }}
            className="absolute -bottom-2 -right-2 w-9 h-9 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 cursor-pointer ring-4 ring-slate-950 font-bold"
            title="Đổi ảnh đại diện"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Member Details Header */}
        <div className="flex-1 text-center md:text-left space-y-4">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {profile.role === "COACH"
                  ? "Huấn luyện viên chính thức"
                  : profile.role === "ADMIN" || profile.role === "CENTER_MANAGER"
                  ? "Ban quản trị hệ thống"
                  : "Hội viên chính thức"}
              </span>
            </span>

            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border backdrop-blur-md",
                genderInfo.className
              )}
            >
              <span className="text-xs font-black">{genderInfo.icon}</span>
              <span>Giới tính: {genderInfo.label}</span>
            </span>

            {activeSub && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-500/15 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Gói: {activeSub.packageTier || "VIP Member"}</span>
              </span>
            )}
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center justify-center md:justify-start gap-3">
              <span>{displayName}</span>
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 hidden sm:inline-block" />
            </h1>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-y-2 gap-x-5 text-xs text-slate-300 mt-2 font-medium">
              <span className="inline-flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-xl border border-slate-800/80">
                <Mail className="w-3.5 h-3.5 text-emerald-400" />
                <span>{profile.email}</span>
              </span>
              {displayPhone && (
                <span className="inline-flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-xl border border-slate-800/80">
                  <Phone className="w-3.5 h-3.5 text-teal-400" />
                  <span>{displayPhone}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 bg-emerald-950/70 px-2.5 py-1 rounded-xl border border-emerald-800/80 text-emerald-300">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  Mã PIN:{" "}
                  <strong className="font-mono tracking-wider">
                    {showPin ? pinValue : "*".repeat(Math.max(4, pinValue.length))}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPin((prev) => !prev)}
                  className="ml-0.5 text-emerald-400 hover:text-emerald-200 transition-colors cursor-pointer"
                  title={showPin ? "Ẩn mã PIN" : "Xem mã PIN"}
                  aria-label={showPin ? "Ẩn mã PIN" : "Xem mã PIN"}
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </span>
              {heightNum && (
                <span className="inline-flex items-center gap-1.5 bg-slate-900/60 px-2.5 py-1 rounded-xl border border-slate-800/80">
                  <Ruler className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{heightNum} cm</span>
                </span>
              )}
            </div>
          </div>

          {/* Athletic Fast-Stats Chips */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
            {bmiVal && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800/90 text-xs">
                <Activity className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-slate-400 font-medium">BMI:</span>
                <span className="font-black text-white">{bmiVal}</span>
                <span className={cn("text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-white/5", bmiInfo.color)}>
                  {bmiInfo.text}
                </span>
              </div>
            )}

            {displayGoals && (
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 max-w-full">
                <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-semibold text-emerald-400/90">Mục tiêu:</span>
                <span className="font-bold truncate max-w-[260px] sm:max-w-md">
                  {displayGoals}
                </span>
              </div>
            )}

            {onChangePasswordClick && (
              <button
                type="button"
                onClick={onChangePasswordClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-emerald-300 border border-slate-700/80 text-xs font-bold transition-all cursor-pointer shadow-xs ml-auto"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Đổi mật khẩu</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal Change Avatar URL */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/90 rounded-3xl p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-black flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>Cập nhật ảnh đại diện</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Preview */}
            <div className="flex items-center gap-4 p-3 bg-slate-950/70 rounded-2xl border border-slate-800">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0 flex items-center justify-center">
                {tempUrl.trim() ? (
                  <img
                    src={tempUrl.trim()}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = "";
                    }}
                  />
                ) : (
                  <User className="w-6 h-6 text-slate-500" />
                )}
              </div>
              <div className="text-xs text-slate-400 space-y-0.5 min-w-0">
                <p className="font-bold text-slate-200">Xem trước ảnh</p>
                <p className="text-[11px] truncate">Hỗ trợ định dạng .jpg, .png, .webp từ web</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <LinkIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>Dán đường dẫn ảnh (URL)</span>
              </div>
              <Input
                placeholder="https://images.unsplash.com/photo-..."
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                className="h-11 bg-slate-950 border-slate-700 text-xs text-white rounded-xl focus:border-emerald-500"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              {displayAvatar ? (
                <button
                  type="button"
                  onClick={handleClearAvatar}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-bold cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ảnh hiện tại</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAvatarModal(false)}
                  className="h-9 px-4 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer text-xs font-semibold"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="mint"
                  size="sm"
                  onClick={handleApplyAvatar}
                  className="h-9 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black cursor-pointer text-xs"
                >
                  Xác nhận
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. SUBCOMPONENT: ACTIVE SUBSCRIPTION & PHYSICAL STATS
// ==========================================
interface MemberStatusOverviewProps {
  profile: UserProfile;
}

const MemberStatusOverview: React.FC<MemberStatusOverviewProps> = ({ profile }) => {
  const activeSub = profile.subscriptions && profile.subscriptions.length > 0
    ? profile.subscriptions[0]
    : null;

  const height = profile.heightCm ?? profile.memberProfile?.heightCm;
  const weight = profile.weightKg ?? profile.memberProfile?.weightKg;
  const bmi = profile.bmi ?? profile.memberProfile?.bmi;
  const bodyFat = profile.bodyFatPct ?? profile.memberProfile?.bodyFatPct;

  const hasBodyStats = Boolean(height || weight || bmi || bodyFat);
  const bmiStatus = getBmiInterpretation(bmi);

  const isGroupSub = Boolean(
    activeSub &&
      ((activeSub.remainingGroupSessions ?? 0) > 0 ||
        (activeSub.plan?.groupSessionQuota ?? 0) > 0),
  );
  const remainingSessions = activeSub
    ? isGroupSub
      ? (activeSub.remainingGroupSessions ?? activeSub.remainingSessions ?? 0)
      : (activeSub.remainingPtSessions ?? activeSub.remainingSessions ?? 0)
    : 0;

  return (
    <div className="space-y-6 mb-6">
      {/* 1. THẺ HỘI VIÊN & GÓI TẬP HIỆN HÀNH (TRỌN 1 LINE) */}
      <div className="w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
              <span className="p-1.5 rounded-xl bg-emerald-50 text-[#17664e]">
                <CreditCard className="w-4 h-4" />
              </span>
              <span>Gói tập & Thẻ hội viên</span>
            </span>
            {activeSub ? (
              <span className="px-3 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                {activeSub.packageTier || "ACTIVE"}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500">
                Chưa kích hoạt
              </span>
            )}
          </div>

          <div className="pt-4">
            {activeSub ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-xl font-black text-slate-950 tracking-tight">
                    {activeSub.plan?.name || "Gói tập hội viên tiêu chuẩn"}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                    {activeSub.plan?.description || "Toàn quyền sử dụng tiện ích gym, locker, và các lớp tiêu chuẩn."}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/80 to-teal-50/40 border border-emerald-200/80 space-y-1">
                    <span className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                      {isGroupSub ? "Buổi lớp nhóm còn lại" : "Buổi PT 1:1 còn lại"}
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-black text-[#17664e]">
                        {remainingSessions}
                      </span>
                      <span className="text-xs font-bold text-emerald-800">buổi tập</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Hạn gói tập
                    </span>
                    <div className="flex items-center gap-2 pt-1">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-black text-slate-800">
                        {activeSub.endDate
                          ? new Date(activeSub.endDate).toLocaleDateString("vi-VN")
                          : "Đang duy trì"}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Huấn luyện viên phụ trách
                    </span>
                    <div className="flex items-center gap-2 pt-1">
                      {activeSub.assignedCoach ? (
                        <>
                          <div className="w-6 h-6 rounded-full bg-[#17664e] text-white flex items-center justify-center font-bold text-[10px]">
                            {activeSub.assignedCoach.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm font-black text-slate-900 truncate">
                            {activeSub.assignedCoach.fullName}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-slate-500">
                          Chưa chỉ định HLV riêng
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 text-slate-500 text-xs text-center border border-slate-200/70 space-y-2">
                <CreditCard className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Chưa có gói tập nào đang hoạt động</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Vui lòng liên hệ quầy dịch vụ hoặc đăng ký gói tập trực tuyến để mở khóa toàn bộ quyền lợi.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. CHỈ SỐ THỂ CHẤT & INBODY (TRỌN 1 LINE) */}
      <div className="w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all">
        <div>
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900">
              <span className="p-1.5 rounded-xl bg-teal-50 text-teal-600">
                <Activity className="w-4 h-4" />
              </span>
              <span>Chỉ số thể chất & InBody</span>
            </span>
            <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Đo định kỳ
            </span>
          </div>

          <div className="pt-4">
            {hasBodyStats ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-xs transition-all">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Chiều cao
                  </span>
                  <span className="text-lg font-black text-slate-900 mt-1 block">
                    {height ? `${height} cm` : "--"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-xs transition-all">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                    Cân nặng
                  </span>
                  <span className="text-lg font-black text-slate-900 mt-1 block">
                    {weight ? `${weight} kg` : "--"}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 hover:bg-emerald-50 hover:shadow-xs transition-all">
                  <span className="text-[10px] font-extrabold text-emerald-700/80 uppercase tracking-wider block">
                    Chỉ số BMI
                  </span>
                  <span className="text-lg font-black text-emerald-800 mt-1 block">
                    {bmi ? `${bmi}` : "--"}
                  </span>
                  <span className={cn("text-[10px] font-extrabold block mt-0.5", bmiStatus.color)}>
                    {bmiStatus.text}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100 hover:bg-amber-50 hover:shadow-xs transition-all">
                  <span className="text-[10px] font-extrabold text-amber-700/80 uppercase tracking-wider block">
                    Tỷ lệ mỡ
                  </span>
                  <span className="text-lg font-black text-amber-800 mt-1 block">
                    {bodyFat ? `${bodyFat}%` : "--"}
                  </span>
                  <span className="text-[10px] font-extrabold text-amber-600 block mt-0.5">
                    Body Fat
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-slate-50 text-slate-500 text-xs text-center border border-slate-200/70 space-y-2">
                <Activity className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Chưa có dữ liệu InBody trong hồ sơ</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Bạn có thể nhập chiều cao ở mẫu bên dưới hoặc đo máy InBody tại quầy thể chất để hệ thống tự động cập nhật.
                </p>
              </div>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400 pt-3 border-t border-slate-100/80 mt-4 flex items-center justify-between">
          <span>* Chỉ số InBody hỗ trợ HLV xây dựng khối lượng bài tập chuẩn xác theo thể trạng của bạn.</span>
        </p>
      </div>
    </div>
  );
};

// ==========================================
// 4. SUBCOMPONENT: PROFILE FORM (BENTO GRID)
// ==========================================
interface ProfileFormProps {
  initialData: UserProfile;
  avatarUrl: string;
  onAvatarChange: (url: string) => void;
  onLiveChange?: (state: {
    fullName: string;
    phone: string;
    checkinCode?: string;
    gender: GenderType;
    heightCm: string;
    fitnessGoals: string;
  }) => void;
  onSubmit: (dto: UpdateProfileDto) => Promise<void> | void;
  isSaving: boolean;
  saveSuccess?: boolean;
  saveError?: string;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
  initialData,
  avatarUrl,
  onAvatarChange,
  onLiveChange,
  onSubmit,
  isSaving,
  saveSuccess,
  saveError,
}) => {
  const { showToast } = useNotification();
  const [fullName, setFullName] = useState(initialData.fullName || "");
  const [phone, setPhone] = useState(initialData.phone || "");
  const [checkinCode, setCheckinCode] = useState(initialData.checkinCode || "1234");
  const [gender, setGender] = useState<GenderType>(initialData.gender || "MALE");
  const [heightCm, setHeightCm] = useState<string>(
    initialData.heightCm
      ? String(initialData.heightCm)
      : initialData.memberProfile?.heightCm
      ? String(initialData.memberProfile.heightCm)
      : ""
  );
  const [fitnessGoals, setFitnessGoals] = useState(
    initialData.fitnessGoals || initialData.memberProfile?.fitnessGoals || ""
  );
  const [medicalHistory, setMedicalHistory] = useState(
    initialData.medicalHistory || initialData.memberProfile?.medicalHistory || ""
  );
  const [showPinInput, setShowPinInput] = useState(false);
  const [pendingSaveDto, setPendingSaveDto] = useState<UpdateProfileDto | null>(null);
  const [confirmSavePassword, setConfirmSavePassword] = useState("");
  const [showConfirmSavePassword, setShowConfirmSavePassword] = useState(false);
  const [confirmSaveError, setConfirmSaveError] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setFullName(initialData.fullName || "");
    setPhone(initialData.phone || "");
    setCheckinCode(initialData.checkinCode || "1234");
    setGender(initialData.gender || "MALE");
    setHeightCm(
      initialData.heightCm
        ? String(initialData.heightCm)
        : initialData.memberProfile?.heightCm
        ? String(initialData.memberProfile.heightCm)
        : ""
    );
    setFitnessGoals(initialData.fitnessGoals || initialData.memberProfile?.fitnessGoals || "");
    setMedicalHistory(initialData.medicalHistory || initialData.memberProfile?.medicalHistory || "");
  }, [initialData]);

  useEffect(() => {
    if (onLiveChange) {
      onLiveChange({
        fullName,
        phone,
        checkinCode,
        gender,
        heightCm,
        fitnessGoals,
      });
    }
  }, [fullName, phone, checkinCode, gender, heightCm, fitnessGoals, onLiveChange]);

  const handleReset = () => {
    setFullName(initialData.fullName || "");
    setPhone(initialData.phone || "");
    setCheckinCode(initialData.checkinCode || "1234");
    onAvatarChange(initialData.avatarUrl || "");
    setGender(initialData.gender || "MALE");
    setHeightCm(
      initialData.heightCm
        ? String(initialData.heightCm)
        : initialData.memberProfile?.heightCm
        ? String(initialData.memberProfile.heightCm)
        : ""
    );
    setFitnessGoals(initialData.fitnessGoals || initialData.memberProfile?.fitnessGoals || "");
    setMedicalHistory(initialData.medicalHistory || initialData.memberProfile?.medicalHistory || "");
    setValidationError("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      const msg = "Vui lòng nhập họ và tên của bạn";
      setValidationError(msg);
      showToast("warning", "Thông tin bắt buộc", msg);
      return;
    }
    if (checkinCode && !/^\d{4,6}$/.test(checkinCode.trim())) {
      const msg = "Mã PIN check-in bảo mật phải là 4 đến 6 chữ số";
      setValidationError(msg);
      showToast("warning", "Mã PIN không hợp lệ", msg);
      return;
    }
    setValidationError("");
    setConfirmSaveError("");
    setConfirmSavePassword("");
    setShowConfirmSavePassword(false);
    setPendingSaveDto({
      fullName: fullName.trim(),
      phone: phone.trim(),
      checkinCode: checkinCode.trim() || undefined,
      avatarUrl: avatarUrl.trim(),
      gender,
      heightCm: heightCm ? Number(heightCm) : undefined,
      fitnessGoals: fitnessGoals.trim(),
      medicalHistory: medicalHistory.trim(),
    });
  };

  const handleConfirmSaveWithPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!pendingSaveDto) return;
    if (!confirmSavePassword) {
      setConfirmSaveError("Vui lòng nhập mật khẩu hiện tại để xác nhận.");
      return;
    }
    setConfirmSaveError("");
    try {
      await onSubmit({
        ...pendingSaveDto,
        currentPassword: confirmSavePassword,
      });
      setPendingSaveDto(null);
      setConfirmSavePassword("");
      setShowConfirmSavePassword(false);
    } catch (err) {
      setConfirmSaveError(errorText(err) || "Mật khẩu xác nhận không chính xác.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* CONTAINERS TRỌN 1 LINE CHO MỖI PHẦN */}
      <div className="space-y-6">
        {/* CARD 1: THÔNG TIN CÁ NHÂN & TÀI KHOẢN (TRỌN 1 LINE) */}
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#17664e] flex items-center justify-center font-bold shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Thông tin cá nhân & Tài khoản
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Thông tin định danh hội viên trên toàn bộ hệ sinh thái trung tâm
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>Họ và tên</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </span>
                </div>
                <Input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nhập họ và tên đầy đủ"
                  className="h-11 rounded-2xl text-xs font-semibold bg-slate-50/90 border-slate-200 focus:bg-white text-slate-900 focus:border-[#17664e] focus:ring-2 focus:ring-[#17664e]/15 transition-all"
                />
              </div>

              {/* Gender Segmented Control */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Giới tính</span>
                  <span className="text-[11px] text-slate-400 font-medium">Hiển thị trên thẻ & hồ sơ</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/70">
                  {[
                    { id: "MALE" as GenderType, label: "Nam", icon: "♂" },
                    { id: "FEMALE" as GenderType, label: "Nữ", icon: "♀" },
                    { id: "OTHER" as GenderType, label: "Khác", icon: "⚧" },
                  ].map((g) => {
                    const active = gender === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGender(g.id)}
                        className={cn(
                          "flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 cursor-pointer border",
                          active
                            ? "!bg-white !text-emerald-800 !border-emerald-300 shadow-xs"
                            : "!bg-transparent !text-slate-600 !border-transparent hover:!text-slate-900 hover:!bg-white/60"
                        )}
                      >
                        <span className="text-sm font-black">{g.icon}</span>
                        <span>{g.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {/* Phone */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>Số điện thoại</span>
                    <span className="text-rose-500 font-bold">*</span>
                  </span>
                </div>
                <Input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0901234567"
                  className="h-11 rounded-2xl text-xs font-semibold bg-slate-50/90 border-slate-200 focus:bg-white text-slate-900 focus:border-[#17664e] focus:ring-2 focus:ring-[#17664e]/15 transition-all"
                />
              </div>

              {/* Security Check-in PIN */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#17664e]" />
                    <span>Mã PIN check-in (4-6 số)</span>
                  </span>
                </div>
                <div className="relative">
                  <Input
                    type={showPinInput ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    value={checkinCode}
                    onChange={(e) => setCheckinCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="****"
                    className="h-11 pr-10 rounded-2xl text-xs font-mono font-bold tracking-widest bg-emerald-50/50 border-emerald-200 focus:bg-white text-emerald-950 focus:border-[#17664e] focus:ring-2 focus:ring-[#17664e]/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPinInput((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#17664e] transition-colors cursor-pointer"
                    title={showPinInput ? "Ẩn mã PIN" : "Hiện mã PIN"}
                    aria-label={showPinInput ? "Ẩn mã PIN" : "Hiện mã PIN"}
                  >
                    {showPinInput ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Height (cm) */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                    <Ruler className="w-3.5 h-3.5 text-slate-400" />
                    <span>Chiều cao (cm)</span>
                  </span>
                </div>
                <Input
                  type="number"
                  min="50"
                  max="250"
                  step="0.5"
                  value={heightCm}
                  onChange={(e) => setHeightCm(e.target.value)}
                  placeholder="Ví dụ: 175"
                  className="h-11 rounded-2xl text-xs font-semibold bg-slate-50/90 border-slate-200 focus:bg-white text-slate-900 focus:border-[#17664e] focus:ring-2 focus:ring-[#17664e]/15 transition-all"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-500 text-left -mt-2">
              * Mã PIN check-in dùng để đọc cho Lễ tân vào cổng trong trường hợp bạn quên hoặc hết pin điện thoại.
            </p>

            {/* Email (Read-only) */}
            <div className="space-y-1.5 text-left pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Email tài khoản</span>
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                  <Lock className="w-3 h-3 text-slate-400" /> Cố định theo tài khoản
                </span>
              </div>
              <Input
                disabled
                value={initialData.email}
                className="h-11 rounded-2xl text-xs font-semibold bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        {/* CARD 2: MỤC TIÊU THỂ HÌNH & SỨC KHỎE (TRỌN 1 LINE) */}
        <div className="w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Mục tiêu & Thể lực
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Hồ sơ thể chất phục vụ xây dựng giáo án HLV
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fitness Goals */}
            <div className="space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Mục tiêu thể hình</span>
                </span>
              </div>
              <textarea
                rows={3}
                value={fitnessGoals}
                onChange={(e) => setFitnessGoals(e.target.value)}
                placeholder="Ví dụ: Tăng 2kg cơ bắp, giảm mỡ vòng eo, tăng thể lực boxing..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              />

              {/* Quick Goal Suggestion Chips */}
              <div className="space-y-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" /> Gợi ý mục tiêu nhanh:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {FITNESS_GOAL_CATEGORIES.map((item) => {
                    const isSelected = fitnessGoals.includes(item.label);
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => {
                          const currentText = fitnessGoals.trim();
                          if (!currentText) setFitnessGoals(item.label);
                          else if (!currentText.includes(item.label)) {
                            setFitnessGoals(`${currentText}, ${item.label}`);
                          }
                        }}
                        className={cn(
                          "!px-2.5 !py-1 !rounded-xl !text-[11px] !font-bold transition-all cursor-pointer border flex items-center gap-1",
                          isSelected
                            ? "!bg-emerald-50 !text-emerald-800 !border-emerald-300"
                            : "!bg-slate-50 hover:!bg-emerald-50/60 hover:!text-emerald-800 !text-slate-600 !border-slate-200"
                        )}
                      >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                        {isSelected && <Check className="w-3 h-3 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Medical History */}
            <div className="space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 inline-flex items-center gap-1.5">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>Tiền sử sức khỏe & Bệnh lý nền</span>
                </span>
              </div>
              <textarea
                rows={3}
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="Ví dụ: Không có bệnh lý nền / Tiền sử đau thắt lưng nhẹ..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50/90 p-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
              />

              {/* Quick Medical Suggestion Chips */}
              <div className="space-y-1.5 pt-0.5">
                <span className="text-[10px] font-bold text-slate-400 inline-flex items-center gap-1">
                  <HeartPulse className="w-3 h-3 text-rose-400" /> Mẫu nhanh:
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {MEDICAL_SUGGESTIONS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setMedicalHistory(tag)}
                      className="!px-2.5 !py-1 !rounded-xl !text-[11px] !font-medium !bg-slate-50 hover:!bg-teal-50 hover:!text-teal-800 !text-slate-600 !border !border-slate-200 transition-all cursor-pointer"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {validationError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{validationError}</span>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{saveError}</span>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2.5 shadow-xs animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Hồ sơ cá nhân đã được lưu và cập nhật thành công vào hệ thống!</span>
        </div>
      )}

      {/* BOTTOM ACTION BAR */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-slate-400 font-medium hidden sm:block">
          Các thay đổi sẽ được đồng bộ ngay lập tức vào thẻ và giáo án của bạn.
        </p>

        <div className="flex items-center gap-3 ml-auto">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isSaving}
            className="h-11 px-5 rounded-2xl text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Đặt lại</span>
          </Button>

          <Button
            type="submit"
            variant="mint"
            disabled={isSaving}
            className="h-11 px-7 rounded-2xl text-xs font-black tracking-wide bg-[#17664e] hover:bg-[#007360] text-white shadow-lg shadow-emerald-900/10 cursor-pointer transition-all active:scale-[0.98]"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi hồ sơ"}</span>
          </Button>
        </div>
      </div>

      {/* MODAL XÁC NHẬN MẬT KHẨU KHI LƯU HỒ SƠ */}
      {pendingSaveDto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Xác nhận mật khẩu</h3>
                  <p className="text-xs text-slate-400">Nhập mật khẩu hiện tại để lưu thay đổi hồ sơ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingSaveDto(null);
                  setConfirmSavePassword("");
                  setConfirmSaveError("");
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {confirmSaveError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{confirmSaveError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5 text-xs">
                <label className="block font-bold text-slate-300">Mật khẩu hiện tại</label>
                <div className="relative">
                  <input
                    type={showConfirmSavePassword ? "text" : "password"}
                    autoFocus
                    placeholder="Nhập mật khẩu tài khoản để xác nhận..."
                    value={confirmSavePassword}
                    onChange={(e) => setConfirmSavePassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleConfirmSaveWithPassword(e);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmSavePassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                    aria-label={showConfirmSavePassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showConfirmSavePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setPendingSaveDto(null);
                    setConfirmSavePassword("");
                    setConfirmSaveError("");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Hủy
                </button>
                <Button
                  type="button"
                  variant="mint"
                  disabled={isSaving}
                  onClick={(e) => void handleConfirmSaveWithPassword(e)}
                  className="h-10 px-5 text-xs font-bold bg-[#17664e] text-white hover:bg-[#135641]"
                >
                  {isSaving ? "Đang xác nhận..." : "Xác nhận & Lưu"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

// ==========================================
// 5. MAIN PROFILE PAGE
// ==========================================
export const ProfilePage: React.FC = () => {
  const { user, verify } = useSession();
  const { showToast } = useNotification();
  const cache = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const closeChangePasswordModal = () => {
    setShowChangePasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError(null);
    setPasswordSuccess(false);
  };

  const profileQuery = useQuery({
    queryKey: ["member", user?.id || "current", "profile"],
    queryFn: () => profileApiService.getProfile(),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error("Vui lòng nhập mật khẩu hiện tại.");
      if (newPassword.length < 6) throw new Error("Mật khẩu mới phải có tối thiểu 6 ký tự.");
      if (!confirmPassword) throw new Error("Vui lòng nhập xác nhận mật khẩu mới.");
      if (newPassword !== confirmPassword) throw new Error("Xác nhận mật khẩu mới không khớp.");
      return profileApiService.changePassword({ currentPassword, newPassword });
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("success", "Đổi mật khẩu", "Mật khẩu của bạn đã được thay đổi thành công!");
      setTimeout(() => {
        setPasswordSuccess(false);
        setShowChangePasswordModal(false);
      }, 1500);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || "Lỗi đổi mật khẩu";
      const text = typeof msg === "string" ? msg : JSON.stringify(msg);
      setPasswordError(text);
      showToast("error", "Lỗi đổi mật khẩu", text);
    },
  });

  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null);
  const activeAvatarUrl =
    customAvatarUrl !== null ? customAvatarUrl : profileQuery.data?.avatarUrl || "";

  const [liveForm, setLiveForm] = useState<{
    fullName: string;
    phone: string;
    checkinCode?: string;
    gender: GenderType;
    heightCm: string;
    fitnessGoals: string;
  } | null>(null);

  const saveMutation = useMutation({
    mutationFn: (dto: UpdateProfileDto) => profileApiService.updateProfile(dto),
    onSuccess: (updatedData) => {
      setSaveSuccess(true);
      setSaveError("");
      setCustomAvatarUrl(null);
      showToast(
        "success",
        "Cập nhật thành công",
        "Hồ sơ cá nhân đã được lưu và cập nhật thành công vào hệ thống!"
      );
      if (updatedData) {
        cache.setQueryData(["member", user?.id || "current", "profile"], updatedData);
      }
      setTimeout(() => {
        setSaveSuccess(false);
      }, 4000);
    },
    onError: (err) => {
      setSaveSuccess(false);
      const msg = errorText(err) || "Không thể cập nhật hồ sơ. Vui lòng thử lại.";
      setSaveError(msg);
      showToast("error", "Lỗi cập nhật", msg);
    },
  });

  const handleSubmit = (dto: UpdateProfileDto) => {
    setSaveSuccess(false);
    setSaveError("");
    return saveMutation.mutateAsync(dto);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-20">
      {/* Loading / Error States */}
      <StateMessage
        loading={profileQuery.isPending}
        error={profileQuery.error}
        onRetry={() => void profileQuery.refetch()}
      />

      {/* Render Main Content Once Loaded */}
      {profileQuery.data && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Visual Hero Card with Avatar & Live Athletic Status */}
          <ProfileHeader
            profile={profileQuery.data}
            avatarUrl={activeAvatarUrl}
            onAvatarChange={(url) => setCustomAvatarUrl(url)}
            liveFullName={liveForm?.fullName}
            livePhone={liveForm?.phone}
            liveCheckinCode={liveForm?.checkinCode}
            liveGender={liveForm?.gender}
            liveHeightCm={liveForm?.heightCm}
            liveFitnessGoals={liveForm?.fitnessGoals}
            onChangePasswordClick={() => setShowChangePasswordModal(true)}
          />

          {/* Connected Subscriptions & Physical InBody Stats Overview */}
          <MemberStatusOverview profile={profileQuery.data} />

          {/* Clean 2-Column Bento Form */}
          <ProfileForm
            initialData={profileQuery.data}
            avatarUrl={activeAvatarUrl}
            onAvatarChange={(url) => setCustomAvatarUrl(url)}
            onLiveChange={setLiveForm}
            onSubmit={handleSubmit}
            isSaving={saveMutation.isPending}
            saveSuccess={saveSuccess}
            saveError={saveError}
          />

          {/* Modal Đổi Mật Khẩu Hội Viên */}
          {showChangePasswordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
              <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 text-white shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold">Đổi mật khẩu tài khoản</h3>
                      <p className="text-xs text-slate-400">Bảo mật tài khoản hội viên</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeChangePasswordModal}
                    className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {passwordError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                {passwordSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Đổi mật khẩu thành công!</span>
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    changePasswordMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-3.5 text-xs">
                    <div className="space-y-1">
                      <label className="block font-bold text-slate-300">Mật khẩu hiện tại</label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          placeholder="Nhập mật khẩu đang sử dụng..."
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          aria-label={showCurrentPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        >
                          {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-300">Mật khẩu mới</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          placeholder="Tối thiểu 6 ký tự..."
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block font-bold text-slate-300">Xác nhận mật khẩu mới</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Nhập lại mật khẩu mới..."
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-700 bg-slate-800 pl-3.5 pr-10 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((p) => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                          aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={closeChangePasswordModal}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                    >
                      Hủy
                    </button>
                    <Button
                      type="submit"
                      variant="mint"
                      disabled={changePasswordMutation.isPending || passwordSuccess}
                      className="h-10 px-5 text-xs font-bold bg-[#17664e] text-white hover:bg-[#135641]"
                    >
                      {changePasswordMutation.isPending ? "Đang cập nhật..." : "Xác nhận đổi mật khẩu"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
