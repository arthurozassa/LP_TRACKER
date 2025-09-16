'use client';

import React from 'react';
import { ProtocolCardProps, ProtocolType } from '../../types';
import { ProtocolRegistry } from '../../utils/protocols/registry';

// Protocol emoji mappings
const PROTOCOL_EMOJIS: Record<string, string> = {
  // Ethereum
  'uniswap-v2': '🦄',
  'uniswap-v3': '🦄',
  'sushiswap': '🍣',
  'curve': '🌊',
  'balancer': '⚖️',
  
  // Solana
  'meteora-dlmm': '☄️',
  'raydium-clmm': '⚡',
  'orca-whirlpools': '🐋',
  'lifinity': '♾️',
  'jupiter': '🪐',
  
  // Layer 2
  'uniswap-v3-arbitrum': '🦄',
  'uniswap-v3-polygon': '🦄',
  'uniswap-v3-base': '🦄',
};

// Protocol color mappings for gradients
const PROTOCOL_COLORS: Record<string, string> = {
  // Ethereum
  'uniswap-v2': '#FF007A',
  'uniswap-v3': '#FF007A',
  'sushiswap': '#0E4FD6',
  'curve': '#40E0D0',
  'balancer': '#1E1E1E',
  
  // Solana
  'meteora-dlmm': '#7C2AE8',
  'raydium-clmm': '#8C6EEF',
  'orca-whirlpools': '#FF6B35',
  'lifinity': '#00D4AA',
  'jupiter': '#FBA43A',
  
  // Layer 2
  'uniswap-v3-arbitrum': '#FF007A',
  'uniswap-v3-polygon': '#FF007A',
  'uniswap-v3-base': '#FF007A',
};

/**
 * ProtocolCard Component
 * 
 * A glassmorphism-styled card that displays protocol information including:
 * - Protocol name with emoji icon
 * - Active positions count
 * - Total value
 * - Total fees earned
 * 
 * Features:
 * - Clickable to filter positions by protocol
 * - Gradient hover effects
 * - Glassmorphism design with backdrop blur
 * - Responsive design
 * - TypeScript support
 */
export const ProtocolCard: React.FC<ProtocolCardProps> = ({
  protocolData,
  onClick,
  isExpanded = false,
}) => {
  const { protocol, positions, totalValue, totalPositions, totalFeesEarned, avgApr, isLoading } = protocolData;

  // Check if positions contain demo/generated data
  const isDemoData = positions.some(position =>
    position.id?.includes('demo-') ||
    position.id?.includes('generated-') ||
    position.createdAt && new Date(position.createdAt) > new Date(Date.now() - 24 * 60 * 60 * 1000) // Very recent positions might be demo
  );
  
  // Get protocol emoji and color
  const emoji = PROTOCOL_EMOJIS[protocol.id] || '🔗';
  const color = PROTOCOL_COLORS[protocol.id] || '#6366f1';
  
  // Format currency values
  const formatCurrency = (value: number): string => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  // Format percentage
  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  // Handle card click
  const handleClick = () => {
    if (onClick && !isLoading) {
      onClick(protocol.id);
    }
  };

  return (
    <div
      className={`
        tt-card tt-card-hover transition-all duration-200
        ${onClick ? 'cursor-pointer' : ''}
        ${isExpanded ? 'ring-2 ring-blue-500/50' : ''}
        ${isLoading ? 'tt-skeleton' : ''}
      `}
      onClick={handleClick}
    >
      {/* Content */}
      <div className="p-4">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-2xl flex-shrink-0" role="img" aria-label={protocol.name}>
              {emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="tt-heading-3 truncate">
                {protocol.name}
              </h3>
              <p className="tt-text-tertiary text-sm capitalize truncate">
                {protocol.chain}
              </p>
            </div>
          </div>
          
          {/* Status indicators */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Demo data indicator */}
            {isDemoData && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 border border-amber-500/30">
                <div className="h-1.5 w-1.5 rounded-full bg-amber-400"></div>
                <span className="text-xs font-medium text-amber-300">Demo</span>
              </div>
            )}

            {/* Active indicator */}
            {totalPositions > 0 && !isDemoData && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                <div className="h-1.5 w-1.5 rounded-full bg-green-500"></div>
                <span className="text-xs font-medium tt-status-positive">Real</span>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Positions Count */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3">
            <p className="text-xs font-medium tt-text-tertiary uppercase tracking-wide truncate">
              Positions
            </p>
            <p className="text-lg font-bold tt-text-primary truncate">
              {isLoading ? '...' : totalPositions.toLocaleString()}
            </p>
          </div>

          {/* Total Value */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3">
            <p className="text-xs font-medium tt-text-tertiary uppercase tracking-wide truncate">
              Total Value
            </p>
            <p className="text-lg font-bold tt-text-primary truncate">
              {isLoading ? '...' : formatCurrency(totalValue)}
            </p>
          </div>

          {/* Fees Earned */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3">
            <p className="text-xs font-medium tt-text-tertiary uppercase tracking-wide truncate">
              Fees Earned
            </p>
            <p className="text-lg font-bold tt-status-positive truncate">
              {isLoading ? '...' : formatCurrency(totalFeesEarned)}
            </p>
          </div>

          {/* Average APR */}
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-3">
            <p className="text-xs font-medium tt-text-tertiary uppercase tracking-wide truncate">
              Avg APR
            </p>
            <p className="text-lg font-bold tt-text-primary truncate">
              {isLoading ? '...' : formatPercentage(avgApr)}
            </p>
          </div>
        </div>

        {/* Click indicator */}
        {onClick && !isLoading && (
          <div className="mt-4 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs tt-text-tertiary">
              <span>Click to filter</span>
              <svg
                className="h-3 w-3 transition-transform group-hover:translate-x-1"
                fill="none"
                strokeWidth={2}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </div>
          </div>
        )}

        {/* Expanded state indicator */}
        {isExpanded && (
          <div className="absolute -top-1 -right-1">
            <div className="h-2 w-2 sm:h-3 sm:w-3 rounded-full bg-white/80 animate-pulse" />
          </div>
        )}
      </div>

      {/* Hover effect overlay */}
      {onClick && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
      )}
    </div>
  );
};

export default ProtocolCard;