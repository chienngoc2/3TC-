import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck,
  Camera,
  CheckCircle2,
  DollarSign,
  RefreshCw,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  Save,
  ArrowLeft,
  CreditCard,
  Clock,
  Calendar,
  Plus,
  Trash2,
  Lock,
  KeyRound,
  ShieldCheck,
  X,
  Tag,
  Copy,
  ArrowDown,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/auth-context';
import { useNotification } from '@/context/notification-context';
import { coachPortalApi } from '../api/coach-portal-api';

const ALL_DAYS = [
  { code: 'MONDAY', label: 'Thứ 2' },
  { code: 'TUESDAY', label: 'Thứ 3' },
  { code: 'WEDNESDAY', label: 'Thứ 4' },
  { code: 'THURSDAY', label: 'Thứ 5' },
  { code: 'FRIDAY', label: 'Thứ 6' },
  { code: 'SATURDAY', label: 'Thứ 7' },
  { code: 'SUNDAY', label: 'Chủ Nhật' },
];

const VIETNAMESE_BANKS = [
  'Vietcombank',
  'Techcombank',
  'MB Bank',
  'VietinBank',
  'ACB',
  'BIDV',
  'VPBank',
  'TPBank',
  'Sacombank',
  'VIB',
  'HDBank',
];

export const CoachProfilePage: React.FC = () => {
  const location = useLocation();
  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';
  const { user: authUser, setUser } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useNotification();

  const [fullName, setFullName] = useState<string>(authUser?.fullName || '');
  const [phone, setPhone] = useState<string>(authUser?.phone || '');
  const [checkinCode, setCheckinCode] = useState<string>((authUser as any)?.checkinCode || '1234');
  const [bio, setBio] = useState<string>('');
  const [yearsExperience, setYearsExperience] = useState<number>(0);
  const [bankName, setBankName] = useState<string>('');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [bankAccountName, setBankAccountName] = useState<string>('');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [workingDays, setWorkingDays] = useState<string[]>([]);
  const [daySchedules, setDaySchedules] = useState<Record<string, { start: string; end: string }[]>>({
    MONDAY: [{ start: '08:00', end: '12:00' }],
    TUESDAY: [{ start: '08:00', end: '12:00' }],
    WEDNESDAY: [{ start: '08:00', end: '12:00' }],
    THURSDAY: [{ start: '08:00', end: '12:00' }],
    FRIDAY: [{ start: '08:00', end: '12:00' }],
    SATURDAY: [{ start: '08:00', end: '12:00' }],
    SUNDAY: [{ start: '08:00', end: '12:00' }],
  });
  const [activeDayCode, setActiveDayCode] = useState<string>('MONDAY');
  const [isCopyScheduleModalOpen, setIsCopyScheduleModalOpen] = useState(false);

  const handleConfirmCopySchedule = () => {
    const currentIntervals = daySchedules[activeDayCode] || [];
    const activeLabel = ALL_DAYS.find((d) => d.code === activeDayCode)?.label || activeDayCode;
    const targetDays = ALL_DAYS.filter((d) => workingDays.includes(d.code) && d.code !== activeDayCode);

    setDaySchedules((prev) => {
      const updated = { ...prev };
      for (const d of workingDays) {
        updated[d] = JSON.parse(JSON.stringify(currentIntervals));
      }
      return updated;
    });
    setIsCopyScheduleModalOpen(false);
    showToast(
      'success',
      'Đã sao chép lịch làm việc',
      `Đã đồng bộ khung giờ của ${activeLabel} sang ${targetDays.length} thứ khác trong tuần.`
    );
  };

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Topic Requests state & queries
  const [isRequestTopicOpen, setIsRequestTopicOpen] = useState(false);
  const [requestSpecialtyId, setRequestSpecialtyId] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestCertUrl, setRequestCertUrl] = useState('');

  const allSpecialtiesQuery = useQuery({
    queryKey: ['all-specialties'],
    queryFn: coachPortalApi.getAllSpecialties,
  });

  const myTopicRequestsQuery = useQuery({
    queryKey: ['coach', 'my-topic-requests'],
    queryFn: coachPortalApi.getMyTopicRequests,
  });

  const createTopicRequestMutation = useMutation({
    mutationFn: (body: { specialtyId: string; reason: string; certificateUrl?: string }) =>
      coachPortalApi.createTopicRequest(body),
    onSuccess: () => {
      showToast('success', 'Đã gửi yêu cầu', 'Yêu cầu xin dạy thêm chuyên đề đã được gửi tới Quản lý xét duyệt.');
      setIsRequestTopicOpen(false);
      setRequestSpecialtyId('');
      setRequestReason('');
      setRequestCertUrl('');
      void queryClient.invalidateQueries({ queryKey: ['coach', 'my-topic-requests'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Không thể gửi yêu cầu.';
      showToast('error', 'Lỗi gửi yêu cầu', msg);
    },
  });

  // Profile Query
  const {
    data: profile,
    isLoading: isProfileLoading,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['coach', 'profile'],
    queryFn: coachPortalApi.getMyProfile,
  });

  // Sync state whenever profile data is loaded or refetched
  useEffect(() => {
    if (profile) {
      if (profile.fullName) setFullName(profile.fullName);
      if (profile.phone) setPhone(profile.phone);
      if ((profile as any).checkinCode) setCheckinCode((profile as any).checkinCode);
      const cp = profile.coachProfile;
      if (cp) {
        if (cp.bio !== undefined) setBio(cp.bio || '');
        if (cp.yearsExperience !== undefined) setYearsExperience(cp.yearsExperience || 0);
        if (cp.bankName !== undefined) setBankName(cp.bankName || '');
        if (cp.bankAccountNumber !== undefined) setBankAccountNumber(cp.bankAccountNumber || '');
        if (cp.bankAccountName !== undefined) setBankAccountName(cp.bankAccountName || '');
        if (Array.isArray(cp.workingDays) && cp.workingDays.length > 0) {
          setWorkingDays(cp.workingDays);
          setActiveDayCode((prev) => (cp.workingDays.includes(prev) ? prev : cp.workingDays[0]));
        }
        if (Array.isArray(cp.workingHours) && cp.workingHours.length > 0) {
          const hasDay = cp.workingHours.some((wh: any) => Boolean(wh.day));
          const newMap: Record<string, { start: string; end: string }[]> = {};
          if (hasDay) {
            for (const wh of cp.workingHours) {
              const d = wh.day || 'MONDAY';
              if (!newMap[d]) newMap[d] = [];
              newMap[d].push({
                start: wh.start || wh.from || '08:00',
                end: wh.end || wh.to || '12:00',
              });
            }
          } else {
            const legacyList = cp.workingHours.map((wh: any) => ({
              start: wh.start || wh.from || '08:00',
              end: wh.end || wh.to || '12:00',
            }));
            ALL_DAYS.forEach((d) => {
              newMap[d.code] = [...legacyList];
            });
          }
          ALL_DAYS.forEach((d) => {
            if (!newMap[d.code] || newMap[d.code].length === 0) {
              newMap[d.code] = [{ start: '08:00', end: '12:00' }];
            }
          });
          setDaySchedules(newMap);
        }
      }
    }
  }, [profile]);

  // Calculate registered minutes for a specific day
  const getMinutesForDay = (dayCode: string) => {
    const list = daySchedules[dayCode] || [];
    let mins = 0;
    for (const wh of list) {
      const [sh, sm] = (wh.start || '08:00').split(':').map(Number);
      const [eh, em] = (wh.end || '12:00').split(':').map(Number);
      const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
      if (diff > 0) mins += diff;
    }
    return mins;
  };

  // Check if ANY working day exceeds 8 hours
  const dayOver8Hours = useMemo(() => {
    for (const d of workingDays) {
      if (getMinutesForDay(d) > 8 * 60) return d;
    }
    return null;
  }, [workingDays, daySchedules]);

  const activeDayMinutes = getMinutesForDay(activeDayCode);
  const activeDayHours = (activeDayMinutes / 60).toFixed(1);
  const isActiveDayOver8Hours = activeDayMinutes > 8 * 60;

  // Rates Query
  const {
    data: rates = [],
    isLoading: isRatesLoading,
    refetch: refetchRates,
  } = useQuery({
    queryKey: ['coach', 'rates', authUser?.id],
    queryFn: () => {
      if (!authUser?.id) return [];
      return coachPortalApi.getMyRates(authUser.id);
    },
    enabled: Boolean(authUser?.id),
  });

  const coachDisciplineCodes = useMemo(() => {
    const set = new Set<string>();
    (profile?.coachProfile?.coachSpecialties || []).forEach((cs: any) => {
      const code = cs.specialty?.discipline?.code;
      if (code) set.add(code.toUpperCase());
    });
    (rates || []).forEach((r: any) => {
      const code = r.discipline?.code;
      if (code) set.add(code.toUpperCase());
    });
    const s = (profile?.coachProfile?.specialties || '').toUpperCase();
    if (s.includes('GYM')) set.add('GYM');
    if (s.includes('YOGA')) set.add('YOGA');
    if (s.includes('BOXING')) set.add('BOXING');
    return set;
  }, [profile, rates]);

  const isSelectedSpecialtyIncompatible = useMemo(() => {
    if (!requestSpecialtyId) return false;
    const selectedSpec = (allSpecialtiesQuery.data || []).find((s: any) => s.id === requestSpecialtyId);
    const tCode = selectedSpec?.discipline?.code?.toUpperCase();
    const isGymCoach = coachDisciplineCodes.has('GYM');
    const isYogaOrBoxingCoach = coachDisciplineCodes.has('YOGA') || coachDisciplineCodes.has('BOXING');
    return (
      (isGymCoach && (tCode === 'YOGA' || tCode === 'BOXING')) ||
      (isYogaOrBoxingCoach && tCode === 'GYM')
    );
  }, [requestSpecialtyId, allSpecialtiesQuery.data, coachDisciplineCodes]);

  // Update Profile Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!fullName.trim()) throw new Error('Vui lòng nhập họ và tên.');
      if (dayOver8Hours) {
        const dayLabel = ALL_DAYS.find((d) => d.code === dayOver8Hours)?.label || dayOver8Hours;
        throw new Error(`Khung giờ rảnh của ${dayLabel} đang vượt quá 8h/ngày theo quy định.`);
      }

      const flatWorkingHours: { day: string; start: string; end: string }[] = [];
      for (const dayCode of workingDays) {
        const intervals = daySchedules[dayCode] || [{ start: '08:00', end: '12:00' }];
        for (const interval of intervals) {
          flatWorkingHours.push({
            day: dayCode,
            start: interval.start,
            end: interval.end,
          });
        }
      }

      return coachPortalApi.updateMyProfile({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        checkinCode: checkinCode.trim() || undefined,
        bio: bio.trim() || undefined,
        yearsExperience: Number(yearsExperience) || 0,
        bankName: bankName.trim() || undefined,
        bankAccountNumber: bankAccountNumber.trim() || undefined,
        bankAccountName: bankAccountName.trim() || undefined,
        workingDays,
        workingHours: flatWorkingHours,
      });
    },
    onSuccess: (updated) => {
      setSuccessMsg('Cập nhật hồ sơ & khung giờ rảnh thành công.');
      showToast('success', 'Thành công', 'Cập nhật hồ sơ & khung giờ rảnh thành công.');
      if (authUser) {
        setUser({ ...authUser, fullName: updated.fullName, phone: updated.phone });
      }
      queryClient.setQueryData(['coach', 'profile'], (old: any) => ({
        ...old,
        ...updated,
        coachProfile: {
          ...(old?.coachProfile || {}),
          ...(updated?.coachProfile || {}),
        },
      }));
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi cập nhật hồ sơ';
      const errorString = typeof msg === 'string' ? msg : JSON.stringify(msg);
      setErrorMsg(errorString);
      showToast('error', 'Cập nhật thất bại', errorString);
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  // Change Password Mutation
  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (!currentPassword) throw new Error('Vui lòng nhập mật khẩu hiện tại.');
      if (newPassword.length < 6) throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự.');
      if (newPassword !== confirmPassword) throw new Error('Xác nhận mật khẩu mới không khớp.');
      return coachPortalApi.changePassword({ currentPassword, newPassword });
    },
    onSuccess: () => {
      showToast('success', 'Đổi mật khẩu thành công', 'Mật khẩu tài khoản đã được cập nhật thành công.');
      setIsChangePasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangePasswordError(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi đổi mật khẩu';
      const errorString = typeof msg === 'string' ? msg : JSON.stringify(msg);
      setChangePasswordError(errorString);
      showToast('error', 'Đổi mật khẩu thất bại', errorString);
    },
  });

  // Avatar Upload Mutation
  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      return coachPortalApi.uploadAvatar(file);
    },
    onSuccess: (res) => {
      setSuccessMsg('Cập nhật ảnh đại diện thành công.');
      showToast('success', 'Thành công', 'Cập nhật ảnh đại diện thành công.');
      if (authUser && res.avatarUrl) {
        setUser({ ...authUser, avatarUrl: res.avatarUrl });
      }
      queryClient.invalidateQueries({ queryKey: ['coach', 'profile'] });
      setTimeout(() => setSuccessMsg(null), 3000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi tải ảnh đại diện';
      const errorString = typeof msg === 'string' ? msg : JSON.stringify(msg);
      setErrorMsg(errorString);
      showToast('error', 'Tải ảnh thất bại', errorString);
      setTimeout(() => setErrorMsg(null), 4000);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      avatarMutation.mutate(file);
    }
  };

  const handleRefresh = () => {
    void refetchProfile();
    void refetchRates();
  };

  const displayAvatar = profile?.avatarUrl || authUser?.avatarUrl;
  const displayName = profile?.fullName || authUser?.fullName || 'Huấn luyện viên';
  const displayEmail = profile?.email || authUser?.email || '';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24">
      {/* ========================================================= */}
      {/* CONTAINER 1: HEADER: Receptionist standard benchmark       */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to={`${coachBasePath}/schedule`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#17664e] hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Lịch HLV
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mt-1">
            Hồ sơ cá nhân
          </h1>
          <p className="text-xs text-white mt-0.5">
            Quản lý thông tin định danh, số điện thoại liên hệ và tra cứu các định mức biểu phí dạy kèm 1-1
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isProfileLoading || isRatesLoading}
            className="text-xs font-bold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer h-9 px-3 rounded-xl shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isProfileLoading || isRatesLoading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => setIsChangePasswordOpen(true)}
            className="text-xs font-bold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer h-9 px-3 rounded-xl shadow-xs"
          >
            <Lock className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
            <span>Đổi mật khẩu</span>
          </Button>
l
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#17664e] border border-emerald-200/70">
            Huấn luyện viên
          </span>
        </div>
      </div>

      {/* FEEDBACK ALERTS */}
      {successMsg && (
        <div className="w-full flex items-center gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-xs font-bold text-emerald-900 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="w-full flex items-center gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-bold text-rose-900 animate-in fade-in">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* CONTAINER 2: AVATAR & IDENTITY BANNER                     */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Camera Overlay */}
          <div className="relative group shrink-0">
            <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-3xl bg-emerald-600 text-white font-black flex items-center justify-center text-3xl uppercase overflow-hidden shadow-sm">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                displayName.charAt(0)
              )}
            </div>

            <label className="absolute -bottom-2 -right-2 h-9 w-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-md cursor-pointer hover:bg-emerald-800 border-2 border-white transition-colors">
              <Camera className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={avatarMutation.isPending}
              />
            </label>
          </div>

          {/* Coach Identity Information */}
          <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {displayName}
              </h2>
              
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                {displayEmail || 'Chưa cập nhật email'}
              </span>
              {phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {phone}
                </span>
              )}
              <span className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
                <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Mã PIN: <strong className="font-mono tracking-wider">{checkinCode}</strong></span>
              </span>
             
            </div>

            {avatarMutation.isPending && (
              <p className="text-xs text-emerald-600 flex items-center justify-center sm:justify-start gap-1.5 font-bold pt-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang tải ảnh đại diện lên máy chủ...</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTAINER 3: THÔNG TIN CÁ NHÂN & LIÊN HỆ (1 LINE TRỌN VẸN) */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-emerald-600" />
            <span>Thông Tin Cá Nhân &amp; Liên Hệ</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Cập nhật tên hiển thị và số điện thoại liên hệ trực tiếp cho học viên
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Họ và tên huấn luyện viên <span className="text-emerald-600">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Số điện thoại liên hệ
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ví dụ: 0987654321"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mã PIN check-in (4 - 6 số)</span>
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold">Khi quên ĐT</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={checkinCode}
              onChange={(e) => setCheckinCode(e.target.value.replace(/\D/g, ''))}
              placeholder="1234"
              className="w-full rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 px-4 py-2.5 text-xs font-mono font-bold tracking-widest text-emerald-950 dark:text-emerald-100 focus:border-emerald-600 focus:outline-hidden transition-all"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Địa chỉ Email tài khoản
            </label>
            <input
              type="email"
              value={displayEmail}
              disabled
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-4 py-2.5 text-xs font-semibold text-slate-500 cursor-not-allowed"
            />
            <span className="text-[11px] text-slate-400 block mt-1">
              Địa chỉ email đăng nhập được quản lý bởi Quản trị viên (Admin).
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTAINER 3A: TÀI KHOẢN NGÂN HÀNG NHẬN THÙ LAO DẠY KÈM    */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-emerald-600" />
              <span>Tài Khoản Ngân Hàng Nhận Thù Lao</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thông tin nhận thanh toán thù lao ca dạy kèm PT và lớp học từ trung tâm
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 text-[#17664e] px-3 py-1 text-[11px] font-bold border border-emerald-200">
            Chính chủ
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Ngân hàng thụ hưởng
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden transition-all"
            >
              <option value="">-- Chọn ngân hàng --</option>
              {VIETNAMESE_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Số tài khoản ngân hàng
            </label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Ví dụ: 190358697168"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Tên chủ tài khoản (Viết hoa không dấu)
            </label>
            <input
              type="text"
              value={bankAccountName}
              onChange={(e) => setBankAccountName(e.target.value.toUpperCase())}
              placeholder="Ví dụ: NGUYEN VAN A"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 uppercase focus:border-emerald-600 focus:outline-hidden transition-all"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTAINER: KINH NGHIỆM CHUYÊN MÔN & GIỚI THIỆU BẢN THÂN  */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Kinh Nghiệm Chuyên Môn &amp; Giới Thiệu Bản Thân</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Thông tin hiển thị cho Hội viên khi lựa chọn Huấn luyện viên kèm 1-1
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-1.5 md:col-span-1">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Số năm kinh nghiệm
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(Number(e.target.value))}
              placeholder="Ví dụ: 3"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden transition-all"
            />
          </div>

          <div className="space-y-1.5 md:col-span-3">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100">
              Giới thiệu bản thân &amp; Chứng chỉ chuyên môn
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="VD: Cử nhân ĐH TDTT, chứng chỉ HLV Quốc tế, chuyên sâu thể lực Boxing và điều chỉnh tư thế..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:border-emerald-600 focus:outline-hidden transition-all"
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTAINER: CHUYÊN ĐỀ KHÓA HỌC LỚP NHÓM & XIN DẠY THÊM   */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Tag className="h-4 w-4 text-emerald-600" />
              <span>Chuyên Đề Khóa Học Lớp Nhóm &amp; Xin Dạy Thêm</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Các chuyên đề khóa học HLV đã được cấp phép giảng dạy. Bạn có thể gửi yêu cầu xin dạy thêm chuyên đề mới tới Quản lý.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setIsRequestTopicOpen(true)}
            className="text-xs font-bold bg-[#17664e] hover:bg-[#007360] text-white cursor-pointer h-9 px-4 rounded-xl shadow-xs self-start sm:self-auto"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            <span>Xin dạy thêm chuyên đề</span>
          </Button>
        </div>

        {/* Danh sách chuyên đề đang phụ trách */}
        <div className="space-y-3">
          <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Chuyên đề đang phụ trách ({profile?.coachProfile?.coachSpecialties?.length || 0})
          </label>

          {(profile?.coachProfile?.coachSpecialties || []).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(profile?.coachProfile?.coachSpecialties || []).map((cs: any, idx: number) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {cs.specialty?.name}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-800 bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-emerald-200">
                      {cs.specialty?.discipline?.name}
                    </span>
                  </div>
                  {cs.specialty?.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {cs.specialty.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#17664e] pt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Đã cấp phép giảng dạy</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
              Bạn chưa được phân công chuyên đề lớp nhóm nào. Hãy bấm nút <strong>"Xin dạy thêm chuyên đề"</strong> phía trên để gửi yêu cầu tới Quản lý.
            </div>
          )}
        </div>

        {/* Lịch sử yêu cầu đã gửi */}
        {(myTopicRequestsQuery.data || []).length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Lịch sử yêu cầu xin dạy chuyên đề
            </label>
            <div className="space-y-2">
              {(myTopicRequestsQuery.data || []).map((req: any) => {
                const isPending = req.status === 'PENDING';
                const isApproved = req.status === 'APPROVED';
                return (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{req.specialty?.name}</span>
                        <span className="text-[10px] text-slate-500 bg-white dark:bg-slate-800 px-1.5 py-0.2 rounded border border-slate-200">
                          {req.specialty?.discipline?.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        Lý do / bằng cấp: {req.reason}
                      </p>
                      {req.rejectionReason && (
                        <p className="text-[11px] text-rose-600 italic mt-0.5">
                          Lý do từ chối: {req.rejectionReason}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] text-slate-400">
                        {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                      </span>
                      {isPending ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Chờ Quản lý duyệt
                        </span>
                      ) : isApproved ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          ✓ Đã phê duyệt
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          ✕ Bị từ chối
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CONTAINER 3B: ĐĂNG KÝ KHUNG GIỜ RẢNH & LỊCH TRỰC CỐ ĐỊNH   */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>Đăng Ký Khung Giờ Rảnh &amp; Lịch Trực Hàng Tuần</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Cho phép cấu hình khung giờ rảnh riêng cho từng thứ trong tuần. Quy định trung tâm: <strong>mỗi ngày tối đa 8h</strong> (giờ chẵn :00).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-black border flex items-center gap-1.5 ${
                dayOver8Hours
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : 'bg-emerald-50 text-emerald-900 border-emerald-300'
              }`}
            >
              <span>Giới hạn ca:</span>
              <span className="text-sm font-bold">Tối đa 8.0h / ngày</span>
            </span>
          </div>
        </div>

        {/* 1. Chọn các thứ rảnh trong tuần */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-emerald-600" />
              <span>1. Chọn các thứ làm việc trong tuần:</span>
            </label>
            <div className="flex items-center gap-1 text-[11px]">
              
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => {
                  const days = ['TUESDAY', 'THURSDAY', 'SATURDAY'];
                  setWorkingDays(days);
                  if (!days.includes(activeDayCode)) setActiveDayCode(days[0]);
                }}
                className="text-emerald-700 font-bold hover:underline px-1 py-0.5 cursor-pointer"
              >
                3-5-7
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => {
                  const days = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
                  setWorkingDays(days);
                  if (!days.includes(activeDayCode)) setActiveDayCode(days[0]);
                }}
                className="text-emerald-700 font-bold hover:underline px-1 py-0.5 cursor-pointer"
              >
                T2 - T6
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={() => {
                  const days = ALL_DAYS.map((d) => d.code);
                  setWorkingDays(days);
                  if (!days.includes(activeDayCode)) setActiveDayCode(days[0]);
                }}
                className="text-emerald-700 font-bold hover:underline px-1 py-0.5 cursor-pointer"
              >
                Cả tuần
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {ALL_DAYS.map((day) => {
              const isSelected = workingDays.includes(day.code);
              return (
                <button
                  key={day.code}
                  type="button"
                  onClick={() => {
                    setWorkingDays((prev) => {
                      const next = prev.includes(day.code)
                        ? prev.filter((d) => d !== day.code)
                        : [...prev, day.code];
                      if (!next.includes(activeDayCode) && next.length > 0) {
                        setActiveDayCode(next[0]);
                      }
                      return next;
                    });
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  {day.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Cấu hình khung giờ rảnh theo từng ngày */}
        {workingDays.length === 0 ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
            Vui lòng chọn ít nhất 1 thứ làm việc trong tuần ở mục 1 để cấu hình khung giờ rảnh.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-emerald-600" />
                <span>2. Chọn thứ để chỉnh sửa khung giờ rảnh riêng biệt:</span>
              </label>

              {/* Action: Copy active day schedule to all other working days */}
              <button
                type="button"
                onClick={() => setIsCopyScheduleModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all border border-emerald-200 dark:border-emerald-800/80 cursor-pointer shadow-2xs group"
              >
                <Copy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Sao chép giờ {ALL_DAYS.find((d) => d.code === activeDayCode)?.label} sang các thứ khác</span>
              </button>
            </div>

            {/* Day Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
              {ALL_DAYS.filter((d) => workingDays.includes(d.code)).map((d) => {
                const isActive = activeDayCode === d.code;
                const dMins = getMinutesForDay(d.code);
                const dHours = (dMins / 60).toFixed(1);
                const isOver = dMins > 8 * 60;

                return (
                  <button
                    key={d.code}
                    type="button"
                    onClick={() => setActiveDayCode(d.code)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs dark:bg-emerald-600 dark:border-emerald-600'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    <span>{d.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                        isOver
                          ? 'bg-rose-500 text-white'
                          : isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {dHours}h
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Intervals editor for activeDayCode */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Khung giờ làm việc của {ALL_DAYS.find((d) => d.code === activeDayCode)?.label}:
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                      isActiveDayOver8Hours
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}
                  >
                    {activeDayHours} / 8h
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const curList = daySchedules[activeDayCode] || [];
                      const curMins = getMinutesForDay(activeDayCode);
                      if (curMins >= 8 * 60) {
                        showToast(
                          'warning',
                          'Đã đạt mức tối đa',
                          `Tổng thời gian rảnh của ${ALL_DAYS.find((d) => d.code === activeDayCode)?.label} đã đạt mức tối đa 8h/ngày.`
                        );
                        return;
                      }
                      const remainingHours = Math.max(1, Math.min(4, 8 - Math.floor(curMins / 60)));
                      let nextStartH = 14;
                      if (curList.length > 0) {
                        const lastEnd = curList[curList.length - 1].end || '12:00';
                        const [eh] = lastEnd.split(':').map(Number);
                        nextStartH = Math.min(21, Math.max(6, eh));
                      }
                      const nextEndH = Math.min(22, nextStartH + remainingHours);
                      const nextStart = `${String(nextStartH).padStart(2, '0')}:00`;
                      const nextEnd = `${String(nextEndH).padStart(2, '0')}:00`;

                      setDaySchedules((prev) => ({
                        ...prev,
                        [activeDayCode]: [...(prev[activeDayCode] || []), { start: nextStart, end: nextEnd }],
                      }));
                    }}
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Thêm ca</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {(daySchedules[activeDayCode] || []).map((wh, idx) => {
                  const hourList = [
                    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
                    '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
                    '18:00', '19:00', '20:00', '21:00', '22:00'
                  ];
                  const [sH] = wh.start.split(':').map(Number);
                  const [eH] = wh.end.split(':').map(Number);
                  const duration = eH - sH;

                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600"
                    >
                      <span className="text-xs font-bold text-slate-500 w-12 shrink-0">
                        Ca {idx + 1}:
                      </span>

                      <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Từ</span>
                        <select
                          value={wh.start}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            setDaySchedules((prev) => ({
                              ...prev,
                              [activeDayCode]: (prev[activeDayCode] || []).map((item, i) =>
                                i === idx ? { ...item, start: newStart } : item
                              ),
                            }));
                          }}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                        >
                          {hourList.slice(0, -1).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>

                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Đến</span>
                        <select
                          value={wh.end}
                          onChange={(e) => {
                            const newEnd = e.target.value;
                            setDaySchedules((prev) => ({
                              ...prev,
                              [activeDayCode]: (prev[activeDayCode] || []).map((item, i) =>
                                i === idx ? { ...item, end: newEnd } : item
                              ),
                            }));
                          }}
                          className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-slate-100"
                        >
                          {hourList.slice(1).map((h) => (
                            <option key={h} value={h}>
                              {h}
                            </option>
                          ))}
                        </select>

                        {duration <= 0 && (
                          <span className="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800">
                            Không hợp lệ
                          </span>
                        )}
                      </div>

                      {(daySchedules[activeDayCode] || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDaySchedules((prev) => ({
                              ...prev,
                              [activeDayCode]: (prev[activeDayCode] || []).filter((_, i) => i !== idx),
                            }));
                          }}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xóa ca này"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {dayOver8Hours && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-300 text-xs font-bold text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  Khung giờ rảnh của {ALL_DAYS.find((d) => d.code === dayOver8Hours)?.label} vượt quá mức tối đa 8h/ngày. Vui lòng điều chỉnh lại trước khi lưu.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Global Save Button */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-[11px] text-slate-500 font-medium">
            Thông tin ngân hàng và khung giờ rảnh theo từng ngày sẽ được lưu trực tiếp vào cơ sở dữ liệu hồ sơ HLV.
          </p>

          <Button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending || Boolean(dayOver8Hours)}
            className={`text-xs font-bold gap-2 h-10 px-7 rounded-xl shadow-sm cursor-pointer transition-all ${
              dayOver8Hours
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Lưu tất cả thay đổi hồ sơ</span>
          </Button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONTAINER 4: BIỂU PHÍ DẠY KÈM ĐƯỢC DUYỆT (1 LINE TRỌN VẸN) */}
      {/* ========================================================= */}
      <div className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span>Biểu Phí Dạy Kèm  Được Phê Duyệt</span>
            </h3>
            <p className="text-xs text-slate-500">
              Định mức thù lao dạy kèm theo buổi học được phê duyệt bởi Quản Lý Trung Tâm
            </p>
          </div>

          <span className="text-[11px] font-bold text-slate-400">
            Tổng cộng: {rates.length} biểu phí
          </span>
        </div>

        {isRatesLoading ? (
          <div className="py-16 text-center space-y-3">
            <RefreshCw className="h-7 w-7 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Đang tải biểu phí dạy kèm...</p>
          </div>
        ) : rates.length === 0 ? (
          <div className="py-16 text-center space-y-2 p-8">
            <DollarSign className="h-10 w-10 text-slate-300 mx-auto" />
            <h4 className="text-sm font-black text-slate-900 dark:text-slate-100">
              Chưa có biểu phí nào được phê duyệt
            </h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Vui lòng liên hệ Quản lý trung tâm để cập nhật biểu phí buổi dạy cho chuyên môn của bạn.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-4 px-6">Bộ môn chuyên môn</th>
                  <th className="py-4 px-6">Mức phí mỗi buổi</th>
                  <th className="py-4 px-6">Ngày bắt đầu áp dụng</th>
                  <th className="py-4 px-6">Hạn hiệu lực</th>
                  <th className="py-4 px-6 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {rates.map((rate) => (
                  <tr key={rate.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="font-black text-slate-900 dark:text-slate-100 block">
                        {rate.discipline?.name || 'Huấn luyện viên PT'}
                      </span>
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap">
                      <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                        {Number(rate.ratePerSession).toLocaleString('vi-VN')} <span className="text-xs font-semibold text-slate-500">đ / buổi</span>
                      </span>
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {new Date(rate.effectiveFrom).toLocaleDateString('vi-VN')}
                    </td>

                    <td className="py-4 px-6 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {rate.effectiveTo
                        ? new Date(rate.effectiveTo).toLocaleDateString('vi-VN')
                        : 'Vô thời hạn'}
                    </td>

                    <td className="py-4 px-6 text-center whitespace-nowrap">
                      <span className="inline-block rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 px-3 py-1 text-xs font-bold">
                        Đang áp dụng
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL: ĐỔI MẬT KHẨU TÀI KHOẢN HLV                         */}
      {/* ========================================================= */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Đổi mật khẩu tài khoản
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bảo mật tài khoản Huấn luyện viên
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsChangePasswordOpen(false);
                  setChangePasswordError(null);
                }}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {changePasswordError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{changePasswordError}</span>
              </div>
            )}

            <div className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  placeholder="Nhập mật khẩu đang sử dụng..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Mật khẩu mới
                </label>
                <input
                  type="password"
                  placeholder="Tối thiểu 6 ký tự..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  placeholder="Nhập lại mật khẩu mới..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsChangePasswordOpen(false);
                  setChangePasswordError(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={changePasswordMutation.isPending}
                onClick={() => changePasswordMutation.mutate()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17664e] text-white hover:bg-[#135641] transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {changePasswordMutation.isPending ? 'Đang cập nhật...' : 'Xác nhận đổi mật khẩu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Xin Dạy Thêm Chuyên Đề Khóa Học */}
      {isRequestTopicOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-emerald-600" />
                  <span>Xin Dạy Thêm Chuyên Đề Khóa Học</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đề xuất chuyên đề mới để Quản lý thẩm định và cấp phép mở lớp
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsRequestTopicOpen(false);
                  setRequestSpecialtyId('');
                  setRequestReason('');
                  setRequestCertUrl('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Chuyên đề khóa học muốn xin dạy <span className="text-rose-500">*</span>
                </label>
                <select
                  value={requestSpecialtyId}
                  onChange={(e) => setRequestSpecialtyId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium focus:border-emerald-600 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Chọn chuyên đề khóa học --</option>
                  {(allSpecialtiesQuery.data || [])
                    .filter((s: any) => {
                      const alreadyHas = (profile?.coachProfile?.coachSpecialties || []).some(
                        (cs: any) => cs.specialtyId === s.id || cs.specialty?.id === s.id
                      );
                      return !alreadyHas;
                    })
                    .map((s: any) => {
                      const tCode = s.discipline?.code?.toUpperCase();
                      const isGymCoach = coachDisciplineCodes.has('GYM');
                      const isYogaOrBoxingCoach = coachDisciplineCodes.has('YOGA') || coachDisciplineCodes.has('BOXING');
                      const isIncompatible =
                        (isGymCoach && (tCode === 'YOGA' || tCode === 'BOXING')) ||
                        (isYogaOrBoxingCoach && tCode === 'GYM');

                      return (
                        <option key={s.id} value={s.id} disabled={isIncompatible}>
                          [{s.discipline?.name || 'Khác'}] {s.name} {isIncompatible ? '⛔ (Không áp dụng cho bộ môn của bạn)' : ''}
                        </option>
                      );
                    })}
                </select>

                {(() => {
                  if (!requestSpecialtyId) return null;
                  const selectedSpec = (allSpecialtiesQuery.data || []).find((s: any) => s.id === requestSpecialtyId);
                  const tCode = selectedSpec?.discipline?.code?.toUpperCase();
                  const isGymCoach = coachDisciplineCodes.has('GYM');
                  const isYogaOrBoxingCoach = coachDisciplineCodes.has('YOGA') || coachDisciplineCodes.has('BOXING');
                  const isIncompatible =
                    (isGymCoach && (tCode === 'YOGA' || tCode === 'BOXING')) ||
                    (isYogaOrBoxingCoach && tCode === 'GYM');

                  if (!isIncompatible) return null;
                  return (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11.5px] leading-relaxed">
                      ⚠️ <strong>Quy định trung tâm:</strong> {isGymCoach
                        ? 'Huấn luyện viên chuyên môn Gym & Fitness không thể đăng ký dạy thêm chuyên đề Yoga hoặc Boxing.'
                        : 'Huấn luyện viên Yoga / Boxing không thể đăng ký dạy thêm chuyên môn Gym & Fitness (PT Gym).'}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Lý do / Bằng cấp &amp; Kinh nghiệm giảng dạy <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả chứng chỉ chuyên môn, số năm kinh nghiệm hoặc các lớp tương tự đã từng đứng..."
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium focus:border-emerald-600 focus:outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Link chứng chỉ / Portfolio đính kèm (nếu có)
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/... hoặc link ảnh chứng chỉ"
                  value={requestCertUrl}
                  onChange={(e) => setRequestCertUrl(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-xs font-medium focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsRequestTopicOpen(false);
                  setRequestSpecialtyId('');
                  setRequestReason('');
                  setRequestCertUrl('');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={!requestSpecialtyId || !requestReason.trim() || isSelectedSpecialtyIncompatible || createTopicRequestMutation.isPending}
                onClick={() => {
                  createTopicRequestMutation.mutate({
                    specialtyId: requestSpecialtyId,
                    reason: requestReason.trim(),
                    certificateUrl: requestCertUrl.trim() || undefined,
                  });
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#17664e] text-white hover:bg-[#135641] transition-all cursor-pointer shadow-sm disabled:opacity-50"
              >
                {createTopicRequestMutation.isPending ? 'Đang gửi...' : 'Gửi yêu cầu tới Quản lý'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal: Sao chép khung giờ làm việc */}
      {isCopyScheduleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setIsCopyScheduleModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                    Sao chép khung giờ
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Đồng bộ khung giờ sang các ngày làm việc khác
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyScheduleModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Day Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>1. Nguồn sao chép</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                  {ALL_DAYS.find((d) => d.code === activeDayCode)?.label} ({activeDayHours}h)
                </span>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3.5">
                {(daySchedules[activeDayCode] || []).length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Chưa có khung giờ nào. Sao chép sẽ làm trống các ngày khác!</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(daySchedules[activeDayCode] || []).map((inv, idx) => {
                      const [sh, sm] = (inv.start || '08:00').split(':').map(Number);
                      const [eh, em] = (inv.end || '12:00').split(':').map(Number);
                      const dur = Math.max(0, ((eh * 60 + (em || 0)) - (sh * 60 + (sm || 0))) / 60).toFixed(1);
                      return (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-2xs"
                        >
                          <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{inv.start} - {inv.end}</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">({dur}h)</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Arrow separator */}
            <div className="flex justify-center -my-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shadow-2xs">
                <ArrowDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Target Days Details */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>2. Áp dụng đè lên các ngày</span>
                <span className="text-slate-700 dark:text-slate-300 font-bold">
                  {workingDays.filter((d) => d !== activeDayCode).length} ngày
                </span>
              </div>
              <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 p-3.5">
                {workingDays.filter((d) => d !== activeDayCode).length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Bạn chỉ đang chọn 1 thứ làm việc trong tuần ở Mục 1. Hãy tích chọn thêm các thứ khác nếu muốn sao chép.</span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_DAYS.filter((d) => workingDays.includes(d.code) && d.code !== activeDayCode).map((d) => (
                        <span
                          key={d.code}
                          className="px-2.5 py-1 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/70 border border-emerald-300/70 dark:border-emerald-800 text-xs font-bold text-emerald-900 dark:text-emerald-300"
                        >
                          {d.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Lưu ý: Khung giờ hiện tại của những ngày này sẽ được thay thế hoàn toàn bằng khung giờ của <span className="font-semibold text-slate-700 dark:text-slate-300">{ALL_DAYS.find((d) => d.code === activeDayCode)?.label}</span>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsCopyScheduleModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={workingDays.filter((d) => d !== activeDayCode).length === 0}
                onClick={handleConfirmCopySchedule}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#17664e] text-white hover:bg-[#135641] transition-all cursor-pointer shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận sao chép</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
