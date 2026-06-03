import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { useWallet } from '../hooks/useWallet'

const Dashboard = () => {
  const navigate = useNavigate()
  const { ready = true, connected, account, balance, disconnect } = useWallet()

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
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-value" data-testid="datasets-count">
                0
              </span>
              <span className="stat-label">Datasets</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" data-testid="total-reads">
                0
              </span>
              <span className="stat-label">Total Reads</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" data-testid="earnings">
                $0
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
            <p className="empty-state">No recent activity</p>
          </div>
        </section>
      </main>
    </div>
  )
}

export default Dashboard
