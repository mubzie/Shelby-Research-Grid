import { test, expect } from '@playwright/test'

/**
 * Download access gate E2E: hits the real backend API through the browser.
 * An ungranted reader must get 403; a request without a blob must get 400.
 */
test.describe('Download Access Gate', () => {
  test('rejects a reader with no on-chain grant (403)', async ({ page, request }) => {
    await page.goto('/')
    const res = await request.get('http://localhost:3001/api/download', {
      params: {
        blob_id: 'datasets/some-dataset.bin',
        dataset_id: '00000000-0000-4000-8000-000000000000',
        reader_addr: '0x' + 'aa'.repeat(32),
      },
    })
    expect(res.status()).toBe(403)
  })

  test('rejects a download with no blob id (400)', async ({ page, request }) => {
    await page.goto('/')
    const res = await request.get('http://localhost:3001/api/download')
    expect(res.status()).toBe(400)
  })
})
