const mockUpload = jest.fn();
const mockGenerateCommitments = jest.fn();
const mockGetAccountModules = jest.fn();
const mockReader = {
  read: jest.fn(),
};

const mockMerkleRoot = '0x' + 'ab'.repeat(32);

jest.mock('@shelby-protocol/sdk/node');
jest.mock('@aptos-labs/ts-sdk');

/**
 * Resets module state (ShelbyClient is a singleton) and re-wires the mocked SDK,
 * returning a fresh ShelbyClient instance.
 */
const freshClient = () => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sdk = require('@shelby-protocol/sdk/node') as typeof import('@shelby-protocol/sdk/node');
  (sdk.ShelbyNodeClient as unknown as jest.Mock).mockImplementation(() => ({
    aptos: { getAccountModules: mockGetAccountModules },
    upload: mockUpload,
    download: jest.fn().mockResolvedValue({
      account: '0x1',
      name: 'datasets/test.bin',
      contentLength: 2,
      readable: { getReader: () => mockReader },
    }),
  }));
  (sdk.createDefaultErasureCodingProvider as unknown as jest.Mock).mockResolvedValue({});
  (sdk.generateCommitments as unknown as jest.Mock).mockImplementation(mockGenerateCommitments);
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../services/ShelbyClient').default;
};

describe('ShelbyClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReader.read
      .mockResolvedValueOnce({ done: false, value: new Uint8Array([104, 105]) })
      .mockResolvedValueOnce({ done: true, value: undefined });
    mockGenerateCommitments.mockResolvedValue({ blob_merkle_root: mockMerkleRoot });
    mockGetAccountModules.mockResolvedValue([{}]);
    process.env.APTOS_PRIVATE_KEY = '0x1111111111111111111111111111111111111111111111111111111111111111';
    process.env.SHELBY_RPC_URL = 'https://shelby.shelbynet.shelby.xyz/shelby';
  });

  test('uploadDataset uploads to the Shelby SDK and returns real blobId + merkle root', async () => {
    const client = freshClient();

    const res = await client.uploadDataset(Buffer.from('secret bytes'), 'abc-123');

    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        blobName: 'datasets/abc-123.bin',
        expirationMicros: expect.any(Number),
        signer: expect.any(Object),
        blobData: expect.any(Uint8Array),
      })
    );
    expect(res.blobId).toBe('datasets/abc-123.bin');
    expect(res.merkleRoot).toBe(mockMerkleRoot);
    expect(res.size).toBe(12);
  });

  test('uploadDataset uploads the exact bytes provided (ciphertext when encrypted upstream)', async () => {
    const client = freshClient();

    const ciphertext = Buffer.from('encrypted-payload-bytes');
    await client.uploadDataset(ciphertext, 'abc-123');

    const uploadCall = mockUpload.mock.calls[0][0];
    const uploadedBytes = Buffer.from(uploadCall.blobData);
    expect(uploadedBytes.equals(ciphertext)).toBe(true);
  });

  test('downloadDataset returns a buffer from the SDK stream', async () => {
    const client = freshClient();

    const buf = await client.downloadDataset('datasets/abc-123.bin');
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.toString()).toBe('hi');
  });

  test('verifyBlobIntegrity recomputes the merkle root and compares', async () => {
    const client = freshClient();

    const ok = await client.verifyBlobIntegrity('datasets/abc-123.bin', mockMerkleRoot);
    expect(ok).toBe(true);

    const mismatch = await client.verifyBlobIntegrity('datasets/abc-123.bin', '0xdeadbeef');
    expect(mismatch).toBe(false);
  });
});
