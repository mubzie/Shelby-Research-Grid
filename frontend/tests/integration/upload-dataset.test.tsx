import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import UploadDataset from '../../src/pages/UploadDataset'

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
