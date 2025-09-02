import type { ChainType } from '../../types';
export type Chain = ChainType;

// Demo wallet addresses for testing
export const DEMO_WALLETS = {
  ethereum: {
    label: 'Ethereum LP Whale',
    address: '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503',
    description: 'Large Uniswap V3 LP positions across multiple pairs',
  },
  solana: {
    label: 'Solana DeFi Trader',
    address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
    description: 'Active Meteora DLMM and Orca Whirlpools positions',
  },
  arbitrum: {
    label: 'Arbitrum LP Provider',
    address: '0x56178a0d5F301bAf6CF3e17a8e4d8B5e7e5e5e5e',
    description: 'Camelot V3 and Uniswap V3 concentrated liquidity',
  },
} as const;

// RPC endpoints (these should be moved to environment variables in production)
export const RPC_ENDPOINTS: Record<Chain, string> = {
  ethereum: 'https://eth-mainnet.g.alchemy.com/v2/demo',
  arbitrum: 'https://arb-mainnet.g.alchemy.com/v2/demo',
  polygon: 'https://polygon-mainnet.g.alchemy.com/v2/demo',
  base: 'https://base-mainnet.g.alchemy.com/v2/demo',
  solana: 'https://api.mainnet-beta.solana.com',
};

// Chain network IDs
export const CHAIN_IDS: Record<Chain, number | string> = {
  ethereum: 1,
  arbitrum: 42161,
  polygon: 137,
  base: 8453,
  solana: 'mainnet-beta',
};

// Native tokens for each chain
export const NATIVE_TOKENS: Record<Chain, { symbol: string; decimals: number; address?: string }> = {
  ethereum: { symbol: 'ETH', decimals: 18 },
  arbitrum: { symbol: 'ETH', decimals: 18 },
  polygon: { symbol: 'MATIC', decimals: 18 },
  base: { symbol: 'ETH', decimals: 18 },
  solana: { symbol: 'SOL', decimals: 9, address: 'So11111111111111111111111111111111111111112' },
};

// Common stablecoins addresses
export const STABLECOINS: Record<Chain, Record<string, { symbol: string; decimals: number; address: string }>> = {
  ethereum: {
    USDC: { symbol: 'USDC', decimals: 6, address: '0xA0b86a33E6441cB81308d4d1F4cD4F6BE0b5B2F8' },
    USDT: { symbol: 'USDT', decimals: 6, address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    DAI: { symbol: 'DAI', decimals: 18, address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
  },
  arbitrum: {
    USDC: { symbol: 'USDC', decimals: 6, address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8' },
    USDT: { symbol: 'USDT', decimals: 6, address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    DAI: { symbol: 'DAI', decimals: 18, address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
  },
  polygon: {
    USDC: { symbol: 'USDC', decimals: 6, address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
    USDT: { symbol: 'USDT', decimals: 6, address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
    DAI: { symbol: 'DAI', decimals: 18, address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' },
  },
  base: {
    USDC: { symbol: 'USDC', decimals: 6, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    DAI: { symbol: 'DAI', decimals: 18, address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
  },
  solana: {
    USDC: { symbol: 'USDC', decimals: 6, address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    USDT: { symbol: 'USDT', decimals: 6, address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' },
  },
};

// Fee tiers for different protocols
export const FEE_TIERS = {
  UNISWAP_V3: {
    LOW: 500,      // 0.05%
    MEDIUM: 3000,  // 0.3%
    HIGH: 10000,   // 1%
  },
  UNISWAP_V2: {
    STANDARD: 3000, // 0.3%
  },
  SUSHISWAP: {
    STANDARD: 3000, // 0.3%
  },
  CURVE: {
    LOW: 400,     // 0.04%
    MEDIUM: 4000, // 0.4%
  },
} as const;

// Position status types
export const POSITION_STATUS = {
  IN_RANGE: 'in_range',
  OUT_OF_RANGE: 'out_of_range',
  CLOSED: 'closed',
  PENDING: 'pending',
} as const;

// Time ranges for historical data
export const TIME_RANGES = {
  '1D': { label: '1 Day', hours: 24 },
  '1W': { label: '1 Week', hours: 24 * 7 },
  '1M': { label: '1 Month', hours: 24 * 30 },
  '3M': { label: '3 Months', hours: 24 * 90 },
  '1Y': { label: '1 Year', hours: 24 * 365 },
  'ALL': { label: 'All Time', hours: 24 * 365 * 10 },
} as const;

// Scanning status types
export const SCAN_STATUS = {
  IDLE: 'idle',
  SCANNING: 'scanning',
  SUCCESS: 'success',
  ERROR: 'error',
  PARTIAL: 'partial',
} as const;

// Protocol feature flags
export const PROTOCOL_FEATURES = {
  V2_POOLS: 'v2_pools',
  V3_POOLS: 'v3_pools',
  CONCENTRATED_LIQUIDITY: 'concentrated_liquidity',
  STABLE_SWAPS: 'stable_swaps',
  YIELD_FARMING: 'yield_farming',
  GOVERNANCE_TOKENS: 'governance_tokens',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  INVALID_ADDRESS: 'Invalid wallet address format',
  NETWORK_ERROR: 'Network error occurred while scanning',
  TIMEOUT_ERROR: 'Request timeout - please try again',
  RATE_LIMIT: 'Rate limit exceeded - please wait before scanning again',
  PROTOCOL_ERROR: 'Protocol-specific error occurred',
  INSUFFICIENT_DATA: 'Insufficient data to calculate metrics',
  UNSUPPORTED_CHAIN: 'Chain not supported',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  SCAN_COMPLETE: 'Scan completed successfully',
  POSITIONS_FOUND: 'LP positions found',
  NO_POSITIONS: 'No LP positions found for this wallet',
} as const;

// API rate limits (requests per minute)
export const RATE_LIMITS = {
  SUBGRAPH: 60,
  RPC: 120,
  EXTERNAL_API: 30,
  COINGECKO: 100,
} as const;