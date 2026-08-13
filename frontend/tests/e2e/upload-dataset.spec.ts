import { test, expect } from '@playwright/test'
import { installMockWallet } from './helpers/wallet'

test.describe('Complete Upload Flow', () => {
  test('connects wallet, signs register_dataset, uploads, shows blob id + merkle root', async ({ page }) => {
    await installMockWallet(page)
    await page.goto('/')

    // Connect through the wallet selector so the adapter has a signer
    await page.getByRole('button', { name: /Connect Wallet/i }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()
    await modal.getByRole('button', { name: /Connect/i }).click()
    await page.waitForURL('**/dashboard')

    // Intercept the upload API with a deterministic fixture (real path covered by integration tests)
    await page.route('**/api/datasets/upload', async (route) => {
      const body = route.request().postData() ?? ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dataset_id: 'e2e-uuid-0000',
          shelby_blob_id: 'datasets/e2e-uuid-0000.bin',
          merkle_root: '0xe2e0000000000000000000000000000000000000000000000000000000000000',
          integrity_verified: false,
          encrypted: true,
          on_chain_tx: '0x' + 'aa'.repeat(32),
          _received_register_tx_hash: body.includes('aa'.repeat(32)) ? 'present' : 'missing',
        }),
      })
    })

    await page.getByRole('button', { name: /Upload.*Dataset/i }).click()
    await page.waitForURL('**/datasets/upload')

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
