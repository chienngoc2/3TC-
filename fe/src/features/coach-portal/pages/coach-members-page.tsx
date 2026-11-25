import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Search,
  RefreshCw,
  FileText,
  X,
  ArrowLeft,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { coachPortalApi } from '../api/coach-portal-api';
import type { AssignedMemberItem, InbodyLogItem } from '../types/coach-portal.types';
import { TablePagination } from '@/components/common/table-pagination';
import { MemberGoalModal, type MemberGoalModalData } from '../components/member-goal-modal';

const ITEMS_PER_PAGE = 10;

const hasValue = (value: unknown) => value !== null && value !== undefined && value !== '';
const fatText = (log: InbodyLogItem) =>
  hasValue(log.bodyFatMassKg)
    ? `${log.bodyFatMassKg} kg`
    : hasValue(log.bodyFatPct)
      ? `${log.bodyFatPct}%`
      : '--';
const muscleText = (log: InbodyLogItem) => {
  const value = hasValue(log.skeletalMuscleMassKg) ? log.skeletalMuscleMassKg : log.muscleMassKg;
  return hasValue(value) ? `${value} kg` : '--';
};

export const CoachMembersPage: React.FC = () => {
  const location = useLocation();
  const coachBasePath = location.pathname.startsWith('/portal/coach') ? '/portal/coach' : '/coach';
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedMember, setSelectedMember] = useState<AssignedMemberItem | null>(null);
  const [goalModalMember, setGoalModalMember] = useState<MemberGoalModalData | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const selectedMemberId = selectedMember?.user?.id || selectedMember?.id;
  const { data: memberAttendances = [] } = useQuery({
    queryKey: ['coach', 'member-attendances', selectedMemberId],
    queryFn: () => coachPortalApi.getMemberAttendanceHistory(selectedMemberId!),
    enabled: Boolean(selectedMemberId),
  });

  const {
    data: members = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['coach', 'members', searchTerm],
    queryFn: () => coachPortalApi.getAssignedMembers(searchTerm.trim() || undefined),
  });

  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return members.slice(start, start + ITEMS_PER_PAGE);
  }, [members, currentPage]);

  const sanitizeText = (val: unknown, fallback: string | null = null): string | null => {
    if (val === null || val === undefined) return fallback;
    const str = String(val).trim();
    if (
      !str ||
      str.toLowerCase() === 'null' ||
      str.toLowerCase() === 'undefined' ||
      str === '{}' ||
      str === '[]'
    ) {
      return fallback;
    }
    return str;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24">
      {/* Page Header */}
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
            Học viên của tôi
          </h1>
          <p className="text-xs text-white mt-0.5">
            Quản lý học viên cá nhân 1-1, theo dõi số buổi tập còn lại, hạn sử dụng và chỉ số InBody
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => void refetch()}
            disabled={isLoading || isRefetching}
            className="text-xs font-bold gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </Button>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-[#17664e] border border-emerald-200/70">
            Học viên PT
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên học viên, số điện thoại hoặc email..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-hidden transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="text-xs font-bold text-slate-500">
          Tổng số học viên: <strong className="text-slate-900">{members.length}</strong>
        </div>
      </div>

      {/* 3. Members Data Table */}
      <div className="rounded-3xl bg-white border border-slate-200/90 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Đang tải danh sách học viên...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="py-16 text-center space-y-3 p-8">
            <Users className="h-10 w-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-black text-slate-900">Không tìm thấy học viên nào</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm
                ? 'Không có học viên nào khớp với từ khóa tìm kiếm.'
                : 'Chưa có học viên nào được phân công kèm riêng.'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-4 px-5">Học viên</th>
                  <th className="py-4 px-4">Mục tiêu tập luyện</th>
                  <th className="py-4 px-4">Số buổi PT còn lại</th>
                  <th className="py-4 px-4">Chỉ số InBody gần nhất</th>
                  <th className="py-4 px-5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedMembers.map((item) => {
                  const user = item?.user || ({} as any);
                  const memberName = sanitizeText(user.fullName, 'Học viên') || 'Học viên';
                  const memberPhone = sanitizeText(user.phone);
                  const memberEmail = sanitizeText(user.email);
                  const contactInfo = memberPhone || memberEmail || '--';
                  const initial = memberName.charAt(0).toUpperCase();

                  const memberLogs = Array.isArray(user.memberInbodyLogs) ? user.memberInbodyLogs : [];
                  // The API returns logs oldest first.
                  const latestInbody = memberLogs[memberLogs.length - 1];
                  const fitnessGoal = sanitizeText(user.memberProfile?.fitnessGoals);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Member Info */}
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-2xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-xs overflow-hidden">
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={memberName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              initial
                            )}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => {
                                setGoalModalMember({
                                  fullName: memberName,
                                  email: user.email,
                                  phone: user.phone,
                                  avatarUrl: user.avatarUrl,
                                  memberProfile: user.memberProfile,
                                });
                              }}
                              className="font-bold text-slate-900 block truncate text-left hover:text-emerald-700 hover:underline cursor-pointer"
                              title="Bấm để xem mục tiêu & hồ sơ học viên"
                            >
                              {memberName}
                            </button>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {contactInfo}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Goal */}
                      <td className="py-4 px-4 max-w-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setGoalModalMember({
                              fullName: memberName,
                              email: user.email,
                              phone: user.phone,
                              avatarUrl: user.avatarUrl,
                              memberProfile: user.memberProfile,
                            });
                          }}
                          className="text-left text-slate-700 line-clamp-2 hover:text-emerald-700 hover:underline cursor-pointer"
                          title="Bấm để xem mục tiêu chi tiết"
                        >
                          {fitnessGoal || '--'}
                        </button>
                      </td>

                      {/* PT Sessions & End Date */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className="font-black text-slate-900 block text-sm">
                          {item.remainingPtSessions ?? 0} <span className="text-xs font-semibold text-slate-500">buổi</span>
                        </span>
                        <span className="text-[11px] text-slate-400 block">
                          Hạn: {item.endDate ? new Date(item.endDate).toLocaleDateString('vi-VN') : '--'}
                        </span>
                      </td>

                      {/* Latest Inbody Snapshot */}
                      <td className="py-4 px-4 whitespace-nowrap">
                        {latestInbody ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-bold text-slate-900">
                                {sanitizeText(latestInbody.weightKg) ? `${latestInbody.weightKg} kg` : '--'}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-600">
                                Cơ: {muscleText(latestInbody)}
                              </span>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-600">
                                Mỡ: {fatText(latestInbody)}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-400 block">
                              Đo ngày: {new Date(latestInbody.measuredAt).toLocaleDateString('vi-VN')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Chưa đo InBody</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`${coachBasePath}/inbody?memberId=${user.id || item.id}`}
                            className="inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-3 rounded-xl transition-colors shadow-2xs"
                          >
                            <Activity className="h-3.5 w-3.5 mr-1" />
                            <span>Đo InBody</span>
                          </Link>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedMember(item)}
                            className="text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 h-8 px-3 rounded-xl cursor-pointer border-slate-300"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />
                            <span>Hồ sơ</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalItems={members.length}
            itemsPerPage={ITEMS_PER_PAGE}
            onPageChange={setCurrentPage}
            itemName="học viên"
          />
        </>
      )}
      </div>

      {/* 4. Member Profile Details Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50 text-slate-900 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Hồ sơ học viên: {sanitizeText(selectedMember.user?.fullName, 'Học viên')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {sanitizeText(selectedMember.user?.phone) ||
                    sanitizeText(selectedMember.user?.email) ||
                    'Chưa cập nhật thông tin liên hệ'}
                </p>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                type="button"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              {/* Profile Details */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-xs">
                <p className="font-black text-slate-900 text-sm mb-2">Thông tin thể trạng</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Mục tiêu luyện tập:</span>
                    <span className="font-bold text-slate-900">
                      {sanitizeText(selectedMember.user?.memberProfile?.fitnessGoals, 'Chưa cập nhật')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Chiều cao:</span>
                    <span className="font-bold text-slate-900">
                      {sanitizeText(selectedMember.user?.memberProfile?.heightCm)
                        ? `${selectedMember.user?.memberProfile?.heightCm} cm`
                        : 'Chưa cập nhật'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block text-[11px]">Tiền sử chấn thương / bệnh lý:</span>
                    <span className="font-bold text-slate-900">
                      {sanitizeText(selectedMember.user?.memberProfile?.medicalHistory, 'Không có')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inbody Logs History Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Lịch sử đo InBody ({selectedMember.user?.memberInbodyLogs?.length || 0})
                  </h4>
                  <Link
                    to={`/portal/coach/inbody?memberId=${selectedMember.user?.id || selectedMember.id}`}
                    className="inline-flex items-center justify-center h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl cursor-pointer transition-colors shadow-2xs"
                  >
                    <Activity className="h-3.5 w-3.5 mr-1" />
                    <span>Đo InBody</span>
                  </Link>
                </div>

                {Array.isArray(selectedMember.user?.memberInbodyLogs) &&
                selectedMember.user.memberInbodyLogs.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Ngày đo</th>
                          <th className="p-3">Cân nặng</th>
                          <th className="p-3">Lượng cơ</th>
                          <th className="p-3">Lượng mỡ</th>
                          <th className="p-3">Điểm InBody</th>
                          <th className="p-3">Ghi chú</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {[...selectedMember.user.memberInbodyLogs].reverse().map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-900 font-bold">
                              {new Date(log.measuredAt).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="p-3 text-slate-800 font-bold">
                              {sanitizeText(log.weightKg) ? `${log.weightKg} kg` : '--'}
                            </td>
                            <td className="p-3 text-emerald-600 font-bold">
                              {muscleText(log)}
                            </td>
                            <td className="p-3 text-slate-700">
                              {fatText(log)}
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              {sanitizeText(log.inbodyScore, '--')}
                            </td>
                            <td className="p-3 text-slate-500 max-w-xs truncate">
                              {sanitizeText(log.notes, '--')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-3 text-center">
                    Chưa có lịch sử đo InBody nào được ghi nhận.
                  </p>
                )}
              </div>

              {/* Attendance History Section */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                  Lịch sử tham gia buổi tập ({memberAttendances.length})
                </h4>
                {memberAttendances.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                          <th className="p-3">Thời gian</th>
                          <th className="p-3">Loại ca</th>
                          <th className="p-3">Trạng thái</th>
                          <th className="p-3">Nhật ký của HLV</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {memberAttendances.slice(0, 10).map((att: any) => (
                          <tr key={att.id} className="hover:bg-slate-50/50">
                            <td className="p-3 text-slate-900 font-bold">
                              {new Date(att.checkInTime).toLocaleString('vi-VN')}
                            </td>
                            <td className="p-3 text-slate-700">
                              {att.checkinType === 'GATE_ENTRY' ? 'Vào cửa' : 'Buổi tập'}
                            </td>
                            <td className="p-3">
                              <span
                                className={`rounded-lg px-2.5 py-0.5 text-[10px] font-bold ${
                                  att.status === 'PRESENT' || att.status === 'ATTENDED'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {att.status === 'PRESENT' || att.status === 'ATTENDED'
                                  ? 'Có mặt'
                                  : 'Vắng mặt'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 max-w-xs truncate">
                              {sanitizeText(att.notes, '--')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-3 text-center">
                    Chưa có lịch sử tham gia buổi tập nào được ghi nhận.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end p-4 border-t border-slate-200 bg-slate-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedMember(null)}
                className="text-xs font-bold cursor-pointer rounded-xl px-4"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Member Goal & Profile Modal */}
      <MemberGoalModal
        member={goalModalMember}
        isOpen={Boolean(goalModalMember)}
        onClose={() => setGoalModalMember(null)}
      />
    </div>
  );
};
