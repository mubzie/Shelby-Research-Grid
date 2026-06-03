import { act, renderHook, waitFor } from '@testing-library/react'
import { useWallet } from './useWallet'

const walletAddress = '0xfcba1234567890abcdef1234567890abcdef1234'

describe('useWallet', () => {
  const mockFetch = jest.fn()
  const mockConnect = jest.fn()
  const mockDisconnect = jest.fn()
  const mockAccount = jest.fn()

  beforeEach(() => {
    localStorage.clear()
    mockFetch.mockReset()
    mockConnect.mockReset()
    mockDisconnect.mockReset()
    mockAccount.mockReset()

    mockAccount.mockResolvedValue(null)
    mockConnect.mockResolvedValue({ address: walletAddress })

    global.fetch = mockFetch as unknown as typeof fetch
    (window as any).aptos = {
      connect: mockConnect,
      disconnect: mockDisconnect,
      account: mockAccount,
    }
  })
  
  afterEach(() => {
    delete (window as any).aptos
  })

  it('returns disconnected state initially', async () => {
    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    expect(result.current.connected).toBe(false)
    expect(result.current.account).toBe(null)
  })

  it('connects wallet and stores address', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
          data: { coin: { value: '150000000' } },
        },
      ],
    })

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    expect(mockConnect).toHaveBeenCalled()
    expect(result.current.connected).toBe(true)
    expect(result.current.account?.address).toBe(walletAddress)
    expect(result.current.balance?.apt).toBe(1.5)
  })

  it('persists wallet connection to localStorage', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    })

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
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    })

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.connected).toBe(true)

    await act(async () => {
      await result.current.disconnect()
    })

    expect(mockDisconnect).toHaveBeenCalled()
    expect(result.current.connected).toBe(false)
    expect(result.current.account).toBe(null)
    expect(localStorage.getItem('aptos:wallet')).toBeNull()
  })

  it('sets balance from testnet resources after connect', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
          data: { coin: { value: '250000000' } },
        },
      ],
    })

    const { result } = renderHook(() => useWallet())

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.balance?.apt).toBe(2.5)
    expect(result.current.balance?.shelbyUsd).toBe(0)
  })
})
