import { render, screen, fireEvent } from '@testing-library/react'
import ConnectWalletButton from './ConnectWalletButton'

describe('ConnectWalletButton', () => {
  it('renders a button with text "Connect Wallet" when NOT connected', () => {
    render(<ConnectWalletButton />)
    const button = screen.getByRole('button', { name: /connect wallet/i })
    expect(button).toBeInTheDocument()
  })

  it('has variant="primary" styling', () => {
    render(<ConnectWalletButton />)
    const button = screen.getByRole('button', { name: /connect wallet/i })
    expect(button).toHaveClass('button-primary')
  })

  it('triggers onConnect when clicked', () => {
    const mockConnect = jest.fn()
    render(<ConnectWalletButton onConnect={mockConnect} />)

    const button = screen.getByRole('button', { name: /connect wallet/i })
    fireEvent.click(button)

    expect(mockConnect).toHaveBeenCalled()
  })

  it('shows wallet address (abbreviated) when connected', () => {
    const mockAccount = {
      address: '0xfcba1234567890abcdef1234567890abcdef1234',
    }

    render(<ConnectWalletButton connected={true} account={mockAccount} />)

    const button = screen.getByRole('button')
    expect(button.textContent).toContain('Disconnect')
    expect(button.textContent).toContain('0xfcba')
  })

  it('shows "Disconnect" button when connected', () => {
    render(
      <ConnectWalletButton
        connected={true}
        account={{ address: '0xtest1234' }}
      />
    )

    const disconnectBtn = screen.getByRole('button', { name: /disconnect/i })
    expect(disconnectBtn).toBeInTheDocument()
  })

  it('calls onDisconnect when Disconnect is clicked', () => {
    const mockDisconnect = jest.fn()

    render(
      <ConnectWalletButton
        connected={true}
        account={{ address: '0xtest1234' }}
        onDisconnect={mockDisconnect}
      />
    )

    const disconnectBtn = screen.getByRole('button', { name: /disconnect/i })
    fireEvent.click(disconnectBtn)

    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('is disabled while connection is in progress', () => {
    render(<ConnectWalletButton connecting={true} />)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
  })
})
