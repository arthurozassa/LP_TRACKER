import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ProtocolDistribution as ProtocolDistributionData, ProtocolType } from '../../types';

interface ProtocolDistributionProps {
  data: ProtocolDistributionData[];
  loading?: boolean;
  height?: number;
  showLegend?: boolean;
}

// Protocol color mapping for consistent theming
const PROTOCOL_COLORS: Record<string, string> = {
  'uniswap-v2': '#FF007A',
  'uniswap-v3': '#FF007A',
  'sushiswap': '#0993EC',
  'curve': '#40E0D0',
  'balancer': '#1E1E1E',
  'meteora-dlmm': '#9945FF',
  'raydium-clmm': '#8C65F7',
  'orca-whirlpools': '#FFD512',
  'lifinity': '#00D4FF',
  'jupiter': '#FBA43A',
  'uniswap-v3-arbitrum': '#FF007A',
  'uniswap-v3-polygon': '#8247E5',
  'uniswap-v3-base': '#0052FF'
};

// Generate gradient colors based on protocol colors
const generateGradientColors = (baseColor: string, index: number): string => {
  // Convert hex to HSL and adjust lightness for variety
  const hue = (index * 137.508) % 360; // Golden angle approximation for good color distribution
  const saturation = 70 + (index * 5) % 30; // 70-100% saturation
  const lightness = 50 + (index * 10) % 30; // 50-80% lightness
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium mb-1">{data.name}</p>
        <p className="text-blue-400 text-sm">
          Value: {formatCurrency(data.value)}
        </p>
        <p className="text-green-400 text-sm">
          Positions: {data.positions}
        </p>
        <p className="text-gray-400 text-xs mt-1">
          {((data.value / payload[0].payload.total) * 100).toFixed(1)}% of total
        </p>
      </div>
    );
  }
  return null;
};

const CustomLegend = ({ payload }: any) => {
  if (!payload || payload.length === 0) return null;

  return (
    <div className="flex flex-wrap justify-center gap-2 sm:gap-3 lg:gap-4 mt-3 sm:mt-4">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center space-x-1 sm:space-x-2">
          <div 
            className="w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-300 text-xs sm:text-sm font-medium truncate max-w-[100px] sm:max-w-none">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const LoadingSkeleton: React.FC<{ height: number }> = ({ height }) => (
  <div className="relative bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl border border-white/20 p-4 sm:p-6 shadow-lg">
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg sm:rounded-xl pointer-events-none" />
    
    <div className="relative z-10">
      <div className="h-5 w-32 sm:h-6 sm:w-48 bg-white/20 rounded mb-3 sm:mb-4 animate-pulse" />
      
      <div className="flex items-center justify-center" style={{ height: height - 60 }}>
        <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full bg-white/10 animate-pulse flex items-center justify-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 rounded-full bg-white/5" />
        </div>
      </div>
      
      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-3 sm:mt-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center space-x-1 sm:space-x-2">
            <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-white/20 animate-pulse" />
            <div className="h-3 w-16 sm:h-4 sm:w-20 bg-white/20 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ProtocolDistribution: React.FC<ProtocolDistributionProps> = ({
  data,
  loading = false,
  height = 400,
  showLegend = true
}) => {
  if (loading) {
    return <LoadingSkeleton height={height} />;
  }

  if (!data || data.length === 0) {
    return (
      <div className="relative bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6 shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-xl pointer-events-none" />
        
        <div className="relative z-10">
          <h3 className="text-lg font-semibold text-white mb-4">
            Protocol Distribution
          </h3>
          
          <div className="flex items-center justify-center" style={{ height: height - 80 }}>
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/10" />
              </div>
              <p className="text-gray-400">No positions found</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate total for percentage calculations
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Prepare data with colors and total
  const chartData = data.map((item, index) => ({
    ...item,
    color: PROTOCOL_COLORS[item.protocol] || generateGradientColors(PROTOCOL_COLORS[item.protocol], index),
    total
  }));

  return (
    <div className="relative group">
      <div className="relative bg-white/10 backdrop-blur-md rounded-lg sm:rounded-xl border border-white/20 p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/15">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-lg sm:rounded-xl pointer-events-none" />
        
        <div className="relative z-10">
          <h3 className="text-base sm:text-lg font-semibold text-white mb-3 sm:mb-4">
            Protocol Distribution
          </h3>
          
          <ResponsiveContainer width="100%" height={height - 60}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius={Math.min(60, (height - 120) / 3)}
                innerRadius={Math.min(30, (height - 120) / 6)}
                paddingAngle={2}
                dataKey="value"
                animationBegin={0}
                animationDuration={1000}
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color}
                    className="hover:opacity-80 transition-opacity duration-200"
                  />
                ))}
              </Pie>
              
              <Tooltip content={<CustomTooltip />} />
              
              {showLegend && (
                <Legend content={<CustomLegend />} />
              )}
            </PieChart>
          </ResponsiveContainer>
          
          {/* Summary stats */}
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-white/10">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="text-center">
                <p className="text-gray-400">Total Value</p>
                <p className="text-white font-semibold">{formatCurrency(total)}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400">Protocols</p>
                <p className="text-white font-semibold">{data.length}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Hover glow effect */}
        <div className="absolute inset-0 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/10 group-hover:to-pink-500/10 transition-all duration-300 pointer-events-none" />
      </div>
    </div>
  );
};

export default ProtocolDistribution;