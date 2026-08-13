import { test, expect } from '@playwright/test'
import { seedConnectedWallet } from './helpers/wallet'

test.describe('Wallet Connect Flow', () => {
  test('shows landing page with a Connect Wallet button', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Share Medical Research Data')).toBeVisible()
    await expect(page.getByRole('button', { name: /Connect Wallet/i })).toBeVisible()
  })

  test('persisted wallet session auto-redirects to the dashboard', async ({ page }) => {
    await seedConnectedWallet(page)
    await page.goto('/')
    await page.waitForURL('**/dashboard')
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByTestId('account-address')).toContainText('0xfcba')
  })

  test('prevents access to /dashboard without a wallet connection', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/connect your wallet to access the dashboard/i)).toBeVisible()
  })
})
