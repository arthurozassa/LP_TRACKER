'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Zap, 
  TrendingUp, 
  ArrowRight, 
  ExternalLink, 
  AlertTriangle,
  Target,
  Lightbulb,
  RefreshCw,
  Clock,
  DollarSign,
  Activity,
  Filter
} from 'lucide-react';
import { YieldOptimization, Position } from '../../types';
import { defiLlamaService } from '../../services/defiLlama';

interface YieldOptimizerProps {
  positions: Position[];
  currentPortfolioValue: number;
  className?: string;
  onOptimizationApply?: (action: any) => void;
}

type SortBy = 'apr' | 'tvl' | 'risk' | 'opportunity';
type FilterBy = 'all' | 'low-risk' | 'high-yield' | 'stablecoin' | 'blue-chip';

const YieldOptimizer: React.FC<YieldOptimizerProps> = ({
  positions,
  currentPortfolioValue,
  className = '',
  onOptimizationApply
}) => {
  const [optimization, setOptimization] = useState<YieldOptimization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('apr');
  const [filterBy, setFilterBy] = useState<FilterBy>('all');
  const [showOnlyActionable, setShowOnlyActionable] = useState(true);

  // Calculate current portfolio metrics
  const currentMetrics = useMemo(() => {
    if (!positions.length) return { avgAPR: 0, totalFees: 0, riskLevel: 'medium' as const };
    
    const totalValue = positions.reduce((sum, pos) => sum + pos.value, 0);
    const weightedAPR = positions.reduce((sum, pos) => {
      const weight = totalValue > 0 ? pos.value / totalValue : 0;
      return sum + (pos.apr * weight);
    }, 0);
    
    const totalFees = positions.reduce((sum, pos) => sum + (pos.feesEarned || 0), 0);
    
    // Simple risk assessment based on protocol diversity and position status
    const outOfRangeCount = positions.filter(p => !p.inRange).length;
    const riskRatio = positions.length > 0 ? outOfRangeCount / positions.length : 0;
    
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (riskRatio < 0.2 && positions.length >= 3) riskLevel = 'low';
    if (riskRatio > 0.5 || positions.length < 2) riskLevel = 'high';
    
    return {
      avgAPR: weightedAPR,
      totalFees,
      riskLevel
    };
  }, [positions]);

  // Fetch optimization data
  const fetchOptimization = useCallback(async () => {
    if (!positions.length) return;

    setIsLoading(true);
    try {
      const userProtocols = Array.from(new Set(positions.map(p => p.protocol.toLowerCase())));
      const chains = Array.from(new Set(positions.map(p => p.chain || 'ethereum')));

      const optimizationData = await defiLlamaService.getYieldOptimization(
        userProtocols,
        1000000, // Min $1M TVL
        chains.map(chain => chain.charAt(0).toUpperCase() + chain.slice(1))
      );

      setOptimization(optimizationData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching optimization:', error);
      // Use mock data on error
      setOptimization(generateMockOptimization());
      setLastUpdated(new Date());
    } finally {
      setIsLoading(false);
    }
  }, [positions]);

  // Auto-fetch on mount and when positions change
  useEffect(() => {
    fetchOptimization();
  }, [fetchOptimization]);

  // Filter and sort opportunities
  const filteredOpportunities = useMemo(() => {
    if (!optimization) return [];
    
    let filtered = [...optimization.bestOpportunities];
    
    // Apply filters
    switch (filterBy) {
      case 'low-risk':
        filtered = filtered.filter(opp => opp.risk === 'low');
        break;
      case 'high-yield':
        filtered = filtered.filter(opp => opp.apr > 20);
        break;
      case 'stablecoin':
        filtered = filtered.filter(opp => 
          opp.pool.toLowerCase().includes('usdc') || 
          opp.pool.toLowerCase().includes('usdt') ||
          opp.pool.toLowerCase().includes('dai')
        );
        break;
      case 'blue-chip':
        filtered = filtered.filter(opp =>
          opp.pool.toLowerCase().includes('eth') ||
          opp.pool.toLowerCase().includes('btc') ||
          opp.pool.toLowerCase().includes('sol')
        );
        break;
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'apr':
        filtered.sort((a, b) => b.apr - a.apr);
        break;
      case 'tvl':
        filtered.sort((a, b) => b.tvl - a.tvl);
        break;
      case 'risk':
        const riskOrder = { 'low': 0, 'medium': 1, 'high': 2 };
        filtered.sort((a, b) => riskOrder[a.risk] - riskOrder[b.risk]);
        break;
      case 'opportunity':
        // Sort by potential improvement over current APR
        filtered.sort((a, b) => (b.apr - currentMetrics.avgAPR) - (a.apr - currentMetrics.avgAPR));
        break;
    }
    
    return filtered;
  }, [optimization, sortBy, filterBy, currentMetrics.avgAPR]);

  // Get actionable suggestions
  const actionableSuggestions = useMemo(() => {
    if (!optimization) return [];
    
    return optimization.suggestedActions.filter(action => {
      if (!showOnlyActionable) return true;
      
      // Only show high-impact suggestions
      const improvementThreshold = 2; // 2% APR improvement
      return action.expectedAPR > currentMetrics.avgAPR + improvementThreshold;
    });
  }, [optimization, showOnlyActionable, currentMetrics.avgAPR]);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const formatAPR = (apr: number) => `${apr.toFixed(1)}%`;
  const formatTVL = (tvl: number) => {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(0)}M`;
    return `$${(tvl / 1e3).toFixed(0)}K`;
  };

  // Mock data generator for development
  const generateMockOptimization = (): YieldOptimization => ({
    currentAPR: currentMetrics.avgAPR,
    suggestedActions: [
      {
        action: 'rebalance',
        protocol: 'Curve',
        pool: 'stETH-ETH',
        expectedAPR: currentMetrics.avgAPR + 5.2,
        risk: 'medium',
        reasoning: 'Lower impermanent loss with higher yields in liquid staking',
        urgency: 'medium'
      },
      {
        action: 'enter',
        protocol: 'Balancer',
        pool: 'wstETH-WETH',
        expectedAPR: currentMetrics.avgAPR + 3.1,
        risk: 'low',
        reasoning: 'Stable correlation with additional BAL rewards',
        urgency: 'low'
      }
    ],
    bestOpportunities: [
      {
        protocol: 'Curve',
        pool: 'stETH-ETH',
        apr: currentMetrics.avgAPR + 5.2,
        tvl: 125000000,
        volume24h: 5000000,
        risk: 'medium'
      },
      {
        protocol: 'Balancer',
        pool: 'wstETH-WETH',
        apr: currentMetrics.avgAPR + 3.1,
        tvl: 45000000,
        volume24h: 2000000,
        risk: 'low'
      }
    ]
  });

  return (
    <div className={`crypto-card border border-orange-500/30 p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 crypto-card rounded-lg border border-orange-500/20">
            <Zap className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Yield Optimization</h3>
            <p className="text-gray-400 text-sm">AI-powered yield improvement suggestions</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {lastUpdated && (
            <div className="text-xs text-gray-500">
              Updated {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={fetchOptimization}
            disabled={isLoading}
            className="p-2 crypto-card border border-orange-500/20 rounded-lg hover:border-orange-500/40 transition-all duration-200 disabled:opacity-50"
            title="Refresh optimization data"
          >
            <RefreshCw className={`w-4 h-4 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Current Portfolio Summary */}
      <div className="crypto-card border border-blue-500/20 p-5">
        <h4 className="font-semibold text-white mb-4 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span>Current Portfolio Performance</span>
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {formatAPR(currentMetrics.avgAPR)}
            </div>
            <div className="text-gray-400 text-sm">Average APR</div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">
              ${currentMetrics.totalFees.toFixed(0)}
            </div>
            <div className="text-gray-400 text-sm">Total Fees Earned</div>
          </div>
          
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              currentMetrics.riskLevel === 'low' ? 'text-green-400' :
              currentMetrics.riskLevel === 'medium' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {currentMetrics.riskLevel.toUpperCase()}
            </div>
            <div className="text-gray-400 text-sm">Risk Level</div>
          </div>
        </div>
      </div>

      {/* Action Suggestions */}
      {!isLoading && actionableSuggestions.length > 0 && (
        <div className="crypto-card border border-green-500/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold text-white flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-green-400" />
              <span>Recommended Actions</span>
            </h4>
            
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyActionable}
                onChange={(e) => setShowOnlyActionable(e.target.checked)}
                className="rounded border-gray-600 bg-gray-800 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-gray-400">High impact only</span>
            </label>
          </div>

          <div className="space-y-4">
            {actionableSuggestions.map((action, index) => (
              <div key={index} className="crypto-card border border-white/10 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      action.action === 'enter' ? 'bg-green-500/20 text-green-400' :
                      action.action === 'exit' ? 'bg-red-500/20 text-red-400' :
                      action.action === 'rebalance' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {action.action.toUpperCase()}
                    </div>
                    
                    <div className={`w-2 h-2 rounded-full ${getUrgencyColor(action.urgency)}`} />
                    
                    <span className="font-medium text-white">
                      {action.protocol} - {action.pool}
                    </span>
                  </div>

                  <div className="text-right">
                    <div className="text-green-400 font-bold">
                      {formatAPR(action.expectedAPR)}
                    </div>
                    <div className="text-xs text-gray-400">
                      +{(action.expectedAPR - currentMetrics.avgAPR).toFixed(1)}% improvement
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-gray-300 text-sm mb-2">{action.reasoning}</p>
                    <div className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-xs border ${getRiskColor(action.risk)}`}>
                      <span className="capitalize">{action.risk} Risk</span>
                    </div>
                  </div>

                  {onOptimizationApply && (
                    <button
                      onClick={() => onOptimizationApply(action)}
                      className="ml-4 px-4 py-2 crypto-button text-sm rounded-lg flex items-center space-x-2 hover:scale-105 transition-transform"
                    >
                      <span>Apply</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Opportunities */}
      {!isLoading && optimization && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-white flex items-center space-x-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span>Best Opportunities</span>
            </h4>

            {/* Filters and Sorting */}
            <div className="flex items-center space-x-2">
              {/* Filter */}
              <select
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="all">All Pools</option>
                <option value="low-risk">Low Risk</option>
                <option value="high-yield">High Yield</option>
                <option value="stablecoin">Stablecoins</option>
                <option value="blue-chip">Blue Chip</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white"
              >
                <option value="apr">Highest APR</option>
                <option value="tvl">Highest TVL</option>
                <option value="risk">Lowest Risk</option>
                <option value="opportunity">Best Opportunity</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredOpportunities.slice(0, 6).map((opportunity, index) => (
              <div key={index} className="crypto-card border border-white/10 p-4 hover:border-orange-500/30 transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-medium text-white">{opportunity.protocol}</div>
                    <div className="text-gray-400 text-sm">{opportunity.pool}</div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-400">
                      {formatAPR(opportunity.apr)}
                    </div>
                    <div className={`text-xs px-2 py-1 rounded border ${getRiskColor(opportunity.risk)}`}>
                      {opportunity.risk}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-4 text-gray-400">
                    <span>TVL: {formatTVL(opportunity.tvl)}</span>
                    {opportunity.volume24h > 0 && (
                      <span>Vol: {formatTVL(opportunity.volume24h)}</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="text-xs text-gray-500">
                      +{(opportunity.apr - currentMetrics.avgAPR).toFixed(1)}%
                    </div>
                    <ExternalLink className="w-3 h-3 text-gray-500" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredOpportunities.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No opportunities match your current filters</p>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-orange-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Analyzing yield opportunities...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !positions.length && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <div className="text-center">
            <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No positions to optimize</p>
            <p className="text-sm">Add liquidity positions to see optimization suggestions</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default YieldOptimizer;