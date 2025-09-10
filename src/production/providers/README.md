# Web3 Providers

Production-ready Web3 providers for Ethereum and Solana blockchains with comprehensive features including automatic failover, retry logic, rate limiting, and health monitoring.

## Features

- 🔄 **Automatic Failover**: Multiple RPC endpoints with intelligent routing
- 🔁 **Retry Logic**: Exponential backoff with configurable jitter
- ⚡ **Rate Limiting**: Token bucket algorithm per endpoint
- 🏥 **Health Monitoring**: Continuous endpoint health checks
- 📊 **Metrics & Logging**: Comprehensive monitoring and debugging
- 🔗 **Connection Pooling**: Efficient connection management
- 🌍 **Multi-Chain**: Support for Ethereum, Solana, and Layer 2s
- 🛡️ **Error Handling**: Comprehensive error classification and recovery

## Quick Start

```typescript
import { ProviderFactory, getProviderForAddress } from './providers';

// Auto-detect chain and get provider
const address = '0x742d35Cc6d54E0532e3Bf2b8ABcCD8e90d3c3f5C';
const provider = await getProviderForAddress(address);
const balance = await provider.getBalance(address);

// Or get specific providers
const ethProvider = await ProviderFactory.getEthereumProvider('mainnet');
const solProvider = await ProviderFactory.getSolanaProvider('mainnet-beta');
```

## Supported Networks

### Ethereum
- **Mainnet**: Production Ethereum network
- **Sepolia**: Test network
- **Arbitrum**: Layer 2 scaling solution
- **Polygon**: Sidechain network  
- **Base**: Coinbase Layer 2

### Solana
- **Mainnet-beta**: Production Solana network
- **Devnet**: Development network
- **Testnet**: Test network

## RPC Providers

### Ethereum
- **Primary**: Infura, Alchemy
- **Secondary**: QuickNode
- **Fallback**: Ankr, Cloudflare, 1RPC (public)

### Solana  
- **Primary**: Helius, QuickNode
- **Secondary**: Alchemy
- **Fallback**: Solana Labs, Serum, Ankr (public)

## Configuration

### Environment Variables

Copy `.env.example.providers` to `.env` and configure your API keys:

```bash
# Ethereum
INFURA_MAINNET_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID
ALCHEMY_MAINNET_URL=https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY

# Solana
HELIUS_MAINNET_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
QUICKNODE_SOLANA_URL=https://YOUR_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_API_KEY/
```

### Custom Configuration

```typescript
import { getEthereumConfig, createEthereumProvider } from './providers';

const config = getEthereumConfig('mainnet');
config.rateLimiting.globalLimit = 200;
config.healthCheck.interval = 30000;

const provider = createEthereumProvider(config);
await provider.initialize();
```

## Usage Examples

### Basic Operations

```typescript
import { ProviderFactory } from './providers';

// Ethereum
const ethProvider = await ProviderFactory.getEthereumProvider();
const blockNumber = await ethProvider.getBlockNumber();
const balance = await ethProvider.getBalance('0x742d35Cc6d54E0532e3Bf2b8ABcCD8e90d3c3f5C');
const transaction = await ethProvider.getTransaction('0x...');

// Solana
const solProvider = await ProviderFactory.getSolanaProvider();
const slot = await solProvider.getSlot();
const account = await solProvider.getAccountInfo('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
const tokenAccounts = await solProvider.getTokenAccountsByOwner('9WzD...', { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' });
```

### Multi-Chain Provider

```typescript
import { MultiChainProvider, PROVIDER_PRESETS } from './providers';

const multiProvider = new MultiChainProvider(
  PROVIDER_PRESETS.PRODUCTION.ethereum,
  PROVIDER_PRESETS.PRODUCTION.solana
);

await multiProvider.initialize();

// Auto-routing based on address format
const ethBalance = await multiProvider.getBalance('0x742d35Cc...');
const solBalance = await multiProvider.getBalance('9WzDXwBbmkg...');
```

### Batch Requests

```typescript
// Ethereum batch request
const ethProvider = await ProviderFactory.getEthereumProvider();
const results = await ethProvider.batchRequest([
  { method: 'eth_getBalance', params: ['0x742d35Cc...', 'latest'] },
  { method: 'eth_getTransactionCount', params: ['0x742d35Cc...', 'latest'] },
  { method: 'eth_blockNumber' }
]);

// Solana batch request  
const solProvider = await ProviderFactory.getSolanaProvider();
const results = await solProvider.batchRequest([
  { method: 'getBalance', params: ['9WzDXwBbmkg...'] },
  { method: 'getAccountInfo', params: ['9WzDXwBbmkg...'] }
]);
```

### Health Monitoring

```typescript
// Check provider health
const stats = ProviderFactory.getProviderStats();
console.log('Overall health:', stats.overallHealth);
console.log('Ethereum endpoints:', stats.ethereum.endpoints);
console.log('Solana endpoints:', stats.solana.endpoints);

// Individual provider stats
const ethProvider = await ProviderFactory.getEthereumProvider();
console.log('ETH provider healthy:', ethProvider.isHealthy());
console.log('ETH provider stats:', ethProvider.getProviderStats());
```

## Architecture

### Base Provider

All providers extend `AbstractBaseProvider` which includes:
- Connection pooling and management
- Rate limiting with token bucket algorithm
- Health checking and monitoring
- Retry logic with exponential backoff
- Comprehensive error handling and logging

### Provider Factory

`ProviderFactory` provides singleton access to providers:
- Lazy initialization
- Resource management
- Address-based routing
- Health monitoring across all providers

### Multi-Chain Provider

`MultiChainProvider` enables unified access across chains:
- Automatic chain detection from address format
- Unified API for common operations
- Cross-chain balance and account queries

## Error Handling

Providers use comprehensive error classification:

```typescript
// Ethereum errors
NETWORK_ERROR: 'NETWORK_ERROR',           // Retryable
TIMEOUT: 'TIMEOUT',                       // Retryable  
RATE_LIMITED: 'RATE_LIMITED',            // Retryable
INVALID_PARAMS: 'INVALID_PARAMS',        // Non-retryable
EXECUTION_REVERTED: 'EXECUTION_REVERTED' // Non-retryable

// Solana errors  
ACCOUNT_NOT_FOUND: 'ACCOUNT_NOT_FOUND',       // Non-retryable
BLOCK_NOT_AVAILABLE: 'BLOCK_NOT_AVAILABLE',   // Retryable
INSUFFICIENT_FUNDS_FOR_FEE: 'INSUFFICIENT_FUNDS_FOR_FEE' // Non-retryable
```

## Configuration Options

### Rate Limiting
```typescript
rateLimiting: {
  enabled: true,
  globalLimit: 100,        // Requests per window
  perEndpointLimit: 50,    // Requests per endpoint per window
  windowMs: 60000         // Rate limit window
}
```

### Health Checks
```typescript
healthCheck: {
  enabled: true,
  interval: 60000,        // Check interval in ms
  timeout: 10000,         // Check timeout in ms  
  failureThreshold: 3     // Failures before marking down
}
```

### Retry Configuration
```typescript
retryConfig: {
  maxRetries: 3,
  baseDelay: 1000,        // Base delay in ms
  maxDelay: 8000,         // Max delay in ms
  backoffFactor: 2,       // Exponential backoff factor
  jitter: true            // Add randomization to delays
}
```

### Connection Pooling
```typescript
connectionPool: {
  maxConnections: 10,     // Max concurrent connections
  idleTimeout: 30000,     // Idle connection timeout
  connectionTimeout: 10000, // Connection establishment timeout
  keepAlive: true         // Enable HTTP keep-alive
}
```

## Testing

Run the test suite:

```typescript
import { runAllTests } from './providers/test';
await runAllTests();
```

Tests include:
- Address detection and validation
- Provider initialization
- Configuration presets
- Multi-chain routing
- Error handling
- Health monitoring

## Best Practices

1. **Use Environment Variables**: Store API keys securely
2. **Handle Errors Gracefully**: Check error codes and retry appropriately
3. **Monitor Health**: Regularly check provider health status
4. **Rate Limit Awareness**: Respect provider rate limits
5. **Batch Requests**: Use batch operations when possible
6. **Resource Cleanup**: Call `destroy()` when done

## Performance Considerations

- **Connection Pooling**: Reuses connections for better performance
- **Intelligent Routing**: Prioritizes healthy, low-latency endpoints  
- **Batch Operations**: Reduces network roundtrips
- **Rate Limiting**: Prevents API quota exhaustion
- **Caching**: Results cached where appropriate

## Security Features

- **Input Validation**: All addresses and parameters validated
- **Rate Limiting**: Prevents abuse and quota exhaustion
- **Error Sanitization**: Sensitive data removed from error messages
- **Timeout Protection**: All requests have configurable timeouts

## Monitoring & Debugging

Enable detailed logging:

```typescript
const config = getEthereumConfig('mainnet');
config.logging.level = 'debug';
config.logging.includeMetrics = true;
```

Metrics tracked per endpoint:
- Total requests
- Success/failure rates  
- Average latency
- Requests per second
- Health status
- Error rates

## Contributing

When adding new providers or features:
1. Extend `AbstractBaseProvider`
2. Implement required abstract methods
3. Add comprehensive error handling
4. Include health checks
5. Add tests and documentation
6. Follow TypeScript strict mode