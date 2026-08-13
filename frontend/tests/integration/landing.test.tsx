import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Landing from '../../src/pages/Landing'

jest.mock('../../src/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
  APTOS_FULLNODE_URL: 'https://fullnode.devnet.aptoslabs.com/v1',
}))

describe('Landing Page Integration Tests', () => {
  const renderLanding = () => {
    return render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    )
  }

  it('renders landing page with welcome message', () => {
    renderLanding()
    expect(screen.getByText('Share Medical Research Data')).toBeInTheDocument()
  })

  it('displays connect wallet button', () => {
    renderLanding()
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('shows benefit cards with metrics', () => {
    renderLanding()
    expect(screen.getByText('public datasets available')).toBeInTheDocument()
    expect(screen.getByText('99.9%')).toBeInTheDocument()
    expect(screen.getByText('policy-compliant access logs')).toBeInTheDocument()
  })
})
