'use client';

import { useState, useMemo } from 'react';
import { FilterState } from '../components/filters/AdvancedFilters';

interface Position {
  id: string;
  protocol: string;
  chain: string;
  pool: string;
  liquidity: number;
  value: number;
  feesEarned: number;
  apr: number;
  inRange: boolean;
  tokens: {
    token0: { symbol: string; amount: number; address?: string };
    token1: { symbol: string; amount: number; address?: string };
  };
  poolAddress: string;
  createdAt: string;
  updatedAt: string;
}

const usePositionFilters = (positions: Position[]) => {
  const [filters, setFilters] = useState<FilterState>({
    minValue: '',
    maxValue: '',
    protocols: [],
    status: 'all',
    timeRange: 'all',
    chains: [],
    minApr: '',
    maxApr: ''
  });

  // Get available protocols and chains from positions
  const availableProtocols = useMemo(() => {
    const protocols = new Set(positions.map(p => p.protocol));
    return Array.from(protocols).sort();
  }, [positions]);

  const availableChains = useMemo(() => {
    const chains = new Set(positions.map(p => p.chain));
    return Array.from(chains).sort();
  }, [positions]);

  // Apply filters to positions
  const filteredPositions = useMemo(() => {
    let filtered = [...positions];

    // Filter by minimum value
    if (filters.minValue) {
      const minVal = parseFloat(filters.minValue);
      filtered = filtered.filter(p => p.value >= minVal);
    }

    // Filter by maximum value
    if (filters.maxValue) {
      const maxVal = parseFloat(filters.maxValue);
      filtered = filtered.filter(p => p.value <= maxVal);
    }

    // Filter by minimum APR
    if (filters.minApr) {
      const minApr = parseFloat(filters.minApr);
      filtered = filtered.filter(p => p.apr >= minApr);
    }

    // Filter by maximum APR
    if (filters.maxApr) {
      const maxApr = parseFloat(filters.maxApr);
      filtered = filtered.filter(p => p.apr <= maxApr);
    }

    // Filter by protocols
    if (filters.protocols.length > 0) {
      filtered = filtered.filter(p => filters.protocols.includes(p.protocol));
    }

    // Filter by chains
    if (filters.chains.length > 0) {
      filtered = filtered.filter(p => filters.chains.includes(p.chain));
    }

    // Filter by status (in-range/out-of-range)
    if (filters.status !== 'all') {
      if (filters.status === 'in-range') {
        filtered = filtered.filter(p => p.inRange);
      } else if (filters.status === 'out-of-range') {
        filtered = filtered.filter(p => !p.inRange);
      }
    }

    // Filter by time range
    if (filters.timeRange !== 'all') {
      const now = new Date();
      let cutoffTime: Date;

      switch (filters.timeRange) {
        case '24h':
          cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoffTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoffTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoffTime = new Date(0);
      }

      filtered = filtered.filter(p => {
        const updatedAt = new Date(p.updatedAt);
        return updatedAt >= cutoffTime;
      });
    }

    return filtered;
  }, [positions, filters]);

  // Get filter statistics
  const filterStats = useMemo(() => {
    const totalPositions = positions.length;
    const filteredCount = filteredPositions.length;
    const totalValue = filteredPositions.reduce((sum, p) => sum + p.value, 0);
    const totalFees = filteredPositions.reduce((sum, p) => sum + p.feesEarned, 0);
    const avgApr = filteredPositions.length > 0 
      ? filteredPositions.reduce((sum, p) => sum + p.apr, 0) / filteredPositions.length 
      : 0;

    return {
      totalPositions,
      filteredCount,
      totalValue,
      totalFees,
      avgApr,
      filteredPercentage: totalPositions > 0 ? (filteredCount / totalPositions) * 100 : 0
    };
  }, [positions, filteredPositions]);

  // Quick filter functions inspired by Arkham
  const quickFilters = {
    showHighValue: () => setFilters(prev => ({ ...prev, minValue: '10000' })),
    showInRangeOnly: () => setFilters(prev => ({ ...prev, status: 'in-range' })),
    showHighYield: () => setFilters(prev => ({ ...prev, minApr: '20' })),
    showRecent: () => setFilters(prev => ({ ...prev, timeRange: '7d' })),
    showWhalePositions: () => setFilters(prev => ({ ...prev, minValue: '100000' })),
    reset: () => setFilters({
      minValue: '',
      maxValue: '',
      protocols: [],
      status: 'all',
      timeRange: 'all',
      chains: [],
      minApr: '',
      maxApr: ''
    })
  };

  return {
    filters,
    setFilters,
    filteredPositions,
    availableProtocols,
    availableChains,
    filterStats,
    quickFilters
  };
};

export default usePositionFilters;