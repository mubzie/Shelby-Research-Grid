import { render, screen, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../../src/pages/Dashboard'

jest.mock('../../src/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
  APTOS_FULLNODE_URL: 'https://fullnode.devnet.aptoslabs.com/v1',
}))

jest.mock('../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    connected: true,
    account: {
      address: '0xfcba1234567890abcdef1234567890abcdef1234',
    },
    balance: {
      apt: 150,
      shelbyUsd: 5000,
    },
    disconnect: jest.fn(),
  }),
}))

const mockFetch = jest.fn()

describe('Dashboard Page Integration Tests', () => {
  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
  }

  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation(async (url: string) => {
      if (String(url).includes('/stats')) {
        return {
          ok: true,
          json: async () => ({ datasets_count: 3, total_reads: 45, total_revenue_millAPT: 850 }),
        }
      }
      if (String(url).includes('/activity')) {
        return {
          ok: true,
          json: async () => ({
            activity: [
              { type: 'read', dataset_title: 'COVID Dataset', reader_addr: '0xaaaa', bytes_downloaded: 1024, at: '2026-08-12T10:00:00Z' },
              { type: 'access_granted', dataset_title: 'Flu Dataset', grantee_addr: '0xbbbb', read_count: 2, at: '2026-08-11T10:00:00Z' },
            ],
          }),
        }
      }
      return {
        ok: true,
        json: async () => ({
          datasets: [
            { id: '1', title: 'COVID Dataset', virus_types: ['SARS-CoV-2'], is_public: false, created_at: '2026-08-01T00:00:00Z', total_reads: 45, total_revenue_earned_millAPT: 850 },
          ],
        }),
      }
    })
    global.fetch = mockFetch as unknown as typeof fetch
  })

  it('displays user account address', () => {
    renderDashboard()
    expect(screen.getByTestId('account-address')).toHaveTextContent('0xfcba')
  })

  it('displays wallet balances', () => {
    renderDashboard()
    expect(screen.getByTestId('apt-balance')).toHaveTextContent('150')
    expect(screen.getByTestId('shelby-balance')).toHaveTextContent('5000')
  })

  it('shows stats cards with real API values: Dataset Count, Total Reads, Earnings', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByTestId('datasets-count')).toHaveTextContent('3')
      expect(screen.getByTestId('total-reads')).toHaveTextContent('45')
      expect(screen.getByTestId('earnings')).toHaveTextContent('0.85 mAPT')
    })
  })

  it('displays recent activity (reads and access grants) from the API', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('Dataset read')).toBeInTheDocument()
      expect(screen.getByText('Access granted')).toBeInTheDocument()
    })
  })

  it('lists the user datasets from the API', async () => {
    renderDashboard()
    await waitFor(() => {
      expect(screen.getByText('COVID Dataset')).toBeInTheDocument()
    })
  })

  it('has upload dataset button', () => {
    renderDashboard()
    expect(screen.getByTestId('upload-dataset-btn')).toBeInTheDocument()
  })

  it('has disconnect button', () => {
    renderDashboard()
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  it('displays header with dashboard title', () => {
    renderDashboard()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })
})
