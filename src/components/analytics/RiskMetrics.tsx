'use client';

import React, { useMemo } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  TrendingDown, 
  Activity, 
  Target, 
  Zap,
  BarChart3,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { RiskMetrics as RiskMetricsType, TimeSeriesDataPoint, PerformanceMetrics } from '../../types';

interface RiskMetricsProps {
  portfolioHistory: TimeSeriesDataPoint[];
  benchmarkHistory?: TimeSeriesDataPoint[];
  positions: any[];
  className?: string;
}

interface RiskCalculation extends RiskMetricsType {
  performanceMetrics: PerformanceMetrics;
  riskScore: number; // 0-100
  riskCategory: 'Conservative' | 'Moderate' | 'Aggressive' | 'Extreme';
  recommendations: string[];
}

const RiskMetrics: React.FC<RiskMetricsProps> = ({
  portfolioHistory,
  benchmarkHistory,
  positions,
  className = ''
}) => {
  const riskAnalysis = useMemo((): RiskCalculation | null => {
    if (!portfolioHistory.length || portfolioHistory.length < 7) {
      return null;
    }

    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < portfolioHistory.length; i++) {
      const currentValue = portfolioHistory[i].value;
      const previousValue = portfolioHistory[i - 1].value;
      if (previousValue > 0) {
        const dailyReturn = (currentValue - previousValue) / previousValue;
        returns.push(dailyReturn);
      }
    }

    if (returns.length === 0) return null;

    // Basic statistics
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365); // Annualized volatility
    const standardDeviation = Math.sqrt(variance);

    // Risk metrics calculations
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const var95Index = Math.floor(returns.length * 0.05);
    const var99Index = Math.floor(returns.length * 0.01);
    
    const var95 = sortedReturns[var95Index] || 0;
    const var99 = sortedReturns[var99Index] || 0;

    // Expected Shortfall (Conditional VaR)
    const tailLosses95 = sortedReturns.slice(0, var95Index + 1);
    const expectedShortfall = tailLosses95.length > 0 
      ? tailLosses95.reduce((sum, ret) => sum + ret, 0) / tailLosses95.length 
      : 0;

    // Downside deviation (only negative returns)
    const negativeReturns = returns.filter(ret => ret < 0);
    const downsideVariance = negativeReturns.length > 0 
      ? negativeReturns.reduce((sum, ret) => sum + ret * ret, 0) / negativeReturns.length 
      : 0;
    const downsideDeviation = Math.sqrt(downsideVariance);

    // Sortino ratio (return vs downside risk)
    const annualizedReturn = meanReturn * 365;
    const annualizedDownsideDeviation = downsideDeviation * Math.sqrt(365);
    const sortinoRatio = annualizedDownsideDeviation > 0 
      ? annualizedReturn / annualizedDownsideDeviation 
      : 0;

    // Maximum Drawdown
    let peak = portfolioHistory[0].value;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    
    portfolioHistory.forEach(point => {
      if (point.value > peak) {
        peak = point.value;
      } else {
        currentDrawdown = (peak - point.value) / peak;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    });

    // Sharpe Ratio (simplified, assuming 0% risk-free rate)
    const sharpeRatio = volatility > 0 ? annualizedReturn / volatility : 0;

    // Beta calculation (vs benchmark if available)
    let beta = 1;
    let alpha = 0;
    let correlation = 0;
    
    if (benchmarkHistory && benchmarkHistory.length === portfolioHistory.length) {
      const benchmarkReturns: number[] = [];
      for (let i = 1; i < benchmarkHistory.length; i++) {
        const currentValue = benchmarkHistory[i].value;
        const previousValue = benchmarkHistory[i - 1].value;
        if (previousValue > 0) {
          benchmarkReturns.push((currentValue - previousValue) / previousValue);
        }
      }

      if (benchmarkReturns.length === returns.length) {
        // Calculate correlation
        const benchmarkMean = benchmarkReturns.reduce((sum, ret) => sum + ret, 0) / benchmarkReturns.length;
        let numerator = 0;
        let sumPortfolioSq = 0;
        let sumBenchmarkSq = 0;

        for (let i = 0; i < returns.length; i++) {
          const portfolioDiff = returns[i] - meanReturn;
          const benchmarkDiff = benchmarkReturns[i] - benchmarkMean;
          numerator += portfolioDiff * benchmarkDiff;
          sumPortfolioSq += portfolioDiff * portfolioDiff;
          sumBenchmarkSq += benchmarkDiff * benchmarkDiff;
        }

        correlation = Math.sqrt(sumPortfolioSq * sumBenchmarkSq) > 0 
          ? numerator / Math.sqrt(sumPortfolioSq * sumBenchmarkSq) 
          : 0;

        // Beta calculation
        const benchmarkVariance = sumBenchmarkSq / benchmarkReturns.length;
        const covariance = numerator / returns.length;
        beta = benchmarkVariance > 0 ? covariance / benchmarkVariance : 1;

        // Alpha (Jensen's Alpha)
        const benchmarkAnnualizedReturn = benchmarkMean * 365;
        alpha = annualizedReturn - (beta * benchmarkAnnualizedReturn);
      }
    }

    // Risk level determination
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    let riskScore = 0;

    // Calculate risk score (0-100)
    const volatilityScore = Math.min(volatility * 100, 40); // Max 40 points
    const maxDrawdownScore = Math.min(maxDrawdown * 50, 30); // Max 30 points  
    const varScore = Math.min(Math.abs(var95) * 100, 20); // Max 20 points
    const concentrationScore = positions.length < 3 ? 10 : 0; // Max 10 points

    riskScore = volatilityScore + maxDrawdownScore + varScore + concentrationScore;

    if (riskScore < 25) {
      riskLevel = 'low';
    } else if (riskScore < 50) {
      riskLevel = 'medium';
    } else if (riskScore < 75) {
      riskLevel = 'high';
    } else {
      riskLevel = 'extreme';
    }

    // Risk category
    let riskCategory: 'Conservative' | 'Moderate' | 'Aggressive' | 'Extreme';
    if (volatility < 0.2 && maxDrawdown < 0.1) {
      riskCategory = 'Conservative';
    } else if (volatility < 0.4 && maxDrawdown < 0.2) {
      riskCategory = 'Moderate';
    } else if (volatility < 0.8 && maxDrawdown < 0.4) {
      riskCategory = 'Aggressive';
    } else {
      riskCategory = 'Extreme';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (maxDrawdown > 0.3) {
      recommendations.push('Consider position sizing - maximum drawdown exceeds 30%');
    }
    if (volatility > 0.6) {
      recommendations.push('High volatility detected - consider diversification');
    }
    if (sortinoRatio < 1) {
      recommendations.push('Low risk-adjusted returns - review yield strategies');
    }
    if (positions.length < 3) {
      recommendations.push('Limited diversification - consider spreading across more protocols');
    }
    if (Math.abs(var95) > 0.05) {
      recommendations.push('Potential for significant daily losses - monitor position sizes');
    }
    if (beta > 1.5) {
      recommendations.push('Portfolio highly sensitive to market movements');
    }

    if (recommendations.length === 0) {
      recommendations.push('Portfolio shows balanced risk profile');
    }

    return {
      var95: var95 * 100,
      var99: var99 * 100,
      expectedShortfall: expectedShortfall * 100,
      downsideDeviation: downsideDeviation * 100,
      sortinoRatio,
      riskLevel,
      performanceMetrics: {
        roi: annualizedReturn * 100,
        apr: annualizedReturn * 100,
        sharpeRatio,
        maxDrawdown: maxDrawdown * 100,
        volatility: volatility * 100,
        beta,
        alpha: alpha * 100,
        winRate: (returns.filter(r => r > 0).length / returns.length) * 100,
        profitFactor: 0, // Would need more data
        calmarRatio: maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0
      },
      riskScore,
      riskCategory,
      recommendations
    };
  }, [portfolioHistory, benchmarkHistory, positions]);

  if (!riskAnalysis) {
    return (
      <div className={`crypto-card border border-orange-500/30 p-6 ${className}`}>
        <div className="flex items-center justify-center h-48 text-gray-400">
          <div className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Insufficient data for risk analysis</p>
            <p className="text-sm">Need at least 7 days of portfolio history</p>
          </div>
        </div>
      </div>
    );
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'medium': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'high': return 'text-red-400 border-red-500/30 bg-red-500/10';
      case 'extreme': return 'text-red-500 border-red-600/30 bg-red-600/10';
      default: return 'text-gray-400 border-gray-500/30 bg-gray-500/10';
    }
  };

  const getRiskIcon = () => {
    switch (riskAnalysis.riskLevel) {
      case 'low': return <Shield className="w-5 h-5" />;
      case 'medium': return <Activity className="w-5 h-5" />;
      case 'high': return <AlertTriangle className="w-5 h-5" />;
      case 'extreme': return <Zap className="w-5 h-5" />;
      default: return <Shield className="w-5 h-5" />;
    }
  };

  return (
    <div className={`crypto-card border border-orange-500/30 p-6 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 crypto-card rounded-lg border border-orange-500/20">
            <Shield className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Risk Analysis</h3>
            <p className="text-gray-400 text-sm">Advanced risk metrics & assessment</p>
          </div>
        </div>

        {/* Risk Level Badge */}
        <div className={`px-4 py-2 rounded-full border flex items-center space-x-2 ${getRiskLevelColor(riskAnalysis.riskLevel)}`}>
          {getRiskIcon()}
          <span className="font-medium capitalize">{riskAnalysis.riskLevel} Risk</span>
        </div>
      </div>

      {/* Risk Score */}
      <div className="crypto-card border border-purple-500/20 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-white">Risk Score</h4>
          <div className="text-right">
            <div className="text-2xl font-bold text-purple-400">
              {riskAnalysis.riskScore.toFixed(0)}/100
            </div>
            <div className="text-sm text-gray-400">{riskAnalysis.riskCategory}</div>
          </div>
        </div>
        
        <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
          <div 
            className={`h-2 rounded-full ${
              riskAnalysis.riskScore < 25 ? 'bg-green-500' :
              riskAnalysis.riskScore < 50 ? 'bg-yellow-500' :
              riskAnalysis.riskScore < 75 ? 'bg-red-500' : 'bg-red-600'
            }`}
            style={{ width: `${Math.min(riskAnalysis.riskScore, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-gray-400">
          <span>Conservative</span>
          <span>Moderate</span>
          <span>Aggressive</span>
          <span>Extreme</span>
        </div>
      </div>

      {/* Risk Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Value at Risk */}
        <div className="crypto-card border border-red-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              <span className="text-sm text-gray-400">VaR (95%)</span>
            </div>
            <Info className="w-3 h-3 text-gray-500" />
          </div>
          <div className="text-lg font-bold text-red-400">
            {riskAnalysis.var95.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Daily loss risk</div>
        </div>

        {/* Maximum Drawdown */}
        <div className="crypto-card border border-orange-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-gray-400">Max Drawdown</span>
            </div>
          </div>
          <div className="text-lg font-bold text-orange-400">
            -{riskAnalysis.performanceMetrics.maxDrawdown.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">Peak to valley</div>
        </div>

        {/* Volatility */}
        <div className="crypto-card border border-blue-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-gray-400">Volatility</span>
            </div>
          </div>
          <div className="text-lg font-bold text-blue-400">
            {riskAnalysis.performanceMetrics.volatility.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">Annualized</div>
        </div>

        {/* Sharpe Ratio */}
        <div className="crypto-card border border-green-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-sm text-gray-400">Sharpe Ratio</span>
            </div>
          </div>
          <div className="text-lg font-bold text-green-400">
            {riskAnalysis.performanceMetrics.sharpeRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Risk-adj return</div>
        </div>

        {/* Sortino Ratio */}
        <div className="crypto-card border border-cyan-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <TrendingDown className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-400">Sortino Ratio</span>
            </div>
          </div>
          <div className="text-lg font-bold text-cyan-400">
            {riskAnalysis.sortinoRatio.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Downside risk</div>
        </div>

        {/* Beta */}
        <div className="crypto-card border border-purple-500/20 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-gray-400">Beta</span>
            </div>
          </div>
          <div className="text-lg font-bold text-purple-400">
            {riskAnalysis.performanceMetrics.beta.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">Market sensitivity</div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="crypto-card border border-blue-500/20 p-5">
        <h4 className="font-semibold text-white mb-4 flex items-center space-x-2">
          <Info className="w-4 h-4 text-blue-400" />
          <span>Risk Management Recommendations</span>
        </h4>
        
        <div className="space-y-3">
          {riskAnalysis.recommendations.map((recommendation, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className={`p-1 rounded-full ${
                recommendation.includes('consider') || recommendation.includes('review') 
                  ? 'bg-yellow-500/20' : 'bg-green-500/20'
              }`}>
                {recommendation.includes('consider') || recommendation.includes('review') ? (
                  <AlertTriangle className="w-3 h-3 text-yellow-400" />
                ) : (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                )}
              </div>
              <span className="text-gray-300 text-sm flex-1">{recommendation}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RiskMetrics;