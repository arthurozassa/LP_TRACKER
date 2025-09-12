/**
 * Real-Time Positions Hook
 * Manages real-time position data and updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from './useWebSocket';
import { 
  RealTimePosition, 
  PositionUpdateMessage, 
  PositionCreatedMessage, 
  PositionRemovedMessage,
  PositionsBatchUpdateMessage,
  PortfolioUpdateMessage,
  PnLUpdateMessage
} from '../../types/messages';
import { Position } from '../../../../types';

// ============================================================================
// REAL-TIME POSITIONS INTERFACES
// ============================================================================

export interface PositionsState {
  positions: RealTimePosition[];
  loading: boolean;
  error?: string;
  lastUpdate?: Date;
  totalValue: number;
  totalPnL: number;
  totalPnLPercentage: number;
  positionCount: number;
}

export interface PositionFilters {
  chains?: string[];
  protocols?: string[];
  inRangeOnly?: boolean;
  minValue?: number;
  maxValue?: number;
}

export interface PositionsOptions {
  walletAddress: string;
  filters?: PositionFilters;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export interface PositionUpdate {
  positionId: string;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
}

// ============================================================================
// REAL-TIME POSITIONS HOOK
// ============================================================================

export function useRealTimePositions(options: PositionsOptions) {
  const { walletAddress, filters, autoRefresh = true, refreshInterval = 5000 } = options;

  // WebSocket connection
  const webSocket = useWebSocket({
    autoConnect: true,
    debug: process.env.NODE_ENV === 'development',
  });

  // State
  const [state, setState] = useState<PositionsState>({
    positions: [],
    loading: true,
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercentage: 0,
    positionCount: 0,
  });

  const [recentUpdates, setRecentUpdates] = useState<PositionUpdate[]>([]);

  // Refs
  const subscriptionIdRef = useRef<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // POSITION DATA MANAGEMENT
  // ============================================================================

  const updatePosition = useCallback((updatedPosition: RealTimePosition) => {
    setState(prev => {
      const existingIndex = prev.positions.findIndex(p => p.id === updatedPosition.id);
      let newPositions: RealTimePosition[];

      if (existingIndex >= 0) {
        // Update existing position
        newPositions = [...prev.positions];
        newPositions[existingIndex] = updatedPosition;
      } else {
        // Add new position
        newPositions = [...prev.positions, updatedPosition];
      }

      // Recalculate totals
      const totals = calculatePortfolioTotals(newPositions);

      return {
        ...prev,
        positions: newPositions,
        lastUpdate: new Date(),
        ...totals,
      };
    }, 'Logger message');
  }, []);

  const removePosition = useCallback((positionId: string) => {
    setState(prev => {
      const newPositions = prev.positions.filter(p => p.id !== positionId);
      const totals = calculatePortfolioTotals(newPositions);

      return {
        ...prev,
        positions: newPositions,
        lastUpdate: new Date(),
        ...totals,
      };
    }, 'Logger message');
  }, []);

  const updatePositionsBatch = useCallback((positions: RealTimePosition[]) => {
    setState(prev => {
      const totals = calculatePortfolioTotals(positions);

      return {
        ...prev,
        positions,
        loading: false,
        lastUpdate: new Date(),
        ...totals,
      };
    }, 'Logger message');
  }, []);

  const addPositionUpdate = useCallback((update: PositionUpdate) => {
    setRecentUpdates(prev => {
      const newUpdates = [update, ...prev];
      
      // Keep only recent updates (last 50)
      if (newUpdates.length > 50) {
        return newUpdates.slice(0, 50);
      }
      
      return newUpdates;
    }, 'Logger message');
  }, []);

  // ============================================================================
  // WEBSOCKET MESSAGE HANDLERS
  // ============================================================================

  useEffect(() => {
    if (!webSocket.isReady) return;

    // Position update handler
    const handlePositionUpdate = (message: PositionUpdateMessage) => {
      const { position, changes } = message.data;
      
      updatePosition(position);

      // Track changes
      changes.forEach(change => {
        addPositionUpdate({
          positionId: position.id,
          field: change.field,
          oldValue: change.oldValue,
          newValue: change.newValue,
          timestamp: change.timestamp,
        }, 'Logger message');
      }, 'Logger message');
    };

    // Position created handler
    const handlePositionCreated = (message: PositionCreatedMessage) => {
      updatePosition(message.data.position);
    };

    // Position removed handler
    const handlePositionRemoved = (message: PositionRemovedMessage) => {
      removePosition(message.data.positionId);
    };

    // Batch update handler
    const handlePositionsBatchUpdate = (message: PositionsBatchUpdateMessage) => {
      updatePositionsBatch(message.data.positions);
    };

    // Portfolio update handler
    const handlePortfolioUpdate = (message: PortfolioUpdateMessage) => {
      setState(prev => ({
        ...prev,
        totalValue: message.data.totalValue,
        positionCount: message.data.positionCount,
        lastUpdate: new Date(),
      }));
    };

    // P&L update handler
    const handlePnLUpdate = (message: PnLUpdateMessage) => {
      setState(prev => ({
        ...prev,
        totalPnL: message.data.totalPnL,
        totalPnLPercentage: message.data.pnlPercentage,
        lastUpdate: new Date(),
      }));

      // If it's for a specific position, update that position
      if (message.data.positionId) {
        setState(prev => ({
          ...prev,
          positions: prev.positions.map(pos => 
            pos.id === message.data.positionId 
              ? {
                  ...pos,
                  pnl: {
                    unrealized: message.data.unrealizedPnL,
                    realized: message.data.realizedPnL,
                    total: message.data.totalPnL,
                    percentage: message.data.pnlPercentage,
                  },
                  lastUpdate: message.data.timestamp,
                }
              : pos
          ),
        }));
      }
    };

    // Register message handlers
    const cleanupHandlers = [
      webSocket.addMessageListener('position_update', handlePositionUpdate),
      webSocket.addMessageListener('position_created', handlePositionCreated),
      webSocket.addMessageListener('position_removed', handlePositionRemoved),
      webSocket.addMessageListener('positions_batch_update', handlePositionsBatchUpdate),
      webSocket.addMessageListener('portfolio_update', handlePortfolioUpdate),
      webSocket.addMessageListener('pnl_update', handlePnLUpdate),
    ];

    return () => {
      cleanupHandlers.forEach(cleanup => cleanup());
    };
  }, [
    webSocket.isReady,
    webSocket.addMessageListener,
    updatePosition,
    removePosition,
    updatePositionsBatch,
    addPositionUpdate,
  ]);

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // ============================================================================

  const subscribeToPositions = useCallback(() => {
    if (!webSocket.isReady || !walletAddress) return;

    try {
      // Create subscription for positions
      webSocket.subscribe('positions', {
        walletAddress,
        ...filters,
      }, {
        updateFrequency: refreshInterval,
        includeHistorical: true,
      }, 'Logger message');

      // Also subscribe to portfolio updates
      webSocket.subscribe('portfolio', {
        walletAddress,
      }, {
        updateFrequency: refreshInterval,
      }, 'Logger message');

      console.log('Subscribed to real-time positions for:', walletAddress);

    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Subscription failed',
        loading: false,
      }));
    }
  }, [webSocket.isReady, webSocket.subscribe, walletAddress, filters, refreshInterval]);

  const unsubscribeFromPositions = useCallback(() => {
    if (subscriptionIdRef.current) {
      webSocket.unsubscribe(subscriptionIdRef.current);
      subscriptionIdRef.current = null;
    }
  }, [webSocket.unsubscribe]);

  // ============================================================================
  // AUTO-SUBSCRIPTION
  // ============================================================================

  useEffect(() => {
    if (webSocket.isReady && walletAddress) {
      subscribeToPositions();
    }

    return () => {
      unsubscribeFromPositions();
    };
  }, [webSocket.isReady, walletAddress, subscribeToPositions, unsubscribeFromPositions]);

  // ============================================================================
  // AUTO REFRESH
  // ============================================================================

  useEffect(() => {
    if (autoRefresh && refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        // Request fresh data
        subscribeToPositions();
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, subscribeToPositions]);

  // ============================================================================
  // FILTERING AND SORTING
  // ============================================================================

  const getFilteredPositions = useCallback((customFilters?: PositionFilters) => {
    const activeFilters = customFilters || filters || {};
    let filtered = [...state.positions];

    // Chain filter
    if (activeFilters.chains?.length) {
      filtered = filtered.filter(pos => activeFilters.chains!.includes(pos.chain));
    }

    // Protocol filter
    if (activeFilters.protocols?.length) {
      filtered = filtered.filter(pos => activeFilters.protocols!.includes(pos.protocol));
    }

    // In range filter
    if (activeFilters.inRangeOnly) {
      filtered = filtered.filter(pos => pos.rangeStatus.inRange);
    }

    // Value filters
    if (activeFilters.minValue !== undefined) {
      filtered = filtered.filter(pos => pos.value >= activeFilters.minValue!);
    }

    if (activeFilters.maxValue !== undefined) {
      filtered = filtered.filter(pos => pos.value <= activeFilters.maxValue!);
    }

    return filtered;
  }, [state.positions, filters]);

  const getSortedPositions = useCallback((
    sortBy: 'value' | 'pnl' | 'apr' | 'lastUpdate' = 'value',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) => {
    const positions = getFilteredPositions();
    
    return positions.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortBy) {
        case 'value':
          aValue = a.value;
          bValue = b.value;
          break;
        case 'pnl':
          aValue = a.pnl.total;
          bValue = b.pnl.total;
          break;
        case 'apr':
          aValue = a.apr;
          bValue = b.apr;
          break;
        case 'lastUpdate':
          aValue = a.lastUpdate.getTime();
          bValue = b.lastUpdate.getTime();
          break;
        default:
          aValue = a.value;
          bValue = b.value;
      }

      return sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    }, 'Logger message');
  }, [getFilteredPositions]);

  // ============================================================================
  // MANUAL REFRESH
  // ============================================================================

  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, loading: true }));
    subscribeToPositions();
  }, [subscribeToPositions]);

  // ============================================================================
  // RETURN HOOK INTERFACE
  // ============================================================================

  return {
    // State
    ...state,
    isConnected: webSocket.isConnected,
    recentUpdates,

    // Position data
    filteredPositions: getFilteredPositions(),
    sortedPositions: getSortedPositions(),

    // Methods
    refresh,
    getFilteredPositions,
    getSortedPositions,
    subscribeToPositions,
    unsubscribeFromPositions,

    // WebSocket methods
    webSocket,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function calculatePortfolioTotals(positions: RealTimePosition[]) {
  const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl.total, 0);
  const totalPnLPercentage = totalValue > 0 ? (totalPnL / totalValue) * 100 : 0;

  return {
    totalValue,
    totalPnL,
    totalPnLPercentage,
    positionCount: positions.length,
  };
}