import React, { useState } from 'react';
import { MetricsCards, ProtocolDistribution, FilterPills } from './index';
import { DashboardMetrics, ProtocolDistribution as ProtocolDistributionData, ProtocolType, ChainType } from '../../types';

// Example data for demonstration
const exampleMetrics: DashboardMetrics = {
  totalValue: 125000.50,
  totalFeesEarned: 3247.82,
  avgApr: 12.45,
  activeProtocols: 5,
  inRangePositions: 8,
  outOfRangePositions: 2,
  totalYield24h: 2.1,
  totalYield7d: 8.3,
  totalYield30d: -1.2,
  totalImpermanentLoss: -456.78,
  
  // Advanced Performance Metrics
  totalROI: 15.2,
  hodlROI: 12.8,
  outperformance: 2.4,
  sharpeRatio: 1.35,
  maxDrawdown: -8.5,
  winRate: 75.0,
  volatility: 25.6,
  
  // Time-based metrics
  valueChange1h: 0.5,
  valueChange24h: -1.2,
  valueChange7d: 3.8,
  valueChange30d: 15.2,
  
  // Additional risk metrics
  riskLevel: 'medium' as 'low' | 'medium' | 'high',
  correlationETH: 0.75,
  correlationBTC: 0.45,
  beta: 1.2
};

const exampleDistribution: ProtocolDistributionData[] = [
  { name: 'Uniswap V3', value: 45000, color: '#FF007A', protocol: 'uniswap-v3', positions: 4 },
  { name: 'SushiSwap', value: 32000, color: '#0993EC', protocol: 'sushiswap', positions: 2 },
  { name: 'Curve', value: 28000, color: '#40E0D0', protocol: 'curve', positions: 3 },
  { name: 'Meteora DLMM', value: 20500, color: '#9945FF', protocol: 'meteora-dlmm', positions: 1 }
];

const availableProtocols: ProtocolType[] = [
  'uniswap-v3',
  'sushiswap', 
  'curve',
  'meteora-dlmm',
  'raydium-clmm'
];

const availableChains: ChainType[] = ['ethereum', 'solana'];

/**
 * Example component showing how to use the dashboard components together
 * This is for demonstration purposes and shows the glassmorphism design
 */
const DashboardExample: React.FC = () => {
  const [selectedProtocols, setSelectedProtocols] = useState<ProtocolType[]>([]);
  const [selectedChains, setSelectedChains] = useState<ChainType[]>([]);
  const [loading, setLoading] = useState(false);

  const handleProtocolToggle = (protocol: ProtocolType) => {
    setSelectedProtocols(prev => 
      prev.includes(protocol) 
        ? prev.filter(p => p !== protocol)
        : [...prev, protocol]
    );
  };

  const handleChainToggle = (chain: ChainType) => {
    setSelectedChains(prev => 
      prev.includes(chain)
        ? prev.filter(c => c !== chain)
        : [...prev, chain]
    );
  };

  const handleClearAll = () => {
    setSelectedProtocols([]);
    setSelectedChains([]);
  };

  const handleSelectAll = () => {
    setSelectedProtocols([...availableProtocols]);
  };

  // Simulate loading state
  const toggleLoading = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">
            LP Position Dashboard
          </h1>
          <p className="text-gray-300">
            Complete dashboard components with glassmorphism design
          </p>
          
          <button
            onClick={toggleLoading}
            className="mt-4 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-lg hover:bg-white/20 transition-all duration-200"
          >
            {loading ? 'Loading...' : 'Toggle Loading State'}
          </button>
        </div>

        {/* Metrics Cards */}
        <div className="mb-8">
          <MetricsCards 
            metrics={exampleMetrics}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Protocol Distribution Chart */}
          <ProtocolDistribution
            data={exampleDistribution}
            loading={loading}
            height={400}
            showLegend={true}
          />

          {/* Filter Pills */}
          <FilterPills
            availableProtocols={availableProtocols}
            selectedProtocols={selectedProtocols}
            onProtocolToggle={handleProtocolToggle}
            onClearAll={handleClearAll}
            onSelectAll={handleSelectAll}
            loading={loading}
            showChainFilter={true}
            availableChains={availableChains}
            selectedChains={selectedChains}
            onChainToggle={handleChainToggle}
          />
        </div>

        {/* Filter State Display */}
        <div className="bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Current Filter State</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-gray-300 mb-2">Selected Protocols:</p>
              <p className="text-white font-mono text-sm">
                {selectedProtocols.length > 0 ? selectedProtocols.join(', ') : 'None'}
              </p>
            </div>
            <div>
              <p className="text-gray-300 mb-2">Selected Chains:</p>
              <p className="text-white font-mono text-sm">
                {selectedChains.length > 0 ? selectedChains.join(', ') : 'None'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardExample;