# Protocol Management URLs

This module provides comprehensive URL generation utilities for managing LP positions across different DEX protocols on various chains.

## Features

- ✅ **Universal Protocol Support**: Supports 15+ major DEX protocols across Ethereum, Solana, Arbitrum, Polygon, and Base
- ✅ **Smart URL Generation**: Generates protocol-specific management URLs with proper parameters
- ✅ **Fallback Handling**: Provides fallback URLs when specific position data is unavailable
- ✅ **Chain-Specific Modifications**: Applies chain-specific URL modifications for L2 protocols
- ✅ **Type Safety**: Full TypeScript support with proper type definitions
- ✅ **Parameter Validation**: Validates required parameters for each protocol

## Supported Protocols

### Ethereum
- **Uniswap V2**: `https://app.uniswap.org/#/pools/v2/{poolAddress}`
- **Uniswap V3**: `https://app.uniswap.org/#/pool/{positionId}`
- **SushiSwap**: `https://app.sushi.com/pools/{poolAddress}`
- **Curve Finance**: `https://curve.fi/{poolAddress}`
- **Balancer**: `https://app.balancer.fi/pool/{poolAddress}`

### Layer 2 Networks
- **Uniswap V3 (Arbitrum)**: `https://app.uniswap.org/#/pool/{positionId}?chain=arbitrum`
- **Uniswap V3 (Polygon)**: `https://app.uniswap.org/#/pool/{positionId}?chain=polygon`
- **Uniswap V3 (Base)**: `https://app.uniswap.org/#/pool/{positionId}?chain=base`

### Solana
- **Meteora DLMM**: `https://app.meteora.ag/dlmm/{poolAddress}`
- **Raydium CLMM**: `https://raydium.io/clmm/pools/{poolAddress}`
- **Orca Whirlpools**: `https://www.orca.so/pools/{poolAddress}`
- **Lifinity**: `https://lifinity.io/pools/{poolAddress}`
- **Jupiter**: `https://jup.ag/liquidity/{poolAddress}`

## Usage

### Basic URL Generation

```typescript
import { generateManageUrl, ManageUrlParams } from './manageUrls';

const params: ManageUrlParams = {
  protocol: 'uniswap-v3',
  positionId: '12345',
  chain: 'ethereum'
};

const url = generateManageUrl(params);
// Result: "https://app.uniswap.org#/pool/12345"
```

### From Position Data

```typescript
import { 
  generateManageUrlWithFallback, 
  extractUrlParamsFromPosition 
} from './manageUrls';

const position = {
  id: 'pos-123',
  protocol: 'uniswap-v3',
  chain: 'ethereum',
  poolAddress: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
  // ... other position data
};

const urlParams = extractUrlParamsFromPosition(position);
const manageUrl = generateManageUrlWithFallback(urlParams);
```

### Get Protocol Button Text

```typescript
import { getProtocolManageButtonText } from './manageUrls';

const buttonText = getProtocolManageButtonText('uniswap-v3');
// Result: "Uniswap V3"
```

### Validate Parameters

```typescript
import { validateUrlParams } from './manageUrls';

const params = {
  protocol: 'uniswap-v3',
  chain: 'ethereum'
  // Missing required positionId
};

const validation = validateUrlParams(params);
// Result: { valid: false, missing: ['position ID'] }
```

## Protocol Configuration

Each protocol is configured with specific requirements:

```typescript
interface ProtocolManageConfig {
  baseUrl: string;                    // Base URL for the protocol
  supportedChains: ChainType[];       // Supported blockchain networks
  urlTemplate: string;                // URL template with placeholders
  requiresPositionId?: boolean;       // Requires NFT position ID
  requiresTokenAddresses?: boolean;   // Requires token pair addresses
  requiresFeeTier?: boolean;         // Requires fee tier information
}
```

## URL Template Placeholders

- `{positionId}`: NFT position ID for V3 protocols
- `{poolAddress}`: Pool contract address
- `{tokenA}/{tokenB}`: Token pair addresses (for protocols that use token-based routing)
- `{feeTier}`: Fee tier (e.g., 500, 3000, 10000)

## Chain-Specific Modifications

L2 protocols automatically apply chain-specific URL modifications:

```typescript
// Arbitrum example
const originalUrl = "https://app.uniswap.org#/pool/12345";
const modifiedUrl = "https://app.uniswap.org#/pool/12345?chain=arbitrum";
```

## Error Handling

The system includes comprehensive error handling:

1. **Protocol not found**: Returns `#` and logs warning
2. **Chain not supported**: Returns `#` and logs warning
3. **Missing required parameters**: Falls back to base protocol URL
4. **Import errors**: Falls back to simple URL generation

## Integration with PositionCard

The PositionCard component automatically uses these utilities:

```typescript
// In PositionCard.tsx
import { hasValidManageUrl, getPositionManageUrl } from './PositionCard.utils';

// Check if position has manage URL
if (hasValidManageUrl(position)) {
  const manageUrl = getPositionManageUrl(position);
  // Show manage button with protocol-specific styling
}
```

## Testing

Run the test suite to verify functionality:

```bash
node test-manage-urls.js
```

The test covers:
- URL generation for all supported protocols
- Protocol button text generation
- Parameter validation
- Position data extraction
- Fallback URL handling

## Adding New Protocols

To add a new protocol:

1. **Add to PROTOCOL_MANAGE_CONFIGS**:
```typescript
'new-protocol': {
  baseUrl: 'https://newprotocol.com',
  supportedChains: ['ethereum'],
  urlTemplate: '/pools/{poolAddress}',
}
```

2. **Add to button text mapping**:
```typescript
// In getProtocolManageButtonText()
'new-protocol': 'New Protocol'
```

3. **Add chain-specific modifications if needed**:
```typescript
// In CHAIN_URL_MODIFIERS if special handling required
```

4. **Update tests**:
```javascript
// Add test cases for the new protocol
```

## Security Considerations

- All external links open in new tabs with `noopener,noreferrer`
- URL generation validates input parameters
- Fallback handling prevents broken links
- No user data is included in URLs unless explicitly required by the protocol

## Performance

- URL generation is lightweight and synchronous
- Dynamic imports prevent bundle size impact
- Caching considerations for repeated URL generation
- Error boundaries prevent crashes from URL generation failures