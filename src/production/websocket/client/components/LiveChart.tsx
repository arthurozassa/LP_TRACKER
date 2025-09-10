/**
 * Live Chart Component
 * Real-time chart that updates via WebSocket data
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, RotateCw, Pause, Play } from 'lucide-react';
import { useWebSocketContext } from '../providers/WebSocketProvider';
import { PriceUpdateMessage, PortfolioUpdateMessage } from '../../types/messages';

// ============================================================================
// COMPONENT INTERFACES
// ============================================================================

interface LiveChartProps {
  type: 'price' | 'portfolio' | 'pnl';
  token?: string;
  walletAddress?: string;
  height?: number;
  maxDataPoints?: number;
  updateInterval?: number;
  showControls?: boolean;
  className?: string;
}

interface ChartDataPoint {
  timestamp: number;
  value: number;
  label: string;
  change?: number;
}

interface ChartState {
  data: ChartDataPoint[];
  isLive: boolean;
  isPaused: boolean;
  lastUpdate: Date | null;
  trend: 'up' | 'down' | 'neutral';
  currentValue: number;
  change24h: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LiveChart({ 
  type,
  token,
  walletAddress,
  height = 300,
  maxDataPoints = 50,
  updateInterval = 1000,
  showControls = true,
  className = ''
}: LiveChartProps) {
  const webSocket = useWebSocketContext();
  
  // State
  const [state, setState] = useState<ChartState>({
    data: [],
    isLive: false,
    isPaused: false,
    lastUpdate: null,
    trend: 'neutral',
    currentValue: 0,
    change24h: 0,
  });

  // Refs
  const subscriptionRef = useRef<string | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // DATA MANAGEMENT
  // ============================================================================

  const addDataPoint = useCallback((value: number, timestamp?: number) => {
    const now = timestamp || Date.now();
    
    setState(prev => {
      const newDataPoint: ChartDataPoint = {
        timestamp: now,
        value,
        label: new Date(now).toLocaleTimeString(),
        change: prev.data.length > 0 ? value - prev.data[prev.data.length - 1].value : 0,
      };

      let newData = [...prev.data, newDataPoint];
      
      // Limit data points
      if (newData.length > maxDataPoints) {
        newData = newData.slice(-maxDataPoints);
      }

      // Calculate trend
      const trend = newDataPoint.change! > 0 ? 'up' : 
                    newDataPoint.change! < 0 ? 'down' : 'neutral';

      // Calculate 24h change (simplified)
      const change24h = newData.length >= 2 ? 
        ((value - newData[0].value) / newData[0].value) * 100 : 0;

      return {
        ...prev,
        data: newData,
        trend,
        currentValue: value,
        change24h,
        lastUpdate: new Date(),
      };
    });
  }, [maxDataPoints]);

  const clearData = useCallback(() => {
    setState(prev => ({
      ...prev,
      data: [],
      currentValue: 0,
      change24h: 0,
      trend: 'neutral',
    }));
  }, []);

  // ============================================================================
  // WEBSOCKET MESSAGE HANDLERS
  // ============================================================================

  useEffect(() => {
    if (!webSocket.isReady) return;

    let cleanupHandlers: (() => void)[] = [];

    if (type === 'price' && token) {
      const handlePriceUpdate = (message: PriceUpdateMessage) => {
        if (message.data.token === token) {
          addDataPoint(message.data.price, message.data.timestamp.getTime());
        }
      };

      cleanupHandlers.push(
        webSocket.addMessageListener('price_update', handlePriceUpdate)
      );

    } else if (type === 'portfolio' && walletAddress) {
      const handlePortfolioUpdate = (message: PortfolioUpdateMessage) => {
        addDataPoint(message.data.totalValue, message.data.lastUpdate.getTime());
      };

      cleanupHandlers.push(
        webSocket.addMessageListener('portfolio_update', handlePortfolioUpdate)
      );

    } else if (type === 'pnl' && walletAddress) {
      const handlePnLUpdate = (message: any) => {
        addDataPoint(message.data.totalPnL, message.data.timestamp.getTime());
      };

      cleanupHandlers.push(
        webSocket.addMessageListener('pnl_update', handlePnLUpdate)
      );
    }

    return () => {
      cleanupHandlers.forEach(cleanup => cleanup());
    };
  }, [webSocket.isReady, webSocket.addMessageListener, type, token, walletAddress, addDataPoint]);

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  const startLiveUpdates = useCallback(() => {
    if (!webSocket.isReady) return;

    try {
      if (type === 'price' && token) {
        webSocket.subscribe('prices', {
          tokens: [token],
        }, {
          updateFrequency: updateInterval,
        });
      } else if ((type === 'portfolio' || type === 'pnl') && walletAddress) {
        webSocket.subscribe(type === 'portfolio' ? 'portfolio' : 'pnl', {
          walletAddress,
        }, {
          updateFrequency: updateInterval,
        });
      }

      setState(prev => ({ ...prev, isLive: true, isPaused: false }));
      console.log(`Started live ${type} updates`);

    } catch (error) {
      console.error('Failed to start live updates:', error);
    }
  }, [webSocket.isReady, webSocket.subscribe, type, token, walletAddress, updateInterval]);

  const stopLiveUpdates = useCallback(() => {
    if (subscriptionRef.current) {
      webSocket.unsubscribe(subscriptionRef.current);
      subscriptionRef.current = null;
    }

    setState(prev => ({ ...prev, isLive: false, isPaused: false }));
    console.log(`Stopped live ${type} updates`);
  }, [webSocket.unsubscribe, type]);

  const togglePause = useCallback(() => {
    setState(prev => ({ ...prev, isPaused: !prev.isPaused }));
  }, []);

  // ============================================================================
  // AUTO START/STOP
  // ============================================================================

  useEffect(() => {
    if (webSocket.isConnected && (token || walletAddress)) {
      startLiveUpdates();
    }

    return () => {
      stopLiveUpdates();
    };
  }, [webSocket.isConnected, token, walletAddress, startLiveUpdates, stopLiveUpdates]);

  // ============================================================================
  // CHART CONFIGURATION
  // ============================================================================

  const getChartColor = () => {
    switch (state.trend) {
      case 'up':
        return '#10b981'; // green
      case 'down':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  };

  const getTrendIcon = () => {
    switch (state.trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatValue = (value: number) => {
    if (type === 'price') {
      return `$${value.toFixed(6)}`;
    } else if (type === 'portfolio') {
      return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    } else if (type === 'pnl') {
      return `${value >= 0 ? '+' : ''}$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    }
    return value.toString();
  };

  const formatTooltip = (value: number, name: string, props: any) => {
    return [formatValue(value), name];
  };

  // ============================================================================
  // RENDER COMPONENT
  // ============================================================================

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getTrendIcon()}
              <h3 className="font-semibold text-gray-900">
                {type === 'price' && `${token} Price`}
                {type === 'portfolio' && 'Portfolio Value'}
                {type === 'pnl' && 'P&L'}
              </h3>
            </div>
            
            {state.isLive && (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Live
              </div>
            )}
          </div>

          {showControls && (
            <div className="flex items-center gap-2">
              <button
                onClick={togglePause}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                disabled={!state.isLive}
              >
                {state.isPaused ? 
                  <Play className="w-4 h-4" /> : 
                  <Pause className="w-4 h-4" />
                }
              </button>
              
              <button
                onClick={clearData}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Current Value and Stats */}
        <div className="mt-2 flex items-center gap-4">
          <div className="text-2xl font-bold text-gray-900">
            {formatValue(state.currentValue)}
          </div>
          
          {state.change24h !== 0 && (
            <div className={`flex items-center gap-1 text-sm ${
              state.change24h >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              <span>{state.change24h >= 0 ? '+' : ''}{state.change24h.toFixed(2)}%</span>
            </div>
          )}
          
          {state.lastUpdate && (
            <div className="text-xs text-gray-500 ml-auto">
              Last update: {state.lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        {state.data.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={state.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis 
                dataKey="label"
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#9ca3af"
                tickFormatter={(value) => type === 'price' ? 
                  `$${value.toFixed(4)}` : 
                  `$${value.toLocaleString()}`
                }
              />
              <Tooltip 
                formatter={formatTooltip}
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={getChartColor()}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, stroke: getChartColor(), strokeWidth: 2 }}
                name={type === 'price' ? 'Price' : type === 'portfolio' ? 'Portfolio' : 'P&L'}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <div className="text-lg mb-2">No data available</div>
              <div className="text-sm">
                {!state.isLive ? 'Waiting for connection...' : 'Waiting for data...'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MINI CHART COMPONENT
// ============================================================================

export function MiniLiveChart({ 
  type, 
  token, 
  walletAddress, 
  className = '' 
}: Omit<LiveChartProps, 'height' | 'showControls'>) {
  return (
    <LiveChart
      type={type}
      token={token}
      walletAddress={walletAddress}
      height={100}
      maxDataPoints={20}
      showControls={false}
      className={className}
    />
  );
}