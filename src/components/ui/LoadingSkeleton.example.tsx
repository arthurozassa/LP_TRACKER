'use client';

import React, { useState, useEffect } from 'react';
import LoadingSkeleton from './LoadingSkeleton';
import { LoadingState, ProtocolLoadingState, ProtocolType } from '../../types';

// Example usage of LoadingSkeleton component
const LoadingSkeletonExample: React.FC = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isScanning: true,
    currentProtocol: 'uniswap-v3' as ProtocolType,
    completedProtocols: [],
    failedProtocols: [],
    progress: 0,
  });

  const [protocolStates, setProtocolStates] = useState<ProtocolLoadingState[]>([
    { protocol: 'uniswap-v3' as ProtocolType, status: 'loading' },
    { protocol: 'uniswap-v2' as ProtocolType, status: 'pending' },
    { protocol: 'sushiswap' as ProtocolType, status: 'pending' },
    { protocol: 'curve' as ProtocolType, status: 'pending' },
    { protocol: 'balancer' as ProtocolType, status: 'pending' },
    { protocol: 'meteora-dlmm' as ProtocolType, status: 'pending' },
    { protocol: 'raydium-clmm' as ProtocolType, status: 'pending' },
    { protocol: 'orca-whirlpools' as ProtocolType, status: 'pending' },
  ]);

  // Simulate progressive loading
  useEffect(() => {
    const interval = setInterval(() => {
      setLoadingState(prev => {
        const newProgress = Math.min(prev.progress + 2, 100);
        return { ...prev, progress: newProgress };
      });

      // Simulate protocol completion
      setProtocolStates(prev => {
        return prev.map((state, index) => {
          const shouldComplete = loadingState.progress > (index + 1) * 12;
          const shouldStart = loadingState.progress > index * 12;
          
          if (shouldComplete && state.status !== 'success' && state.status !== 'error') {
            const isError = Math.random() < 0.1; // 10% chance of error
            return {
              ...state,
              status: isError ? 'error' : 'success',
              positionsFound: isError ? undefined : Math.floor(Math.random() * 5),
              error: isError ? 'Failed to fetch positions' : undefined,
            };
          } else if (shouldStart && state.status === 'pending') {
            return { ...state, status: 'loading' };
          }
          
          return state;
        });
      });
    }, 200);

    return () => clearInterval(interval);
  }, [loadingState.progress]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            LP Position Tracker - Loading Demo
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Demonstrating the LoadingSkeleton component with different loading states
          </p>
        </div>

        <LoadingSkeleton
          loadingState={loadingState}
          protocolStates={protocolStates}
          chain="ethereum"
          className="animate-fadeIn"
        />

        {/* Control Panel */}
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg border border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Controls</h3>
          <div className="space-y-2">
            <button
              onClick={() => setLoadingState(prev => ({ ...prev, progress: 0 }))}
              className="w-full px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            >
              Reset Demo
            </button>
            <button
              onClick={() => setLoadingState(prev => ({ ...prev, progress: 100 }))}
              className="w-full px-3 py-1 text-sm bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
            >
              Complete All
            </button>
          </div>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Progress: {Math.round(loadingState.progress)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSkeletonExample;