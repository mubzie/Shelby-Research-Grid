import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Button from '../components/Button'
import { useWallet } from '../hooks/useWallet'
import { API_BASE_URL } from '../config'

interface DatasetDetail {
  id: string
  uploader_addr: string
  shelby_blob_id: string
  merkle_root: string
  title: string
  description: string | null
  virus_types: string[]
  file_size_bytes: number
  is_public: boolean
  created_at: string
  total_reads: number
  total_revenue_earned_millAPT: number
}

const shortAddr = (addr: string) => (addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr)

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

const DatasetDetail = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { ready = true, connected, account } = useWallet()
  const [dataset, setDataset] = useState<DatasetDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [accessGranted, setAccessGranted] = useState(false)

  const base = API_BASE_URL.replace(/\/$/, '')
  const isOwner = Boolean(dataset && account?.address && dataset.uploader_addr.toLowerCase() === account.address.toLowerCase())

  useEffect(() => {
    if (!id) return
    let cancelled = false

    fetch(`${base}/api/datasets/${id}${account?.address ? `?viewer_addr=${encodeURIComponent(account.address)}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Dataset not found (HTTP ${r.status})`))))
      .then((data: { dataset: DatasetDetail }) => {
        if (!cancelled) setDataset(data.dataset)
      })
      .catch((e: Error) => {
        if (!cancelled) setLoadError(e.message)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, account?.address])

  const handleRequestAccess = async () => {
    if (!account?.address || !dataset) return
    setIsRequestingAccess(true)
    setActionMessage(null)
    try {
      const response = await fetch(`${base}/api/datasets/${dataset.id}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grantee_addr: account.address,
          duration_secs: 86400,
          read_limit: 10,
        }),
      })
      const result = (await response.json()) as { error?: string; tx_hash?: string }
      if (!response.ok) {
        throw new Error(result.error || 'Access request failed')
      }
      setAccessGranted(true)
      setActionMessage({ kind: 'success', text: `Access granted on-chain (${result.tx_hash?.slice(0, 12)}…) — you can now download.` })
    } catch (error) {
      setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Access request failed' })
    } finally {
      setIsRequestingAccess(false)
    }
  }

  const handleDownload = async () => {
    if (!account?.address || !dataset) return
    setIsDownloading(true)
    setActionMessage(null)
    try {
      const response = await fetch(
        `${base}/api/download?blob_id=${encodeURIComponent(dataset.shelby_blob_id)}&dataset_id=${encodeURIComponent(dataset.id)}&reader_addr=${encodeURIComponent(account.address)}`
      )
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || `Download failed (HTTP ${response.status})`)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${dataset.title || dataset.id}.bin`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setActionMessage({ kind: 'success', text: 'Download started' })
    } catch (error) {
      setActionMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Download failed' })
    } finally {
      setIsDownloading(false)
    }
  }

  if (!ready) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Loading wallet state...</h2>
      </div>
    )
  }

  return (
    <div className="dataset-detail-page">
      <header className="upload-header">
        <Button variant="tertiary" size="sm" onClick={() => navigate(-1)}>
          ← Back
        </Button>
        <h1>{dataset?.title || 'Dataset'}</h1>
      </header>

      <main className="dataset-detail-main">
        {loadError && (
          <div className="error-message" data-testid="detail-error">
            {loadError}
          </div>
        )}

        {dataset && (
          <>
            <section className="detail-section">
              {dataset.description && <p className="detail-description">{dataset.description}</p>}
              <div className="detail-meta-grid">
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Virus types</span>
                  <span className="detail-meta-value">
                    {dataset.virus_types?.length ? dataset.virus_types.join(', ') : 'General'}
                  </span>
                </div>
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Size</span>
                  <span className="detail-meta-value">{formatBytes(dataset.file_size_bytes)}</span>
                </div>
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Uploaded by</span>
                  <span className="detail-meta-value">{shortAddr(dataset.uploader_addr)}</span>
                </div>
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Date</span>
                  <span className="detail-meta-value">{new Date(dataset.created_at).toLocaleDateString()}</span>
                </div>
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Visibility</span>
                  <span className="detail-meta-value">{dataset.is_public ? 'Public' : 'Private'}</span>
                </div>
                <div className="detail-meta-item">
                  <span className="detail-meta-label">Reads</span>
                  <span className="detail-meta-value">{dataset.total_reads ?? 0}</span>
                </div>
              </div>

              <div className="detail-integrity">
                <span className="detail-meta-label">Blob</span>
                <code>{dataset.shelby_blob_id}</code>
                <span className="detail-meta-label">Merkle root</span>
                <code>{dataset.merkle_root.slice(0, 24)}…</code>
              </div>
            </section>

            <section className="detail-actions">
              {!connected ? (
                <p className="empty-state">Connect your wallet to request access or download this dataset.</p>
              ) : isOwner || accessGranted ? (
                <Button variant="primary" onClick={handleDownload} loading={isDownloading} disabled={isDownloading} data-testid="download-btn">
                  {isDownloading ? 'Downloading...' : 'Download Dataset'}
                </Button>
              ) : (
                <Button variant="primary" onClick={handleRequestAccess} loading={isRequestingAccess} disabled={isRequestingAccess} data-testid="request-access-btn">
                  {isRequestingAccess ? 'Requesting...' : 'Request Access'}
                </Button>
              )}

              {actionMessage && (
                <p className={actionMessage.kind === 'success' ? 'success-message-inline' : 'error-message'} data-testid="detail-action-message">
                  {actionMessage.text}
                </p>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default DatasetDetail
