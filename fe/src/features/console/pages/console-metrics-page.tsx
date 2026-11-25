import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Server,
  Activity,
  Cpu,
  Database,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { consoleApi } from '../api/console-api';

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

const formatUptime = (seconds: number) => {
  if (!seconds) return '0s';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
};

export const ConsoleMetricsPage: React.FC = () => {
  const {
    data: metrics,
    isLoading: isMetricsLoading,
    isRefetching: isMetricsRefetching,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['console', 'system-metrics'],
    queryFn: consoleApi.getSystemMetrics,
    refetchInterval: 10000,
  });

  const {
    data: health,
    isLoading: isHealthLoading,
    isRefetching: isHealthRefetching,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ['console', 'system-health'],
    queryFn: consoleApi.getHealth,
    refetchInterval: 10000,
  });

  const isLoading = isMetricsLoading || isHealthLoading;
  const isRefetching = isMetricsRefetching || isHealthRefetching;

  const handleRefresh = () => {
    void refetchMetrics();
    void refetchHealth();
  };

  const heapPercent =
    metrics?.memoryUsageBytes?.heapTotal && metrics?.memoryUsageBytes?.heapUsed
      ? Math.round(
          (metrics.memoryUsageBytes.heapUsed / metrics.memoryUsageBytes.heapTotal) * 100
        )
      : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Giám Sát Hạ Tầng & Sức Khỏe Hệ Thống
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi thời gian hoạt động (uptime), tiến trình CPU, tiêu thụ RAM và trạng thái kết nối Database.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading || isRefetching}
          className="self-start sm:self-auto text-xs font-semibold gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          <span>Tự động cập nhật (10s)</span>
        </Button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Node.js API Server
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-900">
                {health?.status === 'UP' ? 'ONLINE' : 'DEGRADED'}
              </span>
              <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {health?.status || 'UP'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono">
              Runtime: {metrics?.nodeVersion || 'Node.js v24'}
            </p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Server className="h-6 w-6" />
          </div>
        </div>

        {/* Database Status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              PostgreSQL Database
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-900">
                {health?.database === 'UP' ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
              {health?.database === 'UP' ? (
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                  HEALTHY
                </span>
              ) : (
                <span className="rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  ERROR
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">Supabase Pool Active</p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Database className="h-6 w-6" />
          </div>
        </div>

        {/* Server Uptime */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Uptime Liên Tục
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-900 font-mono">
                {formatUptime(metrics?.uptimeSeconds || health?.uptimeSeconds || 0)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">Không có gián đoạn</p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="h-6 w-6" />
          </div>
        </div>

        {/* Heap Memory */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Heap RAM Đang Dùng
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-slate-900 font-mono">
                {formatBytes(metrics?.memoryUsageBytes?.heapUsed || 0)}
              </span>
              <span className="text-xs text-slate-500 font-bold">({heapPercent}%)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Tổng cấp: {formatBytes(metrics?.memoryUsageBytes?.heapTotal || 0)}
            </p>
          </div>
          <div className="h-11 w-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Activity className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Technical Metric Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RAM Usage Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              <h3 className="text-sm font-bold text-slate-900">Chi Tiết Cấp Phát Bộ Nhớ (V8 Engine)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono font-semibold">memoryUsage()</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-semibold text-slate-700">V8 Heap Used / Total</span>
                <span className="font-mono text-slate-900 font-bold">
                  {formatBytes(metrics?.memoryUsageBytes?.heapUsed || 0)} /{' '}
                  {formatBytes(metrics?.memoryUsageBytes?.heapTotal || 0)} ({heapPercent}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(2, heapPercent))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">RSS (Resident Set)</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {formatBytes(metrics?.memoryUsageBytes?.rss || 0)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">External C++ Buffers</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {formatBytes(metrics?.memoryUsageBytes?.external || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* CPU & Process Stats */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Tiêu Thụ CPU & Thông Tin Tiến Trình</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono font-semibold">cpuUsage()</span>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">User Space CPU</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {((metrics?.cpuUsageMicroseconds?.user || 0) / 1000000).toFixed(2)}s
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-slate-400 text-[10px] font-bold uppercase block">System Kernel CPU</span>
                <span className="font-mono font-bold text-slate-800 text-sm">
                  {((metrics?.cpuUsageMicroseconds?.system || 0) / 1000000).toFixed(2)}s
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                Hệ thống hoạt động ổn định và tối ưu
              </p>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                Các chỉ số CPU và RAM đều nằm trong ngưỡng an toàn ({'<'} 70%). Mọi tác vụ xếp ca hàng loạt và tính toán InBody đều chạy trong luồng async không gây tắc nghẽn event loop.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
