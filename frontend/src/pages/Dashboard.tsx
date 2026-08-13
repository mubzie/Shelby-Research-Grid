import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { useWallet } from '../hooks/useWallet'
import { API_BASE_URL } from '../config'

interface Stats {
  datasets_count: number
  total_reads: number
  total_revenue_millAPT: number
}

interface Dataset {
  id: string
  title: string
  description: string | null
  virus_types: string[]
  is_public: boolean
  created_at: string
  total_reads: number
  total_revenue_earned_millAPT: number
}

interface ActivityItem {
  type: 'read' | 'access_granted'
  dataset_id: string
  dataset_title: string
  reader_addr?: string
  grantee_addr?: string
  bytes_downloaded?: number
  read_count?: number
  at: string
}

const shortAddr = (addr: string) => (addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr)

const Dashboard = () => {
  const navigate = useNavigate()
  const { ready = true, connected, account, balance, disconnect } = useWallet()
  const [stats, setStats] = useState<Stats | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [statsError, setStatsError] = useState<string | null>(null)

  useEffect(() => {
    if (!connected || !account?.address) return

    let cancelled = false
    const base = API_BASE_URL.replace(/\/$/, '')
    const uploader = encodeURIComponent(account.address)

    fetch(`${base}/api/datasets/stats?uploader_addr=${uploader}`)
      .then((r) => r.json())
      .then((data: Stats) => {
        if (!cancelled) setStats(data)
      })
      .catch((e: Error) => {
        if (!cancelled) setStatsError(e.message)
      })

    fetch(`${base}/api/datasets?uploader_addr=${uploader}`)
      .then((r) => r.json())
      .then((data: { datasets?: Dataset[] }) => {
        if (!cancelled) setDatasets(data.datasets ?? [])
      })
      .catch((e: Error) => {
        if (!cancelled) setStatsError(e.message)
      })

    fetch(`${base}/api/datasets/activity?uploader_addr=${uploader}`)
      .then((r) => r.json())
      .then((data: { activity?: ActivityItem[] }) => {
        if (!cancelled) setActivity(data.activity ?? [])
      })
      .catch(() => {
        if (!cancelled) setActivity([])
      })

    return () => {
      cancelled = true
    }
  }, [connected, account?.address])

  if (!ready) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Loading wallet state...</h2>
      </div>
    )
  }

  if (!connected) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Please connect your wallet to access the dashboard</h2>
        <Button
          variant="primary"
          onClick={() => navigate('/')}
        >
          Go to Home
        </Button>
      </div>
    )
  }

  const handleDisconnect = async () => {
    await disconnect()
    navigate('/')
  }

  const revenueAPT = String((((stats?.total_revenue_millAPT ?? 0) / 1000).toFixed(4)).replace(/\.?0+$/, '') || '0')

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="dashboard-header-actions">
          <span className="account-badge" data-testid="account-address">
            {account?.address}
          </span>
          <Button variant="secondary" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="wallet-section">
          <h2>Wallet Balance</h2>
          <div className="balance-cards">
            <div className="balance-card">
              <span className="balance-label">APT</span>
              <span className="balance-amount" data-testid="apt-balance">
                {balance?.apt?.toFixed(4) ?? '0.0000'}
              </span>
            </div>
            <div className="balance-card">
              <span className="balance-label">ShelbyUSD</span>
              <span className="balance-amount" data-testid="shelby-balance">
                {balance?.shelbyUsd ?? 0}
              </span>
            </div>
          </div>
        </section>

        <section className="stats-section">
          <h2>Statistics</h2>
          {statsError && <p className="error-message">Could not load stats: {statsError}</p>}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value" data-testid="datasets-count">
                {stats?.datasets_count ?? 0}
              </span>
              <span className="stat-label">Datasets</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" data-testid="total-reads">
                {stats?.total_reads ?? 0}
              </span>
              <span className="stat-label">Total Reads</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" data-testid="earnings">
                {revenueAPT} mAPT
              </span>
              <span className="stat-label">Earnings</span>
            </div>
          </div>
        </section>

        <section className="actions-section">
          <Button
            variant="primary"
            onClick={() => navigate('/datasets/upload')}
            data-testid="upload-dataset-btn"
          >
            Upload New Dataset
          </Button>
        </section>

        <section className="activity-section">
          <h2>Recent Activity</h2>
          <div className="activity-list" data-testid="activity-list">
            {activity.length === 0 ? (
              <p className="empty-state">No recent activity</p>
            ) : (
              activity.map((item, i) => (
                <div className="dataset-row" key={`${item.type}-${i}`}>
                  <div className="dataset-row-info">
                    <strong>
                      {item.type === 'read' ? 'Dataset read' : 'Access granted'}
                    </strong>
                    <span className="dataset-meta">
                      {item.dataset_title || 'Untitled dataset'} ·{' '}
                      {item.type === 'read'
                        ? `by ${shortAddr(item.reader_addr ?? '')}`
                        : `to ${shortAddr(item.grantee_addr ?? '')}`}
                      {' · '}
                      {new Date(item.at).toLocaleString()}
                    </span>
                  </div>
                  <div className="dataset-row-stats">
                    {item.type === 'read' && item.bytes_downloaded != null && (
                      <span>{item.bytes_downloaded} bytes</span>
                    )}
                    {item.type === 'access_granted' && item.read_count != null && (
                      <span>{item.read_count} reads</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="activity-section">
          <h2>My Datasets</h2>
          <div className="activity-list" data-testid="datasets-list">
            {datasets.length === 0 ? (
              <p className="empty-state">No datasets uploaded yet</p>
            ) : (
              datasets.map((d) => (
                <div
                  className="dataset-row dataset-row-clickable"
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
                  <div className="dataset-row-info">
                    <strong>{d.title || 'Untitled dataset'}</strong>
                    <span className="dataset-meta">
                      {d.virus_types?.length ? d.virus_types.join(', ') : 'No virus types'} ·{' '}
                      {d.is_public ? 'Public' : 'Private'} ·{' '}
                      {new Date(d.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="dataset-row-stats">
                    <span>{d.total_reads ?? 0} reads</span>
                    <span>{((d.total_revenue_earned_millAPT ?? 0) / 1000).toFixed(2)} mAPT</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default Dashboard
