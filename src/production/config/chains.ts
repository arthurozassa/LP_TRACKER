/**
 * Chain Configuration for Production
 * Defines all supported blockchain networks and their configurations
 */

import { ChainType } from '../../types';

export interface ChainConfig {
  id: string;
  name: string;
  type: ChainType;
  chainId: number;
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
    logoUri: string;
  };
  rpcEndpoints: {
    primary: string;
    backup: string;
    websocket?: string;
  };
  explorer: {
    name: string;
    url: string;
    apiUrl?: string;
  };
  subgraph?: {
    url: string;
    backup?: string;
  };
  gasSettings: {
    maxGasPrice: number; // in wei/lamports
    gasMultiplier: number;
    priorityFee?: number;
  };
  features: {
    eip1559: boolean;
    multicall: boolean;
    contractWallets: boolean;
  };
  tokens: {
    wrapped: string;
    stablecoins: string[];
    popular: string[];
  };
  isTestnet: boolean;
  isMainnet: boolean;
  supportedProtocols: string[];
}

/**
 * Get RPC URL for chain with fallback
 */
function getRpcUrl(chainType: ChainType, isPrimary = true): string {
  const envKey = `${chainType.toUpperCase()}_RPC_${isPrimary ? 'URL' : 'BACKUP_URL'}`;
  return process.env[envKey] || '';
}

/**
 * Get WebSocket URL for chain
 */
function getWebSocketUrl(chainType: ChainType): string | undefined {
  const envKey = `${chainType.toUpperCase()}_WEBSOCKET_URL`;
  return process.env[envKey];
}

/**
 * Ethereum Mainnet Configuration
 */
export const ETHEREUM_CONFIG: ChainConfig = {
  id: 'ethereum',
  name: 'Ethereum',
  type: 'ethereum',
  chainId: 1,
  nativeToken: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoUri: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  rpcEndpoints: {
    primary: getRpcUrl('ethereum', true) || 'https://mainnet.infura.io/v3/',
    backup: getRpcUrl('ethereum', false) || 'https://eth-mainnet.alchemyapi.io/v2/',
    websocket: getWebSocketUrl('ethereum'),
  },
  explorer: {
    name: 'Etherscan',
    url: 'https://etherscan.io',
    apiUrl: 'https://api.etherscan.io/api',
  },
  subgraph: {
    url: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
  },
  gasSettings: {
    maxGasPrice: 100_000_000_000, // 100 gwei
    gasMultiplier: 1.2,
  },
  features: {
    eip1559: true,
    multicall: true,
    contractWallets: true,
  },
  tokens: {
    wrapped: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    stablecoins: [
      '0xA0b86a33E6c52D8A4E0f77b64e251a19B75Dc10a', // USDC
      '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
    ],
    popular: [
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
      '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', // MATIC
    ],
  },
  isTestnet: false,
  isMainnet: true,
  supportedProtocols: ['uniswap-v2', 'uniswap-v3', 'sushiswap', 'curve', 'balancer'],
};

/**
 * Arbitrum Configuration
 */
export const ARBITRUM_CONFIG: ChainConfig = {
  id: 'arbitrum',
  name: 'Arbitrum One',
  type: 'arbitrum',
  chainId: 42161,
  nativeToken: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoUri: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  rpcEndpoints: {
    primary: getRpcUrl('arbitrum', true) || 'https://arbitrum-mainnet.infura.io/v3/',
    backup: getRpcUrl('arbitrum', false) || 'https://arb-mainnet.g.alchemy.com/v2/',
  },
  explorer: {
    name: 'Arbiscan',
    url: 'https://arbiscan.io',
    apiUrl: 'https://api.arbiscan.io/api',
  },
  gasSettings: {
    maxGasPrice: 1_000_000_000, // 1 gwei
    gasMultiplier: 1.1,
  },
  features: {
    eip1559: true,
    multicall: true,
    contractWallets: true,
  },
  tokens: {
    wrapped: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
    stablecoins: [
      '0xA0b86a33E6c52D8A4E0f77b64e251a19B75Dc10a', // USDC.e
      '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
      '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
    ],
    popular: [
      '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', // WBTC
      '0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', // UNI
      '0x912CE59144191C1204E64559FE8253a0e49E6548', // ARB
    ],
  },
  isTestnet: false,
  isMainnet: true,
  supportedProtocols: ['uniswap-v3-arbitrum', 'sushiswap', 'curve'],
};

/**
 * Polygon Configuration
 */
export const POLYGON_CONFIG: ChainConfig = {
  id: 'polygon',
  name: 'Polygon',
  type: 'polygon',
  chainId: 137,
  nativeToken: {
    symbol: 'MATIC',
    name: 'Polygon',
    decimals: 18,
    logoUri: 'https://assets.coingecko.com/coins/images/4713/small/matic-token-icon.png',
  },
  rpcEndpoints: {
    primary: getRpcUrl('polygon', true) || 'https://polygon-mainnet.infura.io/v3/',
    backup: getRpcUrl('polygon', false) || 'https://polygon-mainnet.g.alchemy.com/v2/',
  },
  explorer: {
    name: 'PolygonScan',
    url: 'https://polygonscan.com',
    apiUrl: 'https://api.polygonscan.com/api',
  },
  gasSettings: {
    maxGasPrice: 500_000_000_000, // 500 gwei
    gasMultiplier: 1.2,
  },
  features: {
    eip1559: true,
    multicall: true,
    contractWallets: true,
  },
  tokens: {
    wrapped: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    stablecoins: [
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // USDT
      '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI
    ],
    popular: [
      '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', // WBTC
      '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
      '0xb33EaAd8d922B1083446DC23f610c2567fB5180f', // UNI
    ],
  },
  isTestnet: false,
  isMainnet: true,
  supportedProtocols: ['uniswap-v3-polygon', 'sushiswap', 'curve'],
};

/**
 * Base Configuration
 */
export const BASE_CONFIG: ChainConfig = {
  id: 'base',
  name: 'Base',
  type: 'base',
  chainId: 8453,
  nativeToken: {
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoUri: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  rpcEndpoints: {
    primary: getRpcUrl('base', true) || 'https://mainnet.base.org',
    backup: getRpcUrl('base', false) || 'https://base-mainnet.g.alchemy.com/v2/',
  },
  explorer: {
    name: 'BaseScan',
    url: 'https://basescan.org',
    apiUrl: 'https://api.basescan.org/api',
  },
  gasSettings: {
    maxGasPrice: 1_000_000_000, // 1 gwei
    gasMultiplier: 1.1,
  },
  features: {
    eip1559: true,
    multicall: true,
    contractWallets: true,
  },
  tokens: {
    wrapped: '0x4200000000000000000000000000000000000006', // WETH
    stablecoins: [
      '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDT
    ],
    popular: [
      '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', // DAI
      '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // cbETH
    ],
  },
  isTestnet: false,
  isMainnet: true,
  supportedProtocols: ['uniswap-v3-base'],
};

/**
 * Solana Configuration
 */
export const SOLANA_CONFIG: ChainConfig = {
  id: 'solana',
  name: 'Solana',
  type: 'solana',
  chainId: 101, // Solana mainnet cluster
  nativeToken: {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    logoUri: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  },
  rpcEndpoints: {
    primary: getRpcUrl('solana', true) || 'https://api.mainnet-beta.solana.com',
    backup: getRpcUrl('solana', false) || 'https://solana-mainnet.g.alchemy.com/v2/',
    websocket: getWebSocketUrl('solana') || 'wss://api.mainnet-beta.solana.com',
  },
  explorer: {
    name: 'Solscan',
    url: 'https://solscan.io',
    apiUrl: 'https://public-api.solscan.io',
  },
  gasSettings: {
    maxGasPrice: 100_000, // 0.0001 SOL in lamports
    gasMultiplier: 1.1,
    priorityFee: 1000, // micro-lamports
  },
  features: {
    eip1559: false,
    multicall: false,
    contractWallets: false,
  },
  tokens: {
    wrapped: 'So11111111111111111111111111111111111111112', // Wrapped SOL
    stablecoins: [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
    ],
    popular: [
      '9n4nbM75f5Ui33ZbPYXn59EwSgE8CGsHtAeTH5YFeJ9E', // BTC (Wrapped)
      '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs', // ETH (Wrapped)
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',  // mSOL
    ],
  },
  isTestnet: false,
  isMainnet: true,
  supportedProtocols: ['meteora-dlmm', 'raydium-clmm', 'orca-whirlpools', 'lifinity', 'jupiter'],
};

/**
 * All supported chain configurations
 */
export const CHAIN_CONFIGS: Record<ChainType, ChainConfig> = {
  ethereum: ETHEREUM_CONFIG,
  arbitrum: ARBITRUM_CONFIG,
  polygon: POLYGON_CONFIG,
  base: BASE_CONFIG,
  solana: SOLANA_CONFIG,
};

/**
 * Get configuration for a specific chain
 */
export function getChainConfig(chainType: ChainType): ChainConfig {
  const config = CHAIN_CONFIGS[chainType];
  if (!config) {
    throw new Error(`Unsupported chain type: ${chainType}`);
  }
  return config;
}

/**
 * Get all EVM chain configurations
 */
export function getEvmChainConfigs(): ChainConfig[] {
  return [ETHEREUM_CONFIG, ARBITRUM_CONFIG, POLYGON_CONFIG, BASE_CONFIG];
}

/**
 * Get Solana chain configuration
 */
export function getSolanaChainConfig(): ChainConfig {
  return SOLANA_CONFIG;
}

/**
 * Check if chain is EVM compatible
 */
export function isEvmChain(chainType: ChainType): boolean {
  return chainType !== 'solana';
}

/**
 * Check if chain is Solana
 */
export function isSolanaChain(chainType: ChainType): boolean {
  return chainType === 'solana';
}

/**
 * Get supported chains list
 */
export function getSupportedChains(): ChainType[] {
  return Object.keys(CHAIN_CONFIGS) as ChainType[];
}

/**
 * Validate chain configuration
 */
export function validateChainConfig(config: ChainConfig): void {
  const errors: string[] = [];

  if (!config.rpcEndpoints.primary) {
    errors.push(`Missing primary RPC endpoint for ${config.name}`);
  }

  if (!config.explorer.url) {
    errors.push(`Missing explorer URL for ${config.name}`);
  }

  if (config.gasSettings.maxGasPrice <= 0) {
    errors.push(`Invalid max gas price for ${config.name}`);
  }

  if (errors.length > 0) {
    throw new Error(`Chain configuration errors for ${config.name}:\n${errors.join('\n')}`);
  }
}

/**
 * Initialize and validate all chain configurations
 */
export function initializeChainConfigs(): void {
  Object.values(CHAIN_CONFIGS).forEach(validateChainConfig);
}

export default {
  configs: CHAIN_CONFIGS,
  get: getChainConfig,
  getEvmChains: getEvmChainConfigs,
  getSolanaChain: getSolanaChainConfig,
  isEvm: isEvmChain,
  isSolana: isSolanaChain,
  getSupportedChains,
  validate: validateChainConfig,
  initialize: initializeChainConfigs,
};