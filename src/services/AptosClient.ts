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
   * The platform account used to sign on-chain transactions.
   */
  getSigner(): Account {
    if (!this.account) {
      throw new Error('APTOS_PRIVATE_KEY not configured; cannot sign transactions');
    }
    return this.account;
  }

  /**
   * Register dataset ownership on-chain
   * Calls: shelby_research::access_control::register_dataset
   */
  async registerDataset(uploaderAddr: string, datasetId: string): Promise<{ txHash: string }> {
    console.log('[AptosClient] registerDataset called', uploaderAddr, datasetId);
    if (!this.account || !this.moduleAddress) {
      console.warn('[AptosClient] Account/module not configured; skipping on-chain registration');
      return { txHash: 'stub-' + Date.now() };
    }
    try {
      const tx = await this.clientWithNetwork.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${this.moduleAddress}::${MODULE}::register_dataset`,
          functionArguments: [datasetId],
        },
      });
      const pending = await this.clientWithNetwork.signAndSubmitTransaction({ signer: this.account, transaction: tx });
      await this.clientWithNetwork.waitForTransaction({ transactionHash: pending.hash });
      return { txHash: pending.hash };
    } catch (e: any) {
      console.warn('[AptosClient] registerDataset failed:', e?.message || e);
      return { txHash: 'stub-' + Date.now() };
    }
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
    if (!this.account || !this.moduleAddress) {
      console.warn('[AptosClient] Account/module not configured; skipping grant');
      return { txHash: 'stub-' + Date.now() };
    }
    try {
      const tx = await this.clientWithNetwork.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${this.moduleAddress}::${MODULE}::grant_access`,
          functionArguments: [datasetId, granteeAddr, durationSecs, readLimit],
        },
      });
      const pending = await this.clientWithNetwork.signAndSubmitTransaction({ signer: this.account, transaction: tx });
      await this.clientWithNetwork.waitForTransaction({ transactionHash: pending.hash });
      return { txHash: pending.hash };
    } catch (e: any) {
      console.warn('[AptosClient] grantAccess failed:', e?.message || e);
      return { txHash: 'stub-' + Date.now() };
    }
  }

  /**
   * Revoke access on-chain
   * Calls: shelby_research::access_control::revoke_access
   */
  async revokeAccess(uploaderAddr: string, datasetId: string, granteeAddr: string): Promise<{ txHash: string }> {
    console.log('[AptosClient] revokeAccess called', uploaderAddr, datasetId, granteeAddr);
    if (!this.account || !this.moduleAddress) {
      console.warn('[AptosClient] Account/module not configured; skipping revoke');
      return { txHash: 'stub-' + Date.now() };
    }
    try {
      const tx = await this.clientWithNetwork.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${this.moduleAddress}::${MODULE}::revoke_access`,
          functionArguments: [datasetId, granteeAddr],
        },
      });
      const pending = await this.clientWithNetwork.signAndSubmitTransaction({ signer: this.account, transaction: tx });
      await this.clientWithNetwork.waitForTransaction({ transactionHash: pending.hash });
      return { txHash: pending.hash };
    } catch (e: any) {
      console.warn('[AptosClient] revokeAccess failed:', e?.message || e);
      return { txHash: 'stub-' + Date.now() };
    }
  }

  /**
   * Record a read event on-chain for payment tracking
   * Calls: shelby_research::payment::record_read
   */
  async recordRead(    uploaderAddr: string,
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
          function: `${this.moduleAddress}::${PAYMENT_MODULE}::record_read`,
          functionArguments: [datasetId, readerAddr, amountMillAPT],
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
   * Log a read event in the access control module
   * Calls: shelby_research::access_control::log_read
   */
  async logRead(datasetId: string, readerAddr: string, bytesRead: number): Promise<{ txHash: string }> {
    console.log('[AptosClient] logRead called', datasetId, readerAddr, bytesRead);
    if (!this.account || !this.moduleAddress) {
      console.warn('[AptosClient] Account/module not configured; skipping read log');
      return { txHash: 'stub-' + Date.now() };
    }
    try {
      const tx = await this.clientWithNetwork.transaction.build.simple({
        sender: this.account.accountAddress,
        data: {
          function: `${this.moduleAddress}::${MODULE}::log_read`,
          functionArguments: [datasetId, readerAddr, bytesRead],
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
   * Settle batch payments (called by cron job daily)
   * Calls: shelby_research::payment::settle_dataset_payments
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
          function: `${this.moduleAddress}::${PAYMENT_MODULE}::settle_dataset_payments`,
          functionArguments: [datasetId, totalMillAPT],
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
   * Check whether a reader currently has valid access on-chain
   * Calls: shelby_research::access_control::has_valid_access (view)
   */
  async hasValidAccess(datasetId: string, readerAddr: string): Promise<boolean> {
    if (!this.moduleAddress) return false;
    try {
      const result = await this.clientWithNetwork.view({
        payload: {
          function: `${this.moduleAddress}::${MODULE}::has_valid_access`,
          functionArguments: [this.moduleAddress, datasetId, readerAddr],
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
