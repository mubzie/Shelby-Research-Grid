import { render, screen } from '@testing-library/react'
import App from '../../src/App'

jest.mock('../../src/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
  APTOS_FULLNODE_URL: 'https://fullnode.devnet.aptoslabs.com/v1',
}))

const mockWalletState = {
  connected: false,
  account: null as { address: string } | null,
  balance: null as { apt: number; shelbyUsd: number } | null,
  ready: true,
  connect: jest.fn(),
  disconnect: jest.fn(),
}

jest.mock('../../src/hooks/useWallet', () => ({
  useWallet: () => mockWalletState,
}))

describe('Landing → Wallet Connect Flow', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
    mockWalletState.connected = false
    mockWalletState.account = null
    mockWalletState.balance = null
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ datasets: [] }),
    })) as unknown as typeof fetch
  })

  it('shows the landing page with a Connect Wallet button to unauthenticated users', () => {
    render(<App />)
    expect(screen.getByText(/Share Medical Research Data/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument()
  })

  it('navigates to the dashboard once the wallet becomes connected', () => {
    mockWalletState.connected = true
    mockWalletState.account = { address: '0xfcba1234567890abcdef1234567890abcdef1234' }
    mockWalletState.balance = { apt: 10, shelbyUsd: 0 }

    render(<App />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('prevents access to /dashboard without a wallet connection', () => {
    window.history.replaceState({}, '', '/dashboard')
    render(<App />)
    expect(screen.getByText(/connect your wallet to access the dashboard/i)).toBeInTheDocument()
  })
})
