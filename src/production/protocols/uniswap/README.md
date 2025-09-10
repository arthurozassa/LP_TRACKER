# Uniswap V2 & V3 Integration

This directory contains the complete production-ready integration for Uniswap V2 and V3 protocols, supporting multiple chains including Ethereum mainnet and L2s.

## Architecture Overview

```
src/production/protocols/uniswap/
├── common/
│   ├── types.ts         # Shared types and interfaces
│   └── utils.ts         # Common utilities and helpers
├── v2/
│   ├── contracts.ts     # V2 contract interactions
│   ├── scanner.ts       # V2 position scanning logic
│   └── calculations.ts  # V2 fee/APR calculations
├── v3/
│   ├── subgraph.ts      # The Graph subgraph integration
│   ├── nft.ts          # NFT Position Manager interactions
│   ├── scanner.ts       # V3 position scanning logic
│   └── calculations.ts  # V3 advanced calculations
├── adapter.ts           # API integration adapter
├── index.ts            # Main service entry point
└── README.md           # This file
```

## Features

### Uniswap V2 Integration
- **Contract Scanning**: Direct interaction with V2 Factory and Pair contracts
- **LP Position Detection**: Scans for LP token balances across all pairs
- **Fee Calculations**: Accurate fee tracking and APR/APY calculations
- **Multi-chain Support**: Works on Ethereum mainnet and compatible chains

### Uniswap V3 Integration
- **Subgraph Integration**: Uses The Graph for comprehensive position data
- **NFT Position Manager**: Direct on-chain interaction with position NFTs
- **Concentrated Liquidity**: Full support for V3's concentrated liquidity model
- **Range Analysis**: In-range/out-of-range detection and efficiency calculations
- **Multi-chain Support**: Ethereum, Arbitrum, Polygon, Base, Optimism, and more

### Advanced Calculations
- **Fee Tracking**: Real-time fee accumulation and collection tracking
- **Impermanent Loss**: Accurate IL calculations for both V2 and V3
- **APR/APY**: Time-weighted return calculations
- **Range Efficiency**: V3-specific concentration and utilization metrics

### Production Features
- **Caching**: Built-in caching system with configurable TTL
- **Error Handling**: Comprehensive error handling with retry logic
- **Rate Limiting**: Respects RPC and subgraph rate limits
- **Provider Integration**: Seamless integration with existing Web3 providers
- **Progress Tracking**: Real-time scan progress updates

## Usage

### Basic Usage

```typescript
import { createUniswapService } from '@/src/production/protocols/uniswap';

// Create service instance
const uniswapService = createUniswapService({
  chains: [UniswapChain.ETHEREUM, UniswapChain.ARBITRUM],
  enableV2: true,
  enableV3: true
});

// Scan positions for a wallet
const results = await uniswapService.scanPositions(
  '0x1234...', // wallet address
  {
    chains: [UniswapChain.ETHEREUM],
    includeV2: true,
    includeV3: true,
    includeInactive: false
  },
  (progress) => {
    console.log(`Progress: ${progress.totalPositionsFound} positions found`);
  }
);

console.log(`Found ${results.totalPositions} positions worth $${results.totalValueUSD}`);
```

### API Integration

```typescript
import { getUniswapAdapter } from '@/src/production/protocols/uniswap/adapter';

// Get adapter instance
const adapter = getUniswapAdapter();

// Scan for API format
const protocolData = await adapter.scanUniswapPositions(
  walletAddress,
  ['uniswap-v2', 'uniswap-v3'],
  ['ethereum', 'arbitrum'],
  (protocol, progress) => {
    console.log(`${protocol}: ${progress}% complete`);
  }
);
```

## Supported Chains

| Chain | V2 | V3 | Subgraph | Notes |
|-------|----|----|----------|--------|
| Ethereum | ✅ | ✅ | ✅ | Full support |
| Arbitrum | ❌ | ✅ | ✅ | V3 only |
| Polygon | ❌ | ✅ | ✅ | V3 only |
| Base | ❌ | ✅ | ✅ | V3 only |
| Optimism | ❌ | ✅ | ✅ | V3 only |
| Avalanche | ❌ | ✅ | ✅ | V3 only |
| BSC | ❌ | ✅ | ✅ | V3 only |

## Configuration

### Service Configuration

```typescript
const config = {
  chains: [UniswapChain.ETHEREUM, UniswapChain.ARBITRUM],
  enableV2: true,
  enableV3: true,
  enableCaching: true,
  cacheConfig: {
    ttl: 300, // 5 minutes
    maxSize: 1000
  },
  v2Config: {
    batchSize: 50,
    maxPairs: 10000,
    minLiquidityUSD: 10
  },
  v3Config: {
    useSubgraph: true,
    useOnChain: true,
    maxPositions: 1000
  }
};
```

### Environment Variables

```bash
# RPC Endpoints (optional, will use defaults if not provided)
ALCHEMY_API_KEY=your_alchemy_key
INFURA_API_KEY=your_infura_key

# Subgraph Endpoints (optional, will use public endpoints)
ETHEREUM_V2_SUBGRAPH_URL=https://...
ETHEREUM_V3_SUBGRAPH_URL=https://...
```

## Error Handling

The integration includes comprehensive error handling:

```typescript
try {
  const results = await uniswapService.scanPositions(address);
} catch (error) {
  if (error instanceof UniswapError) {
    console.error(`Uniswap Error [${error.code}]: ${error.message}`);
    console.error(`Chain: ${error.chain}, Protocol: ${error.protocol}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Performance Considerations

### Scanning Strategy
1. **V2**: Scans popular pairs first, then expands if needed
2. **V3**: Uses subgraph for comprehensive data, falls back to on-chain
3. **Batching**: Processes multiple positions in parallel
4. **Caching**: Caches results to reduce API calls

### Rate Limiting
- Automatic retry with exponential backoff
- Respects RPC provider limits
- Built-in delays between batch requests

### Memory Usage
- Streaming results for large wallets
- Configurable batch sizes
- Automatic cleanup of expired cache entries

## Development

### Adding New Chains

1. Add chain to `UniswapChain` enum in `common/types.ts`
2. Add network configuration to `NETWORK_CONFIGS`
3. Update subgraph URLs if available
4. Test with known wallet addresses

### Adding New Calculations

1. Add calculation interface to appropriate types file
2. Implement calculation in the relevant calculator class
3. Add tests for edge cases
4. Update documentation

### Debugging

Enable debug logging:

```typescript
const service = createUniswapService({
  // ... other config
  providerConfig: {
    logging: { enabled: true, level: 'debug' }
  }
});
```

## API Integration

The integration includes an adapter (`adapter.ts`) that converts Uniswap-specific data to the format expected by the existing scan API. This allows seamless integration with the current frontend.

### Replacing Mock Implementation

To use the real Uniswap implementation instead of mocks:

1. Import the adapter in your scan route
2. Replace mock protocol scanners with adapter calls
3. Update protocol lists to include real Uniswap protocols

See `uniswap-enhanced.ts` for a complete example.

## Testing

### Test Wallets

Use these test wallet addresses for development:

- **Ethereum V2/V3**: `0x7a16fF8270133F063aAb6C9977183D9e72835428`
- **Arbitrum V3**: `0x1234567890123456789012345678901234567890`
- **Polygon V3**: `0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef`

### Manual Testing

```bash
# Test V2 scanning
curl -X POST "http://localhost:3000/api/scan/0x7a16fF8270133F063aAb6C9977183D9e72835428" \
  -H "Content-Type: application/json" \
  -d '{"protocols": ["uniswap-v2"]}'

# Test V3 scanning
curl -X POST "http://localhost:3000/api/scan/0x7a16fF8270133F063aAb6C9977183D9e72835428" \
  -H "Content-Type: application/json" \
  -d '{"protocols": ["uniswap-v3"], "chains": ["ethereum"]}'
```

## Troubleshooting

### Common Issues

1. **RPC Rate Limits**: Increase retry delays or use premium RPC endpoints
2. **Subgraph Sync Issues**: Fall back to on-chain scanning
3. **Large Wallets**: Increase timeouts and batch sizes
4. **Memory Usage**: Reduce max positions and enable streaming

### Performance Tuning

- Adjust batch sizes based on RPC performance
- Enable caching for frequently scanned wallets
- Use multiple RPC endpoints for load distribution
- Optimize subgraph queries for specific use cases

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live position updates
2. **Historical Analysis**: Track position performance over time
3. **Yield Optimization**: Suggest better performing positions
4. **Advanced Analytics**: Portfolio analysis and risk metrics
5. **Cross-DEX Arbitrage**: Identify arbitrage opportunities

## Contributing

1. Follow TypeScript strict mode
2. Add comprehensive error handling
3. Include progress callbacks for long operations
4. Write tests for new calculations
5. Update documentation for API changes