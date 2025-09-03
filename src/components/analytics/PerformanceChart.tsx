'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Legend
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target, 
  AlertTriangle,
  BarChart3,
  Calendar,
  Percent
} from 'lucide-react';
import { TimeSeriesDataPoint, HodlComparison, PerformanceMetrics } from '../../types';

interface PerformanceChartProps {
  portfolioData: TimeSeriesDataPoint[];
  hodlData?: TimeSeriesDataPoint[];
  benchmarkData?: Record<string, TimeSeriesDataPoint[]>;
  className?: string;
  height?: number;
  showComparison?: boolean;
  showBenchmarks?: boolean;
}

type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';
type ChartType = 'line' | 'area' | 'comparison';
type MetricType = 'value' | 'roi' | 'apr' | 'fees' | 'il';

const TIME_RANGES: Record<TimeRange, { label: string; days: number }> = {
  '24h': { label: '24H', days: 1 },
  '7d': { label: '7D', days: 7 },
  '30d': { label: '30D', days: 30 },
  '90d': { label: '90D', days: 90 },
  '1y': { label: '1Y', days: 365 },
  'all': { label: 'All', days: 0 }
};

const METRIC_CONFIG = {
  value: { 
    label: 'Portfolio Value', 
    key: 'value', 
    color: '#F54B00', 
    format: (v: number) => `$${(v / 1000).toFixed(1)}K`,
    icon: <TrendingUp className="w-4 h-4" />
  },
  roi: { 
    label: 'ROI %', 
    key: 'roi', 
    color: '#00FF88', 
    format: (v: number) => `${v.toFixed(2)}%`,
    icon: <Percent className="w-4 h-4" />
  },
  apr: { 
    label: 'APR %', 
    key: 'apr', 
    color: '#00D4FF', 
    format: (v: number) => `${v.toFixed(2)}%`,
    icon: <Activity className="w-4 h-4" />
  },
  fees: { 
    label: 'Fees Earned', 
    key: 'fees', 
    color: '#FFD700', 
    format: (v: number) => `$${v.toFixed(0)}`,
    icon: <Target className="w-4 h-4" />
  },
  il: { 
    label: 'Impermanent Loss', 
    key: 'impermanentLoss', 
    color: '#FF3366', 
    format: (v: number) => `${v.toFixed(2)}%`,
    icon: <AlertTriangle className="w-4 h-4" />
  }
};

const PerformanceChart: React.FC<PerformanceChartProps> = ({
  portfolioData,
  hodlData,
  benchmarkData,
  className = '',
  height = 400,
  showComparison = true,
  showBenchmarks = false
}) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('value');
  const [isLoading, setIsLoading] = useState(false);

  // Filter data based on selected time range
  const filteredData = useMemo(() => {
    if (!portfolioData.length) return [];
    
    const range = TIME_RANGES[timeRange];
    if (range.days === 0) return portfolioData;
    
    const cutoffDate = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000);
    return portfolioData.filter(point => 
      new Date(point.timestamp) >= cutoffDate
    );
  }, [portfolioData, timeRange]);

  // Prepare chart data with all metrics
  const chartData = useMemo(() => {
    if (!filteredData.length) return [];
    
    const initialValue = filteredData[0]?.value || 0;
    
    return filteredData.map((point, index) => {
      const roi = initialValue > 0 ? ((point.value - initialValue) / initialValue) * 100 : 0;
      const hodlPoint = hodlData?.[index];
      const hodlROI = hodlPoint && initialValue > 0 ? ((hodlPoint.value - initialValue) / initialValue) * 100 : 0;
      
      return {
        timestamp: point.timestamp,
        date: new Date(point.timestamp).toLocaleDateString(),
        time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        
        // Portfolio metrics
        value: point.value,
        roi: roi,
        apr: point.apr || 0,
        fees: point.fees || 0,
        impermanentLoss: point.impermanentLoss || 0,
        
        // HODL comparison
        hodlValue: hodlPoint?.value || 0,
        hodlROI: hodlROI,
        outperformance: roi - hodlROI,
        
        // Benchmarks (if available)
        ethPrice: benchmarkData?.eth?.[index]?.value || 0,
        btcPrice: benchmarkData?.btc?.[index]?.value || 0,
        solPrice: benchmarkData?.sol?.[index]?.value || 0,
      };
    });
  }, [filteredData, hodlData, benchmarkData]);

  // Calculate performance summary
  const performanceMetrics = useMemo(() => {
    if (!chartData.length) return null;
    
    const latest = chartData[chartData.length - 1];
    const first = chartData[0];
    
    const totalReturn = latest.roi;
    const hodlReturn = latest.hodlROI;
    const outperformance = latest.outperformance;
    
    const maxValue = Math.max(...chartData.map(d => d.value));
    const maxROI = Math.max(...chartData.map(d => d.roi));
    const minROI = Math.min(...chartData.map(d => d.roi));
    const maxDrawdown = maxROI - minROI;
    
    return {
      totalReturn: totalReturn,
      hodlReturn: hodlReturn,
      outperformance: outperformance,
      maxDrawdown: maxDrawdown,
      currentValue: latest.value,
      totalFees: latest.fees,
      avgAPR: chartData.reduce((sum, d) => sum + d.apr, 0) / chartData.length,
      sharpeRatio: totalReturn / Math.sqrt(maxDrawdown || 1), // Simplified Sharpe ratio
    };
  }, [chartData]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    
    return (
      <div className="crypto-card border border-orange-500/30 p-4 shadow-xl">
        <div className="text-white font-medium mb-2">
          {timeRange === '24h' ? data.time : data.date}
        </div>
        
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-gray-300 text-sm">{entry.name}</span>
              </div>
              <span className="text-white font-medium">
                {METRIC_CONFIG[selectedMetric]?.format(entry.value) || entry.value}
              </span>
            </div>
          ))}
        </div>

        {showComparison && data.hodlValue > 0 && (
          <>
            <div className="border-t border-white/10 mt-2 pt-2">
              <div className="text-xs text-gray-400 mb-1">vs HODL</div>
              <div className={`text-sm font-medium ${
                data.outperformance > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {data.outperformance > 0 ? '+' : ''}{data.outperformance.toFixed(2)}%
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const metric = METRIC_CONFIG[selectedMetric];

  return (
    <div className={`crypto-card border border-orange-500/30 p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-6 space-y-4 lg:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 crypto-card rounded-lg border border-orange-500/20">
            <BarChart3 className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Performance Analytics</h3>
            <p className="text-gray-400 text-sm">Advanced portfolio tracking & comparison</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center space-x-2 gap-2">
          {/* Time Range Selector */}
          <div className="flex bg-black/20 rounded-lg p-1">
            {Object.entries(TIME_RANGES).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setTimeRange(key as TimeRange)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                  timeRange === key
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {config.label}
              </button>
            ))}
          </div>

          {/* Metric Selector */}
          <div className="flex bg-black/20 rounded-lg p-1">
            {Object.entries(METRIC_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedMetric(key as MetricType)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 flex items-center space-x-1 ${
                  selectedMetric === key
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={config.label}
              >
                {config.icon}
                <span className="hidden sm:inline">{config.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Summary */}
      {performanceMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="crypto-card border border-green-500/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-green-400 text-lg font-bold">
                  {performanceMetrics.totalReturn > 0 ? '+' : ''}
                  {performanceMetrics.totalReturn.toFixed(2)}%
                </div>
                <div className="text-gray-400 text-xs">LP Return</div>
              </div>
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
          </div>

          {showComparison && (
            <div className="crypto-card border border-blue-500/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-lg font-bold ${
                    performanceMetrics.outperformance > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {performanceMetrics.outperformance > 0 ? '+' : ''}
                    {performanceMetrics.outperformance.toFixed(2)}%
                  </div>
                  <div className="text-gray-400 text-xs">vs HODL</div>
                </div>
                <Target className="w-4 h-4 text-blue-400" />
              </div>
            </div>
          )}

          <div className="crypto-card border border-purple-500/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-purple-400 text-lg font-bold">
                  {performanceMetrics.sharpeRatio.toFixed(2)}
                </div>
                <div className="text-gray-400 text-xs">Sharpe Ratio</div>
              </div>
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
          </div>

          <div className="crypto-card border border-red-500/20 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-red-400 text-lg font-bold">
                  -{performanceMetrics.maxDrawdown.toFixed(2)}%
                </div>
                <div className="text-gray-400 text-xs">Max Drawdown</div>
              </div>
              <TrendingDown className="w-4 h-4 text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="relative" style={{ height: `${height}px` }}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metric.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={metric.color} stopOpacity={0.01}/>
                  </linearGradient>
                  {showComparison && (
                    <linearGradient id="hodlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.01}/>
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={metric.format}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={2}
                  fill="url(#portfolioGradient)"
                  name="LP Strategy"
                />
                {showComparison && hodlData && (
                  <Area
                    type="monotone"
                    dataKey={selectedMetric === 'value' ? 'hodlValue' : 'hodlROI'}
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    fill="url(#hodlGradient)"
                    name="HODL Strategy"
                  />
                )}
                {selectedMetric === 'roi' && (
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
                )}
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={metric.format}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey={metric.key}
                  stroke={metric.color}
                  strokeWidth={3}
                  dot={false}
                  name="LP Strategy"
                />
                {showComparison && hodlData && (
                  <Line
                    type="monotone"
                    dataKey={selectedMetric === 'value' ? 'hodlValue' : 'hodlROI'}
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="HODL Strategy"
                  />
                )}
                {selectedMetric === 'roi' && (
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="2 2" />
                )}
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
            <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
            <p>No data available</p>
            <p className="text-sm">Connect wallet and scan positions to see analytics</p>
          </div>
        )}
      </div>

      {/* Chart Type Toggle */}
      <div className="flex justify-center mt-4">
        <div className="flex bg-black/20 rounded-lg p-1">
          <button
            onClick={() => setChartType('line')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
              chartType === 'line'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType('area')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
              chartType === 'area'
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Area
          </button>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;