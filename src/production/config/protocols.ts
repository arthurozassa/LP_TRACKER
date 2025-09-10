/**
 * Protocol Configuration for Production
 * Defines all supported DEX protocols and their configurations
 */

import { ChainType, ProtocolType } from '../../types';

export interface ProtocolEndpoints {
  api?: string;
  subgraph?: string;
  websocket?: string;
  backup?: string;
}

export interface ProtocolConfig {
  id: string;
  name: string;
  type: ProtocolType;
  chain: ChainType;
  displayName: string;
  description: string;
  logoUri: string;
  website: string;
  documentation: string;
  
  // Technical Configuration
  endpoints: ProtocolEndpoints;
  contractAddresses: {
    factory?: string;
    router?: string;
    multicall?: string;
    quoter?: string;
    positionManager?: string;
  };
  
  // Features
  features: {
    concentrated: boolean;
    v2Style: boolean;
    stableSwap: boolean;
    multiAsset: boolean;
    yieldFarming: boolean;
    flashLoans: boolean;
  };
  
  // Data Configuration
  dataConfig: {
    poolsEndpoint: string;
    positionsEndpoint: string;
    pricesEndpoint: string;
    feesEndpoint: string;
    analyticsEndpoint?: string;
  };
  
  // Rate Limiting
  rateLimit: {
    requestsPerSecond: number;
    burstCapacity: number;
  };
  
  // Status
  isActive: boolean;
  isTestnet: boolean;
  supportedFeatures: string[];
  version: string;
}

/**
 * Helper to get environment-based API URLs
 */
function getProtocolApiUrl(protocol: string, endpoint: string): string {
  const envKey = `${protocol.toUpperCase()}_${endpoint.toUpperCase()}_URL`;
  return process.env[envKey] || '';
}

// ============================================================================
// ETHEREUM PROTOCOLS
// ============================================================================

export const UNISWAP_V2_CONFIG: ProtocolConfig = {
  id: 'uniswap-v2',
  name: 'Uniswap V2',
  type: 'uniswap-v2',
  chain: 'ethereum',
  displayName: 'Uniswap V2',
  description: 'The original AMM with constant product formula',
  logoUri: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
  website: 'https://uniswap.org',
  documentation: 'https://docs.uniswap.org/contracts/v2',
  
  endpoints: {
    subgraph: getProtocolApiUrl('uniswap', 'v2_subgraph') || 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  },
  
  contractAddresses: {
    factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  },
  
  features: {
    concentrated: false,
    v2Style: true,
    stableSwap: false,
    multiAsset: false,
    yieldFarming: true,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/pairs',
    positionsEndpoint: '/liquidityPositions',
    pricesEndpoint: '/tokens',
    feesEndpoint: '/pairDayDatas',
  },
  
  rateLimit: {
    requestsPerSecond: 5,
    burstCapacity: 10,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees'],
  version: '2.0',
};

export const UNISWAP_V3_CONFIG: ProtocolConfig = {
  id: 'uniswap-v3',
  name: 'Uniswap V3',
  type: 'uniswap-v3',
  chain: 'ethereum',
  displayName: 'Uniswap V3',
  description: 'Concentrated liquidity AMM with customizable fee tiers',
  logoUri: 'https://assets.coingecko.com/coins/images/12504/small/uniswap-uni.png',
  website: 'https://uniswap.org',
  documentation: 'https://docs.uniswap.org/contracts/v3',
  
  endpoints: {
    subgraph: getProtocolApiUrl('uniswap', 'subgraph') || 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  },
  
  contractAddresses: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
  
  features: {
    concentrated: true,
    v2Style: false,
    stableSwap: false,
    multiAsset: false,
    yieldFarming: true,
    flashLoans: true,
  },
  
  dataConfig: {
    poolsEndpoint: '/pools',
    positionsEndpoint: '/positions',
    pricesEndpoint: '/tokens',
    feesEndpoint: '/poolDayDatas',
    analyticsEndpoint: '/analytics',
  },
  
  rateLimit: {
    requestsPerSecond: 10,
    burstCapacity: 20,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'concentrated-liquidity', 'flash-loans'],
  version: '3.0',
};

export const SUSHISWAP_CONFIG: ProtocolConfig = {
  id: 'sushiswap',
  name: 'SushiSwap',
  type: 'sushiswap',
  chain: 'ethereum',
  displayName: 'SushiSwap',
  description: 'Community-driven AMM with yield farming',
  logoUri: 'https://assets.coingecko.com/coins/images/12271/small/512x512_Logo_no_chop.png',
  website: 'https://sushi.com',
  documentation: 'https://docs.sushi.com',
  
  endpoints: {
    subgraph: getProtocolApiUrl('sushiswap', 'subgraph') || 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange',
    api: 'https://api.sushi.com',
  },
  
  contractAddresses: {
    factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  },
  
  features: {
    concentrated: false,
    v2Style: true,
    stableSwap: false,
    multiAsset: false,
    yieldFarming: true,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/pairs',
    positionsEndpoint: '/liquidityPositions',
    pricesEndpoint: '/tokens',
    feesEndpoint: '/pairDayDatas',
  },
  
  rateLimit: {
    requestsPerSecond: 8,
    burstCapacity: 15,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'yield-farming'],
  version: '1.0',
};

export const CURVE_CONFIG: ProtocolConfig = {
  id: 'curve',
  name: 'Curve Finance',
  type: 'curve',
  chain: 'ethereum',
  displayName: 'Curve',
  description: 'Stablecoin-focused AMM with low slippage',
  logoUri: 'https://assets.coingecko.com/coins/images/12124/small/Curve.png',
  website: 'https://curve.fi',
  documentation: 'https://curve.readthedocs.io',
  
  endpoints: {
    api: getProtocolApiUrl('curve', 'api') || 'https://api.curve.fi',
  },
  
  contractAddresses: {
    // Curve has multiple registries
    factory: '0x0959158b6040D32d04c301A72CBFD6b39E21c9AE', // Main registry
  },
  
  features: {
    concentrated: false,
    v2Style: false,
    stableSwap: true,
    multiAsset: true,
    yieldFarming: true,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/getPools',
    positionsEndpoint: '/getUserLiquidity',
    pricesEndpoint: '/getPrices',
    feesEndpoint: '/getPoolStats',
  },
  
  rateLimit: {
    requestsPerSecond: 5,
    burstCapacity: 10,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'stable-swaps', 'meta-pools'],
  version: '1.0',
};

export const BALANCER_CONFIG: ProtocolConfig = {
  id: 'balancer',
  name: 'Balancer',
  type: 'balancer',
  chain: 'ethereum',
  displayName: 'Balancer',
  description: 'Multi-asset AMM with customizable weights',
  logoUri: 'https://assets.coingecko.com/coins/images/11683/small/Balancer.png',
  website: 'https://balancer.fi',
  documentation: 'https://docs.balancer.fi',
  
  endpoints: {
    subgraph: getProtocolApiUrl('balancer', 'subgraph') || 'https://api.thegraph.com/subgraphs/name/balancer-labs/balancer-v2',
    api: 'https://api.balancer.fi',
  },
  
  contractAddresses: {
    factory: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', // Vault
  },
  
  features: {
    concentrated: false,
    v2Style: false,
    stableSwap: false,
    multiAsset: true,
    yieldFarming: true,
    flashLoans: true,
  },
  
  dataConfig: {
    poolsEndpoint: '/pools',
    positionsEndpoint: '/poolShares',
    pricesEndpoint: '/tokens',
    feesEndpoint: '/poolSnapshots',
  },
  
  rateLimit: {
    requestsPerSecond: 8,
    burstCapacity: 15,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'weighted-pools', 'flash-loans'],
  version: '2.0',
};

// ============================================================================
// SOLANA PROTOCOLS
// ============================================================================

export const METEORA_DLMM_CONFIG: ProtocolConfig = {
  id: 'meteora-dlmm',
  name: 'Meteora DLMM',
  type: 'meteora-dlmm',
  chain: 'solana',
  displayName: 'Meteora',
  description: 'Dynamic Liquidity Market Maker on Solana',
  logoUri: 'https://meteora.ag/favicon.ico',
  website: 'https://meteora.ag',
  documentation: 'https://docs.meteora.ag',
  
  endpoints: {
    api: getProtocolApiUrl('meteora', 'api') || 'https://api.meteora.ag',
  },
  
  contractAddresses: {
    factory: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // DLMM Program ID
  },
  
  features: {
    concentrated: true,
    v2Style: false,
    stableSwap: false,
    multiAsset: false,
    yieldFarming: true,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/pair',
    positionsEndpoint: '/position',
    pricesEndpoint: '/price',
    feesEndpoint: '/fee',
  },
  
  rateLimit: {
    requestsPerSecond: 10,
    burstCapacity: 20,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'concentrated-liquidity', 'dlmm'],
  version: '1.0',
};

export const RAYDIUM_CLMM_CONFIG: ProtocolConfig = {
  id: 'raydium-clmm',
  name: 'Raydium CLMM',
  type: 'raydium-clmm',
  chain: 'solana',
  displayName: 'Raydium',
  description: 'Concentrated Liquidity Market Maker on Solana',
  logoUri: 'https://raydium.io/favicon.ico',
  website: 'https://raydium.io',
  documentation: 'https://docs.raydium.io',
  
  endpoints: {
    api: getProtocolApiUrl('raydium', 'api') || 'https://api.raydium.io',
  },
  
  contractAddresses: {
    factory: 'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // CLMM Program ID
  },
  
  features: {
    concentrated: true,
    v2Style: false,
    stableSwap: false,
    multiAsset: false,
    yieldFarming: true,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/v2/main/pairs',
    positionsEndpoint: '/v2/main/position',
    pricesEndpoint: '/v2/main/price',
    feesEndpoint: '/v2/main/info',
  },
  
  rateLimit: {
    requestsPerSecond: 15,
    burstCapacity: 30,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'concentrated-liquidity', 'clmm'],
  version: '2.0',
};

export const ORCA_WHIRLPOOLS_CONFIG: ProtocolConfig = {
  id: 'orca-whirlpools',
  name: 'Orca Whirlpools',
  type: 'orca-whirlpools',
  chain: 'solana',
  displayName: 'Orca',
  description: 'Concentrated liquidity pools on Solana',
  logoUri: 'https://www.orca.so/favicon.ico',
  website: 'https://www.orca.so',
  documentation: 'https://docs.orca.so',
  
  endpoints: {
    api: getProtocolApiUrl('orca', 'api') || 'https://api.orca.so',
  },
  
  contractAddresses: {
    factory: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Whirlpool Program ID
  },
  
  features: {
    concentrated: true,
    v2Style: false,
    stableSwap: false,
    multiAsset: false,
    yieldFarming: true,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/v1/whirlpool/list',
    positionsEndpoint: '/v1/whirlpool/position',
    pricesEndpoint: '/v1/token/price',
    feesEndpoint: '/v1/whirlpool/fee',
  },
  
  rateLimit: {
    requestsPerSecond: 12,
    burstCapacity: 25,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'concentrated-liquidity', 'whirlpools'],
  version: '1.0',
};

export const LIFINITY_CONFIG: ProtocolConfig = {
  id: 'lifinity',
  name: 'Lifinity',
  type: 'lifinity',
  chain: 'solana',
  displayName: 'Lifinity',
  description: 'Proactive market making on Solana',
  logoUri: 'https://lifinity.io/favicon.ico',
  website: 'https://lifinity.io',
  documentation: 'https://docs.lifinity.io',
  
  endpoints: {
    api: 'https://api.lifinity.io',
  },
  
  contractAddresses: {
    factory: 'EewxydAPCCVuNEyrVN68PuSYdQ7wKn27aNjb9UdqbDms', // Lifinity Program ID
  },
  
  features: {
    concentrated: false,
    v2Style: true,
    stableSwap: false,
    multiAsset: false,
    yieldFarming: true,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/pools',
    positionsEndpoint: '/positions',
    pricesEndpoint: '/prices',
    feesEndpoint: '/fees',
  },
  
  rateLimit: {
    requestsPerSecond: 8,
    burstCapacity: 15,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'liquidity', 'fees', 'proactive-mm'],
  version: '1.0',
};

export const JUPITER_CONFIG: ProtocolConfig = {
  id: 'jupiter',
  name: 'Jupiter',
  type: 'jupiter',
  chain: 'solana',
  displayName: 'Jupiter',
  description: 'Liquidity aggregator and DCA on Solana',
  logoUri: 'https://jup.ag/favicon.ico',
  website: 'https://jup.ag',
  documentation: 'https://docs.jup.ag',
  
  endpoints: {
    api: getProtocolApiUrl('jupiter', 'api') || 'https://quote-api.jup.ag',
  },
  
  contractAddresses: {
    factory: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter Program ID
  },
  
  features: {
    concentrated: false,
    v2Style: false,
    stableSwap: false,
    multiAsset: true,
    yieldFarming: false,
    flashLoans: false,
  },
  
  dataConfig: {
    poolsEndpoint: '/v6/quote',
    positionsEndpoint: '/dca/orders',
    pricesEndpoint: '/price',
    feesEndpoint: '/stats',
  },
  
  rateLimit: {
    requestsPerSecond: 20,
    burstCapacity: 40,
  },
  
  isActive: true,
  isTestnet: false,
  supportedFeatures: ['swaps', 'aggregation', 'dca', 'limit-orders'],
  version: '6.0',
};

// ============================================================================
// L2 PROTOCOL CONFIGS (Inherited from base with chain-specific modifications)
// ============================================================================

export const UNISWAP_V3_ARBITRUM_CONFIG: ProtocolConfig = {
  ...UNISWAP_V3_CONFIG,
  id: 'uniswap-v3-arbitrum',
  type: 'uniswap-v3-arbitrum',
  chain: 'arbitrum',
  endpoints: {
    subgraph: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-arbitrum',
  },
  contractAddresses: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
};

export const UNISWAP_V3_POLYGON_CONFIG: ProtocolConfig = {
  ...UNISWAP_V3_CONFIG,
  id: 'uniswap-v3-polygon',
  type: 'uniswap-v3-polygon',
  chain: 'polygon',
  endpoints: {
    subgraph: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3-polygon',
  },
  contractAddresses: {
    factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    positionManager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
  },
};

export const UNISWAP_V3_BASE_CONFIG: ProtocolConfig = {
  ...UNISWAP_V3_CONFIG,
  id: 'uniswap-v3-base',
  type: 'uniswap-v3-base',
  chain: 'base',
  endpoints: {
    subgraph: 'https://api.studio.thegraph.com/query/5713/uniswap-v3-base/version/latest',
  },
  contractAddresses: {
    factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    router: '0x2626664c2603336E57B271c5C0b26F421741e481',
    positionManager: '0x03a520b32C04BF3bEEf7BF5d56E2a3Bd46d8e1ae',
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
  },
};

// ============================================================================
// PROTOCOL COLLECTIONS
// ============================================================================

export const ETHEREUM_PROTOCOLS: ProtocolConfig[] = [
  UNISWAP_V2_CONFIG,
  UNISWAP_V3_CONFIG,
  SUSHISWAP_CONFIG,
  CURVE_CONFIG,
  BALANCER_CONFIG,
];

export const SOLANA_PROTOCOLS: ProtocolConfig[] = [
  METEORA_DLMM_CONFIG,
  RAYDIUM_CLMM_CONFIG,
  ORCA_WHIRLPOOLS_CONFIG,
  LIFINITY_CONFIG,
  JUPITER_CONFIG,
];

export const L2_PROTOCOLS: ProtocolConfig[] = [
  UNISWAP_V3_ARBITRUM_CONFIG,
  UNISWAP_V3_POLYGON_CONFIG,
  UNISWAP_V3_BASE_CONFIG,
];

export const ALL_PROTOCOL_CONFIGS: Record<string, ProtocolConfig> = {
  // Ethereum
  'uniswap-v2': UNISWAP_V2_CONFIG,
  'uniswap-v3': UNISWAP_V3_CONFIG,
  'sushiswap': SUSHISWAP_CONFIG,
  'curve': CURVE_CONFIG,
  'balancer': BALANCER_CONFIG,
  
  // Solana
  'meteora-dlmm': METEORA_DLMM_CONFIG,
  'raydium-clmm': RAYDIUM_CLMM_CONFIG,
  'orca-whirlpools': ORCA_WHIRLPOOLS_CONFIG,
  'lifinity': LIFINITY_CONFIG,
  'jupiter': JUPITER_CONFIG,
  
  // L2s
  'uniswap-v3-arbitrum': UNISWAP_V3_ARBITRUM_CONFIG,
  'uniswap-v3-polygon': UNISWAP_V3_POLYGON_CONFIG,
  'uniswap-v3-base': UNISWAP_V3_BASE_CONFIG,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get protocol configuration by ID
 */
export function getProtocolConfig(protocolId: string): ProtocolConfig {
  const config = ALL_PROTOCOL_CONFIGS[protocolId];
  if (!config) {
    throw new Error(`Unsupported protocol: ${protocolId}`);
  }
  return config;
}

/**
 * Get all protocols for a specific chain
 */
export function getProtocolsByChain(chain: ChainType): ProtocolConfig[] {
  return Object.values(ALL_PROTOCOL_CONFIGS).filter(config => config.chain === chain);
}

/**
 * Get all active protocols
 */
export function getActiveProtocols(): ProtocolConfig[] {
  return Object.values(ALL_PROTOCOL_CONFIGS).filter(config => config.isActive);
}

/**
 * Check if protocol supports specific feature
 */
export function protocolSupportsFeature(protocolId: string, feature: string): boolean {
  const config = getProtocolConfig(protocolId);
  return config.supportedFeatures.includes(feature);
}

/**
 * Get protocols that support a specific feature
 */
export function getProtocolsByFeature(feature: string): ProtocolConfig[] {
  return Object.values(ALL_PROTOCOL_CONFIGS).filter(config => 
    config.supportedFeatures.includes(feature)
  );
}

/**
 * Validate protocol configuration
 */
export function validateProtocolConfig(config: ProtocolConfig): void {
  const errors: string[] = [];

  if (!config.id || !config.name) {
    errors.push(`Protocol must have id and name`);
  }

  if (!config.endpoints.api && !config.endpoints.subgraph) {
    errors.push(`Protocol ${config.name} must have either API or subgraph endpoint`);
  }

  if (config.rateLimit.requestsPerSecond <= 0) {
    errors.push(`Protocol ${config.name} must have positive rate limit`);
  }

  if (errors.length > 0) {
    throw new Error(`Protocol configuration errors for ${config.name}:\n${errors.join('\n')}`);
  }
}

/**
 * Initialize and validate all protocol configurations
 */
export function initializeProtocolConfigs(): void {
  Object.values(ALL_PROTOCOL_CONFIGS).forEach(validateProtocolConfig);
}

export default {
  configs: ALL_PROTOCOL_CONFIGS,
  ethereum: ETHEREUM_PROTOCOLS,
  solana: SOLANA_PROTOCOLS,
  l2: L2_PROTOCOLS,
  get: getProtocolConfig,
  getByChain: getProtocolsByChain,
  getActive: getActiveProtocols,
  supportsFeature: protocolSupportsFeature,
  getByFeature: getProtocolsByFeature,
  validate: validateProtocolConfig,
  initialize: initializeProtocolConfigs,
};