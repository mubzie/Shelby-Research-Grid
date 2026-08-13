import config from '../config';

// The Shelby SDK is ESM-only; its types resolve @aptos-labs/ts-sdk in ESM mode.
// Use resolution-mode type imports so Account/Network types match the SDK's world.
type ESMAccount = import('@aptos-labs/ts-sdk', { with: { 'resolution-mode': 'import' } }).Account;

export interface UploadResult {
  blobId: string;
  merkleRoot: string;
  size: number;
}

export interface DatasetInfo {
  blobId: string;
  merkleRoot: string;
  size: number;
  metadata: Record<string, any>;
}

type ShelbyNodeClientType = import('@shelby-protocol/sdk/node').ShelbyNodeClient;
type ErasureCodingProviderType = import('@shelby-protocol/sdk/node').ErasureCodingProvider;

const BLOB_PREFIX = 'datasets';
const DEFAULT_EXPIRATION_DAYS = 30;

class ShelbyClient {
  private rpcUrl: string;
  private apiKey: string;
  private client: ShelbyNodeClientType | null = null;
  private provider: ErasureCodingProviderType | null = null;
  private initPromise: Promise<ShelbyNodeClientType> | null = null;

  constructor() {
    this.rpcUrl = process.env.SHELBY_RPC_URL || config.shelby.rpcUrl;
    this.apiKey = process.env.SHELBY_API_KEY || config.shelby.apiKey || '';
    console.log('[ShelbyClient] Initialized with rpcUrl:', this.rpcUrl, 'hasApiKey:', !!this.apiKey);
  }

  /**
   * Lazily initialize the Shelby SDK client (ESM-only package, loaded via dynamic import).
   */
  private async getClient(): Promise<ShelbyNodeClientType> {
    if (this.client) return this.client;
    if (!this.initPromise) {
      this.initPromise = (async () => {
        const [{ ShelbyNodeClient }, { Network }] = await Promise.all([
          import('@shelby-protocol/sdk/node'),
          import('@aptos-labs/ts-sdk'),
        ]);
        const signer = await this.getSigner();
        const client = new ShelbyNodeClient({
          network: Network.SHELBYNET,
          rpc: { baseUrl: process.env.SHELBY_RPC_PROXY_URL || this.rpcUrl },
          orderless: true,
          locationHint: process.env.SHELBY_LOCATION_HINT || 'shelbynet-1',
          // geomi gateway expects x-api-key; the SDK sends Bearer, so inject the header directly
          aptos: this.apiKey
            ? { clientConfig: { HEADERS: { 'x-api-key': this.apiKey } as Record<string, string> } }
            : undefined,
        });
        // Connectivity probe (non-fatal): warn if the fullnode rejects anonymous access
        try {
          const modules = await client.aptos.getAccountModules({ accountAddress: signer.accountAddress });
          console.log('[ShelbyClient] SDK initialized; modules on', signer.accountAddress.toString().slice(0, 10) + '...', ':', modules.length);
        } catch (probeErr: any) {
          console.warn('[ShelbyClient] fullnode probe failed (anonymous access may be blocked):', probeErr?.message || probeErr);
        }
        this.client = client;
        return client;
      })();
    }
    return this.initPromise;
  }

  private async getSigner(): Promise<ESMAccount> {
    const { Account, Ed25519PrivateKey } = await import('@aptos-labs/ts-sdk');
    const privateKey = process.env.APTOS_PRIVATE_KEY || '';
    if (!privateKey) throw new Error('APTOS_PRIVATE_KEY not configured; cannot sign Shelby transactions');
    return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(`0x${privateKey.replace(/^0x/, '')}`) });
  }

  /**
   * Upload a blob to the Shelby network (real on-chain registration + storage upload).
   * Returns the real blob name and merkle root.
   */
  async uploadDataset(encryptedBuffer: Buffer, datasetId: string): Promise<UploadResult> {
    const client = await this.getClient();
    const signer = await this.getSigner();
    const blobName = `${BLOB_PREFIX}/${datasetId}.bin`;
    const expirationMicros = Date.now() * 1000 + DEFAULT_EXPIRATION_DAYS * 86400_000_000;

    const provider = await this.getProvider(client);
    const { generateCommitments } = await import('@shelby-protocol/sdk/node');
    const commitments = await generateCommitments(provider, new Uint8Array(encryptedBuffer));
    const merkleRoot = commitments.blob_merkle_root;

    await client.upload({
      blobData: new Uint8Array(encryptedBuffer),
      signer,
      blobName,
      expirationMicros,
      options: { locationHint: process.env.SHELBY_LOCATION_HINT || 'shelbynet-1' },
    });

    return { blobId: blobName, merkleRoot, size: encryptedBuffer.length };
  }

  /**
   * Download a blob from the Shelby network (real retrieval from storage providers).
   */
  async downloadDataset(blobId: string): Promise<Buffer> {
    const client = await this.getClient();
    const signer = await this.getSigner();
    const blob = await client.download({ account: signer.accountAddress, blobName: blobId });
    const reader = blob.readable.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.length;
    }
    return Buffer.from(out);
  }

  /**
   * Verify blob integrity by recomputing the merkle root from the downloaded bytes
   * and comparing against the stored root.
   */
  async verifyBlobIntegrity(blobId: string, merkleRoot: string): Promise<boolean> {
    if (!merkleRoot) return false;
    try {
      const buf = await this.downloadDataset(blobId);
      const client = await this.getClient();
      const provider = await this.getProvider(client);
      const { generateCommitments } = await import('@shelby-protocol/sdk/node');
      const commitments = await generateCommitments(provider, new Uint8Array(buf));
      return commitments.blob_merkle_root.toLowerCase() === String(merkleRoot).toLowerCase();
    } catch (err: any) {
      console.warn('[ShelbyClient] verifyBlobIntegrity failed:', err?.message || err);
      return false;
    }
  }

  /**
   * List blobs stored under the platform account namespace.
   * Listing is not part of the public SDK surface; the backend DB is the source of truth.
   */
  async listDatasets(ownerAddr: string): Promise<DatasetInfo[]> {
    return [];
  }

  private async getProvider(client: ShelbyNodeClientType): Promise<ErasureCodingProviderType> {
    if (this.provider) return this.provider;
    const { createDefaultErasureCodingProvider } = await import('@shelby-protocol/sdk/node');
    this.provider = await createDefaultErasureCodingProvider();
    return this.provider;
  }
}

export default new ShelbyClient();
