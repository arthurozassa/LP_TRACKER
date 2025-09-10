/**
 * Solana provider utility functions
 */

import { RequestContext, ProviderError } from '../base/types';

export interface SolanaJsonRpcRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: any[];
}

export interface SolanaJsonRpcResponse<T = any> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: SolanaJsonRpcError;
}

export interface SolanaJsonRpcError {
  code: number;
  message: string;
  data?: any;
}

export interface SolanaAccount {
  lamports: number;
  owner: string;
  data: string | object;
  executable: boolean;
  rentEpoch: number;
}

export interface SolanaTransaction {
  signatures: string[];
  message: {
    header: {
      numRequiredSignatures: number;
      numReadonlySignedAccounts: number;
      numReadonlyUnsignedAccounts: number;
    };
    accountKeys: string[];
    recentBlockhash: string;
    instructions: {
      programIdIndex: number;
      accounts: number[];
      data: string;
    }[];
  };
}

export interface SolanaBlock {
  blockhash: string;
  parentSlot: number;
  slot: number;
  blockTime?: number;
  blockHeight?: number;
  transactions?: any[];
  rewards?: any[];
}

export interface SolanaSignatureStatus {
  slot: number;
  confirmations?: number;
  err?: any;
  confirmationStatus?: 'processed' | 'confirmed' | 'finalized';
}

export interface SolanaTokenAccount {
  account: {
    data: {
      program: string;
      parsed: {
        info: {
          tokenAmount: {
            amount: string;
            decimals: number;
            uiAmount: number;
            uiAmountString: string;
          };
          mint: string;
          owner: string;
        };
        type: string;
      };
      space: number;
    };
    executable: boolean;
    lamports: number;
    owner: string;
    rentEpoch: number;
  };
  pubkey: string;
}

export class SolanaProviderError extends Error implements ProviderError {
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
    this.name = 'SolanaProviderError';
    this.code = code;
    this.endpoint = endpoint;
    this.retryable = retryable;
    this.originalError = originalError;
  }
}

export const SOLANA_ERROR_CODES = {
  // Network errors (retryable)
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // RPC errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  METHOD_NOT_FOUND: 'METHOD_NOT_FOUND',
  INVALID_PARAMS: 'INVALID_PARAMS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  
  // Solana specific errors
  ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',
  BLOCK_NOT_AVAILABLE: 'BLOCK_NOT_AVAILABLE',
  SLOT_SKIPPED: 'SLOT_SKIPPED',
  NO_LEADER: 'NO_LEADER',
  TRANSACTION_SIGNATURE_VERIFICATION_FAILURE: 'TRANSACTION_SIGNATURE_VERIFICATION_FAILURE',
  BLOCKHASH_NOT_FOUND: 'BLOCKHASH_NOT_FOUND',
  INSUFFICIENT_FUNDS_FOR_FEE: 'INSUFFICIENT_FUNDS_FOR_FEE',
  INSUFFICIENT_FUNDS_FOR_RENT: 'INSUFFICIENT_FUNDS_FOR_RENT',
  
  // Custom errors
  NO_HEALTHY_ENDPOINTS: 'NO_HEALTHY_ENDPOINTS',
  PROVIDER_DESTROYED: 'PROVIDER_DESTROYED'
} as const;

export function createSolanaJsonRpcRequest(
  method: string,
  params?: any[],
  id?: number
): SolanaJsonRpcRequest {
  return {
    jsonrpc: '2.0',
    id: id || Date.now(),
    method,
    params: params || []
  };
}

export function parseSolanaJsonRpcResponse<T>(
  response: any,
  context: RequestContext
): T {
  if (!response) {
    throw new SolanaProviderError(
      'Empty response received',
      SOLANA_ERROR_CODES.PARSE_ERROR,
      true,
      context.endpoint
    );
  }

  if (response.error) {
    const error = response.error as SolanaJsonRpcError;
    const retryable = isRetrySolanaRpcError(error.code);
    
    throw new SolanaProviderError(
      `Solana RPC Error: ${error.message} (${error.code})`,
      mapSolanaRpcErrorCode(error.code),
      retryable,
      context.endpoint
    );
  }

  if (response.result === undefined) {
    throw new SolanaProviderError(
      'No result in RPC response',
      SOLANA_ERROR_CODES.PARSE_ERROR,
      true,
      context.endpoint
    );
  }

  return response.result as T;
}

export function isRetrySolanaRpcError(rpcCode: number): boolean {
  // Solana-specific retryable error codes
  const retryableRpcCodes = [
    -32603, // Internal error
    -32005, // Request-rate limit exceeded
    -32004, // Transaction simulation failed
    -32002, // Transaction signature verification failure
    -32001, // Blockhash not found
  ];

  return retryableRpcCodes.includes(rpcCode);
}

export function mapSolanaRpcErrorCode(rpcCode: number): string {
  switch (rpcCode) {
    case -32700:
      return SOLANA_ERROR_CODES.PARSE_ERROR;
    case -32600:
      return SOLANA_ERROR_CODES.INVALID_REQUEST;
    case -32601:
      return SOLANA_ERROR_CODES.METHOD_NOT_FOUND;
    case -32602:
      return SOLANA_ERROR_CODES.INVALID_PARAMS;
    case -32603:
      return SOLANA_ERROR_CODES.INTERNAL_ERROR;
    case -32005:
      return SOLANA_ERROR_CODES.RATE_LIMITED;
    case -32004:
      return SOLANA_ERROR_CODES.TRANSACTION_SIGNATURE_VERIFICATION_FAILURE;
    case -32002:
      return SOLANA_ERROR_CODES.TRANSACTION_SIGNATURE_VERIFICATION_FAILURE;
    case -32001:
      return SOLANA_ERROR_CODES.BLOCKHASH_NOT_FOUND;
    default:
      return SOLANA_ERROR_CODES.INTERNAL_ERROR;
  }
}

export function isValidSolanaAddress(address: string): boolean {
  // Solana addresses are base58 encoded and 32-44 characters long
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

export function isValidSolanaSignature(signature: string): boolean {
  // Solana signatures are base58 encoded and typically 88 characters
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
}

export function formatLamports(lamports: number, decimals = 9): string {
  // Convert lamports to SOL (9 decimals by default)
  const solNumber = lamports / Math.pow(10, decimals);
  return solNumber.toFixed(6);
}

export function parseLamports(sol: string, decimals = 9): number {
  // Convert SOL to lamports
  const solNumber = parseFloat(sol);
  return Math.floor(solNumber * Math.pow(10, decimals));
}

export function normalizeAccount(account: string): string {
  return account;
}

export function formatCommitment(commitment?: 'processed' | 'confirmed' | 'finalized'): string {
  return commitment || 'confirmed';
}

export function createAccountInfoParams(
  address: string,
  options: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'base58' | 'base64' | 'base64+zstd' | 'jsonParsed';
    dataSlice?: {
      offset: number;
      length: number;
    };
  } = {}
): any[] {
  const params: any[] = [address];
  
  if (Object.keys(options).length > 0) {
    const config: any = {};
    
    if (options.commitment) {
      config.commitment = options.commitment;
    }
    
    if (options.encoding) {
      config.encoding = options.encoding;
    }
    
    if (options.dataSlice) {
      config.dataSlice = options.dataSlice;
    }
    
    params.push(config);
  }
  
  return params;
}

export function createTransactionParams(
  signature: string,
  options: {
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'base58' | 'base64' | 'base64+zstd' | 'json' | 'jsonParsed';
    maxSupportedTransactionVersion?: number;
  } = {}
): any[] {
  const params: any[] = [signature];
  
  if (Object.keys(options).length > 0) {
    const config: any = {};
    
    if (options.commitment) {
      config.commitment = options.commitment;
    }
    
    if (options.encoding) {
      config.encoding = options.encoding;
    }
    
    if (options.maxSupportedTransactionVersion !== undefined) {
      config.maxSupportedTransactionVersion = options.maxSupportedTransactionVersion;
    }
    
    params.push(config);
  }
  
  return params;
}

export function createSignatureParams(
  address: string,
  options: {
    limit?: number;
    before?: string;
    until?: string;
    commitment?: 'processed' | 'confirmed' | 'finalized';
  } = {}
): any[] {
  const params: any[] = [address];
  
  if (Object.keys(options).length > 0) {
    const config: any = {};
    
    if (options.limit) {
      config.limit = options.limit;
    }
    
    if (options.before) {
      config.before = options.before;
    }
    
    if (options.until) {
      config.until = options.until;
    }
    
    if (options.commitment) {
      config.commitment = options.commitment;
    }
    
    params.push(config);
  }
  
  return params;
}

export function createTokenAccountParams(
  owner: string,
  options: {
    mint?: string;
    programId?: string;
    commitment?: 'processed' | 'confirmed' | 'finalized';
    encoding?: 'base58' | 'base64' | 'jsonParsed';
  } = {}
): any[] {
  const params: any[] = [owner];
  
  const filter: any = {};
  if (options.mint) {
    filter.mint = options.mint;
  } else if (options.programId) {
    filter.programId = options.programId;
  }
  
  params.push(filter);
  
  if (options.commitment || options.encoding) {
    const config: any = {};
    
    if (options.commitment) {
      config.commitment = options.commitment;
    }
    
    if (options.encoding) {
      config.encoding = options.encoding;
    }
    
    params.push(config);
  }
  
  return params;
}

export function createHealthCheckMethod(): string {
  return 'getHealth';
}

export function validateSolanaRpcEndpoint(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return ['http:', 'https:', 'wss:', 'ws:'].includes(parsedUrl.protocol);
  } catch {
    return false;
  }
}

export function createBatchSolanaRequest(requests: SolanaJsonRpcRequest[]): SolanaJsonRpcRequest[] {
  return requests.map((req, index) => ({
    ...req,
    id: Date.now() + index
  }));
}

export function calculateTransactionSize(transaction: string): number {
  // Estimate transaction size in bytes (base64 encoded)
  return Math.ceil(transaction.length * 0.75);
}

export function estimateTransactionFee(
  signatures: number,
  computeUnits: number = 200000
): number {
  // Basic fee estimation for Solana transactions
  // 5000 lamports per signature + compute fee
  const signatureFee = signatures * 5000;
  const computeFee = Math.ceil(computeUnits / 1000) * 1000; // Simplified
  
  return signatureFee + computeFee;
}

export function parseTokenAmount(
  amount: string,
  decimals: number
): {
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
} {
  const amountBN = BigInt(amount);
  const divisor = BigInt(Math.pow(10, decimals));
  const uiAmount = Number(amountBN) / Math.pow(10, decimals);
  
  return {
    amount,
    decimals,
    uiAmount,
    uiAmountString: uiAmount.toFixed(decimals)
  };
}

export function encodeInstructionData(data: number[]): string {
  // Convert instruction data array to base64 encoded string (fallback for base58)
  return Buffer.from(data).toString('base64');
}

export function decodeInstructionData(data: string): number[] {
  // Decode base64 encoded instruction data to array (fallback for base58)
  return Array.from(Buffer.from(data, 'base64'));
}

export function getAccountTypeFromData(data: any): string {
  if (typeof data === 'object' && data.program) {
    return data.program;
  }
  
  if (typeof data === 'string') {
    return 'raw';
  }
  
  return 'unknown';
}