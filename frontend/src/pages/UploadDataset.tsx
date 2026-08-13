import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Input from '../components/Input'
import FileUploadInput from '../components/FileUploadInput'
import Button from '../components/Button'
import { useWallet } from '../hooks/useWallet'
import { API_BASE_URL, APTOS_MODULE_ADDRESS } from '../config'
import { encryptFile } from '../utils/encryption'

export interface UploadResult {
  dataset_id: string | null
  shelby_blob_id: string | null
  merkle_root: string | null
  on_chain_tx: string | null
  error?: string
}

export interface EncryptionService {
  encrypt: (data: ArrayBuffer | Uint8Array) => Promise<{
    ciphertext: Uint8Array
    iv: string
    authTag: string
    dataKey: string
  }>
}

const defaultEncryptionService: EncryptionService = { encrypt: encryptFile }

interface UploadDatasetProps {
  encryptionService?: EncryptionService
}

const UploadDataset = ({ encryptionService = defaultEncryptionService }: UploadDatasetProps) => {
  const navigate = useNavigate()
  const { ready = true, connected, account, signAndSubmitTransaction } = useWallet()
  const [datasetName, setDatasetName] = useState('')
  const [virusTypes, setVirusTypes] = useState('')
  const [visibility, setVisibility] = useState<'private' | 'internal' | 'public'>('private')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [lastUpload, setLastUpload] = useState<UploadResult | null>(null)

  useEffect(() => {
    if (ready && !connected) {
      navigate('/')
    }
  }, [connected, navigate, ready])

  if (!ready) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Loading wallet state...</h2>
      </div>
    )
  }

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    setUploadError(null)
  }

  const handleFileError = (error: string) => {
    setSelectedFile(null)
    setUploadError(error)
  }

  const isFormValid = Boolean(datasetName.trim() && selectedFile)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!datasetName.trim() || !selectedFile) {
      setUploadError('Please fill in all required fields')
      return
    }

    setIsUploading(true)
    setUploadError(null)

    try {
      if (!account?.address) {
        throw new Error('Connect your wallet before uploading a dataset.')
      }

      const file = selectedFile
      const fileBytes = await new Response(file).arrayBuffer()

      // Encrypt client-side BEFORE anything leaves the browser
      const enc = await encryptionService.encrypt(fileBytes)
      const ciphertextFile = new File([enc.ciphertext.slice().buffer as ArrayBuffer], `${file.name}.enc`, { type: 'application/octet-stream' })

      // The dataset id is generated client-side so it can be committed on-chain first
      const datasetId = crypto.randomUUID()

      // Sign + submit register_dataset with the user's wallet (1 wallet prompt)
      const signed = await signAndSubmitTransaction({
        data: {
          function: `${APTOS_MODULE_ADDRESS}::access_control::register_dataset`,
          functionArguments: [datasetId],
        },
      })

      const formData = new FormData()
      formData.append('file', ciphertextFile)
      formData.append('iv', enc.iv)
      formData.append('auth_tag', enc.authTag)
      formData.append('data_key', enc.dataKey)
      formData.append('dataset_id', datasetId)
      formData.append('register_tx_hash', signed.hash)
      formData.append(
        'metadata',
        JSON.stringify({
          title: datasetName.trim(),
          virus_types: virusTypes
            .split(',')
            .map((type) => type.trim())
            .filter(Boolean),
          visibility,
          is_public: visibility === 'public',
        })
      )
      formData.append('uploader_addr', account.address)

      const response = await fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/datasets/upload`, {
        method: 'POST',
        body: formData,
      })

      let result: UploadResult = {
        dataset_id: null,
        shelby_blob_id: null,
        merkle_root: null,
        on_chain_tx: null,
      }
      try {
        result = (await response.json()) as UploadResult
      } catch {
        result.error = `Upload failed (HTTP ${response.status})`
      }

      if (!response.ok) {
        throw new Error(result.error || `Upload failed (HTTP ${response.status}). Please try again.`)
      }

      setLastUpload(result)
      setUploadSuccess(true)
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : 'Upload failed. Please try again.'
      )
      setIsUploading(false)
    }
  }

  const handleReset = () => {
    setDatasetName('')
    setVirusTypes('')
    setVisibility('private')
    setSelectedFile(null)
    setUploadError(null)
    setUploadSuccess(false)
  }

  return (
    <div className="upload-dataset-page">
      <header className="upload-header">
        <h1>Upload New Dataset</h1>
        <p className="upload-subtitle">
          Share your research data securely with the research community
        </p>
      </header>

      <main className="upload-main">
        {uploadSuccess ? (
          <div className="success-state" data-testid="upload-success">
            <div className="success-message">
              <h2>✓ Upload Successful</h2>
              <p>Your dataset has been encrypted, uploaded to the Shelby network, and recorded on-chain.</p>
              {lastUpload?.shelby_blob_id && (
                <p className="upload-result-line" data-testid="upload-blob-id">
                  Blob ID: <code>{lastUpload.shelby_blob_id}</code>
                </p>
              )}
              {lastUpload?.merkle_root && (
                <p className="upload-result-line" data-testid="upload-merkle-root">
                  Merkle Root: <code>{lastUpload.merkle_root}</code>
                </p>
              )}
              {lastUpload?.on_chain_tx && (
                <p className="upload-result-line">
                  On-chain tx: <code>{lastUpload.on_chain_tx.slice(0, 20)}…</code>
                </p>
              )}
              <Button variant="primary" onClick={() => navigate('/dashboard')} data-testid="upload-done">
                Back to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <form className="upload-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <label>Dataset File *</label>
              <FileUploadInput
                onFileSelect={handleFileSelect}
                onError={handleFileError}
                data-testid="file-upload"
              />
              {selectedFile && (
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Selected: {selectedFile.name}
                </p>
              )}
            </div>

            <div className="form-section">
              <Input
                label="Dataset Name *"
                value={datasetName}
                onChange={setDatasetName}
                placeholder="e.g., COVID-19 Variant Analysis 2024"
                disabled={isUploading}
                data-testid="dataset-name-input"
              />
            </div>

            <div className="form-section">
              <Input
                label="Virus Types (comma-separated)"
                value={virusTypes}
                onChange={setVirusTypes}
                placeholder="e.g., SARS-CoV-2, Influenza, RSV"
                disabled={isUploading}
                data-testid="virus-types-input"
              />
            </div>

            <div className="form-section">
              <label>Visibility</label>
              <div className="radio-group">
                {(['private', 'internal', 'public'] as const).map((option) => (
                  <label key={option} className="radio-label">
                    <input
                      type="radio"
                      name="visibility"
                      value={option}
                      checked={visibility === option}
                      onChange={(e) => setVisibility(e.target.value as typeof visibility)}
                      disabled={isUploading}
                      data-testid={`visibility-${option}`}
                    />
                    <span>{option.charAt(0).toUpperCase() + option.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>

            {uploadError && (
              <div className="error-message" data-testid="upload-error">
                {uploadError}
              </div>
            )}

            <div className="form-actions">
              <Button
                variant="primary"
                type="submit"
                disabled={!isFormValid || isUploading}
                loading={isUploading}
                data-testid="upload-submit"
              >
                {isUploading ? 'Uploading...' : uploadError ? 'Retry Upload' : 'Upload Dataset'}
              </Button>
              <Button variant="secondary" type="button" onClick={handleReset} disabled={isUploading}>
                Reset
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}

export default UploadDataset
