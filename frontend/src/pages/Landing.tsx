import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design'
import { useWallet } from '../hooks/useWallet'
import { API_BASE_URL } from '../config'

interface Dataset {
  id: string
  title: string
  description: string | null
  virus_types: string[]
  file_size_bytes: number
  created_at: string
}

const Landing = () => {
  const navigate = useNavigate()
  const { connected, account, error } = useWallet()
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [listError, setListError] = useState<string | null>(null)

  useEffect(() => {
    if (connected && account) {
      navigate('/dashboard')
    }
  }, [account, connected, navigate])

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE_URL.replace(/\/$/, '')}/api/datasets`)
      .then((r) => r.json())
      .then((data: { datasets?: Dataset[] }) => {
        if (!cancelled) setDatasets(data.datasets ?? [])
      })
      .catch((e: Error) => {
        if (!cancelled) setListError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
    return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <h1>Share Medical Research Data</h1>
        <p className="subtitle">
          Secure, encrypted collaboration for epidemiologists and biomedical AI teams
        </p>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="hero-content">
            <h2>Shelby Research Grid</h2>
            <p>
              A clean platform for moving governed medical datasets across organizations with
              complete auditability and researcher control.
            </p>

            <WalletSelector />
            {error && (
              <p className="error-message" style={{ marginTop: '12px' }}>
                {error}
              </p>
            )}
          </div>

          <aside className="landing-benefits">
            <div className="benefit-card">
              <strong>{datasets.length}</strong>
              <span>public datasets available</span>
            </div>
            <div className="benefit-card">
              <strong>99.9%</strong>
              <span>policy-compliant access logs</span>
            </div>
            <div className="benefit-card">
              <strong>&lt; 2 min</strong>
              <span>average secure handoff</span>
            </div>
          </aside>
        </section>

        <section className="public-datasets-section">
          <h2>Public Datasets</h2>
          {listError && <p className="error-message">Could not load datasets: {listError}</p>}
          {datasets.length === 0 && !listError ? (
            <p className="empty-state">No public datasets yet — be the first to share</p>
          ) : (
            <div className="dataset-grid">
              {datasets.map((d) => (
                <div
                  className="dataset-card"
                  key={d.id}
                  onClick={() => navigate(`/datasets/${d.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      navigate(`/datasets/${d.id}`)
                    }
                  }}
                >
                  <h3>{d.title || 'Untitled dataset'}</h3>
                  {d.description && <p className="dataset-card-desc">{d.description}</p>}
                  <div className="dataset-card-meta">
                    <span className="virus-tags">
                      {d.virus_types?.length ? d.virus_types.join(', ') : 'General'}
                    </span>
                    <span>{formatBytes(d.file_size_bytes)}</span>
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default Landing
