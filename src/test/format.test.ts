import { describe, it, expect } from 'vitest'
import { invoiceDisplayStatus, outstanding, money } from '../lib/format'
import { toCsv } from '../lib/csv'
import { can } from '../lib/permissions'

describe('invoice derived values', () => {
  it('computes outstanding for partial payment', () => {
    expect(outstanding({ amount_due: 15000, amount_paid: 10000, status: 'open' })).toBe(5000)
  })
  it('is paid only when stored status is paid', () => {
    expect(invoiceDisplayStatus({ status: 'paid', amount_due: 100, amount_paid: 100, due_date: '2000-01-01' })).toBe('paid')
  })
  it('marks past-due unpaid invoices overdue', () => {
    expect(invoiceDisplayStatus({ status: 'open', amount_due: 100, amount_paid: 0, due_date: '2000-01-01' })).toBe('overdue')
  })
  it('marks partially paid, not-yet-due invoices as partial', () => {
    expect(invoiceDisplayStatus({ status: 'open', amount_due: 100, amount_paid: 40, due_date: '2999-01-01' })).toBe('partial')
  })
  it('void invoices have zero outstanding', () => {
    expect(outstanding({ amount_due: 100, amount_paid: 0, status: 'void' })).toBe(0)
  })
  it('formats money', () => {
    expect(money(1500, 'USD')).toContain('1,500')
  })
})

describe('csv', () => {
  it('neutralises formula injection', () => {
    const csv = toCsv([{ a: '=SUM(1,2)' }], [{ key: 'a', header: 'A' }])
    expect(csv).toContain(`"'=SUM(1,2)"`)
  })
})

describe('permissions', () => {
  it('only owners manage the team', () => {
    expect(can.manageTeam('owner')).toBe(true)
    expect(can.manageTeam('property_manager')).toBe(false)
  })
  it('maintenance staff cannot see finance', () => {
    expect(can.seeFinance('maintenance')).toBe(false)
  })
})
