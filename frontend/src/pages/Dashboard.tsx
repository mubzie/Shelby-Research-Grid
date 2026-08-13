import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { useWallet } from '../hooks/useWallet'
import { API_BASE_URL, APTOS_MODULE_ADDRESS } from '../config'

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

interface AccessRequest {
  id: string
  dataset_id: string
  dataset_title: string
  requester_addr: string
  status: string
  created_at: string
}

const shortAddr = (addr: string) => (addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr)

const Dashboard = () => {
  const navigate = useNavigate()
  const { ready = true, connected, account, balance, disconnect, signAndSubmitTransaction } = useWallet()
  const [stats, setStats] = useState<Stats | null>(null)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [requestError, setRequestError] = useState<string | null>(null)

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

    fetch(`${base}/api/datasets/access-requests?owner_addr=${uploader}`)
      .then((r) => r.json())
      .then((data: { requests?: AccessRequest[] }) => {
        if (!cancelled) setAccessRequests(data.requests ?? [])
      })
      .catch(() => {
        if (!cancelled) setAccessRequests([])
      })

    return () => {
      cancelled = true
    }
  }, [connected, account?.address])

  const handleApprove = async (request: AccessRequest) => {
    if (!account?.address) return
    setApprovingId(request.id)
    setRequestError(null)
    try {
      // Owner signs grant_access with their wallet (1 prompt)
      const signed = await signAndSubmitTransaction({
        data: {
          function: `${APTOS_MODULE_ADDRESS}::access_control::grant_access`,
          functionArguments: [request.dataset_id, request.requester_addr, 86400, 10],
        },
      })
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, '')}/api/datasets/${request.dataset_id}/access-requests/${request.id}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant_tx_hash: signed.hash, owner_addr: account.address }),
        }
      )
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error || 'Approval failed')
      }
      setAccessRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: 'granted' } : r)))
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Approval failed')
    } finally {
      setApprovingId(null)
    }
  }

  const handleReject = async (request: AccessRequest) => {
    if (!account?.address) return
    setRequestError(null)
    try {
      const response = await fetch(
        `${API_BASE_URL.replace(/\/$/, '')}/api/datasets/${request.dataset_id}/access-requests/${request.id}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner_addr: account.address }),
        }
      )
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error || 'Reject failed')
      }
      setAccessRequests((prev) => prev.map((r) => (r.id === request.id ? { ...r, status: 'rejected' } : r)))
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : 'Reject failed')
    }
  }

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
          <h2>Access Requests</h2>
          {requestError && <p className="error-message">{requestError}</p>}
          <div className="activity-list" data-testid="access-requests-list">
            {accessRequests.length === 0 ? (
              <p className="empty-state">No access requests</p>
            ) : (
              accessRequests.map((req) => (
                <div className="dataset-row" key={req.id}>
                  <div className="dataset-row-info">
                    <strong>{req.dataset_title || 'Untitled dataset'}</strong>
                    <span className="dataset-meta">
                      {shortAddr(req.requester_addr)} · {new Date(req.created_at).toLocaleString()} ·{' '}
                      <span className={`request-status request-status-${req.status}`}>{req.status}</span>
                    </span>
                  </div>
                  <div className="dataset-row-stats">
                    {req.status === 'pending' ? (
                      <>
                        <Button variant="primary" size="sm" onClick={() => handleApprove(req)} loading={approvingId === req.id} disabled={approvingId !== null} data-testid={`approve-${req.id}`}>
                          {approvingId === req.id ? 'Signing...' : 'Approve'}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleReject(req)} disabled={approvingId !== null} data-testid={`reject-${req.id}`}>
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="dataset-meta">{req.status === 'granted' ? 'Access granted' : 'Request rejected'}</span>
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
