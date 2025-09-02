import { ProtocolType } from '@/types';

/**
 * Utility functions for PositionCard component
 */

/**
 * Format number as currency with appropriate suffix
 */
export const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
};

/**
 * Format percentage with + or - sign
 */
export const formatPercentage = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

/**
 * Format date in readable format
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

/**
 * Get human-readable protocol display names
 */
export const getProtocolDisplayName = (protocol: string): string => {
  const protocolNames: Record<string, string> = {
    'uniswap-v2': 'Uniswap V2',
    'uniswap-v3': 'Uniswap V3',
    'sushiswap': 'SushiSwap',
    'curve': 'Curve Finance',
    'balancer': 'Balancer',
    'meteora-dlmm': 'Meteora DLMM',
    'raydium-clmm': 'Raydium CLMM',
    'orca-whirlpools': 'Orca Whirlpools',
    'lifinity': 'Lifinity',
    'jupiter': 'Jupiter',
    'uniswap-v3-arbitrum': 'Uniswap V3 (Arbitrum)',
    'uniswap-v3-polygon': 'Uniswap V3 (Polygon)',
    'uniswap-v3-base': 'Uniswap V3 (Base)'
  };
  return protocolNames[protocol] || protocol;
};

/**
 * Get protocol logo URL with fallback
 */
export const getProtocolLogoUrl = (protocol: string): string => {
  return `/icons/protocols/${protocol.replace('-', '_')}.svg`;
};

/**
 * Get chain logo URL
 */
export const getChainLogoUrl = (chain: string): string => {
  return `/icons/chains/${chain}.svg`;
};

/**
 * Get status-based styling classes
 */
export const getStatusStyling = (inRange: boolean) => {
  if (inRange) {
    return {
      textColor: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/30'
    };
  } else {
    return {
      textColor: 'text-red-400',
      bgColor: 'bg-red-400/10',
      borderColor: 'border-red-400/30'
    };
  }
};

/**
 * Calculate price position percentage for visualization
 */
export const calculatePricePosition = (
  current: number,
  lower: number,
  upper: number
): number => {
  if (current < lower) return 0;
  if (current > upper) return 100;
  return ((current - lower) / (upper - lower)) * 100;
};

/**
 * Truncate address for display
 */
export const truncateAddress = (address: string, startLength: number = 6, endLength: number = 4): string => {
  if (address.length <= startLength + endLength) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

/**
 * Get relative time from date string
 */
export const getRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return formatDate(dateString);
};

/**
 * Validate required position fields
 */
export const validatePosition = (position: any): boolean => {
  const requiredFields = [
    'id', 'protocol', 'chain', 'pool', 'poolAddress',
    'liquidity', 'value', 'feesEarned', 'apr', 'inRange',
    'tokens', 'createdAt', 'updatedAt'
  ];

  return requiredFields.every(field => position[field] !== undefined);
};

/**
 * Get metric styling based on value and type
 */
export const getMetricStyling = (
  value: number,
  type: 'currency' | 'percentage' | 'neutral' = 'neutral'
) => {
  if (type === 'currency') {
    return value > 0 ? 'text-green-400' : 'text-red-400';
  }
  
  if (type === 'percentage') {
    if (value > 0) return 'text-green-400';
    if (value < 0) return 'text-red-400';
    return 'text-yellow-400';
  }
  
  return 'text-white';
};

/**
 * Format large numbers with appropriate units
 */
export const formatLargeNumber = (value: number, decimals: number = 2): string => {
  if (value >= 1e12) {
    return `${(value / 1e12).toFixed(decimals)}T`;
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(decimals)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(decimals)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(decimals)}K`;
  }
  return value.toFixed(decimals);
};

/**
 * Generate protocol-specific management URL if not provided
 */
export const generateManageUrl = (protocol: string, poolAddress: string, chain: string): string => {
  try {
    // Import the new comprehensive URL generation system
    const { generateManageUrlWithFallback } = require('../../utils/protocols/manageUrls');
    
    const params = {
      protocol,
      poolAddress,
      chain: chain as any,
    };
    
    return generateManageUrlWithFallback(params);
  } catch (error) {
    console.warn('Error generating manage URL:', error);
    
    // Fallback to simple base URLs
    const baseUrls: Record<string, string> = {
      'uniswap-v2': 'https://app.uniswap.org/#/pools/v2',
      'uniswap-v3': 'https://app.uniswap.org/#/pools',
      'sushiswap': 'https://app.sushi.com/pools',
      'curve': 'https://curve.fi',
      'balancer': 'https://app.balancer.fi',
      'meteora-dlmm': 'https://app.meteora.ag/dlmm',
      'raydium-clmm': 'https://raydium.io/clmm',
      'orca-whirlpools': 'https://www.orca.so/pools',
      'lifinity': 'https://lifinity.io',
      'jupiter': 'https://jup.ag/liquidity'
    };

    return baseUrls[protocol] || '#';
  }
};

/**
 * Check if a position has a valid manage URL
 */
export const hasValidManageUrl = (position: any): boolean => {
  try {
    if (position.manageUrl && position.manageUrl !== '#') {
      return true;
    }
    
    const { generateManageUrlWithFallback, extractUrlParamsFromPosition } = require('../../utils/protocols/manageUrls');
    const urlParams = extractUrlParamsFromPosition(position);
    const testUrl = generateManageUrlWithFallback(urlParams);
    return testUrl !== '#';
  } catch (error) {
    const fallbackUrl = generateManageUrl(position.protocol, position.poolAddress || '', position.chain || 'ethereum');
    return fallbackUrl !== '#';
  }
};

/**
 * Get the manage button text for a protocol
 */
export const getManageButtonText = (protocol: string): string => {
  try {
    const { getProtocolManageButtonText } = require('../../utils/protocols/manageUrls');
    return getProtocolManageButtonText(protocol);
  } catch (error) {
    return getProtocolDisplayName(protocol).split(' ')[0]; // Get first word only for button
  }
};

/**
 * Generate comprehensive manage URL for a position
 */
export const getPositionManageUrl = (position: any): string => {
  try {
    if (position.manageUrl && position.manageUrl !== '#') {
      return position.manageUrl;
    }
    
    const { generateManageUrlWithFallback, extractUrlParamsFromPosition } = require('../../utils/protocols/manageUrls');
    const urlParams = extractUrlParamsFromPosition(position);
    return generateManageUrlWithFallback(urlParams);
  } catch (error) {
    console.warn('Error generating position manage URL:', error);
    return generateManageUrl(position.protocol, position.poolAddress || '', position.chain || 'ethereum');
  }
};