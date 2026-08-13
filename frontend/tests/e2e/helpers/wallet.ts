import type { Page } from '@playwright/test'

/**
 * Seeds the app's wallet persistence (localStorage) so the useWallet hook
 * hydrates a connected session — the app's real auto-connect path.
 */
export async function seedConnectedWallet(page: Page, address = '0xfcba1234567890abcdef1234567890abcdef1234'): Promise<void> {
  await page.addInitScript(({ mockAddress }) => {
    localStorage.setItem('aptos:wallet', mockAddress)
  }, { mockAddress: address })
}
