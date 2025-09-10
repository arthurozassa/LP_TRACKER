import { ScanResults, Position } from '../types';

// Calculate aggregated metrics from scan results
export function calculateMetrics(scanResults: ScanResults) {
  const allPositions = Object.values(scanResults.protocols)
    .flatMap(protocol => protocol.positions);

  const totalFeesEarned = allPositions.reduce((sum, pos) => sum + pos.feesEarned, 0);
  const averageAPR = allPositions.length > 0 
    ? allPositions.reduce((sum, pos) => sum + pos.apr, 0) / allPositions.length 
    : 0;
  
  const activeProtocols = Object.keys(scanResults.protocols).length;
  const inRangePositions = allPositions.filter(pos => pos.inRange).length;
  const outOfRangePositions = allPositions.filter(pos => !pos.inRange).length;

  return {
    totalValue: scanResults.totalValue,
    totalPositions: scanResults.totalPositions,
    totalFeesEarned,
    averageAPR,
    activeProtocols,
    inRangePositions,
    outOfRangePositions,
    protocolDistribution: Object.entries(scanResults.protocols).map(([name, data]) => ({
      name,
      value: data.positions.reduce((sum, pos) => sum + pos.value, 0),
      positions: data.positions.length
    }))
  };
}

// Get positions filtered by protocol
export function getPositionsByProtocol(scanResults: ScanResults, protocolName?: string): Position[] {
  if (!protocolName) {
    return Object.values(scanResults.protocols)
      .flatMap(protocol => protocol.positions);
  }
  
  return scanResults.protocols[protocolName]?.positions || [];
}

// Get top performing positions by APR
export function getTopPerformingPositions(scanResults: ScanResults, limit: number = 5): Position[] {
  const allPositions = Object.values(scanResults.protocols)
    .flatMap(protocol => protocol.positions);
  
  return allPositions
    .sort((a, b) => b.apr - a.apr)
    .slice(0, limit);
}

// Get positions by range status
export function getPositionsByRangeStatus(scanResults: ScanResults, inRange: boolean): Position[] {
  const allPositions = Object.values(scanResults.protocols)
    .flatMap(protocol => protocol.positions);
  
  return allPositions.filter(pos => pos.inRange === inRange);
}

// Format currency values
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

// Format percentage values
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Format token amounts
export function formatTokenAmount(amount: number, symbol: string): string {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(2)}M ${symbol}`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(2)}K ${symbol}`;
  } else {
    return `${amount.toFixed(4)} ${symbol}`;
  }
}