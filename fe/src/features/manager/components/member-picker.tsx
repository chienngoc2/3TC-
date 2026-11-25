import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { managerApi, managerKeys } from '../api/manager-api'
import type { UserRow } from '../types/manager.types'
import { errorMessage } from '../lib/format'
import { Btn, TextInput } from './manager-ui'

/** Search members by name, phone or email and pick one. */
export function MemberPicker({
  value,
  onChange,
}: {
  value: UserRow | null
  onChange: (member: UserRow | null) => void
}) {
  const [draft, setDraft] = useState('')
  const [q, setQ] = useState<string | null>(null)
  const results = useQuery({
    queryKey: managerKeys.members(q ?? ''),
    queryFn: () => managerApi.members(q ?? ''),
    enabled: q !== null,
  })

  if (value)
    return (
      <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-slate-900">{value.fullName}</p>
          <p className="text-xs text-slate-500">
            {value.phone} {value.email}
          </p>
        </div>
        <Btn size="sm" tone="ghost" onClick={() => onChange(null)}>
          Đổi
        </Btn>
      </div>
    )

  const search = (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setQ(draft.trim())
  }

  return (
    <div>
      <div className="flex gap-2">
        <TextInput
          type="search"
          aria-label="Tìm hội viên"
          placeholder="Tên, SĐT hoặc email hội viên"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') search(event)
          }}
        />
        <Btn onClick={search}>Tìm</Btn>
      </div>
      {q !== null ? (
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200">
          {results.isLoading ? <p className="px-3 py-2 text-sm text-slate-400">Đang tìm…</p> : null}
          {results.isError ? (
            <p className="px-3 py-2 text-sm text-rose-700">{errorMessage(results.error)}</p>
          ) : null}
          {results.data?.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">Không tìm thấy hội viên.</p>
          ) : null}
          {results.data?.map((member) => (
            <button
              key={member.id}
              type="button"
              disabled={!member.isActive}
              onClick={() => onChange(member)}
              className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-b-0 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="block text-sm text-slate-900">
                {member.fullName}
                {member.isActive ? '' : ' (đã khóa)'}
              </span>
              <span className="block text-xs text-slate-500">
                {member.phone} {member.email}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
