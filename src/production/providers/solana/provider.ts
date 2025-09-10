/**
 * Solana Web3 Provider with production-ready features
 */

import { AbstractBaseProvider } from '../base/provider';
import { RequestContext, ProviderError, RpcEndpoint } from '../base/types';
import { SolanaConfig, SOLANA_METHODS, COMMITMENT_LEVELS, ENCODING_TYPES } from './config';
import {
  SolanaJsonRpcRequest,
  SolanaJsonRpcResponse,
  SolanaProviderError,
  SOLANA_ERROR_CODES,
  createSolanaJsonRpcRequest,
  parseSolanaJsonRpcResponse,
  isValidSolanaAddress,
  isValidSolanaSignature,
  formatLamports,
  createAccountInfoParams,
  createTransactionParams,
  createSignatureParams,
  createTokenAccountParams,
  validateSolanaRpcEndpoint,
  createHealthCheckMethod,
  SolanaAccount,
  SolanaBlock,
  SolanaTokenAccount,
  SolanaSignatureStatus
} from './utils';

export class SolanaProvider extends AbstractBaseProvider {
  protected config: SolanaConfig;
  private abortControllers = new Map<string, AbortController>();

  constructor(config: SolanaConfig) {
    super(config);
    this.config = config;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    
    // Validate all endpoints
    for (const endpoint of this.config.endpoints) {
      if (!validateSolanaRpcEndpoint(endpoint.url)) {
        this.logger.warn(`Invalid Solana RPC endpoint: ${endpoint.url}`);
      }
    }

    // Test initial connection to primary endpoint
    try {
      await this.testConnection();
      this.logger.info(`Successfully connected to Solana ${this.config.cluster}`);
    } catch (error) {
      this.logger.warn('Initial Solana connection test failed', { error });
    }
  }

  protected async executeRequest<T>(
    endpoint: RpcEndpoint,
    context: RequestContext
  ): Promise<T> {
    const request = createSolanaJsonRpcRequest(context.method, context.params);
    const abortController = new AbortController();
    const requestId = `${endpoint.id}-${Date.now()}`;
    
    this.abortControllers.set(requestId, abortController);

    try {
      const timeoutId = setTimeout(() => {
        abortController.abort();
      }, context.timeout);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LP-Tracker-Solana/1.0'
        },
        body: JSON.stringify(request),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new SolanaProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status >= 500 ? SOLANA_ERROR_CODES.INTERNAL_ERROR : SOLANA_ERROR_CODES.INVALID_REQUEST,
          response.status >= 500,
          endpoint.id
        );
      }

      const jsonResponse: SolanaJsonRpcResponse<T> = await response.json();
      return parseSolanaJsonRpcResponse<T>(jsonResponse, context);

    } catch (error) {
      if (abortController.signal.aborted) {
        throw new SolanaProviderError(
          `Request timeout after ${context.timeout}ms`,
          SOLANA_ERROR_CODES.TIMEOUT,
          true,
          endpoint.id,
          error as Error
        );
      }

      throw error;
    } finally {
      this.abortControllers.delete(requestId);
    }
  }

  protected handleError(error: Error, context: RequestContext): ProviderError {
    if (error instanceof SolanaProviderError) {
      return error;
    }

    // Handle fetch errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new SolanaProviderError(
        'Network connection failed',
        SOLANA_ERROR_CODES.CONNECTION_ERROR,
        true,
        context.endpoint,
        error
      );
    }

    // Handle timeout errors
    if (error.name === 'AbortError') {
      return new SolanaProviderError(
        'Request was aborted',
        SOLANA_ERROR_CODES.TIMEOUT,
        true,
        context.endpoint,
        error
      );
    }

    // Generic error
    return new SolanaProviderError(
      error.message || 'Unknown error occurred',
      SOLANA_ERROR_CODES.INTERNAL_ERROR,
      true,
      context.endpoint,
      error
    );
  }

  // Core Solana methods
  async getSlot(): Promise<number> {
    return this.request<number>(SOLANA_METHODS.GET_SLOT, [
      { commitment: this.config.commitment }
    ]);
  }

  async getBlockNumber(): Promise<number> {
    return this.getSlot();
  }

  async getBalance(address: string): Promise<string> {
    if (!isValidSolanaAddress(address)) {
      throw new SolanaProviderError(
        'Invalid Solana address',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const result = await this.request<{ value: number }>('getBalance', [
      address,
      { commitment: this.config.commitment }
    ]);
    
    return formatLamports(result.value);
  }

  async getAccountInfo(
    address: string,
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
      encoding?: 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
      dataSlice?: { offset: number; length: number };
    } = {}
  ): Promise<SolanaAccount | null> {
    if (!isValidSolanaAddress(address)) {
      throw new SolanaProviderError(
        'Invalid Solana address',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const params = createAccountInfoParams(address, {
      commitment: options.commitment || this.config.commitment,
      encoding: options.encoding || ENCODING_TYPES.BASE64,
      dataSlice: options.dataSlice
    });

    const result = await this.request<{ value: SolanaAccount | null }>(
      SOLANA_METHODS.GET_ACCOUNT_INFO,
      params
    );

    return result.value;
  }

  async getMultipleAccounts(
    addresses: string[],
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
      encoding?: 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
    } = {}
  ): Promise<(SolanaAccount | null)[]> {
    for (const address of addresses) {
      if (!isValidSolanaAddress(address)) {
        throw new SolanaProviderError(
          `Invalid Solana address: ${address}`,
          SOLANA_ERROR_CODES.INVALID_PARAMS,
          false
        );
      }
    }

    const params = [
      addresses,
      {
        commitment: options.commitment || this.config.commitment,
        encoding: options.encoding || ENCODING_TYPES.BASE64
      }
    ];

    const result = await this.request<{ value: (SolanaAccount | null)[] }>(
      SOLANA_METHODS.GET_MULTIPLE_ACCOUNTS,
      params
    );

    return result.value;
  }

  async getProgramAccounts(
    programId: string,
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
      encoding?: 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
      filters?: Array<{
        memcmp?: { offset: number; bytes: string };
        dataSize?: number;
      }>;
    } = {}
  ): Promise<Array<{ pubkey: string; account: SolanaAccount }>> {
    if (!isValidSolanaAddress(programId)) {
      throw new SolanaProviderError(
        'Invalid program ID',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const params: any[] = [programId];
    
    const config: any = {
      commitment: options.commitment || this.config.commitment,
      encoding: options.encoding || ENCODING_TYPES.BASE64
    };

    if (options.filters) {
      config.filters = options.filters;
    }

    params.push(config);

    return this.request(SOLANA_METHODS.GET_PROGRAM_ACCOUNTS, params);
  }

  async getBlock(
    slot: number,
    options: {
      encoding?: 'json' | 'jsonParsed' | 'base58' | 'base64';
      transactionDetails?: 'full' | 'signatures' | 'none';
      rewards?: boolean;
      commitment?: 'processed' | 'confirmed' | 'finalized';
    } = {}
  ): Promise<SolanaBlock | null> {
    const params = [
      slot,
      {
        encoding: options.encoding || 'json',
        transactionDetails: options.transactionDetails || 'full',
        rewards: options.rewards !== false,
        commitment: options.commitment || this.config.commitment
      }
    ];

    return this.request(SOLANA_METHODS.GET_BLOCK, params);
  }

  async getTransaction(
    signature: string,
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
      encoding?: 'json' | 'jsonParsed' | 'base58' | 'base64';
      maxSupportedTransactionVersion?: number;
    } = {}
  ): Promise<any> {
    if (!isValidSolanaSignature(signature)) {
      throw new SolanaProviderError(
        'Invalid transaction signature',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const params = createTransactionParams(signature, {
      commitment: options.commitment || this.config.commitment,
      encoding: options.encoding || 'json',
      maxSupportedTransactionVersion: options.maxSupportedTransactionVersion
    });

    return this.request(SOLANA_METHODS.GET_TRANSACTION, params);
  }

  async getSignaturesForAddress(
    address: string,
    options: {
      limit?: number;
      before?: string;
      until?: string;
      commitment?: 'processed' | 'confirmed' | 'finalized';
    } = {}
  ): Promise<Array<{
    signature: string;
    slot: number;
    err: any;
    memo: string | null;
    blockTime: number | null;
  }>> {
    if (!isValidSolanaAddress(address)) {
      throw new SolanaProviderError(
        'Invalid Solana address',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const params = createSignatureParams(address, {
      limit: options.limit || 1000,
      before: options.before,
      until: options.until,
      commitment: options.commitment || this.config.commitment
    });

    return this.request(SOLANA_METHODS.GET_SIGNATURES_FOR_ADDRESS, params);
  }

  async getTokenAccountsByOwner(
    owner: string,
    filter: { mint: string } | { programId: string },
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
      encoding?: 'base58' | 'base64' | 'jsonParsed';
    } = {}
  ): Promise<{ value: SolanaTokenAccount[] }> {
    if (!isValidSolanaAddress(owner)) {
      throw new SolanaProviderError(
        'Invalid owner address',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const params = createTokenAccountParams(owner, {
      ...filter,
      commitment: options.commitment || this.config.commitment,
      encoding: options.encoding || ENCODING_TYPES.JSON_PARSED
    });

    return this.request(SOLANA_METHODS.GET_TOKEN_ACCOUNTS_BY_OWNER, params);
  }

  async getTokenAccountBalance(
    tokenAccount: string,
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
    } = {}
  ): Promise<{
    value: {
      amount: string;
      decimals: number;
      uiAmount: number;
      uiAmountString: string;
    };
  }> {
    if (!isValidSolanaAddress(tokenAccount)) {
      throw new SolanaProviderError(
        'Invalid token account address',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const params = [
      tokenAccount,
      { commitment: options.commitment || this.config.commitment }
    ];

    return this.request(SOLANA_METHODS.GET_TOKEN_ACCOUNT_BALANCE, params);
  }

  async getTokenSupply(
    mint: string,
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
    } = {}
  ): Promise<{
    value: {
      amount: string;
      decimals: number;
      uiAmount: number;
      uiAmountString: string;
    };
  }> {
    if (!isValidSolanaAddress(mint)) {
      throw new SolanaProviderError(
        'Invalid mint address',
        SOLANA_ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const params = [
      mint,
      { commitment: options.commitment || this.config.commitment }
    ];

    return this.request(SOLANA_METHODS.GET_TOKEN_SUPPLY, params);
  }

  async sendTransaction(
    transaction: string,
    options: {
      skipPreflight?: boolean;
      preflightCommitment?: 'processed' | 'confirmed' | 'finalized';
      encoding?: 'base58' | 'base64';
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const params = [
      transaction,
      {
        skipPreflight: options.skipPreflight || false,
        preflightCommitment: options.preflightCommitment || this.config.commitment,
        encoding: options.encoding || 'base64',
        maxRetries: options.maxRetries
      }
    ];

    return this.request(SOLANA_METHODS.SEND_TRANSACTION, params);
  }

  async simulateTransaction(
    transaction: string,
    options: {
      commitment?: 'processed' | 'confirmed' | 'finalized';
      encoding?: 'base58' | 'base64';
      replaceRecentBlockhash?: boolean;
      accounts?: {
        encoding?: 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
        addresses: string[];
      };
    } = {}
  ): Promise<any> {
    const params = [
      transaction,
      {
        commitment: options.commitment || this.config.commitment,
        encoding: options.encoding || 'base64',
        replaceRecentBlockhash: options.replaceRecentBlockhash || false,
        accounts: options.accounts
      }
    ];

    return this.request(SOLANA_METHODS.SIMULATE_TRANSACTION, params);
  }

  async getLatestBlockhash(
    commitment?: 'processed' | 'confirmed' | 'finalized'
  ): Promise<{
    value: {
      blockhash: string;
      lastValidBlockHeight: number;
    };
  }> {
    const params = [
      { commitment: commitment || this.config.commitment }
    ];

    return this.request(SOLANA_METHODS.GET_LATEST_BLOCKHASH, params);
  }

  async getEpochInfo(
    commitment?: 'processed' | 'confirmed' | 'finalized'
  ): Promise<{
    epoch: number;
    slotIndex: number;
    slotsInEpoch: number;
    absoluteSlot: number;
    blockHeight: number;
    transactionCount: number;
  }> {
    const params = [
      { commitment: commitment || this.config.commitment }
    ];

    return this.request(SOLANA_METHODS.GET_EPOCH_INFO, params);
  }

  async getHealth(): Promise<'ok' | string> {
    return this.request(SOLANA_METHODS.GET_HEALTH);
  }

  async getVersion(): Promise<{
    'solana-core': string;
    'feature-set': number;
  }> {
    return this.request(SOLANA_METHODS.GET_VERSION);
  }

  // Batch requests
  async batchRequest(requests: Array<{
    method: string;
    params?: any[];
  }>): Promise<any[]> {
    const endpoint = this.selectHealthyEndpoint();
    if (!endpoint) {
      throw new SolanaProviderError(
        'No healthy endpoints available',
        SOLANA_ERROR_CODES.NO_HEALTHY_ENDPOINTS,
        false
      );
    }

    const jsonRpcRequests = requests.map((req, index) => 
      createSolanaJsonRpcRequest(req.method, req.params, Date.now() + index)
    );

    const context: RequestContext = {
      method: 'batch',
      params: jsonRpcRequests,
      endpoint: endpoint.id,
      attempt: 0,
      startTime: Date.now(),
      timeout: endpoint.timeout
    };

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, context.timeout);

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LP-Tracker-Solana/1.0'
        },
        body: JSON.stringify(jsonRpcRequests),
        signal: abortController.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new SolanaProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status >= 500 ? SOLANA_ERROR_CODES.INTERNAL_ERROR : SOLANA_ERROR_CODES.INVALID_REQUEST,
          response.status >= 500,
          endpoint.id
        );
      }

      const jsonResponses: SolanaJsonRpcResponse[] = await response.json();
      
      return jsonResponses.map((resp, index) => {
        try {
          return parseSolanaJsonRpcResponse(resp, {
            ...context,
            method: requests[index].method
          });
        } catch (error) {
          return { error: (error as Error).message };
        }
      });

    } catch (error) {
      if (abortController.signal.aborted) {
        throw new SolanaProviderError(
          `Batch request timeout after ${context.timeout}ms`,
          SOLANA_ERROR_CODES.TIMEOUT,
          true,
          endpoint.id,
          error as Error
        );
      }
      throw this.handleError(error as Error, context);
    }
  }

  // Health check
  private async testConnection(): Promise<void> {
    await this.getHealth();
  }

  // Cluster info
  getClusterInfo(): { cluster: string; commitment: string } {
    return {
      cluster: this.config.cluster,
      commitment: this.config.commitment
    };
  }

  // Provider stats
  getProviderStats(): {
    endpoints: Array<{
      id: string;
      url: string;
      health: any;
      metrics: any;
    }>;
    overallHealth: boolean;
  } {
    const endpoints = this.config.endpoints.map(endpoint => ({
      id: endpoint.id,
      url: endpoint.url,
      health: this.health.get(endpoint.id),
      metrics: this.metrics.get(endpoint.id)
    }));

    return {
      endpoints,
      overallHealth: this.isHealthy()
    };
  }

  async destroy(): Promise<void> {
    // Cancel all pending requests
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();

    await super.destroy();
  }
}

// Factory function for easy instantiation
export function createSolanaProvider(config: SolanaConfig): SolanaProvider {
  return new SolanaProvider(config);
}