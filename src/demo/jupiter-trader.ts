import { ScanResults } from '../types';

// Solana address: CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq
// Jupiter and Lifinity focused trader with smaller positions
export const jupiterTraderData = {
  chain: 'solana',
  totalValue: 234567.89,
  totalPositions: 8,
  protocols: {
    'Jupiter': {
      positions: [
        {
          id: 'jupiter-1',
          protocol: 'Jupiter',
          pool: 'JUP/SOL LP',
          liquidity: 85000,
          value: 67890.12,
          feesEarned: 1234.56,
          apr: 26.8,
          inRange: true,
          tokens: {
            token0: { symbol: 'JUP', amount: 19876.54 },
            token1: { symbol: 'SOL', amount: 291.23 }
          }
        },
        {
          id: 'jupiter-2',
          protocol: 'Jupiter',
          pool: 'JUP/USDC LP',
          liquidity: 65000,
          value: 52345.67,
          feesEarned: 987.34,
          apr: 23.4,
          inRange: false,
          tokens: {
            token0: { symbol: 'JUP', amount: 15234.78 },
            token1: { symbol: 'USDC', amount: 26172.84 }
          }
        },
        {
          id: 'jupiter-3',
          protocol: 'Jupiter',
          pool: 'W/JUP LP',
          liquidity: 45000,
          value: 38765.43,
          feesEarned: 756.89,
          apr: 31.2,
          inRange: true,
          tokens: {
            token0: { symbol: 'W', amount: 56789.12 },
            token1: { symbol: 'JUP', amount: 11234.56 }
          }
        }
      ]
    },
    'Lifinity': {
      positions: [
        {
          id: 'lifinity-1',
          protocol: 'Lifinity',
          pool: 'LFNTY/SOL Proactive',
          liquidity: 55000,
          value: 43210.98,
          feesEarned: 876.54,
          apr: 28.7,
          inRange: true,
          tokens: {
            token0: { symbol: 'LFNTY', amount: 12345.67 },
            token1: { symbol: 'SOL', amount: 185.42 }
          }
        },
        {
          id: 'lifinity-2',
          protocol: 'Lifinity',
          pool: 'SOL/USDC Proactive',
          liquidity: 38000,
          value: 31234.56,
          feesEarned: 645.32,
          apr: 22.1,
          inRange: true,
          tokens: {
            token0: { symbol: 'SOL', amount: 134.12 },
            token1: { symbol: 'USDC', amount: 15617.28 }
          }
        },
        {
          id: 'lifinity-3',
          protocol: 'Lifinity',
          pool: 'RAY/LFNTY Proactive',
          liquidity: 25000,
          value: 20876.54,
          feesEarned: 432.18,
          apr: 34.5,
          inRange: false,
          tokens: {
            token0: { symbol: 'RAY', amount: 9876.54 },
            token1: { symbol: 'LFNTY', amount: 5234.21 }
          }
        },
        {
          id: 'lifinity-4',
          protocol: 'Lifinity',
          pool: 'mSOL/SOL Proactive',
          liquidity: 32000,
          value: 26543.21,
          feesEarned: 567.89,
          apr: 19.8,
          inRange: true,
          tokens: {
            token0: { symbol: 'mSOL', amount: 112.34 },
            token1: { symbol: 'SOL', amount: 107.65 }
          }
        },
        {
          id: 'lifinity-5',
          protocol: 'Lifinity',
          pool: 'USDT/USDC Stable',
          liquidity: 28000,
          value: 23456.78,
          feesEarned: 234.56,
          apr: 12.3,
          inRange: true,
          tokens: {
            token0: { symbol: 'USDT', amount: 11728.39 },
            token1: { symbol: 'USDC', amount: 11728.39 }
          }
        }
      ]
    }
  }
};