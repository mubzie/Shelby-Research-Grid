import { test, expect } from '@playwright/test'
import { seedConnectedWallet } from './helpers/wallet'

const datasetFixture = {
  id: 'e2e-detail-0000',
  uploader_addr: '0x' + '99'.repeat(32),
  shelby_blob_id: 'datasets/e2e-detail-0000.bin',
  merkle_root: '0x' + 'cd'.repeat(32),
  title: 'Omicron Variant Sequences',
  description: 'De-identified sequence data',
  virus_types: ['SARS-CoV-2'],
  file_size_bytes: 2048,
  is_public: true,
  created_at: '2026-08-01T00:00:00Z',
  total_reads: 3,
  total_revenue_earned_millAPT: 5,
}

test.describe('Dataset Detail Flow', () => {
  test('requests access and downloads a dataset', async ({ page }) => {
    await seedConnectedWallet(page)
    await page.route(/\/api\/datasets\/e2e-detail-0000\/access-requests$/, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ request_id: 'req-1', status: 'pending' }),
      })
    })
    await page.route(/\/api\/datasets\/e2e-detail-0000(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dataset: datasetFixture }),
      })
    })

    await page.goto('/datasets/e2e-detail-0000')

    await expect(page.getByText('Omicron Variant Sequences')).toBeVisible()

    await page.getByTestId('request-access-btn').click()
    await expect(page.getByTestId('detail-action-message')).toContainText(/owner must approve/i)
  })

  test('dataset owner sees the download button directly', async ({ page }) => {
    await seedConnectedWallet(page, '0x' + '99'.repeat(32))
    await page.route(/\/api\/datasets\/e2e-detail-0000(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ dataset: { ...datasetFixture, title: 'My Own Dataset', is_public: false } }),
      })
    })

    await page.goto('/datasets/e2e-detail-0000')

    await expect(page.getByText('My Own Dataset')).toBeVisible()
    await expect(page.getByTestId('download-btn')).toBeVisible()
  })
})
