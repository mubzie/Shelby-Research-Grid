import { act, renderHook, waitFor } from '@testing-library/react'
import { useWallet } from './useWallet'

const walletAddress = '0xfcba1234567890abcdef1234567890abcdef1234'

const mockAdapter = {
  connected: false,
  account: null as { address: string } | null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  network: { name: 'shelbynet' },
}

const mockGetAccountAPTAmount = jest.fn()

jest.mock('@aptos-labs/wallet-adapter-react', () => ({
  useWallet: () => mockAdapter,
}))

jest.mock('@aptos-labs/ts-sdk', () => ({
  Network: { SHELBYNET: 'shelbynet', DEVNET: 'devnet', TESTNET: 'testnet' },
  AptosConfig: jest.fn(),
  Aptos: jest.fn().mockImplementation(() => ({
    getAccountAPTAmount: mockGetAccountAPTAmount,
  })),
}))

describe('useWallet', () => {
  beforeEach(() => {
    localStorage.clear()
    mockGetAccountAPTAmount.mockReset()
    mockAdapter.connect.mockReset()
    mockAdapter.disconnect.mockReset()
    mockAdapter.connected = false
    mockAdapter.account = null
    mockAdapter.connect.mockImplementation(async () => {
      mockAdapter.account = { address: walletAddress }
      mockAdapter.connected = true
    })
    mockAdapter.disconnect.mockImplementation(async () => {
      mockAdapter.account = null
      mockAdapter.connected = false
    })

  })

  it('returns disconnected state initially', async () => {
    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.connected).toBe(false)
    expect(result.current.account).toBe(null)
  })

  it('connects wallet and stores address', async () => {
    mockGetAccountAPTAmount.mockResolvedValue(150000000n)

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    expect(mockAdapter.connect).toHaveBeenCalled()
    expect(result.current.connected).toBe(true)
    expect(result.current.account?.address).toBe(walletAddress)
    expect(result.current.balance?.apt).toBe(1.5)
  })

  it('persists wallet connection to localStorage', async () => {
    mockGetAccountAPTAmount.mockResolvedValue(0n)

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    const stored = localStorage.getItem('aptos:wallet')
    expect(stored).toBe(walletAddress)
  })

  it('loads wallet from localStorage on mount', async () => {
    localStorage.setItem('aptos:wallet', '0xtest1234')

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.connected).toBe(true)
    expect(result.current.account?.address).toBe('0xtest1234')
  })

  it('disconnects wallet and clears storage', async () => {
    mockGetAccountAPTAmount.mockResolvedValue(0n)

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.connected).toBe(true)

    await act(async () => {
      await result.current.disconnect()
    })

    expect(mockAdapter.disconnect).toHaveBeenCalled()
    expect(result.current.connected).toBe(false)
    expect(result.current.account).toBe(null)
    expect(localStorage.getItem('aptos:wallet')).toBeNull()
  })

  it('sets balance from the network after connect', async () => {
    mockGetAccountAPTAmount.mockResolvedValue(250000000n)

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.balance?.apt).toBe(2.5)
    expect(result.current.balance?.shelbyUsd).toBe(0)
  })
})
