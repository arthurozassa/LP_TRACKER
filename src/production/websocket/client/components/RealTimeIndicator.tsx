/**
 * Real-Time Connection Indicator
 * Shows WebSocket connection status and real-time updates
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RotateCw, AlertTriangle, Clock, Zap } from 'lucide-react';
import { useConnectionStatus, useWebSocketContext } from '../providers/WebSocketProvider';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface RealTimeIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  compact?: boolean;
  showMetrics?: boolean;
  onClick?: () => void;
}

interface ConnectionStatusBadgeProps {
  status: string;
  compact?: boolean;
}

interface MetricsDisplayProps {
  metrics: any;
  compact?: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function RealTimeIndicator({ 
  position = 'top-right', 
  compact = false, 
  showMetrics = false,
  onClick 
}: RealTimeIndicatorProps) {
  const { status, error, statusText } = useConnectionStatus();
  const webSocket = useWebSocketContext();
  const [pulseAnimation, setPulseAnimation] = useState(false);

  // Trigger pulse animation on connection changes
  useEffect(() => {
    if (status === 'connected') {
      setPulseAnimation(true);
      const timer = setTimeout(() => setPulseAnimation(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  return (
    <div 
      className={`fixed ${positionClasses[position]} z-50 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className={`
        bg-white/90 backdrop-blur-sm border rounded-lg shadow-lg
        transition-all duration-200 hover:shadow-xl
        ${pulseAnimation ? 'animate-pulse' : ''}
        ${compact ? 'p-2' : 'p-3'}
      `}>
        <div className="flex items-center gap-2">
          <ConnectionStatusBadge status={status} compact={compact} />
          
          {!compact && (
            <>
              <div className="h-4 w-px bg-gray-300" />
              <span className="text-sm font-medium text-gray-700">
                {statusText}
              </span>
            </>
          )}
          
          {error && !compact && (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          )}
        </div>
        
        {showMetrics && webSocket.metrics && (
          <MetricsDisplay metrics={webSocket.metrics} compact={compact} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// CONNECTION STATUS BADGE
// ============================================================================

function ConnectionStatusBadge({ status, compact }: ConnectionStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          pulse: 'animate-pulse',
        };
      case 'connecting':
        return {
          icon: RotateCw,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          pulse: 'animate-spin',
        };
      case 'reconnecting':
        return {
          icon: RotateCw,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          pulse: 'animate-spin',
        };
      case 'error':
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          pulse: '',
        };
      default:
        return {
          icon: WifiOff,
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          pulse: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`
      flex items-center justify-center
      ${compact ? 'w-6 h-6' : 'w-8 h-8'}
      rounded-full border
      ${config.bgColor}
      ${config.borderColor}
    `}>
      <Icon className={`
        ${compact ? 'w-3 h-3' : 'w-4 h-4'}
        ${config.color}
        ${config.pulse}
      `} />
    </div>
  );
}

// ============================================================================
// METRICS DISPLAY
// ============================================================================

function MetricsDisplay({ metrics, compact }: MetricsDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
        <Zap className="w-3 h-3" />
        <span>{metrics.messagesReceived || 0}</span>
      </div>
    );
  }

  return (
    <div className="mt-2 pt-2 border-t border-gray-200">
      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>↓ {metrics.messagesReceived || 0}</span>
        </div>
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3" />
          <span>↑ {metrics.messagesSent || 0}</span>
        </div>
        {metrics.averageLatency > 0 && (
          <>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{Math.round(metrics.averageLatency)}ms</span>
            </div>
            <div className="text-gray-400">
              {metrics.lastMessageAt && (
                <span>{formatRelativeTime(metrics.lastMessageAt)}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// DETAILED CONNECTION STATUS COMPONENT
// ============================================================================

export function ConnectionStatusPanel() {
  const { status, error, isConnected, isConnecting, isReconnecting } = useConnectionStatus();
  const webSocket = useWebSocketContext();
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-white border rounded-lg shadow-sm">
      <div 
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <ConnectionStatusBadge status={status} />
          <div>
            <h3 className="font-semibold text-gray-900">Real-Time Connection</h3>
            <p className="text-sm text-gray-600">
              {isConnected && 'Live data streaming active'}
              {isConnecting && 'Establishing connection...'}
              {isReconnecting && 'Attempting to reconnect...'}
              {error && 'Connection interrupted'}
            </p>
          </div>
        </div>
        
        <RotateCw 
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isExpanded ? 'rotate-180' : ''
          }`} 
        />
      </div>

      {isExpanded && (
        <div className="border-t px-4 pb-4">
          <div className="mt-4 space-y-3">
            {/* Connection Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Status:</span>
                <span className={`ml-2 font-medium ${getStatusTextColor(status)}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
              
              {webSocket.connectionId && (
                <div>
                  <span className="text-gray-500">Connection ID:</span>
                  <span className="ml-2 font-mono text-xs">
                    {webSocket.connectionId.slice(-8)}
                  </span>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              </div>
            )}

            {/* Metrics */}
            {webSocket.metrics && isConnected && (
              <div className="p-3 bg-gray-50 rounded-md">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Connection Metrics</h4>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="text-center">
                    <div className="font-semibold text-green-600">
                      {webSocket.metrics.messagesReceived || 0}
                    </div>
                    <div className="text-gray-500">Received</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">
                      {webSocket.metrics.messagesSent || 0}
                    </div>
                    <div className="text-gray-500">Sent</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-purple-600">
                      {webSocket.metrics.averageLatency ? 
                        `${Math.round(webSocket.metrics.averageLatency)}ms` : '--'
                      }
                    </div>
                    <div className="text-gray-500">Latency</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={webSocket.reconnect}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Reconnect
              </button>
              
              {isConnected && (
                <button
                  onClick={webSocket.disconnect}
                  className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getStatusTextColor(status: string): string {
  switch (status) {
    case 'connected':
      return 'text-green-600';
    case 'connecting':
    case 'reconnecting':
      return 'text-blue-600';
    case 'error':
    case 'disconnected':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
  return `${Math.floor(diffSecs / 3600)}h ago`;
}