# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Universal LP Position Tracker - A comprehensive web application that scans wallet addresses (Ethereum/Solana) across all major DEXs to display LP positions, fees earned, performance metrics, and more.

## Technical Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Charts**: Recharts (LineChart, AreaChart, BarChart, PieChart)
- **Icons**: Lucide React
- **Main Component**: app/page.tsx (App Router structure)

## Common Commands

```bash
# Project setup
npm create next-app@latest . --typescript --tailwind --eslint --app

# Development
npm run dev

# Build and lint
npm run build
npm run lint

# Install required dependencies
npm install recharts lucide-react
```

## Architecture Overview

### Chain Detection System
- Automatic wallet address detection using regex patterns:
  - Ethereum: `/^0x[a-fA-F0-9]{40}$/`
  - Solana: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`

### Supported Protocols
- **Ethereum**: Uniswap V2/V3, SushiSwap, Curve Finance, Balancer
- **Solana**: Meteora DLMM, Raydium CLMM, Orca Whirlpools, Lifinity, Jupiter
- **L2s**: Arbitrum, Polygon, Base (Uniswap + native DEXs)

### Core Features Implementation
1. **Universal Scanner**: Single input field with "Scan All DEXs" functionality
2. **Protocol Detection**: Auto-detects chain and scans all relevant protocols
3. **Demo Addresses**: 3 preset addresses (Solana Whale, Ethereum LP, Jupiter Trader)
4. **Dashboard**: Metrics cards, protocol distribution charts, position filtering
5. **Position Details**: In Range/Out of Range status, fee tracking, APR calculations

### Data Structures

```typescript
interface Position {
  id: string;
  protocol: string;
  pool: string;
  liquidity: number;
  value: number;
  feesEarned: number;
  apr: number;
  inRange: boolean;
  tokens: {
    token0: { symbol: string; amount: number };
    token1: { symbol: string; amount: number };
  };
}

interface ScanResults {
  chain: 'ethereum' | 'solana';
  totalValue: number;
  totalPositions: number;
  protocols: Record<string, { positions: Position[] }>;
}
```

## Development Guidelines

- Use App Router structure (`app/` directory)
- Implement strict TypeScript typing for all data structures
- Create reusable components for protocol cards, position items, and charts
- Use Tailwind classes for responsive design
- Implement proper loading states with protocol-specific indicators
- Add status badges for In Range/Out of Range positions