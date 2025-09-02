import type { ChainType } from '../../types';

/**
 * Utility functions for generating protocol-specific management URLs
 */

export interface ManageUrlParams {
  protocol: string;
  poolAddress?: string;
  positionId?: string;
  chain: ChainType;
  tokenA?: string;
  tokenB?: string;
  feeTier?: number;
}

export interface ProtocolManageConfig {
  baseUrl: string;
  supportedChains: ChainType[];
  urlTemplate: string;
  requiresPositionId?: boolean;
  requiresTokenAddresses?: boolean;
  requiresFeeTier?: boolean;
}

/**
 * Configuration for each protocol's management URLs
 */
export const PROTOCOL_MANAGE_CONFIGS: Record<string, ProtocolManageConfig> = {
  // Ethereum Protocols
  'uniswap-v2': {
    baseUrl: 'https://app.uniswap.org',
    supportedChains: ['ethereum'],
    urlTemplate: '#/pools/v2/{poolAddress}',
    requiresTokenAddresses: true,
  },
  'uniswap-v3': {
    baseUrl: 'https://app.uniswap.org',
    supportedChains: ['ethereum'],
    urlTemplate: '#/pool/{positionId}',
    requiresPositionId: true,
  },
  'sushiswap': {
    baseUrl: 'https://app.sushi.com',
    supportedChains: ['ethereum', 'arbitrum', 'polygon'],
    urlTemplate: '/pools/{poolAddress}',
  },
  'curve': {
    baseUrl: 'https://curve.fi',
    supportedChains: ['ethereum', 'arbitrum', 'polygon'],
    urlTemplate: '/{poolAddress}',
  },
  'balancer': {
    baseUrl: 'https://app.balancer.fi',
    supportedChains: ['ethereum', 'arbitrum', 'polygon'],
    urlTemplate: '/pool/{poolAddress}',
  },

  // L2 Protocols
  'uniswap-v3-arbitrum': {
    baseUrl: 'https://app.uniswap.org',
    supportedChains: ['arbitrum'],
    urlTemplate: '#/pool/{positionId}',
    requiresPositionId: true,
  },
  'uniswap-v3-polygon': {
    baseUrl: 'https://app.uniswap.org',
    supportedChains: ['polygon'],
    urlTemplate: '#/pool/{positionId}',
    requiresPositionId: true,
  },
  'uniswap-v3-base': {
    baseUrl: 'https://app.uniswap.org',
    supportedChains: ['base'],
    urlTemplate: '#/pool/{positionId}',
    requiresPositionId: true,
  },

  // Solana Protocols
  'meteora-dlmm': {
    baseUrl: 'https://app.meteora.ag',
    supportedChains: ['solana'],
    urlTemplate: '/dlmm/{poolAddress}',
  },
  'raydium-clmm': {
    baseUrl: 'https://raydium.io',
    supportedChains: ['solana'],
    urlTemplate: '/clmm/pools/{poolAddress}',
  },
  'orca-whirlpools': {
    baseUrl: 'https://www.orca.so',
    supportedChains: ['solana'],
    urlTemplate: '/pools/{poolAddress}',
  },
  'lifinity': {
    baseUrl: 'https://lifinity.io',
    supportedChains: ['solana'],
    urlTemplate: '/pools/{poolAddress}',
  },
  'jupiter': {
    baseUrl: 'https://jup.ag',
    supportedChains: ['solana'],
    urlTemplate: '/liquidity/{poolAddress}',
  },

  // Additional L2 DEXs
  'camelot-v3': {
    baseUrl: 'https://app.camelot.exchange',
    supportedChains: ['arbitrum'],
    urlTemplate: '/pools/{poolAddress}',
  },
  'quickswap-v3': {
    baseUrl: 'https://quickswap.exchange',
    supportedChains: ['polygon'],
    urlTemplate: '/pools/{poolAddress}',
  },
  'spookyswap': {
    baseUrl: 'https://spooky.fi',
    supportedChains: ['base'],
    urlTemplate: '/pools/{poolAddress}',
  },
};

/**
 * Chain-specific URL modifications
 */
export const CHAIN_URL_MODIFIERS: Record<ChainType, (url: string) => string> = {
  ethereum: (url) => url,
  arbitrum: (url) => url.includes('uniswap.org') ? `${url}?chain=arbitrum` : url,
  polygon: (url) => url.includes('uniswap.org') ? `${url}?chain=polygon` : url,
  base: (url) => url.includes('uniswap.org') ? `${url}?chain=base` : url,
  solana: (url) => url,
};

/**
 * Generate management URL for a specific position
 */
export function generateManageUrl(params: ManageUrlParams): string {
  const { protocol, poolAddress, positionId, chain, tokenA, tokenB, feeTier } = params;

  const config = PROTOCOL_MANAGE_CONFIGS[protocol];
  if (!config) {
    console.warn(`No management URL configuration found for protocol: ${protocol}`);
    return '#';
  }

  // Check if chain is supported
  if (!config.supportedChains.includes(chain)) {
    console.warn(`Chain ${chain} not supported for protocol: ${protocol}`);
    return '#';
  }

  let url = `${config.baseUrl}${config.urlTemplate}`;

  // Replace placeholders in URL template
  if (config.requiresPositionId && positionId) {
    url = url.replace('{positionId}', positionId);
  } else if (poolAddress) {
    url = url.replace('{poolAddress}', poolAddress);
  } else if (config.requiresTokenAddresses && tokenA && tokenB) {
    // For protocols that need token addresses instead of pool addresses
    url = url.replace('{poolAddress}', `${tokenA}/${tokenB}`);
    if (config.requiresFeeTier && feeTier) {
      url = `${url}/${feeTier}`;
    }
  } else {
    // Return base URL if specific parameters are not available
    return config.baseUrl;
  }

  // Apply chain-specific URL modifications
  const chainModifier = CHAIN_URL_MODIFIERS[chain];
  if (chainModifier) {
    url = chainModifier(url);
  }

  return url;
}

/**
 * Get protocol display name for buttons
 */
export function getProtocolManageButtonText(protocol: string): string {
  const protocolNames: Record<string, string> = {
    'uniswap-v2': 'Uniswap V2',
    'uniswap-v3': 'Uniswap V3',
    'uniswap-v3-arbitrum': 'Uniswap V3',
    'uniswap-v3-polygon': 'Uniswap V3',
    'uniswap-v3-base': 'Uniswap V3',
    'sushiswap': 'SushiSwap',
    'curve': 'Curve',
    'balancer': 'Balancer',
    'meteora-dlmm': 'Meteora',
    'raydium-clmm': 'Raydium',
    'orca-whirlpools': 'Orca',
    'lifinity': 'Lifinity',
    'jupiter': 'Jupiter',
    'camelot-v3': 'Camelot',
    'quickswap-v3': 'QuickSwap',
    'spookyswap': 'SpookySwap',
  };

  return protocolNames[protocol] || protocol.charAt(0).toUpperCase() + protocol.slice(1);
}

/**
 * Check if a protocol supports direct position management
 */
export function supportsDirectManagement(protocol: string): boolean {
  return PROTOCOL_MANAGE_CONFIGS.hasOwnProperty(protocol);
}

/**
 * Get fallback URL for protocols without specific position management
 */
export function getFallbackUrl(protocol: string): string {
  const fallbackUrls: Record<string, string> = {
    'uniswap-v2': 'https://app.uniswap.org/#/pools/v2',
    'uniswap-v3': 'https://app.uniswap.org/#/pools',
    'sushiswap': 'https://app.sushi.com/pools',
    'curve': 'https://curve.fi',
    'balancer': 'https://app.balancer.fi',
    'meteora-dlmm': 'https://app.meteora.ag/dlmm',
    'raydium-clmm': 'https://raydium.io/clmm',
    'orca-whirlpools': 'https://www.orca.so/pools',
    'lifinity': 'https://lifinity.io',
    'jupiter': 'https://jup.ag/liquidity',
  };

  return fallbackUrls[protocol] || '#';
}

/**
 * Generate management URL with fallback handling
 */
export function generateManageUrlWithFallback(params: ManageUrlParams): string {
  const directUrl = generateManageUrl(params);
  
  if (directUrl === '#') {
    return getFallbackUrl(params.protocol);
  }
  
  return directUrl;
}

/**
 * Extract protocol info for URL generation from position data
 */
export function extractUrlParamsFromPosition(position: any): ManageUrlParams {
  return {
    protocol: position.protocol,
    poolAddress: position.poolAddress,
    positionId: position.id,
    chain: position.chain || 'ethereum',
    tokenA: position.tokens?.token0?.address,
    tokenB: position.tokens?.token1?.address,
    feeTier: position.feeTier,
  };
}

/**
 * Validate if all required parameters are available for URL generation
 */
export function validateUrlParams(params: ManageUrlParams): { valid: boolean; missing: string[] } {
  const config = PROTOCOL_MANAGE_CONFIGS[params.protocol];
  if (!config) {
    return { valid: false, missing: ['protocol configuration'] };
  }

  const missing: string[] = [];

  if (config.requiresPositionId && !params.positionId) {
    missing.push('position ID');
  }

  if (config.requiresTokenAddresses && (!params.tokenA || !params.tokenB)) {
    missing.push('token addresses');
  }

  if (config.requiresFeeTier && !params.feeTier) {
    missing.push('fee tier');
  }

  if (!params.poolAddress && !config.requiresPositionId && !config.requiresTokenAddresses) {
    missing.push('pool address');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}