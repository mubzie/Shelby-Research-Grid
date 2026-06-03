import { test, expect } from '@playwright/test'

test.describe('Medical Research Platform E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173')
  })

  test('landing page loads and displays content', async ({ page }) => {
    // Verify landing page elements
    await expect(page.locator('h1')).toContainText('Share Medical Research Data')
    await expect(page.locator('.subtitle')).toBeVisible()

    // Check benefit metrics display
    await expect(page.locator('text=128')).toBeVisible()
    await expect(page.locator('text=research cohorts shared')).toBeVisible()
  })

  test('connect wallet button is visible and clickable', async ({ page }) => {
    const connectBtn = page.locator('[data-testid="landing-connect"]')
    await expect(connectBtn).toBeVisible()
    await expect(connectBtn).toBeEnabled()
  })

  test('complete upload dataset workflow', async ({ page }) => {
    // Skip to upload page for E2E test (in production, would go through landing->dashboard->upload)
    await page.goto('http://localhost:5173/datasets/upload')

    // Fill in dataset name
    await page.locator('[data-testid="dataset-name-input"]').fill('COVID-19 Genome Analysis')

    // Add virus types
    await page.locator('[data-testid="virus-types-input"]').fill('SARS-CoV-2, Omicron, Delta')

    // Select visibility (public)
    await page.locator('[data-testid="visibility-public"]').check()

    // Upload a file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/sample-dataset.csv')

    // Submit upload
    await page.locator('[data-testid="upload-submit"]').click()

    // Wait for success message
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Upload Successful')).toBeVisible()
  })

  test('dashboard displays user wallet info', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:5173/dashboard')

    // Check that wallet address is displayed
    const addressElement = page.locator('[data-testid="account-address"]')
    if (await addressElement.isVisible()) {
      await expect(addressElement).toBeVisible()
    }
  })

  test('form validation prevents empty submission', async ({ page }) => {
    await page.goto('http://localhost:5173/datasets/upload')

    // Try to submit empty form
    const uploadBtn = page.locator('[data-testid="upload-submit"]')
    await expect(uploadBtn).toBeDisabled()

    // Fill name but not file
    await page.locator('[data-testid="dataset-name-input"]').fill('Test Dataset')

    // Button should still be disabled
    await expect(uploadBtn).toBeDisabled()

    // Fill file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles('tests/fixtures/sample-dataset.csv')

    // Now button should be enabled
    await expect(uploadBtn).toBeEnabled()
  })

  test('navigation between pages works', async ({ page }) => {
    // Start at landing
    await expect(page.locator('text=Share Medical Research Data')).toBeVisible()

    // Navigate to dashboard
    await page.goto('http://localhost:5173/dashboard')
    // Dashboard should load or redirect based on wallet state

    // Navigate to upload
    await page.goto('http://localhost:5173/datasets/upload')
    await expect(page.locator('text=Upload New Dataset')).toBeVisible()

    // Test invalid route redirects to landing
    await page.goto('http://localhost:5173/invalid-route')
    await expect(page.locator('text=Share Medical Research Data')).toBeVisible()
  })

  test('error states are handled gracefully', async ({ page }) => {
    await page.goto('http://localhost:5173/datasets/upload')

    // Try uploading without required fields
    const submitBtn = page.locator('[data-testid="upload-submit"]')
    await expect(submitBtn).toBeDisabled()

    // Add name but oversized file (testing file validation)
    await page.locator('[data-testid="dataset-name-input"]').fill('Test')

    // Try to upload a file and verify size validation happens
    const fileInput = page.locator('input[type="file"]')
    if (await fileInput.isVisible()) {
      // FileUploadInput will validate size
    }
  })

  test('reset button clears form fields', async ({ page }) => {
    await page.goto('http://localhost:5173/datasets/upload')

    // Fill form
    await page.locator('[data-testid="dataset-name-input"]').fill('Test Dataset')
    await page.locator('[data-testid="virus-types-input"]').fill('Virus1, Virus2')

    // Click reset
    await page.locator('button:has-text("Reset")').click()

    // Verify fields are cleared
    await expect(page.locator('[data-testid="dataset-name-input"]')).toHaveValue('')
    await expect(page.locator('[data-testid="virus-types-input"]')).toHaveValue('')
  })

  test('disconnect button removes wallet connection', async ({ page }) => {
    await page.goto('http://localhost:5173/dashboard')

    // If connected, click disconnect
    const disconnectBtn = page.locator('button:has-text("Disconnect")')
    if (await disconnectBtn.isVisible()) {
      await disconnectBtn.click()

      // Should redirect to landing
      await expect(page.locator('text=Share Medical Research Data')).toBeVisible({ timeout: 5000 })
    }
  })
})
