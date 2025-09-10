import { ScanResults } from '../types';

// Ethereum address: 0x742d35Cc6634C0532925a3b8D9e7b21b5F96a91c
// Large Uniswap V2/V3 and SushiSwap LP positions
export const ethereumWhaleData = {
  chain: 'ethereum',
  totalValue: 2847362.45,
  totalPositions: 12,
  protocols: {
    'Uniswap V3': {
      positions: [
        {
          id: 'uni-v3-1',
          protocol: 'Uniswap V3',
          pool: 'USDC/ETH 0.05%',
          liquidity: 1250000,
          value: 847562.34,
          feesEarned: 12456.78,
          apr: 18.5,
          inRange: true,
          tokens: {
            token0: { symbol: 'USDC', amount: 423781.5 },
            token1: { symbol: 'ETH', amount: 127.84 }
          }
        },
        {
          id: 'uni-v3-2',
          protocol: 'Uniswap V3',
          pool: 'WBTC/ETH 0.3%',
          liquidity: 750000,
          value: 523847.12,
          feesEarned: 8923.45,
          apr: 22.3,
          inRange: false,
          tokens: {
            token0: { symbol: 'WBTC', amount: 5.67 },
            token1: { symbol: 'ETH', amount: 89.23 }
          }
        },
        {
          id: 'uni-v3-3',
          protocol: 'Uniswap V3',
          pool: 'DAI/USDC 0.01%',
          liquidity: 400000,
          value: 298754.67,
          feesEarned: 3245.12,
          apr: 12.8,
          inRange: true,
          tokens: {
            token0: { symbol: 'DAI', amount: 149377.34 },
            token1: { symbol: 'USDC', amount: 149377.33 }
          }
        },
        {
          id: 'uni-v3-4',
          protocol: 'Uniswap V3',
          pool: 'LINK/ETH 0.3%',
          liquidity: 200000,
          value: 187234.56,
          feesEarned: 2156.89,
          apr: 15.7,
          inRange: true,
          tokens: {
            token0: { symbol: 'LINK', amount: 12847.5 },
            token1: { symbol: 'ETH', amount: 28.91 }
          }
        }
      ]
    },
    'Uniswap V2': {
      positions: [
        {
          id: 'uni-v2-1',
          protocol: 'Uniswap V2',
          pool: 'ETH/USDT',
          liquidity: 650000,
          value: 456789.23,
          feesEarned: 5234.67,
          apr: 14.2,
          inRange: true,
          tokens: {
            token0: { symbol: 'ETH', amount: 69.45 },
            token1: { symbol: 'USDT', amount: 228394.78 }
          }
        },
        {
          id: 'uni-v2-2',
          protocol: 'Uniswap V2',
          pool: 'WBTC/USDC',
          liquidity: 350000,
          value: 234567.89,
          feesEarned: 2987.34,
          apr: 16.8,
          inRange: true,
          tokens: {
            token0: { symbol: 'WBTC', amount: 2.34 },
            token1: { symbol: 'USDC', amount: 117283.95 }
          }
        }
      ]
    },
    'SushiSwap': {
      positions: [
        {
          id: 'sushi-1',
          protocol: 'SushiSwap',
          pool: 'SUSHI/ETH',
          liquidity: 180000,
          value: 145623.78,
          feesEarned: 1876.45,
          apr: 19.3,
          inRange: true,
          tokens: {
            token0: { symbol: 'SUSHI', amount: 15234.67 },
            token1: { symbol: 'ETH', amount: 22.19 }
          }
        },
        {
          id: 'sushi-2',
          protocol: 'SushiSwap',
          pool: 'AAVE/ETH',
          liquidity: 120000,
          value: 98745.32,
          feesEarned: 1234.56,
          apr: 17.4,
          inRange: false,
          tokens: {
            token0: { symbol: 'AAVE', amount: 678.91 },
            token1: { symbol: 'ETH', amount: 15.02 }
          }
        },
        {
          id: 'sushi-3',
          protocol: 'SushiSwap',
          pool: 'CRV/ETH',
          liquidity: 85000,
          value: 67834.21,
          feesEarned: 892.13,
          apr: 20.1,
          inRange: true,
          tokens: {
            token0: { symbol: 'CRV', amount: 18456.78 },
            token1: { symbol: 'ETH', amount: 10.31 }
          }
        },
        {
          id: 'sushi-4',
          protocol: 'SushiSwap',
          pool: 'COMP/USDC',
          liquidity: 95000,
          value: 78923.45,
          feesEarned: 967.82,
          apr: 15.9,
          inRange: true,
          tokens: {
            token0: { symbol: 'COMP', amount: 1456.78 },
            token1: { symbol: 'USDC', amount: 39461.73 }
          }
        },
        {
          id: 'sushi-5',
          protocol: 'SushiSwap',
          pool: 'UNI/ETH',
          liquidity: 75000,
          value: 58734.29,
          feesEarned: 723.91,
          apr: 18.7,
          inRange: false,
          tokens: {
            token0: { symbol: 'UNI', amount: 8234.56 },
            token1: { symbol: 'ETH', amount: 8.94 }
          }
        }
      ]
    }
  }
};