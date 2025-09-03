'use client';

import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Coins, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { HodlComparison as HodlComparisonType, Position, TimeSeriesDataPoint } from '../../types';

interface HodlComparisonProps {
  positions: Position[];
  portfolioHistory: TimeSeriesDataPoint[];
  hodlHistory: TimeSeriesDataPoint[];
  className?: string;
}

interface AnalysisResult {
  lpStrategy: {
    currentValue: number;
    totalReturn: number;
    fees: number;
    impermanentLoss: number;
    netROI: number;
  };
  hodlStrategy: {
    currentValue: number;
    totalReturn: number;
    roi: number;
    tokenAllocation: Record<string, { amount: number; value: number; percentage: number }>;
  };
  comparison: {
    outperformance: number;
    outperformancePercentage: number;
    winner: 'LP' | 'HODL' | 'TIE';
    breakEvenDays?: number;
    lpAdvantages: string[];
    hodlAdvantages: string[];
  };
  timeline: {
    periodWhenLPWinning: number; // Percentage of time LP was winning
    bestLPPeriod: { start: string; end: string; outperformance: number };
    worstLPPeriod: { start: string; end: string; underperformance: number };
  };
}

const HodlComparison: React.FC<HodlComparisonProps> = ({
  positions,
  portfolioHistory,
  hodlHistory,
  className = ''
}) => {
  const analysis = useMemo((): AnalysisResult | null => {
    if (!positions.length || !portfolioHistory.length || !hodlHistory.length) {
      return null;
    }

    const latestPortfolio = portfolioHistory[portfolioHistory.length - 1];
    const latestHodl = hodlHistory[hodlHistory.length - 1];
    const initialPortfolio = portfolioHistory[0];
    const initialHodl = hodlHistory[0];

    // Calculate LP strategy metrics
    const totalFees = positions.reduce((sum, p) => sum + (p.feesEarned || 0), 0);
    const totalIL = positions.reduce((sum, p) => sum + (p.impermanentLoss || 0), 0);
    const lpCurrentValue = latestPortfolio.value;
    const lpInitialValue = initialPortfolio.value;
    const lpTotalReturn = lpCurrentValue - lpInitialValue;
    const lpNetROI = lpInitialValue > 0 ? (lpTotalReturn / lpInitialValue) * 100 : 0;

    // Calculate HODL strategy metrics  
    const hodlCurrentValue = latestHodl.value;
    const hodlInitialValue = initialHodl.value;
    const hodlTotalReturn = hodlCurrentValue - hodlInitialValue;
    const hodlROI = hodlInitialValue > 0 ? (hodlTotalReturn / hodlInitialValue) * 100 : 0;

    // Token allocation for HODL
    const tokenAllocation: Record<string, { amount: number; value: number; percentage: number }> = {};
    let totalTokenValue = 0;
    
    positions.forEach(position => {
      const token0 = position.tokens.token0;
      const token1 = position.tokens.token1;
      
      // Simplified token value calculation (using current position value as proxy)
      const token0Value = position.value * 0.5; // Assume 50/50 split for simplicity
      const token1Value = position.value * 0.5;
      
      if (!tokenAllocation[token0.symbol]) {
        tokenAllocation[token0.symbol] = { amount: 0, value: 0, percentage: 0 };
      }
      if (!tokenAllocation[token1.symbol]) {
        tokenAllocation[token1.symbol] = { amount: 0, value: 0, percentage: 0 };
      }
      
      tokenAllocation[token0.symbol].amount += token0.amount;
      tokenAllocation[token0.symbol].value += token0Value;
      tokenAllocation[token1.symbol].amount += token1.amount;
      tokenAllocation[token1.symbol].value += token1Value;
      
      totalTokenValue += token0Value + token1Value;
    });

    // Calculate percentages
    Object.keys(tokenAllocation).forEach(symbol => {
      tokenAllocation[symbol].percentage = totalTokenValue > 0 
        ? (tokenAllocation[symbol].value / totalTokenValue) * 100 
        : 0;
    });

    // Comparison metrics
    const outperformanceAbsolute = lpTotalReturn - hodlTotalReturn;
    const outperformancePercentage = lpNetROI - hodlROI;
    const winner = Math.abs(outperformanceAbsolute) < 100 ? 'TIE' : 
                   outperformanceAbsolute > 0 ? 'LP' : 'HODL';

    // Timeline analysis
    let lpWinningPeriods = 0;
    let bestOutperformance = -Infinity;
    let worstOutperformance = Infinity;
    let bestPeriod = { start: '', end: '', outperformance: 0 };
    let worstPeriod = { start: '', end: '', underperformance: 0 };

    portfolioHistory.forEach((portfolio, index) => {
      const hodl = hodlHistory[index];
      if (!hodl) return;

      const portfolioROI = initialPortfolio.value > 0 ? 
        ((portfolio.value - initialPortfolio.value) / initialPortfolio.value) * 100 : 0;
      const hodlROI = initialHodl.value > 0 ? 
        ((hodl.value - initialHodl.value) / initialHodl.value) * 100 : 0;
      const dailyOutperformance = portfolioROI - hodlROI;

      if (dailyOutperformance > 0) lpWinningPeriods++;
      
      if (dailyOutperformance > bestOutperformance) {
        bestOutperformance = dailyOutperformance;
        bestPeriod = {
          start: initialPortfolio.timestamp,
          end: portfolio.timestamp,
          outperformance: dailyOutperformance
        };
      }
      
      if (dailyOutperformance < worstOutperformance) {
        worstOutperformance = dailyOutperformance;
        worstPeriod = {
          start: initialPortfolio.timestamp,
          end: portfolio.timestamp,
          underperformance: Math.abs(dailyOutperformance)
        };
      }
    });

    const periodWhenLPWinning = portfolioHistory.length > 0 ? 
      (lpWinningPeriods / portfolioHistory.length) * 100 : 0;

    // LP Advantages vs HODL Advantages
    const lpAdvantages: string[] = [];
    const hodlAdvantages: string[] = [];

    if (totalFees > 0) lpAdvantages.push(`Earned $${totalFees.toFixed(0)} in fees`);
    if (lpNetROI > hodlROI) lpAdvantages.push(`${(lpNetROI - hodlROI).toFixed(2)}% outperformance`);
    if (periodWhenLPWinning > 50) lpAdvantages.push(`Outperformed ${periodWhenLPWinning.toFixed(0)}% of the time`);
    
    if (totalIL < 0) lpAdvantages.push(`Positive impermanent loss of ${Math.abs(totalIL).toFixed(2)}%`);
    else hodlAdvantages.push(`Avoided ${totalIL.toFixed(2)}% impermanent loss`);
    
    if (hodlROI > lpNetROI) hodlAdvantages.push(`${(hodlROI - lpNetROI).toFixed(2)}% outperformance`);
    hodlAdvantages.push('No active management required');
    hodlAdvantages.push('No smart contract risk');
    if (positions.some(p => !p.inRange)) hodlAdvantages.push('No range management needed');

    return {
      lpStrategy: {
        currentValue: lpCurrentValue,
        totalReturn: lpTotalReturn,
        fees: totalFees,
        impermanentLoss: totalIL,
        netROI: lpNetROI
      },
      hodlStrategy: {
        currentValue: hodlCurrentValue,
        totalReturn: hodlTotalReturn,
        roi: hodlROI,
        tokenAllocation
      },
      comparison: {
        outperformance: outperformanceAbsolute,
        outperformancePercentage,
        winner,
        lpAdvantages,
        hodlAdvantages
      },
      timeline: {
        periodWhenLPWinning,
        bestLPPeriod: bestPeriod,
        worstLPPeriod: worstPeriod
      }
    };
  }, [positions, portfolioHistory, hodlHistory]);

  if (!analysis) {
    return (
      <div className={`crypto-card border border-orange-500/30 p-6 ${className}`}>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No data available for comparison</p>
            <p className="text-sm">Scan positions to see LP vs HODL analysis</p>
          </div>
        </div>
      </div>
    );
  }

  const { lpStrategy, hodlStrategy, comparison, timeline } = analysis;

  return (
    <div className={`crypto-card border border-orange-500/30 p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 crypto-card rounded-lg border border-orange-500/20">
            <Target className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">LP vs HODL Analysis</h3>
            <p className="text-gray-400 text-sm">Strategy performance comparison</p>
          </div>
        </div>
        
        {/* Winner Badge */}
        <div className={`px-4 py-2 rounded-full border flex items-center space-x-2 ${
          comparison.winner === 'LP' 
            ? 'border-green-500/30 bg-green-500/10 text-green-400'
            : comparison.winner === 'HODL'
            ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
            : 'border-gray-500/30 bg-gray-500/10 text-gray-400'
        }`}>
          {comparison.winner === 'LP' ? (
            <CheckCircle className="w-4 h-4" />
          ) : comparison.winner === 'HODL' ? (
            <XCircle className="w-4 h-4" />
          ) : (
            <Info className="w-4 h-4" />
          )}
          <span className="font-medium">{comparison.winner} Wins</span>
        </div>
      </div>

      {/* Strategy Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LP Strategy */}
        <div className="crypto-card border border-green-500/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Coins className="w-5 h-5 text-green-400" />
              <h4 className="font-semibold text-white">LP Strategy</h4>
            </div>
            <div className={`text-lg font-bold ${
              lpStrategy.netROI > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {lpStrategy.netROI > 0 ? '+' : ''}{lpStrategy.netROI.toFixed(2)}%
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Current Value:</span>
              <span className="text-white font-medium">${lpStrategy.currentValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Return:</span>
              <span className={`font-medium ${
                lpStrategy.totalReturn > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {lpStrategy.totalReturn > 0 ? '+' : ''}${lpStrategy.totalReturn.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fees Earned:</span>
              <span className="text-green-400 font-medium">+${lpStrategy.fees.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Impermanent Loss:</span>
              <span className={`font-medium ${
                lpStrategy.impermanentLoss < 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {lpStrategy.impermanentLoss.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* LP Advantages */}
          {comparison.lpAdvantages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-xs text-gray-400 mb-2">Advantages:</div>
              <ul className="space-y-1">
                {comparison.lpAdvantages.map((advantage, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm">
                    <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                    <span className="text-gray-300">{advantage}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* HODL Strategy */}
        <div className="crypto-card border border-blue-500/20 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <h4 className="font-semibold text-white">HODL Strategy</h4>
            </div>
            <div className={`text-lg font-bold ${
              hodlStrategy.roi > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {hodlStrategy.roi > 0 ? '+' : ''}{hodlStrategy.roi.toFixed(2)}%
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Current Value:</span>
              <span className="text-white font-medium">${hodlStrategy.currentValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Return:</span>
              <span className={`font-medium ${
                hodlStrategy.totalReturn > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {hodlStrategy.totalReturn > 0 ? '+' : ''}${hodlStrategy.totalReturn.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Management:</span>
              <span className="text-green-400 font-medium">Passive</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Smart Contract Risk:</span>
              <span className="text-green-400 font-medium">None</span>
            </div>
          </div>

          {/* Token Allocation */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="text-xs text-gray-400 mb-2">Token Allocation:</div>
            <div className="space-y-2">
              {Object.entries(hodlStrategy.tokenAllocation).map(([symbol, data]) => (
                <div key={symbol} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{symbol}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium text-white">
                      ${data.value.toFixed(0)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {data.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* HODL Advantages */}
          {comparison.hodlAdvantages.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="text-xs text-gray-400 mb-2">Advantages:</div>
              <ul className="space-y-1">
                {comparison.hodlAdvantages.map((advantage, index) => (
                  <li key={index} className="flex items-center space-x-2 text-sm">
                    <CheckCircle className="w-3 h-3 text-blue-400 flex-shrink-0" />
                    <span className="text-gray-300">{advantage}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      <div className="crypto-card border border-purple-500/20 p-5">
        <h4 className="font-semibold text-white mb-4 flex items-center space-x-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <span>Performance Summary</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              comparison.outperformance > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {comparison.outperformance > 0 ? '+' : ''}${comparison.outperformance.toFixed(0)}
            </div>
            <div className="text-gray-400 text-sm">Absolute Difference</div>
          </div>

          <div className="text-center">
            <div className={`text-2xl font-bold ${
              comparison.outperformancePercentage > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {comparison.outperformancePercentage > 0 ? '+' : ''}{comparison.outperformancePercentage.toFixed(1)}%
            </div>
            <div className="text-gray-400 text-sm">Relative Difference</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-blue-400">
              {timeline.periodWhenLPWinning.toFixed(0)}%
            </div>
            <div className="text-gray-400 text-sm">Time LP Winning</div>
          </div>
        </div>

        {/* Insights */}
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-start space-x-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-300">
              {comparison.winner === 'LP' 
                ? `LP strategy outperformed HODL by $${Math.abs(comparison.outperformance).toFixed(0)} (${Math.abs(comparison.outperformancePercentage).toFixed(1)}%). The additional fees and active management paid off despite any impermanent loss.`
                : comparison.winner === 'HODL'
                ? `HODL strategy outperformed LP by $${Math.abs(comparison.outperformance).toFixed(0)} (${Math.abs(comparison.outperformancePercentage).toFixed(1)}%). The passive approach avoided impermanent loss and management complexity.`
                : `Both strategies performed similarly with less than $100 difference. Consider your risk tolerance and time commitment when choosing between them.`
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HodlComparison;