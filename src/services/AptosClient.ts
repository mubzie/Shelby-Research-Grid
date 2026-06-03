import axios from 'axios';
import config from '../config';

export interface AptosModule {
  moduleAddress: string;
  moduleName: string;
}

class AptosClient {
  private rpcUrl: string;
  private network: string;
  private privateKey: string;
  private moduleAddress: string;

  constructor() {
    this.rpcUrl = process.env.APTOS_RPC_URL || config.aptos.rpcUrl;
    this.network = process.env.APTOS_NETWORK || config.aptos.network;
    this.privateKey = process.env.APTOS_PRIVATE_KEY || config.aptos.privateKey;
    this.moduleAddress = process.env.APTOS_MODULE_ADDRESS || config.aptos.moduleAddress;
    console.log('[AptosClient] Initialized with network:', this.network, 'module:', this.moduleAddress);
  }

  /**
   * Register dataset ownership on-chain
   * Calls: shelby_research::access_control::register_dataset
   */
  async registerDataset(uploaderAddr: string, datasetId: string): Promise<{ txHash: string }> {
    console.log('[AptosClient] registerDataset called', uploaderAddr, datasetId);
    if (!this.moduleAddress) {
      console.warn('[AptosClient] No module address configured; skipping on-chain registration');
      return { txHash: 'stub-' + Date.now() };
    }
    // TODO: Implement transaction signing and submission
    // For now, return a stub tx hash
    return { txHash: `aptos-reg-${Date.now()}` };
  }

  /**
   * Grant access to a collaborator on-chain
   * Calls: shelby_research::access_control::grant_access
   */
  async grantAccess(
    uploaderAddr: string,
    datasetId: string,
    granteeAddr: string,
    durationSecs: number,
    readLimit: number
  ): Promise<{ txHash: string }> {
    console.log('[AptosClient] grantAccess called', uploaderAddr, datasetId, granteeAddr);
    if (!this.moduleAddress) {
      console.warn('[AptosClient] No module address configured; skipping grant');
      return { txHash: 'stub-' + Date.now() };
    }
    // TODO: Implement transaction signing and submission
    return { txHash: `aptos-grant-${Date.now()}` };
  }

  /**
   * Revoke access on-chain
   * Calls: shelby_research::access_control::revoke_access
   */
  async revokeAccess(uploaderAddr: string, datasetId: string, granteeAddr: string): Promise<{ txHash: string }> {
    console.log('[AptosClient] revokeAccess called', uploaderAddr, datasetId, granteeAddr);
    if (!this.moduleAddress) {
      console.warn('[AptosClient] No module address configured; skipping revoke');
      return { txHash: 'stub-' + Date.now() };
    }
    // TODO: Implement transaction signing and submission
    return { txHash: `aptos-revoke-${Date.now()}` };
  }

  /**
   * Record a read event on-chain for payment tracking
   * Calls: shelby_research::payment::record_read
   */
  async recordRead(
    uploaderAddr: string,
    datasetId: string,
    readerAddr: string,
    amountMillAPT: number
  ): Promise<{ txHash: string }> {
    console.log('[AptosClient] recordRead called', uploaderAddr, datasetId, readerAddr, amountMillAPT);
    if (!this.moduleAddress) {
      console.warn('[AptosClient] No module address configured; skipping read event');
      return { txHash: 'stub-' + Date.now() };
    }
    // TODO: Implement transaction signing and submission
    return { txHash: `aptos-read-${Date.now()}` };
  }

  /**
   * Settle batch payments (called by cron job daily)
   * Calls: shelby_research::payment::settle_dataset_payments
   */
  async settlePayments(uploaderAddr: string, datasetId: string, totalMillAPT: number): Promise<{ txHash: string }> {
    console.log('[AptosClient] settlePayments called', uploaderAddr, datasetId, totalMillAPT);
    if (!this.moduleAddress) {
      console.warn('[AptosClient] No module address configured; skipping settlement');
      return { txHash: 'stub-' + Date.now() };
    }
    // TODO: Implement transaction signing and submission
    return { txHash: `aptos-settle-${Date.now()}` };
  }

  /**
   * Check if module is deployed
   */
  async isModuleDeployed(): Promise<boolean> {
    if (!this.moduleAddress || !this.rpcUrl) return false;
    try {
      const resp = await axios.get(`${this.rpcUrl}/accounts/${this.moduleAddress}/modules`, {
        timeout: 5000,
      });
      return resp.status === 200 && resp.data && Array.isArray(resp.data);
    } catch (e) {
      console.warn('[AptosClient] Module check failed:', (e as any)?.message);
      return false;
    }
  }

  /**
   * Get account balance
   */
  async getBalance(address: string): Promise<number> {
    if (!this.rpcUrl) return 0;
    try {
      const resp = await axios.get(`${this.rpcUrl}/accounts/${address}`, {
        timeout: 5000,
      });
      const resources = resp.data?.resources || [];
      const coinResource = resources.find((r: any) => r.type.includes('0x1::coin::CoinStore'));
      return coinResource?.data?.coin?.value || 0;
    } catch (e) {
      console.warn('[AptosClient] Balance check failed:', (e as any)?.message);
      return 0;
    }
  }
}

export default new AptosClient();
