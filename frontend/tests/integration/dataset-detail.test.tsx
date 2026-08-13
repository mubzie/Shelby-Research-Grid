import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import DatasetDetail from '../../src/pages/DatasetDetail'

jest.mock('../../src/config', () => ({
  API_BASE_URL: 'http://localhost:3001',
  APTOS_FULLNODE_URL: 'https://fullnode.devnet.aptoslabs.com/v1',
}))

const mockWallet = {
  connected: true,
  account: { address: '0xfcba1234567890abcdef1234567890abcdef1234' },
  ready: true,
}

jest.mock('../../src/hooks/useWallet', () => ({
  useWallet: () => mockWallet,
}))

const mockFetch = jest.fn()

const renderDetail = () =>
  render(
    <MemoryRouter initialEntries={['/datasets/abc-123']}>
      <Routes>
        <Route path="/datasets/:id" element={<DatasetDetail />} />
      </Routes>
    </MemoryRouter>
  )

describe('Dataset Detail Page', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockImplementation(async (url: string) => {
      const u = String(url)
      if (u.includes('/grants')) {
        return {
          ok: true,
          json: async () => ({ tx_hash: '0x' + 'ab'.repeat(32) }),
        }
      }
      if (u.includes('/api/download')) {
        return {
          ok: true,
          blob: async () => new Blob(['decrypted-bytes']),
        }
      }
      return {
        ok: true,
        json: async () => ({
          dataset: {
            id: 'abc-123',
            uploader_addr: '0x9999999999999999999999999999999999999999999999999999999999999999',
            shelby_blob_id: 'datasets/abc-123.bin',
            merkle_root: '0x' + 'cd'.repeat(32),
            title: 'COVID Dataset',
            description: 'Omicron variant sequences',
            virus_types: ['SARS-CoV-2'],
            file_size_bytes: 2048,
            is_public: true,
            created_at: '2026-08-01T00:00:00Z',
            total_reads: 3,
            total_revenue_earned_millAPT: 5,
          },
        }),
      }
    })
    global.fetch = mockFetch as unknown as typeof fetch
  })

  it('loads and displays dataset details', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByText('COVID Dataset')).toBeInTheDocument()
      expect(screen.getByText('Omicron variant sequences')).toBeInTheDocument()
      expect(screen.getByText('SARS-CoV-2')).toBeInTheDocument()
      expect(screen.getByText('2.0 KB')).toBeInTheDocument()
    })
  })

  it('shows Request Access for a reader (non-owner)', async () => {
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('request-access-btn')).toBeInTheDocument()
    })
  })

  it('requesting access calls the grants API and reveals the download button', async () => {
    renderDetail()
    await waitFor(() => {
      screen.getByTestId('request-access-btn').click()
    })
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3001/api/datasets/abc-123/grants',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('0xfcba1234567890abcdef1234567890abcdef1234'),
        })
      )
      expect(screen.getByTestId('download-btn')).toBeInTheDocument()
    })
  })

  it('shows a Download button for the dataset owner', async () => {
    mockWallet.account = { address: '0x9999999999999999999999999999999999999999999999999999999999999999' }
    renderDetail()
    await waitFor(() => {
      expect(screen.getByTestId('download-btn')).toBeInTheDocument()
    })
  })

  it('downloads the decrypted blob as a file', async () => {
    mockWallet.account = { address: '0x9999999999999999999999999999999999999999999999999999999999999999' }
    renderDetail()
    await waitFor(() => {
      screen.getByTestId('download-btn').click()
    })
    await waitFor(() => {
      const downloadCall = mockFetch.mock.calls.find(([url]) => String(url).includes('/api/download'))
      expect(downloadCall).toBeTruthy()
      expect(String(downloadCall![0])).toContain('blob_id=datasets%2Fabc-123.bin')
    })
  })
})
