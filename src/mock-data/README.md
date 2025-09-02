# Mock Data Documentation

This directory contains realistic mock data for the Universal LP Position Tracker demo addresses.

## Demo Addresses

### 1. Ethereum Whale: `0x742d35Cc6634C0532925a3b8D9e7b21b5F96a91c`
- **Total Value:** $2,847,362.45
- **Positions:** 12 LP positions
- **Protocols:** Uniswap V2, Uniswap V3, SushiSwap
- **Highlights:**
  - Large USDC/ETH position on Uniswap V3 ($847K)
  - Multiple concentrated liquidity positions
  - Mix of in-range and out-of-range positions
  - High-value pairs: WBTC/ETH, DAI/USDC, LINK/ETH

### 2. Solana Whale: `DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK`
- **Total Value:** $1,456,789.23
- **Positions:** 15 LP positions
- **Protocols:** Meteora DLMM, Orca Whirlpools, Raydium CLMM
- **Highlights:**
  - Dynamic market making on Meteora with high APRs
  - Concentrated liquidity on Orca and Raydium
  - SOL-focused pairs with various tokens (JUP, BONK, RAY, WIF)
  - Mix of stablecoin and volatile pairs

### 3. Jupiter Trader: `CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq`
- **Total Value:** $234,567.89
- **Positions:** 8 LP positions
- **Protocols:** Jupiter, Lifinity
- **Highlights:**
  - JUP-focused positions on Jupiter protocol
  - Proactive market making on Lifinity
  - Smaller but active trading positions
  - Good APR performance across positions

## Data Structure

Each mock data file exports a `ScanResults` object with:

```typescript
interface ScanResults {
  chain: 'ethereum' | 'solana';
  totalValue: number;
  totalPositions: number;
  protocols: Record<string, { positions: Position[] }>;
}
```

## Position Details

Each position includes:
- **Protocol-specific data:** Different fee tiers, pool types
- **Realistic token amounts:** Based on actual market conditions
- **Performance metrics:** APR ranges typical for each protocol
- **Range status:** Mix of in-range and out-of-range positions
- **Fee earnings:** Accumulated fees based on position age and activity

## Usage

```typescript
import { ethereumWhaleData, solanaWhaleData, jupiterTraderData } from '@/mock-data';
import { getMockDataByAddress, calculateMetrics } from '@/mock-data';

// Get data by address
const data = getMockDataByAddress('0x742d35Cc6634C0532925a3b8D9e7b21b5F96a91c');

// Calculate metrics
const metrics = calculateMetrics(ethereumWhaleData);
```

## Protocols Included

### Ethereum
- **Uniswap V2:** Classic AMM pairs
- **Uniswap V3:** Concentrated liquidity with fee tiers (0.01%, 0.05%, 0.3%)
- **SushiSwap:** Various token pairs with competitive APRs

### Solana
- **Meteora DLMM:** Dynamic liquidity market making
- **Orca Whirlpools:** Concentrated liquidity AMM
- **Raydium CLMM:** Concentrated liquidity with various fee tiers
- **Jupiter:** Native Jupiter protocol LP positions
- **Lifinity:** Proactive market making algorithm

## Realistic Features

- **APR Ranges:** 
  - Ethereum: 8-25% (typical for established protocols)
  - Solana: 15-45% (higher due to newer, more volatile ecosystem)
- **Position Sizes:** Varied from $20K to $800K+ reflecting real whale behavior
- **Token Pairs:** Mix of blue-chip, DeFi, and meme tokens
- **Fee Tiers:** Accurate fee structures for each protocol
- **Range Status:** ~70% in-range, 30% out-of-range (realistic for volatile markets)