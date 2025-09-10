/**
 * Shared types for Uniswap V2 and V3 integrations
 */

import { Position, ChainType } from '../../../../types';

// ============================================================================
// NETWORK CONFIGURATIONS
// ============================================================================

export enum UniswapChain {
  ETHEREUM = 'ethereum',
  ARBITRUM = 'arbitrum',
  POLYGON = 'polygon',
  BASE = 'base',
  OPTIMISM = 'optimism',
  AVALANCHE = 'avalanche',
  BSC = 'bsc'
}

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrls: string[];
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    v2Factory?: string;
    v2Router?: string;
    v3Factory?: string;
    v3Router?: string;
    nftPositionManager?: string;
    quoter?: string;
    multicall?: string;
  };
  subgraphs: {
    v2?: string;
    v3?: string;
  };
}

export const NETWORK_CONFIGS: Record<UniswapChain, NetworkConfig> = {
  [UniswapChain.ETHEREUM]: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/', 'https://cloudflare-eth.com'],
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    contracts: {
      v2Factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      v2Router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      nftPositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      multicall: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696'
    },
    subgraphs: {
      v2: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
      v3: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3'
    }
  },
  [UniswapChain.ARBITRUM]: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.public-rpc.com'],
    blockExplorer: 'https://arbiscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    contracts: {
      v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      nftPositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      multicall: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696'
    },
    subgraphs: {
      v3: 'https://api.thegraph.com/subgraphs/name/ianlapham/arbitrum-minimal'
    }
  },
  [UniswapChain.POLYGON]: {
    chainId: 137,
    name: 'Polygon',
    rpcUrls: ['https://polygon-rpc.com', 'https://rpc-mainnet.maticvigil.com'],
    blockExplorer: 'https://polygonscan.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    contracts: {
      v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      nftPositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      multicall: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696'
    },
    subgraphs: {
      v3: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-polygon'
    }
  },
  [UniswapChain.BASE]: {
    chainId: 8453,
    name: 'Base',
    rpcUrls: ['https://mainnet.base.org', 'https://base.publicnode.com'],
    blockExplorer: 'https://basescan.org',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    contracts: {
      v3Factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
      v3Router: '0x2626664c2603336E57B271c5C0b26F421741e481',
      nftPositionManager: '0x03a520b32C04BF3bEEf7BF5C4Fc8F37E15C67c7d',
      quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
      multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    subgraphs: {
      v3: 'https://api.thegraph.com/subgraphs/name/ianlapham/base-uniswap-v3'
    }
  },
  [UniswapChain.OPTIMISM]: {
    chainId: 10,
    name: 'Optimism',
    rpcUrls: ['https://mainnet.optimism.io', 'https://optimism.publicnode.com'],
    blockExplorer: 'https://optimistic.etherscan.io',
    nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
    contracts: {
      v3Factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      v3Router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      nftPositionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      multicall: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696'
    },
    subgraphs: {
      v3: 'https://api.thegraph.com/subgraphs/name/ianlapham/optimism-minimal'
    }
  },
  [UniswapChain.AVALANCHE]: {
    chainId: 43114,
    name: 'Avalanche',
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorer: 'https://snowtrace.io',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
    contracts: {
      v3Factory: '0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD',
      v3Router: '0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE',
      nftPositionManager: '0x655C406EBFa14EE2006250925e54ec43AD184f8B',
      quoter: '0xbe0F5544EC67e9B3b2D979aaA43f18Fd87E6257F',
      multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    subgraphs: {
      v3: 'https://api.thegraph.com/subgraphs/name/messari/uniswap-v3-avalanche'
    }
  },
  [UniswapChain.BSC]: {
    chainId: 56,
    name: 'Binance Smart Chain',
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorer: 'https://bscscan.com',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    contracts: {
      v3Factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
      v3Router: '0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2',
      nftPositionManager: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613',
      quoter: '0x78D78E420Da98ad378D7799bE8f4AF69033EB077',
      multicall: '0xcA11bde05977b3631167028862bE2a173976CA11'
    },
    subgraphs: {
      v3: 'https://api.thegraph.com/subgraphs/name/ianlapham/uniswap-v3-bsc'
    }
  }
};

// ============================================================================
// TOKEN TYPES
// ============================================================================

export interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
}

export interface TokenAmount {
  token: Token;
  amount: string;
  amountHuman: string;
}

// ============================================================================
// POOL TYPES
// ============================================================================

export interface Pool {
  id: string;
  address: string;
  token0: Token;
  token1: Token;
  fee?: number; // V3 only - fee tier in basis points
  tvlUSD: number;
  volumeUSD24h: number;
  feesUSD24h: number;
  apr?: number;
  createdAt: Date;
}

export interface PoolV2 extends Pool {
  reserve0: string;
  reserve1: string;
  totalSupply: string;
}

export interface PoolV3 extends Pool {
  fee: number; // fee tier (500, 3000, 10000)
  sqrtPriceX96: string;
  tick: number;
  liquidity: string;
  tickSpacing: number;
}

// ============================================================================
// POSITION TYPES
// ============================================================================

export interface UniswapBasePosition {
  id: string;
  protocol: 'uniswap-v2' | 'uniswap-v3';
  chain: UniswapChain;
  pool: Pool;
  owner: string;
  
  // Value information
  liquidity: string;
  liquidityUSD: number;
  
  // Token amounts
  token0Amount: TokenAmount;
  token1Amount: TokenAmount;
  
  // Fee information
  feesEarned0: TokenAmount;
  feesEarned1: TokenAmount;
  feesEarnedUSD: number;
  
  // Performance metrics
  apr: number;
  apy: number;
  impermanentLoss: number;
  
  // Metadata
  createdAt: Date;
  lastUpdate: Date;
  isActive: boolean;
}

export interface UniswapV2Position extends UniswapBasePosition {
  protocol: 'uniswap-v2';
  pool: PoolV2;
  
  // V2 specific
  lpTokenBalance: string;
  shareOfPool: number;
}

export interface UniswapV3Position extends UniswapBasePosition {
  protocol: 'uniswap-v3';
  pool: PoolV3;
  
  // V3 specific - concentrated liquidity
  tokenId: string;
  tickLower: number;
  tickUpper: number;
  inRange: boolean;
  
  // Price range information
  priceLower: number;
  priceUpper: number;
  priceRange: {
    min: string;
    max: string;
    current: string;
  };
  
  // Fee growth tracking
  feeGrowthInside0LastX128: string;
  feeGrowthInside1LastX128: string;
  tokensOwed0: string;
  tokensOwed1: string;
}

export type UniswapPosition = UniswapV2Position | UniswapV3Position;

// ============================================================================
// SCANNING TYPES
// ============================================================================

export interface ScanParams {
  address: string;
  chains?: UniswapChain[];
  includeV2?: boolean;
  includeV3?: boolean;
  minTvl?: number;
  includeInactive?: boolean;
}

export interface ScanResult {
  address: string;
  totalValueUSD: number;
  totalFeesEarnedUSD: number;
  positions: UniswapPosition[];
  chains: UniswapChain[];
  protocols: ('uniswap-v2' | 'uniswap-v3')[];
  scannedAt: Date;
  processingTimeMs: number;
}

export interface PositionScanProgress {
  chain: UniswapChain;
  protocol: 'v2' | 'v3';
  status: 'pending' | 'scanning' | 'completed' | 'error';
  positionsFound: number;
  error?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class UniswapError extends Error {
  constructor(
    message: string,
    public code: string,
    public chain?: UniswapChain,
    public protocol?: 'v2' | 'v3'
  ) {
    super(message);
    this.name = 'UniswapError';
  }
}

export enum UniswapErrorCodes {
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  SUBGRAPH_ERROR = 'SUBGRAPH_ERROR',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  POSITION_NOT_FOUND = 'POSITION_NOT_FOUND',
  CALCULATION_ERROR = 'CALCULATION_ERROR',
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN'
}

// ============================================================================
// CALCULATION TYPES
// ============================================================================

export interface PriceData {
  token0PriceUSD: number;
  token1PriceUSD: number;
  poolPriceToken0: number;
  poolPriceToken1: number;
  timestamp: Date;
}

export interface FeesCalculation {
  fees0: string;
  fees1: string;
  feesUSD: number;
  apr: number;
  apy: number;
  period: number; // days
}

export interface ImpermanentLossCalculation {
  currentValue: number;
  hodlValue: number;
  impermanentLoss: number;
  impermanentLossPercent: number;
}

export interface PositionMetrics {
  currentValue: number;
  originalValue: number;
  pnl: number;
  pnlPercent: number;
  fees: FeesCalculation;
  impermanentLoss: ImpermanentLossCalculation;
  timeWeightedReturn: number;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  expiresAt: Date;
  key: string;
}

export interface CacheConfig {
  ttl: {
    positions: number;    // Position data TTL in seconds
    pools: number;        // Pool data TTL
    prices: number;       // Price data TTL
    tokens: number;       // Token metadata TTL
  };
  maxSize: number;        // Max cache entries
  compression: boolean;   // Enable compression
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export function isV2Position(position: UniswapPosition): position is UniswapV2Position {
  return position.protocol === 'uniswap-v2';
}

export function isV3Position(position: UniswapPosition): position is UniswapV3Position {
  return position.protocol === 'uniswap-v3';
}

export function chainToChainType(chain: UniswapChain): ChainType {
  switch (chain) {
    case UniswapChain.ETHEREUM:
      return 'ethereum' as any;
    case UniswapChain.ARBITRUM:
    case UniswapChain.POLYGON:
    case UniswapChain.BASE:
    case UniswapChain.OPTIMISM:
      return 'ethereum' as any; // All are Ethereum L2s
    case UniswapChain.AVALANCHE:
      return 'ethereum' as any; // EVM compatible
    case UniswapChain.BSC:
      return 'ethereum' as any; // EVM compatible
    default:
      return 'ethereum' as any;
  }
}

export function uniswapChainFromId(chainId: number): UniswapChain | null {
  const entries = Object.entries(NETWORK_CONFIGS);
  const found = entries.find(([, config]) => config.chainId === chainId);
  return found ? (found[0] as UniswapChain) : null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)',
];

export const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function totalSupply() external view returns (uint)',
  'function balanceOf(address owner) external view returns (uint)',
  'function kLast() external view returns (uint)',
];

export const UNISWAP_V3_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
];

export const UNISWAP_V3_POOL_ABI = [
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function tickSpacing() external view returns (int24)',
];

export const NFT_POSITION_MANAGER_ABI = [
  'function balanceOf(address owner) external view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
];

export const ERC20_ABI = [
  'function decimals() external view returns (uint8)',
  'function symbol() external view returns (string)',
  'function name() external view returns (string)',
  'function balanceOf(address account) external view returns (uint256)',
];

// Fee tiers for Uniswap V3
export const V3_FEE_TIERS = {
  LOWEST: 100,  // 0.01%
  LOW: 500,     // 0.05%
  MEDIUM: 3000, // 0.3%
  HIGH: 10000,  // 1%
} as const;

// Common stable coins and wrapped tokens
export const COMMON_TOKENS: Record<UniswapChain, Record<string, Token>> = {
  [UniswapChain.ETHEREUM]: {
    WETH: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      name: 'Wrapped Ethereum',
      decimals: 18,
      chainId: 1
    },
    USDC: {
      address: '0xA0b86a33E6441936e9dBEb1C5f10c5F6Bb9B74c7',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      chainId: 1
    },
    USDT: {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      chainId: 1
    }
  },
  // Add other chains as needed
  [UniswapChain.ARBITRUM]: {},
  [UniswapChain.POLYGON]: {},
  [UniswapChain.BASE]: {},
  [UniswapChain.OPTIMISM]: {},
  [UniswapChain.AVALANCHE]: {},
  [UniswapChain.BSC]: {}
};