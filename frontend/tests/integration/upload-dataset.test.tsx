import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import UploadDataset from '../../src/pages/UploadDataset'

jest.mock('../../src/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
  APTOS_FULLNODE_URL: 'https://fullnode.testnet.aptoslabs.com/v1',
}))

jest.mock('../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    connected: true,
    account: {
      address: '0x1234567890abcdef',
    },
  }),
}))

describe('Upload Dataset Page Integration Tests', () => {
  const renderUploadPage = () => {
    return render(
      <BrowserRouter>
        <UploadDataset />
      </BrowserRouter>
    )
  }

  it('displays upload form with all fields', () => {
    renderUploadPage()
    expect(screen.getByText('Upload New Dataset')).toBeInTheDocument()
    expect(screen.getByTestId('dataset-name-input')).toBeInTheDocument()
    expect(screen.getByTestId('virus-types-input')).toBeInTheDocument()
    expect(screen.getByTestId('file-upload')).toBeInTheDocument()
  })

  it('displays visibility radio options', () => {
    renderUploadPage()
    expect(screen.getByTestId('visibility-private')).toBeInTheDocument()
    expect(screen.getByTestId('visibility-internal')).toBeInTheDocument()
    expect(screen.getByTestId('visibility-public')).toBeInTheDocument()
  })

  it('disables upload button when form is incomplete', () => {
    renderUploadPage()
    expect(screen.getByTestId('upload-submit')).toBeDisabled()
  })

  it('enables upload button when form is complete', async () => {
    renderUploadPage()

    const nameInput = screen.getByTestId('dataset-name-input')
    fireEvent.change(nameInput, { target: { value: 'Test Dataset' } })

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const fileInput = screen.getByTestId('file-upload').querySelector('input[type="file"]')
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    await waitFor(() => {
      expect(screen.getByTestId('upload-submit')).not.toBeDisabled()
    })
  })

  it('displays success message after upload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ dataset_id: 'test-id' }),
    }) as unknown as typeof fetch

    renderUploadPage()

    const nameInput = screen.getByTestId('dataset-name-input')
    fireEvent.change(nameInput, { target: { value: 'Test Dataset' } })

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const fileInput = screen.getByTestId('file-upload').querySelector('input[type="file"]')
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    await waitFor(() => {
      const submitBtn = screen.getByTestId('upload-submit')
      expect(submitBtn).not.toBeDisabled()
      fireEvent.click(submitBtn)
    })

    await waitFor(
      () => {
        expect(screen.getByTestId('upload-success')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('encrypts the file client-side before uploading (network payload is ciphertext)', async () => {
    const mockEncrypt = jest.fn(async () => ({
      ciphertext: new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]),
      iv: 'aWF2LWJ5dGVzMTI=',
      authTag: 'dGFnLWJ5dGVzLTE2Ynl0ZXM=',
      dataKey: 'MzJieXRlLWRhdGEta2V5LWJ5dGVzLXNlY3JldA==',
    }))
    let sentFormData: FormData | null = null
    global.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
      sentFormData = init?.body as FormData
      return { ok: true, json: async () => ({ dataset_id: 'x', shelby_blob_id: 'blob_x', merkle_root: '0xabc' }) }
    }) as unknown as typeof fetch

    render(
      <BrowserRouter>
        <UploadDataset encryptionService={{ encrypt: mockEncrypt }} />
      </BrowserRouter>
    )

    const nameInput = screen.getByTestId('dataset-name-input')
    fireEvent.change(nameInput, { target: { value: 'Encrypted Dataset' } })

    const plaintext = 'SECRET PLAINTEXT VIRUS DATA'
    const file = new File([plaintext], 'data.csv', { type: 'text/csv' })
    const fileInput = screen.getByTestId('file-upload').querySelector('input[type="file"]')
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [file] } })
    }

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('upload-submit'))
    })

    await waitFor(() => {
      expect(mockEncrypt).toHaveBeenCalled()
    })

    expect(sentFormData).not.toBeNull()
    const sentFile = sentFormData!.get('file') as File
    const sentBytes = await new Response(sentFile).arrayBuffer()
    const sentText = new TextDecoder().decode(sentBytes)
    // The ciphertext must never contain the plaintext
    expect(sentText).not.toContain('SECRET PLAINTEXT')
    // Encryption metadata must be attached
    expect(sentFormData!.get('iv')).toBeTruthy()
    expect(sentFormData!.get('auth_tag')).toBeTruthy()
    expect(sentFormData!.get('data_key')).toBeTruthy()
  })

  it('shows blob id and merkle root on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        dataset_id: 'test-id',
        shelby_blob_id: 'datasets/abc-123.bin',
        merkle_root: '0x1234abcd',
        on_chain_tx: '0xdeadbeef1234',
      }),
    }) as unknown as typeof fetch

    renderUploadPage()

    fireEvent.change(screen.getByTestId('dataset-name-input'), { target: { value: 'D' } })
    const fileInput = screen.getByTestId('file-upload').querySelector('input[type="file"]')
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [new File(['data'], 'd.csv')] } })
    }

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('upload-submit'))
    })

    await waitFor(
      () => {
        expect(screen.getByTestId('upload-blob-id')).toHaveTextContent('datasets/abc-123.bin')
        expect(screen.getByTestId('upload-merkle-root')).toHaveTextContent('0x1234abcd')
      },
      { timeout: 3000 }
    )
  })

  it('shows an error and allows retry when the upload fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Upload failed (HTTP 500)' }),
    }) as unknown as typeof fetch

    renderUploadPage()

    fireEvent.change(screen.getByTestId('dataset-name-input'), { target: { value: 'D' } })
    const fileInput = screen.getByTestId('file-upload').querySelector('input[type="file"]')
    if (fileInput) {
      fireEvent.change(fileInput, { target: { files: [new File(['data'], 'd.csv')] } })
    }

    await waitFor(() => {
      fireEvent.click(screen.getByTestId('upload-submit'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Retry Upload/i })).toBeInTheDocument()
    })
  })

  it('can reset form', async () => {
    renderUploadPage()

    const nameInput = screen.getByTestId('dataset-name-input') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'Test Dataset' } })

    expect(nameInput.value).toBe('Test Dataset')

    const resetBtn = screen.getByText('Reset')
    fireEvent.click(resetBtn)

    await waitFor(() => {
      expect(nameInput.value).toBe('')
    })
  })

  it('defaults to private visibility', () => {
    renderUploadPage()
    const privateRadio = screen.getByTestId('visibility-private') as HTMLInputElement
    expect(privateRadio.checked).toBe(true)
  })
})
