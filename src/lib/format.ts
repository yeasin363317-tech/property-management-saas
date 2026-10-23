export function money(n: number | string | null | undefined, currency = 'BDT'): string {
  const v = Number(n ?? 0)
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${currency} ${v.toFixed(2)}`
  }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '-'
  const date = new Date(d.length === 10 ? d + 'T00:00:00' : d)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '-'
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Local calendar date as YYYY-MM-DD (not UTC) so "today" matches the user's clock. */
export function todayStr(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function monthStartStr(offsetMonths = 0): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offsetMonths)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'object' && e && 'message' in e) return String((e as { message: unknown }).message)
  return 'Something went wrong. Please try again.'
}

export type InvoiceDisplay = 'paid' | 'partial' | 'overdue' | 'open' | 'void'

/** Display status is derived: stored status is only open/paid/void. */
export function invoiceDisplayStatus(i: { status: string; amount_due: number | string; amount_paid: number | string; due_date: string }): InvoiceDisplay {
  if (i.status === 'void') return 'void'
  if (i.status === 'paid') return 'paid'
  if (i.due_date < todayStr()) return 'overdue'
  if (Number(i.amount_paid) > 0) return 'partial'
  return 'open'
}

export function outstanding(i: { amount_due: number | string; amount_paid: number | string; status: string }): number {
  if (i.status === 'void') return 0
  return Math.max(0, Number(i.amount_due) - Number(i.amount_paid))
}

export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '-')
