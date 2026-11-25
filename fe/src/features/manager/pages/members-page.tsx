import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { managerApi, managerKeys } from '../api/manager-api'
import type { MemberSubscription } from '../types/manager.types'
import {
  errorMessage,
  formatDate,
  formatDay,
  subscriptionStatusLabel,
  tierLabel,
} from '../lib/format'
import {
  Btn,
  EmptyRow,
  FormError,
  PageHeader,
  Panel,
  Pill,
  StateMessage,
  Table,
  Td,
  TextInput,
  Th,
  Pagination,
} from '../components/manager-ui'
import { usePagination } from '../lib/use-pagination'
import {
  AvatarButton,
  CreateMemberForm,
  EditMemberForm,
  InbodyPanel,
} from '../components/member-forms'

const statusTone = { ACTIVE: 'green', EXPIRED: 'gray', FROZEN: 'blue' } as const

export function ManagerMembersPage() {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const queryClient = useQueryClient()
  const members = useQuery({
    queryKey: managerKeys.members(q),
    queryFn: () => managerApi.members(q),
  })
  const rows = members.data ?? []
  const { items: pageRows, pager } = usePagination(rows, 15, q)

  const search = (event: FormEvent) => {
    event.preventDefault()
    setQ(draft.trim())
  }

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Hội viên & InBody"
        description="Tra cứu hội viên, hồ sơ, hợp đồng gói tập và chỉ số InBody."
        actions={
          <Btn tone="primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Đăng ký hội viên
          </Btn>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel>
          <form onSubmit={search} className="flex gap-2 border-b border-slate-200 p-3">
            <TextInput
              type="search"
              aria-label="Tìm hội viên"
              placeholder="Tên, email hoặc số điện thoại"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Btn type="submit" tone="primary">
              Tìm
            </Btn>
          </form>
          {members.isLoading || members.isError ? (
            <StateMessage
              loading={members.isLoading}
              error={members.isError ? errorMessage(members.error) : null}
              onRetry={() => void members.refetch()}
            />
          ) : (
            <>
              <p className="px-4 pt-2 text-xs text-slate-400">
                {q ? `${rows.length} kết quả cho “${q}”` : `${rows.length} hội viên mới nhất`}
              </p>
              <ul className="divide-y divide-slate-100">
                {rows.length === 0 ? (
                  <li className="px-4 py-8 text-center text-sm text-slate-400">
                    Không tìm thấy hội viên.
                  </li>
                ) : null}
                {pageRows.map((member) => (
                  <li key={member.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(member.id)}
                      className={cn(
                        'w-full px-4 py-2.5 text-left hover:bg-slate-50',
                        member.id === selectedId && 'bg-emerald-50/60',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900">
                          {member.fullName}
                        </span>
                        {member.isActive ? null : <Pill>Đã khóa</Pill>}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {member.phone} {member.email}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination pager={pager} />
            </>
          )}
        </Panel>
        {selectedId ? (
          <MemberDetail key={selectedId} memberId={selectedId} />
        ) : (
          <Panel>
            <p className="px-4 py-12 text-center text-sm text-slate-400">
              Chọn một hội viên để xem hợp đồng.
            </p>
          </Panel>
        )}
      </div>
      {creating ? (
        <CreateMemberForm
          onClose={() => setCreating(false)}
          onSaved={(member) => {
            setCreating(false)
            void queryClient.invalidateQueries({ queryKey: ['manager', 'members'] })
            setSelectedId(member.id)
          }}
        />
      ) : null}
    </div>
  )
}

function MemberDetail({ memberId }: { memberId: string }) {
  const queryClient = useQueryClient()
  const member = useQuery({
    queryKey: managerKeys.member(memberId),
    queryFn: () => managerApi.member(memberId),
  })
  const subscriptions = useQuery({
    queryKey: managerKeys.memberSubscriptions(memberId),
    queryFn: () => managerApi.memberSubscriptions(memberId),
  })
  const [error, setError] = useState<string | null>(null)
  const status = useMutation({
    mutationFn: (sub: MemberSubscription) =>
      managerApi.setSubscriptionStatus(sub.id, sub.status === 'FROZEN' ? 'ACTIVE' : 'FROZEN'),
    onSuccess: () => {
      setError(null)
      void queryClient.invalidateQueries({ queryKey: managerKeys.memberSubscriptions(memberId) })
    },
    onError: (err) => setError(errorMessage(err)),
  })
  const m = member.data
  const [editing, setEditing] = useState(false)
  const refreshMember = () =>
    void queryClient.invalidateQueries({ queryKey: managerKeys.member(memberId) })

  return (
    <div className="min-w-0 space-y-6">
      <Panel
        title="Thông tin hội viên"
        actions={
          m ? (
            <div className="flex flex-wrap items-center gap-2">
              <AvatarButton memberId={m.id} onUploaded={refreshMember} />
              <Btn size="sm" onClick={() => setEditing(true)}>
                Sửa hồ sơ
              </Btn>
            </div>
          ) : null
        }
      >
        {member.isLoading || member.isError ? (
          <StateMessage
            loading={member.isLoading}
            error={member.isError ? errorMessage(member.error) : null}
            onRetry={() => void member.refetch()}
          />
        ) : m ? (
          <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
            {m.avatarUrl ? (
              <div className="sm:col-span-2">
                <img
                  src={m.avatarUrl}
                  alt={`Ảnh của ${m.fullName}`}
                  className="h-16 w-16 rounded-full object-cover"
                />
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-slate-500">Họ tên</dt>
              <dd className="font-medium text-slate-900">{m.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Ngày tham gia</dt>
              <dd>{formatDate(m.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
              <dd>{m.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Số điện thoại</dt>
              <dd>{m.phone ?? '—'}</dd>
            </div>
            {m.memberProfile?.heightCm ? (
              <div>
                <dt className="text-xs text-slate-500">Chiều cao</dt>
                <dd>{Number(m.memberProfile.heightCm)} cm</dd>
              </div>
            ) : null}
            {m.memberProfile?.fitnessGoals ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Mục tiêu tập luyện</dt>
                <dd className="whitespace-pre-line">{m.memberProfile.fitnessGoals}</dd>
              </div>
            ) : null}
            {m.memberProfile?.medicalHistory ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-slate-500">Tiền sử bệnh</dt>
                <dd className="whitespace-pre-line">{m.memberProfile.medicalHistory}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Panel>

      <Panel title="Hợp đồng gói tập">
        <FormError inset>{error}</FormError>
        {subscriptions.isLoading || subscriptions.isError ? (
          <StateMessage
            loading={subscriptions.isLoading}
            error={subscriptions.isError ? errorMessage(subscriptions.error) : null}
            onRetry={() => void subscriptions.refetch()}
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Gói</Th>
                <Th>Thời hạn</Th>
                <Th>Buổi còn lại</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {(subscriptions.data ?? []).length === 0 ? (
                <EmptyRow colSpan={5}>Hội viên chưa có gói nào.</EmptyRow>
              ) : (
                (subscriptions.data ?? []).map((sub) => (
                  <tr key={sub.id}>
                    <Td>
                      <div className="font-medium text-slate-900">
                        {sub.plan?.name ?? 'Gói tập'}
                      </div>
                      <div className="text-xs text-slate-400">
                        {tierLabel[sub.packageTier]}
                        {sub.assignedCoach ? `, HLV ${sub.assignedCoach.fullName}` : ''}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">
                      {formatDay(sub.startDate)} – {formatDay(sub.endDate)}
                    </Td>
                    <Td className="tabular-nums">
                      Nhóm {sub.remainingGroupSessions ?? 0}, PT {sub.remainingPtSessions ?? 0}
                    </Td>
                    <Td>
                      <Pill tone={statusTone[sub.status]}>
                        {subscriptionStatusLabel[sub.status]}
                      </Pill>
                      {sub.status === 'FROZEN' && sub.frozenAt ? (
                        <div className="mt-1 text-xs text-slate-400">
                          từ {formatDate(sub.frozenAt)}
                        </div>
                      ) : null}
                    </Td>
                    <Td className="text-right">
                      {sub.status === 'EXPIRED' ? null : (
                        <Btn
                          size="sm"
                          disabled={status.isPending}
                          onClick={() => {
                            const freezing = sub.status === 'ACTIVE'
                            if (
                              window.confirm(
                                freezing
                                  ? 'Đóng băng gói này? Số ngày đóng băng sẽ được cộng thêm khi mở lại.'
                                  : 'Mở lại gói này?',
                              )
                            )
                              status.mutate(sub)
                          }}
                        >
                          {sub.status === 'FROZEN' ? 'Mở lại' : 'Đóng băng'}
                        </Btn>
                      )}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        )}
      </Panel>
      <InbodyPanel memberId={memberId} />
      {editing && m ? (
        <EditMemberForm
          member={m}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            refreshMember()
            void queryClient.invalidateQueries({ queryKey: ['manager', 'members'] })
          }}
        />
      ) : null}
    </div>
  )
}
