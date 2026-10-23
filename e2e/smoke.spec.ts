import { test, expect } from '@playwright/test'

test('public pages render and protected routes redirect', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.goto('/app')
  await expect(page).toHaveURL(/\/login/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/login/)
})

test('legal pages exist', async ({ page }) => {
  await page.goto('/terms')
  await expect(page.getByRole('heading', { name: /terms/i })).toBeVisible()
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: /privacy/i })).toBeVisible()
})
