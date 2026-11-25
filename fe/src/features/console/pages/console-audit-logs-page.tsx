import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  RefreshCw,
  Loader2,
  FileText,
  User,
  Clock,
  Globe,
  Code,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { consoleApi, type AuditLogItem } from '../api/console-api';

export const ConsoleAuditLogsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const {
    data: logs = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['console', 'audit-logs'],
    queryFn: consoleApi.getAuditLogs,
  });

  const filteredLogs = logs.filter(
    (l) =>
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.entityType.toLowerCase().includes(search.toLowerCase()) ||
      (l.actorId && l.actorId.toLowerCase().includes(search.toLowerCase())) ||
      (l.ipAddress && l.ipAddress.includes(search))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Nhật Ký Kiểm Toán Hệ Thống (Audit Trail)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Lịch sử ghi nhận toàn bộ các thao tác nghiệp vụ, bảo mật, xác thực và thay đổi dữ liệu nhạy cảm.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isLoading || isRefetching}
          className="self-start sm:self-auto text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Tải lại log</span>
        </Button>
      </div>

      {/* Main Table Panel */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Lọc theo action, entity, actor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:border-indigo-500"
            />
          </div>
          <span className="text-xs text-slate-500 font-semibold">
            Hiển thị <strong className="text-slate-800">{filteredLogs.length}</strong> / {logs.length} bản ghi gần nhất
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Hành động (Action)</th>
                <th className="px-5 py-3.5">Thực thể (Entity)</th>
                <th className="px-5 py-3.5">Tác nhân (Actor)</th>
                <th className="px-5 py-3.5">Địa chỉ IP</th>
                <th className="px-5 py-3.5">Thời gian</th>
                <th className="px-5 py-3.5 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700 font-mono text-[11px]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans text-xs">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    Đang truy vấn nhật ký kiểm toán...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-sans text-xs">
                    <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    Không tìm thấy bản ghi nhật ký phù hợp.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3 font-sans">
                      <span className="font-bold text-slate-900 block">{log.action}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-indigo-50 text-indigo-700 px-1.5 py-0.5 text-[10px] font-bold">
                        {log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          #{log.entityId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-sans">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <User className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[130px]">{log.actorId ? log.actorId.slice(0, 8) : 'SYSTEM'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Globe className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{log.ipAddress || 'Internal'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500 font-sans tabular-nums">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{new Date(log.createdAt).toLocaleString('vi-VN')}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Xem JSON
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-700 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-bold">Chi tiết bản ghi #{selectedLog.id.slice(0, 12)}</h3>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-white"
              >
                Đóng
              </Button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-indigo-200 bg-slate-900/90">
              <pre className="whitespace-pre-wrap leading-relaxed">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
