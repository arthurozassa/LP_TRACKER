'use client';

import React, { useState, useCallback } from 'react';
import { Network, Search, Wallet, Loader2 } from 'lucide-react';
import MetricsCards from '../components/dashboard/MetricsCards';
import ProtocolCard from '../components/dashboard/ProtocolCard';
import PositionCard from '../components/dashboard/PositionCard';
import { ScanResults, ChainType, LoadingState, DashboardMetrics, ProtocolDistribution } from '../types';
import { getMockDataByAddress } from '../mock-data';
import { detectChainType, isEthereumAddress, isSolanaAddress } from '../types';

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
}> = ({ onScan, isLoading }) => {
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
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Main Search Input */}
      <div className="crypto-card border border-orange-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl hover:shadow-orange-500/20 transition-all duration-300">
        <div className="flex flex-col space-y-3 sm:space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-white/60" />
            </div>
            <input
              type="text"
              value={address}
              onChange={handleAddressChange}
              placeholder="Enter wallet address..."
              className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-3 sm:py-4 crypto-card border border-orange-500/30 rounded-lg sm:rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-orange-400/50 focus:border-orange-400/50 transition-all duration-200 text-sm sm:text-base"
              disabled={isLoading}
            />
          </div>

          {/* Chain Detection */}
          {address && (
            <div className="flex items-center space-x-2">
              {detectedChain ? (
                <div className="flex items-center space-x-2 text-green-400">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs sm:text-sm font-medium capitalize">
                    {detectedChain} address detected
                  </span>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-red-400">
                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  <span className="text-xs sm:text-sm">Invalid address format</span>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-red-400 text-xs sm:text-sm">{error}</div>
          )}

          {/* Scan Button */}
          <button
            onClick={handleScan}
            disabled={isLoading || !detectedChain || !!error}
            className="w-full crypto-button disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-lg sm:rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 text-sm sm:text-base"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                <span>Scanning All DEXs...</span>
              </>
            ) : (
              <>
                <Search className="h-4 w-4 sm:h-5 sm:w-5" />
                <span>Scan All DEXs</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Demo Addresses */}
      <div className="crypto-card border border-orange-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl">
        <h3 className="text-white font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Try Demo Addresses</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
          {DEMO_ADDRESSES.map((demo, index) => (
            <button
              key={index}
              onClick={() => handleDemoClick(demo)}
              disabled={isLoading}
              className="p-3 sm:p-4 crypto-card crypto-card-hover border border-orange-500/20 rounded-lg sm:rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-left touch-manipulation hover:shadow-orange-500/10"
            >
              <div className="text-white font-medium text-xs sm:text-sm">{demo.label}</div>
              <div className="text-white/60 text-xs mt-1 sm:mt-0">{demo.description}</div>
              <div className="text-white/40 text-xs font-mono mt-1 break-all sm:break-normal">
                {formatAddress(demo.address)}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Home() {
  const [scanResults, setScanResults] = useState<ScanResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isScanning: false,
    completedProtocols: [],
    failedProtocols: [],
    progress: 0
  });

  const calculateMetrics = (results: ScanResults): DashboardMetrics => {
    const positions = Object.values(results.protocols).flatMap(p => p.positions || []);
    const inRangePositions = positions.filter(p => p.inRange).length;
    const activeProtocols = Object.keys(results.protocols).length;

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
      totalImpermanentLoss: 0
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

  const handleScan = useCallback(async (address: string, chain: ChainType) => {
    setIsLoading(true);
    setLoadingState({
      isScanning: true,
      completedProtocols: [],
      failedProtocols: [],
      progress: 0
    });

    try {
      // Simulate scanning delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to get mock data
      const mockData = getMockDataByAddress(address) as any;
      
      if (mockData) {
        // Convert the old structure to new ScanResults structure
        const newResults = {
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
        
        setScanResults(newResults as ScanResults);
      } else {
        // Generate empty results for unknown addresses
        setScanResults({
          chain,
          walletAddress: address,
          totalValue: 0,
          totalPositions: 0,
          totalFeesEarned: 0,
          avgApr: 0,
          protocols: {} as Record<string, any>,
          lastUpdated: new Date().toISOString()
        } as ScanResults);
      }
    } catch (error) {
      console.error('Scan error:', error);
    } finally {
      setIsLoading(false);
      setLoadingState({
        isScanning: false,
        completedProtocols: [],
        failedProtocols: [],
        progress: 100
      });
    }
  }, []);

  const metrics = scanResults ? calculateMetrics(scanResults) : null;
  const protocolDistribution = scanResults ? getProtocolDistribution(scanResults) : [];
  const allPositions = scanResults ? Object.values(scanResults.protocols).flatMap(p => p.positions || []) : [];

  return (
    <main className="min-h-screen" style={{ 
      background: 'linear-gradient(135deg, #0A0A0F 0%, #151520 25%, #1A1A28 50%, #0A0A0F 100%)',
      backgroundAttachment: 'fixed'
    }}>
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-2 sm:mb-4 leading-tight crypto-text-gradient">
            Universal LP Position Tracker
          </h1>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/80 mb-4 sm:mb-6 lg:mb-8 max-w-4xl mx-auto px-2">
            Scan any wallet address to track liquidity provider positions across all major DEXs on Ethereum and Solana
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-6 sm:mb-8 lg:mb-12">
          <SimpleSearchBar onScan={handleScan} isLoading={isLoading} />
        </div>

        {/* Dashboard */}
        {scanResults && (
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Metrics Cards */}
            {metrics && (
              <MetricsCards metrics={metrics} loading={isLoading} />
            )}

            {/* Protocol Distribution */}
            {Object.keys(scanResults.protocols).length > 0 && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-4 sm:mb-6">Protocol Distribution</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
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

            {/* Positions List */}
            {allPositions.length > 0 && (
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-6">
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-4 sm:mb-6">
                  All Positions ({allPositions.length})
                </h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
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
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 text-center">
                <div className="text-white/60 text-base sm:text-lg">
                  No liquidity positions found for this address
                </div>
              </div>
            )}
          </div>
        )}

        {/* Welcome State */}
        {!scanResults && !isLoading && (
          <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 text-center">
            <Network className="h-12 w-12 sm:h-16 sm:w-16 text-white/60 mx-auto mb-4 sm:mb-6" />
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-3 sm:mb-4">
              Ready to Track Your LP Positions
            </h2>
            <p className="text-white/70 text-sm sm:text-base lg:text-lg max-w-2xl mx-auto px-2">
              Enter a wallet address above to scan across all major DEXs and protocols. 
              We support Ethereum, Solana, and major L2 networks with real-time position tracking.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}