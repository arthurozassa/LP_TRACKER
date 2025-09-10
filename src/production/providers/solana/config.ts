/**
 * Solana provider configuration with multiple RPC endpoints
 */

import { ProviderConfig, ChainType, RpcEndpoint } from '../base/types';

export interface SolanaConfig extends ProviderConfig {
  cluster: 'mainnet-beta' | 'devnet' | 'testnet';
  commitment: 'processed' | 'confirmed' | 'finalized';
}

// Production Solana RPC endpoints with fallbacks
export const SOLANA_MAINNET_ENDPOINTS: RpcEndpoint[] = [
  // Helius (Primary)
  {
    id: 'helius-mainnet',
    url: process.env.HELIUS_MAINNET_URL || 'https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
    priority: 1,
    maxRequestsPerSecond: 20,
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

  // QuickNode (Secondary)
  {
    id: 'quicknode-solana',
    url: process.env.QUICKNODE_SOLANA_URL || 'https://YOUR_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_API_KEY/',
    priority: 2,
    maxRequestsPerSecond: 15,
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

  // Alchemy Solana (Tertiary)
  {
    id: 'alchemy-solana',
    url: process.env.ALCHEMY_SOLANA_URL || 'https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
    priority: 3,
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

  // Solana Labs (Public fallback)
  {
    id: 'solana-labs-mainnet',
    url: 'https://api.mainnet-beta.solana.com',
    priority: 4,
    maxRequestsPerSecond: 5,
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

  // Serum (Public fallback)
  {
    id: 'serum-mainnet',
    url: 'https://solana-api.projectserum.com',
    priority: 5,
    maxRequestsPerSecond: 3,
    timeout: 35000,
    healthCheckInterval: 90000,
    retryConfig: {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 12000,
      backoffFactor: 2,
      jitter: true
    }
  },

  // Ankr (Public fallback)
  {
    id: 'ankr-solana',
    url: 'https://rpc.ankr.com/solana',
    priority: 6,
    maxRequestsPerSecond: 2,
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

// Devnet endpoints
export const SOLANA_DEVNET_ENDPOINTS: RpcEndpoint[] = [
  {
    id: 'helius-devnet',
    url: process.env.HELIUS_DEVNET_URL || 'https://devnet.helius-rpc.com/?api-key=YOUR_API_KEY',
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
    id: 'solana-labs-devnet',
    url: 'https://api.devnet.solana.com',
    priority: 2,
    maxRequestsPerSecond: 5,
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

export const DEFAULT_SOLANA_CONFIG: SolanaConfig = {
  chainType: ChainType.SOLANA,
  cluster: 'mainnet-beta',
  commitment: 'confirmed',
  endpoints: SOLANA_MAINNET_ENDPOINTS,
  connectionPool: {
    maxConnections: 8,
    idleTimeout: 30000,
    connectionTimeout: 10000,
    keepAlive: true
  },
  healthCheck: {
    enabled: true,
    interval: 60000,
    timeout: 15000,
    failureThreshold: 3
  },
  rateLimiting: {
    enabled: true,
    globalLimit: 200,
    perEndpointLimit: 100,
    windowMs: 60000
  },
  logging: {
    enabled: true,
    level: 'info',
    includeMetrics: true
  }
};

export const SOLANA_DEVNET_CONFIG: SolanaConfig = {
  ...DEFAULT_SOLANA_CONFIG,
  cluster: 'devnet',
  endpoints: SOLANA_DEVNET_ENDPOINTS
};

// RPC methods configuration
export const SOLANA_METHODS = {
  // Account methods
  GET_ACCOUNT_INFO: 'getAccountInfo',
  GET_MULTIPLE_ACCOUNTS: 'getMultipleAccounts',
  GET_PROGRAM_ACCOUNTS: 'getProgramAccounts',
  
  // Block methods
  GET_BLOCK: 'getBlock',
  GET_BLOCKS: 'getBlocks',
  GET_BLOCK_HEIGHT: 'getBlockHeight',
  GET_BLOCK_COMMITMENT: 'getBlockCommitment',
  GET_BLOCK_TIME: 'getBlockTime',
  
  // Transaction methods
  GET_TRANSACTION: 'getTransaction',
  GET_SIGNATURES_FOR_ADDRESS: 'getSignaturesForAddress',
  GET_CONFIRMED_SIGNATURES_FOR_ADDRESS2: 'getConfirmedSignaturesForAddress2',
  SEND_TRANSACTION: 'sendTransaction',
  SIMULATE_TRANSACTION: 'simulateTransaction',
  
  // Slot methods
  GET_SLOT: 'getSlot',
  GET_SLOT_LEADER: 'getSlotLeader',
  GET_SLOT_LEADERS: 'getSlotLeaders',
  
  // Network methods
  GET_CLUSTER_NODES: 'getClusterNodes',
  GET_EPOCH_INFO: 'getEpochInfo',
  GET_GENESIS_HASH: 'getGenesisHash',
  GET_HEALTH: 'getHealth',
  GET_VERSION: 'getVersion',
  
  // Token methods
  GET_TOKEN_ACCOUNT_BALANCE: 'getTokenAccountBalance',
  GET_TOKEN_ACCOUNTS_BY_OWNER: 'getTokenAccountsByOwner',
  GET_TOKEN_SUPPLY: 'getTokenSupply',
  
  // Staking methods
  GET_STAKE_ACTIVATION: 'getStakeActivation',
  GET_VOTE_ACCOUNTS: 'getVoteAccounts',
  
  // Recent methods
  GET_RECENT_BLOCK_HASH: 'getRecentBlockhash',
  GET_LATEST_BLOCKHASH: 'getLatestBlockhash',
  GET_FEE_FOR_MESSAGE: 'getFeeForMessage',
  
  // Supply methods
  GET_SUPPLY: 'getSupply',
  GET_INFLATION_GOVERNOR: 'getInflationGovernor',
  GET_INFLATION_RATE: 'getInflationRate',
  GET_INFLATION_REWARD: 'getInflationReward'
} as const;

export const COMMITMENT_LEVELS = {
  PROCESSED: 'processed',
  CONFIRMED: 'confirmed', 
  FINALIZED: 'finalized'
} as const;

export const ENCODING_TYPES = {
  BASE58: 'base58',
  BASE64: 'base64',
  BASE64_ZSTD: 'base64+zstd',
  JSON_PARSED: 'jsonParsed'
} as const;

export function getSolanaConfig(
  cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'
): SolanaConfig {
  const baseConfig = { ...DEFAULT_SOLANA_CONFIG };
  
  switch (cluster) {
    case 'mainnet-beta':
      return baseConfig;
    
    case 'devnet':
      return {
        ...baseConfig,
        cluster: 'devnet',
        endpoints: SOLANA_DEVNET_ENDPOINTS
      };
    
    case 'testnet':
      return {
        ...baseConfig,
        cluster: 'testnet',
        endpoints: [{
          id: 'solana-labs-testnet',
          url: 'https://api.testnet.solana.com',
          priority: 1,
          maxRequestsPerSecond: 5,
          timeout: 30000,
          healthCheckInterval: 60000,
          retryConfig: {
            maxRetries: 2,
            baseDelay: 1500,
            maxDelay: 10000,
            backoffFactor: 2,
            jitter: true
          }
        }]
      };
    
    default:
      return baseConfig;
  }
}

// Helper function to get WebSocket endpoints for real-time subscriptions
export function getWebSocketEndpoints(cluster: 'mainnet-beta' | 'devnet' | 'testnet' = 'mainnet-beta'): string[] {
  switch (cluster) {
    case 'mainnet-beta':
      return [
        process.env.HELIUS_MAINNET_WS || 'wss://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY',
        process.env.QUICKNODE_SOLANA_WS || 'wss://YOUR_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_API_KEY/',
        'wss://api.mainnet-beta.solana.com'
      ];
    
    case 'devnet':
      return [
        process.env.HELIUS_DEVNET_WS || 'wss://devnet.helius-rpc.com/?api-key=YOUR_API_KEY',
        'wss://api.devnet.solana.com'
      ];
    
    case 'testnet':
      return ['wss://api.testnet.solana.com'];
    
    default:
      return ['wss://api.mainnet-beta.solana.com'];
  }
}