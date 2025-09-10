/**
 * Solana common utilities
 * Shared functionality across all Solana DEX integrations
 */

import { 
  SolanaAccountInfo, 
  SolanaTokenAccount, 
  SolanaPosition,
  SolanaPositionMetrics,
  SolanaCalculationConfig,
  SolanaTokenInfo,
  SolanaAddress,
  U64String,
  SolanaIntegrationError,
  SolanaAccountError,
  SolanaParsingError,
  SOLANA_PROGRAMS,
  SOLANA_TOKEN_MINTS,
  isValidSolanaAddress
} from './types';
import { ProtocolType } from '../../../../types';

// ============================================================================
// ADDRESS AND KEY UTILITIES
// ============================================================================

/**
 * Convert buffer to base58 string (for addresses)
 */
export function bufferToBase58(buffer: Buffer): string {
  // This would use bs58 in production
  return buffer.toString('base64').replace(/[^A-Za-z0-9]/g, '');
}

/**
 * Convert base58 string to buffer
 */
export function base58ToBuffer(base58: string): Buffer {
  try {
    return Buffer.from(base58, 'base64');
  } catch (error) {
    throw new SolanaIntegrationError(
      `Invalid base58 string: ${base58}`,
      'meteora-dlmm',
      'INVALID_BASE58',
      error as Error
    );
  }
}

/**
 * Find program derived address (PDA)
 */
export function findProgramAddress(
  seeds: (Buffer | Uint8Array)[],
  programId: string
): [string, number] {
  // In production, this would use PublicKey.findProgramAddress
  // For now, return a mock implementation
  const combinedSeeds = Buffer.concat(seeds);
  const hash = combinedSeeds.toString('hex').slice(0, 44);
  return [hash, 255]; // [address, bump]
}

/**
 * Get associated token account address
 */
export function getAssociatedTokenAccount(
  address: string,
  owner: string
): string {
  // In production, this would use getAssociatedTokenAddress
  const seeds = [
    Buffer.from(owner, 'utf8'),
    Buffer.from(SOLANA_PROGRAMS.TOKEN, 'utf8'),
    Buffer.from(address, 'utf8')
  ];
  const [ata] = findProgramAddress(seeds, SOLANA_PROGRAMS.ASSOCIATED_TOKEN);
  return ata;
}

/**
 * Validate and normalize Solana address
 */
export function normalizeAddress(address: string): string {
  if (!isValidSolanaAddress(address)) {
    throw new SolanaIntegrationError(
      `Invalid Solana address: ${address}`,
      'meteora-dlmm',
      'INVALID_ADDRESS'
    );
  }
  return address;
}

// ============================================================================
// ACCOUNT DATA PARSING
// ============================================================================

/**
 * Parse account data with discriminator
 */
export function parseAccountData<T>(
  data: Buffer,
  discriminator: Buffer,
  parser: (data: Buffer) => T
): T {
  try {
    // Check discriminator (first 8 bytes)
    if (data.length < 8) {
      throw new Error('Account data too short for discriminator');
    }
    
    const accountDiscriminator = data.slice(0, 8);
    if (!accountDiscriminator.equals(discriminator)) {
      throw new Error('Invalid discriminator');
    }
    
    // Parse the remaining data
    return parser(data.slice(8));
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse account data',
      'meteora-dlmm',
      data,
      error as Error
    );
  }
}

/**
 * Parse token account data
 */
export function parseTokenAccountData(data: Buffer): SolanaTokenAccount {
  try {
    // Token account layout is well-defined
    if (data.length !== 165) {
      throw new Error(`Invalid token account data length: ${data.length}`);
    }
    
    return {
      pubkey: '', // Will be filled by caller
      account: {
        address: bufferToBase58(data.slice(0, 32)),
        owner: bufferToBase58(data.slice(32, 64)),
        amount: data.readBigUInt64LE(64).toString(),
        delegatedAmount: data.readBigUInt64LE(72).toString(),
        delegate: data.slice(76, 80).readUInt32LE(0) === 1 
          ? bufferToBase58(data.slice(80, 112)) 
          : undefined,
        state: data.slice(108, 109).readUInt8(0) === 1 ? 'initialized' : 'uninitialized',
        isNative: data.slice(112, 124).some(byte => byte !== 0) 
          ? data.readBigUInt64LE(112).toString() !== '0'
          : undefined,
        rentExemptReserve: data.readBigUInt64LE(124).toString(),
        closeAuthority: data.slice(136, 140).readUInt32LE(0) === 1 
          ? bufferToBase58(data.slice(140, 172)) 
          : undefined,
      }
    };
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse token account data',
      'meteora-dlmm',
      data,
      error as Error
    );
  }
}

/**
 * Parse U64 from buffer (little-endian)
 */
export function parseU64(data: Buffer, offset: number = 0): U64String {
  try {
    return data.readBigUInt64LE(offset).toString();
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse U64',
      'meteora-dlmm',
      data,
      error as Error
    );
  }
}

/**
 * Parse U128 from buffer (little-endian)
 */
export function parseU128(data: Buffer, offset: number = 0): string {
  try {
    const low = data.readBigUInt64LE(offset);
    const high = data.readBigUInt64LE(offset + 8);
    return (high << BigInt(64) | low).toString();
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse U128',
      'meteora-dlmm',
      data,
      error as Error
    );
  }
}

/**
 * Parse I64 from buffer (little-endian, signed)
 */
export function parseI64(data: Buffer, offset: number = 0): string {
  try {
    return data.readBigInt64LE(offset).toString();
  } catch (error) {
    throw new SolanaParsingError(
      'Failed to parse I64',
      'meteora-dlmm',
      data,
      error as Error
    );
  }
}

// ============================================================================
// MATHEMATICAL UTILITIES
// ============================================================================

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: U64String): number {
  return Number(lamports) / 1e9;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): U64String {
  return (sol * 1e9).toString();
}

/**
 * Convert token amount to UI amount
 */
export function tokenAmountToUi(amount: U64String, decimals: number): number {
  return Number(amount) / Math.pow(10, decimals);
}

/**
 * Convert UI amount to token amount
 */
export function uiAmountToToken(uiAmount: number, decimals: number): U64String {
  return (uiAmount * Math.pow(10, decimals)).toString();
}

/**
 * Calculate price from reserves (constant product)
 */
export function calculatePrice(
  reserveA: U64String,
  reserveB: U64String,
  decimalsA: number,
  decimalsB: number
): number {
  const reserveAUi = tokenAmountToUi(reserveA, decimalsA);
  const reserveBUi = tokenAmountToUi(reserveB, decimalsB);
  
  if (reserveAUi === 0) return 0;
  return reserveBUi / reserveAUi;
}

/**
 * Calculate square root price from tick (Uniswap V3 style)
 */
export function tickToSqrtPrice(tick: number): string {
  const sqrtPrice = Math.pow(1.0001, tick / 2);
  // Convert to Q64.64 format
  return (sqrtPrice * Math.pow(2, 64)).toString();
}

/**
 * Calculate tick from square root price
 */
export function sqrtPriceToTick(sqrtPrice: string): number {
  const price = Number(sqrtPrice) / Math.pow(2, 64);
  return Math.floor(Math.log(price * price) / Math.log(1.0001));
}

/**
 * Calculate liquidity for concentrated liquidity position
 */
export function calculateLiquidity(
  amount0: U64String,
  amount1: U64String,
  sqrtPriceLower: string,
  sqrtPriceUpper: string,
  sqrtPriceCurrent: string
): string {
  const amount0Num = Number(amount0);
  const amount1Num = Number(amount1);
  const priceLower = Number(sqrtPriceLower);
  const priceUpper = Number(sqrtPriceUpper);
  const priceCurrent = Number(sqrtPriceCurrent);
  
  let liquidity = 0;
  
  if (priceCurrent <= priceLower) {
    // Only token0
    liquidity = amount0Num * priceLower * priceUpper / (priceUpper - priceLower);
  } else if (priceCurrent >= priceUpper) {
    // Only token1
    liquidity = amount1Num / (priceUpper - priceLower);
  } else {
    // Both tokens
    const liquidity0 = amount0Num * priceCurrent * priceUpper / (priceUpper - priceCurrent);
    const liquidity1 = amount1Num / (priceCurrent - priceLower);
    liquidity = Math.min(liquidity0, liquidity1);
  }
  
  return liquidity.toString();
}

// ============================================================================
// POSITION CALCULATIONS
// ============================================================================

/**
 * Calculate position value in USD
 */
export function calculatePositionValue(
  position: SolanaPosition,
  config: SolanaCalculationConfig
): number {
  const token0Price = config.priceFeeds.get(position.tokens.token0.address || '') || 0;
  const token1Price = config.priceFeeds.get(position.tokens.token1.address || '') || 0;
  
  const token0ValueUi = tokenAmountToUi(
    position.tokens.token0.amount.toString(),
    position.tokens.token0.decimals || 9
  );
  const token1ValueUi = tokenAmountToUi(
    position.tokens.token1.amount.toString(),
    position.tokens.token1.decimals || 9
  );
  
  return (token0ValueUi * token0Price) + (token1ValueUi * token1Price);
}

/**
 * Calculate fees earned for a position
 */
export function calculateFeesEarned(
  position: SolanaPosition,
  config: SolanaCalculationConfig
): number {
  // This would be protocol-specific in production
  return position.feesEarned || 0;
}

/**
 * Calculate APR for a position
 */
export function calculateAPR(
  position: SolanaPosition,
  config: SolanaCalculationConfig
): number {
  const positionValue = calculatePositionValue(position, config);
  const dailyFees = position.feesEarned || 0;
  
  if (positionValue === 0) return 0;
  
  const dailyReturn = dailyFees / positionValue;
  return dailyReturn * 365 * 100; // Convert to percentage APR
}

/**
 * Calculate position metrics
 */
export function calculatePositionMetrics(
  position: SolanaPosition,
  config: SolanaCalculationConfig
): SolanaPositionMetrics {
  const totalValue = calculatePositionValue(position, config);
  const totalFeesEarned = calculateFeesEarned(position, config);
  const apr = calculateAPR(position, config);
  
  const token0Price = config.priceFeeds.get(position.tokens.token0.address || '') || 0;
  const token1Price = config.priceFeeds.get(position.tokens.token1.address || '') || 0;
  
  const token0ValueUi = tokenAmountToUi(
    position.tokens.token0.amount.toString(),
    position.tokens.token0.decimals || 9
  );
  const token1ValueUi = tokenAmountToUi(
    position.tokens.token1.amount.toString(),
    position.tokens.token1.decimals || 9
  );
  
  const token0Value = token0ValueUi * token0Price;
  const token1Value = token1ValueUi * token1Price;
  
  return {
    totalValue,
    token0Value,
    token1Value,
    totalFeesEarned,
    fees24h: totalFeesEarned, // Simplified
    feeAPR: apr,
    totalRewardsEarned: 0, // Would calculate from reward data
    rewards24h: 0,
    rewardAPR: 0,
    totalAPR: apr,
    impermanentLoss: 0, // Would calculate based on entry price
    impermanentLossPercent: 0,
    utilizationRate: position.inRange ? 1 : 0,
    concentrationRisk: 0.5, // Medium risk by default
    priceRange: {
      lower: 0, // Would calculate from tick data
      upper: 0,
      current: token0Price / token1Price,
      inRange: position.inRange
    },
    ageInDays: (Date.now() - new Date(position.createdAt || '').getTime()) / (1000 * 60 * 60 * 24),
    lastActiveSlot: position.lastSlot,
    lastRewardClaim: position.updatedAt ? new Date(position.updatedAt).getTime() : 0
  };
}

// ============================================================================
// TOKEN UTILITIES
// ============================================================================

/**
 * Get token info from cache or default
 */
export function getTokenInfo(address: string): SolanaTokenInfo {
  // In production, this would query a token registry or cache
  const knownTokens: Record<string, Partial<SolanaTokenInfo>> = {
    [SOLANA_TOKEN_MINTS.SOL]: {
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      isVerified: true
    },
    [SOLANA_TOKEN_MINTS.USDC]: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      isVerified: true
    },
    [SOLANA_TOKEN_MINTS.USDT]: {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      isVerified: true
    },
  };
  
  const known = knownTokens[address];
  
  return {
    address: address,
    symbol: known?.symbol || `TOKEN_${address.slice(0, 8)}`,
    name: known?.name || `Unknown Token`,
    decimals: known?.decimals || 9,
    logoURI: known?.logoURI,
    coingeckoId: known?.coingeckoId,
    isVerified: known?.isVerified || false,
    price: known?.price,
    marketCap: known?.marketCap,
    volume24h: known?.volume24h
  };
}

/**
 * Format token amount for display
 */
export function formatTokenAmount(
  amount: U64String,
  decimals: number,
  precision: number = 6
): string {
  const uiAmount = tokenAmountToUi(amount, decimals);
  
  if (uiAmount === 0) return '0';
  if (uiAmount < 0.000001) return '<0.000001';
  
  return uiAmount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision
  });
}

/**
 * Format price for display
 */
export function formatPrice(price: number, precision: number = 6): string {
  if (price === 0) return '$0';
  if (price < 0.000001) return '<$0.000001';
  
  return price.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: precision
  });
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle RPC errors gracefully
 */
export function handleRpcError(error: any, context: string): never {
  let message = `RPC error in ${context}`;
  let code = 'RPC_ERROR';
  
  if (error?.code) {
    code = `RPC_${error.code}`;
    message = `${message}: ${error.message || 'Unknown RPC error'}`;
  } else if (error?.message) {
    message = `${message}: ${error.message}`;
  }
  
  throw new SolanaIntegrationError(
    message,
    'meteora-dlmm',
    code,
    error
  );
}

/**
 * Handle account not found errors
 */
export function handleAccountNotFound(
  account: string,
  protocol: ProtocolType
): never {
  throw new SolanaAccountError(
    `Account not found: ${account}`,
    protocol,
    account
  );
}

/**
 * Retry with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (i === maxRetries) break;
      
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate position data
 */
export function validatePosition(position: any): position is SolanaPosition {
  return (
    typeof position === 'object' &&
    position !== null &&
    typeof position.id === 'string' &&
    typeof position.protocol === 'string' &&
    typeof position.pool === 'string' &&
    typeof position.accounts === 'object' &&
    typeof position.accounts.position === 'string' &&
    isValidSolanaAddress(position.accounts.position)
  );
}

/**
 * Validate account data
 */
export function validateAccountData(data: Buffer): boolean {
  return Buffer.isBuffer(data) && data.length > 0;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  // Address utilities
  bufferToBase58,
  base58ToBuffer,
  findProgramAddress,
  getAssociatedTokenAccount,
  normalizeAddress,
  
  // Parsing utilities
  parseAccountData,
  parseTokenAccountData,
  parseU64,
  parseU128,
  parseI64,
  
  // Math utilities
  lamportsToSol,
  solToLamports,
  tokenAmountToUi,
  uiAmountToToken,
  calculatePrice,
  tickToSqrtPrice,
  sqrtPriceToTick,
  calculateLiquidity,
  
  // Position utilities
  calculatePositionValue,
  calculateFeesEarned,
  calculateAPR,
  calculatePositionMetrics,
  
  // Token utilities
  getTokenInfo,
  formatTokenAmount,
  formatPrice,
  
  // Error handling
  handleRpcError,
  handleAccountNotFound,
  retryWithBackoff,
  
  // Validation
  validatePosition,
  validateAccountData,
};