import type { ProtocolConfig } from './types';
import type { ChainType } from '../../types';
export type Chain = ChainType;
import { protocolRegistry } from './registry';
import { DEMO_WALLETS, CHAIN_IDS, FEE_TIERS, POSITION_STATUS } from './constants';

/**
 * Validates wallet address format based on blockchain
 */
export function validateWalletAddress(address: string): {
  isValid: boolean;
  chain: Chain | null;
  error?: string;
} {
  const ethereumRegex = /^0x[a-fA-F0-9]{40}$/;
  const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  if (ethereumRegex.test(address)) {
    return { isValid: true, chain: 'ethereum' };
  }

  if (solanaRegex.test(address)) {
    return { isValid: true, chain: 'solana' };
  }

  return {
    isValid: false,
    chain: null,
    error: 'Invalid address format. Must be a valid Ethereum (0x...) or Solana address.',
  };
}

/**
 * Formats protocol fee tier for display
 */
export function formatFeeTier(feeTier: number): string {
  if (feeTier < 1000) {
    return `${feeTier / 100}%`;
  }
  return `${feeTier / 10000}%`;
}

/**
 * Formats currency values with appropriate decimals
 */
export function formatCurrency(value: number, decimals: number = 2): string {
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  if (value > 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value > 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(decimals)}`;
}

/**
 * Formats APR percentage
 */
export function formatAPR(apr: number): string {
  if (apr === 0) return '0%';
  if (apr < 0.01) return '<0.01%';
  return `${apr.toFixed(2)}%`;
}

/**
 * Formats token amounts
 */
export function formatTokenAmount(amount: number, symbol: string, decimals: number = 6): string {
  if (amount === 0) return `0 ${symbol}`;
  if (amount < Math.pow(10, -decimals)) return `<${Math.pow(10, -decimals)} ${symbol}`;
  
  // For large amounts, use K/M notation
  if (amount > 1000000) return `${(amount / 1000000).toFixed(2)}M ${symbol}`;
  if (amount > 1000) return `${(amount / 1000).toFixed(2)}K ${symbol}`;
  
  return `${amount.toFixed(decimals)} ${symbol}`;
}

/**
 * Gets position status badge info
 */
export function getPositionStatusBadge(inRange: boolean): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (inRange) {
    return {
      label: 'In Range',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
    };
  }
  return {
    label: 'Out of Range',
    color: 'text-red-700',
    bgColor: 'bg-red-100',
  };
}

/**
 * Calculates position health score (0-100)
 */
export function calculatePositionHealth(position: {
  inRange: boolean;
  apr: number;
  feesEarned: number;
  value: number;
}): number {
  let score = 0;

  // In range positions get base score
  if (position.inRange) {
    score += 40;
  }

  // APR contribution (max 30 points)
  const aprScore = Math.min(position.apr * 2, 30);
  score += aprScore;

  // Fees earned ratio (max 20 points)
  if (position.value > 0) {
    const feesRatio = (position.feesEarned / position.value) * 100;
    const feesScore = Math.min(feesRatio * 4, 20);
    score += feesScore;
  }

  // Value contribution (max 10 points)
  if (position.value > 1000) score += 5;
  if (position.value > 10000) score += 5;

  return Math.min(Math.round(score), 100);
}

/**
 * Gets health score color and label
 */
export function getHealthScoreDisplay(score: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (score >= 80) {
    return { label: 'Excellent', color: 'text-green-700', bgColor: 'bg-green-100' };
  }
  if (score >= 60) {
    return { label: 'Good', color: 'text-blue-700', bgColor: 'bg-blue-100' };
  }
  if (score >= 40) {
    return { label: 'Fair', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  }
  return { label: 'Poor', color: 'text-red-700', bgColor: 'bg-red-100' };
}

/**
 * Determines the best protocol for a given pair and chain
 */
export function suggestOptimalProtocol(
  chain: Chain,
  tokenA: string,
  tokenB: string,
  isStablePair: boolean = false
): ProtocolConfig | null {
  const chainProtocols = Object.values(protocolRegistry).filter(p => p.chain === chain && p.isActive);

  if (chainProtocols.length === 0) return null;

  // For stable pairs, prefer protocols with stable swap features
  if (isStablePair) {
    const stableProtocols = chainProtocols.filter(p => p.supportedFeatures.stable);
    if (stableProtocols.length > 0) {
      // Prefer Curve for stables on Ethereum
      if (chain === 'ethereum') {
        const curve = stableProtocols.find(p => p.id === 'curve');
        if (curve) return curve;
      }
      return stableProtocols[0];
    }
  }

  // For other pairs, prefer V3 concentrated liquidity
  const v3Protocols = chainProtocols.filter(p => p.supportedFeatures.concentrated);
  if (v3Protocols.length > 0) {
    // Prefer Uniswap V3 if available
    const uniV3 = v3Protocols.find(p => p.id.includes('uniswap-v3'));
    if (uniV3) return uniV3;
    return v3Protocols[0];
  }

  // Fallback to any active protocol
  return chainProtocols[0];
}

/**
 * Gets demo wallet info for a chain
 */
export function getDemoWallet(chain: Chain): typeof DEMO_WALLETS[keyof typeof DEMO_WALLETS] | null {
  if (chain === 'ethereum' || chain === 'arbitrum' || chain === 'polygon' || chain === 'base') {
    return DEMO_WALLETS.ethereum;
  }
  if (chain === 'solana') {
    return DEMO_WALLETS.solana;
  }
  return null;
}

/**
 * Generates a shortened address for display
 */
export function shortenAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Creates a block explorer URL for a transaction or address
 */
export function getExplorerUrl(chain: Chain, hash: string, type: 'tx' | 'address' = 'address'): string {
  const explorers: Record<ChainType, string> = {
    ethereum: 'https://etherscan.io',
    arbitrum: 'https://arbiscan.io',
    polygon: 'https://polygonscan.com',
    base: 'https://basescan.org',
    solana: 'https://explorer.solana.com',
  };

  const baseUrl = explorers[chain];
  if (chain === 'solana') {
    return `${baseUrl}/${type === 'tx' ? 'tx' : 'account'}/${hash}`;
  }
  return `${baseUrl}/${type}/${hash}`;
}

/**
 * Calculates time since a timestamp
 */
export function timeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = minute * 60;
  const day = hour * 24;
  const week = day * 7;
  const month = day * 30;

  if (diff < minute) return 'just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < week) return `${Math.floor(diff / day)}d ago`;
  if (diff < month) return `${Math.floor(diff / week)}w ago`;
  return `${Math.floor(diff / month)}mo ago`;
}

/**
 * Generates a random color for unknown protocols
 */
export function generateProtocolColor(protocolId: string): string {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
  ];
  
  let hash = 0;
  for (let i = 0; i < protocolId.length; i++) {
    hash = protocolId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Sorts positions by multiple criteria
 */
export function sortPositions<T extends { value: number; apr: number; inRange: boolean }>(
  positions: T[],
  sortBy: 'value' | 'apr' | 'status' = 'value'
): T[] {
  return [...positions].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return b.value - a.value;
      case 'apr':
        return b.apr - a.apr;
      case 'status':
        // In range positions first, then by value
        if (a.inRange !== b.inRange) {
          return a.inRange ? -1 : 1;
        }
        return b.value - a.value;
      default:
        return 0;
    }
  });
}