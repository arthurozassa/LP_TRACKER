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

  // Create gradient style based on protocol color
  const gradientStyle = {
    background: `linear-gradient(135deg, ${color}20, rgba(245, 75, 0, 0.05))`,
    borderImage: `linear-gradient(135deg, ${color}60, #F54B0040) 1`,
  };

  const hoverGradientStyle = {
    background: `linear-gradient(135deg, ${color}35, rgba(245, 75, 0, 0.10))`,
    boxShadow: `0 8px 32px rgba(245, 75, 0, 0.2)`,
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg sm:rounded-xl border border-orange-500/30 
        crypto-card backdrop-blur-md transition-all duration-300 ease-in-out
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:shadow-orange-500/20 active:scale-[0.98] touch-manipulation animate-cryptoGlow' : ''}
        ${isExpanded ? 'ring-2 ring-orange-500/50' : ''}
        ${isLoading ? 'animate-pulse' : ''}
      `}
      style={gradientStyle}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.background = hoverGradientStyle.background;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = gradientStyle.background;
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
        </div>
      )}

      {/* Gradient accent border */}
      <div
        className="absolute inset-0 rounded-xl opacity-50"
        style={{
          background: `linear-gradient(135deg, ${color}30, transparent, ${color}15)`,
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'subtract',
          padding: '1px',
        }}
      />

      {/* Content */}
      <div className="relative z-20 p-3 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="mb-3 sm:mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <span className="text-xl sm:text-2xl flex-shrink-0" role="img" aria-label={protocol.name}>
              {emoji}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">
                {protocol.name}
              </h3>
              <p className="text-xs sm:text-sm text-white/70 capitalize truncate">
                {protocol.chain}
              </p>
            </div>
          </div>
          
          {/* Active indicator */}
          {totalPositions > 0 && (
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="hidden sm:inline text-xs font-medium text-green-300">Active</span>
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
          {/* Positions Count */}
          <div className="rounded-md sm:rounded-lg bg-white/5 p-2 sm:p-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide truncate">
              Positions
            </p>
            <p className="text-base sm:text-lg lg:text-xl font-bold text-white truncate">
              {isLoading ? '...' : totalPositions.toLocaleString()}
            </p>
          </div>

          {/* Total Value */}
          <div className="rounded-md sm:rounded-lg bg-white/5 p-2 sm:p-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide truncate">
              Total Value
            </p>
            <p className="text-base sm:text-lg lg:text-xl font-bold text-white truncate">
              {isLoading ? '...' : formatCurrency(totalValue)}
            </p>
          </div>

          {/* Fees Earned */}
          <div className="rounded-md sm:rounded-lg bg-white/5 p-2 sm:p-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide truncate">
              Fees Earned
            </p>
            <p className="text-base sm:text-lg lg:text-xl font-bold text-green-300 truncate">
              {isLoading ? '...' : formatCurrency(totalFeesEarned)}
            </p>
          </div>

          {/* Average APR */}
          <div className="rounded-md sm:rounded-lg bg-white/5 p-2 sm:p-3 backdrop-blur-sm">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wide truncate">
              Avg APR
            </p>
            <p className="text-base sm:text-lg lg:text-xl font-bold text-blue-300 truncate">
              {isLoading ? '...' : formatPercentage(avgApr)}
            </p>
          </div>
        </div>

        {/* Click indicator */}
        {onClick && !isLoading && (
          <div className="mt-3 sm:mt-4 flex items-center justify-center">
            <div className="flex items-center gap-1 sm:gap-2 text-xs text-white/50">
              <span className="hidden sm:inline">Click to filter</span>
              <span className="sm:hidden">Tap to filter</span>
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