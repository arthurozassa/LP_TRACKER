/**
 * Solana-specific types for DEX integrations
 * Common types used across all Solana protocols
 */

import { Position, ProtocolType, ChainType } from '../../../../types';

// ============================================================================
// SOLANA CORE TYPES
// ============================================================================

export interface SolanaAccountInfo {
  executable: boolean;
  owner: string;
  lamports: number;
  data: Buffer | string;
  rentEpoch?: number;
}

export interface SolanaTokenAccount {
  pubkey: string;
  account: {
    owner: string;
    mint: string;
    amount: string;
    delegatedAmount?: string;
    delegate?: string;
    state: 'initialized' | 'uninitialized' | 'frozen';
    isNative?: boolean;
    rentExemptReserve?: string;
    closeAuthority?: string;
  };
}

export interface SolanaTransaction {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
  err: any;
  memo: string | null;
}

export interface SolanaInstruction {
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: Buffer;
}

// ============================================================================
// SOLANA DEX POSITION TYPES
// ============================================================================

export interface SolanaPosition extends Position {
  // Solana-specific data
  accounts: {
    position: string;
    mint0: string;
    mint1: string;
    vault0?: string;
    vault1?: string;
  };
  
  // Program-specific data
  programId: string;
  discriminator?: Buffer;
  bump?: number;
  
  // Position state
  liquidity: string;
  tickLower?: number;
  tickUpper?: number;
  feeGrowthInside0LastX64?: string;
  feeGrowthInside1LastX64?: string;
  tokensOwed0?: string;
  tokensOwed1?: string;
  
  // Rewards (for positions with farming)
  rewards?: SolanaReward[];
  
  // Metadata
  lastSlot: number;
  createdAt: number;
  updatedAt: number;
}

export interface SolanaReward {
  mint: string;
  vault: string;
  authority: string;
  emissions: string;
  growthGlobalX64: string;
  amountOwed: string;
}

// ============================================================================
// SOLANA POOL TYPES
// ============================================================================

export interface SolanaPool {
  address: string;
  programId: string;
  
  // Token information
  tokenA: {
    mint: string;
    vault: string;
    decimals: number;
    symbol: string;
    reserve: string;
  };
  
  tokenB: {
    mint: string;
    vault: string;
    decimals: number;
    symbol: string;
    reserve: string;
  };
  
  // Pool state
  tickSpacing?: number;
  tickCurrent?: number;
  sqrtPrice?: string;
  liquidity?: string;
  feeRate: number;
  
  // Protocol-specific
  protocolVersion?: string;
  whirlpoolsConfig?: string;
  rewardInfos?: SolanaReward[];
  
  // Statistics
  volume24h: number;
  fees24h: number;
  tvl: number;
  apr: number;
  
  // Metadata
  lastSlot: number;
  createdAt: number;
}

// ============================================================================
// PROTOCOL-SPECIFIC TYPES
// ============================================================================

// Meteora DLMM (Dynamic Liquidity Market Maker)
export interface MeteoraPosition extends SolanaPosition {
  // DLMM specific
  binStep: number;
  activeId: number;
  minBinId: number;
  maxBinId: number;
  
  // Bin positions
  binPositions: Array<{
    binId: number;
    xAmount: string;
    yAmount: string;
    price: number;
    liquidity: string;
    feeX: string;
    feeY: string;
  }>;
  
  // Fee tracking
  unclaimedFees: {
    tokenX: string;
    tokenY: string;
  };
  
  // Rewards
  unclaimedRewards: Array<{
    mint: string;
    amount: string;
  }>;
}

export interface MeteoraPool extends SolanaPool {
  // DLMM specific
  binStep: number;
  activeId: number;
  reserve: {
    tokenX: string;
    tokenY: string;
  };
  
  // Bin array
  binArray: string;
  
  // Oracle
  oracle: string;
  
  // Parameters
  parameters: {
    baseFactor: number;
    filterPeriod: number;
    decayPeriod: number;
    reductionFactor: number;
    variableFeeControl: number;
    maxVolatilityAccumulator: number;
    minBinId: number;
    maxBinId: number;
  };
}

// Raydium CLMM (Concentrated Liquidity Market Maker)
export interface RaydiumPosition extends SolanaPosition {
  // CLMM specific
  poolId: string;
  positionNftMint: string;
  positionNftAccount: string;
  
  // Price range
  priceLower: number;
  priceUpper: number;
  
  // Amounts
  amountA: string;
  amountB: string;
  
  // Fees
  feeOwedA: string;
  feeOwedB: string;
  feeGrowthInsideLastA: string;
  feeGrowthInsideLastB: string;
  
  // Rewards
  rewardInfos: Array<{
    rewardMint: string;
    rewardVault: string;
    rewardGrowthGlobalX64: string;
    rewardAmountOwed: string;
  }>;
}

export interface RaydiumPool extends SolanaPool {
  // CLMM specific
  ammConfig: string;
  observationKey: string;
  
  // Tick arrays
  tickArrayBitmap: Array<string>;
  
  // Protocol fee
  protocolFeesTokenA: string;
  protocolFeesTokenB: string;
  
  // Fund fees
  fundFeesTokenA: string;
  fundFeesTokenB: string;
  
  // Open time
  openTime: string;
}

// Orca Whirlpools
export interface OrcaPosition extends SolanaPosition {
  // Whirlpool specific
  whirlpool: string;
  positionMint: string;
  
  // Price range
  tickLowerIndex: number;
  tickUpperIndex: number;
  
  // Rewards
  rewardInfos: Array<{
    mint: string;
    vault: string;
    authority: string;
    emissionsPerSecondX64: string;
    growthGlobalX64: string;
    amountOwed: string;
  }>;
}

export interface OrcaPool extends SolanaPool {
  // Whirlpool specific
  whirlpoolsConfig: string;
  whirlpoolBump: Array<number>;
  
  // Tick arrays
  tickArrays: Array<string>;
  
  // Fee and protocol fee rate
  feeRate: number;
  protocolFeeRate: number;
  
  // Reward vaults
  rewardLastUpdatedTimestamp: string;
  rewardVaultBalances: Array<string>;
}

// Jupiter Perpetuals
export interface JupiterPosition extends SolanaPosition {
  // Perp specific
  perpetuals: string;
  custody: string;
  
  // Position data
  owner: string;
  collateralMint: string;
  collateralAmount: string;
  
  // PnL data
  sizeUsd: string;
  collateralUsd: string;
  unrealizedPnlUsd: string;
  realizedPnlUsd: string;
  
  // Position state
  side: 'long' | 'short';
  entryPrice: string;
  markPrice: string;
  liquidationPrice: string;
  
  // Timestamps
  openTime: number;
  lastUpdateTime: number;
}

// ============================================================================
// SCANNING AND ANALYSIS TYPES
// ============================================================================

export interface SolanaScanConfig {
  walletAddress: string;
  protocols: SolanaProtocolConfig[];
  includeZeroBalances: boolean;
  includeClosedPositions: boolean;
  maxSlotLag: number;
  commitment: 'processed' | 'confirmed' | 'finalized';
}

export interface SolanaProtocolConfig {
  name: ProtocolType;
  programIds: string[];
  enabled: boolean;
  scanDepth: number;
  customFilters?: Array<{
    memcmp: {
      offset: number;
      bytes: string;
    };
  }>;
}

export interface SolanaScanResult {
  walletAddress: string;
  protocol: ProtocolType;
  positions: SolanaPosition[];
  pools: SolanaPool[];
  totalValue: number;
  totalPositions: number;
  scanTime: number;
  lastSlot: number;
  confidence: number;
  errors: string[];
}

// ============================================================================
// CALCULATION TYPES
// ============================================================================

export interface SolanaCalculationConfig {
  priceFeeds: Map<string, number>;
  feeTiers: Map<string, number>;
  rewardRates: Map<string, number>;
  gasPrice: number;
  slippage: number;
}

export interface SolanaPositionMetrics {
  // Value metrics
  totalValue: number;
  token0Value: number;
  token1Value: number;
  
  // Fee metrics
  totalFeesEarned: number;
  fees24h: number;
  feeAPR: number;
  
  // Reward metrics
  totalRewardsEarned: number;
  rewards24h: number;
  rewardAPR: number;
  
  // Performance metrics
  totalAPR: number;
  impermanentLoss: number;
  impermanentLossPercent: number;
  
  // Risk metrics
  utilizationRate: number;
  concentrationRisk: number;
  priceRange: {
    lower: number;
    upper: number;
    current: number;
    inRange: boolean;
  };
  
  // Time-based metrics
  ageInDays: number;
  lastActiveSlot: number;
  lastRewardClaim: number;
}

// ============================================================================
// API AND EXTERNAL TYPES
// ============================================================================

export interface SolanaAPIConfig {
  rpcUrl: string;
  wsUrl?: string;
  apiKey?: string;
  rateLimits: {
    requestsPerSecond: number;
    burstCapacity: number;
  };
  timeout: number;
  retryConfig: {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  };
}

export interface SolanaExternalAPI {
  name: string;
  baseUrl: string;
  apiKey?: string;
  endpoints: {
    pools: string;
    positions: string;
    prices: string;
    analytics: string;
  };
  rateLimits: {
    requestsPerMinute: number;
    concurrent: number;
  };
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class SolanaIntegrationError extends Error {
  constructor(
    message: string,
    public protocol: ProtocolType,
    public code: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'SolanaIntegrationError';
  }
}

export class SolanaAccountError extends SolanaIntegrationError {
  constructor(
    message: string,
    protocol: ProtocolType,
    public account: string,
    cause?: Error
  ) {
    super(message, protocol, 'ACCOUNT_ERROR', cause);
    this.name = 'SolanaAccountError';
  }
}

export class SolanaParsingError extends SolanaIntegrationError {
  constructor(
    message: string,
    protocol: ProtocolType,
    public data: any,
    cause?: Error
  ) {
    super(message, protocol, 'PARSING_ERROR', cause);
    this.name = 'SolanaParsingError';
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type SolanaAddress = string;
export type SolanaSignature = string;
export type U64String = string;
export type U128String = string;

export interface SolanaContext {
  connection: any; // Connection from @solana/web3.js
  commitment: 'processed' | 'confirmed' | 'finalized';
  timeout: number;
}

export interface SolanaTokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  coingeckoId?: string;
  isVerified: boolean;
  price?: number;
  marketCap?: number;
  volume24h?: number;
}

export interface SolanaProtocolInfo {
  name: ProtocolType;
  programId: string;
  version: string;
  tvl: number;
  volume24h: number;
  fees24h: number;
  pools: number;
  isActive: boolean;
  lastUpdate: number;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isSolanaPosition(position: Position): position is SolanaPosition {
  return position.chain === ChainType.SOLANA && 'accounts' in position;
}

export function isMeteoraPosition(position: SolanaPosition): position is MeteoraPosition {
  return position.protocol === ProtocolType.METEORA && 'binStep' in position;
}

export function isRaydiumPosition(position: SolanaPosition): position is RaydiumPosition {
  return position.protocol === ProtocolType.RAYDIUM && 'poolId' in position;
}

export function isOrcaPosition(position: SolanaPosition): position is OrcaPosition {
  return position.protocol === ProtocolType.ORCA && 'whirlpool' in position;
}

export function isJupiterPosition(position: SolanaPosition): position is JupiterPosition {
  return position.protocol === ProtocolType.JUPITER && 'perpetuals' in position;
}

export function isValidSolanaAddress(address: string): boolean {
  try {
    // Basic validation - should be base58 and correct length
    const decoded = Buffer.from(address, 'base64');
    return decoded.length === 32;
  } catch {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
}

export function isValidSolanaSignature(signature: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{86,88}$/.test(signature);
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const SOLANA_PROGRAMS = {
  // Core Solana programs
  SYSTEM: '11111111111111111111111111111112',
  TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  ASSOCIATED_TOKEN: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  
  // DEX programs
  METEORA_DLMM: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  RAYDIUM_CLMM: 'CAMMCzo5YL8w4VFF8KVHrK22GGUQZeLv6Mhff2prcJj',
  ORCA_WHIRLPOOLS: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  JUPITER_PERP: 'PERPHjGBqRHArX4DySjwM6UJHiGZs9zrePdEbJ5KPY4',
  
  // Additional protocols
  LIFINITY: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27yA35CyoWkjNsR',
  ALDRIN: 'AMM55ShdkoGRB5jVYPjWzHkwMiS1hkY3RpKDTBTXFKdq',
  SABER: 'SSwpkEEctmznU4anA1WR2T5Xhux5GxEW48U8MEjxGNk',
} as const;

export const SOLANA_TOKEN_MINTS = {
  // Native
  SOL: 'So11111111111111111111111111111111111111112',
  
  // Stablecoins
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYS',
  
  // Major tokens
  RAY: '4k3Dyjzvq8FhqrCb9jEEv4U8WKD7VTL2RfbBaK9QfYRM',
  SRM: 'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt',
  ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
  MNGO: 'MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac',
  MSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  
  // Wrapped tokens
  WBTC: '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E',
  WETH: '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
} as const;

export default {
  SOLANA_PROGRAMS,
  SOLANA_TOKEN_MINTS,
  isValidSolanaAddress,
  isValidSolanaSignature,
  isSolanaPosition,
  isMeteoraPosition,
  isRaydiumPosition,
  isOrcaPosition,
  isJupiterPosition,
};