import { ScanResults } from '../types';

// Solana address: DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK
// Active across Meteora DLMM, Orca Whirlpools, and Raydium CLMM
export const solanaWhaleData = {
  chain: 'solana',
  totalValue: 1456789.23,
  totalPositions: 15,
  protocols: {
    'Meteora DLMM': {
      positions: [
        {
          id: 'meteora-1',
          protocol: 'Meteora DLMM',
          pool: 'SOL/USDC Dynamic',
          liquidity: 350000,
          value: 287634.56,
          feesEarned: 4567.89,
          apr: 28.4,
          inRange: true,
          tokens: {
            token0: { symbol: 'SOL', amount: 1234.56 },
            token1: { symbol: 'USDC', amount: 143817.28 }
          }
        },
        {
          id: 'meteora-2',
          protocol: 'Meteora DLMM',
          pool: 'JUP/SOL Dynamic',
          liquidity: 180000,
          value: 156789.34,
          feesEarned: 3245.67,
          apr: 35.2,
          inRange: true,
          tokens: {
            token0: { symbol: 'JUP', amount: 45678.91 },
            token1: { symbol: 'SOL', amount: 672.84 }
          }
        },
        {
          id: 'meteora-3',
          protocol: 'Meteora DLMM',
          pool: 'BONK/SOL Dynamic',
          liquidity: 95000,
          value: 78234.12,
          feesEarned: 2134.56,
          apr: 42.1,
          inRange: false,
          tokens: {
            token0: { symbol: 'BONK', amount: 12345678.9 },
            token1: { symbol: 'SOL', amount: 335.67 }
          }
        },
        {
          id: 'meteora-4',
          protocol: 'Meteora DLMM',
          pool: 'PYTH/USDC Dynamic',
          liquidity: 120000,
          value: 94567.89,
          feesEarned: 1876.34,
          apr: 25.8,
          inRange: true,
          tokens: {
            token0: { symbol: 'PYTH', amount: 23456.78 },
            token1: { symbol: 'USDC', amount: 47283.95 }
          }
        }
      ]
    },
    'Orca Whirlpools': {
      positions: [
        {
          id: 'orca-1',
          protocol: 'Orca Whirlpools',
          pool: 'SOL/USDC 0.3%',
          liquidity: 420000,
          value: 345678.12,
          feesEarned: 5234.78,
          apr: 24.6,
          inRange: true,
          tokens: {
            token0: { symbol: 'SOL', amount: 1483.92 },
            token1: { symbol: 'USDC', amount: 172839.06 }
          }
        },
        {
          id: 'orca-2',
          protocol: 'Orca Whirlpools',
          pool: 'mSOL/SOL 0.05%',
          liquidity: 200000,
          value: 178934.45,
          feesEarned: 2345.67,
          apr: 18.9,
          inRange: true,
          tokens: {
            token0: { symbol: 'mSOL', amount: 756.23 },
            token1: { symbol: 'SOL', amount: 723.89 }
          }
        },
        {
          id: 'orca-3',
          protocol: 'Orca Whirlpools',
          pool: 'ORCA/SOL 0.3%',
          liquidity: 150000,
          value: 123456.78,
          feesEarned: 1987.45,
          apr: 22.3,
          inRange: false,
          tokens: {
            token0: { symbol: 'ORCA', amount: 15234.56 },
            token1: { symbol: 'SOL', amount: 529.81 }
          }
        },
        {
          id: 'orca-4',
          protocol: 'Orca Whirlpools',
          pool: 'USDT/USDC 0.01%',
          liquidity: 300000,
          value: 234567.89,
          feesEarned: 1456.78,
          apr: 8.4,
          inRange: true,
          tokens: {
            token0: { symbol: 'USDT', amount: 117283.95 },
            token1: { symbol: 'USDC', amount: 117283.94 }
          }
        }
      ]
    },
    'Raydium CLMM': {
      positions: [
        {
          id: 'raydium-1',
          protocol: 'Raydium CLMM',
          pool: 'RAY/SOL 0.25%',
          liquidity: 180000,
          value: 145623.78,
          feesEarned: 2876.45,
          apr: 31.7,
          inRange: true,
          tokens: {
            token0: { symbol: 'RAY', amount: 67891.23 },
            token1: { symbol: 'SOL', amount: 624.57 }
          }
        },
        {
          id: 'raydium-2',
          protocol: 'Raydium CLMM',
          pool: 'WIF/SOL 0.5%',
          liquidity: 95000,
          value: 76543.21,
          feesEarned: 1734.56,
          apr: 38.2,
          inRange: true,
          tokens: {
            token0: { symbol: 'WIF', amount: 12345.67 },
            token1: { symbol: 'SOL', amount: 328.42 }
          }
        },
        {
          id: 'raydium-3',
          protocol: 'Raydium CLMM',
          pool: 'JITO/SOL 0.25%',
          liquidity: 130000,
          value: 98756.43,
          feesEarned: 2134.78,
          apr: 27.9,
          inRange: false,
          tokens: {
            token0: { symbol: 'JITO', amount: 3456.78 },
            token1: { symbol: 'SOL', amount: 423.81 }
          }
        },
        {
          id: 'raydium-4',
          protocol: 'Raydium CLMM',
          pool: 'SAMO/SOL 1%',
          liquidity: 65000,
          value: 54321.98,
          feesEarned: 1876.23,
          apr: 44.6,
          inRange: true,
          tokens: {
            token0: { symbol: 'SAMO', amount: 123456.78 },
            token1: { symbol: 'SOL', amount: 232.94 }
          }
        },
        {
          id: 'raydium-5',
          protocol: 'Raydium CLMM',
          pool: 'USDC/USDT 0.01%',
          liquidity: 250000,
          value: 198765.43,
          feesEarned: 987.65,
          apr: 6.2,
          inRange: true,
          tokens: {
            token0: { symbol: 'USDC', amount: 99382.72 },
            token1: { symbol: 'USDT', amount: 99382.71 }
          }
        },
        {
          id: 'raydium-6',
          protocol: 'Raydium CLMM',
          pool: 'HNT/SOL 0.5%',
          liquidity: 75000,
          value: 61234.56,
          feesEarned: 1345.67,
          apr: 29.8,
          inRange: false,
          tokens: {
            token0: { symbol: 'HNT', amount: 8765.43 },
            token1: { symbol: 'SOL', amount: 262.89 }
          }
        }
      ]
    }
  }
};