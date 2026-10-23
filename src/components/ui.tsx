import { forwardRef, useEffect, useId, useRef } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ')

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean }
export function Button({ variant = 'primary', loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700',
    secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-slate-700 hover:bg-slate-100',
  }[variant]
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed', v, className)}
    >
      {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  )
}

const inputCls = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-brand-500 disabled:bg-slate-100'
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) {
  return <input ref={ref} {...p} className={cx(inputCls, className)} />
})
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, ...p }, ref) {
  return <select ref={ref} {...p} className={cx(inputCls, className)} />
})
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...p }, ref) {
  return <textarea ref={ref} rows={3} {...p} className={cx(inputCls, className)} />
})

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">{label}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-lg border border-slate-200 bg-white p-4 shadow-sm', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  )
}

const tones = {
  gray: 'bg-slate-100 text-slate-700', green: 'bg-green-100 text-green-800', red: 'bg-red-100 text-red-800',
  amber: 'bg-amber-100 text-amber-800', blue: 'bg-blue-100 text-blue-800',
}
export function Badge({ tone = 'gray', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cx('inline-block rounded-full px-2 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>
}

export function statusTone(s: string): keyof typeof tones {
  if (['paid', 'active', 'completed', 'occupied', 'resolved', 'valid', 'accepted'].includes(s)) return 'green'
  if (['overdue', 'suspended', 'terminated', 'urgent', 'failed', 'past_due', 'reversed', 'void'].includes(s)) return 'red'
  if (['partial', 'waiting', 'reserved', 'high', 'pending', 'trialing', 'upcoming'].includes(s)) return 'amber'
  if (['in_progress', 'acknowledged', 'open', 'new', 'medium'].includes(s)) return 'blue'
  return 'gray'
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-10 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      {label}...
    </div>
  )
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
      <p className="font-medium text-slate-800">{title}</p>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong.'
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      {msg}
      {onRetry && <button onClick={onRetry} className="ml-3 font-medium underline">Retry</button>}
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-xl bg-white p-5 shadow-xl sm:rounded-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, loading, onConfirm, onClose }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onClose: () => void
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </Card>
  )
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[560px] text-left text-sm">{children}</table></div>
}
export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => <th scope="col" className={cx('border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500', className)}>{children}</th>
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cx('border-b border-slate-100 px-3 py-2.5 align-top', className)}>{children}</td>

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
      <span>{total} result{total === 1 ? '' : 's'}</span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" disabled={page <= 0} onClick={() => onPage(page - 1)}>Previous</Button>
        <span>Page {page + 1} of {pages}</span>
        <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

export const numField = { setValueAs: (v: string | number) => (v === '' || v === null || v === undefined ? undefined : Number(v)) }
