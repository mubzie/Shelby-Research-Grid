import { useCallback, useEffect, useMemo, useState } from 'react'
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react'
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'

export interface WalletAccount {
  address: string
}

export interface UseWalletReturn {
  ready: boolean
  connected: boolean
  connecting: boolean
  account: WalletAccount | null
  balance: { apt: number; shelbyUsd: number } | null
  error: string | null
  connect: (walletName?: string) => Promise<void>
  disconnect: () => Promise<void>
}

const WALLET_STORAGE_KEY = 'aptos:wallet'

const readStoredAccount = (): WalletAccount | null => {
  const stored = localStorage.getItem(WALLET_STORAGE_KEY)
  return stored ? { address: stored } : null
}

const normalizeAddress = (address: string | { toString(): string } | undefined) => {
  if (!address) return null
  return typeof address === 'string' ? address : address.toString()
}

let aptosClient: Aptos | null = null
const getAptosClient = () => {
  if (!aptosClient) {
    aptosClient = new Aptos(new AptosConfig({ network: Network.TESTNET }))
  }
  return aptosClient
}

const fetchAptBalance = async (address: string) => {
  const amount = await getAptosClient().getAccountAPTAmount({ accountAddress: address })
  return Number(amount) / 1e8
}

export const useWallet = (): UseWalletReturn => {
  const adapter = useAptosWallet()
  const [ready, setReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [account, setAccount] = useState<WalletAccount | null>(() => readStoredAccount())
  const [balance, setBalance] = useState<{ apt: number; shelbyUsd: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const connected = useMemo(() => !!adapter.connected || account !== null, [adapter.connected, account])

  // Hydrate initial account from adapter or localStorage
  useEffect(() => {
    let active = true

    const hydrate = async () => {
      try {
        if (adapter.account?.address) {
          const nextAccountAddress = normalizeAddress(adapter.account.address)
          if (!nextAccountAddress) {
            throw new Error('Wallet account address is missing.')
          }

          const nextAccount = { address: nextAccountAddress }
          if (active) {
            setAccount(nextAccount)
            localStorage.setItem(WALLET_STORAGE_KEY, nextAccount.address)
          }
        } else {
          const stored = readStoredAccount()
          if (active) {
            setAccount(stored)
          }
        }
      } catch {
        if (!active) return
        const stored = readStoredAccount()
        setAccount(stored)
      } finally {
        if (active) setReady(true)
      }
    }

    hydrate()

    return () => {
      active = false
    }
  }, [adapter.account?.address])

  // Load balance when account changes
  useEffect(() => {
    let active = true

    const loadBalance = async () => {
      if (!account?.address) {
        setBalance(null)
        return
      }

      try {
        const apt = await fetchAptBalance(account.address)
        if (active) setBalance({ apt, shelbyUsd: 0 })
      } catch {
        if (active) setBalance({ apt: 0, shelbyUsd: 0 })
      }
    }

    void loadBalance()

    return () => {
      active = false
    }
  }, [account?.address])

  const connect = useCallback(async (walletName?: string) => {
    setConnecting(true)
    setError(null)

    try {
      if (!adapter.connect) {
        throw new Error('No Aptos wallet adapter available. Install a supported wallet.')
      }

      // Call adapter.connect(walletName) which will open the user's wallet or the wallet selector
      // If walletName is provided (e.g., 'Petra') it attempts a direct connection to that wallet
      await adapter.connect(walletName as never)

      // adapter.account updates via effect, but apply it immediately so state is consistent
      const nextAccountAddress = normalizeAddress(adapter.account?.address)
      if (nextAccountAddress) {
        setAccount({ address: nextAccountAddress })
        localStorage.setItem(WALLET_STORAGE_KEY, nextAccountAddress)
      }
    } catch (connectError) {
      const message = connectError instanceof Error ? connectError.message : 'Wallet connection failed.'
      setError(message)
      throw connectError
    } finally {
      setConnecting(false)
    }
  }, [adapter])

  const disconnect = useCallback(async () => {
    try {
      await adapter.disconnect?.()
    } catch {
      // ignore
    }

    localStorage.removeItem(WALLET_STORAGE_KEY)
    setAccount(null)
    setBalance(null)
    setError(null)
  }, [adapter])

  return { ready, connected, connecting, account, balance, error, connect, disconnect }
}

export default useWallet
