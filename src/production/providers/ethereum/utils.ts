/**
 * Ethereum provider utility functions
 */

import { RequestContext, ProviderError } from '../base/types';

export interface JsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any[];
}

export interface JsonRpcResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface EthereumBlock {
  number: string;
  hash: string;
  parentHash: string;
  timestamp: string;
  gasLimit: string;
  gasUsed: string;
  transactions: string[];
}

export interface EthereumTransaction {
  hash: string;
  nonce: string;
  blockHash: string;
  blockNumber: string;
  transactionIndex: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gas: string;
  input: string;
}

export interface EthereumLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
  transactionIndex: string;
  blockHash: string;
  logIndex: string;
}

export class EthereumProviderError extends Error implements ProviderError {
  public readonly code: string;
  public readonly endpoint?: string;
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(
    message: string,
    code: string,
    retryable = true,
    endpoint?: string,
    originalError?: Error
  ) {
    super(message);
    this.name = 'EthereumProviderError';
    this.code = code;
    this.endpoint = endpoint;
    this.retryable = retryable;
    this.originalError = originalError;
  }
}

export const ERROR_CODES = {
  // Network errors (retryable)
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // RPC errors (mostly non-retryable)
  INVALID_REQUEST: 'INVALID_REQUEST',
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
  INVALID_PARAMS: 'INVALID_PARAMS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  
  // Provider specific errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  NONCE_TOO_LOW: 'NONCE_TOO_LOW',
  REPLACEMENT_UNDERPRICED: 'REPLACEMENT_UNDERPRICED',
  EXECUTION_REVERTED: 'EXECUTION_REVERTED',
  
  // Custom errors
  NO_HEALTHY_ENDPOINTS: 'NO_HEALTHY_ENDPOINTS',
  PROVIDER_DESTROYED: 'PROVIDER_DESTROYED'
} as const;

export function createJsonRpcRequest(
  method: string,
  params?: any[],
  id?: number
): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: id || Date.now(),
    method,
    params: params || []
  };
}

export function parseJsonRpcResponse<T>(
  response: any,
  context: RequestContext
): T {
  if (!response) {
    throw new EthereumProviderError(
      'Empty response received',
      ERROR_CODES.PARSE_ERROR,
      true,
      context.endpoint
    );
  }

  if (response.error) {
    const error = response.error as JsonRpcError;
    const retryable = isRetryableRpcError(error.code);
    
    throw new EthereumProviderError(
      `RPC Error: ${error.message} (${error.code})`,
      mapRpcErrorCode(error.code),
      retryable,
      context.endpoint
    );
  }

  if (response.result === undefined) {
    throw new EthereumProviderError(
      'No result in RPC response',
      ERROR_CODES.PARSE_ERROR,
      true,
      context.endpoint
    );
  }

  return response.result as T;
}

export function isRetryableRpcError(rpcCode: number): boolean {
  // Standard JSON-RPC error codes
  const retryableRpcCodes = [
    -32603, // Internal error
    -32000, // Server error (generic)
    -32001, // Resource unavailable
    -32002, // Resource not found
    -32005, // Limit exceeded
  ];

  return retryableRpcCodes.includes(rpcCode);
}

export function mapRpcErrorCode(rpcCode: number): string {
  switch (rpcCode) {
    case -32700:
      return ERROR_CODES.PARSE_ERROR;
    case -32600:
      return ERROR_CODES.INVALID_REQUEST;
    case -32601:
      return ERROR_CODES.METHOD_NOT_FOUND;
    case -32602:
      return ERROR_CODES.INVALID_PARAMS;
    case -32603:
      return ERROR_CODES.INTERNAL_ERROR;
    case -32000:
    case -32001:
    case -32002:
    case -32005:
      return ERROR_CODES.RATE_LIMITED;
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function isValidEthereumHash(hash: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

export function formatWei(wei: string): string {
  // Convert wei to ETH (18 decimals)
  const weiNumber = BigInt(wei);
  const ethNumber = Number(weiNumber) / Math.pow(10, 18);
  return ethNumber.toFixed(6);
}

export function parseWei(eth: string): string {
  // Convert ETH to wei
  const ethNumber = parseFloat(eth);
  const weiNumber = BigInt(Math.floor(ethNumber * Math.pow(10, 18)));
  return `0x${weiNumber.toString(16)}`;
}

export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

export function formatBlockNumber(blockNumber: string | number): string {
  if (typeof blockNumber === 'number') {
    return `0x${blockNumber.toString(16)}`;
  }
  
  if (typeof blockNumber === 'string' && !blockNumber.startsWith('0x')) {
    return `0x${parseInt(blockNumber, 10).toString(16)}`;
  }
  
  return blockNumber;
}

export function parseBlockNumber(blockNumber: string): number {
  if (blockNumber.startsWith('0x')) {
    return parseInt(blockNumber, 16);
  }
  return parseInt(blockNumber, 10);
}

export function isContractInteraction(transaction: EthereumTransaction): boolean {
  return transaction.to !== null && transaction.input !== '0x';
}

export function estimateGasPrice(recentBlocks: EthereumBlock[]): string {
  if (recentBlocks.length === 0) {
    return '0x2540be400'; // 10 gwei default
  }

  // Simple estimation based on recent blocks (in a real implementation,
  // you'd want to analyze actual gas prices from transactions)
  const totalGasUsed = recentBlocks.reduce((sum, block) => {
    return sum + parseInt(block.gasUsed, 16);
  }, 0);

  const averageGasUsed = totalGasUsed / recentBlocks.length;
  const basePrice = Math.max(averageGasUsed / 1000000, 1); // Minimum 1 gwei
  
  return `0x${Math.floor(basePrice * Math.pow(10, 9)).toString(16)}`;
}

export function createHealthCheckMethod(): string {
  // Use eth_blockNumber for health checks as it's fast and reliable
  return 'eth_blockNumber';
}

export function validateRpcEndpoint(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:', 'wss:', 'ws:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

export function createBatchRequest(requests: JsonRpcRequest[]): JsonRpcRequest[] {
  return requests.map((req, index) => ({
    ...req,
    id: Date.now() + index
  }));
}

export function formatLogFilter(filter: {
  fromBlock?: string | number;
  toBlock?: string | number;
  address?: string | string[];
  topics?: (string | string[] | null)[];
}): any {
  return {
    fromBlock: filter.fromBlock ? formatBlockNumber(filter.fromBlock) : 'latest',
    toBlock: filter.toBlock ? formatBlockNumber(filter.toBlock) : 'latest',
    address: filter.address,
    topics: filter.topics
  };
}

export function decodeLogData(log: EthereumLog, abi: any[]): any {
  // This would implement actual ABI decoding
  // For now, return the raw log data
  return {
    address: log.address,
    topics: log.topics,
    data: log.data,
    decoded: null // Would contain decoded parameters
  };
}

export function calculateTransactionFee(transaction: EthereumTransaction): string {
  const gasUsed = parseInt(transaction.gas, 16);
  const gasPrice = parseInt(transaction.gasPrice, 16);
  const fee = gasUsed * gasPrice;
  return `0x${fee.toString(16)}`;
}