import { useQuery } from '@tanstack/react-query'
import { money } from '@/lib/api'
import { AlertTriangle, Award, ShieldAlert } from 'lucide-react'
import { managerApi, managerKeys } from '../api/manager-api'
import { errorMessage } from '../lib/format'
import {
  EmptyRow,
  PageHeader,
  Panel,
  Stat,
  StateMessage,
  Table,
  Td,
  Th,
} from '../components/manager-ui'

function Bar({ value, max }: { value: number; max: number }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-2 w-full rounded-sm bg-slate-100">
      <div className="h-2 rounded-sm bg-[#17664e]" style={{ width: `${width}%` }} />
    </div>
  )
}

const share = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)}%` : '0%'

export function ManagerReportsPage() {
  const revenue = useQuery({ queryKey: managerKeys.revenue, queryFn: managerApi.revenue })
  const kpi = useQuery({ queryKey: managerKeys.kpi, queryFn: managerApi.kpi })
  const topPlans = useQuery({ queryKey: ['manager', 'top-plans'], queryFn: managerApi.topPlans })
  const topCoaches = useQuery({ queryKey: ['manager', 'top-coaches'], queryFn: managerApi.topCoaches })
  const dss = useQuery({ queryKey: ['manager', 'dss-summary'], queryFn: managerApi.dssSummary })

  const r = revenue.data
  const disciplines = Object.entries(r?.byDiscipline ?? {}).sort((a, b) => b[1] - a[1])
  const topDiscipline = disciplines[0]?.[1] ?? 0
  const coaches = [...(kpi.data?.coaches ?? [])].sort(
    (a, b) => b._count.coachedSchedules - a._count.coachedSchedules,
  )
  const rooms = [...(kpi.data?.rooms ?? [])].sort(
    (a, b) => b.totalScheduledHours - a.totalScheduledHours,
  )
  const topRoom = rooms[0]?.totalScheduledHours ?? 0

  const dssData = dss.data

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Báo cáo & Hỗ trợ Quyết định (DSS)"
        description="Tổng quan doanh thu, số liệu vận hành và hệ thống cảnh báo kỷ luật HLV."
      />

      {/* DSS Operational Intelligence Banner */}
      {dssData && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50/60 p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-5 w-5 text-amber-700" />
            <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
              Cảnh báo Vận hành & Quyết định Quản lý (DSS)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border border-amber-200/80 bg-white p-3.5">
              <span className="text-xs text-slate-500 font-medium">Đơn hủy khẩn chờ duyệt</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {dssData.pendingCancellationRequests ?? 0}
                </span>
                <span className="text-[11px] text-amber-700 font-bold">
                  {dssData.pendingCancellationRequests > 0 ? 'Cần xử lý ngay' : 'Đã duyệt hết'}
                </span>
              </div>
            </div>

            <div className="rounded-md border border-amber-200/80 bg-white p-3.5">
              <span className="text-xs text-slate-500 font-medium">Chế tài kỷ luật chưa xem</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900">
                  {dssData.unreviewedPenalties ?? 0}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">Ghi nhận vi phạm</span>
              </div>
            </div>

            <div className="rounded-md border border-amber-200/80 bg-white p-3.5">
              <span className="text-xs text-slate-500 font-medium">HLV vi phạm ngưỡng hủy</span>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={`text-2xl font-black ${(dssData.flaggedCoaches?.length ?? 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {dssData.flaggedCoaches?.length ?? 0}
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">HLV {'>='} 2 lần/tháng</span>
              </div>
            </div>
          </div>

          {(dssData.flaggedCoaches?.length ?? 0) > 0 && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2">
              <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                Đề xuất can thiệp hợp đồng HLV:
              </span>
              <div className="space-y-1">
                {dssData.flaggedCoaches.map((c: any) => (
                  <div key={c.coachId} className="flex items-center justify-between text-xs text-rose-950 bg-white/80 px-3 py-1.5 rounded-lg border border-rose-100">
                    <span className="font-semibold">{c.fullName} ({c.phone || 'Chưa có SĐT'})</span>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-rose-100 text-rose-800 text-[10px] font-bold px-1.5 py-0.5">
                        {c.monthlyEmergencyCancellations} lần hủy/tháng
                      </span>
                      <span className="text-[11px] font-bold text-rose-700">
                        {c.recommendation === 'CRITICAL_REVIEW_RATE_REDUCTION'
                          ? 'Đề xuất: Giảm bậc Rate / Tạm dừng nhận lớp'
                          : 'Đề xuất: Nhắc nhở cảnh cáo'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {revenue.isLoading || revenue.isError ? (
        <Panel className="mb-6">
          <StateMessage
            loading={revenue.isLoading}
            error={revenue.isError ? errorMessage(revenue.error) : null}
            onRetry={() => void revenue.refetch()}
          />
        </Panel>
      ) : r ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat label="Tổng doanh thu" value={money(r.totalRevenue)} />
            <Stat
              label="Gói cơ bản"
              value={money(r.baseRevenue)}
              hint={`${share(r.baseRevenue, r.totalRevenue)} tổng`}
            />
            <Stat
              label="PT"
              value={money(r.ptRevenue)}
              hint={`${share(r.ptRevenue, r.totalRevenue)} tổng`}
            />
          </div>
          <Panel title="Doanh thu theo môn" className="mb-6">
            <Table>
              <thead>
                <tr>
                  <Th>Môn</Th>
                  <Th className="w-1/2" />
                  <Th className="text-right">Doanh thu</Th>
                  <Th className="text-right">Tỷ trọng</Th>
                </tr>
              </thead>
              <tbody>
                {disciplines.length === 0 ? (
                  <EmptyRow colSpan={4}>Chưa có hóa đơn đã thanh toán.</EmptyRow>
                ) : (
                  disciplines.map(([code, amount]) => (
                    <tr key={code}>
                      <Td className="font-medium text-slate-900">
                        {code === 'UNSPECIFIED' ? 'Chưa phân môn' : code}
                      </Td>
                      <Td>
                        <Bar value={amount} max={topDiscipline} />
                      </Td>
                      <Td className="text-right tabular-nums">{money(amount)}</Td>
                      <Td className="text-right tabular-nums">{share(amount, r.totalRevenue)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          </Panel>
        </>
      ) : null}

      {/* Top Plans & Top Coaches Row */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Plans */}
        <Panel title="Gói tập bán chạy nhất (30 ngày gần nhất)">
          {topPlans.isLoading || topPlans.isError ? (
            <StateMessage
              loading={topPlans.isLoading}
              error={topPlans.isError ? errorMessage(topPlans.error) : null}
              onRetry={() => void topPlans.refetch()}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Tên gói tập</Th>
                  <Th>Phân hạng</Th>
                  <Th className="text-right">Số lượng bán</Th>
                  <Th className="text-right">Doanh thu</Th>
                </tr>
              </thead>
              <tbody>
                {(topPlans.data?.length ?? 0) === 0 ? (
                  <EmptyRow colSpan={4}>Chưa có dữ liệu bán gói trong 30 ngày qua.</EmptyRow>
                ) : (
                  (topPlans.data ?? []).map((p: any) => (
                    <tr key={p.planId}>
                      <Td className="font-medium text-slate-900">{p.planName}</Td>
                      <Td>
                        <span className="rounded bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5">
                          {p.tier} ({p.discipline})
                        </span>
                      </Td>
                      <Td className="text-right tabular-nums font-bold text-slate-800">{p.salesCount}</Td>
                      <Td className="text-right tabular-nums text-emerald-700 font-bold">{money(p.totalRevenue)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </Panel>

        {/* Top Coaches */}
        <Panel title="HLV có đơn giá (Rate) cao nhất & Lớp hoàn thành">
          {topCoaches.isLoading || topCoaches.isError ? (
            <StateMessage
              loading={topCoaches.isLoading}
              error={topCoaches.isError ? errorMessage(topCoaches.error) : null}
              onRetry={() => void topCoaches.refetch()}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Huấn luyện viên</Th>
                  <Th className="text-right">Rate hiện tại</Th>
                  <Th className="text-right">Lớp đã dạy</Th>
                </tr>
              </thead>
              <tbody>
                {(topCoaches.data?.length ?? 0) === 0 ? (
                  <EmptyRow colSpan={3}>Chưa có HLV.</EmptyRow>
                ) : (
                  (topCoaches.data ?? []).map((c: any) => (
                    <tr key={c.coachId}>
                      <Td className="font-medium text-slate-900 flex items-center gap-2">
                        <Award className="h-4 w-4 text-amber-500" />
                        <span>{c.fullName}</span>
                      </Td>
                      <Td className="text-right tabular-nums font-bold text-indigo-700">
                        {money(c.currentRate)} / ca
                      </Td>
                      <Td className="text-right tabular-nums font-bold text-slate-800">
                        {c.completedClasses} lớp
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="KPI huấn luyện viên">
          {kpi.isLoading || kpi.isError ? (
            <StateMessage
              loading={kpi.isLoading}
              error={kpi.isError ? errorMessage(kpi.error) : null}
              onRetry={() => void kpi.refetch()}
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>HLV</Th>
                  <Th className="text-right">Lớp được xếp</Th>
                  <Th className="text-right">Slot PT đã mở</Th>
                  <Th className="text-right">Hủy khẩn tháng này</Th>
                  <Th className="text-right">Tổng hủy khẩn</Th>
                </tr>
              </thead>
              <tbody>
                {coaches.length === 0 ? (
                  <EmptyRow colSpan={5}>Chưa có HLV.</EmptyRow>
                ) : (
                  coaches.map((coach) => {
                    const monthly = coach.coachProfile?.monthlyEmergencyCancellations ?? 0
                    return (
                      <tr key={coach.id}>
                        <Td className="font-medium text-slate-900">{coach.fullName}</Td>
                        <Td className="text-right tabular-nums">{coach._count.coachedSchedules}</Td>
                        <Td className="text-right tabular-nums">
                          {coach._count.coachAvailabilities}
                        </Td>
                        <Td
                          className={
                            monthly > 0
                              ? 'text-right tabular-nums text-rose-700'
                              : 'text-right tabular-nums'
                          }
                        >
                          {monthly}
                        </Td>
                        <Td className="text-right tabular-nums">
                          {coach.coachProfile?.emergencyCancellationCount ?? 0}
                        </Td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </Table>
          )}
        </Panel>

        <Panel title="Giờ sử dụng phòng">
          {kpi.isLoading || kpi.isError ? (
            <StateMessage
              loading={kpi.isLoading}
              error={kpi.isError ? errorMessage(kpi.error) : null}
            />
          ) : (
            <ul className="space-y-3 p-4">
              {rooms.length === 0 ? (
                <li className="text-sm text-slate-400">Chưa có phòng.</li>
              ) : null}
              {rooms.map((room) => (
                <li key={room.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="text-slate-700">{room.name}</span>
                    <span className="tabular-nums text-slate-500">
                      {room.totalScheduledHours.toFixed(1)} giờ
                    </span>
                  </div>
                  <Bar value={room.totalScheduledHours} max={topRoom} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
