# PositionCard Component

A sophisticated, interactive card component for displaying LP position information with glassmorphism styling and comprehensive details.

## Features

### Visual Status Indicators
- **In Range**: Green status badge with target icon
- **Out of Range**: Red status badge indicating position needs attention
- Color-coded status affects badges, borders, and visual elements

### Glassmorphism Styling
- Semi-transparent background with backdrop blur
- Subtle border with opacity variations
- Hover effects with enhanced transparency and shadows
- Smooth transitions and animations

### Position Information Display
- **Protocol Integration**: Logo and name display
- **Chain Support**: Ethereum, Solana, Arbitrum, Polygon, Base
- **Token Pair**: Symbol display with amounts
- **Key Metrics**: Value, fees earned, APR, liquidity in card format

### Expandable Details
- **Price Range Visualization**: Interactive progress bar showing current price position
- **Additional Metrics**: APY, impermanent loss, yield data
- **Position Metadata**: ID, creation date, last updated
- **Smooth Animation**: Slide-in animation for expanded content

### External Protocol Links
- **Manage Button**: Direct links to protocol interfaces
- **External Link Icon**: Clear indication of external navigation
- **Protocol-Specific URLs**: Support for all major DEX interfaces

### Responsive Design
- **Grid Layout**: Optimized for various screen sizes
- **Compact Mode**: Simplified layout for dense listings
- **Touch-Friendly**: Proper sizing for mobile interactions

## Usage

```tsx
import { PositionCard } from '@/components/dashboard';
import { Position } from '@/types';

// Basic usage
<PositionCard
  position={position}
  onClick={(pos) => handlePositionClick(pos)}
  showManageButton={true}
  compact={false}
/>

// Compact mode for lists
<PositionCard
  position={position}
  compact={true}
  showManageButton={false}
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `position` | `Position` | **required** | LP position data object |
| `onClick` | `(position: Position) => void` | `undefined` | Click handler for card interaction |
| `showManageButton` | `boolean` | `true` | Display external protocol management link |
| `compact` | `boolean` | `false` | Use compact layout without expansion |

## Position Data Requirements

The component expects a `Position` object with the following structure:

```typescript
interface Position {
  id: string;                    // Unique position identifier
  protocol: ProtocolType;        // Protocol name (uniswap-v3, etc.)
  chain: ChainType;             // Blockchain (ethereum, solana, etc.)
  pool: string;                 // Pool name (ETH/USDC)
  poolAddress: string;          // Pool contract address
  liquidity: number;            // Liquidity amount
  value: number;                // USD value
  feesEarned: number;           // Total fees earned
  apr: number;                  // Annual percentage rate
  apy: number;                  // Annual percentage yield
  inRange: boolean;             // Position range status
  tokens: TokenPair;            // Token pair information
  createdAt: string;            // ISO date string
  updatedAt: string;            // ISO date string
  manageUrl?: string;           // External management URL
  priceRange?: {                // Price range information
    lower: number;
    upper: number;
    current: number;
  };
  yield24h?: number;            // 24h yield percentage
  impermanentLoss?: number;     // IL percentage
}
```

## Styling

The component uses Tailwind CSS with custom glassmorphism utilities:

- **Background**: `bg-white/5 backdrop-blur-md`
- **Borders**: `border-white/10` with hover states
- **Hover Effects**: Enhanced opacity and shadow
- **Status Colors**: Green for in-range, red for out-of-range
- **Metric Cards**: Individual glassmorphism containers

## Accessibility

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Focus Management**: Clear focus indicators
- **Color Contrast**: Accessible color combinations

## Examples

See `PositionCard.example.tsx` for comprehensive usage examples including:
- Different position states (in-range vs out-of-range)
- Various protocol types
- Compact vs full layouts
- Interactive demonstrations

## Protocol Support

The component supports all major LP protocols:

### Ethereum
- Uniswap V2/V3
- SushiSwap
- Curve Finance
- Balancer

### Solana
- Meteora DLMM
- Raydium CLMM
- Orca Whirlpools
- Lifinity
- Jupiter

### L2 Networks
- Arbitrum (Uniswap V3)
- Polygon (Uniswap V3)
- Base (Uniswap V3)

## Performance

- **Lazy Loading**: Images loaded on demand
- **Efficient Rendering**: Optimized re-render cycles
- **Smooth Animations**: Hardware-accelerated transitions
- **Memory Management**: Proper cleanup and optimization