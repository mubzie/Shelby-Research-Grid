import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Dashboard from '../../src/pages/Dashboard'

jest.mock('../../src/hooks/useWallet', () => ({
  useWallet: () => ({
    connected: true,
    account: {
      address: '0x1234567890abcdef',
    },
    balance: {
      apt: 100,
      shelbyUsd: 500,
    },
    disconnect: jest.fn(),
  }),
}))

describe('Dashboard Page Integration Tests', () => {
  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    )
  }

  it('displays user account address', () => {
    renderDashboard()
    expect(screen.getByTestId('account-address')).toBeInTheDocument()
  })

  it('displays wallet balances', () => {
    renderDashboard()
    expect(screen.getByTestId('apt-balance')).toHaveTextContent('100')
    expect(screen.getByTestId('shelby-balance')).toHaveTextContent('500')
  })

  it('displays dashboard statistics', () => {
    renderDashboard()
    expect(screen.getByTestId('datasets-count')).toBeInTheDocument()
    expect(screen.getByTestId('total-reads')).toBeInTheDocument()
    expect(screen.getByTestId('earnings')).toBeInTheDocument()
  })

  it('displays activity list section', () => {
    renderDashboard()
    expect(screen.getByTestId('activity-list')).toBeInTheDocument()
    expect(screen.getByText('No recent activity')).toBeInTheDocument()
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
