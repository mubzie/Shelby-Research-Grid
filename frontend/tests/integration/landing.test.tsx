import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import Landing from '../../src/pages/Landing'

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
    expect(screen.getByTestId('connect-btn')).toBeInTheDocument()
  })

  it('shows benefit cards with metrics', () => {
    renderLanding()
    expect(screen.getByText('128')).toBeInTheDocument()
    expect(screen.getByText('research cohorts shared')).toBeInTheDocument()
    expect(screen.getByText('99.9%')).toBeInTheDocument()
    expect(screen.getByText('policy-compliant access logs')).toBeInTheDocument()
  })
})
