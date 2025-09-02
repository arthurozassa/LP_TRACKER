'use client';

import React from 'react';
import { ProtocolType, ProtocolLoadingState, LoadingState, ChainType } from '../../types';
import { ProtocolRegistry } from '../../utils/protocols/registry';

interface LoadingSkeletonProps {
  loadingState: LoadingState;
  protocolStates: ProtocolLoadingState[];
  chain?: ChainType;
  className?: string;
}

interface ProtocolLoadingCardProps {
  protocol: string;
  state: ProtocolLoadingState;
  delay?: number;
}

interface SkeletonCardProps {
  delay?: number;
  className?: string;
}

interface LoadingStateIndicatorProps {
  state: 'scanning' | 'fetching' | 'calculating';
  protocol?: string;
}

// Shimmer effect keyframes
const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: -1000px 0;
    }
    100% {
      background-position: 1000px 0;
    }
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  @keyframes bounce {
    0%, 20%, 53%, 80%, 100% {
      transform: translateY(0);
    }
    40%, 43% {
      transform: translateY(-8px);
    }
    70% {
      transform: translateY(-4px);
    }
    90% {
      transform: translateY(-2px);
    }
  }
`;

// Shimmer background class
const shimmerClass = `
  relative overflow-hidden
  bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700
  bg-[length:1000px_100%]
  animate-[shimmer_2s_infinite_linear]
`;

// Protocol Loading Card Component
const ProtocolLoadingCard: React.FC<ProtocolLoadingCardProps> = ({ 
  protocol, 
  state, 
  delay = 0 
}) => {
  const protocolConfig = ProtocolRegistry.getProtocolById(protocol);
  const emoji = protocolConfig?.emoji || '❓';
  const name = protocolConfig?.name || protocol;
  const color = protocolConfig?.color || '#6B7280';

  const getStatusIcon = () => {
    switch (state.status) {
      case 'pending':
        return '⏳';
      case 'loading':
        return <span className="animate-spin text-lg">{emoji}</span>;
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      default:
        return emoji;
    }
  };

  const getStatusText = () => {
    switch (state.status) {
      case 'pending':
        return 'Waiting...';
      case 'loading':
        return 'Scanning...';
      case 'success':
        return state.positionsFound ? `${state.positionsFound} positions found` : 'Complete';
      case 'error':
        return state.error || 'Error occurred';
      default:
        return 'Ready';
    }
  };

  const getProgressWidth = () => {
    switch (state.status) {
      case 'pending':
        return '0%';
      case 'loading':
        return '60%';
      case 'success':
        return '100%';
      case 'error':
        return '100%';
      default:
        return '0%';
    }
  };

  return (
    <div 
      className={`
        relative rounded-lg sm:rounded-xl p-3 sm:p-4 mb-2 sm:mb-3 
        backdrop-blur-sm bg-white/10 dark:bg-gray-800/20 
        border border-white/20 dark:border-gray-700/30
        shadow-lg hover:shadow-xl transition-all duration-300
        ${state.status === 'loading' ? 'ring-2 ring-blue-400/50' : ''}
      `}
      style={{ 
        animationDelay: `${delay}ms`,
        borderColor: state.status === 'success' ? `${color}40` : undefined
      }}
    >
      {/* Protocol Header */}
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <div className="text-lg sm:text-xl lg:text-2xl flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
            {getStatusIcon()}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">
              {name}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">
              {protocolConfig?.chain || 'Unknown chain'}
            </p>
          </div>
        </div>
        <div className="text-xs sm:text-sm text-right flex-shrink-0">
          <span 
            className={`
              font-medium
              ${state.status === 'success' ? 'text-green-600 dark:text-green-400' : ''}
              ${state.status === 'error' ? 'text-red-600 dark:text-red-400' : ''}
              ${state.status === 'loading' ? 'text-blue-600 dark:text-blue-400' : ''}
              ${state.status === 'pending' ? 'text-gray-600 dark:text-gray-400' : ''}
            `}
          >
            {getStatusText()}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 sm:h-2 overflow-hidden">
        <div 
          className={`
            h-full transition-all duration-1000 ease-out rounded-full
            ${state.status === 'loading' ? 'bg-gradient-to-r from-blue-400 to-blue-600 animate-pulse' : ''}
            ${state.status === 'success' ? 'bg-gradient-to-r from-green-400 to-green-600' : ''}
            ${state.status === 'error' ? 'bg-gradient-to-r from-red-400 to-red-600' : ''}
            ${state.status === 'pending' ? 'bg-gray-300 dark:bg-gray-600' : ''}
          `}
          style={{ 
            width: getProgressWidth(),
            background: state.status === 'success' ? `linear-gradient(90deg, ${color}, ${color}CC)` : undefined
          }}
        />
      </div>

      {/* Loading shimmer overlay for active loading */}
      {state.status === 'loading' && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] animate-[shimmer_2s_infinite]" />
        </div>
      )}
    </div>
  );
};

// Skeleton Position Card
const SkeletonCard: React.FC<SkeletonCardProps> = ({ delay = 0, className = '' }) => {
  return (
    <div 
      className={`
        rounded-lg sm:rounded-xl p-4 sm:p-5 lg:p-6 
        backdrop-blur-sm bg-white/10 dark:bg-gray-800/20 
        border border-white/20 dark:border-gray-700/30
        shadow-lg animate-pulse
        ${className}
      `}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <div className={`w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex-shrink-0 ${shimmerClass}`} />
          <div className="min-w-0 flex-1">
            <div className={`h-3 w-16 sm:h-4 sm:w-24 rounded mb-1 sm:mb-2 ${shimmerClass}`} />
            <div className={`h-2 w-12 sm:h-3 sm:w-16 rounded ${shimmerClass}`} />
          </div>
        </div>
        <div className={`h-5 w-12 sm:h-6 sm:w-16 rounded-full flex-shrink-0 ${shimmerClass}`} />
      </div>

      {/* Content */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex justify-between">
          <div className={`h-2 w-16 sm:h-3 sm:w-20 rounded ${shimmerClass}`} />
          <div className={`h-2 w-12 sm:h-3 sm:w-16 rounded ${shimmerClass}`} />
        </div>
        <div className="flex justify-between">
          <div className={`h-2 w-12 sm:h-3 sm:w-16 rounded ${shimmerClass}`} />
          <div className={`h-2 w-8 sm:h-3 sm:w-12 rounded ${shimmerClass}`} />
        </div>
        <div className="flex justify-between">
          <div className={`h-2 w-18 sm:h-3 sm:w-24 rounded ${shimmerClass}`} />
          <div className={`h-2 w-16 sm:h-3 sm:w-20 rounded ${shimmerClass}`} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10 dark:border-gray-700/30">
        <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center space-y-2 xs:space-y-0">
          <div className={`h-6 w-20 sm:h-8 sm:w-24 rounded ${shimmerClass}`} />
          <div className={`h-2 w-24 sm:h-3 sm:w-32 rounded ${shimmerClass}`} />
        </div>
      </div>
    </div>
  );
};

// Loading State Indicator
const LoadingStateIndicator: React.FC<LoadingStateIndicatorProps> = ({ 
  state, 
  protocol 
}) => {
  const getStateText = () => {
    switch (state) {
      case 'scanning':
        return protocol ? `Scanning ${ProtocolRegistry.getDisplayName(protocol)}...` : 'Initializing scan...';
      case 'fetching':
        return protocol ? `Fetching ${ProtocolRegistry.getDisplayName(protocol)} positions...` : 'Fetching positions...';
      case 'calculating':
        return 'Calculating metrics and performance...';
      default:
        return 'Loading...';
    }
  };

  const getStateIcon = () => {
    switch (state) {
      case 'scanning':
        return '🔍';
      case 'fetching':
        return '📊';
      case 'calculating':
        return '🧮';
      default:
        return '⏳';
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2 py-3 sm:py-4">
      <span className="text-xl sm:text-2xl animate-bounce" style={{ animationDelay: '0ms' }}>
        {getStateIcon()}
      </span>
      <span className="text-base sm:text-lg font-medium text-gray-700 dark:text-gray-300 animate-pulse text-center sm:text-left">
        {getStateText()}
      </span>
    </div>
  );
};

// Main Loading Skeleton Component
const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  loadingState,
  protocolStates,
  chain,
  className = ''
}) => {
  const getCurrentState = (): 'scanning' | 'fetching' | 'calculating' => {
    if (loadingState.progress < 30) return 'scanning';
    if (loadingState.progress < 80) return 'fetching';
    return 'calculating';
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: shimmerStyles }} />
      <div className={`w-full max-w-6xl mx-auto p-3 sm:p-4 lg:p-6 ${className}`}>
        {/* Main Loading Indicator */}
        <div className="text-center mb-6 sm:mb-8">
          <LoadingStateIndicator 
            state={getCurrentState()} 
            protocol={loadingState.currentProtocol} 
          />
          
          {/* Overall Progress */}
          <div className="mt-3 sm:mt-4 max-w-sm sm:max-w-md mx-auto">
            <div className="flex justify-between text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>Progress</span>
              <span>{Math.round(loadingState.progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 sm:h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-400 to-purple-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${loadingState.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Protocol Loading Cards Grid */}
        <div className="grid gap-2 sm:gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 mb-6 sm:mb-8">
          {protocolStates.map((protocolState, index) => (
            <ProtocolLoadingCard
              key={protocolState.protocol}
              protocol={protocolState.protocol}
              state={protocolState}
              delay={index * 100}
            />
          ))}
        </div>

        {/* Skeleton Position Cards */}
        <div className="space-y-4 sm:space-y-6">
          <div className="border-t border-white/10 dark:border-gray-700/30 pt-4 sm:pt-6">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <div className={`h-5 w-24 sm:h-6 sm:w-32 rounded ${shimmerClass}`} />
              <span className="animate-bounce text-base sm:text-lg">💰</span>
            </div>
            
            <div className="grid gap-2 sm:gap-3 lg:gap-4 grid-cols-1 xl:grid-cols-2">
              {Array.from({ length: 6 }, (_, index) => (
                <SkeletonCard key={index} delay={index * 150} />
              ))}
            </div>
          </div>

          {/* Metrics Cards Section */}
          <div className="border-t border-white/10 dark:border-gray-700/30 pt-4 sm:pt-6">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <div className={`h-5 w-20 sm:h-6 sm:w-24 rounded ${shimmerClass}`} />
              <span className="animate-pulse text-base sm:text-lg">📈</span>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
              {Array.from({ length: 4 }, (_, index) => (
                <div
                  key={index}
                  className={`
                    rounded-md sm:rounded-lg p-3 sm:p-4 
                    backdrop-blur-sm bg-white/10 dark:bg-gray-800/20 
                    border border-white/20 dark:border-gray-700/30
                    shadow-lg animate-pulse
                  `}
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className={`h-3 w-12 sm:h-4 sm:w-16 rounded mb-1 sm:mb-2 ${shimmerClass}`} />
                  <div className={`h-6 w-16 sm:h-8 sm:w-20 rounded mb-1 ${shimmerClass}`} />
                  <div className={`h-2 w-8 sm:h-3 sm:w-12 rounded ${shimmerClass}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Chart Section */}
          <div className="border-t border-white/10 dark:border-gray-700/30 pt-4 sm:pt-6">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <div className={`h-5 w-24 sm:h-6 sm:w-28 rounded ${shimmerClass}`} />
              <span className="animate-spin text-base sm:text-lg">📊</span>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Pie Chart Skeleton */}
              <div className={`
                rounded-lg sm:rounded-xl p-4 sm:p-6 h-64 sm:h-80
                backdrop-blur-sm bg-white/10 dark:bg-gray-800/20 
                border border-white/20 dark:border-gray-700/30
                shadow-lg animate-pulse
              `}>
                <div className={`h-3 w-24 sm:h-4 sm:w-32 rounded mb-3 sm:mb-4 ${shimmerClass}`} />
                <div className="flex items-center justify-center h-48 sm:h-60">
                  <div className={`w-32 h-32 sm:w-48 sm:h-48 rounded-full ${shimmerClass}`} />
                </div>
              </div>

              {/* Bar Chart Skeleton */}
              <div className={`
                rounded-lg sm:rounded-xl p-4 sm:p-6 h-64 sm:h-80
                backdrop-blur-sm bg-white/10 dark:bg-gray-800/20 
                border border-white/20 dark:border-gray-700/30
                shadow-lg animate-pulse
              `}>
                <div className={`h-3 w-20 sm:h-4 sm:w-28 rounded mb-3 sm:mb-4 ${shimmerClass}`} />
                <div className="space-y-2 sm:space-y-3">
                  {Array.from({ length: 5 }, (_, index) => (
                    <div key={index} className="flex items-end space-x-1 sm:space-x-2">
                      <div className={`h-2 w-12 sm:h-3 sm:w-20 rounded ${shimmerClass}`} />
                      <div 
                        className={`rounded ${shimmerClass}`} 
                        style={{ 
                          height: `${30 + (index * 15)}px`, 
                          width: `${60 + (index * 10)}%` 
                        }} 
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with scan info */}
        <div className="text-center mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/10 dark:border-gray-700/30">
          <div className="flex flex-col xs:flex-row xs:items-center xs:justify-center xs:space-x-4 space-y-2 xs:space-y-0 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center justify-center space-x-1">
              <span className="animate-pulse">🔍</span>
              <span>Scanning {chain || 'all chains'}</span>
            </div>
            <div className="flex items-center justify-center space-x-1">
              <span className="animate-bounce">⏱️</span>
              <span>This may take a few moments</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoadingSkeleton;
export type { LoadingSkeletonProps, ProtocolLoadingCardProps, SkeletonCardProps, LoadingStateIndicatorProps };