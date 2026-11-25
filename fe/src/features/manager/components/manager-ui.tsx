import React, { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Pager } from '../lib/use-pagination'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({
  title,
  actions,
  children,
  className,
}: {
  title?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0 rounded-lg border border-slate-200 bg-white', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          {title ? <h2 className="text-sm font-semibold text-slate-900">{title}</h2> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: React.ReactNode
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500',
        className,
      )}
    >
      {children}
    </th>
  )
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn('border-b border-slate-100 px-4 py-2.5 align-top text-slate-700', className)}>
      {children}
    </td>
  )
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-slate-400">
        {children}
      </td>
    </tr>
  )
}

export function StateMessage({
  loading,
  error,
  onRetry,
}: {
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}) {
  if (loading) return <p className="px-4 py-8 text-center text-sm text-slate-400">Đang tải…</p>
  if (!error) return null
  return (
    <div className="px-4 py-6 text-center text-sm text-rose-700">
      {error}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="ml-2 font-medium underline underline-offset-2"
        >
          Thử lại
        </button>
      ) : null}
    </div>
  )
}

const pillTone = {
  green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-rose-50 text-rose-700',
  gray: 'bg-slate-100 text-slate-600',
  blue: 'bg-sky-50 text-sky-700',
}
export function Pill({
  tone = 'gray',
  children,
}: {
  tone?: keyof typeof pillTone
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium',
        pillTone[tone],
      )}
    >
      {children}
    </span>
  )
}

const buttonTone = {
  primary:
    'bg-[#17664e] text-white hover:bg-[#135641] active:bg-[#0f4433] shadow-sm disabled:bg-slate-300 font-bold',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400 font-medium',
  danger:
    'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:text-slate-400 font-medium',
  ghost: 'text-slate-600 hover:bg-slate-100 disabled:text-slate-300 font-medium',
}
export function Btn({
  tone = 'secondary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: keyof typeof buttonTone
  size?: 'sm' | 'md'
}) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-[8px] transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#17664e]/40 disabled:cursor-not-allowed disabled:active:scale-100',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        buttonTone[tone],
        className,
      )}
    />
  )
}

const controlClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#17664e] focus:outline-none focus:ring-2 focus:ring-[#17664e]/20 disabled:bg-slate-50 disabled:text-slate-500'

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: React.ReactElement<{ id?: string }>
  className?: string
}) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      {React.cloneElement(children, { id })}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} {...props} className={cn(controlClass, className)} />
))
TextInput.displayName = 'TextInput'

export function SelectInput({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlClass, 'pr-8', className)} />
}

export function TextArea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(controlClass, className)} />
}

export function FormError({ children, inset }: { children?: React.ReactNode; inset?: boolean }) {
  if (!children) return null
  return (
    <p
      role="alert"
      className={cn('rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700', inset && 'mx-4 mt-3')}
    >
      {children}
    </p>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  wide,
  className,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  wide?: boolean
  className?: string
}) {
  const panel = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-6 backdrop-blur-xs">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'w-full max-h-[92vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden my-auto',
          wide ? 'max-w-6xl xl:max-w-7xl' : 'max-w-md',
          className
        )}
      >
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200/90 px-7 py-4.5 bg-slate-50/70">
          <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-7 sm:p-8">{children}</div>
        {footer ? (
          <div className="shrink-0 flex justify-end gap-3 border-t border-slate-200/90 px-7 py-4 bg-slate-50/80">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (value: T) => void
  items: Array<{ value: T; label: string; count?: number }>
}) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 border-b border-slate-200">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm',
            value === item.value
              ? 'border-[#17664e] font-medium text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800',
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

/** Footer under a paged list */
export function Pagination({ pager, note }: { pager: Pager; note?: string }) {
  if (pager.total === 0) return null
  const first = pager.page * pager.pageSize + 1
  const last = Math.min(pager.total, (pager.page + 1) * pager.pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
      <span>
        {pager.pages > 1 ? `Hiển thị ${first}–${last} trên ${pager.total} kết quả` : `Tổng cộng ${pager.total} kết quả`}
        {note ? ` • ${note}` : null}
      </span>
      <nav aria-label="Phân trang" className="flex items-center gap-1">
        <Btn
          size="sm"
          tone="ghost"
          disabled={pager.page === 0}
          onClick={() => pager.onPage(pager.page - 1)}
        >
          Trước
        </Btn>
        <span className="px-2 tabular-nums font-mono font-medium text-slate-700" aria-current="page">
          Trang {pager.page + 1}/{pager.pages}
        </span>
        <Btn
          size="sm"
          tone="ghost"
          disabled={pager.page >= pager.pages - 1}
          onClick={() => pager.onPage(pager.page + 1)}
        >
          Sau
        </Btn>
      </nav>
    </div>
  )
}
