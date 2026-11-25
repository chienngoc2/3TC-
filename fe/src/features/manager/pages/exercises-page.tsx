import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { managerApi, managerKeys } from '../api/manager-api'
import type {
  ExerciseKnowledge,
  TemplateExercise,
  WorkoutPlan,
  WorkoutTemplate,
} from '../types/manager.types'
import { errorMessage, formatDate } from '../lib/format'
import {
  CATEGORY_CODES,
  categoryLabel,
  equipmentLabel,
  muscleLabel,
  parseExercise,
  perSet,
  unitLabel,
} from '../lib/exercise-meta'
import { useUserNames } from '../lib/use-user-names'
import {
  Btn,
  EmptyRow,
  Field,
  FormError,
  Modal,
  PageHeader,
  Panel,
  SelectInput,
  StateMessage,
  Table,
  Tabs,
  Td,
  TextArea,
  TextInput,
  Th,
  Pagination,
} from '../components/manager-ui'
import { usePagination } from '../lib/use-pagination'

type Tab = 'library' | 'templates' | 'plans'

/** Row of toggle buttons used as a single-choice filter. */
function FilterChips({
  value,
  onChange,
  items,
  label,
}: {
  value: string
  onChange: (value: string) => void
  items: Array<{ value: string; label: string; count?: number }>
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-sm',
            value === item.value
              ? 'border-[#17664e] bg-emerald-50 font-medium text-[#135641]'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
          )}
        >
          {item.label}
          {item.count !== undefined ? (
            <span className="ml-1.5 text-xs text-slate-400">{item.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

/** Sets and reps of one template or plan session, one exercise per row. */
function ExerciseTable({
  items,
  units,
}: {
  items: TemplateExercise[]
  units: Map<string, string | undefined>
}) {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex)
  return (
    <Table>
      <thead>
        <tr>
          <Th className="w-10">#</Th>
          <Th>Bài tập</Th>
          <Th className="text-right">Số hiệp</Th>
          <Th className="text-right">Mỗi hiệp</Th>
          <Th className="text-right">Tạ</Th>
          <Th className="text-right">Nghỉ</Th>
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 ? (
          <EmptyRow colSpan={6}>Buổi này chưa có bài tập.</EmptyRow>
        ) : (
          sorted.map((item, index) => (
            <tr key={item.id}>
              <Td className="tabular-nums text-slate-400">{index + 1}</Td>
              <Td className="font-medium text-slate-900">{item.exercise?.title ?? 'Bài tập'}</Td>
              <Td className="text-right tabular-nums">{item.sets ?? '—'}</Td>
              <Td className="text-right tabular-nums">
                {perSet(
                  item.reps,
                  item.unit ?? (item.exercise ? units.get(item.exercise.id) : undefined) ?? null,
                )}
              </Td>
              <Td className="text-right tabular-nums">
                {item.weightKg ? `${Number(item.weightKg)} kg` : '—'}
              </Td>
              <Td className="text-right tabular-nums">
                {item.restSeconds ? `${item.restSeconds} giây` : '—'}
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  )
}

export function ManagerExercisesPage() {
  const [tab, setTab] = useState<Tab>('library')
  const exercises = useQuery({ queryKey: managerKeys.exercises, queryFn: managerApi.exercises })
  const disciplines = useQuery({
    queryKey: managerKeys.disciplines,
    queryFn: managerApi.disciplines,
  })
  // Unit of each exercise, for plan rows that do not store their own unit.
  const units = new Map(
    (exercises.data ?? []).map((e) => [e.id, parseExercise(e.instructions).unit]),
  )
  const disciplineName = (code: string) =>
    disciplines.data?.find((d) => d.code.toUpperCase() === code.toUpperCase())?.name ?? code

  return (
    <div className="rounded-md bg-white border border-slate-200/90 p-5 sm:p-7 shadow-xs space-y-6">
      <PageHeader
        title="Bài tập & giáo án"
        description="Thư viện động tác chuẩn, giáo án mẫu theo khóa 12 buổi và giáo án HLV đã soạn cho hội viên."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'library', label: 'Thư viện bài tập', count: exercises.data?.length },
          { value: 'templates', label: 'Giáo án mẫu' },
          { value: 'plans', label: 'Giáo án hội viên' },
        ]}
      />
      {tab === 'library' ? (
        <LibraryTab exercises={exercises} disciplineName={disciplineName} />
      ) : null}
      {tab === 'templates' ? <TemplatesTab units={units} disciplineName={disciplineName} /> : null}
      {tab === 'plans' ? <PlansTab units={units} /> : null}
    </div>
  )
}

function LibraryTab({
  exercises,
  disciplineName,
}: {
  exercises: UseQueryResult<ExerciseKnowledge[]>
  disciplineName: (code: string) => string
}) {
  const queryClient = useQueryClient()
  const [discipline, setDiscipline] = useState('ALL')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const rows = (exercises.data ?? []).map((e) => ({ ...e, meta: parseExercise(e.instructions) }))
  // Untagged (manually added) exercises go last.
  const codes = [...new Set(rows.map((r) => r.meta.discipline ?? 'OTHER'))].sort((a, b) =>
    a === 'OTHER' ? 1 : b === 'OTHER' ? -1 : a.localeCompare(b),
  )
  const term = search.trim().toLowerCase()
  const visible = rows.filter(
    (r) =>
      (discipline === 'ALL' || (r.meta.discipline ?? 'OTHER') === discipline) &&
      (!term || r.title.toLowerCase().includes(term)),
  )
  const categories = [...new Set([...CATEGORY_CODES, ...rows.map((r) => r.category)])]
  const { items: pageRows, pager } = usePagination(visible, 20, `${discipline}|${term}`)

  return (
    <Panel
      title={`${visible.length} bài tập`}
      actions={
        <div className="flex flex-wrap gap-2">
          <TextInput
            type="search"
            aria-label="Tìm bài tập"
            placeholder="Tìm theo tên bài tập"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-56 py-1"
          />
          <Btn size="sm" tone="primary" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" />
            Thêm bài tập
          </Btn>
        </div>
      }
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <FilterChips
          label="Lọc theo môn"
          value={discipline}
          onChange={setDiscipline}
          items={[
            { value: 'ALL', label: 'Tất cả', count: rows.length },
            ...codes.map((code) => ({
              value: code,
              label: code === 'OTHER' ? 'Chưa gắn môn' : disciplineName(code),
              count: rows.filter((r) => (r.meta.discipline ?? 'OTHER') === code).length,
            })),
          ]}
        />
      </div>
      {exercises.isLoading || exercises.isError ? (
        <StateMessage
          loading={exercises.isLoading}
          error={exercises.isError ? errorMessage(exercises.error) : null}
          onRetry={() => void exercises.refetch()}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Bài tập</Th>
                {discipline === 'ALL' ? <Th>Môn</Th> : null}
                <Th>Loại</Th>
                <Th>Nhóm cơ</Th>
                <Th>Dụng cụ</Th>
                <Th>Tính theo</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <EmptyRow colSpan={6}>Không có bài tập phù hợp.</EmptyRow>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.id}>
                    <Td>
                      <div className="font-medium text-slate-900">{r.title}</div>
                      {r.meta.note ? (
                        <div className="mt-0.5 max-w-md text-xs text-slate-500">{r.meta.note}</div>
                      ) : null}
                    </Td>
                    {discipline === 'ALL' ? (
                      <Td className="whitespace-nowrap">
                        {r.meta.discipline ? disciplineName(r.meta.discipline) : '—'}
                      </Td>
                    ) : null}
                    <Td className="whitespace-nowrap">{categoryLabel(r.category)}</Td>
                    <Td className="whitespace-nowrap">{muscleLabel(r.meta.muscle)}</Td>
                    <Td className="whitespace-nowrap">{equipmentLabel(r.meta.equipment)}</Td>
                    <Td className="whitespace-nowrap">
                      {r.meta.unit ? unitLabel(r.meta.unit) : '—'}
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <Pagination pager={pager} />
        </>
      )}
      {creating ? (
        <ExerciseForm
          categories={categories}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false)
            void queryClient.invalidateQueries({ queryKey: managerKeys.exercises })
          }}
        />
      ) : null}
    </Panel>
  )
}

function ExerciseForm({
  categories,
  onClose,
  onSaved,
}: {
  categories: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ title: '', category: categories[0] ?? '', instructions: '' })
  const [error, setError] = useState<string | null>(null)
  const save = useMutation({
    mutationFn: () =>
      managerApi.createExercise({
        title: form.title.trim(),
        category: form.category.trim(),
        instructions: form.instructions.trim(),
      }),
    onSuccess: onSaved,
    onError: (err) => setError(errorMessage(err)),
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (form.instructions.trim().length < 10) return setError('Hướng dẫn cần ít nhất 10 ký tự.')
    setError(null)
    save.mutate()
  }
  return (
    <Modal
      wide
      title="Thêm bài tập vào thư viện"
      onClose={onClose}
      footer={
        <>
          <Btn onClick={onClose}>Hủy</Btn>
          <Btn tone="primary" type="submit" form="exercise-form" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Thêm bài tập'}
          </Btn>
        </>
      }
    >
      <form id="exercise-form" onSubmit={submit} className="space-y-3">
        <Field label="Tên bài tập">
          <TextInput
            required
            minLength={2}
            maxLength={150}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </Field>
        <Field label="Loại bài tập">
          <SelectInput
            required
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </SelectInput>
        </Field>
        <Field
          label="Hướng dẫn thực hiện"
          hint="Mô tả tư thế, nhịp thở và lỗi hay gặp. Ít nhất 10 ký tự."
        >
          <TextArea
            rows={6}
            required
            maxLength={10000}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </Field>
        <FormError>{error}</FormError>
      </form>
    </Modal>
  )
}

function TemplatesTab({
  units,
  disciplineName,
}: {
  units: Map<string, string | undefined>
  disciplineName: (code: string) => string
}) {
  const templates = useQuery({
    queryKey: managerKeys.templates(''),
    queryFn: () => managerApi.templates(),
  })
  const all = templates.data ?? []
  const codes = [...new Set(all.map((t) => t.disciplineCode.toUpperCase()))].sort()
  const [picked, setPicked] = useState<string | null>(null)
  const discipline = picked && codes.includes(picked) ? picked : (codes[0] ?? '')
  const rows = all
    .filter((t) => t.disciplineCode.toUpperCase() === discipline)
    .sort((a, b) => a.sessionOrder - b.sessionOrder)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = rows.find((t) => t.id === selectedId) ?? rows[0] ?? null
  const weeks = new Map<number, WorkoutTemplate[]>()
  for (const t of rows) weeks.set(t.weekNumber, [...(weeks.get(t.weekNumber) ?? []), t])

  if (templates.isLoading || templates.isError)
    return (
      <Panel>
        <StateMessage
          loading={templates.isLoading}
          error={templates.isError ? errorMessage(templates.error) : null}
          onRetry={() => void templates.refetch()}
        />
      </Panel>
    )
  if (all.length === 0)
    return (
      <Panel>
        <p className="px-4 py-12 text-center text-sm text-slate-400">Chưa có giáo án mẫu.</p>
      </Panel>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          label="Chọn môn"
          value={discipline}
          onChange={(code) => {
            setPicked(code)
            setSelectedId(null)
          }}
          items={codes.map((code) => ({
            value: code,
            label: disciplineName(code),
            count: all.filter((t) => t.disciplineCode.toUpperCase() === code).length,
          }))}
        />
        <p className="text-xs text-slate-400">
          Gán giáo án mẫu cho một buổi tập ở màn Lịch đặt chỗ.
        </p>
      </div>
      {rows[0]?.description ? (
        <p className="text-sm text-slate-500">{rows[0].description}</p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Panel>
          <nav aria-label="Các buổi trong khóa" className="p-2">
            {[...weeks].map(([week, sessions]) => (
              <div key={week} className="mb-2 last:mb-0">
                <p className="px-2 py-1 text-xs text-slate-400">Tuần {week}</p>
                {sessions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-current={selected?.id === t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      'flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      selected?.id === t.id
                        ? 'bg-emerald-50 text-[#135641]'
                        : 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span className="w-14 shrink-0 tabular-nums text-xs text-slate-400">
                      Buổi {t.sessionOrder}
                    </span>
                    <span className="min-w-0">{t.title}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </Panel>

        {selected ? (
          <Panel>
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="text-base font-semibold text-slate-900">
                Buổi {selected.sessionOrder}: {selected.title}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Tuần {selected.weekNumber}, {selected.exercises.length} bài tập, mã{' '}
                <span className="font-mono">{selected.templateCode}</span>
              </p>
            </div>
            <ExerciseTable items={selected.exercises} units={units} />
          </Panel>
        ) : null}
      </div>
    </div>
  )
}

function PlansTab({ units }: { units: Map<string, string | undefined> }) {
  const plans = useQuery({ queryKey: managerKeys.workoutPlans, queryFn: managerApi.workoutPlans })
  const staff = useQuery({ queryKey: managerKeys.staff, queryFn: managerApi.staff })
  const [open, setOpen] = useState<WorkoutPlan | null>(null)
  const rows = plans.data ?? []
  const { items: pageRows, pager } = usePagination(rows, 15)
  const memberName = useUserNames(pageRows.map((p) => p.memberId))
  const coachName = (id: string) => staff.data?.find((u) => u.id === id)?.fullName ?? 'HLV'

  return (
    <Panel title={`${rows.length} giáo án gần nhất`}>
      {plans.isLoading || plans.isError ? (
        <StateMessage
          loading={plans.isLoading}
          error={plans.isError ? errorMessage(plans.error) : null}
          onRetry={() => void plans.refetch()}
        />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Hội viên</Th>
                <Th>Giáo án</Th>
                <Th>HLV</Th>
                <Th className="text-right">Buổi</Th>
                <Th className="text-right">Số bài</Th>
                <Th>Ngày soạn</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <EmptyRow colSpan={7}>HLV chưa soạn giáo án nào.</EmptyRow>
              ) : (
                pageRows.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium text-slate-900">{memberName(p.memberId)}</Td>
                    <Td>
                      {p.title}
                      {p.templateId ? (
                        <div className="text-xs text-slate-400">Từ giáo án mẫu</div>
                      ) : null}
                    </Td>
                    <Td>{coachName(p.coachId)}</Td>
                    <Td className="text-right tabular-nums">{p.sessionOrder ?? '—'}</Td>
                    <Td className="text-right tabular-nums">{p.exercises.length}</Td>
                    <Td className="whitespace-nowrap">{formatDate(p.createdAt)}</Td>
                    <Td className="text-right">
                      <Btn size="sm" tone="ghost" onClick={() => setOpen(p)}>
                        Xem bài tập
                      </Btn>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
          <Pagination pager={pager} />
        </>
      )}
      {open ? (
        <Modal
          wide
          title={`${open.title}, ${memberName(open.memberId)}`}
          onClose={() => setOpen(null)}
          footer={<Btn onClick={() => setOpen(null)}>Đóng</Btn>}
        >
          {open.notes ? <p className="text-sm text-slate-600">{open.notes}</p> : null}
          <div className="-mx-5">
            <ExerciseTable items={open.exercises} units={units} />
          </div>
        </Modal>
      ) : null}
    </Panel>
  )
}
