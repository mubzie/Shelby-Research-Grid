import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design'
import { useWallet } from '../hooks/useWallet'

const Landing = () => {
  const navigate = useNavigate()
  const { connected, account, error } = useWallet()

  useEffect(() => {
    if (connected && account) {
      navigate('/dashboard')
    }
  }, [account, connected, navigate])

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
              <strong>128</strong>
              <span>research cohorts shared</span>
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
      </main>
    </div>
  )
}

export default Landing
