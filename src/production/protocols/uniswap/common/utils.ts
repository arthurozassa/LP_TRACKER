/**
 * Shared utilities for Uniswap V2 and V3 integrations
 */

import { BigNumber, ethers } from 'ethers';
import { Token, TokenAmount, UniswapChain, UniswapError, UniswapErrorCodes, NETWORK_CONFIGS, PriceData } from './types';

// ============================================================================
// ADDRESS AND VALIDATION UTILITIES
// ============================================================================

/**
 * Validates if a string is a valid Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
  try {
    return ethers.utils.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Normalizes an Ethereum address to checksummed format
 */
export function normalizeAddress(address: string): string {
  if (!isValidEthereumAddress(address)) {
    throw new UniswapError(
      `Invalid Ethereum address: ${address}`,
      UniswapErrorCodes.INVALID_ADDRESS
    );
  }
  return ethers.utils.getAddress(address);
}

/**
 * Sorts token addresses for consistent pair ordering
 */
export function sortTokens(tokenA: string, tokenB: string): [string, string] {
  const addressA = normalizeAddress(tokenA);
  const addressB = normalizeAddress(tokenB);
  
  return addressA.toLowerCase() < addressB.toLowerCase() 
    ? [addressA, addressB] 
    : [addressB, addressA];
}

// ============================================================================
// CHAIN UTILITIES
// ============================================================================

/**
 * Gets network configuration for a chain
 */
export function getNetworkConfig(chain: UniswapChain) {
  const config = NETWORK_CONFIGS[chain];
  if (!config) {
    throw new UniswapError(
      `Unsupported chain: ${chain}`,
      UniswapErrorCodes.UNSUPPORTED_CHAIN,
      chain
    );
  }
  return config;
}

/**
 * Gets RPC URL for a chain with fallback
 */
export function getRpcUrl(chain: UniswapChain, apiKey?: string): string {
  const config = getNetworkConfig(chain);
  const urls = [...config.rpcUrls];
  
  // Add API key to first URL if it's Alchemy
  if (apiKey && urls[0]?.includes('alchemy')) {
    urls[0] = `${urls[0]}${apiKey}`;
  }
  
  return urls[0];
}

/**
 * Detects Uniswap chain from chain ID
 */
export function chainIdToUniswapChain(chainId: number): UniswapChain | null {
  for (const [chain, config] of Object.entries(NETWORK_CONFIGS)) {
    if (config.chainId === chainId) {
      return chain as UniswapChain;
    }
  }
  return null;
}

// ============================================================================
// MATH UTILITIES
// ============================================================================

/**
 * Formats wei amounts to human readable strings
 */
export function formatTokenAmount(amount: string | BigNumber, decimals: number): string {
  try {
    const bn = BigNumber.from(amount);
    return ethers.utils.formatUnits(bn, decimals);
  } catch (error) {
    throw new UniswapError(
      `Failed to format token amount: ${amount}`,
      UniswapErrorCodes.CALCULATION_ERROR
    );
  }
}

/**
 * Parses human readable amount to wei
 */
export function parseTokenAmount(amount: string, decimals: number): BigNumber {
  try {
    return ethers.utils.parseUnits(amount, decimals);
  } catch (error) {
    throw new UniswapError(
      `Failed to parse token amount: ${amount}`,
      UniswapErrorCodes.CALCULATION_ERROR
    );
  }
}

/**
 * Safely divides BigNumbers with precision
 */
export function safeDivide(numerator: BigNumber, denominator: BigNumber, precision = 18): number {
  if (denominator.isZero()) {
    return 0;
  }
  
  try {
    const scaled = numerator.mul(BigNumber.from(10).pow(precision));
    const result = scaled.div(denominator);
    return parseFloat(ethers.utils.formatUnits(result, precision));
  } catch (error) {
    return 0;
  }
}

/**
 * Calculates percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue === 0 ? 0 : 100;
  }
  return ((newValue - oldValue) / Math.abs(oldValue)) * 100;
}

/**
 * Calculates geometric mean for APY calculation
 */
export function calculateGeometricMean(values: number[]): number {
  if (values.length === 0 || values.some(v => v <= 0)) {
    return 0;
  }
  
  const product = values.reduce((acc, val) => acc * val, 1);
  return Math.pow(product, 1 / values.length);
}

// ============================================================================
// TIME UTILITIES
// ============================================================================

/**
 * Gets timestamp from blocks ago
 */
export function getTimestampFromBlocksAgo(blocksAgo: number, avgBlockTime = 12): Date {
  const secondsAgo = blocksAgo * avgBlockTime;
  return new Date(Date.now() - secondsAgo * 1000);
}

/**
 * Calculates days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime());
  return diffTime / (1000 * 60 * 60 * 24);
}

/**
 * Formats duration in milliseconds to human readable
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

// ============================================================================
// PRICE AND VALUE UTILITIES
// ============================================================================

/**
 * Creates a TokenAmount object
 */
export function createTokenAmount(token: Token, amount: string | BigNumber): TokenAmount {
  const amountBN = BigNumber.from(amount);
  const amountHuman = formatTokenAmount(amountBN, token.decimals);
  
  return {
    token,
    amount: amountBN.toString(),
    amountHuman
  };
}

/**
 * Calculates USD value of a token amount
 */
export function calculateTokenValueUSD(tokenAmount: TokenAmount, priceUSD: number): number {
  const amount = parseFloat(tokenAmount.amountHuman);
  return amount * priceUSD;
}

/**
 * Calculates pool token price based on reserves
 */
export function calculatePoolPrice(
  reserve0: string,
  reserve1: string,
  decimals0: number,
  decimals1: number
): { price0: number; price1: number } {
  const reserve0Formatted = parseFloat(formatTokenAmount(reserve0, decimals0));
  const reserve1Formatted = parseFloat(formatTokenAmount(reserve1, decimals1));
  
  if (reserve0Formatted === 0 || reserve1Formatted === 0) {
    return { price0: 0, price1: 0 };
  }
  
  return {
    price0: reserve1Formatted / reserve0Formatted,
    price1: reserve0Formatted / reserve1Formatted
  };
}

// ============================================================================
// CACHE KEY UTILITIES
// ============================================================================

/**
 * Generates cache key for positions
 */
export function generatePositionsCacheKey(
  address: string,
  chain: UniswapChain,
  protocol: 'v2' | 'v3'
): string {
  return `uniswap:${protocol}:positions:${chain}:${address.toLowerCase()}`;
}

/**
 * Generates cache key for pool data
 */
export function generatePoolCacheKey(
  poolAddress: string,
  chain: UniswapChain,
  protocol: 'v2' | 'v3'
): string {
  return `uniswap:${protocol}:pool:${chain}:${poolAddress.toLowerCase()}`;
}

/**
 * Generates cache key for token data
 */
export function generateTokenCacheKey(tokenAddress: string, chain: UniswapChain): string {
  return `uniswap:token:${chain}:${tokenAddress.toLowerCase()}`;
}

/**
 * Generates cache key for price data
 */
export function generatePriceCacheKey(tokenAddress: string, chain: UniswapChain): string {
  return `uniswap:price:${chain}:${tokenAddress.toLowerCase()}`;
}

// ============================================================================
// RETRY AND ERROR HANDLING UTILITIES
// ============================================================================

/**
 * Retries a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 10000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);
      const jitter = Math.random() * 0.1 * delay;
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError!;
}

/**
 * Wraps a promise with a timeout
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
}

/**
 * Batches array items for processing
 */
export function batchArray<T>(array: T[], batchSize: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += batchSize) {
    batches.push(array.slice(i, i + batchSize));
  }
  return batches;
}

/**
 * Delays execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// LOGGING UTILITIES
// ============================================================================

/**
 * Creates a structured log entry
 */
export function createLogEntry(
  level: 'info' | 'warn' | 'error' | 'debug',
  message: string,
  metadata?: Record<string, any>
) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: 'uniswap-integration',
    ...metadata
  };
}

/**
 * Measures execution time of a function
 */
export async function measureExecutionTime<T>(
  name: string,
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    
    console.log(createLogEntry('debug', `${name} completed`, { 
      duration: formatDuration(duration) 
    }));
    
    return { result, duration };
  } catch (error) {
    const duration = Date.now() - start;
    
    console.error(createLogEntry('error', `${name} failed`, { 
      duration: formatDuration(duration),
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
    
    throw error;
  }
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates token object
 */
export function validateToken(token: any): token is Token {
  return (
    typeof token === 'object' &&
    typeof token.address === 'string' &&
    isValidEthereumAddress(token.address) &&
    typeof token.symbol === 'string' &&
    typeof token.name === 'string' &&
    typeof token.decimals === 'number' &&
    token.decimals >= 0 &&
    token.decimals <= 18 &&
    typeof token.chainId === 'number'
  );
}

/**
 * Validates price data object
 */
export function validatePriceData(priceData: any): priceData is PriceData {
  return (
    typeof priceData === 'object' &&
    typeof priceData.token0PriceUSD === 'number' &&
    typeof priceData.token1PriceUSD === 'number' &&
    typeof priceData.poolPriceToken0 === 'number' &&
    typeof priceData.poolPriceToken1 === 'number' &&
    priceData.timestamp instanceof Date
  );
}

// ============================================================================
// EXPORT ALL UTILITIES
// ============================================================================

export const UniswapUtils = {
  // Address utilities
  isValidEthereumAddress,
  normalizeAddress,
  sortTokens,
  
  // Chain utilities
  getNetworkConfig,
  getRpcUrl,
  chainIdToUniswapChain,
  
  // Math utilities
  formatTokenAmount,
  parseTokenAmount,
  safeDivide,
  calculatePercentageChange,
  calculateGeometricMean,
  
  // Time utilities
  getTimestampFromBlocksAgo,
  daysBetween,
  formatDuration,
  
  // Price utilities
  createTokenAmount,
  calculateTokenValueUSD,
  calculatePoolPrice,
  
  // Cache utilities
  generatePositionsCacheKey,
  generatePoolCacheKey,
  generateTokenCacheKey,
  generatePriceCacheKey,
  
  // Async utilities
  retryWithBackoff,
  withTimeout,
  batchArray,
  delay,
  
  // Logging utilities
  createLogEntry,
  measureExecutionTime,
  
  // Validation utilities
  validateToken,
  validatePriceData
};

export default UniswapUtils;