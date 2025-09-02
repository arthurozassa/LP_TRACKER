'use client';

import React, { useState } from 'react';
import { 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown,
  Target,
  Calendar,
  DollarSign,
  Percent,
  BarChart3,
  Link as LinkIcon,
  Info
} from 'lucide-react';
import { Position } from '@/types';
import {
  formatCurrency,
  formatPercentage,
  formatDate,
  getProtocolDisplayName,
  getProtocolLogoUrl,
  getChainLogoUrl,
  getStatusStyling,
  truncateAddress,
  generateManageUrl,
  hasValidManageUrl,
  getManageButtonText,
  getPositionManageUrl
} from './PositionCard.utils';

export interface PositionCardProps {
  position: Position;
  onClick?: (position: Position) => void;
  showManageButton?: boolean;
  compact?: boolean;
}

export const PositionCard: React.FC<PositionCardProps> = ({
  position,
  onClick,
  showManageButton = true,
  compact = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCardClick = () => {
    if (onClick) {
      onClick(position);
    }
    if (!compact) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleManageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const manageUrl = getPositionManageUrl(position);
    
    if (manageUrl && manageUrl !== '#') {
      window.open(manageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const statusStyling = getStatusStyling(position.inRange);

  return (
    <div 
      className={`
        relative overflow-hidden rounded-lg sm:rounded-xl border border-white/10 
        bg-white/5 backdrop-blur-md cursor-pointer group touch-manipulation animate-fadeIn
        hover:bg-white/8 hover:border-white/20 hover:scale-102 hover:-translate-y-1 hover:shadow-xl
        transition-all duration-300
        ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-5 lg:p-6'}
      `}
      onClick={handleCardClick}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Header */}
      <div className="relative flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1 mr-2">
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white/10 p-0.5 sm:p-1 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">
              {getProtocolDisplayName(position.protocol).charAt(0)}
            </div>
            <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white/80">
              {(position.chain || 'ethereum').charAt(0).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-white text-sm sm:text-base lg:text-lg leading-tight truncate">
              {position.pool}
            </h3>
            <p className="text-xs sm:text-sm text-white/60 truncate">
              {getProtocolDisplayName(position.protocol)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`
          flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1 rounded-full border flex-shrink-0
          ${statusStyling.bgColor} ${statusStyling.borderColor} ${statusStyling.textColor}
        `}>
          <Target className="w-2 h-2 sm:w-3 sm:h-3" />
          <span className="text-xs font-medium whitespace-nowrap">
            <span className="hidden sm:inline">{position.inRange ? 'In Range' : 'Out of Range'}</span>
            <span className="sm:hidden">{position.inRange ? 'In' : 'Out'}</span>
          </span>
        </div>
      </div>

      {/* Token Pair */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
          <div className="text-xs sm:text-sm min-w-0 flex-1">
            <div className="flex items-center space-x-1 sm:space-x-2 text-white/80">
              <span className="font-medium truncate">{position.tokens.token0.symbol}</span>
              <span className="text-white/60 flex-shrink-0">•</span>
              <span className="font-medium truncate">{position.tokens.token1.symbol}</span>
            </div>
            <div className="text-xs text-white/60 mt-0.5 sm:mt-1 truncate">
              {position.tokens.token0.amount.toFixed(2)} • {position.tokens.token1.amount.toFixed(2)}
            </div>
          </div>
        </div>
        
        {!compact && (
          <button className="text-white/60 hover:text-white/80 transition-colors flex-shrink-0 p-1">
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        )}
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4">
        <div className="bg-white/5 rounded-md sm:rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
            <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-white/60 flex-shrink-0" />
            <span className="text-xs text-white/60 uppercase tracking-wide truncate">Position Value</span>
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-semibold text-white truncate">
            {formatCurrency(position.value)}
          </div>
        </div>

        <div className="bg-white/5 rounded-md sm:rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
            <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 flex-shrink-0" />
            <span className="text-xs text-white/60 uppercase tracking-wide truncate">Fees Earned</span>
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-semibold text-green-400 truncate">
            {formatCurrency(position.feesEarned)}
          </div>
        </div>

        <div className="bg-white/5 rounded-md sm:rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
            <Percent className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400 flex-shrink-0" />
            <span className="text-xs text-white/60 uppercase tracking-wide truncate">APR</span>
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-semibold text-blue-400 truncate">
            {formatPercentage(position.apr)}
          </div>
        </div>

        <div className="bg-white/5 rounded-md sm:rounded-lg p-2 sm:p-3 border border-white/10">
          <div className="flex items-center space-x-1 sm:space-x-2 mb-1">
            <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4 text-purple-400 flex-shrink-0" />
            <span className="text-xs text-white/60 uppercase tracking-wide truncate">Liquidity</span>
          </div>
          <div className="text-sm sm:text-base lg:text-lg font-semibold text-purple-400 truncate">
            {formatCurrency(position.liquidity)}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && !compact && (
        <div className="mt-4 pt-4 border-t border-white/10 space-y-4 animate-slideUp">
          {/* Additional Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Position ID:</span>
                <span className="text-sm font-mono text-white/80">
                  {truncateAddress(position.id, 8, 4)}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-white/60">Created:</span>
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-white/60" />
                  <span className="text-sm text-white/80">
                    {position.createdAt ? formatDate(position.createdAt) : 'N/A'}
                  </span>
                </div>
              </div>

              {position.yield24h !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">24h Yield:</span>
                  <span className={`text-sm font-medium ${
                    position.yield24h >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(position.yield24h)}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {position.impermanentLoss !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">IL:</span>
                  <span className={`text-sm font-medium ${
                    position.impermanentLoss <= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatPercentage(position.impermanentLoss)}
                  </span>
                </div>
              )}

              {position.apy && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/60">APY:</span>
                  <span className="text-sm font-medium text-yellow-400">
                    {formatPercentage(position.apy)}
                  </span>
                </div>
              )}

              {position.priceRange && (
                <div className="space-y-2">
                  <span className="text-sm text-white/60">Price Range:</span>
                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-white/60">Lower:</span>
                      <span className="text-white/80">{position.priceRange.lower.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Current:</span>
                      <span className="text-white/80">{position.priceRange.current.toFixed(6)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Upper:</span>
                      <span className="text-white/80">{position.priceRange.upper.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Price Range Visualization */}
          {position.priceRange && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center space-x-2 mb-3">
                <Info className="w-4 h-4 text-white/60" />
                <span className="text-sm font-medium text-white/80">Price Range</span>
              </div>
              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`absolute h-full rounded-full transition-all duration-300 ${
                    position.inRange ? 'bg-green-400' : 'bg-red-400'
                  }`}
                  style={{
                    left: '20%',
                    width: '60%',
                  }}
                />
                <div 
                  className="absolute w-3 h-3 bg-white rounded-full border-2 border-gray-800 transform -translate-y-0.5"
                  style={{
                    left: position.inRange ? '50%' : '10%',
                    transform: 'translateX(-50%) translateY(-25%)'
                  }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/60">
                <span>{position.priceRange.lower.toFixed(4)}</span>
                <span className="text-white/80 font-medium">{position.priceRange.current.toFixed(4)}</span>
                <span>{position.priceRange.upper.toFixed(4)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {showManageButton && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-1 sm:space-x-2 text-xs text-white/60">
            <span className="truncate">Updated {position.updatedAt ? formatDate(position.updatedAt) : 'N/A'}</span>
          </div>
          
          {hasValidManageUrl(position) && (
            <button
              onClick={handleManageClick}
              className="
                flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 
                bg-gradient-to-r from-blue-500/20 to-purple-500/20 
                hover:from-blue-500/30 hover:to-purple-500/30 
                active:from-blue-500/40 active:to-purple-500/40
                border border-blue-500/30 hover:border-blue-400/50
                rounded-lg transition-all duration-200
                text-blue-400 hover:text-blue-300
                text-xs sm:text-sm font-medium
                group/btn backdrop-blur-sm
                hover:shadow-lg hover:shadow-blue-500/20
                hover:scale-[1.02] active:scale-[0.98]
                w-full sm:w-auto touch-manipulation
              "
              title={`Manage on ${getManageButtonText(position.protocol)}`}
            >
              <LinkIcon className="w-3 h-3 sm:w-4 sm:h-4 group-hover/btn:scale-110 transition-transform flex-shrink-0" />
              <span className="hidden sm:inline">Manage on</span>
              <span className="font-semibold truncate">
                {getManageButtonText(position.protocol)}
              </span>
              <ExternalLink className="w-2 h-2 sm:w-3 sm:h-3 opacity-60 group-hover/btn:opacity-80 transition-opacity flex-shrink-0" />
            </button>
          )}
        </div>
      )}

      {/* Hover Effect Gradient */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/[0.02] to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </div>
  );
};

export default PositionCard;