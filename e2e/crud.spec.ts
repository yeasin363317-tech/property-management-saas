import { test, expect } from '@playwright/test'

// Runs only against a disposable Supabase project. Set E2E_LANDLORD_EMAIL/PASSWORD and
// E2E_TENANT_EMAIL/PASSWORD (a tenant already linked to a tenant record). Never use production data.
const L = { email: process.env.E2E_LANDLORD_EMAIL, password: process.env.E2E_LANDLORD_PASSWORD }
const T = { email: process.env.E2E_TENANT_EMAIL, password: process.env.E2E_TENANT_PASSWORD }

test.describe('landlord workflows', () => {
  test.skip(!L.email || !L.password, 'E2E landlord credentials not set')
  test('property and tenant persist after reload', async ({ page }) => {
    const name = `E2E ${Date.now()}`
    await page.goto('/login')
    await page.getByLabel(/email/i).fill(L.email!)
    await page.getByLabel(/password/i).fill(L.password!)
    await page.getByRole('button', { name: /log in|sign in/i }).click()
    await expect(page).toHaveURL(/\/app/)

    await page.goto('/app/properties')
    await page.getByRole('button', { name: /add property/i }).first().click()
    await page.getByLabel(/name/i).first().fill(name)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(name)).toBeVisible()
    await page.reload()
    await expect(page.getByText(name)).toBeVisible()

    await page.goto('/app/tenants')
    await page.getByRole('button', { name: /add tenant/i }).click()
    await page.getByLabel(/full name/i).fill(name)
    await page.getByRole('button', { name: /save/i }).click()
    await expect(page.getByText(name)).toBeVisible()
    await page.reload()
    await expect(page.getByText(name)).toBeVisible()
  })
})

test.describe('tenant login', () => {
  test.skip(!T.email || !T.password, 'E2E tenant credentials not set')
  test('tenant lands on the portal, not the landlord dashboard', async ({ page }) => {
    await page.goto('/tenant-login')
    await page.getByLabel(/email/i).fill(T.email!)
    await page.getByLabel(/password/i).fill(T.password!)
    await page.getByRole('button', { name: /log in|sign in/i }).click()
    await expect(page).toHaveURL(/\/portal/)
    await page.goto('/app')
    await expect(page).toHaveURL(/\/portal/)
  })
  test('wrong password shows an error', async ({ page }) => {
    await page.goto('/tenant-login')
    await page.getByLabel(/email/i).fill('nobody@example.com')
    await page.getByLabel(/password/i).fill('wrong-password-123')
    await page.getByRole('button', { name: /log in|sign in/i }).click()
    await expect(page.getByRole('alert')).toBeVisible()
  })
})
