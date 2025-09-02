'use client';

import React from 'react';
import { Check, X, Clock, Zap } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface ProtocolLoadingIndicatorProps {
  protocolName: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  positionsFound?: number;
  error?: string;
  progress?: number;
  emoji?: string;
  color?: string;
}

const ProtocolLoadingIndicator: React.FC<ProtocolLoadingIndicatorProps> = ({
  protocolName,
  status,
  positionsFound = 0,
  error,
  progress = 0,
  emoji = '🔄',
  color = '#6366f1'
}) => {

  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'loading':
        return <LoadingSpinner size="sm" variant="ring" color="primary" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending':
        return 'border-gray-300 bg-gray-50';
      case 'loading':
        return 'border-blue-300 bg-blue-50 ring-2 ring-blue-200';
      case 'success':
        return 'border-green-300 bg-green-50';
      case 'error':
        return 'border-red-300 bg-red-50';
      default:
        return 'border-gray-300 bg-gray-50';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return 'Queued';
      case 'loading':
        return 'Scanning...';
      case 'success':
        return positionsFound > 0 
          ? `${positionsFound} position${positionsFound === 1 ? '' : 's'}`
          : 'No positions';
      case 'error':
        return error || 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div
      className={`
        relative rounded-lg p-3 border transition-all duration-300 animate-fadeIn
        ${getStatusColor()}
        ${status === 'loading' ? 'shadow-lg animate-pulse' : 'shadow-sm'}
        ${status === 'error' ? 'animate-shake' : ''}
      `}
    >
      {/* Shimmer effect for loading state */}
      {status === 'loading' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
      )}

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className={`text-lg ${status === 'loading' ? 'animate-spin' : ''}`}>
              {emoji}
            </div>
            <span className="font-medium text-gray-900 text-sm">
              {protocolName}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            {getStatusIcon()}
          </div>
        </div>

        {/* Status text */}
        <div className="text-xs text-gray-600 mb-2">
          {getStatusText()}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              status === 'loading' ? 'bg-blue-500' :
              status === 'success' ? 'bg-green-500' :
              status === 'error' ? 'bg-red-500' :
              'bg-gray-300'
            }`}
            style={{ 
              width: status === 'success' ? '100%' : 
                     status === 'error' ? '100%' : 
                     status === 'loading' ? `${Math.max(progress, 20)}%` : '0%'
            }}
          />
        </div>

        {/* Success badge */}
        {status === 'success' && positionsFound > 0 && (
          <div className="absolute -top-1 -right-1 animate-bounce">
            <div className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {positionsFound}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProtocolLoadingIndicator;