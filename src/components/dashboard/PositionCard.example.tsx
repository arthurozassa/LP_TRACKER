'use client';

import React from 'react';
import { PositionCard } from './PositionCard';
import { Position } from '@/types';

// Example positions for demonstration
const examplePositions: Position[] = [
  {
    id: 'pos_1a2b3c4d5e6f7g8h',
    protocol: 'uniswap-v3',
    chain: 'ethereum',
    pool: 'ETH/USDC',
    poolAddress: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
    liquidity: 125000,
    value: 145000,
    feesEarned: 8250.75,
    apr: 24.5,
    apy: 27.8,
    inRange: true,
    tokens: {
      token0: {
        symbol: 'ETH',
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount: 45.67,
        decimals: 18,
        logoUri: '/tokens/eth.svg'
      },
      token1: {
        symbol: 'USDC',
        address: '0xA0b86a33E6441e8b02b52E02b52a69B44B7F4d78',
        amount: 89234.12,
        decimals: 6,
        logoUri: '/tokens/usdc.svg'
      }
    },
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-02-01T14:22:00Z',
    tickLower: 195000,
    tickUpper: 205000,
    currentTick: 200500,
    priceRange: {
      lower: 1850.25,
      upper: 2150.75,
      current: 2000.50
    },
    manageUrl: 'https://app.uniswap.org/#/pools/123',
    yield24h: 0.85,
    yield7d: 6.2,
    yield30d: 24.5,
    impermanentLoss: -0.12
  },
  {
    id: 'pos_9z8y7x6w5v4u3t2s',
    protocol: 'meteora-dlmm',
    chain: 'solana',
    pool: 'SOL/USDC',
    poolAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    liquidity: 75000,
    value: 82500,
    feesEarned: 3420.80,
    apr: 45.2,
    apy: 58.7,
    inRange: false,
    tokens: {
      token0: {
        symbol: 'SOL',
        address: 'So11111111111111111111111111111111111111112',
        amount: 823.45,
        decimals: 9,
        logoUri: '/tokens/sol.svg'
      },
      token1: {
        symbol: 'USDC',
        address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        amount: 41250.0,
        decimals: 6,
        logoUri: '/tokens/usdc.svg'
      }
    },
    createdAt: '2024-01-20T16:45:00Z',
    updatedAt: '2024-02-01T09:15:00Z',
    manageUrl: 'https://app.meteora.ag/dlmm/7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
    yield24h: 1.2,
    yield7d: 8.5,
    yield30d: 35.7,
    impermanentLoss: -2.34
  },
  {
    id: 'pos_5r4e3w2q1a9s8d7f',
    protocol: 'curve',
    chain: 'ethereum',
    pool: 'stETH/ETH',
    poolAddress: '0xdc24316b9ae028f1497c275eb9192a3ea0f67022',
    liquidity: 200000,
    value: 205000,
    feesEarned: 12750.25,
    apr: 18.7,
    apy: 20.5,
    inRange: true,
    tokens: {
      token0: {
        symbol: 'stETH',
        address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
        amount: 52.34,
        decimals: 18,
        logoUri: '/tokens/steth.svg'
      },
      token1: {
        symbol: 'ETH',
        address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        amount: 50.89,
        decimals: 18,
        logoUri: '/tokens/eth.svg'
      }
    },
    createdAt: '2024-01-10T12:00:00Z',
    updatedAt: '2024-02-01T11:30:00Z',
    manageUrl: 'https://curve.fi/steth',
    yield24h: 0.45,
    yield7d: 3.2,
    yield30d: 15.8,
    impermanentLoss: 0.05
  }
];

/**
 * Example usage of PositionCard component
 * 
 * Features demonstrated:
 * - In Range vs Out of Range status with visual indicators
 * - Pool information and token pair display
 * - Key metrics in glassmorphism cards
 * - Expandable details section
 * - External management links
 * - Hover effects and animations
 * - Price range visualization
 * - Protocol and chain logos
 */
export const PositionCardExamples: React.FC = () => {
  const handlePositionClick = (position: Position) => {
    console.log('Position clicked:', position);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900/20 to-purple-900/20 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">
            PositionCard Component Examples
          </h1>
          <p className="text-white/60">
            Interactive LP position cards with glassmorphism styling, status indicators, and detailed metrics.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {examplePositions.map((position) => (
            <PositionCard
              key={position.id}
              position={position}
              onClick={handlePositionClick}
              showManageButton={true}
              compact={false}
            />
          ))}
        </div>

        {/* Compact versions */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-white mb-6">
            Compact Versions
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {examplePositions.map((position) => (
              <PositionCard
                key={`compact-${position.id}`}
                position={position}
                onClick={handlePositionClick}
                showManageButton={false}
                compact={true}
              />
            ))}
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-16 p-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md">
          <h2 className="text-2xl font-bold text-white mb-4">
            Usage Instructions
          </h2>
          <div className="space-y-4 text-white/80">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Basic Usage:</h3>
              <pre className="bg-black/30 p-4 rounded-lg text-sm overflow-x-auto">
{`import { PositionCard } from '@/components/dashboard';

<PositionCard
  position={position}
  onClick={(pos) => console.log(pos)}
  showManageButton={true}
  compact={false}
/>`}
              </pre>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Props:</h3>
              <ul className="space-y-2 text-sm">
                <li><code className="bg-black/30 px-2 py-1 rounded">position</code> - Position object with LP data</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">onClick</code> - Optional click handler</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">showManageButton</code> - Show external manage link</li>
                <li><code className="bg-black/30 px-2 py-1 rounded">compact</code> - Compact layout without expansion</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Features:</h3>
              <ul className="space-y-1 text-sm">
                <li>• In Range / Out of Range status indicators</li>
                <li>• Expandable details section</li>
                <li>• Glassmorphism styling with hover effects</li>
                <li>• Protocol and chain logo display</li>
                <li>• Price range visualization</li>
                <li>• External protocol management links</li>
                <li>• Responsive grid layout</li>
                <li>• TypeScript type safety</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PositionCardExamples;