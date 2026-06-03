import { render, screen, fireEvent } from '@testing-library/react'
import FileUploadInput from './FileUploadInput'

describe('FileUploadInput', () => {
  it('renders a drop zone with drag-and-drop area', () => {
    render(<FileUploadInput onFileSelect={jest.fn()} />)
    const dropZone = screen.getByText(/Drag files here/i)
    expect(dropZone).toBeInTheDocument()
  })

  it('accepts .csv, .json, .gz files', () => {
    render(<FileUploadInput onFileSelect={jest.fn()} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(input.accept).toMatch(/csv|json|gz/)
  })

  it('rejects files > 5GB with error message', () => {
    const onError = jest.fn()
    render(
      <FileUploadInput
        onFileSelect={jest.fn()}
        onError={onError}
        maxSize={5 * 1024 * 1024 * 1024}
      />
    )

    const largeFile = new File(['x'.repeat(1024)], 'big.csv', { type: 'text/csv' })
    Object.defineProperty(largeFile, 'size', { value: 10 * 1024 * 1024 * 1024 })

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [largeFile] } })

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('exceeds'))
  })

  it('calls onFileSelect callback with file when valid file is selected', () => {
    const onFileSelect = jest.fn()
    render(<FileUploadInput onFileSelect={onFileSelect} />)

    const testFile = new File(['virus data'], 'sars.csv', { type: 'text/csv' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [testFile] } })

    expect(onFileSelect).toHaveBeenCalledWith(testFile)
  })

  it('supports drag-and-drop', () => {
    const onFileSelect = jest.fn()
    render(<FileUploadInput onFileSelect={onFileSelect} />)

    const dropZone = screen.getByText(/Drag files here/i).closest('div')
    const testFile = new File(['data'], 'dropped.csv', { type: 'text/csv' })

    fireEvent.drop(dropZone!, { dataTransfer: { files: [testFile] } })

    expect(onFileSelect).toHaveBeenCalledWith(testFile)
  })
})

