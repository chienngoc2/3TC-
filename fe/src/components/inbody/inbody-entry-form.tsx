import { useId, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  PRO_FIELDS,
  QUICK_FIELDS,
  SEGMENT_FIELDS,
  checkEntry,
  entryValues,
  getFieldHint,
  hasProData,
  type EntryField,
  type EntryMode,
  type EntrySource,
  type EntryValues,
  type FieldSpec,
  type InbodyPayload,
} from '@/lib/inbody-entry'

const MODES: Array<{ value: EntryMode; label: string; hint: string }> = [
  { value: 'quick', label: 'Nhập nhanh', hint: '4 chỉ số chính, máy tự tính phần còn lại' },
  { value: 'pro', label: 'Chuyên sâu', hint: 'Thêm thành phần cơ thể và cơ 5 vùng' },
]

const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 })

function Field({
  spec,
  value,
  error,
  hint,
  required,
  onChange,
  onBlur,
}: {
  spec: FieldSpec
  value: string
  error?: string
  hint?: string
  required?: boolean
  onChange: (value: string) => void
  onBlur: () => void
}) {
  const id = useId()
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="block text-xs font-medium text-slate-700 truncate">
          {spec.label}
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
        {hint && !error ? (
          <span className="text-[10px] font-normal text-slate-400 shrink-0 ml-1">{hint}</span>
        ) : null}
      </div>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={spec.integer ? 1 : 0.01}
          min={spec.min}
          max={spec.max}
          placeholder={spec.placeholder}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          className={cn(
            'h-10 w-full rounded-lg border bg-white px-3 pr-12 text-sm tabular-nums text-slate-900 outline-none focus:ring-2',
            error
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15'
              : 'border-slate-300 focus:border-teal-600 focus:ring-teal-600/15',
          )}
        />
        {spec.unit ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {spec.unit}
          </span>
        ) : null}
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface InbodyEntryFormProps {
  /** The log being edited; omit to record a new measurement. */
  source?: EntrySource | null
  defaultMode: EntryMode
  notesLabel: string
  notesPlaceholder?: string
  submitLabel: string
  onSubmit: (payload: InbodyPayload) => Promise<unknown>
  onCancel: () => void
  /** Turns an API failure into a message for the form. */
  describeError: (cause: unknown) => string
  /** Lets the dialog block closing while the request runs. */
  onBusyChange?: (busy: boolean) => void
}

export function InbodyEntryForm({
  source,
  defaultMode,
  notesLabel,
  notesPlaceholder,
  submitLabel,
  onSubmit,
  onCancel,
  describeError,
  onBusyChange,
}: InbodyEntryFormProps) {
  const editing = Boolean(source)
  const [values, setValues] = useState<EntryValues>(() => entryValues(source))
  const [mode, setMode] = useState<EntryMode>(() =>
    source && hasProData(entryValues(source)) ? 'pro' : defaultMode,
  )
  const [touched, setTouched] = useState<Set<EntryField>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const check = checkEntry(values, mode, editing)
  // Required-field messages wait until the field is left, other problems show right away.
  const errorFor = (key: EntryField) => {
    const error = check.errors[key]
    if (!error) return undefined
    return error === 'Bắt buộc.' && !touched.has(key) ? undefined : error
  }
  const update = (key: EntryField | 'notes', value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setServerError(null)
  }
  const touch = (key: EntryField) => setTouched((current) => new Set(current).add(key))

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busyRef.current || !check.payload) return
    busyRef.current = true
    setBusy(true)
    onBusyChange?.(true)
    setServerError(null)
    try {
      await onSubmit(check.payload)
    } catch (cause) {
      setServerError(describeError(cause))
    } finally {
      busyRef.current = false
      setBusy(false)
      onBusyChange?.(false)
    }
  }

  const { derived } = check
  const heightNum = Number(values.heightCm.replace(',', '.')) || null
  const weightNum = Number(values.weightKg.replace(',', '.')) || null

  const preview = [
    { label: 'Khối mỡ (BFM)', value: derived.bodyFatMassKg, unit: 'kg' },
    { label: 'Khối nạc (LBM)', value: derived.leanBodyMassKg, unit: 'kg' },
    { label: 'BMI', value: derived.bmi, unit: '' },
    { label: 'Trao đổi chất (BMR)', value: derived.bmrKcal, unit: 'kcal' },
  ]

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="space-y-5 text-sm">
      <div>
        <div
          role="radiogroup"
          aria-label="Chế độ nhập"
          className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1"
        >
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={mode === option.value}
              disabled={busy}
              onClick={() => setMode(option.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                mode === option.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          {MODES.find((option) => option.value === mode)?.hint}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_FIELDS.map((spec) => (
          <Field
            key={spec.key}
            spec={spec}
            required
            hint={getFieldHint(spec.key, heightNum, weightNum)}
            value={values[spec.key]}
            error={errorFor(spec.key)}
            onChange={(value) => update(spec.key, value)}
            onBlur={() => touch(spec.key)}
          />
        ))}
      </div>

      <section aria-label="Chỉ số tự tính" className="rounded-lg bg-slate-50 px-3 py-2.5">
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          Tự tính từ số đã nhập
        </p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
          {preview.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] text-slate-500">{item.label}</dt>
              <dd className="font-semibold tabular-nums text-slate-700">
                {item.value === null
                  ? '—'
                  : `${numberFormat.format(item.value)}${item.unit ? ` ${item.unit}` : ''}`}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {mode === 'pro' ? (
        <>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-900">Thành phần cơ thể</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PRO_FIELDS.map((spec) => (
                <Field
                  key={spec.key}
                  spec={spec}
                  hint={getFieldHint(spec.key, heightNum, weightNum)}
                  value={values[spec.key]}
                  error={errorFor(spec.key)}
                  onChange={(value) => update(spec.key, value)}
                  onBlur={() => touch(spec.key)}
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-slate-900">
              Cơ nạc 5 vùng <span className="font-normal text-slate-500">(theo phiếu InBody)</span>
            </legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {SEGMENT_FIELDS.map((spec) => (
                <Field
                  key={spec.key}
                  spec={spec}
                  hint={getFieldHint(spec.key, heightNum, weightNum)}
                  value={values[spec.key]}
                  error={errorFor(spec.key)}
                  onChange={(value) => update(spec.key, value)}
                  onBlur={() => touch(spec.key)}
                />
              ))}
            </div>
          </fieldset>
        </>
      ) : null}

      <div>
        <label className="mb-1 block text-xs font-medium text-slate-700" htmlFor="inbody-notes">
          {notesLabel}
        </label>
        <textarea
          id="inbody-notes"
          rows={3}
          maxLength={4000}
          value={values.notes}
          placeholder={notesPlaceholder}
          onChange={(event) => update('notes', event.target.value)}
          className="w-full resize-none rounded-lg border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/15"
        />
      </div>

      {check.warnings.length > 0 && !check.formError ? (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 space-y-1"
        >
          <div className="flex items-center gap-1.5 font-bold text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>Lưu ý chỉ số bất thường:</span>
          </div>
          <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-amber-800">
            {check.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {check.formError || serverError ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {check.formError ?? serverError}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
        {!check.payload && !check.formError ? (
          <p className="mr-auto text-xs text-slate-500">
            Nhập đủ 4 chỉ số có dấu * và sửa ô báo đỏ để lưu.
          </p>
        ) : null}
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Hủy
        </Button>
        <Button
          type="submit"
          disabled={busy || !check.payload}
          className="bg-teal-700 text-white hover:bg-teal-800"
        >
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {busy ? 'Đang lưu...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
