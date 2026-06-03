import Button from './Button'

export interface ConnectWalletButtonProps {
  connected?: boolean
  connecting?: boolean
  account?: { address: string }
  onConnect?: () => void
  onDisconnect?: () => void
}

const truncateAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export const ConnectWalletButton = ({
  connected = false,
  connecting = false,
  account,
  onConnect,
  onDisconnect,
}: ConnectWalletButtonProps) => {
  if (connected && account) {
    return (
      <Button
        variant="secondary"
        onClick={onDisconnect}
        data-testid="disconnect-btn"
      >
        Disconnect {truncateAddress(account.address)}
      </Button>
    )
  }

  return (
    <Button
      variant="primary"
      onClick={onConnect}
      disabled={connecting}
      loading={connecting}
      data-testid="connect-btn"
    >
      Connect Wallet
    </Button>
  )
}

export default ConnectWalletButton
