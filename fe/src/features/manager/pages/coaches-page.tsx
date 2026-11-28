import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign,
  CheckCircle2,
  Clock,
  QrCode,
  AlertCircle,
} from 'lucide-react'
import { useNotification } from '@/context/notification-context'
import { cn } from '@/lib/utils'
import { managerApi, managerKeys } from '../api/manager-api'
import type { CoachPayoutItem } from '../types/manager.types'
import { errorMessage, formatDate, formatTime, formatCurrency } from '../lib/format'
import {
  Btn,
  EmptyRow,
  Modal,
  PageHeader,
  Panel,
  StateMessage,
  Table,
  Td,
  Th,
} from '../components/manager-ui'

const BANK_QR_CODES: Record<string, string> = {
  Vietcombank: 'VCB',
  Techcombank: 'TCB',
  'MB Bank': 'MB',
  MBBank: 'MB',
  VietinBank: 'ICB',
  BIDV: 'BIDV',
  ACB: 'ACB',
  VPBank: 'VPB',
  TPBank: 'TPB',
  Sacombank: 'STB',
  VIB: 'VIB',
  HDBank: 'HDB',
}

export function ManagerCoachesPage() {
  const queryClient = useQueryClient()
  const { showToast } = useNotification()

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    return `${now.getFullYear()}-${m}`
  })

  // Selected coach for viewing details
  const [viewingCoachId, setViewingCoachId] = useState<string | null>(null)
  // Selected coach for paying via QR
  const [payingCoach, setPayingCoach] = useState<CoachPayoutItem | null>(null)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  const payouts = useQuery({
    queryKey: managerKeys.payouts(selectedMonth),
    queryFn: () => managerApi.payoutSummary(selectedMonth),
  })

  const detailsQuery = useQuery({
    queryKey: managerKeys.payoutDetails(viewingCoachId || '', selectedMonth),
    queryFn: () => managerApi.payoutDetails(viewingCoachId || '', selectedMonth),
    enabled: !!viewingCoachId,
  })

  const payMutation = useMutation({
    mutationFn: ({
      coachId,
      note,
      receiptUrl,
    }: {
      coachId: string
      note: string
      receiptUrl?: string
    }) => managerApi.payCoach(coachId, selectedMonth, note, receiptUrl),
    onSuccess: () => {
      showToast(
        'success',
        'Thanh toán thành công',
        `Đã quyết toán chuyển khoản lương cho HLV ${payingCoach?.coachName || ''} thành công!`,
      )
      setPayingCoach(null)
      setReceiptUrl('')
      setPaymentNote('')
      void queryClient.invalidateQueries({ queryKey: managerKeys.payouts(selectedMonth) })
    },
    onError: (err) => {
      showToast('error', 'Lỗi thanh toán', errorMessage(err))
    },
  })

  const list = payouts.data ?? []
  const totalGroupSessions = list.reduce((sum, item) => sum + item.groupSessionCount, 0)
  const totalPtSessions = list.reduce((sum, item) => sum + item.ptSessionCount, 0)
  const totalAllSessions = totalGroupSessions + totalPtSessions
  const totalPayrollAmount = list.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)
  const totalPaid = list
    .filter((item) => item.status === 'PAID')
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0)

  // Parse month to display previous 20th to current 20th
  const [yStr, mStr] = selectedMonth.split('-')
  const yNum = Number(yStr)
  const mNum = Number(mStr)
  const prevMonthDate = new Date(yNum, mNum - 2, 20)
  const currentMonthDate = new Date(yNum, mNum - 1, 20)
  const cycleText = `Từ 20/${prevMonthDate.getMonth() + 1}/${prevMonthDate.getFullYear()} đến 20/${currentMonthDate.getMonth() + 1}/${currentMonthDate.getFullYear()}`

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Trả phí Huấn luyện viên"
        description="Quyết toán chi trả thù lao ca dạy định kỳ và tạo mã VietQR thanh toán nhanh."
      />

      {/* Month & Cycle Filter Banner */}
      <Panel className="p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Bảng thanh toán lương Huấn luyện viên
            </h3>
            <p className="text-xs text-slate-500">
              Quy định chu kỳ tính lương trung tâm: <strong>{cycleText}</strong>. Thống kê toàn bộ ca dạy Lớp nhóm và ca PT 1-1 đã hoàn thành.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-slate-600 shrink-0">Kỳ thanh toán:</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white shadow-2xs focus:border-[#17664e] focus:outline-none"
            />
          </div>
        </div>
      </Panel>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Tổng số HLV
          </span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">
            {list.length} <span className="text-xs font-semibold text-slate-400">HLV</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
            Tổng số ca hoàn thành
          </span>
          <span className="text-2xl font-black text-slate-800 mt-1 block">
            {totalAllSessions} <span className="text-xs font-semibold text-slate-400">ca ({totalPtSessions} PT + {totalGroupSessions} Nhóm)</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase text-emerald-800 block tracking-wider">
            Tổng quỹ lương kỳ này
          </span>
          <span className="text-2xl font-black text-[#17664e] mt-1 block">
            {formatCurrency(totalPayrollAmount)}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-extrabold uppercase text-slate-500 block tracking-wider">
            Đã thanh toán
          </span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            {formatCurrency(totalPaid)}
          </span>
        </div>
      </div>

      {/* Coaches Payroll Table */}
      <Panel title={`Danh sách quyết toán lương HLV kỳ ${selectedMonth}`}>
        {payouts.isLoading || payouts.isError ? (
          <StateMessage
            loading={payouts.isLoading}
            error={payouts.isError ? errorMessage(payouts.error) : null}
            onRetry={() => void payouts.refetch()}
          />
        ) : list.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">
            Không có dữ liệu ca dạy nào trong kỳ {selectedMonth}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>HLV</Th>
                  <Th>Tài khoản Ngân hàng</Th>
                  <Th className="text-center">Ca nhóm</Th>
                  <Th className="text-center">Ca PT 1:1</Th>
                  <Th className="text-center">Tổng ca</Th>
                  <Th className="text-right">Đơn giá / ca</Th>
                  <Th className="text-right">Tổng tiền lương</Th>
                  <Th className="text-center">Trạng thái</Th>
                  <Th className="text-right">Thao tác</Th>
                </tr>
              </thead>
              <tbody>
                {list.map((item) => {
                  const isPaid = item.status === 'PAID'
                  return (
                    <tr key={item.coachId} className="hover:bg-slate-50/80 transition-colors">
                      <Td>
                        <div className="font-bold text-slate-900">{item.coachName}</div>
                        <div className="text-[11px] text-slate-400">{item.phone || item.email}</div>
                      </Td>
                      <Td>
                        {item.bankName && item.bankAccountNumber ? (
                          <div>
                            <span className="font-semibold text-slate-800 text-xs">
                              {item.bankName} - {item.bankAccountNumber}
                            </span>
                            <span className="text-[11px] text-slate-400 block">
                              {item.bankAccountName || item.coachName}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600 font-medium italic">
                            Chưa cập nhật STK
                          </span>
                        )}
                      </Td>
                      <Td className="text-center font-semibold text-slate-700">
                        {item.groupSessionCount}
                      </Td>
                      <Td className="text-center font-semibold text-slate-700">
                        {item.ptSessionCount}
                      </Td>
                      <Td className="text-center font-black text-slate-900">
                        {item.totalSessions}
                      </Td>
                      <Td className="text-right font-mono text-slate-600 text-xs">
                        {formatCurrency(Number(item.ratePerSession))}
                      </Td>
                      <Td className="text-right font-black text-[#17664e] text-sm">
                        {formatCurrency(Number(item.totalAmount))}
                      </Td>
                      <Td className="text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã quyết toán
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3 text-amber-600" /> Chưa thanh toán
                          </span>
                        )}
                      </Td>
                      <Td className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Btn
                            size="sm"
                            tone="ghost"
                            onClick={() => setViewingCoachId(item.coachId)}
                          >
                            Xem chi tiết
                          </Btn>
                          <Btn
                            size="sm"
                            tone={isPaid ? 'ghost' : 'primary'}
                            onClick={() => {
                              setPayingCoach(item)
                              setReceiptUrl(item.receiptUrl || '')
                              setPaymentNote(item.paymentNote || '')
                            }}
                          >
                            <QrCode className="w-3.5 h-3.5 mr-1" />
                            {isPaid ? 'Xem lại QR & Biên lai' : 'Thanh toán'}
                          </Btn>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </div>
        )}
      </Panel>

      {/* Session Details Modal ("Xem chi tiết") */}
      {viewingCoachId && (
        <Modal
          wide
          className="max-w-4xl"
          title={`Bảng kê ca dạy — ${detailsQuery.data?.coachName || 'HLV'}`}
          onClose={() => setViewingCoachId(null)}
          footer={<Btn onClick={() => setViewingCoachId(null)}>Đóng</Btn>}
        >
          {detailsQuery.isLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Đang tải bảng kê chi tiết...
            </div>
          ) : detailsQuery.isError ? (
            <div className="py-12 text-center text-sm text-rose-600">
              {errorMessage(detailsQuery.error)}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 py-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-xs text-slate-500 block">Chu kỳ tính lương</span>
                  <span className="mt-1 font-medium text-slate-900 text-sm tabular-nums block">
                    {detailsQuery.data?.cycleRange}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Tổng số ca dạy</span>
                  <span className="mt-1 font-medium text-slate-900 text-sm tabular-nums block">
                    {(detailsQuery.data?.sessions || []).length} ca
                  </span>
                </div>
                <div className="sm:text-right">
                  <span className="text-xs text-slate-500 block">Tổng thù lao</span>
                  <span className="mt-1 font-semibold text-[#17664e] text-base tabular-nums block">
                    {formatCurrency(Number(detailsQuery.data?.totalAmount || 0))}
                  </span>
                </div>
              </div>

              {/* Sessions Table */}
              <div className="max-h-96 overflow-y-auto border border-slate-200/80 rounded-xl bg-white">
                <Table>
                  <thead>
                    <tr className="bg-slate-50/70">
                      <Th className="w-36">Thời gian</Th>
                      <Th className="w-36">Loại ca</Th>
                      <Th>Lớp / Học viên</Th>
                      <Th className="text-right w-32">Thù lao</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(detailsQuery.data?.sessions || []).length === 0 ? (
                      <EmptyRow colSpan={4}>Không có ca dạy nào trong kỳ này</EmptyRow>
                    ) : (
                      detailsQuery.data?.sessions.map((s: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <Td className="whitespace-nowrap">
                            <span className="font-medium text-slate-900 text-xs tabular-nums block">
                              {formatDate(s.startTime)}
                            </span>
                            <span className="text-xs text-slate-500 tabular-nums mt-0.5 block">
                              {formatTime(s.startTime)} – {formatTime(s.endTime)}
                            </span>
                          </Td>
                          <Td className="whitespace-nowrap">
                            <span
                              className={cn(
                                'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border',
                                s.type === 'PT'
                                  ? 'bg-slate-100/80 text-slate-700 border-slate-200/80'
                                  : 'bg-emerald-50/70 text-[#17664e] border-emerald-200/70',
                              )}
                            >
                              <span
                                className={cn(
                                  'w-1.5 h-1.5 rounded-full',
                                  s.type === 'PT' ? 'bg-slate-500' : 'bg-[#17664e]',
                                )}
                              />
                              {s.typeName}
                            </span>
                          </Td>
                          <Td className="text-xs font-medium text-slate-800 leading-snug">
                            {s.studentOrClass}
                          </Td>
                          <Td className="text-right whitespace-nowrap font-medium text-slate-900 text-xs tabular-nums">
                            {formatCurrency(Number(s.fee))}
                          </Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* QR Payment Modal ("Thanh toán") */}
      {payingCoach && (
        <Modal
          wide
          className="max-w-xl"
          title={`Thanh toán lương — ${payingCoach.coachName}`}
          onClose={() => setPayingCoach(null)}
          footer={
            <>
              <Btn onClick={() => setPayingCoach(null)}>Đóng</Btn>
              {payingCoach.status !== 'PAID' && (
                <Btn
                  tone="primary"
                  disabled={payMutation.isPending}
                  onClick={() =>
                    payMutation.mutate({
                      coachId: payingCoach.coachId,
                      note:
                        paymentNote ||
                        `Quyết toán lương HLV ${payingCoach.coachName} kỳ ${selectedMonth} qua VietQR`,
                      receiptUrl: receiptUrl || undefined,
                    })
                  }
                >
                  {payMutation.isPending ? 'Đang ghi nhận...' : 'Xác nhận chuyển khoản'}
                </Btn>
              )}
            </>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="text-center p-4 bg-slate-50/80 rounded-xl border border-slate-200/80">
              <span className="text-xs text-slate-600 font-medium block mb-2">
                Quét mã VietQR để chuyển tiền lương
              </span>
              <div className="flex justify-center py-2">
                {payingCoach.bankAccountNumber ? (
                  <img
                    src={`https://img.vietqr.io/image/${
                      BANK_QR_CODES[payingCoach.bankName || ''] || 'MB'
                    }-${payingCoach.bankAccountNumber}-compact2.png?amount=${
                      payingCoach.totalAmount
                    }&addInfo=${encodeURIComponent(
                      `Luong HLV ${payingCoach.coachName} ky ${selectedMonth}`,
                    )}&accountName=${encodeURIComponent(
                      payingCoach.bankAccountName || payingCoach.coachName,
                    )}`}
                    alt="VietQR Chuyển khoản"
                    className="w-52 h-auto rounded-lg border border-slate-200/80 bg-white"
                  />
                ) : (
                  <div className="w-52 h-52 rounded-lg bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-4 text-center text-slate-500">
                    <AlertCircle className="w-6 h-6 text-slate-400 mb-2" strokeWidth={1.5} />
                    HLV chưa cập nhật số tài khoản ngân hàng. Vui lòng thanh toán tiền mặt hoặc yêu cầu HLV bổ sung STK.
                  </div>
                )}
              </div>
              <span className="text-xs text-slate-500 mt-1 block">
                Mã QR chuẩn Napas247 tương thích với tất cả ứng dụng ngân hàng tại Việt Nam
              </span>
            </div>

            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500">Huấn luyện viên</span>
                <span className="font-medium text-slate-900">{payingCoach.coachName}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500">Ngân hàng thụ hưởng</span>
                <span className="font-medium text-slate-900">{payingCoach.bankName || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500">Số tài khoản</span>
                <span className="font-medium text-slate-900 tabular-nums text-sm">
                  {payingCoach.bankAccountNumber || '—'}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500">Chủ tài khoản</span>
                <span className="font-medium text-slate-900">
                  {payingCoach.bankAccountName || payingCoach.coachName}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4 pt-2.5 border-t border-slate-200/80">
                <span className="text-slate-700 font-medium">Số tiền thanh toán</span>
                <span className="text-base font-semibold text-[#17664e] tabular-nums">
                  {formatCurrency(Number(payingCoach.totalAmount))}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-500 shrink-0">Nội dung chuyển khoản</span>
                <span className="font-medium text-slate-800 text-right">
                  Luong HLV {payingCoach.coachName} ky {selectedMonth}
                </span>
              </div>
            </div>

            {/* Input Note & Receipt Image */}
            <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200/80 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">
                  Ghi chú thanh toán
                </label>
                <input
                  type="text"
                  value={paymentNote}
                  disabled={payingCoach.status === 'PAID'}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder={`Quyết toán lương HLV ${payingCoach.coachName} kỳ ${selectedMonth} qua VietQR`}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#17664e] disabled:bg-slate-100 disabled:text-slate-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1.5">
                  Ảnh chụp biên lai chuyển khoản (URL)
                </label>
                <input
                  type="text"
                  value={receiptUrl}
                  disabled={payingCoach.status === 'PAID'}
                  onChange={(e) => setReceiptUrl(e.target.value)}
                  placeholder="https://... hoặc đường dẫn ảnh chụp biên lai giao dịch"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#17664e] disabled:bg-slate-100 disabled:text-slate-500 transition-colors"
                />
              </div>

              {receiptUrl && (
                <div className="mt-2 text-center p-3 bg-white rounded-lg border border-slate-200/80">
                  <span className="text-xs text-slate-500 block mb-2 font-medium">
                    Ảnh chụp biên lai đã đính kèm
                  </span>
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={receiptUrl}
                      alt="Biên lai chuyển khoản"
                      className="max-h-48 mx-auto rounded-lg border border-slate-200 hover:opacity-90 transition-opacity cursor-zoom-in"
                    />
                  </a>
                </div>
              )}
            </div>

            {payingCoach.status === 'PAID' && (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 text-[#17664e] rounded-lg text-center font-medium">
                Khoản lương này đã được xác nhận thanh toán
                {payingCoach.paidAt && (
                  <div className="text-xs font-normal text-slate-600 mt-1 tabular-nums">
                    Thời gian: {new Date(payingCoach.paidAt).toLocaleString('vi-VN')}
                    {payingCoach.paidByName ? ` bởi ${payingCoach.paidByName}` : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}
