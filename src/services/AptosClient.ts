import {
  Aptos,
  AptosConfig,
  Network,
  Account,
  AccountAddress,
  Ed25519PrivateKey,
} from '@aptos-labs/ts-sdk';
import config from '../config';

export interface AptosModule {
  moduleAddress: string;
  moduleName: string;
}

const MODULE = 'access_control';
const PAYMENT_MODULE = 'payment';

function hexToUtf8(hex: string): string {
  const clean = hex.replace(/^0x/, '');
  if (!clean || clean.length % 2 !== 0) return hex;
  return Buffer.from(clean, 'hex').toString('utf8');
}

class AptosClient {
  private rpcUrl: string;
  private network: string;
  private moduleAddress: string;
  private account: Account | null;
  private client: Aptos;

  constructor() {
    this.rpcUrl = process.env.APTOS_RPC_URL || config.aptos.rpcUrl;
    this.network = process.env.APTOS_NETWORK || config.aptos.network;
    this.moduleAddress = (process.env.APTOS_MODULE_ADDRESS || config.aptos.moduleAddress).replace(/^0x/, '');
    const privateKey = process.env.APTOS_PRIVATE_KEY || config.aptos.privateKey;

    // Resolve the Aptos network: shelbynet for storage (Shelby SDK), testnet for access control.
    // The geomi gateway rejects Authorization: Bearer, so inject the API key as x-api-key header.
    const shelbyApiKey = process.env.SHELBY_API_KEY || '';
    const networkForChain = this.network === 'shelbynet' ? Network.SHELBYNET : Network.TESTNET;
    this.client = new Aptos(
      new AptosConfig({
        network: networkForChain,
        fullnode: this.rpcUrl,
        clientConfig: shelbyApiKey
          ? { HEADERS: { 'x-api-key': shelbyApiKey } as Record<string, string> }
          : undefined,
      })
    );
    this.account = this.tryCreateAccount(privateKey);

    console.log('[AptosClient] Initialized network:', this.network, 'module:', this.moduleAddress, 'account:', this.account?.accountAddress.toString() || 'NONE');
  }

  private tryCreateAccount(privateKeyHex: string): Account | null {
    if (!privateKeyHex) {
      console.warn('[AptosClient] No APTOS_PRIVATE_KEY configured; on-chain calls will be stubbed');
      return null;
    }
    try {
      return Account.fromPrivateKey({ privateKey: new Ed25519PrivateKey(`0x${privateKeyHex.replace(/^0x/, '')}`) });
    } catch (e: any) {
      console.warn('[AptosClient] Failed to load account from private key:', e?.message || e);
      return null;
    }
  }

  private get clientWithNetwork(): Aptos {
    return this.client;
  }

  /**
   * The platform account used to sign platform-role transactions (read loop, settlement).
   */
  getSigner(): Account {
    if (!this.account) {
      throw new Error('APTOS_PRIVATE_KEY not configured; cannot sign transactions');
    }
    return this.account;
  }

  /**
   * Wait for a transaction and return the confirmed response.
   */
  async waitForTransaction(txHash: string): Promise<{ success: boolean; sender: string; payload: any }> {
    const tx = await this.clientWithNetwork.waitForTransaction({ transactionHash: txHash });
    return {
      success: Boolean(tx.success),
      sender: String((tx as any).sender || ''),
      payload: (tx as any).payload || {},
    };
  }

  /**
   * Verify a user-signed register_dataset transaction.
   * Extracts + cross-checks the dataset id from the tx and requires the sender to be the uploader.
   */
  async verifyRegisterTx(txHash: string, expectedDatasetId: string, expectedUploader: string): Promise<boolean> {
    try {
      const { success, sender, payload } = await this.waitForTransaction(txHash);
      if (!success) return false;
      const txFunction = String(payload.function || '').toLowerCase().replace(/^0x/, '');
      const expectedFunction = `${this.moduleAddress}::${MODULE}::register_dataset`.toLowerCase();
      if (txFunction !== expectedFunction) return false;
      if (sender.toLowerCase() !== expectedUploader.toLowerCase()) return false;
      const args = payload.arguments || [];
      const datasetIdFromTx = hexToUtf8(String(args[0] || ''));
      return datasetIdFromTx === expectedDatasetId;
    } catch (e: any) {
      console.warn('[AptosClient] verifyRegisterTx failed:', e?.message || e);
      return false;
    }
  }

  /**
   * Verify a user-signed grant_access transaction (owner → grantee on a dataset).
   */
  async verifyGrantTx(txHash: string, expectedDatasetId: string, expectedGrantee: string, expectedOwner: string): Promise<boolean> {
    try {
      const { success, sender, payload } = await this.waitForTransaction(txHash);
      if (!success) return false;
      const txFunction = String(payload.function || '').toLowerCase().replace(/^0x/, '');
      const expectedFunction = `${this.moduleAddress}::${MODULE}::grant_access`.toLowerCase();
      if (txFunction !== expectedFunction) return false;
      if (sender.toLowerCase() !== expectedOwner.toLowerCase()) return false;
      const args = payload.arguments || [];
      const datasetIdFromTx = hexToUtf8(String(args[0] || ''));
      const granteeFromTx = String(args[1] || '').toLowerCase();
      return datasetIdFromTx === expectedDatasetId && granteeFromTx === expectedGrantee.toLowerCase();
    } catch (e: any) {
      console.warn('[AptosClient] verifyGrantTx failed:', e?.message || e);
      return false;
    }
  }

  /**
   * Record a read + payment on behalf of an owner (platform operator role)
   * Calls: shelby_research::payment::record_read_by_platform
   */
  async recordRead(
    uploaderAddr: string,
    datasetId: string,
    readerAddr: string,
    amountMillAPT: number
  ): Promise<{ txHash: string }> {
    console.log('[AptosClient] recordRead called', uploaderAddr, datasetId, readerAddr, amountMillAPT);
    if (!this.account || !this.moduleAddress) {
      console.warn('[AptosClient] Account/module not configured; skipping read event');
      return { txHash: 'stub-' + Date.now() };
    }
    try {
      const tx = await this.clientWithNetwork.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${this.moduleAddress}::${PAYMENT_MODULE}::record_read_by_platform`,
          functionArguments: [uploaderAddr, datasetId, readerAddr, amountMillAPT],
        },
      });
      const pending = await this.clientWithNetwork.signAndSubmitTransaction({ signer: this.account, transaction: tx });
      await this.clientWithNetwork.waitForTransaction({ transactionHash: pending.hash });
      return { txHash: pending.hash };
    } catch (e: any) {
      console.warn('[AptosClient] recordRead failed:', e?.message || e);
      return { txHash: 'stub-' + Date.now() };
    }
  }

  /**
   * Log a read in the owner's access control manager (platform operator role)
   * Calls: shelby_research::access_control::log_read_by_platform
   */
  async logRead(ownerAddr: string, datasetId: string, readerAddr: string, bytesRead: number): Promise<{ txHash: string }> {
    console.log('[AptosClient] logRead called', ownerAddr, datasetId, readerAddr, bytesRead);
    if (!this.account || !this.moduleAddress) {
      console.warn('[AptosClient] Account/module not configured; skipping read log');
      return { txHash: 'stub-' + Date.now() };
    }
    try {
      const tx = await this.clientWithNetwork.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${this.moduleAddress}::${MODULE}::log_read_by_platform`,
          functionArguments: [ownerAddr, datasetId, readerAddr, bytesRead],
        },
      });
      const pending = await this.clientWithNetwork.signAndSubmitTransaction({ signer: this.account, transaction: tx });
      await this.clientWithNetwork.waitForTransaction({ transactionHash: pending.hash });
      return { txHash: pending.hash };
    } catch (e: any) {
      console.warn('[AptosClient] logRead failed:', e?.message || e);
      return { txHash: 'stub-' + Date.now() };
    }
  }

  /**
   * Settle batch payments (platform operator role, called by cron job daily)
   * Calls: shelby_research::payment::settle_dataset_payments_by_platform
   */
  async settlePayments(uploaderAddr: string, datasetId: string, totalMillAPT: number): Promise<{ txHash: string }> {
    console.log('[AptosClient] settlePayments called', uploaderAddr, datasetId, totalMillAPT);
    if (!this.account || !this.moduleAddress) {
      console.warn('[AptosClient] Account/module not configured; skipping settlement');
      return { txHash: 'stub-' + Date.now() };
    }
    try {
      const tx = await this.clientWithNetwork.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${this.moduleAddress}::${PAYMENT_MODULE}::settle_dataset_payments_by_platform`,
          functionArguments: [uploaderAddr, datasetId, totalMillAPT],
        },
      });
      const pending = await this.clientWithNetwork.signAndSubmitTransaction({ signer: this.account, transaction: tx });
      await this.clientWithNetwork.waitForTransaction({ transactionHash: pending.hash });
      return { txHash: pending.hash };
    } catch (e: any) {
      console.warn('[AptosClient] settlePayments failed:', e?.message || e);
      return { txHash: 'stub-' + Date.now() };
    }
  }

  /**
   * Check whether a reader currently has valid access on-chain.
   * The owner is the dataset uploader (their wallet signed the registration).
   * Calls: shelby_research::access_control::has_valid_access (view)
   */
  async hasValidAccess(ownerAddr: string, datasetId: string, readerAddr: string): Promise<boolean> {
    if (!this.moduleAddress) return false;
    try {
      const result = await this.clientWithNetwork.view({
        payload: {
          function: `${this.moduleAddress}::${MODULE}::has_valid_access`,
          functionArguments: [ownerAddr, datasetId, readerAddr],
        },
      });
      return Boolean(result[0]);
    } catch (e: any) {
      console.warn('[AptosClient] hasValidAccess failed:', e?.message || e);
      return false;
    }
  }

  /**
   * Check if module is deployed
   */
  async isModuleDeployed(): Promise<boolean> {
    if (!this.moduleAddress) return false;
    try {
      const modules = await this.clientWithNetwork.getAccountModules({ accountAddress: AccountAddress.from(this.moduleAddress) });
      return Array.isArray(modules) && modules.length > 0;
    } catch (e) {
      console.warn('[AptosClient] Module check failed:', (e as any)?.message);
      return false;
    }
  }

  /**
   * Get account APT balance (in APT units)
   */
  async getBalance(address: string): Promise<number> {
    try {
      const amount = await this.clientWithNetwork.getAccountAPTAmount({ accountAddress: address });
      return Number(amount) / 1e8;
    } catch (e) {
      console.warn('[AptosClient] Balance check failed:', (e as any)?.message);
      return 0;
    }
  }
}

export default new AptosClient();
