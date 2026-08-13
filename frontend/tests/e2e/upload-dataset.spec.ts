import { test, expect } from '@playwright/test'
import { seedConnectedWallet } from './helpers/wallet'

test.describe('Complete Upload Flow', () => {
  test('uploads a file, shows blob id + merkle root, and navigates back to the dashboard', async ({ page }) => {
    await seedConnectedWallet(page)
    await page.goto('/datasets/upload')

    // Intercept the upload API with a deterministic fixture (real path covered by integration tests)
    await page.route('**/api/datasets/upload', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dataset_id: 'e2e-uuid-0000',
          shelby_blob_id: 'datasets/e2e-uuid-0000.bin',
          merkle_root: '0xe2e0000000000000000000000000000000000000000000000000000000000000',
          integrity_verified: true,
          encrypted: true,
          on_chain_tx: '0x' + 'e2'.repeat(32),
        }),
      })
    })

    await page.locator('input[type="file"]').setInputFiles({ name: 'sample-virus-data.csv', mimeType: 'text/csv', buffer: Buffer.from('strain,sequence\nomicron,ATCG') })
    await expect(page.getByText('sample-virus-data.csv')).toBeVisible()

    await page.getByTestId('dataset-name-input').fill('COVID-19 Omicron Variants')
    await page.getByTestId('virus-types-input').fill('SARS-CoV-2')

    const submitBtn = page.getByTestId('upload-submit')
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    await expect(page.getByTestId('upload-success')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('upload-blob-id')).toContainText('datasets/e2e-uuid-0000.bin')
    await expect(page.getByTestId('upload-merkle-root')).toContainText(/0xe2e0/)

    await page.getByTestId('upload-done').click()
    await page.waitForURL('**/dashboard')
  })
})
