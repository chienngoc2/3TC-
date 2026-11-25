import React from 'react';
import { createPortal } from 'react-dom';
import { X, Target, HeartPulse, Phone, Mail, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface MemberGoalModalData {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string | null;
  memberProfile?: {
    fitnessGoals?: string | null;
    medicalHistory?: string | null;
    heightCm?: number | null;
    weightKg?: number | null;
    bmi?: number | null;
    bodyFatPct?: number | null;
  } | null;
}

interface MemberGoalModalProps {
  member: MemberGoalModalData | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MemberGoalModal: React.FC<MemberGoalModalProps> = ({
  member,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !member) return null;

  const profile = member.memberProfile;
  const height = profile?.heightCm ? Number(profile.heightCm) : null;
  const weight = profile?.weightKg ? Number(profile.weightKg) : null;
  const bmi = profile?.bmi
    ? Number(profile.bmi)
    : height && weight
      ? +(weight / ((height / 100) * (height / 100))).toFixed(1)
      : null;
  const bodyFat = profile?.bodyFatPct ? Number(profile.bodyFatPct) : null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Mục tiêu & Hồ sơ học viên</h3>
              <p className="text-xs text-slate-500">Thông tin chi tiết thể trạng và mục tiêu rèn luyện</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Member Card */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.fullName}
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-teal-600 text-white font-bold text-lg flex items-center justify-center shadow-xs">
                {member.fullName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-slate-900 truncate">{member.fullName}</h4>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-600">
                {member.phone && (
                  <a
                    href={`tel:${member.phone}`}
                    className="flex items-center gap-1 hover:text-teal-600 font-medium"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {member.phone}
                  </a>
                )}
                {member.email && (
                  <div className="flex items-center gap-1 text-slate-500 truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Primary Section: Mục tiêu tập luyện */}
          <div className="rounded-xl border border-teal-200/80 bg-teal-50/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-xs uppercase tracking-wider">
              <Target className="w-4 h-4 text-teal-600" />
              <span>Mục tiêu tập luyện</span>
            </div>
            <p className="text-sm text-slate-800 leading-relaxed font-medium bg-white/80 p-3 rounded-lg border border-teal-100">
              {profile?.fitnessGoals?.trim() ? (
                profile.fitnessGoals
              ) : (
                <span className="text-slate-400 italic font-normal">
                  Chưa thiết lập mục tiêu tập luyện cụ thể trong hồ sơ.
                </span>
              )}
            </p>
          </div>

          {/* Body Metrics Grid */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5 text-slate-500" />
              <span>Chỉ số thể hình</span>
            </div>
            <div className="grid grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block">Chiều cao</span>
                <span className="text-sm font-bold text-slate-900">
                  {height ? `${height} cm` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block">Cân nặng</span>
                <span className="text-sm font-bold text-slate-900">
                  {weight ? `${weight} kg` : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block">BMI</span>
                <span className="text-sm font-bold text-slate-900">
                  {bmi ? bmi : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-center">
                <span className="text-[11px] text-slate-500 block">Tỷ lệ mỡ</span>
                <span className="text-sm font-bold text-slate-900">
                  {bodyFat ? `${bodyFat}%` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Health Notes / Medical History */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-xs uppercase tracking-wider">
              <HeartPulse className="w-4 h-4 text-rose-500" />
              <span>Tiền sử bệnh lý / Lưu ý chấn thương</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/60">
              {profile?.medicalHistory?.trim() ? (
                profile.medicalHistory
              ) : (
                <span className="text-slate-400 italic">
                  Không có ghi nhận bệnh lý hoặc chấn thương hạn chế vận động.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex justify-end">
          <Button
            size="sm"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-4"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
