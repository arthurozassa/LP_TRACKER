/**
 * Ethereum provider configuration with multiple RPC endpoints
 */

import { ProviderConfig, ChainType, RpcEndpoint } from '../base/types';

export interface EthereumConfig extends ProviderConfig {
  chainId: number;
  networkName: string;
}

// Production RPC endpoints with fallbacks
export const ETHEREUM_MAINNET_ENDPOINTS: RpcEndpoint[] = [
  // Infura (Primary)
  {
    id: 'infura-mainnet',
    url: process.env.INFURA_MAINNET_URL || 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
    priority: 1,
    maxRequestsPerSecond: 10,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  
  // Alchemy (Secondary)
  {
    id: 'alchemy-mainnet',
    url: process.env.ALCHEMY_MAINNET_URL || 'https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY',
    priority: 2,
    maxRequestsPerSecond: 5,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },

  // QuickNode (Tertiary)
  {
    id: 'quicknode-mainnet',
    url: process.env.QUICKNODE_MAINNET_URL || 'https://YOUR_ENDPOINT.quiknode.pro/YOUR_API_KEY/',
    priority: 3,
    maxRequestsPerSecond: 5,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },

  // Ankr (Public fallback)
  {
    id: 'ankr-mainnet',
    url: 'https://rpc.ankr.com/eth',
    priority: 4,
    maxRequestsPerSecond: 2,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 1500,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    }
  },

  // Cloudflare (Public fallback)
  {
    id: 'cloudflare-mainnet',
    url: 'https://cloudflare-eth.com',
    priority: 5,
    maxRequestsPerSecond: 1,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 12000,
      backoffFactor: 2,
      jitter: true
    }
  },

  // 1RPC (Public fallback)
  {
    id: '1rpc-mainnet',
    url: 'https://1rpc.io/eth',
    priority: 6,
    maxRequestsPerSecond: 1,
    timeout: 35000,
    healthCheckInterval: 90000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffFactor: 2.5,
      jitter: true
    }
  }
];

// Sepolia testnet endpoints
export const ETHEREUM_SEPOLIA_ENDPOINTS: RpcEndpoint[] = [
  {
    id: 'infura-sepolia',
    url: process.env.INFURA_SEPOLIA_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
    priority: 1,
    maxRequestsPerSecond: 10,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  {
    id: 'alchemy-sepolia',
    url: process.env.ALCHEMY_SEPOLIA_URL || 'https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY',
    priority: 2,
    maxRequestsPerSecond: 5,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  }
];

export const DEFAULT_ETHEREUM_CONFIG: EthereumConfig = {
  chainType: ChainType.ETHEREUM,
  chainId: 1,
  networkName: 'mainnet',
  endpoints: ETHEREUM_MAINNET_ENDPOINTS,
  connectionPool: {
    maxConnections: 10,
    idleTimeout: 30000,
    connectionTimeout: 10000,
    keepAlive: true
  },
  healthCheck: {
    enabled: true,
    interval: 60000,
    timeout: 10000,
    failureThreshold: 3
  },
  rateLimiting: {
    enabled: true,
    globalLimit: 100,
    perEndpointLimit: 50,
    windowMs: 60000
  },
  logging: {
    enabled: true,
    level: 'info',
    includeMetrics: true
  }
};

export const ETHEREUM_SEPOLIA_CONFIG: EthereumConfig = {
  ...DEFAULT_ETHEREUM_CONFIG,
  chainId: 11155111,
  networkName: 'sepolia',
  endpoints: ETHEREUM_SEPOLIA_ENDPOINTS
};

// Layer 2 configurations
export const ARBITRUM_ONE_ENDPOINTS: RpcEndpoint[] = [
  {
    id: 'infura-arbitrum',
    url: process.env.INFURA_ARBITRUM_URL || 'https://arbitrum-mainnet.infura.io/v3/YOUR_PROJECT_ID',
    priority: 1,
    maxRequestsPerSecond: 10,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  {
    id: 'alchemy-arbitrum',
    url: process.env.ALCHEMY_ARBITRUM_URL || 'https://arb-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    priority: 2,
    maxRequestsPerSecond: 5,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  {
    id: 'arbitrum-public',
    url: 'https://arb1.arbitrum.io/rpc',
    priority: 3,
    maxRequestsPerSecond: 2,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 1500,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    }
  }
];

export const POLYGON_ENDPOINTS: RpcEndpoint[] = [
  {
    id: 'infura-polygon',
    url: process.env.INFURA_POLYGON_URL || 'https://polygon-mainnet.infura.io/v3/YOUR_PROJECT_ID',
    priority: 1,
    maxRequestsPerSecond: 10,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  {
    id: 'alchemy-polygon',
    url: process.env.ALCHEMY_POLYGON_URL || 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    priority: 2,
    maxRequestsPerSecond: 5,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  {
    id: 'polygon-public',
    url: 'https://polygon-rpc.com',
    priority: 3,
    maxRequestsPerSecond: 2,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 1500,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    }
  }
];

export const BASE_ENDPOINTS: RpcEndpoint[] = [
  {
    id: 'infura-base',
    url: process.env.INFURA_BASE_URL || 'https://base-mainnet.infura.io/v3/YOUR_PROJECT_ID',
    priority: 1,
    maxRequestsPerSecond: 10,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  {
    id: 'alchemy-base',
    url: process.env.ALCHEMY_BASE_URL || 'https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    priority: 2,
    maxRequestsPerSecond: 5,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffFactor: 2,
      jitter: true
    }
  },
  {
    id: 'base-public',
    url: 'https://mainnet.base.org',
    priority: 3,
    maxRequestsPerSecond: 2,
    timeout: 30000,
    healthCheckInterval: 60000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 1500,
      maxDelay: 10000,
      backoffFactor: 2,
      jitter: true
    }
  }
];

export function getEthereumConfig(
  network: 'mainnet' | 'sepolia' | 'arbitrum' | 'polygon' | 'base' = 'mainnet'
): EthereumConfig {
  const baseConfig = { ...DEFAULT_ETHEREUM_CONFIG };
  
  switch (network) {
    case 'mainnet':
      return baseConfig;
    
    case 'sepolia':
      return {
        ...baseConfig,
        chainId: 11155111,
        networkName: 'sepolia',
        endpoints: ETHEREUM_SEPOLIA_ENDPOINTS
      };
    
    case 'arbitrum':
      return {
        ...baseConfig,
        chainId: 42161,
        networkName: 'arbitrum',
        endpoints: ARBITRUM_ONE_ENDPOINTS
      };
    
    case 'polygon':
      return {
        ...baseConfig,
        chainId: 137,
        networkName: 'polygon',
        endpoints: POLYGON_ENDPOINTS
      };
    
    case 'base':
      return {
        ...baseConfig,
        chainId: 8453,
        networkName: 'base',
        endpoints: BASE_ENDPOINTS
      };
    
    default:
      return baseConfig;
  }
}