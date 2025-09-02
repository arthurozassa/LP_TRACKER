# Chain Detection Utility

A comprehensive TypeScript utility for detecting and validating blockchain addresses across Ethereum and Solana ecosystems, built for the Universal LP Position Tracker.

## Features

- **Multi-Chain Support**: Ethereum (including L2s) and Solana
- **Auto-Detection**: Automatically detect chain type from address format
- **Network Mapping**: Support for Arbitrum, Polygon, Base, and Optimism
- **Protocol Integration**: Pre-configured protocol support per network
- **Robust Validation**: Strict validation with detailed error reporting
- **TypeScript First**: Full TypeScript support with strict mode compatibility
- **Performance Optimized**: Fast regex-based validation
- **Error Handling**: Custom error types for better debugging

## Supported Networks

### Ethereum Ecosystem
- **Ethereum Mainnet** - Uniswap V2/V3, SushiSwap, Curve, Balancer
- **Arbitrum One** - Uniswap V3, SushiSwap, Curve, Camelot, Ramses
- **Polygon** - Uniswap V3, SushiSwap, QuickSwap, Gamma
- **Base** - Uniswap V3, SushiSwap, Aerodrome, Velodrome
- **Optimism** - Uniswap V3, SushiSwap, Velodrome, Beethoven X

### Solana Ecosystem
- **Solana Mainnet** - Meteora DLMM, Raydium CLMM, Orca Whirlpools, Lifinity, Jupiter

## Quick Start

```typescript
import { 
  validateAddress, 
  detectChainFromAddress, 
  getScanNetworks,
  isValidAddress 
} from '@/utils/chains';

// Basic validation
const address = '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503';
const isValid = isValidAddress(address); // true
const chain = detectChainFromAddress(address); // 'ethereum'

// Get networks to scan
const networks = getScanNetworks(address); 
// ['ethereum', 'arbitrum', 'polygon', 'base', 'optimism']

// Detailed validation
const result = validateAddress(address);
console.log(result);
// {
//   isValid: true,
//   chain: 'ethereum',
//   network: 'ethereum'
// }
```

## API Reference

### Core Functions

#### `validateAddress(address: string, config?: ValidationConfig): AddressValidationResult`
Comprehensive address validation with detailed results.

```typescript
const result = validateAddress('0x123...', {
  strictValidation: true,
  supportedNetworks: ['ethereum', 'arbitrum']
});
```

#### `detectChainFromAddress(address: string): SupportedChain | null`
Detects chain type from address format.

```typescript
const chain = detectChainFromAddress('J1S9H3Q...'); // 'solana'
```

#### `autoDetectScanningNetwork(address: string)`
Auto-detects the best networks for scanning based on address.

```typescript
const detection = autoDetectScanningNetwork(address);
// {
//   networks: ['ethereum', 'arbitrum', 'polygon', 'base', 'optimism'],
//   primaryNetwork: 'ethereum',
//   chain: 'ethereum'
// }
```

### Validation Functions

#### `isValidEthereumAddress(address: string): boolean`
Validates Ethereum address format using regex `/^0x[a-fA-F0-9]{40}$/`.

#### `isValidSolanaAddress(address: string): boolean`
Validates Solana address format using regex `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`.

#### `isValidAddressForChain(address: string, chain: SupportedChain): boolean`
Checks if address is valid for a specific chain.

### Utility Functions

#### `getSupportedProtocols(network: AllNetworks): string[]`
Gets all supported DEX protocols for a network.

#### `getChainInfo(network: AllNetworks): ChainInfo`
Gets complete chain configuration including RPC URLs and block explorers.

#### `normalizeAddress(address: string, chain: SupportedChain): string`
Normalizes address format (lowercase for Ethereum, case-sensitive for Solana).

### Convenience Functions

```typescript
// Quick checks
isValidAddress(address); // boolean
getChainType(address); // SupportedChain | null
getPrimaryNetwork(address); // AllNetworks | null

// Address info for display
getAddressInfo(address);
// {
//   address: string,
//   chain: SupportedChain | null,
//   isValid: boolean,
//   displayName: string,
//   explorerUrl: string | null
// }
```

## Address Format Validation

### Ethereum Addresses
- **Format**: `0x` + 40 hexadecimal characters
- **Regex**: `/^0x[a-fA-F0-9]{40}$/`
- **Examples**: 
  - ✅ `0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503`
  - ❌ `0x123` (too short)
  - ❌ `47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503` (missing 0x)

### Solana Addresses
- **Format**: Base58 string, 32-44 characters
- **Regex**: `/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`
- **Examples**:
  - ✅ `J1S9H3QjnRtBbbuD4HjPV6RpRhwuk4zKbxsnCHuTgh9w`
  - ❌ `0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503` (wrong format)
  - ❌ `123` (too short)

## Error Handling

The utility provides custom error types for better error handling:

```typescript
import { ChainDetectionError, InvalidAddressError, UnsupportedChainError } from '@/utils/chains';

try {
  const result = detectNetworkFromAddress(address);
} catch (error) {
  if (error instanceof InvalidAddressError) {
    console.log('Invalid address format:', error.address);
  } else if (error instanceof UnsupportedChainError) {
    console.log('Unsupported chain:', error.message);
  } else if (error instanceof ChainDetectionError) {
    console.log('Detection error:', error.code, error.message);
  }
}
```

## Configuration

### Validation Config
```typescript
interface ValidationConfig {
  allowTestnets?: boolean;
  strictValidation?: boolean;
  supportedNetworks?: AllNetworks[];
}

const config: ValidationConfig = {
  allowTestnets: false,
  strictValidation: true,
  supportedNetworks: ['ethereum', 'arbitrum', 'polygon']
};
```

### Default Demo Addresses
```typescript
import { DEMO_ADDRESSES } from '@/utils/chains';

console.log(DEMO_ADDRESSES.SOLANA_WHALE); // J1S9H3Q...
console.log(DEMO_ADDRESSES.ETHEREUM_LP);  // 0x47ac0f...
console.log(DEMO_ADDRESSES.JUPITER_TRADER); // 9WzDXw...
```

## Performance

The utility is optimized for performance:
- Regex-based validation (microsecond speed)
- No external dependencies
- Cached configurations
- Batch processing support

Typical performance: **~10,000+ validations per second**

## Testing

Run the built-in tests:

```typescript
import { runChainDetectionTests, demonstrateUsage } from '@/utils/chains/test';

// Run comprehensive tests
const testResults = runChainDetectionTests();
console.log(`Tests: ${testResults.passed} passed, ${testResults.failed} failed`);

// See usage examples
demonstrateUsage();
```

## Integration with LP Scanner

This utility integrates seamlessly with the LP Position Scanner:

```typescript
import { validateAddress, getScanNetworks, getSupportedProtocols } from '@/utils/chains';

async function scanLPPositions(walletAddress: string) {
  // Validate address
  const validation = validateAddress(walletAddress);
  if (!validation.isValid) {
    throw new Error(`Invalid address: ${validation.error}`);
  }

  // Get networks to scan
  const networks = getScanNetworks(walletAddress);
  
  // Scan each network
  for (const network of networks) {
    const protocols = getSupportedProtocols(network);
    
    for (const protocol of protocols) {
      // Scan protocol on network
      await scanProtocolPositions(walletAddress, network, protocol);
    }
  }
}
```

## TypeScript Types

All major types are exported for use throughout the application:

```typescript
import type { 
  SupportedChain,
  AllNetworks,
  ChainInfo,
  AddressValidationResult,
  NetworkDetectionResult,
  ValidationConfig
} from '@/utils/chains';
```