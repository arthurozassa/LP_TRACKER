/**
 * Chain constants and configurations for LP Position Tracker
 */

import { ChainInfo, EthereumNetwork, SolanaNetwork } from './types';

// Address format regex patterns
export const ADDRESS_PATTERNS = {
  ETHEREUM: /^0x[a-fA-F0-9]{40}$/,
  SOLANA: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
} as const;

// Chain IDs for Ethereum-based networks
export const CHAIN_IDS = {
  ETHEREUM: 1,
  ARBITRUM: 42161,
  POLYGON: 137,
  BASE: 8453,
  OPTIMISM: 10,
  // Testnets
  ETHEREUM_GOERLI: 5,
  ETHEREUM_SEPOLIA: 11155111,
  ARBITRUM_GOERLI: 421613,
  POLYGON_MUMBAI: 80001,
  BASE_GOERLI: 84531,
  OPTIMISM_GOERLI: 420,
} as const;

// Network configurations
export const CHAIN_CONFIGS: Record<string, ChainInfo> = {
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    type: 'ethereum',
    network: 'ethereum',
    displayName: 'Ethereum Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
    ],
    blockExplorerUrls: ['https://etherscan.io'],
    chainId: CHAIN_IDS.ETHEREUM,
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum',
    type: 'ethereum',
    network: 'arbitrum',
    displayName: 'Arbitrum One',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://arbitrum.llamarpc.com',
      'https://rpc.ankr.com/arbitrum',
      'https://arbitrum-one.publicnode.com',
    ],
    blockExplorerUrls: ['https://arbiscan.io'],
    chainId: CHAIN_IDS.ARBITRUM,
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    type: 'ethereum',
    network: 'polygon',
    displayName: 'Polygon Mainnet',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: [
      'https://polygon.llamarpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon-bor.publicnode.com',
    ],
    blockExplorerUrls: ['https://polygonscan.com'],
    chainId: CHAIN_IDS.POLYGON,
  },
  base: {
    id: 'base',
    name: 'Base',
    type: 'ethereum',
    network: 'base',
    displayName: 'Base Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://base.llamarpc.com',
      'https://rpc.ankr.com/base',
      'https://base.publicnode.com',
    ],
    blockExplorerUrls: ['https://basescan.org'],
    chainId: CHAIN_IDS.BASE,
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    type: 'ethereum',
    network: 'optimism',
    displayName: 'Optimism Mainnet',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: [
      'https://optimism.llamarpc.com',
      'https://rpc.ankr.com/optimism',
      'https://optimism.publicnode.com',
    ],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
    chainId: CHAIN_IDS.OPTIMISM,
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    type: 'solana',
    network: 'solana',
    displayName: 'Solana Mainnet',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
    },
    rpcUrls: [
      'https://api.mainnet-beta.solana.com',
      'https://rpc.ankr.com/solana',
      'https://solana.publicnode.com',
    ],
    blockExplorerUrls: ['https://solscan.io', 'https://explorer.solana.com'],
  },
};

// Protocol support by network
export const SUPPORTED_PROTOCOLS = {
  ethereum: [
    'uniswap-v2',
    'uniswap-v3',
    'sushiswap',
    'curve',
    'balancer',
    'pancakeswap',
  ],
  arbitrum: [
    'uniswap-v3',
    'sushiswap',
    'curve',
    'balancer',
    'camelot',
    'ramses',
  ],
  polygon: [
    'uniswap-v3',
    'sushiswap',
    'curve',
    'balancer',
    'quickswap',
    'gamma',
  ],
  base: [
    'uniswap-v3',
    'sushiswap',
    'curve',
    'balancer',
    'aerodrome',
    'velodrome',
  ],
  optimism: [
    'uniswap-v3',
    'sushiswap',
    'curve',
    'balancer',
    'velodrome',
    'beethoven-x',
  ],
  solana: [
    'meteora-dlmm',
    'raydium-clmm',
    'orca-whirlpools',
    'lifinity',
    'jupiter',
    'aldrin',
  ],
} as const;

// Testnet configurations (for development)
export const TESTNET_CONFIGS: Record<string, Partial<ChainInfo>> = {
  'ethereum-goerli': {
    id: 'ethereum-goerli',
    displayName: 'Ethereum Goerli',
    chainId: CHAIN_IDS.ETHEREUM_GOERLI,
    blockExplorerUrls: ['https://goerli.etherscan.io'],
  },
  'ethereum-sepolia': {
    id: 'ethereum-sepolia',
    displayName: 'Ethereum Sepolia',
    chainId: CHAIN_IDS.ETHEREUM_SEPOLIA,
    blockExplorerUrls: ['https://sepolia.etherscan.io'],
  },
  'solana-devnet': {
    id: 'solana-devnet',
    displayName: 'Solana Devnet',
    rpcUrls: ['https://api.devnet.solana.com'],
    blockExplorerUrls: ['https://explorer.solana.com/?cluster=devnet'],
  },
};

// Common Solana program IDs for additional validation
export const SOLANA_PROGRAM_IDS = {
  SYSTEM: '11111111111111111111111111111111',
  TOKEN: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  ASSOCIATED_TOKEN: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
  METEORA: 'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo',
  ORCA: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',
  RAYDIUM: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
} as const;