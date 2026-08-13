import type { Page } from '@playwright/test'

/**
 * Registers a wallet-standard mock wallet ("Petra") so the Aptos wallet adapter
 * discovers it and can connect + sign. The wallet implements the required aptos
 * features (connect, account, network, onAccountChange, onNetworkChange,
 * signMessage, signTransaction) plus aptos:signAndSubmitTransaction v1.1.0,
 * which the adapter uses directly — returning a canned tx hash with no network
 * submission.
 */
export async function installMockWallet(page: Page, address = '0xfcba1234567890abcdef1234567890abcdef1234'): Promise<void> {
  await page.addInitScript(({ mockAddress }) => {
    const address = mockAddress
    const publicKeyHex = '0x' + 'ab'.repeat(32)
    const CHAIN = 'aptos:testnet'

    const account = { address, publicKey: publicKeyHex, ansName: undefined }
    let connected = false
    const accountListeners: Array<(account: unknown) => void> = []
    const networkListeners: Array<(network: unknown) => void> = []

    const wallet = {
      name: 'Petra',
      version: '1.0.0',
      icon: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="16" fill="#1B5FFF"/></svg>'),
      chains: [CHAIN],
      accounts: connected ? [address] : [],
      features: {
        'aptos:connect': {
          version: '1.1.0',
          connect: async () => {
            connected = true
            wallet.accounts = [address]
            accountListeners.forEach((cb) => cb(account))
            return { status: 'Approved', args: account }
          },
        },
        'aptos:disconnect': {
          version: '1.1.0',
          disconnect: async () => {
            connected = false
            wallet.accounts = []
          },
        },
        'aptos:account': {
          version: '1.1.0',
          account: async () => account,
        },
        'aptos:network': {
          version: '1.1.0',
          network: async () => ({ chain: CHAIN, network: 'testnet' }),
        },
        'aptos:onAccountChange': {
          version: '1.1.0',
          onAccountChange: (cb: (a: unknown) => void) => {
            accountListeners.push(cb)
            return () => {
              const i = accountListeners.indexOf(cb)
              if (i >= 0) accountListeners.splice(i, 1)
            }
          },
        },
        'aptos:onNetworkChange': {
          version: '1.1.0',
          onNetworkChange: (cb: (n: unknown) => void) => {
            networkListeners.push(cb)
            return () => {
              const i = networkListeners.indexOf(cb)
              if (i >= 0) networkListeners.splice(i, 1)
            }
          },
        },
        'aptos:signMessage': {
          version: '1.1.0',
          signMessage: async (input: { message: string }) => ({
            address,
            signature: '0x' + 'cd'.repeat(64),
            fullMessage: input.message,
            message: input.message,
          }),
        },
        'aptos:signTransaction': {
          version: '1.1.0',
          signTransaction: async (tx: unknown) => ({
            signedTransaction: '0x' + 'ef'.repeat(64),
            response: 'Approved',
          }),
        },
        'aptos:signAndSubmitTransaction': {
          version: '1.1.0',
          signAndSubmitTransaction: async () => ({
            status: 'Approved',
            args: '0x' + 'aa'.repeat(32),
          }),
        },
      },
    }

    window.addEventListener('wallet-standard:app-ready', (event: Event) => {
      const detail = (event as CustomEvent<{ register: (w: unknown) => () => void }>).detail
      if (detail && typeof detail.register === 'function') {
        detail.register(wallet)
      }
    })
  }, { mockAddress: address })
}

/**
 * Seeds the app's wallet persistence (localStorage) so the useWallet hook
 * hydrates a connected session without the connect modal.
 */
export async function seedConnectedWallet(page: Page, address = '0xfcba1234567890abcdef1234567890abcdef1234'): Promise<void> {
  await page.addInitScript(({ mockAddress }) => {
    localStorage.setItem('aptos:wallet', mockAddress)
  }, { mockAddress: address })
}
