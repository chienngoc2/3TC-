import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  RefreshCw,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  CalendarCheck,
  Clock,
  MapPin,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotification } from '@/context/notification-context';
import { coachPortalApi } from '../api/coach-portal-api';
import type { SubstitutionRequestItem } from '../types/coach-portal.types';
import { TablePagination } from '@/components/common/table-pagination';

const ITEMS_PER_PAGE = 10;

interface CoachRequestsPageProps {
  defaultTab?: 'REQUESTS' | 'INVITATIONS' | 'PICKUP' | 'PENALTIES';
}

export const CoachRequestsPage: React.FC<CoachRequestsPageProps> = ({ defaultTab }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';
  const queryClient = useQueryClient();
  const { showToast } = useNotification();

  const getInitialTab = (): 'REQUESTS' | 'INVITATIONS' | 'PICKUP' | 'PENALTIES' => {
    if (defaultTab) return defaultTab;
    const tabParam = searchParams.get('tab')?.toUpperCase();
    if (tabParam === 'PICKUP' || tabParam === 'INVITATIONS' || tabParam === 'PENALTIES') {
      return tabParam as 'REQUESTS' | 'INVITATIONS' | 'PICKUP' | 'PENALTIES';
    }
    if (location.pathname.endsWith('/pickup')) return 'PICKUP';
    return 'REQUESTS';
  };

  const [activeTab, setActiveTab] = useState<'REQUESTS' | 'INVITATIONS' | 'PICKUP' | 'PENALTIES'>(getInitialTab);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    } else if (location.pathname.endsWith('/pickup')) {
      setActiveTab('PICKUP');
    }
  }, [defaultTab, location.pathname]);
  const [reqPage, setReqPage] = useState<number>(1);
  const [penPage, setPenPage] = useState<number>(1);
  const [applyingScheduleId, setApplyingScheduleId] = useState<string | null>(null);
  const [respondingInvitation, setRespondingInvitation] = useState<SubstitutionRequestItem | null>(null);
  const [acceptingInvitation, setAcceptingInvitation] = useState<{
    inv: SubstitutionRequestItem;
    sessionTitle: string;
    timeStr: string;
    dateStr: string;
  } | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [isDecliningModalOpen, setIsDecliningModalOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const {
    data: requests = [],
    isLoading: isReqLoading,
    isRefetching: isReqRefetching,
    refetch: refetchRequests,
  } = useQuery({
    queryKey: ['coach', 'cancellation-requests'],
    queryFn: () => coachPortalApi.getMyCancellationRequests(),
  });

  const {
    data: invitations = [],
    isLoading: isInvLoading,
    isRefetching: isInvRefetching,
    refetch: refetchInvitations,
  } = useQuery({
    queryKey: ['coach', 'substitution-requests'],
    queryFn: () => coachPortalApi.getSubstitutionRequests(),
  });

  const {
    data: penalties = [],
    isLoading: isPenLoading,
    isRefetching: isPenRefetching,
    refetch: refetchPenalties,
  } = useQuery({
    queryKey: ['coach', 'penalties'],
    queryFn: () => coachPortalApi.getMyPenalties(),
  });

  const {
    data: pickupSchedules = [],
    isLoading: isPickupLoading,
    isRefetching: isPickupRefetching,
    refetch: refetchPickup,
  } = useQuery({
    queryKey: ['coach', 'pickup-schedules'],
    queryFn: () => coachPortalApi.getPickupSchedules(),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'ACCEPT' | 'DECLINE'; reason?: string }) =>
      coachPortalApi.respondSubstitutionRequest(id, { action, reason }),
    onSuccess: (res, variables) => {
      const msg = res.message || 'Thao tác thành công!';
      showToast('success', variables.action === 'ACCEPT' ? 'Đã nhận ca dạy thay' : 'Đã từ chối ca dạy thay', msg);
      setActionMessage({
        type: 'success',
        text: msg,
      });
      setIsDecliningModalOpen(false);
      setRespondingInvitation(null);
      setAcceptingInvitation(null);
      setDeclineReason('');
      queryClient.setQueryData<SubstitutionRequestItem[]>(['coach', 'substitution-requests'], (old) =>
        (old || []).filter((item) => item.id !== variables.id),
      );
      void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      setTimeout(() => setActionMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Lỗi khi phản hồi lời mời.';
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
      showToast('error', 'Không thể phản hồi lời mời', text);
      setActionMessage({
        type: 'error',
        text,
      });
      setTimeout(() => setActionMessage(null), 4000);
    },
  });

  const applyPickupMutation = useMutation({
    mutationFn: (scheduleId: string) => coachPortalApi.applyPickupSchedule(scheduleId),
    onSuccess: (res, scheduleId) => {
      const msg = res.message || 'Đã nhận dạy thay thành công! Ca dạy đã được chuyển trực tiếp vào lịch của bạn.';
      showToast('success', 'Nhận dạy thay thành công', msg);
      setActionMessage({
        type: 'success',
        text: msg,
      });
      queryClient.setQueryData<any[]>(['coach', 'pickup-schedules'], (old) =>
        (old || []).filter(
          (item) =>
            item.id !== scheduleId &&
            item.scheduleId !== scheduleId &&
            item.cancellationRequestId !== scheduleId,
        ),
      );
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'substitution-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      setTimeout(() => setActionMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể đăng ký nhận ca.';
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
      showToast('error', 'Không thể nhận dạy thay', text);
      setActionMessage({
        type: 'error',
        text,
      });
      setTimeout(() => setActionMessage(null), 4000);
    },
    onSettled: () => setApplyingScheduleId(null),
  });

  const withdrawMutation = useMutation({
    mutationFn: (id: string) => coachPortalApi.withdrawCancellationRequest(id),
    onSuccess: () => {
      showToast('success', 'Đã rút đơn', 'Yêu cầu hủy ca của bạn đã được rút lại.');
      setActionMessage({
        type: 'success',
        text: 'Đã rút lại yêu cầu hủy ca thành công.',
      });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'cancellation-requests'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'pickup-schedules'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'today-schedule'] });
      void queryClient.invalidateQueries({ queryKey: ['coach', 'multi-day-schedule'] });
      setTimeout(() => setActionMessage(null), 4000);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Không thể rút đơn hủy ca.';
      const text = typeof msg === 'string' ? msg : JSON.stringify(msg);
      showToast('error', 'Không thể rút đơn', text);
      setActionMessage({ type: 'error', text });
      setTimeout(() => setActionMessage(null), 4000);
    },
  });

  const paginatedRequests = useMemo(() => {
    const start = (reqPage - 1) * ITEMS_PER_PAGE;
    return requests.slice(start, start + ITEMS_PER_PAGE);
  }, [requests, reqPage]);

  const paginatedPenalties = useMemo(() => {
    const start = (penPage - 1) * ITEMS_PER_PAGE;
    return penalties.slice(start, start + ITEMS_PER_PAGE);
  }, [penalties, penPage]);

  const isCurrentLoading =
    activeTab === 'REQUESTS'
      ? isReqLoading
      : activeTab === 'INVITATIONS'
      ? isInvLoading
      : activeTab === 'PICKUP'
      ? isPickupLoading
      : isPenLoading;
  const isCurrentRefetching =
    activeTab === 'REQUESTS'
      ? isReqRefetching
      : activeTab === 'INVITATIONS'
      ? isInvRefetching
      : activeTab === 'PICKUP'
      ? isPickupRefetching
      : isPenRefetching;

  const handleRefetch = () => {
    if (activeTab === 'REQUESTS') void refetchRequests();
    else if (activeTab === 'INVITATIONS') void refetchInvitations();
    else if (activeTab === 'PICKUP') void refetchPickup();
    else void refetchPenalties();
  };

  const getSuggestedActionLabel = (action: string) => {
    switch (action) {
      case 'NONE':
        return 'Không áp dụng';
      case 'WARNING':
        return 'Cảnh cáo nhắc nhở';
      case 'SUGGEST_RATE_REDUCTION_15PCT':
        return 'Giảm 15% rate';
      case 'TEMP_SUSPEND':
        return 'Tạm đình chỉ mở ca';
      default:
        return action || 'Chưa xác định';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24">
      {/* 1. Header: Receptionist standard format */}
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
            Đơn hủy &amp; Kỷ luật
          </h1>
          <p className="text-xs text-white mt-0.5">
            Theo dõi tiến độ duyệt đơn xin nghỉ, hủy ca đột xuất và các chế tài kỷ luật
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            variant="outline"
            onClick={handleRefetch}
            disabled={isCurrentLoading || isCurrentRefetching}
            className="text-xs font-bold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer h-9 px-3 rounded-xl shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isCurrentRefetching ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#17664e] border border-emerald-200/70">
            Kỷ luật &amp; Hủy ca
          </span>
        </div>
      </div>

      {/* 2. Feedback Message */}
      {actionMessage && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl p-4 text-xs font-bold border ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200/90 w-full sm:w-fit shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('REQUESTS')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'REQUESTS'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className={`h-4 w-4 ${activeTab === 'REQUESTS' ? 'text-white' : 'text-slate-500'}`} />
          <span>Đơn xin hủy ca</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
              activeTab === 'REQUESTS'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {requests.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('INVITATIONS')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'INVITATIONS'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarCheck className={`h-4 w-4 ${activeTab === 'INVITATIONS' ? 'text-white' : 'text-slate-500'}`} />
          <span>Lời mời dạy thay từ Quản lý</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
              invitations.length > 0
                ? 'bg-amber-500 text-white animate-pulse'
                : activeTab === 'INVITATIONS'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {invitations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PICKUP')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PICKUP'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CalendarCheck className={`h-4 w-4 ${activeTab === 'PICKUP' ? 'text-white' : 'text-slate-500'}`} />
          <span>Ca trống cần dạy thay</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
              activeTab === 'PICKUP'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {pickupSchedules.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PENALTIES')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'PENALTIES'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldAlert className={`h-4 w-4 ${activeTab === 'PENALTIES' ? 'text-white' : 'text-slate-500'}`} />
          <span>Chế tài kỷ luật</span>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 ${
              activeTab === 'PENALTIES'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {penalties.length}
          </span>
        </button>
      </div>

      {/* 4. TAB 1: Cancellation Requests Table */}
      {activeTab === 'REQUESTS' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {isReqLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Đang tải danh sách đơn hủy...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-8">
              <FileText className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Chưa có đơn xin hủy ca nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Hiện tại bạn không có yêu cầu hủy ca khẩn cấp nào trong hệ thống.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-4 px-5">Thời gian gửi</th>
                    <th className="py-4 px-4">Loại ca</th>
                    <th className="py-4 px-5">Lý do hủy gửi học viên</th>
                    <th className="py-4 px-4">Ghi chú phản hồi</th>
                    <th className="py-4 px-4 text-center">Trạng thái</th>
                    <th className="py-4 px-5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {paginatedRequests.map((req) => {
                    const isPending = req.status === 'PENDING';
                    const isApproved = req.status === 'APPROVED';
                    const isCancelled = req.status === 'CANCELLED';

                    return (
                      <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-4 px-5 whitespace-nowrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block">
                            {new Date(req.createdAt).toLocaleDateString('vi-VN')}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono block">
                            {new Date(req.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} 
                          </span>
                        </td>

                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide ${
                              req.targetType === 'GROUP_CLASS'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                            }`}
                          >
                            {req.targetType === 'GROUP_CLASS' ? 'Lớp nhóm' : 'Ca PT 1-1'}
                          </span>
                        </td>

                        <td className="py-4 px-5 max-w-sm">
                          <p className="text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed">
                            {req.reasonMessage || '--'}
                          </p>
                          {req.internalNote && (
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              Ghi chú nội bộ: {req.internalNote}
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-4 max-w-xs">
                          {req.reviewNote ? (
                            <span className="text-slate-700 dark:text-slate-300 font-semibold block line-clamp-2">
                              {req.reviewNote}
                            </span>
                          ) : (
                            <span className="text-slate-400">--</span>
                          )}
                        </td>

                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {isPending ? (
                            <span className="inline-block px-3 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800 text-xs font-bold">
                              Chờ duyệt
                            </span>
                          ) : isApproved ? (
                            <span className="inline-block px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 text-xs font-bold">
                              Đã phê duyệt
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-block px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                              Đã rút đơn
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800 text-xs font-bold">
                              Từ chối
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-5 text-right whitespace-nowrap">
                          {isPending && req.substitutionStatus !== 'ACCEPTED' ? (
                            <button
                              type="button"
                              disabled={withdrawMutation.isPending}
                              onClick={() => {
                                if (window.confirm('Bạn có chắc muốn rút lại yêu cầu hủy ca này?')) {
                                  withdrawMutation.mutate(req.id);
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {withdrawMutation.isPending ? 'Đang rút...' : 'Rút đơn'}
                            </button>
                          ) : req.substitutionStatus === 'ACCEPTED' ? (
                            <span className="text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold">
                              Đã có HLV nhận thay
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">--</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Pagination */}
            <TablePagination
              currentPage={reqPage}
              totalItems={requests.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setReqPage}
              itemName="đơn hủy"
            />
          </>
        )}
        </div>
      )}

      {/* TAB INVITATIONS: Lời mời dạy thay từ Quản lý */}
      {activeTab === 'INVITATIONS' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Lời mời dạy thay từ Quản lý
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Các ca học Quản lý đã chọn bạn để dạy thay do HLV khác có việc đột xuất. Bạn xác nhận đồng ý thì ca học mới chính thức chuyển qua bạn.
              </p>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 self-start sm:self-auto">
              {invitations.length} ca chờ bạn phản hồi
            </span>
          </div>

          {isInvLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Đang tải danh sách lời mời dạy thay...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CalendarCheck className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Không có lời mời dạy thay nào đang chờ
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Khi Quản lý chỉ định bạn dạy thay ca lớp nhóm cho HLV khác, yêu cầu sẽ xuất hiện tại đây để bạn bấm xác nhận.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invitations.map((inv) => {
                const sched = inv.schedule;
                const booking = inv.booking;
                const avail = booking?.coachAvailability;
                const rawStart = sched?.startTime || avail?.startTime;
                const rawEnd = sched?.endTime || avail?.endTime;
                const startDate = rawStart ? new Date(rawStart) : null;
                const endDate = rawEnd ? new Date(rawEnd) : null;

                const isGroupBooking = booking?.bookingType === 'GROUP_CLASS';
                const disciplineName =
                  sched?.class?.discipline?.name ||
                  booking?.discipline?.name ||
                  (sched ? 'Lớp nhóm' : isGroupBooking ? 'Lớp nhóm' : 'Ca PT 1-1');
                const sessionTitle =
                  sched?.class?.name ||
                  (isGroupBooking
                    ? `Lớp nhóm ${booking?.discipline?.name || ''}`.trim()
                    : `Buổi PT 1-1${booking?.member?.fullName ? ` • ${booking.member.fullName}` : ''}`);

                const dateStr = startDate
                  ? startDate.toLocaleDateString('vi-VN', {
                      weekday: 'long',
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })
                  : '—';
                const timeStr =
                  startDate && endDate
                    ? `${startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                    : '—';

                return (
                  <div
                    key={inv.id}
                    className="rounded-2xl border border-emerald-200 p-5 bg-white dark:bg-slate-950 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide uppercase bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1">
                            {disciplineName}
                          </span>
                          <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                            {sessionTitle}
                          </h3>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                          Chờ bạn xác nhận
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="space-y-1">
                          <span className="text-slate-400 font-medium block flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" /> Thời gian:
                          </span>
                          <strong className="text-slate-800 dark:text-slate-200 block">{timeStr}</strong>
                          <span className="text-[11px] text-slate-500 capitalize">{dateStr}</span>
                        </div>
                        <div className="space-y-1">
                          {sched ? (
                            <>
                              <span className="text-slate-400 font-medium block flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" /> Phòng & Sĩ số:
                              </span>
                              <strong className="text-slate-800 dark:text-slate-200 block">{sched.room?.name || 'Phòng tập'}</strong>
                              <span className="text-[11px] text-slate-500">
                                Đã đăng ký: {sched.currentEnrolled || 0} / {sched.capacity || 0} học viên
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-400 font-medium block flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" /> Học viên & Hình thức:
                              </span>
                              <strong className="text-slate-800 dark:text-slate-200 block">
                                {booking?.member?.fullName || 'Học viên'}
                              </strong>
                              <span className="text-[11px] text-slate-500">
                                {isGroupBooking ? 'Lớp nhóm theo khung giờ' : 'Kèm riêng PT 1-1'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/60 dark:border-amber-800/40 space-y-1">
                        <div>
                          <span className="text-amber-900 dark:text-amber-200 font-semibold">HLV xin nghỉ: </span>
                          <span className="text-slate-800 dark:text-slate-200 font-bold">{inv.coach?.fullName || 'HLV'}</span>
                          {inv.coach?.phone && <span className="text-slate-500 font-mono"> ({inv.coach.phone})</span>}
                        </div>
                        <div>
                          <span className="text-amber-900 dark:text-amber-200 font-semibold">Lý do nghỉ: </span>
                          <span className="italic text-slate-700 dark:text-slate-300">"{inv.reasonMessage}"</span>
                        </div>
                        {inv.internalNote && (
                          <div className="pt-1 border-t border-amber-200/50 dark:border-amber-800/40 text-[11px] text-slate-500">
                            <strong>Ghi chú:</strong> {inv.internalNote}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={respondMutation.isPending}
                        onClick={() => {
                          setRespondingInvitation(inv);
                          setIsDecliningModalOpen(true);
                        }}
                        className="text-xs font-bold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 cursor-pointer h-9 px-3 rounded-xl"
                      >
                        Từ chối ca
                      </Button>
                      <Button
                        size="sm"
                        disabled={respondMutation.isPending}
                        onClick={() => {
                          setAcceptingInvitation({ inv, sessionTitle, timeStr, dateStr });
                        }}
                        className="text-xs font-bold bg-[#17664e] hover:bg-[#135641] text-white cursor-pointer h-9 px-4 rounded-xl shadow-xs"
                      >
                        {respondMutation.isPending ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Đang xử lý...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Đồng ý nhận ca
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Pickup Schedules (Ca trống / ca bị hủy cần người dạy thay) */}
      {activeTab === 'PICKUP' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Các ca trống &amp; ca bị hủy cần người dạy thay 
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bạn chỉ nhận dạy thay được ca cùng môn, và coach nghỉ cùng trình độ với bạn
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetchPickup()}
              disabled={isPickupLoading}
              className="text-xs font-bold"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isPickupLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>

          {isPickupLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Đang tìm các ca trống cần người dạy thay...</p>
            </div>
          ) : pickupSchedules.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <CalendarCheck className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                Hiện không có ca nào cần người dạy thay
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tất cả các ca thuộc bộ môn của bạn đều đang có HLV phụ trách bình thường.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pickupSchedules.map((item) => {
                const startTime = new Date(item.startTime);
                const endTime = new Date(item.endTime);
                const isApplying = applyingScheduleId === item.id;
                const pendingReq = item.cancellationRequests?.[0];

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200 p-4 bg-white hover:border-emerald-300 transition-colors space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                          {item.class.discipline?.name || 'Bộ môn'}
                        </span>
                        <h4 className="text-sm font-semibold text-slate-900 leading-snug">
                          {item.class.name}
                        </h4>
                      </div>
                      <span className="whitespace-nowrap shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                        Cần dạy thay
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                        <span>
                          {startTime.toLocaleDateString('vi-VN', {
                            weekday: 'short',
                            day: '2-digit',
                            month: '2-digit',
                          })}{' '}
                          {startTime.toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          –{' '}
                          {endTime.toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                        <span className="truncate">{item.room?.name || 'Phòng tập'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:col-span-2">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" strokeWidth={1.5} />
                        <span>
                          HLV ban đầu: <span className="font-medium text-slate-900">{item.coach?.fullName || 'HLV'}</span>
                        </span>
                      </div>
                    </div>

                    {pendingReq?.reasonMessage ? (
                      <div className="text-xs bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/80 text-slate-600 break-words line-clamp-2">
                        <span className="font-medium text-slate-700">Lý do xin nghỉ: </span>
                        {pendingReq.reasonMessage}
                      </div>
                    ) : null}

                    <div className="pt-2.5 flex items-center justify-end border-t border-slate-100">
                      <Button
                        size="sm"
                        disabled={isApplying}
                        onClick={() => {
                          setApplyingScheduleId(item.id);
                          applyPickupMutation.mutate(item.id);
                        }}
                        className="bg-[#17664e] hover:bg-[#135641] text-white text-xs font-medium h-8 px-3.5 rounded-lg cursor-pointer"
                      >
                        {isApplying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                        )}
                        <span>Xin nhận ca này</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. TAB 3: Penalties Table */}
      {activeTab === 'PENALTIES' && (
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          {isPenLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Đang tải lịch sử kỷ luật...</p>
            </div>
          ) : penalties.length === 0 ? (
            <div className="py-16 text-center space-y-3 p-8">
              <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Không có bản ghi kỷ luật nào</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Tỷ lệ chuyên cần tốt, chưa ghi nhận vi phạm kỷ luật nào.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-4 px-5">Kỳ đánh giá</th>
                    <th className="py-4 px-4 text-center">Số ca hủy</th>
                    <th className="py-4 px-5">Chế tài áp dụng</th>
                    <th className="py-4 px-4 text-center">Trạng thái</th>
                    <th className="py-4 px-5 text-right">Ngày ghi nhận</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {paginatedPenalties.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100 block">
                          Tháng {item.month}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {item.cancellationCount} ca
                        </span>
                      </td>

                      <td className="py-4 px-5">
                        <span
                          className={`inline-block px-3 py-1 rounded-lg text-xs font-bold ${
                            item.suggestedAction === 'NONE'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800'
                              : item.suggestedAction === 'WARNING'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800'
                              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800'
                          }`}
                        >
                          {getSuggestedActionLabel(item.suggestedAction)}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            item.isReviewed
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {item.isReviewed ? 'Đã xem xét' : 'Đang xem xét'}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right whitespace-nowrap text-slate-500">
                        {new Date(item.updatedAt || item.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Pagination */}
            <TablePagination
              currentPage={penPage}
              totalItems={penalties.length}
              itemsPerPage={ITEMS_PER_PAGE}
              onPageChange={setPenPage}
              itemName="bản ghi kỷ luật"
            />
          </>
        )}
        </div>
      )}

      {/* Modal từ chối nhận ca dạy thay */}
      {isDecliningModalOpen && respondingInvitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Từ chối nhận ca dạy thay
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Vui lòng cung cấp lý do từ chối để Quản lý nắm thông tin và kịp thời tìm HLV khác thay thế.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
              <div className="font-bold text-slate-900 dark:text-white">
                {respondingInvitation.schedule?.class?.name || 'Ca học nhóm'}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                {respondingInvitation.schedule?.startTime
                  ? `${new Date(respondingInvitation.schedule.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${new Date(respondingInvitation.schedule.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${new Date(respondingInvitation.schedule.startTime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })}`
                  : '—'}
              </div>
              <div className="text-slate-500 text-[11px]">
                HLV báo nghỉ: <strong>{respondingInvitation.coach?.fullName || 'HLV'}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Lý do từ chối <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Ví dụ: Bận việc đột xuất, trùng lịch cá nhân, không đảm bảo sức khỏe..."
                rows={3}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={respondMutation.isPending}
                onClick={() => {
                  setIsDecliningModalOpen(false);
                  setRespondingInvitation(null);
                  setDeclineReason('');
                }}
                className="text-xs font-semibold h-9 rounded-xl cursor-pointer"
              >
                Hủy bỏ
              </Button>
              <Button
                size="sm"
                disabled={respondMutation.isPending || !declineReason.trim()}
                onClick={() => {
                  respondMutation.mutate({
                    id: respondingInvitation.id,
                    action: 'DECLINE',
                    reason: declineReason.trim(),
                  });
                }}
                className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white h-9 px-4 rounded-xl shadow-xs cursor-pointer"
              >
                {respondMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  'Xác nhận từ chối'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận đồng ý nhận ca dạy thay */}
      {acceptingInvitation && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
          onClick={() => {
            if (!respondMutation.isPending) setAcceptingInvitation(null);
          }}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-[#17664e]" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Xác nhận nhận ca dạy thay
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Buổi học sẽ được chuyển vào lịch giảng dạy của bạn ngay sau khi xác nhận.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
              <div className="font-semibold text-slate-900 dark:text-white text-sm">
                {acceptingInvitation.sessionTitle}
              </div>
              <div className="text-slate-600 dark:text-slate-400 tabular-nums">
                {acceptingInvitation.timeStr} • {acceptingInvitation.dateStr}
              </div>
              <div className="text-slate-500">
                HLV ban đầu:{' '}
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {acceptingInvitation.inv.coach?.fullName || 'HLV'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                disabled={respondMutation.isPending}
                onClick={() => setAcceptingInvitation(null)}
                className="text-xs font-medium h-9 px-3.5 rounded-lg cursor-pointer"
              >
                Hủy
              </Button>
              <Button
                size="sm"
                disabled={respondMutation.isPending}
                onClick={() => {
                  respondMutation.mutate({ id: acceptingInvitation.inv.id, action: 'ACCEPT' });
                }}
                className="text-xs font-medium bg-[#17664e] hover:bg-[#135641] text-white h-9 px-4 rounded-lg cursor-pointer"
              >
                {respondMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Đang xử lý…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Đồng ý nhận ca
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
