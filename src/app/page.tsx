'use client';

import React, { useState, useCallback } from 'react';
import { Network, Search, Wallet, Loader2, BarChart3, TrendingUp } from 'lucide-react';
import MetricsCards from '../components/dashboard/MetricsCards';
import ProtocolCard from '../components/dashboard/ProtocolCard';
import PositionCard from '../components/dashboard/PositionCard';
import { 
  PerformanceChart, 
  HodlComparison, 
  RiskMetrics, 
  YieldOptimizer, 
  SmartAlerts 
} from '../components/analytics';
import { ScanResults, ChainType, LoadingState, DashboardMetrics, ProtocolDistribution } from '../types';
import { getMockDataByAddress } from '../demo';
import { historicalDataService } from '../services/historicalData';
import { detectChainType, isEthereumAddress, isSolanaAddress } from '../types';
import { useMode } from '../contexts/ModeContext';
import { getProductionScanner } from '../services/productionScanner';
import ModeToggle from '../components/ui/ModeToggle';

// Demo addresses
const DEMO_ADDRESSES = [
  {
    label: 'Ethereum Whale',
    address: '0x742d35Cc6634C0532925a3b8D9e7b21b5F96a91c',
    chain: 'ethereum' as ChainType,
    description: 'Large Uniswap positions'
  },
  {
    label: 'Solana Whale', 
    address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
    chain: 'solana' as ChainType,
    description: 'Multi-DEX trader'
  },
  {
    label: 'Jupiter Trader',
    address: 'CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq',
    chain: 'solana' as ChainType,
    description: 'Active LP provider'
  }
];

// Simple SearchBar component
const SimpleSearchBar: React.FC<{
  onScan: (address: string, chain: ChainType) => void;
  isLoading: boolean;
  isDemo: boolean;
}> = ({ onScan, isLoading, isDemo }) => {
  const [address, setAddress] = useState('');
  const [detectedChain, setDetectedChain] = useState<ChainType | null>(null);
  const [error, setError] = useState('');

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setAddress(value);
    
    if (value) {
      const chain = detectChainType(value);
      setDetectedChain(chain);
      setError(chain ? '' : 'Invalid address format');
    } else {
      setDetectedChain(null);
      setError('');
    }
  };

  const handleScan = () => {
    if (!detectedChain) {
      setError('Please enter a valid address');
      return;
    }
    onScan(address.trim(), detectedChain);
  };

  const handleDemoClick = (demo: typeof DEMO_ADDRESSES[0]) => {
    setAddress(demo.address);
    setDetectedChain(demo.chain);
    setError('');
  };

  const formatAddress = (addr: string) => {
    if (addr.length <= 14) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Main Search Input */}
      <div className="tt-card tt-card-hover p-6">
        <div className="flex flex-col space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Wallet className="h-5 w-5 tt-text-tertiary" />
            </div>
            <input
              type="text"
              value={address}
              onChange={handleAddressChange}
              placeholder="Enter wallet address..."
              className="w-full pl-12 pr-4 py-3 bg-white/[0.05] border border-white/[0.08] rounded-md tt-text-primary placeholder:tt-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all duration-200"
              disabled={isLoading}
            />
          </div>

          {/* Chain Detection */}
          {address && (
            <div className="flex items-center space-x-2">
              {detectedChain ? (
                <div className="flex items-center space-x-2 tt-status-positive">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium capitalize">
                    {detectedChain} address detected
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 tt-status-negative">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm">Invalid address format</span>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="tt-status-negative text-sm">{error}</div>
          )}

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={isLoading || !detectedChain || !!error}
            className="w-full tt-button-primary disabled:opacity-50 disabled:cursor-not-allowed py-3 px-6 rounded-md transition-all duration-200 flex items-center justify-center space-x-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Scanning All DEXs...</span>
              </>
            ) : (
              <>
                <Search className="h-5 w-5" />
                <span>Scan All DEXs</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Demo Addresses - Only show in demo mode */}
      {isDemo && (
        <div className="tt-card p-6">
          <h3 className="tt-heading-3 mb-4">Try Demo Addresses</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DEMO_ADDRESSES.map((demo, index) => (
              <button
                key={index}
                onClick={() => handleDemoClick(demo)}
                disabled={isLoading}
                className="p-4 tt-card tt-card-hover transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="tt-text-primary font-medium text-sm">{demo.label}</div>
                <div className="tt-text-secondary text-xs mt-1">{demo.description}</div>
                <div className="tt-text-tertiary text-xs font-mono mt-1 break-all">
                  {formatAddress(demo.address)}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Production Mode Info */}
      {!isDemo && (
        <div className="tt-card p-6">
          <h3 className="tt-heading-3 mb-4">Production Mode</h3>
          <div className="tt-text-secondary text-sm">
            Enter any wallet address to scan for live LP positions across supported protocols.
            Data is fetched from real-time sources and may take longer to load.
          </div>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  const { mode, isDemo, isProduction, isTransitioning, dataSource, isHydrated } = useMode();
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isScanning: false,
    completedProtocols: [],
    failedProtocols: [],
    progress: 0
  });
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Advanced analytics data
  const [portfolioHistory, setPortfolioHistory] = useState<any[]>([]);
  const [hodlHistory, setHodlHistory] = useState<any[]>([]);
  const [marketBenchmarks, setMarketBenchmarks] = useState<any[]>([]);
  const [showAdvancedAnalytics, setShowAdvancedAnalytics] = useState(false);

  const calculateMetrics = (results: ScanResults): DashboardMetrics => {
    const positions = Object.values(results.protocols).flatMap(p => p.positions || []);
    const inRangePositions = positions.filter(p => p.inRange).length;
    const activeProtocols = Object.keys(results.protocols).length;
    const profitablePositions = positions.filter(p => (p.feesEarned || 0) > 0).length;

    return {
      totalValue: results.totalValue,
      totalFeesEarned: results.totalFeesEarned || positions.reduce((sum, p) => sum + (p.feesEarned || 0), 0),
      avgApr: results.avgApr || positions.reduce((sum, p) => sum + (p.apr || 0), 0) / positions.length || 0,
      activeProtocols,
      inRangePositions,
      outOfRangePositions: positions.length - inRangePositions,
      totalYield24h: 0,
      totalYield7d: 0,
      totalYield30d: 0,
      totalImpermanentLoss: 0,
      
      // Advanced Performance Metrics (mock values for now)
      totalROI: 15.2, // Mock 15.2% ROI
      hodlROI: 12.8, // Mock 12.8% HODL ROI
      outperformance: 2.4, // LP outperforming HODL by 2.4%
      sharpeRatio: 1.35, // Mock Sharpe ratio
      maxDrawdown: -8.5, // Mock max drawdown
      winRate: profitablePositions / positions.length * 100 || 0,
      volatility: 25.6, // Mock annualized volatility
      
      // Time-based metrics (mock values)
      valueChange1h: 0.5,
      valueChange24h: -1.2,
      valueChange7d: 3.8,
      valueChange30d: 15.2,
      
      // Additional risk metrics
      riskLevel: 'medium' as 'low' | 'medium' | 'high',
      correlationETH: 0.75, // Mock correlation with ETH
      correlationBTC: 0.45, // Mock correlation with BTC
      beta: 1.2 // Mock beta (market sensitivity)
    };
  };

  const getProtocolDistribution = (results: ScanResults): ProtocolDistribution[] => {
    return Object.entries(results.protocols).map(([name, data]) => ({
      name,
      protocol: name as any,
      value: data.positions?.reduce((sum, p) => sum + p.value, 0) || 0,
      positions: data.positions?.length || 0,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    }));
  };

  // Generate mock historical data for development
  const generateMockPortfolioHistory = useCallback(() => {
    const days = 30;
    const history = [];
    const baseValue = scanResults?.totalValue || 100000;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      const volatility = 0.03; // 3% daily volatility
      const trend = i * 0.001; // Small upward trend
      const randomChange = (Math.random() - 0.5) * 2 * volatility;
      const value = baseValue * (1 + trend + randomChange);
      
      history.push({
        timestamp: date.toISOString(),
        value: value,
        fees: (scanResults?.totalFeesEarned || 0) * (i / days),
        apr: 15 + Math.sin(i * 0.1) * 5, // Varying APR
        impermanentLoss: Math.random() * 2 - 1
      });
    }
    
    return history;
  }, [scanResults?.totalValue, scanResults?.totalFeesEarned]);

  const generateMockHodlHistory = useCallback(() => {
    const days = 30;
    const history = [];
    const baseValue = scanResults?.totalValue || 100000;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      // HODL follows market more closely
      const marketChange = Math.sin(i * 0.15) * 0.02 + i * 0.0005;
      const value = baseValue * (1 + marketChange);
      
      history.push({
        timestamp: date.toISOString(),
        value: value,
        hodlValue: value
      });
    }
    
    return history;
  }, [scanResults?.totalValue]);

  // Load advanced analytics data
  const loadAdvancedAnalytics = useCallback(async (results: ScanResults) => {
    try {
      const positions = Object.values(results.protocols).flatMap(p => p.positions || []);
      
      // Calculate portfolio history (30 days)
      const portfolioData = await historicalDataService.calculatePortfolioHistory(positions, 30);
      setPortfolioHistory(portfolioData);
      
      // Calculate HODL comparison
      const hodlData = await historicalDataService.calculateHodlComparison(positions, 30);
      setHodlHistory(hodlData);
      
      // Get market benchmarks
      const benchmarks = await historicalDataService.getMarketBenchmarks(30);
      setMarketBenchmarks(benchmarks);
      
    } catch (error) {
      console.error('Error loading advanced analytics:', error);
      // Generate mock data for development
      setPortfolioHistory(generateMockPortfolioHistory());
      setHodlHistory(generateMockHodlHistory());
      setMarketBenchmarks([]);
    }
  }, [generateMockPortfolioHistory, generateMockHodlHistory]);

  const handleScan = useCallback(async (address: string, chain: ChainType) => {
    setIsLoading(true);
    setScanError(null);
    setLoadingState({
      isScanning: true,
      completedProtocols: [],
      failedProtocols: [],
      progress: 0
    });

    try {
      let scanResults: ScanResults;
      
      if (isDemo) {
        // Demo Mode: Use mock data
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
        
        const mockData = getMockDataByAddress(address) as any;
        
        if (mockData) {
          // Convert the old structure to new ScanResults structure
          scanResults = {
            chain,
            walletAddress: address,
            totalValue: mockData.totalValue,
            totalPositions: mockData.totalPositions,
            totalFeesEarned: Object.values(mockData.protocols).flatMap((p: any) => p.positions).reduce((sum: number, pos: any) => sum + pos.feesEarned, 0),
            avgApr: Object.values(mockData.protocols).flatMap((p: any) => p.positions).reduce((sum: number, pos: any) => sum + pos.apr, 0) / Object.values(mockData.protocols).flatMap((p: any) => p.positions).length,
            protocols: Object.entries(mockData.protocols).reduce((acc, [name, data]) => {
              acc[name as any] = {
                protocol: {
                  id: name as any,
                  name,
                  chain,
                  logoUri: '',
                  website: '',
                  supported: true
                },
                positions: (data as any).positions.map((pos: any) => ({
                  ...pos,
                  chain,
                  poolAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
                  apy: pos.apr * 1.1,
                  createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                  updatedAt: new Date().toISOString(),
                  tokens: {
                    token0: {
                      ...pos.tokens.token0,
                      address: `0x${Math.random().toString(16).slice(2, 42)}`,
                      decimals: 18
                    },
                    token1: {
                      ...pos.tokens.token1,
                      address: `0x${Math.random().toString(16).slice(2, 42)}`,
                      decimals: 18
                    }
                  }
                })),
                totalValue: (data as any).positions.reduce((sum: number, p: any) => sum + p.value, 0),
                totalPositions: (data as any).positions.length,
                totalFeesEarned: (data as any).positions.reduce((sum: number, p: any) => sum + p.feesEarned, 0),
                avgApr: (data as any).positions.reduce((sum: number, p: any) => sum + p.apr, 0) / (data as any).positions.length,
                isLoading: false
              };
              return acc;
            }, {} as Record<string, any>),
            lastUpdated: new Date().toISOString()
          };
        } else {
          // Generate empty results for unknown demo addresses
          scanResults = {
            chain,
            walletAddress: address,
            totalValue: 0,
            totalPositions: 0,
            totalFeesEarned: 0,
            avgApr: 0,
            protocols: {} as Record<string, any>,
            lastUpdated: new Date().toISOString()
          };
        }
      } else {
        // Production Mode: Use production scanner
        const productionScanner = getProductionScanner();
        const response = await productionScanner.scanWallet(address, chain, {
          includeHistoricalData: true,
          includeFees: true,
          timeframe: '30d'
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Failed to scan wallet');
        }
        
        scanResults = response.data!;
      }
      
      setScanResults(scanResults);
      
      // Load advanced analytics data
      await loadAdvancedAnalytics(scanResults);
      
    } catch (error) {
      console.error('Scan error:', error);
      setScanError(error instanceof Error ? error.message : 'An error occurred during scanning');
    } finally {
      setIsLoading(false);
      setLoadingState({
        isScanning: false,
        completedProtocols: [],
        failedProtocols: [],
        progress: 100
      });
    }
  }, [isDemo, loadAdvancedAnalytics]);

  const metrics = scanResults ? calculateMetrics(scanResults) : null;
  const protocolDistribution = scanResults ? getProtocolDistribution(scanResults) : [];
  const allPositions = scanResults ? Object.values(scanResults.protocols).flatMap(p => p.positions || []) : [];

  return (
    <main className="min-h-screen bg-gray-900">
      <div className="tt-container py-6 sm:py-8 lg:py-12">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">
          <h1 className="tt-heading-1 mb-4">
            LP Position Tracker
          </h1>
          <p className="tt-body max-w-3xl mx-auto text-lg">
            Track liquidity provider positions across all major DEXs on Ethereum and Solana with institutional-grade analytics
          </p>
          
          {/* Current mode indicator */}
          {isHydrated && (
            <div className="flex justify-center mt-4">
              <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium ${
                isDemo 
                  ? 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
                  : 'bg-green-500/10 border border-green-500/20 text-green-300'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  isDemo ? 'bg-blue-400' : 'bg-green-400'
                }`}></div>
                <span>Currently in {isDemo ? 'demo' : 'production'} mode {isDemo ? '(Sample Data)' : '(Live Data)'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Header with Mode Toggle */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <ModeToggle size="md" showLabels={true} />
        </div>

        {/* Search Bar */}
        <div className="mb-6 sm:mb-8 lg:mb-12">
          {isHydrated ? (
            <SimpleSearchBar onScan={handleScan} isLoading={isLoading || isTransitioning} isDemo={isDemo} />
          ) : (
            <SimpleSearchBar onScan={handleScan} isLoading={isLoading || isTransitioning} isDemo={false} />
          )}
        </div>
        
        {/* Error Display */}
        {scanError && (
          <div className="mb-6 tt-card p-4 border-l-4 border-red-500">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-red-300 font-medium">Scan Failed</span>
            </div>
            <p className="tt-text-secondary text-sm mt-2">{scanError}</p>
          </div>
        )}

        {/* Dashboard */}
        {scanResults && (
          <div className="tt-section">
            {/* Metrics Cards */}
            {metrics && (
              <MetricsCards metrics={metrics} loading={isLoading} />
            )}

            {/* Protocol Distribution */}
            {Object.keys(scanResults.protocols).length > 0 && (
              <div className="tt-card p-6">
                <h2 className="tt-heading-2 mb-6">Protocol Distribution</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {Object.entries(scanResults.protocols).map(([name, protocolData]) => (
                    <ProtocolCard
                      key={protocolData.protocol.id}
                      protocolData={protocolData}
                      onClick={(protocol) => {
                        console.log('Filter by protocol:', protocol);
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Advanced Analytics Toggle */}
            {allPositions.length > 0 && (
              <div className="text-center">
                <button
                  onClick={() => setShowAdvancedAnalytics(!showAdvancedAnalytics)}
                  className="tt-button-primary py-3 px-6 rounded-md transition-all duration-200 flex items-center justify-center space-x-2 mx-auto"
                >
                  <TrendingUp className="h-5 w-5" />
                  <span>{showAdvancedAnalytics ? 'Hide' : 'Show'} Advanced Analytics</span>
                </button>
              </div>
            )}

            {/* Advanced Analytics Section */}
            {showAdvancedAnalytics && allPositions.length > 0 && (
              <div className="space-y-6">
                {/* Performance Chart */}
                <div className="tt-card p-6">
                  <h2 className="tt-heading-2 mb-6 flex items-center space-x-2">
                    <BarChart3 className="h-6 w-6" />
                    <span>Portfolio Performance</span>
                  </h2>
                  <PerformanceChart 
                    portfolioData={portfolioHistory}
                    hodlData={hodlHistory}
                    benchmarkData={Array.isArray(marketBenchmarks) ? {} : marketBenchmarks}
                  />
                </div>

                {/* HODL Comparison & Risk Metrics */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="tt-card p-6">
                    <HodlComparison 
                      portfolioHistory={portfolioHistory}
                      hodlHistory={hodlHistory}
                      positions={allPositions}
                    />
                  </div>
                  <div className="tt-card p-6">
                    <RiskMetrics 
                      portfolioHistory={portfolioHistory}
                      positions={allPositions}
                    />
                  </div>
                </div>

                {/* Yield Optimizer & Smart Alerts */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="tt-card p-6">
                    <YieldOptimizer 
                      positions={allPositions}
                      currentPortfolioValue={scanResults.totalValue}
                    />
                  </div>
                  <div className="tt-card p-6">
                    <SmartAlerts 
                      positions={allPositions}
                      portfolioHistory={portfolioHistory}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Positions List */}
            {allPositions.length > 0 && (
              <div className="tt-card p-6">
                <h2 className="tt-heading-2 mb-6">
                  All Positions ({allPositions.length})
                </h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {allPositions.map((position) => (
                    <PositionCard 
                      key={position.id} 
                      position={position}
                      showManageButton={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {allPositions.length === 0 && (
              <div className="tt-card p-12 text-center">
                <div className="tt-text-secondary text-lg">
                  No liquidity positions found for this address
                </div>
                {isHydrated && isProduction && (
                  <div className="tt-text-tertiary text-sm mt-2">
                    Data sourced from live protocols - this address may not have active LP positions
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Welcome State */}
        {!scanResults && !isLoading && !isTransitioning && (
          <div className="tt-card p-12 text-center">
            <Network className="h-16 w-16 tt-text-tertiary mx-auto mb-6" />
            <h2 className="tt-heading-2 mb-4">
              Ready to Track Your LP Positions
            </h2>
            <p className="tt-text-secondary max-w-2xl mx-auto mb-6">
              {isHydrated 
                ? (isDemo 
                  ? 'Currently in Demo Mode - explore with sample data and try the demo addresses below.'
                  : 'Currently in Production Mode - enter any wallet address to scan for live LP positions across supported protocols.')
                : 'Enter any wallet address to scan for LP positions across supported protocols.'
              }
            </p>
            
            {/* Mode-specific features */}
            {isHydrated && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-6">
                <div className={`p-4 rounded-lg border ${isDemo ? 'bg-blue-500/10 border-blue-500/20' : 'bg-gray-500/10 border-gray-500/20'}`}>
                  <h3 className="font-semibold mb-2">{isDemo ? '🧪 Demo Features' : '🚀 Production Features'}</h3>
                  <ul className="text-sm tt-text-secondary space-y-1 text-left">
                    {isDemo ? (
                      <>
                        <li>• Sample wallet data</li>
                        <li>• Simulated analytics</li>
                        <li>• All UI components</li>
                        <li>• No API rate limits</li>
                      </>
                    ) : (
                      <>
                        <li>• Live position data</li>
                        <li>• Real-time price feeds</li>
                        <li>• Protocol integrations</li>
                        <li>• Production analytics</li>
                    </>
                  )}
                </ul>
              </div>
              
              <div className="p-4 rounded-lg border bg-gray-500/5 border-gray-500/10">
                <h3 className="font-semibold mb-2">📊 Supported Protocols</h3>
                <ul className="text-sm tt-text-secondary space-y-1 text-left">
                  <li>• Uniswap V2/V3</li>
                  <li>• Raydium CLMM</li>
                  <li>• Orca Whirlpools</li>
                  <li>• And many more...</li>
                </ul>
              </div>
            </div>
            )}
          </div>
        )}
        
        {/* Transition Loading State */}
        {isTransitioning && (
          <div className="tt-card p-12 text-center">
            <Loader2 className="h-16 w-16 tt-text-tertiary mx-auto mb-6 animate-spin" />
            <h2 className="tt-heading-2 mb-4">
              Switching Modes...
            </h2>
            <p className="tt-text-secondary max-w-2xl mx-auto">
              {isHydrated 
                ? (isDemo ? 'Activating production features and connecting to live data sources.' : 'Loading demo data and sample positions.')
                : 'Switching between demo and production modes...'
              }
            </p>
          </div>
        )}
      </div>
    </main>
  );
}