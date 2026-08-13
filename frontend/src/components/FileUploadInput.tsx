import { useRef } from 'react'

export interface FileUploadInputProps {
  onFileSelect: (file: File) => void
  onError?: (error: string) => void
  maxSize?: number
  accept?: string
  'data-testid'?: string
}

export const FileUploadInput = ({
  onFileSelect,
  onError,
  maxSize = 5 * 1024 * 1024 * 1024,
  accept = '.csv,.tsv,.txt,.json,.xlsx,.gz,.fasta,.fa,.fastq',
  ...rest
}: FileUploadInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (file: File) => {
    if (file.size > maxSize) {
      onError?.(`File size exceeds ${maxSize / (1024 * 1024 * 1024)}GB limit`)
      return
    }

    onFileSelect(file)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileChange(file)
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileChange(file)
    }
  }

  return (
    <div className="file-upload-input" {...rest}>
      <div
        className="drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
      >
        <p>Drag files here or click to select</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  )
}

export default FileUploadInput
