/**
 * Ethereum Web3 Provider with production-ready features
 */

import { AbstractBaseProvider } from '../base/provider';
import { RequestContext, ProviderError, RpcEndpoint } from '../base/types';
import { EthereumConfig } from './config';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  EthereumProviderError,
  ERROR_CODES,
  createJsonRpcRequest,
  parseJsonRpcResponse,
  isValidEthereumAddress,
  formatWei,
  parseBlockNumber,
  validateRpcEndpoint,
  createHealthCheckMethod
} from './utils';

export class EthereumProvider extends AbstractBaseProvider {
  protected config: EthereumConfig;
  private abortControllers = new Map<string, AbortController>();

  constructor(config: EthereumConfig) {
    super(config);
    this.config = config;
  }

  async initialize(): Promise<void> {
    await super.initialize();
    
    // Validate all endpoints
    for (const endpoint of this.config.endpoints) {
      if (!validateRpcEndpoint(endpoint.url)) {
        this.logger.warn(`Invalid RPC endpoint: ${endpoint.url}`);
      }
    }

    // Test initial connection to primary endpoint
    try {
      await this.testConnection();
      this.logger.info(`Successfully connected to Ethereum ${this.config.networkName}`);
    } catch (error) {
      this.logger.warn({ error }, 'Initial connection test failed');
    }
  }

  protected async executeRequest<T>(
    endpoint: RpcEndpoint,
    context: RequestContext
  ): Promise<T> {
    const request = createJsonRpcRequest(context.method, context.params);
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
          'User-Agent': 'LP-Tracker/1.0'
        },
        body: JSON.stringify(request),
        signal: abortController.signal
      }, 'Logger message');

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new EthereumProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.INVALID_REQUEST,
          response.status >= 500,
          endpoint.id
        );
      }

      const jsonResponse: JsonRpcResponse<T> = await response.json();
      return parseJsonRpcResponse<T>(jsonResponse, context);

    } catch (error) {
      if (abortController.signal.aborted) {
        throw new EthereumProviderError(
          `Request timeout after ${context.timeout}ms`,
          ERROR_CODES.TIMEOUT,
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
    if (error instanceof EthereumProviderError) {
      return error;
    }

    // Handle fetch errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new EthereumProviderError(
        'Network connection failed',
        ERROR_CODES.CONNECTION_ERROR,
        true,
        context.endpoint,
        error
      );
    }

    // Handle timeout errors
    if (error.name === 'AbortError') {
      return new EthereumProviderError(
        'Request was aborted',
        ERROR_CODES.TIMEOUT,
        true,
        context.endpoint,
        error
      );
    }

    // Generic error
    return new EthereumProviderError(
      error.message || 'Unknown error occurred',
      ERROR_CODES.INTERNAL_ERROR,
      true,
      context.endpoint,
      error
    );
  }

  // Core Ethereum methods
  async getBlockNumber(): Promise<number> {
    const result = await this.request<string>('eth_blockNumber');
    return parseBlockNumber(result);
  }

  async getBalance(address: string): Promise<string> {
    if (!isValidEthereumAddress(address)) {
      throw new EthereumProviderError(
        'Invalid Ethereum address',
        ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const result = await this.request<string>('eth_getBalance', [address, 'latest']);
    return formatWei(result);
  }

  async getBlock(
    blockHashOrNumber: string | number,
    includeTransactions = false
  ): Promise<any> {
    const blockId = typeof blockHashOrNumber === 'number' 
      ? `0x${blockHashOrNumber.toString(16)}`
      : blockHashOrNumber;

    return this.request('eth_getBlockByHash', [blockId, includeTransactions]);
  }

  async getTransaction(hash: string): Promise<any> {
    return this.request('eth_getTransactionByHash', [hash]);
  }

  async getTransactionReceipt(hash: string): Promise<any> {
    return this.request('eth_getTransactionReceipt', [hash]);
  }

  async getLogs(filter: {
    fromBlock?: string | number;
    toBlock?: string | number;
    address?: string | string[];
    topics?: (string | string[] | null)[];
  }): Promise<any[]> {
    const formattedFilter = {
      fromBlock: filter.fromBlock ? 
        (typeof filter.fromBlock === 'number' ? `0x${filter.fromBlock.toString(16)}` : filter.fromBlock) : 'latest',
      toBlock: filter.toBlock ? 
        (typeof filter.toBlock === 'number' ? `0x${filter.toBlock.toString(16)}` : filter.toBlock) : 'latest',
      address: filter.address,
      topics: filter.topics
    };

    return this.request('eth_getLogs', [formattedFilter]);
  }

  async call(transaction: {
    to: string;
    data?: string;
    from?: string;
    gas?: string;
    gasPrice?: string;
    value?: string;
  }, blockTag = 'latest'): Promise<string> {
    return this.request('eth_call', [transaction, blockTag]);
  }

  async estimateGas(transaction: {
    to?: string;
    data?: string;
    from?: string;
    gas?: string;
    gasPrice?: string;
    value?: string;
  }): Promise<string> {
    return this.request('eth_estimateGas', [transaction]);
  }

  async getGasPrice(): Promise<string> {
    return this.request('eth_gasPrice');
  }

  async getTransactionCount(address: string, blockTag = 'latest'): Promise<number> {
    if (!isValidEthereumAddress(address)) {
      throw new EthereumProviderError(
        'Invalid Ethereum address',
        ERROR_CODES.INVALID_PARAMS,
        false
      );
    }

    const result = await this.request<string>('eth_getTransactionCount', [address, blockTag]);
    return parseInt(result, 16);
  }

  async sendRawTransaction(signedTransaction: string): Promise<string> {
    return this.request('eth_sendRawTransaction', [signedTransaction]);
  }

  // Batch requests
  async batchRequest(requests: Array<{
    method: string;
    params?: any[];
  }>): Promise<any[]> {
    const endpoint = this.selectHealthyEndpoint();
    if (!endpoint) {
      throw new EthereumProviderError(
        'No healthy endpoints available',
        ERROR_CODES.NO_HEALTHY_ENDPOINTS,
        false
      );
    }

    const jsonRpcRequests = requests.map((req, index) => 
      createJsonRpcRequest(req.method, req.params, Date.now() + index)
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
          'User-Agent': 'LP-Tracker/1.0'
        },
        body: JSON.stringify(jsonRpcRequests),
        signal: abortController.signal
      }, 'Logger message');

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new EthereumProviderError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status >= 500 ? ERROR_CODES.INTERNAL_ERROR : ERROR_CODES.INVALID_REQUEST,
          response.status >= 500,
          endpoint.id
        );
      }

      const jsonResponses: JsonRpcResponse[] = await response.json();
      
      return jsonResponses.map((resp, index) => {
        try {
          return parseJsonRpcResponse(resp, {
            ...context,
            method: requests[index].method
          }, 'Logger message');
        } catch (error) {
          return { error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }, 'Logger message');

    } catch (error) {
      if (abortController.signal.aborted) {
        throw new EthereumProviderError(
          `Batch request timeout after ${context.timeout}ms`,
          ERROR_CODES.TIMEOUT,
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
    await this.getBlockNumber();
  }

  // Network info
  getNetworkInfo(): { chainId: number; name: string } {
    return {
      chainId: this.config.chainId,
      name: this.config.networkName
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
export function createEthereumProvider(config: EthereumConfig): EthereumProvider {
  return new EthereumProvider(config);
}